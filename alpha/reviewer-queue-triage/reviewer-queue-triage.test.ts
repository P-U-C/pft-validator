/**
 * Tests for Reviewer Queue Aging Triage Reducer
 *
 * Covers all required scenarios: fresh, aging (8-14d), stale (15+d),
 * awaiting-verification, authorization-hold, legacy evidence.
 * Plus: reviewer deadlock, dead evidence, timestamp missing,
 * terminal states, queue sorting, status-line safety, determinism.
 */

import { describe, it, expect } from "vitest";
import {
  triageQueueItem,
  triageQueue,
  type QueueItem,
} from "./reviewer-queue-triage.js";

// -- Test Clock ------------------------------------------------------------

const AS_OF = new Date("2026-04-25T12:00:00Z");

// -- Fixture Factory -------------------------------------------------------

function makeItem(overrides: Partial<QueueItem> = {}): QueueItem {
  return {
    task_id: "task-001",
    submission_id: "sub-001",
    producer_address: "rDVKRN1234567890tyjB",
    task_created_at: "2026-04-20T10:00:00Z",
    submitted_at: "2026-04-24T10:00:00Z",
    last_reviewer_action_at: null,
    status: "submitted",
    evidence_visibility: "public",
    authorization_state: "authorized",
    assigned_reviewer: null,
    reviewer_count: 0,
    has_content_hash: true,
    has_url: true,
    url_status: "live",
    reward_pft: 3000,
    task_category: "network",
    ...overrides,
  };
}

// -- Scenario 1: Fresh Active Work -----------------------------------------

describe("Scenario 1: Fresh active work (0-3 days)", () => {
  it("classifies a 1-day-old submission as fresh_active", () => {
    const item = makeItem({ submitted_at: "2026-04-24T10:00:00Z" });
    const result = triageQueueItem(item, AS_OF);
    expect(result.triage_label).toBe("fresh_active");
    expect(result.age_class).toBe("fresh");
    expect(result.urgency).toBe("medium");
    expect(result.recommended_action).toBe("review_now");
    expect(result.reviewer_verifiable).toBe(true);
    expect(result.publicly_openable).toBe(true);
    expect(result.age_days).toBe(1);
  });

  it("classifies a same-day submission as fresh", () => {
    const item = makeItem({ submitted_at: "2026-04-25T08:00:00Z" });
    const result = triageQueueItem(item, AS_OF);
    expect(result.triage_label).toBe("fresh_active");
    expect(result.age_days).toBe(0);
  });
});

// -- Scenario 2: Aging Work (8-14 days) ------------------------------------

describe("Scenario 2: Aging work (8-14 days)", () => {
  it("classifies 10-day-old unreviewed as aging_unreviewed", () => {
    const item = makeItem({ submitted_at: "2026-04-15T10:00:00Z" });
    const result = triageQueueItem(item, AS_OF);
    expect(result.triage_label).toBe("aging_unreviewed");
    expect(result.age_class).toBe("aging");
    expect(result.urgency).toBe("high");
    expect(result.recommended_action).toBe("review_now");
  });

  it("classifies 12-day-old in-progress as aging_in_progress", () => {
    const item = makeItem({
      submitted_at: "2026-04-13T10:00:00Z",
      status: "in_review",
      assigned_reviewer: "reviewer-abc",
      last_reviewer_action_at: "2026-04-18T10:00:00Z",
    });
    const result = triageQueueItem(item, AS_OF);
    expect(result.triage_label).toBe("aging_in_progress");
    expect(result.has_reviewer).toBe(true);
    expect(result.days_since_last_action).toBe(7);
  });
});

// -- Scenario 3: Stale Work (15+ days) -------------------------------------

describe("Scenario 3: Stale work (15+ days)", () => {
  it("classifies 20-day-old unreviewed as stale_unreviewed / critical", () => {
    const item = makeItem({ submitted_at: "2026-04-05T10:00:00Z" });
    const result = triageQueueItem(item, AS_OF);
    expect(result.triage_label).toBe("stale_unreviewed");
    expect(result.urgency).toBe("critical");
    expect(result.recommended_action).toBe("review_now");
  });

  it("classifies stale in-progress as stale_in_progress with escalate", () => {
    const item = makeItem({
      submitted_at: "2026-04-05T10:00:00Z",
      status: "in_review",
      assigned_reviewer: "reviewer-xyz",
      last_reviewer_action_at: "2026-04-20T10:00:00Z",
    });
    const result = triageQueueItem(item, AS_OF);
    expect(result.triage_label).toBe("stale_in_progress");
    expect(result.urgency).toBe("critical");
    expect(result.recommended_action).toBe("escalate");
  });
});

// -- Scenario 4: Awaiting Verification ------------------------------------

describe("Scenario 4: Awaiting verification", () => {
  it("flags private evidence without hash", () => {
    const item = makeItem({
      evidence_visibility: "private",
      has_content_hash: false,
      has_url: false,
      url_status: null,
    });
    const result = triageQueueItem(item, AS_OF);
    expect(result.triage_label).toBe("awaiting_verification");
    expect(result.recommended_action).toBe("verify_evidence");
    expect(result.reviewer_verifiable).toBe(false);
    expect(result.publicly_openable).toBe(false);
  });

  it("treats private evidence WITH hash as reviewer_verifiable but not publicly_openable", () => {
    const item = makeItem({
      evidence_visibility: "private",
      has_content_hash: true,
      has_url: true,
      url_status: "live",
    });
    const result = triageQueueItem(item, AS_OF);
    expect(result.triage_label).toBe("fresh_active");
    expect(result.reviewer_verifiable).toBe(true);
    expect(result.publicly_openable).toBe(false);
  });
});

// -- Scenario 5: Authorization Hold ----------------------------------------

describe("Scenario 5: Authorization hold", () => {
  it("classifies held authorization", () => {
    const item = makeItem({ authorization_state: "held" });
    const result = triageQueueItem(item, AS_OF);
    expect(result.triage_label).toBe("authorization_hold");
    expect(result.urgency).toBe("medium");
    expect(result.recommended_action).toBe("wait_for_authorization");
    expect(result.triage_invariants.blocks_reward_emission).toBe(true);
  });

  it("escalates expired authorization", () => {
    const item = makeItem({ authorization_state: "expired" });
    const result = triageQueueItem(item, AS_OF);
    expect(result.triage_label).toBe("authorization_hold");
    expect(result.recommended_action).toBe("escalate");
  });
});

// -- Scenario 6: Legacy Evidence -------------------------------------------

describe("Scenario 6: Legacy evidence", () => {
  it("classifies legacy as legacy_evidence with attest action", () => {
    const item = makeItem({
      evidence_visibility: "legacy",
      has_content_hash: false,
      has_url: false,
      url_status: null,
    });
    const result = triageQueueItem(item, AS_OF);
    expect(result.triage_label).toBe("legacy_evidence");
    expect(result.recommended_action).toBe("attest_legacy");
    expect(result.reviewer_verifiable).toBe(false);
    expect(result.triage_invariants.requires_human_attestation).toBe(true);
  });
});

// -- Reviewer Deadlock -----------------------------------------------------

describe("Reviewer deadlock", () => {
  it("detects stalled reviewer (10+ days since last action)", () => {
    const item = makeItem({
      submitted_at: "2026-04-05T10:00:00Z",
      status: "in_review",
      assigned_reviewer: "reviewer-xyz",
      last_reviewer_action_at: "2026-04-06T10:00:00Z",
    });
    const result = triageQueueItem(item, AS_OF);
    expect(result.triage_label).toBe("reviewer_deadlock");
    expect(result.urgency).toBe("critical");
    expect(result.recommended_action).toBe("reassign_or_escalate");
    expect(result.triage_invariants.requires_human_attestation).toBe(true);
  });

  it("does not trigger deadlock if action was recent", () => {
    const item = makeItem({
      submitted_at: "2026-04-05T10:00:00Z",
      status: "in_review",
      assigned_reviewer: "reviewer-xyz",
      last_reviewer_action_at: "2026-04-20T10:00:00Z",
    });
    const result = triageQueueItem(item, AS_OF);
    expect(result.triage_label).not.toBe("reviewer_deadlock");
  });
});

// -- Timestamp Missing -----------------------------------------------------

describe("Missing timestamps", () => {
  it("classifies null submitted_at as timestamp_missing / high", () => {
    const item = makeItem({ submitted_at: null });
    const result = triageQueueItem(item, AS_OF);
    expect(result.triage_label).toBe("timestamp_missing");
    expect(result.urgency).toBe("high");
    expect(result.recommended_action).toBe("repair_metadata");
    expect(result.age_days).toBeNull();
    expect(result.triage_invariants.blocks_reward_emission).toBe(true);
  });

  it("classifies invalid timestamp string as timestamp_missing", () => {
    const item = makeItem({ submitted_at: "not-a-date" });
    const result = triageQueueItem(item, AS_OF);
    expect(result.triage_label).toBe("timestamp_missing");
    expect(result.recommended_action).toBe("repair_metadata");
  });
});

// -- Dead Evidence / Changes / Terminal ------------------------------------

describe("Dead evidence", () => {
  it("classifies dead URL as dead_evidence", () => {
    const item = makeItem({ url_status: "dead" });
    const result = triageQueueItem(item, AS_OF);
    expect(result.triage_label).toBe("dead_evidence");
    expect(result.recommended_action).toBe("contact_producer");
    expect(result.triage_invariants.blocks_reward_emission).toBe(true);
  });
});

describe("Changes pending", () => {
  it("classifies changes_requested as changes_pending / low", () => {
    const item = makeItem({ status: "changes_requested" });
    const result = triageQueueItem(item, AS_OF);
    expect(result.triage_label).toBe("changes_pending");
    expect(result.recommended_action).toBe("wait_for_producer");
    expect(result.urgency).toBe("low");
  });

  it("raises urgency for stale changes_requested", () => {
    const item = makeItem({ status: "changes_requested", submitted_at: "2026-04-05T10:00:00Z" });
    const result = triageQueueItem(item, AS_OF);
    expect(result.urgency).toBe("high");
  });
});

describe("Terminal states", () => {
  it("classifies approved as completed / info", () => {
    const item = makeItem({ status: "approved" });
    const result = triageQueueItem(item, AS_OF);
    expect(result.triage_label).toBe("completed");
    expect(result.urgency).toBe("info");
    expect(result.recommended_action).toBe("close");
    expect(result.status_line).toContain("Approved");
  });

  it("classifies withdrawn as withdrawn / info", () => {
    const item = makeItem({ status: "withdrawn" });
    const result = triageQueueItem(item, AS_OF);
    expect(result.triage_label).toBe("withdrawn");
    expect(result.urgency).toBe("info");
  });
});

// -- Queue Sorting ---------------------------------------------------------

describe("triageQueue batch sorting", () => {
  it("sorts most urgent first", () => {
    const items: QueueItem[] = [
      makeItem({ submission_id: "completed", status: "approved" }),
      makeItem({ submission_id: "stale", submitted_at: "2026-04-05T10:00:00Z" }),
      makeItem({ submission_id: "fresh", submitted_at: "2026-04-24T10:00:00Z" }),
      makeItem({ submission_id: "aging", submitted_at: "2026-04-13T10:00:00Z" }),
    ];
    const results = triageQueue(items, AS_OF);
    expect(results[0].submission_id).toBe("stale");
    expect(results[results.length - 1].submission_id).toBe("completed");
  });
});

// -- Priority Components ---------------------------------------------------

describe("Priority components are decomposed", () => {
  it("shows age_score for fresh item", () => {
    const item = makeItem();
    const result = triageQueueItem(item, AS_OF);
    expect(result.priority_components).toBeDefined();
    expect(result.priority_components.terminal_penalty).toBe(0);
    expect(result.sort_priority).toBe(
      result.priority_components.age_score +
      result.priority_components.evidence_score +
      result.priority_components.authorization_score +
      result.priority_components.assignment_score +
      result.priority_components.terminal_penalty
    );
  });

  it("shows terminal_penalty for completed items", () => {
    const item = makeItem({ status: "approved" });
    const result = triageQueueItem(item, AS_OF);
    expect(result.priority_components.terminal_penalty).toBe(999);
  });
});

// -- Triage Invariants -----------------------------------------------------

describe("Triage invariants", () => {
  it("never exposes restricted URL or private data", () => {
    for (const vis of ["public", "private", "obfuscated", "legacy"] as const) {
      const item = makeItem({ evidence_visibility: vis, has_content_hash: true });
      const result = triageQueueItem(item, AS_OF);
      expect(result.triage_invariants.exposes_restricted_url).toBe(false);
      expect(result.triage_invariants.exposes_producer_private_data).toBe(false);
    }
  });

  it("marks legacy as requiring human attestation", () => {
    const item = makeItem({ evidence_visibility: "legacy", has_content_hash: false, has_url: false, url_status: null });
    const result = triageQueueItem(item, AS_OF);
    expect(result.triage_invariants.requires_human_attestation).toBe(true);
  });

  it("marks authorization_hold as blocking reward emission", () => {
    const item = makeItem({ authorization_state: "held" });
    const result = triageQueueItem(item, AS_OF);
    expect(result.triage_invariants.blocks_reward_emission).toBe(true);
  });

  it("marks public verifiable as safe for collaborator view", () => {
    const item = makeItem();
    const result = triageQueueItem(item, AS_OF);
    expect(result.triage_invariants.safe_for_collaborator_view).toBe(true);
  });

  it("marks private as NOT safe for collaborator view", () => {
    const item = makeItem({ evidence_visibility: "private", has_content_hash: true });
    const result = triageQueueItem(item, AS_OF);
    expect(result.triage_invariants.safe_for_collaborator_view).toBe(false);
  });
});

// -- Status Line Safety (Hard No-Leak Invariants) --------------------------

describe("Status line NEVER contains identifiers", () => {
  const scenarios = [
    makeItem(),
    makeItem({ evidence_visibility: "private", has_content_hash: false, has_url: false, url_status: null }),
    makeItem({ evidence_visibility: "legacy", has_content_hash: false, has_url: false, url_status: null }),
    makeItem({ status: "in_review", assigned_reviewer: "rReviewer1234567890ABCD" }),
    makeItem({ status: "approved" }),
    makeItem({ submitted_at: null }),
  ];

  for (const item of scenarios) {
    it(`no identifiers leaked for ${item.evidence_visibility}/${item.status}`, () => {
      const result = triageQueueItem(item, AS_OF);
      expect(result.status_line).not.toContain(item.task_id);
      expect(result.status_line).not.toContain(item.submission_id);
      expect(result.status_line).not.toContain(item.producer_address);
      if (item.assigned_reviewer) {
        expect(result.status_line).not.toContain(item.assigned_reviewer);
        // Also no fragments of the reviewer ID
        expect(result.status_line).not.toContain(item.assigned_reviewer.substring(0, 8));
      }
    });
  }
});

// -- Determinism -----------------------------------------------------------

describe("Determinism", () => {
  it("identical input produces identical output", () => {
    const item = makeItem({ submitted_at: "2026-04-15T10:00:00Z" });
    const r1 = triageQueueItem(item, AS_OF);
    const r2 = triageQueueItem(item, AS_OF);
    expect(r1).toEqual(r2);
  });

  it("different as_of dates produce different age classifications", () => {
    const item = makeItem({ submitted_at: "2026-04-20T10:00:00Z" });
    const fresh = triageQueueItem(item, new Date("2026-04-22T12:00:00Z"));
    const stale = triageQueueItem(item, new Date("2026-05-10T12:00:00Z"));
    expect(fresh.age_class).toBe("fresh");
    expect(stale.age_class).toBe("stale");
  });
});
