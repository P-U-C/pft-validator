---
layout: default
title: "b1e55ed Standard Producer Interface (SPI) v1.0"
date: 2026-03-16
category: specification
status: published
---

# b1e55ed Standard Producer Interface (SPI) v1.0

Open attribution protocol for external signal producers

**Status:** Draft for implementation  
**Version:** 1.0.0  
**Date:** 16 March 2026  
**Author:** Permanent Upper Class  
**Repository:** P-U-C/b1e55ed  
**Intended audience:** External producer teams, gateway implementers, attribution-engine maintainers, protocol reviewers

---

## Normative Language

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in RFC 2119.

---

## 0. Design Stance

This specification is designed around five principles.

**Identity before throughput.** A producer MUST prove who controls the producing identity before it can submit network-relevant signals. No anonymous submission is accepted, because attribution without identity is meaningless.

**Attribution before prestige.** Signals are not accepted because a producer is well-known, well-capitalized, or internally connected. They are accepted, scored, and promoted through measurable downstream performance and policy compliance. The only currency that compounds is calibrated accuracy.

**Bounded openness.** The interface is open to new producers, but not permissionless in the naive sense. Stake, karma, quotas, and lifecycle gates exist to resist spam, sybil flooding, and low-effort extraction. The cost of participation is real but proportionate.

**Transport pragmatism.** SPI v1 uses JSON over HTTPS as the canonical wire format. Binary bindings such as Protobuf MAY be added in future versions, but JSON is the normative encoding for all v1 implementations. This maximizes adoption surface at the cost of payload density — a trade the protocol makes deliberately, because partner friction matters more than byte efficiency at this stage.

**Adapter compatibility.** A producer MAY participate natively through SPI, or through an adapter-mediated path in which b1e55ed ingests that producer's existing API and mints SPI-equivalent internal records. Adapter mode is a valid bootstrap path, not a second-class integration. Both ingress modes converge into the same internal attribution core.

---

## 1. Scope

### 1.1 What the SPI Defines

The Standard Producer Interface specifies:

- Producer identity binding and wallet-signature authentication
- Producer registration and credential issuance
- Canonical message schemas for signal submission, acknowledgment, and attribution outcome
- Signal submission semantics including validation, idempotency, and batch handling
- Producer lifecycle states and deterministic transition triggers
- Quota and rate-limit mechanics tiered by lifecycle state
- Stake and karma activation requirements
- Attribution outcome resolution and delivery
- Adapter-mediated participation rules and submission equivalence
- Security considerations and anti-gaming defenses

### 1.2 What the SPI Does Not Define

The SPI does not specify:

- How b1e55ed internally synthesizes signals into portfolio conviction
- How the brain cycle, domain weights, or execution logic operate
- How the kill switch or operator-level controls function
- How consumers access oracle outputs
- Token distribution, governance, or pricing mechanics (these belong to the tokenomics specification)
- How any specific producer's internal model or decision logic should work
- Slashing contract implementation details beyond the interface commitments
- Cross-chain custody architecture for stake

### 1.3 Integration Modes

SPI supports two distinct ingress paths. Both produce identical internal outcomes.

**Mode A — Push / Native SPI.** The producer authenticates directly, submits signals through the SPI gateway, and receives acknowledgments and attribution outcomes in real time. This is the canonical path for network-native producers.

**Mode B — Pull / Adapter-Mediated.** b1e55ed operates an adapter that polls an external producer's existing API surface and translates responses into SPI-equivalent internal events. The external producer does not implement the SPI directly. Instead, b1e55ed builds and maintains the ingestion layer.

Mode A is the long-term standard. Mode B is the bootstrap path — it allows producers to participate before they have implemented the full native protocol. Any adapter-mediated producer MAY later migrate to native SPI participation.

Normatively: adapter-mediated producers MUST be mappable onto the same logical producer model as native SPI producers. This means they MUST have a registered producer identity, lifecycle state, quota tier, stake and karma accounting, and canonical attribution outcomes — even though the transport layer is operated by b1e55ed rather than the producer.

---

## 2. Terminology

**Producer.** Any external system, agent, or individual that submits directional market signals to the b1e55ed attribution network. A producer is identified by a wallet-bound cryptographic identity.

**Signal.** A structured assertion about a market instrument's expected direction, magnitude, and/or regime context, submitted with a confidence level and evaluation horizon.

**Conviction.** A signal that includes a directional claim (bullish/bearish), a confidence level, a magnitude bucket, and a horizon. Convictions are the primary unit of producer contribution.

**Submission.** A single API call delivering one or more signals from an authenticated producer.

**Acknowledgment.** The network's immediate response to a submission, confirming receipt, validation status, and acceptance or rejection of each signal.

**Attribution Outcome.** The resolved result of a previously accepted signal, including whether the directional claim was correct, the scoring delta, the karma delta, and any staking consequences.

**Karma.** A reputation score that reflects a producer's historical calibration quality. Karma is earned through accurate, well-calibrated convictions and lost through persistent inaccuracy or gaming. Karma is the primary input to producer weighting and lifecycle transitions.

**Stake.** An economic bond that a producer must post to achieve active status. Stake creates skin-in-the-game and is subject to slashing for persistent miscalibration. The stake asset, minimum amounts, and slashing parameters are governance-controlled.

**The Forge.** b1e55ed's identity primitive. A vanity address grinder that produces a 0xb1e55ed-prefixed Ethereum address, bound to a persistent, non-transferable key pair with an on-chain EAS attestation. The Forge attestation is the cost of entry and the anchor of identity persistence.

**Epoch.** A discrete evaluation period (default: 1 week) during which convictions are submitted, evaluated, and scored. Karma updates and emission calculations occur at epoch boundaries.

**Gateway.** The SPI-compliant API server that accepts producer submissions, issues acknowledgments, and delivers attribution outcomes.

**Lifecycle State.** The current participation status of a producer within the network: onboarding, probationary, active, or suspended.

**Control Graph.** The identity and authorization structure associated with a producer. In v1, this is a single wallet identity plus optional delegates. In later versions it MAY include multisig approval, organizational attestations, and operator roles.

**Adapter-Mediated Producer.** A producer whose source interface is polled or wrapped by b1e55ed, with the adapter acting as the transport bridge into SPI-equivalent internal flows.

---

## 3. System Model

SPI assumes a logical architecture with the following roles:

- **Producer Client** — external system implementing SPI directly, or existing API consumed by an adapter
- **Wallet Signer** — wallet or signing agent controlling the producer identity
- **SPI Gateway** — public ingress service that authenticates producers and validates submissions
- **Identity Registry** — service storing producer identity, credentials, lifecycle state, and quotas
- **Attribution Engine** — service that accepts, tracks, resolves, and scores signals
- **Outcome Delivery Service** — service that exposes or pushes attribution results
- **Adapter Bridge** — optional compatibility layer for non-native producers

---

## 4. Versioning and Compatibility

SPI messages MUST include a `schema_version` field. For v1, the canonical value is `"spi.v1"`.

The gateway MUST reject messages with an unknown major version. Minor fields MAY be added as optional extensions without breaking compatibility.

Gateways MUST ignore unknown fields in submissions (forward compatibility). Producers MUST ignore unknown fields in responses.

All endpoints are versioned under `/v1/`. When a future major version is released, the previous major version MUST remain supported for a minimum of 6 months. Deprecation warnings SHOULD be included in response headers.

---

## 5. Identity and Authentication

### 5.1 Identity Model

Each producer MUST bind to at least one wallet-controlled identity. A producer MAY later attach delegated API keys, rotating credentials, or subordinate operator credentials, but the root identity in v1 is wallet-based.

Minimum identity fields:

- `wallet_address` — the cryptographic address controlling the producer identity
- `wallet_scheme` — the signing scheme used (v1 MUST support at least `eip191`; future versions MAY add `eip712`, `xrpl`, or other schemes)
- `producer_name` — human-readable identifier
- `control_graph` — identity and authorization structure (root wallet, delegates, multisig status)
- `callback_url` (optional) — endpoint for webhook outcome delivery
- `organization_name` (optional) — organizational affiliation

In the b1e55ed reference implementation, the recommended identity path is the Forge: a vanity address grinder producing a 0xb1e55ed-prefixed Ethereum address with an on-chain EAS attestation on Base mainnet. The Forge attestation is not KYC — it is cryptographic proof that a producer identity is bound to a persistent key pair with a computational cost of creation. A producer who accumulates bad karma cannot register a new wallet and start fresh; identity persistence is the anti-sybil mechanism.

However, the SPI protocol itself does not mandate the Forge. Any wallet-controlled identity satisfying the authentication handshake is valid.

### 5.2 Authentication Handshake

Authentication uses a wallet-signature challenge-response protocol. No passwords, API keys, or OAuth flows are involved. The producer proves control of their wallet by signing a server-issued challenge.

The handshake MUST prove:

- The producer controls the stated wallet
- The challenge is fresh and replay-resistant
- The producer intended to register for SPI participation
- The producer is bound to a specific `producer_name` and requested configuration
- The system can issue a credential tied to that identity

### 5.3 Handshake Flow

```
Producer Client          Wallet Signer          SPI Gateway          Identity Registry
      |                       |                       |                       |
      |-- request challenge -------------------->|                       |
      |<---------------- challenge -----------------|                       |
      |-- sign challenge -->|                       |                       |
      |<-- signature -------|                       |                       |
      |-- register signed challenge ------------->|---- verify/store -->|
      |<----------- producer_id + credential -----|<--------------------|
      |                       |                       |                       |
      |-- submit SignalSubmission ---------------->|---- validate ------>|
      |<------------- SignalAcknowledgment --------|                       |
      |                       |                       |                       |
      |<---------- AttributionOutcome (poll or webhook) -----------------|
```

### 5.4 Challenge Request

```
POST /v1/producers/challenge
Content-Type: application/json

{
  "schema_version": "spi.v1",
  "wallet_address": "0xb1e55edA3F...",
  "wallet_scheme": "eip191",
  "producer_name": "post-fiat-signals",
  "organization_name": "Post Fiat Signals",
  "callback_url": "https://producer.example.com/spi/outcomes",
  "requested_mode": "native",
  "control_graph": {
    "root_wallet": "0xb1e55edA3F...",
    "delegates": [],
    "multisig": null
  },
  "metadata": {
    "system_description": "Regime-aware semi-crypto divergence engine",
    "source_repo": "https://github.com/sendoeth/post-fiat-signals"
  }
}
```

Response (200):

```json
{
  "schema_version": "spi.v1",
  "challenge_id": "chl_01J...",
  "nonce": "4fdfc6f0-...",
  "challenge_text": "b1e55ed SPI registration challenge for producer post-fiat-signals. Nonce: 4fdfc6f0-... Expires: 2026-03-16T17:25:00Z",
  "issued_at": "2026-03-16T17:20:00Z",
  "expires_at": "2026-03-16T17:25:00Z",
  "domain": "spi.b1e55ed.network",
  "requested_bindings": {
    "producer_name": "post-fiat-signals",
    "requested_mode": "native"
  }
}
```

The challenge MUST expire within 5 minutes. The nonce MUST NOT be reusable. Expired or reused challenge IDs MUST be rejected.

### 5.5 Registration Request

After signing the challenge text with the wallet specified:

```
POST /v1/producers/register
Content-Type: application/json

{
  "schema_version": "spi.v1",
  "challenge_id": "chl_01J...",
  "wallet_address": "0xb1e55edA3F...",
  "wallet_scheme": "eip191",
  "producer_name": "post-fiat-signals",
  "requested_mode": "native",
  "signature": "0x...",
  "callback_url": "https://producer.example.com/spi/outcomes",
  "control_graph": {
    "root_wallet": "0xb1e55edA3F...",
    "delegates": [],
    "multisig": null
  },
  "capabilities": [
    "has_directional_signals",
    "has_regime_context",
    "has_confidence_metrics",
    "has_health_status",
    "has_freshness_metadata"
  ],
  "preferred_attribution": {
    "display_name": "Post Fiat Signals",
    "logo_url": "https://...",
    "repo_url": "https://github.com/sendoeth/post-fiat-signals"
  }
}
```

Response (200):

```json
{
  "schema_version": "spi.v1",
  "producer_id": "prd_01J...",
  "producer_name": "post-fiat-signals",
  "lifecycle_state": "onboarding",
  "auth_credential": {
    "credential_id": "cred_01J...",
    "token_type": "bearer",
    "token": "spi_live_...",
    "issued_at": "2026-03-16T17:21:03Z",
    "expires_at": "2026-06-14T17:21:03Z",
    "permissions": ["signal.submit", "signal.read", "outcome.read", "outcome.webhook"]
  },
  "stake_requirements": {
    "minimum_activation_stake": "governance_defined",
    "asset": "governance_defined",
    "status": "not_met"
  },
  "quota": {
    "tier": "onboarding",
    "signals_per_hour": 0,
    "signals_per_day": 5,
    "burst": 1,
    "mode": "sandbox_only"
  }
}
```

### 5.6 Credential Rules

Bearer credentials MUST be:

- Scoped to a single `producer_id` and environment
- Rotatable via `POST /v1/producers/{producer_id}/rotate-credential`
- Revocable upon compromise
- Expired after a gateway-defined period (RECOMMENDED: 90 days)

The credential does not replace wallet signatures for critical operations (stake changes, key rotation, lifecycle transitions). It is a session convenience for routine signal submission.

Minimum permissions: `signal.submit`, `signal.read`, `outcome.read`. Optional: `outcome.webhook`, `producer.rotate_key`.

### 5.7 Authentication Error Responses

| HTTP Status | Error Code | Meaning |
|---|---|---|
| 400 | INVALID_WALLET | Address does not satisfy identity requirements |
| 400 | NONCE_EXPIRED | Challenge nonce has expired |
| 400 | NONCE_REUSED | Challenge nonce was already consumed |
| 400 | UNSUPPORTED_WALLET_SCHEME | wallet_scheme not supported in this version |
| 401 | SIGNATURE_INVALID | Signature does not match wallet address |
| 403 | ATTESTATION_MISSING | No valid identity attestation found (Forge or equivalent) |
| 409 | PRODUCER_EXISTS | Wallet address already registered |
| 429 | RATE_LIMITED | Too many challenge requests |

### 5.8 Adapter-Mediated Identity

In adapter mode, the producer SHOULD still complete identity binding even if direct submission is not yet enabled. The adapter bridge MUST bind internal submission records to the registered `producer_id`.

If a producer migrates from adapter to native SPI, karma earned during adapter participation transfers if the wallet identity is the same.

---

## 6. Producer Lifecycle

### 6.1 State Machine

Every producer exists in exactly one of four lifecycle states. Transitions are triggered by specific conditions — not by operator discretion.

```
┌──────────────┐
│  Onboarding  │
└──────┬───────┘
       │ identity valid + minimum stake posted
       │ + authorization gate passed
       ▼
┌──────────────┐
│ Probationary │◄────────────────────────────┐
└──────┬───────┘                             │
       │ karma ≥ threshold                   │
       │ + min resolved outcomes             │
       │ + rejection rate < ceiling          │
       │ + stake maintained                  │
       ▼                                     │
┌──────────────┐                             │
│    Active    │─────────────────────────────┤
└──────┬───────┘                             │
       │ karma < floor, OR stake < min       │
       │ OR abuse, OR liveness failure       │
       ▼                                     │
┌──────────────┐                             │
│  Suspended   │─────────────────────────────┘
└──────────────┘   (remediation → probationary)
```

### 6.2 Onboarding

**Entry:** Successful registration (challenge/response completed).

**Permissions:** Sandbox submissions only. Zero live throughput. May inspect status, rotate credentials, deposit stake.

**Exit to Probationary:** All of the following MUST be satisfied:

- Valid identity with non-expired credential
- Minimum onboarding stake posted (governance-defined)
- Authorization gate passes minimum activation criteria
- At least 1 successful sandbox submission validated
- No outstanding suspension flags

### 6.3 Probationary

**Entry:** Onboarding requirements met.

**Permissions:** Live signals under restricted quota. Attribution outcomes delivered. Signals participate in synthesis at reduced weight (RECOMMENDED: 0.25× active weight). Karma accumulation begins. Close monitoring of acceptance quality.

**Recommended quota:** 5 submissions/hour, 25/day, burst 2, batch max 5.

**Exit to Active:** All of the following MUST be satisfied:

- Minimum resolved signal count (governance-defined; RECOMMENDED: ≥ 50)
- Minimum karma threshold (governance-defined)
- Rejection/error rate below threshold (governance-defined; RECOMMENDED: < 5%)
- Stake remains above required level
- No current compliance or abuse flags

### 6.4 Active

**Entry:** Probationary graduation conditions met.

**Permissions:** Full submission quota. Full attribution participation. Standard synthesis weight. Eligible for emission rewards. May delegate submission authority. Eligible for tier scaling based on sustained performance.

**Recommended quota:** 60 submissions/hour, 500/day, burst 10, batch max 25.

**Exit to Suspended:** Triggered by any of:

- Stake below active maintenance floor
- Karma below active maintenance floor
- Liveness failure: 0 convictions for 2 consecutive epochs
- Abuse detection: cross-producer correlation threshold triggered (RECOMMENDED: 0.85 across conviction vectors, 4-epoch lookback)
- Repeated invalid or malicious submissions (RECOMMENDED: 3+ malformed per epoch)
- Key compromise or identity integrity failure
- Governance enforcement action

### 6.5 Suspended

**Entry:** Any exit condition from Active or Probationary.

**Permissions:** Zero live throughput. Outcomes for prior accepted signals continue to resolve. Credential remains readable for status access but MUST NOT permit new live submissions. May submit sandbox signals for testing.

**Exit:** A suspended producer MAY return to probationary after remediation. Recovery SHOULD pass through probationary, not skip directly to active.

Specific remediation depends on trigger:

- If karma-triggered: karma recovers above remediation threshold through outstanding resolutions
- If stake-triggered: additional stake deposited to meet minimum
- If liveness-triggered: successful sandbox submission demonstrating operational readiness
- If abuse-triggered: review period (RECOMMENDED: 4 epochs) + correlation drops below threshold
- If credential-triggered: credential rotated, review passed

A suspended producer who remains suspended for a governance-defined period (RECOMMENDED: 12 consecutive epochs) without remediation is deregistered. Karma is preserved for re-entry through a fresh onboarding cycle.

### 6.6 State Transition Table

| From | To | Trigger |
|---|---|---|
| onboarding | probationary | Identity valid, minimum stake met, authorization gate passed |
| probationary | active | Minimum karma met, minimum resolved outcomes, acceptable error rate, stake maintained |
| active | suspended | Stake floor breach, karma floor breach, abuse, liveness failure, compromised identity |
| probationary | suspended | Spam, malformed flooding, fraud, repeated invalid submissions |
| suspended | probationary | Remediation complete, credential rotated if needed, review passed |

---

## 7. Stake and Karma Mechanics

### 7.1 Why Both Are Required

Stake alone is insufficient because a wealthy spammer can bond capital and flood the system. Karma alone is insufficient because a new producer has no earned history.

Therefore activation uses two orthogonal mechanisms:

- **Stake** — economic anti-spam bond, slashable for persistent miscalibration
- **Karma** — earned trust through outcome quality and protocol integrity

### 7.2 Staking

Minimum stake amounts are governance-controlled parameters. SPI v1 defines the categories; the network exposes current values through the requirements endpoint.

| Tier | Required Stake | Status |
|---|---|---|
| Onboarding | None for registration; minimum for activation | Governance-defined |
| Probationary | minimum_probationary_stake | Governance-defined |
| Active | minimum_active_stake | Governance-defined |

**Stake deposit:** Producer calls the staking contract from their registered wallet or an authorized delegate.

**Unstaking cooldown:** Governance-defined (RECOMMENDED: 4 epochs / ~1 month). When a producer initiates unstaking, their stake remains locked and at-risk for the cooldown period. Karma changes and slashing apply normally during cooldown.

**Emergency exit:** A producer MAY forfeit a governance-defined percentage (RECOMMENDED: 5%) of their stake to exit immediately without cooldown.

**Partial unstaking:** Permitted above the active minimum. The cooldown applies to the unstaked portion only.

### 7.3 Slashing

Slashing conditions are governance-defined. The SPI requires:

- Slashing MUST be triggered by objective, auditable conditions (e.g., epoch-level Brier score exceeding a threshold)
- Slashing MUST NOT exceed a governance-defined maximum per epoch (RECOMMENDED: 10% of current stake)
- Slashing does not trigger immediate suspension unless stake drops below the active minimum as a result
- Slash distribution SHOULD follow a governance-defined split (RECOMMENDED: 60% protocol reserve, 40% unissued supply)

### 7.4 Karma

Karma is a reputation score on the range [0.0, 1.0] reflecting calibration quality.

**Karma update rule (reference implementation):**

At each epoch boundary, for each resolved conviction:

```
brier_component = (confidence - outcome)²
```

Where outcome is 1.0 if the directional claim was correct and 0.0 otherwise.

```
epoch_karma = 1.0 - mean(brier_components)
karma_new = (smoothing_factor × karma_old) + ((1 - smoothing_factor) × epoch_karma)
```

RECOMMENDED smoothing factor: 0.7. Initial karma: 0.50 (neutral). Karma floor: 0.0. Karma ceiling: 1.0.

The network MUST expose karma via the producer status endpoint. Producers MUST be able to inspect their karma history and per-signal scoring details.

### 7.5 Effective Weight

A producer's influence in synthesis is determined by:

```
effective_weight = effective_stake × karma³
```

Where `effective_stake = min(actual_stake, cap_multiple × median_stake)`.

The stake cap (RECOMMENDED: 3× median) prevents capital dominance. Cubic karma weighting ensures that reputation dominates capital.

### 7.6 Normative Requirements Endpoint

The network MUST expose current activation requirements for a producer's current and next tier:

```
GET /v1/producers/{producer_id}/requirements

{
  "producer_id": "prd_01J...",
  "lifecycle_state": "probationary",
  "requirements": {
    "current_tier": {
      "stake_minimum": "1000",
      "karma_minimum": null,
      "maintenance": "stake must remain above minimum"
    },
    "next_tier": {
      "stake_minimum": "5000",
      "karma_minimum": 0.40,
      "resolved_signals_minimum": 50,
      "max_rejection_rate": 0.05
    }
  },
  "governance_effective_at": "2026-03-01T00:00:00Z"
}
```

Parameters MUST NOT remain implicit. Producers MUST be able to inspect what they need to achieve before achieving it.

---

## 8. Wire Format Schemas

### 8.1 Encoding

All messages use JSON encoding with UTF-8 character set. Content-Type MUST be `application/json`.

Timestamps MUST use RFC 3339 format with UTC timezone: `2026-03-16T20:00:00Z`.

Numeric values MUST use JSON number type (not string-encoded numbers).

Confidence values MUST be in the range [0.0, 1.0]. Values outside this range MUST be rejected.

Note: the reference implementation's conviction system operates within [0.55, 0.99] for Brier-scoring purposes, but the wire format accepts the full probability range to avoid coupling protocol constraints to application-layer policy.

### 8.2 Core Message Types

SPI v1 defines three normative message types and two supplementary types:

| Type | Direction | Purpose |
|---|---|---|
| SignalSubmission | Producer → Gateway | Submit signals for attribution |
| SignalAcknowledgment | Gateway → Producer | Confirm receipt, validation, acceptance/rejection |
| AttributionOutcome | Gateway → Producer | Report resolved signal results and scoring |
| AuthChallenge | Gateway → Producer | Issued during authentication handshake |
| ProducerCredential | Gateway → Producer | Issued after registration or credential refresh |

### 8.3 SignalSubmission

```json
{
  "schema_version": "spi.v1",
  "submission_id": "sub_01J7Y...",
  "producer_id": "prd_01J6X...",
  "submitted_at": "2026-03-16T18:05:00Z",
  "mode": "live",
  "idempotency_key": "sub_01J7Y...",
  "signals": [
    {
      "signal_client_id": "sig_client_0001",
      "signal_type": "directional",
      "instrument": {
        "symbol": "BTC-USD",
        "venue": null,
        "asset_class": "crypto"
      },
      "claim": {
        "direction": "bullish",
        "confidence": 0.78,
        "magnitude": "medium",
        "horizon": "168h",
        "thesis": "NEUTRAL regime + CRYPTO_LEADS: 82% hit rate, +8.24% avg 14d return. BTC breaking resistance with declining exchange reserves.",
        "source_assertion": "EXECUTE"
      },
      "regime_context": {
        "regime": "NEUTRAL",
        "signal_type": "CRYPTO_LEADS",
        "regime_filter": "ACTIONABLE"
      },
      "quality_metadata": {
        "hit_rate": 0.82,
        "avg_return": 0.0824,
        "reliability_decay": false,
        "data_age_sec": 45,
        "is_stale": false
      },
      "source_metadata": {
        "source_system": "post-fiat-signals",
        "source_endpoint": "/signals/filtered",
        "source_schema_version": "v1.1.0"
      },
      "evidence_refs": [
        "ipfs://Qm...",
        "https://github.com/sendoeth/post-fiat-signals/blob/main/ALPHA_REPORT.md"
      ],
      "tags": ["regime_signal", "crypto_leads", "backtested"],
      "observed_at": "2026-03-16T18:04:30Z",
      "expires_at": "2026-03-23T18:04:30Z"
    }
  ],
  "health_status": {
    "system_state": "HEALTHY",
    "components": {
      "regime_engine": "HEALTHY",
      "granger_pipeline": "HEALTHY",
      "circuit_breaker": "HEALTHY"
    }
  },
  "auth": {
    "credential_id": "cred_01J...",
    "signature": null
  }
}
```

**Required fields per signal:**

| Field | Type | Constraints | Description |
|---|---|---|---|
| signal_client_id | string | Unique within submission | Producer-generated idempotency key |
| instrument.symbol | string | Non-empty | Instrument identifier (e.g., "BTC-USD") |
| claim.direction | enum | bullish / bearish / neutral | Directional claim |
| claim.confidence | float | [0.0, 1.0] | Probability assigned to the directional claim |
| claim.horizon | string | Parseable duration (e.g., "24h", "168h") | Evaluation window. Minimum 4h, maximum 2160h (90 days) |
| observed_at | RFC 3339 | Valid timestamp | When the producer generated this signal |
| expires_at | RFC 3339 | Must be after observed_at | Signal expiry |

**Optional fields per signal:**

| Field | Type | Description |
|---|---|---|
| claim.magnitude | enum | "low", "medium", "high", "extreme" |
| claim.thesis | string | Human/agent-readable rationale (max 2000 chars) |
| claim.source_assertion | string | Producer-native action label (e.g., "EXECUTE", "WAIT") |
| regime_context | object | Source-native regime/context data (preserved as source truth) |
| quality_metadata | object | Hit rates, avg returns, decay status, freshness |
| source_metadata | object | Origin system, endpoint, schema version |
| evidence_refs | array[string] | IPFS hashes, URLs, or other evidence pointers |
| tags | array[string] | Freeform classification tags |

**Submission-level required fields:**

| Field | Type | Description |
|---|---|---|
| schema_version | string | Must be "spi.v1" |
| submission_id | string | Unique per producer within replay window |
| producer_id | string | Must match credential |
| submitted_at | RFC 3339 | Submission timestamp |
| mode | enum | "live" or "sandbox" |
| signals | array | 1 to batch maximum signals |

**Submission-level optional fields:**

| Field | Type | Description |
|---|---|---|
| idempotency_key | string | Alias for submission_id for dedup |
| health_status | object | Current producer system health |
| auth | object | Credential reference and/or signature |

### 8.4 SignalAcknowledgment

```json
{
  "schema_version": "spi.v1",
  "ack_id": "ack_01J7Z...",
  "submission_id": "sub_01J7Y...",
  "producer_id": "prd_01J6X...",
  "received_at": "2026-03-16T18:05:01Z",
  "status": "accepted",
  "accepted_count": 1,
  "rejected_count": 0,
  "results": [
    {
      "signal_client_id": "sig_client_0001",
      "status": "accepted",
      "signal_id": "sig_01J7Z9...",
      "reason_code": null,
      "reason_detail": null,
      "attribution_window": {
        "start": "2026-03-16T18:05:01Z",
        "end": "2026-03-23T18:05:01Z"
      },
      "synthesis_weight": 0.25,
      "dedupe_status": "new"
    }
  ],
  "producer_state": {
    "lifecycle_state": "probationary",
    "quota_tier": "probationary",
    "karma": 0.52,
    "quota_remaining_hour": 4,
    "quota_remaining_day": 24
  }
}
```

**Submission-level status values:**

| Status | Meaning |
|---|---|
| accepted | All signals accepted |
| partially_accepted | Some accepted, some rejected |
| rejected | All signals rejected |
| deferred | Submission queued for later processing |

**Per-signal status values:**

| Status | Meaning |
|---|---|
| accepted | Validated, assigned network signal ID, entering attribution window |
| rejected | Failed validation (includes reason_code and reason_detail) |
| duplicate | Signal ID already submitted; original preserved, no new attribution |
| deferred | Signal queued for later evaluation |

**Batch atomicity:** Submissions are NOT atomic. Each signal within a submission is evaluated independently. Partial acceptance is the norm, not the exception.

### 8.5 AttributionOutcome

```json
{
  "schema_version": "spi.v1",
  "outcome_id": "out_01J90...",
  "signal_id": "sig_01J7Z9...",
  "signal_client_id": "sig_client_0001",
  "submission_id": "sub_01J7Y...",
  "producer_id": "prd_01J6X...",
  "resolved_at": "2026-03-23T18:06:02Z",
  "status": "resolved",
  "outcome_label": "correct",
  "resolution": {
    "direction_correct": true,
    "entry_price": 84250.00,
    "exit_price": 91340.00,
    "price_change_pct": 8.42,
    "method": "twap_4h",
    "horizon_used": "168h",
    "price_feed": "chainlink_btc_usd",
    "ground_truth_ref": "gt_01J..."
  },
  "scoring": {
    "brier_component": 0.0484,
    "score_delta": 3.2,
    "karma_delta": 0.038,
    "karma_new": 0.558,
    "calibration_quality": "well_calibrated",
    "conviction_weight_used": 0.25,
    "synthesis_contribution": 0.067,
    "weight_eligible_next_epoch": true
  },
  "staking": {
    "slash_applied": false,
    "slash_amount": 0,
    "stake_remaining": "1000",
    "emission_earned": "2.4"
  },
  "attribution": {
    "chain_hash": "sha256:...",
    "event_id": "evt_...",
    "provenance_url": "https://oracle.b1e55ed.permanentupperclass.com/attribution/out_01J90..."
  },
  "producer_state_after": {
    "lifecycle_state": "probationary",
    "karma": 0.558,
    "stake_status": "met"
  }
}
```

**Outcome status values:**

| Status | Meaning |
|---|---|
| resolved | Attribution window closed; outcome determined from price feeds |
| cancelled | Signal cancelled before window close (producer or system initiated) |
| invalidated | Price feed unavailable/unreliable; no karma impact |
| expired | Attribution window closed with insufficient data; no karma impact |

**Resolution method:**

- `twap_4h` — Time-weighted average price over 4-hour window at resolution point (default; resists manipulation)
- `spot` — Spot price at exact resolution timestamp (fallback when TWAP unavailable)
- `market_close_plus_horizon` — Close price at horizon expiry (for traditional instruments)

**Attribution chain:** Every accepted signal and resolved outcome is written to b1e55ed's append-only event chain. The `chain_hash` links to the specific event, providing cryptographic proof that the signal was submitted at the claimed time, resolved against the claimed price feed, and scored correctly. External producers benefit from the same integrity guarantees as internal producers.

---

## 9. Submission Lifecycle

The logical lifecycle for an accepted signal:

```
SIGNAL_SUBMITTED → SIGNAL_RECEIVED → SIGNAL_ACCEPTED → ATTRIBUTION_PENDING → ATTRIBUTION_OUTCOME
```

Rejected path:

```
SIGNAL_SUBMITTED → SIGNAL_RECEIVED → SIGNAL_REJECTED
```

### 9.1 Idempotency

`submission_id` and `idempotency_key` MUST be honored within a replay window (RECOMMENDED: 7 days).

A duplicate submission with identical content MUST return the original acknowledgment with `dedupe_status: "duplicate"` rather than creating new signals.

If a `signal_client_id` within a new submission matches a previously accepted signal from the same producer, that individual signal is marked duplicate. Other signals in the submission are processed normally.

### 9.2 Signal Cancellation

A producer MAY cancel a previously submitted signal before its attribution window closes:

```
POST /v1/signals/cancel
Authorization: Bearer spi_live_...
Content-Type: application/json

{
  "signal_client_id": "sig_client_0001",
  "signal_id": "sig_01J7Z9...",
  "reason": "model_retrained"
}
```

Cancellation is karma-neutral — it neither helps nor hurts. But excessive cancellation (RECOMMENDED threshold: >30% of submissions in an epoch) triggers a review flag.

### 9.3 Clock Skew Tolerance

The gateway MUST accept submissions where `submitted_at` differs from the server's receipt time by up to 60 seconds in either direction.

Submissions with `submitted_at` more than 60 seconds in the future or more than 5 minutes in the past relative to server time SHOULD be flagged but MAY still be accepted with a warning in the acknowledgment.

The `observed_at` field on individual signals MAY differ more substantially from submission time, since a producer may batch signals observed over a window.

---

## 10. API Surface

### 10.1 Required Endpoints

| Method | Path | Purpose |
|---|---|---|
| POST | /v1/producers/challenge | Request authentication challenge |
| POST | /v1/producers/register | Register with signed challenge |
| GET | /v1/producers/{producer_id} | Producer status, metadata, credential status |
| POST | /v1/signals/submit | Submit signals |
| POST | /v1/signals/cancel | Cancel a signal before resolution |
| GET | /v1/signals/{signal_id} | Signal status and details |
| GET | /v1/outcomes/{signal_id} | Attribution outcome for a signal |
| GET | /v1/producers/{producer_id}/outcomes | Paginated outcomes for a producer |
| GET | /v1/producers/{producer_id}/quota | Current quota state |
| GET | /v1/producers/{producer_id}/requirements | Current and next-tier requirements |

### 10.2 Optional Endpoints

| Method | Path | Purpose |
|---|---|---|
| POST | /v1/producers/{producer_id}/rotate-credential | Rotate bearer token |
| POST | /v1/producers/{producer_id}/callback/verify | Verify webhook callback ownership |
| POST | /v1/sandbox/submit | Submit sandbox signals (any lifecycle state) |
| POST | /v1/webhooks/outcomes/test | Test webhook delivery |

### 10.3 Sandbox Mode

Producers in any lifecycle state MAY submit sandbox signals via `POST /v1/sandbox/submit` (or `POST /v1/signals/submit` with `"mode": "sandbox"`).

Sandbox submissions are validated identically to live submissions but:

- Do not enter synthesis
- Do not affect karma
- Do not consume live quota
- Return realistic acknowledgments for integration testing

---

## 11. Rate Limits and Quotas

### 11.1 Tiered Access

Quotas are bound to lifecycle state and optionally scaled by stake and karma.

| Parameter | Onboarding | Probationary | Active | Suspended |
|---|---|---|---|---|
| Live signals/hour | 0 | 5 | 60 | 0 |
| Sandbox signals/day | 5 | 10 | 20 | 5 |
| Daily submission cap | 0 live | 25 | 500 | 0 |
| Per-minute burst | — | 2 | 10 | — |
| Batch max | 1 | 5 | 25 | — |

These values are RECOMMENDED defaults, not fixed universal constants. The network MAY adjust them through governance.

### 11.2 Dynamic Scaling

The network MAY increase active-tier quotas based on karma above tier thresholds, stake above minimum, low rejection rate, and sustained calibration quality.

The network SHOULD decrease quotas when malformed request rate spikes, rejection rate exceeds policy thresholds, or abuse heuristics are triggered.

### 11.3 Rate Limit Headers

Every response MUST include:

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 58
X-RateLimit-Reset: 1710594000
X-RateLimit-Tier: active
```

### 11.4 Quota Violation Behavior

| Violation | Response | Consequence |
|---|---|---|
| Hourly limit exceeded | 429 with Retry-After | Submission dropped, no penalty |
| Burst limit exceeded | 429 with Retry-After | Submission dropped, no penalty |
| Daily limit exceeded | 429 with Retry-After | Warning logged |
| Persistent daily violation (3+ consecutive days) | 429 | Quota reduced by 50% for 1 epoch |
| Malformed submissions (3+ per epoch) | 400 | Suspension review triggered |

---

## 12. Error Codes and Rejection Reasons

### 12.1 HTTP Status Codes

| Code | Meaning |
|---|---|
| 200 | Success |
| 400 | Validation error |
| 401 | Authentication required or credential expired |
| 403 | Insufficient permissions for current lifecycle state |
| 404 | Resource not found |
| 409 | Conflict (duplicate submission_id, producer already exists) |
| 422 | Semantically invalid |
| 429 | Rate limited |
| 500 | Internal server error |
| 503 | Gateway temporarily unavailable |

### 12.2 Machine-Readable Reason Codes

The SPI MUST return machine-readable codes. Required set:

`unsupported_schema_version`, `invalid_json`, `invalid_signature`, `invalid_credential`, `credential_expired`, `producer_not_found`, `producer_state_disallows_submission`, `authorization_gate_failed`, `stake_requirement_not_met`, `karma_requirement_not_met`, `quota_exceeded`, `burst_exceeded`, `batch_too_large`, `duplicate_submission_id`, `duplicate_signal_client_id`, `invalid_confidence`, `invalid_instrument`, `invalid_horizon`, `expired_signal`, `malformed_signal`, `policy_restricted_symbol`, `callback_verification_failed`.

### 12.3 Error Response Format

```json
{
  "error": {
    "code": "invalid_confidence",
    "message": "Confidence must be between 0.0 and 1.0",
    "field": "signals[0].claim.confidence",
    "value": 1.5
  },
  "request_id": "req_...",
  "timestamp": "2026-03-16T20:00:00Z"
}
```

---

## 13. Attribution Outcome Delivery

### 13.1 Two Channels

**Pull:** `GET /v1/producers/{producer_id}/outcomes` or `GET /v1/outcomes/{signal_id}`.

**Push (webhook):** If the producer registered a `callback_url`, the gateway POSTs `AttributionOutcome` messages to that URL as outcomes resolve.

Pull MUST always exist as the fallback canonical retrieval path.

### 13.2 Webhook Delivery

```
POST {callback_url}
Content-Type: application/json
X-B1e55ed-Signature: sha256=...
X-B1e55ed-Delivery-Id: del_...
X-B1e55ed-Idempotency-Key: out_01J90...

{body: AttributionOutcome}
```

The signature header contains an HMAC-SHA256 of the request body, keyed with a shared secret established during registration. Producers SHOULD verify this signature.

**Retry policy:** Failed deliveries (non-2xx) retry with exponential backoff: 1 minute, 5 minutes, 30 minutes, 2 hours, 12 hours. After 5 failures, the delivery is marked failed and the outcome is available only via pull.

### 13.3 Callback Verification

Before enabling webhook delivery, the gateway MAY verify callback ownership via `POST /v1/producers/{producer_id}/callback/verify`, which sends a verification challenge to the callback URL. The producer must echo the challenge to confirm ownership.

---

## 14. Adapter-Mediated Participation

### 14.1 Rationale

Many external producers already have working APIs or signal services. Requiring every partner to reimplement native SPI before collaboration would slow network growth. SPI v1 recognizes adapter-mediated participation as a valid mode.

### 14.2 Rules

An adapter-mediated producer MUST still have: a registered `producer_id`, wallet-bound identity, lifecycle state, quota tier, stake and karma accounting, and attribution outcomes.

The adapter MAY perform: polling, payload translation, field normalization, confidence translation, callback bridging.

The adapter MUST NOT: fabricate producer identity, bypass quota policy, bypass lifecycle state, bypass attribution accounting.

### 14.3 Submission Equivalence

Internally, the system MUST mint SPI-equivalent submission records for adapter-ingested signals so that:

- The producer has a canonical submission history
- Outcomes can be returned consistently
- Native and adapter producers can be compared on equal footing

### 14.4 Adapter Metadata

Adapter-originated records MUST include:

- `ingress_mode: "adapter"`
- `adapter_id`: identifier of the adapter instance
- `source_endpoint`: which upstream endpoint was polled
- `source_payload_hash`: SHA-256 of the raw upstream payload
- `adapter_version`: version of the adapter code

### 14.5 Migration Path

An adapter-mediated producer MAY migrate to native SPI at any time by completing the authentication handshake, posting stake, and beginning direct submissions.

Karma earned during adapter participation transfers to the native SPI identity if the wallet address is the same.

---

## 15. Security Considerations

### 15.1 Transport Security

All SPI endpoints MUST be served over HTTPS (TLS 1.2+). HTTP MUST be rejected.

### 15.2 Signature Verification

Signal submissions SHOULD include a cryptographic signature. When present, the gateway MUST verify the signature against the registered wallet address before processing.

The signed payload MUST include `submission_id`, `producer_id`, `submitted_at`, and a hash of the signals array to prevent replay and tampering.

Bearer credential authentication is acceptable for routine submissions; wallet signatures are REQUIRED for critical operations (registration, key rotation, stake operations).

### 15.3 Replay Prevention

Challenge nonces MUST be single-use, cryptographically random (minimum 128 bits), and expire within 5 minutes.

Submission IDs MUST be deduplicated within the replay window.

### 15.4 Flood Resistance

Quotas, burst limits, and malformed-request penalties MUST be enforced before expensive downstream processing.

### 15.5 Evidence Abuse

The gateway SHOULD limit evidence ref count (RECOMMENDED: max 10 per signal) and payload size to avoid storage abuse.

### 15.6 Oracle Manipulation Defense

Producers with large positions in illiquid assets could theoretically move prices to validate their own convictions. Defenses:

- TWAP-based resolution (not spot price) as the default method
- Minimum evaluation window of 4 hours; flash loans cannot sustain directional moves
- Low-liquidity discount: assets with < $1M daily volume receive reduced karma weight (RECOMMENDED: 0.5×)
- Solo-signal cap: if a producer's conviction is the only signal on an asset AND resolution matches, karma gain is capped (RECOMMENDED: 0.5×)

### 15.7 Sybil Resistance

Two-factor defense:

- **Stake** — economic cost of participation
- **Identity persistence** — Forge attestation (or equivalent) prevents fresh-start after reputation damage

Additionally, cross-producer correlation detection (RECOMMENDED: 0.85 threshold, 4-epoch lookback) penalizes copycat behavior by halving the lower-karma producer's emissions.

### 15.8 Credential Hygiene

Bearer credentials MUST be rotatable. Compromised credentials MUST be revocable.

The refresh flow SHOULD require a fresh wallet signature, not just the old token.

### 15.9 Control Graph Evolution

When delegated keys or multisig bindings are added in later versions, the root wallet MUST remain auditable as the producer's identity anchor.

---

## 16. Worked Scenario A: First Signal Submission

### Context

sendoeth operates post-fiat-signals, a regime-aware semi-crypto divergence engine exposing structured endpoints for health, regime state, filtered signals, and reliability. They want to become a producer in the b1e55ed network.

### A.1 Registration

sendoeth requests a challenge:

```
POST /v1/producers/challenge

{
  "schema_version": "spi.v1",
  "wallet_address": "0xb1e55edA3F...",
  "wallet_scheme": "eip191",
  "producer_name": "post-fiat-signals",
  "requested_mode": "native"
}
```

Gateway returns challenge. sendoeth signs with Forge key. Submits to `/v1/producers/register`.

Result: `producer_id = prd_01J6X...`, `lifecycle_state = onboarding`, sandbox quota only.

sendoeth deposits stake to the staking contract. Gateway detects the on-chain event and transitions to probationary.

### A.2 First Live Submission

```
POST /v1/signals/submit
Authorization: Bearer spi_live_...

{
  "schema_version": "spi.v1",
  "submission_id": "sub_pfs_001",
  "producer_id": "prd_01J6X...",
  "submitted_at": "2026-03-16T20:00:00Z",
  "mode": "live",
  "signals": [{
    "signal_client_id": "sig_pfs_btc_001",
    "signal_type": "directional",
    "instrument": {
      "symbol": "BTC-USD",
      "asset_class": "crypto"
    },
    "claim": {
      "direction": "bullish",
      "confidence": 0.78,
      "horizon": "168h",
      "thesis": "NEUTRAL regime + CRYPTO_LEADS: 82% hit rate, +8.24% avg 14d return",
      "source_assertion": "EXECUTE"
    },
    "regime_context": {
      "regime": "NEUTRAL",
      "signal_type": "CRYPTO_LEADS",
      "regime_filter": "ACTIONABLE"
    },
    "quality_metadata": {
      "hit_rate": 0.82,
      "avg_return": 0.0824,
      "reliability_decay": false
    },
    "observed_at": "2026-03-16T19:59:30Z",
    "expires_at": "2026-03-23T19:59:30Z"
  }]
}
```

### A.3 Acknowledgment

```json
{
  "schema_version": "spi.v1",
  "ack_id": "ack_001",
  "submission_id": "sub_pfs_001",
  "status": "accepted",
  "accepted_count": 1,
  "results": [{
    "signal_client_id": "sig_pfs_btc_001",
    "status": "accepted",
    "signal_id": "sig_01J7Z9...",
    "attribution_window": {
      "start": "2026-03-16T20:00:01Z",
      "end": "2026-03-23T20:00:01Z"
    },
    "synthesis_weight": 0.25
  }],
  "producer_state": {
    "lifecycle_state": "probationary",
    "karma": 0.50,
    "quota_remaining_hour": 4
  }
}
```

### A.4 Attribution Outcome (7 days later)

BTC-USD moved from $84,250 to $91,340 (+8.42%). The signal claimed bullish at 0.78 confidence.

```json
{
  "schema_version": "spi.v1",
  "outcome_id": "out_001",
  "signal_id": "sig_01J7Z9...",
  "resolved_at": "2026-03-23T20:06:02Z",
  "status": "resolved",
  "outcome_label": "correct",
  "resolution": {
    "direction_correct": true,
    "entry_price": 84250.00,
    "exit_price": 91340.00,
    "price_change_pct": 8.42,
    "method": "twap_4h",
    "price_feed": "chainlink_btc_usd"
  },
  "scoring": {
    "brier_component": 0.0484,
    "karma_delta": 0.038,
    "karma_new": 0.538,
    "conviction_weight_used": 0.25,
    "synthesis_contribution": 0.067
  },
  "staking": {
    "slash_applied": false,
    "emission_earned": "2.4"
  },
  "attribution": {
    "chain_hash": "sha256:...",
    "provenance_url": "https://oracle.b1e55ed.permanentupperclass.com/attribution/out_001"
  }
}
```

First signal accepted. Outcome resolved correct. Karma increases from 0.50 to 0.538. Producer remains probationary, pending more resolved history.

---

## 17. Worked Scenario B: Probationary to Active Graduation

### B.1 Starting Point

post-fiat-signals has been submitting for 4 epochs (4 weeks):

- 48 signals submitted, 42 accepted (87.5% acceptance rate)
- 28 outcomes resolved
- Mean Brier score: 0.18 (well-calibrated)
- Running karma: 0.64
- No suspension events
- Stake maintained above active minimum

### B.2 Graduation Check

The active-tier requirements (as exposed by `/v1/producers/{producer_id}/requirements`):

```
✓ Minimum resolved signals: 28 ≥ 50? — NOT MET
```

Two more epochs pass. More signals submitted. After epoch 6:

- Resolved signals: 52
- Karma: 0.68
- Rejection rate: 2.1%
- Stake maintained

```
✓ Minimum resolved signals: 52 ≥ 50
✓ Minimum karma: 0.68 ≥ 0.40
✓ Rejection rate: 2.1% < 5%
✓ Stake maintained: true
✓ No suspension events: true
```

### B.3 State Transition

The identity registry updates the producer state automatically:

```json
{
  "schema_version": "spi.v1",
  "producer_id": "prd_01J6X...",
  "lifecycle_state": "active",
  "transition": {
    "from": "probationary",
    "to": "active",
    "at": "2026-04-27T00:00:00Z",
    "reason": "active_requirements_met"
  },
  "quota": {
    "tier": "active",
    "signals_per_hour": 60,
    "signals_per_day": 500,
    "burst": 10,
    "batch_max_size": 25
  },
  "metrics": {
    "karma": 0.68,
    "resolved_signals": 52,
    "rejection_rate": 0.021,
    "stake_status": "met"
  }
}
```

Graduation is automatic and rule-based. Throughput expands. Synthesis weight increases to 1.0×. Emission rewards apply at full rate. Future drops in karma or stake can still trigger suspension.

---

## 18. Capability Taxonomy

Producers declare capabilities during registration. These inform the gateway's expectations and the adapter framework's behavior.

| Capability | Description |
|---|---|
| has_directional_signals | Produces bullish/bearish/neutral claims on instruments |
| has_regime_context | Produces macro regime or market state assessments |
| has_confidence_metrics | Includes calibrated confidence values with signals |
| has_health_status | Exposes system health (healthy/degraded/halt) |
| has_freshness_metadata | Includes data age, staleness, freshness timestamps |
| has_ranked_candidates | Produces ranked opportunity lists |
| has_rebalancing_hints | Produces portfolio rebalancing instructions |
| has_source_assertions | Includes source-native action assertions (EXECUTE/WAIT) |
| has_evidence_refs | Links to supporting evidence (IPFS, URLs) |

---

## 19. Governance Hooks

The following parameters SHOULD be governance-controlled or at minimum operator-configurable:

- Minimum onboarding/probationary/active stake
- Minimum active karma threshold
- Resolved-signal thresholds for graduation
- Rejection-rate thresholds
- Quota tier values and scaling factors
- Malformed-request penalty thresholds
- Suspension and recovery policies
- Tracked instrument universe
- Slashing parameters

The protocol MUST expose current effective values to producers via the requirements endpoint. Parameters MUST NOT remain implicit.

---

## 20. Implementation Bridge

### 20.1 Internal Convergence

Both native SPI and adapter-mediated flows MUST converge into the same internal records:

- Registered producer identity
- Canonical signal ID
- Acknowledgment record
- Attribution outcome record
- Producer lifecycle state
- Quota counters
- Karma/stake ledger linkages

### 20.2 Adapter Framework (Internal)

The b1e55ed codebase includes a reusable adapter framework at `engine/external/` that implements Mode B for any HTTP/JSON signal source. Adapters are declared via YAML spec files and produce native b1e55ed events through the standard `BaseProducer → publish()` path.

The adapter framework is the compatibility transport. The SPI is the public producer protocol. The internal attribution engine is the shared core underneath both.

### 20.3 Reference Integration

The first SPI integration is with sendoeth/post-fiat-signals. This system already exposes structured endpoints for health, regime state, filtered signals, and reliability.

The integration will initially operate in adapter-mediated mode (Mode B), with a defined migration path to native SPI (Mode A) once the producer has validated the attribution pipeline through shadow-mode evaluation.

---

## 21. Normative Summary

A compliant SPI v1 gateway implementation MUST provide:

- Wallet-signature challenge registration
- Producer lifecycle states with deterministic transitions
- At least the three core message types (SignalSubmission, SignalAcknowledgment, AttributionOutcome)
- Machine-readable rejection codes
- Quota enforcement by lifecycle tier
- Stake and karma-aware activation
- Canonical producer status inspection including requirements transparency
- Attribution outcome retrieval (pull at minimum; webhook RECOMMENDED)
- Adapter-mediated participation equivalence

A compliant SPI v1 producer implementation MUST provide:

- Wallet-controlled identity
- Valid registered credential
- Unique submission IDs
- Valid signal payloads conforming to the schema
- Quota compliance
- Truthful mode declaration (live vs sandbox)
- Acceptance of lifecycle enforcement

---

*End of specification.*

*This document transitions b1e55ed from a closed oracle into an open, agnostic attribution layer — the critical step for network-scale producer onboarding.*
