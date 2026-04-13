# SUBS — On-Chain Subscription Protocol for Post Fiat

## Overview

SUBS is a composable subscription layer for the PFTL chain. Any service provider registers an address and price. Any user subscribes by sending PFT. Any service verifies by querying the chain. No accounts, no APIs, no intermediaries. The ledger is the subscription database.

---

## Protocol Design

### Subscription = Payment

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

That's it. One transaction. The subscriber is now active for that service's billing period.

### Verification = Chain Query

Any service checks subscription status with one query against the chain index:

```sql
SELECT COUNT(*) > 0 as is_active
FROM transactions
WHERE destination = :service_address
  AND account = :subscriber_address
  AND memo_type = 'subs.subscribe'
  AND CAST(amount_drops AS INTEGER) >= :min_price_drops
  AND timestamp_iso > datetime('now', :period)
```

Returns `true` if the subscriber has paid at least the minimum price within the billing period. Deterministic, replayable, no API call needed.

### Cancellation = Inaction

Stop paying. When the billing period expires, verification returns `false`. No unsubscribe flow, no forms, no retention dark patterns.

### Renewal = Re-payment

Send the same transaction again. The verification query checks the rolling window, so any payment within the period keeps the subscription active.

---

## Service Registry

A public JSON file (`subs.json`) hosted on GitHub Pages alongside the Lens feeds. This is the canonical directory of available services on the network.

### Registry Schema

```json
{
  "schema_version": "1.0.0",
  "updated_at": "2026-04-13T02:00:00Z",
  "registry_address": "<SUBS registry address>",
  "services": [
    {
      "service_id": "alpha",
      "name": "Task Alpha",
      "description": "AI co-pilot for PFT task completion. Task analysis, timing signals, earnings optimizer.",
      "provider": "Permanent Upper Class",
      "address": "r3hH6UNw1eVQYiXbDVoarp2kN6JKyTYveT",
      "price_pft": 500,
      "period_days": 30,
      "tier": "premium",
      "features": [
        "AI task analysis and drafting",
        "Personal earnings profile",
        "Optimal submission timing",
        "Network competition alerts",
        "Leaderboard access"
      ],
      "free_features": [
        "Basic rank lookup",
        "Network status"
      ],
      "status": "active",
      "registered_at": "2026-04-13T00:00:00Z",
      "subscribers": 0,
      "memo_type": "subs.subscribe",
      "memo_data": "alpha"
    }
  ],
  "protocol": {
    "memo_type": "subs.subscribe",
    "memo_data_format": "<service_id>",
    "payment_currency": "PFT (drops, 1 PFT = 1,000,000 drops)",
    "verification_method": "chain_query",
    "cancellation": "non-renewal"
  }
}
```

### Service Registration (via Bot)

All registration happens through the SUBS bot on-chain. Send a memo to the bot address:

```
MemoType:  "subs.register"
MemoData:  "<service_id>:<name>:<price_pft>:<period_days>:<description>"
Amount:    100 PFT (registration fee, prevents spam)
```

The bot confirms registration by replying on-chain with the service details. The service is immediately live in the registry.

**Bot commands for registration:**
```
/register <service_id> <price> <period_days> <description>
```

The bot validates the input, charges the 100 PFT registration fee from the incoming payment, and adds the service to the registry. All on-chain.

---

## Verification Library

A lightweight module that any PFTL service can import to check subscriptions.

### TypeScript (for bots/services on Node.js)

```typescript
// subs-verify.ts

interface SubsConfig {
  dbPath: string;          // path to chain-index.db
  serviceAddress: string;  // your service's XRPL address
  serviceId: string;       // your service_id in the registry
  pricePft: number;        // minimum payment in PFT
  periodDays: number;      // billing period
}

interface SubsStatus {
  active: boolean;
  subscriber: string;
  lastPayment: string | null;     // ISO timestamp
  lastAmount: number | null;      // PFT
  expiresAt: string | null;       // ISO timestamp
  totalPaid: number;              // lifetime PFT
  subscriptionCount: number;      // number of payments
}

function checkSubscription(
  db: Database,
  config: SubsConfig,
  subscriberAddress: string
): SubsStatus {
  const periodClause = `-${config.periodDays} days`;
  const minDrops = config.pricePft * 1_000_000;

  // Find most recent qualifying payment
  const latest = db.prepare(`
    SELECT timestamp_iso, CAST(amount_drops AS INTEGER) as amount_drops
    FROM transactions
    WHERE destination = ?
      AND account = ?
      AND memo_type = 'subs.subscribe'
      AND CAST(amount_drops AS INTEGER) >= ?
    ORDER BY timestamp_iso DESC
    LIMIT 1
  `).get(config.serviceAddress, subscriberAddress, minDrops);

  // Check if within billing period
  const activePayment = db.prepare(`
    SELECT COUNT(*) as c
    FROM transactions
    WHERE destination = ?
      AND account = ?
      AND memo_type = 'subs.subscribe'
      AND CAST(amount_drops AS INTEGER) >= ?
      AND timestamp_iso > datetime('now', ?)
  `).get(config.serviceAddress, subscriberAddress, minDrops, periodClause);

  // Lifetime stats
  const lifetime = db.prepare(`
    SELECT COUNT(*) as payments,
           SUM(CAST(amount_drops AS INTEGER)) as total_drops
    FROM transactions
    WHERE destination = ?
      AND account = ?
      AND memo_type = 'subs.subscribe'
  `).get(config.serviceAddress, subscriberAddress);

  const isActive = (activePayment?.c ?? 0) > 0;
  const lastTs = latest?.timestamp_iso ?? null;
  const lastAmt = latest ? latest.amount_drops / 1_000_000 : null;

  // Calculate expiry
  let expiresAt = null;
  if (lastTs) {
    const expiry = new Date(lastTs);
    expiry.setDate(expiry.getDate() + config.periodDays);
    expiresAt = expiry.toISOString();
  }

  return {
    active: isActive,
    subscriber: subscriberAddress,
    lastPayment: lastTs,
    lastAmount: lastAmt,
    expiresAt,
    totalPaid: (lifetime?.total_drops ?? 0) / 1_000_000,
    subscriptionCount: lifetime?.payments ?? 0,
  };
}
```

### Python (for API services)

```python
def check_subscription(db, service_address, subscriber, price_pft, period_days):
    min_drops = price_pft * 1_000_000
    row = db.execute("""
        SELECT COUNT(*) as c FROM transactions
        WHERE destination = ? AND account = ?
        AND memo_type = 'subs.subscribe'
        AND CAST(amount_drops AS INTEGER) >= ?
        AND timestamp_iso > datetime('now', ?)
    """, (service_address, subscriber, min_drops, f'-{period_days} days')).fetchone()
    return row['c'] > 0
```

Three lines. Any Python service can verify subscriptions.

### Shell (one-liner for scripts)

```bash
# Check if $USER_ADDR is subscribed to $SERVICE_ADDR (500 PFT / 30 days)
sqlite3 ~/.pf-scout/chain-index.db \
  "SELECT COUNT(*)>0 FROM transactions \
   WHERE destination='$SERVICE_ADDR' AND account='$USER_ADDR' \
   AND memo_type='subs.subscribe' \
   AND CAST(amount_drops AS INTEGER)>=500000000 \
   AND timestamp_iso > datetime('now','-30 days')"
```

---

## Bot Interface

The SUBS bot is the primary interface for everything — subscribing, registering, managing, and discovering services. All interactions happen on-chain via memos to the bot address.

### User Commands (send as memo to bot)

```
/services                        → List all available services
/subscribe <service_id>          → Subscribe (send with required PFT amount)
/status                          → Your active subscriptions + expiry dates
/status <service_id>             → Check specific subscription status
/cancel <service_id>             → Reminder of expiry (no action needed — just stop paying)
```

### Provider Commands

```
/register <id> <price> <period> <description>   → Register new service (send 100 PFT)
/dashboard                                       → Your service stats: subscribers, revenue
/update <service_id> <field> <value>             → Update service details
```

### Example Interaction

```
Contributor → Bot:  /services
Bot → Contributor:  
  SUBS — 2 services available:
  
  1. alpha | Task Alpha | 500 PFT/30d
     AI co-pilot for PFT task completion
     3 subscribers | by Permanent Upper Class
  
  2. alerts | Network Alerts | 200 PFT/30d
     Push notifications for network events
     1 subscriber | by community
  
  Send /subscribe <id> with payment to activate.

Contributor → Bot:  /subscribe alpha  [+ 500 PFT payment]
Bot → Contributor:
  Subscribed to Task Alpha.
  Active until: 2026-05-13
  Features unlocked: task analysis, timing signals, leaderboard
```

### Dashboard Page (subs.html)

A static read-only page on GitHub Pages for public visibility. Shows the service directory, subscriber counts, and protocol documentation. Not interactive — the bot handles all actions.

```
┌─────────────────────────────────────────────────────────┐
│  SUBS — Post Fiat Service Marketplace                    │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  How it works:                                           │
│  1. Message the SUBS bot: r3hH6UNw1eVQ...               │
│  2. Send /services to browse                             │
│  3. Send /subscribe <id> with PFT payment               │
│  4. Done. Your subscription is on-chain.                 │
│                                                          │
│  Services:                                               │
│  ┌─────────────────────────────────────────────┐        │
│  │  Task Alpha                    500 PFT/mo   │        │
│  │  3 subscribers │ 1,500 PFT revenue          │        │
│  └─────────────────────────────────────────────┘        │
│                                                          │
│  Protocol:                                               │
│  Verification: deterministic chain query                 │
│  Cancellation: non-renewal                               │
│  Registry: subs.json (machine-readable)                  │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## Indexer Integration

The existing hourly indexer pipeline needs one addition: detect `subs.subscribe` and `subs.register` memo types.

### Changes to crawler.ts

The memo parser already extracts `memoType` and `memoData`. No changes needed to indexing — these transactions are already stored in the `transactions` table.

### New export: export-subs.sh

Added to the hourly cron pipeline:

```
crawl → classify → sybil → export audit → export graph → export health → export auth → export subs
```

Generates `subs.json` with:
- Service registry (static config + on-chain registrations)
- Per-service subscriber counts and revenue (from chain queries)
- Protocol metadata

---

## Build Plan

| Phase | What | Time | Output |
|-------|------|------|--------|
| 1 | Verification library (TS + Python) | 2h | `subs-verify.ts`, `subs_verify.py` |
| 2 | Bot command router — /services, /subscribe, /status, /register, /dashboard | 4h | SUBS bot handles all interactions on-chain |
| 3 | `export-subs.sh` — registry + subscriber stats from chain data | 2h | `subs.json` on GitHub Pages |
| 4 | `subs.html` — read-only public directory page | 2h | Static dashboard |
| 5 | Alpha Bot (first SUBS service) — task analysis + timing gated by subscription | 4h | Premium features behind /subscribe alpha |

**Total: ~14 hours. SUBS platform (phases 1-4): ~10 hours. Alpha as first service (phase 5): ~4 hours.**

Everything runs through the bot. The dashboard is a read-only window into the registry for public visibility and review.

---

## Protocol Properties

### Why this works on PFTL specifically

1. **Memos are native**. XRPL/PFTL has first-class memo support on every transaction. No smart contracts needed.
2. **Chain index exists**. We already index every transaction hourly. Subscription verification is just another query.
3. **PFT is the unit of account**. Services price in PFT, subscribers pay in PFT, revenue stays in the ecosystem.
4. **Full history available**. Our archive node means subscription verification works retroactively — we can see every payment ever made.

### What makes it composable

- **Cross-service queries**: Service A can check if a user is subscribed to Service B. Enables bundles, loyalty tiers, partner discounts.
- **On-chain proof**: Subscription status is publicly verifiable. A service can prove its subscriber count without trust.
- **No vendor lock-in**: Any service can verify subscriptions independently using the chain. If our indexer goes down, anyone with a node can verify.
- **Permissionless registration**: Anyone can register a service. The registry is a convenience layer, not a gatekeeper.

### Trust model

- **Subscribers trust the chain**, not the service provider. Payment is on-chain, verification is deterministic.
- **Services trust the chain**, not subscribers. No fake subscriptions, no chargebacks, no stolen credentials.
- **The registry is informational**, not authoritative. Even if `subs.json` disappeared, subscriptions would still work via direct chain queries.

---

## Future Extensions (not building now)

- **Tiered subscriptions**: Multiple price points per service (free/basic/premium)
- **Trial periods**: First N days free, tracked by first-seen timestamp
- **Referral credits**: Memo field `subs.subscribe:alpha:ref:rsS2Y6...` — referrer gets a credit
- **Usage-based billing**: Pay-per-query instead of flat monthly
- **DAO governance**: Service registry managed by PFT holders voting on-chain
- **Subscription NFTs**: Mint an NFT as proof of active subscription (XRPL has native NFTs)

These are documented but explicitly deferred. The protocol is designed to accommodate them without breaking changes.

---

## The Bigger Picture

SUBS turns Post Fiat from a task-reward network into a **service economy**.

Right now: Task Node → proposes work → contributors complete → earn PFT → hold or sell.

With SUBS: Task Node → proposes work → contributors complete → earn PFT → **spend PFT on services that help them earn more PFT**.

The circular economy:
1. Contributors earn PFT from tasks
2. They spend PFT on services (Alpha, analytics, alerts, AI tools)
3. Service providers earn PFT from subscribers
4. Service providers are also contributors who earn from tasks
5. More services → more reasons to hold PFT → more network value

SUBS is the plumbing that makes PFT useful beyond "task completion token." It becomes the currency of an on-chain service marketplace.

**The one-liner**: "Stripe for crypto services, but the blockchain is the database and PFT is the only currency."
