/**
 * Tests for Reviewer Queue Aging Triage Reducer
 *
 * Fixture cases for all six required scenarios plus edge cases:
 * fresh active, aging (8-14d), stale (15+d), awaiting-verification,
 * authorization-hold, legacy evidence, plus dead evidence, changes
 * pending, completed, withdrawn, missing timestamps, and queue sorting.
 */

import { describe, it, expect } from "vitest";
import {
  triageQueueItem,
  triageQueue,
  type QueueItem,
} from "./reviewer-queue-triage.js";

// ─── Test Clock ───────────────────────────────────────────────────

const AS_OF = new Date("2026-04-25T12:00:00Z");

// ─── Fixture Factory ──────────────────────────────────────────────

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

// ─── Scenario 1: Fresh Active Work ────────────────────────────────

describe("Scenario 1: Fresh active work (0-3 days)", () => {
  it("classifies a 1-day-old submission as fresh_active", () => {
    const item = makeItem({ submitted_at: "2026-04-24T10:00:00Z" });
    const result = triageQueueItem(item, AS_OF);

    expect(result.triage_label).toBe("fresh_active");
    expect(result.age_class).toBe("fresh");
    expect(result.urgency).toBe("medium");
    expect(result.recommended_action).toBe("review_now");
    expect(result.evidence_accessible).toBe(true);
    expect(result.age_days).toBe(1);
  });

  it("classifies a same-day submission as fresh", () => {
    const item = makeItem({ submitted_at: "2026-04-25T08:00:00Z" });
    const result = triageQueueItem(item, AS_OF);

    expect(result.triage_label).toBe("fresh_active");
    expect(result.age_class).toBe("fresh");
    expect(result.age_days).toBe(0);
  });
});

// ─── Scenario 2: Aging Work (8-14 days) ──────────────────────────

describe("Scenario 2: Aging work (8-14 days)", () => {
  it("classifies a 10-day-old unreviewed submission as aging_unreviewed", () => {
    const item = makeItem({ submitted_at: "2026-04-15T10:00:00Z" });
    const result = triageQueueItem(item, AS_OF);

    expect(result.triage_label).toBe("aging_unreviewed");
    expect(result.age_class).toBe("aging");
    expect(result.urgency).toBe("high");
    expect(result.recommended_action).toBe("review_now");
    expect(result.age_days).toBe(10);
  });

  it("classifies a 12-day-old in-progress review as aging_in_progress", () => {
    const item = makeItem({
      submitted_at: "2026-04-13T10:00:00Z",
      status: "in_review",
      assigned_reviewer: "reviewer-abc",
      last_reviewer_action_at: "2026-04-18T10:00:00Z",
    });
    const result = triageQueueItem(item, AS_OF);

    expect(result.triage_label).toBe("aging_in_progress");
    expect(result.age_class).toBe("aging");
    expect(result.urgency).toBe("high");
    expect(result.has_reviewer).toBe(true);
    expect(result.days_since_last_action).toBe(7);
  });
});

// ─── Scenario 3: Stale Work (15+ days) ──────────────────────────

describe("Scenario 3: Stale work (15+ days)", () => {
  it("classifies a 20-day-old unreviewed submission as stale_unreviewed / critical", () => {
    const item = makeItem({ submitted_at: "2026-04-05T10:00:00Z" });
    const result = triageQueueItem(item, AS_OF);

    expect(result.triage_label).toBe("stale_unreviewed");
    expect(result.age_class).toBe("stale");
    expect(result.urgency).toBe("critical");
    expect(result.recommended_action).toBe("review_now");
    expect(result.age_days).toBe(20);
  });

  it("classifies stale in-progress review as stale_in_progress with escalate action", () => {
    const item = makeItem({
      submitted_at: "2026-04-05T10:00:00Z",
      status: "in_review",
      assigned_reviewer: "reviewer-xyz",
      last_reviewer_action_at: "2026-04-10T10:00:00Z",
    });
    const result = triageQueueItem(item, AS_OF);

    expect(result.triage_label).toBe("stale_in_progress");
    expect(result.urgency).toBe("critical");
    expect(result.recommended_action).toBe("escalate");
  });
});

// ─── Scenario 4: Awaiting Verification ──────────────────────────

describe("Scenario 4: Awaiting verification", () => {
  it("flags private evidence without hash as awaiting_verification", () => {
    const item = makeItem({
      evidence_visibility: "private",
      has_content_hash: false,
      has_url: false,
      url_status: null,
    });
    const result = triageQueueItem(item, AS_OF);

    expect(result.triage_label).toBe("awaiting_verification");
    expect(result.urgency).toBe("high");
    expect(result.recommended_action).toBe("verify_evidence");
    expect(result.evidence_accessible).toBe(false);
  });

  it("treats private evidence WITH hash as accessible", () => {
    const item = makeItem({
      evidence_visibility: "private",
      has_content_hash: true,
      has_url: true,
      url_status: "live",
    });
    const result = triageQueueItem(item, AS_OF);

    expect(result.triage_label).toBe("fresh_active");
    expect(result.evidence_accessible).toBe(true);
  });

  it("escalates stale awaiting-verification to critical", () => {
    const item = makeItem({
      submitted_at: "2026-04-05T10:00:00Z",
      evidence_visibility: "obfuscated",
      has_content_hash: false,
    });
    const result = triageQueueItem(item, AS_OF);

    expect(result.triage_label).toBe("awaiting_verification");
    expect(result.urgency).toBe("critical");
  });
});

// ─── Scenario 5: Authorization Hold ─────────────────────────────

describe("Scenario 5: Authorization hold", () => {
  it("classifies held authorization as authorization_hold", () => {
    const item = makeItem({ authorization_state: "held" });
    const result = triageQueueItem(item, AS_OF);

    expect(result.triage_label).toBe("authorization_hold");
    expect(result.urgency).toBe("medium");
    expect(result.recommended_action).toBe("wait_for_authorization");
  });

  it("classifies pending_review authorization as authorization_hold / high", () => {
    const item = makeItem({ authorization_state: "pending_review" });
    const result = triageQueueItem(item, AS_OF);

    expect(result.triage_label).toBe("authorization_hold");
    expect(result.urgency).toBe("high");
    expect(result.recommended_action).toBe("wait_for_authorization");
  });

  it("escalates expired authorization", () => {
    const item = makeItem({ authorization_state: "expired" });
    const result = triageQueueItem(item, AS_OF);

    expect(result.triage_label).toBe("authorization_hold");
    expect(result.urgency).toBe("high");
    expect(result.recommended_action).toBe("escalate");
  });
});

// ─── Scenario 6: Legacy / Obfuscated Evidence ───────────────────

describe("Scenario 6: Legacy evidence", () => {
  it("classifies legacy evidence as legacy_evidence with attest action", () => {
    const item = makeItem({
      evidence_visibility: "legacy",
      has_content_hash: false,
      has_url: false,
      url_status: null,
    });
    const result = triageQueueItem(item, AS_OF);

    expect(result.triage_label).toBe("legacy_evidence");
    expect(result.urgency).toBe("medium");
    expect(result.recommended_action).toBe("attest_legacy");
    expect(result.evidence_accessible).toBe(false);
  });

  it("escalates stale legacy evidence to high urgency", () => {
    const item = makeItem({
      submitted_at: "2026-04-05T10:00:00Z",
      evidence_visibility: "legacy",
      has_content_hash: false,
      has_url: false,
      url_status: null,
    });
    const result = triageQueueItem(item, AS_OF);

    expect(result.triage_label).toBe("legacy_evidence");
    expect(result.urgency).toBe("high");
  });
});

// ─── Additional Scenarios ─────────────────────────────────────────

describe("Dead evidence", () => {
  it("classifies dead URL as dead_evidence with contact_producer action", () => {
    const item = makeItem({ url_status: "dead" });
    const result = triageQueueItem(item, AS_OF);

    expect(result.triage_label).toBe("dead_evidence");
    expect(result.urgency).toBe("high");
    expect(result.recommended_action).toBe("contact_producer");
  });
});

describe("Changes pending", () => {
  it("classifies changes_requested as changes_pending", () => {
    const item = makeItem({ status: "changes_requested" });
    const result = triageQueueItem(item, AS_OF);

    expect(result.triage_label).toBe("changes_pending");
    expect(result.recommended_action).toBe("wait_for_producer");
    expect(result.urgency).toBe("low");
  });

  it("raises urgency for stale changes_requested", () => {
    const item = makeItem({
      status: "changes_requested",
      submitted_at: "2026-04-05T10:00:00Z",
    });
    const result = triageQueueItem(item, AS_OF);

    expect(result.triage_label).toBe("changes_pending");
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

  it("classifies rejected as completed / info", () => {
    const item = makeItem({ status: "rejected" });
    const result = triageQueueItem(item, AS_OF);

    expect(result.triage_label).toBe("completed");
    expect(result.urgency).toBe("info");
    expect(result.status_line).toContain("Rejected");
  });

  it("classifies withdrawn as withdrawn / info", () => {
    const item = makeItem({ status: "withdrawn" });
    const result = triageQueueItem(item, AS_OF);

    expect(result.triage_label).toBe("withdrawn");
    expect(result.urgency).toBe("info");
    expect(result.recommended_action).toBe("close");
  });
});

// ─── Missing Timestamps ──────────────────────────────────────────

describe("Missing timestamps", () => {
  it("handles null submitted_at gracefully", () => {
    const item = makeItem({ submitted_at: null });
    const result = triageQueueItem(item, AS_OF);

    expect(result.age_days).toBeNull();
    expect(result.age_class).toBe("unknown");
    expect(result.triage_label).toBe("fresh_active"); // defaults to fresh when unknown
  });

  it("handles invalid timestamp string", () => {
    const item = makeItem({ submitted_at: "not-a-date" });
    const result = triageQueueItem(item, AS_OF);

    expect(result.age_days).toBeNull();
    expect(result.age_class).toBe("unknown");
  });

  it("handles null last_reviewer_action_at", () => {
    const item = makeItem({ last_reviewer_action_at: null });
    const result = triageQueueItem(item, AS_OF);

    expect(result.days_since_last_action).toBeNull();
  });
});

// ─── Queue Sorting ───────────────────────────────────────────────

describe("triageQueue — batch sorting", () => {
  it("sorts by urgency (most urgent first)", () => {
    const items: QueueItem[] = [
      makeItem({ submission_id: "completed", status: "approved" }),
      makeItem({ submission_id: "stale", submitted_at: "2026-04-05T10:00:00Z" }),
      makeItem({ submission_id: "fresh", submitted_at: "2026-04-24T10:00:00Z" }),
      makeItem({ submission_id: "aging", submitted_at: "2026-04-13T10:00:00Z" }),
      makeItem({ submission_id: "dead", url_status: "dead" }),
      makeItem({ submission_id: "legacy", evidence_visibility: "legacy", has_content_hash: false, has_url: false, url_status: null }),
    ];

    const results = triageQueue(items, AS_OF);

    // Stale unreviewed should be first (most urgent)
    expect(results[0].submission_id).toBe("stale");
    expect(results[0].urgency).toBe("critical");

    // Completed should be last (least urgent)
    expect(results[results.length - 1].submission_id).toBe("completed");
    expect(results[results.length - 1].urgency).toBe("info");
  });

  it("returns empty array for empty queue", () => {
    const results = triageQueue([], AS_OF);
    expect(results).toEqual([]);
  });
});

// ─── Status Line Safety ──────────────────────────────────────────

describe("Status line does not leak restricted evidence", () => {
  it("private evidence status line says 'evidence restricted' not URL", () => {
    const item = makeItem({
      evidence_visibility: "private",
      has_content_hash: false,
      has_url: true,
      url_status: "live",
    });
    const result = triageQueueItem(item, AS_OF);

    expect(result.status_line).toContain("evidence restricted");
    expect(result.status_line).not.toContain(item.producer_address);
  });

  it("legacy evidence status line mentions attestation requirement", () => {
    const item = makeItem({
      evidence_visibility: "legacy",
      has_content_hash: false,
      has_url: false,
      url_status: null,
    });
    const result = triageQueueItem(item, AS_OF);

    expect(result.status_line).toContain("attestation");
  });
});

// ─── Determinism ─────────────────────────────────────────────────

describe("Determinism", () => {
  it("produces identical output for identical input", () => {
    const item = makeItem({ submitted_at: "2026-04-15T10:00:00Z" });
    const r1 = triageQueueItem(item, AS_OF);
    const r2 = triageQueueItem(item, AS_OF);

    expect(r1).toEqual(r2);
  });

  it("produces different output for different as_of dates", () => {
    const item = makeItem({ submitted_at: "2026-04-20T10:00:00Z" });
    const fresh = triageQueueItem(item, new Date("2026-04-22T12:00:00Z"));
    const stale = triageQueueItem(item, new Date("2026-05-10T12:00:00Z"));

    expect(fresh.age_class).toBe("fresh");
    expect(stale.age_class).toBe("stale");
  });
});
