---
layout: default
title: Reward Artifact Coverage Audit Module
date: 2026-04-07
category: audit-module
status: published
---

# Reward Artifact Coverage Audit Module

A deterministic TypeScript module for detecting evidence coverage gaps in Post Fiat Network rewarded tasks. Outputs a ranked JSON audit queue for manual review targeting.

## Overview

This module audits rewarded task records to identify operators and tasks with weak, missing, or non-public evidence coverage. It produces a deterministic, sortable queue ranked by audit priority.

**Key Features:**
- Evidence coverage ratio calculation per operator
- Anomaly detection (missing evidence, expired links, malformed verification, high-reward unverified)
- Deterministic priority scoring and banding
- Task-level flagging with reason codes
- Data quality risk detection

## Installation

```bash
npm install
npm run build
npm test
```

## Usage

```typescript
import { auditEvidenceCoverage } from './dist/audit.js';

const result = auditEvidenceCoverage({
  records: [
    {
      task_id: "t1",
      operator_id: "op1",
      reward_pft: 5000,
      rewarded_at: "2026-04-01T10:00:00Z",
      verification_type: "url",
      verification_target: "https://example.com/evidence",
      evidence_visibility: "public"
    }
  ],
  as_of: "2026-04-07T12:00:00Z"
});

console.log(result.operators[0].evidence_coverage_ratio);
console.log(result.operators[0].anomaly_flags);
console.log(result.operators[0].priority_band);
```

## Output Fields

Per-operator:
- `evidence_coverage_ratio` — 0-1, publicly_verifiable_pft / total_pft
- `publicly_verifiable_pft` — PFT with public/authenticated evidence
- `unverifiable_pft` — PFT with private/missing/malformed/expired evidence
- `anomaly_flags` — Array of detected anomalies
- `priority_band` — critical/high/medium/low
- `flagged_task_ids` — Tasks requiring manual review

## Anomaly Types

| Flag | Description |
|------|-------------|
| `HIGH_REWARD_NO_EVIDENCE` | Large reward with missing/private evidence |
| `HIGH_REWARD_SELF_REPORT` | Large reward with only self-report |
| `EVIDENCE_EXPIRED` | Evidence was public, now inaccessible |
| `MALFORMED_VERIFICATION` | Invalid verification metadata |
| `ALL_PRIVATE` | Operator has 0% public evidence |
| `LOW_COVERAGE_HIGH_VOLUME` | Many tasks, low public coverage |
| `CONCENTRATION_RISK` | Single task > 50% of operator's rewards |
| `DATA_QUALITY_RISK` | Duplicate task IDs, malformed URLs, etc. |
| `STALE_EVIDENCE_CHECK` | Evidence not re-verified recently |

## Sample Input

```json
{
  "records": [
    {
      "task_id": "clean-1",
      "operator_id": "operator-clean",
      "reward_pft": 4000,
      "rewarded_at": "2026-04-01T10:00:00Z",
      "verification_type": "url",
      "verification_target": "https://example.com/evidence/clean-1",
      "evidence_visibility": "public"
    },
    {
      "task_id": "partial-1",
      "operator_id": "operator-partial",
      "reward_pft": 6000,
      "rewarded_at": "2026-04-01T10:00:00Z",
      "verification_type": "url",
      "verification_target": "https://example.com/evidence/partial-1",
      "evidence_visibility": "private"
    },
    {
      "task_id": "critical-1",
      "operator_id": "operator-critical",
      "reward_pft": 12000,
      "rewarded_at": "2026-04-01T10:00:00Z",
      "verification_type": "url",
      "verification_target": "not-a-valid-url",
      "evidence_visibility": "public"
    }
  ],
  "as_of": "2026-04-07T12:00:00Z"
}
```

## Sample Output

```json
{
  "operators": [
    {
      "operator_id": "operator-critical",
      "total_tasks": 1,
      "total_pft": 12000,
      "publicly_verifiable_pft": 0,
      "unverifiable_pft": 12000,
      "evidence_coverage_ratio": 0,
      "anomaly_flags": ["MALFORMED_VERIFICATION", "ALL_PRIVATE", "DATA_QUALITY_RISK"],
      "priority_band": "high",
      "flagged_task_ids": ["critical-1"]
    },
    {
      "operator_id": "operator-partial",
      "total_tasks": 1,
      "total_pft": 6000,
      "publicly_verifiable_pft": 0,
      "unverifiable_pft": 6000,
      "evidence_coverage_ratio": 0,
      "anomaly_flags": ["HIGH_REWARD_NO_EVIDENCE", "ALL_PRIVATE"],
      "priority_band": "medium",
      "flagged_task_ids": ["partial-1"]
    },
    {
      "operator_id": "operator-clean",
      "total_tasks": 1,
      "total_pft": 4000,
      "publicly_verifiable_pft": 4000,
      "unverifiable_pft": 0,
      "evidence_coverage_ratio": 1,
      "anomaly_flags": [],
      "priority_band": "low",
      "flagged_task_ids": []
    }
  ]
}
```

## Integrity Guarantees

1. **Expired evidence is unverifiable** — Expired links count toward `unverifiable_pft`
2. **Malformed URLs are hard failures** — Invalid URLs force `MALFORMED_TARGET` flag and count as unverifiable
3. **Missing URL targets are audit risks** — URL verification type without a target triggers `DATA_QUALITY_RISK`
4. **Duplicate task IDs escalate severity** — Duplicates contribute to anomaly scoring, not just warnings

## Repository

Code: [github.com/P-U-C/reward-artifact-coverage-audit](https://github.com/P-U-C/reward-artifact-coverage-audit)

## License

MIT

---
*Published by Zoz via the Permanent Upper Class validator operation.*
*Task completed for the Post Fiat Network.*
