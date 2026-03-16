---
layout: default
title: "Standard Producer Interface (SPI) Specification"
subtitle: "b1e55ed External Signal Producer Protocol v1.0"
date: 2026-03-16
category: specification
status: published
---

# Standard Producer Interface (SPI) Specification

**b1e55ed External Signal Producer Protocol v1.0**

**Task ID:** [5bf41b82-6281-4fa1-9f70-9bcf2f0c8838](https://tasknode.postfiat.org/tasks/5bf41b82-6281-4fa1-9f70-9bcf2f0c8838/forensics)  
**Author:** Permanent Upper Class Validator (b1e55ed Oracle Node Operator)  
**Date:** 2026-03-16

---

## Abstract

This specification defines the Standard Producer Interface (SPI) — the protocol by which external signal producers authenticate, submit signals, and receive attribution outcomes through the b1e55ed oracle network. The SPI converts b1e55ed from a closed, single-operator oracle into an open, permissionless attribution layer capable of integrating signals from any producer who meets the activation requirements.

The specification covers:

1. **Wire format** — JSON schema for signal submission, acknowledgment, and attribution outcome messages
2. **Authentication** — wallet-signature identity binding to b1e55ed control graphs
3. **Producer lifecycle** — state machine governing producer activation, operation, and suspension
4. **Rate limiting** — quota mechanics that prevent abuse while allowing proven producers to scale
5. **Integration scenarios** — worked examples demonstrating the complete signal-to-attribution flow

---

## 1. Design Principles

### 1.1 Why External Producers?

The b1e55ed oracle currently operates as a closed system — signals originate from internal models and position management logic. This architecture limits the network's information surface to what a single operator can build.

The SPI opens that surface. Any participant who can express calibrated conviction about market states — whether a human trader, an ML model, a proprietary data pipeline, or a collective intelligence system — can become a b1e55ed producer. The oracle aggregates their signals using the Conviction-Weighted Portfolio mechanism described in the [$BLESS tokenomics](../b1e55ed-tokenomics-v7/).

External producers earn attribution through the same mechanism as internal signals:
- Submit a calibrated conviction signal (direction, confidence, timeframe)
- If the signal is accepted and a position opens, receive `SIGNAL_ACCEPTED` acknowledgment
- When the position closes, receive `ATTRIBUTION_OUTCOME` with karma credit and PnL share

The economic incentive is direct: accurate signals earn $BLESS emissions proportional to calibration quality.

### 1.2 Trust Model

The SPI operates on a **graduated trust model** aligned with the [Network Task Authorization Gate Specification](../network-task-authorization-gate-specification/). New producers cannot immediately flood the network with signals. They must:

1. Bind a wallet identity to a b1e55ed control graph (one-time)
2. Meet minimum karma or staking requirements (configurable per network)
3. Progress through lifecycle states as they demonstrate calibration quality

The trust model assumes producers are economically rational. A producer who submits miscalibrated signals loses karma, loses delegation, and eventually loses activation status. The system self-regulates through economic consequences rather than upfront gatekeeping.

### 1.3 Wire Format Choice

The SPI v1 uses **JSON over HTTPS** for all message types. This prioritizes:

- **Accessibility** — any language with an HTTP client can integrate
- **Debuggability** — human-readable payloads simplify development
- **Compatibility** — works with existing webhook infrastructure

Future versions may offer Protobuf or gRPC for performance-critical integrations. The JSON schema is designed to be mechanically translatable to Protobuf.

---

## 2. Wire Format Schema

### 2.1 Message Type: `SignalSubmission`

Submitted by an external producer to express a market conviction.

```json
{
  "$schema": "https://b1e55ed.oracle/schema/v1/signal-submission.json",
  "type": "SignalSubmission",
  "version": "1.0",
  "id": "sig_01HWQV5X7ZRQK9Y2M8D3N4P6F7",
  "timestamp": "2026-03-16T18:30:00.000Z",
  "producer": {
    "control_graph_id": "cg_puc_validator_01",
    "wallet_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD38",
    "signature": "0x..."
  },
  "signal": {
    "asset": "ETH-USD",
    "direction": "LONG",
    "confidence": 0.78,
    "timeframe_hours": 168,
    "entry_price_hint": 2450.00,
    "stop_loss_pct": 0.05,
    "take_profit_pct": 0.15
  },
  "metadata": {
    "model_id": "puc_momentum_v3",
    "source_event_ids": ["evt_abc123", "evt_def456"],
    "tags": ["momentum", "weekly"]
  }
}
```

#### Field Definitions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Producer-generated unique identifier (ULID format recommended) |
| `timestamp` | ISO 8601 | Yes | Signal generation time (UTC) |
| `producer.control_graph_id` | string | Yes | b1e55ed control graph identifier (obtained during onboarding) |
| `producer.wallet_address` | string | Yes | EVM-compatible wallet address bound to control graph |
| `producer.signature` | string | Yes | EIP-712 typed signature of signal payload |
| `signal.asset` | string | Yes | Trading pair (format: `BASE-QUOTE`) |
| `signal.direction` | enum | Yes | `LONG` or `SHORT` |
| `signal.confidence` | float | Yes | Calibrated probability [0.50, 1.00] that direction is correct |
| `signal.timeframe_hours` | int | Yes | Expected resolution timeframe in hours |
| `signal.entry_price_hint` | float | No | Suggested entry price (oracle may adjust) |
| `signal.stop_loss_pct` | float | No | Suggested stop loss percentage |
| `signal.take_profit_pct` | float | No | Suggested take profit percentage |
| `metadata.model_id` | string | No | Producer's internal model identifier |
| `metadata.source_event_ids` | array | No | Upstream event IDs for provenance tracking |
| `metadata.tags` | array | No | Categorical tags for signal classification |

#### Validation Rules

1. `confidence` must be in range [0.50, 1.00] — 0.50 represents no edge (random), 1.00 represents certainty
2. `timeframe_hours` must be in range [1, 720] (1 hour to 30 days)
3. `signature` must be a valid EIP-712 signature over the canonical signal payload
4. `asset` must be a supported trading pair on the oracle network

---

### 2.2 Message Type: `SignalAcknowledgment`

Returned by b1e55ed to confirm signal receipt and acceptance status.

```json
{
  "$schema": "https://b1e55ed.oracle/schema/v1/signal-acknowledgment.json",
  "type": "SignalAcknowledgment",
  "version": "1.0",
  "signal_id": "sig_01HWQV5X7ZRQK9Y2M8D3N4P6F7",
  "timestamp": "2026-03-16T18:30:01.234Z",
  "status": "ACCEPTED",
  "acceptance": {
    "position_id": "pos_01HWQV6B2KMPQ8R3S5T7V9W1X2",
    "order_id": "ord_01HWQV6B3LNRQ9S4T6U8V0W2X3",
    "entry_price": 2448.50,
    "position_size_usd": 1000.00,
    "weight_applied": 0.024
  },
  "quota": {
    "remaining_daily": 47,
    "remaining_hourly": 9,
    "tier": "ACTIVE"
  }
}
```

#### Status Values

| Status | Meaning | `acceptance` Present? |
|--------|---------|----------------------|
| `ACCEPTED` | Signal accepted, position opened | Yes |
| `QUEUED` | Signal accepted, pending aggregation | No |
| `REJECTED_DUPLICATE` | Duplicate signal ID | No |
| `REJECTED_ASSET` | Unsupported asset | No |
| `REJECTED_CONFIDENCE` | Confidence out of range | No |
| `REJECTED_QUOTA` | Rate limit exceeded | No |
| `REJECTED_SUSPENDED` | Producer is suspended | No |
| `REJECTED_INSUFFICIENT_STAKE` | Below minimum $BLESS stake | No |

#### Field Definitions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `signal_id` | string | Yes | Echo of submitted signal ID |
| `timestamp` | ISO 8601 | Yes | Acknowledgment time |
| `status` | enum | Yes | Acceptance status (see table above) |
| `acceptance.position_id` | string | Conditional | Assigned position ID (if accepted) |
| `acceptance.order_id` | string | Conditional | Execution order ID |
| `acceptance.entry_price` | float | Conditional | Actual entry price |
| `acceptance.position_size_usd` | float | Conditional | Position size in USD |
| `acceptance.weight_applied` | float | Conditional | Signal weight in aggregation (0.0–1.0) |
| `quota.remaining_daily` | int | Yes | Remaining signals allowed today |
| `quota.remaining_hourly` | int | Yes | Remaining signals allowed this hour |
| `quota.tier` | string | Yes | Current producer tier |

---

### 2.3 Message Type: `AttributionOutcome`

Delivered by b1e55ed when a position closes and attribution is calculated.

```json
{
  "$schema": "https://b1e55ed.oracle/schema/v1/attribution-outcome.json",
  "type": "AttributionOutcome",
  "version": "1.0",
  "signal_id": "sig_01HWQV5X7ZRQK9Y2M8D3N4P6F7",
  "position_id": "pos_01HWQV6B2KMPQ8R3S5T7V9W1X2",
  "timestamp": "2026-03-23T14:45:00.000Z",
  "outcome": {
    "direction_correct": true,
    "entry_price": 2448.50,
    "exit_price": 2612.30,
    "pnl_usd": 66.87,
    "pnl_pct": 0.0669,
    "hold_duration_hours": 164.25
  },
  "attribution": {
    "karma_delta": 42,
    "karma_total": 1847,
    "brier_score": 0.0484,
    "bless_earned": 12.5,
    "attribution_share": 0.024
  },
  "position_summary": {
    "total_signals": 12,
    "your_weight": 0.024,
    "aggregated_confidence": 0.72
  }
}
```

#### Field Definitions

| Field | Type | Description |
|-------|------|-------------|
| `signal_id` | string | Original signal ID |
| `position_id` | string | Position that closed |
| `timestamp` | ISO 8601 | Attribution calculation time |
| `outcome.direction_correct` | bool | Whether signal direction matched outcome |
| `outcome.entry_price` | float | Position entry price |
| `outcome.exit_price` | float | Position exit price |
| `outcome.pnl_usd` | float | Position PnL in USD |
| `outcome.pnl_pct` | float | Position PnL as percentage |
| `outcome.hold_duration_hours` | float | Time position was held |
| `attribution.karma_delta` | int | Karma points earned (or lost if negative) |
| `attribution.karma_total` | int | Producer's total karma after this outcome |
| `attribution.brier_score` | float | Calibration score for this signal (lower is better) |
| `attribution.bless_earned` | float | $BLESS earned from this attribution |
| `attribution.attribution_share` | float | Share of position attributed to this signal |
| `position_summary.total_signals` | int | Number of signals aggregated into position |
| `position_summary.your_weight` | float | This signal's weight in aggregation |
| `position_summary.aggregated_confidence` | float | CWP aggregated confidence |

---

## 3. Authentication Handshake

### 3.1 Overview

External producers must complete a one-time onboarding flow to bind their wallet identity to a b1e55ed control graph. This binding enables:

1. **Signal attribution** — signals are credited to the producer's karma ledger
2. **Rate limiting** — quotas are enforced per control graph
3. **Staking verification** — $BLESS stake determines signal weight

### 3.2 Sequence Diagram

```
┌──────────────┐                    ┌─────────────────┐                    ┌──────────────┐
│   Producer   │                    │    b1e55ed      │                    │  Blockchain  │
│   (Client)   │                    │    Oracle       │                    │   (L1/L2)    │
└──────┬───────┘                    └────────┬────────┘                    └──────┬───────┘
       │                                     │                                    │
       │  1. POST /v1/producers/register     │                                    │
       │  {wallet_address, chain_id}         │                                    │
       │────────────────────────────────────>│                                    │
       │                                     │                                    │
       │  2. {challenge_nonce, expires_at}   │                                    │
       │<────────────────────────────────────│                                    │
       │                                     │                                    │
       │  3. Sign EIP-712 typed data         │                                    │
       │     (challenge_nonce + terms_hash)  │                                    │
       │                                     │                                    │
       │  4. POST /v1/producers/verify       │                                    │
       │  {wallet, nonce, signature}         │                                    │
       │────────────────────────────────────>│                                    │
       │                                     │                                    │
       │                                     │  5. Verify signature               │
       │                                     │  6. Check $BLESS balance/stake     │
       │                                     │─────────────────────────────────────>
       │                                     │                                    │
       │                                     │  7. {balance, staked_amount}       │
       │                                     │<─────────────────────────────────────
       │                                     │                                    │
       │                                     │  8. Create control_graph entry     │
       │                                     │     Set initial state: ONBOARDING  │
       │                                     │                                    │
       │  9. {control_graph_id, api_key,     │                                    │
       │      state: ONBOARDING,             │                                    │
       │      activation_requirements}       │                                    │
       │<────────────────────────────────────│                                    │
       │                                     │                                    │
       ▼                                     ▼                                    ▼
```

### 3.3 Registration Request

```json
POST /v1/producers/register
{
  "wallet_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD38",
  "chain_id": 1,
  "producer_name": "PUC Momentum Model",
  "webhook_url": "https://api.permanentupperclass.com/b1e55ed/webhook"
}
```

### 3.4 Challenge Response

```json
{
  "challenge_nonce": "0x8a3f...7b2e",
  "expires_at": "2026-03-16T18:35:00.000Z",
  "terms_hash": "0xabc123...def456",
  "eip712_domain": {
    "name": "b1e55ed Producer Registry",
    "version": "1",
    "chainId": 1,
    "verifyingContract": "0x..."
  }
}
```

### 3.5 Verification Request

```json
POST /v1/producers/verify
{
  "wallet_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD38",
  "challenge_nonce": "0x8a3f...7b2e",
  "signature": "0x...",
  "accepted_terms_version": "1.0"
}
```

### 3.6 Verification Response

```json
{
  "control_graph_id": "cg_puc_validator_01",
  "api_key": "bls_prod_xxxxxxxxxxxxxxxxxxxxxxxx",
  "state": "ONBOARDING",
  "activation_requirements": {
    "min_bless_stake": 100,
    "current_stake": 0,
    "min_karma": 0,
    "current_karma": 0,
    "probation_signals_required": 10,
    "probation_signals_completed": 0
  },
  "quotas": {
    "daily_limit": 5,
    "hourly_limit": 2
  }
}
```

---

## 4. Producer Lifecycle

### 4.1 State Machine

```
                    ┌─────────────────────────────────────────────────────┐
                    │                                                     │
                    ▼                                                     │
    ┌───────────────────────────┐                                        │
    │        ONBOARDING         │                                        │
    │                           │                                        │
    │  • Register wallet        │                                        │
    │  • Stake min $BLESS       │                                        │
    │  • Accept terms           │                                        │
    └─────────────┬─────────────┘                                        │
                  │                                                       │
                  │ [stake ≥ MIN_STAKE]                                  │
                  ▼                                                       │
    ┌───────────────────────────┐                                        │
    │       PROBATIONARY        │                                        │
    │                           │                                        │
    │  • Limited quota (5/day)  │                                        │
    │  • 25% attribution vests  │                                        │
    │  • Build karma track      │                                        │
    └─────────────┬─────────────┘                                        │
                  │                                                       │
                  │ [karma ≥ 500 AND signals ≥ 10                        │
                  │  AND brier_avg ≤ 0.20]                               │
                  ▼                                                       │
    ┌───────────────────────────┐                                        │
    │          ACTIVE           │◄───────────────────────────────────────┤
    │                           │         [appeal approved OR            │
    │  • Full quota (50/day)    │          cooldown expired]             │
    │  • 100% attribution       │                                        │
    │  • Weight by stake        │                                        │
    └─────────────┬─────────────┘                                        │
                  │                                                       │
                  │ [karma < -100 OR                                     │
                  │  brier_avg > 0.35 OR                                 │
                  │  rate_violation]                                     │
                  ▼                                                       │
    ┌───────────────────────────┐                                        │
    │        SUSPENDED          │────────────────────────────────────────┘
    │                           │
    │  • Zero quota             │
    │  • Attribution frozen     │
    │  • 7-day cooldown minimum │
    └───────────────────────────┘
```

### 4.2 State Definitions

| State | Description | Daily Quota | Attribution | Weight Multiplier |
|-------|-------------|-------------|-------------|-------------------|
| **ONBOARDING** | Wallet bound, stake pending | 0 | 0% | 0x |
| **PROBATIONARY** | Building track record | 5 signals | 25% (vests 30d) | 0.5x |
| **ACTIVE** | Full participation | 50 signals | 100% | 1.0x |
| **SUSPENDED** | Violations detected | 0 signals | Frozen | 0x |

### 4.3 Transition Triggers

#### ONBOARDING → PROBATIONARY
- Wallet signature verified
- Minimum $BLESS stake deposited (100 $BLESS default)
- Terms accepted

#### PROBATIONARY → ACTIVE
- At least 10 signals submitted
- Karma score ≥ 500
- Rolling 30-day Brier score ≤ 0.20 (demonstrating calibration)
- No rate limit violations in last 7 days

#### ACTIVE → SUSPENDED
Any of:
- Karma drops below -100
- Rolling 30-day Brier score > 0.35 (persistent miscalibration)
- 3+ rate limit violations in 24 hours
- Stake falls below minimum (slashing or withdrawal)
- Manual suspension by network governance

#### SUSPENDED → ACTIVE
- 7-day minimum cooldown elapsed
- Stake replenished to minimum
- Appeal approved by governance (if manual suspension)

### 4.4 Karma Mechanics

Karma is the cumulative measure of a producer's signal quality:

```
karma_delta = attribution_share × direction_bonus × calibration_factor

where:
  attribution_share = signal_weight / total_position_weight
  direction_bonus = +50 if direction_correct else -25
  calibration_factor = 1 - brier_score  (range: 0 to 1)
```

Example:
- Signal with 0.024 attribution share
- Direction correct
- Brier score 0.0484

```
karma_delta = 0.024 × 50 × (1 - 0.0484) = 1.14
```

Karma accumulates over time. Negative outcomes subtract karma. The 30-day rolling Brier average is the primary measure used for state transitions.

---

## 5. Rate Limiting and Quotas

### 5.1 Quota Tiers

| Tier | Hourly Limit | Daily Limit | Burst Allowance | Cooldown on Violation |
|------|--------------|-------------|-----------------|----------------------|
| **ONBOARDING** | 0 | 0 | 0 | N/A |
| **PROBATIONARY** | 2 | 5 | 0 | 1 hour |
| **ACTIVE** | 10 | 50 | +5 (once/day) | 15 minutes |
| **ACTIVE + HIGH_KARMA** | 20 | 100 | +10 (twice/day) | 5 minutes |

HIGH_KARMA threshold: karma ≥ 5000

### 5.2 Rate Limit Headers

All API responses include rate limit headers:

```
X-RateLimit-Limit-Hour: 10
X-RateLimit-Remaining-Hour: 7
X-RateLimit-Limit-Day: 50
X-RateLimit-Remaining-Day: 43
X-RateLimit-Reset: 1710612000
```

### 5.3 Quota Replenishment

- **Hourly quota**: Resets at the top of each UTC hour
- **Daily quota**: Resets at 00:00 UTC
- **Burst allowance**: Resets at 00:00 UTC; must be explicitly requested via `X-Request-Burst: true` header

### 5.4 Violation Handling

```json
HTTP 429 Too Many Requests
{
  "error": "RATE_LIMIT_EXCEEDED",
  "message": "Hourly quota exhausted",
  "retry_after_seconds": 847,
  "quota": {
    "remaining_hourly": 0,
    "remaining_daily": 38,
    "cooldown_until": "2026-03-16T19:00:00.000Z"
  },
  "violation_count_24h": 1,
  "suspension_threshold": 3
}
```

---

## 6. Integration Scenarios

### 6.1 Scenario A: New Producer First Signal

**Context:** A new external producer (PUC Momentum Model) registers, stakes, submits their first signal, and receives their first attribution outcome.

#### Step 1: Register Wallet

```bash
curl -X POST https://api.b1e55ed.oracle/v1/producers/register \
  -H "Content-Type: application/json" \
  -d '{
    "wallet_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD38",
    "chain_id": 1,
    "producer_name": "PUC Momentum Model",
    "webhook_url": "https://api.permanentupperclass.com/b1e55ed/webhook"
  }'
```

**Response:**
```json
{
  "challenge_nonce": "0x8a3f4b2c1d0e9f8a7b6c5d4e3f2a1b0c",
  "expires_at": "2026-03-16T18:35:00.000Z",
  "terms_hash": "0xabc123def456789...",
  "eip712_domain": { ... }
}
```

#### Step 2: Sign and Verify

```bash
# Producer signs challenge with wallet private key (offline)
# Then submits signature:

curl -X POST https://api.b1e55ed.oracle/v1/producers/verify \
  -H "Content-Type: application/json" \
  -d '{
    "wallet_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD38",
    "challenge_nonce": "0x8a3f4b2c1d0e9f8a7b6c5d4e3f2a1b0c",
    "signature": "0x1234...abcd",
    "accepted_terms_version": "1.0"
  }'
```

**Response:**
```json
{
  "control_graph_id": "cg_puc_validator_01",
  "api_key": "bls_prod_xxxxxxxxxxxxxxxxxxxx",
  "state": "ONBOARDING",
  "activation_requirements": {
    "min_bless_stake": 100,
    "current_stake": 0
  }
}
```

#### Step 3: Stake $BLESS

Producer stakes 100 $BLESS to the b1e55ed staking contract via on-chain transaction:

```solidity
// On-chain: BLESS.approve(stakingContract, 100e18)
// On-chain: stakingContract.stake(control_graph_id, 100e18)
```

b1e55ed detects the stake event and updates producer state:

```json
// Webhook to producer:
{
  "type": "ProducerStateChange",
  "control_graph_id": "cg_puc_validator_01",
  "previous_state": "ONBOARDING",
  "new_state": "PROBATIONARY",
  "quotas": {
    "daily_limit": 5,
    "hourly_limit": 2
  }
}
```

#### Step 4: Submit First Signal

```bash
curl -X POST https://api.b1e55ed.oracle/v1/signals \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer bls_prod_xxxxxxxxxxxxxxxxxxxx" \
  -d '{
    "type": "SignalSubmission",
    "version": "1.0",
    "id": "sig_01HWQV5X7ZRQK9Y2M8D3N4P6F7",
    "timestamp": "2026-03-16T18:30:00.000Z",
    "producer": {
      "control_graph_id": "cg_puc_validator_01",
      "wallet_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD38",
      "signature": "0x..."
    },
    "signal": {
      "asset": "ETH-USD",
      "direction": "LONG",
      "confidence": 0.78,
      "timeframe_hours": 168
    }
  }'
```

**Response:**
```json
{
  "type": "SignalAcknowledgment",
  "signal_id": "sig_01HWQV5X7ZRQK9Y2M8D3N4P6F7",
  "status": "ACCEPTED",
  "acceptance": {
    "position_id": "pos_01HWQV6B2KMPQ8R3S5T7V9W1X2",
    "order_id": "ord_01HWQV6B3LNRQ9S4T6U8V0W2X3",
    "entry_price": 2448.50,
    "position_size_usd": 1000.00,
    "weight_applied": 0.024
  },
  "quota": {
    "remaining_daily": 4,
    "remaining_hourly": 1,
    "tier": "PROBATIONARY"
  }
}
```

#### Step 5: Receive Attribution Outcome

7 days later, the position closes. b1e55ed sends attribution via webhook:

```json
POST https://api.permanentupperclass.com/b1e55ed/webhook
{
  "type": "AttributionOutcome",
  "signal_id": "sig_01HWQV5X7ZRQK9Y2M8D3N4P6F7",
  "position_id": "pos_01HWQV6B2KMPQ8R3S5T7V9W1X2",
  "timestamp": "2026-03-23T14:45:00.000Z",
  "outcome": {
    "direction_correct": true,
    "entry_price": 2448.50,
    "exit_price": 2612.30,
    "pnl_usd": 66.87,
    "pnl_pct": 0.0669
  },
  "attribution": {
    "karma_delta": 42,
    "karma_total": 42,
    "brier_score": 0.0484,
    "bless_earned": 3.125,
    "attribution_share": 0.024
  }
}
```

**Note:** As a PROBATIONARY producer, only 25% of the $BLESS earned (0.78 $BLESS) is immediately liquid. The remaining 75% (2.34 $BLESS) vests linearly over 30 days.

---

### 6.2 Scenario B: Probationary Producer Graduates to Active

**Context:** A probationary producer has submitted 12 signals over 3 weeks. Their karma is 520 and their rolling Brier score is 0.18. The system evaluates them for graduation.

#### Current State

```json
GET /v1/producers/cg_puc_validator_01/status

{
  "control_graph_id": "cg_puc_validator_01",
  "state": "PROBATIONARY",
  "metrics": {
    "signals_submitted": 12,
    "signals_accepted": 11,
    "karma_total": 520,
    "brier_score_30d": 0.18,
    "rate_violations_7d": 0
  },
  "graduation_requirements": {
    "min_signals": {"required": 10, "current": 12, "met": true},
    "min_karma": {"required": 500, "current": 520, "met": true},
    "max_brier": {"required": 0.20, "current": 0.18, "met": true},
    "no_violations": {"required": true, "current": true, "met": true}
  },
  "eligible_for_graduation": true
}
```

#### Graduation Trigger

b1e55ed runs state evaluation at the end of each epoch (weekly). The producer meets all requirements:

```json
// Webhook to producer:
{
  "type": "ProducerStateChange",
  "control_graph_id": "cg_puc_validator_01",
  "previous_state": "PROBATIONARY",
  "new_state": "ACTIVE",
  "timestamp": "2026-04-06T00:00:00.000Z",
  "reason": "Graduation criteria met",
  "new_quotas": {
    "daily_limit": 50,
    "hourly_limit": 10
  },
  "new_attribution": {
    "rate": 1.0,
    "vesting": "immediate"
  }
}
```

#### Post-Graduation Signal

The producer can now submit at higher volume with full attribution:

```bash
curl -X POST https://api.b1e55ed.oracle/v1/signals \
  -H "Authorization: Bearer bls_prod_xxxxxxxxxxxxxxxxxxxx" \
  -d '{
    "type": "SignalSubmission",
    "id": "sig_01HXYZ...",
    "signal": {
      "asset": "BTC-USD",
      "direction": "SHORT",
      "confidence": 0.65,
      "timeframe_hours": 72
    }
  }'
```

**Response:**
```json
{
  "type": "SignalAcknowledgment",
  "signal_id": "sig_01HXYZ...",
  "status": "ACCEPTED",
  "acceptance": {
    "position_id": "pos_01HXYZ...",
    "weight_applied": 0.048
  },
  "quota": {
    "remaining_daily": 49,
    "remaining_hourly": 9,
    "tier": "ACTIVE"
  }
}
```

Note the `weight_applied` increased from 0.024 (PROBATIONARY with 0.5x multiplier) to 0.048 (ACTIVE with 1.0x multiplier) — the producer's signals now carry full weight in the aggregation.

---

## 7. API Endpoint Summary

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/v1/producers/register` | POST | Initiate wallet registration |
| `/v1/producers/verify` | POST | Complete wallet verification |
| `/v1/producers/{id}/status` | GET | Get producer state and metrics |
| `/v1/producers/{id}/signals` | GET | List submitted signals |
| `/v1/signals` | POST | Submit a signal |
| `/v1/signals/{id}` | GET | Get signal status |
| `/v1/signals/{id}/outcome` | GET | Get attribution outcome |
| `/v1/assets` | GET | List supported trading pairs |

---

## 8. Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INVALID_SIGNATURE` | 401 | EIP-712 signature verification failed |
| `EXPIRED_CHALLENGE` | 401 | Challenge nonce expired |
| `INSUFFICIENT_STAKE` | 403 | $BLESS stake below minimum |
| `PRODUCER_SUSPENDED` | 403 | Producer is in SUSPENDED state |
| `RATE_LIMIT_EXCEEDED` | 429 | Quota exhausted |
| `INVALID_ASSET` | 400 | Unsupported trading pair |
| `INVALID_CONFIDENCE` | 400 | Confidence outside [0.50, 1.00] |
| `DUPLICATE_SIGNAL` | 409 | Signal ID already submitted |

---

## 9. Versioning and Migration

The SPI follows semantic versioning. Breaking changes increment the major version. The current version is `1.0`.

Clients must include `version` in all messages. The server will reject messages with unsupported versions and return:

```json
{
  "error": "UNSUPPORTED_VERSION",
  "supported_versions": ["1.0"],
  "migration_guide": "https://b1e55ed.oracle/docs/migration/v1"
}
```

---

## 10. Security Considerations

1. **Signature replay protection**: Each signal includes a unique `id` and `timestamp`. The server rejects duplicate IDs and signals with timestamps more than 5 minutes in the past.

2. **API key rotation**: Producers can rotate API keys via `/v1/producers/{id}/rotate-key`. Old keys are invalidated immediately.

3. **Webhook verification**: b1e55ed signs all webhook payloads with HMAC-SHA256. Producers should verify the `X-B1e55ed-Signature` header.

4. **Stake slashing**: Malicious behavior (e.g., submitting signals that consistently lose) results in karma loss. Severe or persistent miscalibration can trigger stake slashing via governance action.

---

*Specification published by Permanent Upper Class Validator.*  
*For the Post Fiat Network and b1e55ed oracle community.*
