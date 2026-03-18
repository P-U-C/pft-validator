---
layout: default
title: "Authorization Gate Enforcement: Task Node Integration Specification v1.1"
date: 2026-03-18
category: spec
status: published
---

# Authorization Gate Enforcement: Task Node Integration Specification

**Status:** PUBLISHED
**Version:** v1.1
**Date:** 2026-03-18
**Author:** Permanent Upper Class Validator
**Review:** Three-panel review incorporated — protocol designer, implementation engineer, mechanism design lens

---

## Abstract

The Authorization Gate v4.1 design defines five contributor states (UNKNOWN, PROBATIONARY, AUTHORIZED, TRUSTED, SUSPENDED), concentration caps, linking score thresholds, registration stakes, and vesting rules. This specification maps those rules into enforceable code at every decision point in the Task Node pipeline, closing approximately 1M PFT in unauthorized emissions that flowed without identity verification or sybil resistance.

The Task Node runs TypeScript/Node.js with PostgreSQL for state, Redis for hot-path caching, and IPFS for evidence hashing. The task lifecycle is: registration → proposal → acceptance → evidence submission → adjudication → reward emission. Every transition is gated.

This spec is structured in two layers:

- **Layer A (ship now):** Gate 4 hard enforcement, transaction boundaries, auth state table, probation split, audit log, shadow/soft/full rollout, grandfathering, rollback + replay. Closes the exploit.
- **Layer B (phase 2):** Linking score declaration flows, concentration graph dynamics, grouped wallet treatment, advanced cooldown escalation, clawback workflows, stake slashing integration.

---

## System Invariants

These are non-negotiable. Any implementation that violates these is broken.

1. **No unauthorized rewards.** No contributor in UNAUTHORIZED or SUSPENDED state may receive newly committed liquid reward in full enforcement mode.
2. **Exactly-once emission.** Reward emission is idempotent. Duplicate emission for the same task_id is impossible.
3. **Replayable decisions.** Authorization decisions must be replayable from audit logs alone.
4. **Monotonic gate evaluation.** Within a transaction, earlier gates do not create rights that later gates must honor. Each gate evaluates independently against current state.
5. **No silent degradation.** Hold states do not silently degrade to pass states. A HELD result stays HELD until explicitly resolved.
6. **Atomic emission.** No reward emission may be committed unless the authorization decision and the emission write occur in the same DB transaction boundary.
7. **Decision provenance.** Every authorization decision must reference: `auth_version`, `ledger_height`, `epoch_id`, `policy_version`.

---

## 1. Contributor State Machine

Five states with explicit transition rules:

```
                    ┌──────────┐
                    │  UNKNOWN  │  ← wallet seen, no registration
                    └─────┬────┘
                          │ register + post stake
                          ▼
                    ┌──────────────┐
        ┌──────────│ PROBATIONARY  │◄─────────────────┐
        │          └──────┬───────┘                    │
        │                 │ stake verified +            │ unfreeze /
        │                 │ KYC clear +                 │ admin restore
        │                 │ linking < 2.5               │
        │                 ▼                             │
        │          ┌──────────────┐              ┌─────┴──────┐
        │          │  AUTHORIZED  │──────────────│  SUSPENDED  │
        │          └──────┬───────┘  sybil /     └─────┬──────┘
        │                 │          3rd offense        │
        │                 │ sustained good              │ permanent ban
        │                 │ standing (Layer B)          ▼
        │                 ▼                        [terminal]
        │          ┌──────────┐
        │          │  TRUSTED  │  (Layer B — reduced checks)
        │          └──────────┘
        │                │
        └────────────────┘  linking hold / stake breach
```

### State Definitions

| State | Can Propose | Can Accept Tasks | Reward Treatment | Retriable |
|-------|-------------|------------------|------------------|-----------|
| UNKNOWN | Yes | No | None | Yes — register |
| PROBATIONARY | Yes | Yes | 25% liquid / 75% vesting | Yes — clear conditions |
| AUTHORIZED | Yes | Yes | 100% liquid | N/A |
| TRUSTED | Yes | Yes | 100% liquid, reduced gates (Layer B) | N/A |
| SUSPENDED | No | No | All frozen | Requires admin review |

---

## 2. Decision Outcome States

Gate checks return one of these outcomes per task:

| Outcome | Meaning | Retriable | Next Action |
|---------|---------|-----------|-------------|
| PASS | Proceed | N/A | Continue pipeline |
| REJECTED | Final for this task | No | Contributor may submit new task |
| HELD | Pending review | No (blocked) | No new tasks until resolved |
| FROZEN | Emission held | Yes (can submit tasks) | Awaiting admin unfreeze |
| SUSPENDED | No participation | No | Admin review required |
| VOIDED | Task cancelled | No | No credit, resubmit allowed |
| RETRIABLE | Temporary block | Yes | Retry after `Retry-After` |

---

## 3. Pipeline Integration Points

Every decision point calls `authorizationCheck()` before proceeding. The check is synchronous and blocking.

### Flow Diagram

```
  ┌──────────────────────────────────────────────────────────┐
  │  GATE 0: REGISTRATION (integration point)                │
  │                                                           │
  │  State: UNKNOWN → PROBATIONARY                            │
  │  Requires: wallet signature + minimum stake deposit       │
  │  Creates: contributor_authorization row                   │
  │  Emits: audit log entry                                   │
  └──────────────────────┬────────────────────────────────────┘
                         │
                         ▼
  ┌──────────────────────────────────────────────────────────┐
  │  TASK PROPOSAL (no auth check — anyone proposes)          │
  └──────────────────────┬────────────────────────────────────┘
                         │
                         ▼
  ┌──────────────────────────────────────────────────────────┐
  │  GATE 1: TASK ACCEPTANCE                                  │
  │                                                           │
  │  Check: state ∈ {AUTHORIZED, PROBATIONARY, TRUSTED}       │
  │         + concentration_cap(control_graph, epoch)         │
  │         + cooldown_expired(wallet)                        │
  │         + linking_score < 4.5                             │
  │                                                           │
  │  PASS → accept task, log audit entry                      │
  │  FAIL → reject with external error code                   │
  └──────────────────────┬────────────────────────────────────┘
                         │ PASS
                         ▼
  ┌──────────────────────────────────────────────────────────┐
  │  GATE 2: EVIDENCE SUBMISSION                              │
  │                                                           │
  │  Check: state ∈ {AUTHORIZED, PROBATIONARY, TRUSTED}       │
  │         + wallet matches accepted contributor             │
  │         + cooldown_expired(wallet)                        │
  │         + linking_score < 4.5                             │
  │         + IPFS available (hard requirement)               │
  │                                                           │
  │  PASS → hash evidence to IPFS, store reference            │
  │  FAIL → reject submission                                 │
  └──────────────────────┬────────────────────────────────────┘
                         │ PASS
                         ▼
  ┌──────────────────────────────────────────────────────────┐
  │  GATE 3: ADJUDICATION                                     │
  │                                                           │
  │  Check: re-validate state (may have changed since         │
  │         submission). If degraded → auto-reject task.      │
  │         Check linking_score for provisional cap.          │
  │                                                           │
  │  PASS → adjudicator proceeds                              │
  │  FAIL → REJECTED_AUTH or HELD (48h for linking flag)      │
  └──────────────────────┬────────────────────────────────────┘
                         │ PASS
                         ▼
  ┌──────────────────────────────────────────────────────────┐
  │  GATE 4: REWARD EMISSION (transactional — see §4)         │
  │                                                           │
  │  Check: final state verification                          │
  │         + cumulative PFT vs threshold                     │
  │         + concentration_cap re-check                      │
  │         + PROBATIONARY vesting split enforcement          │
  │                                                           │
  │  PASS (AUTHORIZED/TRUSTED) → 100% liquid emission         │
  │  PASS (PROBATIONARY) → 25% liquid / 75% vesting escrow   │
  │  FAIL → hold emission, trigger escalation                 │
  └──────────────────────────────────────────────────────────┘
```

### State Transition Side Effects

```
  AUTHORIZED → PROBATIONARY (linking_score hit)
    → In-flight tasks: complete normally
    → New emissions: apply 25/75 split going forward

  AUTHORIZED → SUSPENDED (sybil confirmed)
    → In-flight tasks at Gate 2+: complete (honest work gets credit)
    → In-flight tasks before Gate 2: VOIDED
    → Pending emissions: FROZEN, stake slashed

  PROBATIONARY → SUSPENDED
    → 75% vesting balance: forfeited
    → 25% liquid already emitted: clawback review
```

---

## 4. Gate 4 Transaction Boundary

Gate 4 is the critical path. All state reads and writes execute within a single serializable transaction:

```sql
BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE;

  -- Lock rows to prevent concurrent emission
  SELECT * FROM contributor_authorization
    WHERE wallet = $1 FOR UPDATE;

  SELECT * FROM control_graph_cap_state
    WHERE control_graph_id = $2 AND epoch_id = $3 FOR UPDATE;

  -- Assert reward not already emitted (exactly-once)
  SELECT 1 FROM emission_log
    WHERE task_id = $4;
  -- If found: ROLLBACK, return cached result

  -- Re-run authorization decision using locked rows
  -- (full gate check logic against locked state)

  -- Write reward decision
  INSERT INTO emission_log (task_id, wallet, pft_amount, liquid, vesting,
    auth_version, ledger_height, epoch_id, policy_version, idempotency_key)
  VALUES ($4, $1, ...);

  -- Update cap counters
  UPDATE control_graph_cap_state
    SET pft_emitted = pft_emitted + $5,
        contributor_count = contributor_count + 1
    WHERE control_graph_id = $2 AND epoch_id = $3;

  -- Update contributor counters
  UPDATE contributor_authorization
    SET total_pft_emitted_lifetime = total_pft_emitted_lifetime + $5,
        total_pft_emitted_epoch = total_pft_emitted_epoch + $5,
        auth_version = auth_version + 1,
        updated_at = NOW()
    WHERE wallet = $1;

  -- Append audit log
  INSERT INTO authorization_audit_log (...) VALUES (...);

COMMIT;
```

### Retry Policy on Serialization Failure

- **Max retries:** 3
- **Backoff:** Exponential — 100ms, 400ms, 1600ms
- **After 3 failures:** Fail-closed (reject emission, alert ops)

---

## 5. Idempotency and Replay

### Authorization Check Idempotency

```
idempotency_key = sha256(contributor_wallet + task_id + check_type + epoch_id)
```

- If key exists in `authorization_check_cache`: return cached result, do not re-execute
- Cache TTL: 5 minutes (short — state can change)

### Emission Idempotency

- Before writing to `emission_log`: check `WHERE task_id = $task_id`
- If found: return previous result, do not double-emit
- This check happens inside the Gate 4 transaction (§4)

---

## 6. PostgreSQL Schema

### Three-Ledger Architecture

1. **Authorization Ledger** — contributor state, scores, stakes
2. **Emission Ledger** — every PFT emission with full provenance
3. **Audit Ledger** — immutable decision log for replay

```sql
-- ============================================================
-- contributor_authorization (Authorization Ledger)
-- One row per contributor. Source of truth for gate checks.
-- ============================================================
CREATE TABLE contributor_authorization (
    wallet                    TEXT PRIMARY KEY,  -- contributor address (chain-agnostic)
    state                     VARCHAR(20) NOT NULL DEFAULT 'UNKNOWN'
                              CHECK (state IN (
                                'UNKNOWN','PROBATIONARY','AUTHORIZED',
                                'TRUSTED','SUSPENDED'
                              )),
    auth_version              BIGINT NOT NULL DEFAULT 0,  -- optimistic concurrency, increment on every mutation
    tier                      SMALLINT NOT NULL DEFAULT 0,
    registration_stake        BIGINT NOT NULL DEFAULT 0,
    linking_score             NUMERIC(4,2) NOT NULL DEFAULT 0.0,
    cooldown_until            TIMESTAMPTZ,
    cooldown_count            SMALLINT NOT NULL DEFAULT 0,
    cooldown_epoch            VARCHAR(32),
    total_pft_emitted_lifetime BIGINT NOT NULL DEFAULT 0,
    total_pft_emitted_epoch   BIGINT NOT NULL DEFAULT 0,  -- reset each epoch
    total_pft_frozen          BIGINT NOT NULL DEFAULT 0,
    total_pft_vested          BIGINT NOT NULL DEFAULT 0,
    total_pft_clawed_back     BIGINT NOT NULL DEFAULT 0,
    control_graph_id          VARCHAR(64),
    declaration_prompted_at   TIMESTAMPTZ,
    declaration_deadline      TIMESTAMPTZ,
    grandfathered             BOOLEAN NOT NULL DEFAULT FALSE,
    created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_auth_wallet_state ON contributor_authorization(wallet, state);
CREATE INDEX idx_auth_linking ON contributor_authorization(linking_score) WHERE linking_score >= 1.5;
CREATE INDEX idx_auth_cooldown ON contributor_authorization(cooldown_until) WHERE cooldown_until IS NOT NULL;

-- ============================================================
-- emission_log (Emission Ledger)
-- Exactly-once emission record. Source of truth for payouts.
-- ============================================================
CREATE TABLE emission_log (
    id                BIGSERIAL PRIMARY KEY,
    task_id           VARCHAR(64) NOT NULL UNIQUE,  -- enforces exactly-once
    wallet            TEXT NOT NULL,
    pft_amount        BIGINT NOT NULL,
    liquid_amount     BIGINT NOT NULL,
    vesting_amount    BIGINT NOT NULL,
    auth_version      BIGINT NOT NULL,
    ledger_height     BIGINT NOT NULL,
    epoch_id          VARCHAR(32) NOT NULL,
    policy_version    VARCHAR(20) NOT NULL,
    idempotency_key   VARCHAR(128) NOT NULL UNIQUE,
    contributor_state VARCHAR(20) NOT NULL,
    cgi_boost         NUMERIC(3,1) DEFAULT 0.0,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_emission_wallet ON emission_log(wallet);
CREATE INDEX idx_emission_epoch ON emission_log(epoch_id);

-- ============================================================
-- authorization_audit_log (Audit Ledger)
-- Immutable append-only. Never UPDATE or DELETE.
-- ============================================================
CREATE TABLE authorization_audit_log (
    id                BIGSERIAL PRIMARY KEY,
    wallet            TEXT NOT NULL,
    old_state         VARCHAR(20),
    new_state         VARCHAR(20) NOT NULL,
    reason            TEXT NOT NULL,
    reason_code       VARCHAR(64),       -- machine-readable
    triggered_by      VARCHAR(64) NOT NULL,
    task_id           VARCHAR(64),
    epoch_id          VARCHAR(32),
    auth_version      BIGINT,
    ledger_height     BIGINT,
    policy_version    VARCHAR(20),
    pft_amount        BIGINT,
    metadata          JSONB,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_wallet_time ON authorization_audit_log(wallet, created_at DESC);
CREATE INDEX idx_audit_epoch ON authorization_audit_log(epoch_id);

-- ============================================================
-- cooldown_escalation_log
-- ============================================================
CREATE TABLE cooldown_escalation_log (
    id                BIGSERIAL PRIMARY KEY,
    wallet            TEXT NOT NULL,
    incident_type     VARCHAR(40) NOT NULL,
    offense_number    SMALLINT NOT NULL,
    epoch_id          VARCHAR(32) NOT NULL,
    cooldown_hours    INT NOT NULL,
    action_taken      VARCHAR(40) NOT NULL,
    pft_frozen        BIGINT DEFAULT 0,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cooldown_wallet_epoch ON cooldown_escalation_log(wallet, epoch_id);

-- ============================================================
-- control_graph_cap_state
-- Per-epoch budget tracking for concentration cap
-- ============================================================
CREATE TABLE control_graph_cap_state (
    control_graph_id  VARCHAR(64) NOT NULL,
    epoch_id          VARCHAR(32) NOT NULL,
    total_pft_budget  BIGINT NOT NULL,
    pft_emitted       BIGINT NOT NULL DEFAULT 0,
    contributor_count INT NOT NULL DEFAULT 0,
    cgi_boost         NUMERIC(3,1) NOT NULL DEFAULT 0.0,
    PRIMARY KEY (control_graph_id, epoch_id)
);

-- ============================================================
-- policy_config
-- All magic constants. No hardcoded values in application code.
-- ============================================================
CREATE TABLE policy_config (
    key               VARCHAR(64) PRIMARY KEY,
    value             NUMERIC NOT NULL,
    description       TEXT,
    policy_version    VARCHAR(20),
    updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Seed values:
INSERT INTO policy_config (key, value, description, policy_version) VALUES
  ('unauthorized_pft_threshold',         10000,   'PFT threshold triggering suspension for UNAUTHORIZED wallets', 'v1.1'),
  ('probation_liquid_bps',               2500,    '25% liquid portion for PROBATIONARY emissions', 'v1.1'),
  ('probation_vesting_bps',              7500,    '75% vesting portion for PROBATIONARY emissions', 'v1.1'),
  ('declaration_window_seconds',         1209600, '14 days to respond to linking declaration', 'v1.1'),
  ('linking_soft_flag_threshold',        1.5,     'Linking score: soft flag (log only)', 'v1.1'),
  ('linking_declaration_threshold',      2.5,     'Linking score: declaration prompt', 'v1.1'),
  ('linking_provisional_cap_threshold',  3.5,     'Linking score: provisional task cap', 'v1.1'),
  ('linking_immediate_group_threshold',  4.5,     'Linking score: immediate grouping', 'v1.1'),
  ('concentration_cap_bps',             1500,     '15% epoch concentration cap', 'v1.1'),
  ('grandfathering_grace_days',         30,       'Days before grandfathered wallets must stake', 'v1.1'),
  ('shadow_mode_false_positive_max_pct', 5,       'Max acceptable false positive rate in shadow mode', 'v1.1'),
  ('cooldown_first_offense_hours',      24,       '1st offense: 24h cooldown', 'v1.1'),
  ('cooldown_second_offense_days',       7,       '2nd offense: 7d cooldown', 'v1.1'),
  ('cooldown_third_offense_action',      0,       'suspension_review (0 = enum placeholder)', 'v1.1');
```

---

## 7. Redis Cache Spec

Hot-path caching for contributor_authorization:

```
Key:    auth:{wallet}
Value:  JSON serialization of contributor_authorization row
TTL:    30 seconds
```

**Read path:** Gate checks read Redis first → on miss, read Postgres → populate cache.

**Invalidation:** Any state write to `contributor_authorization` immediately DELETEs `auth:{wallet}`.

**Redis unavailable:** Fall through to Postgres. Log warning. Do not fail.

**Stale detection:** If `updated_at` in cached row is > 30s old on a hot-path check, re-read from Postgres and log staleness metric.

---

## 8. Error Codes: External vs Internal

### External (client-facing HTTP responses)

| Code | HTTP | Meaning |
|------|------|---------|
| NOT_ELIGIBLE | 403 | Wallet cannot participate |
| RETRY_LATER | 429 | Temporary block, check Retry-After |
| UNDER_REVIEW | 403 | Decision pending human review |

### Internal (audit logs only — never exposed to contributors)

| Code | Meaning |
|------|---------|
| UNAUTHORIZED | State is UNKNOWN/UNAUTHORIZED |
| SUSPENDED | Confirmed sybil or 3rd offense |
| COOLDOWN_ACTIVE | Cooldown timer running |
| CONCENTRATION_CAP_EXCEEDED | Control graph hit epoch cap |
| PROBATIONARY_LIMIT_EXCEEDED | Probationary per-epoch ceiling |
| LINKING_FLAG_HOLD | Linking score ≥ 2.5, declaration pending |
| EXTRACTION_FLAG | Suspected extraction pattern |
| TIER_ACCESS_DENIED | Task tier exceeds contributor tier |

---

## 9. API Contract

### Authorization Check

```
POST /api/v1/authorization/check
Content-Type: application/json
Authorization: Bearer <service-token>
```

Internal service-to-service only.

```typescript
interface AuthorizationCheckRequest {
  contributor_wallet: string;   // contributor address (chain-agnostic)
  check_type: 'task_accept' | 'evidence_submit' | 'adjudicate' | 'reward_emit';
  task_id: string;
  epoch_id: string;
  pft_amount?: number;          // required for reward_emit
  control_graph_id?: string;    // required for task_accept and reward_emit
}

interface AuthorizationCheckResponse {
  allowed: boolean;
  contributor_state: string;
  error_code?: string;           // external codes only
  error_message?: string;
  retry_after_seconds?: number;
  vesting_split?: { liquid_bps: number; vesting_bps: number };
  concentration_remaining_pft?: number;
  auth_version: number;
  policy_version: string;
}
```

### Contributor Status (public-facing)

```
GET /api/v1/authorization/status
Authorization: Bearer <contributor-token>
```

Returns:
```json
{
  "state": "PROBATIONARY",
  "reason": "Linking score above threshold — declaration required",
  "next_step": "Submit related wallet declaration at /api/v1/declaration",
  "declaration_deadline": "2026-04-01T00:00:00Z"
}
```

No internal diagnostic codes exposed. State transitions above PROBATIONARY severity require signed policy reason codes.

---

## 10. Failure Mode Matrix

| Failure | Gate 1 | Gate 2 | Gate 3 | Gate 4 |
|---------|--------|--------|--------|--------|
| **DB unavailable** | Fail-closed (reject, warn) | Fail-closed | Fail-closed | Fail-closed |
| **Redis unavailable** | Fall through to DB, warn | Fall through to DB | Fall through to DB | Fall through to DB |
| **IPFS unavailable** | N/A | Reject (no hash = no evidence) | N/A | N/A |
| **Stale auth row (>30s)** | Re-read from DB, log | Re-read, log | Re-read, log | Re-read inside txn |
| **Duplicate request** | Return cached (idempotency key) | Return cached | Return cached | Return cached |
| **Cap row missing** | Fail-closed (reject, alert) | N/A | N/A | Fail-closed (alert) |
| **Serialization conflict** | N/A | N/A | N/A | Retry 3x, then fail-closed |
| **Policy config unavailable** | Use hardcoded safe defaults, alert | Same | Same | Same |

**Hardcoded safe defaults** (used only when policy_config table is unreachable):
- `unauthorized_pft_threshold`: 10000
- `probation_liquid_bps`: 2500
- `concentration_cap_bps`: 1500
- All linking thresholds: as listed in §6 seed values

---

## 11. Cooldown Escalation Logic

```
function escalate_cooldown(wallet, incident_type, current_state, epoch_id):
    offenses = COUNT(*) FROM cooldown_escalation_log
               WHERE wallet = $wallet AND epoch_id = $epoch_id

    auth = SELECT * FROM contributor_authorization WHERE wallet = $wallet

    // PFT threshold breach — immediate suspension
    if current_state == 'UNKNOWN'
       AND auth.total_pft_emitted_lifetime > policy('unauthorized_pft_threshold'):
        → state = SUSPENDED, freeze all PFT, log, RETURN

    if offenses == 0:  // 1st offense
        → cooldown = policy('cooldown_first_offense_hours') hours
        → no state change, just cooldown timer

    else if offenses == 1:  // 2nd offense
        → cooldown = policy('cooldown_second_offense_days') days
        → state → PROBATIONARY
        → 75% of emitted PFT moved to vesting

    else:  // 3rd+ offense
        → state → SUSPENDED
        → freeze all PFT
        → indefinite until admin review

    INSERT cooldown_escalation_log(...)
    INSERT authorization_audit_log(...)
    INVALIDATE Redis auth:{wallet}
```

---

## 12. Migration Path

### Phase 1: Shadow Mode (2 weeks)

- `enforcement_mode = 'shadow'`
- All gate checks run fully but always return `allowed: true`
- Violations logged with `metadata.shadow = true`
- Metrics: false positive rate, would-be rejections, PFT volume blocked
- **Success criteria:** false positive rate < 5%

### Phase 2: Soft Enforcement (2 weeks)

- `enforcement_mode = 'soft'`
- UNKNOWN: blocked at Gate 1. Existing in-flight tasks may complete.
- PROBATIONARY: warned, vesting split enforced. Not blocked.
- AUTHORIZED/TRUSTED: full pass.
- SUSPENDED: fully blocked at all gates.
- Concentration cap: logged but not enforced.
- Linking score: flags and prompts active, no automatic state transitions.

### Phase 3: Full Enforcement

- `enforcement_mode = 'full'`
- All gates enforce all checks per this spec.
- Concentration caps enforced.
- Linking score automated transitions active.
- Cooldown escalation fully operational.

### Rollback Procedure

```
IF false_rejection_rate > 5% for any 24h window:
  1. Alert ops (PagerDuty / Telegram)
  2. Auto downgrade: full → soft
  3. Manual review of rejected wallets
  4. Fix, re-validate against shadow logs, redeploy
  5. Re-enter Phase 2 for minimum 48h
```

### Rollback Data Safety

- **Held rewards on rollback to shadow:** Replay held emissions — re-evaluate against shadow rules, emit if would-pass.
- **Rejected tasks:** Remain VOIDED. Contributor may resubmit. Never auto-re-queue.
- **False suspensions:** Admin sets `state = 'PROBATIONARY'`, logs reason code. Append correction record — never mutate existing audit rows.
- **Audit corrections:** Insert new `authorization_audit_log` row with `triggered_by = 'admin_correction'` and reference to original row ID in metadata.

---

## 13. Grandfathering Semantics

Active contributors as of enforcement date with no stake:

- Identified by: `total_pft_emitted_lifetime > 0 AND registration_stake = 0 AND state = 'UNKNOWN'`
- Flag set: `grandfathered = TRUE`

### Rules (non-negotiable)

1. `grandfathered = true` overrides UNKNOWN at **Gates 1–3 only**. NOT Gate 4 — Gate 4 always enforces current state.
2. Grandfathered status does **NOT** survive a linking hold. Linking hold takes precedence.
3. Grandfathered wallets **CAN** be suspended. Grandfathering is not immunity.
4. After 30-day grace: grandfathered wallet that has not posted stake becomes UNKNOWN, gates block new tasks.
5. Vesting from grandfathering period: held 90 days, released if stake posted, forfeited if not.

---

## 14. Appeals and Transparency

- `GET /api/v1/authorization/status` — returns state, human-readable reason, next remediation step. No internal codes.
- State transitions above PROBATIONARY severity require signed policy reason codes in audit log.
- **Suspension ≠ forfeiture.** Suspension freezes participation. Forfeiture is a separate admin action requiring its own audit entry.
- **In-flight tasks on suspension:** Voided only if work was not yet submitted. Completed honest work (Gate 2+ passed) gets credit.

---

## 15. Scenarios

### Scenario A: Unauthorized Operator Accumulates 12,000 PFT

```
Epoch 47, Day 1:
  Wallet 0xABC... submits registration (state: UNKNOWN, stake: 0)
  
  GATE 1: state = UNKNOWN
    SHADOW MODE → logged but not blocked (this is the leak)
    FULL MODE   → blocked with NOT_ELIGIBLE

Epoch 47, Days 1-14 (shadow mode):
  Operator completes 8 tasks, 12,000 PFT emitted
  At task #6 (cumulative crosses 10,000):
    → escalate_cooldown triggered
    → PFT threshold breach: UNKNOWN + 10,200 > 10,000
    → State → SUSPENDED
    → All pending emissions: FROZEN
    → In-flight tasks before Gate 2: VOIDED
    → In-flight tasks past Gate 2: complete (honest work credit)
    
  Audit: old_state=UNKNOWN, new_state=SUSPENDED,
         reason='PFT threshold breach: 10200 > 10000',
         triggered_by='gate_4_escalation'
```

### Scenario B: Linking Score Rise to 3.2

```
Epoch 50: wallet 0xDEF..., state=AUTHORIZED, linking=1.2

  Score → 1.6: SOFT FLAG (log only, no user impact)
  Score → 2.8: DECLARATION PROMPT (14 day deadline)
  Score → 3.2: still < 3.5, no provisional cap yet

  PATH A — responds within 14 days:
    Declares related wallets → admin reviews
    Legitimate: score recalculated, flag cleared
    Suspicious: escalate to sybil review

  PATH B — no response in 14 days:
    State: AUTHORIZED → PROBATIONARY
    New emissions: 25% liquid / 75% vesting
    If score later hits 3.5+: provisional task cap (50%)
    If score hits 4.5+: immediate grouping, suspension review
```

---

## 16. Registration Stake Requirements

| State | Stake (PFT) | Notes |
|-------|-------------|-------|
| UNKNOWN | 0 | Cannot participate (post-enforcement) |
| PROBATIONARY | 10–50 | Slashed on confirmed sybil |
| AUTHORIZED | 50–200 | Tier-dependent, fully slashable |
| TRUSTED | 200+ | Layer B — enhanced privileges |
| SUSPENDED | Frozen | Pending review |

---

## Layer B Items (Phase 2 — not implemented in v1.1)

For tracking. These are designed but not shipped:

- Linking score declaration submission flows
- Concentration graph dynamics and grouped wallet treatment
- TRUSTED state promotion criteria and reduced gate checks
- Advanced cooldown escalation with stake slashing
- Clawback workflow automation
- Cross-epoch concentration rebalancing
- Grouped wallet shared cap enforcement

---

*End of specification v1.1. Implementation begins with Phase 1 shadow deployment targeting Gate 4 transaction boundary as the critical-path deliverable.*
