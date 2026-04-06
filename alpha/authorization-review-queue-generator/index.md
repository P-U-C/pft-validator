---
layout: default
title: Authorization Review Queue Generator
date: 2026-04-06
category: network
status: submitted
task_id: 568c04d0-bb69-4338-bce2-25cdf398705c
---

# Authorization Review Queue Generator

Generates moderator-ready review queue from contributor authorization records and task history. Each case includes exposure score, recommended action, and evidence checklist for reviewer decision.

**Task ID:** `568c04d0-bb69-4338-bce2-25cdf398705c`  
**Reward:** 4,200 PFT  
**Verification:** Code artifact  
**Version:** 1.0.0

---

## Overview

This module complements the Engagement Guardrail Policy Generator by converting authorization and task signals into an actionable review backlog for human moderators.

**Key features:**
- Ranks cases by exposure score (0-100)
- Recommends action: `confirm`, `cooldown`, `audit`, or `suppress`
- Provides evidence checklist for each case
- Deterministic sorting and tie-breaking
- Handles missing authorization records

---

## Output Schema

```typescript
interface ReviewPacket {
  operator_id: string;
  
  // Exposure scoring
  exposure_score: number;          // 0-100, higher = more urgent
  exposure_pft: number;            // Total PFT rewarded
  exposure_task_count: number;     // Total tasks completed
  
  // Authorization state
  authorization_state: 'authorized' | 'pending' | 'suspended' | 'revoked' | 'unknown';
  authorization_missing: boolean;
  days_since_last_review?: number;
  
  // Recommended action
  recommended_action: 'confirm' | 'cooldown' | 'audit' | 'suppress';
  action_rationale: string;
  
  // Activity summary
  summary: {
    first_task_at?: string;
    last_task_at?: string;
    days_active?: number;
    days_inactive?: number;
    refusal_count: number;
    refusal_rate: number;
    avg_task_score?: number;
  };
  
  // Evidence checklist for reviewer
  evidence_checklist: EvidenceChecklistItem[];
  
  // Deterministic sort keys
  sort_keys: {
    exposure_score: number;
    exposure_pft: number;
    operator_id: string;
  };
}
```

---

## Action Triggers

| Action | Trigger |
|--------|---------|
| `suppress` | Missing auth + ≥50K PFT exposure, OR ≥50% refusal rate |
| `audit` | Missing auth with any exposure, OR ≥25% refusal rate, OR high exposure + stale review |
| `cooldown` | Suspended state, OR ≥90 days inactive |
| `confirm` | Pending auth, OR clean authorized (routine check) |

---

## Exposure Score Components

| Factor | Points |
|--------|--------|
| PFT ≥200K | 40 |
| PFT ≥50K | 25 |
| PFT ≥10K | 15 |
| PFT ≥1K | 5 |
| Missing auth | 30 |
| Pending auth | 20 |
| Suspended | 25 |
| Refusal rate ≥50% | 20 |
| Refusal rate ≥25% | 12 |
| Stale review (180+ days) | 10 |
| Stale review (90+ days) | 5 |
| Never reviewed (but authorized) | 8 |

Score capped at 100.

---

## Sample Input

```json
{
  "authorizations": [
    {
      "operator_id": "alice",
      "state": "authorized",
      "authorized_at": "2025-06-01T00:00:00Z",
      "last_reviewed_at": "2026-03-01T00:00:00Z"
    },
    {
      "operator_id": "bob",
      "state": "authorized",
      "authorized_at": "2026-02-01T00:00:00Z",
      "last_reviewed_at": "2026-03-15T00:00:00Z",
      "review_notes": "Previously suspended, restored after appeal"
    },
    {
      "operator_id": "carol",
      "state": "pending"
    }
  ],
  "tasks": [
    { "task_id": "t1", "operator_id": "alice", "completed_at": "2026-04-01T10:00:00Z", "reward_pft": 8000, "score": 92 },
    { "task_id": "t2", "operator_id": "alice", "completed_at": "2026-04-03T14:00:00Z", "reward_pft": 12000, "score": 88 },
    { "task_id": "t3", "operator_id": "bob", "completed_at": "2026-04-01T09:00:00Z", "reward_pft": 3000, "score": 85 },
    { "task_id": "t4", "operator_id": "bob", "completed_at": "2026-04-05T11:00:00Z", "reward_pft": 4000, "score": 90 },
    { "task_id": "t5", "operator_id": "carol", "completed_at": "2026-04-02T15:00:00Z", "reward_pft": 2000 },
    { "task_id": "t6", "operator_id": "unknown_dave", "completed_at": "2026-04-01T08:00:00Z", "reward_pft": 55000 },
    { "task_id": "t7", "operator_id": "unknown_dave", "completed_at": "2026-04-04T16:00:00Z", "reward_pft": 25000 }
  ],
  "refusals": [
    { "task_id": "r1", "operator_id": "unknown_dave", "type": "wrong_scope", "occurred_at": "2026-04-02T10:00:00Z" },
    { "task_id": "r2", "operator_id": "unknown_dave", "type": "no_response", "occurred_at": "2026-04-03T12:00:00Z" }
  ],
  "as_of": "2026-04-06T12:00:00Z"
}
```

## Sample Output (First Entry)

```json
{
  "operator_id": "unknown_dave",
  "exposure_score": 75,
  "exposure_pft": 80000,
  "exposure_task_count": 2,
  "authorization_state": "unknown",
  "authorization_missing": true,
  "recommended_action": "suppress",
  "action_rationale": "No authorization record found. 80,000 PFT already rewarded without verification.",
  "summary": {
    "first_task_at": "2026-04-01T08:00:00Z",
    "last_task_at": "2026-04-04T16:00:00Z",
    "days_active": 4,
    "days_inactive": 2,
    "refusal_count": 2,
    "refusal_rate": 0.5
  },
  "evidence_checklist": [
    {
      "check": "Verify operator identity matches authorization record",
      "status": "required",
      "data_available": false,
      "value": "missing"
    },
    {
      "check": "Review total PFT exposure and reward history",
      "status": "required",
      "data_available": true,
      "value": 80000
    },
    {
      "check": "Analyze refusal patterns (types: wrong_scope, no_response)",
      "status": "required",
      "data_available": true,
      "value": 2
    }
  ],
  "sort_keys": {
    "exposure_score": 75,
    "exposure_pft": 80000,
    "operator_id": "unknown_dave"
  }
}
```

---

## Case Types in Sample

| Operator | Type | Action | Rationale |
|----------|------|--------|-----------|
| **unknown_dave** | High-risk | `suppress` | No auth record, 80K PFT exposure, 50% refusal rate |
| **carol** | Pending | `confirm` | Auth pending, low exposure, complete verification |
| **alice** | Clean | `confirm` | Authorized, good scores, routine check |
| **bob** | Recovered | `confirm` | Previously suspended, restored, performing well |

---

## Test Execution

```bash
$ npm test -- --reporter=verbose

 RUN  v2.1.9

 ✓ Empty Input > returns empty queue for empty input
 ✓ Missing Authorization Records > flags operators with tasks but no auth record
 ✓ Missing Authorization Records > recommends suppress for missing auth with high exposure
 ✓ Aggregation Correctness > correctly aggregates tasks and refusals per operator
 ✓ Aggregation Correctness > calculates average task score correctly
 ✓ Action Threshold Boundaries > triggers audit at exactly 25% refusal rate
 ✓ Action Threshold Boundaries > triggers suppress at 50%+ refusal rate
 ✓ Deterministic Tie-Breaking > produces identical output for same input
 ✓ Deterministic Tie-Breaking > breaks ties by exposure_pft then operator_id alphabetically
 ✓ Inactivity Escalation > recommends cooldown for critical inactivity (90+ days)
 ✓ Inactivity Escalation > calculates days_inactive correctly
 ✓ Stable Sort Order > sorts by exposure_score desc, then exposure_pft desc, then operator_id asc
 ✓ Exposure Score Calculation > scores missing auth higher than authorized
 ✓ Exposure Score Calculation > caps exposure score at 100
 ✓ Evidence Checklist > generates checklist with required items for high-risk cases
 ✓ Evidence Checklist > includes refusal analysis when refusals exist
 ✓ Sample Cases > handles high-risk case correctly
 ✓ Sample Cases > handles recovered case correctly
 ✓ Sample Cases > handles clean authorized case correctly
 ✓ Summary Statistics > correctly aggregates summary by action and auth state

 Test Files  1 passed (1)
      Tests  20 passed (20)
   Duration  273ms
```

---

## Integration Example

```typescript
import { generateReviewQueue } from './index.js';

const result = generateReviewQueue(input);

// Get cases needing immediate action
const urgent = result.queue.filter(p => 
  p.recommended_action === 'suppress' || p.recommended_action === 'audit'
);

// Build moderation work queue
const workQueue = urgent.map(p => ({
  operator_id: p.operator_id,
  action: p.recommended_action,
  exposure_pft: p.exposure_pft,
  rationale: p.action_rationale,
  checklist: p.evidence_checklist.filter(c => c.status === 'required'),
}));

// Route to moderator dashboard
moderatorDashboard.addCases(workQueue);
```

---

## Source Code

### types.ts

```typescript
export type AuthorizationState = 
  | 'authorized' | 'pending' | 'suspended' | 'revoked' | 'unknown';

export type RecommendedAction = 
  | 'confirm' | 'cooldown' | 'audit' | 'suppress';

export interface AuthorizationRecord {
  operator_id: string;
  state: AuthorizationState;
  authorized_at?: string;
  last_reviewed_at?: string;
  review_notes?: string;
}

export interface TaskRecord {
  task_id: string;
  operator_id: string;
  completed_at: string;
  reward_pft: number;
  score?: number;
  category?: string;
}

export interface RefusalRecord {
  task_id: string;
  operator_id: string;
  type: 'no_response' | 'explicit_decline' | 'wrong_scope' | 'quality_reject' | 'cancelled';
  occurred_at: string;
  notes?: string;
}

export interface ReviewQueueInput {
  authorizations: AuthorizationRecord[];
  tasks: TaskRecord[];
  refusals: RefusalRecord[];
  as_of?: string;
}

export interface EvidenceChecklistItem {
  check: string;
  status: 'required' | 'recommended' | 'optional';
  data_available: boolean;
  value?: string | number;
}

export interface ReviewPacket {
  operator_id: string;
  exposure_score: number;
  exposure_pft: number;
  exposure_task_count: number;
  authorization_state: AuthorizationState;
  authorization_missing: boolean;
  days_since_last_review?: number;
  recommended_action: RecommendedAction;
  action_rationale: string;
  summary: { /* activity metrics */ };
  evidence_checklist: EvidenceChecklistItem[];
  sort_keys: { exposure_score: number; exposure_pft: number; operator_id: string };
}

export interface ReviewQueueOutput {
  generated_at: string;
  as_of: string;
  version: string;
  queue: ReviewPacket[];
  summary: {
    total_operators: number;
    total_exposure_pft: number;
    by_action: Record<RecommendedAction, number>;
    by_auth_state: Record<AuthorizationState, number>;
    missing_auth_count: number;
  };
}

export const DEFAULT_THRESHOLDS = {
  inactivity_days_warning: 30,
  inactivity_days_critical: 90,
  refusal_rate_audit: 0.25,
  refusal_rate_suppress: 0.50,
  exposure_pft_audit: 50000,
  exposure_pft_critical: 200000,
  review_stale_days: 90,
  min_tasks_for_patterns: 3,
};
```

### review-queue.ts (core function)

```typescript
export function generateReviewQueue(
  input: ReviewQueueInput,
  thresholds: ReviewQueueThresholds = DEFAULT_THRESHOLDS
): ReviewQueueOutput {
  const asOf = input.as_of ? new Date(input.as_of) : new Date();
  
  // 1. Aggregate data by operator
  const operators = aggregateByOperator(input, asOf);
  
  // 2. Generate review packets with scores and actions
  const packets = Array.from(operators.values())
    .map(agg => generateReviewPacket(agg, asOf, thresholds));
  
  // 3. Sort by exposure_score desc, exposure_pft desc, operator_id asc
  packets.sort((a, b) => {
    if (a.exposure_score !== b.exposure_score) 
      return b.exposure_score - a.exposure_score;
    if (a.exposure_pft !== b.exposure_pft) 
      return b.exposure_pft - a.exposure_pft;
    return a.operator_id.localeCompare(b.operator_id);
  });
  
  // 4. Calculate summary statistics
  return { /* output with queue and summary */ };
}
```

---

*Task: Build Authorization Review Queue Generator*  
*Submitted by: Permanent Upper Class (@zozDOTeth)*  
*April 2026*
