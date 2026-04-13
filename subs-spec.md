# SUBS — Monetization and Coordination Rail for the Post Fiat Contributor Economy

## Overview

SUBS is the billing primitive underneath the Post Fiat service economy. It turns PFT from a reward token into a working unit of account for on-chain services, with subscription state derived from ledger activity instead of app-side accounts.

The protocol is deliberately thin: subscription = payment, verification = chain query, cancellation = inaction. Everything else — discovery, UX, bundling — is layered on top without modifying the core primitive.

The first service built on SUBS is **Alpha Terminal**: a paid decision layer for maximizing PFT yield per hour of contributor effort.

---

## Protocol Design

### Core Primitive: Subscription = Payment

A subscription is a standard XRPL Payment transaction with a structured memo:

```
Transaction: Payment
  Account:     <subscriber address>
  Destination: <service address>
  Amount:      <price in drops>
  Memos: [{
    MemoType:  "subs.subscribe"          (hex-encoded)
    MemoData:  "<service_id>"            (hex-encoded)
  }]
```

One transaction. The subscriber is now active for that service's billing period.

### Canonical Verification Rule

A subscription is active if and only if ALL of the following are true:

| Condition | Field | Operator | Value |
|-----------|-------|----------|-------|
| Correct destination | `destination` | `=` | service address |
| Correct subscriber | `account` | `=` | subscriber address |
| Correct memo type | `memo_type` | `=` | `subs.subscribe` |
| Correct service | `memo_data_preview` | `LIKE` | `%<service_id>%` |
| Sufficient payment | `amount_drops` | `>=` | service minimum price (drops) |
| Successful transaction | `tx_type` | `=` | `Payment` |
| Within billing period | `timestamp_iso` | `>` | `now - period_days` |

```sql
SELECT COUNT(*) > 0 as is_active
FROM transactions
WHERE destination = :service_address
  AND account = :subscriber_address
  AND memo_type = 'subs.subscribe'
  AND memo_data_preview LIKE '%' || :service_id || '%'
  AND CAST(amount_drops AS INTEGER) >= :min_price_drops
  AND tx_type = 'Payment'
  AND timestamp_iso > datetime('now', :period_clause)
```

All seven conditions must match. A payment to the same address without the correct `service_id` in the memo does not grant access.

### Payment Semantics

- **One qualifying payment buys one period.** A payment of 500 PFT for a 30-day service grants 30 days from the payment timestamp.
- **Overpayment does not extend duration.** Sending 1,500 PFT still buys one 30-day period. (Accrual mode is a future extension, not v1.)
- **Early renewal resets the window.** If a subscriber pays again before expiry, the new period starts from the new payment timestamp. The remaining days from the prior payment are forfeited. (Stacking is a future extension.)
- **Multiple payments within a period are idempotent** for access purposes. The subscriber is active if any qualifying payment exists within the rolling window.

### Cancellation = Inaction

Stop paying. When the billing period expires, verification returns `false`. No unsubscribe flow, no forms, no retention dark patterns.

### Freshness Model

- **Registry and export** (`subs.json`) updates hourly via the existing indexer pipeline.
- **Entitlement checks** in the bot use the chain index, which is refreshed hourly. Activation lag is up to 60 minutes after payment.
- **Live-chain fallback**: For time-sensitive verification, services may query the node's `account_tx` RPC directly to check for recent subscription payments not yet indexed. The bot implements this fallback for immediate activation.
- **All UI and bot responses must disclose freshness**: "Data as of {last_indexed_at}."

---

## Authority Model

The chain and registry serve different roles:

| Layer | Authoritative For | Trust Basis |
|-------|-------------------|-------------|
| **Chain (ledger)** | Payment truth — who paid whom, when, how much | Consensus, immutable |
| **Registry (`subs.json`)** | Discovery metadata — service names, descriptions, features | Signed by registry publisher |
| **Bot** | UX convenience — commands, formatting, alerts | Client of the above |

If the registry disappears, subscriptions still work via direct chain queries. If the bot goes offline, subscriptions still work via direct chain queries. The protocol is the memo/payment convention plus the verification rule. Everything else is a client.

---

## Service Registry

A public JSON file (`subs.json`) hosted on GitHub Pages. Informational for discovery. The chain remains authoritative for payment state.

### Registry Schema

```json
{
  "schema_version": "1.0.0",
  "updated_at": "2026-04-13T02:00:00Z",
  "publisher": "Permanent Upper Class",
  "publisher_address": "rsS2Y6CK9dz9dVFjJvRyD2gBdoLPqjaXRZ",
  "services": [
    {
      "service_id": "alpha",
      "name": "Alpha Terminal",
      "description": "AI-powered decision layer for maximizing PFT earnings. Task analysis, timing signals, competition heatmap, earnings optimizer.",
      "provider": "Permanent Upper Class",
      "provider_address": "rsS2Y6CK9dz9dVFjJvRyD2gBdoLPqjaXRZ",
      "service_address": "r3hH6UNw1eVQYiXbDVoarp2kN6JKyTYveT",
      "price_pft": 500,
      "period_days": 30,
      "features": [
        "Task EV ranking and probability-of-acceptance estimate",
        "Competition density heatmap by hour",
        "Personal earnings analytics and win-rate dashboard",
        "Network timing alerts (low competition, high reward cycles)",
        "AI-assisted task drafting"
      ],
      "free_features": [
        "Basic rank lookup",
        "Network status"
      ],
      "status": "active",
      "verified": true,
      "registered_at": "2026-04-13T00:00:00Z",
      "subscribers_active": 0,
      "revenue_30d_pft": 0
    }
  ],
  "bundles": [],
  "protocol": {
    "memo_type_subscribe": "subs.subscribe",
    "memo_type_register": "subs.register",
    "memo_data_format": "service_id (plain text, no delimiters)",
    "payment_currency": "PFT (1 PFT = 1,000,000 drops)",
    "verification_method": "canonical_chain_query",
    "cancellation": "non-renewal",
    "overpayment": "does_not_extend_period",
    "early_renewal": "resets_window",
    "activation_lag": "up_to_60_minutes_or_live_fallback"
  }
}
```

### Service Registration (via Bot)

All registration happens through the SUBS bot. Send a Payment to the bot address with:

```
MemoType:  "subs.register"
MemoData:  JSON payload (hex-encoded)
Amount:    100 PFT (registration fee)
```

Registration payload (JSON in memo data):
```json
{
  "id": "myservice",
  "name": "My Service",
  "price": 200,
  "period": 30,
  "description": "What this service does"
}
```

Using JSON instead of delimited text avoids parsing ambiguity. The bot validates the payload, confirms registration on-chain, and adds the service to the next registry export.

**Uniqueness**: `service_id` must be unique across the registry. Multiple services per provider address are allowed — the `memo_data` match on `service_id` ensures correct routing.

---

## Verification Library

Drop-in module for any PFTL service to check subscriptions.

### TypeScript

```typescript
// subs-verify.ts

interface SubsConfig {
  serviceAddress: string;
  serviceId: string;
  pricePft: number;
  periodDays: number;
}

interface SubsStatus {
  active: boolean;
  subscriber: string;
  lastPayment: string | null;
  lastAmount: number | null;
  expiresAt: string | null;
  totalPaid: number;
  subscriptionCount: number;
  verifiedAt: string;
  freshnessNote: string;
}

function checkSubscription(
  db: Database,
  config: SubsConfig,
  subscriberAddress: string,
): SubsStatus {
  const periodClause = `-${config.periodDays} days`;
  const minDrops = config.pricePft * 1_000_000;
  const verifiedAt = new Date().toISOString();

  // Canonical verification: all 7 conditions
  const active = db.prepare(`
    SELECT COUNT(*) as c FROM transactions
    WHERE destination = ?
      AND account = ?
      AND memo_type = 'subs.subscribe'
      AND memo_data_preview LIKE '%' || ? || '%'
      AND CAST(amount_drops AS INTEGER) >= ?
      AND tx_type = 'Payment'
      AND timestamp_iso > datetime('now', ?)
  `).get(
    config.serviceAddress, subscriberAddress,
    config.serviceId, minDrops, periodClause
  );

  // Most recent qualifying payment
  const latest = db.prepare(`
    SELECT timestamp_iso, CAST(amount_drops AS INTEGER) as amount_drops
    FROM transactions
    WHERE destination = ? AND account = ?
      AND memo_type = 'subs.subscribe'
      AND memo_data_preview LIKE '%' || ? || '%'
      AND CAST(amount_drops AS INTEGER) >= ?
      AND tx_type = 'Payment'
    ORDER BY timestamp_iso DESC LIMIT 1
  `).get(
    config.serviceAddress, subscriberAddress,
    config.serviceId, minDrops
  );

  // Lifetime stats
  const lifetime = db.prepare(`
    SELECT COUNT(*) as payments,
           COALESCE(SUM(CAST(amount_drops AS INTEGER)), 0) as total_drops
    FROM transactions
    WHERE destination = ? AND account = ?
      AND memo_type = 'subs.subscribe'
      AND memo_data_preview LIKE '%' || ? || '%'
  `).get(config.serviceAddress, subscriberAddress, config.serviceId);

  const isActive = (active?.c ?? 0) > 0;
  const lastTs = latest?.timestamp_iso ?? null;
  const lastAmt = latest ? latest.amount_drops / 1_000_000 : null;

  let expiresAt = null;
  if (lastTs) {
    const expiry = new Date(lastTs);
    expiry.setDate(expiry.getDate() + config.periodDays);
    expiresAt = expiry.toISOString();
  }

  // Freshness: when was the index last updated?
  const lastCrawl = db.prepare(
    "SELECT value FROM crawl_state WHERE key = 'last_crawl_at'"
  ).get();

  return {
    active: isActive,
    subscriber: subscriberAddress,
    lastPayment: lastTs,
    lastAmount: lastAmt,
    expiresAt,
    totalPaid: (lifetime?.total_drops ?? 0) / 1_000_000,
    subscriptionCount: lifetime?.payments ?? 0,
    verifiedAt,
    freshnessNote: `Index as of ${lastCrawl?.value ?? 'unknown'}`,
  };
}
```

### Python

```python
def check_subscription(db, service_address, service_id, subscriber, price_pft, period_days):
    """Canonical SUBS verification. Returns True if subscriber is active."""
    min_drops = price_pft * 1_000_000
    row = db.execute("""
        SELECT COUNT(*) as c FROM transactions
        WHERE destination = ? AND account = ?
        AND memo_type = 'subs.subscribe'
        AND memo_data_preview LIKE '%' || ? || '%'
        AND CAST(amount_drops AS INTEGER) >= ?
        AND tx_type = 'Payment'
        AND timestamp_iso > datetime('now', ?)
    """, (service_address, subscriber, service_id,
          min_drops, f'-{period_days} days')).fetchone()
    return row['c'] > 0
```

### Shell

```bash
sqlite3 ~/.pf-scout/chain-index.db \
  "SELECT COUNT(*)>0 FROM transactions \
   WHERE destination='$SERVICE_ADDR' AND account='$USER_ADDR' \
   AND memo_type='subs.subscribe' \
   AND memo_data_preview LIKE '%$SERVICE_ID%' \
   AND CAST(amount_drops AS INTEGER)>=500000000 \
   AND tx_type='Payment' \
   AND timestamp_iso > datetime('now','-30 days')"
```

---

## Signed Entitlement Receipts

After verification, services may generate a short-lived receipt for downstream systems to consume without repeated DB reads:

```json
{
  "subscriber": "rsS2Y6CK9dz9...",
  "service_id": "alpha",
  "verified_at": "2026-04-13T02:15:00Z",
  "expires_at": "2026-05-13T00:00:00Z",
  "last_tx_hash": "A1B2C3D4...",
  "receipt_valid_until": "2026-04-13T03:15:00Z",
  "signature": "<service provider signs with their XRPL key>"
}
```

Receipts are a caching optimization, not a trust replacement. The chain remains authoritative. Receipt validity should be short (1 hour) to limit stale-state risk.

---

## Bot Interface

The bot is the primary UX client. It is not the protocol — it is one client of the protocol. If the bot dies, the protocol still functions via direct chain queries and any alternative client.

### User Commands

```
/services                        → List all available services with prices
/subscribe <service_id>          → Subscribe (send with required PFT amount)
/status                          → Your active subscriptions + expiry dates
/status <service_id>             → Check specific subscription status
```

### Provider Commands

```
/register                        → Register a new service (send 100 PFT + JSON memo)
/dashboard                       → Your service stats: active subs, revenue, churn
/update <service_id>             → Update service metadata
```

### Example Interaction

```
Contributor → Bot:  /services
Bot → Contributor:  
  SUBS — 2 services available:
  
  1. alpha | Alpha Terminal | 500 PFT/30d
     AI decision layer for PFT earnings
     3 subscribers | by Permanent Upper Class
  
  2. alerts | Network Alerts | 200 PFT/30d
     Push notifications for network events
     1 subscriber | by community
  
  Send /subscribe <id> with payment to activate.

Contributor → Bot:  /subscribe alpha  [+ 500 PFT payment]
Bot → Contributor:
  Subscribed to Alpha Terminal.
  Active until: 2026-05-13
  Features unlocked: task EV ranking, competition heatmap,
    earnings analytics, timing alerts, AI drafting
  
  Data as of: 2026-04-13T02:00:00Z
```

---

## Bundle Primitives

Cross-service bundling is supported from v1 via the registry:

```json
{
  "bundle_id": "contributor_pro",
  "name": "Contributor Pro Bundle",
  "included_service_ids": ["alpha", "alerts"],
  "individual_total_pft": 700,
  "bundle_price_pft": 550,
  "bundle_discount_bps": 2143,
  "period_days": 30,
  "proof_rule": "subscriber must have active subs.subscribe for each included service_id within the bundle period"
}
```

Services can check each other's subscribers via cross-service queries. A bundle discount is verified by confirming the subscriber holds active subscriptions to all included services.

---

## Earnings Uplift Tracking

The most powerful marketing surface for SUBS services: provable performance data.

```json
{
  "service_id": "alpha",
  "uplift_metrics": {
    "period": "30d",
    "subscriber_cohort_size": 12,
    "non_subscriber_cohort_size": 41,
    "metrics": {
      "median_pft_per_submission": {
        "subscribers": 3200,
        "non_subscribers": 2450,
        "uplift_pct": 30.6
      },
      "completion_rate": {
        "subscribers": 0.48,
        "non_subscribers": 0.39,
        "uplift_pct": 23.1
      },
      "tasks_completed_30d": {
        "subscribers": 18,
        "non_subscribers": 14,
        "uplift_pct": 28.6
      }
    },
    "methodology": "cohort comparison of subscribers vs non-subscribers on identical time window. No self-selection correction in v1.",
    "caveat": "Uplift may reflect subscriber self-selection (higher-performing contributors more likely to subscribe). Causal claims require controlled comparison."
  }
}
```

This is included in `subs.json` once subscriber cohorts are large enough (minimum 5 subscribers for statistical relevance). The caveat is mandatory — honest reporting builds trust faster than inflated claims.

---

## Decision Trace Schema

How an address becomes a subscriber or is denied service:

```json
{
  "decision_trace_schema": {
    "inputs": ["destination", "account", "memo_type", "memo_data", "amount_drops", "tx_type", "timestamp_iso"],
    "verification_rules_in_order": [
      "match_destination",
      "match_subscriber",
      "match_memo_type_subs_subscribe",
      "match_service_id_in_memo_data",
      "meet_minimum_payment",
      "transaction_type_is_payment",
      "within_billing_period"
    ],
    "grant_condition": "ALL seven rules pass",
    "deny_condition": "ANY rule fails",
    "freshness_fallback": "if index stale >60min, check live node account_tx"
  }
}
```

---

## Build Plan

| Phase | What | Time | Output |
|-------|------|------|--------|
| 1 | Verification library (`subs-verify.ts`) + canonical query | 2h | Drop-in module for bot |
| 2 | Bot command router — /services, /subscribe, /status, /register, /dashboard | 4h | Bot handles all SUBS interactions on-chain |
| 3 | `export-subs.sh` — registry + subscriber stats + uplift metrics | 2h | `subs.json` on GitHub Pages |
| 4 | `subs.html` — read-only public directory + protocol docs | 2h | Static page for review |
| 5 | Alpha Terminal (first service) — task EV, timing, earnings, AI drafting | 4h | Premium features gated by /subscribe alpha |

**Total: ~14 hours. SUBS platform (phases 1-4): ~10 hours. Alpha Terminal (phase 5): ~4 hours.**

---

## Protocol Properties

### Why PFTL specifically

1. **Memos are native**. XRPL has first-class memo support on every transaction. No smart contracts needed.
2. **Chain index exists**. We already index every transaction hourly. Subscription verification is just another query.
3. **PFT is the unit of account**. Services price in PFT, subscribers pay in PFT, revenue stays in the ecosystem.
4. **Full history available**. Our archive node means verification works retroactively.

### What makes it composable

- **Cross-service queries**: Service A can check if a user subscribes to Service B.
- **On-chain proof**: Subscriber counts are publicly verifiable.
- **No vendor lock-in**: Any node operator can verify subscriptions independently.
- **Permissionless registration**: Anyone can register a service via the bot.

### Resilience

- **Bot goes offline?** Subscriptions still work. Anyone with a node runs the canonical query.
- **Registry disappears?** Subscriptions still work. The chain has all payment data.
- **Indexer stops?** Subscriptions still work via direct `account_tx` RPC against any node.
- **Our node goes down?** Any PFTL node can serve the same data.

---

## Future Extensions (documented, deferred)

- **Tiered subscriptions**: Multiple price points per service (free/basic/premium) via different `service_id` suffixes
- **Accrual mode**: Overpayment extends duration (opt-in per service)
- **Stacking renewals**: Early renewal adds to remaining days instead of resetting
- **Trial periods**: First N days free, tracked by first-seen timestamp
- **Referral credits**: Memo field `subs.subscribe:alpha:ref:rsS2Y6...`
- **Usage-based billing**: Pay-per-query instead of flat monthly
- **Subscription NFTs**: Mint an NFT as proof of active subscription

These are designed to be additive — they extend the memo data format without breaking existing verification queries.

---

## The Bigger Picture

SUBS is the billing rail for a closed-loop contributor economy.

```
Tasks pay contributors in PFT
    → contributors spend PFT on services that improve task performance
        → service providers earn PFT from subscribers
            → service providers reinvest into the network
                → more services → more reasons to hold PFT → more network value
```

That is a flywheel, not a SaaS feature.

The first killer app is **Alpha Terminal**: a premium contributor edge product that measurably improves PFT earnings. SUBS handles payment and entitlement. Alpha Terminal is the product with teeth.

The endgame is the **Contributor Operating System**: task sourcing, drafting assistance, competition analysis, earnings optimization, reputation building, collaborator matching — all paid in PFT, all verified on-chain, all composable.

**The one-liner**: "The monetization and coordination rail for turning contributors into operators and operators into businesses."
