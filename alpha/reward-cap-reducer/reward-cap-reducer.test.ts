/**
 * Tests for Evidence-Weighted Reward Cap Reducer
 *
 * Seven required scenarios: public verified, private metadata-only,
 * obfuscated verified, legacy, missing evidence, stale queue, and
 * duplicate/collision risk. Plus: key invariant tests.
 *
 * Task ID: e18618a0-f24d-45fa-92a9-59205cc8f183
 */

import { describe, it, expect } from "vitest";
import {
  computeRewardCap,
  type RewardCapInput,
  type AbuseRiskFlags,
} from "./reward-cap-reducer.js";

// -- Fixture Factory -------------------------------------------------------

const NO_RISK: AbuseRiskFlags = {
  duplicate_submission: false,
  collision_with_other_task: false,
  sybil_flagged_producer: false,
  velocity_anomaly: false,
  reward_concentration_risk: false,
};

function makeInput(overrides: Partial<RewardCapInput> = {}): RewardCapInput {
  return {
    task_id: "task-001",
    submission_id: "sub-001",
    base_reward_pft: 5000,
    evidence_visibility: "public",
    verification_confidence: "high",
    queue_status: "fresh",
    queue_age_days: 1,
    reviewer_verified: true,
    risk_flags: { ...NO_RISK },
    producer_address: "rDVKRN1234567890tyjB",
    task_category: "network",
    ...overrides,
  };
}

// -- Scenario 1: Public Verified Evidence ----------------------------------

describe("Scenario 1: Public verified evidence", () => {
  it("returns full_eligible with 100% cap", () => {
    const input = makeInput();
    const result = computeRewardCap(input);

    expect(result.eligibility).toBe("full_eligible");
    expect(result.cap_multiplier).toBe(1.0);
    expect(result.capped_reward_pft).toBe(5000);
    expect(result.reason_codes).toContain("evidence_public_verified");
    expect(result.display_label).toContain("Full reward");
  });

  it("decomposes cap components correctly", () => {
    const result = computeRewardCap(makeInput());
    expect(result.cap_components.visibility_factor).toBe(1.0);
    expect(result.cap_components.confidence_factor).toBe(1.0);
    expect(result.cap_components.risk_factor).toBe(1.0);
    expect(result.cap_components.queue_adjustment).toBe(1.0);
  });
});

// -- Scenario 2: Private Metadata-Only Evidence ----------------------------

describe("Scenario 2: Private metadata-only evidence", () => {
  it("caps at 75% visibility * confidence factor", () => {
    const input = makeInput({
      evidence_visibility: "private",
      verification_confidence: "medium",
      reviewer_verified: true,
    });
    const result = computeRewardCap(input);

    expect(result.cap_components.visibility_factor).toBe(0.75);
    expect(result.reason_codes).toContain("evidence_private_hash_verified");
    expect(result.cap_multiplier).toBeGreaterThan(0);
    expect(result.cap_multiplier).toBeLessThan(1);
  });

  it("puts unreviewed private evidence on review_hold", () => {
    const input = makeInput({
      evidence_visibility: "private",
      verification_confidence: "medium",
      reviewer_verified: false,
    });
    const result = computeRewardCap(input);

    expect(result.eligibility).toBe("review_hold");
    expect(result.invariants.blocks_automated_emission).toBe(true);
    expect(result.invariants.requires_human_sign_off).toBe(true);
  });
});

// -- Scenario 3: Obfuscated Verified Evidence ------------------------------

describe("Scenario 3: Obfuscated verified evidence", () => {
  it("caps at 90% visibility with full confidence", () => {
    const input = makeInput({
      evidence_visibility: "obfuscated",
      verification_confidence: "high",
    });
    const result = computeRewardCap(input);

    expect(result.cap_components.visibility_factor).toBe(0.9);
    expect(result.cap_multiplier).toBe(0.9);
    expect(result.capped_reward_pft).toBe(4500);
    expect(result.reason_codes).toContain("evidence_obfuscated_verified");
    expect(result.eligibility).toBe("capped");
  });
});

// -- Scenario 4: Legacy Evidence -------------------------------------------

describe("Scenario 4: Legacy evidence", () => {
  it("caps at 50% visibility * 70% attested confidence", () => {
    const input = makeInput({
      evidence_visibility: "legacy",
      verification_confidence: "attested",
      reviewer_verified: true,
    });
    const result = computeRewardCap(input);

    expect(result.cap_components.visibility_factor).toBe(0.5);
    expect(result.cap_components.confidence_factor).toBe(0.7);
    expect(result.cap_multiplier).toBe(0.35);
    expect(result.capped_reward_pft).toBe(1750);
    expect(result.reason_codes).toContain("evidence_legacy_attested");
    expect(result.invariants.requires_human_sign_off).toBe(true);
  });

  it("holds unattested legacy for review", () => {
    const input = makeInput({
      evidence_visibility: "legacy",
      verification_confidence: "low",
      reviewer_verified: false,
    });
    const result = computeRewardCap(input);

    expect(result.eligibility).toBe("review_hold");
    expect(result.reason_codes).toContain("evidence_low_confidence");
  });
});

// -- Scenario 5: Missing Evidence ------------------------------------------

describe("Scenario 5: Missing evidence", () => {
  it("returns evidence_hold with 0 cap", () => {
    const input = makeInput({
      verification_confidence: "none",
    });
    const result = computeRewardCap(input);

    expect(result.eligibility).toBe("evidence_hold");
    expect(result.cap_multiplier).toBe(0);
    expect(result.capped_reward_pft).toBe(0);
    expect(result.reason_codes).toContain("evidence_missing");
    expect(result.display_label).toContain("Evidence missing");
    expect(result.invariants.blocks_automated_emission).toBe(true);
  });
});

// -- Scenario 6: Stale Reviewer Queue --------------------------------------

describe("Scenario 6: Stale reviewer queue", () => {
  it("does NOT penalize submitter for reviewer delay", () => {
    const input = makeInput({
      queue_status: "stale",
      queue_age_days: 25,
    });
    const result = computeRewardCap(input);

    expect(result.eligibility).toBe("full_eligible");
    expect(result.cap_multiplier).toBe(1.0);
    expect(result.cap_components.queue_adjustment).toBe(1.0);
    expect(result.reason_codes).toContain("queue_stale_no_fault");
    expect(result.invariants.reviewer_delay_penalizes_submitter).toBe(false);
  });

  it("does NOT penalize for deadlocked queue either", () => {
    const input = makeInput({ queue_status: "deadlocked", queue_age_days: 30 });
    const result = computeRewardCap(input);

    expect(result.cap_multiplier).toBe(1.0);
    expect(result.cap_components.queue_adjustment).toBe(1.0);
    expect(result.reason_codes).toContain("queue_stale_no_fault");
  });
});

// -- Scenario 7: Duplicate/Collision Risk ----------------------------------

describe("Scenario 7: Duplicate and collision risk", () => {
  it("blocks duplicate submissions entirely", () => {
    const input = makeInput({
      risk_flags: { ...NO_RISK, duplicate_submission: true },
    });
    const result = computeRewardCap(input);

    expect(result.eligibility).toBe("blocked");
    expect(result.cap_multiplier).toBe(0);
    expect(result.reason_codes).toContain("duplicate_detected");
    expect(result.display_label).toContain("duplicate");
  });

  it("caps collision risk at 50%", () => {
    const input = makeInput({
      risk_flags: { ...NO_RISK, collision_with_other_task: true },
    });
    const result = computeRewardCap(input);

    expect(result.cap_components.risk_factor).toBe(0.5);
    expect(result.reason_codes).toContain("collision_detected");
    expect(result.eligibility).toBe("capped");
    expect(result.capped_reward_pft).toBe(2500);
  });

  it("blocks sybil-flagged producers entirely", () => {
    const input = makeInput({
      risk_flags: { ...NO_RISK, sybil_flagged_producer: true },
    });
    const result = computeRewardCap(input);

    expect(result.eligibility).toBe("blocked");
    expect(result.cap_multiplier).toBe(0);
    expect(result.reason_codes).toContain("sybil_flagged");
  });

  it("stacks velocity + concentration risk multiplicatively", () => {
    const input = makeInput({
      risk_flags: { ...NO_RISK, velocity_anomaly: true, reward_concentration_risk: true },
    });
    const result = computeRewardCap(input);

    // 0.7 * 0.8 = 0.56 risk factor
    expect(result.cap_components.risk_factor).toBe(0.56);
    expect(result.reason_codes).toContain("velocity_anomaly");
    expect(result.reason_codes).toContain("concentration_risk");
    expect(result.capped_reward_pft).toBe(2800);
  });
});

// -- Withdrawn -------------------------------------------------------------

describe("Withdrawn submission", () => {
  it("returns withdrawn with 0 reward", () => {
    const input = makeInput({ queue_status: "withdrawn" });
    const result = computeRewardCap(input);

    expect(result.eligibility).toBe("withdrawn");
    expect(result.cap_multiplier).toBe(0);
    expect(result.capped_reward_pft).toBe(0);
    expect(result.reason_codes).toContain("submission_withdrawn");
  });
});

// -- Key Invariants --------------------------------------------------------

describe("Hard invariants", () => {
  it("reviewer_delay_penalizes_submitter is ALWAYS false", () => {
    const scenarios = [
      makeInput(),
      makeInput({ queue_status: "stale", queue_age_days: 100 }),
      makeInput({ queue_status: "deadlocked", queue_age_days: 50 }),
      makeInput({ evidence_visibility: "legacy", verification_confidence: "attested" }),
      makeInput({ verification_confidence: "none" }),
      makeInput({ risk_flags: { ...NO_RISK, sybil_flagged_producer: true } }),
    ];

    for (const input of scenarios) {
      const result = computeRewardCap(input);
      expect(result.invariants.reviewer_delay_penalizes_submitter).toBe(false);
    }
  });

  it("exposes_restricted_evidence is ALWAYS false", () => {
    for (const vis of ["public", "private", "obfuscated", "legacy"] as const) {
      const result = computeRewardCap(makeInput({ evidence_visibility: vis }));
      expect(result.invariants.exposes_restricted_evidence).toBe(false);
    }
  });

  it("cap_below_zero is ALWAYS false", () => {
    const result = computeRewardCap(makeInput({ risk_flags: { ...NO_RISK, sybil_flagged_producer: true } }));
    expect(result.invariants.cap_below_zero).toBe(false);
    expect(result.cap_multiplier).toBeGreaterThanOrEqual(0);
    expect(result.capped_reward_pft).toBeGreaterThanOrEqual(0);
  });

  it("cap_multiplier never exceeds 1.0", () => {
    const result = computeRewardCap(makeInput({ base_reward_pft: 100000 }));
    expect(result.cap_multiplier).toBeLessThanOrEqual(1.0);
  });

  it("capped_reward_pft equals base * multiplier", () => {
    const input = makeInput({ base_reward_pft: 6429 });
    const result = computeRewardCap(input);
    expect(result.capped_reward_pft).toBe(
      round(input.base_reward_pft * result.cap_multiplier, 2)
    );
  });
});

// -- Display Label Safety --------------------------------------------------

describe("Display label does not leak identifiers", () => {
  const scenarios = [
    makeInput(),
    makeInput({ evidence_visibility: "private", verification_confidence: "medium", reviewer_verified: false }),
    makeInput({ verification_confidence: "none" }),
    makeInput({ risk_flags: { ...NO_RISK, sybil_flagged_producer: true } }),
    makeInput({ queue_status: "withdrawn" }),
  ];

  for (const input of scenarios) {
    it(`no identifiers for ${input.evidence_visibility}/${input.verification_confidence}`, () => {
      const result = computeRewardCap(input);
      expect(result.display_label).not.toContain(input.task_id);
      expect(result.display_label).not.toContain(input.submission_id);
      expect(result.display_label).not.toContain(input.producer_address);
    });
  }
});

// -- Determinism -----------------------------------------------------------

describe("Determinism", () => {
  it("identical input produces identical output", () => {
    const input = makeInput();
    const r1 = computeRewardCap(input);
    const r2 = computeRewardCap(input);
    expect(r1).toEqual(r2);
  });
});

// -- Helper ----------------------------------------------------------------

function round(val: number, decimals: number): number {
  const f = Math.pow(10, decimals);
  return Math.round(val * f) / f;
}
