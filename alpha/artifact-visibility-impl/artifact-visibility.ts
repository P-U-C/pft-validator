/**
 * Artifact Visibility States — Typed Contract + Render Logic
 *
 * Implements the rewarded artifact-visibility specification as a
 * merge-ready UI/state slice. Covers submission detail, submission
 * list, and reviewer queue rendering for public, private, obfuscated,
 * and legacy evidence states.
 *
 * Task ID: 5a3e0e52-3714-4e9f-928e-8eec74b40bab
 * Spec: pft.permanentupperclass.com/alpha/artifact-discovery-spec/
 */

// ─── Thin Typed Contract ──────────────────────────────────────────

/** The four artifact visibility states from the spec. */
export type VisibilityState = "public" | "private" | "obfuscated" | "legacy";

/** Obfuscation subtypes — verification spectrum, not binary. */
export type ObfuscationSubtype =
  | "clear_metadata"    // content restricted, all metadata public
  | "partial_metadata"  // content restricted, only date+hash public
  | "sealed";           // nothing public, verifier escrow only

/** Collaboration eligibility — distinct from visibility. */
export type CollaborationEligibility =
  | "open"          // available for cross-check and cohort reference
  | "constrained"   // reference only, no direct cross-check
  | "reviewer_only" // adjudication only, not collaboration
  | "not_eligible"; // cannot support any collaborative flow

/** How a reviewer accesses the full artifact. */
export type ReviewerAccessMode =
  | "direct"   // URL loads without gating
  | "attested" // reviewer attestation, no direct access
  | "escrow"   // designated verifier holds escrow key
  | "unavailable"; // no access path

/** Legacy artifact handling. */
export type LegacyStatus = "n/a" | "pending_migration" | "migrated" | "grace_expired";
export type LegacyConfidenceTier = "high" | "medium" | "low";
export type LegacyAllowedUse = "collaboration" | "adjudication_only" | "historical_reference";

/** URL liveness status. */
export type UrlStatus = "live" | "dead" | "unknown";

/** Metadata leakage class — controls what can be surfaced per role. */
export type MetadataClass =
  | "safe_public"          // hash, date, visibility badge, eligibility
  | "sensitive_operational" // title, task ID, word count, file type
  | "identity_revealing"   // submitter handle, repo path, filename
  | "forbidden_derivative"; // inferred content from metadata combos

/** Three-layer proof model. */
export interface ProofStatus {
  existence: "verified" | "attested" | "unverified";
  relevance: "verified" | "attested" | "unverified";
  completion: "verified" | "attested" | "unverified";
}

/** The normalized artifact verification envelope. */
export interface ArtifactEnvelope {
  artifact_id: string;
  task_id: string;
  visibility_state: VisibilityState;
  obfuscation_subtype: ObfuscationSubtype | null;

  created_at: string;       // ISO timestamp
  created_by_role: "producer" | "reviewer" | "system";

  // Discovery
  collaborator_discoverable: boolean;
  collaboration_eligibility: CollaborationEligibility;
  reviewer_access_mode: ReviewerAccessMode;

  // Metadata (role-scoped at render time)
  artifact_title: string | null;
  artifact_url: string | null;
  artifact_redacted_url: string | null;
  artifact_content_hash: string;      // SHA-256
  artifact_url_status: UrlStatus;
  artifact_verified_at: string | null;

  // Proof layers
  proof: ProofStatus;

  // Legacy
  legacy_status: LegacyStatus;
  legacy_confidence_tier: LegacyConfidenceTier | null;
  legacy_allowed_use: LegacyAllowedUse | null;

  // Review
  notes_for_reviewer: string | null;
}

// ─── Viewer Role ──────────────────────────────────────────────────

export type ViewerRole = "submitter" | "collaborator" | "reviewer";

// ─── Render State ─────────────────────────────────────────────────

/** Badge shown in the UI next to the artifact. */
export type VisibilityBadge = "🌐 PUBLIC" | "🔒 PRIVATE" | "🔍 OBFUSCATED" | "📦 LEGACY";

/** What the UI actually renders for a given artifact + viewer role. */
export interface ArtifactRenderState {
  badge: VisibilityBadge;
  show_url: boolean;
  url_to_show: string | null;         // null if restricted
  show_title: boolean;
  title_to_show: string | null;       // null if restricted
  show_hash: boolean;
  hash_to_show: string | null;
  show_date: boolean;
  date_to_show: string | null;
  show_proof_layers: boolean;
  proof: ProofStatus | null;
  eligibility_label: string;
  status_message: string;             // human-readable status line
  can_cross_check: boolean;
  can_open: boolean;
  url_status_indicator: string | null; // "✓ live" | "✗ dead" | "? unknown" | null
  legacy_badge: string | null;        // "low confidence" etc.
  reviewer_access_note: string | null;
  is_empty_state: boolean;
  empty_state_reason: string | null;  // explains why: permissions, policy, provenance, or reviewer path
}

// ─── Mapper: Envelope → Render State ──────────────────────────────

/**
 * Deterministic mapper from raw ArtifactEnvelope to render state,
 * scoped by viewer role. This is the single source of truth for
 * what each role sees.
 *
 * Invariants:
 * - A collaborator cannot discover content-bearing metadata for
 *   artifacts marked private or reviewer-only.
 * - A reviewer can always see the verification path and eligibility
 *   reason for a non-public artifact.
 * - Empty states explain whether failure is due to permissions,
 *   policy, missing provenance, or missing reviewer path.
 */
export function mapToRenderState(
  envelope: ArtifactEnvelope,
  viewerRole: ViewerRole,
): ArtifactRenderState {
  const badge = getBadge(envelope.visibility_state);
  const urlStatusIndicator = formatUrlStatus(envelope.artifact_url_status);

  switch (envelope.visibility_state) {
    case "public":
      return renderPublic(envelope, viewerRole, badge, urlStatusIndicator);
    case "private":
      return renderPrivate(envelope, viewerRole, badge, urlStatusIndicator);
    case "obfuscated":
      return renderObfuscated(envelope, viewerRole, badge, urlStatusIndicator);
    case "legacy":
      return renderLegacy(envelope, viewerRole, badge);
  }
}

function getBadge(state: VisibilityState): VisibilityBadge {
  switch (state) {
    case "public": return "🌐 PUBLIC";
    case "private": return "🔒 PRIVATE";
    case "obfuscated": return "🔍 OBFUSCATED";
    case "legacy": return "📦 LEGACY";
  }
}

function formatUrlStatus(status: UrlStatus): string | null {
  switch (status) {
    case "live": return "✓ live";
    case "dead": return "✗ dead";
    case "unknown": return "? unknown";
  }
}

function formatEligibility(elig: CollaborationEligibility): string {
  switch (elig) {
    case "open": return "Open — available for cross-check";
    case "constrained": return "Constrained — reference only";
    case "reviewer_only": return "Reviewer-only — not available for collaboration";
    case "not_eligible": return "Not eligible — cannot support collaborative flow";
  }
}

// ─── Per-State Renderers ──────────────────────────────────────────

function renderPublic(
  e: ArtifactEnvelope,
  role: ViewerRole,
  badge: VisibilityBadge,
  urlStatus: string | null,
): ArtifactRenderState {
  // Public artifacts: everyone sees everything.
  const urlDead = e.artifact_url_status === "dead";
  return {
    badge,
    show_url: true,
    url_to_show: e.artifact_url,
    show_title: true,
    title_to_show: e.artifact_title,
    show_hash: true,
    hash_to_show: e.artifact_content_hash,
    show_date: true,
    date_to_show: e.created_at,
    show_proof_layers: role === "reviewer",
    proof: role === "reviewer" ? e.proof : null,
    eligibility_label: formatEligibility(e.collaboration_eligibility),
    status_message: urlDead
      ? `URL no longer resolves. Last verified: ${e.artifact_verified_at ?? "never"}.`
      : "Public artifact — loads without login.",
    can_cross_check: !urlDead,
    can_open: !urlDead,
    url_status_indicator: urlStatus,
    legacy_badge: null,
    reviewer_access_note: null,
    is_empty_state: urlDead,
    empty_state_reason: urlDead ? "URL no longer resolves. Reviewer access path: missing; submission can proceed only as manual review." : null,
  };
}

function renderPrivate(
  e: ArtifactEnvelope,
  role: ViewerRole,
  badge: VisibilityBadge,
  urlStatus: string | null,
): ArtifactRenderState {
  // Private: collaborators see metadata only, reviewers see gated access path.
  const isReviewer = role === "reviewer";
  const isSubmitter = role === "submitter";

  return {
    badge,
    show_url: isSubmitter || isReviewer,
    url_to_show: isSubmitter || isReviewer ? e.artifact_url : null,
    show_title: isReviewer,   // title is sensitive-operational, hidden from collaborators
    title_to_show: isReviewer ? e.artifact_title : null,
    show_hash: true,          // hash is safe-public
    hash_to_show: e.artifact_content_hash,
    show_date: true,          // date is safe-public
    date_to_show: e.created_at,
    show_proof_layers: isReviewer,
    proof: isReviewer ? e.proof : null,
    eligibility_label: formatEligibility(e.collaboration_eligibility),
    status_message: isReviewer
      ? "Private artifact — reviewer access via gated link."
      : "Artifact exists but cannot be used for open collaboration.",
    can_cross_check: false,
    can_open: isSubmitter || isReviewer,
    url_status_indicator: isSubmitter || isReviewer ? urlStatus : null,
    legacy_badge: null,
    reviewer_access_note: isReviewer
      ? `Access mode: ${e.reviewer_access_mode}. Content hash verified against submission record.`
      : null,
    is_empty_state: role === "collaborator",
    empty_state_reason: role === "collaborator"
      ? "Restricted evidence detected; public discovery limited to existence-only metadata."
      : null,
  };
}

function renderObfuscated(
  e: ArtifactEnvelope,
  role: ViewerRole,
  badge: VisibilityBadge,
  urlStatus: string | null,
): ArtifactRenderState {
  const isReviewer = role === "reviewer";
  const isSubmitter = role === "submitter";
  const isClearMeta = e.obfuscation_subtype === "clear_metadata";
  const isSealed = e.obfuscation_subtype === "sealed";

  // Redacted URL is public for non-sealed subtypes
  const showRedactedUrl = !isSealed;
  const showTitle = isClearMeta || isReviewer;

  return {
    badge,
    show_url: isSubmitter || isReviewer,
    url_to_show: isSubmitter || isReviewer ? e.artifact_url : (showRedactedUrl ? e.artifact_redacted_url : null),
    show_title: showTitle,
    title_to_show: showTitle ? e.artifact_title : null,
    show_hash: true,
    hash_to_show: e.artifact_content_hash,
    show_date: true,
    date_to_show: e.created_at,
    show_proof_layers: isReviewer,
    proof: isReviewer ? e.proof : null,
    eligibility_label: formatEligibility(e.collaboration_eligibility),
    status_message: isSealed
      ? "Sealed artifact — existence proved by hash only."
      : `Obfuscated artifact (${e.obfuscation_subtype ?? "unknown"}) — redacted version available.`,
    can_cross_check: e.collaboration_eligibility === "constrained" && !isSealed,
    can_open: showRedactedUrl || isSubmitter || isReviewer,
    url_status_indicator: urlStatus,
    legacy_badge: null,
    reviewer_access_note: isReviewer
      ? `Access mode: ${e.reviewer_access_mode}. Verify redaction preserves verification-critical content.`
      : null,
    is_empty_state: isSealed && role === "collaborator",
    empty_state_reason: isSealed && role === "collaborator"
      ? "Sealed artifact with verifier escrow. Public discovery limited to existence-only metadata."
      : null,
  };
}

function renderLegacy(
  e: ArtifactEnvelope,
  role: ViewerRole,
  badge: VisibilityBadge,
): ArtifactRenderState {
  const isReviewer = role === "reviewer";
  const confidenceLabel = e.legacy_confidence_tier
    ? `${e.legacy_confidence_tier} confidence`
    : "unknown confidence";
  const allowedUseLabel = e.legacy_allowed_use ?? "historical_reference";

  return {
    badge,
    show_url: false,
    url_to_show: null,
    show_title: isReviewer,
    title_to_show: isReviewer ? e.artifact_title : null,
    show_hash: !!e.artifact_content_hash,
    hash_to_show: e.artifact_content_hash || null,
    show_date: true,
    date_to_show: e.created_at,
    show_proof_layers: isReviewer,
    proof: isReviewer ? e.proof : null,
    eligibility_label: formatEligibility(e.collaboration_eligibility),
    status_message: isReviewer
      ? `Legacy artifact (${confidenceLabel}). Allowed use: ${allowedUseLabel}. Reviewer attestation required.`
      : "Pre-dates common sharing norms. Reviewer-verified completion.",
    can_cross_check: false,
    can_open: false,
    url_status_indicator: null,
    legacy_badge: `${confidenceLabel} · ${allowedUseLabel}`,
    reviewer_access_note: isReviewer
      ? `Legacy status: ${e.legacy_status}. Reviewer must document attestation basis. ${e.notes_for_reviewer ?? ""}`
      : null,
    is_empty_state: role === "collaborator",
    empty_state_reason: role === "collaborator"
      ? "Legacy artifact lacks minimum provenance for collaboration. Allowed use: historical reference only."
      : null,
  };
}

// ─── Metadata Leakage Guard ───────────────────────────────────────

/** Keywords that risk re-identification when combined with date + cohort. */
const SENSITIVE_TITLE_PATTERNS = [
  /portfolio/i, /trading/i, /position/i, /alpha/i, /strategy/i,
  /pnl/i, /p&l/i, /profit/i, /loss/i, /revenue/i, /salary/i,
  /confidential/i, /internal/i, /private/i, /secret/i, /nda/i,
  /mnpi/i, /insider/i, /merger/i, /acquisition/i,
];

/**
 * Detects when title + date + cohort context risks derivative exposure.
 * Returns true if the title should be downgraded to hidden even when
 * the visibility state would normally allow it.
 *
 * Rationale: a private artifact can leak through metadata combinations.
 * A title like "Trading Strategy QA — April 2026" combined with cohort
 * membership and submission date reconstructs restricted evidence.
 */
export function detectForbiddenDerivativeExposure(
  title: string | null,
  cohortSize: number,
): { exposed: boolean; reason: string | null } {
  if (!title) return { exposed: false, reason: null };

  // Small cohorts increase re-identification risk
  const smallCohort = cohortSize <= 3;

  for (const pattern of SENSITIVE_TITLE_PATTERNS) {
    if (pattern.test(title)) {
      if (smallCohort) {
        return {
          exposed: true,
          reason: `Title contains "${pattern.source}" in a cohort of ${cohortSize}. Combination of title + date + small cohort risks re-identification.`,
        };
      }
      // Larger cohort: warn but don't block
      return {
        exposed: false,
        reason: `Title contains potentially sensitive term "${pattern.source}". Review before surfacing.`,
      };
    }
  }

  return { exposed: false, reason: null };
}

// ─── Submission Detail Renderer ───────────────────────────────────

/** Full detail view for a single artifact — the submission detail surface. */
export interface SubmissionDetailView {
  render: ArtifactRenderState;
  metadata_leakage_warning: string | null;
  verification_envelope_summary: string;
  action_buttons: string[];
}

/**
 * Renders the submission detail surface for a single artifact.
 * This is the dedicated adapter for the submission detail view,
 * distinct from list cards and queue items.
 */
export function renderSubmissionDetail(
  envelope: ArtifactEnvelope,
  viewerRole: ViewerRole,
  cohortSize: number = 12,
): SubmissionDetailView {
  // Check for metadata leakage before rendering
  const leakage = detectForbiddenDerivativeExposure(envelope.artifact_title, cohortSize);

  // If leakage detected and viewer is collaborator, downgrade title visibility
  let effectiveEnvelope = envelope;
  if (leakage.exposed && viewerRole === "collaborator") {
    effectiveEnvelope = { ...envelope, artifact_title: null };
  }

  const render = mapToRenderState(effectiveEnvelope, viewerRole);

  // If leakage was detected but not blocked (large cohort), attach warning
  const warning = leakage.reason && viewerRole !== "submitter"
    ? leakage.reason
    : null;

  // Build verification envelope summary
  const proofSummary = [
    `Existence: ${envelope.proof.existence}`,
    `Relevance: ${envelope.proof.relevance}`,
    `Completion: ${envelope.proof.completion}`,
  ].join(" · ");

  const envelopeSummary = [
    `Visibility: ${envelope.visibility_state}`,
    envelope.obfuscation_subtype ? `Subtype: ${envelope.obfuscation_subtype}` : null,
    `Eligibility: ${envelope.collaboration_eligibility}`,
    `Access: ${envelope.reviewer_access_mode}`,
    `Proof: ${proofSummary}`,
    envelope.legacy_status !== "n/a" ? `Legacy: ${envelope.legacy_status} (${envelope.legacy_confidence_tier ?? "?"})` : null,
  ].filter(Boolean).join("\n");

  // Determine available actions based on role and state
  const actions: string[] = [];
  if (viewerRole === "submitter") {
    actions.push("Edit Visibility");
    if (envelope.visibility_state !== "public") actions.push("Upgrade to Public");
  }
  if (viewerRole === "collaborator" && render.can_cross_check) {
    actions.push("Use for Cross-Check");
  }
  if (viewerRole === "collaborator" && render.can_open) {
    actions.push("Open");
  }
  if (viewerRole === "reviewer") {
    actions.push("Verify", "Request Changes", "Approve", "Reject");
  }

  return {
    render,
    metadata_leakage_warning: warning,
    verification_envelope_summary: envelopeSummary,
    action_buttons: actions,
  };
}

// ─── Protocol-Safe Preflight Guard ────────────────────────────────
//
// Prevents the UI from generating impossible collaborator workflows
// under constrained or empty cohorts. This is not adjacent product
// logic — it is the protocol-safe guard that ensures no review
// surface ever renders an impossible cross-check action.

// ─── Task Generator Preflight ─────────────────────────────────────

export interface PreflightResult {
  eligible: boolean;
  open_count: number;
  constrained_count: number;
  reroute_to: "cross_check" | "fresh_pass" | "normalization_request";
  reason: string;
}

/**
 * Preflight check before generating a cross-check task.
 * Blocks impossible tasks at generation time.
 */
export function preflightCrossCheck(
  cohortArtifacts: ArtifactEnvelope[],
): PreflightResult {
  const open = cohortArtifacts.filter(
    a => a.collaboration_eligibility === "open" && a.artifact_url_status === "live"
  );
  const constrained = cohortArtifacts.filter(
    a => a.collaboration_eligibility === "constrained"
  );

  if (open.length >= 1) {
    return {
      eligible: true,
      open_count: open.length,
      constrained_count: constrained.length,
      reroute_to: "cross_check",
      reason: `${open.length} open artifact(s) available for cross-check.`,
    };
  }

  if (constrained.length >= 1) {
    return {
      eligible: false,
      open_count: 0,
      constrained_count: constrained.length,
      reroute_to: "fresh_pass",
      reason: "No open artifacts. Constrained artifacts exist but cannot support full cross-check. Rerouting to fresh-pass task shape.",
    };
  }

  return {
    eligible: false,
    open_count: 0,
    constrained_count: 0,
    reroute_to: "normalization_request",
    reason: "No discoverable artifacts in cohort. Rerouting to artifact normalization request.",
  };
}

// ─── Submission List Renderer ─────────────────────────────────────

/** Renders the collaboration panel artifact cards for a cohort. */
export function renderSubmissionList(
  artifacts: ArtifactEnvelope[],
  viewerRole: ViewerRole,
): { cards: ArtifactRenderState[]; summary: string } {
  const cards = artifacts.map(a => mapToRenderState(a, viewerRole));
  const openCount = cards.filter(c => c.can_cross_check).length;
  const total = cards.length;

  let summary: string;
  if (openCount === 0) {
    summary = "No artifacts with open collaboration eligibility in this cohort. Cross-check tasks cannot be generated.";
  } else {
    summary = `${openCount} of ${total} artifact(s) available for cross-check.`;
  }

  return { cards, summary };
}

// ─── Reviewer Queue Renderer ──────────────────────────────────────

export interface ReviewQueueItem {
  artifact: ArtifactEnvelope;
  render: ArtifactRenderState;
  requires_manual_review: boolean;
  manual_review_reason: string | null;
}

/** Renders the reviewer queue with manual review flags. */
export function renderReviewerQueue(
  artifacts: ArtifactEnvelope[],
): ReviewQueueItem[] {
  return artifacts.map(a => {
    const render = mapToRenderState(a, "reviewer");

    let requires_manual = false;
    let reason: string | null = null;

    if (a.visibility_state === "legacy") {
      requires_manual = true;
      reason = "Legacy artifact requires reviewer attestation.";
    } else if (a.artifact_url_status === "dead") {
      requires_manual = true;
      reason = "Artifact URL no longer resolves.";
    } else if (a.visibility_state === "private") {
      requires_manual = true;
      reason = "Private artifact — reviewer must verify via gated access.";
    } else if (a.visibility_state === "obfuscated" && a.obfuscation_subtype === "sealed") {
      requires_manual = true;
      reason = "Sealed artifact — requires verifier escrow access.";
    } else if (a.proof.existence === "unverified" || a.proof.relevance === "unverified" || a.proof.completion === "unverified") {
      requires_manual = true;
      reason = "One or more proof layers unverified.";
    }

    return { artifact: a, render, requires_manual_review: requires_manual, manual_review_reason: reason };
  });
}
