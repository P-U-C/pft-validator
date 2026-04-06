---
layout: default
title: Authorization Review Queue Generator
date: 2026-04-06
category: network
status: submitted
task_id: 568c04d0-bb69-4338-bce2-25cdf398705c
---

# Authorization Review Queue Generator

Generates moderator-ready review queue from contributor authorization records and task history. Each case includes exposure score, operational metadata, machine-readable trigger codes, structured reviewer facts, key dates, action justification, and evidence checklist for rapid reviewer decision.

**Task ID:** `568c04d0-bb69-4338-bce2-25cdf398705c`  
**Reward:** 4,200 PFT  
**Verification:** Code artifact  
**Version:** 1.1.0

---

## Key Design Decisions

### 1. Explicit Reward History
Supports both embedded task rewards AND separate reward stream (bonuses, corrections, clawbacks). Net exposure = sum of all rewards, which can be negative after clawbacks.

### 2. Refusal Rate Denominator
Refusal rate uses **total opportunities** (tasks_completed + refusals), not just completed tasks. Explicitly documented as `denominator_type: 'total_opportunities'`.

### 3. Risk Family Classification
Every case is classified into a risk family:
- `unauthorized_exposure` — No auth record with rewards
- `state_anomaly` — Revoked/suspended with recent activity
- `behavioral_pattern` — High refusal rate
- `trend_deterioration` — Recent performance worse than historical
- `stale_review` — High exposure + outdated review
- `inactivity` — Extended dormancy
- `low_risk` — Routine confirmation

### 4. Machine-Readable Trigger Codes
`trigger_codes` array for workflow automation:
- `MISSING_AUTH`, `HIGH_EXPOSURE_NO_AUTH`
- `REVOKED_WITH_ACTIVITY`, `SUSPENDED_WITH_ACTIVITY`
- `HIGH_REFUSAL_RATE`, `ELEVATED_REFUSAL_RATE`
- `TREND_DETERIORATING`, `STALE_REVIEW`, `CRITICAL_INACTIVITY`

### 5. Trigger Reasons (Human-Readable)
Each trigger includes threshold vs actual values and severity (`critical`/`warning`/`info`).

### 6. Operational Queue Metadata
- `priority_band`: critical/high/medium/low
- `review_sla_hours`: 4/24/72/168 based on priority
- `decision_due_at`: ISO 8601 timestamp (as_of + SLA)
- `case_status`: pending/in_review/decided
- `requires_human`: boolean
- `requires_human_reason`: explanation

### 7. Action Justification
- `why_not_lower`: Why not less severe action
- `why_not_higher`: Why not more severe action
- `suggested_reviewer_notes`: Pre-written notes for reviewer

### 8. Structured Reviewer Facts
Not just checklist prompts — actual metrics:
- `total_pft_rewarded`, `net_pft_after_corrections`
- `recent_30d_pft`, `recent_30d_tasks`, `recent_30d_refusals`
- `post_review_tasks`, `post_review_refusals`
- `refusal_rate_percent`, `avg_task_score`

### 9. Key Dates
Compact timeline: `first_reward_at`, `last_reward_at`, `first_refusal_at`, `last_refusal_at`, `last_review_at`, `authorized_at`, `state_changed_at`

### 10. Validation Warnings
Malformed data (duplicate IDs, future dates, conflicting auth records) flagged in `validation_warnings`.

---

## Output Schema

```typescript
interface ReviewPacket {
  operator_id: string;
  
  // Exposure scoring
  exposure_score: number;          // 0-100
  exposure_pft: number;            // Net PFT
  exposure_task_count: number;
  
  // Queue-operational metadata
  priority_band: 'critical' | 'high' | 'medium' | 'low';
  review_sla_hours: number;
  decision_due_at: string;         // ISO 8601
  case_status: 'pending' | 'in_review' | 'decided';
  requires_human: boolean;
  requires_human_reason?: string;
  
  // Machine-readable triggers
  trigger_codes: TriggerCode[];
  
  // Authorization state
  authorization_state: AuthorizationState;
  authorization_missing: boolean;
  days_since_last_review?: number;
  prior_review_notes?: string;
  
  // Risk classification
  risk_family: RiskFamily;
  trigger_reasons: TriggerReason[];
  
  // Recommended action with justification
  recommended_action: 'confirm' | 'cooldown' | 'audit' | 'suppress';
  action_rationale: string;
  why_not_lower?: string;
  why_not_higher?: string;
  suggested_reviewer_notes?: string;
  
  // Structured reviewer facts
  facts: ReviewerFacts;
  
  // Key dates
  key_dates: KeyDates;
  
  // Activity summary
  summary: {
    first_task_at?: string;
    last_task_at?: string;
    days_active?: number;
    days_inactive?: number;
    refusal_breakdown: RefusalBreakdown;
    avg_task_score?: number;
    recent_task_count: number;
    recent_refusal_count: number;
    recent_pft: number;
  };
  
  // Recent timeline (last 10 events)
  recent_timeline: TimelineEvent[];
  
  // Evidence checklist
  evidence_checklist: EvidenceChecklistItem[];
  
  // Sort keys
  sort_keys: { exposure_score: number; exposure_pft: number; operator_id: string };
  
  // Validation warnings
  validation_warnings: string[];
}

interface ReviewerFacts {
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

interface KeyDates {
  first_reward_at?: string;
  last_reward_at?: string;
  first_refusal_at?: string;
  last_refusal_at?: string;
  last_review_at?: string;
  authorized_at?: string;
  state_changed_at?: string;
}

interface RefusalBreakdown {
  no_response: number;
  wrong_scope: number;
  quality_reject: number;
  cancelled: number;
  explicit_decline: number;
  total: number;
  denominator: number;
  denominator_type: 'total_opportunities';
}

interface TriggerReason {
  trigger: string;
  threshold: string;
  actual: string;
  severity: 'critical' | 'warning' | 'info';
}
```

---

## Test Execution

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

## Sample Cases

### Case 1: Revoked with Post-Revocation Activity
```json
{
  "operator_id": "revoked_active_001",
  "exposure_score": 85,
  "priority_band": "critical",
  "review_sla_hours": 4,
  "requires_human": true,
  "requires_human_reason": "State anomaly requires investigation",
  "trigger_codes": ["REVOKED_WITH_ACTIVITY"],
  "risk_family": "state_anomaly",
  "recommended_action": "suppress",
  "why_not_lower": "State is revoked. Any task activity indicates enforcement failure."
}
```

### Case 2: Missing Auth with High Exposure
```json
{
  "operator_id": "unknown_high_exposure",
  "exposure_score": 70,
  "exposure_pft": 95000,
  "priority_band": "critical",
  "trigger_codes": ["HIGH_EXPOSURE_NO_AUTH"],
  "risk_family": "unauthorized_exposure",
  "recommended_action": "suppress",
  "why_not_lower": "Exposure exceeds audit threshold (50,000 PFT)."
}
```

### Case 3: Elevated Refusal Rate
```json
{
  "operator_id": "elevated_refusals",
  "exposure_score": 55,
  "priority_band": "high",
  "trigger_codes": ["ELEVATED_REFUSAL_RATE"],
  "risk_family": "behavioral_pattern",
  "recommended_action": "audit",
  "why_not_higher": "Rate is 36%, below 50% suppress threshold.",
  "why_not_lower": "Rate exceeds 25% audit threshold."
}
```

### Case 4: Recovered Operator (Clean)
```json
{
  "operator_id": "recovered_clean",
  "exposure_score": 15,
  "priority_band": "low",
  "trigger_codes": [],
  "risk_family": "low_risk",
  "recommended_action": "confirm",
  "why_not_higher": "No risk signals detected. Operator in good standing."
}
```

### Case 5: Stale Review + High Exposure
```json
{
  "operator_id": "stale_review_high",
  "exposure_score": 48,
  "exposure_pft": 180000,
  "priority_band": "medium",
  "trigger_codes": ["STALE_REVIEW"],
  "risk_family": "stale_review",
  "recommended_action": "audit",
  "why_not_lower": "Exposure ≥50,000 PFT requires 90-day review cadence."
}
```

---

## Integration Example

```typescript
import { generateReviewQueue } from './review-queue.js';

const output = generateReviewQueue(input);

// Filter to urgent cases only
const urgentCases = output.queue.filter(p => 
  p.priority_band === 'critical' || p.priority_band === 'high'
);

// Map to moderation dashboard
const dashboard = urgentCases.map(p => ({
  id: p.operator_id,
  priority: p.priority_band,
  sla: p.decision_due_at,
  action: p.recommended_action,
  codes: p.trigger_codes,
  rationale: p.action_rationale,
  whyNotLower: p.why_not_lower,
  facts: p.facts,
  notes: p.suggested_reviewer_notes,
}));
```

---

*Published by Zoz via the Permanent Upper Class validator operation.*  
*Task completed for the Post Fiat Network.*
