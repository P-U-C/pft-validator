---
layout: default
title: "Post Fiat Task Node — Public Architecture Inference Map v1.0"
date: 2026-03-18
category: spec
status: published
---

# Post Fiat Task Node — Public Architecture Inference Map v1.0

**Status:** PUBLISHED  
**Version:** v1.0  
**Date:** 2026-03-18  
**Author:** Permanent Upper Class Validator

> **Scope Limitation:** No publicly accessible Task Node server repository was available at the time of writing. Server internals below are inferred from public client code (`pft-chatbot-mcp`), public protocol artifacts, and public documentation. This document does not claim direct visibility into the private Keystone backend. It is a public-artifact survey intended to identify the most plausible enforcement surfaces for Authorization Gate implementation and to bound what must be validated once internal Keystone / Task Node code is available.
>
> **Evidence grades used throughout:** 🟢 Publicly evidenced (confirmed from public repo/README) | 🟡 Strongly inferred (logical from client shape) | 🟠 Weakly inferred (architecturally plausible, not verifiable from public code) | 🔴 Speculative (design recommendation, not archaeology)

---

## 1. Executive Summary

The Post Fiat Task Node is not a monolithic server. There is no single REST API backed by a database that you can point at and say "that's the Task Node." Instead, the Task Node is a **distributed system composed of three coordinating layers**:

1. **PFTL Chain** — An XRPL fork (`postfiatd`) where task lifecycle events are encoded as Payment transactions with Keystone v1 envelopes in the memo field. This is the immutable record.
2. **Keystone gRPC Service** — A Post Fiat-operated backend that serves as the coordination layer: agent registry, IPFS write gate, envelope metadata storage, authentication, and rate limiting. Backed by PostgreSQL.
3. **IPFS Cluster** — Content-addressed storage for task evidence (proposals, submissions, adjudication results). CIDs are referenced in on-chain envelopes.

This matters for Authorization Gate implementation because **there is no single enforcement point**. Authorization checks must be woven into multiple layers — the gRPC write gate, the chain event processor, and the epoch settlement job. A naive "add middleware to the API" approach doesn't work here. The enforcement surface is distributed across the same three layers the system itself spans.

The public `pft-chatbot-mcp` repository (TypeScript MCP server) is the **client SDK**, not the server. But it reveals the server's shape through its gRPC client stubs, chain scanner logic, and encryption primitives. This document maps what we can confirm and infer from that client code and the README.

---

## 2. Task Lifecycle State Machine

The task lifecycle is **message-based**, not endpoint-based. Each state transition is a signed on-chain transaction carrying a typed Keystone v1 envelope. The Keystone gRPC service processes side effects (IPFS writes, registry updates), but the chain is the source of truth.

```
  ┌──────────────┐
  │  PROPOSED     │  Proposer submits task definition
  │  (on-chain)   │  Envelope: task_proposal
  └──────┬───────┘
         │ Contributor sends task_acceptance tx
         ▼
  ┌──────────────┐
  │  ACCEPTED     │  Contributor commits to task
  │  (on-chain)   │  Envelope: task_acceptance
  └──────┬───────┘
         │ Contributor submits evidence
         ▼
  ┌──────────────┐
  │  SUBMITTED    │  Evidence uploaded to IPFS via Keystone
  │  (on-chain)   │  Envelope: task_submission (contains IPFS CID)
  └──────┬───────┘
         │ TaskNode or designated adjudicator reviews
         ▼
  ┌──────────────┐
  │  ADJUDICATED  │  Pass/fail determination
  │  (on-chain)   │  Envelope: task_adjudication
  └──────┬───────┘
         │ Epoch settlement triggers reward
         ▼
  ┌──────────────┐
  │  REWARDED     │  PFT payment emitted on-chain
  │  (on-chain)   │  Standard Payment tx
  └──────────────┘
```

**Phase-by-phase breakdown:**

| Phase | On-Chain Tx | Keystone gRPC Role | IPFS Content | Trigger |
|-------|-------------|-------------------|--------------|---------|
| **Proposal** | Payment with `task_proposal` envelope | Receives content upload, stores envelope metadata, validates proposer auth | Task description, requirements, reward terms | Proposer initiates |
| **Acceptance** | Payment with `task_acceptance` envelope | Validates contributor eligibility, updates task state | Acceptance terms (if any) | Contributor responds to proposal |
| **Submission** | Payment with `task_submission` envelope | IPFS write gate uploads evidence, records CID | Evidence payload (work product, proofs) | Contributor completes work |
| **Adjudication** | Payment with `task_adjudication` envelope | May run automated checks, records verdict | Adjudication rationale, scoring | TaskNode or adjudicator reviews |
| **Reward** | Standard Payment (PFT transfer) | Epoch settlement job calculates and emits | None (pure value transfer) | Epoch boundary or adjudication completion |

Each envelope is encrypted with XChaCha20-Poly1305 and key-wrapped for multiple recipients (sender, recipient, TaskNode). The chain transaction itself is the state transition — no separate database update "commits" the state change. The chain scanner on each participant's side picks up new transactions and updates local state.

*Confirmed from: pft-chatbot-mcp README, scanner.ts/submitter.ts module structure. Envelope type names are inferred from architecture patterns; exact field names are not public.*

---

## 3. Keystone gRPC Service Architecture

The Keystone gRPC service is the **server-side coordination layer** operated by Post Fiat. We don't have its source code or proto definitions, but the client SDK (`src/grpc/client.ts`) reveals its surface area through the methods it calls.

**Inferred service capabilities:**

### Agent Registry
- **Registration**: Bots/agents register with a wallet address, name, description, and capability declarations. Based on the MCP server's agent configuration patterns, registration likely involves a challenge-response flow where the agent signs a nonce with its PFTL wallet key to prove ownership.
- **Capability declaration**: Agents declare what task types they can handle. This feeds into task routing — when a proposal is posted, eligible agents are those whose capabilities match.
- **API key issuance**: Post-registration, agents likely receive an API key (or use wallet-signature-based auth per request) for subsequent gRPC calls.

### IPFS Write Gate
- **Authenticated uploads**: Content destined for IPFS goes through Keystone, not directly to an IPFS node. This is critical — it means Keystone is a chokepoint for all evidence entering the system.
- **Content validation**: Before pinning to IPFS, Keystone likely validates envelope format, checks auth, and applies rate limits.
- **CID return**: After successful upload, Keystone returns the IPFS CID which the client then includes in the on-chain envelope.

### Rate Limiting
- **Per-wallet limits**: The README mentions rate limits. Given the gRPC auth model, these are almost certainly per-wallet, tracking request counts within sliding windows.
- **Purpose**: Prevents spam submissions, protects IPFS cluster resources, and limits chain transaction flooding.

### Envelope Metadata Storage
- **PostgreSQL backend**: Keystone stores envelope metadata — mapping CIDs to wallet addresses, transaction IDs, timestamps. This enables efficient lookups without scanning the full chain.
- **Index layer**: Think of it as a read-optimized index over the chain's memo data, plus the IPFS CID mappings that aren't directly queryable from chain state.

*Inferred from: src/grpc/client.ts method signatures, src/config.ts gRPC endpoint configuration, README authentication references.*

---

## 4. IPFS Evidence Flow

```
  Contributor                  Keystone gRPC              IPFS Cluster
  ──────────                  ─────────────              ────────────
       │                            │                          │
       │  1. Encrypt content        │                          │
       │  (XChaCha20-Poly1305)      │                          │
       │                            │                          │
       │  2. UploadContent(         │                          │
       │     encrypted_blob,        │                          │
       │     auth_token)            │                          │
       │ ─────────────────────────► │                          │
       │                            │  3. Validate auth        │
       │                            │     Check rate limit     │
       │                            │                          │
       │                            │  4. ipfs.add(blob)       │
       │                            │ ────────────────────────►│
       │                            │                          │
       │                            │  5. CID returned         │
       │                            │ ◄────────────────────────│
       │                            │                          │
       │  6. CID returned           │  Store envelope metadata │
       │ ◄───────────────────────── │                          │
       │                            │                          │
       │  7. Build Keystone v1      │                          │
       │     envelope with CID      │                          │
       │                            │                          │
       │  8. Submit PFTL Payment    │                          │
       │     tx with envelope       │                          │
       │     in memo field          │                          │
       ▼                            │                          │
    PFTL Chain                      │                          │
```

**Key properties:**

- **Content-addressed integrity**: IPFS CIDs are cryptographic hashes of content. If anyone tampers with the evidence blob, the CID won't match. The on-chain CID reference is immutable once confirmed. This gives tamper-evidence for free.
- **Keystone as gatekeeper**: Contributors cannot write directly to IPFS — they must go through the authenticated Keystone write gate. This is where authorization checks can be enforced before evidence enters the system.
- **Public read access**: Recipients fetch evidence from public IPFS gateways using the CID from the on-chain envelope. No authentication needed for reads — only writes are gated.
- **Encryption before upload**: Content is encrypted client-side before upload. Keystone and IPFS see only ciphertext. Only holders of the decryption shards (sender, recipient, TaskNode) can read the plaintext.

*Confirmed from: src/chain/pointer.ts (CID resolution), src/grpc/client.ts (upload methods), src/crypto/ (client-side encryption).*

---

## 5. Database Schema Inference

The Keystone PostgreSQL database must track several entity types based on the service's responsibilities. Inferred schema:

```sql
-- Agent registry
CREATE TABLE agents (
    wallet_address  TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    description     TEXT,
    capabilities    JSONB,          -- task types this agent handles
    api_key_hash    TEXT,           -- bcrypt or argon2 hash
    status          TEXT DEFAULT 'active',  -- active, suspended, deregistered
    registered_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at    TIMESTAMPTZ
);

-- Envelope metadata (IPFS CID → chain mapping)
CREATE TABLE envelopes (
    id              BIGSERIAL PRIMARY KEY,
    ipfs_cid        TEXT NOT NULL UNIQUE,
    envelope_type   TEXT NOT NULL,  -- task_proposal, task_acceptance, etc.
    sender_wallet   TEXT NOT NULL REFERENCES agents(wallet_address),
    recipient_wallet TEXT NOT NULL,
    chain_txid      TEXT,           -- populated after on-chain confirmation
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Rate limit tracking
CREATE TABLE rate_limit_state (
    wallet_address  TEXT NOT NULL,
    endpoint        TEXT NOT NULL,  -- which gRPC method
    window_start    TIMESTAMPTZ NOT NULL,
    request_count   INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (wallet_address, endpoint, window_start)
);

-- FOR AUTHORIZATION GATE (proposed addition):
CREATE TABLE contributor_authorization (
    wallet_address      TEXT PRIMARY KEY REFERENCES agents(wallet_address),
    auth_state          TEXT NOT NULL DEFAULT 'UNKNOWN',
        -- UNKNOWN, PROBATIONARY, AUTHORIZED, TRUSTED, SUSPENDED
    tier_access         INTEGER NOT NULL DEFAULT 1,
    epoch_id            TEXT NOT NULL,
    state_changed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    changed_by          TEXT,       -- system, adjudicator wallet, admin
    reason              TEXT,
    vesting_pct         NUMERIC(3,2) DEFAULT 1.0,  -- 0.00–1.00
    total_rewards_epoch NUMERIC,
    concentration_check BOOLEAN DEFAULT false
);
```

*Entirely inferred from service responsibilities. Exact schema is not public.*

---

## 6. Encryption and Key Architecture

The encryption model ensures end-to-end confidentiality while allowing the TaskNode to adjudicate.

**Key derivation chain:**

```
PFTL Wallet (Ed25519 keypair)
    │
    │  RFC 8032 → Curve25519 conversion
    ▼
X25519 keypair (for Diffie-Hellman key agreement)
    │
    │  ECDH with recipient's X25519 public key
    ▼
Shared secret → HKDF → symmetric key
    │
    ▼
XChaCha20-Poly1305 encryption of content
```

**Multi-recipient key wrapping:**

Each piece of evidence is encrypted once with a random content encryption key (CEK). The CEK is then wrapped (encrypted) separately for each authorized recipient:

1. **Sender shard** — sender can always re-read their own submissions
2. **Recipient shard** — the task counterparty (proposer or contributor)
3. **TaskNode shard** — allows Keystone service to decrypt for adjudication

The wrapped key shards are included in the Keystone v1 envelope alongside the IPFS CID. Each recipient uses their X25519 private key to unwrap their shard and recover the CEK.

**Why TaskNode gets a shard:** The TaskNode must be able to preview submissions for automated or semi-automated adjudication. Without a decryption shard, the TaskNode would be blind to content it's supposed to judge. This is a deliberate design choice — the TaskNode is a trusted third party for adjudication purposes.

**Private key isolation:** Private keys never leave the operator's machine. The client SDK (`src/crypto/`) handles all encryption/decryption locally. Keystone only ever sees ciphertext and wrapped key shards — never plaintext content or private keys.

*Confirmed from: src/crypto/ module structure, README encryption description. Specific algorithms (XChaCha20-Poly1305, X25519) confirmed from README.*

---

## 7. Three Authorization Gate Integration Points

> The hooks below are **recommended enforcement attachment points** based on inferred system shape — not confirmed current middleware insertion sites. The left column describes the observable/inferable enforcement surface; the right column describes the recommended Authorization Gate hook at that surface.

### Integration Point 1: Keystone gRPC Write Gate

**Where (inferred):** `KeystoneService.UploadContent()` gRPC method — the authenticated endpoint that accepts encrypted evidence blobs for IPFS pinning.

**Rationale:** This is the first chokepoint. Before any task evidence enters the IPFS cluster, the contributor's authorization state must be verified. An unauthorized contributor should never get content pinned.

**Middleware contract:**
```
gRPC interceptor on UploadContent():
  1. Extract wallet_address from auth context
  2. Query contributor_authorization table
  3. IF state ∈ {PROBATIONARY, AUTHORIZED, TRUSTED}: ALLOW
     IF state = SUSPENDED: DENY (PERMISSION_DENIED, reason: "suspended")
     IF state = UNKNOWN AND task_tier > 1: DENY (PERMISSION_DENIED, reason: "insufficient_authorization")
     IF state = UNKNOWN AND task_tier = 1: ALLOW (Tier 1 open to all)
  4. Log decision to audit trail
```

**Failure behavior:** Fail-closed. If the authorization check fails (database unreachable, timeout), return `UNAVAILABLE` — do not allow the upload. The contributor retries; no data enters the system without a positive authorization decision.

### Integration Point 2: Chain Scanner — Task Acceptance Processing

**Where (inferred):** Keystone service's chain scanner component (server-side equivalent of `scanner.ts`), specifically the handler for `task_acceptance` envelope types.

**Rationale:** When a contributor accepts a task, they're committing to do work that will eventually result in reward emission. This is the second gate — catching unauthorized contributors before they accumulate work that would need to be paid out.

**Middleware contract:**
```
On processing task_acceptance envelope:
  1. Extract contributor_wallet from transaction
  2. authorizationCheck(wallet, 'task_accept', task_id, epoch_id)
  3. Verify: state ≠ SUSPENDED, state ≠ UNKNOWN (for non-Tier-1)
  4. Verify: rate limit not exceeded for acceptance count
  5. Verify: tier access matches task tier requirement
  6. IF PASS: update task state to ACCEPTED
     IF FAIL: emit task_acceptance_rejected envelope (notify proposer)
```

**Failure behavior:** Fail-closed. If authorization cannot be verified, the acceptance is not processed. The task remains in PROPOSED state. The contributor receives a rejection envelope with a reason code.

### Integration Point 3: Epoch Settlement — Reward Emission

**Where (inferred):** Keystone service epoch settlement job — the batch process that calculates rewards for adjudicated tasks and triggers on-chain PFT Payment transactions.

**Rationale:** This is the **critical gate**. This is where the ~1M PFT in unauthorized emissions occurred. Even if Points 1 and 2 are bypassed (edge cases, race conditions, manual overrides), Point 3 must catch unauthorized reward emission before PFT leaves the system.

**Middleware contract:**
```
For each pending reward in epoch settlement:
  BEGIN SERIALIZABLE TRANSACTION
    1. SELECT ... FROM contributor_authorization
       WHERE wallet_address = :wallet FOR UPDATE  -- row lock
    2. Re-verify auth_state ∈ {PROBATIONARY, AUTHORIZED, TRUSTED}
    3. Re-verify NOT SUSPENDED (state could have changed since adjudication)
    4. Calculate vesting_split based on auth_state:
       - PROBATIONARY: 50% immediate, 50% vested (90-day cliff)
       - AUTHORIZED: 80% immediate, 20% vested (30-day cliff)
       - TRUSTED: 100% immediate
    5. Check concentration_cap: contributor's epoch rewards < 5% of total epoch pool
    6. IF ALL PASS: emit reward Payment tx, record in ledger
       IF ANY FAIL: hold reward in escrow, flag for manual review
    7. Log full decision with all check results
  COMMIT
```

**Failure behavior:** Fail-closed with escrow. If the authorization check fails or the database is unreachable, the reward is **not emitted**. It enters an escrow/hold state pending manual review. No PFT leaves the system without a positive, logged authorization decision within a serializable transaction.

---

## 8. What's Not Public

Honest accounting of what we cannot determine from public repositories:

| Gap | Impact | Mitigation |
|-----|--------|------------|
| **Keystone gRPC proto definitions** | Cannot confirm exact method signatures, request/response types | Inferred from client SDK usage patterns |
| **Internal task state machine** | Don't know exact state transitions, edge cases, timeout handling | Mapped from architecture; real implementation may have additional states |
| **Exact PostgreSQL schema** | Schema in §5 is inferred, not confirmed | Must be validated against actual Keystone codebase |
| **Epoch settlement logic** | Don't know reward calculation formula, epoch boundaries, batch scheduling | Integration Point 3 is designed to wrap whatever logic exists |
| **Reward calculation formula** | Don't know how PFT amounts are determined per task | Authorization Gate is agnostic to amount — it gates emission, not calculation |
| **Rate limit parameters** | Don't know window sizes, thresholds, or per-endpoint limits | Authorization Gate adds its own checks independent of existing rate limits |
| **Adjudication algorithm** | Don't know if automated, manual, or hybrid | Gate doesn't depend on adjudication method — it checks auth state at emission time |

**These gaps are precisely why this architectural survey is a prerequisite to enforcement implementation.** The Authorization Gate design must be validated against the actual Keystone codebase before any code is written. The three integration points identified above are architecturally sound regardless of implementation details — but the specific middleware contracts will need adjustment once proto definitions and internal state machine logic are available.

---

*This document represents the state of public knowledge as of 2026-03-18. All inferences are marked as such. The architecture map should be updated when Keystone gRPC proto definitions or internal documentation become available.*

---

*Architecture map v1.0 — ~2,550 words. Published 2026-03-18. Sources: [postfiatorg/pft-chatbot-mcp](https://github.com/postfiatorg/pft-chatbot-mcp) (README + src/{chain,grpc,crypto}), [postfiatorg/postfiatd](https://github.com/postfiatorg/postfiatd). No task-node server repo exists publicly in the org (9 repos total as of 2026-03-18).*
