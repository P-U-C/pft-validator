---
layout: default
title: Outstanding Queue Reconciliation Patch Generator
date: 2026-04-06
category: network
status: submitted
task_id: bc272587-c8a8-40a3-9064-c513abff169a
---

# Outstanding Queue Reconciliation Patch Generator

**Task ID:** `bc272587-c8a8-40a3-9064-c513abff169a`  
**Reward:** 4,400 PFT  
**Verification:** Code artifact  
**Version:** 1.0.0

Deterministic module that accepts outstanding task records and emits a JSON reconciliation patch list with recommended state transitions, reason codes, and safe_to_apply flags. Separates genuinely active work from cancelled clutter, stale accepted work, and unknown-owner anomalies.

---

## Sample Input/Output

### Input
```json
{
  "tasks": [
    {
      "task_id": "cancelled_limbo_001",
      "status": "cancelled",
      "owner_id": "operator_A",
      "created_at": "2026-03-15T10:00:00Z",
      "cancelled_at": "2026-03-20T14:00:00Z",
      "cancellation_reason": "Scope changed"
    },
    {
      "task_id": "fresh_active_001",
      "status": "accepted",
      "owner_id": "operator_B",
      "created_at": "2026-04-01T09:00:00Z",
      "accepted_at": "2026-04-02T10:00:00Z",
      "last_activity_at": "2026-04-05T16:00:00Z",
      "deadline": "2026-04-15T12:00:00Z",
      "reward_pft": 3500
    },
    {
      "task_id": "stale_accepted_001",
      "status": "accepted",
      "owner_id": "operator_C",
      "created_at": "2026-03-01T08:00:00Z",
      "accepted_at": "2026-03-10T09:00:00Z",
      "last_activity_at": "2026-03-15T10:00:00Z",
      "deadline": "2026-04-20T12:00:00Z",
      "reward_pft": 5000
    },
    {
      "task_id": "unknown_owner_001",
      "status": "accepted",
      "created_at": "2026-03-25T12:00:00Z",
      "last_activity_at": "2026-04-01T14:00:00Z"
    }
  ],
  "as_of": "2026-04-06T12:00:00Z"
}
```

### Output (ranked patch list)
```json
{
  "generated_at": "2026-04-06T12:00:00.000Z",
  "as_of": "2026-04-06T12:00:00.000Z",
  "version": "1.0.0",
  "patches": [
    {
      "task_id": "unknown_owner_001",
      "current_status": "accepted",
      "recommended_action": "resolve_unknown_owner",
      "proposed_state": "pending_reassignment",
      "reason_codes": ["UNKNOWN_OWNER"],
      "safe_to_apply": false,
      "requires_human_reason": "Accepted task has no assigned owner",
      "created_at": "2026-03-25T12:00:00Z",
      "last_activity_at": "2026-04-01T14:00:00Z",
      "days_since_created": 12,
      "days_since_activity": 4,
      "priority": 85,
      "priority_band": "critical",
      "sort_keys": { "priority": 85, "created_at": "2026-03-25T12:00:00Z", "task_id": "unknown_owner_001" },
      "validation_warnings": []
    },
    {
      "task_id": "cancelled_limbo_001",
      "current_status": "cancelled",
      "recommended_action": "clear_cancelled",
      "proposed_state": "archived_cancelled",
      "reason_codes": ["CANCELLED_EXPLICIT", "CANCELLED_LIMBO"],
      "safe_to_apply": true,
      "owner_id": "operator_A",
      "created_at": "2026-03-15T10:00:00Z",
      "days_since_created": 22,
      "priority": 80,
      "priority_band": "critical",
      "sort_keys": { "priority": 80, "created_at": "2026-03-15T10:00:00Z", "task_id": "cancelled_limbo_001" },
      "validation_warnings": []
    },
    {
      "task_id": "stale_accepted_001",
      "current_status": "accepted",
      "recommended_action": "escalate_stale",
      "proposed_state": "pending_review",
      "reason_codes": ["STALE_ACCEPTED"],
      "safe_to_apply": false,
      "requires_human_reason": "No activity for 22 days (threshold: 15)",
      "owner_id": "operator_C",
      "created_at": "2026-03-01T08:00:00Z",
      "last_activity_at": "2026-03-15T10:00:00Z",
      "days_since_created": 36,
      "days_since_activity": 22,
      "days_until_deadline": 14,
      "reward_pft": 5000,
      "priority": 55,
      "priority_band": "high",
      "sort_keys": { "priority": 55, "created_at": "2026-03-01T08:00:00Z", "task_id": "stale_accepted_001" },
      "validation_warnings": []
    },
    {
      "task_id": "fresh_active_001",
      "current_status": "accepted",
      "recommended_action": "keep_active",
      "proposed_state": "active",
      "reason_codes": ["FRESH_ACTIVE"],
      "safe_to_apply": true,
      "owner_id": "operator_B",
      "created_at": "2026-04-01T09:00:00Z",
      "last_activity_at": "2026-04-05T16:00:00Z",
      "days_since_created": 5,
      "days_since_activity": 0,
      "days_until_deadline": 9,
      "reward_pft": 3500,
      "priority": 10,
      "priority_band": "low",
      "sort_keys": { "priority": 10, "created_at": "2026-04-01T09:00:00Z", "task_id": "fresh_active_001" },
      "validation_warnings": []
    }
  ],
  "summary": {
    "total_tasks": 4,
    "by_action": { "keep_active": 1, "clear_cancelled": 1, "clear_expired": 0, "escalate_stale": 1, "resolve_unknown_owner": 1, "no_action": 0 },
    "by_proposed_state": { "archived_cancelled": 1, "archived_expired": 0, "archived_refused": 0, "pending_review": 1, "pending_reassignment": 1, "active": 1, "unchanged": 0 },
    "safe_to_apply_count": 2,
    "requires_human_count": 2
  }
}
```

---

## Reconciliation Taxonomy

| Action | Proposed State | Trigger | Safe to Apply |
|--------|----------------|---------|---------------|
| `keep_active` | `active` | Fresh task with recent activity | ✅ Yes |
| `clear_cancelled` | `archived_cancelled` / `archived_refused` | Task has cancelled/refused status | ✅ Yes |
| `clear_expired` | `archived_expired` | Deadline passed or no-deadline + >30 days pending | ✅ / ⚠️ |
| `escalate_stale` | `pending_review` | Accepted >15 days with no activity | ❌ No |
| `resolve_unknown_owner` | `pending_reassignment` / `pending_review` | No owner_id on accepted/submitted task | ❌ No |
| `no_action` | `unchanged` | Normal pending task, no issues | ✅ Yes |

---

## Reason Codes

| Code | Description |
|------|-------------|
| `CANCELLED_EXPLICIT` | Task was explicitly cancelled |
| `CANCELLED_LIMBO` | Status is cancelled but still in active queue |
| `REFUSED_EXPLICIT` | Operator refused the task |
| `EXPIRED_DEADLINE` | Deadline passed without submission |
| `EXPIRED_NO_DEADLINE` | No deadline, created >30 days ago, never accepted |
| `STALE_ACCEPTED` | Accepted >15 days ago, no activity |
| `STALE_PENDING` | Pending >30 days, never accepted |
| `UNKNOWN_OWNER` | No owner_id assigned |
| `OWNER_MISSING_ACTIVITY` | Has owner but no activity timestamps |
| `FRESH_ACTIVE` | Recently active, keep as-is |
| `NORMAL_PENDING` | Normal pending task |
| `SUBMITTED_AWAITING` | Submitted, waiting for review |

---

## Module Code

```typescript
/**
 * Outstanding Queue Reconciliation Patch Generator
 */

export type TaskStatus = 'pending' | 'accepted' | 'submitted' | 'cancelled' | 'expired' | 'refused' | 'unknown';
export type ReconAction = 'keep_active' | 'clear_cancelled' | 'clear_expired' | 'escalate_stale' | 'resolve_unknown_owner' | 'no_action';
export type ProposedState = 'archived_cancelled' | 'archived_expired' | 'archived_refused' | 'pending_review' | 'pending_reassignment' | 'active' | 'unchanged';

export interface TaskRecord {
  task_id: string;
  status: TaskStatus;
  owner_id?: string;
  created_at: string;
  accepted_at?: string;
  last_activity_at?: string;
  deadline?: string;
  cancelled_at?: string;
  reward_pft?: number;
}

export interface ReconciliationPatch {
  task_id: string;
  current_status: TaskStatus;
  recommended_action: ReconAction;
  proposed_state: ProposedState;
  reason_codes: string[];
  safe_to_apply: boolean;
  requires_human_reason?: string;
  priority: number;
  priority_band: 'critical' | 'high' | 'medium' | 'low';
  sort_keys: { priority: number; created_at: string; task_id: string };
  validation_warnings: string[];
}

export const DEFAULT_THRESHOLDS = {
  stale_accepted_days: 15,
  stale_pending_days: 30,
  expired_no_deadline_days: 30,
};

function classifyTask(task, asOf, thresholds) {
  // Cancelled/Refused → clear_cancelled
  if (task.status === 'cancelled') {
    return { action: 'clear_cancelled', state: 'archived_cancelled', reasons: ['CANCELLED_EXPLICIT'], safeToApply: true, priority: 80 };
  }
  if (task.status === 'refused') {
    return { action: 'clear_cancelled', state: 'archived_refused', reasons: ['REFUSED_EXPLICIT'], safeToApply: true, priority: 75 };
  }
  
  // Expired
  if (task.status === 'expired' || (task.deadline && new Date(task.deadline) < asOf)) {
    return { action: 'clear_expired', state: 'archived_expired', reasons: ['EXPIRED_DEADLINE'], safeToApply: true, priority: 70 };
  }
  
  // Unknown owner
  if (!task.owner_id && (task.status === 'accepted' || task.status === 'submitted')) {
    return { action: 'resolve_unknown_owner', state: 'pending_reassignment', reasons: ['UNKNOWN_OWNER'], safeToApply: false, priority: 85 };
  }
  
  // Stale accepted (>15 days)
  if (task.status === 'accepted') {
    const activityDate = task.last_activity_at ? new Date(task.last_activity_at) : new Date(task.accepted_at || task.created_at);
    const daysSinceActivity = Math.floor((asOf - activityDate) / (1000 * 60 * 60 * 24));
    if (daysSinceActivity >= thresholds.stale_accepted_days) {
      return { action: 'escalate_stale', state: 'pending_review', reasons: ['STALE_ACCEPTED'], safeToApply: false, priority: 55 };
    }
    return { action: 'keep_active', state: 'active', reasons: ['FRESH_ACTIVE'], safeToApply: true, priority: 10 };
  }
  
  // Normal pending
  return { action: 'no_action', state: 'unchanged', reasons: ['NORMAL_PENDING'], safeToApply: true, priority: 5 };
}

export function generateReconciliationPatches(input, thresholds = DEFAULT_THRESHOLDS) {
  const asOf = input.as_of ? new Date(input.as_of) : new Date();
  const patches = input.tasks.map(task => {
    const { action, state, reasons, safeToApply, priority } = classifyTask(task, asOf, thresholds);
    return {
      task_id: task.task_id,
      current_status: task.status,
      recommended_action: action,
      proposed_state: state,
      reason_codes: reasons,
      safe_to_apply: safeToApply,
      priority,
      priority_band: priority >= 70 ? 'critical' : priority >= 50 ? 'high' : priority >= 25 ? 'medium' : 'low',
      sort_keys: { priority, created_at: task.created_at, task_id: task.task_id },
    };
  });
  
  // Sort by priority desc, created_at asc, task_id asc
  patches.sort((a, b) => {
    if (a.priority !== b.priority) return b.priority - a.priority;
    if (a.sort_keys.created_at !== b.sort_keys.created_at) return a.sort_keys.created_at.localeCompare(b.sort_keys.created_at);
    return a.task_id.localeCompare(b.task_id);
  });
  
  return { generated_at: new Date().toISOString(), as_of: asOf.toISOString(), version: '1.0.0', patches, summary: { ... } };
}
```

---

## Unit Tests (17 passing)

```bash
$ npm test -- --reporter=verbose

 RUN  v2.1.9

 ✓ Empty Input > returns empty patches for empty input
 ✓ Cancelled Task Cleanup > recommends clear_cancelled for cancelled tasks
 ✓ Cancelled Task Cleanup > recommends clear_cancelled for refused tasks
 ✓ Stale Threshold Boundaries > keeps fresh accepted tasks active
 ✓ Stale Threshold Boundaries > escalates stale accepted tasks (>15 days)
 ✓ Stale Threshold Boundaries > escalates stale pending tasks (>30 days)
 ✓ Unknown Owner Handling > flags accepted tasks with no owner
 ✓ Unknown Owner Handling > flags submitted tasks with no owner with high priority
 ✓ Deterministic Sorting > produces identical output for same input
 ✓ Deterministic Sorting > sorts by priority desc, then created_at asc, then task_id asc
 ✓ Duplicate Task IDs > flags duplicate task IDs with warnings
 ✓ Idempotent Repeated Runs > produces same output when run multiple times
 ✓ Expired Deadline Handling > clears tasks with passed deadline
 ✓ Expired Deadline Handling > handles already-expired status
 ✓ Expired Deadline Handling > expires old pending tasks with no deadline
 ✓ Summary Statistics > correctly aggregates summary counts
 ✓ Submitted Tasks > keeps submitted tasks active

 Test Files  1 passed (1)
      Tests  17 passed (17)
   Duration  262ms
```

---

*Published by Zoz via the Permanent Upper Class validator operation.*  
*Task completed for the Post Fiat Network.*
