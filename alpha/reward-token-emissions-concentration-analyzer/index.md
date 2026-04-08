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
| Version | 1.0.0 (v2 logic) |

---

## What This Module Is

This module is a deterministic analyzer that ingests rewarded task records and produces a JSON emissions snapshot across three time windows (7-day, 30-day, and all-time). It computes contributor concentration via the Herfindahl-Hirschman Index (HHI), identifies top recipient and project dominance, aggregates flagged risk exposure, and recommends an emission posture of `healthy`, `watch`, or `restrict`. The v2 revision adds per-window posture metadata, an exclusion summary for auditability, configurable special-flag thresholds, and fixes the inferred non-public evidence bug where `evidence_visibility` was only checked when `risk_flags` was already present. The module is designed to be embedded in automated emission pipelines where a single function call returns a complete, auditable snapshot of reward distribution health.

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
  "exclusion_summary": {
    "input_record_count": 10,
    "accepted_record_count": 10,
    "excluded_record_count": 0,
    "excluded_reward_total": 0,
    "exclusion_reason_counts": {
      "non_positive_reward": 0,
      "invalid_timestamp": 0,
      "future_timestamp": 0
    }
  },
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
  "top_recipients_by_window": {
    "7d": [
      { "operator_id": "op_000", "total_pft": 1000, "share": 0.1, "record_count": 1 },
      { "operator_id": "op_001", "total_pft": 1000, "share": 0.1, "record_count": 1 },
      { "operator_id": "op_002", "total_pft": 1000, "share": 0.1, "record_count": 1 },
      { "operator_id": "op_003", "total_pft": 1000, "share": 0.1, "record_count": 1 },
      { "operator_id": "op_004", "total_pft": 1000, "share": 0.1, "record_count": 1 }
    ],
    "30d": [
      { "operator_id": "op_000", "total_pft": 1000, "share": 0.1, "record_count": 1 },
      { "operator_id": "op_001", "total_pft": 1000, "share": 0.1, "record_count": 1 },
      { "operator_id": "op_002", "total_pft": 1000, "share": 0.1, "record_count": 1 },
      { "operator_id": "op_003", "total_pft": 1000, "share": 0.1, "record_count": 1 },
      { "operator_id": "op_004", "total_pft": 1000, "share": 0.1, "record_count": 1 }
    ],
    "all_time": [
      { "operator_id": "op_000", "total_pft": 1000, "share": 0.1, "record_count": 1 },
      { "operator_id": "op_001", "total_pft": 1000, "share": 0.1, "record_count": 1 },
      { "operator_id": "op_002", "total_pft": 1000, "share": 0.1, "record_count": 1 },
      { "operator_id": "op_003", "total_pft": 1000, "share": 0.1, "record_count": 1 },
      { "operator_id": "op_004", "total_pft": 1000, "share": 0.1, "record_count": 1 }
    ]
  },
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
  "dominant_project_buckets_by_window": {
    "7d": [],
    "30d": [],
    "all_time": []
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
  "window_postures": { "7d": "healthy", "30d": "healthy", "all_time": "healthy" },
  "triggered_windows": {},
  "worst_window": "7d",
  "review_priority_window": "7d",
  "emission_posture": "healthy",
  "reason_codes": ["CLEAN"],
  "posture_rationale": "All windows within healthy thresholds. No concentration or exposure concerns detected.",
  "validation_warnings": []
}
```

---

### Example 2: Restrict Posture (Flagged Exposure + Concentration)

One recipient holds 30% share with flagged exposure from a disputed operator. The 30% disputed operator exposure exceeds the `flagged_exposure_restrict` threshold of 25%, escalating to restrict.

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
  "exclusion_summary": {
    "input_record_count": 6,
    "accepted_record_count": 6,
    "excluded_record_count": 0,
    "excluded_reward_total": 0,
    "exclusion_reason_counts": {
      "non_positive_reward": 0,
      "invalid_timestamp": 0,
      "future_timestamp": 0
    }
  },
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
  "top_recipients_by_window": {
    "7d": [
      { "operator_id": "op_alpha", "total_pft": 3000, "share": 0.3, "record_count": 1 },
      { "operator_id": "op_beta", "total_pft": 2000, "share": 0.2, "record_count": 1 },
      { "operator_id": "op_delta", "total_pft": 1500, "share": 0.15, "record_count": 1 },
      { "operator_id": "op_gamma", "total_pft": 1500, "share": 0.15, "record_count": 1 },
      { "operator_id": "op_epsilon", "total_pft": 1000, "share": 0.1, "record_count": 1 }
    ],
    "30d": [
      { "operator_id": "op_alpha", "total_pft": 3000, "share": 0.3, "record_count": 1 },
      { "operator_id": "op_beta", "total_pft": 2000, "share": 0.2, "record_count": 1 },
      { "operator_id": "op_delta", "total_pft": 1500, "share": 0.15, "record_count": 1 },
      { "operator_id": "op_gamma", "total_pft": 1500, "share": 0.15, "record_count": 1 },
      { "operator_id": "op_epsilon", "total_pft": 1000, "share": 0.1, "record_count": 1 }
    ],
    "all_time": [
      { "operator_id": "op_alpha", "total_pft": 3000, "share": 0.3, "record_count": 1 },
      { "operator_id": "op_beta", "total_pft": 2000, "share": 0.2, "record_count": 1 },
      { "operator_id": "op_delta", "total_pft": 1500, "share": 0.15, "record_count": 1 },
      { "operator_id": "op_gamma", "total_pft": 1500, "share": 0.15, "record_count": 1 },
      { "operator_id": "op_epsilon", "total_pft": 1000, "share": 0.1, "record_count": 1 }
    ]
  },
  "project_bucket_share": {
    "7d": [
      { "bucket": "defi", "total_pft": 4500, "share": 0.45, "record_count": 2 },
      { "bucket": "network", "total_pft": 3000, "share": 0.3, "record_count": 2 },
      { "bucket": "infra", "total_pft": 2500, "share": 0.25, "record_count": 2 }
    ],
    "30d": [
      { "bucket": "defi", "total_pft": 4500, "share": 0.45, "record_count": 2 },
      { "bucket": "network", "total_pft": 3000, "share": 0.3, "record_count": 2 },
      { "bucket": "infra", "total_pft": 2500, "share": 0.25, "record_count": 2 }
    ],
    "all_time": [
      { "bucket": "defi", "total_pft": 4500, "share": 0.45, "record_count": 2 },
      { "bucket": "network", "total_pft": 3000, "share": 0.3, "record_count": 2 },
      { "bucket": "infra", "total_pft": 2500, "share": 0.25, "record_count": 2 }
    ]
  },
  "dominant_project_buckets_by_window": {
    "7d": [
      { "bucket": "defi", "total_pft": 4500, "share": 0.45, "record_count": 2 }
    ],
    "30d": [
      { "bucket": "defi", "total_pft": 4500, "share": 0.45, "record_count": 2 }
    ],
    "all_time": [
      { "bucket": "defi", "total_pft": 4500, "share": 0.45, "record_count": 2 }
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
  "window_postures": { "7d": "restrict", "30d": "restrict", "all_time": "restrict" },
  "triggered_windows": {
    "TOP_RECIPIENT_DOMINANCE": ["7d", "30d", "all_time"],
    "HIGH_CONCENTRATION_INDEX": ["7d", "30d", "all_time"],
    "PROJECT_BUCKET_DOMINANCE": ["7d", "30d", "all_time"],
    "FLAGGED_EXPOSURE_ELEVATED": ["7d", "30d", "all_time"],
    "DISPUTED_OPERATOR_EXPOSURE": ["7d", "30d", "all_time"]
  },
  "worst_window": "7d",
  "review_priority_window": "7d",
  "emission_posture": "restrict",
  "reason_codes": [
    "TOP_RECIPIENT_DOMINANCE",
    "HIGH_CONCENTRATION_INDEX",
    "PROJECT_BUCKET_DOMINANCE",
    "FLAGGED_EXPOSURE_ELEVATED",
    "DISPUTED_OPERATOR_EXPOSURE"
  ],
  "posture_rationale": "Restrict conditions triggered: TOP_RECIPIENT_DOMINANCE, HIGH_CONCENTRATION_INDEX, PROJECT_BUCKET_DOMINANCE, FLAGGED_EXPOSURE_ELEVATED, DISPUTED_OPERATOR_EXPOSURE. Worst window: 7d. Recommend pausing or reducing emissions until resolved.",
  "validation_warnings": []
}
```

---

### Example 3: Restrict Posture (Monopoly)

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
  "exclusion_summary": {
    "input_record_count": 2,
    "accepted_record_count": 2,
    "excluded_record_count": 0,
    "excluded_reward_total": 0,
    "exclusion_reason_counts": {
      "non_positive_reward": 0,
      "invalid_timestamp": 0,
      "future_timestamp": 0
    }
  },
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
  "top_recipients_by_window": {
    "7d": [
      { "operator_id": "op_monopoly", "total_pft": 15000, "share": 1, "record_count": 2 }
    ],
    "30d": [
      { "operator_id": "op_monopoly", "total_pft": 15000, "share": 1, "record_count": 2 }
    ],
    "all_time": [
      { "operator_id": "op_monopoly", "total_pft": 15000, "share": 1, "record_count": 2 }
    ]
  },
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
  "dominant_project_buckets_by_window": {
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
  "window_postures": { "7d": "restrict", "30d": "restrict", "all_time": "restrict" },
  "triggered_windows": {
    "TOP_RECIPIENT_DOMINANCE": ["7d", "30d", "all_time"],
    "HIGH_CONCENTRATION_INDEX": ["7d", "30d", "all_time"],
    "PROJECT_BUCKET_DOMINANCE": ["7d", "30d", "all_time"]
  },
  "worst_window": "7d",
  "review_priority_window": "7d",
  "emission_posture": "restrict",
  "reason_codes": [
    "TOP_RECIPIENT_DOMINANCE",
    "HIGH_CONCENTRATION_INDEX",
    "PROJECT_BUCKET_DOMINANCE"
  ],
  "posture_rationale": "Restrict conditions triggered: TOP_RECIPIENT_DOMINANCE, HIGH_CONCENTRATION_INDEX, PROJECT_BUCKET_DOMINANCE. Worst window: 7d. Recommend pausing or reducing emissions until resolved.",
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

The global posture is derived from per-window postures. Each window is evaluated independently. The worst-case window wins: if the all-time window is `restrict` but the 7-day and 30-day windows are `healthy`, the final posture is `restrict`.

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
| `UNAUTHORIZED_OPERATOR_EXPOSURE` | PFT flowing to unauthorized operators exceeds 5% of total PFT in any window. |
| `HIGH_REWARD_UNVERIFIED_EXPOSURE` | PFT for high-reward unverified tasks exceeds 10% of total PFT in any window. |
| `INSUFFICIENT_DIVERSITY` | Fewer than 3 unique recipients when there are 5 or more records in a window. |

### Posture Escalation Rationale

The threshold structure follows a two-tier escalation model:

- **Top recipient share (25% / 50%):** A single operator receiving a quarter of all emissions is a concentration signal worth monitoring. At half, the distribution has effectively failed and should be paused.
- **HHI (0.15 / 0.30):** An HHI of 0.15 already suggests moderate concentration (equivalent to roughly 6-7 equal recipients). An HHI of 0.30 indicates a highly concentrated market structure.
- **Flagged exposure (10% / 25%):** At 10%, flagged records are a non-trivial portion of emissions. At 25%, a quarter of all PFT is going to records with known risk flags.
- **Project dominance (40% / 70%):** A single project receiving 40% of emissions suggests category imbalance. At 70%, the network is essentially funding one initiative.
- **Non-public evidence (15%):** When 15% or more of PFT flows to tasks with non-public evidence, the transparency of the reward process is degraded.
- **Unauthorized operator (5%):** Even a small share of PFT going to unauthorized operators is a serious concern, hence the low threshold.
- **High-reward unverified (10%):** When 10% or more of PFT goes to high-reward unverified tasks, the verification process needs attention.
- **Insufficient diversity:** A hard floor of 3 unique recipients for any window with 5+ records ensures a minimum spread.
- **Specific flag codes (disputed, stale):** These are presence-based triggers that immediately escalate to watch, ensuring human review of any flagged activity.

---

## Per-Window Posture

The v2 output includes per-window posture metadata that allows reviewers to distinguish between historical concentration issues and recent ones.

### Fields

| Field | Type | Description |
|---|---|---|
| `window_postures` | `Record<WindowLabel, EmissionPosture>` | The independently derived posture for each of the three windows (`7d`, `30d`, `all_time`). |
| `triggered_windows` | `Record<string, WindowLabel[]>` | Maps each triggered reason code to the list of windows that produced it. `CLEAN` is omitted. |
| `worst_window` | `WindowLabel` | The window with the highest severity posture. Ties broken by preferring shorter windows (7d > 30d > all_time). |
| `review_priority_window` | `WindowLabel` | The most recent (shortest) window with a non-healthy posture, or `7d` if all windows are healthy. This tells reviewers where to focus first. |

### How It Works

Each window is evaluated independently using `deriveWindowPosture()`. The global posture is then derived from the per-window postures by taking the worst case. This allows a scenario where the 7-day window is healthy but the all-time window is restrict -- the reviewer can see that recent emissions are fine but historical concentration remains.

---

## Exclusion Summary

The v2 output includes an `exclusion_summary` block that provides full auditability of record filtering.

### Fields

| Field | Type | Description |
|---|---|---|
| `input_record_count` | `number` | Total records passed into the analyzer. |
| `accepted_record_count` | `number` | Records that passed all filters and were included in analysis. |
| `excluded_record_count` | `number` | Records excluded from analysis. |
| `excluded_reward_total` | `number` | Total PFT value of excluded records (absolute value for negative amounts). |
| `exclusion_reason_counts` | `object` | Breakdown: `non_positive_reward` (zero or negative amount), `invalid_timestamp` (unparseable), `future_timestamp` (after `as_of`). |

Records are excluded before window filtering. Excluded records never influence any metric or posture decision.

---

## Flagged Exposure Inference

In v2, flagged exposure is inferred from **both** explicit `risk_flags` **and** `evidence_visibility` independently. This fixes a v1 bug where `evidence_visibility` was only checked when `risk_flags` was already present on the record.

### Inference Rules

1. All flags listed in `risk_flags` are counted directly.
2. If `evidence_visibility` is one of `private`, `missing`, `expired`, or `malformed`, the `non_public_evidence` flag is added automatically -- even if `risk_flags` is empty or undefined.
3. A record with multiple flags (explicit or inferred) counts only **once** toward `total_flagged_pft`, but each individual flag receives its own per-flag PFT tally.

### Example

A record with `evidence_visibility: "private"` and no `risk_flags` field will:
- Be counted under `by_flag.non_public_evidence`
- Contribute to `total_flagged_pft` and `total_flagged_share`
- Trigger `NON_PUBLIC_EVIDENCE_EXPOSURE` if the share exceeds the 15% threshold

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
| `non_public_evidence_watch` | 0.15 | Non-public evidence PFT share at or above this triggers watch. |
| `unauthorized_operator_watch` | 0.05 | Unauthorized operator PFT share at or above this triggers watch. |
| `high_reward_unverified_watch` | 0.10 | High-reward unverified PFT share at or above this triggers watch. |

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

export type EvidenceVisibility =
  | 'public'
  | 'authenticated'
  | 'private'
  | 'expired'
  | 'missing'
  | 'malformed';

export type RiskFlag =
  | 'disputed_operator'
  | 'non_public_evidence'
  | 'stale_or_inactive_recipient'
  | 'unauthorized_operator'
  | 'high_reward_unverified';

export interface RewardedTaskRecord {
  task_id: string;
  operator_id: string;
  reward_amount: number;
  timestamp: string;                    // ISO 8601
  project_bucket?: string;
  evidence_visibility?: EvidenceVisibility;
  risk_flags?: RiskFlag[];
}

export interface AnalyzerThresholds {
  top_recipient_watch: number;
  top_recipient_restrict: number;
  concentration_index_watch: number;
  concentration_index_restrict: number;
  flagged_exposure_watch: number;
  flagged_exposure_restrict: number;
  project_dominance_watch: number;
  project_dominance_restrict: number;
  non_public_evidence_watch: number;      // Share of non-public evidence triggering watch
  unauthorized_operator_watch: number;    // Share of unauthorized operator PFT triggering watch
  high_reward_unverified_watch: number;   // Share of high-reward-unverified PFT triggering watch
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
  non_public_evidence_watch: 0.15,
  unauthorized_operator_watch: 0.05,
  high_reward_unverified_watch: 0.10,
};

export interface AnalyzerInput {
  records: RewardedTaskRecord[];
  as_of: string;
  thresholds?: Partial<AnalyzerThresholds>;
}

// ============================================================================
// Output Types
// ============================================================================

export type EmissionPosture = 'healthy' | 'watch' | 'restrict';
export type WindowLabel = '7d' | '30d' | 'all_time';

export type ReasonCode =
  | 'TOP_RECIPIENT_DOMINANCE'
  | 'HIGH_CONCENTRATION_INDEX'
  | 'FLAGGED_EXPOSURE_ELEVATED'
  | 'PROJECT_BUCKET_DOMINANCE'
  | 'DISPUTED_OPERATOR_EXPOSURE'
  | 'NON_PUBLIC_EVIDENCE_EXPOSURE'
  | 'STALE_RECIPIENT_EXPOSURE'
  | 'UNAUTHORIZED_OPERATOR_EXPOSURE'
  | 'HIGH_REWARD_UNVERIFIED_EXPOSURE'
  | 'INSUFFICIENT_DIVERSITY'
  | 'CLEAN';

export interface WindowMetrics {
  window: WindowLabel;
  total_pft: number;
  total_records: number;
  unique_recipients: number;
  unique_projects: number;
  concentration_index: number;
  top_recipient_id: string;
  top_recipient_share: number;
  top_recipient_pft: number;
  top_project_bucket: string;
  top_project_share: number;
  top_project_pft: number;
}

export interface TopRecipient {
  operator_id: string;
  total_pft: number;
  share: number;
  record_count: number;
}

export interface DominantProjectBucket {
  bucket: string;
  total_pft: number;
  share: number;
  record_count: number;
}

export interface ProjectBucketShare {
  bucket: string;
  total_pft: number;
  share: number;
  record_count: number;
}

export interface FlaggedExposureTotals {
  total_flagged_pft: number;
  total_flagged_share: number;
  by_flag: Record<RiskFlag, { pft: number; share: number; record_count: number }>;
}

export interface ExclusionSummary {
  input_record_count: number;
  accepted_record_count: number;
  excluded_record_count: number;
  excluded_reward_total: number;
  exclusion_reason_counts: {
    non_positive_reward: number;
    invalid_timestamp: number;
    future_timestamp: number;
  };
}

export interface AnalyzerOutput {
  generated_at: string;
  as_of: string;
  version: string;
  exclusion_summary: ExclusionSummary;
  window_metrics: Record<WindowLabel, WindowMetrics>;
  concentration_index: Record<WindowLabel, number>;
  top_recipient_share: Record<WindowLabel, number>;
  top_recipients_by_window: Record<WindowLabel, TopRecipient[]>;
  project_bucket_share: Record<WindowLabel, ProjectBucketShare[]>;
  dominant_project_buckets_by_window: Record<WindowLabel, DominantProjectBucket[]>;
  flagged_exposure_totals: Record<WindowLabel, FlaggedExposureTotals>;
  window_postures: Record<WindowLabel, EmissionPosture>;
  triggered_windows: Record<string, WindowLabel[]>;
  worst_window: WindowLabel;
  review_priority_window: WindowLabel;
  emission_posture: EmissionPosture;
  reason_codes: ReasonCode[];
  posture_rationale: string;
  validation_warnings: string[];
}

export type InvalidReasonCode = 'INVALID_INPUT' | 'MISSING_RECORDS' | 'MISSING_AS_OF';
```

### analyzer.ts

```typescript
/**
 * Reward Token Emissions Concentration Analyzer — Core Logic
 *
 * Deterministic module. Never reads the runtime clock.
 * All timestamps derive from the required as_of input field.
 * Malformed inputs fail closed. Flagged exposure is inferred from
 * both explicit risk_flags AND evidence_visibility independently.
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
  type TopRecipient,
  type DominantProjectBucket,
  type ProjectBucketShare,
  type FlaggedExposureTotals,
  type ExclusionSummary,
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

// ============================================================================
// Record Filtering + Exclusion Summary
// ============================================================================

function filterAndSummarize(
  records: RewardedTaskRecord[],
  asOfMs: number,
): { accepted: RewardedTaskRecord[]; summary: ExclusionSummary } {
  const summary: ExclusionSummary = {
    input_record_count: records.length,
    accepted_record_count: 0,
    excluded_record_count: 0,
    excluded_reward_total: 0,
    exclusion_reason_counts: {
      non_positive_reward: 0,
      invalid_timestamp: 0,
      future_timestamp: 0,
    },
  };

  const accepted: RewardedTaskRecord[] = [];

  for (const r of records) {
    if (!r || typeof r !== 'object') {
      summary.excluded_record_count++;
      continue;
    }

    if (typeof r.reward_amount !== 'number' || r.reward_amount <= 0) {
      summary.exclusion_reason_counts.non_positive_reward++;
      summary.excluded_record_count++;
      summary.excluded_reward_total += (typeof r.reward_amount === 'number' ? Math.abs(r.reward_amount) : 0);
      continue;
    }

    const ts = new Date(r.timestamp).getTime();
    if (!r.timestamp || isNaN(ts)) {
      summary.exclusion_reason_counts.invalid_timestamp++;
      summary.excluded_record_count++;
      summary.excluded_reward_total += r.reward_amount;
      continue;
    }

    if (ts > asOfMs) {
      summary.exclusion_reason_counts.future_timestamp++;
      summary.excluded_record_count++;
      summary.excluded_reward_total += r.reward_amount;
      continue;
    }

    accepted.push(r);
  }

  summary.accepted_record_count = accepted.length;
  summary.excluded_reward_total = round4(summary.excluded_reward_total);

  return { accepted, summary };
}

// ============================================================================
// Empty Builders
// ============================================================================

function buildEmptyWindowMetrics(window: WindowLabel): WindowMetrics {
  return {
    window, total_pft: 0, total_records: 0, unique_recipients: 0,
    unique_projects: 0, concentration_index: 0,
    top_recipient_id: 'N/A', top_recipient_share: 0, top_recipient_pft: 0,
    top_project_bucket: 'N/A', top_project_share: 0, top_project_pft: 0,
  };
}

function buildEmptyFlaggedExposure(): FlaggedExposureTotals {
  const flags: RiskFlag[] = [
    'disputed_operator', 'non_public_evidence', 'stale_or_inactive_recipient',
    'unauthorized_operator', 'high_reward_unverified',
  ];
  const byFlag: Record<string, { pft: number; share: number; record_count: number }> = {};
  for (const f of flags) byFlag[f] = { pft: 0, share: 0, record_count: 0 };
  return { total_flagged_pft: 0, total_flagged_share: 0, by_flag: byFlag as FlaggedExposureTotals['by_flag'] };
}

const EMPTY_EXCLUSION: ExclusionSummary = {
  input_record_count: 0, accepted_record_count: 0, excluded_record_count: 0,
  excluded_reward_total: 0,
  exclusion_reason_counts: { non_positive_reward: 0, invalid_timestamp: 0, future_timestamp: 0 },
};

function buildInvalidOutput(input: unknown, reason: string, warnings: string[]): AnalyzerOutput {
  const obj = (input && typeof input === 'object') ? input as Record<string, unknown> : {};
  const asOf = (typeof obj.as_of === 'string' && obj.as_of) ? obj.as_of : 'UNKNOWN';

  const emptyMetrics: Record<WindowLabel, WindowMetrics> = {
    '7d': buildEmptyWindowMetrics('7d'),
    '30d': buildEmptyWindowMetrics('30d'),
    'all_time': buildEmptyWindowMetrics('all_time'),
  };
  const emptyFlagged: Record<WindowLabel, FlaggedExposureTotals> = {
    '7d': buildEmptyFlaggedExposure(), '30d': buildEmptyFlaggedExposure(), 'all_time': buildEmptyFlaggedExposure(),
  };

  return {
    generated_at: asOf, as_of: asOf, version: SCHEMA_VERSION,
    exclusion_summary: EMPTY_EXCLUSION,
    window_metrics: emptyMetrics,
    concentration_index: { '7d': 0, '30d': 0, 'all_time': 0 },
    top_recipient_share: { '7d': 0, '30d': 0, 'all_time': 0 },
    top_recipients_by_window: { '7d': [], '30d': [], 'all_time': [] },
    project_bucket_share: { '7d': [], '30d': [], 'all_time': [] },
    dominant_project_buckets_by_window: { '7d': [], '30d': [], 'all_time': [] },
    flagged_exposure_totals: emptyFlagged,
    window_postures: { '7d': 'healthy', '30d': 'healthy', 'all_time': 'healthy' },
    triggered_windows: {},
    worst_window: '7d',
    review_priority_window: '7d',
    emission_posture: 'restrict',
    reason_codes: ['CLEAN'],
    posture_rationale: `Input failed validation: ${reason}. Empty snapshot returned.`,
    validation_warnings: warnings,
  };
}

// ============================================================================
// Window Filtering
// ============================================================================

const WINDOW_DAYS: Record<WindowLabel, number | null> = { '7d': 7, '30d': 30, 'all_time': null };

function filterByWindow(records: RewardedTaskRecord[], window: WindowLabel, asOfMs: number): RewardedTaskRecord[] {
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

function computeHHI(shares: number[]): number {
  if (shares.length === 0) return 0;
  return shares.reduce((sum, s) => sum + s * s, 0);
}

function computeRecipientConcentration(records: RewardedTaskRecord[]): {
  byRecipient: Map<string, { pft: number; count: number }>; totalPft: number;
} {
  const byRecipient = new Map<string, { pft: number; count: number }>();
  let totalPft = 0;
  for (const r of records) {
    if (r.reward_amount <= 0) continue;
    totalPft += r.reward_amount;
    const existing = byRecipient.get(r.operator_id) ?? { pft: 0, count: 0 };
    existing.pft += r.reward_amount;
    existing.count += 1;
    byRecipient.set(r.operator_id, existing);
  }
  return { byRecipient, totalPft };
}

function computeProjectConcentration(records: RewardedTaskRecord[]): Map<string, { pft: number; count: number }> {
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

function sortedEntries<T>(map: Map<string, T>, getPft: (v: T) => number): [string, T][] {
  return [...map.entries()].sort((a, b) => {
    const diff = getPft(b[1]) - getPft(a[1]);
    if (diff !== 0) return diff;
    return a[0].localeCompare(b[0]);
  });
}

function computeWindowMetrics(records: RewardedTaskRecord[], window: WindowLabel): WindowMetrics {
  if (records.length === 0) return buildEmptyWindowMetrics(window);

  const { byRecipient, totalPft } = computeRecipientConcentration(records);
  if (totalPft === 0) return buildEmptyWindowMetrics(window);

  const recipientShares = [...byRecipient.values()].map((v) => v.pft / totalPft);
  const hhi = computeHHI(recipientShares);

  const sortedRecipients = sortedEntries(byRecipient, (v) => v.pft);
  const [topId, topData] = sortedRecipients[0] ?? ['N/A', { pft: 0 }];

  const byProject = computeProjectConcentration(records);
  const projects = new Set(records.map((r) => r.project_bucket ?? 'unclassified'));
  const sortedProjects = sortedEntries(byProject, (v) => v.pft);
  const [topBucket, topBucketData] = sortedProjects[0] ?? ['N/A', { pft: 0 }];

  return {
    window, total_pft: round4(totalPft), total_records: records.length,
    unique_recipients: byRecipient.size, unique_projects: projects.size,
    concentration_index: round4(hhi),
    top_recipient_id: topId, top_recipient_share: round4(topData.pft / totalPft), top_recipient_pft: round4(topData.pft),
    top_project_bucket: topBucket, top_project_share: round4(topBucketData.pft / totalPft), top_project_pft: round4(topBucketData.pft),
  };
}

function computeTopRecipients(records: RewardedTaskRecord[], totalPft: number, limit: number = 5): TopRecipient[] {
  if (records.length === 0 || totalPft === 0) return [];
  const { byRecipient } = computeRecipientConcentration(records);
  const sorted = sortedEntries(byRecipient, (v) => v.pft);
  return sorted.slice(0, limit).map(([id, data]) => ({
    operator_id: id,
    total_pft: round4(data.pft),
    share: round4(data.pft / totalPft),
    record_count: data.count,
  }));
}

function computeDominantProjects(records: RewardedTaskRecord[], totalPft: number, watchThreshold: number): DominantProjectBucket[] {
  if (records.length === 0 || totalPft === 0) return [];
  const byProject = computeProjectConcentration(records);
  const sorted = sortedEntries(byProject, (v) => v.pft);
  return sorted
    .filter(([_, data]) => data.pft / totalPft >= watchThreshold)
    .map(([bucket, data]) => ({
      bucket,
      total_pft: round4(data.pft),
      share: round4(data.pft / totalPft),
      record_count: data.count,
    }));
}

function computeProjectBucketShares(records: RewardedTaskRecord[], totalPft: number): ProjectBucketShare[] {
  if (records.length === 0 || totalPft === 0) return [];
  const byProject = computeProjectConcentration(records);
  const shares: ProjectBucketShare[] = [];
  for (const [bucket, data] of byProject.entries()) {
    shares.push({ bucket, total_pft: round4(data.pft), share: round4(data.pft / totalPft), record_count: data.count });
  }
  shares.sort((a, b) => {
    if (a.share !== b.share) return b.share - a.share;
    return a.bucket.localeCompare(b.bucket);
  });
  return shares;
}

// ============================================================================
// Flagged Exposure — FIX: infer flags from BOTH risk_flags AND evidence_visibility
// ============================================================================

const NON_PUBLIC_VISIBILITIES = new Set(['private', 'missing', 'expired', 'malformed']);

function inferFlags(record: RewardedTaskRecord): Set<RiskFlag> {
  const flags = new Set<RiskFlag>(record.risk_flags ?? []);

  // Independently infer non_public_evidence from evidence_visibility
  // This runs regardless of whether risk_flags is present
  if (record.evidence_visibility && NON_PUBLIC_VISIBILITIES.has(record.evidence_visibility)) {
    flags.add('non_public_evidence');
  }

  return flags;
}

function computeFlaggedExposure(records: RewardedTaskRecord[], totalPft: number): FlaggedExposureTotals {
  const result = buildEmptyFlaggedExposure();
  if (totalPft === 0) return result;

  const flaggedTaskIds = new Set<string>();

  for (const r of records) {
    if (r.reward_amount <= 0) continue;

    const flags = inferFlags(r);
    if (flags.size === 0) continue;

    for (const flag of flags) {
      const entry = result.by_flag[flag];
      if (entry) {
        entry.pft += r.reward_amount;
        entry.record_count += 1;
      }
    }

    // Count toward total only once per task
    if (!flaggedTaskIds.has(r.task_id)) {
      result.total_flagged_pft += r.reward_amount;
      flaggedTaskIds.add(r.task_id);
    }
  }

  result.total_flagged_share = round4(result.total_flagged_pft / totalPft);
  for (const flag of Object.keys(result.by_flag) as RiskFlag[]) {
    result.by_flag[flag].pft = round4(result.by_flag[flag].pft);
    result.by_flag[flag].share = round4(result.by_flag[flag].pft / totalPft);
  }
  result.total_flagged_pft = round4(result.total_flagged_pft);

  return result;
}

// ============================================================================
// Per-Window Posture
// ============================================================================

function deriveWindowPosture(
  metrics: WindowMetrics,
  flagged: FlaggedExposureTotals,
  thresholds: AnalyzerThresholds,
): { posture: EmissionPosture; codes: ReasonCode[] } {
  const codes: ReasonCode[] = [];
  let hasRestrict = false;
  let hasWatch = false;

  if (metrics.total_pft === 0) return { posture: 'healthy', codes: ['CLEAN'] };

  // Top recipient
  if (metrics.top_recipient_share >= thresholds.top_recipient_restrict) {
    codes.push('TOP_RECIPIENT_DOMINANCE'); hasRestrict = true;
  } else if (metrics.top_recipient_share >= thresholds.top_recipient_watch) {
    codes.push('TOP_RECIPIENT_DOMINANCE'); hasWatch = true;
  }

  // HHI
  if (metrics.concentration_index >= thresholds.concentration_index_restrict) {
    codes.push('HIGH_CONCENTRATION_INDEX'); hasRestrict = true;
  } else if (metrics.concentration_index >= thresholds.concentration_index_watch) {
    codes.push('HIGH_CONCENTRATION_INDEX'); hasWatch = true;
  }

  // Project dominance
  if (metrics.top_project_share >= thresholds.project_dominance_restrict) {
    codes.push('PROJECT_BUCKET_DOMINANCE'); hasRestrict = true;
  } else if (metrics.top_project_share >= thresholds.project_dominance_watch) {
    codes.push('PROJECT_BUCKET_DOMINANCE'); hasWatch = true;
  }

  // Aggregate flagged exposure
  if (flagged.total_flagged_share >= thresholds.flagged_exposure_restrict) {
    codes.push('FLAGGED_EXPOSURE_ELEVATED'); hasRestrict = true;
  } else if (flagged.total_flagged_share >= thresholds.flagged_exposure_watch) {
    codes.push('FLAGGED_EXPOSURE_ELEVATED'); hasWatch = true;
  }

  // Per-flag dedicated codes
  if (flagged.by_flag.disputed_operator.pft > 0) {
    codes.push('DISPUTED_OPERATOR_EXPOSURE'); hasWatch = true;
  }
  if (flagged.by_flag.non_public_evidence.share >= thresholds.non_public_evidence_watch) {
    codes.push('NON_PUBLIC_EVIDENCE_EXPOSURE'); hasWatch = true;
  }
  if (flagged.by_flag.stale_or_inactive_recipient.pft > 0) {
    codes.push('STALE_RECIPIENT_EXPOSURE'); hasWatch = true;
  }
  if (flagged.by_flag.unauthorized_operator.share >= thresholds.unauthorized_operator_watch) {
    codes.push('UNAUTHORIZED_OPERATOR_EXPOSURE'); hasWatch = true;
  }
  if (flagged.by_flag.high_reward_unverified.share >= thresholds.high_reward_unverified_watch) {
    codes.push('HIGH_REWARD_UNVERIFIED_EXPOSURE'); hasWatch = true;
  }

  // Diversity
  if (metrics.unique_recipients < 3 && metrics.total_records >= 5) {
    codes.push('INSUFFICIENT_DIVERSITY'); hasWatch = true;
  }

  if (codes.length === 0) codes.push('CLEAN');
  const posture: EmissionPosture = hasRestrict ? 'restrict' : hasWatch ? 'watch' : 'healthy';
  return { posture, codes };
}

// ============================================================================
// Global Posture from Per-Window
// ============================================================================

const WINDOW_PRIORITY: WindowLabel[] = ['7d', '30d', 'all_time'];
const POSTURE_SEVERITY: Record<EmissionPosture, number> = { healthy: 0, watch: 1, restrict: 2 };

function deriveGlobalPosture(
  windowPostures: Record<WindowLabel, EmissionPosture>,
  windowCodes: Record<WindowLabel, ReasonCode[]>,
): {
  posture: EmissionPosture;
  codes: ReasonCode[];
  worstWindow: WindowLabel;
  reviewPriorityWindow: WindowLabel;
  triggeredWindows: Record<string, WindowLabel[]>;
  rationale: string;
} {
  // Aggregate codes (deduplicated, ordered by first appearance across windows)
  const allCodes: ReasonCode[] = [];
  const triggeredWindows: Record<string, WindowLabel[]> = {};

  for (const w of WINDOW_PRIORITY) {
    for (const code of windowCodes[w]) {
      if (code === 'CLEAN') continue;
      if (!allCodes.includes(code)) allCodes.push(code);
      if (!triggeredWindows[code]) triggeredWindows[code] = [];
      triggeredWindows[code].push(w);
    }
  }

  if (allCodes.length === 0) allCodes.push('CLEAN');

  // Worst window: highest severity, prefer shorter window for tie
  let worstWindow: WindowLabel = '7d';
  let worstSeverity = 0;
  for (const w of WINDOW_PRIORITY) {
    const s = POSTURE_SEVERITY[windowPostures[w]];
    if (s > worstSeverity) {
      worstSeverity = s;
      worstWindow = w;
    }
  }

  // Review priority: most recent window with non-healthy posture, or 7d
  let reviewPriorityWindow: WindowLabel = '7d';
  for (const w of WINDOW_PRIORITY) {
    if (windowPostures[w] !== 'healthy') {
      reviewPriorityWindow = w;
      break;
    }
  }

  const posture = windowPostures[worstWindow];

  const rationale = posture === 'healthy'
    ? 'All windows within healthy thresholds. No concentration or exposure concerns detected.'
    : posture === 'watch'
    ? `Watch conditions triggered: ${allCodes.filter(c => c !== 'CLEAN').join(', ')}. Worst window: ${worstWindow}. Recommend review before next emission cycle.`
    : `Restrict conditions triggered: ${allCodes.filter(c => c !== 'CLEAN').join(', ')}. Worst window: ${worstWindow}. Recommend pausing or reducing emissions until resolved.`;

  return { posture, codes: allCodes, worstWindow, reviewPriorityWindow, triggeredWindows, rationale };
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

  const { accepted, summary } = filterAndSummarize(typedInput.records, asOfMs);

  const windows: WindowLabel[] = ['7d', '30d', 'all_time'];
  const windowMetrics = {} as Record<WindowLabel, WindowMetrics>;
  const concentrationIndex = {} as Record<WindowLabel, number>;
  const topRecipientShare = {} as Record<WindowLabel, number>;
  const topRecipientsByWindow = {} as Record<WindowLabel, TopRecipient[]>;
  const projectBucketShare = {} as Record<WindowLabel, ProjectBucketShare[]>;
  const dominantProjectsByWindow = {} as Record<WindowLabel, DominantProjectBucket[]>;
  const flaggedExposureTotals = {} as Record<WindowLabel, FlaggedExposureTotals>;
  const windowPostures = {} as Record<WindowLabel, EmissionPosture>;
  const windowCodes = {} as Record<WindowLabel, ReasonCode[]>;

  for (const w of windows) {
    const filtered = filterByWindow(accepted, w, asOfMs);
    const metrics = computeWindowMetrics(filtered, w);
    windowMetrics[w] = metrics;
    concentrationIndex[w] = metrics.concentration_index;
    topRecipientShare[w] = metrics.top_recipient_share;
    topRecipientsByWindow[w] = computeTopRecipients(filtered, metrics.total_pft);
    projectBucketShare[w] = computeProjectBucketShares(filtered, metrics.total_pft);
    dominantProjectsByWindow[w] = computeDominantProjects(filtered, metrics.total_pft, thresholds.project_dominance_watch);
    flaggedExposureTotals[w] = computeFlaggedExposure(filtered, metrics.total_pft);

    const { posture, codes } = deriveWindowPosture(metrics, flaggedExposureTotals[w], thresholds);
    windowPostures[w] = posture;
    windowCodes[w] = codes;
  }

  const global = deriveGlobalPosture(windowPostures, windowCodes);

  return {
    generated_at: asOf, as_of: asOf, version: SCHEMA_VERSION,
    exclusion_summary: summary,
    window_metrics: windowMetrics,
    concentration_index: concentrationIndex,
    top_recipient_share: topRecipientShare,
    top_recipients_by_window: topRecipientsByWindow,
    project_bucket_share: projectBucketShare,
    dominant_project_buckets_by_window: dominantProjectsByWindow,
    flagged_exposure_totals: flaggedExposureTotals,
    window_postures: windowPostures,
    triggered_windows: global.triggeredWindows,
    worst_window: global.worstWindow,
    review_priority_window: global.reviewPriorityWindow,
    emission_posture: global.posture,
    reason_codes: global.codes,
    posture_rationale: global.rationale,
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
 * Original 20 tests + 10 new tests from review:
 * 21. Private evidence with no risk_flags still counts as non_public_evidence
 * 22. unauthorized_operator produces dedicated reason code
 * 23. high_reward_unverified produces dedicated reason code
 * 24. Record with multiple flags counts once toward total_flagged_pft
 * 25. Exact flagged_exposure_watch boundary
 * 26. Exact flagged_exposure_restrict boundary
 * 27. Exact project_dominance_watch boundary
 * 28. Exact project_dominance_restrict boundary
 * 29. all_time restrict but 7d healthy produces correct window_postures
 * 30. Excluded-record summary is deterministic
 */

import { describe, it, expect } from 'vitest';
import { analyzeEmissions } from '../src/analyzer.js';
import type { AnalyzerInput, RewardedTaskRecord } from '../src/types.js';

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
  return { records, as_of: NOW, ...overrides };
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
    expect(result.exclusion_summary.input_record_count).toBe(0);
    expect(result.exclusion_summary.accepted_record_count).toBe(0);
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
        task_id: `t${i}`, operator_id: `op_${String(i).padStart(3, '0')}`,
        reward_amount: 1000, project_bucket: `proj_${i % 4}`,
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
    expect(result.window_metrics['7d'].top_recipient_share).toBe(0.25);
    expect(result.reason_codes).toContain('TOP_RECIPIENT_DOMINANCE');
    expect(result.emission_posture).toBe('watch');
  });
});

// ============================================================================
// Test 5: Threshold Boundary — concentration_index_restrict
// ============================================================================

describe('Threshold Boundary — Concentration Index', () => {
  it('triggers restrict when HHI >= 0.30', () => {
    const records = [
      makeRecord({ task_id: 't1', operator_id: 'op_a', reward_amount: 5500, project_bucket: 'p1' }),
      makeRecord({ task_id: 't2', operator_id: 'op_b', reward_amount: 4500, project_bucket: 'p2' }),
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
    expect(result.window_metrics['7d'].top_recipient_id).toBe('op_alice');
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
    expect(result.reason_codes).toContain('DISPUTED_OPERATOR_EXPOSURE');
  });
});

// ============================================================================
// Test 9: Flagged Exposure — non_public_evidence
// ============================================================================

describe('Flagged Exposure — Non-Public Evidence', () => {
  it('detects non_public_evidence above threshold', () => {
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
    expect(result.window_metrics['7d'].total_records).toBe(1);
    expect(result.window_metrics['7d'].total_pft).toBe(1000);
    expect(result.window_metrics['30d'].total_records).toBe(2);
    expect(result.window_metrics['30d'].total_pft).toBe(3000);
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
      makeRecord({ task_id: 't1', operator_id: 'op_a', reward_amount: 6000, project_bucket: 'p1' }),
      makeRecord({ task_id: 't2', operator_id: 'op_b', reward_amount: 4000, project_bucket: 'p2' }),
    ];
    const defaultResult = analyzeEmissions(makeInput(records));
    expect(defaultResult.emission_posture).toBe('restrict');

    const permissive = analyzeEmissions(makeInput(records, {
      thresholds: { top_recipient_restrict: 0.70, concentration_index_restrict: 0.60 },
    }));
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
    expect(result.dominant_project_buckets_by_window['7d'].length).toBeGreaterThan(0);
    expect(result.dominant_project_buckets_by_window['7d'][0].bucket).toBe('defi');
  });
});

// ============================================================================
// Test 18: Insufficient Diversity
// ============================================================================

describe('Insufficient Diversity', () => {
  it('flags when too few recipients for record count', () => {
    const records = Array.from({ length: 6 }, (_, i) =>
      makeRecord({ task_id: `t${i}`, operator_id: i < 4 ? 'op_a' : 'op_b', reward_amount: 1000 })
    );
    const result = analyzeEmissions(makeInput(records));
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
    expect(result.window_metrics['all_time'].total_records).toBe(1);
    expect(result.window_metrics['all_time'].total_pft).toBe(1000);
    expect(result.exclusion_summary.excluded_record_count).toBe(1);
    expect(result.exclusion_summary.exclusion_reason_counts.future_timestamp).toBe(1);
    expect(result.exclusion_summary.excluded_reward_total).toBe(9000);
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
  });
});

// ============================================================================
// Test 21: Private evidence with no risk_flags still counts as non_public_evidence
// ============================================================================

describe('Inferred Non-Public Evidence', () => {
  it('infers non_public_evidence from evidence_visibility even without risk_flags', () => {
    const records = [
      makeRecord({ task_id: 't1', operator_id: 'op_a', reward_amount: 2000, evidence_visibility: 'private' }),
      makeRecord({ task_id: 't2', operator_id: 'op_b', reward_amount: 8000 }),
    ];
    const result = analyzeEmissions(makeInput(records));
    expect(result.flagged_exposure_totals['7d'].by_flag.non_public_evidence.pft).toBe(2000);
    expect(result.flagged_exposure_totals['7d'].by_flag.non_public_evidence.share).toBe(0.2);
    expect(result.reason_codes).toContain('NON_PUBLIC_EVIDENCE_EXPOSURE');
  });

  it('infers from missing evidence_visibility too', () => {
    const records = [
      makeRecord({ task_id: 't1', operator_id: 'op_a', reward_amount: 3000, evidence_visibility: 'missing' }),
      makeRecord({ task_id: 't2', operator_id: 'op_b', reward_amount: 7000 }),
    ];
    const result = analyzeEmissions(makeInput(records));
    expect(result.flagged_exposure_totals['7d'].by_flag.non_public_evidence.pft).toBe(3000);
  });
});

// ============================================================================
// Test 22: unauthorized_operator produces dedicated reason code
// ============================================================================

describe('Unauthorized Operator Exposure', () => {
  it('produces UNAUTHORIZED_OPERATOR_EXPOSURE reason code', () => {
    const records = [
      makeRecord({ task_id: 't1', operator_id: 'op_unauth', reward_amount: 1000, risk_flags: ['unauthorized_operator'] }),
      makeRecord({ task_id: 't2', operator_id: 'op_b', reward_amount: 9000 }),
    ];
    const result = analyzeEmissions(makeInput(records));
    // 1000/10000 = 0.10 >= 0.05 threshold
    expect(result.flagged_exposure_totals['7d'].by_flag.unauthorized_operator.pft).toBe(1000);
    expect(result.reason_codes).toContain('UNAUTHORIZED_OPERATOR_EXPOSURE');
  });
});

// ============================================================================
// Test 23: high_reward_unverified produces dedicated reason code
// ============================================================================

describe('High Reward Unverified Exposure', () => {
  it('produces HIGH_REWARD_UNVERIFIED_EXPOSURE reason code', () => {
    const records = [
      makeRecord({ task_id: 't1', operator_id: 'op_a', reward_amount: 2000, risk_flags: ['high_reward_unverified'] }),
      makeRecord({ task_id: 't2', operator_id: 'op_b', reward_amount: 8000 }),
    ];
    const result = analyzeEmissions(makeInput(records));
    // 2000/10000 = 0.20 >= 0.10 threshold
    expect(result.flagged_exposure_totals['7d'].by_flag.high_reward_unverified.pft).toBe(2000);
    expect(result.reason_codes).toContain('HIGH_REWARD_UNVERIFIED_EXPOSURE');
  });
});

// ============================================================================
// Test 24: Record with multiple flags counts once toward total_flagged_pft
// ============================================================================

describe('Multiple Flags Single Record', () => {
  it('counts record only once toward total_flagged_pft', () => {
    const records = [
      makeRecord({
        task_id: 't1', operator_id: 'op_a', reward_amount: 5000,
        risk_flags: ['disputed_operator', 'non_public_evidence', 'stale_or_inactive_recipient'],
        evidence_visibility: 'private',
      }),
      makeRecord({ task_id: 't2', operator_id: 'op_b', reward_amount: 5000 }),
    ];
    const result = analyzeEmissions(makeInput(records));
    // total_flagged_pft should be 5000, not 15000
    expect(result.flagged_exposure_totals['7d'].total_flagged_pft).toBe(5000);
    expect(result.flagged_exposure_totals['7d'].total_flagged_share).toBe(0.5);
    // But per-flag counts each
    expect(result.flagged_exposure_totals['7d'].by_flag.disputed_operator.pft).toBe(5000);
    expect(result.flagged_exposure_totals['7d'].by_flag.non_public_evidence.pft).toBe(5000);
    expect(result.flagged_exposure_totals['7d'].by_flag.stale_or_inactive_recipient.pft).toBe(5000);
  });
});

// ============================================================================
// Test 25: Exact flagged_exposure_watch boundary
// ============================================================================

describe('Exact Flagged Exposure Watch Boundary', () => {
  it('triggers watch at exactly 10% flagged exposure', () => {
    const records = [
      makeRecord({ task_id: 't1', operator_id: 'op_a', reward_amount: 1000, risk_flags: ['disputed_operator'] }),
      makeRecord({ task_id: 't2', operator_id: 'op_b', reward_amount: 9000 }),
    ];
    const result = analyzeEmissions(makeInput(records));
    // 1000/10000 = 0.10 = exactly flagged_exposure_watch
    expect(result.flagged_exposure_totals['7d'].total_flagged_share).toBe(0.1);
    expect(result.reason_codes).toContain('FLAGGED_EXPOSURE_ELEVATED');
  });
});

// ============================================================================
// Test 26: Exact flagged_exposure_restrict boundary
// ============================================================================

describe('Exact Flagged Exposure Restrict Boundary', () => {
  it('triggers restrict at exactly 25% flagged exposure', () => {
    const records = [
      makeRecord({ task_id: 't1', operator_id: 'op_a', reward_amount: 2500, risk_flags: ['disputed_operator'], project_bucket: 'p1' }),
      makeRecord({ task_id: 't2', operator_id: 'op_b', reward_amount: 2500, project_bucket: 'p2' }),
      makeRecord({ task_id: 't3', operator_id: 'op_c', reward_amount: 2500, project_bucket: 'p3' }),
      makeRecord({ task_id: 't4', operator_id: 'op_d', reward_amount: 2500, project_bucket: 'p4' }),
    ];
    const result = analyzeEmissions(makeInput(records));
    expect(result.flagged_exposure_totals['7d'].total_flagged_share).toBe(0.25);
    expect(result.reason_codes).toContain('FLAGGED_EXPOSURE_ELEVATED');
    // Should be restrict because flagged_exposure_restrict = 0.25
    expect(result.window_postures['7d']).toBe('restrict');
  });
});

// ============================================================================
// Test 27: Exact project_dominance_watch boundary
// ============================================================================

describe('Exact Project Dominance Watch Boundary', () => {
  it('triggers watch at exactly 40% project share', () => {
    const records = [
      makeRecord({ task_id: 't1', operator_id: 'op_a', reward_amount: 4000, project_bucket: 'defi' }),
      makeRecord({ task_id: 't2', operator_id: 'op_b', reward_amount: 3000, project_bucket: 'network' }),
      makeRecord({ task_id: 't3', operator_id: 'op_c', reward_amount: 3000, project_bucket: 'infra' }),
    ];
    const result = analyzeEmissions(makeInput(records));
    expect(result.window_metrics['7d'].top_project_share).toBe(0.4);
    expect(result.reason_codes).toContain('PROJECT_BUCKET_DOMINANCE');
  });
});

// ============================================================================
// Test 28: Exact project_dominance_restrict boundary
// ============================================================================

describe('Exact Project Dominance Restrict Boundary', () => {
  it('triggers restrict at exactly 70% project share', () => {
    const records = [
      makeRecord({ task_id: 't1', operator_id: 'op_a', reward_amount: 7000, project_bucket: 'defi' }),
      makeRecord({ task_id: 't2', operator_id: 'op_b', reward_amount: 1500, project_bucket: 'network' }),
      makeRecord({ task_id: 't3', operator_id: 'op_c', reward_amount: 1500, project_bucket: 'infra' }),
    ];
    const result = analyzeEmissions(makeInput(records));
    expect(result.window_metrics['7d'].top_project_share).toBe(0.7);
    expect(result.reason_codes).toContain('PROJECT_BUCKET_DOMINANCE');
    expect(result.window_postures['7d']).toBe('restrict');
  });
});

// ============================================================================
// Test 29: all_time restrict but 7d healthy produces correct window_postures
// ============================================================================

describe('Per-Window Posture Divergence', () => {
  it('shows healthy 7d and restrict all_time', () => {
    // 10 evenly distributed recent records (7d: healthy)
    const recentRecords = Array.from({ length: 10 }, (_, i) =>
      makeRecord({
        task_id: `t_recent_${i}`, operator_id: `op_${String(i).padStart(3, '0')}`,
        reward_amount: 1000, timestamp: DAY_3_AGO, project_bucket: `proj_${i % 4}`,
      })
    );
    // 1 old monopoly record (all_time: concentrated)
    const oldRecords = [
      makeRecord({ task_id: 't_old_1', operator_id: 'op_whale', reward_amount: 100000, timestamp: DAY_45_AGO, project_bucket: 'whale_proj' }),
    ];
    const result = analyzeEmissions(makeInput([...recentRecords, ...oldRecords]));

    expect(result.window_postures['7d']).toBe('healthy');
    expect(result.window_postures['30d']).toBe('healthy');
    expect(result.window_postures['all_time']).not.toBe('healthy');
    expect(result.worst_window).toBe('all_time');
    // review_priority_window picks first non-healthy window in [7d, 30d, all_time] order
    // Since only all_time is non-healthy, it correctly returns all_time
    expect(result.review_priority_window).toBe('all_time');
    // Key insight: the per-window breakdown lets reviewers see that recent emissions are fine
    expect(result.emission_posture).not.toBe('healthy');
  });
});

// ============================================================================
// Test 30: Excluded-record summary is deterministic
// ============================================================================

describe('Exclusion Summary Determinism', () => {
  it('produces deterministic exclusion summary', () => {
    const records = [
      makeRecord({ task_id: 't1', operator_id: 'op_a', reward_amount: 1000, timestamp: DAY_3_AGO }),
      makeRecord({ task_id: 't2', operator_id: 'op_b', reward_amount: -500, timestamp: DAY_3_AGO }),
      makeRecord({ task_id: 't3', operator_id: 'op_c', reward_amount: 2000, timestamp: FUTURE }),
      makeRecord({ task_id: 't4', operator_id: 'op_d', reward_amount: 0, timestamp: DAY_3_AGO }),
    ];
    const input = makeInput(records);
    const a = analyzeEmissions(input);
    const b = analyzeEmissions(input);

    expect(JSON.stringify(a.exclusion_summary)).toBe(JSON.stringify(b.exclusion_summary));
    expect(a.exclusion_summary.input_record_count).toBe(4);
    expect(a.exclusion_summary.accepted_record_count).toBe(1);
    expect(a.exclusion_summary.excluded_record_count).toBe(3);
    expect(a.exclusion_summary.exclusion_reason_counts.non_positive_reward).toBe(2);
    expect(a.exclusion_summary.exclusion_reason_counts.future_timestamp).toBe(1);
  });
});
```

### Test Results

```
 ✓ tests/analyzer.test.ts (31 tests) 20ms

 Test Files  1 passed (1)
      Tests  31 passed (31)
   Start at  17:10:24
   Duration  278ms

  ✓ Empty Input > returns healthy posture with zero metrics for empty records
  ✓ Single Recipient Monopoly > flags restrict with TOP_RECIPIENT_DOMINANCE and HIGH_CONCENTRATION_INDEX
  ✓ Evenly Distributed > returns healthy when many recipients share equally
  ✓ Threshold Boundary — Top Recipient Watch > triggers watch at exactly 25% share
  ✓ Threshold Boundary — Concentration Index > triggers restrict when HHI >= 0.30
  ✓ Ties in Recipient Share > breaks ties alphabetically for top_recipient_id
  ✓ Missing Project Buckets > defaults missing project_bucket to unclassified
  ✓ Flagged Exposure — Disputed Operator > detects disputed_operator exposure
  ✓ Flagged Exposure — Non-Public Evidence > detects non_public_evidence above threshold
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
  ✓ Inferred Non-Public Evidence > infers non_public_evidence from evidence_visibility even without risk_flags
  ✓ Inferred Non-Public Evidence > infers from missing evidence_visibility too
  ✓ Unauthorized Operator Exposure > produces UNAUTHORIZED_OPERATOR_EXPOSURE reason code
  ✓ High Reward Unverified Exposure > produces HIGH_REWARD_UNVERIFIED_EXPOSURE reason code
  ✓ Multiple Flags Single Record > counts record only once toward total_flagged_pft
  ✓ Exact Flagged Exposure Watch Boundary > triggers watch at exactly 10% flagged exposure
  ✓ Exact Flagged Exposure Restrict Boundary > triggers restrict at exactly 25% flagged exposure
  ✓ Exact Project Dominance Watch Boundary > triggers watch at exactly 40% project share
  ✓ Exact Project Dominance Restrict Boundary > triggers restrict at exactly 70% project share
  ✓ Per-Window Posture Divergence > shows healthy 7d and restrict all_time
  ✓ Exclusion Summary Determinism > produces deterministic exclusion summary
```

---

*Published by Zoz via the Permanent Upper Class validator operation.*
*Task completed for the Post Fiat Network.*
