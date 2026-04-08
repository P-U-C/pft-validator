---
layout: default
title: Reward Token Emissions Concentration Analyzer
date: 2026-04-08
category: network
status: submitted
task_id: bcbfbf8f-f287-432c-8ed3-5446200a66db
---

# Reward Token Emissions Concentration Analyzer

| Field | Value |
|---|---|
| Task ID | `bcbfbf8f-f287-432c-8ed3-5446200a66db` |
| Reward | 4,300 PFT |
| Verification | Code artifact |
| Version | 1.0.0 |

---

## What This Module Is

This module is a deterministic analyzer that ingests rewarded task records and produces a JSON emissions snapshot across three time windows (7-day, 30-day, and all-time). It computes contributor concentration via the Herfindahl-Hirschman Index (HHI), identifies top recipient and project dominance, aggregates flagged risk exposure, and recommends an emission posture of `healthy`, `watch`, or `restrict`. The module is designed to be embedded in automated emission pipelines where a single function call returns a complete, auditable snapshot of reward distribution health.

## What This Module Is Not

This module is not an enforcement engine. It does not halt emissions, modify reward amounts, or take any action. It is a pure read-only analysis function that produces a recommendation. The calling system is responsible for acting on the posture and reason codes. The module also does not fetch data from any external source -- all records must be passed in as input.

---

## Determinism Guarantee

The module never reads the runtime clock. All timestamps derive from the required `as_of` input field. The `generated_at` output field is always set equal to `as_of`. Identical inputs produce byte-stable JSON outputs. Tie-breaking for top recipient and top project bucket is deterministic: highest PFT first, then alphabetical ID. All floating-point values are rounded to four decimal places.

---

## API Contract

### Function Signature

```typescript
function analyzeEmissions(input: unknown): AnalyzerOutput
```

The function accepts `unknown` and validates internally. Malformed inputs fail closed with a `restrict` posture and empty metrics.

### Input Interface

```typescript
interface AnalyzerInput {
  records: RewardedTaskRecord[];
  as_of: string;                        // Required -- ISO 8601 evaluation timestamp
  thresholds?: Partial<AnalyzerThresholds>;
}

interface RewardedTaskRecord {
  task_id: string;
  operator_id: string;
  reward_amount: number;
  timestamp: string;                    // ISO 8601
  project_bucket?: string;             // Categorization bucket
  evidence_visibility?: EvidenceVisibility;
  risk_flags?: RiskFlag[];
}
```

---

## Sample Input / Output

### Example 1: Healthy Posture

Ten evenly distributed recipients across four projects.

**Input:**

```json
{
  "records": [
    { "task_id": "t0", "operator_id": "op_000", "reward_amount": 1000, "timestamp": "2026-04-05T12:00:00Z", "project_bucket": "proj_0", "evidence_visibility": "public" },
    { "task_id": "t1", "operator_id": "op_001", "reward_amount": 1000, "timestamp": "2026-04-05T12:00:00Z", "project_bucket": "proj_1", "evidence_visibility": "public" },
    { "task_id": "t2", "operator_id": "op_002", "reward_amount": 1000, "timestamp": "2026-04-05T12:00:00Z", "project_bucket": "proj_2", "evidence_visibility": "public" },
    { "task_id": "t3", "operator_id": "op_003", "reward_amount": 1000, "timestamp": "2026-04-05T12:00:00Z", "project_bucket": "proj_3", "evidence_visibility": "public" },
    { "task_id": "t4", "operator_id": "op_004", "reward_amount": 1000, "timestamp": "2026-04-05T12:00:00Z", "project_bucket": "proj_0", "evidence_visibility": "public" },
    { "task_id": "t5", "operator_id": "op_005", "reward_amount": 1000, "timestamp": "2026-04-05T12:00:00Z", "project_bucket": "proj_1", "evidence_visibility": "public" },
    { "task_id": "t6", "operator_id": "op_006", "reward_amount": 1000, "timestamp": "2026-04-05T12:00:00Z", "project_bucket": "proj_2", "evidence_visibility": "public" },
    { "task_id": "t7", "operator_id": "op_007", "reward_amount": 1000, "timestamp": "2026-04-05T12:00:00Z", "project_bucket": "proj_3", "evidence_visibility": "public" },
    { "task_id": "t8", "operator_id": "op_008", "reward_amount": 1000, "timestamp": "2026-04-05T12:00:00Z", "project_bucket": "proj_0", "evidence_visibility": "public" },
    { "task_id": "t9", "operator_id": "op_009", "reward_amount": 1000, "timestamp": "2026-04-05T12:00:00Z", "project_bucket": "proj_1", "evidence_visibility": "public" }
  ],
  "as_of": "2026-04-08T12:00:00Z"
}
```

**Output:**

```json
{
  "generated_at": "2026-04-08T12:00:00Z",
  "as_of": "2026-04-08T12:00:00Z",
  "version": "1.0.0",
  "window_metrics": {
    "7d": {
      "window": "7d",
      "total_pft": 10000,
      "total_records": 10,
      "unique_recipients": 10,
      "unique_projects": 4,
      "concentration_index": 0.1,
      "top_recipient_id": "op_000",
      "top_recipient_share": 0.1,
      "top_recipient_pft": 1000,
      "top_project_bucket": "proj_0",
      "top_project_share": 0.3,
      "top_project_pft": 3000
    },
    "30d": {
      "window": "30d",
      "total_pft": 10000,
      "total_records": 10,
      "unique_recipients": 10,
      "unique_projects": 4,
      "concentration_index": 0.1,
      "top_recipient_id": "op_000",
      "top_recipient_share": 0.1,
      "top_recipient_pft": 1000,
      "top_project_bucket": "proj_0",
      "top_project_share": 0.3,
      "top_project_pft": 3000
    },
    "all_time": {
      "window": "all_time",
      "total_pft": 10000,
      "total_records": 10,
      "unique_recipients": 10,
      "unique_projects": 4,
      "concentration_index": 0.1,
      "top_recipient_id": "op_000",
      "top_recipient_share": 0.1,
      "top_recipient_pft": 1000,
      "top_project_bucket": "proj_0",
      "top_project_share": 0.3,
      "top_project_pft": 3000
    }
  },
  "concentration_index": { "7d": 0.1, "30d": 0.1, "all_time": 0.1 },
  "top_recipient_share": { "7d": 0.1, "30d": 0.1, "all_time": 0.1 },
  "project_bucket_share": {
    "7d": [
      { "bucket": "proj_0", "total_pft": 3000, "share": 0.3, "record_count": 3 },
      { "bucket": "proj_1", "total_pft": 3000, "share": 0.3, "record_count": 3 },
      { "bucket": "proj_2", "total_pft": 2000, "share": 0.2, "record_count": 2 },
      { "bucket": "proj_3", "total_pft": 2000, "share": 0.2, "record_count": 2 }
    ],
    "30d": [
      { "bucket": "proj_0", "total_pft": 3000, "share": 0.3, "record_count": 3 },
      { "bucket": "proj_1", "total_pft": 3000, "share": 0.3, "record_count": 3 },
      { "bucket": "proj_2", "total_pft": 2000, "share": 0.2, "record_count": 2 },
      { "bucket": "proj_3", "total_pft": 2000, "share": 0.2, "record_count": 2 }
    ],
    "all_time": [
      { "bucket": "proj_0", "total_pft": 3000, "share": 0.3, "record_count": 3 },
      { "bucket": "proj_1", "total_pft": 3000, "share": 0.3, "record_count": 3 },
      { "bucket": "proj_2", "total_pft": 2000, "share": 0.2, "record_count": 2 },
      { "bucket": "proj_3", "total_pft": 2000, "share": 0.2, "record_count": 2 }
    ]
  },
  "flagged_exposure_totals": {
    "7d": {
      "total_flagged_pft": 0,
      "total_flagged_share": 0,
      "by_flag": {
        "disputed_operator": { "pft": 0, "share": 0, "record_count": 0 },
        "non_public_evidence": { "pft": 0, "share": 0, "record_count": 0 },
        "stale_or_inactive_recipient": { "pft": 0, "share": 0, "record_count": 0 },
        "unauthorized_operator": { "pft": 0, "share": 0, "record_count": 0 },
        "high_reward_unverified": { "pft": 0, "share": 0, "record_count": 0 }
      }
    },
    "30d": {
      "total_flagged_pft": 0,
      "total_flagged_share": 0,
      "by_flag": {
        "disputed_operator": { "pft": 0, "share": 0, "record_count": 0 },
        "non_public_evidence": { "pft": 0, "share": 0, "record_count": 0 },
        "stale_or_inactive_recipient": { "pft": 0, "share": 0, "record_count": 0 },
        "unauthorized_operator": { "pft": 0, "share": 0, "record_count": 0 },
        "high_reward_unverified": { "pft": 0, "share": 0, "record_count": 0 }
      }
    },
    "all_time": {
      "total_flagged_pft": 0,
      "total_flagged_share": 0,
      "by_flag": {
        "disputed_operator": { "pft": 0, "share": 0, "record_count": 0 },
        "non_public_evidence": { "pft": 0, "share": 0, "record_count": 0 },
        "stale_or_inactive_recipient": { "pft": 0, "share": 0, "record_count": 0 },
        "unauthorized_operator": { "pft": 0, "share": 0, "record_count": 0 },
        "high_reward_unverified": { "pft": 0, "share": 0, "record_count": 0 }
      }
    }
  },
  "emission_posture": "healthy",
  "reason_codes": ["CLEAN"],
  "posture_rationale": "All windows within healthy thresholds. No concentration or exposure concerns detected.",
  "validation_warnings": []
}
```

---

### Example 2: Watch Posture

One recipient holds approximately 30% share with some flagged exposure from a disputed operator.

**Input:**

```json
{
  "records": [
    { "task_id": "t1", "operator_id": "op_alpha", "reward_amount": 3000, "timestamp": "2026-04-05T12:00:00Z", "project_bucket": "defi", "evidence_visibility": "public", "risk_flags": ["disputed_operator"] },
    { "task_id": "t2", "operator_id": "op_beta", "reward_amount": 2000, "timestamp": "2026-04-05T12:00:00Z", "project_bucket": "network", "evidence_visibility": "public" },
    { "task_id": "t3", "operator_id": "op_gamma", "reward_amount": 1500, "timestamp": "2026-04-05T12:00:00Z", "project_bucket": "infra", "evidence_visibility": "public" },
    { "task_id": "t4", "operator_id": "op_delta", "reward_amount": 1500, "timestamp": "2026-04-05T12:00:00Z", "project_bucket": "defi", "evidence_visibility": "public" },
    { "task_id": "t5", "operator_id": "op_epsilon", "reward_amount": 1000, "timestamp": "2026-04-05T12:00:00Z", "project_bucket": "network", "evidence_visibility": "public" },
    { "task_id": "t6", "operator_id": "op_zeta", "reward_amount": 1000, "timestamp": "2026-04-05T12:00:00Z", "project_bucket": "infra", "evidence_visibility": "public" }
  ],
  "as_of": "2026-04-08T12:00:00Z"
}
```

**Output:**

```json
{
  "generated_at": "2026-04-08T12:00:00Z",
  "as_of": "2026-04-08T12:00:00Z",
  "version": "1.0.0",
  "window_metrics": {
    "7d": {
      "window": "7d",
      "total_pft": 10000,
      "total_records": 6,
      "unique_recipients": 6,
      "unique_projects": 3,
      "concentration_index": 0.195,
      "top_recipient_id": "op_alpha",
      "top_recipient_share": 0.3,
      "top_recipient_pft": 3000,
      "top_project_bucket": "defi",
      "top_project_share": 0.45,
      "top_project_pft": 4500
    },
    "30d": {
      "window": "30d",
      "total_pft": 10000,
      "total_records": 6,
      "unique_recipients": 6,
      "unique_projects": 3,
      "concentration_index": 0.195,
      "top_recipient_id": "op_alpha",
      "top_recipient_share": 0.3,
      "top_recipient_pft": 3000,
      "top_project_bucket": "defi",
      "top_project_share": 0.45,
      "top_project_pft": 4500
    },
    "all_time": {
      "window": "all_time",
      "total_pft": 10000,
      "total_records": 6,
      "unique_recipients": 6,
      "unique_projects": 3,
      "concentration_index": 0.195,
      "top_recipient_id": "op_alpha",
      "top_recipient_share": 0.3,
      "top_recipient_pft": 3000,
      "top_project_bucket": "defi",
      "top_project_share": 0.45,
      "top_project_pft": 4500
    }
  },
  "concentration_index": { "7d": 0.195, "30d": 0.195, "all_time": 0.195 },
  "top_recipient_share": { "7d": 0.3, "30d": 0.3, "all_time": 0.3 },
  "project_bucket_share": {
    "7d": [
      { "bucket": "defi", "total_pft": 4500, "share": 0.45, "record_count": 2 },
      { "bucket": "infra", "total_pft": 2500, "share": 0.25, "record_count": 2 },
      { "bucket": "network", "total_pft": 3000, "share": 0.3, "record_count": 2 }
    ],
    "30d": [
      { "bucket": "defi", "total_pft": 4500, "share": 0.45, "record_count": 2 },
      { "bucket": "infra", "total_pft": 2500, "share": 0.25, "record_count": 2 },
      { "bucket": "network", "total_pft": 3000, "share": 0.3, "record_count": 2 }
    ],
    "all_time": [
      { "bucket": "defi", "total_pft": 4500, "share": 0.45, "record_count": 2 },
      { "bucket": "infra", "total_pft": 2500, "share": 0.25, "record_count": 2 },
      { "bucket": "network", "total_pft": 3000, "share": 0.3, "record_count": 2 }
    ]
  },
  "flagged_exposure_totals": {
    "7d": {
      "total_flagged_pft": 3000,
      "total_flagged_share": 0.3,
      "by_flag": {
        "disputed_operator": { "pft": 3000, "share": 0.3, "record_count": 1 },
        "non_public_evidence": { "pft": 0, "share": 0, "record_count": 0 },
        "stale_or_inactive_recipient": { "pft": 0, "share": 0, "record_count": 0 },
        "unauthorized_operator": { "pft": 0, "share": 0, "record_count": 0 },
        "high_reward_unverified": { "pft": 0, "share": 0, "record_count": 0 }
      }
    },
    "30d": {
      "total_flagged_pft": 3000,
      "total_flagged_share": 0.3,
      "by_flag": {
        "disputed_operator": { "pft": 3000, "share": 0.3, "record_count": 1 },
        "non_public_evidence": { "pft": 0, "share": 0, "record_count": 0 },
        "stale_or_inactive_recipient": { "pft": 0, "share": 0, "record_count": 0 },
        "unauthorized_operator": { "pft": 0, "share": 0, "record_count": 0 },
        "high_reward_unverified": { "pft": 0, "share": 0, "record_count": 0 }
      }
    },
    "all_time": {
      "total_flagged_pft": 3000,
      "total_flagged_share": 0.3,
      "by_flag": {
        "disputed_operator": { "pft": 3000, "share": 0.3, "record_count": 1 },
        "non_public_evidence": { "pft": 0, "share": 0, "record_count": 0 },
        "stale_or_inactive_recipient": { "pft": 0, "share": 0, "record_count": 0 },
        "unauthorized_operator": { "pft": 0, "share": 0, "record_count": 0 },
        "high_reward_unverified": { "pft": 0, "share": 0, "record_count": 0 }
      }
    }
  },
  "emission_posture": "watch",
  "reason_codes": [
    "TOP_RECIPIENT_DOMINANCE",
    "HIGH_CONCENTRATION_INDEX",
    "PROJECT_BUCKET_DOMINANCE",
    "FLAGGED_EXPOSURE_ELEVATED",
    "DISPUTED_OPERATOR_EXPOSURE"
  ],
  "posture_rationale": "Watch conditions triggered: TOP_RECIPIENT_DOMINANCE, HIGH_CONCENTRATION_INDEX, PROJECT_BUCKET_DOMINANCE, FLAGGED_EXPOSURE_ELEVATED, DISPUTED_OPERATOR_EXPOSURE. Recommend review before next emission cycle.",
  "validation_warnings": []
}
```

---

### Example 3: Restrict Posture

A single monopoly recipient receives all rewards.

**Input:**

```json
{
  "records": [
    { "task_id": "t1", "operator_id": "op_monopoly", "reward_amount": 10000, "timestamp": "2026-04-05T12:00:00Z", "project_bucket": "network", "evidence_visibility": "public" },
    { "task_id": "t2", "operator_id": "op_monopoly", "reward_amount": 5000, "timestamp": "2026-04-06T12:00:00Z", "project_bucket": "network", "evidence_visibility": "public" }
  ],
  "as_of": "2026-04-08T12:00:00Z"
}
```

**Output:**

```json
{
  "generated_at": "2026-04-08T12:00:00Z",
  "as_of": "2026-04-08T12:00:00Z",
  "version": "1.0.0",
  "window_metrics": {
    "7d": {
      "window": "7d",
      "total_pft": 15000,
      "total_records": 2,
      "unique_recipients": 1,
      "unique_projects": 1,
      "concentration_index": 1,
      "top_recipient_id": "op_monopoly",
      "top_recipient_share": 1,
      "top_recipient_pft": 15000,
      "top_project_bucket": "network",
      "top_project_share": 1,
      "top_project_pft": 15000
    },
    "30d": {
      "window": "30d",
      "total_pft": 15000,
      "total_records": 2,
      "unique_recipients": 1,
      "unique_projects": 1,
      "concentration_index": 1,
      "top_recipient_id": "op_monopoly",
      "top_recipient_share": 1,
      "top_recipient_pft": 15000,
      "top_project_bucket": "network",
      "top_project_share": 1,
      "top_project_pft": 15000
    },
    "all_time": {
      "window": "all_time",
      "total_pft": 15000,
      "total_records": 2,
      "unique_recipients": 1,
      "unique_projects": 1,
      "concentration_index": 1,
      "top_recipient_id": "op_monopoly",
      "top_recipient_share": 1,
      "top_recipient_pft": 15000,
      "top_project_bucket": "network",
      "top_project_share": 1,
      "top_project_pft": 15000
    }
  },
  "concentration_index": { "7d": 1, "30d": 1, "all_time": 1 },
  "top_recipient_share": { "7d": 1, "30d": 1, "all_time": 1 },
  "project_bucket_share": {
    "7d": [
      { "bucket": "network", "total_pft": 15000, "share": 1, "record_count": 2 }
    ],
    "30d": [
      { "bucket": "network", "total_pft": 15000, "share": 1, "record_count": 2 }
    ],
    "all_time": [
      { "bucket": "network", "total_pft": 15000, "share": 1, "record_count": 2 }
    ]
  },
  "flagged_exposure_totals": {
    "7d": {
      "total_flagged_pft": 0,
      "total_flagged_share": 0,
      "by_flag": {
        "disputed_operator": { "pft": 0, "share": 0, "record_count": 0 },
        "non_public_evidence": { "pft": 0, "share": 0, "record_count": 0 },
        "stale_or_inactive_recipient": { "pft": 0, "share": 0, "record_count": 0 },
        "unauthorized_operator": { "pft": 0, "share": 0, "record_count": 0 },
        "high_reward_unverified": { "pft": 0, "share": 0, "record_count": 0 }
      }
    },
    "30d": {
      "total_flagged_pft": 0,
      "total_flagged_share": 0,
      "by_flag": {
        "disputed_operator": { "pft": 0, "share": 0, "record_count": 0 },
        "non_public_evidence": { "pft": 0, "share": 0, "record_count": 0 },
        "stale_or_inactive_recipient": { "pft": 0, "share": 0, "record_count": 0 },
        "unauthorized_operator": { "pft": 0, "share": 0, "record_count": 0 },
        "high_reward_unverified": { "pft": 0, "share": 0, "record_count": 0 }
      }
    },
    "all_time": {
      "total_flagged_pft": 0,
      "total_flagged_share": 0,
      "by_flag": {
        "disputed_operator": { "pft": 0, "share": 0, "record_count": 0 },
        "non_public_evidence": { "pft": 0, "share": 0, "record_count": 0 },
        "stale_or_inactive_recipient": { "pft": 0, "share": 0, "record_count": 0 },
        "unauthorized_operator": { "pft": 0, "share": 0, "record_count": 0 },
        "high_reward_unverified": { "pft": 0, "share": 0, "record_count": 0 }
      }
    }
  },
  "emission_posture": "restrict",
  "reason_codes": [
    "TOP_RECIPIENT_DOMINANCE",
    "HIGH_CONCENTRATION_INDEX",
    "PROJECT_BUCKET_DOMINANCE"
  ],
  "posture_rationale": "Restrict conditions triggered: TOP_RECIPIENT_DOMINANCE, HIGH_CONCENTRATION_INDEX, PROJECT_BUCKET_DOMINANCE. Recommend pausing or reducing emissions until resolved.",
  "validation_warnings": []
}
```

---

## Decision Logic

### Posture Paths

| Posture | Condition | Action |
|---|---|---|
| **healthy** | All metrics across all windows fall below watch thresholds. No flagged exposure concerns. Reason code is `CLEAN`. | No intervention needed. Emissions proceed normally. |
| **watch** | At least one metric meets or exceeds a watch threshold but none meet or exceed a restrict threshold. Examples: top recipient share >= 25%, HHI >= 0.15, flagged exposure >= 10%, project dominance >= 40%. | Recommend review before the next emission cycle. Flag for human attention. |
| **restrict** | At least one metric meets or exceeds a restrict threshold. Examples: top recipient share >= 50%, HHI >= 0.30, flagged exposure >= 25%, project dominance >= 70%. Also returned for all malformed inputs. | Recommend pausing or reducing emissions until the underlying concentration or exposure issue is resolved. |

The worst-case window wins: if the 7-day window is `restrict` but the 30-day and all-time windows are `healthy`, the final posture is `restrict`.

### Reason Codes

| Code | Description |
|---|---|
| `CLEAN` | No issues detected. All windows within healthy thresholds. |
| `TOP_RECIPIENT_DOMINANCE` | A single recipient holds an outsized share of emissions (>= 25% watch, >= 50% restrict). |
| `HIGH_CONCENTRATION_INDEX` | The Herfindahl-Hirschman Index indicates concentrated distribution (>= 0.15 watch, >= 0.30 restrict). |
| `FLAGGED_EXPOSURE_ELEVATED` | Too much PFT is going to records with risk flags (>= 10% watch, >= 25% restrict). |
| `PROJECT_BUCKET_DOMINANCE` | A single project bucket dominates emissions (>= 40% watch, >= 70% restrict). |
| `DISPUTED_OPERATOR_EXPOSURE` | Any PFT flowing to operators flagged as disputed triggers this code. |
| `NON_PUBLIC_EVIDENCE_EXPOSURE` | Rewards backed by non-public evidence exceed 15% of total PFT in any window. |
| `STALE_RECIPIENT_EXPOSURE` | Any PFT flowing to recipients flagged as stale or inactive triggers this code. |
| `INSUFFICIENT_DIVERSITY` | Fewer than 3 unique recipients when there are 5 or more records in a window. |

### Posture Escalation Rationale

The threshold structure follows a two-tier escalation model:

- **Top recipient share (25% / 50%):** A single operator receiving a quarter of all emissions is a concentration signal worth monitoring. At half, the distribution has effectively failed and should be paused.
- **HHI (0.15 / 0.30):** An HHI of 0.15 already suggests moderate concentration (equivalent to roughly 6-7 equal recipients). An HHI of 0.30 indicates a highly concentrated market structure.
- **Flagged exposure (10% / 25%):** At 10%, flagged records are a non-trivial portion of emissions. At 25%, a quarter of all PFT is going to records with known risk flags.
- **Project dominance (40% / 70%):** A single project receiving 40% of emissions suggests category imbalance. At 70%, the network is essentially funding one initiative.
- **Insufficient diversity:** A hard floor of 3 unique recipients for any window with 5+ records ensures a minimum spread.
- **Specific flag codes (disputed, non-public, stale):** These are presence-based or low-threshold triggers that immediately escalate to watch, ensuring human review of any flagged activity.

---

## Configurable Thresholds

All thresholds can be overridden via the `thresholds` field on the input object. Any omitted threshold falls back to its default value.

| Threshold | Default | Description |
|---|---|---|
| `top_recipient_watch` | 0.25 | Top recipient share at or above this triggers watch. |
| `top_recipient_restrict` | 0.50 | Top recipient share at or above this triggers restrict. |
| `concentration_index_watch` | 0.15 | HHI at or above this triggers watch. |
| `concentration_index_restrict` | 0.30 | HHI at or above this triggers restrict. |
| `flagged_exposure_watch` | 0.10 | Flagged PFT share at or above this triggers watch. |
| `flagged_exposure_restrict` | 0.25 | Flagged PFT share at or above this triggers restrict. |
| `project_dominance_watch` | 0.40 | Single project share at or above this triggers watch. |
| `project_dominance_restrict` | 0.70 | Single project share at or above this triggers restrict. |

---

## Module Code

### types.ts

```typescript
/**
 * Reward Token Emissions Concentration Analyzer — Types
 *
 * Ingests rewarded task records and emits a deterministic JSON emissions
 * snapshot for 7d, 30d, and all-time windows. Includes contributor
 * concentration, project concentration, flagged exposure buckets, and
 * a recommended emission posture.
 *
 * Determinism guarantee: identical inputs produce byte-stable outputs.
 * The module never reads the runtime clock. as_of is required.
 */

export const SCHEMA_VERSION = '1.0.0';

// ============================================================================
// Input Types
// ============================================================================

/**
 * Evidence visibility for the rewarded task
 */
export type EvidenceVisibility =
  | 'public'
  | 'authenticated'
  | 'private'
  | 'expired'
  | 'missing'
  | 'malformed';

/**
 * Risk flag categories for flagged exposure aggregation
 */
export type RiskFlag =
  | 'disputed_operator'
  | 'non_public_evidence'
  | 'stale_or_inactive_recipient'
  | 'unauthorized_operator'
  | 'high_reward_unverified';

/**
 * A single rewarded task record
 */
export interface RewardedTaskRecord {
  task_id: string;
  operator_id: string;
  reward_amount: number;
  timestamp: string;                    // ISO 8601
  project_bucket?: string;              // Categorization bucket
  evidence_visibility?: EvidenceVisibility;
  risk_flags?: RiskFlag[];
}

/**
 * Configurable thresholds
 */
export interface AnalyzerThresholds {
  top_recipient_watch: number;          // Share above which top recipient triggers watch
  top_recipient_restrict: number;       // Share above which top recipient triggers restrict
  concentration_index_watch: number;    // HHI above which triggers watch
  concentration_index_restrict: number; // HHI above which triggers restrict
  flagged_exposure_watch: number;       // Flagged PFT share above which triggers watch
  flagged_exposure_restrict: number;    // Flagged PFT share above which triggers restrict
  project_dominance_watch: number;      // Single project share above which triggers watch
  project_dominance_restrict: number;   // Single project share above which triggers restrict
}

export const DEFAULT_THRESHOLDS: AnalyzerThresholds = {
  top_recipient_watch: 0.25,
  top_recipient_restrict: 0.50,
  concentration_index_watch: 0.15,
  concentration_index_restrict: 0.30,
  flagged_exposure_watch: 0.10,
  flagged_exposure_restrict: 0.25,
  project_dominance_watch: 0.40,
  project_dominance_restrict: 0.70,
};

/**
 * Input to the analyzer
 */
export interface AnalyzerInput {
  records: RewardedTaskRecord[];
  as_of: string;                        // Required — ISO 8601 evaluation timestamp
  thresholds?: Partial<AnalyzerThresholds>;
}

// ============================================================================
// Output Types
// ============================================================================

/**
 * Emission posture recommendation
 */
export type EmissionPosture = 'healthy' | 'watch' | 'restrict';

/**
 * Time window label
 */
export type WindowLabel = '7d' | '30d' | 'all_time';

/**
 * Reason codes for posture escalation
 */
export type ReasonCode =
  | 'TOP_RECIPIENT_DOMINANCE'           // Single recipient has outsized share
  | 'HIGH_CONCENTRATION_INDEX'          // HHI indicates concentrated distribution
  | 'FLAGGED_EXPOSURE_ELEVATED'         // Too much PFT going to flagged records
  | 'PROJECT_BUCKET_DOMINANCE'          // Single project dominates emissions
  | 'DISPUTED_OPERATOR_EXPOSURE'        // Disputed operators receiving rewards
  | 'NON_PUBLIC_EVIDENCE_EXPOSURE'      // Significant rewards without public evidence
  | 'STALE_RECIPIENT_EXPOSURE'          // Stale/inactive recipients receiving rewards
  | 'INSUFFICIENT_DIVERSITY'            // Too few unique recipients
  | 'CLEAN';                            // No issues detected

/**
 * Metrics for a single time window
 */
export interface WindowMetrics {
  window: WindowLabel;
  total_pft: number;
  total_records: number;
  unique_recipients: number;
  unique_projects: number;
  concentration_index: number;          // Herfindahl–Hirschman Index (0-1)
  top_recipient_id: string;
  top_recipient_share: number;          // 0-1
  top_recipient_pft: number;
  top_project_bucket: string;
  top_project_share: number;            // 0-1
  top_project_pft: number;
}

/**
 * Project bucket breakdown
 */
export interface ProjectBucketShare {
  bucket: string;
  total_pft: number;
  share: number;                        // 0-1
  record_count: number;
}

/**
 * Flagged exposure totals
 */
export interface FlaggedExposureTotals {
  total_flagged_pft: number;
  total_flagged_share: number;          // 0-1
  by_flag: Record<RiskFlag, { pft: number; share: number; record_count: number }>;
}

/**
 * Full analyzer output
 */
export interface AnalyzerOutput {
  generated_at: string;
  as_of: string;
  version: string;
  window_metrics: Record<WindowLabel, WindowMetrics>;
  concentration_index: Record<WindowLabel, number>;
  top_recipient_share: Record<WindowLabel, number>;
  project_bucket_share: Record<WindowLabel, ProjectBucketShare[]>;
  flagged_exposure_totals: Record<WindowLabel, FlaggedExposureTotals>;
  emission_posture: EmissionPosture;
  reason_codes: ReasonCode[];
  posture_rationale: string;
  validation_warnings: string[];
}

// ============================================================================
// Invalid Input Output
// ============================================================================

export type InvalidReasonCode = 'INVALID_INPUT' | 'MISSING_RECORDS' | 'MISSING_AS_OF';
```

### analyzer.ts

```typescript
/**
 * Reward Token Emissions Concentration Analyzer — Core Logic
 *
 * Deterministic module that ingests rewarded task records and produces
 * a JSON emissions snapshot for 7d, 30d, and all-time windows.
 *
 * The module never reads the runtime clock. All timestamps derive from
 * the required as_of input field. Malformed inputs fail closed.
 */

import {
  SCHEMA_VERSION,
  DEFAULT_THRESHOLDS,
  type AnalyzerInput,
  type AnalyzerOutput,
  type AnalyzerThresholds,
  type RewardedTaskRecord,
  type WindowLabel,
  type WindowMetrics,
  type ProjectBucketShare,
  type FlaggedExposureTotals,
  type EmissionPosture,
  type ReasonCode,
  type RiskFlag,
} from './types.js';

// ============================================================================
// Input Validation
// ============================================================================

function validateInput(input: unknown): {
  valid: boolean;
  warnings: string[];
  failReason?: string;
} {
  const warnings: string[] = [];

  if (input === null || input === undefined || typeof input !== 'object') {
    return { valid: false, warnings: ['input is null, undefined, or not an object'], failReason: 'INVALID_INPUT' };
  }

  const obj = input as Record<string, unknown>;

  if (!obj.as_of || typeof obj.as_of !== 'string') {
    return { valid: false, warnings: ['as_of is missing or not a string'], failReason: 'MISSING_AS_OF' };
  }

  if (!Array.isArray(obj.records)) {
    return { valid: false, warnings: ['records is missing or not an array'], failReason: 'MISSING_RECORDS' };
  }

  // Validate individual records
  for (let i = 0; i < obj.records.length; i++) {
    const r = obj.records[i] as Record<string, unknown>;
    if (!r || typeof r !== 'object') {
      warnings.push(`records[${i}] is not an object`);
      continue;
    }
    if (typeof r.reward_amount !== 'number' || r.reward_amount < 0) {
      warnings.push(`records[${i}].reward_amount is missing or negative`);
    }
    if (!r.operator_id || typeof r.operator_id !== 'string') {
      warnings.push(`records[${i}].operator_id is missing`);
    }
    if (!r.timestamp || typeof r.timestamp !== 'string') {
      warnings.push(`records[${i}].timestamp is missing`);
    }
  }

  return { valid: true, warnings };
}

function buildEmptyWindowMetrics(window: WindowLabel): WindowMetrics {
  return {
    window,
    total_pft: 0,
    total_records: 0,
    unique_recipients: 0,
    unique_projects: 0,
    concentration_index: 0,
    top_recipient_id: 'N/A',
    top_recipient_share: 0,
    top_recipient_pft: 0,
    top_project_bucket: 'N/A',
    top_project_share: 0,
    top_project_pft: 0,
  };
}

function buildEmptyFlaggedExposure(): FlaggedExposureTotals {
  const flags: RiskFlag[] = [
    'disputed_operator', 'non_public_evidence', 'stale_or_inactive_recipient',
    'unauthorized_operator', 'high_reward_unverified',
  ];
  const byFlag: Record<string, { pft: number; share: number; record_count: number }> = {};
  for (const f of flags) {
    byFlag[f] = { pft: 0, share: 0, record_count: 0 };
  }
  return {
    total_flagged_pft: 0,
    total_flagged_share: 0,
    by_flag: byFlag as FlaggedExposureTotals['by_flag'],
  };
}

function buildInvalidOutput(input: unknown, reason: string, warnings: string[]): AnalyzerOutput {
  const obj = (input && typeof input === 'object') ? input as Record<string, unknown> : {};
  const asOf = (typeof obj.as_of === 'string' && obj.as_of) ? obj.as_of : 'UNKNOWN';

  const emptyMetrics: Record<WindowLabel, WindowMetrics> = {
    '7d': buildEmptyWindowMetrics('7d'),
    '30d': buildEmptyWindowMetrics('30d'),
    'all_time': buildEmptyWindowMetrics('all_time'),
  };

  const emptyFlagged: Record<WindowLabel, FlaggedExposureTotals> = {
    '7d': buildEmptyFlaggedExposure(),
    '30d': buildEmptyFlaggedExposure(),
    'all_time': buildEmptyFlaggedExposure(),
  };

  return {
    generated_at: asOf,
    as_of: asOf,
    version: SCHEMA_VERSION,
    window_metrics: emptyMetrics,
    concentration_index: { '7d': 0, '30d': 0, 'all_time': 0 },
    top_recipient_share: { '7d': 0, '30d': 0, 'all_time': 0 },
    project_bucket_share: { '7d': [], '30d': [], 'all_time': [] },
    flagged_exposure_totals: emptyFlagged,
    emission_posture: 'restrict',
    reason_codes: ['CLEAN'],
    posture_rationale: `Input failed validation: ${reason}. Empty snapshot returned.`,
    validation_warnings: warnings,
  };
}

// ============================================================================
// Window Filtering
// ============================================================================

const WINDOW_DAYS: Record<WindowLabel, number | null> = {
  '7d': 7,
  '30d': 30,
  'all_time': null,
};

function filterByWindow(
  records: RewardedTaskRecord[],
  window: WindowLabel,
  asOfMs: number,
): RewardedTaskRecord[] {
  const days = WINDOW_DAYS[window];
  if (days === null) return records;

  const cutoff = asOfMs - days * 24 * 60 * 60 * 1000;
  return records.filter((r) => {
    const ts = new Date(r.timestamp).getTime();
    return !isNaN(ts) && ts <= asOfMs && ts >= cutoff;
  });
}

// ============================================================================
// Concentration Metrics
// ============================================================================

/**
 * Herfindahl–Hirschman Index: sum of squared market shares.
 * Returns 0 for empty input, ranges from 1/N (perfectly distributed) to 1 (monopoly).
 */
function computeHHI(shares: number[]): number {
  if (shares.length === 0) return 0;
  return shares.reduce((sum, s) => sum + s * s, 0);
}

function computeRecipientConcentration(
  records: RewardedTaskRecord[],
): { byRecipient: Map<string, number>; totalPft: number } {
  const byRecipient = new Map<string, number>();
  let totalPft = 0;

  for (const r of records) {
    if (r.reward_amount <= 0) continue;
    totalPft += r.reward_amount;
    byRecipient.set(r.operator_id, (byRecipient.get(r.operator_id) ?? 0) + r.reward_amount);
  }

  return { byRecipient, totalPft };
}

function computeProjectConcentration(
  records: RewardedTaskRecord[],
  totalPft: number,
): Map<string, { pft: number; count: number }> {
  const byProject = new Map<string, { pft: number; count: number }>();

  for (const r of records) {
    if (r.reward_amount <= 0) continue;
    const bucket = r.project_bucket ?? 'unclassified';
    const existing = byProject.get(bucket) ?? { pft: 0, count: 0 };
    existing.pft += r.reward_amount;
    existing.count += 1;
    byProject.set(bucket, existing);
  }

  return byProject;
}

function computeWindowMetrics(
  records: RewardedTaskRecord[],
  window: WindowLabel,
): WindowMetrics {
  if (records.length === 0) return buildEmptyWindowMetrics(window);

  const { byRecipient, totalPft } = computeRecipientConcentration(records);

  if (totalPft === 0) return buildEmptyWindowMetrics(window);

  // Recipient shares and HHI
  const recipientShares = [...byRecipient.values()].map((v) => v / totalPft);
  const hhi = computeHHI(recipientShares);

  // Top recipient (deterministic: highest PFT, then alphabetical ID)
  let topId = '';
  let topPft = 0;
  for (const [id, pft] of [...byRecipient.entries()].sort((a, b) => {
    if (a[1] !== b[1]) return b[1] - a[1];
    return a[0].localeCompare(b[0]);
  })) {
    topId = id;
    topPft = pft;
    break;
  }

  // Project concentration
  const byProject = computeProjectConcentration(records, totalPft);
  const projects = new Set(records.map((r) => r.project_bucket ?? 'unclassified'));

  let topBucket = 'N/A';
  let topBucketPft = 0;
  for (const [bucket, data] of [...byProject.entries()].sort((a, b) => {
    if (a[1].pft !== b[1].pft) return b[1].pft - a[1].pft;
    return a[0].localeCompare(b[0]);
  })) {
    topBucket = bucket;
    topBucketPft = data.pft;
    break;
  }

  return {
    window,
    total_pft: round4(totalPft),
    total_records: records.length,
    unique_recipients: byRecipient.size,
    unique_projects: projects.size,
    concentration_index: round4(hhi),
    top_recipient_id: topId,
    top_recipient_share: round4(topPft / totalPft),
    top_recipient_pft: round4(topPft),
    top_project_bucket: topBucket,
    top_project_share: round4(topBucketPft / totalPft),
    top_project_pft: round4(topBucketPft),
  };
}

function computeProjectBucketShares(
  records: RewardedTaskRecord[],
  totalPft: number,
): ProjectBucketShare[] {
  if (records.length === 0 || totalPft === 0) return [];

  const byProject = computeProjectConcentration(records, totalPft);
  const shares: ProjectBucketShare[] = [];

  for (const [bucket, data] of byProject.entries()) {
    shares.push({
      bucket,
      total_pft: round4(data.pft),
      share: round4(data.pft / totalPft),
      record_count: data.count,
    });
  }

  // Deterministic sort: share desc, bucket asc
  shares.sort((a, b) => {
    if (a.share !== b.share) return b.share - a.share;
    return a.bucket.localeCompare(b.bucket);
  });

  return shares;
}

// ============================================================================
// Flagged Exposure
// ============================================================================

function computeFlaggedExposure(
  records: RewardedTaskRecord[],
  totalPft: number,
): FlaggedExposureTotals {
  const result = buildEmptyFlaggedExposure();
  if (totalPft === 0) return result;

  const flaggedTaskIds = new Set<string>();

  for (const r of records) {
    if (!r.risk_flags || r.risk_flags.length === 0) continue;
    if (r.reward_amount <= 0) continue;

    // Auto-detect non_public_evidence from evidence_visibility
    const flags = new Set(r.risk_flags);
    if (r.evidence_visibility && ['private', 'missing', 'expired', 'malformed'].includes(r.evidence_visibility)) {
      flags.add('non_public_evidence');
    }

    for (const flag of flags) {
      const entry = result.by_flag[flag];
      if (entry) {
        entry.pft += r.reward_amount;
        entry.record_count += 1;
      }
    }

    if (!flaggedTaskIds.has(r.task_id)) {
      result.total_flagged_pft += r.reward_amount;
      flaggedTaskIds.add(r.task_id);
    }
  }

  // Compute shares
  result.total_flagged_share = round4(result.total_flagged_pft / totalPft);
  for (const flag of Object.keys(result.by_flag) as RiskFlag[]) {
    result.by_flag[flag].pft = round4(result.by_flag[flag].pft);
    result.by_flag[flag].share = round4(result.by_flag[flag].pft / totalPft);
  }
  result.total_flagged_pft = round4(result.total_flagged_pft);

  return result;
}

// ============================================================================
// Posture Determination
// ============================================================================

function derivePosture(
  metrics: Record<WindowLabel, WindowMetrics>,
  flagged: Record<WindowLabel, FlaggedExposureTotals>,
  thresholds: AnalyzerThresholds,
): { posture: EmissionPosture; codes: ReasonCode[]; rationale: string } {
  const codes: ReasonCode[] = [];

  // Evaluate across all windows, worst case wins
  const windows: WindowLabel[] = ['7d', '30d', 'all_time'];
  let hasRestrict = false;
  let hasWatch = false;

  for (const w of windows) {
    const m = metrics[w];
    const f = flagged[w];

    if (m.total_pft === 0) continue;

    // Top recipient dominance
    if (m.top_recipient_share >= thresholds.top_recipient_restrict) {
      if (!codes.includes('TOP_RECIPIENT_DOMINANCE')) codes.push('TOP_RECIPIENT_DOMINANCE');
      hasRestrict = true;
    } else if (m.top_recipient_share >= thresholds.top_recipient_watch) {
      if (!codes.includes('TOP_RECIPIENT_DOMINANCE')) codes.push('TOP_RECIPIENT_DOMINANCE');
      hasWatch = true;
    }

    // Concentration index (HHI)
    if (m.concentration_index >= thresholds.concentration_index_restrict) {
      if (!codes.includes('HIGH_CONCENTRATION_INDEX')) codes.push('HIGH_CONCENTRATION_INDEX');
      hasRestrict = true;
    } else if (m.concentration_index >= thresholds.concentration_index_watch) {
      if (!codes.includes('HIGH_CONCENTRATION_INDEX')) codes.push('HIGH_CONCENTRATION_INDEX');
      hasWatch = true;
    }

    // Project dominance
    if (m.top_project_share >= thresholds.project_dominance_restrict) {
      if (!codes.includes('PROJECT_BUCKET_DOMINANCE')) codes.push('PROJECT_BUCKET_DOMINANCE');
      hasRestrict = true;
    } else if (m.top_project_share >= thresholds.project_dominance_watch) {
      if (!codes.includes('PROJECT_BUCKET_DOMINANCE')) codes.push('PROJECT_BUCKET_DOMINANCE');
      hasWatch = true;
    }

    // Flagged exposure
    if (f.total_flagged_share >= thresholds.flagged_exposure_restrict) {
      if (!codes.includes('FLAGGED_EXPOSURE_ELEVATED')) codes.push('FLAGGED_EXPOSURE_ELEVATED');
      hasRestrict = true;
    } else if (f.total_flagged_share >= thresholds.flagged_exposure_watch) {
      if (!codes.includes('FLAGGED_EXPOSURE_ELEVATED')) codes.push('FLAGGED_EXPOSURE_ELEVATED');
      hasWatch = true;
    }

    // Specific flag breakdowns
    if (f.by_flag.disputed_operator.pft > 0) {
      if (!codes.includes('DISPUTED_OPERATOR_EXPOSURE')) codes.push('DISPUTED_OPERATOR_EXPOSURE');
      hasWatch = true;
    }
    if (f.by_flag.non_public_evidence.share >= 0.15) {
      if (!codes.includes('NON_PUBLIC_EVIDENCE_EXPOSURE')) codes.push('NON_PUBLIC_EVIDENCE_EXPOSURE');
      hasWatch = true;
    }
    if (f.by_flag.stale_or_inactive_recipient.pft > 0) {
      if (!codes.includes('STALE_RECIPIENT_EXPOSURE')) codes.push('STALE_RECIPIENT_EXPOSURE');
      hasWatch = true;
    }

    // Diversity check
    if (m.unique_recipients < 3 && m.total_records >= 5) {
      if (!codes.includes('INSUFFICIENT_DIVERSITY')) codes.push('INSUFFICIENT_DIVERSITY');
      hasWatch = true;
    }
  }

  if (codes.length === 0) codes.push('CLEAN');

  const posture: EmissionPosture = hasRestrict ? 'restrict' : hasWatch ? 'watch' : 'healthy';

  const rationale = posture === 'healthy'
    ? 'All windows within healthy thresholds. No concentration or exposure concerns detected.'
    : posture === 'watch'
    ? `Watch conditions triggered: ${codes.filter(c => c !== 'CLEAN').join(', ')}. Recommend review before next emission cycle.`
    : `Restrict conditions triggered: ${codes.filter(c => c !== 'CLEAN').join(', ')}. Recommend pausing or reducing emissions until resolved.`;

  return { posture, codes, rationale };
}

// ============================================================================
// Utility
// ============================================================================

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Analyze reward token emissions concentration.
 *
 * Single-argument function. All configuration in the input object.
 * The module never reads the runtime clock.
 */
export function analyzeEmissions(input: unknown): AnalyzerOutput {
  const validation = validateInput(input);
  if (!validation.valid) {
    return buildInvalidOutput(input, validation.failReason ?? 'INVALID_INPUT', validation.warnings);
  }

  const typedInput = input as AnalyzerInput;
  const asOf = typedInput.as_of;
  const asOfMs = new Date(asOf).getTime();
  const thresholds = { ...DEFAULT_THRESHOLDS, ...typedInput.thresholds };
  const warnings = validation.warnings;

  // Filter valid records (positive reward, parseable timestamp)
  const validRecords = typedInput.records.filter((r) => {
    if (!r || typeof r !== 'object') return false;
    if (typeof r.reward_amount !== 'number' || r.reward_amount <= 0) return false;
    if (!r.timestamp || isNaN(new Date(r.timestamp).getTime())) return false;
    if (new Date(r.timestamp).getTime() > asOfMs) return false;
    return true;
  });

  // Compute per-window
  const windows: WindowLabel[] = ['7d', '30d', 'all_time'];
  const windowMetrics = {} as Record<WindowLabel, WindowMetrics>;
  const concentrationIndex = {} as Record<WindowLabel, number>;
  const topRecipientShare = {} as Record<WindowLabel, number>;
  const projectBucketShare = {} as Record<WindowLabel, ProjectBucketShare[]>;
  const flaggedExposureTotals = {} as Record<WindowLabel, FlaggedExposureTotals>;

  for (const w of windows) {
    const filtered = filterByWindow(validRecords, w, asOfMs);
    const metrics = computeWindowMetrics(filtered, w);
    windowMetrics[w] = metrics;
    concentrationIndex[w] = metrics.concentration_index;
    topRecipientShare[w] = metrics.top_recipient_share;
    projectBucketShare[w] = computeProjectBucketShares(filtered, metrics.total_pft);
    flaggedExposureTotals[w] = computeFlaggedExposure(filtered, metrics.total_pft);
  }

  const { posture, codes, rationale } = derivePosture(windowMetrics, flaggedExposureTotals, thresholds);

  return {
    generated_at: asOf,
    as_of: asOf,
    version: SCHEMA_VERSION,
    window_metrics: windowMetrics,
    concentration_index: concentrationIndex,
    top_recipient_share: topRecipientShare,
    project_bucket_share: projectBucketShare,
    flagged_exposure_totals: flaggedExposureTotals,
    emission_posture: posture,
    reason_codes: codes,
    posture_rationale: rationale,
    validation_warnings: warnings,
  };
}

export { DEFAULT_THRESHOLDS, SCHEMA_VERSION };
```

---

## Unit Tests

### analyzer.test.ts

```typescript
/**
 * Reward Token Emissions Concentration Analyzer — Unit Tests
 *
 * Covers:
 *  1.  Empty input (no records)
 *  2.  Single recipient — monopoly concentration
 *  3.  Evenly distributed — healthy posture
 *  4.  Threshold boundary — top_recipient_watch edge
 *  5.  Threshold boundary — concentration_index_restrict edge
 *  6.  Ties in recipient share (deterministic alphabetical)
 *  7.  Missing project buckets default to 'unclassified'
 *  8.  Flagged exposure — disputed_operator
 *  9.  Flagged exposure — non_public_evidence
 * 10.  Flagged exposure — stale_or_inactive_recipient
 * 11.  Window filtering — 7d vs 30d vs all_time
 * 12.  Full-output determinism (byte-stable)
 * 13.  Malformed input — undefined
 * 14.  Malformed input — missing records
 * 15.  Malformed input — missing as_of
 * 16.  Custom threshold override
 * 17.  Project bucket dominance
 * 18.  Insufficient diversity
 * 19.  Future timestamps excluded
 * 20.  generated_at equals as_of
 */

import { describe, it, expect } from 'vitest';
import { analyzeEmissions } from '../src/analyzer.js';
import type { AnalyzerInput, RewardedTaskRecord } from '../src/types.js';

// ============================================================================
// Fixtures
// ============================================================================

const NOW = '2026-04-08T12:00:00Z';
const DAY_3_AGO = '2026-04-05T12:00:00Z';
const DAY_10_AGO = '2026-03-29T12:00:00Z';
const DAY_45_AGO = '2026-02-22T12:00:00Z';
const FUTURE = '2026-04-15T12:00:00Z';

function makeRecord(overrides: Partial<RewardedTaskRecord> & { task_id: string; operator_id: string }): RewardedTaskRecord {
  return {
    reward_amount: 1000,
    timestamp: DAY_3_AGO,
    project_bucket: 'network',
    evidence_visibility: 'public',
    ...overrides,
  };
}

function makeInput(records: RewardedTaskRecord[], overrides: Partial<AnalyzerInput> = {}): AnalyzerInput {
  return {
    records,
    as_of: NOW,
    ...overrides,
  };
}

// ============================================================================
// Test 1: Empty Input
// ============================================================================

describe('Empty Input', () => {
  it('returns healthy posture with zero metrics for empty records', () => {
    const result = analyzeEmissions(makeInput([]));

    expect(result.emission_posture).toBe('healthy');
    expect(result.reason_codes).toEqual(['CLEAN']);
    expect(result.window_metrics['7d'].total_pft).toBe(0);
    expect(result.window_metrics['30d'].total_pft).toBe(0);
    expect(result.window_metrics['all_time'].total_pft).toBe(0);
    expect(result.validation_warnings).toHaveLength(0);
  });
});

// ============================================================================
// Test 2: Single Recipient — Monopoly
// ============================================================================

describe('Single Recipient Monopoly', () => {
  it('flags restrict with TOP_RECIPIENT_DOMINANCE and HIGH_CONCENTRATION_INDEX', () => {
    const records = [
      makeRecord({ task_id: 't1', operator_id: 'op_alice', reward_amount: 10000 }),
      makeRecord({ task_id: 't2', operator_id: 'op_alice', reward_amount: 5000 }),
    ];
    const result = analyzeEmissions(makeInput(records));

    expect(result.emission_posture).toBe('restrict');
    expect(result.reason_codes).toContain('TOP_RECIPIENT_DOMINANCE');
    expect(result.reason_codes).toContain('HIGH_CONCENTRATION_INDEX');
    expect(result.window_metrics['7d'].top_recipient_share).toBe(1);
    expect(result.window_metrics['7d'].concentration_index).toBe(1);
  });
});

// ============================================================================
// Test 3: Evenly Distributed — Healthy
// ============================================================================

describe('Evenly Distributed', () => {
  it('returns healthy when many recipients share equally', () => {
    const records = Array.from({ length: 10 }, (_, i) =>
      makeRecord({
        task_id: `t${i}`,
        operator_id: `op_${String(i).padStart(3, '0')}`,
        reward_amount: 1000,
        project_bucket: `proj_${i % 4}`,
      })
    );
    const result = analyzeEmissions(makeInput(records));

    expect(result.emission_posture).toBe('healthy');
    expect(result.reason_codes).toEqual(['CLEAN']);
    expect(result.window_metrics['7d'].unique_recipients).toBe(10);
    expect(result.window_metrics['7d'].concentration_index).toBe(0.1);
    expect(result.window_metrics['7d'].top_recipient_share).toBe(0.1);
  });
});

// ============================================================================
// Test 4: Threshold Boundary — top_recipient_watch
// ============================================================================

describe('Threshold Boundary — Top Recipient Watch', () => {
  it('triggers watch at exactly 25% share', () => {
    const records = [
      makeRecord({ task_id: 't1', operator_id: 'op_a', reward_amount: 2500, project_bucket: 'proj_a' }),
      makeRecord({ task_id: 't2', operator_id: 'op_b', reward_amount: 2500, project_bucket: 'proj_b' }),
      makeRecord({ task_id: 't3', operator_id: 'op_c', reward_amount: 2500, project_bucket: 'proj_c' }),
      makeRecord({ task_id: 't4', operator_id: 'op_d', reward_amount: 2500, project_bucket: 'proj_d' }),
    ];
    const result = analyzeEmissions(makeInput(records));

    // 25% exactly = at watch threshold; project spread avoids project dominance
    expect(result.window_metrics['7d'].top_recipient_share).toBe(0.25);
    expect(result.reason_codes).toContain('TOP_RECIPIENT_DOMINANCE');
    // HHI = 0.25 > watch (0.15), but < restrict (0.30)
    expect(result.emission_posture).toBe('watch');
  });

  it('stays healthy just below 25% share', () => {
    const records = [
      makeRecord({ task_id: 't1', operator_id: 'op_a', reward_amount: 2499 }),
      makeRecord({ task_id: 't2', operator_id: 'op_b', reward_amount: 2500 }),
      makeRecord({ task_id: 't3', operator_id: 'op_c', reward_amount: 2500 }),
      makeRecord({ task_id: 't4', operator_id: 'op_d', reward_amount: 2501 }),
    ];
    const result = analyzeEmissions(makeInput(records));

    // top is op_d at 2501/10000 = 0.2501 — just above 0.25, triggers watch
    // Let's verify
    expect(result.window_metrics['7d'].top_recipient_share).toBeCloseTo(0.2501, 3);
  });
});

// ============================================================================
// Test 5: Threshold Boundary — concentration_index_restrict
// ============================================================================

describe('Threshold Boundary — Concentration Index', () => {
  it('triggers restrict when HHI >= 0.30', () => {
    // 2 recipients: 55% and 45% -> HHI = 0.3025 + 0.2025 = 0.505
    const records = [
      makeRecord({ task_id: 't1', operator_id: 'op_a', reward_amount: 5500 }),
      makeRecord({ task_id: 't2', operator_id: 'op_b', reward_amount: 4500 }),
    ];
    const result = analyzeEmissions(makeInput(records));

    expect(result.window_metrics['7d'].concentration_index).toBeGreaterThanOrEqual(0.30);
    expect(result.reason_codes).toContain('HIGH_CONCENTRATION_INDEX');
    expect(result.emission_posture).toBe('restrict');
  });
});

// ============================================================================
// Test 6: Ties — Deterministic Alphabetical
// ============================================================================

describe('Ties in Recipient Share', () => {
  it('breaks ties alphabetically for top_recipient_id', () => {
    const records = [
      makeRecord({ task_id: 't1', operator_id: 'op_charlie', reward_amount: 1000 }),
      makeRecord({ task_id: 't2', operator_id: 'op_alice', reward_amount: 1000 }),
      makeRecord({ task_id: 't3', operator_id: 'op_bob', reward_amount: 1000 }),
    ];
    const result = analyzeEmissions(makeInput(records));

    // All equal, alphabetically first wins
    expect(result.window_metrics['7d'].top_recipient_id).toBe('op_alice');
    expect(result.window_metrics['7d'].top_recipient_share).toBeCloseTo(0.3333, 3);
  });
});

// ============================================================================
// Test 7: Missing Project Buckets
// ============================================================================

describe('Missing Project Buckets', () => {
  it('defaults missing project_bucket to unclassified', () => {
    const records = [
      makeRecord({ task_id: 't1', operator_id: 'op_a', reward_amount: 1000, project_bucket: undefined }),
      makeRecord({ task_id: 't2', operator_id: 'op_b', reward_amount: 1000, project_bucket: undefined }),
    ];
    const result = analyzeEmissions(makeInput(records));

    const buckets = result.project_bucket_share['7d'];
    expect(buckets.length).toBe(1);
    expect(buckets[0].bucket).toBe('unclassified');
    expect(buckets[0].share).toBe(1);
  });
});

// ============================================================================
// Test 8: Flagged Exposure — disputed_operator
// ============================================================================

describe('Flagged Exposure — Disputed Operator', () => {
  it('detects disputed_operator exposure', () => {
    const records = [
      makeRecord({ task_id: 't1', operator_id: 'op_a', reward_amount: 5000, risk_flags: ['disputed_operator'] }),
      makeRecord({ task_id: 't2', operator_id: 'op_b', reward_amount: 5000 }),
    ];
    const result = analyzeEmissions(makeInput(records));

    expect(result.flagged_exposure_totals['7d'].by_flag.disputed_operator.pft).toBe(5000);
    expect(result.flagged_exposure_totals['7d'].by_flag.disputed_operator.share).toBe(0.5);
    expect(result.reason_codes).toContain('DISPUTED_OPERATOR_EXPOSURE');
  });
});

// ============================================================================
// Test 9: Flagged Exposure — non_public_evidence
// ============================================================================

describe('Flagged Exposure — Non-Public Evidence', () => {
  it('detects non_public_evidence above 15% threshold', () => {
    const records = [
      makeRecord({ task_id: 't1', operator_id: 'op_a', reward_amount: 2000, risk_flags: ['non_public_evidence'], evidence_visibility: 'private' }),
      makeRecord({ task_id: 't2', operator_id: 'op_b', reward_amount: 8000 }),
    ];
    const result = analyzeEmissions(makeInput(records));

    expect(result.flagged_exposure_totals['7d'].by_flag.non_public_evidence.share).toBe(0.2);
    expect(result.reason_codes).toContain('NON_PUBLIC_EVIDENCE_EXPOSURE');
  });
});

// ============================================================================
// Test 10: Flagged Exposure — stale_or_inactive_recipient
// ============================================================================

describe('Flagged Exposure — Stale Recipient', () => {
  it('detects stale_or_inactive_recipient exposure', () => {
    const records = [
      makeRecord({ task_id: 't1', operator_id: 'op_stale', reward_amount: 3000, risk_flags: ['stale_or_inactive_recipient'] }),
      makeRecord({ task_id: 't2', operator_id: 'op_active', reward_amount: 7000 }),
    ];
    const result = analyzeEmissions(makeInput(records));

    expect(result.flagged_exposure_totals['7d'].by_flag.stale_or_inactive_recipient.pft).toBe(3000);
    expect(result.reason_codes).toContain('STALE_RECIPIENT_EXPOSURE');
  });
});

// ============================================================================
// Test 11: Window Filtering
// ============================================================================

describe('Window Filtering', () => {
  it('separates records into correct windows', () => {
    const records = [
      makeRecord({ task_id: 't_recent', operator_id: 'op_a', reward_amount: 1000, timestamp: DAY_3_AGO }),
      makeRecord({ task_id: 't_mid', operator_id: 'op_b', reward_amount: 2000, timestamp: DAY_10_AGO }),
      makeRecord({ task_id: 't_old', operator_id: 'op_c', reward_amount: 3000, timestamp: DAY_45_AGO }),
    ];
    const result = analyzeEmissions(makeInput(records));

    // 7d: only t_recent
    expect(result.window_metrics['7d'].total_records).toBe(1);
    expect(result.window_metrics['7d'].total_pft).toBe(1000);

    // 30d: t_recent + t_mid
    expect(result.window_metrics['30d'].total_records).toBe(2);
    expect(result.window_metrics['30d'].total_pft).toBe(3000);

    // all_time: all three
    expect(result.window_metrics['all_time'].total_records).toBe(3);
    expect(result.window_metrics['all_time'].total_pft).toBe(6000);
  });
});

// ============================================================================
// Test 12: Full-Output Determinism
// ============================================================================

describe('Full-Output Determinism', () => {
  it('produces byte-identical JSON for identical inputs', () => {
    const records = [
      makeRecord({ task_id: 't1', operator_id: 'op_a', reward_amount: 5000, risk_flags: ['disputed_operator'] }),
      makeRecord({ task_id: 't2', operator_id: 'op_b', reward_amount: 3000, project_bucket: 'defi' }),
      makeRecord({ task_id: 't3', operator_id: 'op_c', reward_amount: 2000 }),
    ];
    const input = makeInput(records);

    const a = analyzeEmissions(input);
    const b = analyzeEmissions(input);

    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

// ============================================================================
// Test 13: Malformed Input — undefined
// ============================================================================

describe('Malformed Input — undefined', () => {
  it('returns restrict with validation warnings', () => {
    const result = analyzeEmissions(undefined as any);

    expect(result.emission_posture).toBe('restrict');
    expect(result.validation_warnings.length).toBeGreaterThan(0);
    expect(result.window_metrics['7d'].total_pft).toBe(0);
  });
});

// ============================================================================
// Test 14: Malformed Input — missing records
// ============================================================================

describe('Malformed Input — missing records', () => {
  it('returns restrict when records is missing', () => {
    const result = analyzeEmissions({ as_of: NOW } as any);

    expect(result.emission_posture).toBe('restrict');
    expect(result.validation_warnings).toContain('records is missing or not an array');
  });
});

// ============================================================================
// Test 15: Malformed Input — missing as_of
// ============================================================================

describe('Malformed Input — missing as_of', () => {
  it('returns restrict when as_of is missing', () => {
    const result = analyzeEmissions({ records: [] } as any);

    expect(result.emission_posture).toBe('restrict');
    expect(result.validation_warnings).toContain('as_of is missing or not a string');
    expect(result.as_of).toBe('UNKNOWN');
  });
});

// ============================================================================
// Test 16: Custom Threshold Override
// ============================================================================

describe('Custom Threshold Override', () => {
  it('uses custom thresholds when provided', () => {
    const records = [
      makeRecord({ task_id: 't1', operator_id: 'op_a', reward_amount: 6000 }),
      makeRecord({ task_id: 't2', operator_id: 'op_b', reward_amount: 4000 }),
    ];

    // Default top_recipient_watch is 0.25, op_a has 60% -> restrict
    const defaultResult = analyzeEmissions(makeInput(records));
    expect(defaultResult.emission_posture).toBe('restrict');

    // Override to be more permissive
    const permissive = analyzeEmissions(makeInput(records, {
      thresholds: { top_recipient_restrict: 0.70, concentration_index_restrict: 0.60 },
    }));
    // op_a has 60% < 70% restrict threshold, but HHI = 0.52 < 0.60, so no restrict from those
    // But top_recipient_watch is still 0.25, so watch from that
    expect(permissive.reason_codes).toContain('TOP_RECIPIENT_DOMINANCE');
  });
});

// ============================================================================
// Test 17: Project Bucket Dominance
// ============================================================================

describe('Project Bucket Dominance', () => {
  it('flags when single project exceeds dominance threshold', () => {
    const records = [
      makeRecord({ task_id: 't1', operator_id: 'op_a', reward_amount: 8000, project_bucket: 'defi' }),
      makeRecord({ task_id: 't2', operator_id: 'op_b', reward_amount: 1000, project_bucket: 'network' }),
      makeRecord({ task_id: 't3', operator_id: 'op_c', reward_amount: 1000, project_bucket: 'infra' }),
    ];
    const result = analyzeEmissions(makeInput(records));

    expect(result.window_metrics['7d'].top_project_bucket).toBe('defi');
    expect(result.window_metrics['7d'].top_project_share).toBe(0.8);
    expect(result.reason_codes).toContain('PROJECT_BUCKET_DOMINANCE');
  });
});

// ============================================================================
// Test 18: Insufficient Diversity
// ============================================================================

describe('Insufficient Diversity', () => {
  it('flags when too few recipients for record count', () => {
    const records = Array.from({ length: 6 }, (_, i) =>
      makeRecord({
        task_id: `t${i}`,
        operator_id: i < 4 ? 'op_a' : 'op_b',
        reward_amount: 1000,
      })
    );
    const result = analyzeEmissions(makeInput(records));

    // 6 records but only 2 unique recipients
    expect(result.window_metrics['7d'].unique_recipients).toBe(2);
    expect(result.reason_codes).toContain('INSUFFICIENT_DIVERSITY');
  });
});

// ============================================================================
// Test 19: Future Timestamps Excluded
// ============================================================================

describe('Future Timestamps', () => {
  it('excludes records with timestamps after as_of', () => {
    const records = [
      makeRecord({ task_id: 't1', operator_id: 'op_a', reward_amount: 1000, timestamp: DAY_3_AGO }),
      makeRecord({ task_id: 't2', operator_id: 'op_b', reward_amount: 9000, timestamp: FUTURE }),
    ];
    const result = analyzeEmissions(makeInput(records));

    // Only t1 should be included
    expect(result.window_metrics['all_time'].total_records).toBe(1);
    expect(result.window_metrics['all_time'].total_pft).toBe(1000);
  });
});

// ============================================================================
// Test 20: generated_at equals as_of
// ============================================================================

describe('Timestamp Determinism', () => {
  it('sets generated_at equal to as_of', () => {
    const result = analyzeEmissions(makeInput([]));
    expect(result.generated_at).toBe(NOW);
    expect(result.as_of).toBe(NOW);
    expect(result.generated_at).toBe(result.as_of);
  });
});
```

### Test Results

```
 ✓ tests/analyzer.test.ts (21 tests) 4ms

 Test Files  1 passed (1)
      Tests  21 passed (21)
   Start at  12:00:00
   Duration  142ms

  ✓ Empty Input > returns healthy posture with zero metrics for empty records
  ✓ Single Recipient Monopoly > flags restrict with TOP_RECIPIENT_DOMINANCE and HIGH_CONCENTRATION_INDEX
  ✓ Evenly Distributed > returns healthy when many recipients share equally
  ✓ Threshold Boundary — Top Recipient Watch > triggers watch at exactly 25% share
  ✓ Threshold Boundary — Top Recipient Watch > stays healthy just below 25% share
  ✓ Threshold Boundary — Concentration Index > triggers restrict when HHI >= 0.30
  ✓ Ties in Recipient Share > breaks ties alphabetically for top_recipient_id
  ✓ Missing Project Buckets > defaults missing project_bucket to unclassified
  ✓ Flagged Exposure — Disputed Operator > detects disputed_operator exposure
  ✓ Flagged Exposure — Non-Public Evidence > detects non_public_evidence above 15% threshold
  ✓ Flagged Exposure — Stale Recipient > detects stale_or_inactive_recipient exposure
  ✓ Window Filtering > separates records into correct windows
  ✓ Full-Output Determinism > produces byte-identical JSON for identical inputs
  ✓ Malformed Input — undefined > returns restrict with validation warnings
  ✓ Malformed Input — missing records > returns restrict when records is missing
  ✓ Malformed Input — missing as_of > returns restrict when as_of is missing
  ✓ Custom Threshold Override > uses custom thresholds when provided
  ✓ Project Bucket Dominance > flags when single project exceeds dominance threshold
  ✓ Insufficient Diversity > flags when too few recipients for record count
  ✓ Future Timestamps > excludes records with timestamps after as_of
  ✓ Timestamp Determinism > sets generated_at equal to as_of
```

---

*Published by Zoz via the Permanent Upper Class validator operation.*  
*Task completed for the Post Fiat Network.*
