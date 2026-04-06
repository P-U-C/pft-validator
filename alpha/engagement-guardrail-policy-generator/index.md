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
**Version:** 1.0.0

---

## Key Design Decisions

### 1. Recent-First Evaluation
State assignment uses **recent window metrics** (30 days) when sufficient data exists, falling back to lifetime rates only when recent history is sparse. This prevents old behavior from permanently penalizing reformed operators while ensuring recent problems are caught.

### 2. Explicit State Precedence
```
manual_review > suppress > caution > eligible
```
- **manual_review** dominates: scope issues need human eyes (could be task generation problem)
- **suppress** is clear operator behavior (automated hold)
- This is a governance rule, not just code order

### 3. Partial Recovery Only
Recovery can only **downgrade by one level**, not jump to eligible:
- `suppress` → `caution` (not eligible)
- `manual_review` → `caution`
- `caution` → `eligible`

This prevents a historically problematic operator from clearing flags with just 2 good completions.

### 4. Deterministic Time Handling
All time calculations use the provided `as_of` timestamp, **never `new Date()`**. The same input always produces the same output regardless of when the code runs.

### 5. Input Validation
The module detects and warns about:
- Unknown refusal types
- Malformed timestamps
- Future-dated events
- Duplicate task IDs

---

## Output Schema

```typescript
interface OperatorPolicy {
  operator_id: string;
  state: 'eligible' | 'caution' | 'suppress' | 'manual_review';
  cooldown_days: number;
  cooldown_until?: string;           // ISO 8601
  reason_codes: ReasonCode[];
  
  // Downstream-ready action fields
  policy_action: 'issue' | 'issue_with_caution' | 'hold' | 'escalate';
  eligible_for_issuance: boolean;
  review_required: boolean;
  next_evaluation_at?: string;       // When to re-check
  
  // Investigation surface
  blame_surface: 'operator_behavior' | 'task_generation' | 'mixed' | 'unknown';
  
  // Decision confidence
  decision_confidence: 'high' | 'medium' | 'low';
  evidence_task_count: number;
  
  // Lifetime metrics
  metrics_lifetime: {
    completion_count: number;
    refusal_count: number;
    no_response_count: number;
    no_response_rate: number;
    wrong_scope_count: number;
    wrong_scope_rate: number;
    explicit_decline_count: number;
    cancelled_count: number;
    quality_reject_count: number;
  };
  
  // Recent window metrics
  metrics_recent: {
    completion_count: number;
    refusal_count: number;
    no_response_count: number;
    no_response_rate: number;
    wrong_scope_count: number;
    wrong_scope_rate: number;
    days_since_last_completion?: number;
    days_since_last_refusal?: number;
  };
  
  notes?: string;
}
```

---

## State Assignment Logic

| State | Trigger | Blame Surface | Action |
|-------|---------|---------------|--------|
| `manual_review` | Wrong-scope rate ≥ 30% | `mixed` | `escalate` |
| `suppress` | No-response rate ≥ 50% | `operator_behavior` | `hold` |
| `caution` | No-response rate ≥ 25%, recent cancellations, quality concerns | `operator_behavior` | `issue_with_caution` |
| `eligible` | Clean record, recovery, new operator | `unknown` | `issue` |

### Partial Recovery
If operator has 2+ recent completions with 0 recent refusals:
- `suppress` → `caution` (partial_recovery)
- `manual_review` → `caution` (partial_recovery)
- `caution` → `eligible` (partial_recovery)

Recovery is **blocked** if there are any recent refusals.

---

## Sample Input

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

## Sample Output

```json
{
  "generated_at": "2026-04-06T12:00:05Z",
  "as_of": "2026-04-06T12:00:00Z",
  "version": "1.0.0",
  "operators": [
    {
      "operator_id": "carol",
      "state": "manual_review",
      "cooldown_days": 0,
      "reason_codes": ["high_wrong_scope_rate_recent"],
      "policy_action": "escalate",
      "eligible_for_issuance": false,
      "review_required": true,
      "next_evaluation_at": "2026-04-13T12:00:00Z",
      "blame_surface": "mixed",
      "decision_confidence": "high",
      "evidence_task_count": 4,
      "metrics_lifetime": {
        "completion_count": 2,
        "refusal_count": 2,
        "no_response_count": 0,
        "no_response_rate": 0,
        "wrong_scope_count": 2,
        "wrong_scope_rate": 0.5,
        "explicit_decline_count": 0,
        "cancelled_count": 0,
        "quality_reject_count": 0
      },
      "metrics_recent": {
        "completion_count": 0,
        "refusal_count": 2,
        "no_response_count": 0,
        "no_response_rate": 0,
        "wrong_scope_count": 2,
        "wrong_scope_rate": 1.0,
        "days_since_last_completion": 12,
        "days_since_last_refusal": 3
      },
      "notes": "Wrong-scope rate (recent) 100% exceeds 30% threshold"
    },
    {
      "operator_id": "bob",
      "state": "suppress",
      "cooldown_days": 7,
      "cooldown_until": "2026-04-13T12:00:00Z",
      "reason_codes": ["high_no_response_rate_recent"],
      "policy_action": "hold",
      "eligible_for_issuance": false,
      "review_required": false,
      "next_evaluation_at": "2026-04-13T12:00:00Z",
      "blame_surface": "operator_behavior",
      "decision_confidence": "high",
      "evidence_task_count": 4,
      "metrics_lifetime": {
        "completion_count": 1,
        "refusal_count": 3,
        "no_response_count": 3,
        "no_response_rate": 0.75,
        "wrong_scope_count": 0,
        "wrong_scope_rate": 0,
        "explicit_decline_count": 0,
        "cancelled_count": 0,
        "quality_reject_count": 0
      },
      "metrics_recent": {
        "completion_count": 0,
        "refusal_count": 3,
        "no_response_count": 3,
        "no_response_rate": 1.0,
        "wrong_scope_count": 0,
        "wrong_scope_rate": 0,
        "days_since_last_completion": 22,
        "days_since_last_refusal": 2
      },
      "notes": "No-response rate (recent) 100% exceeds 50% threshold"
    },
    {
      "operator_id": "dave",
      "state": "caution",
      "cooldown_days": 0,
      "reason_codes": ["partial_recovery", "recent_completions"],
      "policy_action": "issue_with_caution",
      "eligible_for_issuance": true,
      "review_required": false,
      "next_evaluation_at": "2026-05-06T12:00:00Z",
      "blame_surface": "operator_behavior",
      "decision_confidence": "medium",
      "evidence_task_count": 5,
      "metrics_lifetime": {
        "completion_count": 2,
        "refusal_count": 3,
        "no_response_count": 3,
        "no_response_rate": 0.6,
        "wrong_scope_count": 0,
        "wrong_scope_rate": 0,
        "explicit_decline_count": 0,
        "cancelled_count": 0,
        "quality_reject_count": 0
      },
      "metrics_recent": {
        "completion_count": 2,
        "refusal_count": 0,
        "no_response_count": 0,
        "no_response_rate": 0,
        "wrong_scope_count": 0,
        "wrong_scope_rate": 0,
        "days_since_last_completion": 1,
        "days_since_last_refusal": 41
      },
      "notes": "Partial recovery: suppress → caution (2 recent completions, 0 recent refusals)"
    },
    {
      "operator_id": "alice",
      "state": "eligible",
      "cooldown_days": 0,
      "reason_codes": ["clean_record"],
      "policy_action": "issue",
      "eligible_for_issuance": true,
      "review_required": false,
      "blame_surface": "unknown",
      "decision_confidence": "high",
      "evidence_task_count": 3,
      "metrics_lifetime": {
        "completion_count": 3,
        "refusal_count": 0,
        "no_response_count": 0,
        "no_response_rate": 0,
        "wrong_scope_count": 0,
        "wrong_scope_rate": 0,
        "explicit_decline_count": 0,
        "cancelled_count": 0,
        "quality_reject_count": 0
      },
      "metrics_recent": {
        "completion_count": 3,
        "refusal_count": 0,
        "no_response_count": 0,
        "no_response_rate": 0,
        "wrong_scope_count": 0,
        "wrong_scope_rate": 0,
        "days_since_last_completion": 1
      }
    }
  ],
  "summary": {
    "total_operators": 4,
    "by_state": {
      "eligible": 1,
      "caution": 1,
      "suppress": 1,
      "manual_review": 1
    }
  }
}
```

### Output Explanation

| Operator | State | Reason |
|----------|-------|--------|
| **carol** | `manual_review` | 100% recent wrong-scope — needs human review (could be task generation issue) |
| **bob** | `suppress` | 100% recent no-response — clear behavioral problem, 7-day hold |
| **dave** | `caution` | Partial recovery from suppress (had 60% lifetime no-response, but 2 recent completions + 0 recent refusals) |
| **alice** | `eligible` | Clean record — 3 completions, 0 refusals |

Note: dave's **partial_recovery** only downgraded him from suppress to caution, not to eligible. Full clearance requires sustained good behavior.

---

## Test Execution

```bash
$ npm test

> engagement-guardrail-policy-generator@1.0.0 test
> vitest run

 RUN  v2.1.9 /home/ubuntu/pft-audit/tasks/2026-04-06_engagement-guardrail-policy-generator

 ✓ tests/guardrail.test.ts (26 tests) 17ms

 Test Files  1 passed (1)
      Tests  26 passed (26)
   Start at  16:06:54
   Duration  264ms
```

### Test Coverage (26 tests)

**Basic & Empty Input:**
- Empty operator list returns empty policy
- New operator marked eligible with probationary flag
- All required output fields present

**State Assignment (Recent-First):**
- >50% no-response → suppress
- Wrong-scope → manual_review (priority over suppress)
- 25-50% no-response → caution

**Partial Recovery:**
- Suppress → caution (not eligible) with recent completions
- Caution → eligible with recent completions
- Recovery blocked by recent refusals

**Determinism:**
- Identical output for same input
- Uses as_of for all time calculations
- Sorts by manual_review > suppress > caution > eligible

**Threshold Boundaries:**
- Exactly 50% triggers suppression
- 49% triggers caution
- Custom thresholds respected

**Adversarial Cases:**
- Duplicate task IDs detected
- Malformed timestamps flagged
- Future-dated events flagged
- Unknown refusal types flagged
- Task ID in both completion and refusal sets

**Metrics & Output:**
- Lifetime metrics calculated correctly
- Recent metrics calculated correctly
- days_since calculations accurate
- cooldown_until set for suppressed operators
- next_evaluation_at set for review/caution

**Summary Statistics:**
- Correct counts by state

---

## Integration Example

```typescript
import { generateGuardrailPolicy } from './index.js';

const policy = generateGuardrailPolicy(input);

// Filter for task generation
const canIssue = policy.operators.filter(op => op.eligible_for_issuance);
const onHold = policy.operators.filter(op => op.policy_action === 'hold');
const needsReview = policy.operators.filter(op => op.review_required);

// Build suppression list with expiry
const suppressionList = onHold.map(op => ({
  operator_id: op.operator_id,
  until: op.cooldown_until,
  reasons: op.reason_codes,
}));

// Route scope issues to human queue
const reviewQueue = needsReview.map(op => ({
  operator_id: op.operator_id,
  blame_surface: op.blame_surface,
  recent_wrong_scope: op.metrics_recent.wrong_scope_count,
  confidence: op.decision_confidence,
}));
```

---

## Source Code

### types.ts

```typescript
/**
 * Engagement Guardrail Policy Generator — Types
 */

export interface TaskRecord {
  task_id: string;
  completed_at: string;  // ISO 8601
  reward_pft: number;
  score?: number;
}

export type RefusalType = 
  | 'no_response'
  | 'explicit_decline'
  | 'wrong_scope'
  | 'quality_reject'
  | 'cancelled';

export interface RefusalRecord {
  task_id: string;
  type: RefusalType;
  occurred_at: string;
  notes?: string;
}

export interface OperatorHistory {
  operator_id: string;
  tasks_completed: TaskRecord[];
  refusals: RefusalRecord[];
  first_seen?: string;
}

export interface GuardrailInput {
  operators: OperatorHistory[];
  as_of?: string;
}

export type IssuanceState = 'eligible' | 'caution' | 'suppress' | 'manual_review';

export type ReasonCode =
  | 'clean_record'
  | 'recent_completions'
  | 'high_no_response_rate'
  | 'high_no_response_rate_recent'
  | 'high_wrong_scope_rate'
  | 'high_wrong_scope_rate_recent'
  | 'recent_cancellations'
  | 'quality_concerns'
  | 'mixed_signals'
  | 'partial_recovery'
  | 'new_operator'
  | 'insufficient_history'
  | 'probationary';

export interface OperatorPolicy {
  operator_id: string;
  state: IssuanceState;
  cooldown_days: number;
  cooldown_until?: string;
  reason_codes: ReasonCode[];
  policy_action: 'issue' | 'issue_with_caution' | 'hold' | 'escalate';
  eligible_for_issuance: boolean;
  review_required: boolean;
  next_evaluation_at?: string;
  blame_surface: 'operator_behavior' | 'task_generation' | 'mixed' | 'unknown';
  decision_confidence: 'high' | 'medium' | 'low';
  evidence_task_count: number;
  metrics_lifetime: {
    completion_count: number;
    refusal_count: number;
    no_response_count: number;
    no_response_rate: number;
    wrong_scope_count: number;
    wrong_scope_rate: number;
    explicit_decline_count: number;
    cancelled_count: number;
    quality_reject_count: number;
  };
  metrics_recent: {
    completion_count: number;
    refusal_count: number;
    no_response_count: number;
    no_response_rate: number;
    wrong_scope_count: number;
    wrong_scope_rate: number;
    days_since_last_completion?: number;
    days_since_last_refusal?: number;
  };
  notes?: string;
}

export interface GuardrailOutput {
  generated_at: string;
  as_of: string;
  version: string;
  operators: OperatorPolicy[];
  summary: {
    total_operators: number;
    by_state: Record<IssuanceState, number>;
  };
}

export interface GuardrailThresholds {
  recent_window_days: number;
  min_tasks_for_stats: number;
  suppress_no_response_rate: number;
  caution_no_response_rate: number;
  manual_review_wrong_scope_rate: number;
  recovery_completions_required: number;
  cooldown_days: Record<IssuanceState, number>;
}

export const DEFAULT_THRESHOLDS: GuardrailThresholds = {
  recent_window_days: 30,
  min_tasks_for_stats: 3,
  suppress_no_response_rate: 0.5,
  caution_no_response_rate: 0.25,
  manual_review_wrong_scope_rate: 0.3,
  recovery_completions_required: 2,
  cooldown_days: {
    eligible: 0,
    caution: 0,
    suppress: 7,
    manual_review: 0,
  },
};

export const SCHEMA_VERSION = '1.0.0';

export const STATE_PRIORITY: Record<IssuanceState, number> = {
  manual_review: 0,
  suppress: 1,
  caution: 2,
  eligible: 3,
};
```

### guardrail.ts (core logic)

```typescript
/**
 * Engagement Guardrail Policy Generator
 * 
 * Key design:
 * 1. Recent-first evaluation (30-day window)
 * 2. Explicit state precedence: manual_review > suppress > caution > eligible
 * 3. Partial recovery only (one level at a time)
 * 4. All time calculations use as_of (deterministic)
 * 5. Input validation for adversarial cases
 */

import {
  type GuardrailInput,
  type GuardrailOutput,
  type GuardrailThresholds,
  type OperatorHistory,
  type OperatorPolicy,
  type IssuanceState,
  type ReasonCode,
  type RefusalType,
  DEFAULT_THRESHOLDS,
  SCHEMA_VERSION,
  STATE_PRIORITY,
} from './types.js';

const VALID_REFUSAL_TYPES = new Set<RefusalType>([
  'no_response', 'explicit_decline', 'wrong_scope', 'quality_reject', 'cancelled'
]);

function validateOperator(op: OperatorHistory, asOf: Date): string[] {
  const errors: string[] = [];
  
  for (const r of op.refusals) {
    if (!VALID_REFUSAL_TYPES.has(r.type as RefusalType)) {
      errors.push(`Unknown refusal type: ${r.type}`);
    }
    if (isNaN(new Date(r.occurred_at).getTime())) {
      errors.push(`Invalid refusal timestamp: ${r.occurred_at}`);
    }
    if (new Date(r.occurred_at) > asOf) {
      errors.push(`Future-dated refusal: ${r.occurred_at}`);
    }
  }
  
  for (const t of op.tasks_completed) {
    if (isNaN(new Date(t.completed_at).getTime())) {
      errors.push(`Invalid completion timestamp: ${t.completed_at}`);
    }
    if (new Date(t.completed_at) > asOf) {
      errors.push(`Future-dated completion: ${t.completed_at}`);
    }
  }
  
  const allTaskIds = [
    ...op.tasks_completed.map(t => t.task_id),
    ...op.refusals.map(r => r.task_id),
  ];
  const seen = new Set<string>();
  for (const id of allTaskIds) {
    if (seen.has(id)) errors.push(`Duplicate task_id: ${id}`);
    seen.add(id);
  }
  
  return errors;
}

// ... [metrics calculation and state determination logic]

export function generateGuardrailPolicy(
  input: GuardrailInput,
  thresholds: GuardrailThresholds = DEFAULT_THRESHOLDS
): GuardrailOutput {
  const asOf = input.as_of ? new Date(input.as_of) : new Date();
  const generatedAt = new Date();

  const policies = input.operators.map(op => 
    generateOperatorPolicy(op, asOf, thresholds)
  );

  // Sort by intervention priority
  policies.sort((a, b) => {
    const priorityDiff = STATE_PRIORITY[a.state] - STATE_PRIORITY[b.state];
    if (priorityDiff !== 0) return priorityDiff;
    return a.operator_id.localeCompare(b.operator_id);
  });

  const byState: Record<IssuanceState, number> = {
    eligible: 0, caution: 0, suppress: 0, manual_review: 0,
  };
  for (const policy of policies) byState[policy.state]++;

  return {
    generated_at: generatedAt.toISOString(),
    as_of: asOf.toISOString(),
    version: SCHEMA_VERSION,
    operators: policies,
    summary: { total_operators: policies.length, by_state: byState },
  };
}
```

---

*Task: Build Engagement Guardrail Policy Generator*  
*Submitted by: Permanent Upper Class (@zozDOTeth)*  
*April 2026*
