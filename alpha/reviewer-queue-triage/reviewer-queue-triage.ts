/**
 * Reviewer Queue Aging Triage Reducer
 *
 * Self-contained Task Node state reducer that classifies reviewer queue
 * items by status, age, evidence visibility, and action urgency.
 *
 * Integration point: plugs into Task Node reviewer queue rendering
 * downstream of the artifact visibility mapper (artifact-visibility.ts).
 * This reducer consumes queue items and produces triage labels —
 * it does NOT overlap with issuance-collision logic, reward holdback,
 * or emissions concentration analysis. Those are separate pipeline
 * stages that consume triage output as one input signal.
 *
 * Task ID: c56bfbe6-ae71-4d02-a3be-eaf4db4cf424
 */

// ─── Input Contract ───────────────────────────────────────────────

/** Evidence visibility state (from artifact-visibility spec). */
export type EvidenceVisibility = "public" | "private" | "obfuscated" | "legacy";

/** Authorization state of the task or submission. */
export type AuthorizationState =
  | "authorized"       // normal flow, no holds
  | "pending_review"   // awaiting authorization decision
  | "held"             // explicitly held by policy or manual action
  | "expired";         // authorization window lapsed

/** Current task/submission status. */
export type SubmissionStatus =
  | "submitted"        // producer submitted, awaiting review
  | "in_review"        // reviewer has started but not completed
  | "changes_requested" // reviewer sent back for revision
  | "approved"         // review complete, approved
  | "rejected"         // review complete, rejected
  | "withdrawn";       // producer withdrew submission

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
  reviewer_count: number;  // how many reviewers have touched this

  // Evidence metadata (safe to surface)
  has_content_hash: boolean;
  has_url: boolean;
  url_status: "live" | "dead" | "unknown" | null;

  // Optional context
  reward_pft: number;
  task_category: string | null;
}

// ─── Output Contract ──────────────────────────────────────────────

/** Age-based triage classification. */
export type AgeClass =
  | "fresh"     // 0-3 days since submission
  | "normal"    // 4-7 days
  | "aging"     // 8-14 days — needs attention
  | "stale"     // 15+ days — urgent
  | "unknown";  // missing timestamp

/** Overall urgency level for reviewer prioritization. */
export type UrgencyLevel =
  | "critical"  // requires immediate action
  | "high"      // should be handled today
  | "medium"    // handle within 2-3 days
  | "low"       // can wait
  | "info";     // no action needed (approved/rejected/withdrawn)

/** Triage label combining age, evidence, and authorization signals. */
export type TriageLabel =
  | "fresh_active"           // new submission, ready for review
  | "aging_unreviewed"       // getting old, nobody has touched it
  | "aging_in_progress"      // reviewer started but hasn't finished
  | "stale_unreviewed"       // 15+ days, no reviewer action — critical
  | "stale_in_progress"      // reviewer started long ago, stalled
  | "awaiting_verification"  // evidence needs verification before review proceeds
  | "authorization_hold"     // blocked by authorization state
  | "legacy_evidence"        // evidence predates sharing norms, special handling
  | "changes_pending"        // sent back to producer, waiting for revision
  | "dead_evidence"          // URL died, needs re-submission or attestation
  | "completed"              // approved or rejected, no action needed
  | "withdrawn";             // producer withdrew

/** Recommended next action for the reviewer. */
export type RecommendedAction =
  | "review_now"             // open and review
  | "verify_evidence"        // check URL/hash before reviewing content
  | "request_evidence_upgrade" // ask producer to provide public URL or hash
  | "escalate"               // flag for senior reviewer or policy team
  | "wait_for_producer"      // producer has the ball (changes requested)
  | "wait_for_authorization" // blocked on authorization decision
  | "close"                  // no further action (completed/withdrawn)
  | "attest_legacy"          // reviewer must manually attest legacy evidence
  | "contact_producer";      // evidence is broken, reach out

/** The full triage output for a single queue item. */
export interface TriageResult {
  task_id: string;
  submission_id: string;

  // Triage classification
  triage_label: TriageLabel;
  age_class: AgeClass;
  urgency: UrgencyLevel;
  recommended_action: RecommendedAction;

  // Safe metadata (never leaks restricted evidence)
  age_days: number | null;
  days_since_last_action: number | null;
  has_reviewer: boolean;
  evidence_accessible: boolean;

  // Reviewer-facing status line
  status_line: string;

  // Sort priority (lower = more urgent, for queue ordering)
  sort_priority: number;
}

// ─── Reducer ──────────────────────────────────────────────────────

/**
 * Pure reducer: QueueItem → TriageResult
 *
 * Deterministic — same input always produces same output.
 * Uses `as_of` parameter instead of runtime clock for testability.
 *
 * Does not expose restricted evidence details. The status_line
 * contains only safe metadata: age, evidence accessibility state,
 * authorization state, and recommended action.
 */
export function triageQueueItem(
  item: QueueItem,
  as_of: Date,
): TriageResult {
  const ageDays = computeAgeDays(item.submitted_at, as_of);
  const daysSinceAction = computeAgeDays(item.last_reviewer_action_at, as_of);
  const ageClass = classifyAge(ageDays);
  const evidenceAccessible = computeEvidenceAccessible(item);

  // Terminal states — no action needed
  if (item.status === "approved" || item.status === "rejected") {
    return buildResult(item, "completed", ageClass, "info", "close", ageDays, daysSinceAction, evidenceAccessible, 999);
  }
  if (item.status === "withdrawn") {
    return buildResult(item, "withdrawn", ageClass, "info", "close", ageDays, daysSinceAction, evidenceAccessible, 998);
  }

  // Changes requested — ball is with the producer
  if (item.status === "changes_requested") {
    const urgency = ageClass === "stale" ? "high" : "low";
    const priority = ageClass === "stale" ? 50 : 200;
    return buildResult(item, "changes_pending", ageClass, urgency, "wait_for_producer", ageDays, daysSinceAction, evidenceAccessible, priority);
  }

  // Authorization hold — blocked upstream
  if (item.authorization_state === "held" || item.authorization_state === "pending_review") {
    const urgency = item.authorization_state === "held" ? "medium" : "high";
    const priority = item.authorization_state === "held" ? 150 : 80;
    return buildResult(item, "authorization_hold", ageClass, urgency, "wait_for_authorization", ageDays, daysSinceAction, evidenceAccessible, priority);
  }

  if (item.authorization_state === "expired") {
    return buildResult(item, "authorization_hold", ageClass, "high", "escalate", ageDays, daysSinceAction, evidenceAccessible, 30);
  }

  // Dead evidence — URL is broken
  if (item.has_url && item.url_status === "dead") {
    return buildResult(item, "dead_evidence", ageClass, "high", "contact_producer", ageDays, daysSinceAction, evidenceAccessible, 40);
  }

  // Legacy evidence — special handling
  if (item.evidence_visibility === "legacy") {
    const urgency = ageClass === "stale" ? "high" : "medium";
    const priority = ageClass === "stale" ? 35 : 100;
    return buildResult(item, "legacy_evidence", ageClass, urgency, "attest_legacy", ageDays, daysSinceAction, evidenceAccessible, priority);
  }

  // Awaiting verification — private/obfuscated without hash, or URL unknown
  if (!evidenceAccessible) {
    const urgency = ageClass === "stale" ? "critical" : "high";
    const priority = ageClass === "stale" ? 15 : 60;
    return buildResult(item, "awaiting_verification", ageClass, urgency, "verify_evidence", ageDays, daysSinceAction, evidenceAccessible, priority);
  }

  // Evidence is accessible — classify by age and review status
  const isInReview = item.status === "in_review";

  if (ageClass === "stale") {
    const label: TriageLabel = isInReview ? "stale_in_progress" : "stale_unreviewed";
    const action: RecommendedAction = isInReview ? "escalate" : "review_now";
    return buildResult(item, label, ageClass, "critical", action, ageDays, daysSinceAction, evidenceAccessible, isInReview ? 10 : 5);
  }

  if (ageClass === "aging") {
    const label: TriageLabel = isInReview ? "aging_in_progress" : "aging_unreviewed";
    const action: RecommendedAction = isInReview ? "review_now" : "review_now";
    return buildResult(item, label, ageClass, "high", action, ageDays, daysSinceAction, evidenceAccessible, isInReview ? 45 : 25);
  }

  // Fresh or normal
  return buildResult(item, "fresh_active", ageClass, isInReview ? "medium" : "medium", "review_now", ageDays, daysSinceAction, evidenceAccessible, isInReview ? 120 : 100);
}

// ─── Batch Reducer ────────────────────────────────────────────────

/**
 * Triage an entire reviewer queue. Returns items sorted by
 * urgency (sort_priority ascending = most urgent first).
 */
export function triageQueue(
  items: QueueItem[],
  as_of: Date,
): TriageResult[] {
  return items
    .map(item => triageQueueItem(item, as_of))
    .sort((a, b) => a.sort_priority - b.sort_priority);
}

// ─── Helpers ──────────────────────────────────────────────────────

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

function computeEvidenceAccessible(item: QueueItem): boolean {
  // Public with live URL = accessible
  if (item.evidence_visibility === "public" && item.url_status === "live") return true;
  // Public with unknown URL status = assume accessible
  if (item.evidence_visibility === "public" && item.url_status !== "dead") return true;
  // Private/obfuscated with content hash = verifiable (reviewer can access via gate)
  if ((item.evidence_visibility === "private" || item.evidence_visibility === "obfuscated") && item.has_content_hash) return true;
  // Legacy = not accessible without attestation
  if (item.evidence_visibility === "legacy") return false;
  // No hash, no URL = not accessible
  return item.has_content_hash;
}

function buildResult(
  item: QueueItem,
  triage_label: TriageLabel,
  age_class: AgeClass,
  urgency: UrgencyLevel,
  recommended_action: RecommendedAction,
  age_days: number | null,
  days_since_last_action: number | null,
  evidence_accessible: boolean,
  sort_priority: number,
): TriageResult {
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
    evidence_accessible,
    status_line: formatStatusLine(triage_label, age_days, evidence_accessible, item),
    sort_priority,
  };
}

function formatStatusLine(
  label: TriageLabel,
  age_days: number | null,
  evidence_accessible: boolean,
  item: QueueItem,
): string {
  const age = age_days !== null ? `${age_days}d old` : "age unknown";
  const evidence = evidence_accessible ? "evidence accessible" : "evidence restricted";
  const reviewer = item.assigned_reviewer ? `reviewer: ${item.assigned_reviewer.substring(0, 8)}...` : "unassigned";

  switch (label) {
    case "fresh_active":
      return `Fresh submission (${age}). ${evidence}. ${reviewer}. Ready for review.`;
    case "aging_unreviewed":
      return `Aging (${age}), no reviewer action. ${evidence}. Needs attention.`;
    case "aging_in_progress":
      return `Aging (${age}), review started but incomplete. ${evidence}. Follow up.`;
    case "stale_unreviewed":
      return `STALE (${age}), never reviewed. ${evidence}. Critical — review immediately or escalate.`;
    case "stale_in_progress":
      return `STALE (${age}), review stalled. ${evidence}. Escalate to senior reviewer.`;
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
    case "completed":
      return `${item.status === "approved" ? "Approved" : "Rejected"} (${age}). No action needed.`;
    case "withdrawn":
      return `Withdrawn by producer. No action needed.`;
  }
}
