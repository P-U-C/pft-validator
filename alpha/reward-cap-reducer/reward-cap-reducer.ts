/**
 * Evidence-Weighted Reward Cap Reducer
 *
 * Deterministic tokenomics reducer that converts evidence visibility,
 * verification confidence, queue status, and abuse-risk flags into
 * safe reward eligibility states. Does NOT calculate final payouts --
 * it produces cap signals consumed by downstream emission logic.
 *
 * Integration point: plugs into Task Node scoring surfaces downstream
 * of artifact-visibility.ts (visibility states) and reviewer-queue-
 * triage.ts (queue aging/urgency). This reducer consumes their output
 * and produces reward eligibility -- it does NOT overlap with payment
 * routing, fee splitting, or ledger writes.
 *
 * Key invariant: reviewer delay alone MUST NOT penalize the submitter.
 * A stale queue item with verified evidence gets full eligibility.
 * Only evidence quality, visibility, and abuse risk affect the cap.
 *
 * Task ID: e18618a0-f24d-45fa-92a9-59205cc8f183
 */

// -- Input Contract --------------------------------------------------------

/** Evidence visibility state (from artifact-visibility.ts). */
export type EvidenceVisibility = "public" | "private" | "obfuscated" | "legacy";

/** How confident the system is in the evidence verification. */
export type VerificationConfidence =
  | "high"      // public URL verified + hash match + proof layers pass
  | "medium"    // reviewer-verifiable (gated) + hash match
  | "low"       // hash only, no URL or reviewer attestation pending
  | "attested"  // legacy: reviewer manually attested, no machine verification
  | "none";     // no evidence, no hash, no attestation

/** Queue status from the triage reducer. */
export type QueueStatus =
  | "fresh"
  | "aging"
  | "stale"
  | "deadlocked"
  | "completed"
  | "withdrawn";

/** Abuse-risk flags -- each is independently assessable. */
export interface AbuseRiskFlags {
  duplicate_submission: boolean;      // same or near-identical content submitted before
  collision_with_other_task: boolean;  // overlaps with another active task's scope
  sybil_flagged_producer: boolean;    // producer address is in a sybil cluster
  velocity_anomaly: boolean;          // abnormal submission speed (too many too fast)
  reward_concentration_risk: boolean; // producer would exceed concentration threshold
}

/** Input to the reward cap reducer. */
export interface RewardCapInput {
  task_id: string;
  submission_id: string;

  // Base reward from task definition
  base_reward_pft: number;

  // Evidence quality signals
  evidence_visibility: EvidenceVisibility;
  verification_confidence: VerificationConfidence;

  // Queue state (from triage reducer)
  queue_status: QueueStatus;
  queue_age_days: number | null;
  reviewer_verified: boolean;

  // Abuse risk
  risk_flags: AbuseRiskFlags;

  // Metadata
  producer_address: string;
  task_category: string | null;
}

// -- Output Contract -------------------------------------------------------

/** Reward eligibility state -- the core output. */
export type RewardEligibility =
  | "full_eligible"    // no restrictions, full base reward available
  | "capped"           // eligible but multiplier < 1.0 due to evidence quality
  | "review_hold"      // eligible pending human review completion
  | "evidence_hold"    // blocked until evidence is upgraded or verified
  | "blocked"          // ineligible due to abuse risk or policy violation
  | "withdrawn";       // submission withdrawn, no reward

/** Reason codes for the eligibility decision -- auditable. */
export type ReasonCode =
  | "evidence_public_verified"
  | "evidence_private_hash_verified"
  | "evidence_obfuscated_verified"
  | "evidence_legacy_attested"
  | "evidence_legacy_unattested"
  | "evidence_missing"
  | "evidence_low_confidence"
  | "reviewer_not_yet_verified"
  | "duplicate_detected"
  | "collision_detected"
  | "sybil_flagged"
  | "velocity_anomaly"
  | "concentration_risk"
  | "submission_withdrawn"
  | "queue_stale_no_fault";

/** Cap multiplier components -- auditable breakdown. */
export interface CapComponents {
  visibility_factor: number;    // 0.0-1.0 based on evidence visibility
  confidence_factor: number;    // 0.0-1.0 based on verification confidence
  risk_factor: number;          // 0.0-1.0 based on abuse risk (1.0 = no risk)
  queue_adjustment: number;     // always 1.0 -- reviewer delay never penalizes
}

/** Safety invariants emitted with every result. */
export interface RewardInvariants {
  reviewer_delay_penalizes_submitter: false;  // hard invariant
  exposes_restricted_evidence: false;         // hard invariant
  cap_below_zero: false;                      // hard invariant
  requires_human_sign_off: boolean;
  blocks_automated_emission: boolean;
}

/** The full reward cap output. */
export interface RewardCapResult {
  task_id: string;
  submission_id: string;

  // Core decision
  eligibility: RewardEligibility;
  cap_multiplier: number;           // 0.0-1.0, applied to base_reward_pft
  capped_reward_pft: number;        // base_reward_pft * cap_multiplier
  reason_codes: ReasonCode[];
  display_label: string;            // short human-readable label for admin UI

  // Decomposition
  cap_components: CapComponents;

  // Safety
  invariants: RewardInvariants;
}

// -- Reducer ---------------------------------------------------------------

/**
 * Pure deterministic reducer: RewardCapInput -> RewardCapResult
 *
 * Decision flow:
 * 1. Check terminal states (withdrawn)
 * 2. Check abuse risk flags (any flag -> blocked or capped)
 * 3. Compute evidence visibility factor
 * 4. Compute verification confidence factor
 * 5. Apply queue adjustment (always 1.0 -- delay never penalizes)
 * 6. Combine into final eligibility + cap
 */
export function computeRewardCap(input: RewardCapInput): RewardCapResult {
  const reasons: ReasonCode[] = [];

  // Terminal: withdrawn
  if (input.queue_status === "withdrawn") {
    reasons.push("submission_withdrawn");
    return buildResult(input, "withdrawn", 0, reasons, "Withdrawn -- no reward");
  }

  // Abuse risk assessment
  const riskResult = assessRisk(input.risk_flags, reasons);
  if (riskResult.blocked) {
    return buildResult(input, "blocked", 0, reasons, riskResult.label);
  }

  // Evidence missing entirely
  if (input.verification_confidence === "none") {
    reasons.push("evidence_missing");
    return buildResult(input, "evidence_hold", 0, reasons, "Evidence missing -- submit evidence to unlock");
  }

  // Compute factors
  const visFactor = computeVisibilityFactor(input.evidence_visibility, reasons);
  const confFactor = computeConfidenceFactor(input.verification_confidence, input.reviewer_verified, reasons);
  const riskFactor = riskResult.factor;

  // Queue adjustment: always 1.0. Reviewer delay does not penalize.
  // If queue is stale, we note it but do NOT reduce the cap.
  const queueAdj = 1.0;
  if (input.queue_status === "stale" || input.queue_status === "deadlocked") {
    reasons.push("queue_stale_no_fault");
  }

  // Combine
  const rawMultiplier = visFactor * confFactor * riskFactor * queueAdj;
  const capMultiplier = clamp(rawMultiplier, 0, 1);

  // Determine eligibility state
  let eligibility: RewardEligibility;
  let label: string;

  if (capMultiplier >= 1.0) {
    eligibility = "full_eligible";
    label = "Full reward eligible";
  } else if (capMultiplier > 0) {
    // Check if we need human review
    const needsHuman = input.evidence_visibility === "legacy"
      || input.verification_confidence === "attested"
      || input.verification_confidence === "low"
      || !input.reviewer_verified;

    if (needsHuman && !input.reviewer_verified) {
      eligibility = "review_hold";
      label = `Review hold -- ${Math.round(capMultiplier * 100)}% cap pending verification`;
    } else {
      eligibility = "capped";
      label = `Capped at ${Math.round(capMultiplier * 100)}% -- ${reasons.join(", ")}`;
    }
  } else {
    eligibility = "evidence_hold";
    label = "Evidence insufficient -- upgrade to unlock reward";
  }

  return {
    task_id: input.task_id,
    submission_id: input.submission_id,
    eligibility,
    cap_multiplier: round(capMultiplier, 4),
    capped_reward_pft: round(input.base_reward_pft * capMultiplier, 2),
    reason_codes: reasons,
    display_label: label,
    cap_components: {
      visibility_factor: round(visFactor, 4),
      confidence_factor: round(confFactor, 4),
      risk_factor: round(riskFactor, 4),
      queue_adjustment: queueAdj,
    },
    invariants: {
      reviewer_delay_penalizes_submitter: false,
      exposes_restricted_evidence: false,
      cap_below_zero: false,
      requires_human_sign_off: eligibility === "review_hold" || input.evidence_visibility === "legacy",
      blocks_automated_emission: eligibility === "blocked" || eligibility === "evidence_hold" || eligibility === "review_hold",
    },
  };
}

// -- Factor Computations ---------------------------------------------------

function computeVisibilityFactor(
  vis: EvidenceVisibility,
  reasons: ReasonCode[],
): number {
  switch (vis) {
    case "public":
      reasons.push("evidence_public_verified");
      return 1.0;
    case "obfuscated":
      reasons.push("evidence_obfuscated_verified");
      return 0.9;   // slight reduction: redacted version, reviewer-gated full
    case "private":
      reasons.push("evidence_private_hash_verified");
      return 0.75;  // hash-verifiable but not publicly inspectable
    case "legacy":
      return 0.5;   // reason added by confidence factor (attested vs unattested)
  }
}

function computeConfidenceFactor(
  conf: VerificationConfidence,
  reviewerVerified: boolean,
  reasons: ReasonCode[],
): number {
  switch (conf) {
    case "high":
      return 1.0;
    case "medium":
      return reviewerVerified ? 0.95 : 0.8;
    case "low":
      reasons.push("evidence_low_confidence");
      return 0.5;
    case "attested":
      reasons.push("evidence_legacy_attested");
      return 0.7;
    case "none":
      reasons.push("evidence_missing");
      return 0;
  }
}

interface RiskAssessment {
  blocked: boolean;
  factor: number;
  label: string;
}

function assessRisk(
  flags: AbuseRiskFlags,
  reasons: ReasonCode[],
): RiskAssessment {
  // Hard blocks: sybil or duplicate
  if (flags.sybil_flagged_producer) {
    reasons.push("sybil_flagged");
    return { blocked: true, factor: 0, label: "Blocked -- sybil-flagged producer" };
  }
  if (flags.duplicate_submission) {
    reasons.push("duplicate_detected");
    return { blocked: true, factor: 0, label: "Blocked -- duplicate submission detected" };
  }

  // Soft caps: collision, velocity, concentration
  let factor = 1.0;

  if (flags.collision_with_other_task) {
    reasons.push("collision_detected");
    factor *= 0.5;
  }
  if (flags.velocity_anomaly) {
    reasons.push("velocity_anomaly");
    factor *= 0.7;
  }
  if (flags.reward_concentration_risk) {
    reasons.push("concentration_risk");
    factor *= 0.8;
  }

  return { blocked: false, factor, label: "" };
}

// -- Helpers ---------------------------------------------------------------

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function round(val: number, decimals: number): number {
  const f = Math.pow(10, decimals);
  return Math.round(val * f) / f;
}

function buildResult(
  input: RewardCapInput,
  eligibility: RewardEligibility,
  capMultiplier: number,
  reasons: ReasonCode[],
  label: string,
): RewardCapResult {
  return {
    task_id: input.task_id,
    submission_id: input.submission_id,
    eligibility,
    cap_multiplier: capMultiplier,
    capped_reward_pft: round(input.base_reward_pft * capMultiplier, 2),
    reason_codes: reasons,
    display_label: label,
    cap_components: {
      visibility_factor: 0,
      confidence_factor: 0,
      risk_factor: 0,
      queue_adjustment: 1.0,
    },
    invariants: {
      reviewer_delay_penalizes_submitter: false,
      exposes_restricted_evidence: false,
      cap_below_zero: false,
      requires_human_sign_off: eligibility === "review_hold" || eligibility === "blocked",
      blocks_automated_emission: eligibility !== "full_eligible" && eligibility !== "capped",
    },
  };
}
