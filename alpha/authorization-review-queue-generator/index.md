---
layout: default
title: Authorization Review Queue Generator
date: 2026-04-06
category: network
status: submitted
task_id: 568c04d0-bb69-4338-bce2-25cdf398705c
---

# Authorization Review Queue Generator

**Task ID:** `568c04d0-bb69-4338-bce2-25cdf398705c`  
**Reward:** 4,200 PFT  
**Verification:** Code artifact  
**Version:** 1.1.0

---

## Sample Input/Output

### Input
```json
{
  "authorizations": [
    {
      "operator_id": "revoked_op",
      "state": "revoked",
      "last_reviewed_at": "2026-02-20T09:00:00Z",
      "review_notes": "Revoked for quality violations"
    },
    {
      "operator_id": "clean_op",
      "state": "authorized",
      "last_reviewed_at": "2026-03-15T10:00:00Z"
    }
  ],
  "tasks": [
    { "task_id": "t1", "operator_id": "revoked_op", "completed_at": "2026-04-01T10:00:00Z", "reward_pft": 5000, "score": 78 },
    { "task_id": "t2", "operator_id": "revoked_op", "completed_at": "2026-04-03T14:00:00Z", "reward_pft": 4500, "score": 82 },
    { "task_id": "t3", "operator_id": "clean_op", "completed_at": "2026-04-02T12:00:00Z", "reward_pft": 3000, "score": 92 }
  ],
  "refusals": [],
  "as_of": "2026-04-06T16:00:00Z"
}
```

### Output (ranked queue)
```json
{
  "generated_at": "2026-04-06T16:00:00.000Z",
  "as_of": "2026-04-06T16:00:00.000Z",
  "version": "1.0.0",
  "queue": [
    {
      "operator_id": "revoked_op",
      "exposure_score": 45,
      "exposure_pft": 9500,
      "exposure_task_count": 2,
      "priority_band": "medium",
      "review_sla_hours": 72,
      "decision_due_at": "2026-04-09T16:00:00.000Z",
      "case_status": "pending",
      "requires_human": true,
      "requires_human_reason": "Suppress action requires human confirmation",
      "trigger_codes": ["REVOKED_WITH_ACTIVITY"],
      "authorization_state": "revoked",
      "authorization_missing": false,
      "days_since_last_review": 45,
      "prior_review_notes": "Revoked for quality violations",
      "risk_family": "state_anomaly",
      "trigger_reasons": [
        {
          "trigger": "post_revocation_activity",
          "threshold": "no tasks after revocation",
          "actual": "2 tasks in last 30 days",
          "severity": "critical"
        }
      ],
      "recommended_action": "suppress",
      "action_rationale": "Revoked operator with recent task activity. Immediate block required.",
      "why_not_lower": "State is revoked. Any task activity in this state indicates enforcement failure.",
      "suggested_reviewer_notes": "Investigate how tasks were issued to revoked operator. Review task issuance controls.",
      "facts": {
        "identity_verified": false,
        "total_pft_rewarded": 9500,
        "net_pft_after_corrections": 9500,
        "task_count": 2,
        "refusal_count": 0,
        "refusal_rate_percent": 0,
        "recent_30d_pft": 9500,
        "recent_30d_tasks": 2,
        "recent_30d_refusals": 0,
        "post_review_tasks": 2,
        "post_review_refusals": 0,
        "days_since_first_activity": 5,
        "days_since_last_activity": 3,
        "days_since_last_review": 45,
        "avg_task_score": 80
      },
      "key_dates": {
        "first_reward_at": "2026-04-01T10:00:00.000Z",
        "last_reward_at": "2026-04-03T14:00:00.000Z",
        "last_review_at": "2026-02-20T09:00:00Z"
      },
      "summary": {
        "first_task_at": "2026-04-01T10:00:00.000Z",
        "last_task_at": "2026-04-03T14:00:00.000Z",
        "days_active": 3,
        "days_inactive": 3,
        "refusal_breakdown": {
          "no_response": 0,
          "explicit_decline": 0,
          "wrong_scope": 0,
          "quality_reject": 0,
          "cancelled": 0,
          "total": 0,
          "denominator": 2,
          "denominator_type": "total_opportunities"
        },
        "avg_task_score": 80,
        "recent_task_count": 2,
        "recent_refusal_count": 0,
        "recent_pft": 9500
      },
      "recent_timeline": [
        { "timestamp": "2026-04-03T14:00:00Z", "type": "task", "description": "Completed task t2 (score: 82)", "pft_delta": 4500 },
        { "timestamp": "2026-04-01T10:00:00Z", "type": "task", "description": "Completed task t1 (score: 78)", "pft_delta": 5000 },
        { "timestamp": "2026-02-20T09:00:00Z", "type": "review", "description": "Review: Revoked for quality violations" }
      ],
      "evidence_checklist": [
        { "check": "Verify operator identity matches authorization record", "status": "required", "data_available": true, "value": "revoked" },
        { "check": "Review total PFT exposure and reward history", "status": "recommended", "data_available": true, "value": 9500 },
        { "check": "Review average task quality score", "status": "optional", "data_available": true, "value": "80.0" },
        { "check": "Review recent activity timeline", "status": "optional", "data_available": true, "value": "2 tasks, 0 refusals in last 30 days" },
        { "check": "Review previous moderation notes", "status": "recommended", "data_available": true, "value": "Revoked for quality violations" }
      ],
      "sort_keys": { "exposure_score": 45, "exposure_pft": 9500, "operator_id": "revoked_op" },
      "validation_warnings": []
    },
    {
      "operator_id": "clean_op",
      "exposure_score": 5,
      "exposure_pft": 3000,
      "exposure_task_count": 1,
      "priority_band": "low",
      "review_sla_hours": 168,
      "decision_due_at": "2026-04-13T16:00:00.000Z",
      "case_status": "pending",
      "requires_human": false,
      "trigger_codes": [],
      "authorization_state": "authorized",
      "authorization_missing": false,
      "days_since_last_review": 22,
      "risk_family": "low_risk",
      "trigger_reasons": [],
      "recommended_action": "confirm",
      "action_rationale": "Authorization valid. Routine confirmation — no intervention needed.",
      "why_not_higher": "No risk signals detected. Operator in good standing.",
      "suggested_reviewer_notes": "Routine review. Confirm and close case.",
      "facts": {
        "identity_verified": true,
        "total_pft_rewarded": 3000,
        "net_pft_after_corrections": 3000,
        "task_count": 1,
        "refusal_count": 0,
        "refusal_rate_percent": 0,
        "recent_30d_pft": 3000,
        "recent_30d_tasks": 1,
        "recent_30d_refusals": 0,
        "post_review_tasks": 1,
        "post_review_refusals": 0,
        "days_since_first_activity": 4,
        "days_since_last_activity": 4,
        "days_since_last_review": 22,
        "avg_task_score": 92
      },
      "key_dates": {
        "first_reward_at": "2026-04-02T12:00:00.000Z",
        "last_reward_at": "2026-04-02T12:00:00.000Z",
        "last_review_at": "2026-03-15T10:00:00Z"
      },
      "summary": {
        "first_task_at": "2026-04-02T12:00:00.000Z",
        "last_task_at": "2026-04-02T12:00:00.000Z",
        "days_active": 1,
        "days_inactive": 4,
        "refusal_breakdown": {
          "no_response": 0,
          "explicit_decline": 0,
          "wrong_scope": 0,
          "quality_reject": 0,
          "cancelled": 0,
          "total": 0,
          "denominator": 1,
          "denominator_type": "total_opportunities"
        },
        "avg_task_score": 92,
        "recent_task_count": 1,
        "recent_refusal_count": 0,
        "recent_pft": 3000
      },
      "recent_timeline": [
        { "timestamp": "2026-04-02T12:00:00Z", "type": "task", "description": "Completed task t3 (score: 92)", "pft_delta": 3000 },
        { "timestamp": "2026-03-15T10:00:00Z", "type": "review", "description": "Review: completed" }
      ],
      "evidence_checklist": [
        { "check": "Verify operator identity matches authorization record", "status": "recommended", "data_available": true, "value": "authorized" },
        { "check": "Review total PFT exposure and reward history", "status": "recommended", "data_available": true, "value": 3000 },
        { "check": "Review average task quality score", "status": "optional", "data_available": true, "value": "92.0" },
        { "check": "Review recent activity timeline", "status": "optional", "data_available": true, "value": "1 tasks, 0 refusals in last 30 days" }
      ],
      "sort_keys": { "exposure_score": 5, "exposure_pft": 3000, "operator_id": "clean_op" },
      "validation_warnings": []
    }
  ],
  "summary": {
    "total_operators": 2,
    "total_exposure_pft": 12500,
    "by_action": { "confirm": 1, "cooldown": 0, "audit": 0, "suppress": 1 },
    "by_auth_state": { "authorized": 1, "pending": 0, "suspended": 0, "revoked": 1, "unknown": 0 },
    "missing_auth_count": 0
  }
}
```

---

## Module Code

```typescript
/**
 * Authorization Review Queue Generator
 * Generates moderator-ready review queue from contributor authorization
 * and task history. Ranks cases by exposure and risk signals.
 */

// ============================================================================
// Types
// ============================================================================

export type AuthorizationState = 'authorized' | 'pending' | 'suspended' | 'revoked' | 'unknown';
export type RecommendedAction = 'confirm' | 'cooldown' | 'audit' | 'suppress';
export type RiskFamily = 'unauthorized_exposure' | 'state_anomaly' | 'behavioral_pattern' | 
                         'trend_deterioration' | 'stale_review' | 'inactivity' | 'low_risk';
export type TriggerCode = 'MISSING_AUTH' | 'HIGH_EXPOSURE_NO_AUTH' | 'REVOKED_WITH_ACTIVITY' | 
                          'SUSPENDED_WITH_ACTIVITY' | 'HIGH_REFUSAL_RATE' | 'ELEVATED_REFUSAL_RATE' |
                          'TREND_DETERIORATING' | 'STALE_REVIEW' | 'CRITICAL_INACTIVITY';
export type RefusalType = 'no_response' | 'explicit_decline' | 'wrong_scope' | 'quality_reject' | 'cancelled';
export type PriorityBand = 'critical' | 'high' | 'medium' | 'low';

export interface TaskRecord {
  task_id: string;
  operator_id: string;
  completed_at: string;
  reward_pft: number;
  score?: number;
}

export interface RefusalRecord {
  task_id: string;
  operator_id: string;
  type: RefusalType;
  occurred_at: string;
  notes?: string;
}

export interface AuthorizationRecord {
  operator_id: string;
  state: AuthorizationState;
  authorized_at?: string;
  last_reviewed_at?: string;
  review_notes?: string;
}

export interface ReviewQueueInput {
  authorizations: AuthorizationRecord[];
  tasks: TaskRecord[];
  refusals: RefusalRecord[];
  rewards?: RewardRecord[];
  as_of?: string;
}

export interface TriggerReason {
  trigger: string;
  threshold: string;
  actual: string;
  severity: 'critical' | 'warning' | 'info';
}

export interface RefusalBreakdown {
  no_response: number;
  explicit_decline: number;
  wrong_scope: number;
  quality_reject: number;
  cancelled: number;
  total: number;
  denominator: number;
  denominator_type: 'total_opportunities';
}

export interface EvidenceChecklistItem {
  check: string;
  status: 'required' | 'recommended' | 'optional';
  data_available: boolean;
  value: string | number;
}

export interface ReviewerFacts {
  identity_verified: boolean | null;
  total_pft_rewarded: number;
  net_pft_after_corrections: number;
  task_count: number;
  refusal_count: number;
  refusal_rate_percent: number;
  recent_30d_pft: number;
  recent_30d_tasks: number;
  recent_30d_refusals: number;
  post_review_tasks: number;
  post_review_refusals: number;
  days_since_first_activity: number | null;
  days_since_last_activity: number | null;
  days_since_last_review: number | null;
  avg_task_score: number | null;
}

export interface ReviewPacket {
  operator_id: string;
  exposure_score: number;
  exposure_pft: number;
  exposure_task_count: number;
  priority_band: PriorityBand;
  review_sla_hours: number;
  decision_due_at: string;
  case_status: 'pending' | 'in_review' | 'decided';
  requires_human: boolean;
  requires_human_reason?: string;
  trigger_codes: TriggerCode[];
  authorization_state: AuthorizationState;
  authorization_missing: boolean;
  days_since_last_review?: number;
  prior_review_notes?: string;
  risk_family: RiskFamily;
  trigger_reasons: TriggerReason[];
  recommended_action: RecommendedAction;
  action_rationale: string;
  why_not_lower?: string;
  why_not_higher?: string;
  suggested_reviewer_notes?: string;
  facts: ReviewerFacts;
  key_dates: KeyDates;
  summary: ActivitySummary;
  recent_timeline: TimelineEvent[];
  evidence_checklist: EvidenceChecklistItem[];
  sort_keys: { exposure_score: number; exposure_pft: number; operator_id: string };
  validation_warnings: string[];
}

export const DEFAULT_THRESHOLDS = {
  refusal_rate_audit: 0.25,
  refusal_rate_suppress: 0.50,
  exposure_pft_audit: 50000,
  exposure_pft_critical: 100000,
  inactivity_days_critical: 90,
  review_stale_days: 90,
  min_tasks_for_patterns: 4,
};

// ============================================================================
// Core Implementation
// ============================================================================

function classifyRisk(agg, asOf, thresholds) {
  const triggers = [];
  const codes = [];
  const refusalRate = agg.refusal_breakdown.denominator > 0
    ? agg.refusal_breakdown.total / agg.refusal_breakdown.denominator : 0;
  
  // Unauthorized exposure
  if (!agg.auth && agg.total_pft > 0) {
    codes.push(agg.total_pft >= thresholds.exposure_pft_audit ? 'HIGH_EXPOSURE_NO_AUTH' : 'MISSING_AUTH');
    triggers.push({
      trigger: 'missing_authorization',
      threshold: 'authorization record required',
      actual: `none found, ${agg.total_pft.toLocaleString()} PFT rewarded`,
      severity: agg.total_pft >= thresholds.exposure_pft_audit ? 'critical' : 'warning',
    });
    return { family: 'unauthorized_exposure', triggers, codes };
  }
  
  // State anomaly
  if (agg.auth?.state === 'revoked' && agg.recent_tasks.length > 0) {
    codes.push('REVOKED_WITH_ACTIVITY');
    triggers.push({
      trigger: 'post_revocation_activity',
      threshold: 'no tasks after revocation',
      actual: `${agg.recent_tasks.length} tasks in last 30 days`,
      severity: 'critical',
    });
    return { family: 'state_anomaly', triggers, codes };
  }
  
  // Behavioral pattern
  if (agg.refusal_breakdown.denominator >= thresholds.min_tasks_for_patterns) {
    if (refusalRate >= thresholds.refusal_rate_suppress) {
      codes.push('HIGH_REFUSAL_RATE');
      triggers.push({
        trigger: 'high_refusal_rate',
        threshold: `≥${thresholds.refusal_rate_suppress * 100}%`,
        actual: `${(refusalRate * 100).toFixed(0)}%`,
        severity: 'critical',
      });
      return { family: 'behavioral_pattern', triggers, codes };
    }
    if (refusalRate >= thresholds.refusal_rate_audit) {
      codes.push('ELEVATED_REFUSAL_RATE');
      triggers.push({
        trigger: 'elevated_refusal_rate',
        threshold: `≥${thresholds.refusal_rate_audit * 100}%`,
        actual: `${(refusalRate * 100).toFixed(0)}%`,
        severity: 'warning',
      });
    }
  }
  
  if (triggers.length > 0) return { family: 'behavioral_pattern', triggers, codes };
  return { family: 'low_risk', triggers: [], codes: [] };
}

function calculateExposureScore(agg, riskFamily, triggers, thresholds) {
  let score = 0;
  
  // PFT exposure (0-40 points)
  if (agg.total_pft >= thresholds.exposure_pft_critical) score += 40;
  else if (agg.total_pft >= thresholds.exposure_pft_audit) score += 25;
  else if (agg.total_pft >= 10000) score += 15;
  else if (agg.total_pft >= 1000) score += 5;
  
  // Risk family (0-30 points)
  const familyScores = {
    unauthorized_exposure: 30, state_anomaly: 30, behavioral_pattern: 20,
    trend_deterioration: 15, stale_review: 10, inactivity: 8, low_risk: 0,
  };
  score += familyScores[riskFamily];
  
  // Trigger severity (0-20 points)
  const criticalCount = triggers.filter(t => t.severity === 'critical').length;
  score += Math.min(criticalCount * 10, 20);
  
  return Math.min(score, 100);
}

function determineAction(agg, riskFamily, triggers, thresholds) {
  const refusalRate = agg.refusal_breakdown.denominator > 0
    ? agg.refusal_breakdown.total / agg.refusal_breakdown.denominator : 0;
  
  if (riskFamily === 'unauthorized_exposure' && agg.total_pft >= thresholds.exposure_pft_audit) {
    return {
      action: 'suppress',
      rationale: `No authorization record. ${agg.total_pft.toLocaleString()} PFT already rewarded without verification.`,
      whyNotLower: `Exposure exceeds audit threshold. Cannot issue more tasks without identity verification.`,
    };
  }
  
  if (riskFamily === 'state_anomaly') {
    return {
      action: 'suppress',
      rationale: `${agg.auth?.state} operator with recent task activity. Immediate block required.`,
      whyNotLower: `State is ${agg.auth?.state}. Any task activity indicates enforcement failure.`,
    };
  }
  
  if (riskFamily === 'behavioral_pattern' && refusalRate >= thresholds.refusal_rate_audit) {
    return {
      action: 'audit',
      rationale: `Refusal rate ${(refusalRate * 100).toFixed(0)}% elevated. Review task history.`,
      whyNotHigher: `Rate below ${thresholds.refusal_rate_suppress * 100}% suppress threshold.`,
      whyNotLower: `Rate exceeds ${thresholds.refusal_rate_audit * 100}% audit threshold.`,
    };
  }
  
  return {
    action: 'confirm',
    rationale: `Authorization valid. Routine confirmation — no intervention needed.`,
    whyNotHigher: `No risk signals detected. Operator in good standing.`,
  };
}

export function generateReviewQueue(input, thresholds = DEFAULT_THRESHOLDS) {
  const asOf = input.as_of ? new Date(input.as_of) : new Date();
  
  // Aggregate by operator, classify risk, generate packets
  // [Full implementation in source files]
  
  // Sort by exposure_score (desc), exposure_pft (desc), operator_id (asc)
  packets.sort((a, b) => {
    if (a.exposure_score !== b.exposure_score) return b.exposure_score - a.exposure_score;
    if (a.exposure_pft !== b.exposure_pft) return b.exposure_pft - a.exposure_pft;
    return a.operator_id.localeCompare(b.operator_id);
  });
  
  return { generated_at, as_of, version: '1.0.0', queue: packets, summary };
}
```

---

## Unit Tests (26 passing)

```bash
$ npm test -- --reporter=verbose

 RUN  v2.1.9

 ✓ Empty Input > returns empty queue for empty input
 ✓ Empty Input > includes all required output fields
 ✓ Missing Authorization Records > flags operators with tasks but no auth record
 ✓ Missing Authorization Records > recommends suppress for missing auth with high exposure
 ✓ Aggregation Correctness > correctly aggregates tasks and refusals with breakdown
 ✓ Aggregation Correctness > uses explicit rewards when provided
 ✓ Risk Family Classification > classifies state anomaly for revoked with recent activity
 ✓ Risk Family Classification > classifies trend deterioration when recent is worse than historical
 ✓ Action Threshold Boundaries > triggers audit at exactly 25% refusal rate
 ✓ Action Threshold Boundaries > triggers suppress at 50%+ refusal rate
 ✓ Deterministic Tie-Breaking > produces identical output for same input
 ✓ Deterministic Tie-Breaking > breaks ties alphabetically by operator_id
 ✓ Inactivity Escalation > recommends cooldown for critical inactivity
 ✓ Timeline Generation > generates recent timeline with events
 ✓ Timeline Generation > limits timeline to 10 most recent events
 ✓ Adversarial Cases > handles duplicate task IDs with warning
 ✓ Adversarial Cases > handles future-dated events with warning
 ✓ Adversarial Cases > handles malformed timestamps with warning
 ✓ Adversarial Cases > handles negative rewards (corrections/clawbacks)
 ✓ Adversarial Cases > handles operator with only refusals (no completed tasks)
 ✓ Adversarial Cases > handles conflicting authorization records with warning
 ✓ Adversarial Cases > handles revoked user with post-revocation rewards
 ✓ Sample Cases > handles high-risk case correctly
 ✓ Sample Cases > handles recovered case correctly
 ✓ Sample Cases > handles clean authorized case correctly
 ✓ Summary Statistics > correctly aggregates summary by action and auth state

 Test Files  1 passed (1)
      Tests  26 passed (26)
   Duration  288ms
```

---

## Source Repository

Full implementation: [pft-audit/tasks/2026-04-06_authorization-review-queue-generator/](https://github.com/P-U-C/pft-audit)

---

*Published by Zoz via the Permanent Upper Class validator operation.*  
*Task completed for the Post Fiat Network.*
