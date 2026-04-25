/**
 * Reviewer Queue Aging Triage Reducer
 *
 * Self-contained Task Node state reducer that classifies reviewer queue
 * items by status, age, evidence visibility, and action urgency.
 *
 * Integration point: plugs into Task Node reviewer queue rendering
 * downstream of the artifact visibility mapper (artifact-visibility.ts).
 * This reducer consumes queue items and produces triage labels --
 * it does NOT overlap with issuance-collision logic, reward holdback,
 * or emissions concentration analysis. Those are separate pipeline
 * stages that consume triage output as one input signal.
 *
 * Visibility/action invariant:
 *   public + live URL          -> review_now, reviewer_verifiable + publicly_openable
 *   private + hash             -> reviewer_verifiable, NOT publicly_openable
 *   obfuscated + hash          -> reviewer_verifiable, redacted display only
 *   legacy                     -> attest_legacy, never open by default
 *   dead URL                   -> contact_producer, never retry-loop forever
 *   missing hash + restricted  -> awaiting_verification
 *   missing timestamp          -> timestamp_missing, repair metadata
 *
 * Task ID: c56bfbe6-ae71-4d02-a3be-eaf4db4cf424
 */

// -- Input Contract --------------------------------------------------------

/** Evidence visibility state (from artifact-visibility spec). */
export type EvidenceVisibility = "public" | "private" | "obfuscated" | "legacy";

/** Authorization state of the task or submission. */
export type AuthorizationState =
  | "authorized"
  | "pending_review"
  | "held"
  | "expired";

/** Current task/submission status. */
export type SubmissionStatus =
  | "submitted"
  | "in_review"
  | "changes_requested"
  | "approved"
  | "rejected"
  | "withdrawn";

/** A single item in the reviewer queue. */
export interface QueueItem {
  task_id: string;
  submission_id: string;
  producer_address: string;

  // Timestamps (ISO strings, may be null for legacy/broken items)
  task_created_at: string | null;
  submitted_at: string | null;
  last_reviewer_action_at: string | null;

  // State
  status: SubmissionStatus;
  evidence_visibility: EvidenceVisibility;
  authorization_state: AuthorizationState;

  // Reviewer assignment
  assigned_reviewer: string | null;
  reviewer_count: number;

  // Evidence metadata (safe to surface)
  has_content_hash: boolean;
  has_url: boolean;
  url_status: "live" | "dead" | "unknown" | null;

  // Optional context
  reward_pft: number;
  task_category: string | null;
}

// -- Output Contract -------------------------------------------------------

export type AgeClass = "fresh" | "normal" | "aging" | "stale" | "unknown";

export type UrgencyLevel = "critical" | "high" | "medium" | "low" | "info";

export type TriageLabel =
  | "fresh_active"
  | "aging_unreviewed"
  | "aging_in_progress"
  | "stale_unreviewed"
  | "stale_in_progress"
  | "reviewer_deadlock"
  | "awaiting_verification"
  | "authorization_hold"
  | "legacy_evidence"
  | "changes_pending"
  | "dead_evidence"
  | "timestamp_missing"
  | "completed"
  | "withdrawn";

export type RecommendedAction =
  | "review_now"
  | "verify_evidence"
  | "request_evidence_upgrade"
  | "escalate"
  | "reassign_or_escalate"
  | "wait_for_producer"
  | "wait_for_authorization"
  | "close"
  | "attest_legacy"
  | "contact_producer"
  | "repair_metadata";

/** Priority decomposition for auditability. */
export interface PriorityComponents {
  age_score: number;
  evidence_score: number;
  authorization_score: number;
  assignment_score: number;
  terminal_penalty: number;
}

/** Safety invariants emitted with every result. */
export interface TriageInvariants {
  exposes_restricted_url: false;
  exposes_producer_private_data: false;
  requires_human_attestation: boolean;
  blocks_reward_emission: boolean;
  safe_for_collaborator_view: boolean;
}

/** The full triage output for a single queue item. */
export interface TriageResult {
  task_id: string;
  submission_id: string;

  triage_label: TriageLabel;
  age_class: AgeClass;
  urgency: UrgencyLevel;
  recommended_action: RecommendedAction;

  // Safe metadata (never leaks restricted evidence)
  age_days: number | null;
  days_since_last_action: number | null;
  has_reviewer: boolean;
  reviewer_verifiable: boolean;
  publicly_openable: boolean;

  // Reviewer-facing status line (contains NO identifiers)
  status_line: string;

  // Sort priority (lower = more urgent)
  sort_priority: number;
  priority_components: PriorityComponents;

  // Protocol safety
  triage_invariants: TriageInvariants;
}

// -- Reducer ---------------------------------------------------------------

const STALE_REVIEWER_DAYS = 10;

export function triageQueueItem(
  item: QueueItem,
  as_of: Date,
): TriageResult {
  const ageDays = computeAgeDays(item.submitted_at, as_of);
  const daysSinceAction = computeAgeDays(item.last_reviewer_action_at, as_of);
  const ageClass = classifyAge(ageDays);
  const verifiable = computeReviewerVerifiable(item);
  const openable = computePubliclyOpenable(item);

  // Terminal states
  if (item.status === "approved" || item.status === "rejected") {
    return buildResult(item, "completed", ageClass, "info", "close", ageDays, daysSinceAction, verifiable, openable, { age_score: 0, evidence_score: 0, authorization_score: 0, assignment_score: 0, terminal_penalty: 999 });
  }
  if (item.status === "withdrawn") {
    return buildResult(item, "withdrawn", ageClass, "info", "close", ageDays, daysSinceAction, verifiable, openable, { age_score: 0, evidence_score: 0, authorization_score: 0, assignment_score: 0, terminal_penalty: 998 });
  }

  // Missing timestamp -- broken queue state, not a happy path
  if (ageDays === null && (item.status === "submitted" || item.status === "in_review")) {
    return buildResult(item, "timestamp_missing", ageClass, "high", "repair_metadata", null, daysSinceAction, verifiable, openable, { age_score: 55, evidence_score: 0, authorization_score: 0, assignment_score: 0, terminal_penalty: 0 });
  }

  // Changes requested
  if (item.status === "changes_requested") {
    const ageScore = ageClass === "stale" ? 50 : 200;
    const urgency: UrgencyLevel = ageClass === "stale" ? "high" : "low";
    return buildResult(item, "changes_pending", ageClass, urgency, "wait_for_producer", ageDays, daysSinceAction, verifiable, openable, { age_score: ageScore, evidence_score: 0, authorization_score: 0, assignment_score: 0, terminal_penalty: 0 });
  }

  // Authorization hold
  if (item.authorization_state === "held" || item.authorization_state === "pending_review") {
    const urgency: UrgencyLevel = item.authorization_state === "held" ? "medium" : "high";
    const authScore = item.authorization_state === "held" ? 150 : 80;
    return buildResult(item, "authorization_hold", ageClass, urgency, "wait_for_authorization", ageDays, daysSinceAction, verifiable, openable, { age_score: 0, evidence_score: 0, authorization_score: authScore, assignment_score: 0, terminal_penalty: 0 });
  }
  if (item.authorization_state === "expired") {
    return buildResult(item, "authorization_hold", ageClass, "high", "escalate", ageDays, daysSinceAction, verifiable, openable, { age_score: 0, evidence_score: 0, authorization_score: 30, assignment_score: 0, terminal_penalty: 0 });
  }

  // Dead evidence
  if (item.has_url && item.url_status === "dead") {
    return buildResult(item, "dead_evidence", ageClass, "high", "contact_producer", ageDays, daysSinceAction, verifiable, openable, { age_score: 0, evidence_score: 40, authorization_score: 0, assignment_score: 0, terminal_penalty: 0 });
  }

  // Legacy evidence
  if (item.evidence_visibility === "legacy") {
    const ageScore = ageClass === "stale" ? 35 : 100;
    const urgency: UrgencyLevel = ageClass === "stale" ? "high" : "medium";
    return buildResult(item, "legacy_evidence", ageClass, urgency, "attest_legacy", ageDays, daysSinceAction, verifiable, openable, { age_score: ageScore, evidence_score: 0, authorization_score: 0, assignment_score: 0, terminal_penalty: 0 });
  }

  // Awaiting verification
  if (!verifiable) {
    const ageScore = ageClass === "stale" ? 15 : 60;
    const urgency: UrgencyLevel = ageClass === "stale" ? "critical" : "high";
    return buildResult(item, "awaiting_verification", ageClass, urgency, "verify_evidence", ageDays, daysSinceAction, verifiable, openable, { age_score: ageScore, evidence_score: 0, authorization_score: 0, assignment_score: 0, terminal_penalty: 0 });
  }

  // Evidence is verifiable -- classify by age and review status
  const isInReview = item.status === "in_review";

  // Reviewer deadlock: in_review + reviewer action is stale (10+ days ago)
  if (isInReview && daysSinceAction !== null && daysSinceAction >= STALE_REVIEWER_DAYS) {
    return buildResult(item, "reviewer_deadlock", ageClass, "critical", "reassign_or_escalate", ageDays, daysSinceAction, verifiable, openable, { age_score: 5, evidence_score: 0, authorization_score: 0, assignment_score: 3, terminal_penalty: 0 });
  }

  if (ageClass === "stale") {
    const label: TriageLabel = isInReview ? "stale_in_progress" : "stale_unreviewed";
    const action: RecommendedAction = isInReview ? "escalate" : "review_now";
    const assignScore = isInReview ? 10 : 5;
    return buildResult(item, label, ageClass, "critical", action, ageDays, daysSinceAction, verifiable, openable, { age_score: assignScore, evidence_score: 0, authorization_score: 0, assignment_score: 0, terminal_penalty: 0 });
  }

  if (ageClass === "aging") {
    const label: TriageLabel = isInReview ? "aging_in_progress" : "aging_unreviewed";
    const assignScore = isInReview ? 45 : 25;
    return buildResult(item, label, ageClass, "high", "review_now", ageDays, daysSinceAction, verifiable, openable, { age_score: assignScore, evidence_score: 0, authorization_score: 0, assignment_score: 0, terminal_penalty: 0 });
  }

  // Fresh or normal
  const baseScore = isInReview ? 120 : 100;
  return buildResult(item, "fresh_active", ageClass, "medium", "review_now", ageDays, daysSinceAction, verifiable, openable, { age_score: baseScore, evidence_score: 0, authorization_score: 0, assignment_score: 0, terminal_penalty: 0 });
}

// -- Batch Reducer ---------------------------------------------------------

export function triageQueue(
  items: QueueItem[],
  as_of: Date,
): TriageResult[] {
  return items
    .map(item => triageQueueItem(item, as_of))
    .sort((a, b) => a.sort_priority - b.sort_priority);
}

// -- Helpers ---------------------------------------------------------------

function computeAgeDays(timestamp: string | null, as_of: Date): number | null {
  if (!timestamp) return null;
  const ts = new Date(timestamp);
  if (isNaN(ts.getTime())) return null;
  return Math.floor((as_of.getTime() - ts.getTime()) / (1000 * 60 * 60 * 24));
}

function classifyAge(days: number | null): AgeClass {
  if (days === null) return "unknown";
  if (days <= 3) return "fresh";
  if (days <= 7) return "normal";
  if (days <= 14) return "aging";
  return "stale";
}

function computeReviewerVerifiable(item: QueueItem): boolean {
  if (item.evidence_visibility === "public" && item.url_status !== "dead") return true;
  if ((item.evidence_visibility === "private" || item.evidence_visibility === "obfuscated") && item.has_content_hash) return true;
  if (item.evidence_visibility === "legacy") return false;
  return item.has_content_hash;
}

function computePubliclyOpenable(item: QueueItem): boolean {
  if (item.evidence_visibility === "public" && item.has_url && item.url_status === "live") return true;
  return false;
}

function computeInvariants(item: QueueItem, label: TriageLabel, verifiable: boolean): TriageInvariants {
  return {
    exposes_restricted_url: false,
    exposes_producer_private_data: false,
    requires_human_attestation: label === "legacy_evidence" || label === "reviewer_deadlock",
    blocks_reward_emission: label === "authorization_hold" || label === "awaiting_verification" || label === "dead_evidence" || label === "timestamp_missing",
    safe_for_collaborator_view: item.evidence_visibility === "public" && verifiable,
  };
}

function buildResult(
  item: QueueItem,
  triage_label: TriageLabel,
  age_class: AgeClass,
  urgency: UrgencyLevel,
  recommended_action: RecommendedAction,
  age_days: number | null,
  days_since_last_action: number | null,
  reviewer_verifiable: boolean,
  publicly_openable: boolean,
  priority_components: PriorityComponents,
): TriageResult {
  const sort_priority = priority_components.age_score
    + priority_components.evidence_score
    + priority_components.authorization_score
    + priority_components.assignment_score
    + priority_components.terminal_penalty;

  return {
    task_id: item.task_id,
    submission_id: item.submission_id,
    triage_label,
    age_class,
    urgency,
    recommended_action,
    age_days,
    days_since_last_action,
    has_reviewer: !!item.assigned_reviewer,
    reviewer_verifiable,
    publicly_openable,
    status_line: formatStatusLine(triage_label, age_days, reviewer_verifiable, publicly_openable, item),
    sort_priority,
    priority_components,
    triage_invariants: computeInvariants(item, triage_label, reviewer_verifiable),
  };
}

function formatStatusLine(
  label: TriageLabel,
  age_days: number | null,
  reviewer_verifiable: boolean,
  publicly_openable: boolean,
  item: QueueItem,
): string {
  const age = age_days !== null ? `${age_days}d old` : "age unknown";
  const evidence = publicly_openable ? "evidence public" : (reviewer_verifiable ? "evidence gated" : "evidence restricted");
  const reviewer = item.assigned_reviewer ? "reviewer assigned" : "unassigned";

  switch (label) {
    case "fresh_active":
      return `Fresh submission (${age}). ${evidence}. ${reviewer}. Ready for review.`;
    case "aging_unreviewed":
      return `Aging (${age}), no reviewer action. ${evidence}. Needs attention.`;
    case "aging_in_progress":
      return `Aging (${age}), review started but incomplete. ${evidence}. Follow up.`;
    case "stale_unreviewed":
      return `STALE (${age}), never reviewed. ${evidence}. Critical -- review immediately or escalate.`;
    case "stale_in_progress":
      return `STALE (${age}), review stalled. ${evidence}. Escalate to senior reviewer.`;
    case "reviewer_deadlock":
      return `DEADLOCK (${age}), reviewer inactive ${item.last_reviewer_action_at ? "since action" : ""}. ${evidence}. Reassign or escalate.`;
    case "awaiting_verification":
      return `Evidence not yet verified (${age}). ${evidence}. Verify URL/hash before proceeding.`;
    case "authorization_hold":
      return `Blocked on authorization (${item.authorization_state}). ${age}. Waiting for policy decision.`;
    case "legacy_evidence":
      return `Legacy evidence (${age}). Pre-dates sharing norms. Requires manual attestation.`;
    case "changes_pending":
      return `Changes requested (${age}). Waiting for producer revision.`;
    case "dead_evidence":
      return `Evidence URL is dead (${age}). Contact producer for updated link or re-submission.`;
    case "timestamp_missing":
      return `Missing submission timestamp. Cannot determine age. Repair metadata before triage.`;
    case "completed":
      return `${item.status === "approved" ? "Approved" : "Rejected"} (${age}). No action needed.`;
    case "withdrawn":
      return `Withdrawn by producer. No action needed.`;
  }
}
