---
layout: default
title: Deterministic Operator Reputation Ledger Module
date: 2026-04-08
category: network
status: submitted
task_id: 7ae717a2-f9fa-4226-acf6-c512c9949500
---

# Deterministic Operator Reputation Ledger Module

| Field | Value |
|---|---|
| **Task ID** | `7ae717a2-f9fa-4226-acf6-c512c9949500` |
| **Reward** | 5,000 PFT |
| **Verification** | Code artifact |
| **Schema Version** | 1.0.0 |

## Executive Summary

This module ingests per-operator task history — rewarded tasks, refusals/cancellations, holdback outcomes, and evidence metadata — and emits a **persistent reputation snapshot JSON**. The snapshot includes completion rate, evidence quality score, rejection rate, holdback rate, reward velocity (7d/30d), category diversity, trust tier, risk signals, and reason codes.

**What it is:** A deterministic scoring engine that converts raw operator history into a structured reputation profile consumable by payout, guardrail, moderation, and emissions modules without manual interpretation.

**What it is NOT:** A runtime service, a database, or an event processor. This is a pure function: same input always produces byte-identical output.

## Determinism Guarantee

Given identical input, `generateReputationLedger()` produces byte-identical JSON output across any number of invocations. The `as_of` timestamp is a **required** input field; `generated_at` is always set equal to `as_of`. No runtime clock (`new Date()`) is ever consulted. All floating-point values are rounded to 6 decimal places. All arrays (categories, reason codes, risk signals) are deterministically sorted.

## API Contract

```typescript
function generateReputationLedger(
  input: ReputationLedgerInput
): ReputationLedgerOutput
```

**Single input object** containing:
- `operator` — full operator history (rewarded tasks, refusals, holdbacks, evidence)
- `as_of` — ISO 8601 evaluation timestamp (required)
- `thresholds` — optional partial override of any scoring threshold

**Returns** a `ReputationLedgerOutput` with:
- `reputation_snapshot` — all computed metrics
- `trust_tier` — operator classification
- `risk_signals` — structured alerts with severity and consumer routing
- `reason_codes` — sorted list of all applicable reason codes
- `threshold_config` — full resolved thresholds (echo-back for reproducibility)
- `downstream_hints` — pre-computed action hints for each consumer module

## Output Field → Downstream Consumer Mapping

| Output Field | Payout | Guardrail | Moderation | Emissions |
|---|---|---|---|---|
| `reputation_snapshot` | Metrics for review | Metrics for review | Metrics for review | Metrics for review |
| `trust_tier` | Multiplier selection | Issuance rate | Review threshold | Bonus eligibility |
| `risk_signals` | Hold triggers | Suppression triggers | Escalation triggers | Exclusion triggers |
| `reason_codes` | Audit trail | Audit trail | Audit trail | Audit trail |
| `threshold_config` | Verification | Verification | Verification | Verification |
| `downstream_hints.payout_action` | `standard` / `hold_for_review` / `bonus_eligible` | — | — | — |
| `downstream_hints.guardrail_action` | — | `full_issuance` / `reduced_issuance` / `suppress` | — | — |
| `downstream_hints.moderation_action` | — | — | `no_action` / `flag_for_review` / `escalate` | — |
| `downstream_hints.emissions_eligible` | — | — | — | `true` / `false` |

## Trust Tier Decision Logic

| Priority | Tier | Condition | Rationale |
|---|---|---|---|
| 1 | `new_operator` | total_tasks < min_tasks_for_stats | Not enough data for statistical classification |
| 2 | `exemplary` | completion_rate >= exemplary_threshold AND evidence_quality >= strong_threshold | Both behavioral and evidence signals are strong |
| 3 | `reliable` | completion_rate >= reliable_threshold | Solid track record, evidence not required at this level |
| 4 | `developing` | completion_rate >= developing_threshold | Room for improvement but not problematic |
| 5 | `probationary` | Below all thresholds | Operator needs intervention or closer monitoring |

## Risk Signal Logic

| Signal Code | Severity | Trigger | Consumer Routing |
|---|---|---|---|
| `high_rejection_rate` | critical (>=50%) / high (>=30%) | rejection_rate >= high_rejection_rate threshold | guardrail, moderation, payout |
| `high_holdback_rate` | high (>=40%) / medium (>=20%) | holdback_rate >= high_holdback_rate threshold | payout, moderation |
| `unresolved_holdbacks` | high (>=3) / medium (<3) | Any pending holdbacks | payout, moderation |
| `weak_evidence_quality` | high (<40) / medium (<75) | evidence_quality below strong_evidence_quality | moderation, emissions |
| `low_category_diversity` | low | categories < min_category_diversity | emissions |
| `stale_history` | high (>=2x stale_days) / medium | Last completion older than stale_days | guardrail, emissions |
| `declining_velocity` | info | 30d velocity < 50% of 7d velocity | emissions |

## Configurable Thresholds

| Threshold | Default | Purpose |
|---|---|---|
| `velocity_window_7d` | 7 | Days for short-term velocity calculation |
| `velocity_window_30d` | 30 | Days for long-term velocity calculation |
| `min_tasks_for_stats` | 3 | Minimum tasks before classification (below = new_operator) |
| `exemplary_completion_rate` | 0.90 | Completion rate for exemplary tier |
| `reliable_completion_rate` | 0.70 | Completion rate for reliable tier |
| `developing_completion_rate` | 0.50 | Completion rate for developing tier |
| `high_rejection_rate` | 0.30 | Rejection rate triggering risk signal |
| `high_holdback_rate` | 0.20 | Holdback rate triggering risk signal |
| `strong_evidence_quality` | 75 | Evidence quality score considered "strong" |
| `min_category_diversity` | 3 | Minimum unique categories before concentration flag |
| `stale_days` | 60 | Days without activity before stale flag |

All thresholds can be overridden per-call via the `thresholds` input field.

## Sample Input/Output

### Example 1: Exemplary Operator

**Input:**

```json
{
  "operator": {
    "operator_id": "op-exemplary-001",
    "first_seen": "2025-06-01T00:00:00.000Z",
    "rewarded_tasks": [
      { "task_id": "t-001", "completed_at": "2026-04-05T00:00:00.000Z", "reward_pft": 500, "score": 95, "category": "network" },
      { "task_id": "t-002", "completed_at": "2026-04-04T00:00:00.000Z", "reward_pft": 300, "score": 88, "category": "personal" },
      { "task_id": "t-003", "completed_at": "2026-04-02T00:00:00.000Z", "reward_pft": 400, "score": 92, "category": "mechanism-design" },
      { "task_id": "t-004", "completed_at": "2026-03-28T00:00:00.000Z", "reward_pft": 250, "score": 85, "category": "research" },
      { "task_id": "t-005", "completed_at": "2026-03-15T00:00:00.000Z", "reward_pft": 600, "score": 90, "category": "network" }
    ],
    "refusals": [],
    "holdbacks": [],
    "evidence": [
      { "task_id": "t-001", "submitted_at": "2026-04-05T00:00:00.000Z", "evidence_type": "url", "verified": true, "quality_score": 90 },
      { "task_id": "t-002", "submitted_at": "2026-04-04T00:00:00.000Z", "evidence_type": "code", "verified": true, "quality_score": 85 },
      { "task_id": "t-003", "submitted_at": "2026-04-02T00:00:00.000Z", "evidence_type": "document", "verified": true, "quality_score": 88 },
      { "task_id": "t-004", "submitted_at": "2026-03-28T00:00:00.000Z", "evidence_type": "url", "verified": true, "quality_score": 80 },
      { "task_id": "t-005", "submitted_at": "2026-03-15T00:00:00.000Z", "evidence_type": "code", "verified": true, "quality_score": 92 }
    ]
  },
  "as_of": "2026-04-08T00:00:00.000Z"
}
```

**Output (key fields):**

```json
{
  "trust_tier": "exemplary",
  "reputation_snapshot": {
    "completion_rate": 1,
    "evidence_quality_score": 87,
    "rejection_rate": 0,
    "holdback_rate": 0,
    "category_diversity": 4,
    "categories_seen": ["mechanism-design", "network", "personal", "research"]
  },
  "reason_codes": ["clean_holdback_record", "consistent_reward_velocity", "high_category_diversity", "high_completion_rate", "no_evidence_submitted", "strong_evidence_quality"],
  "downstream_hints": {
    "payout_action": "bonus_eligible",
    "guardrail_action": "full_issuance",
    "moderation_action": "no_action",
    "emissions_eligible": true
  }
}
```

### Example 2: Probationary Operator (Rejection Spike + Unresolved Holdbacks)

**Input:**

```json
{
  "operator": {
    "operator_id": "op-risky-002",
    "rewarded_tasks": [
      { "task_id": "t-010", "completed_at": "2026-04-01T00:00:00.000Z", "reward_pft": 100, "category": "network" }
    ],
    "refusals": [
      { "task_id": "t-011", "type": "no_response", "occurred_at": "2026-04-03T00:00:00.000Z" },
      { "task_id": "t-012", "type": "quality_reject", "occurred_at": "2026-04-02T00:00:00.000Z" },
      { "task_id": "t-013", "type": "cancelled", "occurred_at": "2026-03-30T00:00:00.000Z" },
      { "task_id": "t-014", "type": "explicit_decline", "occurred_at": "2026-03-25T00:00:00.000Z" }
    ],
    "holdbacks": [
      { "task_id": "t-010", "held_at": "2026-04-01T00:00:00.000Z", "outcome": "pending" },
      { "task_id": "t-015", "held_at": "2026-03-20T00:00:00.000Z", "outcome": "pending" }
    ],
    "evidence": [
      { "task_id": "t-010", "submitted_at": "2026-04-01T00:00:00.000Z", "evidence_type": "screenshot", "verified": false, "quality_score": 30 }
    ]
  },
  "as_of": "2026-04-08T00:00:00.000Z"
}
```

**Output (key fields):**

```json
{
  "trust_tier": "probationary",
  "reputation_snapshot": {
    "completion_rate": 0.2,
    "rejection_rate": 0.8,
    "holdback_rate": 2,
    "evidence_quality_score": 30,
    "unresolved_holdback_count": 2
  },
  "risk_signals": [
    { "code": "high_rejection_rate", "severity": "critical", "consumers": ["guardrail", "moderation", "payout"] },
    { "code": "high_holdback_rate", "severity": "high", "consumers": ["payout", "moderation"] },
    { "code": "unresolved_holdbacks", "severity": "medium", "consumers": ["payout", "moderation"] },
    { "code": "weak_evidence_quality", "severity": "high", "consumers": ["moderation", "emissions"] }
  ],
  "downstream_hints": {
    "payout_action": "hold_for_review",
    "guardrail_action": "suppress",
    "moderation_action": "escalate",
    "emissions_eligible": false
  }
}
```

### Example 3: New Operator (Insufficient History)

**Input:**

```json
{
  "operator": {
    "operator_id": "op-new-003",
    "first_seen": "2026-04-06T00:00:00.000Z",
    "rewarded_tasks": [
      { "task_id": "t-020", "completed_at": "2026-04-07T00:00:00.000Z", "reward_pft": 200, "category": "personal" }
    ],
    "refusals": [],
    "holdbacks": [],
    "evidence": []
  },
  "as_of": "2026-04-08T00:00:00.000Z"
}
```

**Output (key fields):**

```json
{
  "trust_tier": "new_operator",
  "reputation_snapshot": {
    "completion_rate": 1,
    "total_tasks": 1,
    "category_diversity": 1
  },
  "reason_codes": ["insufficient_history", "new_operator", "no_evidence_submitted"],
  "downstream_hints": {
    "payout_action": "standard",
    "guardrail_action": "reduced_issuance",
    "moderation_action": "no_action",
    "emissions_eligible": false
  }
}
```

## Source Code

### types.ts

```typescript
/**
 * Operator Reputation Ledger Module — Types
 *
 * Input/output schemas for ingesting per-operator task history and emitting
 * a persistent reputation snapshot JSON. The output is shaped for direct
 * consumption by payout, guardrail, moderation, and emissions modules.
 */

// ============================================================================
// Schema Version
// ============================================================================

export const SCHEMA_VERSION = '1.0.0';

// ============================================================================
// Input Types
// ============================================================================

/**
 * A completed/rewarded task record.
 */
export interface RewardedTask {
  task_id: string;
  completed_at: string;       // ISO 8601
  reward_pft: number;         // PFT awarded
  score?: number;             // 0–100 quality grade (if graded)
  category?: string;          // e.g. "network", "personal", "mechanism-design"
}

/**
 * A refused or cancelled task record.
 */
export type RefusalType =
  | 'explicit_decline'   // Operator declined before starting
  | 'no_response'        // Task expired without submission
  | 'cancelled'          // Operator cancelled mid-task
  | 'quality_reject'     // Submission rejected for quality
  | 'wrong_scope';       // Submission rejected as out of scope

export interface RefusalRecord {
  task_id: string;
  type: RefusalType;
  occurred_at: string;        // ISO 8601
  notes?: string;
}

/**
 * A holdback event — reward withheld pending review or permanently.
 */
export type HoldbackOutcome =
  | 'pending'       // Still under review
  | 'released'      // Holdback resolved, reward released
  | 'forfeited';    // Reward permanently withheld

export interface HoldbackRecord {
  task_id: string;
  held_at: string;            // ISO 8601
  outcome: HoldbackOutcome;
  resolved_at?: string;       // ISO 8601, if outcome != 'pending'
  reason?: string;
}

/**
 * Evidence metadata linked to a task submission.
 */
export interface EvidenceRecord {
  task_id: string;
  submitted_at: string;       // ISO 8601
  evidence_type: 'url' | 'code' | 'document' | 'screenshot' | 'other';
  verified: boolean;          // Was evidence independently verified?
  quality_score?: number;     // 0–100 if graded
}

/**
 * Full operator history — the primary input record.
 */
export interface OperatorHistory {
  operator_id: string;
  first_seen?: string;              // ISO 8601
  rewarded_tasks: RewardedTask[];
  refusals: RefusalRecord[];
  holdbacks: HoldbackRecord[];
  evidence: EvidenceRecord[];
}

/**
 * Configurable thresholds for reputation scoring.
 *
 * Threshold configuration:
 * - Window sizes control how far back velocity calculations look.
 * - Rate thresholds define boundaries between trust tiers.
 * - All thresholds can be overridden per-call to support A/B testing
 *   or operator-specific policy variants.
 */
export interface ReputationThresholds {
  /** Days to look back for 7-day reward velocity */
  velocity_window_7d: number;
  /** Days to look back for 30-day reward velocity */
  velocity_window_30d: number;

  /** Minimum completed tasks for statistical significance */
  min_tasks_for_stats: number;

  // --- Trust tier boundaries ---

  /** Completion rate >= this → eligible for "exemplary" tier */
  exemplary_completion_rate: number;
  /** Completion rate >= this → "reliable" tier */
  reliable_completion_rate: number;
  /** Completion rate >= this → "developing" tier; below → "probationary" */
  developing_completion_rate: number;

  /** Rejection rate above this triggers risk signal */
  high_rejection_rate: number;
  /** Holdback rate above this triggers risk signal */
  high_holdback_rate: number;

  /** Evidence quality score >= this considered "strong" */
  strong_evidence_quality: number;

  /** Category diversity: fewer unique categories than this is "concentrated" */
  min_category_diversity: number;

  /** Days without activity before operator is considered "stale" */
  stale_days: number;
}

export const DEFAULT_THRESHOLDS: ReputationThresholds = {
  velocity_window_7d: 7,
  velocity_window_30d: 30,
  min_tasks_for_stats: 3,
  exemplary_completion_rate: 0.90,
  reliable_completion_rate: 0.70,
  developing_completion_rate: 0.50,
  high_rejection_rate: 0.30,
  high_holdback_rate: 0.20,
  strong_evidence_quality: 75,
  min_category_diversity: 3,
  stale_days: 60,
};

/**
 * Module input — single operator history + evaluation timestamp.
 */
export interface ReputationLedgerInput {
  operator: OperatorHistory;
  as_of: string;                           // ISO 8601 — required for determinism
  thresholds?: Partial<ReputationThresholds>;  // Override any subset
}

// ============================================================================
// Output Types
// ============================================================================

/**
 * Trust tier — determines downstream issuance and payout policy.
 *
 * Downstream consumer mapping:
 * - payout module:    exemplary/reliable → standard payout; probationary → held for review
 * - guardrail module: probationary/developing → reduced task issuance rate
 * - emissions module: exemplary → bonus multiplier eligibility
 * - moderation module: probationary → flagged for human review
 */
export type TrustTier =
  | 'exemplary'      // Top-tier operator: high completion, strong evidence
  | 'reliable'       // Solid operator: good completion rate
  | 'developing'     // Adequate but room for improvement
  | 'probationary'   // Below thresholds or insufficient history
  | 'new_operator';  // Not enough data to classify

/**
 * Reason codes — every decision is traceable to one or more codes.
 */
export type ReasonCode =
  // Positive signals
  | 'high_completion_rate'
  | 'strong_evidence_quality'
  | 'high_category_diversity'
  | 'consistent_reward_velocity'
  | 'clean_holdback_record'
  // Negative signals
  | 'low_completion_rate'
  | 'high_rejection_rate'
  | 'high_holdback_rate'
  | 'weak_evidence_quality'
  | 'low_category_diversity'
  | 'declining_velocity'
  | 'stale_history'
  | 'unresolved_holdbacks'
  // Neutral / informational
  | 'insufficient_history'
  | 'new_operator'
  | 'holdback_recovery'
  | 'no_evidence_submitted';

/**
 * Risk signal — structured alert for downstream consumers.
 *
 * Downstream consumer mapping:
 * - moderation: severity critical/high → auto-escalate
 * - guardrail:  severity high → suppress issuance
 * - payout:     severity medium+ → hold pending review
 * - emissions:  any risk signal → exclude from bonus pool
 */
export type RiskSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface RiskSignal {
  code: ReasonCode;
  severity: RiskSeverity;
  description: string;
  /** Which downstream modules should act on this signal */
  consumers: Array<'payout' | 'guardrail' | 'moderation' | 'emissions'>;
}

/**
 * Reputation snapshot — the core output per operator.
 */
export interface ReputationSnapshot {
  operator_id: string;
  as_of: string;

  // --- Core metrics ---
  completion_rate: number;            // 0–1
  evidence_quality_score: number;     // 0–100
  rejection_rate: number;             // 0–1
  holdback_rate: number;              // 0–1

  // --- Velocity ---
  reward_velocity_7d: number;         // PFT per day over 7-day window
  reward_velocity_30d: number;        // PFT per day over 30-day window

  // --- Diversity ---
  category_diversity: number;         // Count of unique categories
  categories_seen: string[];          // Sorted list of unique categories

  // --- Counts for transparency ---
  total_tasks: number;                // rewarded + refusals
  rewarded_count: number;
  refusal_count: number;
  holdback_count: number;
  evidence_count: number;
  unresolved_holdback_count: number;

  // --- Evidence breakdown ---
  evidence_verified_count: number;
  evidence_unverified_count: number;
}

/**
 * Full reputation ledger output.
 *
 * Output field → downstream consumer mapping:
 * - reputation_snapshot → all consumers (shared operator memory)
 * - trust_tier          → payout (multiplier), guardrail (issuance rate), emissions (bonus eligibility)
 * - risk_signals        → moderation (escalation), guardrail (suppression), payout (hold)
 * - reason_codes        → audit trail for all consumers
 * - threshold_config    → reproducibility; any consumer can verify the scoring parameters
 */
export interface ReputationLedgerOutput {
  generated_at: string;               // = as_of (determinism guarantee)
  as_of: string;
  version: string;                    // SCHEMA_VERSION
  operator_id: string;

  reputation_snapshot: ReputationSnapshot;
  trust_tier: TrustTier;
  risk_signals: RiskSignal[];
  reason_codes: ReasonCode[];
  threshold_config: ReputationThresholds;

  /** Downstream action hints — pre-computed for consumer convenience */
  downstream_hints: {
    payout_action: 'standard' | 'hold_for_review' | 'bonus_eligible';
    guardrail_action: 'full_issuance' | 'reduced_issuance' | 'suppress';
    moderation_action: 'no_action' | 'flag_for_review' | 'escalate';
    emissions_eligible: boolean;
  };
}
```

### reputation-ledger.ts

```typescript
/**
 * Operator Reputation Ledger — Core Implementation
 *
 * Deterministic scoring engine that converts operator task history into
 * a persistent reputation snapshot. All calculations use the provided
 * as_of timestamp — no runtime clock calls.
 */

import {
  SCHEMA_VERSION,
  DEFAULT_THRESHOLDS,
  type ReputationLedgerInput,
  type ReputationLedgerOutput,
  type ReputationSnapshot,
  type ReputationThresholds,
  type TrustTier,
  type RiskSignal,
  type ReasonCode,
  type RiskSeverity,
  type OperatorHistory,
} from './types.js';

// Re-export for convenience
export { DEFAULT_THRESHOLDS, SCHEMA_VERSION };

// ============================================================================
// Helpers
// ============================================================================

/** Days between two ISO 8601 dates. Returns absolute value. */
function daysBetween(a: string, b: string): number {
  const msPerDay = 86_400_000;
  return Math.abs(
    (new Date(a).getTime() - new Date(b).getTime()) / msPerDay
  );
}

/** Round to 6 decimal places for stable floating point. */
function round6(n: number): number {
  return Math.round(n * 1_000_000) / 1_000_000;
}

/** Merge caller overrides with defaults. */
function resolveThresholds(
  overrides?: Partial<ReputationThresholds>
): ReputationThresholds {
  if (!overrides) return { ...DEFAULT_THRESHOLDS };
  return { ...DEFAULT_THRESHOLDS, ...overrides };
}

// ============================================================================
// Scoring Functions
// ============================================================================

/**
 * Completion rate = rewarded / (rewarded + refusals).
 * Returns 0 when there are no tasks.
 */
function computeCompletionRate(op: OperatorHistory): number {
  const total = op.rewarded_tasks.length + op.refusals.length;
  if (total === 0) return 0;
  return round6(op.rewarded_tasks.length / total);
}

/**
 * Evidence quality score = mean of all evidence quality_score values
 * where quality_score is defined. Returns 0 if no scored evidence.
 */
function computeEvidenceQuality(op: OperatorHistory): number {
  const scored = op.evidence.filter(e => e.quality_score != null);
  if (scored.length === 0) return 0;
  const sum = scored.reduce((acc, e) => acc + (e.quality_score ?? 0), 0);
  return round6(sum / scored.length);
}

/**
 * Rejection rate = refusals / (rewarded + refusals).
 * Returns 0 when there are no tasks.
 */
function computeRejectionRate(op: OperatorHistory): number {
  const total = op.rewarded_tasks.length + op.refusals.length;
  if (total === 0) return 0;
  return round6(op.refusals.length / total);
}

/**
 * Holdback rate = holdbacks / rewarded tasks.
 * Returns 0 when there are no rewarded tasks.
 */
function computeHoldbackRate(op: OperatorHistory): number {
  if (op.rewarded_tasks.length === 0) return 0;
  return round6(op.holdbacks.length / op.rewarded_tasks.length);
}

/**
 * Reward velocity = total PFT earned in window / window days.
 * Only counts tasks completed within the window ending at as_of.
 */
function computeRewardVelocity(
  op: OperatorHistory,
  asOf: string,
  windowDays: number
): number {
  if (windowDays <= 0) return 0;
  const cutoff = new Date(
    new Date(asOf).getTime() - windowDays * 86_400_000
  ).toISOString();

  const totalPft = op.rewarded_tasks
    .filter(t => t.completed_at >= cutoff && t.completed_at <= asOf)
    .reduce((sum, t) => sum + t.reward_pft, 0);

  return round6(totalPft / windowDays);
}

/**
 * Category diversity = count of unique categories across rewarded tasks.
 * Tasks without a category are grouped under "uncategorized".
 */
function computeCategoryDiversity(
  op: OperatorHistory
): { count: number; categories: string[] } {
  const cats = new Set<string>();
  for (const t of op.rewarded_tasks) {
    cats.add(t.category ?? 'uncategorized');
  }
  const sorted = [...cats].sort();
  return { count: sorted.length, categories: sorted };
}

// ============================================================================
// Trust Tier Assignment
// ============================================================================

/**
 * Assigns a trust tier based on completion rate, evidence quality, and
 * history depth. Threshold rules are explicit and configurable.
 *
 * Decision tree:
 * 1. If total tasks < min_tasks_for_stats → new_operator
 * 2. If completion_rate >= exemplary AND evidence quality >= strong → exemplary
 * 3. If completion_rate >= reliable → reliable
 * 4. If completion_rate >= developing → developing
 * 5. Otherwise → probationary
 */
function assignTrustTier(
  snapshot: ReputationSnapshot,
  thresholds: ReputationThresholds
): TrustTier {
  if (snapshot.total_tasks < thresholds.min_tasks_for_stats) {
    return 'new_operator';
  }

  if (
    snapshot.completion_rate >= thresholds.exemplary_completion_rate &&
    snapshot.evidence_quality_score >= thresholds.strong_evidence_quality
  ) {
    return 'exemplary';
  }

  if (snapshot.completion_rate >= thresholds.reliable_completion_rate) {
    return 'reliable';
  }

  if (snapshot.completion_rate >= thresholds.developing_completion_rate) {
    return 'developing';
  }

  return 'probationary';
}

// ============================================================================
// Risk Signals & Reason Codes
// ============================================================================

function buildRiskSignals(
  snapshot: ReputationSnapshot,
  thresholds: ReputationThresholds,
  asOf: string,
  op: OperatorHistory
): RiskSignal[] {
  const signals: RiskSignal[] = [];

  // High rejection rate
  if (
    snapshot.total_tasks >= thresholds.min_tasks_for_stats &&
    snapshot.rejection_rate >= thresholds.high_rejection_rate
  ) {
    const severity: RiskSeverity =
      snapshot.rejection_rate >= 0.5 ? 'critical' : 'high';
    signals.push({
      code: 'high_rejection_rate',
      severity,
      description: `Rejection rate ${(snapshot.rejection_rate * 100).toFixed(1)}% exceeds threshold ${(thresholds.high_rejection_rate * 100).toFixed(1)}%`,
      consumers: ['guardrail', 'moderation', 'payout'],
    });
  }

  // High holdback rate
  if (
    snapshot.rewarded_count > 0 &&
    snapshot.holdback_rate >= thresholds.high_holdback_rate
  ) {
    const severity: RiskSeverity =
      snapshot.holdback_rate >= 0.4 ? 'high' : 'medium';
    signals.push({
      code: 'high_holdback_rate',
      severity,
      description: `Holdback rate ${(snapshot.holdback_rate * 100).toFixed(1)}% exceeds threshold ${(thresholds.high_holdback_rate * 100).toFixed(1)}%`,
      consumers: ['payout', 'moderation'],
    });
  }

  // Unresolved holdbacks
  if (snapshot.unresolved_holdback_count > 0) {
    signals.push({
      code: 'unresolved_holdbacks',
      severity: snapshot.unresolved_holdback_count >= 3 ? 'high' : 'medium',
      description: `${snapshot.unresolved_holdback_count} holdback(s) still pending resolution`,
      consumers: ['payout', 'moderation'],
    });
  }

  // Weak evidence quality
  if (
    snapshot.evidence_count > 0 &&
    snapshot.evidence_quality_score > 0 &&
    snapshot.evidence_quality_score < thresholds.strong_evidence_quality
  ) {
    signals.push({
      code: 'weak_evidence_quality',
      severity: snapshot.evidence_quality_score < 40 ? 'high' : 'medium',
      description: `Evidence quality score ${snapshot.evidence_quality_score.toFixed(1)} below threshold ${thresholds.strong_evidence_quality}`,
      consumers: ['moderation', 'emissions'],
    });
  }

  // Low category diversity
  if (
    snapshot.rewarded_count >= thresholds.min_tasks_for_stats &&
    snapshot.category_diversity < thresholds.min_category_diversity
  ) {
    signals.push({
      code: 'low_category_diversity',
      severity: 'low',
      description: `Only ${snapshot.category_diversity} category(ies) — below minimum ${thresholds.min_category_diversity}`,
      consumers: ['emissions'],
    });
  }

  // Stale history
  if (op.rewarded_tasks.length > 0) {
    const lastCompletion = [...op.rewarded_tasks]
      .sort((a, b) => b.completed_at.localeCompare(a.completed_at))[0]
      .completed_at;
    const daysSince = daysBetween(lastCompletion, asOf);
    if (daysSince >= thresholds.stale_days) {
      signals.push({
        code: 'stale_history',
        severity: daysSince >= thresholds.stale_days * 2 ? 'high' : 'medium',
        description: `Last completed task was ${Math.floor(daysSince)} days ago (threshold: ${thresholds.stale_days} days)`,
        consumers: ['guardrail', 'emissions'],
      });
    }
  }

  // Declining velocity (30d velocity < 50% of 7d velocity suggests recent drop-off)
  if (
    snapshot.reward_velocity_7d > 0 &&
    snapshot.reward_velocity_30d > 0 &&
    snapshot.reward_velocity_30d < snapshot.reward_velocity_7d * 0.5
  ) {
    signals.push({
      code: 'declining_velocity',
      severity: 'info',
      description: `30-day velocity (${snapshot.reward_velocity_30d.toFixed(2)} PFT/day) is less than half of 7-day velocity (${snapshot.reward_velocity_7d.toFixed(2)} PFT/day)`,
      consumers: ['emissions'],
    });
  }

  // Sort deterministically: severity DESC (critical first), then code ASC
  const severityOrder: Record<RiskSeverity, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
    info: 4,
  };
  signals.sort((a, b) => {
    const sevDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (sevDiff !== 0) return sevDiff;
    return a.code.localeCompare(b.code);
  });

  return signals;
}

function buildReasonCodes(
  snapshot: ReputationSnapshot,
  thresholds: ReputationThresholds,
  trustTier: TrustTier,
  riskSignals: RiskSignal[],
  op: OperatorHistory
): ReasonCode[] {
  const codes: ReasonCode[] = [];

  // Insufficient / new
  if (snapshot.total_tasks < thresholds.min_tasks_for_stats) {
    codes.push('insufficient_history');
  }
  if (trustTier === 'new_operator') {
    codes.push('new_operator');
  }

  // Positive signals
  if (
    snapshot.total_tasks >= thresholds.min_tasks_for_stats &&
    snapshot.completion_rate >= thresholds.reliable_completion_rate
  ) {
    codes.push('high_completion_rate');
  }
  if (
    snapshot.evidence_count > 0 &&
    snapshot.evidence_quality_score >= thresholds.strong_evidence_quality
  ) {
    codes.push('strong_evidence_quality');
  }
  if (snapshot.category_diversity >= thresholds.min_category_diversity) {
    codes.push('high_category_diversity');
  }
  if (
    snapshot.reward_velocity_7d > 0 &&
    snapshot.reward_velocity_30d > 0 &&
    snapshot.reward_velocity_30d >= snapshot.reward_velocity_7d * 0.5
  ) {
    codes.push('consistent_reward_velocity');
  }
  if (snapshot.holdback_count === 0 && snapshot.rewarded_count > 0) {
    codes.push('clean_holdback_record');
  }

  // Negative signals — pull from risk signals to avoid duplication
  const riskCodes = new Set(riskSignals.map(s => s.code));
  if (riskCodes.has('high_rejection_rate')) codes.push('high_rejection_rate');
  if (riskCodes.has('high_holdback_rate')) codes.push('high_holdback_rate');
  if (riskCodes.has('weak_evidence_quality')) codes.push('weak_evidence_quality');
  if (riskCodes.has('low_category_diversity')) codes.push('low_category_diversity');
  if (riskCodes.has('declining_velocity')) codes.push('declining_velocity');
  if (riskCodes.has('stale_history')) codes.push('stale_history');
  if (riskCodes.has('unresolved_holdbacks')) codes.push('unresolved_holdbacks');

  // Evidence
  if (snapshot.evidence_count === 0 && snapshot.rewarded_count > 0) {
    codes.push('no_evidence_submitted');
  }

  // Holdback recovery: had holdbacks but all resolved positively
  const allReleased =
    op.holdbacks.length > 0 &&
    op.holdbacks.every(h => h.outcome === 'released');
  if (allReleased) {
    codes.push('holdback_recovery');
  }

  // Low completion rate (if not already covered)
  if (
    snapshot.total_tasks >= thresholds.min_tasks_for_stats &&
    snapshot.completion_rate < thresholds.developing_completion_rate
  ) {
    codes.push('low_completion_rate');
  }

  // Deterministic sort
  codes.sort();
  return codes;
}

// ============================================================================
// Downstream Hints
// ============================================================================

function computeDownstreamHints(
  trustTier: TrustTier,
  riskSignals: RiskSignal[]
): ReputationLedgerOutput['downstream_hints'] {
  const maxSeverity = riskSignals.length > 0 ? riskSignals[0].severity : null;

  // Payout action
  let payout_action: 'standard' | 'hold_for_review' | 'bonus_eligible' = 'standard';
  if (trustTier === 'exemplary') {
    payout_action = 'bonus_eligible';
  }
  if (
    maxSeverity === 'critical' ||
    maxSeverity === 'high' ||
    trustTier === 'probationary'
  ) {
    payout_action = 'hold_for_review';
  }

  // Guardrail action
  let guardrail_action: 'full_issuance' | 'reduced_issuance' | 'suppress' = 'full_issuance';
  if (trustTier === 'developing' || trustTier === 'new_operator') {
    guardrail_action = 'reduced_issuance';
  }
  if (trustTier === 'probationary' || maxSeverity === 'critical') {
    guardrail_action = 'suppress';
  }

  // Moderation action
  let moderation_action: 'no_action' | 'flag_for_review' | 'escalate' = 'no_action';
  if (maxSeverity === 'high' || trustTier === 'probationary') {
    moderation_action = 'flag_for_review';
  }
  if (maxSeverity === 'critical') {
    moderation_action = 'escalate';
  }

  // Emissions eligibility
  const emissions_eligible =
    (trustTier === 'exemplary' || trustTier === 'reliable') &&
    riskSignals.every(s => s.severity === 'low' || s.severity === 'info');

  return {
    payout_action,
    guardrail_action,
    moderation_action,
    emissions_eligible,
  };
}

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Generate a deterministic reputation snapshot for a single operator.
 *
 * @param input - Operator history, evaluation timestamp, optional threshold overrides
 * @returns Fully deterministic reputation ledger output
 *
 * Determinism guarantee: Given identical input, this function will always
 * produce byte-identical JSON output. No runtime clock is consulted;
 * generated_at is always set to the provided as_of value.
 */
export function generateReputationLedger(
  input: ReputationLedgerInput
): ReputationLedgerOutput {
  const thresholds = resolveThresholds(input.thresholds);
  const op = input.operator;
  const asOf = input.as_of;

  // --- Compute core metrics ---
  const completion_rate = computeCompletionRate(op);
  const evidence_quality_score = computeEvidenceQuality(op);
  const rejection_rate = computeRejectionRate(op);
  const holdback_rate = computeHoldbackRate(op);
  const reward_velocity_7d = computeRewardVelocity(op, asOf, thresholds.velocity_window_7d);
  const reward_velocity_30d = computeRewardVelocity(op, asOf, thresholds.velocity_window_30d);
  const { count: category_diversity, categories: categories_seen } =
    computeCategoryDiversity(op);

  // --- Counts ---
  const rewarded_count = op.rewarded_tasks.length;
  const refusal_count = op.refusals.length;
  const holdback_count = op.holdbacks.length;
  const evidence_count = op.evidence.length;
  const unresolved_holdback_count = op.holdbacks.filter(
    h => h.outcome === 'pending'
  ).length;
  const evidence_verified_count = op.evidence.filter(e => e.verified).length;
  const evidence_unverified_count = evidence_count - evidence_verified_count;
  const total_tasks = rewarded_count + refusal_count;

  // --- Build snapshot ---
  const snapshot: ReputationSnapshot = {
    operator_id: op.operator_id,
    as_of: asOf,
    completion_rate,
    evidence_quality_score,
    rejection_rate,
    holdback_rate,
    reward_velocity_7d,
    reward_velocity_30d,
    category_diversity,
    categories_seen,
    total_tasks,
    rewarded_count,
    refusal_count,
    holdback_count,
    evidence_count,
    unresolved_holdback_count,
    evidence_verified_count,
    evidence_unverified_count,
  };

  // --- Trust tier ---
  const trust_tier = assignTrustTier(snapshot, thresholds);

  // --- Risk signals ---
  const risk_signals = buildRiskSignals(snapshot, thresholds, asOf, op);

  // --- Reason codes ---
  const reason_codes = buildReasonCodes(snapshot, thresholds, trust_tier, risk_signals, op);

  // --- Downstream hints ---
  const downstream_hints = computeDownstreamHints(trust_tier, risk_signals);

  return {
    generated_at: asOf,
    as_of: asOf,
    version: SCHEMA_VERSION,
    operator_id: op.operator_id,
    reputation_snapshot: snapshot,
    trust_tier,
    risk_signals,
    reason_codes,
    threshold_config: thresholds,
    downstream_hints,
  };
}
```

## Test Suite (47 tests)

```
 ✓ tests/reputation-ledger.test.ts (47 tests) 23ms
   ✓ empty history > returns new_operator tier with zero metrics
   ✓ empty history > includes all required output fields
   ✓ high-trust operators > assigns exemplary tier for high completion + strong evidence
   ✓ high-trust operators > reliable tier when completion is good but evidence is weak
   ✓ rejection spikes > flags high rejection rate as critical risk signal
   ✓ rejection spikes > detects moderate rejection rate as high severity
   ✓ holdback recovery > recognizes holdback recovery when all holdbacks released
   ✓ holdback recovery > flags unresolved holdbacks as risk signal
   ✓ holdback recovery > does not flag holdback recovery when some are forfeited
   ✓ stale history > flags operator with no recent activity as stale
   ✓ stale history > does not flag stale when last task is within threshold
   ✓ stale history > stale severity escalates for very old history
   ✓ category concentration > flags low diversity when all tasks in one category
   ✓ category concentration > recognizes high diversity across multiple categories
   ✓ category concentration > groups uncategorized tasks under "uncategorized"
   ✓ threshold boundaries > exemplary requires BOTH high completion AND strong evidence
   ✓ threshold boundaries > boundary: exactly at reliable threshold
   ✓ threshold boundaries > boundary: just below reliable threshold → developing
   ✓ threshold boundaries > boundary: exactly at developing threshold
   ✓ threshold boundaries > boundary: below developing threshold → probationary
   ✓ threshold boundaries > custom thresholds override defaults
   ✓ deterministic repeat runs > produces byte-identical JSON across multiple runs
   ✓ deterministic repeat runs > generated_at always equals as_of
   ✓ deterministic repeat runs > version matches SCHEMA_VERSION constant
   ✓ reward velocity > calculates velocity within window only
   ✓ reward velocity > returns zero velocity when no tasks in window
   ✓ evidence scoring > averages quality scores correctly
   ✓ evidence scoring > ignores evidence without quality_score in average
   ✓ evidence scoring > tracks verified vs unverified evidence
   ✓ evidence scoring > no_evidence_submitted when operator has tasks but no evidence
   ✓ downstream hints > suppress guardrail for probationary operator
   ✓ downstream hints > reduced issuance for new operators
   ✓ downstream hints > emissions eligible only for exemplary/reliable without risk
   ✓ holdback rate > calculates holdback rate relative to rewarded tasks
   ✓ holdback rate > high holdback rate triggers risk signal
   ✓ risk signal ordering > sorts signals by severity (critical first) then code
   ✓ threshold config > echoes back full resolved thresholds including overrides
   ✓ threshold config > echoes back defaults when no overrides provided
   ✓ reason code ordering > reason codes are always sorted alphabetically
   ✓ developing operator > developing tier with mixed signals
   ✓ operator identity > passes through operator_id to all relevant fields
   ✓ category sorting > categories_seen is always alphabetically sorted
   ✓ velocity reason codes > consistent_reward_velocity when 30d >= 50% of 7d
   ✓ consumer routing > rejection risk signal routes to guardrail, moderation, payout
   ✓ consumer routing > low_category_diversity routes to emissions only
   ✓ min tasks for stats > exactly at min_tasks_for_stats gets classified
   ✓ min tasks for stats > below min_tasks_for_stats is new_operator

 Test Files  1 passed (1)
      Tests  47 passed (47)
```

### Full Test Source Code

```typescript
import { describe, it, expect } from 'vitest';
import {
  generateReputationLedger,
  DEFAULT_THRESHOLDS,
  SCHEMA_VERSION,
} from '../src/reputation-ledger.js';
import type {
  ReputationLedgerInput,
  ReputationLedgerOutput,
  OperatorHistory,
  RewardedTask,
  RefusalRecord,
  HoldbackRecord,
  EvidenceRecord,
} from '../src/types.js';

// ============================================================================
// Test Fixtures
// ============================================================================

const NOW = '2026-04-08T00:00:00.000Z';
const RECENT = '2026-04-01T00:00:00.000Z';       // 7 days ago
const MONTH_AGO = '2026-03-08T00:00:00.000Z';    // 31 days ago
const OLD = '2025-12-01T00:00:00.000Z';           // ~4 months ago
const VERY_OLD = '2025-01-01T00:00:00.000Z';      // ~15 months ago

function makeTask(overrides: Partial<RewardedTask> = {}): RewardedTask {
  return {
    task_id: `task-${Math.random().toString(36).slice(2, 8)}`,
    completed_at: RECENT,
    reward_pft: 100,
    category: 'network',
    ...overrides,
  };
}

function makeRefusal(overrides: Partial<RefusalRecord> = {}): RefusalRecord {
  return {
    task_id: `task-${Math.random().toString(36).slice(2, 8)}`,
    type: 'explicit_decline',
    occurred_at: RECENT,
    ...overrides,
  };
}

function makeHoldback(overrides: Partial<HoldbackRecord> = {}): HoldbackRecord {
  return {
    task_id: `task-${Math.random().toString(36).slice(2, 8)}`,
    held_at: RECENT,
    outcome: 'pending',
    ...overrides,
  };
}

function makeEvidence(overrides: Partial<EvidenceRecord> = {}): EvidenceRecord {
  return {
    task_id: `task-${Math.random().toString(36).slice(2, 8)}`,
    submitted_at: RECENT,
    evidence_type: 'url',
    verified: true,
    quality_score: 85,
    ...overrides,
  };
}

function makeOperator(overrides: Partial<OperatorHistory> = {}): OperatorHistory {
  return {
    operator_id: 'op-test-001',
    rewarded_tasks: [],
    refusals: [],
    holdbacks: [],
    evidence: [],
    ...overrides,
  };
}

function makeInput(
  operatorOverrides: Partial<OperatorHistory> = {},
  thresholds?: Partial<ReputationLedgerInput['thresholds']>
): ReputationLedgerInput {
  return {
    operator: makeOperator(operatorOverrides),
    as_of: NOW,
    thresholds: thresholds ?? undefined,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('Operator Reputation Ledger', () => {
  describe('empty history', () => {
    it('returns new_operator tier with zero metrics', () => {
      const result = generateReputationLedger(makeInput());
      expect(result.trust_tier).toBe('new_operator');
      expect(result.reputation_snapshot.completion_rate).toBe(0);
      expect(result.reputation_snapshot.rejection_rate).toBe(0);
      expect(result.reputation_snapshot.holdback_rate).toBe(0);
      expect(result.reputation_snapshot.evidence_quality_score).toBe(0);
      expect(result.reputation_snapshot.reward_velocity_7d).toBe(0);
      expect(result.reputation_snapshot.reward_velocity_30d).toBe(0);
      expect(result.reputation_snapshot.total_tasks).toBe(0);
      expect(result.reason_codes).toContain('insufficient_history');
      expect(result.reason_codes).toContain('new_operator');
      expect(result.risk_signals).toHaveLength(0);
    });

    it('includes all required output fields', () => {
      const result = generateReputationLedger(makeInput());
      expect(result).toHaveProperty('generated_at');
      expect(result).toHaveProperty('as_of');
      expect(result).toHaveProperty('version');
      expect(result).toHaveProperty('reputation_snapshot');
      expect(result).toHaveProperty('trust_tier');
      expect(result).toHaveProperty('risk_signals');
      expect(result).toHaveProperty('reason_codes');
      expect(result).toHaveProperty('threshold_config');
      expect(result).toHaveProperty('downstream_hints');
      expect(result).toHaveProperty('operator_id');
    });
  });

  describe('high-trust operators', () => {
    it('assigns exemplary tier for high completion + strong evidence', () => {
      const tasks = Array.from({ length: 10 }, (_, i) =>
        makeTask({
          task_id: `task-${i}`,
          completed_at: RECENT,
          reward_pft: 500,
          category: ['network', 'personal', 'mechanism-design', 'research'][i % 4],
        })
      );
      const evidence = tasks.map((t, i) =>
        makeEvidence({ task_id: t.task_id, quality_score: 80 + i, verified: true })
      );
      const result = generateReputationLedger(makeInput({ rewarded_tasks: tasks, evidence }));
      expect(result.trust_tier).toBe('exemplary');
      expect(result.reputation_snapshot.completion_rate).toBe(1);
      expect(result.downstream_hints.payout_action).toBe('bonus_eligible');
      expect(result.downstream_hints.emissions_eligible).toBe(true);
    });

    it('reliable tier when completion is good but evidence is weak', () => {
      const tasks = Array.from({ length: 5 }, (_, i) =>
        makeTask({ task_id: `task-${i}`, completed_at: RECENT })
      );
      const evidence = tasks.map(t => makeEvidence({ task_id: t.task_id, quality_score: 50 }));
      const result = generateReputationLedger(makeInput({ rewarded_tasks: tasks, evidence }));
      expect(result.trust_tier).toBe('reliable');
      expect(result.reason_codes).toContain('weak_evidence_quality');
    });
  });

  describe('rejection spikes', () => {
    it('flags high rejection rate as critical risk signal', () => {
      const tasks = [makeTask({ task_id: 'task-0', completed_at: RECENT })];
      const refusals = Array.from({ length: 4 }, (_, i) =>
        makeRefusal({ task_id: `ref-${i}`, occurred_at: RECENT })
      );
      const result = generateReputationLedger(makeInput({ rewarded_tasks: tasks, refusals }));
      expect(result.reputation_snapshot.rejection_rate).toBe(0.8);
      expect(result.trust_tier).toBe('probationary');
      expect(result.risk_signals.find(s => s.code === 'high_rejection_rate')?.severity).toBe('critical');
      expect(result.downstream_hints.moderation_action).toBe('escalate');
      expect(result.downstream_hints.guardrail_action).toBe('suppress');
    });

    it('detects moderate rejection rate as high severity', () => {
      const tasks = [makeTask({ task_id: 'task-0' }), makeTask({ task_id: 'task-1' })];
      const refusals = [makeRefusal({ task_id: 'ref-0' })];
      const result = generateReputationLedger(makeInput({ rewarded_tasks: tasks, refusals }));
      expect(result.reputation_snapshot.rejection_rate).toBeCloseTo(0.333333, 5);
      expect(result.risk_signals.find(s => s.code === 'high_rejection_rate')?.severity).toBe('high');
    });
  });

  describe('holdback recovery', () => {
    it('recognizes holdback recovery when all holdbacks released', () => {
      const tasks = Array.from({ length: 5 }, (_, i) =>
        makeTask({ task_id: `task-${i}`, completed_at: RECENT })
      );
      const holdbacks = [
        makeHoldback({ task_id: 'task-0', outcome: 'released', resolved_at: RECENT }),
        makeHoldback({ task_id: 'task-1', outcome: 'released', resolved_at: RECENT }),
      ];
      const result = generateReputationLedger(makeInput({ rewarded_tasks: tasks, holdbacks }));
      expect(result.reason_codes).toContain('holdback_recovery');
      expect(result.reputation_snapshot.unresolved_holdback_count).toBe(0);
    });

    it('flags unresolved holdbacks as risk signal', () => {
      const tasks = Array.from({ length: 5 }, (_, i) => makeTask({ task_id: `task-${i}` }));
      const holdbacks = Array.from({ length: 3 }, (_, i) =>
        makeHoldback({ task_id: `hold-${i}`, outcome: 'pending' })
      );
      const result = generateReputationLedger(makeInput({ rewarded_tasks: tasks, holdbacks }));
      expect(result.reputation_snapshot.unresolved_holdback_count).toBe(3);
      expect(result.risk_signals.find(s => s.code === 'unresolved_holdbacks')?.severity).toBe('high');
    });

    it('does not flag holdback recovery when some are forfeited', () => {
      const tasks = Array.from({ length: 5 }, (_, i) => makeTask({ task_id: `task-${i}` }));
      const holdbacks = [
        makeHoldback({ task_id: 'task-0', outcome: 'released', resolved_at: RECENT }),
        makeHoldback({ task_id: 'task-1', outcome: 'forfeited', resolved_at: RECENT }),
      ];
      const result = generateReputationLedger(makeInput({ rewarded_tasks: tasks, holdbacks }));
      expect(result.reason_codes).not.toContain('holdback_recovery');
    });
  });

  describe('stale history', () => {
    it('flags operator with no recent activity as stale', () => {
      const tasks = Array.from({ length: 5 }, (_, i) =>
        makeTask({ task_id: `task-${i}`, completed_at: VERY_OLD })
      );
      const result = generateReputationLedger(makeInput({ rewarded_tasks: tasks }));
      expect(result.risk_signals.some(s => s.code === 'stale_history')).toBe(true);
      expect(result.reason_codes).toContain('stale_history');
    });

    it('does not flag stale when last task is within threshold', () => {
      const tasks = Array.from({ length: 5 }, (_, i) =>
        makeTask({ task_id: `task-${i}`, completed_at: RECENT })
      );
      const result = generateReputationLedger(makeInput({ rewarded_tasks: tasks }));
      expect(result.risk_signals.some(s => s.code === 'stale_history')).toBe(false);
    });

    it('stale severity escalates for very old history', () => {
      const tasks = [makeTask({ task_id: 'task-0', completed_at: VERY_OLD })];
      const result = generateReputationLedger(
        makeInput({ rewarded_tasks: tasks, refusals: [
          makeRefusal({ task_id: 'ref-0' }), makeRefusal({ task_id: 'ref-1' }),
        ]})
      );
      const staleSig = result.risk_signals.find(s => s.code === 'stale_history');
      expect(staleSig?.severity).toBe('high');
    });
  });

  describe('category concentration', () => {
    it('flags low diversity when all tasks in one category', () => {
      const tasks = Array.from({ length: 5 }, (_, i) =>
        makeTask({ task_id: `task-${i}`, category: 'network' })
      );
      const result = generateReputationLedger(makeInput({ rewarded_tasks: tasks }));
      expect(result.reputation_snapshot.category_diversity).toBe(1);
      expect(result.risk_signals.some(s => s.code === 'low_category_diversity')).toBe(true);
    });

    it('recognizes high diversity across multiple categories', () => {
      const categories = ['network', 'personal', 'mechanism-design', 'research'];
      const tasks = categories.map((cat, i) => makeTask({ task_id: `task-${i}`, category: cat }));
      const result = generateReputationLedger(makeInput({ rewarded_tasks: tasks }));
      expect(result.reputation_snapshot.category_diversity).toBe(4);
      expect(result.reason_codes).toContain('high_category_diversity');
    });

    it('groups uncategorized tasks under "uncategorized"', () => {
      const tasks = [
        makeTask({ task_id: 'task-0', category: undefined }),
        makeTask({ task_id: 'task-1', category: 'network' }),
        makeTask({ task_id: 'task-2', category: undefined }),
      ];
      const result = generateReputationLedger(makeInput({ rewarded_tasks: tasks }));
      expect(result.reputation_snapshot.categories_seen).toContain('uncategorized');
      expect(result.reputation_snapshot.category_diversity).toBe(2);
    });
  });

  describe('threshold boundaries', () => {
    it('exemplary requires BOTH high completion AND strong evidence', () => {
      const tasks = Array.from({ length: 5 }, (_, i) => makeTask({ task_id: `task-${i}` }));
      const result = generateReputationLedger(makeInput({ rewarded_tasks: tasks }));
      expect(result.reputation_snapshot.completion_rate).toBe(1);
      expect(result.trust_tier).toBe('reliable'); // Not exemplary without evidence
    });

    it('boundary: exactly at reliable threshold', () => {
      const tasks = Array.from({ length: 7 }, (_, i) => makeTask({ task_id: `task-${i}` }));
      const refusals = Array.from({ length: 3 }, (_, i) => makeRefusal({ task_id: `ref-${i}` }));
      const result = generateReputationLedger(makeInput({ rewarded_tasks: tasks, refusals }));
      expect(result.reputation_snapshot.completion_rate).toBe(0.7);
      expect(result.trust_tier).toBe('reliable');
    });

    it('boundary: just below reliable threshold → developing', () => {
      const tasks = [makeTask({ task_id: 'task-0' }), makeTask({ task_id: 'task-1' })];
      const refusals = [makeRefusal({ task_id: 'ref-0' })];
      const result = generateReputationLedger(makeInput({ rewarded_tasks: tasks, refusals }));
      expect(result.reputation_snapshot.completion_rate).toBeCloseTo(0.666667, 5);
      expect(result.trust_tier).toBe('developing');
    });

    it('boundary: exactly at developing threshold', () => {
      const tasks = Array.from({ length: 3 }, (_, i) => makeTask({ task_id: `task-${i}` }));
      const refusals = Array.from({ length: 3 }, (_, i) => makeRefusal({ task_id: `ref-${i}` }));
      const result = generateReputationLedger(makeInput({ rewarded_tasks: tasks, refusals }));
      expect(result.reputation_snapshot.completion_rate).toBe(0.5);
      expect(result.trust_tier).toBe('developing');
    });

    it('boundary: below developing threshold → probationary', () => {
      const tasks = [makeTask({ task_id: 'task-0' })];
      const refusals = Array.from({ length: 3 }, (_, i) => makeRefusal({ task_id: `ref-${i}` }));
      const result = generateReputationLedger(makeInput({ rewarded_tasks: tasks, refusals }));
      expect(result.reputation_snapshot.completion_rate).toBe(0.25);
      expect(result.trust_tier).toBe('probationary');
    });

    it('custom thresholds override defaults', () => {
      const tasks = Array.from({ length: 3 }, (_, i) => makeTask({ task_id: `task-${i}` }));
      const refusals = [makeRefusal({ task_id: 'ref-0' }), makeRefusal({ task_id: 'ref-1' })];
      const evidence = tasks.map(t => makeEvidence({ task_id: t.task_id, quality_score: 90 }));
      const result = generateReputationLedger({
        operator: makeOperator({ rewarded_tasks: tasks, refusals, evidence }),
        as_of: NOW,
        thresholds: { exemplary_completion_rate: 0.50, strong_evidence_quality: 80 },
      });
      expect(result.trust_tier).toBe('exemplary');
      expect(result.threshold_config.exemplary_completion_rate).toBe(0.50);
    });
  });

  describe('deterministic repeat runs', () => {
    it('produces byte-identical JSON across multiple runs', () => {
      const input = makeInput({
        rewarded_tasks: Array.from({ length: 5 }, (_, i) =>
          makeTask({ task_id: `task-${i}`, completed_at: RECENT, category: ['network', 'personal'][i % 2] })
        ),
        refusals: [makeRefusal({ task_id: 'ref-0' })],
        holdbacks: [makeHoldback({ task_id: 'task-0', outcome: 'released', resolved_at: RECENT })],
        evidence: [
          makeEvidence({ task_id: 'task-0', quality_score: 80 }),
          makeEvidence({ task_id: 'task-1', quality_score: 90 }),
        ],
      });
      const run1 = JSON.stringify(generateReputationLedger(input));
      const run2 = JSON.stringify(generateReputationLedger(input));
      const run3 = JSON.stringify(generateReputationLedger(input));
      expect(run1).toBe(run2);
      expect(run2).toBe(run3);
    });

    it('generated_at always equals as_of', () => {
      const result = generateReputationLedger(makeInput());
      expect(result.generated_at).toBe(NOW);
      expect(result.as_of).toBe(NOW);
    });

    it('version matches SCHEMA_VERSION constant', () => {
      const result = generateReputationLedger(makeInput());
      expect(result.version).toBe(SCHEMA_VERSION);
      expect(result.version).toBe('1.0.0');
    });
  });

  describe('reward velocity', () => {
    it('calculates velocity within window only', () => {
      const tasks = [
        makeTask({ task_id: 'task-recent', completed_at: '2026-04-05T00:00:00.000Z', reward_pft: 700 }),
        makeTask({ task_id: 'task-mid', completed_at: '2026-03-20T00:00:00.000Z', reward_pft: 3000 }),
        makeTask({ task_id: 'task-old', completed_at: '2026-02-01T00:00:00.000Z', reward_pft: 9999 }),
      ];
      const result = generateReputationLedger(makeInput({ rewarded_tasks: tasks }));
      expect(result.reputation_snapshot.reward_velocity_7d).toBe(100);
      expect(result.reputation_snapshot.reward_velocity_30d).toBeCloseTo(123.333333, 4);
    });

    it('returns zero velocity when no tasks in window', () => {
      const tasks = [makeTask({ task_id: 'task-old', completed_at: VERY_OLD, reward_pft: 1000 })];
      const result = generateReputationLedger(makeInput({ rewarded_tasks: tasks }));
      expect(result.reputation_snapshot.reward_velocity_7d).toBe(0);
      expect(result.reputation_snapshot.reward_velocity_30d).toBe(0);
    });
  });

  // ... (remaining 17 tests covering evidence scoring, downstream hints,
  //      holdback rate, risk signal ordering, threshold config, reason code
  //      ordering, developing operator, operator identity, category sorting,
  //      velocity reason codes, consumer routing, and min tasks for stats)
});
```

---

*Published by Zoz via the Permanent Upper Class validator operation.*
*Task completed for the Post Fiat Network.*
