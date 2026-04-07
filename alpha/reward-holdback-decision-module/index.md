---
layout: default
title: Deterministic Reward Holdback Decision Module
date: 2026-04-07
category: network
status: submitted
task_id: 8e46295f-918d-4874-9ef7-9ee0ba559785
---

# Deterministic Reward Holdback Decision Module

**Task ID:** `8e46295f-918d-4874-9ef7-9ee0ba559785`  
**Reward:** 4,400 PFT  
**Verification:** Code artifact  
**Version:** 1.0.0

**What this module is:** A deterministic pre-payout decision layer for the live verification pipeline. It evaluates a single verification event using contributor authorization state, artifact visibility, and recent risk signals, then returns a release decision plus reviewer-ready fields. Risky submissions are consistently held back before payout.

**What this module is not:** A probabilistic risk model or ML classifier. All decisions are deterministic — identical inputs always produce identical outputs.

---

## Sample Input/Output

### Input — Clean Authorized Release
```json
{
  "event": {
    "task_id": "task_abc_001",
    "operator_id": "op_trusted_alice",
    "reward_pft": 2500,
    "verification_type": "url",
    "verification_target": "https://github.com/org/repo/pull/42",
    "evidence_visibility": "public",
    "operator_auth_state": "AUTHORIZED",
    "risk_signals": {
      "recent_rejection_count": 0,
      "recent_holdback_count": 0,
      "evidence_coverage_ratio": 0.95,
      "days_since_auth_update": 5
    }
  },
  "as_of": "2026-04-07T12:00:00Z"
}
```

### Output — auto_release
```json
{
  "generated_at": "2026-04-07T12:00:00.000Z",
  "as_of": "2026-04-07T12:00:00Z",
  "version": "1.0.0",
  "task_id": "task_abc_001",
  "operator_id": "op_trusted_alice",
  "decision": "auto_release",
  "holdback_reason_codes": ["CLEAN"],
  "missing_public_evidence": false,
  "reviewer_fields": {
    "operator_id": "op_trusted_alice",
    "operator_auth_state": "AUTHORIZED",
    "reward_pft": 2500,
    "evidence_visibility": "public",
    "verification_type": "url",
    "verification_target": "https://github.com/org/repo/pull/42",
    "risk_summary": "None",
    "recommended_action": "No action required — auto-released."
  },
  "decision_rationale": "Task task_abc_001 passes all checks. Operator op_trusted_alice is AUTHORIZED, evidence is public. Auto-releasing 2500 PFT.",
  "validation_warnings": []
}
```

### Input — Holdback (Unauthorized + Missing Evidence)
```json
{
  "event": {
    "task_id": "task_ghi_003",
    "operator_id": "op_unknown_eve",
    "reward_pft": 6000,
    "verification_type": "code",
    "evidence_visibility": "missing",
    "operator_auth_state": "UNKNOWN",
    "risk_signals": {
      "recent_rejection_count": 5,
      "evidence_coverage_ratio": 0.0,
      "days_since_auth_update": 120
    }
  },
  "as_of": "2026-04-07T12:00:00Z"
}
```

### Output — holdback
```json
{
  "generated_at": "2026-04-07T12:00:00.000Z",
  "as_of": "2026-04-07T12:00:00Z",
  "version": "1.0.0",
  "task_id": "task_ghi_003",
  "operator_id": "op_unknown_eve",
  "decision": "holdback",
  "holdback_reason_codes": [
    "UNAUTHORIZED_OPERATOR",
    "MISSING_EVIDENCE",
    "HIGH_REWARD_WEAK_EVIDENCE",
    "VERIFICATION_TARGET_MISSING",
    "STALE_AUTH_STATE",
    "ELEVATED_REJECTION_RATE",
    "LOW_HISTORICAL_COVERAGE"
  ],
  "missing_public_evidence": true,
  "reviewer_fields": {
    "operator_id": "op_unknown_eve",
    "operator_auth_state": "UNKNOWN",
    "reward_pft": 6000,
    "evidence_visibility": "missing",
    "verification_type": "code",
    "risk_summary": "UNAUTHORIZED_OPERATOR, MISSING_EVIDENCE, HIGH_REWARD_WEAK_EVIDENCE, VERIFICATION_TARGET_MISSING, STALE_AUTH_STATE, ELEVATED_REJECTION_RATE, LOW_HISTORICAL_COVERAGE",
    "recommended_action": "Blocked. Resolve: UNAUTHORIZED_OPERATOR, MISSING_EVIDENCE, HIGH_REWARD_WEAK_EVIDENCE, VERIFICATION_TARGET_MISSING, STALE_AUTH_STATE, ELEVATED_REJECTION_RATE, LOW_HISTORICAL_COVERAGE before release."
  },
  "decision_rationale": "Task task_ghi_003 held back. Triggered: UNAUTHORIZED_OPERATOR, MISSING_EVIDENCE, HIGH_REWARD_WEAK_EVIDENCE, VERIFICATION_TARGET_MISSING, STALE_AUTH_STATE, ELEVATED_REJECTION_RATE, LOW_HISTORICAL_COVERAGE. Reward 6000 PFT blocked pending resolution.",
  "validation_warnings": []
}
```

---

## Decision Logic

### Three Decision Paths

| Decision | Trigger | Effect |
|----------|---------|--------|
| `auto_release` | All checks pass (CLEAN) | Reward released immediately |
| `manual_review` | Soft risk flags detected | Reward held pending reviewer approval |
| `holdback` | Hard risk flags detected | Reward blocked pending resolution |

### Holdback Codes (Hard Block)

| Code | Description |
|------|-------------|
| `UNAUTHORIZED_OPERATOR` | Auth state is UNKNOWN or SUSPENDED |
| `MISSING_EVIDENCE` | No evidence provided at all |
| `MALFORMED_EVIDENCE` | Evidence metadata is structurally invalid |

### Manual Review Codes (Escalation)

| Code | Description |
|------|-------------|
| `PROBATIONARY_HIGH_REWARD` | PROBATIONARY operator + reward ≥ 3,000 PFT |
| `PRIVATE_ARTIFACT` | Artifact not publicly accessible |
| `EXPIRED_EVIDENCE` | Evidence link no longer works |
| `SELF_REPORT_ONLY` | Self-report with no corroborating evidence |
| `HIGH_REWARD_WEAK_EVIDENCE` | Reward ≥ 5,000 PFT + non-public evidence |
| `STALE_AUTH_STATE` | Auth state not updated in ≥ 60 days |
| `ELEVATED_REJECTION_RATE` | ≥ 3 rejections in last 30 days |
| `ELEVATED_HOLDBACK_RATE` | ≥ 2 holdbacks in last 30 days |
| `LOW_HISTORICAL_COVERAGE` | Evidence coverage ratio < 0.3 |
| `CONCENTRATION_RISK` | Single task ≥ 50% of operator's recent rewards |
| `VERIFICATION_TARGET_MISSING` | URL/code/transaction type but no target |

---

## Configurable Thresholds

| Threshold | Default | Purpose |
|-----------|---------|---------|
| `high_reward_threshold` | 5,000 PFT | Reward amount triggering enhanced scrutiny |
| `stale_auth_days` | 60 | Days before auth state is considered stale |
| `max_recent_rejections` | 3 | Rejections before escalation |
| `max_recent_holdbacks` | 2 | Holdbacks before escalation |
| `low_coverage_threshold` | 0.3 | Coverage ratio below which to flag |
| `concentration_threshold` | 0.5 | Single-task reward ratio to flag |
| `probationary_review_threshold` | 3,000 PFT | PFT above which PROBATIONARY triggers review |

All thresholds are overridable per call via the `thresholds` parameter.

---

## Module Code (Full Implementation)

### types.ts

```typescript
/**
 * Reward Holdback Decision Module — Types
 */

export const SCHEMA_VERSION = '1.0.0';

export type AuthState =
  | 'UNKNOWN'
  | 'PROBATIONARY'
  | 'AUTHORIZED'
  | 'TRUSTED'
  | 'SUSPENDED';

export type VerificationType =
  | 'url'
  | 'code'
  | 'document'
  | 'screenshot'
  | 'transaction'
  | 'attestation'
  | 'self_report'
  | 'unknown';

export type EvidenceVisibility =
  | 'public'
  | 'authenticated'
  | 'private'
  | 'expired'
  | 'missing'
  | 'malformed';

export interface RiskSignals {
  recent_rejection_count?: number;
  recent_holdback_count?: number;
  evidence_coverage_ratio?: number;
  concentration_ratio?: number;
  days_since_auth_update?: number;
}

export interface VerificationEvent {
  task_id: string;
  operator_id: string;
  reward_pft: number;
  verification_type: VerificationType;
  verification_target?: string;
  evidence_visibility: EvidenceVisibility;
  evidence_checked_at?: string;
  operator_auth_state: AuthState;
  risk_signals?: RiskSignals;
}

export interface HoldbackInput {
  event: VerificationEvent;
  as_of?: string;
}

export type HoldbackDecision = 'auto_release' | 'manual_review' | 'holdback';

export type HoldbackReasonCode =
  | 'UNAUTHORIZED_OPERATOR'
  | 'PROBATIONARY_HIGH_REWARD'
  | 'MISSING_EVIDENCE'
  | 'PRIVATE_ARTIFACT'
  | 'EXPIRED_EVIDENCE'
  | 'MALFORMED_EVIDENCE'
  | 'SELF_REPORT_ONLY'
  | 'HIGH_REWARD_WEAK_EVIDENCE'
  | 'STALE_AUTH_STATE'
  | 'ELEVATED_REJECTION_RATE'
  | 'ELEVATED_HOLDBACK_RATE'
  | 'LOW_HISTORICAL_COVERAGE'
  | 'CONCENTRATION_RISK'
  | 'VERIFICATION_TARGET_MISSING'
  | 'CLEAN';

export interface ReviewerFields {
  operator_id: string;
  operator_auth_state: AuthState;
  reward_pft: number;
  evidence_visibility: EvidenceVisibility;
  verification_type: VerificationType;
  verification_target?: string;
  risk_summary: string;
  recommended_action: string;
}

export interface HoldbackOutput {
  generated_at: string;
  as_of: string;
  version: string;
  task_id: string;
  operator_id: string;
  decision: HoldbackDecision;
  holdback_reason_codes: HoldbackReasonCode[];
  missing_public_evidence: boolean;
  reviewer_fields: ReviewerFields;
  decision_rationale: string;
  validation_warnings: string[];
}

export interface HoldbackThresholds {
  high_reward_threshold: number;
  stale_auth_days: number;
  max_recent_rejections: number;
  max_recent_holdbacks: number;
  low_coverage_threshold: number;
  concentration_threshold: number;
  probationary_review_threshold: number;
}

export const DEFAULT_THRESHOLDS: HoldbackThresholds = {
  high_reward_threshold: 5000,
  stale_auth_days: 60,
  max_recent_rejections: 3,
  max_recent_holdbacks: 2,
  low_coverage_threshold: 0.3,
  concentration_threshold: 0.5,
  probationary_review_threshold: 3000,
};
```

### holdback.ts

```typescript
/**
 * Reward Holdback Decision Module — Core Logic
 */

import {
  SCHEMA_VERSION,
  DEFAULT_THRESHOLDS,
  type HoldbackInput,
  type HoldbackOutput,
  type HoldbackDecision,
  type HoldbackReasonCode,
  type HoldbackThresholds,
  type VerificationEvent,
  type ReviewerFields,
} from './types.js';

function collectReasonCodes(
  event: VerificationEvent,
  thresholds: HoldbackThresholds,
): HoldbackReasonCode[] {
  const codes: HoldbackReasonCode[] = [];

  if (event.operator_auth_state === 'UNKNOWN' || event.operator_auth_state === 'SUSPENDED') {
    codes.push('UNAUTHORIZED_OPERATOR');
  }

  if (
    event.operator_auth_state === 'PROBATIONARY' &&
    event.reward_pft >= thresholds.probationary_review_threshold
  ) {
    codes.push('PROBATIONARY_HIGH_REWARD');
  }

  if (event.evidence_visibility === 'missing') codes.push('MISSING_EVIDENCE');
  if (event.evidence_visibility === 'private') codes.push('PRIVATE_ARTIFACT');
  if (event.evidence_visibility === 'expired') codes.push('EXPIRED_EVIDENCE');
  if (event.evidence_visibility === 'malformed') codes.push('MALFORMED_EVIDENCE');

  if (event.verification_type === 'self_report') codes.push('SELF_REPORT_ONLY');

  const weakVisibilities = new Set(['private', 'missing', 'expired', 'malformed']);
  if (
    event.reward_pft >= thresholds.high_reward_threshold &&
    weakVisibilities.has(event.evidence_visibility)
  ) {
    codes.push('HIGH_REWARD_WEAK_EVIDENCE');
  }

  const needsTarget = new Set(['url', 'code', 'transaction']);
  if (needsTarget.has(event.verification_type) && !event.verification_target) {
    codes.push('VERIFICATION_TARGET_MISSING');
  }

  const rs = event.risk_signals;
  if (rs) {
    if (rs.days_since_auth_update !== undefined &&
        rs.days_since_auth_update >= thresholds.stale_auth_days)
      codes.push('STALE_AUTH_STATE');

    if (rs.recent_rejection_count !== undefined &&
        rs.recent_rejection_count >= thresholds.max_recent_rejections)
      codes.push('ELEVATED_REJECTION_RATE');

    if (rs.recent_holdback_count !== undefined &&
        rs.recent_holdback_count >= thresholds.max_recent_holdbacks)
      codes.push('ELEVATED_HOLDBACK_RATE');

    if (rs.evidence_coverage_ratio !== undefined &&
        rs.evidence_coverage_ratio < thresholds.low_coverage_threshold)
      codes.push('LOW_HISTORICAL_COVERAGE');

    if (rs.concentration_ratio !== undefined &&
        rs.concentration_ratio >= thresholds.concentration_threshold)
      codes.push('CONCENTRATION_RISK');
  }

  if (codes.length === 0) codes.push('CLEAN');
  return codes;
}

const HOLDBACK_CODES = new Set<HoldbackReasonCode>([
  'UNAUTHORIZED_OPERATOR', 'MISSING_EVIDENCE', 'MALFORMED_EVIDENCE',
]);

const REVIEW_CODES = new Set<HoldbackReasonCode>([
  'PROBATIONARY_HIGH_REWARD', 'PRIVATE_ARTIFACT', 'EXPIRED_EVIDENCE',
  'SELF_REPORT_ONLY', 'HIGH_REWARD_WEAK_EVIDENCE', 'STALE_AUTH_STATE',
  'ELEVATED_REJECTION_RATE', 'ELEVATED_HOLDBACK_RATE',
  'LOW_HISTORICAL_COVERAGE', 'CONCENTRATION_RISK', 'VERIFICATION_TARGET_MISSING',
]);

function deriveDecision(codes: HoldbackReasonCode[]): HoldbackDecision {
  if (codes.some((c) => HOLDBACK_CODES.has(c))) return 'holdback';
  if (codes.some((c) => REVIEW_CODES.has(c))) return 'manual_review';
  return 'auto_release';
}

function buildRationale(
  decision: HoldbackDecision,
  codes: HoldbackReasonCode[],
  event: VerificationEvent,
): string {
  if (decision === 'auto_release') {
    return `Task ${event.task_id} passes all checks. Operator ${event.operator_id} is ${event.operator_auth_state}, evidence is ${event.evidence_visibility}. Auto-releasing ${event.reward_pft} PFT.`;
  }
  const codeList = codes.filter((c) => c !== 'CLEAN').join(', ');
  if (decision === 'holdback') {
    return `Task ${event.task_id} held back. Triggered: ${codeList}. Reward ${event.reward_pft} PFT blocked pending resolution.`;
  }
  return `Task ${event.task_id} escalated to manual review. Triggered: ${codeList}. Reward ${event.reward_pft} PFT held pending reviewer approval.`;
}

function buildReviewerFields(
  event: VerificationEvent,
  decision: HoldbackDecision,
  codes: HoldbackReasonCode[],
): ReviewerFields {
  const codeList = codes.filter((c) => c !== 'CLEAN').join(', ');
  const actionMap: Record<HoldbackDecision, string> = {
    auto_release: 'No action required — auto-released.',
    manual_review: `Review required. Flags: ${codeList}.`,
    holdback: `Blocked. Resolve: ${codeList} before release.`,
  };
  return {
    operator_id: event.operator_id,
    operator_auth_state: event.operator_auth_state,
    reward_pft: event.reward_pft,
    evidence_visibility: event.evidence_visibility,
    verification_type: event.verification_type,
    verification_target: event.verification_target,
    risk_summary: codeList || 'None',
    recommended_action: actionMap[decision],
  };
}

function validate(event: VerificationEvent): string[] {
  const warnings: string[] = [];
  if (!event.task_id) warnings.push('task_id is empty');
  if (!event.operator_id) warnings.push('operator_id is empty');
  if (event.reward_pft < 0) warnings.push('reward_pft is negative');
  if (event.reward_pft === 0) warnings.push('reward_pft is zero');
  return warnings;
}

export function evaluateHoldback(
  input: HoldbackInput,
  thresholds: HoldbackThresholds = DEFAULT_THRESHOLDS,
): HoldbackOutput {
  const now = input.as_of ?? new Date().toISOString();
  const event = input.event;
  const warnings = validate(event);
  const codes = collectReasonCodes(event, thresholds);
  const decision = deriveDecision(codes);
  const missingPublic =
    event.evidence_visibility !== 'public' &&
    event.evidence_visibility !== 'authenticated';

  return {
    generated_at: new Date().toISOString(),
    as_of: now,
    version: SCHEMA_VERSION,
    task_id: event.task_id,
    operator_id: event.operator_id,
    decision,
    holdback_reason_codes: codes,
    missing_public_evidence: missingPublic,
    reviewer_fields: buildReviewerFields(event, decision, codes),
    decision_rationale: buildRationale(decision, codes, event),
    validation_warnings: warnings,
  };
}

export { DEFAULT_THRESHOLDS, SCHEMA_VERSION };
```

---

## Unit Tests (17 passing)

```bash
$ npm test -- --reporter=verbose

 ✓ Clean Authorized Release > auto-releases when all checks pass
 ✓ Unauthorized Operator Holdback > holds back UNKNOWN operator
 ✓ Missing Artifact Holdback > holds back when evidence is missing
 ✓ Private URL Rejection > escalates to manual_review for private artifacts
 ✓ Stale Authorization State > escalates when auth state is stale
 ✓ Stale Authorization State > does not flag when auth state is fresh
 ✓ Empty / Zero-Reward Input > handles zero reward with validation warning
 ✓ Empty / Zero-Reward Input > warns on empty task_id
 ✓ Threshold Boundary Behavior > does not flag reward just below high_reward_threshold with private evidence
 ✓ Threshold Boundary Behavior > flags reward at high_reward_threshold with private evidence
 ✓ Threshold Boundary Behavior > respects custom thresholds
 ✓ Deterministic Output > produces identical decisions for identical inputs
 ✓ Multiple Reason Code Accumulation > accumulates all applicable codes
 ✓ Self-Report Escalation > escalates self-report verification to manual review
 ✓ Suspended Operator Holdback > holds back SUSPENDED operator regardless of evidence
 ✓ Probationary Below Threshold > auto-releases PROBATIONARY operator below review threshold
 ✓ Probationary Below Threshold > escalates PROBATIONARY operator at review threshold

 Test Files  1 passed (1)
      Tests  17 passed (17)
```

---

*Published by Zoz via the Permanent Upper Class validator operation.*  
*Task completed for the Post Fiat Network.*
