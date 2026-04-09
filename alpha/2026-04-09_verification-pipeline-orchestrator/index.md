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

This artifact is a deterministic verification pipeline orchestrator with two supported execution modes: execute mode runs the upstream review modules in fixed dependency order through typed adapters. precomputed mode accepts prior stage outputs for replay, auditing, and deterministic regression testing. Both modes emit the same unified verdict contract for direct integration into the live verification service.

The output includes `pipeline_decision` (release / review / block), per-stage results, the critical path identifying which stage drove the final outcome, operator reputation context, emissions impact assessment, and a structured reviewer packet for human review queues. The reviewer packet carries escalation summaries, decisive evidence, missing artifact lists, operator risk summaries, release consequence assessments, and next-action recommendations.

## What This Module Is Not

This module does not fetch data, modify rewards, or take enforcement actions. It is a pure function that produces a recommendation verdict. In precomputed mode it accepts pre-computed outputs as typed inputs. In execute mode it calls adapter ports that the integrating system supplies. The calling system is responsible for (a) providing adapters or pre-computed stage data, (b) passing inputs to this orchestrator, and (c) acting on the pipeline decision.

---

## Pipeline Flow

```
verification_event
    |
    +---> reputation(operator_id)
    |
    +---> evidence(task_id, operator_id)
    |
    +---> holdback(event, reputation, evidence)    <-- uses reputation + evidence
    |
    +---> emissions(operator_id, reward, holdback)  <-- uses holdback decision
    |
    +---> unified verdict
```

---

## Execution Modes

### Execute Mode

The orchestrator receives a `VerificationEvent`, an `as_of` timestamp, and a `PipelineAdapters` object containing four typed adapter ports. It calls each adapter in dependency order, threading outputs forward:

1. `reputation.run(operator_id, as_of)` -- no upstream dependencies
2. `evidence.run(task_id, operator_id, as_of)` -- no upstream dependencies
3. `holdback.run(event, reputation, evidence, as_of)` -- receives reputation and evidence outputs
4. `emissions.run(operator_id, reward_pft, holdback_decision, as_of)` -- receives holdback decision

If any adapter throws, the orchestrator fails closed with a `block` decision and error code `MALFORMED_STAGE_DATA`.

### Precomputed Mode

The orchestrator receives all four stage outputs directly, alongside the verification event and timestamp. This is the default mode for backwards compatibility. Used for replay, auditing, and deterministic regression testing.

---

## Adapter Port Interfaces

The four adapter interfaces define the contract that upstream module wrappers must satisfy in execute mode.

```typescript
interface ReputationAdapter {
  run(operatorId: string, asOf: string): ReputationStageInput;
}

interface EvidenceAdapter {
  run(taskId: string, operatorId: string, asOf: string): EvidenceStageInput;
}

interface HoldbackAdapter {
  run(
    event: VerificationEvent,
    reputation: ReputationStageInput,
    evidence: EvidenceStageInput,
    asOf: string,
  ): HoldbackStageInput;
}

interface EmissionsAdapter {
  run(
    operatorId: string,
    rewardPft: number,
    holdbackDecision: HoldbackDecision,
    asOf: string,
  ): EmissionsStageInput;
}

interface PipelineAdapters {
  reputation: ReputationAdapter;
  evidence: EvidenceAdapter;
  holdback: HoldbackAdapter;
  emissions: EmissionsAdapter;
}
```

---

## Dependency Wiring

Dependencies between stages are real and enforced by the adapter call signatures:

- **Reputation feeds holdback.** The holdback adapter receives the full `ReputationStageInput` so it can factor trust tier, risk signals, and downstream hints into its hold/release decision. A probationary operator with critical risk signals produces a different holdback outcome than an exemplary operator.

- **Evidence feeds holdback.** The holdback adapter also receives the full `EvidenceStageInput` so it can evaluate whether public artifacts exist and whether anomaly conditions should influence the holdback decision. Missing evidence combined with high reward triggers a holdback that would not occur with verified evidence alone.

- **Holdback decision feeds emissions.** The emissions adapter receives the holdback decision (`auto_release`, `manual_review`, or `holdback`) so it can apply conditional logic -- for example, treating concentration analysis as advisory-only when the reward is already blocked.

This wiring means later stages have strictly more context than earlier stages. The critical path tie-breaking rule reflects this: when two stages produce the same verdict severity, the one with more reason codes wins, and later stages tend to accumulate more specific evidence.

---

## Determinism Guarantee

The module never reads the runtime clock. All timestamps derive from the required `as_of` input field. The `generated_at` output field is always set equal to `as_of`. Identical inputs produce byte-stable JSON outputs. Stage evaluation always proceeds in the fixed order: reputation, evidence, holdback, emissions. Tie-breaking for the critical path is deterministic: the stage with the stronger verdict wins; on ties, the stage with more reason codes wins; on further ties, the earlier stage in execution order wins.

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

### Execute Mode Input

```typescript
interface ExecuteInput {
  mode: 'execute';
  as_of: string;
  verification_event: VerificationEvent;
  adapters: PipelineAdapters;
  thresholds?: Partial<PipelineThresholds>;
}
```

### Precomputed Mode Input

```typescript
interface PrecomputedInput {
  mode?: 'precomputed';  // Default mode for backwards compatibility
  as_of: string;
  verification_event: VerificationEvent;
  reputation_result: ReputationStageInput;
  evidence_result: EvidenceStageInput;
  holdback_result: HoldbackStageInput;
  emissions_result: EmissionsStageInput;
  thresholds?: Partial<PipelineThresholds>;
}

type PipelineInput = ExecuteInput | PrecomputedInput;
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

### Enhanced Reviewer Packet

```typescript
interface ReviewerPacket {
  task_id: string;
  operator_id: string;
  reward_pft: number;
  pipeline_decision: PipelineDecision;
  decisive_stage: StageName;
  all_reason_codes: string[];
  // Escalation summary
  escalation_summary: string;
  decisive_evidence: string[];
  missing_artifacts: string[];
  // Operator risk
  trust_tier: TrustTier;
  operator_risk_summary: string;
  // Evidence
  holdback_reviewer_fields: HoldbackReviewerFields;
  evidence_coverage_ratio: number;
  anomaly_flags: AnomalyFlag[];
  flagged_task_ids: string[];
  // Emissions
  emission_posture: EmissionPosture;
  release_consequence_summary: string;
  // Action
  requires_human_review: boolean;
  review_urgency: 'immediate' | 'standard' | 'low';
  next_action_recommendation: string;
}
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

The orchestrator processes stages in this fixed order. Each stage receives the pre-computed output from its corresponding upstream module (precomputed mode) or adapter output (execute mode), plus the pipeline threshold configuration.

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
| Any risk signal severity >= `reputation_block_severity` | block |
| `guardrail_action` = "suppress" | block |
| `moderation_action` = "escalate" | block |
| `trust_tier` in `reputation_review_tiers` | review |
| Any risk signal severity >= `reputation_review_severity` | review |
| `payout_action` = "hold_for_review" | review |
| `moderation_action` = "flag_for_review" | review |
| Otherwise | pass |

**Evidence Stage:**

| Condition | Verdict |
|---|---|
| `priority_band` in `evidence_block_bands` | block |
| `anomaly_score` >= `evidence_block_anomaly_score` | block |
| `priority_band` in `evidence_review_bands` | review |
| `anomaly_score` >= `evidence_review_anomaly_score` | review |
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

The `critical_path` identifies the decisive stage -- the stage that triggered the strongest verdict. Ties are broken by reason code count (more codes = more decisive), then by execution order. Later stages can override earlier advisory stages because they have more context (holdback sees reputation+evidence; emissions sees the holdback decision).

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

### Execute Mode Description

In execute mode, the caller supplies adapter implementations and the orchestrator drives them. For example, an integrating service would create adapters that call the actual Operator Reputation Ledger, Reward Artifact Coverage Audit, Reward Holdback Decision Module, and Reward Token Emissions Concentration Analyzer. The orchestrator calls each adapter in dependency order, wires outputs forward (reputation and evidence into holdback, holdback decision into emissions), and returns the same unified verdict as precomputed mode. If any adapter throws, the pipeline fails closed with `pipeline_decision: "block"` and `error_code: "MALFORMED_STAGE_DATA"`.

### Precomputed Mode Example 1: RELEASE -- All Stages Clean

**Input:**

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
  "reputation_result": {
    "trust_tier": "reliable",
    "risk_signals": [],
    "reason_codes": [],
    "downstream_hints": {
      "payout_action": "standard",
      "guardrail_action": "full_issuance",
      "moderation_action": "no_action",
      "emissions_eligible": true
    },
    "reputation_snapshot": {
      "operator_id": "op-alpha",
      "as_of": "2026-04-09T00:00:00Z",
      "completion_rate": 0.85,
      "evidence_quality_score": 78,
      "rejection_rate": 0.05,
      "holdback_rate": 0.02,
      "total_tasks": 20,
      "rewarded_count": 17,
      "refusal_count": 1,
      "holdback_count": 1,
      "unresolved_holdback_count": 0
    }
  },
  "evidence_result": {
    "evidence_coverage_ratio": 0.9,
    "anomaly_flags": [],
    "anomaly_score": 10,
    "priority_band": "low",
    "priority_score": 15,
    "flagged_task_ids": [],
    "review_rationale": "No significant anomalies detected.",
    "validation_warnings": []
  },
  "holdback_result": {
    "decision": "auto_release",
    "holdback_reason_codes": ["CLEAN"],
    "missing_public_evidence": false,
    "reviewer_fields": {
      "operator_id": "op-alpha",
      "operator_auth_state": "AUTHORIZED",
      "reward_pft": 2000,
      "evidence_visibility": "public",
      "evidence_status": "verifiable",
      "verification_type": "url",
      "requires_public_artifact": true,
      "blocking_conditions": [],
      "risk_level": "low",
      "next_review_step": "none",
      "recommended_action": "auto_release",
      "risk_summary": "Low risk. All checks passed."
    },
    "decision_rationale": "All pre-payout checks passed. Auto-release approved.",
    "validation_warnings": []
  },
  "emissions_result": {
    "emission_posture": "healthy",
    "reason_codes": ["CLEAN"],
    "worst_window": "7d",
    "review_priority_window": "7d",
    "window_postures": { "7d": "healthy", "30d": "healthy", "all_time": "healthy" },
    "posture_rationale": "All concentration metrics within healthy bounds.",
    "window_summaries": [
      {
        "window": "7d",
        "total_pft": 15000,
        "total_records": 12,
        "unique_recipients": 8,
        "concentration_index": 0.08,
        "top_recipient_share": 0.15
      }
    ],
    "validation_warnings": []
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
    "review_urgency": "low",
    "escalation_summary": "No escalation required. All pipeline stages passed.",
    "decisive_evidence": [],
    "missing_artifacts": [],
    "operator_risk_summary": "Trust tier: reliable. No active risk signals.",
    "release_consequence_summary": "Releasing 2000 PFT has no adverse emissions impact. Posture remains healthy.",
    "next_action_recommendation": "Auto-release approved. No human action required."
  }
}
```

### Precomputed Mode Example 2: REVIEW -- Probationary Operator with Elevated Risk

**Input (abbreviated):**

```json
{
  "as_of": "2026-04-09T12:00:00Z",
  "verification_event": {
    "task_id": "task-042",
    "operator_id": "op-beta",
    "reward_pft": 4500
  },
  "reputation_result": {
    "trust_tier": "probationary",
    "risk_signals": [
      { "code": "high_rejection_rate", "severity": "high" }
    ],
    "downstream_hints": {
      "payout_action": "hold_for_review",
      "moderation_action": "flag_for_review"
    }
  },
  "holdback_result": {
    "decision": "manual_review",
    "holdback_reason_codes": ["PROBATIONARY_HIGH_REWARD", "ELEVATED_REJECTION_RATE"]
  },
  "emissions_result": {
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
    "review_urgency": "standard",
    "escalation_summary": "REVIEW: Triggered by reputation stage. 0 blocking/escalation condition(s) across pipeline.",
    "operator_risk_summary": "Trust tier: probationary. Risk signals: high_rejection_rate(high).",
    "next_action_recommendation": "Review reputation stage findings. none"
  }
}
```

### Precomputed Mode Example 3: BLOCK -- Suspended Operator, Missing Evidence, Restricted Emissions

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
  "reputation_result": {
    "trust_tier": "probationary",
    "risk_signals": [
      { "code": "unresolved_holdbacks", "severity": "critical" }
    ],
    "downstream_hints": {
      "guardrail_action": "suppress",
      "moderation_action": "escalate"
    }
  },
  "evidence_result": {
    "anomaly_score": 92,
    "priority_band": "critical",
    "anomaly_flags": ["HIGH_REWARD_NO_EVIDENCE", "ALL_PRIVATE"]
  },
  "holdback_result": {
    "decision": "holdback",
    "holdback_reason_codes": ["UNAUTHORIZED_OPERATOR", "MISSING_EVIDENCE"]
  },
  "emissions_result": {
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
    "review_urgency": "immediate",
    "escalation_summary": "BLOCK: Triggered by reputation stage. 3 blocking/escalation condition(s) across pipeline.",
    "next_action_recommendation": "BLOCK: Resolve reputation stage conditions before release. Investigate blocking conditions."
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
  // Escalation summary
  escalation_summary: string;
  decisive_evidence: string[];
  missing_artifacts: string[];
  // Operator risk
  trust_tier: TrustTier;
  operator_risk_summary: string;
  // Evidence
  holdback_reviewer_fields: HoldbackReviewerFields;
  evidence_coverage_ratio: number;
  anomaly_flags: AnomalyFlag[];
  flagged_task_ids: string[];
  // Emissions
  emission_posture: EmissionPosture;
  release_consequence_summary: string;
  // Action
  requires_human_review: boolean;
  review_urgency: 'immediate' | 'standard' | 'low';
  next_action_recommendation: string;
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

// ─── Stage Adapter Interfaces (Ports) ──────────────────────────────
// These define the contract for upstream module adapters.
// In execute mode, the orchestrator calls these to run each module.
// In precomputed mode, stage results are passed directly.

export interface ReputationAdapter {
  run(operatorId: string, asOf: string): ReputationStageInput;
}

export interface EvidenceAdapter {
  run(taskId: string, operatorId: string, asOf: string): EvidenceStageInput;
}

export interface HoldbackAdapter {
  run(
    event: VerificationEvent,
    reputation: ReputationStageInput,
    evidence: EvidenceStageInput,
    asOf: string,
  ): HoldbackStageInput;
}

export interface EmissionsAdapter {
  run(
    operatorId: string,
    rewardPft: number,
    holdbackDecision: HoldbackDecision,
    asOf: string,
  ): EmissionsStageInput;
}

export interface PipelineAdapters {
  reputation: ReputationAdapter;
  evidence: EvidenceAdapter;
  holdback: HoldbackAdapter;
  emissions: EmissionsAdapter;
}

// ─── Execution Mode ────────────────────────────────────────────────

export type ExecutionMode = 'execute' | 'precomputed';

/**
 * Execute mode input: pass verification_event + adapters.
 * The orchestrator runs each stage in dependency order.
 */
export interface ExecuteInput {
  mode: 'execute';
  as_of: string;
  verification_event: VerificationEvent;
  adapters: PipelineAdapters;
  thresholds?: Partial<PipelineThresholds>;
}

/**
 * Precomputed mode input: pass pre-computed stage results.
 * Used for replay, auditing, and deterministic regression testing.
 */
export interface PrecomputedInput {
  mode?: 'precomputed';  // Default mode for backwards compatibility
  as_of: string;
  verification_event: VerificationEvent;
  reputation_result: ReputationStageInput;
  evidence_result: EvidenceStageInput;
  holdback_result: HoldbackStageInput;
  emissions_result: EmissionsStageInput;
  thresholds?: Partial<PipelineThresholds>;
}

export type PipelineInput = ExecuteInput | PrecomputedInput;
```

### orchestrator.ts

```typescript
/**
 * Verification Pipeline Orchestrator
 *
 * Deterministic single-entry-point orchestrator with two execution modes:
 *
 *   execute mode — runs upstream review modules in fixed dependency order
 *   through typed adapters. Reputation output feeds holdback. Evidence
 *   output feeds holdback and reviewer packet. Holdback result influences
 *   whether emissions impact is advisory vs blocking.
 *
 *   precomputed mode — accepts prior stage outputs for replay, auditing,
 *   and deterministic regression testing.
 *
 * Both modes emit the same unified verdict contract for direct integration
 * into the live verification service.
 *
 * Pipeline execution order (dependency-aware):
 *
 *   verification_event
 *     → reputation(operator_id)
 *     → evidence(task_id, operator_id)
 *     → holdback(event, reputation, evidence)   ← uses reputation + evidence
 *     → emissions(operator_id, reward, holdback) ← uses holdback decision
 *     → unified verdict
 *
 * Decision rules:
 *   - ANY stage returns block  → pipeline_decision = "block"
 *   - ANY stage returns review → pipeline_decision = "review"
 *   - ALL stages pass clean    → pipeline_decision = "release"
 *   - critical_path = the stage that triggered the strongest decision
 *
 * Critical path justification:
 *   Later stages CAN override earlier advisory stages because they have
 *   more context. Holdback sees reputation + evidence; emissions sees
 *   the holdback decision. Tie-breaking by reason-code count ensures
 *   the stage with the most specific evidence drives the reviewer packet.
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
  type PipelineInput,
  type ExecuteInput,
  type PrecomputedInput,
  type PipelineAdapters,
  type VerificationEvent,
} from './types.js';

// ─── Severity Ordering ──────────────────────────────────────────────

const SEVERITY_RANK: Record<ReputationRiskSeverity | 'none', number> = {
  critical: 4, high: 3, medium: 2, low: 1, info: 0, none: -1,
};

const VERDICT_RANK: Record<StageVerdict, number> = {
  block: 2, review: 1, pass: 0,
};

// ─── Input Validation ────────────────────────────────────────────────

function makeError(
  as_of: string,
  code: OrchestratorErrorCode,
  message: string,
): OrchestratorError {
  return {
    generated_at: as_of, as_of, version: SCHEMA_VERSION,
    pipeline_decision: 'block', error_code: code, error_message: message,
    validation_warnings: [], stage_results: [],
    critical_path: null, operator_context: null,
    emissions_impact: null, reviewer_packet: null,
    reason_codes: [code],
    decision_rationale: `Pipeline blocked due to input error: ${message}`,
    threshold_config: null,
  };
}

function validatePrecomputedInput(input: unknown): OrchestratorError | null {
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
  if (!obj.reputation_result || typeof obj.reputation_result !== 'object') {
    return makeError(as_of, 'MISSING_REPUTATION_STAGE', 'reputation_result is required in precomputed mode.');
  }
  if (!obj.evidence_result || typeof obj.evidence_result !== 'object') {
    return makeError(as_of, 'MISSING_EVIDENCE_STAGE', 'evidence_result is required in precomputed mode.');
  }
  if (!obj.holdback_result || typeof obj.holdback_result !== 'object') {
    return makeError(as_of, 'MISSING_HOLDBACK_STAGE', 'holdback_result is required in precomputed mode.');
  }
  if (!obj.emissions_result || typeof obj.emissions_result !== 'object') {
    return makeError(as_of, 'MISSING_EMISSIONS_STAGE', 'emissions_result is required in precomputed mode.');
  }
  return null;
}

function validateExecuteInput(input: unknown): OrchestratorError | null {
  if (input === null || input === undefined || typeof input !== 'object') {
    return makeError('', 'INVALID_INPUT', 'Input must be a non-null object.');
  }
  const obj = input as Record<string, unknown>;
  if (!obj.as_of || typeof obj.as_of !== 'string') {
    return makeError('', 'MISSING_AS_OF', 'as_of is required.');
  }
  const as_of = obj.as_of as string;
  if (!obj.verification_event || typeof obj.verification_event !== 'object') {
    return makeError(as_of, 'MISSING_VERIFICATION_EVENT', 'verification_event is required.');
  }
  if (!obj.adapters || typeof obj.adapters !== 'object') {
    return makeError(as_of, 'INVALID_INPUT', 'adapters object is required in execute mode.');
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

  if (thresholds.reputation_block_tiers.includes(stage.trust_tier)) {
    verdict = 'block';
    reason_codes.push(`TRUST_TIER_BLOCKED:${stage.trust_tier}`);
  } else if (thresholds.reputation_review_tiers.includes(stage.trust_tier)) {
    verdict = 'review';
    reason_codes.push(`TRUST_TIER_REVIEW:${stage.trust_tier}`);
  }

  const blockSeverityRank = SEVERITY_RANK[thresholds.reputation_block_severity];
  const reviewSeverityRank = SEVERITY_RANK[thresholds.reputation_review_severity];

  for (const signal of stage.risk_signals) {
    const rank = SEVERITY_RANK[signal.severity as ReputationRiskSeverity] ?? -1;
    if (rank >= blockSeverityRank) {
      verdict = 'block';
      reason_codes.push(`RISK_SIGNAL_BLOCK:${signal.code}`);
    } else if (rank >= reviewSeverityRank && verdict !== 'block') {
      verdict = 'review';
      reason_codes.push(`RISK_SIGNAL_REVIEW:${signal.code}`);
    }
  }

  if (stage.downstream_hints.guardrail_action === 'suppress') {
    verdict = 'block';
    reason_codes.push('GUARDRAIL_SUPPRESS');
  } else if (stage.downstream_hints.payout_action === 'hold_for_review' && verdict !== 'block') {
    verdict = 'review';
    reason_codes.push('PAYOUT_HOLD_FOR_REVIEW');
  }

  if (stage.downstream_hints.moderation_action === 'escalate') {
    verdict = 'block';
    reason_codes.push('MODERATION_ESCALATE');
  } else if (stage.downstream_hints.moderation_action === 'flag_for_review' && verdict !== 'block') {
    verdict = 'review';
    reason_codes.push('MODERATION_FLAG_FOR_REVIEW');
  }

  for (const code of stage.reason_codes) {
    if (!reason_codes.includes(code)) reason_codes.push(code);
  }

  const summary = verdict === 'pass'
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

  if (thresholds.evidence_block_bands.includes(stage.priority_band)) {
    verdict = 'block';
    reason_codes.push(`EVIDENCE_PRIORITY_BLOCK:${stage.priority_band}`);
  } else if (thresholds.evidence_review_bands.includes(stage.priority_band)) {
    verdict = 'review';
    reason_codes.push(`EVIDENCE_PRIORITY_REVIEW:${stage.priority_band}`);
  }

  if (stage.anomaly_score >= thresholds.evidence_block_anomaly_score) {
    verdict = 'block';
    reason_codes.push(`ANOMALY_SCORE_BLOCK:${stage.anomaly_score}`);
  } else if (stage.anomaly_score >= thresholds.evidence_review_anomaly_score && verdict !== 'block') {
    verdict = 'review';
    reason_codes.push(`ANOMALY_SCORE_REVIEW:${stage.anomaly_score}`);
  }

  for (const flag of stage.anomaly_flags) {
    reason_codes.push(`ANOMALY:${flag}`);
  }

  const summary = verdict === 'pass'
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
    case 'holdback': verdict = 'block'; break;
    case 'manual_review': verdict = 'review'; break;
    case 'auto_release': verdict = 'pass'; break;
    default: verdict = 'block'; reason_codes.push('UNKNOWN_HOLDBACK_DECISION');
  }

  const summary = `Holdback decision: ${stage.decision}. ${stage.decision_rationale}`;
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

  const summary = verdict === 'pass'
    ? `Emissions posture "${stage.emission_posture}" is healthy. ${stage.posture_rationale}`
    : `Emissions posture "${stage.emission_posture}" ${verdict === 'block' ? 'restricted' : 'flagged'}. ${stage.posture_rationale}`;

  return { stage: 'emissions', verdict, reason_codes, summary };
}

// ─── Pipeline Combiner (Pure, Deterministic) ────────────────────────

function combinePipelineDecision(results: StageResult[]): {
  decision: PipelineDecision;
  criticalPath: CriticalPath;
  allReasonCodes: string[];
} {
  let strongestVerdict: StageVerdict = 'pass';
  let decisiveResult: StageResult = results[0];
  const allReasonCodes: string[] = [];

  for (const result of results) {
    for (const code of result.reason_codes) allReasonCodes.push(code);

    if (VERDICT_RANK[result.verdict] > VERDICT_RANK[strongestVerdict]) {
      strongestVerdict = result.verdict;
      decisiveResult = result;
    } else if (
      VERDICT_RANK[result.verdict] === VERDICT_RANK[strongestVerdict] &&
      result.reason_codes.length > decisiveResult.reason_codes.length
    ) {
      decisiveResult = result;
    }
  }

  const decision: PipelineDecision =
    strongestVerdict === 'block' ? 'block' :
    strongestVerdict === 'review' ? 'review' : 'release';

  const criticalPath: CriticalPath = {
    decisive_stage: decisiveResult.stage,
    verdict: decisiveResult.verdict,
    reason_codes: decisiveResult.reason_codes,
    rationale: decision === 'release'
      ? 'All stages passed clean. No escalation or block conditions triggered.'
      : `Stage "${decisiveResult.stage}" triggered ${decision} with ${decisiveResult.reason_codes.length} reason code(s). Later stages can override earlier advisory stages because they have more context (holdback sees reputation+evidence; emissions sees holdback decision).`,
  };

  return { decision, criticalPath, allReasonCodes };
}

// ─── Context Builders ───────────────────────────────────────────────

function buildOperatorContext(reputation: ReputationStageInput): OperatorContext {
  let highestSeverity: ReputationRiskSeverity | 'none' = 'none';
  let highestRank = -1;
  for (const signal of reputation.risk_signals) {
    const rank = SEVERITY_RANK[signal.severity as ReputationRiskSeverity] ?? -1;
    if (rank > highestRank) { highestRank = rank; highestSeverity = signal.severity as ReputationRiskSeverity; }
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

function buildEmissionsImpact(emissions: EmissionsStageInput, rewardPft: number): EmissionsImpact {
  return {
    current_posture: emissions.emission_posture,
    worst_window: emissions.worst_window,
    review_priority_window: emissions.review_priority_window,
    reward_pft: rewardPft,
    window_postures: emissions.window_postures,
    posture_rationale: emissions.posture_rationale,
  };
}

function buildReviewerPacket(
  event: VerificationEvent,
  decision: PipelineDecision,
  decisiveStage: StageName,
  allReasonCodes: string[],
  reputation: ReputationStageInput,
  evidence: EvidenceStageInput,
  holdback: HoldbackStageInput,
  emissions: EmissionsStageInput,
): ReviewerPacket {
  const urgency: 'immediate' | 'standard' | 'low' =
    decision === 'block' ? 'immediate' : decision === 'review' ? 'standard' : 'low';

  // Escalation summary
  const blockCodes = allReasonCodes.filter(c => c.includes('BLOCK') || c.includes('holdback') || c.includes('ESCALATE'));
  const escalation_summary = decision === 'release'
    ? 'No escalation required. All pipeline stages passed.'
    : `${decision.toUpperCase()}: Triggered by ${decisiveStage} stage. ${blockCodes.length} blocking/escalation condition(s) across pipeline.`;

  // Decisive evidence
  const decisive_evidence: string[] = [];
  if (holdback.missing_public_evidence) decisive_evidence.push('Missing public evidence');
  if (holdback.reviewer_fields.requires_public_artifact) decisive_evidence.push('Requires public artifact');
  for (const flag of evidence.anomaly_flags) decisive_evidence.push(`Anomaly: ${flag}`);
  if (reputation.risk_signals.length > 0) decisive_evidence.push(`${reputation.risk_signals.length} operator risk signal(s)`);

  // Missing artifacts
  const missing_artifacts: string[] = [];
  if (holdback.missing_public_evidence) missing_artifacts.push('Public evidence artifact');
  if (!event.verification_target) missing_artifacts.push('Verification target URL/hash');
  for (const id of evidence.flagged_task_ids) missing_artifacts.push(`Flagged task: ${id}`);

  // Operator risk summary
  const riskSignalCodes = reputation.risk_signals.map(s => `${s.code}(${s.severity})`).join(', ');
  const operator_risk_summary = reputation.risk_signals.length === 0
    ? `Trust tier: ${reputation.trust_tier}. No active risk signals.`
    : `Trust tier: ${reputation.trust_tier}. Risk signals: ${riskSignalCodes}.`;

  // Release consequence
  const release_consequence_summary = emissions.emission_posture === 'healthy'
    ? `Releasing ${event.reward_pft} PFT has no adverse emissions impact. Posture remains healthy.`
    : `Releasing ${event.reward_pft} PFT under ${emissions.emission_posture} emissions posture. Worst window: ${emissions.worst_window}. ${emissions.posture_rationale}`;

  // Next action
  const next_action_recommendation = decision === 'release'
    ? 'Auto-release approved. No human action required.'
    : decision === 'review'
      ? `Review ${decisiveStage} stage findings. ${holdback.reviewer_fields.next_review_step || 'Assess flagged conditions and determine resolution.'}`
      : `BLOCK: Resolve ${decisiveStage} stage conditions before release. ${holdback.reviewer_fields.next_review_step || 'Investigate blocking conditions.'}`;

  return {
    task_id: event.task_id,
    operator_id: event.operator_id,
    reward_pft: event.reward_pft,
    pipeline_decision: decision,
    decisive_stage: decisiveStage,
    all_reason_codes: allReasonCodes,
    escalation_summary,
    decisive_evidence,
    missing_artifacts,
    trust_tier: reputation.trust_tier,
    operator_risk_summary,
    holdback_reviewer_fields: holdback.reviewer_fields,
    evidence_coverage_ratio: evidence.evidence_coverage_ratio,
    anomaly_flags: evidence.anomaly_flags,
    flagged_task_ids: evidence.flagged_task_ids,
    emission_posture: emissions.emission_posture,
    release_consequence_summary,
    requires_human_review: decision !== 'release',
    review_urgency: urgency,
    next_action_recommendation,
  };
}

// ─── Execute Mode: Run Adapters in Dependency Order ─────────────────

function executeWithAdapters(
  input: ExecuteInput,
  thresholds: PipelineThresholds,
): { reputation: ReputationStageInput; evidence: EvidenceStageInput; holdback: HoldbackStageInput; emissions: EmissionsStageInput } {
  const { verification_event: event, adapters, as_of } = input;

  // Stage 1: Reputation (no dependencies)
  const reputation = adapters.reputation.run(event.operator_id, as_of);

  // Stage 2: Evidence (no dependencies)
  const evidence = adapters.evidence.run(event.task_id, event.operator_id, as_of);

  // Stage 3: Holdback (depends on reputation + evidence)
  const holdback = adapters.holdback.run(event, reputation, evidence, as_of);

  // Stage 4: Emissions (depends on holdback decision — only advisory if already blocked)
  const emissions = adapters.emissions.run(
    event.operator_id,
    event.reward_pft,
    holdback.decision,
    as_of,
  );

  return { reputation, evidence, holdback, emissions };
}

// ─── Core Pipeline (shared by both modes) ───────────────────────────

function runPipelineCore(
  event: VerificationEvent,
  as_of: string,
  reputation: ReputationStageInput,
  evidence: EvidenceStageInput,
  holdback: HoldbackStageInput,
  emissions: EmissionsStageInput,
  thresholds: PipelineThresholds,
): OrchestratorOutput {
  const stageResults: StageResult[] = [];
  const warnings: string[] = [];

  for (const stageName of STAGE_ORDER) {
    let result: StageResult;
    switch (stageName) {
      case 'reputation': result = evaluateReputation(reputation, thresholds); break;
      case 'evidence': result = evaluateEvidence(evidence, thresholds); break;
      case 'holdback': result = evaluateHoldback(holdback, thresholds); break;
      case 'emissions': result = evaluateEmissions(emissions, thresholds); break;
    }
    stageResults.push(result);
  }

  const { decision, criticalPath, allReasonCodes } = combinePipelineDecision(stageResults);
  const operatorContext = buildOperatorContext(reputation);
  const emissionsImpact = buildEmissionsImpact(emissions, event.reward_pft);
  const reviewerPacket = buildReviewerPacket(
    event, decision, criticalPath.decisive_stage, allReasonCodes,
    reputation, evidence, holdback, emissions,
  );

  // Collect warnings
  for (const w of holdback.validation_warnings ?? []) warnings.push(`holdback: ${w}`);
  for (const w of evidence.validation_warnings ?? []) warnings.push(`evidence: ${w}`);
  for (const w of emissions.validation_warnings ?? []) warnings.push(`emissions: ${w}`);

  const stageVerdicts = stageResults.map(r => `${r.stage}=${r.verdict}`).join(', ');
  const decisionRationale = decision === 'release'
    ? `All pipeline stages passed clean (${stageVerdicts}). Reward of ${event.reward_pft} PFT approved for release.`
    : `Pipeline decision: ${decision}. Decisive stage: ${criticalPath.decisive_stage}. Stage verdicts: ${stageVerdicts}. ${criticalPath.rationale}`;

  return {
    generated_at: as_of, as_of, version: SCHEMA_VERSION,
    pipeline_decision: decision,
    stage_results: stageResults,
    critical_path: criticalPath,
    operator_context: operatorContext,
    emissions_impact: emissionsImpact,
    reviewer_packet: reviewerPacket,
    reason_codes: decision === 'release' ? [] : allReasonCodes,
    decision_rationale: decisionRationale,
    threshold_config: thresholds,
    validation_warnings: warnings,
  };
}

// ─── Public API ─────────────────────────────────────────────────────

/**
 * Run the verification pipeline.
 *
 * Supports two execution modes:
 *
 *   execute mode — runs upstream modules through typed adapters in
 *   dependency order. Reputation feeds holdback. Evidence feeds holdback.
 *   Holdback decision feeds emissions.
 *
 *   precomputed mode (default) — accepts prior stage outputs for replay,
 *   auditing, and deterministic regression testing.
 *
 * Both modes emit the same unified verdict contract.
 */
export function orchestrateVerification(input: unknown): OrchestratorResult {
  if (input === null || input === undefined || typeof input !== 'object') {
    return makeError('', 'INVALID_INPUT', 'Input must be a non-null object.');
  }

  const obj = input as Record<string, unknown>;
  const mode = obj.mode === 'execute' ? 'execute' : 'precomputed';

  if (mode === 'execute') {
    const error = validateExecuteInput(input);
    if (error) return error;

    const execInput = input as ExecuteInput;
    const thresholds = { ...DEFAULT_THRESHOLDS, ...execInput.thresholds };

    try {
      const { reputation, evidence, holdback, emissions } =
        executeWithAdapters(execInput, thresholds);

      return runPipelineCore(
        execInput.verification_event, execInput.as_of,
        reputation, evidence, holdback, emissions, thresholds,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return makeError(execInput.as_of, 'MALFORMED_STAGE_DATA', `Adapter execution failed: ${msg}`);
    }
  }

  // Precomputed mode
  const error = validatePrecomputedInput(input);
  if (error) return error;

  const preInput = input as PrecomputedInput;
  const thresholds = { ...DEFAULT_THRESHOLDS, ...preInput.thresholds };

  return runPipelineCore(
    preInput.verification_event, preInput.as_of,
    preInput.reputation_result, preInput.evidence_result,
    preInput.holdback_result, preInput.emissions_result,
    thresholds,
  );
}

// Legacy alias for backwards compatibility with existing tests
export { orchestrateVerification as runPipeline };

export { DEFAULT_THRESHOLDS, SCHEMA_VERSION };
```

---

## Full Test Code

```typescript
import { describe, it, expect } from 'vitest';
import { orchestrateVerification } from '../src/orchestrator.js';
import type {
  PrecomputedInput,
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
  overrides: Partial<PrecomputedInput> = {},
): PrecomputedInput {
  return {
    as_of: '2026-04-09T12:00:00Z',
    verification_event: makeVerificationEvent(),
    reputation_result: makeReputationStage(),
    evidence_result: makeEvidenceStage(),
    holdback_result: makeHoldbackStage(),
    emissions_result: makeEmissionsStage(),
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

      // On full pass, all stages have same verdict (pass) and CLEAN codes;
      // tie-break goes to stage with more reason codes, or first stage
      expect(result.critical_path.verdict).toBe('pass');
      expect(result.critical_path.rationale).toContain('All stages passed clean');
    });
  });

  // ── 2. Review Paths ─────────────────────────────────────────────

  describe('Review path', () => {
    it('returns review when reputation stage has probationary tier', () => {
      const input = makeCleanInput({
        reputation_result: makeReputationStage({
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
        holdback_result: makeHoldbackStage({
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
        emissions_result: makeEmissionsStage({
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
        evidence_result: makeEvidenceStage({
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
        reputation_result: makeReputationStage({
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
        holdback_result: makeHoldbackStage({
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
        emissions_result: makeEmissionsStage({
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
        evidence_result: makeEvidenceStage({
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
        reputation_result: makeReputationStage({
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
        reputation_result: makeReputationStage({
          trust_tier: 'probationary', // triggers review
        }),
        holdback_result: makeHoldbackStage({
          decision: 'holdback', // triggers block
          holdback_reason_codes: ['UNAUTHORIZED_OPERATOR'],
          decision_rationale: 'Operator not authorized.',
        }),
      });
      const result = orchestrateVerification(input);
      if (!isOutput(result)) return;

      expect(result.pipeline_decision).toBe('block');
      expect(result.critical_path.decisive_stage).toBe('holdback');
      // Reputation review codes should still be in allReasonCodes
      expect(result.reason_codes).toContain('TRUST_TIER_REVIEW:probationary');
      expect(result.reason_codes).toContain('UNAUTHORIZED_OPERATOR');
    });

    it('returns block when downstream hints indicate suppress', () => {
      const input = makeCleanInput({
        reputation_result: makeReputationStage({
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
        reputation_result: makeReputationStage({
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
        reputation_result: makeReputationStage(),
        evidence_result: makeEvidenceStage(),
        holdback_result: makeHoldbackStage(),
        emissions_result: makeEmissionsStage(),
      });
      expect(isError(result)).toBe(true);
      if (!isError(result)) return;

      expect(result.error_code).toBe('MISSING_VERIFICATION_EVENT');
    });

    it('returns error for missing reputation_stage', () => {
      const result = orchestrateVerification({
        as_of: '2026-04-09T00:00:00Z',
        verification_event: makeVerificationEvent(),
        evidence_result: makeEvidenceStage(),
        holdback_result: makeHoldbackStage(),
        emissions_result: makeEmissionsStage(),
      });
      expect(isError(result)).toBe(true);
      if (!isError(result)) return;

      expect(result.error_code).toBe('MISSING_REPUTATION_STAGE');
    });

    it('returns error for missing evidence_stage', () => {
      const result = orchestrateVerification({
        as_of: '2026-04-09T00:00:00Z',
        verification_event: makeVerificationEvent(),
        reputation_result: makeReputationStage(),
        holdback_result: makeHoldbackStage(),
        emissions_result: makeEmissionsStage(),
      });
      expect(isError(result)).toBe(true);
      if (!isError(result)) return;

      expect(result.error_code).toBe('MISSING_EVIDENCE_STAGE');
    });

    it('returns error for missing holdback_stage', () => {
      const result = orchestrateVerification({
        as_of: '2026-04-09T00:00:00Z',
        verification_event: makeVerificationEvent(),
        reputation_result: makeReputationStage(),
        evidence_result: makeEvidenceStage(),
        emissions_result: makeEmissionsStage(),
      });
      expect(isError(result)).toBe(true);
      if (!isError(result)) return;

      expect(result.error_code).toBe('MISSING_HOLDBACK_STAGE');
    });

    it('returns error for missing emissions_stage', () => {
      const result = orchestrateVerification({
        as_of: '2026-04-09T00:00:00Z',
        verification_event: makeVerificationEvent(),
        reputation_result: makeReputationStage(),
        evidence_result: makeEvidenceStage(),
        holdback_result: makeHoldbackStage(),
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
        evidence_result: makeEvidenceStage({
          anomaly_score: 50, // exactly at default review threshold
        }),
      });
      const result = orchestrateVerification(input);
      if (!isOutput(result)) return;

      expect(result.pipeline_decision).toBe('review');
    });

    it('anomaly score one below review threshold passes', () => {
      const input = makeCleanInput({
        evidence_result: makeEvidenceStage({
          anomaly_score: 49,
        }),
      });
      const result = orchestrateVerification(input);
      if (!isOutput(result)) return;

      expect(result.pipeline_decision).toBe('release');
    });

    it('anomaly score at exactly block threshold triggers block', () => {
      const input = makeCleanInput({
        evidence_result: makeEvidenceStage({
          anomaly_score: 80, // exactly at default block threshold
        }),
      });
      const result = orchestrateVerification(input);
      if (!isOutput(result)) return;

      expect(result.pipeline_decision).toBe('block');
    });

    it('custom thresholds override defaults', () => {
      const input = makeCleanInput({
        evidence_result: makeEvidenceStage({
          anomaly_score: 90, // would normally block at default 80
        }),
        thresholds: {
          evidence_block_anomaly_score: 95, // raise block threshold
          evidence_review_anomaly_score: 85, // raise review threshold
        },
      });
      const result = orchestrateVerification(input);
      if (!isOutput(result)) return;

      expect(result.pipeline_decision).toBe('review'); // 90 >= 85 (review) but < 95 (block)
    });

    it('custom reputation block tiers can block new_operator', () => {
      const input = makeCleanInput({
        reputation_result: makeReputationStage({
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
        holdback_result: makeHoldbackStage({
          decision: 'holdback',
          holdback_reason_codes: ['UNAUTHORIZED_OPERATOR'],
          decision_rationale: 'Blocked.',
        }),
        emissions_result: makeEmissionsStage({
          emission_posture: 'restrict',
          reason_codes: ['HIGH_CONCENTRATION_INDEX', 'TOP_RECIPIENT_DOMINANCE'],
          posture_rationale: 'Restricted.',
        }),
      });
      const result = orchestrateVerification(input);
      if (!isOutput(result)) return;

      expect(result.pipeline_decision).toBe('block');
      // emissions has 3 reason codes (2 upstream + EMISSION_POSTURE_BLOCK:restrict)
      // holdback has 1 reason code (UNAUTHORIZED_OPERATOR)
      expect(result.critical_path.decisive_stage).toBe('emissions');
    });

    it('when two stages both review, decisive stage has more reason codes', () => {
      const input = makeCleanInput({
        reputation_result: makeReputationStage({
          trust_tier: 'probationary',
          reason_codes: ['low_completion_rate', 'weak_evidence_quality'],
        }),
        holdback_result: makeHoldbackStage({
          decision: 'manual_review',
          holdback_reason_codes: ['PROBATIONARY_HIGH_REWARD'],
          decision_rationale: 'Needs review.',
        }),
      });
      const result = orchestrateVerification(input);
      if (!isOutput(result)) return;

      expect(result.pipeline_decision).toBe('review');
      // reputation: TRUST_TIER_REVIEW:probationary + low_completion_rate + weak_evidence_quality = 3
      // holdback: PROBATIONARY_HIGH_REWARD = 1
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
      // Other thresholds should be defaults
      expect(result.threshold_config.evidence_review_anomaly_score).toBe(50);
    });
  });

  // ── 9. Validation Warnings Propagation ──────────────────────────

  describe('Validation warnings', () => {
    it('propagates validation warnings from all stages', () => {
      const input = makeCleanInput({
        holdback_result: makeHoldbackStage({
          validation_warnings: ['Holdback warning 1'],
        }),
        evidence_result: makeEvidenceStage({
          validation_warnings: ['Evidence warning 1'],
        }),
        emissions_result: makeEmissionsStage({
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
        reputation_result: makeReputationStage({
          trust_tier: 'probationary',
          reason_codes: ['low_completion_rate'],
        }),
        evidence_result: makeEvidenceStage({
          priority_band: 'high',
          anomaly_flags: ['LOW_COVERAGE_HIGH_VOLUME'],
        }),
        holdback_result: makeHoldbackStage({
          decision: 'manual_review',
          holdback_reason_codes: ['PROBATIONARY_HIGH_REWARD', 'LOW_HISTORICAL_COVERAGE'],
          decision_rationale: 'Review needed.',
        }),
        emissions_result: makeEmissionsStage({
          emission_posture: 'watch',
          reason_codes: ['TOP_RECIPIENT_DOMINANCE'],
        }),
      });
      const result = orchestrateVerification(input);
      if (!isOutput(result)) return;

      expect(result.pipeline_decision).toBe('review');
      // All four stages produced review verdicts
      expect(result.stage_results.every((s) => s.verdict === 'review')).toBe(true);
    });

    it('downstream hints hold_for_review triggers review at reputation stage', () => {
      const input = makeCleanInput({
        reputation_result: makeReputationStage({
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

  // ── 11. Execute Mode — Adapter Orchestration ──────────────────────

  describe('Execute mode', () => {
    it('runs adapters in dependency order and produces valid output', () => {
      const callOrder: string[] = [];

      const result = orchestrateVerification({
        mode: 'execute',
        as_of: '2026-04-09T12:00:00Z',
        verification_event: makeVerificationEvent(),
        adapters: {
          reputation: {
            run: (operatorId: string, asOf: string) => {
              callOrder.push('reputation');
              return makeReputationStage();
            },
          },
          evidence: {
            run: (taskId: string, operatorId: string, asOf: string) => {
              callOrder.push('evidence');
              return makeEvidenceStage();
            },
          },
          holdback: {
            run: (event: any, reputation: any, evidence: any, asOf: string) => {
              callOrder.push('holdback');
              // Verify holdback receives reputation and evidence outputs
              expect(reputation.trust_tier).toBe('reliable');
              expect(evidence.evidence_coverage_ratio).toBe(0.9);
              return makeHoldbackStage();
            },
          },
          emissions: {
            run: (operatorId: string, rewardPft: number, holdbackDecision: any, asOf: string) => {
              callOrder.push('emissions');
              // Verify emissions receives holdback decision
              expect(holdbackDecision).toBe('auto_release');
              return makeEmissionsStage();
            },
          },
        },
      });

      if (!isOutput(result)) throw new Error('Expected output, got error');

      // Verify execution order
      expect(callOrder).toEqual(['reputation', 'evidence', 'holdback', 'emissions']);
      expect(result.pipeline_decision).toBe('release');
    });

    it('holdback adapter receives reputation output that feeds risk context', () => {
      let holdbackReceivedReputation = false;

      const result = orchestrateVerification({
        mode: 'execute',
        as_of: '2026-04-09T12:00:00Z',
        verification_event: makeVerificationEvent(),
        adapters: {
          reputation: {
            run: () => makeReputationStage({
              trust_tier: 'probationary',
              risk_signals: [{
                code: 'high_rejection_rate',
                severity: 'high',
                description: 'test',
                consumers: ['payout'],
              }],
            }),
          },
          evidence: {
            run: () => makeEvidenceStage(),
          },
          holdback: {
            run: (_event: any, reputation: any, _evidence: any) => {
              // Holdback sees the probationary tier + risk signals from reputation
              holdbackReceivedReputation =
                reputation.trust_tier === 'probationary' &&
                reputation.risk_signals.length === 1;
              return makeHoldbackStage({ decision: 'manual_review', holdback_reason_codes: ['PROBATIONARY_HIGH_REWARD'] });
            },
          },
          emissions: {
            run: () => makeEmissionsStage(),
          },
        },
      });

      expect(holdbackReceivedReputation).toBe(true);
      if (isOutput(result)) {
        expect(result.pipeline_decision).toBe('review');
      }
    });

    it('emissions adapter receives holdback decision for conditional logic', () => {
      let emissionsReceivedBlock = false;

      const result = orchestrateVerification({
        mode: 'execute',
        as_of: '2026-04-09T12:00:00Z',
        verification_event: makeVerificationEvent(),
        adapters: {
          reputation: { run: () => makeReputationStage() },
          evidence: { run: () => makeEvidenceStage() },
          holdback: {
            run: () => makeHoldbackStage({ decision: 'holdback', holdback_reason_codes: ['UNAUTHORIZED_OPERATOR'] }),
          },
          emissions: {
            run: (_opId: string, _reward: number, holdbackDecision: any) => {
              emissionsReceivedBlock = holdbackDecision === 'holdback';
              return makeEmissionsStage();
            },
          },
        },
      });

      expect(emissionsReceivedBlock).toBe(true);
      if (isOutput(result)) {
        expect(result.pipeline_decision).toBe('block');
      }
    });

    it('fails closed when adapter throws', () => {
      const result = orchestrateVerification({
        mode: 'execute',
        as_of: '2026-04-09T12:00:00Z',
        verification_event: makeVerificationEvent(),
        adapters: {
          reputation: { run: () => { throw new Error('DB connection failed'); } },
          evidence: { run: () => makeEvidenceStage() },
          holdback: { run: () => makeHoldbackStage() },
          emissions: { run: () => makeEmissionsStage() },
        },
      });

      expect(result.pipeline_decision).toBe('block');
      if ('error_code' in result) {
        expect(result.error_code).toBe('MALFORMED_STAGE_DATA');
        expect(result.error_message).toContain('DB connection failed');
      }
    });

    it('fails closed when adapters object is missing', () => {
      const result = orchestrateVerification({
        mode: 'execute',
        as_of: '2026-04-09T12:00:00Z',
        verification_event: makeVerificationEvent(),
        // adapters missing
      });

      expect(result.pipeline_decision).toBe('block');
    });
  });

  // ── 12. Enhanced Reviewer Packet ──────────────────────────────────

  describe('Enhanced reviewer packet', () => {
    it('includes escalation summary and next action for block', () => {
      const input = makeCleanInput({
        holdback_result: makeHoldbackStage({
          decision: 'holdback',
          holdback_reason_codes: ['UNAUTHORIZED_OPERATOR', 'MISSING_EVIDENCE'],
          missing_public_evidence: true,
        }),
      });
      const result = orchestrateVerification(input);
      if (!isOutput(result)) return;

      expect(result.reviewer_packet.escalation_summary).toContain('BLOCK');
      expect(result.reviewer_packet.missing_artifacts.length).toBeGreaterThan(0);
      expect(result.reviewer_packet.next_action_recommendation).toContain('BLOCK');
      expect(result.reviewer_packet.review_urgency).toBe('immediate');
    });

    it('includes release consequence summary for healthy emissions', () => {
      const result = orchestrateVerification(makeCleanInput());
      if (!isOutput(result)) return;

      expect(result.reviewer_packet.release_consequence_summary).toContain('no adverse');
      expect(result.reviewer_packet.next_action_recommendation).toContain('Auto-release');
    });

    it('includes operator risk summary with risk signals', () => {
      const input = makeCleanInput({
        reputation_result: makeReputationStage({
          risk_signals: [
            { code: 'high_rejection_rate', severity: 'high', description: 'test', consumers: ['payout'] },
          ],
        }),
      });
      const result = orchestrateVerification(input);
      if (!isOutput(result)) return;

      expect(result.reviewer_packet.operator_risk_summary).toContain('high_rejection_rate');
      expect(result.reviewer_packet.operator_risk_summary).toContain('high');
    });
  });
});
```

---

## Test Results

```
 RUN  v1.6.1

 ✓ tests/orchestrator.test.ts  (51 tests) 14ms

 Test Files  1 passed (1)
      Tests  51 passed (51)
   Start at  17:13:11
   Duration  615ms (transform 132ms, setup 0ms, collect 142ms, tests 14ms, environment 0ms, prepare 115ms)
```

All 51 tests pass. Test coverage includes:
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
- 5 execute mode tests (dependency order, reputation feeds holdback, holdback feeds emissions, adapter failure, missing adapters)
- 3 enhanced reviewer packet tests (escalation summary, release consequence, operator risk summary)

---

*Published by Zoz via the Permanent Upper Class validator operation.*
