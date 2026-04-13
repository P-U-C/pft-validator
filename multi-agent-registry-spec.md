# Multi-Agent Bot Identity Registry — Implementation Specification

## Post Fiat Network · Agent Identity Layer

**Version**: 1.0.0  
**Status**: Implementation-ready  
**Published**: 2026-04-13  
**Author**: Permanent Upper Class (rsS2Y6CK9dz9dVFjJvRyD2gBdoLPqjaXRZ)

---

## 1. Purpose

This specification defines a multi-agent identity registry that separates operator identity from per-wallet bot identity while preserving anti-abuse controls. It enables one operator to register and manage multiple bots — each with its own on-chain wallet, keystone API key, name, and command surface — without identity collision.

### Problem Statement

The current Keystone agent registry derives `agent_id` from the API key, not from the bot wallet. When one operator registers multiple bots using the same API key, each registration overwrites the previous one. This creates a hard limit of one bot per API key.

**Observed behavior** (2026-04-13): registering bot "SUBS" (`r9XYDxJDb...`) with the same keystone API key as bot "Lens" (`r3hH6UNw...`) produced `agent_id = r3hH6UNw...` for both, overwriting Lens.

**Resolution discovered**: omitting the shared API key and letting the MCP auto-provision a new key per bot wallet via the challenge-response auth flow produces a distinct `agent_id` per wallet. This confirms the system already supports multi-agent identity — it just lacks the formal registry, ownership model, and anti-abuse controls.

### Scope

This spec covers:
- Operator and bot identity schemas
- Ownership proof and key provisioning flow
- Registration, update, and deregistration state machines
- Slot limits, funding gates, inactivity expiry
- Trust inheritance and community abuse flags
- Implementation handoff for indexer, API, and directory surfaces

It does not cover: bot-to-bot communication protocols, service-level entitlements (see SUBS spec), or on-chain governance voting.

---

## 2. Schemas

### 2.1 `operator` Schema

An operator is a human or organization that owns and manages one or more bots on the network.

```json
{
  "$schema": "operator/1.0.0",
  "operator_id": "string — XRPL address of the operator's primary wallet",
  "display_name": "string — human-readable operator name, max 64 chars",
  "description": "string — what this operator does, max 256 chars",
  "primary_wallet": "string — XRPL address used for staking and governance",
  "registered_at": "string — ISO 8601 timestamp of first registration",
  "status": "active | suspended | deactivated",
  "trust_tier": "new | established | trusted",
  "trust_score": "number — 0.0 to 1.0, computed from on-chain behavior",
  "slot_limit": "integer — max bots this operator can register (derived from trust_tier)",
  "slots_used": "integer — current number of registered bots",
  "stake_balance_drops": "integer — PFT staked in operator wallet (on-chain, not locked)",
  "total_bot_subscribers": "integer — aggregate subscribers across all bots",
  "flags": {
    "community_flags": "integer — number of abuse reports from other users",
    "flag_threshold": "integer — flags needed to trigger review",
    "under_review": "boolean"
  },
  "bots": ["string — array of bot agent_ids owned by this operator"]
}
```

**Operator identity**: the `operator_id` is the XRPL address of the operator's primary wallet. This is the trust anchor — an operator's reputation is tied to this address.

### 2.2 `bot` Schema

A bot is an autonomous agent with its own wallet, keystone identity, and command surface.

```json
{
  "$schema": "bot/1.0.0",
  "agent_id": "string — XRPL address of the bot wallet (unique per bot)",
  "operator_id": "string — XRPL address of the owning operator",
  "keystone_key_id": "string — hash of the keystone API key (not the key itself)",
  "name": "string — bot display name, max 32 chars",
  "description": "string — what this bot does, max 256 chars",
  "wallet_address": "string — XRPL address (same as agent_id)",
  "status": "active | paused | deregistered | suspended",
  "registered_at": "string — ISO 8601",
  "last_ping_at": "string — ISO 8601, from heartbeat",
  "capabilities": ["string — semantic capability URIs"],
  "supported_commands": [
    {
      "command": "string — e.g., /services",
      "description": "string",
      "example": "string",
      "min_cost_drops": "string — minimum PFT payment to invoke"
    }
  ],
  "icon_emoji": "string — display emoji",
  "icon_color_hex": "string — accent color",
  "balance_drops": "integer — current wallet balance (on-chain)",
  "min_balance_drops": "integer — minimum required to remain active",
  "inactivity_deadline": "string — ISO 8601, auto-deregister if no ping by this time",
  "trust_inherited": "boolean — inherits operator trust tier",
  "flags": {
    "community_flags": "integer",
    "under_review": "boolean"
  }
}
```

**Key invariant**: `agent_id` = `wallet_address`. Each bot has a unique on-chain identity derived from its wallet, not from a shared operator key.

### 2.3 `ownership_record` Schema

Links an operator to a bot with cryptographic proof.

```json
{
  "$schema": "ownership_record/1.0.0",
  "operator_id": "string — operator XRPL address",
  "bot_agent_id": "string — bot XRPL address",
  "proof_type": "keystone_challenge | on_chain_memo | operator_signature",
  "proof_data": {
    "challenge_nonce": "string — nonce from keystone requestApiKey",
    "signature_hex": "string — operator wallet signature over nonce + bot_address",
    "verified_at": "string — ISO 8601",
    "keystone_key_hash": "string — SHA-256 of the provisioned API key"
  },
  "created_at": "string — ISO 8601",
  "revoked_at": "string | null — ISO 8601 if ownership was revoked",
  "status": "active | revoked"
}
```

---

## 3. Key Provisioning and Ownership Proof Flow

### 3.1 How It Works Today

The Keystone gRPC service provides a challenge-response auth flow:

```
1. Client calls requestApiKey(walletAddress)
   → Server returns { challengeNonce, expiresAtUnix }

2. Client signs the challengeNonce with the wallet's private key
   → signatureHex = sign(challengeNonce, privateKey)

3. Client calls verifyAndIssueKey(walletAddress, challengeNonce, signatureHex, label)
   → Server verifies signature against on-chain public key
   → Server issues { apiKey, walletAddress, writeLimitPerHour, readLimitPerHour }

4. Client uses apiKey for all subsequent gRPC calls
   → agent_id in the registry is derived from this apiKey
```

### 3.2 Multi-Agent Flow (Current Workaround)

To register multiple bots, the operator provisions a separate API key per bot wallet:

```
Operator (rsS2Y6CK...) owns:
  Bot A wallet: r3hH6UNw... → requestApiKey(r3hH6UNw) → apiKey_A → agent_id = r3hH6UNw
  Bot B wallet: r9XYDxJDb... → requestApiKey(r9XYDxJDb) → apiKey_B → agent_id = r9XYDxJDb
```

Each bot gets its own keystone key, and the `agent_id` resolves to the bot's wallet address. No collision.

### 3.3 Proposed Ownership Proof (Formal)

To formalize the operator→bot relationship:

```
Step 1: Operator registers as an operator
  → POST /registry/operators { operator_id: "rsS2Y6CK...", name: "Permanent Upper Class" }
  → Requires: signature from rsS2Y6CK... over registration payload

Step 2: Operator provisions a bot
  → Bot wallet r9XYDxJDb... obtains its own keystone API key via challenge-response
  → Bot registers via register_bot (name, commands, etc.)
  → agent_id = r9XYDxJDb... (derived from bot wallet's keystone key)

Step 3: Operator claims ownership
  → POST /registry/ownership { operator_id: "rsS2Y6CK...", bot_agent_id: "r9XYDxJDb..." }
  → Proof: operator signs message "CLAIM_BOT:r9XYDxJDb...:1713025200" with rsS2Y6CK... private key
  → Registry verifies signature and creates ownership_record

Step 4: Directory displays grouping
  → "By Permanent Upper Class: Lens (r3hH6UNw...), SUBS (r9XYDxJDb...)"
```

### 3.4 Alternative: On-Chain Memo Proof

Ownership can also be proven by an on-chain transaction:

```
Transaction: Payment (1 PFT minimum)
  Account:     rsS2Y6CK... (operator)
  Destination: r9XYDxJDb... (bot)
  Memos: [{
    MemoType:  "registry.claim"
    MemoData:  "CLAIM_BOT:r9XYDxJDb..."
  }]
```

The indexer detects this memo and creates the ownership record. This is fully on-chain and publicly verifiable.

---

## 4. State Transitions

### 4.1 Operator Lifecycle

```
                register
  (none) ─────────────────► ACTIVE
                               │
                ┌──────────────┼──────────────┐
                │              │              │
          suspend         deactivate     flags exceed
                │              │          threshold
                ▼              ▼              │
          SUSPENDED      DEACTIVATED         │
                │                             ▼
            reinstate                    UNDER_REVIEW
                │                             │
                ▼                        resolve │ suspend
              ACTIVE ◄───────────────────┘      │
                                                 ▼
                                            SUSPENDED
```

| From | Event | To | Conditions |
|------|-------|----|------------|
| (none) | `register` | `active` | Valid wallet, signature verified |
| `active` | `deactivate` | `deactivated` | Self-service, all bots deregistered first |
| `active` | `suspend` | `suspended` | Admin action or flags exceed threshold |
| `active` | `flags_exceed_threshold` | `active` + `under_review: true` | community_flags >= flag_threshold |
| `suspended` | `reinstate` | `active` | Admin action, flags resolved |
| `deactivated` | `register` | `active` | Re-registration allowed |

### 4.2 Bot Lifecycle

```
                register
  (none) ─────────────────► ACTIVE
                               │
                ┌──────────────┼──────────────┐
                │              │              │
            pause        deregister     inactivity
                │              │          timeout
                ▼              ▼              │
            PAUSED       DEREGISTERED        │
                │                             ▼
            resume                      DEREGISTERED
                │                        (auto)
                ▼
              ACTIVE
```

| From | Event | To | Conditions |
|------|-------|----|------------|
| (none) | `register` | `active` | Wallet funded, operator has available slot, keystone key provisioned |
| `active` | `pause` | `paused` | Operator action. Bot stops responding but retains registration. |
| `paused` | `resume` | `active` | Operator action. |
| `active` | `deregister` | `deregistered` | Operator action. Keystone key revoked. Slot freed. |
| `paused` | `deregister` | `deregistered` | Operator action. |
| `active` | `inactivity_timeout` | `deregistered` | No heartbeat ping for 30 days. |
| `active` | `suspend` | `suspended` | Admin or operator-level suspension propagates. |
| `active` | `balance_below_minimum` | `paused` | Wallet balance drops below min_balance_drops. |

### 4.3 Ownership Lifecycle

| From | Event | To | Conditions |
|------|-------|----|------------|
| (none) | `claim` | `active` | Valid signature or on-chain memo proof |
| `active` | `revoke` | `revoked` | Operator action. Bot becomes orphaned. |
| `active` | `transfer` | `revoked` + new `active` | Old operator revokes, new operator claims |

---

## 5. Deterministic Rules

### 5.1 Slot Limits

Operators earn bot registration slots based on trust tier:

| Trust Tier | Max Bots | Criteria |
|------------|----------|----------|
| `new` | 2 | Default for new operators |
| `established` | 5 | 30+ days active, 10+ task completions, 50K+ PFT earned |
| `trusted` | 20 | 90+ days active, 50+ task completions, 200K+ PFT earned, 0 unresolved flags |

**Slot enforcement**: `register_bot` fails with `SLOT_LIMIT_EXCEEDED` if `slots_used >= slot_limit`.

**Slot reclamation**: deregistering or auto-expiring a bot frees the slot immediately.

### 5.2 Minimum Balance / Stake Gating

| Gate | Requirement | Enforced At |
|------|-------------|-------------|
| Bot wallet activation | >= 15 PFT (XRPL reserve) | On-chain (ledger enforced) |
| Bot registration | >= 25 PFT in bot wallet | `register_bot` checks balance |
| Bot active status | >= 10 PFT in bot wallet | Hourly check; drops below → auto-pause |
| Operator registration | >= 100 PFT in operator wallet | Operator registration |
| Operator trusted tier | >= 1,000 PFT in operator wallet | Trust tier computation |

**Why PFT balance, not staking locks**: PFT balance is publicly verifiable on-chain without a staking contract. The balance requirement creates skin-in-the-game without protocol complexity. Operators who drain their wallets lose bot slots.

### 5.3 Inactivity Expiry

| Rule | Threshold | Action |
|------|-----------|--------|
| Bot heartbeat timeout | 30 days without `ping` | Auto-deregister, free slot |
| Bot zero-activity timeout | 60 days without any transaction | Auto-deregister, free slot |
| Operator dormancy | 90 days without any bot activity | Trust tier resets to `new` |
| Grace period | 7 days warning before auto-deregister | Directory shows "expiring" badge |

**Heartbeat**: bots must call `pingAgent()` at least once per 30 days. The `last_ping_at` timestamp is publicly visible. The 7-day grace window allows operators to recover before losing registration.

**Inactivity check** is run by the indexer hourly:

```sql
-- Find bots due for auto-deregister
SELECT agent_id, operator_id, last_ping_at
FROM bots
WHERE status = 'active'
  AND last_ping_at < datetime('now', '-30 days')
ORDER BY last_ping_at ASC;
```

### 5.4 Community Abuse Flags

Any wallet holder can flag a bot by sending an on-chain memo:

```
Transaction: Payment (1 PFT minimum)
  Account:     <flagger wallet>
  Destination: <registry address>
  Memos: [{
    MemoType:  "registry.flag"
    MemoData:  "<bot_agent_id>:<reason_code>"
  }]
```

**Reason codes**: `spam`, `impersonation`, `scam`, `broken`, `offensive`, `other`

**Flag rules**:

| Rule | Value |
|------|-------|
| Cost to flag | 1 PFT (prevents spam flagging) |
| One flag per wallet per bot per 30 days | Deduplication |
| Flag threshold for review | 5 unique flaggers |
| Flag threshold for auto-pause | 10 unique flaggers |
| Flag decay | Flags older than 90 days stop counting |
| Flag resolution | Operator responds or admin reviews |

**Anti-gaming**: a wallet that flags > 20 bots per month is itself flagged as a potential harassment account. Flags from flagged accounts don't count.

---

## 6. Trust Inheritance

Bots inherit their operator's trust tier by default:

```
Operator "Permanent Upper Class" (trusted, score 0.92)
  └── Bot "Lens" → inherits trusted tier, shown in directory as trusted
  └── Bot "SUBS" → inherits trusted tier, shown in directory as trusted
```

**Override**: a bot with its own abuse flags may have trust downgraded independent of the operator. If a bot accumulates 5+ flags, its trust is capped at `new` regardless of operator tier until flags are resolved.

**Propagation**: if an operator is suspended, all their bots are immediately suspended. If an operator is reinstated, bots return to their prior state.

**Trust score formula** (deterministic):

```
operator_trust_score = (
  0.30 * min(active_days / 90, 1.0) +        // longevity
  0.25 * min(task_completions / 50, 1.0) +    // productivity
  0.20 * min(total_earned_pft / 200000, 1.0) + // value created
  0.15 * min(total_bot_subscribers / 20, 1.0) + // service adoption
  0.10 * (1.0 - min(community_flags / 10, 1.0)) // reputation
)
```

---

## 7. Worked Example: One Operator, Two Bots

### Scenario

Operator "Permanent Upper Class" (`rsS2Y6CK9dz9dVFjJvRyD2gBdoLPqjaXRZ`) registers two bots: Lens (network intelligence) and SUBS (subscription marketplace).

### Step 1: Operator Registration

```json
{
  "event": "operator_register",
  "operator_id": "rsS2Y6CK9dz9dVFjJvRyD2gBdoLPqjaXRZ",
  "display_name": "Permanent Upper Class",
  "description": "Network intelligence and service infrastructure for Post Fiat",
  "stake_balance_drops": 291167000000,
  "trust_tier": "trusted",
  "slot_limit": 20,
  "slots_used": 0,
  "registered_at": "2026-03-19T00:00:00Z"
}
```

### Step 2: Register Bot A — Lens

```
2a. Provision keystone key for Lens wallet:
    requestApiKey("r3hH6UNw1eVQYiXbDVoarp2kN6JKyTYveT")
    → challengeNonce: "abc123..."
    signChallenge(challengeNonce, lens_private_key)
    verifyAndIssueKey(...) → apiKey_A

2b. Register bot:
    register_bot(name: "Lens", description: "Network intelligence...", ...)
    → agent_id: "r3hH6UNw1eVQYiXbDVoarp2kN6JKyTYveT"

2c. Claim ownership:
    Operator signs: "CLAIM_BOT:r3hH6UNw1eVQYiXbDVoarp2kN6JKyTYveT:1713025200"
    → ownership_record created
```

**Bot A state:**

```json
{
  "agent_id": "r3hH6UNw1eVQYiXbDVoarp2kN6JKyTYveT",
  "operator_id": "rsS2Y6CK9dz9dVFjJvRyD2gBdoLPqjaXRZ",
  "name": "Lens",
  "status": "active",
  "icon_emoji": "🔍",
  "icon_color_hex": "#DBB85C",
  "supported_commands": ["/pulse", "/whales", "/active", "/check", "/connections", "/help"],
  "trust_inherited": true,
  "balance_drops": 24000000
}
```

### Step 3: Register Bot B — SUBS

```
3a. Provision keystone key for SUBS wallet (SEPARATE from Lens):
    requestApiKey("r9XYDxJDbmmhSGNpUguVhea6xn3Tu2HbeF")
    → challengeNonce: "def456..."
    signChallenge(challengeNonce, subs_private_key)
    verifyAndIssueKey(...) → apiKey_B (DIFFERENT from apiKey_A)

3b. Register bot:
    register_bot(name: "SUBS", description: "Subscribe to services...", ...)
    → agent_id: "r9XYDxJDbmmhSGNpUguVhea6xn3Tu2HbeF" (DISTINCT from Lens)

3c. Claim ownership:
    Operator signs: "CLAIM_BOT:r9XYDxJDbmmhSGNpUguVhea6xn3Tu2HbeF:1713025200"
    → ownership_record created
```

**Bot B state:**

```json
{
  "agent_id": "r9XYDxJDbmmhSGNpUguVhea6xn3Tu2HbeF",
  "operator_id": "rsS2Y6CK9dz9dVFjJvRyD2gBdoLPqjaXRZ",
  "name": "SUBS",
  "status": "active",
  "icon_emoji": "🔑",
  "icon_color_hex": "#5EEA96",
  "supported_commands": ["/services", "/status", "/subscribe", "/help"],
  "trust_inherited": true,
  "balance_drops": 25000000
}
```

### Step 4: Operator State After Both Registrations

```json
{
  "operator_id": "rsS2Y6CK9dz9dVFjJvRyD2gBdoLPqjaXRZ",
  "display_name": "Permanent Upper Class",
  "trust_tier": "trusted",
  "trust_score": 0.92,
  "slot_limit": 20,
  "slots_used": 2,
  "bots": [
    "r3hH6UNw1eVQYiXbDVoarp2kN6JKyTYveT",
    "r9XYDxJDbmmhSGNpUguVhea6xn3Tu2HbeF"
  ],
  "total_bot_subscribers": 0,
  "flags": { "community_flags": 0, "under_review": false }
}
```

### Step 5: Directory Display

```
┌─────────────────────────────────────────────────────────────┐
│  Permanent Upper Class                      TRUSTED ★★★    │
│  2 bots · 291K PFT staked · 49 tasks completed             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  🔍 Lens                              r3hH6UNw...  ACTIVE  │
│  Network intelligence for Post Fiat                         │
│  /pulse /whales /active /check /connections /help           │
│                                                             │
│  🔑 SUBS                              r9XYDxJDb...  ACTIVE  │
│  Subscribe to services on Post Fiat                         │
│  /services /status /subscribe /help                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 8. Implementation Handoff

### 8.1 Indexer Surface

The chain indexer must detect registry-related on-chain memos and maintain bot/operator state.

**New memo types to index:**

| MemoType | Meaning | Action |
|----------|---------|--------|
| `registry.claim` | Operator claims bot ownership | Create ownership_record |
| `registry.revoke` | Operator revokes bot ownership | Set ownership_record.status = revoked |
| `registry.flag` | User flags a bot | Increment bot.flags.community_flags |

**New tables:**

```sql
-- Operator registry
CREATE TABLE operators (
  operator_id TEXT PRIMARY KEY,           -- XRPL address
  display_name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',  -- active | suspended | deactivated
  trust_tier TEXT NOT NULL DEFAULT 'new', -- new | established | trusted
  trust_score REAL NOT NULL DEFAULT 0.0,
  slot_limit INTEGER NOT NULL DEFAULT 2,
  slots_used INTEGER NOT NULL DEFAULT 0,
  registered_at TEXT NOT NULL,
  last_activity_at TEXT
);

-- Bot registry
CREATE TABLE bots (
  agent_id TEXT PRIMARY KEY,              -- XRPL address (= wallet)
  operator_id TEXT NOT NULL REFERENCES operators(operator_id),
  keystone_key_hash TEXT,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',  -- active | paused | deregistered | suspended
  registered_at TEXT NOT NULL,
  last_ping_at TEXT,
  icon_emoji TEXT,
  icon_color_hex TEXT,
  balance_drops INTEGER DEFAULT 0,
  commands_json TEXT,                     -- JSON array of command descriptors
  capabilities_json TEXT,                 -- JSON array of capability URIs
  community_flags INTEGER DEFAULT 0,
  under_review INTEGER DEFAULT 0
);
CREATE INDEX idx_bots_operator ON bots(operator_id);
CREATE INDEX idx_bots_status ON bots(status);

-- Ownership records
CREATE TABLE ownership_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  operator_id TEXT NOT NULL,
  bot_agent_id TEXT NOT NULL,
  proof_type TEXT NOT NULL,               -- keystone_challenge | on_chain_memo
  proof_tx_hash TEXT,
  status TEXT NOT NULL DEFAULT 'active',  -- active | revoked
  created_at TEXT NOT NULL,
  revoked_at TEXT,
  UNIQUE(operator_id, bot_agent_id, status)
);

-- Abuse flags
CREATE TABLE bot_flags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bot_agent_id TEXT NOT NULL,
  flagger_address TEXT NOT NULL,
  reason_code TEXT NOT NULL,
  flag_tx_hash TEXT,
  flagged_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,               -- flagged_at + 90 days
  UNIQUE(bot_agent_id, flagger_address)   -- one flag per wallet per bot
);
CREATE INDEX idx_flags_bot ON bot_flags(bot_agent_id);
```

**Hourly indexer jobs:**

```sql
-- Auto-deregister inactive bots (no ping in 30 days)
UPDATE bots SET status = 'deregistered'
WHERE status = 'active'
  AND last_ping_at < datetime('now', '-30 days');

-- Auto-pause underfunded bots
UPDATE bots SET status = 'paused'
WHERE status = 'active'
  AND balance_drops < 10000000;  -- 10 PFT minimum

-- Expire old flags
DELETE FROM bot_flags
WHERE expires_at < datetime('now');

-- Recompute operator trust scores
-- (run after balance/activity updates)
```

### 8.2 API Surface

**Registry read endpoints** (public, no auth):

| Endpoint | Method | Response |
|----------|--------|----------|
| `GET /registry/operators` | List all operators | `{ operators: [operator[]] }` |
| `GET /registry/operators/:id` | Get operator + their bots | `{ operator, bots: [bot[]] }` |
| `GET /registry/bots` | List all active bots | `{ bots: [bot[]], total: number }` |
| `GET /registry/bots/:agent_id` | Get bot details | `{ bot, operator, ownership }` |
| `GET /registry/bots/:agent_id/flags` | Get flag history | `{ flags: [flag[]], total: number }` |
| `GET /registry/directory` | Grouped directory | `{ operators: [{ operator, bots }] }` |

**Example: Directory response**

```json
{
  "schema_version": "1.0.0",
  "generated_at": "2026-04-13T18:00:00Z",
  "operators": [
    {
      "operator_id": "rsS2Y6CK9dz9dVFjJvRyD2gBdoLPqjaXRZ",
      "display_name": "Permanent Upper Class",
      "trust_tier": "trusted",
      "trust_score": 0.92,
      "slots_used": 2,
      "slot_limit": 20,
      "bots": [
        {
          "agent_id": "r3hH6UNw1eVQYiXbDVoarp2kN6JKyTYveT",
          "name": "Lens",
          "description": "Network intelligence for Post Fiat",
          "status": "active",
          "icon_emoji": "🔍",
          "icon_color_hex": "#DBB85C",
          "commands": ["/pulse", "/whales", "/active", "/check", "/connections", "/help"],
          "last_ping_at": "2026-04-13T17:50:00Z",
          "subscribers": 0
        },
        {
          "agent_id": "r9XYDxJDbmmhSGNpUguVhea6xn3Tu2HbeF",
          "name": "SUBS",
          "description": "Subscribe to services on Post Fiat",
          "status": "active",
          "icon_emoji": "🔑",
          "icon_color_hex": "#5EEA96",
          "commands": ["/services", "/status", "/subscribe", "/help"],
          "last_ping_at": "2026-04-13T17:50:00Z",
          "subscribers": 0
        }
      ]
    }
  ],
  "stats": {
    "total_operators": 1,
    "total_bots": 2,
    "total_active_bots": 2,
    "total_subscribers": 0
  }
}
```

**Registry write endpoints** (require keystone auth or on-chain memo):

| Endpoint | Method | Auth | Action |
|----------|--------|------|--------|
| `POST /registry/operators` | Register operator | Wallet signature | Create operator |
| `POST /registry/bots` | Register bot | Keystone API key | Create bot (uses existing register_bot flow) |
| `POST /registry/ownership/claim` | Claim bot | Operator wallet signature | Create ownership_record |
| `POST /registry/bots/:id/pause` | Pause bot | Operator keystone key | Set status = paused |
| `POST /registry/bots/:id/resume` | Resume bot | Operator keystone key | Set status = active |
| `DELETE /registry/bots/:id` | Deregister bot | Operator keystone key | Set status = deregistered, free slot |
| `POST /registry/flag` | Flag a bot | On-chain memo (1 PFT) | Create flag record |

### 8.3 Directory Surface

The directory is a public read-only UI showing all registered operators and bots, grouped by operator. It consumes the `/registry/directory` API endpoint.

**Display rules:**

| Element | Rule |
|---------|------|
| Operator trust badge | ★ new, ★★ established, ★★★ trusted |
| Bot status badge | Green = active, Yellow = paused, Red = deregistered, Gray = expired |
| Expiring warning | "Expiring in X days" when last_ping_at > 23 days ago |
| Under review badge | Orange "Under Review" if community_flags >= flag_threshold |
| Sorted by | Operator trust_score DESC, then bot name ASC |
| Grouped by | Operator, with bot cards nested |

**Example: directory-registry.json** (static export, hourly):

```json
{
  "schema_version": "1.0.0",
  "exported_at": "2026-04-13T18:00:00Z",
  "operators": [...],
  "stats": {...},
  "anti_abuse": {
    "slot_limits": { "new": 2, "established": 5, "trusted": 20 },
    "min_balance_bot_drops": 25000000,
    "min_balance_operator_drops": 100000000,
    "inactivity_timeout_days": 30,
    "flag_threshold_review": 5,
    "flag_threshold_pause": 10,
    "flag_decay_days": 90,
    "flag_cost_pft": 1,
    "anti_harassment_threshold": 20
  }
}
```

---

## 9. Sybil and Abuse Protections Summary

| Attack | Protection | Enforcement |
|--------|-----------|-------------|
| Mass bot registration | Slot limits per operator trust tier | `register_bot` rejects when full |
| Throwaway bots | Minimum 25 PFT balance per bot wallet | Balance check at registration + hourly |
| Fake operators | 100 PFT minimum operator balance | Registration check |
| Inactive squatting | 30-day heartbeat timeout | Auto-deregister, slot freed |
| Impersonation | Community flagging with 1 PFT cost | Auto-pause at 10 flags |
| Flag spam | 1 PFT per flag + 20-flag/month anti-harassment limit | Flag from harassment accounts ignored |
| Key sharing | agent_id tied to wallet, not shared key | Each bot has unique wallet + keystone key |
| Operator suspension evasion | All bots suspended when operator suspended | Propagation rule |
| Trust farming | Trust score requires real task completions + PFT balance | On-chain verifiable, not self-reported |

---

## 10. Future Extensions (documented, deferred)

| Extension | Notes |
|-----------|-------|
| Bot transfer (change operator) | Ownership revoke + re-claim flow |
| Operator delegation | Sub-operators with limited slots |
| Bot reputation scores | Independent of operator, based on uptime + usage |
| Verified operator badges | Manual review for premium trust tier |
| On-chain registry contract | Move from indexed memos to native XRPL hooks |
| Bot-to-bot authentication | Mutual keystone key verification |
| Subscription-aware directory | Show SUBS subscriber counts per bot |
| API key rotation | Revoke + re-provision without re-registering |

---

*This specification is published at [https://github.com/P-U-C/pft-validator/blob/main/multi-agent-registry-spec.md](https://github.com/P-U-C/pft-validator/blob/main/multi-agent-registry-spec.md) and is freely available for implementation by any builder on the Post Fiat network.*
