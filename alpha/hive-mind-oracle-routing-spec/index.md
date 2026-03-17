---
layout: default
title: "Hive Mind Task Routing Integration for External Oracles — v1.0"
date: 2026-03-17
category: spec
status: published
---
# Hive Mind Task Routing Integration for External Oracles — v1.0

**Status:** DRAFT  
**Authors:** b1e55ed spec team  
**Date:** 2026-03-17  
**Extends:** Authorization Gate v4.1 — Sybil-Resistant Control Graph Linking Layer  
**Compatible with:** Standard Producer Interface (SPI) v1.0  

---

## 0. Design Stance

This spec extends the Task Node Scoring Pipeline defined in Authorization Gate v4.1. It adds oracle-verified reputation as a new input to routing decisions without replacing or overriding any existing pipeline controls. The linking layer, concentration caps, CGI gap-aware routing, and control graph enforcement remain authoritative. Oracle karma is additive signal — never a bypass mechanism.

**Why oracle reputation should feed task routing:** Without verified external track records, the routing engine scores operators purely on internal task completion metrics — a closed loop vulnerable to Goodharting. Operators optimize for pipeline-legible outputs rather than real-world forecast accuracy. External oracles break this loop by injecting ground-truth attribution: did the operator's signal actually produce a good outcome in markets that don't care about your internal scoring rubric?

**The core tension:** Rewarding verified track records creates reputation moats. An operator with 500 scored signals and T3 karma will dominate routing over a new entrant with zero history, even if the new entrant has genuine edge. Left unchecked, this calcifies into an incumbency cartel. The countermeasure: CGI's +0.3 underserved-domain boost already privileges new contributors in gap domains, and our trust tiering starts T0 operators at 1.0x (not 0x) — they get tasks, just not priority routing. Combined with 30-day karma half-life decay, incumbents who stop performing lose their edge within two half-lives (~60 days to median reversion).

**Design principles:**

- **Oracle is a lens, not a judge.** It provides karma scores; the pipeline decides routing weights.
- **Sybil defense is non-negotiable.** High karma cannot override linking layer caps. A T3 operator in a detected control graph still eats the 15% concentration cap.
- **Staleness is a first-class failure mode.** A score older than 2× its update interval gets a confidence haircut, not silent trust.
- **Decay is the default.** Reputation not actively maintained reverts to T0 floor at ~180 days. No permanent aristocracy.
- **Multi-oracle consensus before high-trust decisions.** Single-oracle scores are useful signal; they are not sufficient for T3 promotion.

---

## 1. Interface Contract

All messages use JSON over HTTPS. Wire format is SPI v1.0-compatible: UTF-8 encoded, `Content-Type: application/json`, authenticated via wallet-signature identity binding as defined in SPI producer registration. Timestamps are ISO 8601 UTC. All `score` fields are float64, range [0.0, 1.0].

### 1.1 `ORACLE_REPUTATION_QUERY`

Hive Mind routing engine → Oracle. Asks: "What is operator X's current karma for domain Y?"

```json
{
  "message_type": "ORACLE_REPUTATION_QUERY",
  "version": "1.0",
  "query_id": "qry_a1b2c3d4e5f6",
  "timestamp": "2026-03-17T22:00:00Z",
  "operator_id": "rNw1e...XRPL_ADDRESS",
  "domain": "tradfi",
  "requesting_pipeline": "task_node_scoring_v4.1",
  "include_linking_context": true,
  "max_staleness_seconds": 3600,
  "timeout_ms": 5000
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `query_id` | string | yes | Idempotency key, UUID v4 prefixed `qry_` |
| `operator_id` | string | yes | XRPL wallet address of the operator |
| `domain` | enum | yes | One of: `tradfi`, `onchain`, `social`, `macro`, `narrative` |
| `include_linking_context` | bool | no | If true, oracle returns any known `linking_flag` and `linking_score` from its records |
| `max_staleness_seconds` | int | no | Reject cached scores older than this. Default 3600 |
| `timeout_ms` | int | no | Client-side timeout. Default 5000 |

### 1.2 `ORACLE_REPUTATION_RESPONSE`

Oracle → Hive Mind routing engine. Response to a reputation query.

```json
{
  "message_type": "ORACLE_REPUTATION_RESPONSE",
  "version": "1.0",
  "query_id": "qry_a1b2c3d4e5f6",
  "timestamp": "2026-03-17T22:00:01Z",
  "operator_id": "rNw1e...XRPL_ADDRESS",
  "domain": "tradfi",
  "karma_score": 0.73,
  "confidence_interval": [0.68, 0.78],
  "sample_size": 142,
  "signal_count_30d": 28,
  "mean_brier_score": 0.21,
  "last_signal_timestamp": "2026-03-16T14:30:00Z",
  "last_outcome_timestamp": "2026-03-15T09:00:00Z",
  "score_computed_at": "2026-03-17T21:55:00Z",
  "staleness_seconds": 301,
  "producer_lifecycle_state": "active",
  "trust_tier": "T2",
  "low_sample_flag": false,
  "linking_context": {
    "linking_flag": false,
    "linking_score": 0.8,
    "suspected_control_graph_id": null
  },
  "oracle_id": "b1e55ed_oracle_v1",
  "oracle_stake_pft": 200,
  "signature": "HEX_WALLET_SIG_OF_PAYLOAD"
}
```

| Field | Type | Notes |
|-------|------|-------|
| `karma_score` | float | [0.0, 1.0]. Brier-weighted, decay-adjusted |
| `confidence_interval` | [float, float] | 95% CI. Width inversely proportional to sample size |
| `sample_size` | int | Total scored signals, all time |
| `signal_count_30d` | int | Signals within last 30 days (recency indicator) |
| `mean_brier_score` | float | [0.0, 1.0]. Lower is better |
| `staleness_seconds` | int | `now() - score_computed_at` |
| `producer_lifecycle_state` | enum | `onboarding`, `probationary`, `active`, `suspended` |
| `trust_tier` | enum | `T0`, `T1`, `T2`, `T3` (computed by oracle from karma_score) |
| `low_sample_flag` | bool | True if `sample_size < 20` |
| `linking_context` | object | Only present if `include_linking_context` was true in query |
| `signature` | string | Wallet signature over canonical JSON payload (excl. signature field) for tamper detection |

### 1.3 `ATTRIBUTION_OUTCOME_INGEST`

Oracle → Hive Mind scoring layer. Pushes a closed-position attribution into the pipeline. Wire-compatible with SPI's `ATTRIBUTION_OUTCOME_V1`.

```json
{
  "message_type": "ATTRIBUTION_OUTCOME_INGEST",
  "version": "1.0",
  "event_id": "attr_x9y8z7w6",
  "dedupe_key": "attribution.outcome:trade_8847",
  "timestamp": "2026-03-17T22:05:00Z",
  "trade_id": "trade_8847",
  "operator_id": "rNw1e...XRPL_ADDRESS",
  "producer_id": "b1e55ed_prod_01",
  "domain": "onchain",
  "conviction_id": "conv_4422",
  "karma_delta": 0.03,
  "brier_score": 0.12,
  "pnl_attributed_usd": 847.32,
  "signal_weight": 1.0,
  "recency_weight": 0.92,
  "horizon_hours": 72,
  "oracle_id": "b1e55ed_oracle_v1",
  "signature": "HEX_WALLET_SIG"
}
```

**Idempotency:** The pipeline MUST deduplicate on `dedupe_key` using the two-layer strategy from SPI: `NOT EXISTS` pre-check followed by `INSERT OR IGNORE` on primary key. Duplicate ingests return `200 OK` with `{"status": "already_processed"}`.

**Karma delta computation:**

```
karma_delta = (1 - brier_score / 2) * signal_weight * recency_weight
```

Where `recency_weight = exp(-ln(2) * age_days / H)` with half-life `H = 30 days`.

### 1.4 `ROUTING_WEIGHT_UPDATE`

Hive Mind → subscribed oracles. Notifies when an operator's routing priority changes (so oracles can adjust their own internal models or dashboards).

```json
{
  "message_type": "ROUTING_WEIGHT_UPDATE",
  "version": "1.0",
  "event_id": "rwu_m3n4o5p6",
  "timestamp": "2026-03-17T22:10:00Z",
  "operator_id": "rNw1e...XRPL_ADDRESS",
  "previous_tier": "T1",
  "new_tier": "T2",
  "task_routing_weight": 1.5,
  "karma_score": 0.65,
  "cgi_adjustment": 0.3,
  "concentration_cap_active": false,
  "control_graph_id": null,
  "effective_weight": 1.8,
  "reason": "karma_promotion",
  "epoch": "2026-03-17"
}
```

| Field | Notes |
|-------|-------|
| `task_routing_weight` | Raw tier multiplier (1.0x / 1.2x / 1.5x / 2.0x) |
| `cgi_adjustment` | CGI boost/drag applied (+0.3 / -0.1 / 0.0) |
| `effective_weight` | `task_routing_weight + cgi_adjustment`, subject to concentration cap |
| `concentration_cap_active` | True if operator's control graph is at the 15% epoch budget ceiling |

---

## 2. Reputation Propagation Mechanics

### 2.1 Exponential Decay

Karma scores decay exponentially with half-life **H = 30 days** (proposed). An operator who stops producing signals sees their karma halve every 30 days:

```
karma_effective(t) = karma_raw * exp(-ln(2) * age_days / 30)
```

At 30 days without new signals: 50% of peak karma.  
At 60 days: 25%.  
At 90 days: 12.5%.  
At 180 days: ~1.6% — effectively T0 floor.

**Rationale:** Markets are non-stationary. An operator who was accurate in a bull market may be systematically wrong in a regime change. 30-day half-life is aggressive — this is deliberate. It forces continuous performance. The alternative (longer half-life) creates reputation rents where operators coast on past performance. We'd rather force re-earning.

**Decay is computed at query time**, not stored. The oracle stores raw karma and `last_outcome_timestamp`; the querying pipeline applies decay. This avoids batch update jobs and ensures freshness.

### 2.2 Domain Separation

Karma is **domain-scoped**. An operator with 0.85 karma in `onchain` and 0.35 karma in `macro` gets routed differently depending on the task domain. There is no cross-domain karma blending.

Supported domains: `tradfi`, `onchain`, `social`, `macro`, `narrative`.

Domain mapping to task types is maintained in the routing engine's configuration, not in the oracle. The oracle scores signals per domain; the pipeline maps tasks to domains.

### 2.3 Multi-Oracle Conflict Resolution

When the pipeline queries multiple oracles for the same operator-domain pair:

1. **Minimum 3 oracle responses** required for consensus. Below 3: apply **50% confidence haircut** to the best available score.
2. **Aggregation method:** Stake-weighted median. Each oracle's response is weighted by its `oracle_stake_pft`. Median (not mean) resists outlier manipulation.
3. **Divergence detection:** If the interquartile range of oracle scores exceeds 0.20, flag as `high_divergence` and route to manual review. This prevents routing decisions on contested reputations.

```
consensus_karma = weighted_median(scores, weights=oracle_stakes)
if num_oracles < 3:
    consensus_karma *= 0.5  # confidence haircut
if iqr(scores) > 0.20:
    flag = "high_divergence"  # manual review
```

**Why stake-weighted median?** Mean is manipulable by a single outlier oracle. Median requires corrupting >50% of stake-weighted reporters. This mirrors Chainlink's aggregation model but adds the stake weighting from Pyth's confidence-weighted design.

### 2.4 Sample Size Floor

Operators with fewer than 20 scored signals in a domain receive the `low_sample_flag = true` marker. The pipeline applies a **0.5x weight multiplier** to their karma score in routing calculations:

```
if sample_size < 20:
    routing_karma = karma_score * 0.5
    low_sample_flag = true
```

This prevents a lucky 5-for-5 streak from catapulting an operator to T3. The floor is deliberately low (20, not 50) because the 30-day decay already penalizes thin signal streams.

---

## 3. Trust Tiering

Four tiers map karma ranges to routing weight multipliers. Tiers interact with — but do not override — the existing CGI and concentration cap systems from v4.1.

| Tier | Karma Range | Routing Multiplier | Minimum Signals | Promotion Window | Demotion |
|------|-------------|-------------------|-----------------|-----------------|----------|
| **T0** (Unverified) | 0.00–0.39 | 1.0x | 0 | — | — |
| **T1** (Probationary) | 0.40–0.59 | 1.2x | 20 | 30 days sustained | Immediate on drop below 0.40 |
| **T2** (Active) | 0.60–0.79 | 1.5x | 50 | 30 days sustained | Immediate on drop below 0.60 |
| **T3** (Verified) | 0.80–1.00 | 2.0x | 100 | 30 days sustained | Immediate on drop below 0.80 |

### Promotion Rules

- **30-day promotion window:** Karma must remain at or above the tier threshold for 30 consecutive days before promotion. This prevents spiky performance from gaming tier upgrades.
- **Minimum signal count is cumulative:** An operator needs 100 total scored signals (all-time, domain-specific) to reach T3. Combined with the 30-day sustained requirement, this means T3 is earned over months, not days.
- **T1 floor after ≥50 signals:** Once an operator has 50+ scored signals, they cannot fall below T1 (1.2x) even if karma decays below 0.40. This rewards participation volume. They can still be suspended via the linking layer.

### Demotion Rules

- **Immediate on threshold breach.** No grace period. If karma drops below tier floor at any query, the operator is demoted. Asymmetric by design: slow to promote, fast to demote.
- **Suspension overrides all tiers.** An operator with `producer_lifecycle_state = suspended` is treated as T0 regardless of karma score.

### Interaction with v4.1 Controls

**CGI stacking:** The final `effective_weight` is `tier_multiplier + cgi_adjustment`. A T2 operator (1.5x) filling an underserved domain (+0.3) gets `effective_weight = 1.8`. A T3 operator (2.0x) in a saturated domain (-0.1) gets `effective_weight = 1.9`.

**Concentration cap override:** A T3 operator (2.0x) whose control graph has hit the 15% epoch budget cap gets their routing weight zeroed for tasks that would exceed the cap. The tier multiplier does not exempt anyone from concentration limits. Formally:

```
if operator.control_graph.epoch_budget_used >= 0.15:
    effective_weight = 0  # cap enforced, regardless of tier
```

**Linking layer interaction:** If `linking_score ≥ 3.5`, the operator is routed to the independent reviewer pool per v4.1 rules. Oracle karma does not prevent this routing. A T3 operator with `linking_score = 4.0` still goes to independent review.

---

## 4. End-to-End Scenarios

### Scenario A: Verified Oracle Operator Gets Priority Routing

**Context:** Operator `rNw1e...ABC` has been producing `onchain` signals via b1e55ed's oracle for 4 months. 142 scored signals, karma 0.73, T2. A new onchain analysis task enters the pipeline.

**Step 1: Pipeline queries oracle**

```json
→ POST /oracle/reputation
{
  "message_type": "ORACLE_REPUTATION_QUERY",
  "version": "1.0",
  "query_id": "qry_f7a8b9c0",
  "timestamp": "2026-03-17T22:00:00Z",
  "operator_id": "rNw1eABC",
  "domain": "onchain",
  "include_linking_context": true,
  "max_staleness_seconds": 3600
}
```

**Step 2: Oracle responds**

```json
← 200 OK
{
  "message_type": "ORACLE_REPUTATION_RESPONSE",
  "version": "1.0",
  "query_id": "qry_f7a8b9c0",
  "timestamp": "2026-03-17T22:00:00Z",
  "operator_id": "rNw1eABC",
  "domain": "onchain",
  "karma_score": 0.73,
  "confidence_interval": [0.68, 0.78],
  "sample_size": 142,
  "signal_count_30d": 28,
  "mean_brier_score": 0.21,
  "staleness_seconds": 180,
  "producer_lifecycle_state": "active",
  "trust_tier": "T2",
  "low_sample_flag": false,
  "linking_context": {
    "linking_flag": false,
    "linking_score": 0.8,
    "suspected_control_graph_id": null
  },
  "oracle_id": "b1e55ed_oracle_v1",
  "oracle_stake_pft": 200,
  "signature": "0xabc123..."
}
```

**Step 3: Pipeline computes routing weight**

```
tier_multiplier = 1.5       # T2
cgi_adjustment  = +0.3      # onchain is underserved this epoch
effective_weight = 1.8
linking_score = 0.8          # below 1.5, no flag
concentration_cap = false    # control graph at 6% of epoch budget
→ Route task with priority weight 1.8
```

**Step 4: Operator completes task. Position closes. Oracle pushes outcome.**

```json
→ POST /pipeline/attribution
{
  "message_type": "ATTRIBUTION_OUTCOME_INGEST",
  "version": "1.0",
  "event_id": "attr_d4e5f6g7",
  "dedupe_key": "attribution.outcome:trade_8847",
  "trade_id": "trade_8847",
  "operator_id": "rNw1eABC",
  "producer_id": "b1e55ed_prod_01",
  "domain": "onchain",
  "conviction_id": "conv_4422",
  "karma_delta": 0.03,
  "brier_score": 0.12,
  "pnl_attributed_usd": 847.32,
  "signal_weight": 1.0,
  "recency_weight": 0.92,
  "horizon_hours": 72,
  "oracle_id": "b1e55ed_oracle_v1",
  "signature": "0xdef456..."
}
```

Pipeline deduplicates on `dedupe_key`, updates operator's karma in the routing ledger, and emits:

```json
← ROUTING_WEIGHT_UPDATE (to subscribed oracles)
{
  "message_type": "ROUTING_WEIGHT_UPDATE",
  "version": "1.0",
  "operator_id": "rNw1eABC",
  "previous_tier": "T2",
  "new_tier": "T2",
  "task_routing_weight": 1.5,
  "karma_score": 0.75,
  "cgi_adjustment": 0.3,
  "effective_weight": 1.8,
  "reason": "attribution_update",
  "epoch": "2026-03-17"
}
```

### Scenario B: Oracle Goes Offline — Staleness and Recovery

**Context:** b1e55ed oracle has been unreachable for 2 hours. Pipeline needs to route a `tradfi` task involving operator `rNw1eXYZ` whose last known karma was 0.82 (T3).

**Step 1: Query times out**

```
→ POST /oracle/reputation  (timeout after 5000ms)
← 504 Gateway Timeout
```

**Step 2: Pipeline falls back to cached score**

Last cached response for `rNw1eXYZ` / `tradfi`:
- `karma_score: 0.82`, `score_computed_at: 2026-03-17T20:00:00Z`
- Current staleness: 7,200 seconds (2 hours)
- `max_staleness_seconds` was 3,600

**Step 3: Staleness haircut applied**

```
staleness_ratio = 7200 / 3600 = 2.0
haircut = min(staleness_ratio * 0.25, 0.75) = 0.50
adjusted_karma = 0.82 * (1 - 0.50) = 0.41
→ Tier drops from T3 to T1 (0.40–0.59 range)
→ effective_weight = 1.2 + cgi_adjustment
```

The operator still gets routed — but at T1 priority, not T3. The pipeline does not block tasks on oracle unavailability.

**Step 4: Oracle recovers**

When the oracle comes back online, the pipeline's next query returns a fresh score. If karma is still 0.82, the operator is immediately restored to T3 (no 30-day window for *restoration* after staleness-induced demotion — only for organic promotion). The `ROUTING_WEIGHT_UPDATE` fires with `reason: "staleness_recovery"`.

---

## 5. Failure Modes

### 5.1 Inflated Karma (Sybil/Gaming)

**Attack:** An oracle colludes with an operator to report inflated karma scores.

**Defense:** Multi-oracle consensus (Section 2.3). A single oracle cannot unilaterally grant T3 status when 3+ oracles are active. Stake-weighted median means the colluding oracle needs >50% of total oracle stake to shift the median. Additionally, `ATTRIBUTION_OUTCOME_INGEST` events are verified against on-chain position data where available — the pipeline cross-references PnL claims against actual trade records.

**Escalation:** Confirmed inflation → oracle stake slashing (50–100% per v4.1 slashing rules). Oracle's `producer_lifecycle_state` set to `suspended`.

### 5.2 Permanent Oracle Offline

**Scenario:** Oracle disappears entirely. No responses, no recovery.

**Behavior:** Cached scores decay via staleness haircut. At 2× `max_staleness`, 50% haircut. At 4×, 75% haircut (capped). After ~180 days of no fresh data, the exponential decay formula drives karma to effective zero regardless. All operators scored only by the offline oracle revert to T0 floor.

**Mitigation:** Multi-oracle architecture. If 2 of 3 oracles are alive, consensus still holds (with 50% confidence haircut for being below the 3-oracle minimum — but still better than T0 reversion).

### 5.3 Unknown Operator (No Oracle History)

**Treatment:** T0 (1.0x multiplier). No oracle karma score exists, so the pipeline uses CGI-only routing. New operators in underserved domains still get the +0.3 CGI boost, ensuring they receive tasks. This is the "new entrant" path — earn karma through performance, not through reputation import.

### 5.4 Network Partition

**Scenario:** Oracle is online but unreachable from the pipeline due to network issues.

**Behavior:** Identical to Scenario B above. Cached score + staleness flag. The pipeline never blocks on oracle availability. Routing degrades gracefully from cached-T3 to haircut-T1 to eventual T0.

**Recovery:** First successful query after partition clears the staleness flag. Fresh score is immediately authoritative.

### 5.5 Score Manipulation via Signal Flooding

**Attack:** Operator submits hundreds of low-conviction signals to inflate sample size and game the minimum-signal thresholds for tier promotion.

**Defense:** `signal_weight` floor in the karma delta formula. Signals below a minimum confidence threshold (proposed: 0.3) receive `signal_weight = 0` — they count toward sample size but contribute zero karma. Combined with Brier scoring (which punishes high-confidence wrong calls), the optimal strategy is actually being right, not being prolific.

---

## 6. Implementation Roadmap

### Phase 1: Read-Only Query (Weeks 1–4)

- Implement `ORACLE_REPUTATION_QUERY` / `ORACLE_REPUTATION_RESPONSE` endpoints
- Pipeline queries b1e55ed oracle for karma scores
- Scores logged but **not used in routing** (shadow mode)
- Compare oracle-informed routing decisions vs. actual routing decisions
- Validate staleness handling and timeout behavior
- Success criteria: 99.5% query success rate, <500ms p95 latency

### Phase 2: Push Outcomes (Weeks 5–8)

- Implement `ATTRIBUTION_OUTCOME_INGEST` endpoint
- Oracle pushes `ATTRIBUTION_OUTCOME_V1` events into pipeline
- Dedupe layer validated against SPI's two-layer strategy
- Karma scores begin updating in the routing ledger (still shadow mode)
- Success criteria: 100% idempotency (no duplicate karma updates), ≥50 paper trade attributions processed

### Phase 3: Bidirectional Feedback (Weeks 9–12)

- Enable oracle karma in live routing decisions (exit shadow mode)
- Implement `ROUTING_WEIGHT_UPDATE` notifications
- Trust tiering goes live with T0–T2 only (T3 gated behind Phase 4)
- Monitor for routing quality improvement vs. CGI-only baseline
- Success criteria: measurable improvement in task outcome quality for oracle-scored operators

### Phase 4: Multi-Oracle Consensus (Weeks 13–20)

- Onboard 2+ additional oracles
- Implement stake-weighted median aggregation
- Enable T3 tier (requires multi-oracle consensus)
- Divergence detection and manual review pipeline
- Full production deployment
- Success criteria: 3+ oracles active, consensus within 0.10 karma for >80% of operators

---

## Appendix A: Proposed Configuration Defaults

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| `karma_decay_halflife_days` | 30 | Aggressive — forces continuous performance |
| `max_staleness_seconds` | 3600 | 1 hour default; configurable per query |
| `staleness_haircut_rate` | 0.25 per staleness_ratio | 50% haircut at 2× staleness |
| `staleness_haircut_cap` | 0.75 | Never fully zero a cached score |
| `min_oracles_for_consensus` | 3 | Below this: 50% confidence haircut |
| `divergence_iqr_threshold` | 0.20 | Above this: manual review flag |
| `low_sample_threshold` | 20 | Below this: 0.5× weight |
| `low_sample_weight` | 0.50 | Multiplier for sub-threshold operators |
| `min_confidence_for_weight` | 0.30 | Below this: signal_weight = 0 |
| `t1_floor_signal_count` | 50 | Operators with 50+ signals can't fall below T1 |
| `promotion_window_days` | 30 | Sustained performance required |
| `concentration_cap_pct` | 0.15 | Per v4.1: 15% per control graph |

## Appendix B: Interaction Matrix with v4.1 Controls

| v4.1 Control | Oracle Interaction | Override Possible? |
|-------------|-------------------|-------------------|
| Linking layer (`linking_score ≥ 3.5`) | Oracle reports `linking_context`; pipeline enforces routing to independent reviewer | **No.** Oracle cannot override linking layer |
| Concentration cap (15%) | T3 operators still subject to cap | **No.** Tier multiplier zeroed at cap |
| CGI gap-aware routing | CGI adjustment stacks additively with tier multiplier | Additive only |
| Control graph grouping (`linking_score ≥ 4.5`) | Immediate grouping per v4.1 | **No.** Karma is irrelevant to grouping |
| Registration stake | Oracle stake is separate from operator registration stake | Independent |
| Vesting schedule (probationary: 25/75) | Oracle tier does not affect vesting | **No.** |

---

*"The oracle sees. The pipeline decides. The linking layer protects."*

**End of spec.**
