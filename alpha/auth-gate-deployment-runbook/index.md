---
layout: page
title: "Authorization Gate Enforcement — Deployment Runbook v1.0"
permalink: /alpha/auth-gate-deployment-runbook/
description: "Deployment runbook for Authorization Gate v4.1 enforcement: environment setup, SQL migrations, middleware registration, integration tests, and rollback procedure."
---

# Authorization Gate Enforcement — Deployment Runbook v1.0

**Published:** 2026-03-18  
**Spec Reference:** [Authorization Gate Enforcement Spec](https://pft.permanentupperclass.com/alpha/auth-gate-enforcement-spec/)  
**Policy Version:** v1.1  
**Status:** Production-ready

---

## Overview

This runbook provides step-by-step operational procedures for deploying the Authorization Gate enforcement system to a production Post Fiat task network. The gate system enforces contributor eligibility checks across the task lifecycle, culminating in Gate 4 — the critical serializable transaction guard placed immediately before irreversible PFT reward emission.

The gate system implements three graduated enforcement levels (shadow, soft, full) that allow operators to progressively tighten controls while monitoring for false positives. Deployment follows a shadow → soft → full ramp, typically spanning two to four epochs before full enforcement is activated.

```
Task Lifecycle with Authorization Gates
========================================

  REGISTRATION ──► Gate 1 ──► PROPOSAL ──► Gate 2 ──► ACCEPTANCE
                  (wallet                  (proposal
                   exists?)                 eligible?)

  ACCEPTANCE ──► EVIDENCE SUBMISSION ──► Gate 3 ──► ADJUDICATION
                                         (evidence
                                          valid?)

  ADJUDICATION ──► Gate 4 ──► EMIT REWARD ──► RECORD OUTCOME
                  (auth check
                   ← THIS IS THE
                     CRITICAL PATH)

Gate 4 is the ONLY point that guards irreversible emission.
All other gates are informational / advisory in shadow mode.
```

---

## Section 1: Environment Prerequisites and Dependency Manifest

### 1.1 Runtime Requirements

Before beginning deployment, verify the following runtime versions are installed and available on all nodes that will run the adjudication service:

```
Node.js         >= 18.0.0   (LTS recommended: 20.x or 22.x)
TypeScript      >= 5.0.0
PostgreSQL      >= 14.0     (16.x recommended for performance)
Redis           >= 7.0.0
npm / pnpm      >= 8.x
```

Verify with:

```bash
node --version
tsc --version
psql --version
redis-cli --version
```

### 1.2 Required npm Dependencies

Add the following to `package.json` under `dependencies`:

```json
{
  "pg": "^8.11.0",
  "@types/pg": "^8.10.0",
  "ioredis": "^5.3.0",
  "zod": "^3.22.0",
  "pino": "^8.15.0",
  "pino-pretty": "^10.2.0"
}
```

Dev dependencies required for integration tests:

```json
{
  "jest": "^29.7.0",
  "@types/jest": "^29.5.0",
  "ts-jest": "^29.1.0",
  "testcontainers": "^10.2.0"
}
```

Install with:

```bash
npm install
npm install --save-dev jest @types/jest ts-jest testcontainers
```

### 1.3 Infrastructure Dependencies

The following infrastructure must be provisioned and reachable before deployment:

```
PostgreSQL cluster
  - Min: 1 primary, 1 read replica
  - Storage: 50GB+ (audit log grows unbounded, plan for partitioning)
  - Connection pooling: PgBouncer recommended (pool_size=20 per app node)
  - Extensions required: none (advisory locks are built-in)

Redis cluster
  - Min: single instance with persistence (RDB + AOF)
  - Used for: distributed lock coordination, rate-limit counters
  - Memory: 512MB+ recommended

IPFS gateway
  - Used by validateIPFSEvidence() upstream of Gate 4
  - Must be reachable before adjudication workers start
  - Recommended: Pinata or local IPFS node with public gateway
```

### 1.4 Environment Variables

Set the following environment variables on all adjudication nodes. Use a secrets manager (AWS Secrets Manager, Vault, or equivalent) for credential values — do not commit tokens to source control.

```bash
# Core database connection
DATABASE_URL=postgresql://pft_app:REDACTED@db-primary:5432/pft_production

# Redis connection
REDIS_URL=redis://redis-primary:6379/0

# Authorization Gate controls
AUTH_GATE_ENABLED=true
AUTH_GATE_ENFORCEMENT_MODE=shadow        # shadow | soft | full
AUTH_GATE_LOG_LEVEL=info                 # debug | info | warn
AUTH_GATE_POLICY_VERSION=v1.1

# Application settings
NODE_ENV=production
LOG_FORMAT=json
```

**Enforcement Mode Ramp Schedule:**

```
Week 1-2:   AUTH_GATE_ENFORCEMENT_MODE=shadow   (observe, no rejections)
Week 3-4:   AUTH_GATE_ENFORCEMENT_MODE=soft     (hold emissions, notify)
Week 5+:    AUTH_GATE_ENFORCEMENT_MODE=full     (hard reject unauthorized)
```

The `AUTH_GATE_ENABLED=false` environment variable (or `policy_config` key `auth_gate_enabled=0`) acts as a master kill switch. Setting either disables all gate checks immediately without requiring a code deployment.

### 1.5 Network and Firewall Requirements

```
Adjudication nodes  →  PostgreSQL primary:5432     REQUIRED
Adjudication nodes  →  Redis:6379                  REQUIRED
Adjudication nodes  →  IPFS gateway (HTTPS/443)    REQUIRED
Adjudication nodes  →  Outbound HTTPS for alerts   OPTIONAL
Monitoring          →  PostgreSQL replica:5432      READ-ONLY
```

---

## Section 2: SQL Migration Scripts

Run all migrations in order. Each migration is idempotent — safe to re-run. Migrations must be applied to the primary PostgreSQL instance before starting any adjudication nodes with `AUTH_GATE_ENABLED=true`.

### 2.1 Migration 001 — Core Authorization State Table

```sql
-- Migration: 001_contributor_authorization.sql
-- Description: Creates the core contributor authorization state table
-- Idempotent: YES (uses IF NOT EXISTS)

BEGIN;

CREATE TABLE IF NOT EXISTS contributor_authorization (
    wallet                    TEXT NOT NULL PRIMARY KEY,
    state                     TEXT NOT NULL DEFAULT 'UNKNOWN'
                              CHECK (state IN ('UNKNOWN','PROBATIONARY','AUTHORIZED','TRUSTED','SUSPENDED')),
    tier                      SMALLINT NOT NULL DEFAULT 0,
    registration_stake        BIGINT NOT NULL DEFAULT 0,
    linking_score             NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    cooldown_until            TIMESTAMPTZ,
    cooldown_count            SMALLINT NOT NULL DEFAULT 0,
    cooldown_epoch            VARCHAR(32),
    pft_accumulation_counter  BIGINT NOT NULL DEFAULT 0,
    grandfathered             BOOLEAN NOT NULL DEFAULT FALSE,
    suspended_at              TIMESTAMPTZ,
    suspension_reason         TEXT,
    policy_version            VARCHAR(16) NOT NULL DEFAULT 'v1.1',
    auth_version              INTEGER NOT NULL DEFAULT 1,
    created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Composite index for the hot path: wallet + state lookup in Gate 4
CREATE INDEX IF NOT EXISTS idx_auth_wallet_state
    ON contributor_authorization(wallet, state);

-- Partial index for cooldown queries (only rows with active cooldowns)
CREATE INDEX IF NOT EXISTS idx_auth_cooldown
    ON contributor_authorization(cooldown_until)
    WHERE cooldown_until IS NOT NULL;

COMMIT;
```

### 2.2 Migration 002 — Audit Log Table

```sql
-- Migration: 002_authorization_audit_log.sql
-- Description: Immutable audit trail for all authorization state transitions
-- NOTE: Rows in this table must NEVER be deleted (compliance requirement)

BEGIN;

CREATE TABLE IF NOT EXISTS authorization_audit_log (
    id             BIGSERIAL PRIMARY KEY,
    wallet         TEXT NOT NULL,
    old_state      TEXT,
    new_state      TEXT NOT NULL,
    reason         TEXT NOT NULL,
    epoch_id       TEXT,
    policy_version VARCHAR(16) NOT NULL,
    auth_version   INTEGER NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata       JSONB
);

-- Index for per-wallet audit history (most recent first)
CREATE INDEX IF NOT EXISTS idx_audit_wallet_time
    ON authorization_audit_log(wallet, created_at DESC);

COMMIT;
```

### 2.3 Migration 003 — Policy Configuration Table

```sql
-- Migration: 003_policy_config.sql
-- Description: Runtime-adjustable policy parameters
-- Idempotent: YES (uses INSERT ... ON CONFLICT DO NOTHING)

BEGIN;

CREATE TABLE IF NOT EXISTS policy_config (
    key            TEXT NOT NULL PRIMARY KEY,
    value          NUMERIC NOT NULL,
    description    TEXT NOT NULL,
    policy_version VARCHAR(16) NOT NULL,
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed initial policy values (v1.1)
INSERT INTO policy_config (key, value, description, policy_version) VALUES
  ('min_stake_probationary',        200,   'Minimum PFT stake for PROBATIONARY state',          'v1.1'),
  ('min_stake_authorized',          1000,  'Minimum PFT stake for AUTHORIZED state',             'v1.1'),
  ('unauthorized_pft_threshold',    10000, 'PFT threshold triggering UNAUTHORIZED flag',         'v1.1'),
  ('concentration_cap_bps',         1500,  'Max concentration basis points (15%)',               'v1.1'),
  ('probationary_vesting_pct',      75,    'Percent of reward held in vesting for PROBATIONARY', 'v1.1'),
  ('probationary_liquid_pct',       25,    'Percent of reward paid liquid for PROBATIONARY',     'v1.1'),
  ('linking_soft_flag_threshold',   1.5,   'Linking score soft flag threshold',                  'v1.1'),
  ('linking_hard_block_threshold',  2.0,   'Linking score hard block threshold',                 'v1.1'),
  ('shadow_false_positive_max_pct', 5,     'Max acceptable false positive rate in shadow mode',  'v1.1'),
  ('auth_gate_enabled',             1,     'Master kill switch: 1=enabled, 0=disabled',          'v1.1')
ON CONFLICT (key) DO NOTHING;

COMMIT;
```

### 2.4 Migration 004 — Emission Hold Table

```sql
-- Migration: 004_emission_hold.sql
-- Description: Holds emissions in soft/shadow modes pending review

BEGIN;

CREATE TABLE IF NOT EXISTS emission_hold (
    id               BIGSERIAL PRIMARY KEY,
    task_id          TEXT NOT NULL UNIQUE,
    wallet           TEXT NOT NULL,
    amount_pft       BIGINT NOT NULL,
    hold_reason      TEXT NOT NULL,
    enforcement_mode TEXT NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    released_at      TIMESTAMPTZ,
    voided_at        TIMESTAMPTZ
);

-- Index for unreleased holds (the operator review queue)
CREATE INDEX IF NOT EXISTS idx_hold_pending
    ON emission_hold(wallet, created_at DESC)
    WHERE released_at IS NULL AND voided_at IS NULL;

COMMIT;
```

### 2.5 Migration Execution

Run all migrations sequentially from the repo root:

```bash
# Set your database URL
export DATABASE_URL="postgresql://pft_app:REDACTED@db-primary:5432/pft_production"

# Apply migrations
psql "$DATABASE_URL" -f migrations/001_contributor_authorization.sql
psql "$DATABASE_URL" -f migrations/002_authorization_audit_log.sql
psql "$DATABASE_URL" -f migrations/003_policy_config.sql
psql "$DATABASE_URL" -f migrations/004_emission_hold.sql

# Verify tables exist
psql "$DATABASE_URL" -c "\dt contributor_authorization authorization_audit_log policy_config emission_hold"
```

Expected output: four rows in the table listing. Any error terminates deployment — do not proceed until all migrations succeed.

---

## Section 3: Middleware Registration Sequence

### 3.1 Architecture Overview

The authorization gate is implemented as middleware that wraps the `emitReward()` call inside the adjudication pipeline. It is not a separate service — it runs in-process within the adjudication worker, sharing the same PostgreSQL connection pool and Redis client.

```
Adjudication Pipeline — Insertion Point Diagram
=================================================

  adjudicate(task)
       │
       ▼
  ┌─────────────────────┐
  │ 1. validateIPFS     │  <── reads from IPFS gateway
  │    Evidence()       │
  └────────┬────────────┘
           │
           ▼
  ┌─────────────────────┐
  │ 2. computeScore()   │  <── pure computation, no I/O
  └────────┬────────────┘
           │
           ▼
  ┌─────────────────────┐  ◄── INSERTION POINT (Gate 4)
  │ 3. gate4AuthCheck() │      AUTH_GATE_ENABLED guards this block
  │   [NEW MIDDLEWARE]  │      Serializable TX + advisory lock
  └────────┬────────────┘
           │
           │ pass: false?
           ├──────────────────► holdEmission() or hard reject
           │                    (depending on enforcement mode)
           │ pass: true
           ▼
  ┌─────────────────────┐
  │ 4. emitReward()     │  <── IRREVERSIBLE: PFT leaves treasury
  └────────┬────────────┘
           │
           ▼
  ┌─────────────────────┐
  │ 5. recordOutcome()  │
  └─────────────────────┘
```

### 3.2 Registration Order of Operations

Apply the following changes in order. Do not skip steps — each depends on the previous.

**Step 1: Deploy database migrations** (Section 2 above)

**Step 2: Deploy updated adjudication worker code** that includes the `gate4AuthCheck()` function. The function must be present in the codebase before environment variables are set — a running worker with `AUTH_GATE_ENABLED=false` in the environment is safe to deploy at any time.

**Step 3: Verify the gate function is loading correctly** by checking startup logs:

```bash
# Expected log line on startup when gate is disabled:
{"level":"info","msg":"AuthGate: disabled (AUTH_GATE_ENABLED=false)","policy":"v1.1"}

# Expected log line when gate is enabled in shadow mode:
{"level":"info","msg":"AuthGate: active","mode":"shadow","policy":"v1.1"}
```

**Step 4: Enable gate in shadow mode** by setting environment variables and performing a rolling restart of adjudication workers:

```bash
AUTH_GATE_ENABLED=true
AUTH_GATE_ENFORCEMENT_MODE=shadow
```

**Step 5: Monitor shadow mode for two full epochs.** Check the false positive rate against the policy threshold:

```sql
-- Count shadow blocks vs. total gate evaluations in last epoch
SELECT
  COUNT(*) FILTER (WHERE metadata->>'shadow' = 'true') AS shadow_blocks,
  COUNT(*) AS total_evaluations,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE metadata->>'shadow' = 'true') / NULLIF(COUNT(*), 0),
    2
  ) AS false_positive_pct
FROM authorization_audit_log
WHERE created_at > NOW() - INTERVAL '7 days';
```

The `shadow_false_positive_max_pct` policy value is 5%. If the rate exceeds this threshold, do not advance to soft or full mode until the root cause is identified and corrected.

**Step 6: Advance to soft enforcement** (after shadow monitoring is clean):

```bash
AUTH_GATE_ENFORCEMENT_MODE=soft
# Rolling restart required
```

**Step 7: Advance to full enforcement** (after soft mode is stable):

```bash
AUTH_GATE_ENFORCEMENT_MODE=full
# Rolling restart required
```

### 3.3 Feature Flag Gates Summary

```
Master Kill Switch
──────────────────
  AUTH_GATE_ENABLED=false   →  Bypasses gate4AuthCheck() entirely
  policy_config.auth_gate_enabled=0  →  Same effect, hot-reloadable

Enforcement Mode Progression
─────────────────────────────
  shadow  →  Log violations, emit anyway (pass: true, shadow: true)
  soft    →  Log + hold emission (pass: false, code: RETRY_LATER)
  full    →  Log + hard reject (pass: false, code: NOT_ELIGIBLE)

Per-State Behavior Matrix
──────────────────────────
  State           shadow    soft            full
  ──────────────────────────────────────────────
  AUTHORIZED      PASS      PASS            PASS
  TRUSTED         PASS      PASS            PASS
  PROBATIONARY*   PASS      PASS/HOLD       PASS/BLOCK
  UNKNOWN         LOG/PASS  HOLD            BLOCK
  SUSPENDED       LOG/PASS  HOLD            BLOCK

  * PROBATIONARY with active cooldown is treated as HOLD/BLOCK
```

### 3.4 Redis Usage

Redis is used for distributed rate limiting and advisory lock coordination across multiple adjudication worker nodes. The gate acquires a PostgreSQL advisory lock (`pg_advisory_xact_lock`) within the serializable transaction, which is sufficient for single-node deployments. For multi-node deployments, Redis provides the cross-process coordination layer.

Key patterns used:

```
pft:authgate:lock:{walletHash}    TTL: 30s   Per-wallet processing lock
pft:authgate:rate:{wallet}        TTL: 60s   Rate limit counter
```

---

## Section 4: Integration Test Scenarios

All scenarios must pass before advancing from shadow mode to soft mode. Run the test suite with:

```bash
npm test -- --testPathPattern=auth-gate
```

The test suite uses `testcontainers` to spin up ephemeral PostgreSQL and Redis instances. No external database is required to run tests.

---

### Scenario A — Unauthorized Submission (Full Enforcement)

**Purpose:** Verify that a wallet in UNKNOWN state is hard-rejected in full enforcement mode and that no emission occurs.

**Setup:**

```sql
-- No row in contributor_authorization for wallet '0xUNKNOWN001'
-- (UNKNOWN is the default state when no row exists)
```

```bash
AUTH_GATE_ENFORCEMENT_MODE=full
AUTH_GATE_ENABLED=true
```

**Input:**

```
wallet:      '0xUNKNOWN001'
task_id:     'T001'
amount_pft:  500n (BigInt)
mode:        full
```

**Expected Outputs:**

```
gate4AuthCheck() return value:
  { pass: false, code: 'NOT_ELIGIBLE', reason: 'UNKNOWN' }

authorization_audit_log row inserted:
  wallet:    '0xUNKNOWN001'
  new_state: 'UNKNOWN'
  reason:    'GATE4_BLOCK'
  metadata:  { state: 'UNKNOWN', taskId: 'T001', mode: 'full' }

emission_hold row:
  NOT created (full mode = hard reject, no hold)

emitReward() call count:
  0 (must not be called)
```

**Pass Criteria:**

- `result.pass === false`
- `result.code === 'NOT_ELIGIBLE'`
- Exactly 1 audit log row with `reason = 'GATE4_BLOCK'`
- Zero rows in `emission_hold` for task_id `T001`
- `emitReward` mock invocation count is 0
- PostgreSQL transaction is rolled back (not committed with hold data)

**Fail Criteria:** Any of the above conditions not met, or an exception is thrown rather than returning the structured error result.

---

### Scenario B — Probationary Cooldown Escalation

**Purpose:** Verify that a PROBATIONARY wallet with an active cooldown is held in soft mode, and that emission proceeds after the cooldown expires.

**Setup:**

```sql
INSERT INTO contributor_authorization
  (wallet, state, registration_stake, cooldown_until, cooldown_count)
VALUES
  ('0xPROB002', 'PROBATIONARY', 300, NOW() + INTERVAL '2 hours', 1);
```

```bash
AUTH_GATE_ENFORCEMENT_MODE=full
AUTH_GATE_ENABLED=true
```

**Input (Phase 1 — during cooldown):**

```
wallet:        '0xPROB002'
task_id:       'T002'
amount_pft:    750n
mode:          full
cooldown_until: NOW() + 2 hours (active)
```

**Expected Outputs (Phase 1):**

```
gate4AuthCheck() return value:
  { pass: false, code: 'RETRY_LATER', reason: 'held_for_review' }

authorization_audit_log row inserted:
  wallet: '0xPROB002'
  reason: 'COOLDOWN_ACTIVE'

emission_hold row inserted:
  task_id:          'T002'
  wallet:           '0xPROB002'
  amount_pft:       750
  hold_reason:      'COOLDOWN_ACTIVE'
  enforcement_mode: 'full'
  released_at:      NULL
```

**Input (Phase 2 — after cooldown expires):**

```sql
-- Simulate cooldown expiry
UPDATE contributor_authorization
SET cooldown_until = NOW() - INTERVAL '1 minute'
WHERE wallet = '0xPROB002';
```

**Expected Outputs (Phase 2):**

```
gate4AuthCheck() return value:
  { pass: true }

emitReward() called once
emission_hold row for T002 remains unchanged (not auto-released by gate)
```

**Pass Criteria:**

- Phase 1: `result.pass === false`, `result.code === 'RETRY_LATER'`
- Phase 1: `emission_hold` row exists for T002 with `released_at IS NULL`
- Phase 1: `authorization_audit_log` contains `reason = 'COOLDOWN_ACTIVE'`
- Phase 2: `result.pass === true`
- Phase 2: `emitReward` mock called exactly once

**Fail Criteria:** Gate passes in Phase 1, or gate blocks in Phase 2 after cooldown expires.

---

### Scenario C — Authorized Passthrough

**Purpose:** Verify that a fully AUTHORIZED wallet with no cooldown passes Gate 4 and receives 100% liquid emission.

**Setup:**

```sql
INSERT INTO contributor_authorization
  (wallet, state, registration_stake, tier)
VALUES
  ('0xAUTH003', 'AUTHORIZED', 1500, 1);
-- No cooldown_until set (NULL = no active cooldown)
```

```bash
AUTH_GATE_ENFORCEMENT_MODE=full
AUTH_GATE_ENABLED=true
```

**Input:**

```
wallet:     '0xAUTH003'
task_id:    'T003'
amount_pft: 1000n
mode:       full
```

**Expected Outputs:**

```
gate4AuthCheck() return value:
  { pass: true }
  (no 'shadow' field, no 'code' field)

emitReward() called once with full amount (1000 PFT)

emission_hold row:
  NOT created

authorization_audit_log row inserted:
  wallet:    '0xAUTH003'
  reason:    'GATE4_PASS'
  new_state: 'AUTHORIZED'
```

**Pass Criteria:**

- `result.pass === true`
- `result.shadow` is undefined (not a shadow pass)
- `emitReward` mock called exactly once with `amountPft === 1000n`
- Zero rows in `emission_hold` for task_id `T003`
- Audit log contains one row with `reason = 'GATE4_PASS'`

**Fail Criteria:** Emission blocked, held, or reduced. Audit log missing or contains GATE4_BLOCK instead of GATE4_PASS.

---

### Scenario D — Kill Switch / Rollback Verification

**Purpose:** Verify that setting `AUTH_GATE_ENABLED=false` completely bypasses gate logic and leaves existing holds untouched.

**Setup:**

```sql
-- Pre-existing hold from before kill switch activation
INSERT INTO emission_hold
  (task_id, wallet, amount_pft, hold_reason, enforcement_mode)
VALUES
  ('T004-PRE', '0xSUSP004', 200, 'SUSPENDED', 'soft');

-- Suspended wallet that would normally be blocked
INSERT INTO contributor_authorization (wallet, state)
VALUES ('0xSUSP004', 'SUSPENDED');
```

```bash
AUTH_GATE_ENABLED=false   # Kill switch active
```

**Input:**

```
wallet:     '0xSUSP004'
task_id:    'T004'
amount_pft: 200n
```

**Expected Outputs:**

```
gate4AuthCheck():
  NOT called (bypassed by kill switch)

emitReward():
  Called immediately (no gate check)

emission_hold row for T004-PRE:
  UNCHANGED (released_at still NULL)
  (kill switch does NOT auto-release held emissions)

authorization_audit_log:
  No new rows created for this task
```

**Pass Criteria:**

- `gate4AuthCheck` mock not called at all
- `emitReward` called exactly once
- `emission_hold` row for `T004-PRE` has `released_at IS NULL` (unchanged)
- `authorization_audit_log` row count unchanged from before the test
- No exceptions thrown

**Fail Criteria:** Gate function called when kill switch is active, or pre-existing holds are auto-released.

---

## Section 5: Rollback Procedure

Use this procedure if the authorization gate causes unintended production impact after go-live. The procedure is designed for safe, auditable recovery without data loss.

### 5.1 Immediate Kill Switch (< 2 minutes)

Flip the master kill switch without redeploying code:

```bash
# Option A: Environment variable (requires process restart)
AUTH_GATE_ENABLED=false
# Then rolling restart adjudication workers

# Option B: Database config (hot-reload, no restart required if workers poll config)
```

```sql
-- Option B: hot kill via policy_config
UPDATE policy_config
SET value = 0, updated_at = NOW()
WHERE key = 'auth_gate_enabled';
```

Verify kill switch is effective by checking logs:

```bash
# Should see this log line immediately after kill switch:
# {"level":"warn","msg":"AuthGate: disabled by kill switch","triggered_by":"policy_config"}
```

### 5.2 Review and Release Held Emissions

Do NOT auto-release all held emissions. Review them first. Release only emissions where the wallet was in AUTHORIZED or TRUSTED state at the time of the hold:

```sql
-- Step 2a: Inspect what's held
SELECT
  eh.task_id,
  eh.wallet,
  eh.amount_pft,
  eh.hold_reason,
  eh.enforcement_mode,
  ca.state AS current_state,
  eh.created_at
FROM emission_hold eh
LEFT JOIN contributor_authorization ca ON ca.wallet = eh.wallet
WHERE eh.released_at IS NULL AND eh.voided_at IS NULL
ORDER BY eh.created_at ASC;

-- Step 2b: Release holds only for wallets that are AUTHORIZED or TRUSTED
-- (these were incorrectly held, likely a false positive)
UPDATE emission_hold
SET released_at = NOW()
WHERE released_at IS NULL
  AND voided_at IS NULL
  AND wallet IN (
    SELECT wallet FROM contributor_authorization
    WHERE state IN ('AUTHORIZED', 'TRUSTED')
  );

-- Step 2c: Do NOT release holds for UNKNOWN, PROBATIONARY, or SUSPENDED wallets
-- Those require manual review before releasing
```

### 5.3 Audit Shadow Violations from Logs

After rollback, review what the shadow mode would have blocked to understand the scope of enforcement impact:

```sql
-- Replace $rollback_start with the timestamp when issues began
SELECT
  wallet,
  COUNT(*) AS violations,
  MIN(created_at) AS first_seen,
  MAX(created_at) AS last_seen,
  JSONB_AGG(DISTINCT metadata->>'state') AS observed_states
FROM authorization_audit_log
WHERE created_at > '2026-03-18T00:00:00Z'   -- replace with $rollback_start
  AND metadata->>'shadow' = 'true'
GROUP BY wallet
ORDER BY violations DESC
LIMIT 100;
```

**Important:** Do not delete or modify any rows in `authorization_audit_log`. This table is the compliance trail and must remain intact.

### 5.4 Root Cause Investigation Checklist

Before re-enabling the gate after rollback, confirm:

```
[ ] False positive rate in shadow logs is below 5% threshold
[ ] All affected wallets have been reviewed in contributor_authorization
[ ] emission_hold queue has been triaged (released or voided as appropriate)
[ ] Policy config values in policy_config table are correct for v1.1
[ ] AUTH_GATE_POLICY_VERSION matches expected version in all workers
[ ] Database indexes are healthy (no bloat on idx_auth_wallet_state)
[ ] No serialization errors appearing in adjudication worker logs
[ ] Redis connectivity stable (no lock timeout errors)
```

### 5.5 Re-Enabling After Rollback

Re-enable in shadow mode and repeat the ramp schedule from Section 3.2, Step 4. Do not skip directly to full enforcement mode after a rollback.

```bash
AUTH_GATE_ENABLED=true
AUTH_GATE_ENFORCEMENT_MODE=shadow
```

---

## Appendix: Contributor State Reference

```
State Transition Diagram
=========================

           register (stake >= 200 PFT)
  NEW ──────────────────────────────► PROBATIONARY
  wallet                                  │
                                          │ stake >= 1000 PFT
                                          │ + passing epoch
                                          ▼
                                      AUTHORIZED ◄──── manual grant
                                          │
                                          │ sustained performance
                                          │ + linking score < 1.5
                                          ▼
                                        TRUSTED
                                          │
                              ┌───────────┼───────────┐
                              │ violation │           │ violation
                              ▼           │           ▼
                          SUSPENDED       │       SUSPENDED
                              │           │
                              │ appeal/   │
                              │ review    │
                              ▼           │
                          (any state) ◄───┘
```

---

## Revision History

```
v1.0  2026-03-18  Initial deployment runbook
                  Covers: env prereqs, SQL migrations, middleware
                  registration, 4 integration test scenarios, rollback
```

---

*Word count: ~2,100 words*  
*Source spec: [https://pft.permanentupperclass.com/alpha/auth-gate-enforcement-spec/](https://pft.permanentupperclass.com/alpha/auth-gate-enforcement-spec/)*  
*Published: 2026-03-18*
