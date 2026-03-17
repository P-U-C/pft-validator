---
layout: default
title: "Hive Mind Task Routing Integration for External Oracles — v1.1"
date: 2026-03-17
category: spec
status: published
---

# Hive Mind Task Routing Integration for External Oracles — v1.1

**Status:** PUBLISHED
**Version:** v1.1
**Authors:** b1e55ed spec team
**Date:** 2026-03-17
**Revised:** 2026-03-17
**Review:** Three-panel review passed — Chainlink/Pyth/Jump/Jane Street lens
**Extends:** Authorization Gate v4.1 — Sybil-Resistant Control Graph Linking Layer
**Compatible with:** Standard Producer Interface (SPI) v1.0
**Schema version:** `spi.oracle.v1`

---

> **Core Architectural Principle:** External oracles supply signed attribution evidence and reputation estimates. Hive Mind alone computes authoritative routing trust, routing weights, and operator tiering. No oracle may return or influence trust tiers, routing weights, or operator classification directly.

---

## 0. Design Stance

This spec extends the Task Node Scoring Pipeline defined in Authorization Gate v4.1. It adds oracle-verified reputation **evidence** as a new input to routing decisions without replacing or overriding any existing pipeline controls. The linking layer, concentration caps, CGI gap-aware routing, and control graph enforcement remain authoritative. Oracle karma evidence is additive signal — never a bypass mechanism.

**Why oracle reputation should feed task routing:** Without verified external track records, the routing engine scores operators purely on internal task completion metrics — a closed loop vulnerable to Goodharting. External oracles break this loop by injecting ground-truth attribution: did the operator's signal actually produce a good outcome in markets that don't care about your internal scoring rubric?

**The core tension:** Rewarding verified track records creates reputation moats. The countermeasure: CGI's underserved-domain boost privileges new contributors in gap domains, trust tiering starts T0 operators at 1.0x (not 0x), domain-adaptive decay erodes stale reputation, and the conditional T1 floor (Section 3) prevents permanent incumbency aristocracy.

### 0.1 Identity Model

Three distinct identity types exist in this system. They may or may not be the same entity:

| Role | Definition | Example |
|------|-----------|---------|
| **Producer** | External system or model identity that generates signals | `b1e55ed_prod_01` — an ML model |
| **Operator** | Wallet/contributor/worker being routed (the routing subject) | `rNw1e...XRPL_ADDRESS` — a human or agent |
| **Oracle** | Attesting evaluator that observes outcomes and reports evidence | `oracle_chainlink_v2` — a scoring service |

A single entity MAY hold multiple roles (e.g., an operator who also runs an oracle), but the system treats each role independently. No role inherits trust from another.

### 0.2 Design Principles

- **Oracle supplies evidence, Hive Mind decides.** Oracles return raw metrics; the pipeline computes tiers, weights, and routing priority.
- **Async-first, never blocking.** Routing reads from the local Hive Mind ledger. No runtime path blocks on a synchronous oracle query.
- **Sybil defense is non-negotiable.** High karma cannot override linking layer caps.
- **Staleness is a first-class failure mode.** A score older than 2× its update interval gets a confidence haircut, not silent trust.
- **Decay is the default.** Domain-adaptive half-lives ensure reputation erodes without continuous performance.
- **Multi-oracle consensus before high-trust decisions.** Single-oracle scores are useful signal; they are not sufficient for T3 promotion.
- **Baseline-relative karma.** Mediocre producers cannot grind upward by participating — only by outperforming a naive benchmark.
- **Linking context from oracles is advisory only.** Never authoritative for linking/control-graph decisions.

---

## 0.3 Oracle Incentives & Governance

### Bond & Stake Requirements

Each oracle must stake a minimum PFT bond at registration. This bond serves as collateral against misbehavior and aligns oracle incentives with accurate evidence reporting.

**Oracle diversity constraint:** No single entity may control >33% of total oracle stake. Violations trigger automatic weight reduction until rebalanced.

### Uptime SLA

99% rolling 30-day uptime. Oracles are expected to push `ORACLE_SCORE_SNAPSHOT_V1` within their declared cadence. Uptime is measured by heartbeat probes (every 60 seconds).

### Slashing Schedule

| Violation | Slash % | Notes |
|-----------|---------|-------|
| Downtime (95–99%) | 10% of bond | Warning + minor slash |
| Downtime (90–95%) | 25% of bond | Degraded status |
| Downtime (<90%) | 50% of bond | Suspended from consensus pool |
| Confirmed karma inflation | 50% of bond | Fraudulent reporting |
| Repeated manipulation (2+ offenses) | 100% of bond | Permanent ban, full slash |

### Dispute Resolution

1. Operator stakes PFT to open a dispute against an oracle's evidence
2. Independent reviewer panel evaluates
3. **Successful dispute:** karma delta reversed, oracle slashed (50% bond), dispute stake returned
4. **Failed dispute:** operator's dispute stake slashed, oracle's evidence stands

### Oracle Accreditation Lifecycle

```
unverified → provisional → verified → degraded → suspended
```

| State | Requirements | Weight Modifier |
|-------|-------------|----------------|
| `unverified` | Registered, bond posted | 0.0× (cannot participate in consensus) |
| `provisional` | 30-day observation, ≥95% uptime | 0.5× |
| `verified` | 90-day track record, ≥99% uptime, calibration score ≥0.7 | 1.0× |
| `degraded` | Uptime drop or calibration drift | 0.5× |
| `suspended` | Slashing event or <90% uptime | 0.0× |

**Reinstatement from degraded/suspended:** Top up bond to minimum, complete 30-day probation at `provisional` weight.

### Reward Distribution

Oracles maintaining ≥99% uptime whose evidence estimates fall within 0.05 of eventual consensus receive a pro-rata share of the oracle reward pool (funded by a small fee on each `ATTRIBUTION_OUTCOME_V1` ingest).

---

## 1. Interface Contract

All messages use JSON over HTTPS. Wire format is SPI v1.0-compatible: UTF-8 encoded, `Content-Type: application/json`. Timestamps are ISO 8601 UTC. All `score` fields are float64, range [0.0, 1.0].

### 1.0 Schema Conventions (SPI-Aligned)

All messages MUST include:

| Field | Type | Description |
|-------|------|-------------|
| `schema` | string | Message type identifier |
| `schema_version` | string | Always `"spi.oracle.v1"` |
| `event_type` | string | One of the four message types |
| `event_id` | string | UUID v4 prefixed per type |
| `occurred_at` | ISO 8601 | When the event occurred |
| `idempotency_key` | string | Deduplication key |
| `nonce` | int | Monotonically increasing per oracle |
| `timestamp` | ISO 8601 | Message creation time |
| `signature` | string | secp256k1 signature over canonical payload |

**Cryptographic verification:**
- Oracle uses a dedicated signing key registered in the Oracle Registry
- Signature algorithm: secp256k1 (consistent with SPI wallet binding)
- `nonce` must be monotonically increasing per `oracle_id`; reject if not
- `timestamp` must be within 60 seconds of receipt; reject if stale
- Key rotation: oracle publishes new key to registry with 7-day overlap window; old key valid during overlap

**Dedupe key format:** `"{oracle_id}:attribution.outcome:{trade_id}"`

### 1.1 Message Types

Four message types define the async communication pattern. **Routing never blocks on a synchronous oracle query.**

| # | Message Type | Direction | Purpose |
|---|-------------|-----------|---------|
| 1 | `ORACLE_SCORE_SNAPSHOT_V1` | Oracle → Hive Mind | Periodic push of evidence to local ledger (primary path) |
| 2 | `ATTRIBUTION_OUTCOME_V1` | Oracle → Hive Mind | Canonical SPI-aligned signed outcome event |
| 3 | `REPUTATION_REFRESH_REQUEST_V1` | Hive Mind → Oracle | Optional best-effort refresh request |
| 4 | `REPUTATION_REFRESH_RESPONSE_V1` | Oracle → Hive Mind | Advisory evidence response (NOT authoritative) |

### 1.2 `ORACLE_SCORE_SNAPSHOT_V1`

Oracle → Hive Mind ledger. **Primary path.** Periodic push of evidence vectors. The oracle does NOT compute or return trust tiers, routing weights, or operator classification.

```json
{
  "schema": "ORACLE_SCORE_SNAPSHOT_V1",
  "schema_version": "spi.oracle.v1",
  "event_type": "ORACLE_SCORE_SNAPSHOT_V1",
  "event_id": "snap_a1b2c3d4e5f6",
  "occurred_at": "2026-03-17T21:55:00Z",
  "idempotency_key": "oracle_v1:snap:rNw1eABC:onchain:2026-03-17T21:55",
  "nonce": 48201,
  "timestamp": "2026-03-17T21:55:01Z",
  "oracle_id": "b1e55ed_oracle_v1",
  "oracle_stake_pft": 200,
  "operator_id": "rNw1e...XRPL_ADDRESS",
  "domain": "onchain",
  "raw_karma": 0.73,
  "sample_size": 142,
  "effective_sample_size": 128,
  "calibration_score": 0.89,
  "freshness_seconds": 301,
  "confidence_interval": {
    "lower": 0.68,
    "upper": 0.78
  },
  "source_overlap_score": 0.15,
  "oracle_quality_score": 0.94,
  "evidence_root": "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
  "external_affinity_signal": {
    "affinity_flag": false,
    "affinity_score": 0.8,
    "suspected_cluster_id": null
  },
  "signature": "0xSECP256K1_SIG_OVER_CANONICAL_PAYLOAD"
}
```

**Oracle evidence fields (what the oracle returns):**

| Field | Type | Notes |
|-------|------|-------|
| `raw_karma` | float | [0.0, 1.0]. Raw evidence score — NOT a tier or routing weight |
| `sample_size` | int | Total scored signals, all time |
| `effective_sample_size` | int | Adjusted for correlation/overlap between data sources |
| `calibration_score` | float | [0.0, 1.0]. How well-calibrated the oracle's predictions are |
| `freshness_seconds` | int | Age of the evidence computation |
| `confidence_interval` | object | `{lower, upper}` — 95% CI around raw_karma |
| `source_overlap_score` | float | [0.0, 1.0]. 1.0 = fully independent source, 0.0 = complete overlap |
| `oracle_quality_score` | float | [0.0, 1.0]. Composite of uptime + historical accuracy |
| `evidence_root` | string | Hash of underlying evidence for audit trail |
| `external_affinity_signal` | object | **Advisory only.** Never authoritative for linking/control-graph decisions |

**What Hive Mind computes from this evidence (never returned by oracle):**
- `trust_tier` (T0–T3)
- `routing_weight`
- `oracle_adjusted_reputation`
- Linking/control-graph decisions

### 1.3 `ATTRIBUTION_OUTCOME_V1`

Oracle → Hive Mind scoring layer. Canonical SPI-aligned signed outcome event. Pushes a closed-position attribution into the pipeline.

```json
{
  "schema": "ATTRIBUTION_OUTCOME_V1",
  "schema_version": "spi.oracle.v1",
  "event_type": "ATTRIBUTION_OUTCOME_V1",
  "event_id": "attr_x9y8z7w6",
  "occurred_at": "2026-03-17T22:05:00Z",
  "idempotency_key": "b1e55ed_oracle_v1:attribution.outcome:trade_8847",
  "nonce": 48202,
  "timestamp": "2026-03-17T22:05:01Z",
  "trade_id": "trade_8847",
  "operator_id": "rNw1e...XRPL_ADDRESS",
  "producer_id": "b1e55ed_prod_01",
  "domain": "onchain",
  "conviction_id": "conv_4422",
  "realized_brier": 0.12,
  "baseline_brier": 0.33,
  "pnl_attributed_usd": 847.32,
  "pnl_volatility": 0.045,
  "signal_weight": 1.0,
  "recency_weight": 0.92,
  "horizon_hours": 72,
  "scoring_method": "brier",
  "oracle_id": "b1e55ed_oracle_v1",
  "signature": "0xSECP256K1_SIG"
}
```

| Field | Type | Notes |
|-------|------|-------|
| `realized_brier` | float | Actual Brier score for this signal. For binary directional signals |
| `baseline_brier` | float | Naive benchmark Brier score for this domain/horizon |
| `pnl_volatility` | float | Realized daily volatility of the underlying over signal horizon |
| `scoring_method` | enum | `"brier"` for binary directional signals, `"crps"` for continuous/sized predictions |
| `signal_weight` | float | [0.0, 1.0]. Below 0.3 confidence → `signal_weight = 0` |
| `recency_weight` | float | Decay weight at time of outcome |

**Idempotency:** The pipeline MUST deduplicate on `idempotency_key` using SPI's two-layer strategy: `NOT EXISTS` pre-check followed by `INSERT OR IGNORE` on primary key. Duplicates return `200 OK` with `{"status": "already_processed"}`.

**Karma delta computation (baseline-relative, signed):**

```
karma_delta = recency_weight * signal_weight * (baseline_brier - realized_brier)
```

- Better than baseline → **positive** delta (operator outperformed naive benchmark)
- Worse than baseline → **negative** delta (operator underperformed)
- Equal to baseline → **zero** (no informational value demonstrated)

Mediocre producers can no longer grind upward by participating. You must beat the benchmark.

**Scoring method selection:**
- **Brier scoring** (`scoring_method: "brier"`): For binary directional signals (e.g., "BTC goes up in 72h")
- **CRPS** (`scoring_method: "crps"`): For continuous or sized predictions (e.g., "BTC reaches $95k ± $2k")

### 1.4 `REPUTATION_REFRESH_REQUEST_V1`

Hive Mind → Oracle. **Optional, best-effort only.** Requests a fresh evidence snapshot. The oracle MAY ignore this or respond with delay. Routing MUST NOT block on this.

```json
{
  "schema": "REPUTATION_REFRESH_REQUEST_V1",
  "schema_version": "spi.oracle.v1",
  "event_type": "REPUTATION_REFRESH_REQUEST_V1",
  "event_id": "rfr_q1w2e3r4",
  "occurred_at": "2026-03-17T22:00:00Z",
  "idempotency_key": "hivemind:refresh:rNw1eABC:onchain:2026-03-17T22",
  "nonce": 1001,
  "timestamp": "2026-03-17T22:00:00Z",
  "operator_id": "rNw1e...XRPL_ADDRESS",
  "domain": "onchain",
  "reason": "stale_evidence",
  "last_snapshot_age_seconds": 7200,
  "signature": "0xHIVEMIND_SIG"
}
```

### 1.5 `REPUTATION_REFRESH_RESPONSE_V1`

Oracle → Hive Mind. Response to a refresh request. **Advisory evidence only — NOT authoritative for tier or routing decisions.** Identical schema to `ORACLE_SCORE_SNAPSHOT_V1` but with `event_type: "REPUTATION_REFRESH_RESPONSE_V1"` and a `refresh_request_id` linking back.

```json
{
  "schema": "REPUTATION_REFRESH_RESPONSE_V1",
  "schema_version": "spi.oracle.v1",
  "event_type": "REPUTATION_REFRESH_RESPONSE_V1",
  "event_id": "rfs_t5y6u7i8",
  "refresh_request_id": "rfr_q1w2e3r4",
  "occurred_at": "2026-03-17T22:00:02Z",
  "idempotency_key": "b1e55ed_oracle_v1:refresh:rNw1eABC:onchain:rfr_q1w2e3r4",
  "nonce": 48203,
  "timestamp": "2026-03-17T22:00:02Z",
  "oracle_id": "b1e55ed_oracle_v1",
  "operator_id": "rNw1e...XRPL_ADDRESS",
  "domain": "onchain",
  "raw_karma": 0.74,
  "sample_size": 143,
  "effective_sample_size": 129,
  "calibration_score": 0.89,
  "freshness_seconds": 2,
  "confidence_interval": { "lower": 0.69, "upper": 0.79 },
  "source_overlap_score": 0.15,
  "oracle_quality_score": 0.94,
  "evidence_root": "0x9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba",
  "external_affinity_signal": {
    "affinity_flag": false,
    "affinity_score": 0.8,
    "suspected_cluster_id": null
  },
  "signature": "0xSECP256K1_SIG"
}
```

---

## 2. Reputation Propagation Mechanics

### 2.1 Domain-Adaptive Exponential Decay

Karma scores decay exponentially with **domain-specific half-lives**. Markets are non-stationary; an operator accurate in a bull market may be wrong in a regime change.

| Domain | Half-Life (H) | Rationale |
|--------|---------------|-----------|
| `social/narrative` | 7 days | Very short narrative half-life; CT meta rotates weekly |
| `onchain` | 14 days | Whale patterns shift quickly |
| `technical` | 21 days | Market structure has moderate persistence |
| `default` | 30 days | Fallback for unmapped domains |
| `tradfi/macro` | 60 days | Regime changes are infrequent |

**Formula:**

$$\text{karma\_effective}(t) = \text{karma\_raw} \times e^{-\frac{\ln 2 \times \text{age\_days}}{H}}$$

**Examples:**
- `onchain` operator, karma_raw = 0.80, 14 days since last signal: `0.80 × exp(-ln(2) × 14/14) = 0.40` → T1 threshold
- Same operator in `tradfi` with H=60: `0.80 × exp(-ln(2) × 14/60) = 0.80 × 0.85 = 0.68` → still T2

**Decay is computed at read time** from the local ledger, not stored. The ledger stores raw karma and timestamps; the routing engine applies decay at query time.

### 2.2 Domain Separation

Karma is **domain-scoped**. An operator with 0.85 karma in `onchain` and 0.35 in `macro` gets routed differently per task domain. No cross-domain karma blending.

Domain mapping to task types is maintained in the routing engine's configuration, not in the oracle.

### 2.3 CI-Weighted Multi-Oracle Aggregation (Pyth-Style)

When multiple oracle snapshots exist in the ledger for the same operator-domain pair:

**Step 1: Filter.** Discard oracles with `oracle_quality_score < 0.7`.

**Step 2: Compute weights.** Each oracle's weight is proportional to stake × quality, inversely proportional to CI width squared:

$$w_i = \frac{\text{oracle\_stake}_i \times \text{oracle\_quality\_score}_i}{\text{CI\_width}_i^2 + 0.01}$$

The `+ 0.01` floor prevents division-by-zero.

**Step 3: Aggregate.** Weighted median (not mean — resists outlier manipulation):

$$\text{consensus\_karma} = \text{weighted\_median}(\{\text{karma}_i\}, \{w_i\})$$

**Step 4: Confidence checks.**
- Below 3 valid oracles → **50% confidence haircut** applied to consensus
- IQR of oracle scores > 0.20 → `high_divergence` flag + manual review queue

```python
eligible = [o for o in oracles if o.oracle_quality_score >= 0.7]

for o in eligible:
    ci_width = o.confidence_interval.upper - o.confidence_interval.lower
    o.weight = (o.oracle_stake_pft * o.oracle_quality_score) / (ci_width ** 2 + 0.01)

consensus_karma = weighted_median(
    scores=[o.raw_karma for o in eligible],
    weights=[o.weight for o in eligible]
)

if len(eligible) < 3:
    consensus_karma *= 0.5  # confidence haircut

if iqr([o.raw_karma for o in eligible]) > 0.20:
    flag = "high_divergence"  # manual review + conservative routing
```

**Why CI-weighted?** An oracle reporting karma 0.75 with CI [0.73, 0.77] (width 0.04) has ~625× more weight per unit stake than one reporting [0.50, 1.00] (width 0.50). This rewards precision, not just capital.

### 2.4 Risk-Adjusted Attribution

Pure Brier + PnL scoring rewards high-volatility lucky bets disproportionately. A correct call on a 50% daily-vol shitcoin shouldn't score the same as a correct call on a 2% daily-vol blue chip.

**Risk adjustment:**

$$\text{karma\_delta\_risk\_adj} = \frac{\text{karma\_delta}}{1 + \frac{\text{pnl\_volatility}}{\text{benchmark\_volatility}}}$$

Where:
- `pnl_volatility` = realized daily volatility of the underlying over the signal horizon
- `benchmark_volatility` = median daily volatility across all scored signals in that domain (rolling 90-day window)

**Blended final karma:**

$$\text{final\_karma} = 0.7 \times \text{karma\_score} + 0.3 \times \text{risk\_adj\_score}$$

Where `risk_adj_score` is the cumulative risk-adjusted karma from all `karma_delta_risk_adj` values. The 70/30 blend ensures raw accuracy dominates while penalizing volatility inflation.

If `pnl_volatility` is unavailable (no price feed), risk adjustment defaults to 1.0 and `final_karma = karma_score`.

### 2.5 Sample Size Handling

Operators with fewer than 20 scored signals in a domain receive a **0.5× weight multiplier** in routing:

```
if effective_sample_size < 20:
    routing_karma = consensus_karma * 0.5
```

This prevents lucky streaks from gaming the system. The floor is deliberately low (20, not 50) because domain-adaptive decay already penalizes thin signal streams.

---

## 3. Trust Tiering

Hive Mind computes trust tiers from oracle evidence. **Oracles never return or influence tier assignments.**

| Tier | Karma Range | Routing Multiplier | Min Effective Samples | Promotion Window |
|------|-------------|--------------------|-----------------------|-----------------|
| **T0** (Unverified) | 0.00–0.39 | 1.0× | 0 | — |
| **T1** (Probationary) | 0.40–0.59 | 1.2× | 20 | 30 days sustained |
| **T2** (Active) | 0.60–0.79 | 1.5× | 50 | 30 days sustained |
| **T3** (Verified) | 0.80–1.00 | 2.0× | 100 + multi-oracle consensus | 30 days sustained |

### Promotion Rules

- **30-day promotion window:** Karma must remain at or above tier threshold for 30 consecutive days.
- **Minimum signal count is cumulative:** Domain-specific, all-time, using `effective_sample_size`.
- **T3 requires multi-oracle consensus:** Cannot be granted by a single oracle.

### Conditional T1 Floor (Replaces Permanent Floor)

The v1.0 permanent T1 floor after 50 signals is removed. Permanent participation entitlements create incumbency aristocracy. Replaced with:

```
if effective_sample_size >= 50 AND historical_peak_karma >= 0.60:
    min_tier = T1
else:
    min_tier = T0
```

An operator must have **both** demonstrated volume (50+ effective samples) **and** demonstrated quality (peak karma ≥0.60) to earn a floor. Operators who participated heavily but never performed well get no protection.

### Demotion Rules

- **Immediate on threshold breach.** No grace period. Asymmetric by design: slow to promote, fast to demote.
- **Suspension overrides all tiers.** `producer_lifecycle_state = suspended` → treated as T0 regardless of karma.

### Routing Objective Function

Per-task routing priority is computed as:

$$\text{routing\_priority} = a \cdot \text{internal\_score} + b \cdot \text{oracle\_reputation\_floor} + c \cdot \text{CGI} - \text{concentration\_penalty} - \text{integrity\_penalty}$$

Where `oracle_reputation_floor` = lower confidence bound of the operator's skill estimate.

**Weights by task class:**

| Task Class | a (internal) | b (oracle floor) | c (CGI) |
|---|---|---|---|
| high-value | 0.3 | 0.4 | 0.3 |
| exploratory | 0.5 | 0.2 | 0.3 |
| underserved domain | 0.2 | 0.2 | 0.6 |

### Interaction with v4.1 Controls

**CGI stacking:** `effective_weight = tier_multiplier + cgi_adjustment`. T2 (1.5×) + underserved domain (+0.3) = 1.8.

**Concentration cap override:** T3 operator at 15% epoch budget cap → `effective_weight = 0` for tasks exceeding cap. Tier does not exempt from concentration limits.

**Linking layer:** `linking_score ≥ 3.5` → independent reviewer routing per v4.1. Oracle karma does not prevent this. `external_affinity_signal` from oracles is **advisory only** — never authoritative for linking/control-graph decisions.

---

## 4. Circuit Breakers

| Trigger | Action |
|---------|--------|
| Operator drops >1 tier per epoch | Block demotion beyond 1 tier; flag for review. **Exception:** integrity failure → immediate drop to T0 |
| Karma drop >0.20 in single attribution | Review flag; attribution held pending review |
| Flash movement >3σ from operator's historical norm | Automatic pause on routing weight changes; manual review required |
| Oracle consensus IQR >0.20 | `high_divergence` flag; conservative routing at 50% haircut |

---

## 5. End-to-End Scenarios

### Scenario A: T3 Operator Gets Priority Routing

**Context:** Operator `rNw1eABC` has 180 effective samples in `onchain`, consensus karma 0.84, T3. A new onchain task enters the pipeline.

**Step 1: Oracle pushes periodic snapshot to Hive Mind ledger**

```json
{
  "schema": "ORACLE_SCORE_SNAPSHOT_V1",
  "schema_version": "spi.oracle.v1",
  "event_type": "ORACLE_SCORE_SNAPSHOT_V1",
  "event_id": "snap_f7a8b9c0d1e2",
  "occurred_at": "2026-03-17T21:55:00Z",
  "idempotency_key": "b1e55ed_oracle_v1:snap:rNw1eABC:onchain:2026-03-17T21:55",
  "nonce": 48201,
  "timestamp": "2026-03-17T21:55:01Z",
  "oracle_id": "b1e55ed_oracle_v1",
  "oracle_stake_pft": 200,
  "operator_id": "rNw1eABC",
  "domain": "onchain",
  "raw_karma": 0.85,
  "sample_size": 190,
  "effective_sample_size": 180,
  "calibration_score": 0.91,
  "freshness_seconds": 60,
  "confidence_interval": { "lower": 0.81, "upper": 0.89 },
  "source_overlap_score": 0.12,
  "oracle_quality_score": 0.96,
  "evidence_root": "0xaaa111bbb222ccc333ddd444eee555fff666000111222333444555666777888999",
  "external_affinity_signal": { "affinity_flag": false, "affinity_score": 0.2, "suspected_cluster_id": null },
  "signature": "0xSIG_ORACLE_1"
}
```

Two additional oracles push similar snapshots (raw_karma: 0.83, 0.86). Hive Mind ledger now has 3 snapshots.

**Step 2: Routing engine reads local ledger and computes**

```python
# Three oracle snapshots in ledger, all oracle_quality_score > 0.7
# CI-weighted aggregation:
# Oracle 1: raw_karma=0.85, CI_width=0.08, stake=200, quality=0.96 → w=200*0.96/(0.08²+0.01)=27,429
# Oracle 2: raw_karma=0.83, CI_width=0.10, stake=150, quality=0.92 → w=150*0.92/(0.10²+0.01)=12,545
# Oracle 3: raw_karma=0.86, CI_width=0.12, stake=180, quality=0.88 → w=180*0.88/(0.12²+0.01)=6,171

consensus_karma = weighted_median([0.85, 0.83, 0.86], [27429, 12545, 6171])  # → 0.85
# IQR = 0.03 < 0.20 → no divergence flag
# 3 oracles → no confidence haircut

# Hive Mind computes:
trust_tier = "T3"  # 0.85 > 0.80, effective_sample_size=180 > 100, sustained 30+ days
tier_multiplier = 2.0
cgi_adjustment = +0.3  # onchain underserved this epoch
oracle_reputation_floor = 0.81  # lower CI bound
routing_priority = 0.3*internal + 0.4*0.81 + 0.3*cgi - 0 - 0  # high-value task weights
effective_weight = 2.0 + 0.3  # = 2.3
# concentration_cap check: operator at 6% < 15% → pass
```

**Step 3: Task routed with priority weight 2.3**

**Step 4: Position closes. Oracle pushes outcome.**

```json
{
  "schema": "ATTRIBUTION_OUTCOME_V1",
  "schema_version": "spi.oracle.v1",
  "event_type": "ATTRIBUTION_OUTCOME_V1",
  "event_id": "attr_d4e5f6g7h8i9",
  "occurred_at": "2026-03-20T14:00:00Z",
  "idempotency_key": "b1e55ed_oracle_v1:attribution.outcome:trade_8847",
  "nonce": 48250,
  "timestamp": "2026-03-20T14:00:01Z",
  "trade_id": "trade_8847",
  "operator_id": "rNw1eABC",
  "producer_id": "b1e55ed_prod_01",
  "domain": "onchain",
  "conviction_id": "conv_4422",
  "realized_brier": 0.12,
  "baseline_brier": 0.33,
  "pnl_attributed_usd": 847.32,
  "pnl_volatility": 0.045,
  "signal_weight": 1.0,
  "recency_weight": 0.92,
  "horizon_hours": 72,
  "scoring_method": "brier",
  "oracle_id": "b1e55ed_oracle_v1",
  "signature": "0xSIG_ATTR_1"
}
```

Pipeline computes: `karma_delta = 0.92 * 1.0 * (0.33 - 0.12) = 0.193` (positive — outperformed baseline). Ledger updated.

### Scenario B: Oracle Offline → Staleness → Haircut → Recovery

**Context:** Oracle `b1e55ed_oracle_v1` has been unreachable for 2 hours. Operator `rNw1eXYZ` last snapshot: raw_karma 0.82, T3.

**Step 1: Hive Mind detects staleness in local ledger**

Last snapshot `freshness_seconds` was 60 at ingest time 2 hours ago. Current effective staleness: ~7,200 seconds. Configured `max_staleness_seconds = 3600`.

**Step 2: Staleness haircut applied to ledger reads**

```python
staleness_ratio = 7200 / 3600  # = 2.0
haircut = min(staleness_ratio * 0.25, 0.75)  # = 0.50
adjusted_karma = 0.82 * (1 - 0.50)  # = 0.41
# Tier drops from T3 → T1 (0.40–0.59 range)
# effective_weight = 1.2 + cgi_adjustment
```

Operator still gets routed at T1, not blocked. **Routing never blocks on oracle availability.**

**Step 3: Hive Mind sends optional refresh request**

```json
{
  "schema": "REPUTATION_REFRESH_REQUEST_V1",
  "schema_version": "spi.oracle.v1",
  "event_type": "REPUTATION_REFRESH_REQUEST_V1",
  "event_id": "rfr_abc123",
  "occurred_at": "2026-03-17T00:05:00Z",
  "idempotency_key": "hivemind:refresh:rNw1eXYZ:tradfi:2026-03-17T00",
  "nonce": 1042,
  "timestamp": "2026-03-17T00:05:00Z",
  "operator_id": "rNw1eXYZ",
  "domain": "tradfi",
  "reason": "stale_evidence",
  "last_snapshot_age_seconds": 7200,
  "signature": "0xHIVEMIND_SIG"
}
```

No response (oracle still offline). Routing continues from local ledger with haircut.

**Step 4: Oracle recovers, pushes fresh snapshot**

Fresh `ORACLE_SCORE_SNAPSHOT_V1` arrives with `raw_karma: 0.82`, `freshness_seconds: 5`. Ledger updated. Next routing read: karma 0.82, staleness cleared. If operator was T3 before staleness demotion, immediate restoration (no 30-day window for staleness recovery — only for organic promotion).

### Scenario C: Conflicting Oracles → Divergence → Resolution

**Context:** Two oracles report conflicting karma for operator `rNw1eDEF` in `technical` domain.

**Step 1: Oracle snapshots in ledger**

- Oracle A: `raw_karma: 0.72`, CI [0.65, 0.79], stake=200, quality=0.95
- Oracle B: `raw_karma: 0.41`, CI [0.35, 0.47], stake=180, quality=0.91

**Step 2: Hive Mind aggregation detects divergence**

```python
eligible = [oracle_a, oracle_b]  # both quality > 0.7
# IQR of [0.72, 0.41] → range = 0.31 > 0.20 → high_divergence flag!

# Only 2 oracles → also below minimum 3 → 50% confidence haircut
consensus_karma = weighted_median([0.72, 0.41], [w_a, w_b])
consensus_karma *= 0.5  # confidence haircut

# Flag: high_divergence + manual_review
# Conservative routing: operator gets haircut weight
```

**Step 3: Third oracle resolves**

Oracle C pushes snapshot: `raw_karma: 0.69`, CI [0.63, 0.75], stake=160, quality=0.93.

```python
eligible = [oracle_a, oracle_b, oracle_c]  # 3 oracles, minimum met
scores = [0.72, 0.41, 0.69]
# IQR = 0.72 - 0.41 = 0.31... still > 0.20
# BUT weighted median heavily favors A and C (tighter CIs)
# w_a = 200*0.95/(0.14²+0.01) = 7,308
# w_b = 180*0.91/(0.12²+0.01) = 6,353
# w_c = 160*0.93/(0.12²+0.01) = 5,770

consensus_karma = weighted_median([0.72, 0.41, 0.69], [7308, 6353, 5770])  # → 0.69
# No confidence haircut (3 oracles)
# high_divergence flag remains → manual review still recommended
# But routing proceeds at karma 0.69 → T2
```

Oracle B's outlier score (0.41) is investigated. If oracle B's evidence is confirmed inaccurate, dispute resolution applies (Section 0.3).

---

## 6. Failure Matrix

| Failure Mode | Detection | Impact | Mitigation | Recovery |
|---|---|---|---|---|
| **Stale-but-signed** | `freshness_seconds` exceeds threshold at ledger read | Graduated confidence haircut (25% per staleness ratio, capped 75%) | Local ledger never blocks; haircut degrades gracefully | Fresh snapshot clears staleness |
| **Fresh-but-low-confidence** | CI width > 0.30 or `effective_sample_size < 20` | Low weight in aggregation; 0.5× routing multiplier | CI-weighted aggregation naturally down-weights uncertain evidence | More signals narrow CI over time |
| **Conflicting oracles** | IQR > 0.20 across oracle snapshots | `high_divergence` flag; conservative routing at 50% haircut | Weighted median resists outliers; manual review queue | Third+ oracle resolves or dispute process |
| **Orphan attribution** | `ATTRIBUTION_OUTCOME_V1` references unknown `operator_id` or `trade_id` | Rejected at ingest; logged for investigation | Schema validation + referential integrity check | Oracle corrects and resubmits |
| **Replay attack** | Duplicate `nonce` or `nonce` not monotonically increasing per oracle | Message rejected | Monotonic nonce enforcement + 60-second timestamp window | Legitimate: oracle increments nonce and resends |
| **Common-mode oracle failure** | All oracles go offline simultaneously | All ledger entries become stale; haircuts applied across the board | Routing falls back to internal scoring (CGI-only) at T0/T1 | First oracle recovery restores partial consensus |
| **Oracle collusion (stake attack)** | Multiple oracles coordinate inflated karma | Difficult to detect in real-time; divergence detection catches crude attempts | **Attack cost:** must control >50% of oracle stake to shift weighted median. 33% cap per entity means minimum 2 colluding entities. Slashing: 50% bond per confirmed inflation | Dispute resolution; slashing; oracle suspension |
| **Partial oracle outage** | 1 of N oracles offline | Reduced consensus quality; if below 3 → 50% confidence haircut | Multi-oracle design provides redundancy | Offline oracle recovers; snapshot resumes |
| **Nonce desync** | Oracle nonce jumps or resets | Messages rejected until nonce sequence restored | Nonce validation per oracle_id | Oracle resets nonce from last accepted value |
| **Key compromise** | Oracle signing key leaked | Attacker can forge snapshots | Key rotation with 7-day overlap; anomaly detection on sudden karma shifts | Emergency key rotation; invalidate old key; re-sign recent snapshots |

---

## 7. Oracle Versioning

- Pipeline supports schema versions **N** and **N-1** simultaneously for **90 days** after a new version release
- Oracle must support **downgrade negotiation**: if Hive Mind requests version N-1, oracle responds in that format
- **30-day minimum deprecation notice** before dropping support for version N-1
- Version is declared in `schema_version` field of every message
- Unknown schema versions are rejected with `400 Bad Request` and logged

---

## 8. Implementation Roadmap

### Phase 1: Async Ledger (Weeks 1–4)
- Implement `ORACLE_SCORE_SNAPSHOT_V1` ingest to local Hive Mind ledger
- Oracle pushes snapshots on declared cadence
- Ledger stores evidence; routing reads locally
- **Shadow mode:** evidence logged but not used in routing
- Success criteria: 99.5% ingest success rate, ledger read <10ms p95

### Phase 2: Attribution Pipeline (Weeks 5–8)
- Implement `ATTRIBUTION_OUTCOME_V1` ingest
- Baseline-relative karma delta computation
- Risk-adjusted attribution
- Domain-adaptive decay
- Dedupe validation against SPI two-layer strategy
- Success criteria: 100% idempotency, ≥50 paper attributions processed

### Phase 3: Live Routing (Weeks 9–12)
- Enable oracle evidence in live routing decisions (exit shadow mode)
- Trust tiering goes live (T0–T2 only; T3 gated behind Phase 4)
- Implement `REPUTATION_REFRESH_REQUEST/RESPONSE_V1`
- Circuit breakers active
- Success criteria: measurable improvement in task outcome quality

### Phase 4: Multi-Oracle Consensus (Weeks 13–20)
- Onboard 2+ additional oracles
- CI-weighted aggregation live
- Enable T3 tier (requires multi-oracle consensus)
- Divergence detection and manual review pipeline
- Oracle governance (dispute resolution, slashing)
- Success criteria: 3+ oracles active, consensus within 0.10 for >80% of operators

---

## Appendix A: Configuration Defaults

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| `max_staleness_seconds` | 3600 | 1 hour; configurable per domain |
| `staleness_haircut_rate` | 0.25 per staleness_ratio | 50% haircut at 2× staleness |
| `staleness_haircut_cap` | 0.75 | Never fully zero a cached score |
| `min_oracles_for_consensus` | 3 | Below this: 50% confidence haircut |
| `divergence_iqr_threshold` | 0.20 | Above this: manual review flag |
| `low_sample_threshold` | 20 | Below this: 0.5× weight |
| `min_confidence_for_weight` | 0.30 | Below this: signal_weight = 0 |
| `promotion_window_days` | 30 | Sustained performance required |
| `concentration_cap_pct` | 0.15 | Per v4.1: 15% per control graph |
| `oracle_max_stake_pct` | 0.33 | No single entity >33% of oracle stake |
| `nonce_replay_window` | 0 | Strictly monotonic; no replay tolerance |
| `timestamp_max_drift_seconds` | 60 | Reject messages older than 60s |
| `oracle_min_quality_score` | 0.70 | Filter threshold for consensus |

### Domain-Specific Decay Defaults

| Domain | Half-Life (days) |
|--------|-----------------|
| `social` / `narrative` | 7 |
| `onchain` | 14 |
| `technical` | 21 |
| `default` | 30 |
| `tradfi` / `macro` | 60 |

---

## Appendix B: Interaction Matrix with v4.1 Controls

| v4.1 Control | Oracle Interaction | Override Possible? |
|---|---|---|
| Linking layer (`linking_score ≥ 3.5`) | `external_affinity_signal` is advisory only; pipeline enforces routing to independent reviewer | **No.** Oracle cannot override linking layer |
| Concentration cap (15%) | T3 operators still subject to cap | **No.** Tier multiplier zeroed at cap |
| CGI gap-aware routing | CGI adjustment stacks additively with tier multiplier | Additive only |
| Control graph grouping (`linking_score ≥ 4.5`) | Immediate grouping per v4.1 | **No.** Karma is irrelevant to grouping |
| Registration stake | Oracle stake is separate from operator registration stake | Independent |

---

## Appendix C: KaTeX Formulas

### Karma Delta (Baseline-Relative)

$$\Delta\kappa = w_{\text{recency}} \cdot w_{\text{signal}} \cdot (\text{Brier}_{\text{baseline}} - \text{Brier}_{\text{realized}})$$

### Domain-Adaptive Decay

$$\kappa_{\text{eff}}(t) = \kappa_{\text{raw}} \cdot \exp\!\left(-\frac{\ln 2 \cdot t_{\text{age}}}{H_{\text{domain}}}\right)$$

### CI-Weighted Consensus Weight

$$w_i = \frac{S_i \cdot Q_i}{(\text{CI}_{\text{upper},i} - \text{CI}_{\text{lower},i})^2 + 0.01}$$

$$\kappa_{\text{consensus}} = \text{weighted\_median}\!\left(\{\kappa_i\},\, \{w_i\}\right)$$

### Routing Priority

$$P_{\text{route}} = a \cdot I_{\text{internal}} + b \cdot \kappa_{\text{floor}} + c \cdot G_{\text{CGI}} - C_{\text{conc}} - C_{\text{integrity}}$$

### Risk-Adjusted Karma Delta

$$\Delta\kappa_{\text{risk}} = \frac{\Delta\kappa}{1 + \frac{\sigma_{\text{pnl}}}{\sigma_{\text{bench}}}}$$

### Blended Final Karma

$$\kappa_{\text{final}} = 0.7 \cdot \kappa_{\text{score}} + 0.3 \cdot \kappa_{\text{risk\_adj}}$$

### Conditional T1 Floor

$$\text{min\_tier} = \begin{cases} T1 & \text{if } n_{\text{eff}} \geq 50 \;\wedge\; \kappa_{\text{peak}} \geq 0.60 \\ T0 & \text{otherwise} \end{cases}$$

---

*"The oracle supplies evidence. The Hive Mind decides. The linking layer protects."*

**End of spec — v1.1**
