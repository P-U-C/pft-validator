# b1e55ed v1.0.0-beta Architectural Bottlenecks: A Post-Mortem for Oracle Builders

Author: b1e55ed / PermanentUpperClass
Version: 2.1
Date: 2026-03-05
Alignment: Post Fiat Alpha Registry and Validator Stack

---

## Abstract

This post-mortem documents three architectural bottlenecks discovered during the b1e55ed v1.0.0-beta deployment — a verifiable oracle system that ingests LLM-produced forecasts, evaluates them against market outcomes, and computes contributor scores for the Post Fiat network. Each bottleneck is described with its root cause, evidence basis, specific impact on the 500-outcome proof state gate, and the architectural pivot implemented to resolve it. The three areas covered are: forecast ingest backpressure from write serialization, outcome resolution path composition failure, and dual-write crash consistency between audit log and query store. The intent is to give other Post Fiat oracle builders a failure map for designing replayable, auditable, multi-producer forecast pipelines.

---

## Evidence Notation

Each bottleneck below is tagged with its evidence status:

- Observed — directly witnessed in beta deployment or reproduced under load testing
- Audited — identified through code-path or scheduler review
- Inferred — architectural conclusion drawn from system behavior and design constraints

This distinction matters. Claims tagged Inferred should be independently verified against your deployment context before treating them as confirmed.

---

## System Context

b1e55ed ingests signals from producers (autonomous agents that emit probabilistic forecasts on price movements, events, and on-chain metrics), stores them in a verifiable event store, evaluates them against outcomes, and computes karma scores that determine a contributor's standing in the Post Fiat Alpha Registry.

The pipeline:

Producer → Signal Emission → Event Store → Brain Cycle → Outcome Resolution → Karma

A forecast record is a minimum tuple of: producer ID, asset, predicted direction, confidence value, and emission timestamp. A forecast becomes a resolved outcome when the brain cycle evaluates it against actual market data and marks it profitable or unprofitable. A resolved outcome is auditable when it has a corresponding entry in the append-only audit log that can be independently verified.

The 500-outcome proof state gate requires 500 *resolved, auditable forecast-outcome pairs* — not 500 emitted forecasts. A system can accumulate thousands of forecast records and still have zero valid proof-state entries if resolution and auditability are broken. All three bottlenecks documented here attack the gate in this way.

---

## Bottleneck 1: Write Serialization and Forecast Ingest Backpressure

Evidence status: Observed (contention path); Inferred (latency accumulation model)

### What Happened

Under concurrent producer activity, forecast emissions began arriving faster than the event store could commit them. The root cause: all forecast writes — ingest, enrichment, and outcome resolution updates — shared a single synchronous write path into a SQLite database. SQLite permits only one active writer at a time; even with WAL mode enabled, concurrent write attempts serialize at the database level rather than being queued or batched.

The symptoms in practice:

- Forecast acceptance latency increased materially as producer concurrency rose
- Under load, the enrichment step (which performs a synchronous context lookup before writing) became a head-of-line blocker — a slow enrichment stalled every subsequent ingest behind it
- At elevated producer counts, write attempts began returning database is locked errors; because the failure path did not reliably surface or halt ingest, forecast records could appear in the audit log while being absent from the canonical store

The contention was not visible under single-producer or low-volume beta conditions. It only surfaced when multiple producers ran simultaneously against a shared deployment.

### Why This Is an Architectural Issue, Not a Tuning Issue

The problem is not that SQLite is slow. It is that the write path was designed assuming a single producer. That assumption was never encoded as a constraint, validated at startup, or tested under concurrent load. The architecture was correct for its implicit model and wrong for its actual deployment context.

This is a class of failure common to oracle systems that grow from prototype to multi-producer deployments without revisiting their I/O architecture.

### Impact on the 500-Outcome Proof Gate

Two mechanisms degraded proof accumulation:

1. Latency inflation: Synchronous enrichment on the ingest path meant each forecast write took longer under load, slowing the rate at which the event store approached the 500-outcome threshold.
2. Silent drops: Write failures that were swallowed rather than surfaced caused the canonical store count and the audit log count to diverge. Records visible in the audit log were absent from the query store used for proof-state computation. The proof gate denominator was being computed against an incomplete canonical record.

Before: All producers write synchronously to a single SQLite connection. Enrichment is on-path. No backpressure signaling. Write failures log nothing alarming and return empty results.

After: All DB writes route through an async queue drained by a single writer coroutine. Enrichment is decoupled from the ingest path and runs asynchronously against a queue of pending records. Write failures raise exceptions that are recorded to the audit log as failed ingest events rather than silently dropped.

### Resolution

- Single writer coroutine. All event store writes go through an async queue. The queue drains sequentially; producers never contend directly on the database lock.
- Enrichment decoupled from ingest. Forecast records are accepted and written first with raw signal data. Enrichment runs asynchronously and updates the record in a second pass. A slow enrichment no longer stalls ingest.
- Explicit write failure handling. A write failure raises an exception that is logged to the audit log as a failed event. It is never silently dropped.
- Startup concurrency assertion. If the configured producer count exceeds the validated write throughput baseline, the system logs a warning at startup rather than discovering contention under load.

### For Other Builders

- If your write path is synchronous and shared across producers, you already have this bottleneck — you just haven't hit it yet.
- SQLite is fine for oracle deployments at low producer counts. The issue is the assumption that it will scale linearly. It will not.
- Decouple enrichment from ingest. They have different latency profiles and should not share a write path.
- Any write failure that is silently swallowed will eventually corrupt your proof state. Make write failures loud.

Primary operator signal: audit-log record count diverges from canonical store row count; ingest queue depth trends upward; p95 ingest latency climbs as concurrent producer activity increases.

---

## Bottleneck 2: Outcome Resolution Path Never Composed into the Brain Cycle

Evidence status: Audited (scheduler gap); Reproduced (null-score test)

### What Happened

The update_outcomes() function — responsible for comparing emitted forecasts against actual market outcomes and marking them profitable or unprofitable — was never called in the production brain cycle. The function existed. It was unit tested. It passed CI. It was simply never invoked from the scheduler that runs the brain cycle.

The result: the profitable field on every forecast record was NULL. Every accuracy score computed from these records was computed against NULL — returning NULL or falling back to a default. The karma system was running on fictional scores.

### How This Survives Testing

Unit tests for update_outcomes() call it directly with test data. They pass. The integration test for the brain cycle checks that the cycle runs without error — it does. What no test checked: *after the brain cycle completes, do forecasts that should be resolved have non-NULL profitable values?*

This is the testing blind spot that kills oracle systems: testing components in isolation while never testing the composition.

### Impact on the 500-Outcome Proof Gate

This bottleneck is the most severe of the three. With update_outcomes() never called:

- Zero forecasts were resolved
- The profitable field was universally NULL
- Karma scores were computed against missing data
- The proof gate denominator was accumulating records; the resolved count was zero

A system could run for months, accumulate thousands of forecast records, and be provably unable to demonstrate a single verified outcome. The count looks healthy. The proof is hollow.

Before: Brain cycle runs on schedule. Ingest and scoring execute. update_outcomes() exists in the codebase but is absent from the scheduler manifest. No error is raised. Resolved count: 0.

After: Scheduler manifest is audited against a documented data-path map. Every function that should run on a cycle is listed explicitly, with its expected state change and a corresponding integration assertion.

### Resolution

- Scheduler wiring audit. After update_outcomes() was found unwired, every function that should be called on a cycle was audited against the scheduler configuration. Two additional functions were found in the same state.
- End-to-end proof state test. Added an integration test that runs a full brain cycle against synthetic data and asserts resolved_count > 0 after completion. Not "function ran without error" but "function produced the expected state change."
- Operational health endpoint. GET /health now returns outcomes_pending count. If this number grows without bound, the resolution pipeline is broken. Operators can monitor it.
- Data-path map as first-class artifact. The scheduler manifest is documented alongside the pipeline diagram. Every record type lists: where it is created, where it is updated, where it is resolved. This map is checked in CI.

### For Other Builders

- Trace the data path explicitly. For every record type, document where it is created, updated, and resolved. Audit the scheduler against this map.
- Assert non-trivial output in integration tests. "Function ran without error" is not a correctness test.
- Health endpoints with semantic meaning. "Service is up" tells you nothing about oracle correctness. "Outcomes resolved in last cycle: N" is meaningful.
- The composition gap is not obvious. A function that passes all its unit tests and is never called looks exactly like a function that passes all its unit tests and runs correctly. You cannot distinguish them from the unit test surface alone.

Primary operator signal: emitted forecast count increases while resolved count remains flat; outcomes_pending trends upward monotonically across cycles.

---

## Bottleneck 3: Dual-Write Crash Consistency Between Audit Log and Query Store

Evidence status: Observed (Failure Mode B and C); Audited (Failure Mode A)

### What Happened

b1e55ed uses a dual-write event store: an append-only JSONL audit log (filesystem) and a queryable SQLite canonical store (brain.db). The two writes are not atomic — there is no cross-medium transaction primitive. Under normal operation this works. Under process crash, it produces three distinct failure modes:

Failure Mode A — Audit log written, canonical write lost (Audited)
JSONL write succeeds; process crashes before SQLite write completes. The event exists in the audit log and is invisible to proof-state computation until the next reconciliation pass.

Failure Mode B — Canonical write complete, audit trail missing (Observed)
SQLite write succeeds; process crashes before JSONL write completes. The canonical record looks normal from query. There is no audit trail entry. The record is unverifiable. This breaks the verifiability guarantee of the oracle without surfacing an obvious anomaly in normal query-path operation.

Failure Mode C — Concurrent write contention causing canonical drops (Observed)
SQLite permits only one active writer at a time. Under concurrent producer activity, write attempts beyond the serialization capacity were dropped at the canonical store level while succeeding at the audit log level. The JSONL count and the SQLite row count diverge over time. The divergence is only detectable via explicit reconciliation.

### Impact on the 500-Outcome Proof Gate

Each failure mode erodes the proof differently:

- Mode A: Proof count understated; records exist but are invisible to scoring
- Mode B: Records are counted but unverifiable; proof gate count is inflated with invalid entries
- Mode C: Proof count is randomly understated under load; gate progress is slower than apparent ingest rate suggests

Before: Dual-write on the request path. No designated source of truth. No deterministic crash recovery. Divergence between audit log and canonical store accumulates silently.

After: JSONL is the primary source of truth. SQLite is a derived query index. All writes commit to JSONL first; SQLite is updated asynchronously. Startup reconciliation replays any JSONL entries missing from SQLite. Hash chain continuity is verified on boot.

### Resolution

- JSONL as primary, SQLite as derived index. Write JSONL first. If JSONL fails, abort — do not write to SQLite. If SQLite fails after JSONL succeeds, enqueue for retry; the JSONL record is truth.
- Single writer coroutine. (Shared with Bottleneck 1.) All DB writes go through an async queue drained by a single coroutine. Removes inter-producer write contention at the application layer by forcing all canonical writes through one serialized path.
- Startup reconciliation. On every restart, scan JSONL from the last checkpoint, identify event IDs absent from SQLite, and replay them in order. Crash recovery is deterministic.
- Hash chain continuity check. After reconciliation, verify the hash chain is unbroken from genesis to head. Any gap surfaces immediately rather than corrupting the proof silently.

### Clarification on SQLite WAL Behavior

SQLite's WAL mode improves read/write concurrency — readers do not block writers and writers do not block readers. It does not remove the single-writer limit. Under concurrent producer activity, write contention persists in WAL mode; WAL only ensures that read operations are not also blocked during that contention.

### For Other Builders

- Pick a primary. One medium is truth; the other is a cache. Document this and enforce it in code. A dual-write system with no designated primary has two sources of truth, which means it has none.
- Design for crash between writes. Test it explicitly: kill the process after the first write completes. What is the state? Is it recoverable?
- Startup reconciliation is not optional. It is the mechanism that makes crashes recoverable rather than data-corrupting.
- Do not rely on WAL to resolve write contention at scale. If your oracle runs more than a handful of concurrent producers, enforce a single-writer pattern from the start.

Primary operator signal: reconciliation replay count is non-zero after restart; hash chain continuity check fails on boot; audit-log and canonical store record counts diverge and the delta persists across cycles.

---

## Summary

| Bottleneck | Evidence Status | Root Cause | Proof Gate Impact | Pivot |
|---|---|---|---|---|
| Write serialization & ingest backpressure | Observed (contention); Inferred (latency model) | Synchronous shared write path; enrichment on ingest; no backpressure | Latency slows accumulation; silent drops cause count divergence | Async queue, single writer, decoupled enrichment |
| update_outcomes() never composed into brain cycle | Audited + Reproduced | Composition gap — function tested in isolation, never wired to scheduler | Zero resolved outcomes despite accumulating records | Scheduler audit, data-path map, end-to-end proof state test |
| Dual-write crash consistency | Observed (B, C); Audited (A) | No atomic cross-medium transaction; no designated primary | Proof count and provable count diverge silently | JSONL-primary, async SQLite index, startup reconciliation, hash chain check |

---

## Appendix: Schema Mismatch in the Enrichment Layer

This failure was discovered during the same beta hardening period and is documented here for completeness. It is a contract-validation bug rather than a deployment-phase architectural bottleneck, but the failure mode is worth knowing.

The producer enrichment layer was returning a flat 0.5 confidence score for every forecast. No error was raised. CI passed. The root cause: a column name mismatch between the schema the enricher expected (token_symbol) and the column name the database actually used (symbol). The join silently returned zero rows and fell through to a default.

```python
# What the enricher expected
df.merge(context_df, on='token_symbol')  # returns empty — no error

# What it should have been
df.merge(context_df, on='symbol')
```

Resolution: Schema validation at startup; enrichment failure raises an exception rather than producing a synthetic confidence value.

For builders: Any pipeline that joins across component boundaries should validate schema contracts at startup and treat empty join results as errors rather than empty datasets.

---

## The Meta-Lesson

All three bottlenecks share a common structure: the system worked, the proofs didn't. CI passed. The service ran. No alarms fired. The oracle was producing records that were unverifiable, inaccurate, or missing — and nothing in the operational surface indicated a problem.

This is the defining challenge of oracle infrastructure: correctness cannot be inferred from availability. A running oracle is not a correct oracle. The proof state gate exists precisely to force this distinction — but it only works if the event store feeding it is sound. Build event store soundness checks first. Everything else depends on them.

These bottlenecks were encountered at beta scale with a small number of concurrent producers. They are not a claim about universal oracle architecture — they are a map of where proof-state divergence from apparent system health is most likely to appear first.

---

*b1e55ed is open source. Source: https://github.com/P-U-C/b1e55ed*
*Oracle endpoint: https://oracle.b1e55ed.permanentupperclass.com*
*Docs: https://docs.b1e55ed.permanentupperclass.com*
