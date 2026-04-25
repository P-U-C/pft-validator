/**
 * Evidence-Weighted Reward Cap Reducer (self-contained artifact)
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
 * Fields that must remain metadata-only for privacy safety:
 *   - producer_address: used for risk lookup, never surfaced in output
 *   - evidence URLs: never loaded, never referenced in display_label
 *   - reviewer identity: not an input to this reducer at all
 *
 * Task ID: e18618a0-f24d-45fa-92a9-59205cc8f183
 */

// -- Input Contract --------------------------------------------------------

export type EvidenceVisibility = "public" | "private" | "obfuscated" | "legacy";

export type VerificationConfidence =
  | "high"       // public URL verified + hash match + proof layers pass
  | "medium"     // reviewer-verifiable (gated) + hash match
  | "low"        // hash only, no URL or reviewer attestation pending
  | "attested"   // legacy: reviewer manually attested, no machine verification
  | "none";      // no evidence, no hash, no attestation

export type QueueStatus =
  | "fresh" | "aging" | "stale" | "deadlocked" | "completed" | "withdrawn";

export interface AbuseRiskFlags {
  duplicate_submission: boolean;
  collision_with_other_task: boolean;
  sybil_flagged_producer: boolean;
  velocity_anomaly: boolean;
  reward_concentration_risk: boolean;
}

export interface RewardCapInput {
  task_id: string;
  submission_id: string;
  base_reward_pft: number;
  evidence_visibility: EvidenceVisibility;
  verification_confidence: VerificationConfidence;
  queue_status: QueueStatus;
  queue_age_days: number | null;
  reviewer_verified: boolean;
  risk_flags: AbuseRiskFlags;
  producer_address: string;
  task_category: string | null;
}

// -- Output Contract -------------------------------------------------------

export type RewardEligibility =
  | "full_eligible"
  | "capped"
  | "review_hold"
  | "evidence_hold"
  | "blocked"
  | "withdrawn";

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
  | "queue_stale_no_fault"
  | "cap_below_auto_emission_floor";

export type ReviewerAction =
  | "approve_cap"
  | "request_public_or_redacted_evidence"
  | "verify_private_metadata"
  | "merge_or_reject_duplicate"
  | "escalate_sybil_review"
  | "attest_legacy_evidence"
  | "no_action_queue_delay_only"
  | "submit_evidence"
  | "no_action";

export interface CapComponents {
  visibility_factor: number;
  confidence_factor: number;
  risk_factor: number;
  queue_adjustment: number;     // always 1.0
  terminal_override: string | null;
}

export interface RewardInvariants {
  reviewer_delay_penalizes_submitter: false;
  exposes_restricted_evidence: false;
  cap_below_zero: false;
  requires_human_sign_off: boolean;
  blocks_automated_emission: boolean;
}

export interface RewardCapResult {
  task_id: string;
  submission_id: string;
  eligibility: RewardEligibility;
  cap_multiplier: number;
  capped_reward_pft: number;
  reason_codes: ReasonCode[];
  dominant_reason: ReasonCode;
  recommended_reviewer_action: ReviewerAction;
  display_label: string;
  cap_components: CapComponents;
  invariants: RewardInvariants;
}

// -- Constants -------------------------------------------------------------

/** Below this cap, auto-emission is not safe -- route to review_hold. */
const MIN_AUTO_CAP_MULTIPLIER = 0.25;

// -- Reducer ---------------------------------------------------------------

export function computeRewardCap(input: RewardCapInput): RewardCapResult {
  const reasons: ReasonCode[] = [];

  // Compute raw factors for forensic components (even if terminal)
  const rawVisFactor = visibilityFactor(input.evidence_visibility);
  const rawConfFactor = confidenceFactor(input.verification_confidence, input.reviewer_verified);

  // Terminal: withdrawn
  if (input.queue_status === "withdrawn") {
    reasons.push("submission_withdrawn");
    return buildTerminal(input, "withdrawn", 0, reasons, "submission_withdrawn", "Withdrawn -- no reward", "no_action", rawVisFactor, rawConfFactor, 1.0, "withdrawn");
  }

  // Abuse risk
  const riskResult = assessRisk(input.risk_flags, reasons);
  if (riskResult.blocked) {
    const action: ReviewerAction = riskResult.blockType === "sybil" ? "escalate_sybil_review" : "merge_or_reject_duplicate";
    return buildTerminal(input, "blocked", 0, reasons, reasons[reasons.length - 1], riskResult.label, action, rawVisFactor, rawConfFactor, 0, riskResult.blockType === "sybil" ? "sybil_block" : "duplicate_block");
  }

  // Evidence missing entirely
  if (input.verification_confidence === "none") {
    reasons.push("evidence_missing");
    return buildTerminal(input, "evidence_hold", 0, reasons, "evidence_missing", "Evidence missing -- submit evidence to unlock", "submit_evidence", rawVisFactor, 0, riskResult.factor, "missing_evidence");
  }

  // Compute factors with reason tracking
  const visFactor = computeVisibilityFactor(input.evidence_visibility, reasons);
  const confFactor = computeConfidenceFactor(input.verification_confidence, input.reviewer_verified, reasons);
  const riskFactor = riskResult.factor;

  // Queue adjustment: always 1.0
  const queueAdj = 1.0;
  if (input.queue_status === "stale" || input.queue_status === "deadlocked") {
    reasons.push("queue_stale_no_fault");
  }

  // Combine
  const rawMultiplier = visFactor * confFactor * riskFactor * queueAdj;
  const capMultiplier = clamp(rawMultiplier, 0, 1);

  // Determine eligibility
  let eligibility: RewardEligibility;
  let label: string;
  let reviewerAction: ReviewerAction;

  if (capMultiplier >= 1.0) {
    eligibility = "full_eligible";
    label = "Full reward eligible";
    reviewerAction = input.queue_status === "stale" || input.queue_status === "deadlocked"
      ? "no_action_queue_delay_only"
      : "approve_cap";
  } else if (capMultiplier > 0 && capMultiplier < MIN_AUTO_CAP_MULTIPLIER) {
    // Below auto-emission floor -- route to human review
    eligibility = "review_hold";
    reasons.push("cap_below_auto_emission_floor");
    label = `Review hold -- ${pct(capMultiplier)} cap below auto-emission floor`;
    reviewerAction = input.evidence_visibility === "legacy"
      ? "attest_legacy_evidence"
      : "verify_private_metadata";
  } else if (capMultiplier > 0) {
    const needsHuman = input.evidence_visibility === "legacy"
      || input.verification_confidence === "attested"
      || input.verification_confidence === "low"
      || !input.reviewer_verified;

    if (needsHuman && !input.reviewer_verified) {
      eligibility = "review_hold";
      label = `Review hold -- ${pct(capMultiplier)} cap pending verification`;
      reviewerAction = input.evidence_visibility === "private"
        ? "verify_private_metadata"
        : input.evidence_visibility === "legacy"
          ? "attest_legacy_evidence"
          : "request_public_or_redacted_evidence";
    } else {
      eligibility = "capped";
      label = `Capped at ${pct(capMultiplier)}`;
      reviewerAction = "approve_cap";
    }
  } else {
    eligibility = "evidence_hold";
    label = "Evidence insufficient -- upgrade to unlock reward";
    reviewerAction = "submit_evidence";
  }

  // Dominant reason: last non-queue reason, or first reason
  const dominantReason = reasons.filter(r => r !== "queue_stale_no_fault" && r !== "cap_below_auto_emission_floor").pop()
    ?? reasons[0]
    ?? "evidence_public_verified";

  return {
    task_id: input.task_id,
    submission_id: input.submission_id,
    eligibility,
    cap_multiplier: round(capMultiplier, 4),
    capped_reward_pft: round(input.base_reward_pft * capMultiplier, 2),
    reason_codes: reasons,
    dominant_reason: dominantReason,
    recommended_reviewer_action: reviewerAction,
    display_label: label,
    cap_components: {
      visibility_factor: round(visFactor, 4),
      confidence_factor: round(confFactor, 4),
      risk_factor: round(riskFactor, 4),
      queue_adjustment: queueAdj,
      terminal_override: null,
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

function visibilityFactor(vis: EvidenceVisibility): number {
  switch (vis) {
    case "public": return 1.0;
    case "obfuscated": return 0.9;
    case "private": return 0.75;
    case "legacy": return 0.5;
  }
}

function confidenceFactor(conf: VerificationConfidence, reviewerVerified: boolean): number {
  switch (conf) {
    case "high": return 1.0;
    case "medium": return reviewerVerified ? 0.95 : 0.8;
    case "low": return 0.5;
    case "attested": return 0.7;
    case "none": return 0;
  }
}

function computeVisibilityFactor(vis: EvidenceVisibility, reasons: ReasonCode[]): number {
  switch (vis) {
    case "public": reasons.push("evidence_public_verified"); return 1.0;
    case "obfuscated": reasons.push("evidence_obfuscated_verified"); return 0.9;
    case "private": reasons.push("evidence_private_hash_verified"); return 0.75;
    case "legacy": return 0.5;
  }
}

function computeConfidenceFactor(conf: VerificationConfidence, reviewerVerified: boolean, reasons: ReasonCode[]): number {
  switch (conf) {
    case "high": return 1.0;
    case "medium": return reviewerVerified ? 0.95 : 0.8;
    case "low": reasons.push("evidence_low_confidence"); return 0.5;
    case "attested": reasons.push("evidence_legacy_attested"); return 0.7;
    case "none": reasons.push("evidence_missing"); return 0;
  }
}

interface RiskAssessment {
  blocked: boolean;
  factor: number;
  label: string;
  blockType: "sybil" | "duplicate" | null;
}

function assessRisk(flags: AbuseRiskFlags, reasons: ReasonCode[]): RiskAssessment {
  if (flags.sybil_flagged_producer) {
    reasons.push("sybil_flagged");
    return { blocked: true, factor: 0, label: "Blocked -- sybil-flagged producer", blockType: "sybil" };
  }
  if (flags.duplicate_submission) {
    reasons.push("duplicate_detected");
    return { blocked: true, factor: 0, label: "Blocked -- duplicate submission detected", blockType: "duplicate" };
  }

  let factor = 1.0;
  if (flags.collision_with_other_task) { reasons.push("collision_detected"); factor *= 0.5; }
  if (flags.velocity_anomaly) { reasons.push("velocity_anomaly"); factor *= 0.7; }
  if (flags.reward_concentration_risk) { reasons.push("concentration_risk"); factor *= 0.8; }

  return { blocked: false, factor, label: "", blockType: null };
}

// -- Helpers ---------------------------------------------------------------

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function round(val: number, decimals: number): number {
  const f = Math.pow(10, decimals);
  return Math.round(val * f) / f;
}

function pct(val: number): string {
  return `${Math.round(val * 100)}%`;
}

function buildTerminal(
  input: RewardCapInput,
  eligibility: RewardEligibility,
  capMultiplier: number,
  reasons: ReasonCode[],
  dominantReason: ReasonCode,
  label: string,
  reviewerAction: ReviewerAction,
  rawVisFactor: number,
  rawConfFactor: number,
  rawRiskFactor: number,
  terminalOverride: string,
): RewardCapResult {
  return {
    task_id: input.task_id,
    submission_id: input.submission_id,
    eligibility,
    cap_multiplier: capMultiplier,
    capped_reward_pft: round(input.base_reward_pft * capMultiplier, 2),
    reason_codes: reasons,
    dominant_reason: dominantReason,
    recommended_reviewer_action: reviewerAction,
    display_label: label,
    cap_components: {
      visibility_factor: round(rawVisFactor, 4),
      confidence_factor: round(rawConfFactor, 4),
      risk_factor: round(rawRiskFactor, 4),
      queue_adjustment: 1.0,
      terminal_override: terminalOverride,
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
