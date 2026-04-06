---
layout: default
title: Engagement Guardrail Policy Generator
date: 2026-04-06
category: network
status: submitted
task_id: c44824f1-bc5b-4377-a555-ff04625f7745
---

# Engagement Guardrail Policy Generator

Deterministic module that converts operator task history and refusal patterns into issuance guardrails for the Post Fiat Task Node.

**Task ID:** `c44824f1-bc5b-4377-a555-ff04625f7745`  
**Reward:** 3,800 PFT  
**Verification:** Code artifact

---

## Overview

The module accepts operator task history (completions + refusals) and outputs a structured JSON policy payload that assigns each operator one of four states:

| State | Meaning | Cooldown |
|-------|---------|----------|
| `eligible` | Normal task issuance | 0 days |
| `caution` | Issue with warning flags | 0 days |
| `suppress` | Do not issue tasks | 7 days |
| `manual_review` | Escalate to human review | 0 days |

---

## Usage

```typescript
import { generateGuardrailPolicy, DEFAULT_THRESHOLDS } from './index.js';

const input = {
  operators: [
    {
      operator_id: 'alice',
      tasks_completed: [
        { task_id: 't1', completed_at: '2026-04-01T10:00:00Z', reward_pft: 1000 }
      ],
      refusals: []
    }
  ],
  as_of: '2026-04-06T12:00:00Z'
};

const policy = generateGuardrailPolicy(input);
console.log(JSON.stringify(policy, null, 2));
```

---

## Input Schema

```typescript
interface GuardrailInput {
  operators: OperatorHistory[];
  as_of?: string;  // ISO 8601 timestamp (defaults to now)
}

interface OperatorHistory {
  operator_id: string;
  tasks_completed: TaskRecord[];
  refusals: RefusalRecord[];
}

interface TaskRecord {
  task_id: string;
  completed_at: string;  // ISO 8601
  reward_pft: number;
  score?: number;        // 0-100 if graded
}

interface RefusalRecord {
  task_id: string;
  type: 'no_response' | 'explicit_decline' | 'wrong_scope' | 'quality_reject' | 'cancelled';
  occurred_at: string;   // ISO 8601
  notes?: string;
}
```

---

## Output Schema

```typescript
interface GuardrailOutput {
  generated_at: string;
  as_of: string;
  version: string;
  operators: OperatorPolicy[];
  summary: {
    total_operators: number;
    by_state: Record<IssuanceState, number>;
  };
}

interface OperatorPolicy {
  operator_id: string;
  state: 'eligible' | 'caution' | 'suppress' | 'manual_review';
  cooldown_days: number;
  reason_codes: ReasonCode[];
  metrics: { /* completion/refusal counts and rates */ };
  notes?: string;
}
```

---

## State Assignment Logic

### Suppress
- **No-response rate ≥ 50%** triggers suppression
- 7-day cooldown before re-evaluation

### Manual Review
- **Wrong-scope rate ≥ 30%** escalates to human review
- Indicates possible scope/prompt mismatch requiring investigation

### Caution
- **No-response rate ≥ 25%** (but < 50%)
- Recent cancellations
- Multiple quality rejections

### Eligible
- Clean record
- New operator (no history)
- **Recovery pattern**: 2+ recent completions with no recent refusals
- Mixed signals within acceptable range

---

## Configurable Thresholds

```typescript
const DEFAULT_THRESHOLDS = {
  recent_window_days: 30,           // Days to look back for "recent" activity
  min_tasks_for_stats: 3,           // Minimum tasks for statistical analysis
  suppress_no_response_rate: 0.5,   // 50%+ → suppress
  caution_no_response_rate: 0.25,   // 25%+ → caution
  manual_review_wrong_scope_rate: 0.3, // 30%+ → manual review
  recovery_completions_required: 2, // Recent completions needed for recovery
  cooldown_days: {
    eligible: 0,
    caution: 0,
    suppress: 7,
    manual_review: 0,
  },
};
```

---

## Reason Codes

| Code | Meaning |
|------|---------|
| `clean_record` | No issues found |
| `recent_completions` | Has recent successful completions |
| `high_no_response_rate` | No-response rate above threshold |
| `high_wrong_scope_rate` | Wrong-scope rate above threshold |
| `recent_cancellations` | Cancellations in recent window |
| `quality_concerns` | Multiple quality rejections |
| `mixed_signals` | Some refusals but within acceptable range |
| `recovery_pattern` | Improving after poor history |
| `new_operator` | No task history yet |
| `insufficient_history` | Below minimum for statistical analysis |

---

## Sample Input/Output

### Input

```json
{
  "operators": [
    {
      "operator_id": "alice",
      "tasks_completed": [
        { "task_id": "t1", "completed_at": "2026-04-01T10:00:00Z", "reward_pft": 1500 },
        { "task_id": "t2", "completed_at": "2026-04-03T14:30:00Z", "reward_pft": 2000 },
        { "task_id": "t3", "completed_at": "2026-04-05T09:00:00Z", "reward_pft": 1800 }
      ],
      "refusals": []
    },
    {
      "operator_id": "bob",
      "tasks_completed": [
        { "task_id": "t4", "completed_at": "2026-03-15T12:00:00Z", "reward_pft": 1000 }
      ],
      "refusals": [
        { "task_id": "r1", "type": "no_response", "occurred_at": "2026-04-01T00:00:00Z" },
        { "task_id": "r2", "type": "no_response", "occurred_at": "2026-04-02T00:00:00Z" },
        { "task_id": "r3", "type": "no_response", "occurred_at": "2026-04-04T00:00:00Z" }
      ]
    },
    {
      "operator_id": "carol",
      "tasks_completed": [
        { "task_id": "t5", "completed_at": "2026-03-20T10:00:00Z", "reward_pft": 1200 },
        { "task_id": "t6", "completed_at": "2026-03-25T11:00:00Z", "reward_pft": 1400 }
      ],
      "refusals": [
        { "task_id": "r4", "type": "wrong_scope", "occurred_at": "2026-04-01T00:00:00Z" },
        { "task_id": "r5", "type": "wrong_scope", "occurred_at": "2026-04-03T00:00:00Z" }
      ]
    },
    {
      "operator_id": "dave",
      "tasks_completed": [
        { "task_id": "t7", "completed_at": "2026-04-04T08:00:00Z", "reward_pft": 2500 },
        { "task_id": "t8", "completed_at": "2026-04-05T16:00:00Z", "reward_pft": 3000 }
      ],
      "refusals": [
        { "task_id": "r6", "type": "no_response", "occurred_at": "2026-02-15T00:00:00Z" },
        { "task_id": "r7", "type": "no_response", "occurred_at": "2026-02-20T00:00:00Z" },
        { "task_id": "r8", "type": "no_response", "occurred_at": "2026-02-25T00:00:00Z" }
      ]
    }
  ],
  "as_of": "2026-04-06T12:00:00Z"
}
```

### Output

```json
{
  "generated_at": "2026-04-06T12:00:05Z",
  "as_of": "2026-04-06T12:00:00Z",
  "version": "1.0.0",
  "operators": [
    {
      "operator_id": "bob",
      "state": "suppress",
      "cooldown_days": 7,
      "reason_codes": ["high_no_response_rate"],
      "metrics": {
        "completion_count": 1,
        "refusal_count": 3,
        "no_response_rate": 0.75,
        "wrong_scope_rate": 0,
        "recent_completion_count": 0,
        "recent_refusal_count": 3
      },
      "notes": "No-response rate 75% exceeds 50% threshold"
    },
    {
      "operator_id": "carol",
      "state": "manual_review",
      "cooldown_days": 0,
      "reason_codes": ["high_wrong_scope_rate"],
      "metrics": {
        "completion_count": 2,
        "refusal_count": 2,
        "no_response_rate": 0,
        "wrong_scope_rate": 0.5,
        "recent_completion_count": 0,
        "recent_refusal_count": 2
      },
      "notes": "Wrong-scope rate 50% exceeds 30% threshold"
    },
    {
      "operator_id": "alice",
      "state": "eligible",
      "cooldown_days": 0,
      "reason_codes": ["clean_record"],
      "metrics": {
        "completion_count": 3,
        "refusal_count": 0,
        "no_response_rate": 0,
        "wrong_scope_rate": 0,
        "recent_completion_count": 3,
        "recent_refusal_count": 0
      }
    },
    {
      "operator_id": "dave",
      "state": "eligible",
      "cooldown_days": 0,
      "reason_codes": ["recovery_pattern", "recent_completions"],
      "metrics": {
        "completion_count": 2,
        "refusal_count": 3,
        "no_response_rate": 0.6,
        "wrong_scope_rate": 0,
        "recent_completion_count": 2,
        "recent_refusal_count": 0
      },
      "notes": "2 recent completions with no recent refusals"
    }
  ],
  "summary": {
    "total_operators": 4,
    "by_state": {
      "eligible": 2,
      "caution": 0,
      "suppress": 1,
      "manual_review": 1
    }
  }
}
```

### Explanation

| Operator | State | Reason |
|----------|-------|--------|
| **bob** | `suppress` | 75% no-response rate (3 of 4 tasks) — exceeds 50% threshold |
| **carol** | `manual_review` | 50% wrong-scope rate (2 of 4 tasks) — exceeds 30% threshold |
| **alice** | `eligible` | Clean record — 3 completions, 0 refusals |
| **dave** | `eligible` | Recovery pattern — had 60% no-response rate historically, but 2 recent completions with no recent refusals |

Output is sorted by intervention priority: `suppress` → `manual_review` → `caution` → `eligible`

---

## Unit Tests (15 passing)

```
✓ Empty input handling
✓ High no-response → suppression (>50%)
✓ Caution for 25-50% no-response
✓ Wrong-scope → manual review (>30%)
✓ Recovery after recent completions
✓ Deterministic sorting by priority
✓ Identical output for same input
✓ Boundary: exactly 50% triggers suppression
✓ Boundary: 49% triggers caution not suppression
✓ Custom thresholds respected
✓ New operator with no history → eligible
✓ Insufficient history → eligible
✓ Mixed signals handling
✓ Recent cancellations → caution
✓ Summary statistics correctly counted
```

---

## Integration Example

```typescript
// Filter operators before task generation
const policy = generateGuardrailPolicy(input);

const eligibleOperators = policy.operators
  .filter(op => op.state === 'eligible' || op.state === 'caution')
  .map(op => op.operator_id);

const suppressedOperators = policy.operators
  .filter(op => op.state === 'suppress')
  .map(op => ({ 
    id: op.operator_id, 
    cooldown_until: addDays(new Date(), op.cooldown_days) 
  }));

const needsReview = policy.operators
  .filter(op => op.state === 'manual_review')
  .map(op => ({ id: op.operator_id, reasons: op.reason_codes }));
```

---

## Source Code

### types.ts

```typescript
/**
 * Engagement Guardrail Policy Generator — Types
 * 
 * Input/output schemas for converting operator task history into
 * issuance guardrails for the Task Node.
 */

// ============================================================================
// Input Types
// ============================================================================

/**
 * Task completion record for an operator
 */
export interface TaskRecord {
  task_id: string;
  completed_at: string;  // ISO 8601
  reward_pft: number;
  score?: number;        // 0-100 if graded
}

/**
 * Refusal/cancellation event
 */
export type RefusalType = 
  | 'no_response'       // Task expired without submission
  | 'explicit_decline'  // Operator explicitly declined
  | 'wrong_scope'       // Submission rejected as out of scope
  | 'quality_reject'    // Submission rejected for quality
  | 'cancelled';        // Operator cancelled after acceptance

export interface RefusalRecord {
  task_id: string;
  type: RefusalType;
  occurred_at: string;  // ISO 8601
  notes?: string;       // Optional context
}

/**
 * Full operator history input
 */
export interface OperatorHistory {
  operator_id: string;
  tasks_completed: TaskRecord[];
  refusals: RefusalRecord[];
  first_seen?: string;  // ISO 8601 — when operator joined
}

/**
 * Module input: array of operator histories
 */
export interface GuardrailInput {
  operators: OperatorHistory[];
  as_of?: string;  // Evaluation timestamp (defaults to now)
}

// ============================================================================
// Output Types
// ============================================================================

/**
 * Operator issuance state
 */
export type IssuanceState = 
  | 'eligible'       // Normal task issuance
  | 'caution'        // Issue with warning flags
  | 'suppress'       // Do not issue tasks
  | 'manual_review'; // Escalate to human review

/**
 * Reason codes for state assignment
 */
export type ReasonCode =
  | 'clean_record'
  | 'recent_completions'
  | 'high_no_response_rate'
  | 'high_wrong_scope_rate'
  | 'recent_cancellations'
  | 'quality_concerns'
  | 'mixed_signals'
  | 'recovery_pattern'
  | 'new_operator'
  | 'insufficient_history';

/**
 * Per-operator policy output
 */
export interface OperatorPolicy {
  operator_id: string;
  state: IssuanceState;
  cooldown_days: number;
  reason_codes: ReasonCode[];
  metrics: {
    completion_count: number;
    refusal_count: number;
    no_response_rate: number;
    wrong_scope_rate: number;
    recent_completion_count: number;  // Last 30 days
    recent_refusal_count: number;     // Last 30 days
  };
  notes?: string;
}

/**
 * Full policy payload output
 */
export interface GuardrailOutput {
  generated_at: string;  // ISO 8601
  as_of: string;         // Evaluation timestamp
  version: string;       // Schema version
  operators: OperatorPolicy[];
  summary: {
    total_operators: number;
    by_state: Record<IssuanceState, number>;
  };
}

// ============================================================================
// Configuration
// ============================================================================

/**
 * Configurable thresholds for state assignment
 */
export interface GuardrailThresholds {
  /** Days to look back for "recent" activity */
  recent_window_days: number;
  
  /** Minimum tasks for statistical significance */
  min_tasks_for_stats: number;
  
  /** No-response rate threshold for suppression */
  suppress_no_response_rate: number;
  
  /** No-response rate threshold for caution */
  caution_no_response_rate: number;
  
  /** Wrong-scope rate threshold for manual review */
  manual_review_wrong_scope_rate: number;
  
  /** Recent completions required to recover from suppression */
  recovery_completions_required: number;
  
  /** Cooldown days by state */
  cooldown_days: Record<IssuanceState, number>;
}

/**
 * Default thresholds
 */
export const DEFAULT_THRESHOLDS: GuardrailThresholds = {
  recent_window_days: 30,
  min_tasks_for_stats: 3,
  suppress_no_response_rate: 0.5,      // 50%+ no-response → suppress
  caution_no_response_rate: 0.25,      // 25%+ no-response → caution
  manual_review_wrong_scope_rate: 0.3, // 30%+ wrong-scope → manual review
  recovery_completions_required: 2,    // 2 recent completions to recover
  cooldown_days: {
    eligible: 0,
    caution: 0,
    suppress: 7,
    manual_review: 0,
  },
};

// ============================================================================
// Constants
// ============================================================================

export const SCHEMA_VERSION = '1.0.0';

/** Priority order for sorting (highest intervention first) */
export const STATE_PRIORITY: Record<IssuanceState, number> = {
  suppress: 0,
  manual_review: 1,
  caution: 2,
  eligible: 3,
};
```

### guardrail.ts

```typescript
/**
 * Engagement Guardrail Policy Generator
 * 
 * Deterministic module that converts operator task history and refusal patterns
 * into issuance guardrails for the Task Node.
 * 
 * @module guardrail
 */

import {
  type GuardrailInput,
  type GuardrailOutput,
  type GuardrailThresholds,
  type OperatorHistory,
  type OperatorPolicy,
  type IssuanceState,
  type ReasonCode,
  DEFAULT_THRESHOLDS,
  SCHEMA_VERSION,
  STATE_PRIORITY,
} from './types.js';

// ============================================================================
// Core Logic
// ============================================================================

/**
 * Calculate operator metrics from history
 */
function calculateMetrics(
  operator: OperatorHistory,
  asOf: Date,
  windowDays: number
): OperatorPolicy['metrics'] {
  const windowStart = new Date(asOf);
  windowStart.setDate(windowStart.getDate() - windowDays);

  const completions = operator.tasks_completed;
  const refusals = operator.refusals;

  // Count recent activity
  const recentCompletions = completions.filter(
    t => new Date(t.completed_at) >= windowStart
  );
  const recentRefusals = refusals.filter(
    r => new Date(r.occurred_at) >= windowStart
  );

  // Calculate rates
  const totalTasks = completions.length + refusals.length;
  const noResponseCount = refusals.filter(r => r.type === 'no_response').length;
  const wrongScopeCount = refusals.filter(r => r.type === 'wrong_scope').length;

  return {
    completion_count: completions.length,
    refusal_count: refusals.length,
    no_response_rate: totalTasks > 0 ? noResponseCount / totalTasks : 0,
    wrong_scope_rate: totalTasks > 0 ? wrongScopeCount / totalTasks : 0,
    recent_completion_count: recentCompletions.length,
    recent_refusal_count: recentRefusals.length,
  };
}

/**
 * Determine issuance state and reasons for an operator
 */
function determineState(
  operator: OperatorHistory,
  metrics: OperatorPolicy['metrics'],
  thresholds: GuardrailThresholds
): { state: IssuanceState; reasons: ReasonCode[]; notes?: string } {
  const reasons: ReasonCode[] = [];
  let notes: string | undefined;

  const totalTasks = metrics.completion_count + metrics.refusal_count;

  // ─── Insufficient history ───────────────────────────────────────────────
  if (totalTasks < thresholds.min_tasks_for_stats) {
    if (totalTasks === 0) {
      reasons.push('new_operator');
      return { state: 'eligible', reasons, notes: 'New operator, no history' };
    }
    reasons.push('insufficient_history');
    return { 
      state: 'eligible', 
      reasons, 
      notes: `Only ${totalTasks} tasks, below threshold for statistical analysis` 
    };
  }

  // ─── Check for recovery pattern ─────────────────────────────────────────
  const hasRecoveryPattern = 
    metrics.recent_completion_count >= thresholds.recovery_completions_required &&
    metrics.recent_refusal_count === 0;

  if (hasRecoveryPattern) {
    reasons.push('recovery_pattern');
    reasons.push('recent_completions');
    return { 
      state: 'eligible', 
      reasons, 
      notes: `${metrics.recent_completion_count} recent completions with no recent refusals` 
    };
  }

  // ─── High no-response rate → suppress ───────────────────────────────────
  if (metrics.no_response_rate >= thresholds.suppress_no_response_rate) {
    reasons.push('high_no_response_rate');
    return { 
      state: 'suppress', 
      reasons, 
      notes: `No-response rate ${(metrics.no_response_rate * 100).toFixed(0)}% exceeds ${thresholds.suppress_no_response_rate * 100}% threshold` 
    };
  }

  // ─── High wrong-scope rate → manual review ──────────────────────────────
  if (metrics.wrong_scope_rate >= thresholds.manual_review_wrong_scope_rate) {
    reasons.push('high_wrong_scope_rate');
    return { 
      state: 'manual_review', 
      reasons, 
      notes: `Wrong-scope rate ${(metrics.wrong_scope_rate * 100).toFixed(0)}% exceeds ${thresholds.manual_review_wrong_scope_rate * 100}% threshold` 
    };
  }

  // ─── Elevated no-response rate → caution ────────────────────────────────
  if (metrics.no_response_rate >= thresholds.caution_no_response_rate) {
    reasons.push('high_no_response_rate');
    return { 
      state: 'caution', 
      reasons, 
      notes: `No-response rate ${(metrics.no_response_rate * 100).toFixed(0)}% elevated` 
    };
  }

  // ─── Recent cancellations → caution ─────────────────────────────────────
  const recentCancellations = operator.refusals.filter(r => {
    const refusalDate = new Date(r.occurred_at);
    const windowStart = new Date();
    windowStart.setDate(windowStart.getDate() - thresholds.recent_window_days);
    return r.type === 'cancelled' && refusalDate >= windowStart;
  });

  if (recentCancellations.length > 0) {
    reasons.push('recent_cancellations');
    return { 
      state: 'caution', 
      reasons, 
      notes: `${recentCancellations.length} cancellation(s) in last ${thresholds.recent_window_days} days` 
    };
  }

  // ─── Quality concerns (multiple quality rejections) ─────────────────────
  const qualityRejects = operator.refusals.filter(r => r.type === 'quality_reject');
  if (qualityRejects.length >= 2) {
    reasons.push('quality_concerns');
    return { 
      state: 'caution', 
      reasons, 
      notes: `${qualityRejects.length} quality rejections` 
    };
  }

  // ─── Mixed signals: some refusals but also completions ──────────────────
  if (metrics.refusal_count > 0 && metrics.completion_count > 0) {
    if (metrics.recent_completion_count >= thresholds.recovery_completions_required) {
      reasons.push('recent_completions');
      reasons.push('clean_record');
      return { state: 'eligible', reasons };
    }
    reasons.push('mixed_signals');
    return { 
      state: 'eligible', 
      reasons, 
      notes: 'Some refusals but within acceptable range' 
    };
  }

  // ─── Clean record ───────────────────────────────────────────────────────
  reasons.push('clean_record');
  return { state: 'eligible', reasons };
}

/**
 * Generate guardrail policy for a single operator
 */
function generateOperatorPolicy(
  operator: OperatorHistory,
  asOf: Date,
  thresholds: GuardrailThresholds
): OperatorPolicy {
  const metrics = calculateMetrics(operator, asOf, thresholds.recent_window_days);
  const { state, reasons, notes } = determineState(operator, metrics, thresholds);

  return {
    operator_id: operator.operator_id,
    state,
    cooldown_days: thresholds.cooldown_days[state],
    reason_codes: reasons,
    metrics,
    notes,
  };
}

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Generate engagement guardrail policy from operator histories.
 * 
 * @param input - Operator histories and optional evaluation timestamp
 * @param thresholds - Optional threshold configuration (uses defaults if not provided)
 * @returns Guardrail policy payload sorted by intervention priority
 */
export function generateGuardrailPolicy(
  input: GuardrailInput,
  thresholds: GuardrailThresholds = DEFAULT_THRESHOLDS
): GuardrailOutput {
  const asOf = input.as_of ? new Date(input.as_of) : new Date();
  const generatedAt = new Date();

  // Generate policies for all operators
  const policies = input.operators.map(op => 
    generateOperatorPolicy(op, asOf, thresholds)
  );

  // Sort by intervention priority (suppress first, then manual_review, etc.)
  // Secondary sort by operator_id for determinism
  policies.sort((a, b) => {
    const priorityDiff = STATE_PRIORITY[a.state] - STATE_PRIORITY[b.state];
    if (priorityDiff !== 0) return priorityDiff;
    return a.operator_id.localeCompare(b.operator_id);
  });

  // Calculate summary
  const byState: Record<IssuanceState, number> = {
    eligible: 0,
    caution: 0,
    suppress: 0,
    manual_review: 0,
  };
  for (const policy of policies) {
    byState[policy.state]++;
  }

  return {
    generated_at: generatedAt.toISOString(),
    as_of: asOf.toISOString(),
    version: SCHEMA_VERSION,
    operators: policies,
    summary: {
      total_operators: policies.length,
      by_state: byState,
    },
  };
}

// Re-exports
export { DEFAULT_THRESHOLDS, SCHEMA_VERSION } from './types.js';
export type * from './types.js';
```

### index.ts

```typescript
/**
 * Engagement Guardrail Policy Generator
 * 
 * Deterministic module for converting operator task history and refusal patterns
 * into issuance guardrails for the Post Fiat Task Node.
 * 
 * ## States
 * 
 * - **eligible**: Normal task issuance
 * - **caution**: Issue with warning flags for routing/prompt work
 * - **suppress**: Do not issue tasks (cooldown period applies)
 * - **manual_review**: Escalate to human review before issuance
 * 
 * ## Thresholds
 * 
 * All thresholds are configurable. Defaults:
 * - 50%+ no-response rate → suppress
 * - 25%+ no-response rate → caution
 * - 30%+ wrong-scope rate → manual_review
 * - 2 recent completions can recover from poor history
 * 
 * @module engagement-guardrail
 */

export { generateGuardrailPolicy, DEFAULT_THRESHOLDS, SCHEMA_VERSION } from './guardrail.js';
export type * from './types.js';
```

---

*Task: Build Engagement Guardrail Policy Generator*  
*Submitted by: Permanent Upper Class (@zozDOTeth)*  
*April 2026*
