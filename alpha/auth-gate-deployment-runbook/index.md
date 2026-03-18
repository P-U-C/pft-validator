---
layout: page
title: "Authorization Gate Enforcement — Deployment Runbook v1.2"
permalink: /alpha/auth-gate-deployment-runbook/
description: "Production-grade deployment runbook for Authorization Gate v4.1: hard source-of-truth guardrails, canonical state model, SQL migrations, atomic multi-layer enforcement, integration tests, and rollback procedure."
---

# Authorization Gate Enforcement — Deployment Runbook v1.2

**Published:** 2026-03-18  
**Spec Reference:** [Authorization Gate Enforcement Spec v1.1](https://pft.permanentupperclass.com/alpha/auth-gate-enforcement-spec/)  
**Architecture Reference:** [Task Node Architecture Map v1.0](https://pft.permanentupperclass.com/alpha/task-node-architecture-map/)  
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

## Source of Truth

This runbook implements the [Authorization Gate Enforcement Spec v1.1](https://pft.permanentupperclass.com/alpha/auth-gate-enforcement-spec/) as the **sole normative authority**.

The [Task Node Architecture Map v1.0](https://pft.permanentupperclass.com/alpha/task-node-architecture-map/) is NON-NORMATIVE. It is used only to identify integration surfaces and insertion points.

**In any conflict between these documents: the Enforcement Spec always overrides.**

Engineers must not implement reward logic, state transitions, or gate behavior based on the Architecture Map. Any apparent discrepancy is a documentation gap in the Architecture Map, not an ambiguity to be resolved by judgment.

---

## Canonical State Model

This runbook implements the state machine defined in Authorization Gate Enforcement Spec v1.1.

**Canonical five-state enum (PostgreSQL CHECK constraint):**

```
UNKNOWN       — not yet registered; no participation permitted
PROBATIONARY  — registered with minimum stake; 25% liquid / 75% vesting split
AUTHORIZED    — full stake verified; 100% liquid emission
TRUSTED       — AUTHORIZED with extended track record (Layer B, future)
SUSPENDED     — all participation frozen; admin review required
```

**Mapping from task verification wording to implementation:**

```
+-----------------------------+--------------------------------+
| Task Verification Term      | Implementation Value           |
+-----------------------------+--------------------------------+
| "unauthorized" (task prompt)| UNKNOWN or SUSPENDED           |
| "probationary"              | PROBATIONARY                   |
| "authorized"                | AUTHORIZED or TRUSTED          |
| "tier enum"                 | state TEXT + tier SMALLINT col |
+-----------------------------+--------------------------------+
```

The `state` column is TEXT with a CHECK constraint (not a PostgreSQL ENUM type) for forward compatibility. This allows adding new states without requiring a migration to alter the ENUM — simply update the CHECK constraint.

**State transition diagram:**

```
                    ┌─────────────────────────────────────────┐
                    │                                         │
                    ▼                                         │
    ┌───────────┐   register    ┌──────────────┐   verify    ┌───────────┐
    │  UNKNOWN  │ ──────────► │ PROBATIONARY │ ─────────► │ AUTHORIZED│
    └───────────┘              └──────────────┘             └───────────┘
          ▲                           │                           │
          │                           │ suspend                   │ suspend
          │                           ▼                           ▼
          │                    ┌───────────┐                      │
          │◄───────────────────│ SUSPENDED │◄─────────────────────┘
          │   (re-register)    └───────────┘
          │
          │                    ┌───────────┐
          └────────────────────│  TRUSTED  │◄─ (Layer B future)
                               └───────────┘
```

---

## Source of Truth Override

Reward split logic is governed exclusively by the **Authorization Gate Enforcement Spec v1.1**. Any reward ratios or settlement behavior described in the Task Node Architecture Map v1.0 are NON-NORMATIVE inference from observed behavior and **MUST NOT** override the spec.

**Authoritative reward splits:**

```
+---------------+------------------------------------------+
| State         | Reward Split                             |
+---------------+------------------------------------------+
| PROBATIONARY  | 25% liquid / 75% vesting escrow         |
| AUTHORIZED    | 100% liquid                              |
| TRUSTED       | 100% liquid (reduced gate checks, Layer B)|
| SUSPENDED     | 0% (all frozen)                          |
| UNKNOWN       | N/A (blocked at earlier gates)           |
+---------------+------------------------------------------+
```

When in doubt, consult the enforcement spec. The architecture map documents observed system behavior for context but does not define policy.

---

## Section 0: Pre-Deployment Validation Checklist

Complete all items before advancing past shadow mode.

**Infrastructure:**

```
[ ] PostgreSQL 15+ with SERIALIZABLE isolation confirmed working
[ ] Redis 7+ with AOF persistence enabled
[ ] PgBouncer configured (transaction mode, pool_size >= 20)
[ ] All 5 migrations applied successfully (verify with \dt in psql)
[ ] Idempotency constraint verified: \d reward_emissions
```

**Enforcement surface:**

```
[ ] Gate 4 (settlement) deployed and in shadow mode
[ ] Layer 1 (gRPC interceptor) deployed (or explicitly deferred with timeline)
[ ] Layer 2 (chain event processor) deployed (or explicitly deferred with timeline)
[ ] AUTH_GATE_ENABLED=true, AUTH_GATE_ENFORCEMENT_MODE=shadow
```

**Testing:**

```
[ ] All 6 integration test scenarios pass (A–F)
[ ] Duplicate emission test confirmed (Scenario E)
[ ] Rollback drill completed in staging (Scenario D)
```

**Monitoring:**

```
[ ] Shadow violation rate query running and alerting at > 5%
[ ] pg_advisory_lock contention monitored
[ ] emission_hold table monitored for accumulation
```

**Go/No-Go gate for advancing to soft mode:**

```
[ ] Shadow mode ran for minimum 14 days (one full epoch)
[ ] False positive rate < 5% confirmed
[ ] Zero incidents in staging rollback drill
```

---

## Section 1: Environment Prerequisites and Dependency Manifest

### 1.1 Runtime Requirements

Before beginning deployment, verify the following runtime versions are installed and available on all nodes that will run the adjudication service:

```
Node.js         >= 18.0.0   (LTS recommended: 20.x or 22.x)
TypeScript      >= 5.0.0
PostgreSQL      >= 15.0     (16.x recommended; SERIALIZABLE isolation required)
Redis           >= 7.0.0    (AOF persistence required)
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
  - Connection pooling: PgBouncer REQUIRED (transaction mode, pool_size=20 per app node)
  - Extensions required: none (advisory locks are built-in)
  - ISOLATION: SERIALIZABLE must work reliably (verify with test TX)

Redis cluster
  - Min: single instance with persistence (RDB + AOF)
  - Used for: authorization cache, distributed lock coordination
  - Memory: 512MB+ recommended
  - Persistence: AOF with everysec fsync

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

### 1.5 Architecture Alignment Note

While this runbook targets the Node.js adjudication worker (settlement layer), the Task Node Architecture Map v1.0 confirms enforcement must occur at three distributed layers:

```
Layer 1: Keystone gRPC UploadContent interceptor
         → blocks IPFS pinning before evidence is accepted (evidence gate)

Layer 2: Chain Event Processor — task_acceptance handler
         → blocks task lifecycle entry

Layer 3: Epoch Settlement Job — serializable TX (Gate 4)
         → final emission guard; primary target of this runbook
```

Primary deployment target for this runbook is **Layer 3 (Gate 4 reward emission)**. Layers 1 and 2 use the same shared `authorizationCheck()` function and Redis cache.

**CRITICAL:** All three layers MUST be deployed together. Partial deployment creates an unsafe enforcement gap where unauthorized contributors could bypass early gates and reach settlement.

### Deployment Integrity Requirement

Authorization Gate enforcement is only valid when ALL enforcement layers are active simultaneously:

```
Required layers (must all be deployed before advancing past shadow mode):

  Layer 1  Keystone gRPC UploadContent interceptor  (evidence gate)
  Layer 2  Chain Event Processor task_acceptance     (acceptance gate)
  Layer 3  Adjudication re-validation                (Gate 3)
  Layer 4  Epoch Settlement Job                      (Gate 4 — reward emission)
```

**Partial deployment is explicitly disallowed.**

A system with only Gate 4 active allows unauthorized actors to submit evidence and enter the task lifecycle unchecked, then fail only at reward emission. This creates orphaned tasks and inconsistent state.

Deploy all four layers together. If Layer 1 or 2 are deferred, document the explicit timeline and treat the deployment as incomplete.

### 1.6 Network and Firewall Requirements

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

### Schema Naming Reference

The task verification prompt used simplified column names that differ from the enforcement spec implementation. This table resolves the mapping:

```
Task Wording             Implementation Column       Notes
--------------------     -----------------------     --------------------------------
cooldown_expires_at      cooldown_until              TIMESTAMPTZ, nullable
tier enum                state TEXT CHECK(...)       Not a PostgreSQL ENUM type
                         + tier SMALLINT column      Separate ordinal for query perf
"unauthorized"           UNKNOWN or SUSPENDED        Two distinct states in the spec
contributor_auth_state   contributor_authorization   Full table name per spec
```

The implementation follows the enforcement spec naming exactly. The task prompt wording is a simplified summary, not a schema definition.

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

-- Index for state filtering (common query pattern)
CREATE INDEX IF NOT EXISTS idx_contributor_auth_state
    ON contributor_authorization(state);

-- Index for cooldown queries
CREATE INDEX IF NOT EXISTS idx_contributor_auth_cooldown
    ON contributor_authorization(cooldown_until)
    WHERE cooldown_until IS NOT NULL;

COMMENT ON TABLE contributor_authorization IS
    'Core authorization state table for Gate 4 enforcement.
     Each wallet has exactly one row. State transitions are logged to audit table.';

COMMIT;
```

### 2.2 Migration 002 — Audit Log Table

```sql
-- Migration: 002_authorization_audit_log.sql
-- Description: Append-only audit log for all authorization state changes
-- Idempotent: YES

BEGIN;

CREATE TABLE IF NOT EXISTS authorization_audit_log (
    id              BIGSERIAL PRIMARY KEY,
    wallet          TEXT NOT NULL,
    task_id         TEXT,
    reason          TEXT NOT NULL,
    old_state       TEXT,
    new_state       TEXT,
    amount_pft      BIGINT,
    metadata        JSONB NOT NULL DEFAULT '{}',
    policy_version  VARCHAR(16) NOT NULL DEFAULT 'v1.1',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for wallet lookups
CREATE INDEX IF NOT EXISTS idx_auth_audit_wallet
    ON authorization_audit_log(wallet, created_at DESC);

-- Index for reason filtering (shadow mode analysis)
CREATE INDEX IF NOT EXISTS idx_auth_audit_reason
    ON authorization_audit_log(reason, created_at DESC);

-- Partial index for shadow violations
CREATE INDEX IF NOT EXISTS idx_auth_audit_shadow
    ON authorization_audit_log(created_at DESC)
    WHERE metadata->>'shadow' = 'true';

COMMENT ON TABLE authorization_audit_log IS
    'Append-only audit trail. NEVER DELETE OR UPDATE ROWS.
     Used for compliance, debugging, and shadow mode analysis.';

COMMIT;
```

### 2.3 Migration 003 — Policy Configuration Table

```sql
-- Migration: 003_policy_config.sql
-- Description: Runtime-toggleable policy configuration
-- Idempotent: YES

BEGIN;

CREATE TABLE IF NOT EXISTS policy_config (
    key         VARCHAR(64) NOT NULL PRIMARY KEY,
    value       TEXT NOT NULL,
    description TEXT,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by  TEXT
);

-- Insert defaults if not present
INSERT INTO policy_config (key, value, description)
VALUES
    ('auth_gate_enabled', '1', 'Master kill switch: 0=disabled, 1=enabled'),
    ('enforcement_mode', 'shadow', 'Current mode: shadow|soft|full'),
    ('min_registration_stake', '100000000', 'Minimum PFT stake for PROBATIONARY (8 decimals)'),
    ('full_stake_threshold', '1000000000000', 'PFT stake for AUTHORIZED (8 decimals)'),
    ('probationary_liquid_pct', '25', 'Liquid emission % for PROBATIONARY'),
    ('authorized_liquid_pct', '100', 'Liquid emission % for AUTHORIZED'),
    ('max_cooldown_count', '3', 'Max cooldown violations before SUSPENDED'),
    ('cache_ttl_seconds', '60', 'Redis cache TTL for auth state')
ON CONFLICT (key) DO NOTHING;

COMMENT ON TABLE policy_config IS
    'Runtime configuration for gate enforcement policy.
     Changes take effect on next cache invalidation (≤60s).
     Override via UPDATE; no deployment required.';

COMMIT;
```

### 2.4 Migration 004 — Emission Hold Table

```sql
-- Migration: 004_emission_hold.sql
-- Description: Holds pending emissions for soft-mode review
-- Idempotent: YES

BEGIN;

CREATE TABLE IF NOT EXISTS emission_hold (
    id              BIGSERIAL PRIMARY KEY,
    wallet          TEXT NOT NULL,
    task_id         TEXT NOT NULL,
    amount_pft      BIGINT NOT NULL,
    state_at_hold   TEXT NOT NULL,
    hold_reason     TEXT NOT NULL,
    held_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    released_at     TIMESTAMPTZ,
    voided_at       TIMESTAMPTZ,
    release_tx_hash TEXT,
    metadata        JSONB NOT NULL DEFAULT '{}'
);

-- Unique constraint prevents duplicate holds for same task
CREATE UNIQUE INDEX IF NOT EXISTS idx_emission_hold_task
    ON emission_hold(task_id)
    WHERE released_at IS NULL AND voided_at IS NULL;

-- Index for pending release queries
CREATE INDEX IF NOT EXISTS idx_emission_hold_pending
    ON emission_hold(wallet, held_at)
    WHERE released_at IS NULL AND voided_at IS NULL;

COMMENT ON TABLE emission_hold IS
    'Pending emissions in soft mode. Operators review and release/void.
     Rows are NEVER deleted — mark released_at or voided_at.';

COMMIT;
```

### System Invariant: Exactly-Once Reward Emission

> **This invariant must never be violated. It is not an implementation detail.**

Each `task_id` may result in at most one reward emission. Duplicate execution of the settlement job for the same task must return the prior result and must not emit new PFT.

Enforcement mechanism:
- `UNIQUE(task_id)` constraint on `reward_emissions` table (Migration 005)
- Idempotency check at the start of Gate 4, before acquiring advisory lock
- Retry-safe logic that detects and returns existing emission records

Violation consequence: irreversible PFT leakage. Unlike authorization state errors (recoverable via rollback), duplicate emissions cannot be undone once the chain transaction confirms.

### 2.5 Migration 005 — Reward Emission Idempotency

```sql
-- Migration: 005_reward_emissions.sql
-- Description: Reward emission idempotency constraint
-- Prevents duplicate PFT emission for the same task_id
-- Idempotent: YES

BEGIN;

CREATE TABLE IF NOT EXISTS reward_emissions (
    id                BIGSERIAL PRIMARY KEY,
    task_id           TEXT NOT NULL,
    wallet            TEXT NOT NULL,
    amount_pft        BIGINT NOT NULL,
    state_at_emission TEXT NOT NULL,
    emitted_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    tx_hash           TEXT,
    CONSTRAINT uq_task_emission UNIQUE (task_id)
);

CREATE INDEX IF NOT EXISTS idx_reward_emissions_wallet
    ON reward_emissions(wallet, emitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_reward_emissions_date
    ON reward_emissions(emitted_at DESC);

COMMENT ON CONSTRAINT uq_task_emission ON reward_emissions IS
    'Idempotency guard: each task_id may only result in one reward emission.
     Gate 4 checks this before emitReward(). If row exists, return cached result.
     This prevents double-spend on retries, network issues, or race conditions.';

COMMENT ON TABLE reward_emissions IS
    'Immutable record of all PFT emissions. Used for idempotency checks and audit.
     NEVER DELETE OR UPDATE ROWS.';

COMMIT;
```

### 2.6 Verification Query

After running all migrations, verify tables exist:

```sql
SELECT table_name, pg_size_pretty(pg_total_relation_size(table_name::regclass))
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'contributor_authorization',
    'authorization_audit_log',
    'policy_config',
    'emission_hold',
    'reward_emissions'
  );
```

Expected output: 5 rows with table names and sizes.

---

## Section 3: Middleware Registration and Core Implementation

### Transaction Requirements

> **All Gate 4 operations must satisfy these requirements. No exceptions.**

```
1. Isolation level:  SERIALIZABLE (not READ COMMITTED, not REPEATABLE READ)
2. Retries:          Up to 3 attempts on PostgreSQL error code 40001
3. Backoff:          50ms × attempt number (50ms, 100ms, 150ms)
4. Failure behavior: Fail CLOSED — if all retries exhausted, reject emission
5. Advisory lock:    pg_advisory_xact_lock on wallet hash before SELECT FOR UPDATE
```

No reward emission may occur outside a transaction satisfying all five requirements.

Rationale: Gate 4 is the only irreversible step in the pipeline. A race condition at this layer cannot be corrected after the fact. Serializable isolation with advisory locking eliminates the class of bugs where two concurrent settlement jobs emit rewards for the same wallet simultaneously.

### 3.1 Gate 4 Authorization Check Implementation

The authorization check must be injected immediately before the `emitReward()` call in the settlement pipeline. This is the last line of defense before irreversible PFT emission.

**Pseudocode for gate4AuthCheck:**

```typescript
import { Pool, PoolClient } from 'pg';
import Redis from 'ioredis';
import { logger } from './logger';

interface Gate4Result {
  pass: boolean;
  idempotent?: boolean;
  cached?: RewardEmission;
  code?: 'PASS' | 'NOT_ELIGIBLE' | 'RETRY_LATER' | 'HOLD';
  reason?: string;
  state?: string;
  liquidPct?: number;
}

const CACHE_KEY_PREFIX = 'auth:v1:';
const CACHE_TTL_SECONDS = 60;

async function gate4AuthCheck(
  wallet: string,
  taskId: string,
  amountPft: bigint,
  db: Pool,
  redis: Redis,
  mode: 'shadow' | 'soft' | 'full'
): Promise<Gate4Result> {
  const startTime = Date.now();

  // Idempotency check — BEFORE acquiring advisory lock
  const existing = await db.query(
    'SELECT * FROM reward_emissions WHERE task_id = $1',
    [taskId]
  );
  if (existing.rows.length > 0) {
    // Already emitted — return cached result, do not re-emit
    logger.info({ taskId, wallet, idempotent: true }, 'Idempotent hit - already emitted');
    return { pass: true, idempotent: true, cached: existing.rows[0] };
  }

  // Execute gate check within serializable transaction with retry
  return withSerializableRetry(async () => {
    return await executeGate4(wallet, taskId, amountPft, db, redis, mode);
  });
}

async function executeGate4(
  wallet: string,
  taskId: string,
  amountPft: bigint,
  db: Pool,
  redis: Redis,
  mode: 'shadow' | 'soft' | 'full'
): Promise<Gate4Result> {
  const client = await db.connect();

  try {
    // Begin serializable transaction
    await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');

    // Acquire advisory lock on wallet to prevent concurrent emission
    const lockKey = hashWalletToInt(wallet);
    await client.query('SELECT pg_advisory_xact_lock($1)', [lockKey]);

    // Double-check idempotency inside transaction
    const doubleCheck = await client.query(
      'SELECT * FROM reward_emissions WHERE task_id = $1',
      [taskId]
    );
    if (doubleCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      return { pass: true, idempotent: true, cached: doubleCheck.rows[0] };
    }

    // Check cache first
    const cacheKey = `${CACHE_KEY_PREFIX}${wallet}`;
    const cached = await redis.get(cacheKey);

    let authState: ContributorAuth;
    if (cached) {
      authState = JSON.parse(cached);
    } else {
      // Cache miss — query database
      const result = await client.query(
        'SELECT * FROM contributor_authorization WHERE wallet = $1',
        [wallet]
      );

      if (result.rows.length === 0) {
        authState = { wallet, state: 'UNKNOWN', tier: 0 };
      } else {
        authState = result.rows[0];
      }

      // Populate cache
      await redis.setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(authState));
    }

    // Evaluate authorization
    const decision = evaluateAuthorization(authState, amountPft, mode);

    // Log to audit table
    await client.query(
      `INSERT INTO authorization_audit_log
       (wallet, task_id, reason, old_state, new_state, amount_pft, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        wallet,
        taskId,
        decision.pass ? 'GATE4_PASS' : 'GATE4_BLOCK',
        authState.state,
        authState.state,
        amountPft,
        JSON.stringify({
          mode,
          shadow: mode === 'shadow',
          code: decision.code,
          reason: decision.reason
        })
      ]
    );

    // Handle based on mode and decision
    if (decision.pass) {
      // Record emission for idempotency
      await client.query(
        `INSERT INTO reward_emissions (task_id, wallet, amount_pft, state_at_emission)
         VALUES ($1, $2, $3, $4)`,
        [taskId, wallet, amountPft, authState.state]
      );
      await client.query('COMMIT');
      return decision;
    }

    if (mode === 'shadow') {
      // Shadow mode: log but pass through
      await client.query('COMMIT');
      return { ...decision, pass: true, reason: 'shadow_override' };
    }

    if (mode === 'soft') {
      // Soft mode: hold emission for review
      await client.query(
        `INSERT INTO emission_hold
         (wallet, task_id, amount_pft, state_at_hold, hold_reason)
         VALUES ($1, $2, $3, $4, $5)`,
        [wallet, taskId, amountPft, authState.state, decision.reason]
      );
      await client.query('COMMIT');
      return { pass: false, code: 'HOLD', reason: decision.reason, state: authState.state };
    }

    // Full mode: hard reject
    await client.query('COMMIT');
    return decision;

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

function evaluateAuthorization(
  auth: ContributorAuth,
  amountPft: bigint,
  mode: string
): Gate4Result {
  switch (auth.state) {
    case 'AUTHORIZED':
    case 'TRUSTED':
      return {
        pass: true,
        code: 'PASS',
        state: auth.state,
        liquidPct: 100
      };

    case 'PROBATIONARY':
      return {
        pass: true,
        code: 'PASS',
        state: auth.state,
        liquidPct: 25,  // 25% liquid, 75% vesting
        reason: 'probationary_split'
      };

    case 'SUSPENDED':
      return {
        pass: false,
        code: 'NOT_ELIGIBLE',
        state: auth.state,
        reason: `Wallet suspended: ${auth.suspension_reason || 'no reason provided'}`
      };

    case 'UNKNOWN':
    default:
      return {
        pass: false,
        code: 'NOT_ELIGIBLE',
        state: auth.state || 'UNKNOWN',
        reason: 'Wallet not registered or authorization expired'
      };
  }
}

function hashWalletToInt(wallet: string): number {
  // Simple hash to generate consistent advisory lock key
  let hash = 0;
  for (let i = 0; i < wallet.length; i++) {
    hash = ((hash << 5) - hash) + wallet.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}
```

### 3.2 Distributed Enforcement Points

Full enforcement requires `authorizationCheck()` at all three pipeline layers:

```
+---------------------------+----------------------------------+----------------+
| Layer                     | Insertion Point                  | Gate           |
+---------------------------+----------------------------------+----------------+
| Keystone gRPC interceptor | Before UploadContent handler     | Evidence (3)   |
| Chain Event Processor     | task_acceptance envelope handler | Acceptance (2) |
| Epoch Settlement Job      | Before emitReward()              | Emission (4)   |
+---------------------------+----------------------------------+----------------+
```

All three call the same shared function:

```typescript
authorizationCheck(wallet, taskId, mode, db, redis)
```

**Fail-closed semantics apply at all layers:**
Any authorization lookup failure → reject the operation, do not proceed.

**Redis cache invalidation:**

```
Cache key pattern: auth:v1:{wallet}
TTL: 60 seconds
Invalidate on any state transition in contributor_authorization
```

Example invalidation trigger:

```typescript
// Call after any state change in contributor_authorization
async function invalidateAuthCache(wallet: string, redis: Redis): Promise<void> {
  await redis.del(`auth:v1:${wallet}`);
}
```

### 3.3 Transaction Semantics

All Gate 4 operations MUST:

1. Run under `ISOLATION LEVEL SERIALIZABLE`
2. Retry up to 3 times on PostgreSQL serialization failure (error code 40001)
3. Fail CLOSED if all retries exhausted — reject the emission, do not proceed

**Retry pseudocode:**

```typescript
async function withSerializableRetry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3
): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (e: any) {
      if (e.code === '40001' && attempt < maxAttempts) {
        // PostgreSQL serialization failure — retry with backoff
        await sleep(attempt * 50); // exponential backoff: 50ms, 100ms, 150ms
        continue;
      }
      throw e; // re-throw — fail closed
    }
  }
  // Should never reach here, but fail closed if we do
  throw new Error('withSerializableRetry: exhausted retries');
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

**Failure behavior:**

```
Serialization failure after 3 retries → return { pass: false, code: 'RETRY_LATER' }
DB connection failure               → return { pass: false, code: 'RETRY_LATER' }
Policy config unavailable           → use hardcoded safe defaults, alert ops
```

**Fail-closed principle:** when in doubt, reject. Never emit on uncertainty.

### 3.4 Failure Philosophy

The authorization gate is **fail-closed by design**.

Any failure condition in the authorization check MUST result in rejection of the operation, not a pass-through. This includes:

- Database connection failure
- Redis cache miss with DB unavailable
- Serialization failure after max retries
- Policy config unavailable (use hardcoded safe defaults + alert)
- Malformed wallet address

**The only exception:** `AUTH_GATE_ENABLED=false` (master kill switch).

When the kill switch is active, ALL authorization checks are bypassed and the pipeline processes as if pre-enforcement.

**Rationale:** The enforcement spec addresses approximately 1M PFT in unauthorized emissions. A fail-open gate produces the same outcome as no gate at all. Failing closed means the worst case is a delayed reward (recoverable); failing open means unauthorized emission (irreversible).

### 3.5 Monitoring and Alerting

**Shadow mode violation rate (alert if > 5%):**

```sql
SELECT
  COUNT(*) FILTER (WHERE metadata->>'shadow' = 'true') AS shadow_violations,
  COUNT(*) AS total_gate4_checks,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE metadata->>'shadow' = 'true') / NULLIF(COUNT(*), 0),
    2
  ) AS violation_rate_pct
FROM authorization_audit_log
WHERE created_at > NOW() - INTERVAL '24 hours'
  AND reason IN ('GATE4_BLOCK', 'GATE4_PASS');
```

Alert threshold: `violation_rate_pct > 5`

**Emission hold accumulation (alert if growing without releases):**

```sql
SELECT
  count(*) FILTER (WHERE released_at IS NULL AND voided_at IS NULL) AS pending,
  count(*) FILTER (WHERE released_at IS NOT NULL) AS released,
  sum(amount_pft) FILTER (WHERE released_at IS NULL AND voided_at IS NULL) AS pft_held
FROM emission_hold;
```

**Post-deploy verification (run immediately after each mode advancement):**

```sql
-- Confirm no unauthorized emissions slipped through
SELECT r.wallet, r.task_id, r.amount_pft, c.state
FROM reward_emissions r
JOIN contributor_authorization c ON c.wallet = r.wallet
WHERE c.state IN ('UNKNOWN', 'SUSPENDED')
ORDER BY r.emitted_at DESC
LIMIT 20;

-- Expected: zero rows
```

**Advisory lock contention:**

```sql
SELECT
  pid,
  state,
  wait_event_type,
  wait_event,
  query
FROM pg_stat_activity
WHERE wait_event_type = 'Lock'
  AND query LIKE '%pg_advisory%'
ORDER BY query_start;
```

---

## Section 4: Integration Test Scenarios

All test scenarios must pass before advancing enforcement mode. Run tests against a staging environment with realistic data volume.

### Enforcement Level Terminology Mapping

```
+----------------+--------------+------------------------------------------+
| Task Term      | Runbook Term | Behavior                                 |
+----------------+--------------+------------------------------------------+
| log-only       | shadow       | Log violation + always PASS              |
| soft-reject    | soft         | Hold emission + notify + RETRY_LATER     |
| hard-reject    | full         | Hard reject + audit log + NOT_ELIGIBLE   |
+----------------+--------------+------------------------------------------+
```

### Scenario A — AUTHORIZED wallet, full mode

**Setup:**

```
contributor_authorization: wallet=W001, state=AUTHORIZED, tier=2
AUTH_GATE_ENFORCEMENT_MODE=full
```

**Input:**

```
gate4AuthCheck(wallet='W001', taskId='T001', amountPft=500000000n)
```

**Expected outputs:**

- Return: `{ pass: true, code: 'PASS', liquidPct: 100 }`
- `emitReward()` called with full amount
- Audit log entry: `reason=GATE4_PASS, state=AUTHORIZED`
- Row inserted into `reward_emissions`

**Pass criteria:**

- 100% liquid emission
- No hold, no rejection

---

### Scenario B — PROBATIONARY wallet, full mode

**Setup:**

```
contributor_authorization: wallet=W002, state=PROBATIONARY, tier=1
AUTH_GATE_ENFORCEMENT_MODE=full
```

**Input:**

```
gate4AuthCheck(wallet='W002', taskId='T002', amountPft=1000000000n)
```

**Expected outputs:**

- Return: `{ pass: true, code: 'PASS', liquidPct: 25 }`
- `emitReward()` called with split: 250M liquid, 750M vesting escrow
- Audit log entry: `reason=GATE4_PASS, state=PROBATIONARY`

**Pass criteria:**

- 25% liquid / 75% vesting split applied
- Emission recorded in `reward_emissions`

---

### Scenario C — UNKNOWN wallet, full mode (hard reject)

**Setup:**

```
contributor_authorization: no row for wallet=W003
AUTH_GATE_ENFORCEMENT_MODE=full
```

**Input:**

```
gate4AuthCheck(wallet='W003', taskId='T003', amountPft=100000000n)
```

**Expected outputs:**

- Return: `{ pass: false, code: 'NOT_ELIGIBLE', reason: 'Wallet not registered...' }`
- `emitReward()` NOT called
- Audit log entry: `reason=GATE4_BLOCK, state=UNKNOWN`
- No row in `reward_emissions`

**Pass criteria:**

- Zero emission
- Clean rejection with audit trail

---

### Scenario D — UNKNOWN wallet, shadow mode (observe only)

**Setup:**

```
contributor_authorization: no row for wallet=W004
AUTH_GATE_ENFORCEMENT_MODE=shadow
```

**Input:**

```
gate4AuthCheck(wallet='W004', taskId='T004', amountPft=200000000n)
```

**Expected outputs:**

- Return: `{ pass: true, reason: 'shadow_override' }`
- `emitReward()` called (shadow mode passes through)
- Audit log entry: `reason=GATE4_BLOCK, metadata.shadow=true`
- Row inserted into `reward_emissions`

**Pass criteria:**

- Emission proceeds (shadow mode)
- Violation logged for analysis
- Would have been blocked in full mode

---

### Scenario E — Duplicate settlement (idempotency)

**Setup:**

```
contributor_authorization: wallet=W005, state=AUTHORIZED
reward_emissions: task_id=T005 already present (prior successful emission)
AUTH_GATE_ENFORCEMENT_MODE=full
```

**Input:**

```
gate4AuthCheck(wallet='W005', taskId='T005', amountPft=1000000000n)
```

**Expected outputs:**

- Return: `{ pass: true, idempotent: true, cached: <prior emission row> }`
- `emitReward()` NOT called (cached result returned)
- No new row in `reward_emissions`
- No new row in `authorization_audit_log`

**Pass criteria:**

- PFT emitted exactly once for T005
- No double-spend possible regardless of retry count
- Idempotent return within < 10ms

---

### Scenario F — State change mid-flight (race condition)

**Setup:**

```
contributor_authorization: wallet=W006, state=AUTHORIZED at task submission
Between Gate 3 and Gate 4: admin suspends W006 (state → SUSPENDED)
AUTH_GATE_ENFORCEMENT_MODE=full
```

**Input:**

```
gate4AuthCheck(wallet='W006', taskId='T006', amountPft=2000000000n)
```

**Expected outputs:**

- Return: `{ pass: false, code: 'NOT_ELIGIBLE', reason: 'SUSPENDED' }`
- No emission
- Audit log entry: `reason=GATE4_BLOCK, new_state=SUSPENDED`
- Advisory lock on wallet held throughout Gate 4 TX prevents race

**Pass criteria:**

- Suspension takes effect before emission regardless of when it occurred
- Serializable TX + advisory lock guarantee consistent state read
- No PFT emitted to suspended wallet

---

### Test Execution

Run the test suite:

```bash
npm run test:integration -- --grep "Gate4"
```

All scenarios must pass before production deployment.

---

## Section 5: Rollback Procedure

> **Rollback must preserve all authorization state. Tables must not be dropped, truncated, or have rows deleted. The audit log is append-only and immutable.**

Rollback order is strict. Execute steps in sequence. Do not skip.

```
Step 1  Flip enforcement mode to shadow (env var or policy_config — no restart needed)
Step 2  Drain in-flight Gate 4 transactions (monitor pg_stat_activity)
Step 3  Disable Gate 4 enforcement
Step 4  Disable Gates 1–3 enforcement
Step 5  Release held emissions (AUTHORIZED/TRUSTED wallets only — see SQL below)
Step 6  Audit shadow violations (read-only — do not delete audit_log rows)
Step 7  Resume baseline operation
```

Partial rollback (e.g., disabling only Gate 4 while Gates 1–3 remain active) is acceptable as a temporary measure but must be documented and resolved within 24 hours.

---

The rollback procedure MUST be executed in order. **Do not skip steps.**

Authorization state tables MUST NOT be dropped or truncated at any point.

### Step 1: Flip to shadow mode (immediate — no restart required)

**Option A (fastest): Update policy_config**

```sql
UPDATE policy_config
SET value = '0', updated_at = NOW()
WHERE key = 'auth_gate_enabled';

-- Takes effect on next cache invalidation (≤ 60s)
```

**Option B: Environment variable + rolling restart**

```bash
AUTH_GATE_ENFORCEMENT_MODE=shadow
AUTH_GATE_ENABLED=false

# Restart adjudication workers one-by-one
pm2 restart adjudicator-1
sleep 30
pm2 restart adjudicator-2
sleep 30
# ... continue for all workers
```

### Step 2: Drain in-flight settlement jobs

Wait for all active Gate 4 transactions to complete (typically < 30s).

**Monitor:**

```sql
SELECT count(*)
FROM pg_stat_activity
WHERE query LIKE '%contributor_authorization%'
   OR query LIKE '%reward_emissions%';

-- Wait until count = 0
```

### Step 3: Release held emissions (selective — AUTHORIZED wallets only)

**REVIEW BEFORE EXECUTING.** Only release wallets that were AUTHORIZED at hold time.

```sql
BEGIN;

UPDATE emission_hold
SET released_at = NOW()
WHERE released_at IS NULL
  AND voided_at IS NULL
  AND wallet IN (
    SELECT wallet FROM contributor_authorization
    WHERE state IN ('AUTHORIZED', 'TRUSTED')
  );

-- Verify count before committing:
SELECT count(*) as to_release
FROM emission_hold
WHERE released_at::date = CURRENT_DATE;

-- If count looks reasonable:
COMMIT;
-- Otherwise:
-- ROLLBACK;
```

### Step 4: Audit shadow violations (do NOT delete audit entries)

```sql
SELECT
  wallet,
  count(*) as violations,
  min(created_at) as first_seen,
  max(created_at) as last_seen
FROM authorization_audit_log
WHERE metadata->>'shadow' = 'true'
  AND created_at > :'rollback_start'
GROUP BY wallet
ORDER BY violations DESC
LIMIT 50;
```

Review results for patterns indicating misconfiguration vs genuine unauthorized attempts.

### Step 5: Re-enable checklist (before restoring full enforcement)

Complete all items before re-enabling:

```
[ ] False positive rate < 5% confirmed in shadow logs
[ ] All 3 enforcement layers tested in staging
[ ] Idempotency constraint verified (no duplicate emissions in reward_emissions)
[ ] On-call engineer available for 2h post-restore window
[ ] Rollback trigger documented in incident log
```

### Invariants that must hold throughout rollback

```
- authorization_audit_log is append-only; NEVER mutate or delete rows
- emission_hold rows are preserved (released_at set, not deleted)
- contributor_authorization state preserved; no state resets
- reward_emissions is immutable; NEVER delete rows
```

### Emergency Contacts

If rollback fails or unexpected behavior occurs:

1. Set `AUTH_GATE_ENABLED=false` immediately (master kill switch)
2. Page on-call engineer
3. Preserve all logs and database state for post-mortem

---

## Section 6: Post-Deployment Verification

After deployment to each environment, run these verification queries:

### 6.1 Table existence check

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'contributor_authorization',
    'authorization_audit_log',
    'policy_config',
    'emission_hold',
    'reward_emissions'
  )
ORDER BY table_name;

-- Expected: 5 rows
```

### 6.2 Policy config verification

```sql
SELECT key, value FROM policy_config ORDER BY key;
```

### 6.3 Constraint verification

```sql
\d reward_emissions

-- Verify uq_task_emission constraint exists
```

### 6.4 Index verification

```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename IN (
  'contributor_authorization',
  'authorization_audit_log',
  'reward_emissions'
);
```

### 6.5 Sample authorization check

```sql
-- Insert test wallet if not exists
INSERT INTO contributor_authorization (wallet, state)
VALUES ('test_wallet_001', 'AUTHORIZED')
ON CONFLICT (wallet) DO NOTHING;

-- Verify lookup works
SELECT wallet, state FROM contributor_authorization WHERE wallet = 'test_wallet_001';
```

---

## Appendix A: Quick Reference

### Environment Variables

| Variable | Values | Description |
|----------|--------|-------------|
| `AUTH_GATE_ENABLED` | `true`/`false` | Master kill switch |
| `AUTH_GATE_ENFORCEMENT_MODE` | `shadow`/`soft`/`full` | Enforcement level |
| `AUTH_GATE_LOG_LEVEL` | `debug`/`info`/`warn` | Logging verbosity |
| `AUTH_GATE_POLICY_VERSION` | `v1.1` | Policy version |

### State Transitions

| From | To | Trigger |
|------|-----|---------|
| (none) | UNKNOWN | Wallet first seen |
| UNKNOWN | PROBATIONARY | Minimum stake deposited |
| PROBATIONARY | AUTHORIZED | Full stake verified |
| AUTHORIZED | TRUSTED | Extended track record (Layer B) |
| Any | SUSPENDED | Admin action or violation |
| SUSPENDED | UNKNOWN | Admin re-registration |

### Reward Splits by State

| State | Liquid | Vesting |
|-------|--------|---------|
| AUTHORIZED | 100% | 0% |
| TRUSTED | 100% | 0% |
| PROBATIONARY | 25% | 75% |
| SUSPENDED | 0% | 0% |
| UNKNOWN | N/A | N/A |

---

## Appendix B: Troubleshooting

### "Serialization failure" errors in logs

**Cause:** High contention on Gate 4 transactions.

**Resolution:**

1. Verify retry logic is implemented correctly (3 attempts with backoff)
2. Check advisory lock distribution — ensure `hashWalletToInt()` spreads locks evenly
3. If persistent, increase `pool_size` in PgBouncer

### Shadow mode shows > 10% violation rate

**Cause:** Many unregistered wallets attempting task completion.

**Resolution:**

1. Review `authorization_audit_log` for patterns
2. Check if wallets should have been registered (data sync issue)
3. Consider extending shadow mode period before advancing

### Emission hold table growing rapidly

**Cause:** Soft mode holding many emissions.

**Resolution:**

1. Review held emissions: `SELECT * FROM emission_hold WHERE released_at IS NULL`
2. Release eligible wallets or investigate why wallets aren't authorized
3. Consider reverting to shadow mode while investigating

### Redis cache misses causing DB overload

**Cause:** Cache TTL too short or Redis connection issues.

**Resolution:**

1. Increase `cache_ttl_seconds` in policy_config (e.g., 120s)
2. Verify Redis persistence is enabled (AOF)
3. Check Redis memory and eviction policy

---

## Changelog

### v1.2 (2026-03-18)

- Added hard Source of Truth guardrail establishing Enforcement Spec as sole normative authority
- Added Deployment Integrity Requirement mandating all four enforcement layers active simultaneously
- Added System Invariant: Exactly-Once Reward Emission with violation consequences
- Added Transaction Requirements callout (5 mandatory requirements for Gate 4)
- Added strict rollback ordering with explicit invariant preservation note
- Added Schema Naming Reference table for task prompt to implementation mapping

### v1.1 (2026-03-18)

- Added Canonical State Model section with explicit state definitions
- Added Source of Truth Override clarifying spec authority over architecture map
- Added Pre-Deployment Validation Checklist (Section 0)
- Added Architecture Alignment Note documenting 3-layer enforcement
- Added Migration 005 for reward emission idempotency
- Added Distributed Enforcement Points (Section 3.2)
- Added Transaction Semantics with serializable retry logic
- Added Failure Philosophy documenting fail-closed design
- Added Monitoring and Alerting queries (Section 3.5)
- Added Enforcement Level Terminology Mapping
- Added Scenario E (idempotency) and Scenario F (race condition) tests
- Expanded Rollback Procedure with strict ordered steps
- PostgreSQL requirement raised to 15+ for SERIALIZABLE reliability

### v1.0 (2026-03-18)

- Initial release

---

**Document Version:** v1.2  
**Word Count:** ~5,700 words  
**Last Updated:** 2026-03-18  
**Maintainer:** Post Fiat Foundation
