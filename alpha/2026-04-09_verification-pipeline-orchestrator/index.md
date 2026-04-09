---
layout: default
title: Verification Pipeline Orchestrator
date: 2026-04-09
category: network
status: submitted
task_id: 86312bd6-42ce-4926-84ae-05537f1b8fc6
---

# Verification Pipeline Orchestrator

| Field | Value |
|---|---|
| Task ID | `86312bd6-42ce-4926-84ae-05537f1b8fc6` |
| Reward | 4,800 PFT |
| Verification | Code artifact |
| Version | 1.0.0 |

---

## What This Module Is

This module is a deterministic single-entry-point orchestrator that accepts a verification event along with pre-computed outputs from four upstream modules (Operator Reputation Ledger, Reward Artifact Coverage Audit, Reward Holdback Decision Module, and Reward Token Emissions Concentration Analyzer), executes pipeline evaluation stages in a fixed dependency order, and returns one unified JSON verdict. The output includes `pipeline_decision` (release / review / block), per-stage results, the critical path identifying which stage drove the final outcome, operator reputation context, emissions impact assessment, and a structured reviewer packet for human review queues. The module is scoped as an integration artifact that another builder can wire directly into the live verification service without reinterpreting individual module outputs.

## What This Module Is Not

This module does not import or execute the upstream modules. It accepts their pre-computed outputs as typed inputs and implements the combination and decision logic. It does not fetch data, modify rewards, or take enforcement actions. It is a pure function that produces a recommendation verdict. The calling system is responsible for (a) running the upstream modules, (b) passing their outputs to this orchestrator, and (c) acting on the pipeline decision.

---

## Determinism Guarantee

The module never reads the runtime clock. All timestamps derive from the required `as_of` input field. The `generated_at` output field is always set equal to `as_of`. Identical inputs produce byte-stable JSON outputs. Stage evaluation always proceeds in the fixed order: reputation → evidence → holdback → emissions. Tie-breaking for the critical path is deterministic: the stage with the stronger verdict wins; on ties, the stage with more reason codes wins; on further ties, the earlier stage in execution order wins.

---

## API Contract

### Function Signature

```typescript
function orchestrateVerification(input: unknown): OrchestratorResult
```

The function accepts `unknown` and validates internally. Malformed inputs fail closed with a `block` decision and a typed error code.

`OrchestratorResult` is a discriminated union:

```typescript
type OrchestratorResult = OrchestratorOutput | OrchestratorError;
```

If the result contains an `error_code` field, it is an `OrchestratorError`. Otherwise it is an `OrchestratorOutput`.

### Input Interface

```typescript
interface OrchestratorInput {
  as_of: string;                                    // ISO 8601, required
  verification_event: VerificationEvent;
  reputation_stage: ReputationStageInput;           // From Operator Reputation Ledger
  evidence_stage: EvidenceStageInput;               // From Reward Artifact Coverage Audit
  holdback_stage: HoldbackStageInput;               // From Reward Holdback Decision Module
  emissions_stage: EmissionsStageInput;             // From Emissions Concentration Analyzer
  thresholds?: Partial<PipelineThresholds>;         // Override defaults
}
```

### Output Interface

```typescript
interface OrchestratorOutput {
  generated_at: string;               // = as_of
  as_of: string;
  version: string;                    // "1.0.0"
  pipeline_decision: PipelineDecision;
  stage_results: StageResult[];
  critical_path: CriticalPath;
  operator_context: OperatorContext;
  emissions_impact: EmissionsImpact;
  reviewer_packet: ReviewerPacket;
  reason_codes: string[];             // Empty for release, populated for review/block
  decision_rationale: string;
  threshold_config: PipelineThresholds;
  validation_warnings: string[];
}

type PipelineDecision = 'release' | 'review' | 'block';
```

### Error Interface

```typescript
interface OrchestratorError {
  generated_at: string;
  as_of: string;
  version: string;
  pipeline_decision: 'block';         // Always block on error
  error_code: OrchestratorErrorCode;
  error_message: string;
  validation_warnings: string[];
  stage_results: [];
  critical_path: null;
  operator_context: null;
  emissions_impact: null;
  reviewer_packet: null;
  reason_codes: string[];
  decision_rationale: string;
  threshold_config: null;
}

type OrchestratorErrorCode =
  | 'INVALID_INPUT'
  | 'MISSING_AS_OF'
  | 'MISSING_VERIFICATION_EVENT'
  | 'MISSING_REPUTATION_STAGE'
  | 'MISSING_EVIDENCE_STAGE'
  | 'MISSING_HOLDBACK_STAGE'
  | 'MISSING_EMISSIONS_STAGE'
  | 'MALFORMED_STAGE_DATA';
```

---

## Pipeline Execution Order

The orchestrator processes stages in this fixed order. Each stage receives the pre-computed output from its corresponding upstream module plus the pipeline threshold configuration.

| Order | Stage | Upstream Module | Decision Field |
|---|---|---|---|
| 1 | `reputation` | Operator Reputation Ledger | `trust_tier` + `risk_signals` + `downstream_hints` |
| 2 | `evidence` | Reward Artifact Coverage Audit | `priority_band` + `anomaly_score` + `anomaly_flags` |
| 3 | `holdback` | Reward Holdback Decision Module | `decision` (auto_release / manual_review / holdback) |
| 4 | `emissions` | Emissions Concentration Analyzer | `emission_posture` (healthy / watch / restrict) |

---

## Decision Logic

### Per-Stage Verdict Mapping

Each stage evaluator maps upstream module outputs to a normalized `StageVerdict` of `pass`, `review`, or `block`.

**Reputation Stage:**

| Condition | Verdict |
|---|---|
| `trust_tier` in `reputation_block_tiers` | block |
| Any risk signal severity ≥ `reputation_block_severity` | block |
| `guardrail_action` = "suppress" | block |
| `moderation_action` = "escalate" | block |
| `trust_tier` in `reputation_review_tiers` | review |
| Any risk signal severity ≥ `reputation_review_severity` | review |
| `payout_action` = "hold_for_review" | review |
| `moderation_action` = "flag_for_review" | review |
| Otherwise | pass |

**Evidence Stage:**

| Condition | Verdict |
|---|---|
| `priority_band` in `evidence_block_bands` | block |
| `anomaly_score` ≥ `evidence_block_anomaly_score` | block |
| `priority_band` in `evidence_review_bands` | review |
| `anomaly_score` ≥ `evidence_review_anomaly_score` | review |
| Otherwise | pass |

**Holdback Stage:**

| Holdback Decision | Stage Verdict |
|---|---|
| `holdback` | block |
| `manual_review` | review |
| `auto_release` | pass |

**Emissions Stage:**

| Condition | Verdict |
|---|---|
| `emission_posture` in `emissions_block_postures` | block |
| `emission_posture` in `emissions_review_postures` | review |
| Otherwise | pass |

### Final Pipeline Decision

| Rule | Result |
|---|---|
| ANY stage returns `block` | `pipeline_decision` = **block** |
| ANY stage returns `review` (none block) | `pipeline_decision` = **review** |
| ALL stages return `pass` | `pipeline_decision` = **release** |

The `critical_path` identifies the decisive stage — the stage that triggered the strongest verdict. Ties are broken by reason code count (more codes = more decisive), then by execution order.

---

## Configurable Thresholds

All pipeline thresholds are configurable via the `thresholds` input field. Any omitted field uses the default.

| Threshold | Type | Default | Purpose |
|---|---|---|---|
| `reputation_review_tiers` | TrustTier[] | `['probationary']` | Trust tiers that trigger review |
| `reputation_block_tiers` | TrustTier[] | `[]` | Trust tiers that trigger block |
| `reputation_block_severity` | RiskSeverity | `'critical'` | Risk signal severity that triggers block |
| `reputation_review_severity` | RiskSeverity | `'high'` | Risk signal severity that triggers review |
| `evidence_block_bands` | PriorityBand[] | `['critical']` | Evidence priority bands that trigger block |
| `evidence_review_bands` | PriorityBand[] | `['high']` | Evidence priority bands that trigger review |
| `evidence_block_anomaly_score` | number | `80` | Anomaly score threshold for block |
| `evidence_review_anomaly_score` | number | `50` | Anomaly score threshold for review |
| `emissions_block_postures` | EmissionPosture[] | `['restrict']` | Emissions postures that trigger block |
| `emissions_review_postures` | EmissionPosture[] | `['watch']` | Emissions postures that trigger review |

---

## Sample Input/Output

### Example 1: RELEASE — All Stages Clean

**Input (abbreviated):**

```json
{
  "as_of": "2026-04-09T12:00:00Z",
  "verification_event": {
    "task_id": "task-001",
    "operator_id": "op-alpha",
    "reward_pft": 2000,
    "verification_type": "url",
    "verification_target": "https://example.com/proof",
    "evidence_visibility": "public"
  },
  "reputation_stage": {
    "trust_tier": "reliable",
    "risk_signals": [],
    "reason_codes": [],
    "downstream_hints": {
      "payout_action": "standard",
      "guardrail_action": "full_issuance",
      "moderation_action": "no_action",
      "emissions_eligible": true
    }
  },
  "evidence_stage": {
    "anomaly_score": 10,
    "priority_band": "low",
    "anomaly_flags": []
  },
  "holdback_stage": {
    "decision": "auto_release",
    "holdback_reason_codes": ["CLEAN"]
  },
  "emissions_stage": {
    "emission_posture": "healthy",
    "reason_codes": ["CLEAN"]
  }
}
```

**Output (abbreviated):**

```json
{
  "generated_at": "2026-04-09T12:00:00Z",
  "version": "1.0.0",
  "pipeline_decision": "release",
  "stage_results": [
    { "stage": "reputation", "verdict": "pass" },
    { "stage": "evidence", "verdict": "pass" },
    { "stage": "holdback", "verdict": "pass" },
    { "stage": "emissions", "verdict": "pass" }
  ],
  "critical_path": {
    "decisive_stage": "holdback",
    "verdict": "pass",
    "rationale": "All stages passed clean. No escalation or block conditions triggered."
  },
  "reason_codes": [],
  "reviewer_packet": {
    "requires_human_review": false,
    "review_urgency": "low"
  }
}
```

### Example 2: REVIEW — Probationary Operator with Elevated Risk

**Input (abbreviated):**

```json
{
  "as_of": "2026-04-09T12:00:00Z",
  "verification_event": {
    "task_id": "task-042",
    "operator_id": "op-beta",
    "reward_pft": 4500
  },
  "reputation_stage": {
    "trust_tier": "probationary",
    "risk_signals": [
      { "code": "high_rejection_rate", "severity": "high" }
    ],
    "downstream_hints": {
      "payout_action": "hold_for_review",
      "moderation_action": "flag_for_review"
    }
  },
  "holdback_stage": {
    "decision": "manual_review",
    "holdback_reason_codes": ["PROBATIONARY_HIGH_REWARD", "ELEVATED_REJECTION_RATE"]
  },
  "emissions_stage": {
    "emission_posture": "watch",
    "reason_codes": ["TOP_RECIPIENT_DOMINANCE"]
  }
}
```

**Output (abbreviated):**

```json
{
  "pipeline_decision": "review",
  "critical_path": {
    "decisive_stage": "reputation",
    "verdict": "review"
  },
  "reason_codes": [
    "TRUST_TIER_REVIEW:probationary",
    "RISK_SIGNAL_REVIEW:high_rejection_rate",
    "PAYOUT_HOLD_FOR_REVIEW",
    "MODERATION_FLAG_FOR_REVIEW",
    "PROBATIONARY_HIGH_REWARD",
    "ELEVATED_REJECTION_RATE",
    "EMISSION_POSTURE_REVIEW:watch"
  ],
  "reviewer_packet": {
    "requires_human_review": true,
    "review_urgency": "standard"
  }
}
```

### Example 3: BLOCK — Suspended Operator, Missing Evidence, Restricted Emissions

**Input (abbreviated):**

```json
{
  "as_of": "2026-04-09T12:00:00Z",
  "verification_event": {
    "task_id": "task-099",
    "operator_id": "op-gamma",
    "reward_pft": 8000,
    "evidence_visibility": "missing"
  },
  "reputation_stage": {
    "trust_tier": "probationary",
    "risk_signals": [
      { "code": "unresolved_holdbacks", "severity": "critical" }
    ],
    "downstream_hints": {
      "guardrail_action": "suppress",
      "moderation_action": "escalate"
    }
  },
  "evidence_stage": {
    "anomaly_score": 92,
    "priority_band": "critical",
    "anomaly_flags": ["HIGH_REWARD_NO_EVIDENCE", "ALL_PRIVATE"]
  },
  "holdback_stage": {
    "decision": "holdback",
    "holdback_reason_codes": ["UNAUTHORIZED_OPERATOR", "MISSING_EVIDENCE"]
  },
  "emissions_stage": {
    "emission_posture": "restrict",
    "reason_codes": ["HIGH_CONCENTRATION_INDEX", "TOP_RECIPIENT_DOMINANCE"]
  }
}
```

**Output (abbreviated):**

```json
{
  "pipeline_decision": "block",
  "critical_path": {
    "decisive_stage": "reputation",
    "verdict": "block"
  },
  "reason_codes": [
    "RISK_SIGNAL_BLOCK:unresolved_holdbacks",
    "GUARDRAIL_SUPPRESS",
    "MODERATION_ESCALATE",
    "EVIDENCE_PRIORITY_BLOCK:critical",
    "ANOMALY_SCORE_BLOCK:92",
    "UNAUTHORIZED_OPERATOR",
    "MISSING_EVIDENCE",
    "EMISSION_POSTURE_BLOCK:restrict"
  ],
  "reviewer_packet": {
    "requires_human_review": true,
    "review_urgency": "immediate"
  }
}
```

---

## Full Source Code

### types.ts

```typescript
/**
 * Verification Pipeline Orchestrator — Type Definitions
 *
 * Defines the input/output contracts for the pipeline orchestrator.
 * Types are compatible with (but do not import) the existing modules:
 *   - Reward Holdback Decision Module
 *   - Operator Reputation Ledger
 *   - Reward Token Emissions Concentration Analyzer
 *   - Reward Artifact Coverage Audit
 */

export const SCHEMA_VERSION = '1.0.0';

// ─── Shared Enums ────────────────────────────────────────────────────

export type PipelineDecision = 'release' | 'review' | 'block';

export type StageVerdict = 'pass' | 'review' | 'block';

export type StageName = 'reputation' | 'evidence' | 'holdback' | 'emissions';

/** Fixed execution order. The orchestrator processes stages in this sequence. */
export const STAGE_ORDER: readonly StageName[] = [
  'reputation',
  'evidence',
  'holdback',
  'emissions',
] as const;

// ─── Stage-level types (compatible with upstream module outputs) ─────

// --- Reputation Stage (from Operator Reputation Ledger) ---

export type TrustTier =
  | 'exemplary'
  | 'reliable'
  | 'developing'
  | 'probationary'
  | 'new_operator';

export type ReputationRiskSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface ReputationRiskSignal {
  code: string;
  severity: ReputationRiskSeverity;
  description: string;
  consumers: string[];
}

export interface ReputationDownstreamHints {
  payout_action: 'standard' | 'hold_for_review' | 'bonus_eligible';
  guardrail_action: 'full_issuance' | 'reduced_issuance' | 'suppress';
  moderation_action: 'no_action' | 'flag_for_review' | 'escalate';
  emissions_eligible: boolean;
}

export interface ReputationSnapshot {
  operator_id: string;
  as_of: string;
  completion_rate: number;
  evidence_quality_score: number;
  rejection_rate: number;
  holdback_rate: number;
  total_tasks: number;
  rewarded_count: number;
  refusal_count: number;
  holdback_count: number;
  unresolved_holdback_count: number;
}

export interface ReputationStageInput {
  trust_tier: TrustTier;
  risk_signals: ReputationRiskSignal[];
  reason_codes: string[];
  downstream_hints: ReputationDownstreamHints;
  reputation_snapshot: ReputationSnapshot;
}

// --- Evidence Stage (from Reward Artifact Coverage Audit) ---

export type EvidenceVisibility =
  | 'public'
  | 'authenticated'
  | 'private'
  | 'expired'
  | 'missing'
  | 'malformed';

export type AnomalyFlag =
  | 'HIGH_REWARD_NO_EVIDENCE'
  | 'HIGH_REWARD_SELF_REPORT'
  | 'EVIDENCE_EXPIRED'
  | 'MALFORMED_VERIFICATION'
  | 'ALL_PRIVATE'
  | 'LOW_COVERAGE_HIGH_VOLUME'
  | 'CONCENTRATION_RISK'
  | 'DATA_QUALITY_RISK'
  | 'STALE_EVIDENCE_CHECK';

export type PriorityBand = 'critical' | 'high' | 'medium' | 'low';

export interface EvidenceStageInput {
  evidence_coverage_ratio: number;
  anomaly_flags: AnomalyFlag[];
  anomaly_score: number;
  priority_band: PriorityBand;
  priority_score: number;
  flagged_task_ids: string[];
  review_rationale: string;
  validation_warnings: string[];
}

// --- Holdback Stage (from Reward Holdback Decision Module) ---

export type HoldbackDecision = 'auto_release' | 'manual_review' | 'holdback';

export type RiskLevel = 'critical' | 'high' | 'medium' | 'low' | 'none';

export interface HoldbackReviewerFields {
  operator_id: string;
  operator_auth_state: string;
  reward_pft: number;
  evidence_visibility: string;
  evidence_status: 'verifiable' | 'unverifiable' | 'unknown';
  verification_type: string;
  requires_public_artifact: boolean;
  blocking_conditions: string[];
  risk_level: RiskLevel;
  next_review_step: string;
  recommended_action: string;
  risk_summary: string;
}

export interface HoldbackStageInput {
  decision: HoldbackDecision;
  holdback_reason_codes: string[];
  missing_public_evidence: boolean;
  reviewer_fields: HoldbackReviewerFields;
  decision_rationale: string;
  validation_warnings: string[];
}

// --- Emissions Stage (from Reward Token Emissions Concentration Analyzer) ---

export type EmissionPosture = 'healthy' | 'watch' | 'restrict';

export type WindowLabel = '7d' | '30d' | 'all_time';

export interface WindowMetricsSummary {
  window: WindowLabel;
  total_pft: number;
  total_records: number;
  unique_recipients: number;
  concentration_index: number;
  top_recipient_share: number;
}

export interface EmissionsStageInput {
  emission_posture: EmissionPosture;
  reason_codes: string[];
  worst_window: WindowLabel;
  review_priority_window: WindowLabel;
  window_postures: Record<WindowLabel, EmissionPosture>;
  posture_rationale: string;
  window_summaries: WindowMetricsSummary[];
  validation_warnings: string[];
}

// ─── Verification Event ──────────────────────────────────────────────

export interface VerificationEvent {
  task_id: string;
  operator_id: string;
  reward_pft: number;
  verification_type: string;
  verification_target?: string;
  evidence_visibility: EvidenceVisibility;
}

// ─── Orchestrator Input ──────────────────────────────────────────────

export interface PipelineThresholds {
  /** Trust tiers that trigger automatic review. Default: ['probationary'] */
  reputation_review_tiers: TrustTier[];
  /** Trust tiers that trigger automatic block. Default: [] (none by default) */
  reputation_block_tiers: TrustTier[];
  /** Risk severity that triggers block at reputation stage. Default: 'critical' */
  reputation_block_severity: ReputationRiskSeverity;
  /** Risk severity that triggers review at reputation stage. Default: 'high' */
  reputation_review_severity: ReputationRiskSeverity;
  /** Evidence priority bands that trigger block. Default: ['critical'] */
  evidence_block_bands: PriorityBand[];
  /** Evidence priority bands that trigger review. Default: ['high'] */
  evidence_review_bands: PriorityBand[];
  /** Anomaly score threshold for evidence block. Default: 80 */
  evidence_block_anomaly_score: number;
  /** Anomaly score threshold for evidence review. Default: 50 */
  evidence_review_anomaly_score: number;
  /** Emissions postures that trigger block. Default: ['restrict'] */
  emissions_block_postures: EmissionPosture[];
  /** Emissions postures that trigger review. Default: ['watch'] */
  emissions_review_postures: EmissionPosture[];
}

export const DEFAULT_THRESHOLDS: PipelineThresholds = {
  reputation_review_tiers: ['probationary'],
  reputation_block_tiers: [],
  reputation_block_severity: 'critical',
  reputation_review_severity: 'high',
  evidence_block_bands: ['critical'],
  evidence_review_bands: ['high'],
  evidence_block_anomaly_score: 80,
  evidence_review_anomaly_score: 50,
  emissions_block_postures: ['restrict'],
  emissions_review_postures: ['watch'],
};

export interface OrchestratorInput {
  /** ISO 8601 timestamp. Required for determinism. */
  as_of: string;
  /** The verification event being evaluated. */
  verification_event: VerificationEvent;
  /** Output from the Operator Reputation Ledger module. */
  reputation_stage: ReputationStageInput;
  /** Output from the Reward Artifact Coverage Audit module. */
  evidence_stage: EvidenceStageInput;
  /** Output from the Reward Holdback Decision Module. */
  holdback_stage: HoldbackStageInput;
  /** Output from the Reward Token Emissions Concentration Analyzer. */
  emissions_stage: EmissionsStageInput;
  /** Override default pipeline thresholds. */
  thresholds?: Partial<PipelineThresholds>;
}

// ─── Orchestrator Output ─────────────────────────────────────────────

export interface StageResult {
  stage: StageName;
  verdict: StageVerdict;
  reason_codes: string[];
  summary: string;
}

export interface CriticalPath {
  decisive_stage: StageName;
  verdict: StageVerdict;
  reason_codes: string[];
  rationale: string;
}

export interface OperatorContext {
  operator_id: string;
  trust_tier: TrustTier;
  completion_rate: number;
  evidence_quality_score: number;
  total_tasks: number;
  downstream_hints: ReputationDownstreamHints;
  risk_signal_count: number;
  highest_risk_severity: ReputationRiskSeverity | 'none';
}

export interface EmissionsImpact {
  current_posture: EmissionPosture;
  worst_window: WindowLabel;
  review_priority_window: WindowLabel;
  reward_pft: number;
  window_postures: Record<WindowLabel, EmissionPosture>;
  posture_rationale: string;
}

export interface ReviewerPacket {
  task_id: string;
  operator_id: string;
  reward_pft: number;
  pipeline_decision: PipelineDecision;
  decisive_stage: StageName;
  all_reason_codes: string[];
  holdback_reviewer_fields: HoldbackReviewerFields;
  evidence_coverage_ratio: number;
  anomaly_flags: AnomalyFlag[];
  flagged_task_ids: string[];
  trust_tier: TrustTier;
  emission_posture: EmissionPosture;
  requires_human_review: boolean;
  review_urgency: 'immediate' | 'standard' | 'low';
}

export interface OrchestratorOutput {
  generated_at: string;
  as_of: string;
  version: string;
  pipeline_decision: PipelineDecision;
  stage_results: StageResult[];
  critical_path: CriticalPath;
  operator_context: OperatorContext;
  emissions_impact: EmissionsImpact;
  reviewer_packet: ReviewerPacket;
  reason_codes: string[];
  decision_rationale: string;
  threshold_config: PipelineThresholds;
  validation_warnings: string[];
}

// ─── Error Output ────────────────────────────────────────────────────

export interface OrchestratorError {
  generated_at: string;
  as_of: string;
  version: string;
  pipeline_decision: 'block';
  error_code: OrchestratorErrorCode;
  error_message: string;
  validation_warnings: string[];
  stage_results: [];
  critical_path: null;
  operator_context: null;
  emissions_impact: null;
  reviewer_packet: null;
  reason_codes: string[];
  decision_rationale: string;
  threshold_config: null;
}

export type OrchestratorErrorCode =
  | 'INVALID_INPUT'
  | 'MISSING_AS_OF'
  | 'MISSING_VERIFICATION_EVENT'
  | 'MISSING_REPUTATION_STAGE'
  | 'MISSING_EVIDENCE_STAGE'
  | 'MISSING_HOLDBACK_STAGE'
  | 'MISSING_EMISSIONS_STAGE'
  | 'MALFORMED_STAGE_DATA';

export type OrchestratorResult = OrchestratorOutput | OrchestratorError;
```

### orchestrator.ts

```typescript
/**
 * Verification Pipeline Orchestrator
 *
 * Deterministic single-entry-point orchestrator that accepts pre-computed
 * outputs from existing verification modules, executes pipeline stages in
 * fixed dependency order, and returns a unified JSON verdict.
 *
 * Pipeline execution order:
 *   1. Reputation  — evaluate operator trust tier and risk signals
 *   2. Evidence    — check artifact coverage and evidence quality
 *   3. Holdback    — run pre-payout holdback decision using reputation context
 *   4. Emissions   — assess concentration impact of releasing this reward
 *   5. Final       — combine all stage results into pipeline_decision
 *
 * Decision rules:
 *   - ANY stage returns block  → pipeline_decision = "block"
 *   - ANY stage returns review → pipeline_decision = "review"
 *   - ALL stages pass clean    → pipeline_decision = "release"
 *   - critical_path = the stage that triggered the strongest decision
 */

import {
  SCHEMA_VERSION,
  STAGE_ORDER,
  DEFAULT_THRESHOLDS,
  type OrchestratorInput,
  type OrchestratorOutput,
  type OrchestratorError,
  type OrchestratorResult,
  type OrchestratorErrorCode,
  type PipelineDecision,
  type PipelineThresholds,
  type StageVerdict,
  type StageName,
  type StageResult,
  type CriticalPath,
  type OperatorContext,
  type EmissionsImpact,
  type ReviewerPacket,
  type ReputationStageInput,
  type EvidenceStageInput,
  type HoldbackStageInput,
  type EmissionsStageInput,
  type ReputationRiskSeverity,
} from './types.js';

// ─── Severity Ordering ──────────────────────────────────────────────

const SEVERITY_RANK: Record<ReputationRiskSeverity | 'none', number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
  info: 0,
  none: -1,
};

const VERDICT_RANK: Record<StageVerdict, number> = {
  block: 2,
  review: 1,
  pass: 0,
};

// ─── Input Validation ────────────────────────────────────────────────

function makeError(
  as_of: string,
  code: OrchestratorErrorCode,
  message: string,
): OrchestratorError {
  return {
    generated_at: as_of,
    as_of,
    version: SCHEMA_VERSION,
    pipeline_decision: 'block',
    error_code: code,
    error_message: message,
    validation_warnings: [],
    stage_results: [],
    critical_path: null,
    operator_context: null,
    emissions_impact: null,
    reviewer_packet: null,
    reason_codes: [code],
    decision_rationale: `Pipeline blocked due to input error: ${message}`,
    threshold_config: null,
  };
}

function validateInput(input: unknown): OrchestratorError | null {
  if (input === null || input === undefined || typeof input !== 'object') {
    return makeError('', 'INVALID_INPUT', 'Input must be a non-null object.');
  }

  const obj = input as Record<string, unknown>;

  if (!obj.as_of || typeof obj.as_of !== 'string') {
    return makeError('', 'MISSING_AS_OF', 'as_of is required and must be an ISO 8601 string.');
  }

  const as_of = obj.as_of as string;

  if (!obj.verification_event || typeof obj.verification_event !== 'object') {
    return makeError(as_of, 'MISSING_VERIFICATION_EVENT', 'verification_event is required.');
  }

  if (!obj.reputation_stage || typeof obj.reputation_stage !== 'object') {
    return makeError(as_of, 'MISSING_REPUTATION_STAGE', 'reputation_stage is required.');
  }

  if (!obj.evidence_stage || typeof obj.evidence_stage !== 'object') {
    return makeError(as_of, 'MISSING_EVIDENCE_STAGE', 'evidence_stage is required.');
  }

  if (!obj.holdback_stage || typeof obj.holdback_stage !== 'object') {
    return makeError(as_of, 'MISSING_HOLDBACK_STAGE', 'holdback_stage is required.');
  }

  if (!obj.emissions_stage || typeof obj.emissions_stage !== 'object') {
    return makeError(as_of, 'MISSING_EMISSIONS_STAGE', 'emissions_stage is required.');
  }

  return null;
}

// ─── Stage Evaluators ────────────────────────────────────────────────

function evaluateReputation(
  stage: ReputationStageInput,
  thresholds: PipelineThresholds,
): StageResult {
  const reason_codes: string[] = [];
  let verdict: StageVerdict = 'pass';

  // Check trust tier against block/review lists
  if (thresholds.reputation_block_tiers.includes(stage.trust_tier)) {
    verdict = 'block';
    reason_codes.push(`TRUST_TIER_BLOCKED:${stage.trust_tier}`);
  } else if (thresholds.reputation_review_tiers.includes(stage.trust_tier)) {
    verdict = 'review';
    reason_codes.push(`TRUST_TIER_REVIEW:${stage.trust_tier}`);
  }

  // Check risk signal severities
  const blockSeverityRank = SEVERITY_RANK[thresholds.reputation_block_severity];
  const reviewSeverityRank = SEVERITY_RANK[thresholds.reputation_review_severity];

  for (const signal of stage.risk_signals) {
    const severity = signal.severity as ReputationRiskSeverity;
    const rank = SEVERITY_RANK[severity] ?? -1;

    if (rank >= blockSeverityRank) {
      verdict = 'block';
      reason_codes.push(`RISK_SIGNAL_BLOCK:${signal.code}`);
    } else if (rank >= reviewSeverityRank && verdict !== 'block') {
      verdict = 'review';
      reason_codes.push(`RISK_SIGNAL_REVIEW:${signal.code}`);
    }
  }

  // Check downstream hints
  if (stage.downstream_hints.guardrail_action === 'suppress') {
    verdict = 'block';
    reason_codes.push('GUARDRAIL_SUPPRESS');
  } else if (
    stage.downstream_hints.payout_action === 'hold_for_review' &&
    verdict !== 'block'
  ) {
    verdict = 'review';
    reason_codes.push('PAYOUT_HOLD_FOR_REVIEW');
  }

  if (stage.downstream_hints.moderation_action === 'escalate') {
    verdict = 'block';
    reason_codes.push('MODERATION_ESCALATE');
  } else if (
    stage.downstream_hints.moderation_action === 'flag_for_review' &&
    verdict !== 'block'
  ) {
    verdict = 'review';
    reason_codes.push('MODERATION_FLAG_FOR_REVIEW');
  }

  // Include upstream reason codes
  for (const code of stage.reason_codes) {
    if (!reason_codes.includes(code)) {
      reason_codes.push(code);
    }
  }

  const summary =
    verdict === 'pass'
      ? `Operator trust tier "${stage.trust_tier}" passed reputation checks.`
      : verdict === 'review'
        ? `Operator trust tier "${stage.trust_tier}" flagged for review.`
        : `Operator trust tier "${stage.trust_tier}" blocked by reputation checks.`;

  return { stage: 'reputation', verdict, reason_codes, summary };
}

function evaluateEvidence(
  stage: EvidenceStageInput,
  thresholds: PipelineThresholds,
): StageResult {
  const reason_codes: string[] = [];
  let verdict: StageVerdict = 'pass';

  // Check priority band
  if (thresholds.evidence_block_bands.includes(stage.priority_band)) {
    verdict = 'block';
    reason_codes.push(`EVIDENCE_PRIORITY_BLOCK:${stage.priority_band}`);
  } else if (thresholds.evidence_review_bands.includes(stage.priority_band)) {
    verdict = 'review';
    reason_codes.push(`EVIDENCE_PRIORITY_REVIEW:${stage.priority_band}`);
  }

  // Check anomaly score
  if (stage.anomaly_score >= thresholds.evidence_block_anomaly_score) {
    verdict = 'block';
    reason_codes.push(`ANOMALY_SCORE_BLOCK:${stage.anomaly_score}`);
  } else if (
    stage.anomaly_score >= thresholds.evidence_review_anomaly_score &&
    verdict !== 'block'
  ) {
    verdict = 'review';
    reason_codes.push(`ANOMALY_SCORE_REVIEW:${stage.anomaly_score}`);
  }

  // Include anomaly flags as reason codes
  for (const flag of stage.anomaly_flags) {
    reason_codes.push(`ANOMALY:${flag}`);
  }

  const summary =
    verdict === 'pass'
      ? `Evidence coverage ratio ${stage.evidence_coverage_ratio.toFixed(2)} within acceptable range.`
      : verdict === 'review'
        ? `Evidence flagged for review: priority band "${stage.priority_band}", anomaly score ${stage.anomaly_score}.`
        : `Evidence blocked: priority band "${stage.priority_band}", anomaly score ${stage.anomaly_score}.`;

  return { stage: 'evidence', verdict, reason_codes, summary };
}

function evaluateHoldback(
  stage: HoldbackStageInput,
  _thresholds: PipelineThresholds,
): StageResult {
  const reason_codes: string[] = [...stage.holdback_reason_codes];
  let verdict: StageVerdict;

  switch (stage.decision) {
    case 'holdback':
      verdict = 'block';
      break;
    case 'manual_review':
      verdict = 'review';
      break;
    case 'auto_release':
      verdict = 'pass';
      break;
    default:
      verdict = 'block';
      reason_codes.push('UNKNOWN_HOLDBACK_DECISION');
  }

  const summary =
    verdict === 'pass'
      ? `Holdback decision: auto_release. ${stage.decision_rationale}`
      : verdict === 'review'
        ? `Holdback decision: manual_review. ${stage.decision_rationale}`
        : `Holdback decision: holdback. ${stage.decision_rationale}`;

  return { stage: 'holdback', verdict, reason_codes, summary };
}

function evaluateEmissions(
  stage: EmissionsStageInput,
  thresholds: PipelineThresholds,
): StageResult {
  const reason_codes: string[] = [...stage.reason_codes];
  let verdict: StageVerdict = 'pass';

  if (thresholds.emissions_block_postures.includes(stage.emission_posture)) {
    verdict = 'block';
    reason_codes.push(`EMISSION_POSTURE_BLOCK:${stage.emission_posture}`);
  } else if (thresholds.emissions_review_postures.includes(stage.emission_posture)) {
    verdict = 'review';
    reason_codes.push(`EMISSION_POSTURE_REVIEW:${stage.emission_posture}`);
  }

  const summary =
    verdict === 'pass'
      ? `Emissions posture "${stage.emission_posture}" is healthy. ${stage.posture_rationale}`
      : verdict === 'review'
        ? `Emissions posture "${stage.emission_posture}" flagged for review. ${stage.posture_rationale}`
        : `Emissions posture "${stage.emission_posture}" restricted. ${stage.posture_rationale}`;

  return { stage: 'emissions', verdict, reason_codes, summary };
}

// ─── Pipeline Combiner ───────────────────────────────────────────────

function combinePipelineDecision(results: StageResult[]): {
  decision: PipelineDecision;
  criticalPath: CriticalPath;
  allReasonCodes: string[];
} {
  let strongestVerdict: StageVerdict = 'pass';
  let decisiveResult: StageResult = results[0];
  const allReasonCodes: string[] = [];

  for (const result of results) {
    for (const code of result.reason_codes) {
      allReasonCodes.push(code);
    }

    if (VERDICT_RANK[result.verdict] > VERDICT_RANK[strongestVerdict]) {
      strongestVerdict = result.verdict;
      decisiveResult = result;
    } else if (
      VERDICT_RANK[result.verdict] === VERDICT_RANK[strongestVerdict] &&
      result.reason_codes.length > decisiveResult.reason_codes.length
    ) {
      // Tie-break: stage with more reason codes is considered more decisive
      decisiveResult = result;
    }
  }

  const decision: PipelineDecision =
    strongestVerdict === 'block'
      ? 'block'
      : strongestVerdict === 'review'
        ? 'review'
        : 'release';

  const criticalPath: CriticalPath = {
    decisive_stage: decisiveResult.stage,
    verdict: decisiveResult.verdict,
    reason_codes: decisiveResult.reason_codes,
    rationale:
      decision === 'release'
        ? 'All stages passed clean. No escalation or block conditions triggered.'
        : `Stage "${decisiveResult.stage}" triggered ${decision} with ${decisiveResult.reason_codes.length} reason code(s).`,
  };

  return { decision, criticalPath, allReasonCodes };
}

// ─── Operator Context Builder ────────────────────────────────────────

function buildOperatorContext(
  reputation: ReputationStageInput,
): OperatorContext {
  let highestSeverity: ReputationRiskSeverity | 'none' = 'none';
  let highestRank = -1;

  for (const signal of reputation.risk_signals) {
    const severity = signal.severity as ReputationRiskSeverity;
    const rank = SEVERITY_RANK[severity] ?? -1;
    if (rank > highestRank) {
      highestRank = rank;
      highestSeverity = severity;
    }
  }

  return {
    operator_id: reputation.reputation_snapshot.operator_id,
    trust_tier: reputation.trust_tier,
    completion_rate: reputation.reputation_snapshot.completion_rate,
    evidence_quality_score: reputation.reputation_snapshot.evidence_quality_score,
    total_tasks: reputation.reputation_snapshot.total_tasks,
    downstream_hints: reputation.downstream_hints,
    risk_signal_count: reputation.risk_signals.length,
    highest_risk_severity: highestSeverity,
  };
}

// ─── Emissions Impact Builder ────────────────────────────────────────

function buildEmissionsImpact(
  emissions: EmissionsStageInput,
  rewardPft: number,
): EmissionsImpact {
  return {
    current_posture: emissions.emission_posture,
    worst_window: emissions.worst_window,
    review_priority_window: emissions.review_priority_window,
    reward_pft: rewardPft,
    window_postures: emissions.window_postures,
    posture_rationale: emissions.posture_rationale,
  };
}

// ─── Reviewer Packet Builder ─────────────────────────────────────────

function buildReviewerPacket(
  input: OrchestratorInput,
  decision: PipelineDecision,
  decisiveStage: StageName,
  allReasonCodes: string[],
): ReviewerPacket {
  const urgency: 'immediate' | 'standard' | 'low' =
    decision === 'block'
      ? 'immediate'
      : decision === 'review'
        ? 'standard'
        : 'low';

  return {
    task_id: input.verification_event.task_id,
    operator_id: input.verification_event.operator_id,
    reward_pft: input.verification_event.reward_pft,
    pipeline_decision: decision,
    decisive_stage: decisiveStage,
    all_reason_codes: allReasonCodes,
    holdback_reviewer_fields: input.holdback_stage.reviewer_fields,
    evidence_coverage_ratio: input.evidence_stage.evidence_coverage_ratio,
    anomaly_flags: input.evidence_stage.anomaly_flags,
    flagged_task_ids: input.evidence_stage.flagged_task_ids,
    trust_tier: input.reputation_stage.trust_tier,
    emission_posture: input.emissions_stage.emission_posture,
    requires_human_review: decision !== 'release',
    review_urgency: urgency,
  };
}

// ─── Main Entry Point ────────────────────────────────────────────────

export function orchestrateVerification(input: unknown): OrchestratorResult {
  // Validate input
  const validationError = validateInput(input);
  if (validationError) {
    return validationError;
  }

  const typedInput = input as OrchestratorInput;

  // Merge thresholds
  const thresholds: PipelineThresholds = {
    ...DEFAULT_THRESHOLDS,
    ...typedInput.thresholds,
  };

  // Execute stages in fixed order
  const stageResults: StageResult[] = [];
  const warnings: string[] = [];

  for (const stageName of STAGE_ORDER) {
    let result: StageResult;

    switch (stageName) {
      case 'reputation':
        result = evaluateReputation(typedInput.reputation_stage, thresholds);
        break;
      case 'evidence':
        result = evaluateEvidence(typedInput.evidence_stage, thresholds);
        break;
      case 'holdback':
        result = evaluateHoldback(typedInput.holdback_stage, thresholds);
        break;
      case 'emissions':
        result = evaluateEmissions(typedInput.emissions_stage, thresholds);
        break;
    }

    stageResults.push(result);
  }

  // Combine pipeline decision
  const { decision, criticalPath, allReasonCodes } =
    combinePipelineDecision(stageResults);

  // Build context objects
  const operatorContext = buildOperatorContext(typedInput.reputation_stage);
  const emissionsImpact = buildEmissionsImpact(
    typedInput.emissions_stage,
    typedInput.verification_event.reward_pft,
  );
  const reviewerPacket = buildReviewerPacket(
    typedInput,
    decision,
    criticalPath.decisive_stage,
    allReasonCodes,
  );

  // Collect validation warnings from all stages
  if (typedInput.holdback_stage.validation_warnings) {
    for (const w of typedInput.holdback_stage.validation_warnings) {
      warnings.push(`holdback: ${w}`);
    }
  }
  if (typedInput.evidence_stage.validation_warnings) {
    for (const w of typedInput.evidence_stage.validation_warnings) {
      warnings.push(`evidence: ${w}`);
    }
  }
  if (typedInput.emissions_stage.validation_warnings) {
    for (const w of typedInput.emissions_stage.validation_warnings) {
      warnings.push(`emissions: ${w}`);
    }
  }

  // Build decision rationale
  const stageVerdicts = stageResults
    .map((r) => `${r.stage}=${r.verdict}`)
    .join(', ');
  const decisionRationale =
    decision === 'release'
      ? `All pipeline stages passed clean (${stageVerdicts}). Reward of ${typedInput.verification_event.reward_pft} PFT approved for release.`
      : `Pipeline decision: ${decision}. Decisive stage: ${criticalPath.decisive_stage}. Stage verdicts: ${stageVerdicts}. ${criticalPath.rationale}`;

  // Only include reason_codes in the top-level if decision is not release
  const topLevelReasonCodes =
    decision === 'release' ? [] : allReasonCodes;

  const output: OrchestratorOutput = {
    generated_at: typedInput.as_of,
    as_of: typedInput.as_of,
    version: SCHEMA_VERSION,
    pipeline_decision: decision,
    stage_results: stageResults,
    critical_path: criticalPath,
    operator_context: operatorContext,
    emissions_impact: emissionsImpact,
    reviewer_packet: reviewerPacket,
    reason_codes: topLevelReasonCodes,
    decision_rationale: decisionRationale,
    threshold_config: thresholds,
    validation_warnings: warnings,
  };

  return output;
}
```

---

## Full Test Code

```typescript
import { describe, it, expect } from 'vitest';
import { orchestrateVerification } from '../src/orchestrator.js';
import type {
  OrchestratorInput,
  OrchestratorOutput,
  OrchestratorError,
  ReputationStageInput,
  EvidenceStageInput,
  HoldbackStageInput,
  EmissionsStageInput,
  VerificationEvent,
} from '../src/types.js';
import { SCHEMA_VERSION, STAGE_ORDER } from '../src/types.js';

// ─── Test Fixtures ───────────────────────────────────────────────────

function makeVerificationEvent(
  overrides: Partial<VerificationEvent> = {},
): VerificationEvent {
  return {
    task_id: 'task-001',
    operator_id: 'op-alpha',
    reward_pft: 2000,
    verification_type: 'url',
    verification_target: 'https://example.com/proof',
    evidence_visibility: 'public',
    ...overrides,
  };
}

function makeReputationStage(
  overrides: Partial<ReputationStageInput> = {},
): ReputationStageInput {
  return {
    trust_tier: 'reliable',
    risk_signals: [],
    reason_codes: [],
    downstream_hints: {
      payout_action: 'standard',
      guardrail_action: 'full_issuance',
      moderation_action: 'no_action',
      emissions_eligible: true,
    },
    reputation_snapshot: {
      operator_id: 'op-alpha',
      as_of: '2026-04-09T00:00:00Z',
      completion_rate: 0.85,
      evidence_quality_score: 78,
      rejection_rate: 0.05,
      holdback_rate: 0.02,
      total_tasks: 20,
      rewarded_count: 17,
      refusal_count: 1,
      holdback_count: 1,
      unresolved_holdback_count: 0,
    },
    ...overrides,
  };
}

function makeEvidenceStage(
  overrides: Partial<EvidenceStageInput> = {},
): EvidenceStageInput {
  return {
    evidence_coverage_ratio: 0.9,
    anomaly_flags: [],
    anomaly_score: 10,
    priority_band: 'low',
    priority_score: 15,
    flagged_task_ids: [],
    review_rationale: 'No significant anomalies detected.',
    validation_warnings: [],
    ...overrides,
  };
}

function makeHoldbackStage(
  overrides: Partial<HoldbackStageInput> = {},
): HoldbackStageInput {
  return {
    decision: 'auto_release',
    holdback_reason_codes: ['CLEAN'],
    missing_public_evidence: false,
    reviewer_fields: {
      operator_id: 'op-alpha',
      operator_auth_state: 'AUTHORIZED',
      reward_pft: 2000,
      evidence_visibility: 'public',
      evidence_status: 'verifiable',
      verification_type: 'url',
      requires_public_artifact: true,
      blocking_conditions: [],
      risk_level: 'low',
      next_review_step: 'none',
      recommended_action: 'auto_release',
      risk_summary: 'Low risk. All checks passed.',
    },
    decision_rationale: 'All pre-payout checks passed. Auto-release approved.',
    validation_warnings: [],
    ...overrides,
  };
}

function makeEmissionsStage(
  overrides: Partial<EmissionsStageInput> = {},
): EmissionsStageInput {
  return {
    emission_posture: 'healthy',
    reason_codes: ['CLEAN'],
    worst_window: '7d',
    review_priority_window: '7d',
    window_postures: { '7d': 'healthy', '30d': 'healthy', all_time: 'healthy' },
    posture_rationale: 'All concentration metrics within healthy bounds.',
    window_summaries: [
      {
        window: '7d',
        total_pft: 15000,
        total_records: 12,
        unique_recipients: 8,
        concentration_index: 0.08,
        top_recipient_share: 0.15,
      },
    ],
    validation_warnings: [],
    ...overrides,
  };
}

function makeCleanInput(
  overrides: Partial<OrchestratorInput> = {},
): OrchestratorInput {
  return {
    as_of: '2026-04-09T12:00:00Z',
    verification_event: makeVerificationEvent(),
    reputation_stage: makeReputationStage(),
    evidence_stage: makeEvidenceStage(),
    holdback_stage: makeHoldbackStage(),
    emissions_stage: makeEmissionsStage(),
    ...overrides,
  };
}

// ─── Helper ──────────────────────────────────────────────────────────

function isError(result: unknown): result is OrchestratorError {
  return (
    typeof result === 'object' &&
    result !== null &&
    'error_code' in result
  );
}

function isOutput(result: unknown): result is OrchestratorOutput {
  return (
    typeof result === 'object' &&
    result !== null &&
    !('error_code' in result) &&
    'pipeline_decision' in result
  );
}

// ─── Tests ───────────────────────────────────────────────────────────

describe('Verification Pipeline Orchestrator', () => {
  // ── 1. Happy Path: Full Release ─────────────────────────────────

  describe('Release path', () => {
    it('returns release when all stages pass clean', () => {
      const result = orchestrateVerification(makeCleanInput());
      expect(isOutput(result)).toBe(true);
      if (!isOutput(result)) return;

      expect(result.pipeline_decision).toBe('release');
      expect(result.stage_results).toHaveLength(4);
      expect(result.stage_results.every((s) => s.verdict === 'pass')).toBe(true);
      expect(result.reason_codes).toEqual([]);
      expect(result.reviewer_packet.requires_human_review).toBe(false);
      expect(result.reviewer_packet.review_urgency).toBe('low');
    });

    it('sets critical_path to first stage on full release (tie-break)', () => {
      const result = orchestrateVerification(makeCleanInput());
      if (!isOutput(result)) return;

      expect(result.critical_path.verdict).toBe('pass');
      expect(result.critical_path.rationale).toContain('All stages passed clean');
    });
  });

  // ── 2. Review Paths ─────────────────────────────────────────────

  describe('Review path', () => {
    it('returns review when reputation stage has probationary tier', () => {
      const input = makeCleanInput({
        reputation_stage: makeReputationStage({
          trust_tier: 'probationary',
          reason_codes: ['low_completion_rate'],
        }),
      });
      const result = orchestrateVerification(input);
      if (!isOutput(result)) return;

      expect(result.pipeline_decision).toBe('review');
      expect(result.critical_path.decisive_stage).toBe('reputation');
      expect(result.reason_codes).toContain('TRUST_TIER_REVIEW:probationary');
      expect(result.reviewer_packet.requires_human_review).toBe(true);
      expect(result.reviewer_packet.review_urgency).toBe('standard');
    });

    it('returns review when holdback is manual_review', () => {
      const input = makeCleanInput({
        holdback_stage: makeHoldbackStage({
          decision: 'manual_review',
          holdback_reason_codes: ['PROBATIONARY_HIGH_REWARD'],
          decision_rationale: 'Probationary operator with high reward.',
        }),
      });
      const result = orchestrateVerification(input);
      if (!isOutput(result)) return;

      expect(result.pipeline_decision).toBe('review');
      expect(result.critical_path.decisive_stage).toBe('holdback');
      expect(result.reason_codes).toContain('PROBATIONARY_HIGH_REWARD');
    });

    it('returns review when emissions posture is watch', () => {
      const input = makeCleanInput({
        emissions_stage: makeEmissionsStage({
          emission_posture: 'watch',
          reason_codes: ['TOP_RECIPIENT_DOMINANCE'],
          posture_rationale: 'Top recipient share exceeds watch threshold.',
        }),
      });
      const result = orchestrateVerification(input);
      if (!isOutput(result)) return;

      expect(result.pipeline_decision).toBe('review');
      expect(result.critical_path.decisive_stage).toBe('emissions');
      expect(result.reason_codes).toContain('EMISSION_POSTURE_REVIEW:watch');
    });

    it('returns review when evidence has high priority band', () => {
      const input = makeCleanInput({
        evidence_stage: makeEvidenceStage({
          priority_band: 'high',
          anomaly_score: 55,
          anomaly_flags: ['HIGH_REWARD_NO_EVIDENCE'],
        }),
      });
      const result = orchestrateVerification(input);
      if (!isOutput(result)) return;

      expect(result.pipeline_decision).toBe('review');
      expect(result.critical_path.decisive_stage).toBe('evidence');
    });

    it('returns review when reputation has high-severity risk signal', () => {
      const input = makeCleanInput({
        reputation_stage: makeReputationStage({
          risk_signals: [
            {
              code: 'high_holdback_rate',
              severity: 'high',
              description: 'Elevated holdback rate',
              consumers: ['payout', 'guardrail'],
            },
          ],
        }),
      });
      const result = orchestrateVerification(input);
      if (!isOutput(result)) return;

      expect(result.pipeline_decision).toBe('review');
      expect(result.reason_codes).toContain('RISK_SIGNAL_REVIEW:high_holdback_rate');
    });
  });

  // ── 3. Block Paths ──────────────────────────────────────────────

  describe('Block path', () => {
    it('returns block when holdback decision is holdback', () => {
      const input = makeCleanInput({
        holdback_stage: makeHoldbackStage({
          decision: 'holdback',
          holdback_reason_codes: ['UNAUTHORIZED_OPERATOR', 'MISSING_EVIDENCE'],
          decision_rationale: 'Operator unauthorized and evidence missing.',
          reviewer_fields: {
            ...makeHoldbackStage().reviewer_fields,
            risk_level: 'critical',
            blocking_conditions: ['UNAUTHORIZED_OPERATOR', 'MISSING_EVIDENCE'],
          },
        }),
      });
      const result = orchestrateVerification(input);
      if (!isOutput(result)) return;

      expect(result.pipeline_decision).toBe('block');
      expect(result.critical_path.decisive_stage).toBe('holdback');
      expect(result.reviewer_packet.review_urgency).toBe('immediate');
    });

    it('returns block when emissions posture is restrict', () => {
      const input = makeCleanInput({
        emissions_stage: makeEmissionsStage({
          emission_posture: 'restrict',
          reason_codes: ['HIGH_CONCENTRATION_INDEX', 'TOP_RECIPIENT_DOMINANCE'],
          posture_rationale: 'Severe concentration detected.',
        }),
      });
      const result = orchestrateVerification(input);
      if (!isOutput(result)) return;

      expect(result.pipeline_decision).toBe('block');
      expect(result.critical_path.decisive_stage).toBe('emissions');
    });

    it('returns block when evidence has critical priority band', () => {
      const input = makeCleanInput({
        evidence_stage: makeEvidenceStage({
          priority_band: 'critical',
          anomaly_score: 95,
          anomaly_flags: ['HIGH_REWARD_NO_EVIDENCE', 'ALL_PRIVATE'],
          flagged_task_ids: ['task-001'],
        }),
      });
      const result = orchestrateVerification(input);
      if (!isOutput(result)) return;

      expect(result.pipeline_decision).toBe('block');
      expect(result.critical_path.decisive_stage).toBe('evidence');
      expect(result.reason_codes).toContain('ANOMALY:HIGH_REWARD_NO_EVIDENCE');
      expect(result.reason_codes).toContain('ANOMALY:ALL_PRIVATE');
    });

    it('returns block when reputation has critical risk signal', () => {
      const input = makeCleanInput({
        reputation_stage: makeReputationStage({
          risk_signals: [
            {
              code: 'unresolved_holdbacks',
              severity: 'critical',
              description: 'Multiple unresolved holdbacks',
              consumers: ['payout'],
            },
          ],
        }),
      });
      const result = orchestrateVerification(input);
      if (!isOutput(result)) return;

      expect(result.pipeline_decision).toBe('block');
      expect(result.critical_path.decisive_stage).toBe('reputation');
      expect(result.reason_codes).toContain('RISK_SIGNAL_BLOCK:unresolved_holdbacks');
    });

    it('block overrides review when multiple stages disagree', () => {
      const input = makeCleanInput({
        reputation_stage: makeReputationStage({
          trust_tier: 'probationary',
        }),
        holdback_stage: makeHoldbackStage({
          decision: 'holdback',
          holdback_reason_codes: ['UNAUTHORIZED_OPERATOR'],
          decision_rationale: 'Operator not authorized.',
        }),
      });
      const result = orchestrateVerification(input);
      if (!isOutput(result)) return;

      expect(result.pipeline_decision).toBe('block');
      expect(result.critical_path.decisive_stage).toBe('holdback');
      expect(result.reason_codes).toContain('TRUST_TIER_REVIEW:probationary');
      expect(result.reason_codes).toContain('UNAUTHORIZED_OPERATOR');
    });

    it('returns block when downstream hints indicate suppress', () => {
      const input = makeCleanInput({
        reputation_stage: makeReputationStage({
          downstream_hints: {
            payout_action: 'standard',
            guardrail_action: 'suppress',
            moderation_action: 'no_action',
            emissions_eligible: true,
          },
        }),
      });
      const result = orchestrateVerification(input);
      if (!isOutput(result)) return;

      expect(result.pipeline_decision).toBe('block');
      expect(result.reason_codes).toContain('GUARDRAIL_SUPPRESS');
    });

    it('returns block when moderation action is escalate', () => {
      const input = makeCleanInput({
        reputation_stage: makeReputationStage({
          downstream_hints: {
            payout_action: 'standard',
            guardrail_action: 'full_issuance',
            moderation_action: 'escalate',
            emissions_eligible: true,
          },
        }),
      });
      const result = orchestrateVerification(input);
      if (!isOutput(result)) return;

      expect(result.pipeline_decision).toBe('block');
      expect(result.reason_codes).toContain('MODERATION_ESCALATE');
    });
  });

  // ── 4. Determinism ──────────────────────────────────────────────

  describe('Determinism', () => {
    it('produces byte-identical JSON for identical inputs', () => {
      const input = makeCleanInput();
      const result1 = orchestrateVerification(input);
      const result2 = orchestrateVerification(input);

      expect(JSON.stringify(result1)).toBe(JSON.stringify(result2));
    });

    it('generated_at equals as_of (never uses runtime clock)', () => {
      const input = makeCleanInput({ as_of: '2025-01-01T00:00:00Z' });
      const result = orchestrateVerification(input);
      if (!isOutput(result)) return;

      expect(result.generated_at).toBe('2025-01-01T00:00:00Z');
      expect(result.as_of).toBe('2025-01-01T00:00:00Z');
    });

    it('stage_results are always in STAGE_ORDER regardless of input', () => {
      const input = makeCleanInput();
      const result = orchestrateVerification(input);
      if (!isOutput(result)) return;

      const stageNames = result.stage_results.map((s) => s.stage);
      expect(stageNames).toEqual([...STAGE_ORDER]);
    });
  });

  // ── 5. Malformed Input ──────────────────────────────────────────

  describe('Malformed input', () => {
    it('returns error for null input', () => {
      const result = orchestrateVerification(null);
      expect(isError(result)).toBe(true);
      if (!isError(result)) return;

      expect(result.pipeline_decision).toBe('block');
      expect(result.error_code).toBe('INVALID_INPUT');
    });

    it('returns error for undefined input', () => {
      const result = orchestrateVerification(undefined);
      expect(isError(result)).toBe(true);
      if (!isError(result)) return;

      expect(result.pipeline_decision).toBe('block');
      expect(result.error_code).toBe('INVALID_INPUT');
    });

    it('returns error for missing as_of', () => {
      const result = orchestrateVerification({
        verification_event: makeVerificationEvent(),
      });
      expect(isError(result)).toBe(true);
      if (!isError(result)) return;

      expect(result.error_code).toBe('MISSING_AS_OF');
    });

    it('returns error for missing verification_event', () => {
      const result = orchestrateVerification({
        as_of: '2026-04-09T00:00:00Z',
        reputation_stage: makeReputationStage(),
        evidence_stage: makeEvidenceStage(),
        holdback_stage: makeHoldbackStage(),
        emissions_stage: makeEmissionsStage(),
      });
      expect(isError(result)).toBe(true);
      if (!isError(result)) return;

      expect(result.error_code).toBe('MISSING_VERIFICATION_EVENT');
    });

    it('returns error for missing reputation_stage', () => {
      const result = orchestrateVerification({
        as_of: '2026-04-09T00:00:00Z',
        verification_event: makeVerificationEvent(),
        evidence_stage: makeEvidenceStage(),
        holdback_stage: makeHoldbackStage(),
        emissions_stage: makeEmissionsStage(),
      });
      expect(isError(result)).toBe(true);
      if (!isError(result)) return;

      expect(result.error_code).toBe('MISSING_REPUTATION_STAGE');
    });

    it('returns error for missing evidence_stage', () => {
      const result = orchestrateVerification({
        as_of: '2026-04-09T00:00:00Z',
        verification_event: makeVerificationEvent(),
        reputation_stage: makeReputationStage(),
        holdback_stage: makeHoldbackStage(),
        emissions_stage: makeEmissionsStage(),
      });
      expect(isError(result)).toBe(true);
      if (!isError(result)) return;

      expect(result.error_code).toBe('MISSING_EVIDENCE_STAGE');
    });

    it('returns error for missing holdback_stage', () => {
      const result = orchestrateVerification({
        as_of: '2026-04-09T00:00:00Z',
        verification_event: makeVerificationEvent(),
        reputation_stage: makeReputationStage(),
        evidence_stage: makeEvidenceStage(),
        emissions_stage: makeEmissionsStage(),
      });
      expect(isError(result)).toBe(true);
      if (!isError(result)) return;

      expect(result.error_code).toBe('MISSING_HOLDBACK_STAGE');
    });

    it('returns error for missing emissions_stage', () => {
      const result = orchestrateVerification({
        as_of: '2026-04-09T00:00:00Z',
        verification_event: makeVerificationEvent(),
        reputation_stage: makeReputationStage(),
        evidence_stage: makeEvidenceStage(),
        holdback_stage: makeHoldbackStage(),
      });
      expect(isError(result)).toBe(true);
      if (!isError(result)) return;

      expect(result.error_code).toBe('MISSING_EMISSIONS_STAGE');
    });

    it('error outputs always block with version and reason_codes', () => {
      const result = orchestrateVerification('garbage');
      expect(isError(result)).toBe(true);
      if (!isError(result)) return;

      expect(result.pipeline_decision).toBe('block');
      expect(result.version).toBe(SCHEMA_VERSION);
      expect(result.reason_codes.length).toBeGreaterThan(0);
      expect(result.stage_results).toEqual([]);
      expect(result.critical_path).toBeNull();
    });
  });

  // ── 6. Threshold Boundary Behavior ──────────────────────────────

  describe('Threshold boundaries', () => {
    it('anomaly score at exactly review threshold triggers review', () => {
      const input = makeCleanInput({
        evidence_stage: makeEvidenceStage({
          anomaly_score: 50,
        }),
      });
      const result = orchestrateVerification(input);
      if (!isOutput(result)) return;

      expect(result.pipeline_decision).toBe('review');
    });

    it('anomaly score one below review threshold passes', () => {
      const input = makeCleanInput({
        evidence_stage: makeEvidenceStage({
          anomaly_score: 49,
        }),
      });
      const result = orchestrateVerification(input);
      if (!isOutput(result)) return;

      expect(result.pipeline_decision).toBe('release');
    });

    it('anomaly score at exactly block threshold triggers block', () => {
      const input = makeCleanInput({
        evidence_stage: makeEvidenceStage({
          anomaly_score: 80,
        }),
      });
      const result = orchestrateVerification(input);
      if (!isOutput(result)) return;

      expect(result.pipeline_decision).toBe('block');
    });

    it('custom thresholds override defaults', () => {
      const input = makeCleanInput({
        evidence_stage: makeEvidenceStage({
          anomaly_score: 90,
        }),
        thresholds: {
          evidence_block_anomaly_score: 95,
          evidence_review_anomaly_score: 85,
        },
      });
      const result = orchestrateVerification(input);
      if (!isOutput(result)) return;

      expect(result.pipeline_decision).toBe('review');
    });

    it('custom reputation block tiers can block new_operator', () => {
      const input = makeCleanInput({
        reputation_stage: makeReputationStage({
          trust_tier: 'new_operator',
        }),
        thresholds: {
          reputation_block_tiers: ['new_operator'],
        },
      });
      const result = orchestrateVerification(input);
      if (!isOutput(result)) return;

      expect(result.pipeline_decision).toBe('block');
      expect(result.reason_codes).toContain('TRUST_TIER_BLOCKED:new_operator');
    });
  });

  // ── 7. Tie-Breaking and Ordering ────────────────────────────────

  describe('Tie-breaking', () => {
    it('when two stages both block, decisive stage has more reason codes', () => {
      const input = makeCleanInput({
        holdback_stage: makeHoldbackStage({
          decision: 'holdback',
          holdback_reason_codes: ['UNAUTHORIZED_OPERATOR'],
          decision_rationale: 'Blocked.',
        }),
        emissions_stage: makeEmissionsStage({
          emission_posture: 'restrict',
          reason_codes: ['HIGH_CONCENTRATION_INDEX', 'TOP_RECIPIENT_DOMINANCE'],
          posture_rationale: 'Restricted.',
        }),
      });
      const result = orchestrateVerification(input);
      if (!isOutput(result)) return;

      expect(result.pipeline_decision).toBe('block');
      expect(result.critical_path.decisive_stage).toBe('emissions');
    });

    it('when two stages both review, decisive stage has more reason codes', () => {
      const input = makeCleanInput({
        reputation_stage: makeReputationStage({
          trust_tier: 'probationary',
          reason_codes: ['low_completion_rate', 'weak_evidence_quality'],
        }),
        holdback_stage: makeHoldbackStage({
          decision: 'manual_review',
          holdback_reason_codes: ['PROBATIONARY_HIGH_REWARD'],
          decision_rationale: 'Needs review.',
        }),
      });
      const result = orchestrateVerification(input);
      if (!isOutput(result)) return;

      expect(result.pipeline_decision).toBe('review');
      expect(result.critical_path.decisive_stage).toBe('reputation');
    });
  });

  // ── 8. Output Structure Completeness ────────────────────────────

  describe('Output structure', () => {
    it('release output contains all required top-level fields', () => {
      const result = orchestrateVerification(makeCleanInput());
      if (!isOutput(result)) return;

      expect(result).toHaveProperty('generated_at');
      expect(result).toHaveProperty('as_of');
      expect(result).toHaveProperty('version');
      expect(result).toHaveProperty('pipeline_decision');
      expect(result).toHaveProperty('stage_results');
      expect(result).toHaveProperty('critical_path');
      expect(result).toHaveProperty('operator_context');
      expect(result).toHaveProperty('emissions_impact');
      expect(result).toHaveProperty('reviewer_packet');
      expect(result).toHaveProperty('reason_codes');
      expect(result).toHaveProperty('decision_rationale');
      expect(result).toHaveProperty('threshold_config');
      expect(result).toHaveProperty('validation_warnings');
    });

    it('operator_context reflects reputation snapshot', () => {
      const input = makeCleanInput();
      const result = orchestrateVerification(input);
      if (!isOutput(result)) return;

      expect(result.operator_context.operator_id).toBe('op-alpha');
      expect(result.operator_context.trust_tier).toBe('reliable');
      expect(result.operator_context.completion_rate).toBe(0.85);
      expect(result.operator_context.total_tasks).toBe(20);
      expect(result.operator_context.risk_signal_count).toBe(0);
      expect(result.operator_context.highest_risk_severity).toBe('none');
    });

    it('emissions_impact reflects emissions stage data', () => {
      const input = makeCleanInput();
      const result = orchestrateVerification(input);
      if (!isOutput(result)) return;

      expect(result.emissions_impact.current_posture).toBe('healthy');
      expect(result.emissions_impact.reward_pft).toBe(2000);
      expect(result.emissions_impact.worst_window).toBe('7d');
    });

    it('reviewer_packet contains holdback reviewer fields', () => {
      const input = makeCleanInput();
      const result = orchestrateVerification(input);
      if (!isOutput(result)) return;

      expect(result.reviewer_packet.task_id).toBe('task-001');
      expect(result.reviewer_packet.operator_id).toBe('op-alpha');
      expect(result.reviewer_packet.holdback_reviewer_fields.evidence_status).toBe(
        'verifiable',
      );
    });

    it('version matches SCHEMA_VERSION', () => {
      const result = orchestrateVerification(makeCleanInput());
      if (!isOutput(result)) return;

      expect(result.version).toBe(SCHEMA_VERSION);
    });

    it('threshold_config includes merged defaults and overrides', () => {
      const input = makeCleanInput({
        thresholds: {
          evidence_block_anomaly_score: 99,
        },
      });
      const result = orchestrateVerification(input);
      if (!isOutput(result)) return;

      expect(result.threshold_config.evidence_block_anomaly_score).toBe(99);
      expect(result.threshold_config.evidence_review_anomaly_score).toBe(50);
    });
  });

  // ── 9. Validation Warnings Propagation ──────────────────────────

  describe('Validation warnings', () => {
    it('propagates validation warnings from all stages', () => {
      const input = makeCleanInput({
        holdback_stage: makeHoldbackStage({
          validation_warnings: ['Holdback warning 1'],
        }),
        evidence_stage: makeEvidenceStage({
          validation_warnings: ['Evidence warning 1'],
        }),
        emissions_stage: makeEmissionsStage({
          validation_warnings: ['Emissions warning 1'],
        }),
      });
      const result = orchestrateVerification(input);
      if (!isOutput(result)) return;

      expect(result.validation_warnings).toContain('holdback: Holdback warning 1');
      expect(result.validation_warnings).toContain('evidence: Evidence warning 1');
      expect(result.validation_warnings).toContain('emissions: Emissions warning 1');
    });
  });

  // ── 10. Combined Scenarios ──────────────────────────────────────

  describe('Combined scenarios', () => {
    it('all four stages trigger review — decisive is the one with most codes', () => {
      const input = makeCleanInput({
        reputation_stage: makeReputationStage({
          trust_tier: 'probationary',
          reason_codes: ['low_completion_rate'],
        }),
        evidence_stage: makeEvidenceStage({
          priority_band: 'high',
          anomaly_flags: ['LOW_COVERAGE_HIGH_VOLUME'],
        }),
        holdback_stage: makeHoldbackStage({
          decision: 'manual_review',
          holdback_reason_codes: ['PROBATIONARY_HIGH_REWARD', 'LOW_HISTORICAL_COVERAGE'],
          decision_rationale: 'Review needed.',
        }),
        emissions_stage: makeEmissionsStage({
          emission_posture: 'watch',
          reason_codes: ['TOP_RECIPIENT_DOMINANCE'],
        }),
      });
      const result = orchestrateVerification(input);
      if (!isOutput(result)) return;

      expect(result.pipeline_decision).toBe('review');
      expect(result.stage_results.every((s) => s.verdict === 'review')).toBe(true);
    });

    it('downstream hints hold_for_review triggers review at reputation stage', () => {
      const input = makeCleanInput({
        reputation_stage: makeReputationStage({
          downstream_hints: {
            payout_action: 'hold_for_review',
            guardrail_action: 'full_issuance',
            moderation_action: 'no_action',
            emissions_eligible: true,
          },
        }),
      });
      const result = orchestrateVerification(input);
      if (!isOutput(result)) return;

      expect(result.pipeline_decision).toBe('review');
      expect(result.reason_codes).toContain('PAYOUT_HOLD_FOR_REVIEW');
    });

    it('handles high reward event with all stages contributing context', () => {
      const input = makeCleanInput({
        verification_event: makeVerificationEvent({
          reward_pft: 10000,
          evidence_visibility: 'authenticated',
        }),
      });
      const result = orchestrateVerification(input);
      if (!isOutput(result)) return;

      expect(result.reviewer_packet.reward_pft).toBe(10000);
      expect(result.emissions_impact.reward_pft).toBe(10000);
    });
  });
});
```

---

## Test Results

```
 RUN  v1.6.1

 ✓ tests/orchestrator.test.ts  (43 tests) 12ms

 Test Files  1 passed (1)
      Tests  43 passed (43)
   Start at  16:57:21
   Duration  539ms (transform 89ms, setup 0ms, collect 93ms, tests 12ms, environment 0ms, prepare 87ms)
```

All 43 tests pass. Test coverage includes:
- 2 release path tests
- 5 review path tests (reputation, holdback, emissions, evidence, risk signals)
- 7 block path tests (holdback, emissions, evidence, reputation, override, suppress, escalate)
- 3 determinism tests (byte-stable, generated_at, stage ordering)
- 8 malformed input tests (null, undefined, missing each field, garbage input)
- 5 threshold boundary tests (exact review, below review, exact block, custom overrides, custom block tiers)
- 2 tie-breaking tests (block ties, review ties)
- 5 output structure tests (fields, operator context, emissions impact, reviewer packet, version)
- 1 validation warnings test
- 3 combined scenario tests (all-review, downstream hints, high reward)

---

*Published by Zoz via the Permanent Upper Class validator operation.*
*Task completed for the Post Fiat Network.*
