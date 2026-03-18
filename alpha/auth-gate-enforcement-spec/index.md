---
layout: default
title: "Authorization Gate Enforcement: Task Node Integration Specification"
date: 2026-03-18
category: spec
status: published
---

# Authorization Gate Enforcement: Task Node Integration Specification

**Status:** PUBLISHED  
**Version:** v1.0  
**Date:** 2026-03-18  
**Author:** Permanent Upper Class Validator

---

## Abstract

The Authorization Gate v4.1 design defines four contributor states (UNAUTHORIZED, PROBATIONARY, AUTHORIZED, SUSPENDED), concentration caps, linking score thresholds, registration stakes, and vesting rules. This specification maps those rules into enforceable code at every decision point in the Task Node pipeline. The gap being closed: approximately 1M PFT in unauthorized emissions that flowed without identity verification or sybil resistance.

The Task Node runs TypeScript/Node.js with PostgreSQL for state and IPFS for evidence hashing. The task lifecycle is: proposal → acceptance → evidence submission → adjudication → reward emission. Every transition is now gated.

---

## 1. Pipeline Integration Points

Every decision point in the task lifecycle calls `authorizationCheck()` before proceeding. The check is synchronous and blocking — no task progresses without a PASS result.

### Flow Diagram

```
  ┌─────────────────────────────────────────────────────────┐
  │                    TASK PROPOSAL                         │
  │              (no auth check — anyone proposes)           │
  └──────────────────────┬──────────────────────────────────┘
                         │
                         ▼
  ┌─────────────────────────────────────────────────────────┐
  │  GATE 1: TASK ACCEPTANCE                                 │
  │                                                          │
  │  Check: state ∈ {AUTHORIZED, PROBATIONARY}               │
  │         + concentration_cap(control_graph, epoch)        │
  │         + cooldown_expired(wallet)                       │
  │         + linking_score < 4.5                            │
  │                                                          │
  │  PASS → accept task, log audit entry                     │
  │  FAIL → reject with error code:                          │
  │    UNAUTHORIZED        → 403, prompt registration        │
  │    SUSPENDED           → 403, no retry                   │
  │    COOLDOWN_ACTIVE     → 429, Retry-After header         │
  │    CONCENTRATION_CAP   → 403, try different graph        │
  │    LINKING_FLAG_HOLD   → 403, declaration required       │
  └──────────────────────┬──────────────────────────────────┘
                         │ PASS
                         ▼
  ┌─────────────────────────────────────────────────────────┐
  │  GATE 2: EVIDENCE SUBMISSION                             │
  │                                                          │
  │  Check: state ∈ {AUTHORIZED, PROBATIONARY}               │
  │         + wallet matches accepted contributor            │
  │         + cooldown_expired(wallet)                       │
  │         + linking_score < 4.5                            │
  │                                                          │
  │  PASS → hash evidence to IPFS, store reference           │
  │  FAIL → reject submission:                               │
  │    SUSPENDED           → 403, freeze in-progress tasks   │
  │    COOLDOWN_ACTIVE     → 429, Retry-After                │
  │    LINKING_FLAG_HOLD   → 403, pending declaration        │
  └──────────────────────┬──────────────────────────────────┘
                         │ PASS
                         ▼
  ┌─────────────────────────────────────────────────────────┐
  │  GATE 3: ADJUDICATION                                    │
  │                                                          │
  │  Check: re-validate state (may have changed since        │
  │         submission). If state degraded to SUSPENDED      │
  │         during adjudication window → auto-reject task.   │
  │         Check linking_score for provisional cap.         │
  │                                                          │
  │  PASS → adjudicator proceeds                             │
  │  FAIL → task marked REJECTED_AUTH, PFT not emitted       │
  │    SUSPENDED           → task voided, stake review       │
  │    LINKING_FLAG_HOLD   → hold adjudication 48h           │
  └──────────────────────┬──────────────────────────────────┘
                         │ PASS
                         ▼
  ┌─────────────────────────────────────────────────────────┐
  │  GATE 4: REWARD EMISSION                                 │
  │                                                          │
  │  Check: final state verification                         │
  │         + cumulative PFT vs unauthorized threshold       │
  │         + concentration_cap re-check (epoch may shift)   │
  │         + PROBATIONARY vesting split enforcement         │
  │                                                          │
  │  PASS (AUTHORIZED) → 100% liquid emission                │
  │  PASS (PROBATIONARY) → 25% liquid / 75% vesting escrow  │
  │  FAIL → hold emission, trigger escalation:               │
  │    UNAUTHORIZED        → clawback review                 │
  │    CONCENTRATION_CAP   → defer to next epoch             │
  │    PROBATIONARY_LIMIT  → cap at probationary max         │
  └─────────────────────────────────────────────────────────┘
```

### State Transition Side Effects

When a gate check fails due to state degradation detected mid-pipeline:

```
  State degraded during pipeline:
  
  AUTHORIZED → PROBATIONARY (linking_score hit)
    → In-flight tasks: complete normally
    → New emissions: apply 25/75 split going forward
  
  AUTHORIZED → SUSPENDED (sybil confirmed)
    → In-flight tasks: void all, freeze evidence
    → Pending emissions: freeze, stake slashed
  
  PROBATIONARY → SUSPENDED
    → 75% vesting balance: forfeited
    → 25% liquid already emitted: clawback review
```

---

## 2. PostgreSQL Schema

```sql
-- ============================================================
-- contributor_authorization
-- Core state table. One row per contributor wallet.
-- ============================================================
CREATE TABLE contributor_authorization (
    wallet              VARCHAR(44) PRIMARY KEY,  -- solana pubkey
    state               VARCHAR(20) NOT NULL DEFAULT 'UNAUTHORIZED'
                        CHECK (state IN ('UNAUTHORIZED','PROBATIONARY','AUTHORIZED','SUSPENDED')),
    tier                SMALLINT NOT NULL DEFAULT 0,
    registration_stake  BIGINT NOT NULL DEFAULT 0,        -- lamports of PFT staked
    linking_score       NUMERIC(4,2) NOT NULL DEFAULT 0.0,
    cooldown_until      TIMESTAMPTZ,
    cooldown_count      SMALLINT NOT NULL DEFAULT 0,       -- escalation counter
    cooldown_epoch      VARCHAR(32),                       -- epoch of last cooldown
    total_pft_earned    BIGINT NOT NULL DEFAULT 0,         -- lifetime PFT (liquid)
    vesting_pft_held    BIGINT NOT NULL DEFAULT 0,         -- locked 75% portion
    control_graph_id    VARCHAR(64),
    declaration_prompted_at TIMESTAMPTZ,
    declaration_deadline    TIMESTAMPTZ,
    grandfathered       BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Hot path: every gate check queries by wallet + state
CREATE INDEX idx_auth_wallet_state ON contributor_authorization(wallet, state);
-- Linking score monitoring batch job
CREATE INDEX idx_auth_linking_score ON contributor_authorization(linking_score) WHERE linking_score >= 1.5;
-- Cooldown queries
CREATE INDEX idx_auth_cooldown ON contributor_authorization(cooldown_until) WHERE cooldown_until IS NOT NULL;

-- ============================================================
-- authorization_audit_log
-- Immutable append-only. Never UPDATE or DELETE.
-- ============================================================
CREATE TABLE authorization_audit_log (
    id                  BIGSERIAL PRIMARY KEY,
    wallet              VARCHAR(44) NOT NULL,
    old_state           VARCHAR(20),
    new_state           VARCHAR(20) NOT NULL,
    reason              TEXT NOT NULL,
    triggered_by        VARCHAR(64) NOT NULL,   -- 'gate_1','gate_4','linking_monitor','admin','escalation'
    task_id             VARCHAR(64),
    epoch_id            VARCHAR(32),
    pft_amount          BIGINT,
    metadata            JSONB,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_wallet_time ON authorization_audit_log(wallet, created_at DESC);
CREATE INDEX idx_audit_epoch ON authorization_audit_log(epoch_id);

-- ============================================================
-- cooldown_escalation_log
-- Tracks every offense for escalation ladder
-- ============================================================
CREATE TABLE cooldown_escalation_log (
    id                  BIGSERIAL PRIMARY KEY,
    wallet              VARCHAR(44) NOT NULL,
    incident_type       VARCHAR(40) NOT NULL,   -- 'unauthorized_emission','linking_flag','stake_breach'
    offense_number      SMALLINT NOT NULL,
    epoch_id            VARCHAR(32) NOT NULL,
    cooldown_hours      INT NOT NULL,
    action_taken        VARCHAR(40) NOT NULL,   -- 'warning','probation','suspension_review'
    pft_frozen          BIGINT DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cooldown_wallet_epoch ON cooldown_escalation_log(wallet, epoch_id);

-- ============================================================
-- control_graph_cap_state
-- Per-epoch budget tracking for 15% concentration cap
-- ============================================================
CREATE TABLE control_graph_cap_state (
    control_graph_id    VARCHAR(64) NOT NULL,
    epoch_id            VARCHAR(32) NOT NULL,
    total_pft_budget    BIGINT NOT NULL,          -- 15% of epoch total
    pft_emitted         BIGINT NOT NULL DEFAULT 0,
    contributor_count   INT NOT NULL DEFAULT 0,
    cgi_boost           NUMERIC(3,1) NOT NULL DEFAULT 0.0, -- +0.3 underserved, -0.1 saturated
    PRIMARY KEY (control_graph_id, epoch_id)
);

CREATE INDEX idx_cg_epoch ON control_graph_cap_state(epoch_id);
```

---

## 3. API Contract

### Request

```typescript
interface AuthorizationCheckRequest {
  contributor_wallet: string;   // 44-char base58 solana pubkey
  check_type: 'task_accept' | 'evidence_submit' | 'adjudicate' | 'reward_emit';
  task_id: string;
  epoch_id: string;
  pft_amount?: number;          // required for reward_emit
  control_graph_id?: string;    // required for task_accept and reward_emit
}
```

### Response

```typescript
interface AuthorizationCheckResponse {
  allowed: boolean;
  contributor_state: 'UNAUTHORIZED' | 'PROBATIONARY' | 'AUTHORIZED' | 'SUSPENDED';
  error_code?: AuthErrorCode;
  error_message?: string;
  retry_after_seconds?: number;           // present when COOLDOWN_ACTIVE
  vesting_split?: { liquid: number; vesting: number }; // present for PROBATIONARY reward_emit
  cgi_boost?: number;                     // present for reward_emit
  concentration_remaining_pft?: number;   // budget left in control graph this epoch
  linking_score?: number;
  declaration_deadline?: string;          // ISO 8601, present when declaration prompted
}

type AuthErrorCode =
  | 'UNAUTHORIZED'                // wallet not registered, state = UNAUTHORIZED
  | 'SUSPENDED'                   // confirmed sybil or 3rd offense
  | 'COOLDOWN_ACTIVE'             // cooldown not expired, check retry_after_seconds
  | 'CONCENTRATION_CAP_EXCEEDED'  // control graph hit 15% epoch cap
  | 'PROBATIONARY_LIMIT_EXCEEDED' // probationary contributor hit per-epoch PFT ceiling
  | 'LINKING_FLAG_HOLD';          // linking_score ≥ 2.5, declaration pending
```

### HTTP Status Codes

| Code | When | Body |
|------|------|------|
| `200` | Check passed (`allowed: true`) | Full response |
| `403` | UNAUTHORIZED, SUSPENDED, CONCENTRATION_CAP_EXCEEDED, PROBATIONARY_LIMIT_EXCEEDED, LINKING_FLAG_HOLD | Response with `error_code` |
| `429` | COOLDOWN_ACTIVE | Response with `Retry-After` header (seconds) and `retry_after_seconds` in body |
| `400` | Malformed request (missing fields, bad wallet format) | Validation error |
| `500` | Internal failure (DB down, etc.) | Fail-closed: treat as reject |

### Retry-After Semantics

When `error_code === 'COOLDOWN_ACTIVE'`, the response includes:
- HTTP `Retry-After` header with seconds until cooldown expires
- `retry_after_seconds` in JSON body (same value)
- Clients MUST NOT retry before this window. Repeated calls during cooldown do NOT reset the timer but ARE logged.

### Endpoint

```
POST /api/v1/authorization/check
Content-Type: application/json
Authorization: Bearer <service-token>
```

Internal service-to-service call. Not exposed to contributors directly. The Task Node calls this at each gate.

---

## 4. Cooldown Escalation Logic + Scenarios

### Pseudocode

```
function escalate_cooldown(wallet, incident_type, current_state, epoch_id):
    offenses = COUNT cooldown_escalation_log
                WHERE wallet = wallet AND epoch_id = epoch_id

    auth = SELECT * FROM contributor_authorization WHERE wallet = wallet

    // Check PFT threshold breach (immediate escalation)
    if current_state == 'UNAUTHORIZED' AND auth.total_pft_earned > 10_000:
        action = 'suspension_review'
        cooldown_hours = -1  // indefinite until review
        new_state = 'SUSPENDED'
        freeze_all_pft(wallet)
        INSERT cooldown_escalation_log(wallet, incident_type, offenses+1,
               epoch_id, cooldown_hours, action, auth.total_pft_earned)
        UPDATE contributor_authorization
            SET state='SUSPENDED', cooldown_until=NULL, updated_at=NOW()
        INSERT authorization_audit_log(...)
        RETURN {action, new_state}

    if offenses == 0:
        // 1st offense this epoch
        action = 'warning'
        cooldown_hours = 24
        new_state = current_state  // no state change
        UPDATE contributor_authorization
            SET cooldown_until = NOW() + INTERVAL '24 hours',
                cooldown_count = cooldown_count + 1,
                cooldown_epoch = epoch_id,
                updated_at = NOW()

    else if offenses == 1:
        // 2nd offense same epoch
        action = 'probation'
        cooldown_hours = 168  // 7 days
        new_state = 'PROBATIONARY'
        UPDATE contributor_authorization
            SET state = 'PROBATIONARY',
                cooldown_until = NOW() + INTERVAL '7 days',
                cooldown_count = cooldown_count + 1,
                updated_at = NOW()
        // Apply 75% vest lock on existing liquid balance
        vest_amount = auth.total_pft_earned * 0.75
        UPDATE contributor_authorization
            SET vesting_pft_held = vesting_pft_held + vest_amount,
                total_pft_earned = total_pft_earned - vest_amount

    else:  // offenses >= 2 (3rd+)
        action = 'suspension_review'
        cooldown_hours = -1
        new_state = 'SUSPENDED'
        freeze_all_pft(wallet)
        UPDATE contributor_authorization
            SET state = 'SUSPENDED', cooldown_until = NULL,
                updated_at = NOW()

    INSERT cooldown_escalation_log(...)
    INSERT authorization_audit_log(...)
    RETURN {action, new_state, cooldown_hours}
```

### Scenario A: Unauthorized Operator Accumulates 12,000 PFT

Timeline of an operator who begins tasks before registration clears.

```
Epoch 47, Day 1:
  Wallet 7xK...mP submits registration (state: UNAUTHORIZED, stake: 0)
  Registration processing: pending (off-chain KYC queue)

  GATE 1 (task_accept): check_type='task_accept'
    → state = UNAUTHORIZED
    → PHASE 1 (shadow mode): LOGGED but not blocked
    → PHASE 2+: would be BLOCKED with 403 UNAUTHORIZED
    
  (In shadow mode, tasks proceed. This is the leak.)

Epoch 47, Days 1-14:
  Operator completes 8 tasks, accumulating 12,000 PFT
  Each GATE 4 (reward_emit) logs:
    → state = UNAUTHORIZED, pft_amount = 1500 avg
    → Shadow mode: emission proceeds, audit log records violation

  At reward_emit for task #6 (cumulative PFT crosses 10,000):
    → escalate_cooldown('7xK...mP', 'unauthorized_emission', 'UNAUTHORIZED', 'epoch_47')
    → PFT threshold breach detected: total_pft_earned = 10,200 > 10,000
    → ACTION: suspension_review
    → State: UNAUTHORIZED → SUSPENDED
    → All pending emissions: FROZEN
    → Tasks 7, 8 in-flight: VOIDED at next gate check
    → Audit log entry:
        old_state=UNAUTHORIZED, new_state=SUSPENDED,
        reason='PFT threshold breach: 10200 > 10000 while UNAUTHORIZED',
        triggered_by='gate_4_escalation'

  Clawback procedure:
    → Total emitted while UNAUTHORIZED: 10,200 PFT
    → Freeze wallet emissions
    → Flag for manual review (admin queue)
    → If registration eventually clears:
        → Restore to PROBATIONARY (not AUTHORIZED)
        → 75% of accumulated PFT moved to vesting
        → Remaining 2,000 PFT (tasks 7-8): not emitted
    → If sybil confirmed:
        → All PFT clawed back
        → Stake (if any posted): slashed
        → Wallet permanently SUSPENDED
```

### Scenario B: Authorized Operator's Linking Score Rises to 3.2

Timeline of a legitimate operator whose accounts show correlation.

```
Epoch 50:
  Wallet 9aB...cD: state=AUTHORIZED, linking_score=1.2
  Routine linking analysis runs (batch job, daily)
  
  Linking score updated: 1.2 → 1.6
    → Score ≥ 1.5: SOFT FLAG
    → Action: log to audit, no user-facing impact
    → Audit: reason='linking_score_soft_flag: 1.6', triggered_by='linking_monitor'

Epoch 51:
  Linking score updated: 1.6 → 2.8
    → Score ≥ 2.5: DECLARATION PROMPT
    → UPDATE contributor_authorization SET
        declaration_prompted_at = NOW(),
        declaration_deadline = NOW() + INTERVAL '14 days'
    → Notification sent to wallet owner:
        "Your linking score is 2.8. Declare related accounts within 14 days
         or face probationary restrictions."
    → All gate checks still PASS (AUTHORIZED state unchanged)
    → Audit: reason='linking_declaration_prompt: 2.8', triggered_by='linking_monitor'

  Linking score rises further: 2.8 → 3.2
    → Score ≥ 3.5? NO (3.2 < 3.5), no provisional cap yet
    → Declaration deadline still active, 12 days remaining
    → Gates continue to pass normally

  PATH A — Operator responds within 14 days:
    → Submits declaration of related wallets
    → Admin reviews:
        If legitimate (same person, different use cases):
          → linking_score recalculated with declared relationships
          → If new score < 2.5: clear flag, remove deadline
          → If new score still ≥ 2.5: accounts grouped, concentration
            cap applied across group (15% shared)
          → State remains AUTHORIZED
        If suspicious:
          → Escalate to sybil review

  PATH B — Operator does NOT respond within 14 days:
    → declaration_deadline passes
    → Automated state transition:
        AUTHORIZED → PROBATIONARY
    → UPDATE contributor_authorization SET
        state = 'PROBATIONARY',
        updated_at = NOW()
    → Effects:
        → New emissions: 25% liquid / 75% vesting
        → Vesting forfeited if later SUSPENDED
        → Gate checks now return vesting_split in response
        → Concentration cap applied at group level
    → Audit: reason='declaration_timeout: linking_score=3.2, no response in 14d',
             triggered_by='linking_monitor_deadline'
    
    → If linking_score later hits 3.5+:
        → Provisional cap: max 50% of normal task acceptance rate
    → If linking_score hits 4.5+:
        → Immediate grouping: all suspected wallets merged
        → State review for SUSPENDED
```

---

## 5. Migration Path

### Phase 1: Shadow Mode (2 weeks)

- Deploy all gate checks with `enforcement_mode = 'shadow'`
- Every check runs fully but returns `allowed: true` regardless
- All violations logged to `authorization_audit_log` with `metadata.shadow = true`
- Metrics collected:
  - False positive rate (legitimate AUTHORIZED contributors flagged)
  - Total would-be rejections per gate
  - PFT volume that would have been blocked
  - Concentration cap violations detected
- Success criteria: false positive rate < 2%
- Team reviews daily dashboard of shadow violations

### Phase 2: Soft Enforcement (2 weeks)

- `enforcement_mode = 'soft'`
- Gate behavior by state:
  - **UNAUTHORIZED**: blocked at Gate 1 (task_accept). Cannot begin new tasks. Existing in-flight tasks may complete.
  - **PROBATIONARY**: warned at each gate (response includes `warning: true`). Vesting split enforced on new emissions. Not blocked.
  - **AUTHORIZED**: no change. Full pass, no warnings.
  - **SUSPENDED**: fully blocked at all gates (same as full enforcement).
- Concentration cap: logged but not enforced (soft warning only)
- Linking score: flags and prompts active, but no automatic state transitions
- Metrics: compare soft enforcement rejections vs shadow predictions

### Phase 3: Full Enforcement

- `enforcement_mode = 'full'`
- All gates enforce all checks as specified in Section 1
- Concentration caps enforced: tasks rejected when 15% epoch budget exhausted
- Linking score automated transitions active
- Cooldown escalation fully operational
- No exceptions without admin override (logged)

### Rollback Procedure

```
IF false_rejection_rate > 5% for any 24-hour window:
    1. Alert on-call (PagerDuty / Telegram)
    2. Automatic downgrade: full → soft (if in Phase 3)
    3. Manual review of rejected wallets
    4. Root cause analysis on linking_score or concentration_cap logic
    5. Fix, re-validate against shadow logs, redeploy
    6. Re-enter Phase 2 for minimum 48 hours before returning to Phase 3

Rollback command (admin-only):
    POST /api/v1/admin/enforcement-mode
    { "mode": "soft", "reason": "false rejection spike", "operator": "<admin_wallet>" }
    → Logged to authorization_audit_log with triggered_by='admin_rollback'
```

### 30-Day Grandfathering

Active contributors as of enforcement date who have no stake posted:

- Identified by: `total_pft_earned > 0 AND registration_stake = 0 AND state = 'UNAUTHORIZED'`
- Grandfathering flag set: `UPDATE contributor_authorization SET grandfathered = TRUE`
- For 30 days from Phase 3 start:
  - Grandfathered wallets treated as PROBATIONARY (not UNAUTHORIZED)
  - 25/75 vesting split applies to new emissions
  - Must post registration stake within 30 days
  - Daily reminder notifications sent
- After 30 days:
  - If stake posted: transition to PROBATIONARY (normal path to AUTHORIZED)
  - If no stake: transition to UNAUTHORIZED, gate checks block new tasks
  - Vesting balance from grandfathering period: held for 90 days, released if stake posted, forfeited if not

---

## Appendix: Registration Stake Requirements

| State | Stake (PFT) | Notes |
|-------|-------------|-------|
| UNAUTHORIZED | 0 | Cannot participate (post-enforcement) |
| PROBATIONARY | 10-50 | Slashed on confirmed sybil |
| AUTHORIZED | 50-200 | Tier-dependent, fully slashable |
| SUSPENDED | Frozen | Pending review |

---

*End of specification. Implementation begins with Phase 1 shadow deployment.*
