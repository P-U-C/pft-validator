---
layout: default
title: "SPI v1.0 Implementation Plan — External Producer Integration"
date: 2026-03-16
category: b1e55ed
status: published
---

# SPI v1.0 Implementation Plan — Revised

## Mapped to the b1e55ed Repository

**Status:** Implementation-ready  
**Branch strategy:** feat/spi → develop  
**First integration target:** post-fiat-signals (adapter-mediated → native)  
**Revision note:** Incorporates review feedback — thin resolution moved forward, single admission pipeline mandated, explicit deferrals, golden path test defined.

---

## 0. One-Attempt Success Definition

The first successful integration is proven when:

1. post-fiat-signals runs adapter-mediated inside b1e55ed
2. It emits valid native events with provenance
3. Those signals are accepted into a canonical internal signal record
4. Signals resolve once the attribution window closes
5. Outcome resolution changes karma
6. Producer state is inspectable via CLI and dashboard
7. The same internal signal record shape is reusable by native SPI ingress later

If all seven hold, the substrate is proven.

---

## 1. Architectural Invariant: Single Admission Pipeline

This is the highest-risk issue in the entire plan.

Both the adapter path and the future SPI gateway MUST call the same internal services. If they diverge, drift is inevitable in dedupe, validation, signal IDs, attribution windows, and producer accounting.

**Required internal service boundary:**

```
engine/spi/
  admission.py    — accept_signal(), the single entry point for all signal acceptance
  resolution.py   — resolve_signal(), outcome determination
  scoring.py      — compute_brier(), compute_karma_delta(), pure functions
  outcome.py      — apply_outcome(), writes outcome + updates karma
  state.py        — producer state queries and transitions
```

Then:

- **Adapter path:** `BaseExternalProducer.normalize()` → calls `admission.accept_signal()`
- **Gateway path:** `POST /v1/signals/submit` route → calls `admission.accept_signal()`

Both paths produce the same `AcceptedSignal` record. Both paths feed the same resolver. Both paths update the same karma ledger.

This boundary is scaffolded in Phase 1B and used by every subsequent phase.

---

## 2. Explicit Scope: First Landing vs Deferred

### In the first landing

- Adapter framework (`engine/external/`)
- post-fiat-signals as reference adapter producer
- Internal admission pipeline (`engine/spi/admission.py`)
- Canonical `AcceptedSignal` model shared by adapter and future gateway
- Minimal deterministic resolver (one price feed + one fallback)
- Brier-based karma computation
- Basic lifecycle: onboarding → probationary → active, any → suspended
- Stake as recorded/queryable/threshold-checkable (manual recording)
- SPI gateway MVP: challenge, register, submit, ack, status, quota, sandbox
- CLI inspection of producer state
- Golden path acceptance test
- Adapter dry-run and validate commands

### Explicitly deferred to v1.1+

- Webhook push delivery for outcomes
- Credential rotation endpoint
- Signal cancellation endpoint
- Elevated quota tier (karma ≥ 0.70 + 6 months)
- On-chain stake detection (watching Base mainnet events)
- Emergency exit (forfeit 5% for immediate unstaking)
- Deregistration after 12 suspended epochs
- Correlation-abuse detection and enforcement
- Low-liquidity karma discount
- Solo-signal karma cap
- TWAP sophistication beyond basic implementation
- Multiple price feed hierarchy beyond primary + one fallback
- Full dashboard SPI pages (sparklines, advanced visualizations)
- Requirements endpoint richness beyond config reflection

These are all scaffolded in the config and schema (fields exist, columns present) so they can be activated without schema migrations. They are just not implemented in the first landing.

---

## 3. Revised Phase Plan

### Phase 1A — Adapter Framework + First Producer

**Goal:** post-fiat-signals running as a registered producer, emitting native events.  
**Duration:** 1–2 weeks

**Deliverables:**

```
engine/external/
  __init__.py
  models.py         — ExternalObservation, RawExternalRecord
  spec.py           — YAML spec loader, AdapterSpec model
  validation.py     — Spec validation
  connector_http.py — HTTP polling connector
  confidence.py     — Confidence normalization (hit_rate strategy)
  policy.py         — Stale/halt/degraded/min-confidence/dedupe
  dedupe.py         — Deterministic dedupe key generation
  mapper.py         — Observation → native Event mapping
  base.py           — BaseExternalProducer(BaseProducer)
  errors.py         — Typed adapter exceptions
  utils.py          — Field extraction, time parsing

engine/external/specs/
  post_fiat_signals.yaml — Reference adapter spec

engine/producers/post_fiat_signals.py
  — @register("post-fiat-signals", domain="tradfi")
  — Matches sendoeth's existing domain choice
```

**Modified files:**

- `engine/core/config.py` — Add ExternalProducersConfig section
- `engine/core/events.py` — Extend TradFiSignalPayload with external-source fields (direction, confidence, regime, source_system, health_state, hit_rate, avg_return, freshness_sec, metadata)

**Acceptance criteria:**

- `b1e55ed producers list` shows post-fiat-signals
- Dashboard shows health state
- Events appear in event store with correct payloads and provenance
- Dry-run works against fixture data from the post-fiat-signals mock server

---

### Phase 1B — Internal Admission Pipeline + Thin Resolver

**Goal:** The feedback loop works. Adapter-produced signals can be accepted, resolved, and scored.  
**Duration:** 1–2 weeks (overlaps with tail of 1A)

**Deliverables:**

```
engine/spi/
  __init__.py
  models.py       — AcceptedSignal, SignalOutcome, ProducerKarmaState
  admission.py    — accept_signal(): validates, assigns canonical ID, sets attribution window, writes to spi_signals
  scoring.py      — compute_brier(), compute_karma_delta() — PURE FUNCTIONS
  resolution.py   — resolve_expired_signals(): finds expired windows, fetches price, determines direction, calls scoring
  outcome.py      — apply_outcome(): writes spi_outcomes, updates spi_karma
  price_feeds.py  — CoinGecko REST primary, with one fallback stub
  state.py        — get_producer_state(), transition helpers
```

**Modified files:**

- `engine/core/database.py` — Add tables: spi_signals, spi_outcomes, spi_karma, spi_producers
- `engine/external/base.py` — After `normalize()` emits native Events, also call `admission.accept_signal()` to create the canonical AcceptedSignal record

**Key design: scoring as pure functions.**

```python
# engine/spi/scoring.py — no side effects, no DB access, trivially testable

def compute_brier(confidence: float, outcome: bool) -> float:
    """Brier score component for a single conviction."""
    return (confidence - (1.0 if outcome else 0.0)) ** 2


def compute_karma_delta(
    current_karma: float,
    epoch_brier: float,
    smoothing_factor: float = 0.70,
) -> float:
    """Karma update from epoch Brier score."""
    epoch_karma = 1.0 - epoch_brier
    new_karma = (smoothing_factor * current_karma) + ((1.0 - smoothing_factor) * epoch_karma)
    return max(0.0, min(1.0, new_karma)) - current_karma
```

**Resolution is deliberately minimal:**

- Scheduled job: find signals where `attribution_window_end < now()` and `status = 'accepted'`
- For each: fetch close price from CoinGecko REST
- Determine: did price move in the claimed direction?
- Compute Brier component
- Write outcome
- Update running karma

No TWAP, no multiple feeds, no webhook delivery. Just: was the producer right, and by how much?

**Acceptance criteria:**

- Signal submitted via adapter → AcceptedSignal record created
- Attribution window expires → outcome record written with correct direction and Brier
- Karma updates in spi_karma table
- Same AcceptedSignal model will be usable by gateway in Phase 2A

---

### Phase 2A — SPI Gateway MVP

**Goal:** External producer can authenticate and submit signals through the public API.  
**Duration:** 2–3 weeks

**Deliverables:**

```
api/spi/
  __init__.py
  app.py          — FastAPI app, separate port from existing API
  auth.py         — Challenge-response, wallet sig verification (eth_account)
  routes/
    challenge.py  — POST /v1/producers/challenge
    register.py   — POST /v1/producers/register
    submit.py     — POST /v1/signals/submit → calls admission.accept_signal()
    status.py     — GET /v1/producers/{id}, GET /v1/producers/{id}/quota
    outcomes.py   — GET /v1/producers/{id}/outcomes
    sandbox.py    — POST /v1/sandbox/submit
  middleware/
    rate_limit.py     — Quota enforcement per producer per tier
    auth_middleware.py — Bearer token validation
  models/
    submission.py     — SignalSubmission request model
    acknowledgment.py — SignalAcknowledgment response model
    errors.py         — Error response models
  validation.py   — Signal validation (confidence, horizon, symbol)
  signature.py    — EIP-191 signature verification
  quota.py        — Quota state management
```

**Critical: gateway calls the same admission pipeline as adapter.**

```python
# api/spi/routes/submit.py
from engine.spi.admission import accept_signal

@router.post("/v1/signals/submit")
async def submit_signals(submission: SignalSubmission, producer: AuthenticatedProducer):
    results = []
    for signal in submission.signals:
        accepted = accept_signal(        # SAME function the adapter calls
            producer_id=producer.producer_id,
            signal=signal,
            ingress_mode="native",
        )
        results.append(accepted)
    return SignalAcknowledgment(results=results, ...)
```

**Modified files:**

- `engine/core/database.py` — Add tables: spi_challenges, spi_quotas
- `engine/cli/main.py` — Add `b1e55ed spi start` command

**Acceptance criteria:**

- Full challenge → register → submit → ack flow works
- Submitted signals become AcceptedSignal records (same as adapter path)
- Rate limit headers on every response
- Sandbox submissions don't create AcceptedSignal records
- Duplicate submission_id returns original ack

---

### Phase 2B — Lifecycle + Quota Hardening

**Goal:** Producers advance through lifecycle states based on earned performance.  
**Duration:** 1–2 weeks (overlaps with 2A)

**Deliverables:**

```
engine/spi/
  lifecycle.py    — Transition evaluator, runs at epoch boundary
  transitions.py  — Check functions: karma_sufficient(), stake_sufficient(), etc.
```

**Modified files:**

- `engine/spi/state.py` — Add lifecycle transition logic
- `engine/core/database.py` — Add spi_stake table, admin_hold column on spi_producers

**Lifecycle transitions implemented in first landing:**

- onboarding → probationary (stake posted)
- probationary → active (karma ≥ threshold + resolved signal count)
- any → suspended (karma floor breach, stake floor breach, liveness failure)
- operator admin hold (manual emergency suspension)

**Deferred transitions:**

- Suspended → probationary recovery (exists as a path but not automated)
- Correlation-abuse detection
- 12-epoch deregistration

**Acceptance criteria:**

- Producer starts in onboarding after registration
- Stake recording transitions to probationary
- After sufficient resolved outcomes with good karma, transitions to active
- Karma floor breach triggers suspension
- Admin hold works as emergency override

---

### Phase 3 — Robustness + Second Producer

**Goal:** System is hardened and a second producer proves the framework generalizes.  
**Duration:** 2–3 weeks

**Deliverables:**

- Resolution robustness: TWAP, second price feed, oracle manipulation defenses
- Webhook outcome delivery with HMAC signing and retry
- Signal cancellation endpoint
- Credential rotation endpoint
- Richer provenance URLs in outcomes
- Second external producer onboarded via adapter framework
- Adapter dry-run and validate CLI commands
- Documentation: how to add a producer, how to become SPI-native

**Acceptance criteria:**

- Second producer runs with mostly config + thin producer stub
- Webhook delivery works with retry policy
- TWAP resolution produces correct results
- Golden path test passes (see Section 8)

---

### Phase 4 — Operator Polish

**Goal:** Inspectability is excellent.  
**Duration:** 1–2 weeks

**Deliverables:**

- CLI: `b1e55ed spi producers list/inspect/outcomes`
- Dashboard: lifecycle state badges on producer rows
- Fixture-backed replay for adapters
- Requirements endpoint (trivial: reads config, returns JSON)

---

## 4. Database Schema (Revised)

All tables additive. No existing table modifications.

```sql
-- Producer identity and lifecycle
CREATE TABLE spi_producers (
    producer_id TEXT PRIMARY KEY,
    wallet_address TEXT UNIQUE NOT NULL,
    wallet_scheme TEXT NOT NULL DEFAULT 'eip191',
    producer_name TEXT NOT NULL,
    display_name TEXT,
    lifecycle_state TEXT NOT NULL DEFAULT 'onboarding',
    ingress_mode TEXT NOT NULL DEFAULT 'native',
    capabilities TEXT,
    callback_url TEXT,
    admin_hold BOOLEAN DEFAULT FALSE,
    admin_hold_reason TEXT,
    registered_at TEXT NOT NULL,
    last_submission_at TEXT,
    credential_hash TEXT,
    credential_expires_at TEXT,
    suspended_at TEXT,
    suspended_reason TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Canonical accepted signals awaiting resolution
CREATE TABLE spi_signals (
    signal_id TEXT PRIMARY KEY,
    signal_client_id TEXT NOT NULL,
    submission_id TEXT NOT NULL,
    producer_id TEXT NOT NULL REFERENCES spi_producers(producer_id),
    ingress_mode TEXT NOT NULL,
    symbol TEXT NOT NULL,
    direction TEXT NOT NULL,
    confidence REAL NOT NULL,
    horizon_hours INTEGER NOT NULL,
    submitted_at TEXT NOT NULL,
    attribution_window_start TEXT NOT NULL,
    attribution_window_end TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'accepted',
    resolved_at TEXT,
    signal_payload_json TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX idx_spi_signals_producer_status ON spi_signals(producer_id, status);
CREATE INDEX idx_spi_signals_window_end ON spi_signals(attribution_window_end, status);

-- Resolved outcomes
CREATE TABLE spi_outcomes (
    outcome_id TEXT PRIMARY KEY,
    signal_id TEXT NOT NULL REFERENCES spi_signals(signal_id),
    producer_id TEXT NOT NULL,
    resolved_at TEXT NOT NULL,
    status TEXT NOT NULL,
    outcome_label TEXT,
    direction_correct BOOLEAN,
    entry_price REAL,
    exit_price REAL,
    price_change_pct REAL,
    resolution_method TEXT,
    brier_component REAL,
    karma_delta REAL,
    score_delta REAL,
    slash_applied BOOLEAN DEFAULT FALSE,
    slash_amount REAL DEFAULT 0,
    emission_earned REAL DEFAULT 0,
    chain_hash TEXT,
    event_id TEXT,
    created_at TEXT NOT NULL
);

CREATE INDEX idx_spi_outcomes_producer ON spi_outcomes(producer_id, resolved_at);

-- Karma history per producer per epoch
CREATE TABLE spi_karma (
    producer_id TEXT NOT NULL REFERENCES spi_producers(producer_id),
    epoch INTEGER NOT NULL,
    epoch_brier REAL,
    epoch_karma REAL,
    running_karma REAL NOT NULL,
    resolved_count INTEGER DEFAULT 0,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (producer_id, epoch)
);

-- Stake ledger
CREATE TABLE spi_stake (
    producer_id TEXT NOT NULL REFERENCES spi_producers(producer_id),
    amount REAL NOT NULL DEFAULT 0,
    asset TEXT NOT NULL DEFAULT 'governance_defined',
    last_deposit_at TEXT,
    unstaking_initiated_at TEXT,
    unstaking_amount REAL DEFAULT 0,
    cooldown_expires_at TEXT,
    slashed_total REAL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (producer_id)
);

-- Quota tracking
CREATE TABLE spi_quotas (
    producer_id TEXT NOT NULL REFERENCES spi_producers(producer_id),
    tier TEXT NOT NULL,
    hour_window_start TEXT NOT NULL,
    submissions_this_hour INTEGER DEFAULT 0,
    day_window_start TEXT NOT NULL,
    submissions_this_day INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (producer_id)
);

-- Challenge nonces (TTL-based cleanup)
CREATE TABLE spi_challenges (
    challenge_id TEXT PRIMARY KEY,
    nonce TEXT UNIQUE NOT NULL,
    wallet_address TEXT NOT NULL,
    producer_name TEXT NOT NULL,
    issued_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    consumed BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_spi_challenges_expiry ON spi_challenges(expires_at, consumed);

-- Webhook delivery tracking (Phase 3)
CREATE TABLE spi_webhook_deliveries (
    delivery_id TEXT PRIMARY KEY,
    outcome_id TEXT NOT NULL,
    producer_id TEXT NOT NULL,
    callback_url TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    attempts INTEGER DEFAULT 0,
    last_attempt_at TEXT,
    next_retry_at TEXT,
    delivered_at TEXT,
    created_at TEXT NOT NULL
);

CREATE INDEX idx_spi_webhook_status ON spi_webhook_deliveries(status, next_retry_at);
```

---

## 5. Event Types (Revised Framing)

New event types are explicitly protocol/lifecycle events, not domain signal events:

```python
# Protocol events — SPI submission flow
SIGNAL_SPI_ACCEPTED_V1 = "signal.spi.accepted.v1"
SIGNAL_SPI_REJECTED_V1 = "signal.spi.rejected.v1"
ATTRIBUTION_OUTCOME_V1 = "attribution.outcome.v1"
PRODUCER_LIFECYCLE_V1 = "producer.lifecycle.v1"
PRODUCER_REGISTERED_V1 = "producer.registered.v1"
```

These are distinct from domain signal events. External producers still emit `SIGNAL_TRADFI_V1` or `SIGNAL_EVENTS_V1` through the adapter path. The protocol events track what happened to that signal inside the SPI system — acceptance, resolution, scoring.

---

## 6. Domain Decision: Frozen

post-fiat-signals registers as `domain="tradfi"` and emits `SIGNAL_TRADFI_V1`.

This matches sendoeth's existing regime_scanner_producer.py which already shipped with this domain choice. Overriding it creates unnecessary friction.

The adapter framework is domain-agnostic — future external producers choose their domain during registration.

---

## 7. Revised Critical Path

```
Phase 1A (1-2w): Adapter framework + post-fiat-signals producer
        │
        └──→ Phase 1B (1-2w): Admission pipeline + thin resolver + karma
                │
                ├──→ Phase 2A (2-3w): SPI gateway MVP (calls same admission pipeline)
                │         │
                │         └──→ Phase 2B (1-2w): Lifecycle + quota hardening
                │
                └──→ Golden path test proves coherence
                          │
                          └──→ Phase 3 (2-3w): Robustness + second producer
                                    │
                                    └──→ Phase 4 (1-2w): Operator polish
```

**Total critical path:** ~8–10 weeks with parallelization.

The fork point is after Phase 1B. Once the admission pipeline and thin resolver work, the gateway (2A) and lifecycle (2B) can develop in parallel because they both call the same internal services.

---

## 8. Golden Path Acceptance Test

This is the single most important test in the system.

```python
def test_golden_path():
    """
    Both ingress paths produce identical internal outcomes.

    1. Register a producer via SPI gateway
    2. Submit one signal through SPI native path
    3. Submit one equivalent signal through adapter path
    4. Both become AcceptedSignal records in spi_signals
    5. Both resolve after attribution window
    6. Both emit AttributionOutcome events
    7. Karma updates correctly for both
    8. Producer state is inspectable and consistent
    9. No manual DB surgery required
    """
    # Setup: register producer
    producer = register_test_producer(wallet="0xtest...", name="golden-test")

    # Path A: SPI native submission
    native_signal = submit_via_gateway(
        producer_id=producer.producer_id,
        symbol="BTC-USD",
        direction="bullish",
        confidence=0.75,
        horizon_hours=24,
    )

    # Path B: Adapter submission
    adapter_signal = submit_via_adapter(
        producer_name="golden-test",
        symbol="ETH-USD",
        direction="bullish",
        confidence=0.80,
        horizon_hours=24,
    )

    # Both should be AcceptedSignal records
    assert native_signal.status == "accepted"
    assert adapter_signal.status == "accepted"
    assert type(native_signal) == type(adapter_signal)  # same model

    # Simulate time passing + price movement
    mock_price_feed({"BTC-USD": (+5.0), "ETH-USD": (+3.0)})  # both correct

    # Run resolver
    outcomes = resolve_expired_signals()
    assert len(outcomes) == 2

    # Both should have outcomes with karma impact
    for outcome in outcomes:
        assert outcome.status == "resolved"
        assert outcome.direction_correct == True
        assert outcome.brier_component is not None
        assert outcome.karma_delta > 0

    # Producer state should reflect both
    state = get_producer_state(producer.producer_id)
    assert state.running_karma > 0.50  # improved from initial

    # No manual DB surgery
    assert count_orphaned_signals() == 0
    assert count_unresolved_past_window() == 0
```

If this test passes, the system is coherent.

---

## 9. First Week Checklist

If starting tomorrow:

1. Create `feat/spi` branch from develop
2. Create `engine/external/models.py` — ExternalObservation, RawExternalRecord
3. Create `engine/external/spec.py` — YAML spec loader
4. Create `engine/external/connector_http.py` — HTTP polling
5. Create `engine/external/confidence.py` — hit_rate normalization
6. Create `engine/external/policy.py` — stale/halt/min-confidence
7. Create `engine/external/base.py` — BaseExternalProducer(BaseProducer)
8. Create `engine/external/specs/post_fiat_signals.yaml`
9. Create `engine/producers/post_fiat_signals.py` — @register("post-fiat-signals", domain="tradfi")
10. Run against post-fiat-signals mock server
11. Verify in producer_health and dashboard

Then immediately start `engine/spi/admission.py` and `engine/spi/scoring.py` — the shared internal pipeline that everything else depends on.

---

*Published by Zoz via the Permanent Upper Class validator operation.*  
*Task completed for the Post Fiat Network.*
