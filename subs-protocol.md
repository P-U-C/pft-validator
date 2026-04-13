# SUBS Protocol — Service Lifecycle Specification

## Post Fiat Network · On-Chain Subscription Primitive

**Version**: 1.0.0  
**Status**: Implementation-ready  
**Published**: 2026-04-13  
**Author**: Permanent Upper Class (rsS2Y6CK9dz9dVFjJvRyD2gBdoLPqjaXRZ)

---

## 1. Purpose

SUBS defines a subscription primitive for the Post Fiat network that lets pseudonymous contributors list paid services, accept PFT-denominated subscriptions, and expose deterministic entitlement checks — all using native XRPL memo fields. No smart contracts, no external infrastructure, no identity layer.

All subscription payments route through the SUBS protocol address. The protocol takes a 2.5% fee and forwards the remainder to the service provider. This creates a self-sustaining economic model: services list for free, revenue scales with usage, and the protocol funds itself from the value it facilitates.

This document specifies the protocol layer only: schemas, state machines, event payloads, payment routing, entitlement resolution, and implementation handoff interfaces. It is designed so that indexer, API, and client implementers can ship against stable interfaces without inventing bespoke payment logic.

---

## 2. Protocol Economics

### 2.1 Payment Routing

All subscription payments flow through the **SUBS protocol address** as a settlement layer. Subscribers never pay the service provider directly.

```
Subscriber ──── 500 PFT ────► SUBS Protocol Address
                                    │
                                    ├── 12.5 PFT (2.5%) ──► SUBS Treasury
                                    │
                                    └── 487.5 PFT (97.5%) ──► Service Provider
```

**Subscription transaction (from subscriber):**

```
Transaction: Payment
  Account:     <subscriber address>
  Destination: <SUBS protocol address>
  Amount:      <service price in drops>
  Memos: [{
    MemoType:  "subs.subscribe"          (hex-encoded)
    MemoData:  "<service_id>"            (hex-encoded)
  }]
```

**Forwarding transaction (from SUBS protocol to service provider):**

```
Transaction: Payment
  Account:     <SUBS protocol address>
  Destination: <service provider address>
  Amount:      <97.5% of subscription payment>
  Memos: [{
    MemoType:  "subs.forward"            (hex-encoded)
    MemoData:  "<service_id>:<original_tx_hash>"  (hex-encoded)
  }]
```

One transaction from the subscriber. Two on-chain records (subscription + forwarding). Fully auditable.

### 2.2 Protocol Fee

| Parameter | Value |
|-----------|-------|
| Fee rate | 2.5% |
| Rounding | Down to nearest drop |
| Deducted from | Service provider's share (subscriber pays advertised price) |
| Treasury address | Published in `subs.json` |
| Fee visibility | Exposed in registry, verifiable on-chain |

**The fee is not added to the subscriber's price.** A service priced at 500 PFT costs the subscriber exactly 500 PFT. The provider receives 487.5 PFT. The protocol retains 12.5 PFT.

### 2.3 Revenue Model

Services list for free. The protocol earns only when services have paying subscribers. Revenue scales with ecosystem usage:

| Scenario | Services | Avg Subscribers | Avg Price | Monthly Volume | Protocol Revenue (2.5%) |
|----------|----------|-----------------|-----------|----------------|------------------------|
| Launch | 1 | 5 | 500 PFT | 2,500 PFT | 62.5 PFT |
| Early growth | 5 | 10 | 400 PFT | 20,000 PFT | 500 PFT |
| Established | 20 | 25 | 500 PFT | 250,000 PFT | 6,250 PFT |
| At scale | 100 | 50 | 500 PFT | 2,500,000 PFT | 62,500 PFT |

**Why services accept 2.5%:**
- Free to list (no registration fee)
- SUBS handles payment routing, verification, discovery, subscriber management
- 2.5% is lower than any traditional payment processor or app store
- Services get access to composable subscriber infrastructure
- The protocol does their billing for them

### 2.4 On-Chain Auditability

Every fee is verifiable:

```sql
-- Protocol revenue for a given period
SELECT SUM(CAST(amount_drops AS INTEGER)) / 1000000 as protocol_revenue_pft
FROM transactions
WHERE account = :subs_protocol_address
  AND destination = :subs_treasury_address
  AND memo_type = 'subs.fee'
  AND timestamp_iso > datetime('now', '-30 days');

-- Verify fee rate on any subscription
SELECT
  sub.amount_drops as subscriber_paid,
  fwd.amount_drops as provider_received,
  sub.amount_drops - fwd.amount_drops as protocol_fee,
  ROUND((sub.amount_drops - fwd.amount_drops) * 100.0 / sub.amount_drops, 2) as fee_pct
FROM transactions sub
JOIN transactions fwd ON fwd.memo_data_preview LIKE '%' || sub.tx_hash || '%'
WHERE sub.tx_hash = :subscription_tx_hash;
```

---

## 3. Schemas

### 2.1 `service_offer` Schema

A service offer describes a paid service available for subscription on the network.

```json
{
  "$schema": "service_offer/1.0.0",
  "service_id": "string — unique identifier, lowercase alphanumeric + hyphens, max 32 chars",
  "name": "string — human-readable service name, max 64 chars",
  "description": "string — what the service provides, max 256 chars",
  "provider_address": "string — XRPL address of the service provider",
  "service_address": "string — XRPL address that receives forwarded payments (97.5% of subscription)",
  "price_drops": "integer — minimum payment in drops (1 PFT = 1,000,000 drops)",
  "price_pft": "number — price in PFT (derived: price_drops / 1,000,000)",
  "period_seconds": "integer — billing period duration in seconds",
  "period_days": "number — billing period in days (derived: period_seconds / 86400)",
  "features": ["string — list of features included in this subscription"],
  "free_features": ["string — features available without subscription"],
  "status": "active | paused | retired",
  "registered_at": "string — ISO 8601 timestamp of registration",
  "registration_tx": "string — tx_hash of the registration payment",
  "metadata": {
    "version": "string — service version, semver",
    "terms_url": "string | null — optional link to service terms",
    "support_memo": "string | null — memo type for support queries"
  }
}
```

**Required fields**: `service_id`, `name`, `provider_address`, `service_address`, `price_drops`, `period_seconds`, `status`, `registered_at`.

**Constraints**:
- `service_id` must be unique across the registry
- `service_address` may host multiple services (differentiated by `service_id` in memo data)
- `price_drops` must be > 0
- `period_seconds` must be >= 86400 (minimum 1 day)

### 2.2 `subscription` Schema

A subscription represents the relationship between a subscriber and a service.

```json
{
  "$schema": "subscription/1.0.0",
  "subscriber_address": "string — XRPL address of the subscriber",
  "service_id": "string — references service_offer.service_id",
  "service_address": "string — references service_offer.service_address",
  "state": "inactive | active | expiring | expired",
  "current_period": {
    "started_at": "string — ISO 8601, timestamp of qualifying payment",
    "expires_at": "string — ISO 8601, started_at + period_seconds",
    "payment_tx": "string — tx_hash of the payment that activated this period",
    "amount_drops": "integer — amount paid"
  },
  "lifetime": {
    "first_subscribed_at": "string — ISO 8601, earliest qualifying payment",
    "total_payments": "integer — number of qualifying payments ever",
    "total_paid_drops": "integer — sum of all qualifying payments",
    "total_periods": "integer — number of distinct billing periods purchased"
  },
  "entitlement": {
    "is_entitled": "boolean — result of entitlement resolution",
    "resolved_at": "string — ISO 8601, when this was last checked",
    "resolution_method": "chain_query | live_fallback",
    "freshness_note": "string — describes index staleness if applicable"
  }
}
```

**State derivation**: The `state` field is always computed, never stored. It is derived from the current time and the most recent qualifying payment:

| Condition | State |
|-----------|-------|
| No qualifying payment exists | `inactive` |
| Qualifying payment exists AND `now < expires_at` | `active` |
| Qualifying payment exists AND `expires_at - 72h < now < expires_at` | `expiring` |
| Qualifying payment exists AND `now >= expires_at` | `expired` |

Note: `expiring` is a substate of `active` — the subscriber is still entitled but approaching expiry. This enables grace-period notifications without affecting access.

---

## 3. Lifecycle State Machine

```
                    ┌──────────────────────────────┐
                    │                              │
                    ▼                              │
              ┌──────────┐   subscribe       ┌────┴─────┐
   ──────────►│ INACTIVE │──────────────────►│  ACTIVE  │
              └──────────┘                   └────┬─────┘
                    ▲                              │
                    │                              │ period nearing end
                    │                              ▼
                    │                        ┌───────────┐
                    │          expire         │ EXPIRING  │
                    │  ┌─────────────────────│ (grace)   │
                    │  │                     └─────┬─────┘
                    │  │                           │
                    │  ▼           renew           │
              ┌─────┴──────┐◄─────────────────────┘
              │  EXPIRED   │──────────┐
              └────────────┘          │ renew
                                      │
                               ┌──────▼─────┐
                               │   ACTIVE   │
                               └────────────┘
```

### 3.1 State Transitions

| From | Event | To | Trigger |
|------|-------|----|---------|
| `inactive` | `subscribe` | `active` | Qualifying payment received |
| `active` | `time_passes` | `expiring` | `now > expires_at - grace_period` |
| `expiring` | `renew` | `active` | New qualifying payment received |
| `expiring` | `time_passes` | `expired` | `now >= expires_at` |
| `expired` | `renew` | `active` | New qualifying payment received |
| `active` | `renew` | `active` | Early renewal resets period |
| any | `service_retired` | `inactive` | Provider sets service status to `retired` |

### 3.2 Transition Rules

- **Subscribe**: First qualifying payment transitions `inactive → active`. Period starts at payment timestamp.
- **Renew**: Any qualifying payment while `active`, `expiring`, or `expired` starts a new period from the new payment timestamp. Remaining days from the prior period are NOT carried forward (no stacking in v1).
- **Expire**: Automatic when `now >= expires_at`. No transaction needed. State is computed, not stored.
- **Cancel**: There is no cancel event. Subscribers stop paying. The period runs out. State becomes `expired`, then effectively `inactive` for entitlement purposes.
- **Grace period**: The `expiring` state begins 72 hours before `expires_at`. During grace, the subscriber is still entitled but services may send reminders. Grace period duration is a service-level configuration (default 72h, minimum 0).

### 3.3 Payment Qualification

A Payment transaction qualifies as a subscription event if and only if ALL conditions are met:

| # | Condition | Field | Operator | Value |
|---|-----------|-------|----------|-------|
| 1 | Routed through protocol | `destination` | `=` | SUBS protocol address |
| 2 | Correct subscriber | `account` | `=` | subscriber's XRPL address |
| 3 | Subscription memo type | `memo_type` | `=` | `subs.subscribe` |
| 4 | Correct service ID | `memo_data` | `contains` | `service_offer.service_id` |
| 5 | Sufficient payment | `amount_drops` | `>=` | `service_offer.price_drops` |
| 6 | Valid transaction type | `tx_type` | `=` | `Payment` |
| 7 | Transaction succeeded | `meta.TransactionResult` | `=` | `tesSUCCESS` |

Note: Condition 1 checks the SUBS protocol address, not the service provider address. All subscription payments route through the protocol for fee settlement.

### 3.4 Payment Semantics

| Scenario | Behavior |
|----------|----------|
| Exact payment | Grants one period |
| Overpayment | Grants one period (excess is not refunded, does not extend) |
| Underpayment | Does not qualify. No subscription granted. |
| Multiple payments in one period | Idempotent for access. Each is a valid renewal anchor. |
| Early renewal | Resets period start to new payment timestamp |
| Payment to wrong service_id | Does not qualify for unmatched service |
| Payment without memo | Does not qualify |

---

## 4. Event Payloads

Events are derived from chain state, not emitted separately. Indexers and clients detect events by observing qualifying transactions and computing state transitions.

### 4.1 `subscribe` Event

Detected when: a qualifying payment is the first-ever from this subscriber to this service.

```json
{
  "event": "subscribe",
  "service_id": "alpha",
  "subscriber": "rsS2Y6CK9dz9dVFjJvRyD2gBdoLPqjaXRZ",
  "service_address": "r3hH6UNw1eVQYiXbDVoarp2kN6JKyTYveT",
  "amount_drops": 500000000,
  "amount_pft": 500,
  "tx_hash": "A1B2C3D4E5F6...",
  "timestamp_iso": "2026-04-13T10:00:00Z",
  "period_started_at": "2026-04-13T10:00:00Z",
  "period_expires_at": "2026-05-13T10:00:00Z",
  "previous_state": "inactive",
  "new_state": "active"
}
```

### 4.2 `renew` Event

Detected when: a qualifying payment exists and the subscriber has prior payment history for this service.

```json
{
  "event": "renew",
  "service_id": "alpha",
  "subscriber": "rsS2Y6CK9dz9dVFjJvRyD2gBdoLPqjaXRZ",
  "service_address": "r3hH6UNw1eVQYiXbDVoarp2kN6JKyTYveT",
  "amount_drops": 500000000,
  "amount_pft": 500,
  "tx_hash": "F6E5D4C3B2A1...",
  "timestamp_iso": "2026-05-10T14:30:00Z",
  "period_started_at": "2026-05-10T14:30:00Z",
  "period_expires_at": "2026-06-09T14:30:00Z",
  "previous_state": "expiring",
  "new_state": "active",
  "days_before_expiry": 2.8
}
```

### 4.3 `expire` Event

Detected when: `now >= expires_at` and no new qualifying payment exists. This is a computed event — no transaction triggers it.

```json
{
  "event": "expire",
  "service_id": "alpha",
  "subscriber": "rsS2Y6CK9dz9dVFjJvRyD2gBdoLPqjaXRZ",
  "service_address": "r3hH6UNw1eVQYiXbDVoarp2kN6JKyTYveT",
  "expired_at": "2026-05-13T10:00:00Z",
  "last_payment_tx": "A1B2C3D4E5F6...",
  "last_payment_at": "2026-04-13T10:00:00Z",
  "previous_state": "expiring",
  "new_state": "expired",
  "total_periods_completed": 1
}
```

### 4.4 `cancel` Event

There is no cancel event in the protocol. Cancellation is inaction — the subscriber simply does not renew. Services may detect implied cancellation when a subscription transitions from `expiring` to `expired` without a renewal payment:

```json
{
  "event": "cancel_implied",
  "service_id": "alpha",
  "subscriber": "rsS2Y6CK9dz9dVFjJvRyD2gBdoLPqjaXRZ",
  "inferred_at": "2026-05-13T10:00:00Z",
  "reason": "period_expired_without_renewal",
  "total_periods_completed": 1,
  "total_paid_pft": 500,
  "subscriber_since": "2026-04-13T10:00:00Z"
}
```

### 4.5 `grace_enter` Event

Detected when: `now > expires_at - grace_period` and subscription is still active.

```json
{
  "event": "grace_enter",
  "service_id": "alpha",
  "subscriber": "rsS2Y6CK9dz9dVFjJvRyD2gBdoLPqjaXRZ",
  "expires_at": "2026-05-13T10:00:00Z",
  "hours_remaining": 71.5,
  "previous_state": "active",
  "new_state": "expiring"
}
```

---

## 5. Entitlement Resolution

### 5.1 Pseudocode

```
FUNCTION resolve_entitlement(subscriber, service_offer, data_source):

  INPUT:
    subscriber        — XRPL address of the user requesting access
    service_offer     — service_offer object (service_address, service_id, price_drops, period_seconds)
    data_source       — chain index database OR live node RPC

  OUTPUT:
    EntitlementResult — { entitled: bool, state: string, expires_at: timestamp | null, resolved_via: string }

  STEPS:

  1. QUERY data_source for the most recent transaction matching ALL of:
       destination     = subs_protocol_address
       account         = subscriber
       memo_type       = "subs.subscribe"
       memo_data       CONTAINS service_offer.service_id
       amount_drops    >= service_offer.price_drops
       tx_type         = "Payment"

     ORDER BY timestamp DESC
     LIMIT 1

     ASSIGN result → latest_payment

  2. IF latest_payment IS NULL:
       RETURN { entitled: false, state: "inactive", expires_at: null, resolved_via: data_source.type }

  3. COMPUTE expires_at = latest_payment.timestamp + service_offer.period_seconds

  4. COMPUTE now = current UTC time

  5. IF now < expires_at:
       grace_threshold = expires_at - service_offer.grace_period (default 72 hours)
       IF now > grace_threshold:
         state = "expiring"
       ELSE:
         state = "active"
       RETURN { entitled: true, state: state, expires_at: expires_at, resolved_via: data_source.type }

  6. ELSE (now >= expires_at):
       RETURN { entitled: false, state: "expired", expires_at: expires_at, resolved_via: data_source.type }
```

### 5.2 Freshness Handling

```
FUNCTION resolve_with_fallback(subscriber, service_offer, index_db, rpc_node):

  1. CHECK index_db freshness:
       last_indexed = query index_db for crawl_state 'last_crawl_at'
       staleness = now - last_indexed

  2. IF staleness < 90 minutes:
       RETURN resolve_entitlement(subscriber, service_offer, index_db)
         WITH freshness_note = "index as of {last_indexed}"

  3. ELSE (index is stale):
       QUERY rpc_node account_tx for service_offer.service_address
       FILTER for subscriber's qualifying payments
       RETURN resolve_entitlement(subscriber, service_offer, rpc_result)
         WITH freshness_note = "live node query, index stale since {last_indexed}"
```

### 5.3 SQL Implementation (for indexed chain)

```sql
-- Entitlement check: returns 1 if entitled, 0 if not
SELECT CASE
  WHEN COUNT(*) > 0 THEN 1
  ELSE 0
END as entitled
FROM transactions
WHERE destination = :subs_protocol_address
  AND account = :subscriber
  AND memo_type = 'subs.subscribe'
  AND memo_data_preview LIKE '%' || :service_id || '%'
  AND CAST(amount_drops AS INTEGER) >= :min_price_drops
  AND tx_type = 'Payment'
  AND timestamp_iso > datetime('now', :period_clause);

-- Full subscription state: returns latest payment + computed expiry
SELECT
  timestamp_iso as payment_at,
  CAST(amount_drops AS INTEGER) as amount_drops,
  tx_hash,
  datetime(timestamp_iso, '+' || :period_days || ' days') as expires_at,
  CASE
    WHEN datetime(timestamp_iso, '+' || :period_days || ' days') > datetime('now')
      AND datetime(timestamp_iso, '+' || :period_days || ' days') < datetime('now', '+3 days')
    THEN 'expiring'
    WHEN datetime(timestamp_iso, '+' || :period_days || ' days') > datetime('now')
    THEN 'active'
    ELSE 'expired'
  END as state
FROM transactions
WHERE destination = :subs_protocol_address
  AND account = :subscriber
  AND memo_type = 'subs.subscribe'
  AND memo_data_preview LIKE '%' || :service_id || '%'
  AND CAST(amount_drops AS INTEGER) >= :min_price_drops
  AND tx_type = 'Payment'
ORDER BY timestamp_iso DESC
LIMIT 1;
```

---

## 6. Service Registration

### 6.1 Registration Transaction

A service provider registers by sending a memo to the SUBS protocol address. Registration is free — the protocol earns from subscriber fees, not provider fees.

```
Transaction: Payment
  Account:     <provider address>
  Destination: <SUBS protocol address>
  Amount:      1,000,000 drops (1 PFT — minimum to carry memo, not a fee)
  Memos: [{
    MemoType:  "subs.register"                    (hex-encoded)
    MemoData:  <JSON payload>                     (hex-encoded)
  }]
```

### 6.2 Registration Payload Schema

```json
{
  "id": "string — service_id, lowercase alphanumeric + hyphens, max 32",
  "name": "string — display name, max 64 chars",
  "price": "number — price in PFT per period",
  "period": "number — billing period in days",
  "desc": "string — description, max 256 chars",
  "features": ["string — optional feature list"],
  "addr": "string — optional, service_address if different from provider"
}
```

Compact keys to fit within XRPL memo size limits. The bot validates, confirms on-chain, and includes the service in the next registry export.

### 6.3 Registration Validation Rules

| Rule | Validation |
|------|------------|
| `id` format | `^[a-z0-9-]{1,32}$` |
| `id` uniqueness | Must not exist in current registry |
| `price` range | `> 0` and `<= 100000` PFT |
| `period` range | `>= 1` and `<= 365` days |
| `name` length | 1-64 characters |
| `desc` length | 1-256 characters |
| Payment amount | `>= 1 PFT` (minimum to carry memo) |

### 6.4 Service Lifecycle States

| Status | Meaning |
|--------|---------|
| `active` | Service is accepting new subscriptions |
| `paused` | Service is not accepting new subscriptions; existing subscriptions honored until expiry |
| `retired` | Service is permanently closed; existing subscriptions honored until expiry, no renewals |

Providers update status by sending a memo to the bot:
```
MemoType:  "subs.update"
MemoData:  {"id": "<service_id>", "status": "paused"}
```

---

## 7. Worked End-to-End Example

### Scenario

Contributor `rContrib123...` discovers and subscribes to the "Alpha Terminal" service, uses it for one month, renews, then lets it expire.

### Step 1: Discovery

Contributor queries the bot or reads `subs.json`:

```
Contributor → Bot memo: /services

Bot → Contributor memo:
  SUBS — 1 service available:
  1. alpha | Alpha Terminal | 500 PFT / 30 days
     AI decision layer for PFT earnings optimization
     Provider: rsS2Y6CK... | 3 subscribers
```

At this point, the contributor's subscription state for `alpha` is:

```json
{ "state": "inactive", "entitled": false }
```

### Step 2: Subscribe

Contributor sends a Payment transaction to the SUBS protocol address:

```
Transaction: Payment
  Account:     rContrib123...
  Destination: <SUBS protocol address>
  Amount:      500000000 (500 PFT)
  Memos: [{
    MemoType:  7375622e737562736372696265    ("subs.subscribe" hex)
    MemoData:  616c706861                    ("alpha" hex)
  }]
  
Result: tesSUCCESS
TxHash: AAA111...
Timestamp: 2026-04-13T10:00:00Z
```

**SUBS protocol processes the payment:**

```
1. Receive 500 PFT from rContrib123...
2. Compute fee: floor(500,000,000 × 0.025) = 12,500,000 drops (12.5 PFT)
3. Forward to provider: 500,000,000 - 12,500,000 = 487,500,000 drops (487.5 PFT)

Transaction: Payment (forwarding)
  Account:     <SUBS protocol address>
  Destination: r3hH6UNw1eVQYiXbDVoarp2kN6JKyTYveT  (Alpha Terminal provider)
  Amount:      487500000 (487.5 PFT)
  Memos: [{
    MemoType:  "subs.forward"
    MemoData:  "alpha:AAA111..."
  }]

Protocol retains: 12.5 PFT
```

**Event detected by indexer:**

```json
{
  "event": "subscribe",
  "service_id": "alpha",
  "subscriber": "rContrib123...",
  "amount_pft": 500,
  "protocol_fee_pft": 12.5,
  "provider_received_pft": 487.5,
  "tx_hash": "AAA111...",
  "forward_tx_hash": "AAA112...",
  "period_started_at": "2026-04-13T10:00:00Z",
  "period_expires_at": "2026-05-13T10:00:00Z",
  "previous_state": "inactive",
  "new_state": "active"
}
```

**Bot confirmation reply:**

```
Subscribed to Alpha Terminal.
Active until: 2026-05-13T10:00:00Z
Features unlocked: task EV ranking, competition heatmap, earnings analytics
Data as of: 2026-04-13T10:00:00Z
```

**Entitlement resolution at 2026-04-13T10:05:00Z:**

```
resolve_entitlement(rContrib123, alpha_offer, index_db):
  1. Query: found AAA111... at 2026-04-13T10:00:00Z, 500 PFT ✓
  2. latest_payment exists ✓
  3. expires_at = 2026-05-13T10:00:00Z
  4. now = 2026-04-13T10:05:00Z
  5. now < expires_at → entitled = true, state = "active"
  RETURN { entitled: true, state: "active", expires_at: "2026-05-13T10:00:00Z" }
```

### Step 3: Active Usage (30 days)

Contributor uses Alpha Terminal features. The bot checks entitlement on every premium command:

```
Contributor → Bot: /alpha rank

Bot internal: resolve_entitlement(rContrib123, alpha_offer, index_db)
  → { entitled: true, state: "active" }

Bot → Contributor:
  You're #6 of 53 contributors.
  Completion rate: 45% (network avg: 41%)
  PFT/submission: 2,671 (12% above median)
  Trend: ↑ rising
```

### Step 4: Grace Period Entry

At 2026-05-10T10:00:01Z (72 hours before expiry):

**Event detected:**

```json
{
  "event": "grace_enter",
  "service_id": "alpha",
  "subscriber": "rContrib123...",
  "expires_at": "2026-05-13T10:00:00Z",
  "hours_remaining": 72.0,
  "new_state": "expiring"
}
```

**Bot sends reminder:**

```
Bot → Contributor:
  Your Alpha Terminal subscription expires in 3 days (2026-05-13).
  Send 500 PFT with memo "subs.subscribe" / "alpha" to renew.
```

**Entitlement resolution still grants access:**

```
  → { entitled: true, state: "expiring", expires_at: "2026-05-13T10:00:00Z" }
```

### Step 5: Renewal

Contributor renews at 2026-05-11T15:00:00Z (before expiry):

```
Transaction: Payment
  Account:     rContrib123...
  Destination: r3hH6UNw1eVQYiXbDVoarp2kN6JKyTYveT
  Amount:      500000000 (500 PFT)
  Memos: [{ MemoType: "subs.subscribe", MemoData: "alpha" }]
  
Result: tesSUCCESS
TxHash: BBB222...
Timestamp: 2026-05-11T15:00:00Z
```

**Event:**

```json
{
  "event": "renew",
  "service_id": "alpha",
  "subscriber": "rContrib123...",
  "amount_pft": 500,
  "tx_hash": "BBB222...",
  "period_started_at": "2026-05-11T15:00:00Z",
  "period_expires_at": "2026-06-10T15:00:00Z",
  "previous_state": "expiring",
  "new_state": "active",
  "days_before_expiry": 1.8
}
```

Note: the new period starts from the renewal payment timestamp, not from the old expiry. The remaining 1.8 days are forfeited (no stacking in v1).

### Step 6: Expiration (no renewal)

Contributor does not renew after the second period. At 2026-06-10T15:00:00Z:

**Event:**

```json
{
  "event": "expire",
  "service_id": "alpha",
  "subscriber": "rContrib123...",
  "expired_at": "2026-06-10T15:00:00Z",
  "last_payment_tx": "BBB222...",
  "new_state": "expired",
  "total_periods_completed": 2
}
```

**Implied cancel detected at next check after expiry:**

```json
{
  "event": "cancel_implied",
  "service_id": "alpha",
  "subscriber": "rContrib123...",
  "total_paid_pft": 1000,
  "subscriber_since": "2026-04-13T10:00:00Z"
}
```

**Entitlement resolution now denies access:**

```
resolve_entitlement(rContrib123, alpha_offer, index_db):
  1. Query: found BBB222... at 2026-05-11T15:00:00Z
  3. expires_at = 2026-06-10T15:00:00Z
  4. now = 2026-06-11T00:00:00Z
  5. now >= expires_at → entitled = false, state = "expired"
  RETURN { entitled: false, state: "expired", expires_at: "2026-06-10T15:00:00Z" }
```

Contributor receives free-tier responses only.

---

## 8. Implementation Handoff

### 8.1 Indexer Surface

The chain indexer must detect and store SUBS-related transactions. The existing PFTL indexer already stores all transactions with memo fields. No schema changes required.

**What the indexer provides:**

| Data | Source | Notes |
|------|--------|-------|
| All Payment transactions | `transactions` table | Already indexed |
| `memo_type` field | Parsed from `Memos[0].MemoType` | Already extracted as UTF-8 |
| `memo_data_preview` field | Parsed from `Memos[0].MemoData` | Already extracted, first 200 chars |
| Transaction timestamp | `timestamp_iso` | Already converted from Ripple epoch |
| Transaction success | `tx_type = 'Payment'` | Already stored; failed txns excluded by indexer |

**New indexer responsibilities (minimal):**

1. **Detect `subs.subscribe` memo type**: No code change needed — already stored in `memo_type` column. Clients query by filtering `memo_type = 'subs.subscribe'`.

2. **Detect `subs.register` memo type**: Same — already stored. The SUBS export script queries for these to build the registry.

3. **Export `subs.json`**: New hourly export step (added to existing pipeline after `export-auth.sh`). Reads `subs.register` transactions to build the service list, then queries `subs.subscribe` transactions to compute per-service subscriber counts and revenue.

**Indexer contract (stable interface for clients):**

```sql
-- All subscription payments for a service
SELECT account, timestamp_iso, amount_drops, tx_hash, memo_data_preview
FROM transactions
WHERE destination = :subs_protocol_address
  AND memo_type = 'subs.subscribe'
  AND tx_type = 'Payment'
ORDER BY timestamp_iso DESC;

-- All service registrations
SELECT account, timestamp_iso, amount_drops, tx_hash, memo_data_preview
FROM transactions
WHERE destination = :subs_bot_address
  AND memo_type = 'subs.register'
  AND tx_type = 'Payment'
ORDER BY timestamp_iso DESC;
```

These queries work against the existing `transactions` table with no modifications.

### 8.2 API Surface

Services that expose HTTP APIs can implement SUBS entitlement as middleware.

**Recommended API endpoints:**

| Endpoint | Method | Input | Output | Notes |
|----------|--------|-------|--------|-------|
| `/subs/check` | GET | `subscriber`, `service_id` | `SubsStatus` object | Public, no auth |
| `/subs/services` | GET | — | Array of `service_offer` | Public, no auth |
| `/subs/subscribe-info` | GET | `service_id` | Payment instructions | How to subscribe |

**Middleware pattern (pseudocode):**

```
FUNCTION subs_middleware(request, service_id, required_tier):

  subscriber = extract_address_from_request(request)
  
  IF subscriber IS NULL:
    RETURN 401 { error: "address required" }
  
  result = resolve_entitlement(subscriber, service_offers[service_id], data_source)
  
  IF NOT result.entitled:
    RETURN 403 {
      error: "subscription_required",
      service_id: service_id,
      state: result.state,
      subscribe_instructions: {
        send_to: service_offers[service_id].service_address,
        amount_pft: service_offers[service_id].price_pft,
        memo_type: "subs.subscribe",
        memo_data: service_id
      }
    }
  
  request.subscription = result
  CONTINUE to handler
```

**Freshness header**: API responses should include `X-Subs-Freshness: <last_indexed_at>` so clients know the age of the entitlement check.

### 8.3 Client Surface (Bot)

The bot is one client of the protocol. Its responsibilities:

**Command handling:**

| Command | Bot Action |
|---------|------------|
| `/services` | Query `subs.json` or index, format service list, reply on-chain |
| `/subscribe <id>` | Validate incoming payment against service price, confirm activation, reply with expiry |
| `/status` | Run entitlement resolution for sender against all known services, reply with results |
| `/register` | Parse JSON from memo_data, validate fields, store in registry staging, reply with confirmation |
| `/dashboard` | Query index for all `subs.subscribe` payments to sender's service address, compute metrics, reply |

**Bot implementation contract:**

```typescript
interface SubsBot {
  // Detect and route SUBS commands from incoming memos
  routeSubsCommand(memo: ParsedMemo, sender: string, amount: number): Promise<string>;
  
  // Check if sender has active subscription before processing premium commands
  checkEntitlement(sender: string, serviceId: string): Promise<SubsStatus>;
  
  // Format subscription confirmation reply
  formatSubscribeReply(status: SubsStatus, offer: ServiceOffer): string;
  
  // Format service directory listing
  formatServiceList(offers: ServiceOffer[]): string;
}
```

**Client resilience**: If the bot goes offline, subscribers retain their entitlements. Any alternative client can verify subscriptions using the canonical chain query. The bot is a convenience layer, not an authority.

### 8.4 Registry Export Surface

The hourly `export-subs.sh` script generates `subs.json` with live data:

**Export responsibilities:**

1. Read `subs.register` transactions from index to build service list
2. For each service, count active subscribers (qualifying payments within period)
3. Compute revenue metrics (30d, lifetime)
4. Write `subs.json` to GitHub Pages directory
5. Push to remote

**Export contract (stable fields in `subs.json`):**

```json
{
  "schema_version": "1.0.0",
  "exported_at": "ISO 8601",
  "index_freshness": "ISO 8601 — last indexer crawl",
  "services": ["array of service_offer objects with live subscriber/revenue data"],
  "bundles": ["array of bundle definitions"],
  "protocol": {
    "memo_type_subscribe": "subs.subscribe",
    "memo_type_register": "subs.register",
    "verification_method": "canonical_chain_query",
    "payment_semantics": "one_payment_one_period",
    "cancellation": "non_renewal"
  },
  "stats": {
    "total_services": "integer",
    "total_active_subscriptions": "integer",
    "total_revenue_30d_pft": "number"
  }
}
```

Downstream clients (dashboards, analytics, other bots) can consume `subs.json` as a stable read model without querying the chain directly.

---

## 9. Authority and Trust Model

| Layer | Authoritative For | Survives |
|-------|-------------------|----------|
| **Chain ledger** | Payment truth (who paid, when, how much) | Everything — immutable consensus |
| **Registry (`subs.json`)** | Discovery metadata (names, descriptions, features) | Registry publisher going offline (chain still works) |
| **Bot** | UX convenience (commands, formatting) | Bot going offline (chain + registry still work) |
| **Entitlement receipts** | Short-lived access cache (1h validity) | Receipt issuer going offline (chain still works) |

**Key invariant**: at no point does any layer above the chain have the ability to grant or deny access that contradicts the chain state. The chain is the single source of truth for payment status.

---

## 10. Future Extensions (documented, deferred from v1)

| Extension | Impact on v1 | Notes |
|-----------|-------------|-------|
| Accrual mode (overpayment extends) | Additive — new `accrual: true` field on service_offer | Does not break existing verification |
| Stacking renewals | Additive — expiry computation changes | Does not break existing verification |
| Tiered subscriptions | Additive — multiple service_ids per service | e.g., `alpha-basic`, `alpha-pro` |
| Trial periods | Additive — grace logic extended | First-seen timestamp already available |
| Referral credits | Additive — extended memo_data format | `alpha:ref:rAddress...` |
| Subscription NFTs | Additive — NFTokenMint after subscribe event | XRPL has native NFT support |
| Bundle discounts | Additive — bundle definitions in registry | Cross-service verification |
| Usage-based billing | New primitive — not subscription-based | Separate memo type `subs.usage` |

All extensions are designed to be additive — they do not modify the core verification query or break existing subscriptions.

---

## 11. Protocol Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                     SUBS Protocol v1.0.0                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  SUBSCRIBE:  Payment to SUBS protocol address                    │
│              + memo_type="subs.subscribe"                        │
│              + memo_data="<service_id>"                          │
│              + amount >= service price                            │
│                                                                  │
│  ROUTING:    Protocol retains 2.5% fee                           │
│              Forwards 97.5% to service provider                  │
│              Both transactions on-chain, auditable                │
│                                                                  │
│  VERIFY:     7-condition canonical chain query                   │
│              (protocol_addr, subscriber, memo_type, memo_data,   │
│               amount, tx_type, time_window)                      │
│                                                                  │
│  CANCEL:     Stop paying. Period expires. Done.                  │
│                                                                  │
│  REGISTER:   Payment + memo_type="subs.register"                │
│              + memo_data=JSON (free to list)                     │
│                                                                  │
│  STATES:     inactive → active → expiring → expired → (renew)   │
│                                                                  │
│  ECONOMICS:  Services list free. Revenue from usage.             │
│              Protocol scales with ecosystem growth.               │
│                                                                  │
│  TRUST:      Chain is authoritative. Everything else is a client.│
│                                                                  │
│  RESILIENCE: Bot dies? Protocol works. Registry dies? Protocol   │
│              works. Indexer dies? Query the node directly.        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

*This specification is published at [https://pft.permanentupperclass.com/subs-protocol](https://github.com/P-U-C/pft-validator/blob/main/subs-protocol.md) and is freely available for implementation by any builder on the Post Fiat network.*
