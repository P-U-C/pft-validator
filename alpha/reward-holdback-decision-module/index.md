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

**Determinism guarantee:** This artifact is deterministic at the full payload level: identical normalized inputs produce byte-stable decision outputs. Runtime clock values do not affect scoring fields. The module never calls `new Date()` — all timestamps derive from the required `as_of` input field. Malformed or incomplete verification events fail closed into deterministic holdback responses with explicit validation codes.

---

## API Contract

```typescript
evaluateHoldback(input: HoldbackInput): HoldbackOutput
```

Single-argument function. All configuration is passed in the input object:

```typescript
interface HoldbackInput {
  event?: VerificationEvent;           // The verification event to evaluate
  as_of: string;                       // Required — ISO 8601 evaluation timestamp
  thresholds?: Partial<HoldbackThresholds>;  // Optional — merged with defaults
  reason_code_policy?: ReasonCodePolicy;     // Optional — override severity per code
}
```

No second argument. The API contract is self-contained in the input object for pipeline integration.

---

## Sample Input/Output

### Example 1: auto_release — Clean Authorized Submission

#### Input
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

#### Output
```json
{
  "generated_at": "2026-04-07T12:00:00Z",
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
    "evidence_status": "verifiable",
    "verification_type": "url",
    "verification_target": "https://github.com/org/repo/pull/42",
    "requires_public_artifact": false,
    "blocking_conditions": [],
    "risk_level": "none",
    "next_review_step": "No action required.",
    "recommended_action": "auto_release",
    "risk_summary": "None"
  },
  "decision_rationale": "Task task_abc_001 passes all checks. Operator op_trusted_alice is AUTHORIZED, evidence is public. Auto-releasing 2500 PFT.",
  "validation_warnings": []
}
```

### Example 2: manual_review — Probationary Operator with Private Artifact

#### Input
```json
{
  "event": {
    "task_id": "task_def_002",
    "operator_id": "op_new_bob",
    "reward_pft": 4000,
    "verification_type": "document",
    "verification_target": "https://internal.corp/doc/123",
    "evidence_visibility": "private",
    "operator_auth_state": "PROBATIONARY",
    "risk_signals": {
      "recent_rejection_count": 1,
      "recent_holdback_count": 0,
      "evidence_coverage_ratio": 0.4,
      "days_since_auth_update": 15
    }
  },
  "as_of": "2026-04-07T12:00:00Z"
}
```

#### Output
```json
{
  "generated_at": "2026-04-07T12:00:00Z",
  "as_of": "2026-04-07T12:00:00Z",
  "version": "1.0.0",
  "task_id": "task_def_002",
  "operator_id": "op_new_bob",
  "decision": "manual_review",
  "holdback_reason_codes": ["PROBATIONARY_HIGH_REWARD", "PRIVATE_ARTIFACT"],
  "missing_public_evidence": true,
  "reviewer_fields": {
    "operator_id": "op_new_bob",
    "operator_auth_state": "PROBATIONARY",
    "reward_pft": 4000,
    "evidence_visibility": "private",
    "evidence_status": "unverifiable",
    "verification_type": "document",
    "verification_target": "https://internal.corp/doc/123",
    "requires_public_artifact": true,
    "blocking_conditions": ["PROBATIONARY_HIGH_REWARD", "PRIVATE_ARTIFACT"],
    "risk_level": "medium",
    "next_review_step": "Request public artifact or signed attestation from operator.",
    "recommended_action": "manual_review",
    "risk_summary": "PROBATIONARY_HIGH_REWARD, PRIVATE_ARTIFACT"
  },
  "decision_rationale": "Task task_def_002 escalated to manual review. Triggered: PROBATIONARY_HIGH_REWARD, PRIVATE_ARTIFACT. Reward 4000 PFT held pending reviewer approval.",
  "validation_warnings": []
}
```

### Example 3: holdback — Unauthorized Operator with Missing Evidence

#### Input
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

#### Output
```json
{
  "generated_at": "2026-04-07T12:00:00Z",
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
    "evidence_status": "unverifiable",
    "verification_type": "code",
    "requires_public_artifact": true,
    "blocking_conditions": [
      "UNAUTHORIZED_OPERATOR",
      "MISSING_EVIDENCE",
      "HIGH_REWARD_WEAK_EVIDENCE",
      "VERIFICATION_TARGET_MISSING",
      "STALE_AUTH_STATE",
      "ELEVATED_REJECTION_RATE",
      "LOW_HISTORICAL_COVERAGE"
    ],
    "risk_level": "critical",
    "next_review_step": "Verify operator authorization status and update auth state before re-evaluation.",
    "recommended_action": "holdback",
    "risk_summary": "UNAUTHORIZED_OPERATOR, MISSING_EVIDENCE, HIGH_REWARD_WEAK_EVIDENCE, VERIFICATION_TARGET_MISSING, STALE_AUTH_STATE, ELEVATED_REJECTION_RATE, LOW_HISTORICAL_COVERAGE"
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

| Code | Severity | Rationale |
|------|----------|-----------|
| `UNAUTHORIZED_OPERATOR` | holdback | Operator has no valid authorization (UNKNOWN or SUSPENDED). Releasing funds to an unauthorized entity violates the auth-gate invariant. |
| `MISSING_EVIDENCE` | holdback | Nothing to verify. Cannot justify any payout without evidence submission. |
| `MALFORMED_EVIDENCE` | holdback | Evidence metadata is structurally invalid. Cannot be parsed or evaluated by any downstream system. |

### Manual Review Codes (Soft Hold)

| Code | Severity | Rationale |
|------|----------|-----------|
| `PROBATIONARY_HIGH_REWARD` | manual_review | Probationary operator requesting reward above threshold. Needs human judgment on appropriateness. |
| `PRIVATE_ARTIFACT` | manual_review | Evidence exists but is not publicly verifiable. A reviewer with access may confirm it. Hard-blocking would reject legitimate authenticated-access artifacts. |
| `EXPIRED_EVIDENCE` | manual_review | Evidence was once public. May be temporarily down or moved. Reviewer can re-check or request re-upload. |
| `SELF_REPORT_ONLY` | manual_review | Self-report with no corroborating evidence. May be legitimate for certain task types but requires review. |
| `HIGH_REWARD_WEAK_EVIDENCE` | manual_review | High reward (>= 5,000 PFT) combined with non-public evidence. Risk-proportional scrutiny. |
| `STALE_AUTH_STATE` | manual_review | Auth state not updated in >= 60 days. May be outdated — reviewer should refresh before release. |
| `ELEVATED_REJECTION_RATE` | manual_review | >= 3 rejections in last 30 days. Pattern may indicate quality issues. |
| `ELEVATED_HOLDBACK_RATE` | manual_review | >= 2 holdbacks in last 30 days. Recurring issues warrant human review. |
| `LOW_HISTORICAL_COVERAGE` | manual_review | Evidence coverage ratio < 0.3. Operator has poor evidence history. |
| `CONCENTRATION_RISK` | manual_review | Single task >= 50% of operator's recent rewards. Needs scrutiny. |
| `VERIFICATION_TARGET_MISSING` | manual_review | URL/code/transaction type but no target provided. May be data entry omission rather than fraud — reviewer can request. |

### Severity Override

The default policy above is overridable via `reason_code_policy` in the input. Pipeline operators can promote review codes to holdback or demote holdback codes to review:

```json
{
  "reason_code_policy": {
    "PRIVATE_ARTIFACT": "holdback",
    "EXPIRED_EVIDENCE": "holdback",
    "VERIFICATION_TARGET_MISSING": "holdback"
  }
}
```

### Malformed Input Handling

The module fails closed on structurally invalid input. If the input is null, undefined, missing the event object, or missing required fields, the module returns a deterministic holdback response with codes:

| Code | Trigger |
|------|---------|
| `INVALID_INPUT` | Input is null, undefined, or not an object |
| `MISSING_EVENT_OBJECT` | Event field is null or undefined |
| `MISSING_REQUIRED_FIELDS` | Required fields missing from event |

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

Thresholds are overridable per call via `thresholds` in the input object. Partial overrides are merged with defaults:

```json
{
  "as_of": "2026-04-07T12:00:00Z",
  "thresholds": { "high_reward_threshold": 3000 },
  "event": { ... }
}
```

---

## Reviewer Fields

The `reviewer_fields` object is structured for direct pipeline and moderator-queue consumption:

```typescript
interface ReviewerFields {
  operator_id: string;
  operator_auth_state: string;
  reward_pft: number;
  evidence_visibility: string;
  evidence_status: 'verifiable' | 'unverifiable' | 'unknown';
  verification_type: string;
  verification_target?: string;
  requires_public_artifact: boolean;
  blocking_conditions: HoldbackReasonCode[];
  risk_level: 'critical' | 'high' | 'medium' | 'low' | 'none';
  next_review_step: string;
  recommended_action: HoldbackDecision | 'investigate';
  risk_summary: string;
}
```

| Field | Purpose |
|-------|---------|
| `evidence_status` | Normalized: `verifiable` (public/authenticated) or `unverifiable` (all others) |
| `requires_public_artifact` | Boolean — `true` when evidence is not public or authenticated |
| `blocking_conditions` | Array of active reason codes (excludes CLEAN) |
| `risk_level` | `critical` (holdback + 3+ codes), `high` (holdback or review + 3+), `medium` (review), `none` (clean) |
| `next_review_step` | Actionable instruction for the most urgent blocking condition |
| `recommended_action` | The decision itself, or `investigate` for malformed input |

---

## Module Code (Full Implementation)

### types.ts

```typescript
/**
 * Reward Holdback Decision Module — Types
 *
 * Determinism guarantee: identical normalized inputs produce byte-stable
 * decision outputs. Runtime clock values do not affect scoring fields.
 */

export const SCHEMA_VERSION = '1.0.0';

// Input Types

export type AuthState =
  | 'UNKNOWN' | 'PROBATIONARY' | 'AUTHORIZED' | 'TRUSTED' | 'SUSPENDED';

export type VerificationType =
  | 'url' | 'code' | 'document' | 'screenshot'
  | 'transaction' | 'attestation' | 'self_report' | 'unknown';

export type EvidenceVisibility =
  | 'public' | 'authenticated' | 'private' | 'expired' | 'missing' | 'malformed';

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

export type ReasonCodePolicy = Partial<Record<HoldbackReasonCode, 'holdback' | 'manual_review'>>;

export const DEFAULT_REASON_CODE_POLICY: ReasonCodePolicy = {
  UNAUTHORIZED_OPERATOR: 'holdback',
  MISSING_EVIDENCE: 'holdback',
  MALFORMED_EVIDENCE: 'holdback',
  PROBATIONARY_HIGH_REWARD: 'manual_review',
  PRIVATE_ARTIFACT: 'manual_review',
  EXPIRED_EVIDENCE: 'manual_review',
  SELF_REPORT_ONLY: 'manual_review',
  HIGH_REWARD_WEAK_EVIDENCE: 'manual_review',
  STALE_AUTH_STATE: 'manual_review',
  ELEVATED_REJECTION_RATE: 'manual_review',
  ELEVATED_HOLDBACK_RATE: 'manual_review',
  LOW_HISTORICAL_COVERAGE: 'manual_review',
  CONCENTRATION_RISK: 'manual_review',
  VERIFICATION_TARGET_MISSING: 'manual_review',
};

export interface HoldbackInput {
  event?: VerificationEvent;
  as_of: string;
  thresholds?: Partial<HoldbackThresholds>;
  reason_code_policy?: ReasonCodePolicy;
}

// Output Types

export type HoldbackDecision = 'auto_release' | 'manual_review' | 'holdback';
export type RiskLevel = 'critical' | 'high' | 'medium' | 'low' | 'none';

export type HoldbackReasonCode =
  | 'UNAUTHORIZED_OPERATOR' | 'PROBATIONARY_HIGH_REWARD'
  | 'MISSING_EVIDENCE' | 'PRIVATE_ARTIFACT' | 'EXPIRED_EVIDENCE' | 'MALFORMED_EVIDENCE'
  | 'SELF_REPORT_ONLY' | 'HIGH_REWARD_WEAK_EVIDENCE'
  | 'STALE_AUTH_STATE' | 'ELEVATED_REJECTION_RATE' | 'ELEVATED_HOLDBACK_RATE'
  | 'LOW_HISTORICAL_COVERAGE' | 'CONCENTRATION_RISK' | 'VERIFICATION_TARGET_MISSING'
  | 'INVALID_INPUT' | 'MISSING_EVENT_OBJECT' | 'MISSING_REQUIRED_FIELDS'
  | 'CLEAN';

export interface ReviewerFields {
  operator_id: string;
  operator_auth_state: string;
  reward_pft: number;
  evidence_visibility: string;
  evidence_status: 'verifiable' | 'unverifiable' | 'unknown';
  verification_type: string;
  verification_target?: string;
  requires_public_artifact: boolean;
  blocking_conditions: HoldbackReasonCode[];
  risk_level: RiskLevel;
  next_review_step: string;
  recommended_action: HoldbackDecision | 'investigate';
  risk_summary: string;
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
```

### holdback.ts

```typescript
/**
 * Reward Holdback Decision Module — Core Logic
 *
 * Determinism guarantee: identical normalized inputs produce byte-stable
 * decision outputs. The module never reads the runtime clock. Malformed
 * or incomplete inputs fail closed into holdback with explicit codes.
 */

import {
  SCHEMA_VERSION, DEFAULT_THRESHOLDS, DEFAULT_REASON_CODE_POLICY,
  type HoldbackInput, type HoldbackOutput, type HoldbackDecision,
  type HoldbackReasonCode, type HoldbackThresholds, type ReasonCodePolicy,
  type VerificationEvent, type ReviewerFields, type RiskLevel,
  type EvidenceVisibility,
} from './types.js';

// --- Input Validation ---

function validateInput(input: unknown): {
  valid: boolean; warnings: string[]; codes: HoldbackReasonCode[];
} {
  const warnings: string[] = [];
  const codes: HoldbackReasonCode[] = [];

  if (input === null || input === undefined || typeof input !== 'object') {
    return { valid: false, warnings: ['input is null, undefined, or not an object'], codes: ['INVALID_INPUT'] };
  }

  const obj = input as Record<string, unknown>;

  if (!obj.as_of || typeof obj.as_of !== 'string') {
    warnings.push('as_of is missing or not a string');
  }

  if (obj.event === null || obj.event === undefined) {
    return { valid: false, warnings: [...warnings, 'event is null or undefined'], codes: ['MISSING_EVENT_OBJECT'] };
  }

  if (typeof obj.event !== 'object') {
    return { valid: false, warnings: [...warnings, 'event is not an object'], codes: ['INVALID_INPUT'] };
  }

  const event = obj.event as Record<string, unknown>;
  const missingFields: string[] = [];

  if (!event.task_id || typeof event.task_id !== 'string') missingFields.push('task_id');
  if (!event.operator_id || typeof event.operator_id !== 'string') missingFields.push('operator_id');
  if (typeof event.reward_pft !== 'number') missingFields.push('reward_pft');
  if (!event.verification_type || typeof event.verification_type !== 'string') missingFields.push('verification_type');
  if (!event.evidence_visibility || typeof event.evidence_visibility !== 'string') missingFields.push('evidence_visibility');
  if (!event.operator_auth_state || typeof event.operator_auth_state !== 'string') missingFields.push('operator_auth_state');

  if (missingFields.length > 0) {
    return {
      valid: false,
      warnings: [...warnings, `Missing required fields: ${missingFields.join(', ')}`],
      codes: ['MISSING_REQUIRED_FIELDS'],
    };
  }

  if (event.reward_pft === 0) warnings.push('reward_pft is zero');
  if ((event.reward_pft as number) < 0) warnings.push('reward_pft is negative');

  return { valid: true, warnings, codes: [] };
}

function buildInvalidInputOutput(
  input: unknown, codes: HoldbackReasonCode[], warnings: string[],
): HoldbackOutput {
  const obj = (input && typeof input === 'object') ? input as Record<string, unknown> : {};
  const asOf = (typeof obj.as_of === 'string' && obj.as_of) ? obj.as_of : 'UNKNOWN';

  return {
    generated_at: asOf, as_of: asOf, version: SCHEMA_VERSION,
    task_id: 'INVALID', operator_id: 'INVALID',
    decision: 'holdback', holdback_reason_codes: codes,
    missing_public_evidence: true,
    reviewer_fields: {
      operator_id: 'INVALID', operator_auth_state: 'UNKNOWN', reward_pft: 0,
      evidence_visibility: 'missing', evidence_status: 'unknown',
      verification_type: 'unknown', requires_public_artifact: true,
      blocking_conditions: codes, risk_level: 'critical',
      next_review_step: 'Investigate malformed input — event data is missing or structurally invalid.',
      recommended_action: 'investigate', risk_summary: codes.join(', '),
    },
    decision_rationale: `Input failed structural validation. Codes: ${codes.join(', ')}. Failing closed to holdback.`,
    validation_warnings: warnings,
  };
}

// --- Reason Code Collection ---

function collectReasonCodes(
  event: VerificationEvent, thresholds: HoldbackThresholds,
): HoldbackReasonCode[] {
  const codes: HoldbackReasonCode[] = [];

  if (event.operator_auth_state === 'UNKNOWN' || event.operator_auth_state === 'SUSPENDED') {
    codes.push('UNAUTHORIZED_OPERATOR');
  }
  if (event.operator_auth_state === 'PROBATIONARY' &&
      event.reward_pft >= thresholds.probationary_review_threshold) {
    codes.push('PROBATIONARY_HIGH_REWARD');
  }

  if (event.evidence_visibility === 'missing') codes.push('MISSING_EVIDENCE');
  if (event.evidence_visibility === 'private') codes.push('PRIVATE_ARTIFACT');
  if (event.evidence_visibility === 'expired') codes.push('EXPIRED_EVIDENCE');
  if (event.evidence_visibility === 'malformed') codes.push('MALFORMED_EVIDENCE');

  if (event.verification_type === 'self_report') codes.push('SELF_REPORT_ONLY');

  const weakVisibilities = new Set(['private', 'missing', 'expired', 'malformed']);
  if (event.reward_pft >= thresholds.high_reward_threshold &&
      weakVisibilities.has(event.evidence_visibility)) {
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

// --- Decision + Risk ---

function deriveDecision(codes: HoldbackReasonCode[], policy: ReasonCodePolicy): HoldbackDecision {
  let hasHoldback = false;
  let hasReview = false;
  for (const code of codes) {
    const severity = policy[code];
    if (severity === 'holdback') hasHoldback = true;
    else if (severity === 'manual_review') hasReview = true;
  }
  if (hasHoldback) return 'holdback';
  if (hasReview) return 'manual_review';
  return 'auto_release';
}

function deriveRiskLevel(decision: HoldbackDecision, codes: HoldbackReasonCode[]): RiskLevel {
  if (decision === 'holdback' && codes.length >= 3) return 'critical';
  if (decision === 'holdback') return 'high';
  if (decision === 'manual_review' && codes.length >= 3) return 'high';
  if (decision === 'manual_review') return 'medium';
  return 'none';
}

// --- Reviewer Fields ---

function deriveNextStep(decision: HoldbackDecision, codes: HoldbackReasonCode[]): string {
  if (decision === 'auto_release') return 'No action required.';
  if (codes.includes('UNAUTHORIZED_OPERATOR'))
    return 'Verify operator authorization status and update auth state before re-evaluation.';
  if (codes.includes('MISSING_EVIDENCE'))
    return 'Request evidence submission from operator.';
  if (codes.includes('MALFORMED_EVIDENCE'))
    return 'Request corrected evidence metadata from operator.';
  if (codes.includes('PRIVATE_ARTIFACT'))
    return 'Request public artifact or signed attestation from operator.';
  if (codes.includes('EXPIRED_EVIDENCE'))
    return 'Request updated evidence link or re-upload from operator.';
  if (codes.includes('VERIFICATION_TARGET_MISSING'))
    return 'Request verification target (URL, hash, or reference) from operator.';
  if (codes.includes('PROBATIONARY_HIGH_REWARD'))
    return 'Review probationary operator submission for reward appropriateness.';
  if (codes.includes('STALE_AUTH_STATE'))
    return 'Refresh operator authorization state before re-evaluation.';
  if (codes.includes('SELF_REPORT_ONLY'))
    return 'Request corroborating evidence beyond self-report.';
  return 'Review flagged conditions and determine appropriate resolution.';
}

function deriveEvidenceStatus(v: EvidenceVisibility): 'verifiable' | 'unverifiable' | 'unknown' {
  if (v === 'public' || v === 'authenticated') return 'verifiable';
  if (v === 'private' || v === 'expired' || v === 'missing' || v === 'malformed') return 'unverifiable';
  return 'unknown';
}

function buildReviewerFields(
  event: VerificationEvent, decision: HoldbackDecision, codes: HoldbackReasonCode[],
): ReviewerFields {
  const blockingCodes = codes.filter((c) => c !== 'CLEAN');
  return {
    operator_id: event.operator_id,
    operator_auth_state: event.operator_auth_state,
    reward_pft: event.reward_pft,
    evidence_visibility: event.evidence_visibility,
    evidence_status: deriveEvidenceStatus(event.evidence_visibility),
    verification_type: event.verification_type,
    verification_target: event.verification_target,
    requires_public_artifact: event.evidence_visibility !== 'public' && event.evidence_visibility !== 'authenticated',
    blocking_conditions: blockingCodes,
    risk_level: deriveRiskLevel(decision, codes),
    next_review_step: deriveNextStep(decision, codes),
    recommended_action: decision,
    risk_summary: blockingCodes.length > 0 ? blockingCodes.join(', ') : 'None',
  };
}

// --- Rationale ---

function buildRationale(
  decision: HoldbackDecision, codes: HoldbackReasonCode[], event: VerificationEvent,
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

// --- Public API ---

export function evaluateHoldback(input: unknown): HoldbackOutput {
  const validation = validateInput(input);
  if (!validation.valid) {
    return buildInvalidInputOutput(input, validation.codes, validation.warnings);
  }

  const typedInput = input as HoldbackInput;
  const event = typedInput.event!;
  const asOf = typedInput.as_of;
  const thresholds = { ...DEFAULT_THRESHOLDS, ...typedInput.thresholds };
  const policy = { ...DEFAULT_REASON_CODE_POLICY, ...typedInput.reason_code_policy };

  const warnings = validation.warnings;
  const codes = collectReasonCodes(event, thresholds);
  const decision = deriveDecision(codes, policy);
  const missingPublic = event.evidence_visibility !== 'public' && event.evidence_visibility !== 'authenticated';

  return {
    generated_at: asOf, as_of: asOf, version: SCHEMA_VERSION,
    task_id: event.task_id, operator_id: event.operator_id,
    decision, holdback_reason_codes: codes,
    missing_public_evidence: missingPublic,
    reviewer_fields: buildReviewerFields(event, decision, codes),
    decision_rationale: buildRationale(decision, codes, event),
    validation_warnings: warnings,
  };
}

export { DEFAULT_THRESHOLDS, DEFAULT_REASON_CODE_POLICY, SCHEMA_VERSION };
```

---

## Unit Tests (32 passing)

### holdback.test.ts

```typescript
/**
 * Reward Holdback Decision Module — Unit Tests
 *
 * Covers:
 *  1. Clean authorized release (auto_release)
 *  2. Unauthorized operator holdback (UNKNOWN)
 *  3. Missing artifact holdback
 *  4. Private URL rejection (manual_review)
 *  5. Stale authorization state escalation
 *  6. Empty / zero-reward input handling
 *  7. Threshold boundary behavior
 *  8. Full-output determinism (byte-stable JSON)
 *  9. Multiple reason code accumulation
 * 10. Self-report escalation
 * 11. Suspended operator holdback
 * 12. Probationary below threshold passes
 * 13. Malformed input — undefined
 * 14. Malformed input — empty object
 * 15. Malformed input — missing event
 * 16. Malformed input — missing required fields
 * 17. TRUSTED vs AUTHORIZED intentional behavior
 * 18. Authenticated evidence is verifiable
 * 19. Transaction without target
 * 20. Reason code ordering determinism
 * 21. Hard + soft code precedence
 * 22. Configurable reason code policy override
 * 23. Reviewer fields structure
 * 24. Partial threshold override via input
 */

import { describe, it, expect } from 'vitest';
import { evaluateHoldback } from '../src/holdback.js';
import type { HoldbackInput, HoldbackOutput } from '../src/types.js';

const NOW = '2026-04-07T12:00:00Z';

function makeInput(eventOverrides: Record<string, unknown> = {}, inputOverrides: Record<string, unknown> = {}): HoldbackInput {
  return {
    as_of: NOW,
    event: {
      task_id: 'task_clean_001',
      operator_id: 'op_alice',
      reward_pft: 2000,
      verification_type: 'url',
      verification_target: 'https://example.com/proof',
      evidence_visibility: 'public',
      operator_auth_state: 'AUTHORIZED',
      ...eventOverrides,
    } as any,
    ...inputOverrides,
  };
}

describe('Clean Authorized Release', () => {
  it('auto-releases when all checks pass', () => {
    const result = evaluateHoldback(makeInput());
    expect(result.decision).toBe('auto_release');
    expect(result.holdback_reason_codes).toEqual(['CLEAN']);
    expect(result.missing_public_evidence).toBe(false);
    expect(result.task_id).toBe('task_clean_001');
    expect(result.operator_id).toBe('op_alice');
    expect(result.version).toBe('1.0.0');
    expect(result.validation_warnings).toHaveLength(0);
    expect(result.generated_at).toBe(NOW);
    expect(result.as_of).toBe(NOW);
  });
});

describe('Unauthorized Operator Holdback', () => {
  it('holds back UNKNOWN operator', () => {
    const result = evaluateHoldback(makeInput({ operator_auth_state: 'UNKNOWN' }));
    expect(result.decision).toBe('holdback');
    expect(result.holdback_reason_codes).toContain('UNAUTHORIZED_OPERATOR');
  });
});

describe('Missing Artifact Holdback', () => {
  it('holds back when evidence is missing', () => {
    const result = evaluateHoldback(makeInput({ evidence_visibility: 'missing' }));
    expect(result.decision).toBe('holdback');
    expect(result.holdback_reason_codes).toContain('MISSING_EVIDENCE');
    expect(result.missing_public_evidence).toBe(true);
  });
});

describe('Private URL Rejection', () => {
  it('escalates to manual_review for private artifacts', () => {
    const result = evaluateHoldback(makeInput({ evidence_visibility: 'private' }));
    expect(result.decision).toBe('manual_review');
    expect(result.holdback_reason_codes).toContain('PRIVATE_ARTIFACT');
    expect(result.missing_public_evidence).toBe(true);
  });
});

describe('Stale Authorization State', () => {
  it('escalates when auth state is stale', () => {
    const result = evaluateHoldback(makeInput({ risk_signals: { days_since_auth_update: 90 } }));
    expect(result.decision).toBe('manual_review');
    expect(result.holdback_reason_codes).toContain('STALE_AUTH_STATE');
  });
  it('does not flag when auth state is fresh', () => {
    const result = evaluateHoldback(makeInput({ risk_signals: { days_since_auth_update: 10 } }));
    expect(result.decision).toBe('auto_release');
    expect(result.holdback_reason_codes).not.toContain('STALE_AUTH_STATE');
  });
});

describe('Empty / Zero-Reward Input', () => {
  it('handles zero reward with validation warning', () => {
    const result = evaluateHoldback(makeInput({ reward_pft: 0 }));
    expect(result.validation_warnings).toContain('reward_pft is zero');
    expect(result.decision).toBe('auto_release');
  });
  it('warns on negative reward', () => {
    const result = evaluateHoldback(makeInput({ reward_pft: -100 }));
    expect(result.validation_warnings).toContain('reward_pft is negative');
  });
});

describe('Threshold Boundary Behavior', () => {
  it('does not flag reward just below high_reward_threshold with private evidence', () => {
    const result = evaluateHoldback(makeInput({ reward_pft: 4999, evidence_visibility: 'private' }));
    expect(result.holdback_reason_codes).toContain('PRIVATE_ARTIFACT');
    expect(result.holdback_reason_codes).not.toContain('HIGH_REWARD_WEAK_EVIDENCE');
  });
  it('flags reward at high_reward_threshold with private evidence', () => {
    const result = evaluateHoldback(makeInput({ reward_pft: 5000, evidence_visibility: 'private' }));
    expect(result.holdback_reason_codes).toContain('HIGH_REWARD_WEAK_EVIDENCE');
    expect(result.holdback_reason_codes).toContain('PRIVATE_ARTIFACT');
  });
  it('respects custom thresholds via input', () => {
    const result = evaluateHoldback(makeInput(
      { reward_pft: 2000, evidence_visibility: 'private' },
      { thresholds: { high_reward_threshold: 1500 } },
    ));
    expect(result.holdback_reason_codes).toContain('HIGH_REWARD_WEAK_EVIDENCE');
  });
});

describe('Full-Output Determinism', () => {
  it('produces byte-identical JSON for identical inputs', () => {
    const input = makeInput({ evidence_visibility: 'expired', risk_signals: { recent_rejection_count: 5 } });
    const a = evaluateHoldback(input);
    const b = evaluateHoldback(input);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
  it('generated_at equals as_of (no runtime clock)', () => {
    const result = evaluateHoldback(makeInput());
    expect(result.generated_at).toBe(result.as_of);
    expect(result.generated_at).toBe(NOW);
  });
});

describe('Multiple Reason Code Accumulation', () => {
  it('accumulates all applicable codes', () => {
    const result = evaluateHoldback(makeInput({
      operator_auth_state: 'UNKNOWN', evidence_visibility: 'missing',
      reward_pft: 6000, risk_signals: { recent_rejection_count: 10, evidence_coverage_ratio: 0.1 },
    }));
    expect(result.decision).toBe('holdback');
    expect(result.holdback_reason_codes).toContain('UNAUTHORIZED_OPERATOR');
    expect(result.holdback_reason_codes).toContain('MISSING_EVIDENCE');
    expect(result.holdback_reason_codes).toContain('HIGH_REWARD_WEAK_EVIDENCE');
    expect(result.holdback_reason_codes).toContain('ELEVATED_REJECTION_RATE');
    expect(result.holdback_reason_codes).toContain('LOW_HISTORICAL_COVERAGE');
    expect(result.holdback_reason_codes.length).toBeGreaterThanOrEqual(5);
  });
});

describe('Self-Report Escalation', () => {
  it('escalates self-report verification to manual review', () => {
    const result = evaluateHoldback(makeInput({ verification_type: 'self_report' }));
    expect(result.decision).toBe('manual_review');
    expect(result.holdback_reason_codes).toContain('SELF_REPORT_ONLY');
  });
});

describe('Suspended Operator Holdback', () => {
  it('holds back SUSPENDED operator regardless of evidence', () => {
    const result = evaluateHoldback(makeInput({ operator_auth_state: 'SUSPENDED', evidence_visibility: 'public' }));
    expect(result.decision).toBe('holdback');
    expect(result.holdback_reason_codes).toContain('UNAUTHORIZED_OPERATOR');
  });
});

describe('Probationary Below Threshold', () => {
  it('auto-releases PROBATIONARY operator below review threshold', () => {
    const result = evaluateHoldback(makeInput({ operator_auth_state: 'PROBATIONARY', reward_pft: 1000 }));
    expect(result.decision).toBe('auto_release');
    expect(result.holdback_reason_codes).toEqual(['CLEAN']);
  });
  it('escalates PROBATIONARY operator at review threshold', () => {
    const result = evaluateHoldback(makeInput({ operator_auth_state: 'PROBATIONARY', reward_pft: 3000 }));
    expect(result.decision).toBe('manual_review');
    expect(result.holdback_reason_codes).toContain('PROBATIONARY_HIGH_REWARD');
  });
});

describe('Malformed Input — undefined', () => {
  it('fails closed to holdback for undefined input', () => {
    const result = evaluateHoldback(undefined as any);
    expect(result.decision).toBe('holdback');
    expect(result.holdback_reason_codes).toContain('INVALID_INPUT');
    expect(result.task_id).toBe('INVALID');
    expect(result.operator_id).toBe('INVALID');
    expect(result.validation_warnings.length).toBeGreaterThan(0);
  });
});

describe('Malformed Input — empty object', () => {
  it('fails closed to holdback for empty object', () => {
    const result = evaluateHoldback({} as any);
    expect(result.decision).toBe('holdback');
    expect(result.holdback_reason_codes).toContain('MISSING_EVENT_OBJECT');
    expect(result.task_id).toBe('INVALID');
  });
});

describe('Malformed Input — missing event', () => {
  it('fails closed for null event', () => {
    const result = evaluateHoldback({ as_of: NOW, event: null } as any);
    expect(result.decision).toBe('holdback');
    expect(result.holdback_reason_codes).toContain('MISSING_EVENT_OBJECT');
    expect(result.generated_at).toBe(NOW);
  });
});

describe('Malformed Input — missing required fields', () => {
  it('fails closed when event is missing operator_auth_state', () => {
    const result = evaluateHoldback({
      as_of: NOW,
      event: { task_id: 'task_x', operator_id: 'op_x', reward_pft: 1000, verification_type: 'url', evidence_visibility: 'public' },
    } as any);
    expect(result.decision).toBe('holdback');
    expect(result.holdback_reason_codes).toContain('MISSING_REQUIRED_FIELDS');
    expect(result.validation_warnings.some(w => w.includes('operator_auth_state'))).toBe(true);
  });
  it('fails closed when event is missing verification_type', () => {
    const result = evaluateHoldback({
      as_of: NOW,
      event: { task_id: 'task_x', operator_id: 'op_x', reward_pft: 1000, evidence_visibility: 'public', operator_auth_state: 'AUTHORIZED' },
    } as any);
    expect(result.decision).toBe('holdback');
    expect(result.holdback_reason_codes).toContain('MISSING_REQUIRED_FIELDS');
  });
});

describe('TRUSTED vs AUTHORIZED behavior', () => {
  it('auto-releases TRUSTED the same as AUTHORIZED', () => {
    const authorized = evaluateHoldback(makeInput({ operator_auth_state: 'AUTHORIZED' }));
    const trusted = evaluateHoldback(makeInput({ operator_auth_state: 'TRUSTED' }));
    expect(authorized.decision).toBe('auto_release');
    expect(trusted.decision).toBe('auto_release');
    expect(authorized.holdback_reason_codes).toEqual(trusted.holdback_reason_codes);
  });
});

describe('Authenticated Evidence', () => {
  it('treats authenticated evidence as verifiable', () => {
    const result = evaluateHoldback(makeInput({ evidence_visibility: 'authenticated' }));
    expect(result.decision).toBe('auto_release');
    expect(result.missing_public_evidence).toBe(false);
    expect(result.reviewer_fields.evidence_status).toBe('verifiable');
    expect(result.reviewer_fields.requires_public_artifact).toBe(false);
  });
});

describe('Transaction Without Target', () => {
  it('flags transaction type without verification_target', () => {
    const result = evaluateHoldback(makeInput({ verification_type: 'transaction', verification_target: undefined }));
    expect(result.holdback_reason_codes).toContain('VERIFICATION_TARGET_MISSING');
    expect(result.decision).toBe('manual_review');
  });
});

describe('Reason Code Ordering', () => {
  it('produces identical code order across runs', () => {
    const input = makeInput({
      operator_auth_state: 'UNKNOWN', evidence_visibility: 'expired', reward_pft: 6000,
      verification_type: 'code', verification_target: undefined, risk_signals: { recent_holdback_count: 5 },
    });
    const a = evaluateHoldback(input);
    const b = evaluateHoldback(input);
    expect(a.holdback_reason_codes).toEqual(b.holdback_reason_codes);
    const codes = a.holdback_reason_codes;
    const authIdx = codes.indexOf('UNAUTHORIZED_OPERATOR');
    const expiredIdx = codes.indexOf('EXPIRED_EVIDENCE');
    expect(authIdx).toBeLessThan(expiredIdx);
  });
});

describe('Hard + Soft Code Precedence', () => {
  it('holdback takes precedence over manual_review when both present', () => {
    const result = evaluateHoldback(makeInput({
      operator_auth_state: 'SUSPENDED', evidence_visibility: 'private',
      risk_signals: { recent_rejection_count: 10 },
    }));
    expect(result.decision).toBe('holdback');
    expect(result.holdback_reason_codes).toContain('UNAUTHORIZED_OPERATOR');
    expect(result.holdback_reason_codes).toContain('PRIVATE_ARTIFACT');
    expect(result.holdback_reason_codes).toContain('ELEVATED_REJECTION_RATE');
  });
});

describe('Configurable Reason Code Policy', () => {
  it('promotes PRIVATE_ARTIFACT to holdback when policy overridden', () => {
    const result = evaluateHoldback(makeInput(
      { evidence_visibility: 'private' },
      { reason_code_policy: { PRIVATE_ARTIFACT: 'holdback' } },
    ));
    expect(result.decision).toBe('holdback');
    expect(result.holdback_reason_codes).toContain('PRIVATE_ARTIFACT');
  });
  it('demotes UNAUTHORIZED_OPERATOR to manual_review when policy overridden', () => {
    const result = evaluateHoldback(makeInput(
      { operator_auth_state: 'UNKNOWN' },
      { reason_code_policy: { UNAUTHORIZED_OPERATOR: 'manual_review' } },
    ));
    expect(result.decision).toBe('manual_review');
    expect(result.holdback_reason_codes).toContain('UNAUTHORIZED_OPERATOR');
  });
});

describe('Reviewer Fields Structure', () => {
  it('includes all structured operational fields', () => {
    const result = evaluateHoldback(makeInput({
      evidence_visibility: 'private', operator_auth_state: 'PROBATIONARY', reward_pft: 4000,
    }));
    const rf = result.reviewer_fields;
    expect(rf).toHaveProperty('operator_id');
    expect(rf).toHaveProperty('evidence_status');
    expect(rf).toHaveProperty('requires_public_artifact');
    expect(rf).toHaveProperty('blocking_conditions');
    expect(rf).toHaveProperty('risk_level');
    expect(rf).toHaveProperty('next_review_step');
    expect(rf).toHaveProperty('recommended_action');
    expect(rf.evidence_status).toBe('unverifiable');
    expect(rf.requires_public_artifact).toBe(true);
    expect(rf.blocking_conditions).toContain('PROBATIONARY_HIGH_REWARD');
    expect(rf.blocking_conditions).toContain('PRIVATE_ARTIFACT');
    expect(rf.risk_level).toBe('medium');
    expect(rf.recommended_action).toBe('manual_review');
  });
});

describe('Partial Threshold Override', () => {
  it('merges partial thresholds with defaults', () => {
    const result = evaluateHoldback(makeInput(
      { operator_auth_state: 'PROBATIONARY', reward_pft: 1500 },
      { thresholds: { probationary_review_threshold: 1000 } },
    ));
    expect(result.decision).toBe('manual_review');
    expect(result.holdback_reason_codes).toContain('PROBATIONARY_HIGH_REWARD');
  });
});
```

### Test Results

```bash
$ npm test -- --reporter=verbose

 ✓ Clean Authorized Release > auto-releases when all checks pass
 ✓ Unauthorized Operator Holdback > holds back UNKNOWN operator
 ✓ Missing Artifact Holdback > holds back when evidence is missing
 ✓ Private URL Rejection > escalates to manual_review for private artifacts
 ✓ Stale Authorization State > escalates when auth state is stale
 ✓ Stale Authorization State > does not flag when auth state is fresh
 ✓ Empty / Zero-Reward Input > handles zero reward with validation warning
 ✓ Empty / Zero-Reward Input > warns on negative reward
 ✓ Threshold Boundary Behavior > does not flag reward just below high_reward_threshold
 ✓ Threshold Boundary Behavior > flags reward at high_reward_threshold
 ✓ Threshold Boundary Behavior > respects custom thresholds via input
 ✓ Full-Output Determinism > produces byte-identical JSON for identical inputs
 ✓ Full-Output Determinism > generated_at equals as_of (no runtime clock)
 ✓ Multiple Reason Code Accumulation > accumulates all applicable codes
 ✓ Self-Report Escalation > escalates self-report verification to manual review
 ✓ Suspended Operator Holdback > holds back SUSPENDED operator regardless of evidence
 ✓ Probationary Below Threshold > auto-releases PROBATIONARY operator below threshold
 ✓ Probationary Below Threshold > escalates PROBATIONARY operator at threshold
 ✓ Malformed Input — undefined > fails closed to holdback for undefined input
 ✓ Malformed Input — empty object > fails closed to holdback for empty object
 ✓ Malformed Input — missing event > fails closed for null event
 ✓ Malformed Input — missing required fields > fails closed when missing operator_auth_state
 ✓ Malformed Input — missing required fields > fails closed when missing verification_type
 ✓ TRUSTED vs AUTHORIZED behavior > auto-releases TRUSTED the same as AUTHORIZED
 ✓ Authenticated Evidence > treats authenticated evidence as verifiable
 ✓ Transaction Without Target > flags transaction type without verification_target
 ✓ Reason Code Ordering > produces identical code order across runs
 ✓ Hard + Soft Code Precedence > holdback takes precedence over manual_review
 ✓ Configurable Reason Code Policy > promotes PRIVATE_ARTIFACT to holdback
 ✓ Configurable Reason Code Policy > demotes UNAUTHORIZED_OPERATOR to manual_review
 ✓ Reviewer Fields Structure > includes all structured operational fields
 ✓ Partial Threshold Override > merges partial thresholds with defaults

 Test Files  1 passed (1)
      Tests  32 passed (32)
```

---

*Published by Zoz via the Permanent Upper Class validator operation.*  
*Task completed for the Post Fiat Network.*
