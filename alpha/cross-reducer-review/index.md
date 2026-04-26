---
layout: default
title: "Cross-Reducer State Contract Review — Shared Vocabulary for Task Node Verification"
date: 2026-04-26
category: network
status: published
task_id: db179568-9bd7-4d6e-a5ce-cd0e928a35ce
reward: 5357 PFT
---

# Cross-Reducer State Contract Review

**Author:** Zoz (Permanent Upper Class Validator)  
**Date:** April 26, 2026  
**Task ID:** db179568-9bd7-4d6e-a5ce-cd0e928a35ce  
**Public URL:** [pft.permanentupperclass.com/alpha/cross-reducer-review/](https://pft.permanentupperclass.com/alpha/cross-reducer-review/)

> This document aligns the state contracts of three Task Node verification reducers into a shared vocabulary. It does not duplicate any reducer implementation -- it defines the interface compatibility layer between them.

---

## 1. Scope and Non-Scope

**In scope:** Shared type vocabulary, interface compatibility, reviewer-safe metadata contracts, state transition examples, integration handoff.

**Not in scope:** Reducer implementation (already built), reward calculation logic, payment routing, fee splitting, private repo details, restricted artifact content.

**The three reducers being aligned:**

| Reducer | Purpose | Key Output |
|---------|---------|------------|
| **artifact-visibility** | Classifies evidence into visibility states, scopes metadata by viewer role | `ArtifactRenderState` |
| **reviewer-queue-triage** | Ages queue items, assigns urgency and recommended actions | `TriageResult` |
| **reward-cap** | Converts evidence quality + risk into reward eligibility signals | `RewardCapResult` |

---

## 2. Proposed Shared State Vocabulary

These types form the shared language across all three reducers. Each reducer consumes and/or produces values from this vocabulary.

### 2.1 Evidence Visibility

```typescript
type EvidenceVisibility = "public" | "private" | "obfuscated" | "legacy";
```

**Used by:** All three reducers (input).  
**Invariant:** The same visibility value must flow through all three stages for a given submission. No reducer re-derives or overrides visibility.

### 2.2 Verification Confidence

```typescript
type VerificationConfidence = "high" | "medium" | "low" | "attested" | "none";
```

**Used by:** reward-cap (input), reviewer-queue-triage (indirectly via evidence accessibility).  
**Invariant:** Confidence is set once at verification time. Downstream reducers consume it but never upgrade it.

### 2.3 Queue Status

```typescript
type QueueStatus = "fresh" | "aging" | "stale" | "deadlocked" | "completed" | "withdrawn";
```

**Produced by:** reviewer-queue-triage (`age_class` maps to this).  
**Consumed by:** reward-cap (queue_status input).  
**Invariant:** Queue status reflects submission age and reviewer activity, never evidence quality. The reward-cap reducer must treat queue_status as informational only -- `queue_adjustment` is always 1.0.

### 2.4 Reward Eligibility

```typescript
type RewardEligibility =
  | "full_eligible" | "capped" | "review_hold"
  | "evidence_hold" | "blocked" | "withdrawn";
```

**Produced by:** reward-cap.  
**Consumed by:** UI scoring surfaces, emission pipeline (downstream).  
**Invariant:** Eligibility is a cap signal, not a payout instruction.

### 2.5 Abuse Risk Flags

```typescript
interface AbuseRiskFlags {
  duplicate_submission: boolean;
  collision_with_other_task: boolean;
  sybil_flagged_producer: boolean;
  velocity_anomaly: boolean;
  reward_concentration_risk: boolean;
}
```

**Consumed by:** reward-cap (input).  
**Invariant:** Risk flags are computed externally (sybil classifier, duplicate detector). No reducer derives its own risk flags.

### 2.6 Collaboration Eligibility

```typescript
type CollaborationEligibility = "open" | "constrained" | "reviewer_only" | "not_eligible";
```

**Produced by:** artifact-visibility (derived from visibility state + obfuscation subtype).  
**Consumed by:** Task generator preflight.  
**Invariant:** Discoverable does not mean reusable. Reusable does not mean reviewable.

### 2.7 Reviewer-Safe Metadata Envelope

```typescript
interface SafeMetadata {
  has_reviewer: boolean;          // not WHO, just whether assigned
  reviewer_verifiable: boolean;   // reviewer can access evidence via gate
  publicly_openable: boolean;     // anyone can view without login
  evidence_accessible: boolean;   // deprecated -- use above two fields
  age_days: number | null;
  days_since_last_action: number | null;
}
```

**Produced by:** reviewer-queue-triage + artifact-visibility.  
**Invariant:** Safe metadata never contains identifiers (task_id, submission_id, producer_address, reviewer_address) or raw URLs.

---

## 3. Interface Compatibility Matrix

How each reducer's output feeds the next:

```
artifact-visibility          reviewer-queue-triage          reward-cap
     |                              |                          |
     | EvidenceVisibility --------->| EvidenceVisibility ------>|
     | CollaborationEligibility     |                          |
     | reviewer_verifiable -------->| (evidence accessible) -->|
     | publicly_openable ---------->|                          |
     |                              | QueueStatus ------------>|
     |                              | age_class --------------->|
     |                              | has_reviewer ----------->|
     |                              |                          | RewardEligibility
     |                              |                          | cap_multiplier
     |                              |                          | RecommendedAction
```

### Field Mapping Table

| Source Reducer | Field | Target Reducer | Target Field | Notes |
|---------------|-------|----------------|--------------|-------|
| artifact-visibility | `visibility_state` | reviewer-queue-triage | `evidence_visibility` | Direct pass-through |
| artifact-visibility | `visibility_state` | reward-cap | `evidence_visibility` | Direct pass-through |
| artifact-visibility | `reviewer_verifiable` | reviewer-queue-triage | derived `evidence_accessible` | Triage uses this for awaiting_verification check |
| artifact-visibility | `publicly_openable` | reward-cap | influences `verification_confidence` | Public + live URL = high confidence |
| artifact-visibility | `collaboration_eligibility` | task generator | preflight check | Not consumed by other reducers |
| reviewer-queue-triage | `age_class` | reward-cap | `queue_status` | Mapped: fresh/normal->fresh, aging->aging, stale->stale |
| reviewer-queue-triage | `triage_label` | UI | display | Not consumed by reward-cap |
| reviewer-queue-triage | `urgency` | UI | sort order | Not consumed by reward-cap |
| reward-cap | `eligibility` | emission pipeline | gate | Downstream of all three reducers |
| reward-cap | `cap_multiplier` | ledger write | final payout calc | Binding output -- not `capped_reward_pft` |

---

## 4. Peer Feedback Pass

### Feedback Source: Task Node Review System

The following feedback was received through the task node's built-in review process during submission of the three component reducers. Each piece of feedback that affected the shared contract is documented below.

#### Feedback 1: "evidence_accessible should be split"

> *"Private evidence with a hash is called 'accessible.' That is defensible if 'accessible' means 'verifiable through gated reviewer access,' but the wording is risky. A collaborator-facing queue could misread evidence_accessible: true as 'safe to open/show.'"*

**Decision:** Accepted. Split into `reviewer_verifiable` and `publicly_openable`. All three reducers updated. The shared vocabulary now uses these two fields instead of the ambiguous single boolean.

#### Feedback 2: "Missing timestamp should not default to fresh"

> *"A queue item with missing submission time should not look 'fresh.' It should produce timestamp_missing with repair_metadata action."*

**Decision:** Accepted. Added `timestamp_missing` as a triage label and `repair_metadata` as a recommended action. The triage reducer now treats broken queue state as a first-class operational risk, not a default happy path.

#### Feedback 3: "Reviewer delay must not penalize submitter"

> *"The task explicitly says reviewer delay alone must not penalize the submitter."*

**Decision:** Accepted as a hard invariant across all three reducers. The reward-cap reducer enforces `queue_adjustment: 1.0` always. The triage reducer emits `queue_stale_no_fault` as a reason code. The shared contract documents this as a cross-reducer invariant.

#### Feedback 4: "Cap floor to prevent Goodharting tiny caps"

> *"Multiplicative factors can create very low but nonzero caps. Add a minimum floor below which the state becomes review_hold."*

**Decision:** Accepted. Added `MIN_AUTO_CAP_MULTIPLIER = 0.25`. Below this threshold, eligibility becomes `review_hold` with `cap_below_auto_emission_floor` reason code.

#### Feedback 5: "Status lines should never contain identifier fragments"

> *"formatStatusLine includes reviewer ID fragments. Keep raw reviewer IDs out of the human line."*

**Decision:** Accepted. Status lines across all reducers now use `"reviewer assigned"` / `"unassigned"` instead of ID fragments. Hard no-leak tests assert status_line never contains task_id, submission_id, producer_address, or assigned_reviewer.

#### Feedback 6: "Add reviewer deadlock detection"

> *"Stale in-progress is good, but a true stalled reviewer is different from a merely old submission."*

**Decision:** Accepted. Added `reviewer_deadlock` label with `reassign_or_escalate` action when reviewer action is 10+ days stale.

### Rejected Suggestions

| Suggestion | Reason for Rejection |
|-----------|---------------------|
| Add `reserved_cap_multiplier` separate from `cap_multiplier` | Adds complexity without changing downstream behavior -- the cap is already reserved when `blocks_automated_emission` is true. Can revisit if appeal logic requires it. |
| Add `evidence_metadata` sub-object with hash/envelope/attestation booleans | Correct in principle but increases input contract surface. Current approach uses `verification_confidence` as a summary signal. Can add in v2 if needed. |

### Open Questions

1. **Should `collaboration_eligibility` flow into the triage reducer?** Currently only the task generator consumes it. If a reviewer needs to know whether an artifact is cross-checkable, the triage reducer would need this field.

2. **Who computes `VerificationConfidence`?** Neither the visibility mapper nor the triage reducer produces it. It's currently an input to reward-cap from an unspecified upstream. This needs an owner.

3. **Should `reviewer_deadlock` trigger automatic reassignment, or only surface a recommendation?** Current implementation recommends; actual reassignment is a product decision.

---

## 5. State Transition Examples

### Example A: Public Verified Submission (Happy Path)

```
Step 1: Producer submits with public URL
  artifact-visibility:
    visibility_state: "public"
    collaboration_eligibility: "open"
    reviewer_verifiable: true
    publicly_openable: true

Step 2: Enters reviewer queue (Day 1)
  reviewer-queue-triage:
    triage_label: "fresh_active"
    age_class: "fresh"
    urgency: "medium"
    recommended_action: "review_now"

Step 3: Reward cap computed
  reward-cap:
    eligibility: "full_eligible"
    cap_multiplier: 1.0
    queue_adjustment: 1.0
    dominant_reason: "evidence_public_verified"
    recommended_reviewer_action: "approve_cap"

Step 4: Reviewer approves (Day 3)
  -> Emission pipeline receives cap_multiplier: 1.0
  -> Ledger write: base_reward * 1.0
```

No restricted evidence exposed at any stage. Reviewer saw public URL, verified hash, approved.

### Example B: Private Evidence with Stale Queue

```
Step 1: Producer submits with private evidence + content hash
  artifact-visibility:
    visibility_state: "private"
    collaboration_eligibility: "reviewer_only"
    reviewer_verifiable: true      (hash present)
    publicly_openable: false

Step 2: Queue ages to 18 days, no reviewer assigned
  reviewer-queue-triage:
    triage_label: "stale_unreviewed"
    age_class: "stale"
    urgency: "critical"
    recommended_action: "review_now"

Step 3: Reward cap computed
  reward-cap:
    eligibility: "review_hold"
    cap_multiplier: 0.6            (private 0.75 * medium 0.8)
    queue_adjustment: 1.0          (delay does NOT penalize)
    reason_codes: ["evidence_private_hash_verified", "queue_stale_no_fault"]
    recommended_reviewer_action: "verify_private_metadata"
    invariants.reviewer_delay_penalizes_submitter: false

Step 4: Reviewer eventually verifies via gated access (Day 22)
  -> cap_multiplier: 0.6 applied to base reward
  -> Submitter receives 60% despite 22-day delay (not penalized for queue age)
```

Key: the 22-day delay did not reduce the cap from what it would have been on Day 1.

### Example C: Legacy Evidence with Sybil Flag

```
Step 1: Legacy submission, no URL, no hash, reviewer-attested only
  artifact-visibility:
    visibility_state: "legacy"
    collaboration_eligibility: "not_eligible"
    reviewer_verifiable: false
    publicly_openable: false

Step 2: Queue triage
  reviewer-queue-triage:
    triage_label: "legacy_evidence"
    urgency: "medium"
    recommended_action: "attest_legacy"

Step 3: Sybil classifier flags the producer
  risk_flags.sybil_flagged_producer: true

Step 4: Reward cap computed
  reward-cap:
    eligibility: "blocked"
    cap_multiplier: 0
    dominant_reason: "sybil_flagged"
    recommended_reviewer_action: "escalate_sybil_review"
    cap_components:
      visibility_factor: 0.5       (forensic -- shows legacy visibility)
      confidence_factor: 0.7       (forensic -- shows attested confidence)
      risk_factor: 0               (sybil block zeroes the risk factor)
      terminal_override: "sybil_block"
    invariants.blocks_automated_emission: true
```

Key: sybil block dominates all positive evidence signals. Forensic cap_components preserve what the cap would have been without the block (0.35) for audit/appeal purposes.

---

## 6. Cross-Reducer Invariants

These must hold across all three reducers simultaneously:

| # | Invariant | Enforced By |
|---|-----------|-------------|
| 1 | **Reviewer delay never penalizes submitter.** queue_adjustment is always 1.0 in reward-cap. Queue staleness produces reason codes, not cap reductions. | reward-cap |
| 2 | **Restricted evidence is never exposed.** Status lines, display labels, and safe metadata contain no identifiers, URLs, or content from private/obfuscated/legacy artifacts. | All three |
| 3 | **Visibility state flows through unchanged.** No reducer re-derives or overrides the visibility set by artifact-visibility. | Contract rule |
| 4 | **Sybil block dominates all positive signals.** Even public verified evidence with high confidence gets cap_multiplier: 0 if sybil-flagged. | reward-cap |
| 5 | **Impossible tasks are blocked at generation.** If no artifacts with `open` collaboration eligibility exist, cross-check tasks cannot be generated. | artifact-visibility preflight |
| 6 | **Cap multiplier is the binding output.** Downstream emission uses cap_multiplier, not capped_reward_pft (which is a convenience snapshot). | reward-cap contract |
| 7 | **Confidence is set once, consumed downstream.** Neither triage nor reward-cap upgrades verification confidence. | Contract rule |

---

## 7. Decision Log

| # | Decision | Trigger | Outcome |
|---|----------|---------|---------|
| 1 | Split `evidence_accessible` into two fields | Peer review: ambiguity risk | `reviewer_verifiable` + `publicly_openable` adopted across all reducers |
| 2 | Missing timestamp = operational risk, not happy path | Peer review: fresh_active for broken data is wrong | `timestamp_missing` label + `repair_metadata` action added |
| 3 | Reviewer delay invariant formalized | Task requirement + peer review | Documented as cross-reducer invariant #1, tested in all three test suites |
| 4 | Cap floor at 25% | Peer review: Goodharting tiny caps | `MIN_AUTO_CAP_MULTIPLIER = 0.25`, below = `review_hold` |
| 5 | No identifier fragments in status lines | Peer review: privacy leakage | Hard no-leak assertions in all test suites |
| 6 | Reviewer deadlock as distinct label | Peer review: stalled vs old are different | `reviewer_deadlock` + `reassign_or_escalate` added to triage |
| 7 | `cap_multiplier` is binding, not `capped_reward_pft` | Verification question during review | Documented as invariant #6 |
| 8 | Reject `reserved_cap_multiplier` for now | Adds complexity, no current consumer | Deferred to v2 if appeal logic needs it |
| 9 | Reject `evidence_metadata` sub-object for now | Increases contract surface | Deferred to v2 |

---

## 8. Implementation Handoff Checklist

For the contributor wiring these contracts into Task Node UI, reducer, or scoring surfaces:

### Data Layer

- [ ] Shared types file: create `shared-state-types.ts` exporting the vocabulary from Section 2
- [ ] All three reducers import from shared types (not local re-definitions)
- [ ] Verify `EvidenceVisibility` enum is identical across all three reducer inputs
- [ ] Verify `QueueStatus` mapping from triage `age_class` to reward-cap `queue_status`
- [ ] Confirm `VerificationConfidence` has an owner (currently unassigned -- see Open Question #2)

### UI Surfaces

- [ ] Submission detail: consumes `ArtifactRenderState` from artifact-visibility
- [ ] Reviewer queue: consumes `TriageResult` from reviewer-queue-triage, sorted by `sort_priority`
- [ ] Scoring panel: consumes `RewardCapResult` from reward-cap, displays `eligibility` + `display_label`
- [ ] All surfaces use `reviewer_verifiable` / `publicly_openable` (not deprecated `evidence_accessible`)

### Safety Checks

- [ ] Run no-leak assertions: status_line and display_label contain no identifiers across all reducers
- [ ] Verify `queue_adjustment === 1.0` in all reward-cap test fixtures
- [ ] Verify sybil block produces `cap_multiplier: 0` regardless of evidence quality
- [ ] Verify `timestamp_missing` produces `repair_metadata`, not `review_now`
- [ ] Verify cap floor: multiplier < 0.25 routes to `review_hold`

### Integration Tests (New)

- [ ] End-to-end: public verified submission flows through all three reducers to `full_eligible`
- [ ] End-to-end: private stale submission flows through to `review_hold` with `queue_adjustment: 1.0`
- [ ] End-to-end: legacy + sybil flows through to `blocked` with forensic cap_components preserved
- [ ] Preflight: cohort with 0 open artifacts blocks cross-check task generation

### Open Items Requiring Policy Decision

- [ ] Who computes `VerificationConfidence`? Assign an owner or build a fourth reducer.
- [ ] Should `collaboration_eligibility` flow into the triage reducer?
- [ ] Should `reviewer_deadlock` trigger automatic reassignment?

---

*This document is implementation guidance for core-team review. It defines interface compatibility between existing reducers without duplicating their implementations. All contracts reference public artifacts only.*
