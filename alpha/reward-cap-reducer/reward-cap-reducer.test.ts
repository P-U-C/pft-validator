/**
 * Tests for Evidence-Weighted Reward Cap Reducer
 *
 * Seven required scenarios + adversarial protocol tests + invariants.
 * Task ID: e18618a0-f24d-45fa-92a9-59205cc8f183
 */

import { describe, it, expect } from "vitest";
import {
  computeRewardCap,
  type RewardCapInput,
  type AbuseRiskFlags,
} from "./reward-cap-reducer.js";

// -- Fixtures --------------------------------------------------------------

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
    const result = computeRewardCap(makeInput());
    expect(result.eligibility).toBe("full_eligible");
    expect(result.cap_multiplier).toBe(1.0);
    expect(result.capped_reward_pft).toBe(5000);
    expect(result.reason_codes).toContain("evidence_public_verified");
    expect(result.recommended_reviewer_action).toBe("approve_cap");
    expect(result.dominant_reason).toBe("evidence_public_verified");
  });

  it("decomposes cap components correctly", () => {
    const result = computeRewardCap(makeInput());
    expect(result.cap_components.visibility_factor).toBe(1.0);
    expect(result.cap_components.confidence_factor).toBe(1.0);
    expect(result.cap_components.risk_factor).toBe(1.0);
    expect(result.cap_components.queue_adjustment).toBe(1.0);
    expect(result.cap_components.terminal_override).toBeNull();
  });
});

// -- Scenario 2: Private Metadata-Only Evidence ----------------------------

describe("Scenario 2: Private metadata-only evidence", () => {
  it("caps at 75% visibility * confidence factor", () => {
    const result = computeRewardCap(makeInput({
      evidence_visibility: "private",
      verification_confidence: "medium",
      reviewer_verified: true,
    }));
    expect(result.cap_components.visibility_factor).toBe(0.75);
    expect(result.reason_codes).toContain("evidence_private_hash_verified");
    expect(result.cap_multiplier).toBeGreaterThan(0);
    expect(result.cap_multiplier).toBeLessThan(1);
  });

  it("puts unreviewed private evidence on review_hold", () => {
    const result = computeRewardCap(makeInput({
      evidence_visibility: "private",
      verification_confidence: "medium",
      reviewer_verified: false,
    }));
    expect(result.eligibility).toBe("review_hold");
    expect(result.invariants.blocks_automated_emission).toBe(true);
    expect(result.recommended_reviewer_action).toBe("verify_private_metadata");
  });
});

// -- Scenario 3: Obfuscated Verified Evidence ------------------------------

describe("Scenario 3: Obfuscated verified evidence", () => {
  it("caps at 90% visibility with full confidence", () => {
    const result = computeRewardCap(makeInput({
      evidence_visibility: "obfuscated",
      verification_confidence: "high",
    }));
    expect(result.cap_components.visibility_factor).toBe(0.9);
    expect(result.cap_multiplier).toBe(0.9);
    expect(result.capped_reward_pft).toBe(4500);
    expect(result.reason_codes).toContain("evidence_obfuscated_verified");
    expect(result.eligibility).toBe("capped");
  });
});

// -- Scenario 4: Legacy Evidence -------------------------------------------

describe("Scenario 4: Legacy evidence", () => {
  it("caps at 50% visibility * 70% attested confidence = 35%", () => {
    const result = computeRewardCap(makeInput({
      evidence_visibility: "legacy",
      verification_confidence: "attested",
      reviewer_verified: true,
    }));
    expect(result.cap_multiplier).toBe(0.35);
    expect(result.capped_reward_pft).toBe(1750);
    expect(result.reason_codes).toContain("evidence_legacy_attested");
    expect(result.invariants.requires_human_sign_off).toBe(true);
    expect(result.recommended_reviewer_action).toBe("approve_cap");
  });

  it("holds unattested legacy for review", () => {
    const result = computeRewardCap(makeInput({
      evidence_visibility: "legacy",
      verification_confidence: "low",
      reviewer_verified: false,
    }));
    expect(result.eligibility).toBe("review_hold");
    expect(result.recommended_reviewer_action).toBe("attest_legacy_evidence");
  });
});

// -- Scenario 5: Missing Evidence ------------------------------------------

describe("Scenario 5: Missing evidence", () => {
  it("returns evidence_hold with 0 cap", () => {
    const result = computeRewardCap(makeInput({ verification_confidence: "none" }));
    expect(result.eligibility).toBe("evidence_hold");
    expect(result.cap_multiplier).toBe(0);
    expect(result.reason_codes).toContain("evidence_missing");
    expect(result.recommended_reviewer_action).toBe("submit_evidence");
    expect(result.invariants.blocks_automated_emission).toBe(true);
  });

  it("preserves forensic visibility factor even when evidence is missing", () => {
    const result = computeRewardCap(makeInput({
      evidence_visibility: "public",
      verification_confidence: "none",
    }));
    expect(result.cap_components.visibility_factor).toBe(1.0);
    expect(result.cap_components.terminal_override).toBe("missing_evidence");
  });
});

// -- Scenario 6: Stale Reviewer Queue --------------------------------------

describe("Scenario 6: Stale reviewer queue", () => {
  it("does NOT penalize submitter for reviewer delay", () => {
    const result = computeRewardCap(makeInput({
      queue_status: "stale",
      queue_age_days: 25,
    }));
    expect(result.eligibility).toBe("full_eligible");
    expect(result.cap_multiplier).toBe(1.0);
    expect(result.cap_components.queue_adjustment).toBe(1.0);
    expect(result.reason_codes).toContain("queue_stale_no_fault");
    expect(result.recommended_reviewer_action).toBe("no_action_queue_delay_only");
  });

  it("does NOT penalize for deadlocked queue", () => {
    const result = computeRewardCap(makeInput({ queue_status: "deadlocked" }));
    expect(result.cap_multiplier).toBe(1.0);
    expect(result.recommended_reviewer_action).toBe("no_action_queue_delay_only");
  });
});

// -- Scenario 7: Duplicate/Collision Risk ----------------------------------

describe("Scenario 7: Duplicate and collision risk", () => {
  it("blocks duplicate submissions", () => {
    const result = computeRewardCap(makeInput({
      risk_flags: { ...NO_RISK, duplicate_submission: true },
    }));
    expect(result.eligibility).toBe("blocked");
    expect(result.cap_multiplier).toBe(0);
    expect(result.reason_codes).toContain("duplicate_detected");
    expect(result.recommended_reviewer_action).toBe("merge_or_reject_duplicate");
  });

  it("caps collision risk at 50%", () => {
    const result = computeRewardCap(makeInput({
      risk_flags: { ...NO_RISK, collision_with_other_task: true },
    }));
    expect(result.cap_components.risk_factor).toBe(0.5);
    expect(result.capped_reward_pft).toBe(2500);
  });

  it("blocks sybil-flagged producers", () => {
    const result = computeRewardCap(makeInput({
      risk_flags: { ...NO_RISK, sybil_flagged_producer: true },
    }));
    expect(result.eligibility).toBe("blocked");
    expect(result.recommended_reviewer_action).toBe("escalate_sybil_review");
    expect(result.cap_components.terminal_override).toBe("sybil_block");
  });

  it("stacks velocity + concentration multiplicatively (0.7 * 0.8 = 0.56)", () => {
    const result = computeRewardCap(makeInput({
      risk_flags: { ...NO_RISK, velocity_anomaly: true, reward_concentration_risk: true },
    }));
    expect(result.cap_components.risk_factor).toBe(0.56);
    expect(result.capped_reward_pft).toBe(2800);
  });
});

// -- Cap Floor Policy ------------------------------------------------------

describe("Cap floor policy", () => {
  it("routes tiny caps below 25% to review_hold", () => {
    // legacy (0.5) * low (0.5) = 0.25, exactly at floor -- should be review_hold
    // Actually 0.25 is not < 0.25, so let's create a case below
    const result = computeRewardCap(makeInput({
      evidence_visibility: "legacy",
      verification_confidence: "low",
      reviewer_verified: true,
      risk_flags: { ...NO_RISK, collision_with_other_task: true },
    }));
    // legacy(0.5) * low(0.5) * collision(0.5) = 0.125
    expect(result.cap_multiplier).toBe(0.125);
    expect(result.eligibility).toBe("review_hold");
    expect(result.reason_codes).toContain("cap_below_auto_emission_floor");
  });
});

// -- Terminal State Forensics ----------------------------------------------

describe("Terminal states preserve forensic cap components", () => {
  it("sybil block shows real visibility factor", () => {
    const result = computeRewardCap(makeInput({
      evidence_visibility: "public",
      verification_confidence: "high",
      risk_flags: { ...NO_RISK, sybil_flagged_producer: true },
    }));
    expect(result.cap_components.visibility_factor).toBe(1.0);
    expect(result.cap_components.confidence_factor).toBe(1.0);
    expect(result.cap_components.risk_factor).toBe(0);
    expect(result.cap_components.terminal_override).toBe("sybil_block");
  });

  it("withdrawn shows original evidence factors", () => {
    const result = computeRewardCap(makeInput({
      evidence_visibility: "obfuscated",
      verification_confidence: "medium",
      queue_status: "withdrawn",
    }));
    expect(result.cap_components.visibility_factor).toBe(0.9);
    expect(result.cap_components.terminal_override).toBe("withdrawn");
  });
});

// -- Adversarial Protocol Tests --------------------------------------------

describe("Adversarial protocol invariants", () => {
  it("high confidence does NOT override missing evidence", () => {
    const result = computeRewardCap(makeInput({
      verification_confidence: "none",
      evidence_visibility: "public",
    }));
    expect(result.eligibility).toBe("evidence_hold");
    expect(result.cap_multiplier).toBe(0);
  });

  it("public visibility with none confidence does NOT receive a cap", () => {
    const result = computeRewardCap(makeInput({
      evidence_visibility: "public",
      verification_confidence: "none",
    }));
    expect(result.cap_multiplier).toBe(0);
    expect(result.eligibility).toBe("evidence_hold");
  });

  it("completed queue status does NOT bypass duplicate block", () => {
    const result = computeRewardCap(makeInput({
      queue_status: "completed",
      risk_flags: { ...NO_RISK, duplicate_submission: true },
    }));
    expect(result.eligibility).toBe("blocked");
    expect(result.cap_multiplier).toBe(0);
  });

  it("private unverified evidence reserves cap but blocks emission", () => {
    const result = computeRewardCap(makeInput({
      evidence_visibility: "private",
      verification_confidence: "medium",
      reviewer_verified: false,
    }));
    expect(result.cap_multiplier).toBeGreaterThan(0);
    expect(result.eligibility).toBe("review_hold");
    expect(result.invariants.blocks_automated_emission).toBe(true);
  });

  it("stale queue with missing evidence remains evidence_hold, not full_eligible", () => {
    const result = computeRewardCap(makeInput({
      queue_status: "stale",
      queue_age_days: 30,
      verification_confidence: "none",
    }));
    expect(result.eligibility).toBe("evidence_hold");
    expect(result.cap_multiplier).toBe(0);
  });

  it("sybil block dominates ALL positive evidence signals", () => {
    const result = computeRewardCap(makeInput({
      evidence_visibility: "public",
      verification_confidence: "high",
      reviewer_verified: true,
      queue_status: "fresh",
      risk_flags: { ...NO_RISK, sybil_flagged_producer: true },
    }));
    expect(result.eligibility).toBe("blocked");
    expect(result.cap_multiplier).toBe(0);
    expect(result.dominant_reason).toBe("sybil_flagged");
  });

  it("all risk flags combined still correctly blocked by sybil first", () => {
    const result = computeRewardCap(makeInput({
      risk_flags: {
        duplicate_submission: true,
        collision_with_other_task: true,
        sybil_flagged_producer: true,
        velocity_anomaly: true,
        reward_concentration_risk: true,
      },
    }));
    expect(result.eligibility).toBe("blocked");
    expect(result.reason_codes[0]).toBe("sybil_flagged");
  });
});

// -- Hard Invariants -------------------------------------------------------

describe("Hard invariants hold across ALL scenarios", () => {
  const allScenarios = [
    makeInput(),
    makeInput({ queue_status: "stale", queue_age_days: 100 }),
    makeInput({ evidence_visibility: "legacy", verification_confidence: "attested" }),
    makeInput({ verification_confidence: "none" }),
    makeInput({ risk_flags: { ...NO_RISK, sybil_flagged_producer: true } }),
    makeInput({ risk_flags: { ...NO_RISK, duplicate_submission: true } }),
    makeInput({ queue_status: "withdrawn" }),
    makeInput({ evidence_visibility: "private", verification_confidence: "low", reviewer_verified: false }),
  ];

  for (const input of allScenarios) {
    it(`reviewer_delay never penalizes (${input.evidence_visibility}/${input.queue_status})`, () => {
      const result = computeRewardCap(input);
      expect(result.invariants.reviewer_delay_penalizes_submitter).toBe(false);
      expect(result.cap_components.queue_adjustment).toBe(1.0);
    });

    it(`never exposes restricted evidence (${input.evidence_visibility}/${input.queue_status})`, () => {
      const result = computeRewardCap(input);
      expect(result.invariants.exposes_restricted_evidence).toBe(false);
    });

    it(`cap never below zero (${input.evidence_visibility}/${input.queue_status})`, () => {
      const result = computeRewardCap(input);
      expect(result.invariants.cap_below_zero).toBe(false);
      expect(result.cap_multiplier).toBeGreaterThanOrEqual(0);
      expect(result.capped_reward_pft).toBeGreaterThanOrEqual(0);
    });
  }
});

// -- Display Label Safety --------------------------------------------------

describe("Display label never leaks identifiers", () => {
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
    expect(computeRewardCap(input)).toEqual(computeRewardCap(input));
  });
});
