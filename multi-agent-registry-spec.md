# Multi-Agent Bot Identity Registry — Implementation Specification

## Post Fiat Network · Agent Identity Layer

**Version**: 1.1.0  
**Status**: Implementation-ready  
**Published**: 2026-04-13  
**Author**: Permanent Upper Class (rsS2Y6CK9dz9dVFjJvRyD2gBdoLPqjaXRZ)

This registry treats authentication credentials as replaceable, wallets as canonical identity roots, ownership attestations as auditable control links, and directory views as public-safe projections of registry state. The result is a model that supports one operator running many legitimate service bots while preserving deterministic anti-abuse controls against cheap bot-farm replication.

---

## 1. Purpose and Failure Modes

### 1.1 Purpose

Define a multi-agent identity registry that separates operator identity from per-wallet bot identity. Enable one operator to register and manage multiple bots — each with its own on-chain wallet, keystone API key, name, and command surface — without identity collision.

### 1.2 Observed Failure Mode

On 2026-04-13, registering bot "SUBS" (`r9XYDxJDbmmhSGNpUguVhea6xn3Tu2HbeF`) with the same keystone API key as bot "Lens" (`r3hH6UNw1eVQYiXbDVoarp2kN6JKyTYveT`) produced `agent_id = r3hH6UNw...` for both, overwriting Lens. Root cause: the Keystone agent registry derives `agent_id` from the API key, not from the bot wallet.

### 1.3 Resolution Discovered

Omitting the shared API key and letting the MCP auto-provision a new key per bot wallet via the challenge-response auth flow produces a distinct `agent_id` per wallet. This confirms the system already supports multi-agent identity — it lacks the formal registry, ownership model, and anti-abuse controls.

### 1.4 Scope

This spec covers: identity schemas, ownership proof, key provisioning, state machines, slot limits, funding gates, trust model, abuse controls, public-safe views, migration, and implementation handoff. It does not cover: bot-to-bot communication, service-level entitlements (see SUBS spec), or on-chain governance.

---

## 2. Canonical Identity Invariants

These rules are absolute. They MUST NOT be violated by any implementation.

| Invariant | Rule |
|-----------|------|
| **Operator identity** | `operator_id` = operator primary wallet XRPL address. This is the trust anchor. |
| **Bot identity** | `agent_id` = bot wallet XRPL address. Each bot MUST have a unique funded wallet. |
| **Keystone keys are credentials, not identity** | A `keystone_api_key` is an authentication credential only, NEVER an identity root. Replacing or rotating a keystone key MUST NOT change `operator_id` or `agent_id`. |
| **One active owner per bot** | A bot MUST have at most one active `ownership_record` at any time. |
| **Wallet = identity** | If a wallet is the same, the identity is the same. Two bots MUST NOT share a wallet address. |
| **Registration requires funding** | A bot wallet MUST be funded on-chain before registration. Unfunded wallets MUST be rejected. |
| **Operator controls bots, not vice versa** | A bot MUST NOT modify its operator's state. Operator suspension propagates down. Bot flags do NOT propagate up (only reported in operator dashboard). |

**Unit conventions**: all balance fields in schemas and APIs use drops (integer). 1 PFT = 1,000,000 drops. PFT equivalents in prose are for readability only. The API MUST always return integer drops.

---

## 3. Schemas

### 3.1 `operator` Schema

```json
{
  "$schema": "operator/1.1.0",
  "operator_id": "string — XRPL address (canonical identity root)",
  "display_name": "string — max 64 chars",
  "description": "string — max 256 chars",
  "status": "active | suspended | deactivated",
  "trust_tier": "new | established | trusted",
  "trust_score": "number — 0.0 to 1.0",
  "slot_limit": "integer — derived from trust_tier, may be lowered by moderation but MUST NOT exceed tier maximum without override reason_code",
  "slots_used": "integer",
  "registered_at": "string — ISO 8601",
  "last_activity_at": "string — ISO 8601",
  "flags": {
    "community_flags_weighted": "number — weighted flag score",
    "raw_flag_count": "integer",
    "flag_threshold_review": "number",
    "under_review": "boolean"
  },
  "bots": ["string — array of agent_ids"]
}
```

### 3.2 `bot` Schema

```json
{
  "$schema": "bot/1.1.0",
  "agent_id": "string — XRPL address (= wallet_address, canonical identity)",
  "operator_id": "string — owning operator XRPL address",
  "keystone_key_hash": "string — SHA-256 of keystone API key (NEVER the key itself)",
  "name": "string — max 32 chars",
  "description": "string — max 256 chars",
  "status": "active | paused | quarantined | suspended | deregistered",
  "registered_at": "string — ISO 8601",
  "last_ping_at": "string — ISO 8601",
  "inactivity_deadline": "string — ISO 8601 (last_ping_at + 30 days)",
  "icon_emoji": "string",
  "icon_color_hex": "string",
  "balance_drops": "integer",
  "min_balance_drops": 25000000,
  "commands": [{ "command": "string", "description": "string", "example": "string", "min_cost_drops": "string" }],
  "command_manifest_hash": "string — SHA-256 of canonical command list JSON",
  "capabilities": ["string — capability URIs"],
  "trust": {
    "operator_trust_tier": "string — inherited from operator",
    "operator_trust_score": "number — inherited",
    "bot_local_score": "number — earned by this bot (uptime, usage, flags)",
    "effective_trust_tier": "string — min(operator_tier, local_cap)",
    "trust_source": "inherited | inherited_with_local_cap | local_only"
  },
  "flags": {
    "community_flags_weighted": "number",
    "raw_flag_count": "integer",
    "under_review": "boolean"
  }
}
```

### 3.3 `ownership_record` Schema

```json
{
  "$schema": "ownership_record/1.1.0",
  "operator_id": "string",
  "bot_agent_id": "string",
  "proof_type": "keystone_challenge | on_chain_memo | operator_signature",
  "proof_data": {
    "message": "CLAIM_BOT:<bot_agent_id>:<operator_id>:<challenge_nonce>:<issued_at>:<expires_at>:<registry_domain>:<schema_version>",
    "signature_hex": "string — operator wallet signature over message",
    "challenge_nonce": "string",
    "issued_at": "string — ISO 8601",
    "expires_at": "string — ISO 8601 (issued_at + 5 minutes)",
    "consumed": "boolean — true after first successful verification"
  },
  "status": "active | revoked | transferred",
  "created_at": "string — ISO 8601",
  "revoked_at": "string | null",
  "transferred_to": "string | null — new operator_id if transferred"
}
```

**Ownership rules:**
- A bot MUST have at most one `active` ownership record
- First valid claim wins; concurrent claims are rejected with `BOT_ALREADY_CLAIMED`
- Claim proofs MUST include `expires_at`; expired proofs are invalid
- Each nonce is single-use; replayed proofs are rejected with `OWNERSHIP_PROOF_REPLAYED`
- Unclaimed bots remain discoverable but are marked `unowned` with no trust inheritance

### 3.4 Public-Safe View Schemas

These projections are what the directory and API expose publicly. They MUST exclude sensitive internal fields.

**operator_public_view:**
```json
{
  "operator_id": "string",
  "display_name": "string",
  "trust_tier": "string",
  "trust_score": "number",
  "slots_used": "integer",
  "bot_count": "integer",
  "total_subscribers": "integer",
  "registered_at": "string",
  "under_review": "boolean"
}
```
**Excluded**: raw flag details, exact balance (publish tier bucket only), moderation notes, keystone key hashes.

**bot_public_view:**
```json
{
  "agent_id": "string",
  "name": "string",
  "description": "string",
  "operator_id": "string",
  "operator_name": "string",
  "status": "string",
  "effective_trust_tier": "string",
  "icon_emoji": "string",
  "icon_color_hex": "string",
  "commands": [{ "command": "string", "description": "string" }],
  "command_manifest_hash": "string",
  "last_ping_at": "string",
  "balance_tier": "funded | low | critical",
  "subscribers": "integer",
  "under_review": "boolean"
}
```
**Excluded**: exact balance drops, keystone_key_hash, raw flag scores, flagger identities.

---

## 4. Deterministic Validation Rules

### 4.1 Registration Validation

| Rule | Condition | Decision Code |
|------|-----------|---------------|
| Operator wallet must be funded | `balance_drops >= 100_000_000` (100 PFT) | `OPERATOR_BALANCE_BELOW_MINIMUM` |
| Operator must not be suspended | `operator.status != 'suspended'` | `OPERATOR_SUSPENDED` |
| Bot wallet must be funded | `balance_drops >= 25_000_000` (25 PFT) | `BOT_BALANCE_BELOW_REGISTRATION_MINIMUM` |
| Bot wallet must be unique | No existing bot with same `agent_id` | `BOT_ALREADY_REGISTERED` |
| Operator must have available slot | `slots_used < slot_limit` | `SLOT_LIMIT_EXCEEDED` |
| Bot name must be unique per operator | No other bot with same name under this operator | `BOT_NAME_CONFLICT` |
| Keystone key must be valid | Challenge-response auth succeeded | `INVALID_KEYSTONE_AUTH` |

### 4.2 Ownership Validation

| Rule | Condition | Decision Code |
|------|-----------|---------------|
| Operator signature valid | Signature verifies against `operator_id` public key | `INVALID_OPERATOR_SIGNATURE` |
| Bot not already claimed | No active ownership_record for this `bot_agent_id` | `BOT_ALREADY_CLAIMED` |
| Proof not expired | `now < proof_data.expires_at` | `OWNERSHIP_PROOF_EXPIRED` |
| Proof not replayed | `proof_data.consumed == false` | `OWNERSHIP_PROOF_REPLAYED` |
| Bot exists | Bot is registered in the registry | `BOT_NOT_FOUND` |

### 4.3 Slot Limits

| Trust Tier | Max Bots | Criteria |
|------------|----------|----------|
| `new` | 2 | Default for new operators |
| `established` | 5 | 30+ days active, 10+ task completions, 50K+ PFT earned |
| `trusted` | 20 | 90+ days active, 50+ task completions, 200K+ PFT earned, 0 unresolved flags |

`slot_limit` is derived from `trust_tier` and cached on the operator record. It MAY be lowered by moderation (with reason_code logged) but MUST NOT exceed the tier maximum without an explicit override reason_code from an admin action.

### 4.4 Balance Gates

| Gate | Threshold (drops) | PFT Equivalent | Check Frequency |
|------|-------------------|----------------|-----------------|
| Bot registration | 25,000,000 | 25 PFT | At registration |
| Bot active maintenance | 10,000,000 | 10 PFT | Hourly |
| Operator registration | 100,000,000 | 100 PFT | At registration |
| Operator trusted tier | 1,000,000,000 | 1,000 PFT | Trust recomputation |

When a bot's balance drops below the maintenance threshold, it MUST be auto-paused with decision code `BOT_BALANCE_BELOW_MAINTENANCE`. It SHOULD auto-resume when balance is restored above the registration threshold.

### 4.5 Inactivity Expiry

| Rule | Threshold | Action |
|------|-----------|--------|
| Bot heartbeat timeout | 30 days without `ping` | Auto-deregister, free slot |
| Bot zero-activity | 60 days without any on-chain transaction | Auto-deregister |
| Operator dormancy | 90 days without any bot activity | Trust tier resets to `new` |
| Grace warning | 7 days before auto-deregister | Directory shows "expiring" badge |

---

## 5. Lifecycle State Transitions

### 5.1 Status Precedence

When multiple conditions apply, the highest-precedence status wins:

```
operator_suspended > bot_suspended > bot_quarantined > bot_paused > bot_active
deregistered is terminal (re-registration creates a new record)
under_review is an overlay flag, not a primary status
```

### 5.2 Operator Transitions

| From | Event | To | Conditions |
|------|-------|----|------------|
| (none) | `register` | `active` | Balance >= 100 PFT, valid signature |
| `active` | `deactivate` | `deactivated` | Self-service, all bots deregistered first |
| `active` | `suspend` | `suspended` | Admin action or weighted flags exceed threshold |
| `active` | `dormancy_timeout` | `active` (trust reset to `new`) | 90 days without bot activity |
| `suspended` | `reinstate` | `active` | Admin action, flags resolved |
| `deactivated` | `register` | `active` | Re-registration allowed |

### 5.3 Bot Transitions

| From | Event | To | Conditions | Decision Code |
|------|-------|----|------------|---------------|
| (none) | `register` | `active` | Wallet funded, slot available, keystone auth | — |
| `active` | `pause` | `paused` | Operator action | `BOT_PAUSED_BY_OPERATOR` |
| `active` | `balance_low` | `paused` | Balance < 10 PFT | `BOT_BALANCE_BELOW_MAINTENANCE` |
| `active` | `flag_spike` | `quarantined` | Weighted flags spike > 3x in 24h | `BOT_QUARANTINED_FLAG_SPIKE` |
| `active` | `key_compromise` | `quarantined` | Operator reports key compromise | `BOT_QUARANTINED_KEY_COMPROMISE` |
| `active` | `command_mutation` | `quarantined` | Command manifest hash changes > 50% in one update | `BOT_QUARANTINED_COMMAND_MUTATION` |
| `active` | `suspend` | `suspended` | Admin or operator suspension propagation | `BOT_SUSPENDED` |
| `active` | `inactivity` | `deregistered` | 30 days without ping | `BOT_INACTIVE_EXPIRED` |
| `paused` | `resume` | `active` | Operator action, balance above threshold | — |
| `paused` | `deregister` | `deregistered` | Operator action | — |
| `quarantined` | `resolve` | `active` | Flags resolved or operator action | — |
| `quarantined` | `suspend` | `suspended` | Escalation | `BOT_SUSPENDED` |
| `suspended` | `reinstate` | `active` | Admin action | — |
| any | `deregister` | `deregistered` | Operator action or auto-expiry | — |

### 5.4 Quarantine Mode

Quarantine is an intermediate state between active and suspended:

| Capability | In Quarantine? |
|------------|---------------|
| Discoverable in directory | YES (with warning badge) |
| Heartbeat ping allowed | YES |
| New subscriptions / paid actions | NO |
| Existing subscriber access | YES (grace: 7 days) |
| Ownership actions (transfer, revoke) | YES |
| Command updates | NO |

**Triggers**: rapid flag spike, key compromise report, sudden command surface mutation.

### 5.5 Ownership Transitions

| From | Event | To | Conditions |
|------|-------|----|------------|
| (none) | `claim` | `active` | Valid signature, bot unclaimed |
| `active` | `revoke` | `revoked` | Operator action |
| `active` | `transfer_initiate` | `transfer_pending` | Current operator signs transfer intent |
| `transfer_pending` | `transfer_accept` | `transferred` (new `active` for new operator) | New operator signs acceptance within 72h |
| `transfer_pending` | `transfer_timeout` | `active` (original) | 72h without acceptance |

**Transfer flow:**
```
1. Current operator sends: registry.transfer_intent memo
   MemoData: { bot_agent_id, new_operator_id, initiated_at, expires_at }

2. New operator sends: registry.transfer_accept memo (within 72h)
   MemoData: { bot_agent_id, from_operator_id, accepted_at }

3. Registry: old ownership_record → status: "transferred"
             new ownership_record → status: "active"
             bot.trust resets to new operator's tier (no trust carryover by default)
```

**Cooling period**: 72 hours between transfer initiation and completion. During this window the bot continues operating under the original operator.

---

## 6. Trust and Abuse Model

### 6.1 Trust Score Formula (Deterministic)

```
operator_trust_score = (
  0.30 * min(active_days / 90, 1.0) +
  0.25 * min(task_completions / 50, 1.0) +
  0.20 * min(total_earned_pft / 200000, 1.0) +
  0.15 * min(total_bot_subscribers / 20, 1.0) +
  0.10 * (1.0 - min(weighted_flags / 10, 1.0))
)
```

### 6.2 Split Trust Model

Each bot has both inherited and local trust:

```json
{
  "operator_trust_tier": "trusted",
  "operator_trust_score": 0.92,
  "bot_local_score": 0.61,
  "effective_trust_tier": "established",
  "trust_source": "inherited_with_local_cap"
}
```

**Bot local score** (deterministic):
```
bot_local_score = (
  0.40 * min(uptime_days / 30, 1.0) +
  0.30 * min(successful_responses / 100, 1.0) +
  0.20 * min(subscribers / 10, 1.0) +
  0.10 * (1.0 - min(weighted_flags / 5, 1.0))
)
```

**Effective trust tier**: `min(operator_tier, local_tier_cap)`. If bot has >= 5 unresolved flags, local cap is `new` regardless of operator tier.

### 6.3 Community Flagging (Sybil-Hardened)

**Flag transaction:**
```
MemoType:  "registry.flag"
MemoData:  "<bot_agent_id>:<reason_code>"
Amount:    1,000,000 drops (1 PFT)
```

**Reason codes and weights:**

| Code | Weight | Decay (days) |
|------|--------|-------------|
| `scam` | 3.0 | 120 |
| `impersonation` | 2.5 | 120 |
| `spam` | 1.5 | 60 |
| `offensive` | 1.5 | 90 |
| `broken` | 1.0 | 30 |
| `other` | 0.5 | 30 |

**Weighted flag score**: `sum(weight * (1 - days_elapsed / decay_days))` for all non-expired flags.

**Flagger eligibility** (anti-sybil):
- Wallet MUST be older than 14 days (first-seen on chain)
- Wallet MUST have >= 5 lifetime transactions with memos (proof of real participation)
- One flag per wallet per bot per 30 days
- Wallets that flag > 20 bots per month are marked as harassment accounts; their flags carry 0 weight

**Thresholds:**

| Weighted Score | Action |
|---------------|--------|
| >= 5.0 | `under_review: true`, directory shows warning |
| >= 10.0 | Auto-quarantine |
| >= 20.0 | Auto-suspend pending admin review |

### 6.4 Command Surface Integrity

Each bot record includes:
```
"command_manifest_hash": "sha256:<hash of canonical JSON command list>"
```

**Rules:**
- Command changes that modify > 50% of the manifest MUST trigger quarantine
- Directory SHOULD show "commands updated recently" if manifest changed within 7 days
- Indexer tracks manifest hash history for impersonation drift detection

---

## 7. Decision Codes

Canonical enum for all registry operations. Implementations MUST use these codes.

```
REGISTRATION:
  OPERATOR_BALANCE_BELOW_MINIMUM
  OPERATOR_SUSPENDED
  BOT_BALANCE_BELOW_REGISTRATION_MINIMUM
  BOT_ALREADY_REGISTERED
  BOT_NAME_CONFLICT
  SLOT_LIMIT_EXCEEDED
  INVALID_KEYSTONE_AUTH

OWNERSHIP:
  INVALID_OPERATOR_SIGNATURE
  BOT_ALREADY_CLAIMED
  BOT_NOT_FOUND
  OWNERSHIP_PROOF_EXPIRED
  OWNERSHIP_PROOF_REPLAYED
  OWNERSHIP_TRANSFER_REQUIRED
  TRANSFER_TIMEOUT
  TRANSFER_ACCEPTED

STATUS CHANGES:
  BOT_PAUSED_BY_OPERATOR
  BOT_BALANCE_BELOW_MAINTENANCE
  BOT_INACTIVE_EXPIRED
  BOT_SUSPENDED
  BOT_QUARANTINED_FLAG_SPIKE
  BOT_QUARANTINED_KEY_COMPROMISE
  BOT_QUARANTINED_COMMAND_MUTATION
  BOT_UNDER_REVIEW
  OPERATOR_TRUST_RESET_DORMANCY

FLAGGING:
  FLAG_ACCEPTED
  FLAG_REJECTED_WALLET_TOO_NEW
  FLAG_REJECTED_INSUFFICIENT_ACTIVITY
  FLAG_REJECTED_DUPLICATE
  FLAG_REJECTED_HARASSMENT_ACCOUNT
  FLAG_WEIGHT_APPLIED
```

---

## 8. Worked Example: One Operator, Two Bots

### Operator: Permanent Upper Class

```json
{
  "operator_id": "rsS2Y6CK9dz9dVFjJvRyD2gBdoLPqjaXRZ",
  "display_name": "Permanent Upper Class",
  "trust_tier": "trusted",
  "trust_score": 0.92,
  "slot_limit": 20,
  "slots_used": 2,
  "bots": ["r3hH6UNw1eVQYiXbDVoarp2kN6JKyTYveT", "r9XYDxJDbmmhSGNpUguVhea6xn3Tu2HbeF"]
}
```

### Bot A: Lens

```
1. Provision keystone key:
   requestApiKey("r3hH6UNw...") → challengeNonce → sign → verifyAndIssueKey → apiKey_A
   
2. Register bot:
   register_bot(name: "Lens", ...) → agent_id: "r3hH6UNw..." (derived from apiKey_A)
   
3. Claim ownership:
   Operator signs: "CLAIM_BOT:r3hH6UNw...:rsS2Y6CK...:nonce123:2026-04-13T17:00:00Z:2026-04-13T17:05:00Z:postfiat.org:1.1.0"
   → ownership_record created
```

```json
{
  "agent_id": "r3hH6UNw1eVQYiXbDVoarp2kN6JKyTYveT",
  "name": "Lens",
  "status": "active",
  "icon_emoji": "🔍",
  "icon_color_hex": "#DBB85C",
  "commands": ["/pulse", "/whales", "/active", "/check", "/connections", "/help"],
  "trust": {
    "operator_trust_tier": "trusted",
    "operator_trust_score": 0.92,
    "bot_local_score": 0.78,
    "effective_trust_tier": "trusted",
    "trust_source": "inherited"
  }
}
```

### Bot B: SUBS

```
1. Provision SEPARATE keystone key (omit shared key, force auto-provision):
   requestApiKey("r9XYDxJDb...") → challengeNonce → sign → verifyAndIssueKey → apiKey_B
   apiKey_B ≠ apiKey_A → agent_id: "r9XYDxJDb..." (DISTINCT from Lens)
   
2. Register bot:
   register_bot(name: "SUBS", ...) → agent_id: "r9XYDxJDb..."
   
3. Claim ownership:
   Same operator signs ownership claim for this bot
   → both bots owned by same operator, no collision
```

```json
{
  "agent_id": "r9XYDxJDbmmhSGNpUguVhea6xn3Tu2HbeF",
  "name": "SUBS",
  "status": "active",
  "icon_emoji": "🔑",
  "icon_color_hex": "#5EEA96",
  "commands": ["/services", "/status", "/subscribe", "/help"],
  "trust": {
    "operator_trust_tier": "trusted",
    "operator_trust_score": 0.92,
    "bot_local_score": 0.45,
    "effective_trust_tier": "established",
    "trust_source": "inherited_with_local_cap"
  }
}
```

### Directory Display

```
┌──────────────────────────────────────────────────────────────┐
│  Permanent Upper Class                      TRUSTED ★★★     │
│  2 bots · 291K PFT staked · 49 tasks completed              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  🔍 Lens                        r3hH6UNw...  ACTIVE  ★★★   │
│  Network intelligence for Post Fiat                          │
│  /pulse /whales /active /check /connections /help            │
│                                                              │
│  🔑 SUBS                        r9XYDxJDb...  ACTIVE  ★★    │
│  Subscribe to services on Post Fiat                          │
│  /services /status /subscribe /help                          │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 9. Migration Plan

### 9.1 Existing Single-Bot Records

Bots registered under the current system (one API key = one agent_id):
- MUST be grandfathered as both operator and bot
- `operator_id` = the wallet that originally obtained the keystone key
- `agent_id` = same wallet (single-bot operators are their own operator)
- Ownership record auto-created with `proof_type: "migration"`

### 9.2 Key Rotation

- Operators MAY rotate their keystone API key without changing `operator_id`
- Bots MAY rotate their keystone API key without changing `agent_id`
- The registry MUST update `keystone_key_hash` and log the rotation event
- Active subscriptions and ownership records are unaffected by key rotation

### 9.3 Retroactive Ownership Claims

For bots registered before this spec:
- The wallet that provisioned the original keystone key is the presumed operator
- Other wallets MAY claim ownership if the presumed operator does not contest within 30 days
- Contested claims require admin resolution

### 9.4 Backward Compatibility

- Existing `register_bot` API continues to work unchanged
- Bots that register without an explicit ownership claim are auto-claimed by the keystone key holder
- The directory displays all bots regardless of whether they have formal ownership records
- Bots without ownership records show "unverified operator" in the directory

---

## 10. Implementation Handoff

### 10.1 Indexer Surface

**New memo types:**

| MemoType | Action |
|----------|--------|
| `registry.claim` | Create ownership_record |
| `registry.revoke` | Set ownership_record.status = revoked |
| `registry.transfer_intent` | Create pending transfer |
| `registry.transfer_accept` | Complete transfer |
| `registry.flag` | Create flag record, recompute weighted score |

**New tables:**

```sql
CREATE TABLE operators (
  operator_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  trust_tier TEXT NOT NULL DEFAULT 'new',
  trust_score REAL NOT NULL DEFAULT 0.0,
  slot_limit INTEGER NOT NULL DEFAULT 2,
  slots_used INTEGER NOT NULL DEFAULT 0,
  registered_at TEXT NOT NULL,
  last_activity_at TEXT
);

CREATE TABLE bots (
  agent_id TEXT PRIMARY KEY,
  operator_id TEXT NOT NULL,
  keystone_key_hash TEXT,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  registered_at TEXT NOT NULL,
  last_ping_at TEXT,
  icon_emoji TEXT,
  icon_color_hex TEXT,
  balance_drops INTEGER DEFAULT 0,
  commands_json TEXT,
  command_manifest_hash TEXT,
  capabilities_json TEXT,
  operator_trust_tier TEXT,
  operator_trust_score REAL,
  bot_local_score REAL DEFAULT 0.0,
  effective_trust_tier TEXT,
  community_flags_weighted REAL DEFAULT 0.0,
  raw_flag_count INTEGER DEFAULT 0,
  under_review INTEGER DEFAULT 0
);
CREATE INDEX idx_bots_operator ON bots(operator_id);
CREATE INDEX idx_bots_status ON bots(status);

CREATE TABLE ownership_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  operator_id TEXT NOT NULL,
  bot_agent_id TEXT NOT NULL,
  proof_type TEXT NOT NULL,
  proof_tx_hash TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  revoked_at TEXT,
  transferred_to TEXT,
  UNIQUE(bot_agent_id, status) -- one active owner per bot
);

CREATE TABLE bot_flags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bot_agent_id TEXT NOT NULL,
  flagger_address TEXT NOT NULL,
  reason_code TEXT NOT NULL,
  weight REAL NOT NULL,
  flag_tx_hash TEXT,
  flagged_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  UNIQUE(bot_agent_id, flagger_address)
);
CREATE INDEX idx_flags_bot ON bot_flags(bot_agent_id);
```

**Hourly jobs:**

```sql
-- Auto-deregister inactive bots
UPDATE bots SET status = 'deregistered'
WHERE status = 'active' AND last_ping_at < datetime('now', '-30 days');

-- Auto-pause underfunded bots
UPDATE bots SET status = 'paused'
WHERE status = 'active' AND balance_drops < 10000000;

-- Auto-resume funded bots
UPDATE bots SET status = 'active'
WHERE status = 'paused' AND balance_drops >= 25000000;

-- Expire old flags
DELETE FROM bot_flags WHERE expires_at < datetime('now');

-- Recompute weighted flag scores
-- (per-bot, after flag expiry)
```

### 10.2 API Surface

**Read endpoints** (public):

| Endpoint | Response |
|----------|----------|
| `GET /registry/directory` | `{ operators: [{ operator_public_view, bots: [bot_public_view] }], stats }` |
| `GET /registry/operators/:id` | `{ operator_public_view, bots: [bot_public_view] }` |
| `GET /registry/bots/:agent_id` | `{ bot_public_view, operator_public_view }` |
| `GET /registry/bots` | `{ bots: [bot_public_view], total }` |

**Write endpoints** (authenticated):

| Endpoint | Auth | Decision Codes |
|----------|------|----------------|
| `POST /registry/operators` | Wallet signature | `OPERATOR_BALANCE_BELOW_MINIMUM` |
| `POST /registry/bots` | Keystone API key | `SLOT_LIMIT_EXCEEDED`, `BOT_BALANCE_BELOW_REGISTRATION_MINIMUM`, `BOT_ALREADY_REGISTERED` |
| `POST /registry/ownership/claim` | Operator signature | `BOT_ALREADY_CLAIMED`, `OWNERSHIP_PROOF_EXPIRED`, `OWNERSHIP_PROOF_REPLAYED` |
| `POST /registry/ownership/transfer` | Operator signature | `OWNERSHIP_TRANSFER_REQUIRED`, `TRANSFER_TIMEOUT` |
| `POST /registry/flag` | On-chain memo | `FLAG_REJECTED_*` codes |
| `DELETE /registry/bots/:id` | Operator keystone key | — |

### 10.3 Directory Surface

**Static export**: `directory-registry.json`, updated hourly, containing:
- All operators with public-safe views
- All active/quarantined bots grouped by operator
- Anti-abuse parameters (slot limits, balance thresholds, flag weights)
- Stats: total operators, bots, subscribers

---

## 11. Security Considerations

| Threat | Mitigation |
|--------|-----------|
| Key compromise | Quarantine mode, key rotation without identity change |
| Operator impersonation | Ownership proof requires wallet signature |
| Bot-farm sybil attack | Slot limits + PFT balance requirement + trust tiers |
| Coordinated flagging | Weighted flags, flagger eligibility, harassment detection |
| Identity squatting | Inactivity expiry frees names/slots |
| Silent impersonation drift | Command manifest hash tracking |
| Transfer abuse | 72-hour cooling period, trust reset on transfer |

---

*This specification is published at [https://github.com/P-U-C/pft-validator/blob/main/multi-agent-registry-spec.md](https://github.com/P-U-C/pft-validator/blob/main/multi-agent-registry-spec.md) and is freely available for implementation by any builder on the Post Fiat network.*
