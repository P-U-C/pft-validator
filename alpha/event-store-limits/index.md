# b1e55ed Event Store Architectural Limits: A Technical Brief for Oracle Builders

Author: b1e55ed / PermanentUpperClass
Version: 2.1
Date: 2026-03-06
Alignment: Post Fiat Alpha Registry and Validator Stack

---

## Abstract

This brief documents the principal architectural bottlenecks encountered in the b1e55ed beta event store: write serialization under concurrent producers, non-atomic dual-write consistency gaps, incomplete hash-envelope design, and non-idempotent resolution paths. The goal is not to present a universal blueprint, but to give Post Fiat oracle builders a concrete failure map for designing replayable, verifiable, append-heavy data pipelines.

---

## Methodology and Evidence Status

This brief is based on a combination of deployment observations, reproducible stress behavior in the beta environment, and code findings during hardening of the b1e55ed event pipeline. Each bottleneck below is marked to distinguish directly witnessed failure from architectural conclusion:

- **Observed** — directly witnessed and reproducible in the beta deployment
- **Audited** — identified during beta hardening and external code review
- **Inferred** — architectural conclusion drawn from system behavior and design analysis

---

## Deployment Context

- **Runtime:** Python async worker model
- **Store:** SQLite in WAL mode + append-only JSONL audit log (dual-write)
- **Topology:** single-node oracle service
- **Cycle cadence:** 5-minute brain cycles
- **Producer concurrency target:** up to 20 concurrent producer tasks
- **Correctness requirement:** replayable, attributable, tamper-evident forecast history
- **Proof gate:** 500 resolved, accurately-attributed outcomes required for contributor eligibility

*Note: The failure envelope described here is architecture-specific and depends on runtime, storage medium, filesystem behavior, SQLite tuning, and producer burst characteristics.*

---

## 1. Initial Architecture and Design Target

### Dual-Write Event Store

b1e55ed was designed around two persistence layers operating in tandem:

1. **Append-only JSONL audit log** — immutable, filesystem-resident. Every forecast event, resolution, and karma update is appended in order. Never edited.
2. **SQLite canonical store (`brain.db`)** — queryable state, indexed by contributor, asset, horizon, and resolution status.

The dual-write design reflects a deliberate tradeoff: the append log provides auditability and replayability; the queryable store provides the indexed access patterns needed for scoring, resolution, and proof state queries.

### Why SQLite

The choice of SQLite was deliberate and defensible at the design target scale:

- Zero operational overhead for early operators — no Postgres to provision or maintain
- ACID guarantees sufficient for single-node operation
- WAL (Write-Ahead Logging) mode enables concurrent readers without blocking writers
- The event store schema is fundamentally append-heavy, not update-heavy — SQLite's write performance is adequate for this workload at design target throughput

**Design target:**
- 5–50 forecast events per 5-minute brain cycle
- Up to 20 concurrent producer tasks
- Stable operation under sequential or low-concurrency emission

The problems emerged when the concurrency model of the producer framework collided with SQLite's writer serialization semantics.

### When SQLite Becomes the Wrong Choice

SQLite remains viable when the architecture enforces a single-writer pattern and treats the query store as derived state. It is not the right foundation for sub-second latency requirements, multi-region deployments, or producer concurrency significantly beyond the design target.

At sustained throughput far beyond the design target, especially once write concurrency, retention, and query complexity all increase materially, PostgreSQL/TimescaleDB or a dedicated event-sourcing architecture becomes the more defensible choice. That migration path is outside the scope of this brief but should be designed into the schema from the start: event schemas that travel cleanly to Postgres are cheaper to migrate than schemas optimized for SQLite quirks.

---

## 2. Bottlenecks Encountered

### Summary Table

| Failure Class | Trigger Condition | Immediate Symptom | Proof Risk | Evidence Status |
|---|---|---|---|---|
| Write contention | Concurrent producer writes | Lock contention / missed index writes | Incomplete forecast record | Observed |
| Cross-store inconsistency | Crash between JSONL and SQLite write | Divergence between audit and query state | Unverifiable history | Observed |
| Hash envelope incompleteness | Contributor ID omitted from signed payload | Detachable attribution | Identity/provenance failure | Audited |
| Non-idempotent resolution | Duplicate resolver execution | Overwrite of prior outcome record | Corrupted proof sample | Audited |

---

### 2.1 Single-Writer Bottleneck Under Concurrent Producers

**Status: Observed**

**What happened:** When multiple producers attempted to emit forecasts simultaneously during a brain cycle, write contention on the SQLite store produced intermittent `database is locked` errors. SQLite's WAL mode enables concurrent reads but serializes all writes — under bursty multi-producer emission, this serialization became a failure point rather than a performance concern.

The producer framework was designed to run producers as independent async tasks, each holding its own DB connection and attempting writes without coordination. Under low concurrency this works. Under bursty concurrent emission — particularly when producers complete simultaneously after a slow cycle — lock contention became operationally meaningful. PRAGMA settings (`busy_timeout`, retry logic) reduce but do not eliminate this at higher concurrency.

**Impact on proof gate:** Forecast emissions that failed at the SQLite layer were captured in the JSONL audit log but not in the canonical store. The audit log and the queryable store diverged silently. The proof gate count, computed from the canonical store, understated the true emission count.

**Mitigation implemented:** Serialized all DB writes through a single writer coroutine with an async queue. Producers enqueue forecast events; the writer drains the queue sequentially. This eliminated the observed write-lock failure mode in the beta deployment by collapsing producer writes into a single serialized DB path.

**Write semantics:**
- Delivery from producer to queue: at-least-once
- Replay deduplicate key: `event_id` (UUID, generated at emission time)
- Queue: bounded; backpressure surfaced as producer-side latency, not dropped events
- Batching: single-event-per-transaction during beta; batch mode available for higher throughput
- Correctness target: no lost durable audit events; duplication tolerated and handled by dedup key

**For other builders:** If you are using SQLite for your event store, enforce a single-writer pattern from the start. The temptation to give each component its own connection is strong. Resist it. The `busy_timeout` PRAGMA buys time; it does not solve the architecture.

---

### 2.2 Dual-Write Consistency Failure Under Process Crash

**Status: Observed**

**What happened:** The dual-write protocol was not atomic. There is no cross-medium transaction primitive that spans filesystem append and SQLite commit. A process crash between the two writes leaves the system in an inconsistent state.

**Failure modes:**

**Mode A — JSONL write succeeds, process crashes before SQLite write:**
- Event exists in audit log, invisible to scoring
- Detection requires explicit reconciliation scan
- Proof gate count understated

**Mode B — SQLite write succeeds, process crashes before JSONL write:**
- Canonical record exists with no audit trail
- Detection: extremely difficult — the record appears normal
- Severity: breaks the verifiability guarantee, not just the count

Both modes were observed during beta under simulated crash conditions. In the tested beta path, Mode B appeared less frequently than Mode A, but it is more damaging to proof integrity because it produces canonical records with no audit trail.

**Mitigation implemented:** Write-through protocol with JSONL as primary:

1. Append to JSONL first
2. If JSONL write fails → abort; do not write to SQLite
3. If SQLite write fails after successful JSONL → enqueue for retry; JSONL record is the authoritative recovery source
4. Startup reconciliation: scan JSONL from last checkpoint, identify `event_id` values missing from SQLite, replay in order
5. Hash chain continuity check after reconciliation

**Important qualification:** Treating JSONL as primary does not eliminate durability concerns — it makes durability semantics explicit and replayable. Operators still need log rotation, periodic checksums, backup policy, and integrity validation. JSONL is the recovery source, not an unconditionally reliable medium.

**Startup reconciliation as a first-class operation:**

Every restart should:
1. Scan JSONL from last known good checkpoint
2. Identify events missing from SQLite by `event_id`
3. Replay missing events in chronological order
4. Verify hash chain continuity from checkpoint to head
5. Report reconciliation results before accepting new producer connections

This makes crashes recoverable rather than data-corrupting.

**For other builders:** Pick a primary. One medium is truth; the other is a derived index. Document this and enforce it in code. Design the crash scenario explicitly: kill the process between the two writes in your test suite. This failure mode will not surface in happy-path testing.

---

### 2.3 Hash Chain Integrity — What Belongs in the Envelope

**Status: Audited**

**What happened:** The forecast hash chain — designed to make the event sequence tamper-evident — was computed without including `contributor_id` in the hashed payload. This was identified during beta hardening and external code review.

**Why `contributor_id` must be in the envelope:**

An oracle's integrity guarantee requires each event to be cryptographically bound to *who* emitted it, not just *what* they said. Without `contributor_id` in the hash:

- A forecast record can be replayed under a different contributor identity
- Outcome attribution becomes detachable from the forecast record
- The karma system can be exploited: insert a row with your `contributor_id` and a matching hash that references a legitimate forecast

The vulnerability follows directly from the omission, even before considering adversarial extensions.

**Hash v2 envelope (current):**

```python
hash_input = canonical_serialize({
    "previous_hash": <str>,
    "contributor_id": <str>,
    "asset": <str>,
    "horizon": <str>,
    "confidence": <normalized_decimal>,
    "signal_value": <normalized_decimal>,
    "emitted_at": <ISO8601 UTC>,
    "protocol_version": <int>
})
hash = sha256(hash_input.encode("utf-8"))
```

**Canonical serialization rules:**
- JSON with sorted keys, no whitespace
- UTF-8 encoding
- Timestamps: ISO8601, UTC, microsecond precision
- Numeric fields (confidence, signal values): normalized to fixed decimal representation before hashing to avoid float drift across implementations
- `protocol_version` increments on any envelope schema change; old forecasts retain their version identifier

**Verification bug discovered simultaneously:** The `chain_verified` field was stored as `hash IS NOT NULL` — a column existence check, not actual chain verification. The system was reporting all chains as verified while never calling `verify_hash_chain()`. Fixed in the same hardening pass.

**Recommendation:** Do not store `chain_verified` as a persisted column. Compute it on read. Storing it creates a two-source-of-truth problem and, as demonstrated, an easy path to reporting false verification status.

**For other builders:** Define your hash envelope specification *before* writing any code. Ask: what does a downstream verifier need to reconstruct and validate this event independently? Include all of it. Specify the hash function, canonical serialization format, numeric normalization, and timestamp format in a written spec before implementation. Exclusion is harder to correct in production than inclusion.

---

### 2.4 Non-Idempotent Resolution — State Transitions Require Database-Level Guards

**Status: Audited**

**What happened:** The `resolve_forecast` function could overwrite an existing resolution record if called more than once for the same forecast — possible during catch-up after downtime or if the resolution scheduler overlapped with a delayed retry job.

**The original query:**

```sql
UPDATE forecasts SET resolved_at = ?, outcome = ?, profitable = ? WHERE forecast_id = ?
```

No guard against already-resolved rows. A second resolution write silently overwrote the first. If the reference price had moved between the two calls (possible during catch-up), the `outcome` and `profitable` fields could be corrupted.

**The fix:**

```sql
UPDATE forecasts SET resolved_at = ?, outcome = ?, profitable = ? WHERE forecast_id = ? AND resolved_at IS NULL
```

First writer wins. Resolution becomes idempotent. Combined with the JSONL audit log, any second resolution attempt is visible in the append log even when SQLite ignores the second write.

**Broader architectural lesson:** State transitions in event stores should be encoded as database invariants, not scheduler assumptions. Do not rely on "the scheduler won't send duplicates" — it will, eventually, under catch-up, retry, or deployment restart conditions.

**Recommended SQL-level guards for common transitions:**

```sql
-- Unique constraint on event IDs
CREATE UNIQUE INDEX idx_events_event_id ON forecasts(event_id);

-- Resolution guard (only unresolved forecasts can be resolved)
UPDATE forecasts SET ... WHERE forecast_id = ? AND resolved_at IS NULL;

-- Retraction guard
UPDATE forecasts SET retracted_at = ? WHERE forecast_id = ? AND retracted_at IS NULL;

-- Supersession guard
UPDATE forecasts SET superseded_by = ? WHERE forecast_id = ? AND superseded_by IS NULL;

-- Transaction boundary: guarded update within immediate transaction
BEGIN IMMEDIATE;
UPDATE forecasts SET resolved_at = ?, outcome = ?, profitable = ?
    WHERE forecast_id = ? AND resolved_at IS NULL;
COMMIT;
```

Stale workers must fail closed: if a resolution job cannot acquire the write (because another writer won the race), it should log and exit — not retry with backoff that may itself produce another duplicate.

**For other builders:** State machine transitions belong in the database, not the application layer. Use unique constraints, partial indexes, and guarded `UPDATE WHERE` clauses. Assume your scheduler will produce duplicates under exactly the conditions where you can least afford them: catch-up after downtime.

---

## 3. Impact on Oracle Proof Integrity

In the Post Fiat context, the 500-outcome threshold functions as a minimum sample-size gate for meaningful contributor evaluation and downstream trust weighting. Crossing it requires 500 resolved, accurately-attributed outcomes with an intact chain of custody from emission to resolution.

Each bottleneck attacks this gate at a different layer:

| Bottleneck | Proof Gate Impact |
|---|---|
| Write contention (2.1) | Emissions in audit log but not in scoring DB → proof count understated |
| Cross-store inconsistency (2.2) | Canonical records with no audit trail → verifiability broken regardless of count |
| Hash envelope incompleteness (2.3) | Attribution detachable → *who* reached 500 is not cryptographically provable |
| Non-idempotent resolution (2.4) | Outcome accuracy corrupted by overwrite → 500 resolutions may include incorrect outcomes |

A system that passes CI and appears operationally healthy can be producing proof-invalid event records. This is the defining challenge of oracle infrastructure: correctness cannot be inferred from availability. A running oracle is not a correct oracle. The proof gate exists to force this distinction — but only if the event store feeding it is sound.

---

## 4. Mitigations and Recommended Patterns

### 4.1 Layered Write Architecture

```
Producer
    │
    ▼
Async Queue (bounded)
    │
    ▼
Single Writer Coroutine
    │
    ├──▶ JSONL Append Log (primary)
    │         │
    │         ▼
    └──▶ SQLite Index (derived)
              │
              ▼
    Startup Reconciliation (replay JSONL → SQLite on restart)
```

Never write directly to the canonical store from producer code. The queue is your backpressure valve and your serialization point.

### 4.2 Event Schema Specification Before Code

Define a versioned canonical event schema before writing any producer or storage code.

**Mandatory fields:**

| Field | Type | Notes |
|---|---|---|
| `event_id` | UUID | Generated at emission time; dedup key |
| `protocol_version` | int | Increment on any envelope schema change |
| `contributor_id` | str | Always in hash envelope |
| `emitted_at` | ISO8601 UTC | Microsecond precision; no local time |
| `previous_hash` | str | Chain linkage |
| `payload_hash` | str | sha256 of canonical envelope |

### 4.3 Immutability vs Correction Reality

Append-only event stores break down when a producer emits a malformed forecast. You need a correction model that preserves immutability:

- **Short pre-finalization edit window (5 minutes in b1e55ed's current cycle design):** Before the forecast is visible to external consumers or enters a brain cycle, allow direct correction. Enforcement: the brain cycle ingestion pass filters forecasts by `emitted_at + 5m`. Within this window, corrections are direct updates. After it, only retract or supersede. Other builders should choose the shortest window compatible with their own ingestion and trust model.
- **Retract:** Append a `RETRACT` event referencing the original `event_id`. Original stays in log. Scoring ignores retracted events.
- **Supersede:** Append a `SUPERSEDE` event with corrected payload and reference to original. Query layer returns the superseding version; original remains in audit log.

This preserves audit integrity (the log shows what happened, including corrections) while keeping scoring tractable.

### 4.4 Startup Reconciliation Protocol

```python
def reconcile_on_startup(jsonl_path, db_path, last_checkpoint_event_id):
    """Run before accepting any producer connections."""
    audit_events = read_jsonl_from_checkpoint(jsonl_path, last_checkpoint_event_id)
    db_event_ids = fetch_all_event_ids(db_path)
    
    missing = [e for e in audit_events if e["event_id"] not in db_event_ids]
    
    for event in missing:
        replay_to_db(db_path, event)  # idempotent by UNIQUE(event_id)
    
    verify_hash_chain(db_path, from_checkpoint=last_checkpoint_event_id)
    log_reconciliation_result(len(missing))
```

---

## 5. Applicability Bounds

The recommendations in this brief assume:

- Single-node or lightly distributed oracle deployment
- Append-heavy event flow (forecasts, resolutions, karma events)
- Moderate throughput where 5-minute brain cycles are acceptable
- Strong requirements for replayability, auditability, and proof-grade attribution
- Tolerance for eventual consistency in the query layer (SQLite as derived index)

They may not apply unchanged to:

- Multi-region distributed deployments
- Sub-second latency environments
- High-frequency market data ingestion pipelines
- Architectures requiring strictly atomic cross-store guarantees
- Systems where the append log is not an acceptable primary medium (e.g., embedded constraints)

---

## 6. What We Would Do Differently

If building b1e55ed's event store from scratch:

1. **Write the hash envelope spec first** — not the schema, not the API. The envelope determines everything downstream. Include hash function, canonical serialization, numeric normalization, and timestamp format before writing a single line of storage code.

2. **Enforce single-writer from day one** — even with one producer. The discipline is cheap to add early and expensive to retrofit.

3. **Write reconciliation before writing producers** — the startup reconciliation pass should exist before any producer emits a single event. Crash recovery is not a feature you add later.

4. **Test crash scenarios in CI** — kill the process between JSONL write and SQLite write explicitly. Assert that the next startup recovers the event cleanly. This failure mode is invisible in happy-path testing.

5. **Treat `chain_verified` as a computed property** — never persist it. Compute on read. Stored verification status is a two-source-of-truth problem waiting to fail.

6. **Specify delivery semantics explicitly** — at-least-once delivery, deduplicate by `event_id`, and replayability as a first-class correctness property. These should be in the design document, not inferred from implementation.

---

## 7. Conclusion

The central lesson from the b1e55ed beta event store is that oracle correctness depends less on raw write speed than on persistence semantics.

Once an oracle must support replayability, attribution integrity, and proof-grade outcome history, the principal risks shift to write serialization, cross-store consistency, hash-envelope completeness, and idempotent state transitions.

Builders who treat the append log as primary, the query store as derived, and SQL guards as part of the state machine will avoid a large class of proof-invalidating failures.

The goal of this document is to make those failure modes visible in design, not in production, and not while trying to prove 500 outcomes to a network that does not forgive gaps in the chain.

---

*Published by PermanentUpperClass for the Post Fiat Network.*
*Task: Document b1e55ed Event Store Architectural Limits for Oracle Builders*
