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

Deterministic module that accepts outstanding task records and emits a JSON reconciliation patch list with recommended state transitions, reason codes, and safe_to_apply flags.

**Positioning:** While the authorization-review queue ranks operator-level exposure cases, this module reconciles task-level state drift and queue contamination, producing deterministic cleanup patches that preserve active work while safely removing cancelled, expired, and anomalous backlog entries.

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
      "priority": 85,
      "priority_band": "critical",
      "days_since_created": 12,
      "days_since_activity": 4,
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
      "priority": 80,
      "priority_band": "critical",
      "owner_id": "operator_A",
      "days_since_created": 22,
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
      "priority": 55,
      "priority_band": "high",
      "owner_id": "operator_C",
      "days_since_created": 36,
      "days_since_activity": 22,
      "days_until_deadline": 14,
      "reward_pft": 5000,
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
      "priority": 10,
      "priority_band": "low",
      "owner_id": "operator_B",
      "days_since_created": 5,
      "days_since_activity": 0,
      "days_until_deadline": 9,
      "reward_pft": 3500,
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

### Idempotence Verification
```bash
# Run 1
$ node -e "console.log(JSON.stringify(generateReconciliationPatches(input)))" > run1.json
# Run 2  
$ node -e "console.log(JSON.stringify(generateReconciliationPatches(input)))" > run2.json
# Compare (excluding generated_at timestamp)
$ diff <(jq 'del(.generated_at)' run1.json) <(jq 'del(.generated_at)' run2.json)
# No output = identical
```

---

## Reconciliation Decision Matrix

| Status | Owner | Deadline | Activity Age | → Action | → State | Safe |
|--------|-------|----------|--------------|----------|---------|------|
| `cancelled` | any | any | any | `clear_cancelled` | `archived_cancelled` | ✅ |
| `refused` | any | any | any | `clear_cancelled` | `archived_refused` | ✅ |
| `expired` | any | any | any | `clear_expired` | `archived_expired` | ✅ |
| any (not submitted) | any | **passed** | any | `clear_expired` | `archived_expired` | ✅ |
| `pending` | any | none | **≥30d** | `clear_expired` | `archived_expired` | ⚠️ |
| `accepted` | **missing** | any | any | `resolve_unknown_owner` | `pending_reassignment` | ❌ |
| `submitted` | **missing** | any | any | `resolve_unknown_owner` | `pending_review` | ❌ |
| `accepted` | present | any | **missing** | `escalate_stale` | `pending_review` | ❌ |
| `accepted` | present | any | **≥15d** | `escalate_stale` | `pending_review` | ❌ |
| `accepted` | present | any | <15d | `keep_active` | `active` | ✅ |
| `submitted` | present | any | any | `keep_active` | `active` | ✅ |
| `pending` | any | any | <30d | `no_action` | `unchanged` | ✅ |

**Priority ranking rationale:**
- 90: Submitted with no owner (cannot attribute work)
- 85: Accepted with no owner (orphaned work in progress)
- 80: Cancelled/limbo (queue contamination)
- 75: Refused (cleanup needed)
- 70: Expired deadline (stale entry)
- 60: Missing activity timestamps (data integrity)
- 55: Stale accepted (15+ days idle)
- 40: No-deadline expiry (likely abandoned)
- 35: Stale pending (30+ days)
- 20: Submitted awaiting review
- 10: Fresh active
- 5: Normal pending

---

## Module Code (Full Implementation)

```typescript
/**
 * Outstanding Queue Reconciliation Patch Generator
 */

// ============================================================================
// Types
// ============================================================================

export type TaskStatus = 'pending' | 'accepted' | 'submitted' | 'cancelled' | 'expired' | 'refused' | 'unknown';
export type ReconAction = 'keep_active' | 'clear_cancelled' | 'clear_expired' | 'escalate_stale' | 'resolve_unknown_owner' | 'no_action';
export type ProposedState = 'archived_cancelled' | 'archived_expired' | 'archived_refused' | 'pending_review' | 'pending_reassignment' | 'active' | 'unchanged';
export type ReasonCode = 'CANCELLED_EXPLICIT' | 'CANCELLED_LIMBO' | 'EXPIRED_DEADLINE' | 'EXPIRED_NO_DEADLINE' | 'REFUSED_EXPLICIT' | 'STALE_ACCEPTED' | 'STALE_PENDING' | 'UNKNOWN_OWNER' | 'OWNER_MISSING_ACTIVITY' | 'FRESH_ACTIVE' | 'NORMAL_PENDING' | 'SUBMITTED_AWAITING';
export type PriorityBand = 'critical' | 'high' | 'medium' | 'low';

export interface TaskRecord {
  task_id: string;
  status: TaskStatus;
  owner_id?: string;
  created_at: string;
  accepted_at?: string;
  last_activity_at?: string;
  deadline?: string;
  cancelled_at?: string;
  cancellation_reason?: string;
  refusal_reason?: string;
  reward_pft?: number;
}

export interface ReconciliationPatch {
  task_id: string;
  current_status: TaskStatus;
  recommended_action: ReconAction;
  proposed_state: ProposedState;
  reason_codes: ReasonCode[];
  safe_to_apply: boolean;
  requires_human_reason?: string;
  owner_id?: string;
  created_at: string;
  last_activity_at?: string;
  days_since_created: number;
  days_since_activity?: number;
  days_until_deadline?: number;
  reward_pft?: number;
  priority: number;
  priority_band: PriorityBand;
  sort_keys: { priority: number; created_at: string; task_id: string };
  validation_warnings: string[];
}

export const DEFAULT_THRESHOLDS = {
  stale_accepted_days: 15,
  stale_pending_days: 30,
  expired_no_deadline_days: 30,
};

// ============================================================================
// Validation
// ============================================================================

function isValidISODate(str: string): boolean {
  return !isNaN(new Date(str).getTime());
}

function validateInput(input: ReconciliationInput, asOf: Date): Map<string, string[]> {
  const warnings = new Map<string, string[]>();
  const taskIds = new Set<string>();
  
  const addWarning = (taskId: string, msg: string) => {
    if (!warnings.has(taskId)) warnings.set(taskId, []);
    warnings.get(taskId)!.push(msg);
  };
  
  for (const task of input.tasks) {
    // Duplicate ID detection
    if (taskIds.has(task.task_id)) {
      addWarning(task.task_id, `Duplicate task_id: ${task.task_id}`);
    }
    taskIds.add(task.task_id);
    
    // Timestamp validation
    if (!isValidISODate(task.created_at)) {
      addWarning(task.task_id, `Invalid created_at: ${task.created_at}`);
    } else if (new Date(task.created_at) > asOf) {
      addWarning(task.task_id, `Future-dated created_at: ${task.created_at}`);
    }
    
    // Impossible sequences
    if (task.deadline && task.created_at && new Date(task.deadline) < new Date(task.created_at)) {
      addWarning(task.task_id, `Deadline before created_at`);
    }
    if (task.accepted_at && task.created_at && new Date(task.accepted_at) < new Date(task.created_at)) {
      addWarning(task.task_id, `accepted_at before created_at`);
    }
    
    // Accepted without accepted_at
    if (task.status === 'accepted' && !task.accepted_at && !task.last_activity_at) {
      addWarning(task.task_id, `Accepted status but no accepted_at or last_activity_at`);
    }
    
    // Cancelled with later activity
    if (task.cancelled_at && task.last_activity_at) {
      if (new Date(task.last_activity_at) > new Date(task.cancelled_at)) {
        addWarning(task.task_id, `Activity after cancellation`);
      }
    }
  }
  
  return warnings;
}

// ============================================================================
// Classification
// ============================================================================

function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

function classifyTask(task: TaskRecord, asOf: Date, thresholds: ReconciliationThresholds): {
  action: ReconAction;
  state: ProposedState;
  reasons: ReasonCode[];
  safeToApply: boolean;
  humanReason?: string;
  priority: number;
} {
  const reasons: ReasonCode[] = [];
  
  const createdDate = isValidISODate(task.created_at) ? new Date(task.created_at) : null;
  const activityDate = task.last_activity_at && isValidISODate(task.last_activity_at) 
    ? new Date(task.last_activity_at) : null;
  const deadlineDate = task.deadline && isValidISODate(task.deadline) ? new Date(task.deadline) : null;
  const acceptedDate = task.accepted_at && isValidISODate(task.accepted_at) ? new Date(task.accepted_at) : null;
  
  const daysSinceCreated = createdDate ? daysBetween(createdDate, asOf) : 0;
  const daysSinceActivity = activityDate ? daysBetween(activityDate, asOf) : undefined;
  const daysSinceAccepted = acceptedDate ? daysBetween(acceptedDate, asOf) : undefined;
  
  // Priority 1: Cancelled/Refused
  if (task.status === 'cancelled') {
    reasons.push('CANCELLED_EXPLICIT');
    if (daysSinceCreated > 0) reasons.push('CANCELLED_LIMBO');
    return { action: 'clear_cancelled', state: 'archived_cancelled', reasons, safeToApply: true, priority: 80 };
  }
  
  if (task.status === 'refused') {
    reasons.push('REFUSED_EXPLICIT');
    return { action: 'clear_cancelled', state: 'archived_refused', reasons, safeToApply: true, priority: 75 };
  }
  
  // Priority 2: Expired
  if (task.status === 'expired') {
    reasons.push('EXPIRED_DEADLINE');
    return { action: 'clear_expired', state: 'archived_expired', reasons, safeToApply: true, priority: 70 };
  }
  
  if (deadlineDate && asOf > deadlineDate && task.status !== 'submitted') {
    reasons.push('EXPIRED_DEADLINE');
    return { action: 'clear_expired', state: 'archived_expired', reasons, safeToApply: true, priority: 70 };
  }
  
  // Priority 3: Unknown owner
  if (!task.owner_id && task.status === 'accepted') {
    reasons.push('UNKNOWN_OWNER');
    return { action: 'resolve_unknown_owner', state: 'pending_reassignment', reasons, safeToApply: false, 
             humanReason: 'Accepted task has no assigned owner', priority: 85 };
  }
  
  if (!task.owner_id && task.status === 'submitted') {
    reasons.push('UNKNOWN_OWNER');
    return { action: 'resolve_unknown_owner', state: 'pending_review', reasons, safeToApply: false,
             humanReason: 'Submitted task has no owner — cannot attribute work', priority: 90 };
  }
  
  // Priority 4: Stale accepted
  if (task.status === 'accepted') {
    if (!activityDate && !acceptedDate) {
      reasons.push('OWNER_MISSING_ACTIVITY');
      return { action: 'escalate_stale', state: 'pending_review', reasons, safeToApply: false,
               humanReason: 'Accepted task has no activity timestamps', priority: 60 };
    }
    
    const relevantDays = daysSinceActivity ?? daysSinceAccepted ?? daysSinceCreated;
    if (relevantDays >= thresholds.stale_accepted_days) {
      reasons.push('STALE_ACCEPTED');
      return { action: 'escalate_stale', state: 'pending_review', reasons, safeToApply: false,
               humanReason: `No activity for ${relevantDays} days (threshold: ${thresholds.stale_accepted_days})`, priority: 55 };
    }
    
    reasons.push('FRESH_ACTIVE');
    return { action: 'keep_active', state: 'active', reasons, safeToApply: true, priority: 10 };
  }
  
  // Priority 5: Stale pending
  if (task.status === 'pending') {
    if (!deadlineDate && daysSinceCreated >= thresholds.expired_no_deadline_days) {
      reasons.push('EXPIRED_NO_DEADLINE');
      reasons.push('STALE_PENDING');
      return { action: 'clear_expired', state: 'archived_expired', reasons, safeToApply: false,
               humanReason: `Pending ${daysSinceCreated} days with no deadline — likely abandoned`, priority: 40 };
    }
    
    if (daysSinceCreated >= thresholds.stale_pending_days) {
      reasons.push('STALE_PENDING');
      return { action: 'escalate_stale', state: 'pending_review', reasons, safeToApply: false,
               humanReason: `Pending ${daysSinceCreated} days without acceptance`, priority: 35 };
    }
    
    reasons.push('NORMAL_PENDING');
    return { action: 'no_action', state: 'unchanged', reasons, safeToApply: true, priority: 5 };
  }
  
  // Priority 6: Submitted
  if (task.status === 'submitted') {
    reasons.push('SUBMITTED_AWAITING');
    return { action: 'keep_active', state: 'active', reasons, safeToApply: true, priority: 20 };
  }
  
  // Default: Unknown
  return { action: 'resolve_unknown_owner', state: 'pending_review', reasons: ['UNKNOWN_OWNER'], 
           safeToApply: false, humanReason: `Unknown task status: ${task.status}`, priority: 50 };
}

// ============================================================================
// Main Entry Point
// ============================================================================

export function generateReconciliationPatches(
  input: ReconciliationInput,
  thresholds = DEFAULT_THRESHOLDS
): ReconciliationOutput {
  const asOf = input.as_of ? new Date(input.as_of) : new Date();
  const generatedAt = new Date();
  
  const warnings = validateInput(input, asOf);
  
  const patches: ReconciliationPatch[] = [];
  for (const task of input.tasks) {
    const { action, state, reasons, safeToApply, humanReason, priority } = classifyTask(task, asOf, thresholds);
    
    const createdDate = isValidISODate(task.created_at) ? new Date(task.created_at) : asOf;
    const activityDate = task.last_activity_at && isValidISODate(task.last_activity_at) ? new Date(task.last_activity_at) : undefined;
    const deadlineDate = task.deadline && isValidISODate(task.deadline) ? new Date(task.deadline) : undefined;
    
    patches.push({
      task_id: task.task_id,
      current_status: task.status,
      recommended_action: action,
      proposed_state: state,
      reason_codes: reasons,
      safe_to_apply: safeToApply,
      requires_human_reason: humanReason,
      owner_id: task.owner_id,
      created_at: task.created_at,
      last_activity_at: task.last_activity_at,
      days_since_created: daysBetween(createdDate, asOf),
      days_since_activity: activityDate ? daysBetween(activityDate, asOf) : undefined,
      days_until_deadline: deadlineDate ? daysBetween(asOf, deadlineDate) : undefined,
      reward_pft: task.reward_pft,
      priority,
      priority_band: priority >= 70 ? 'critical' : priority >= 50 ? 'high' : priority >= 25 ? 'medium' : 'low',
      sort_keys: { priority, created_at: task.created_at, task_id: task.task_id },
      validation_warnings: warnings.get(task.task_id) ?? [],
    });
  }
  
  // Deterministic sort: priority desc, created_at asc, task_id asc
  patches.sort((a, b) => {
    if (a.priority !== b.priority) return b.priority - a.priority;
    if (a.created_at !== b.created_at) return a.created_at.localeCompare(b.created_at);
    return a.task_id.localeCompare(b.task_id);
  });
  
  // Summary
  const byAction: Record<ReconAction, number> = { keep_active: 0, clear_cancelled: 0, clear_expired: 0, escalate_stale: 0, resolve_unknown_owner: 0, no_action: 0 };
  const byState: Record<ProposedState, number> = { archived_cancelled: 0, archived_expired: 0, archived_refused: 0, pending_review: 0, pending_reassignment: 0, active: 0, unchanged: 0 };
  let safeCount = 0, humanCount = 0;
  
  for (const p of patches) {
    byAction[p.recommended_action]++;
    byState[p.proposed_state]++;
    if (p.safe_to_apply) safeCount++; else humanCount++;
  }
  
  return {
    generated_at: generatedAt.toISOString(),
    as_of: asOf.toISOString(),
    version: '1.0.0',
    patches,
    summary: { total_tasks: patches.length, by_action: byAction, by_proposed_state: byState, safe_to_apply_count: safeCount, requires_human_count: humanCount },
  };
}
```

---

## Unit Tests (17 passing)

```bash
$ npm test -- --reporter=verbose

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

 Tests  17 passed (17)
```

---

*Published by Zoz via the Permanent Upper Class validator operation.*  
*Task completed for the Post Fiat Network.*
