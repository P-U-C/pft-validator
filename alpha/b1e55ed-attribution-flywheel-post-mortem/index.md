---
layout: default
title: "Attribution Flywheel Post-Mortem"
date: 2026-03-16
category: post-mortem
status: published
---

# Attribution Flywheel Post-Mortem: How Three Compounding Bugs Silently Killed Reward Attribution

**Published:** 2026-03-16  
**Author:** b1e55ed (Oracle Node Operator)  
**PRs:** #402, #404, #405, #407, #408  
**System:** b1e55ed — Post Fiat Network oracle and signal attribution engine  
**Status:** All bugs resolved, fixes merged to develop

---

## Executive Summary

Between late February and mid-March 2026, the b1e55ed attribution flywheel was silently non-functional. Producers submitted signals, positions opened and closed, karma rows appeared in the database — but producer attribution and PnL credit were returning zero results on every position close.

The system looked healthy. It wasn't.

Three independent bugs, each individually survivable, combined into a complete attribution failure:

1. **Identity mismatch** — `SIGNAL_ACCEPTED_V1` was keyed on `order_id`; karma and PnL lookups used `position_id`. Every attribution lookup returned empty.
2. **Silent emission guard** — a defensive `if not intent.source_event_ids: return` in `_emit_signal_accepted()` silently skipped event emission when `source_event_ids` defaulted to `[]`. No event, no attribution, no error.
3. **Crash window** — position/order writes were committed before provenance events were appended. A crash between those operations left open positions with no event history — orphaned, unattributable, invisible to audit.

Underneath all three: pruning infrastructure was silently broken — wrong column references, wrong type comparisons, FK violations — so the database was growing unchecked and any operational alert that might have surfaced the attribution failure was drowned in storage noise.

This post-mortem is written for external network builders and oracle developers. Every bug here is a recognizable class failure in event-sourced attribution systems. The lessons generalize.

---

## 1. The Compounding Failure Chain

### Bug 1: Identity Mismatch (`order_id` vs `position_id`)

**Location:** `engine/execution/oms.py`, `engine/execution/karma.py`, `engine/execution/pnl.py`

When a trade executed, `OMS._emit_signal_accepted()` emitted a `SIGNAL_ACCEPTED_V1` event with:

```python
trade_id = fill.order_id  # ← wrong canonical key
```

When a position later closed and the system attempted to attribute the outcome to the originating signal, `karma.py` and `pnl.py` both performed their lookups using:

```python
trade_id = str(position.position_id)  # ← different key
```

These are different identifiers. `order_id` is the execution-layer fill identifier. `position_id` is the position-layer canonical identifier. The lookup was structurally guaranteed to return zero results on every position close.

**Why it wasn't caught immediately:**

The system didn't error. Karma rows were created (from other code paths), positions opened and closed normally, the event bus received events. Zero attribution looked like "no signals were accepted" rather than "the lookup key is wrong."

There was no assertion that `SIGNAL_ACCEPTED_V1` count should be non-zero after a filled position. The invariant simply wasn't enforced.

### Bug 2: Silent Emission Guard

**Location:** `engine/execution/oms.py::_emit_signal_accepted()`

Even if Bug 1 had been fixed, a second bug would have suppressed all event emission entirely.

The function had this guard:

```python
def _emit_signal_accepted(self, *, trade_id: str, intent: TradeIntent) -> None:
    if not intent.source_event_ids:
        return  # silent return — no event, no log, no error
```

This guard was originally defensive — don't emit attribution events if there are no source signal IDs to attribute to. Reasonable in isolation.

But a separate change had removed `source_event_ids` propagation from the orchestrator call sites:

```python
# Before (correct):
decide_and_emit(..., source_event_ids=list(synth.snapshot.source_event_ids or []))

# After (broken):
decide_and_emit(...)  # source_event_ids defaults to []
```

`TradeIntent.source_event_ids` has `default_factory=list`, so it silently defaults to `[]`. The guard fires on every call. `SIGNAL_ACCEPTED_V1` is never emitted. No log line. No exception. The flywheel simply stops.

**Why it compounded Bug 1:**

Even after fixing the identity mismatch, no events were being emitted at all. The fix for Bug 1 was correct but untestable until Bug 2 was also resolved — the test couldn't pass because the event it was asserting against wasn't being created.

**The fix:** Remove the `source_event_ids` injection dependency entirely. Instead, `_emit_signal_accepted()` now queries the database for recent signal events matching `intent.symbol` within a 60-minute window, uses those as source IDs, and — critically — always emits `SIGNAL_ACCEPTED_V1` even if no prior signals are found (using a `producer_id='unknown'` fallback). Silent skipping is never acceptable in an attribution system.

### Bug 3: Crash Window Between Persistence and Provenance

**Location:** `engine/execution/paper.py`, `engine/execution/oms.py`

When a position opened, the execution flow was:

1. `INSERT INTO positions` (committed)
2. `INSERT INTO orders` (committed)
3. Append `ORDER_SUBMITTED_V1`
4. Append `ORDER_FILLED_V1`
5. Append `POSITION_OPENED_V1`
6. Append `SIGNAL_ACCEPTED_V1`

Steps 1-2 were committed to the database. Steps 3-6 were appended separately, in sequence, without a shared transaction boundary.

A crash, restart, or unhandled exception between steps 2 and 3 left a real position in the database with no event history — no `ORDER_SUBMITTED`, no `SIGNAL_ACCEPTED`, no audit trail.

**Why this mattered for attribution:**

Attribution queries for a position look up its provenance by finding the `SIGNAL_ACCEPTED_V1` event with `trade_id = str(position_id)`. If that event was never appended (crash window) and the identity was wrong even when it was appended (Bug 1), the orphaned position was completely invisible to the attribution system.

It existed in the `positions` table, its PnL could be computed, but it could never be attributed to any producer.

**The fix:** Two-part. First, add `dedupe_key` to all four execution event emissions — idempotent keys like `order_submitted:{order_id}` mean backfill operations never create duplicates. Second, implement `reconcile_execution_events(db)` — a function that scans all positions and orders, detects missing provenance events via the `event_dedup` table, and backfills them idempotently. This runs on daemon startup and is callable as `b1e55ed reconcile`.

### The Infrastructure Rot Layer: Pruning Failures

Underneath the three attribution bugs, pruning was silently broken in three independent ways:

**Wrong column reference:** `prune_old_data()` attempted to prune `conviction_scores` by `created_at`, but the `conviction_scores` table had no `created_at` column. The query errored silently (caught and swallowed in the calling context), leaving conviction scores permanently unpruned.

**Wrong type comparison:** `api_rate_limits.window_start` is stored as an integer Unix epoch. The prune query compared it as a datetime text string:

```sql
WHERE window_start < datetime('now', ?)  -- always 0 deletes (integer vs text)
```

Rate limit records were never pruned. The table grew unboundedly.

**FK violation ordering:** Events were pruned before their referencing `event_dedup` rows, causing `FOREIGN KEY constraint failed` errors with `PRAGMA foreign_keys=ON`. The prune function would crash mid-operation, leaving the database partially pruned in an inconsistent state.

None of these produced visible errors to the operator. Logs were clean. The database grew.

---

## 2. Detection Methodology

### What didn't catch it

Standard monitoring caught none of this.

Dashboards showed positions opening and closing. The event bus was receiving events. Karma rows existed. PnL numbers were computed. Everything looked operational because the system *was* operational — it just wasn't attributing.

Attribution failures are particularly hard to detect passively because the correct state is "karma updated after position close" and the failed state is also "karma not updated after position close, because no signals were accepted." Both look the same if you're not specifically asserting that karma *should* have been updated.

### What did catch it

**The attribution flywheel test.**

The specific failure was surfaced when writing `test_producer_karma_updates_after_position_close` — a test that traces the full round-trip: signal emission → position open → position close → karma row updated + `ATTRIBUTION_OUTCOME_V1` emitted.

The test failed immediately. Debugging revealed that `SIGNAL_ACCEPTED_V1` was present in the event bus for some historical positions but not others, and when it was present, the `trade_id` didn't match the `position_id` used in the lookup.

**Code path tracing.** Once the test was failing, a grep for all uses of `trade_id` in the attribution/event code revealed the `order_id` vs `position_id` split. The fix was a one-line change once the mismatch was found.

But the downstream guard in `_emit_signal_accepted()` was only discovered when the fixed test *still* failed — at which point the `if not intent.source_event_ids: return` guard became the next thing to examine.

**Review Council.** After PR #407 was submitted with the identity fix, the Review Council (automated multi-persona code review) flagged that `source_event_ids` propagation had been removed from orchestrator call sites in a prior PR, making the guard always fire. The council specifically called out:

> *"After this PR, `intent.source_event_ids` is always `[]` → `_emit_signal_accepted()` always returns immediately → `SIGNAL_ACCEPTED_V1` is never emitted."*

Without that catch, a correct-looking fix would have shipped with the silent suppression still in place.

**Lesson:** Automated review caught what human review missed because the bug crossed PR boundaries — the guard was correct when written, the propagation removal was reasonable in isolation, but together they were fatal. Cross-PR reasoning is where automated review adds the most value.

---

## 3. Fix Cluster: PR Map

| PR | Failure Resolved | Key Change |
|----|-----------------|------------|
| #402 | Pruning rot (retention/karma DX) | Data pruning infrastructure, karma event-sourcing, cockpit state fixes |
| #404 | Crash window (Bug 3) | `dedupe_key` on all execution events; `reconcile_execution_events()` for idempotent backfill; runs on daemon startup |
| #405 | Pruning bugs + duplicate `TRADE_INTENT_V1` | `conviction_scores.created_at` migration; `api_rate_limits` epoch arithmetic; `event_dedup` FK-safe deletion order; `TRADE_INTENT_V1` removed from OMS (single authoritative emitter) |
| #407 | Identity mismatch (Bug 1) + silent guard (Bug 2) | `trade_id=fill.position_id` in OMS; `_emit_signal_accepted()` queries DB by symbol+window; always emits (fallback to `unknown`); `test_attribution_chain.py` restored |
| #408 | Schema crash on existing DBs | `idx_events_symbol` removed from static SCHEMA string; created only by migration after `_ensure_column()` runs |

---

## 4. Architectural Lessons

These lessons generalize to any event-sourced attribution or reward system.

### Lesson 1: One canonical identity key, enforced at the schema level

Any system that attributes outcomes to events needs a single canonical identifier that is consistent from event emission to outcome lookup.

In b1e55ed, `position_id` is the right key because it's the identifier that persists through the position lifecycle. `order_id` is an execution artifact — it belongs to the fill, not the position.

**The rule:** Define your attribution identity key explicitly, document it in a comment adjacent to every emission site, and write a test that asserts the emitted key matches the lookup key. Never allow these to drift.

### Lesson 2: Defensive guards that return silently are attribution bugs

`if not condition: return` is dangerous in event-emission code. When a guard fires, nothing happens — no event, no log, no exception. The calling system has no way to know the event was suppressed.

From the outside, "emission suppressed by guard" is indistinguishable from "emission not yet reached."

**The rule:** In attribution-critical code paths, never silently skip. Either emit a fallback event (with degraded fields, clearly marked), raise an exception, or log a structured warning that is monitored. Silent suppression hides failures.

### Lesson 3: Persistence and provenance must share a transaction boundary

If you write a record to a database and then separately append the events that describe how that record came to exist, you have a crash window. A failure between the write and the append leaves a record with no history — an orphan.

Orphans accumulate silently. They're unattributable and often undetectable without explicit reconciliation.

**The rule:** Use idempotent event keys (dedupe keys) so backfill is safe to run repeatedly. Implement a reconciliation function that runs at startup. Treat "position exists without SIGNAL_ACCEPTED" as a detectable and repairable invariant violation, not a silent state.

### Lesson 4: Pruning bugs are compounding debt, not cosmetic issues

Pruning that silently fails doesn't just waste disk space — it degrades query performance, masks attribution gaps (old records pollute aggregates), and creates false-positive signals in monitoring. A system that never prunes looks healthy until it doesn't.

**The rule:** Write tests for pruning logic specifically. Verify the correct rows are deleted (not zero, not too many). Test FK-safe deletion order explicitly. Use epoch arithmetic, not string comparison, for Unix timestamp columns.

### Lesson 5: Cross-PR reasoning requires automated review

The `source_event_ids` propagation removal and the emission guard were in different PRs, written by different agents, both passing their own tests. Neither was wrong in isolation. Together they were a complete attribution failure.

Human review of individual PRs doesn't catch this class of bug.

**The rule:** Automated review with memory across PRs — or integration tests that trace the full attribution round-trip — is the only reliable defense against cross-PR regressions. The invariant test (`test_producer_karma_updates_after_position_close`) caught what no single-PR review could.

---

## 5. Invariant Checklist for Oracle and Reward System Builders

Use this checklist before shipping any event-sourced attribution system to production.

- [ ] **Single canonical attribution key** — every event emission site and every attribution lookup site uses the same identifier. A grep for the key name should return a consistent set of sites with no alternative identifiers in use.

- [ ] **No silent emission suppression** — every code path through an attribution-critical event emission either emits an event or raises/logs explicitly. `return` without emission is never acceptable.

- [ ] **Atomic persistence + provenance** — position/record creation and its provenance event emission share a transaction boundary, OR a reconciliation function exists that detects and repairs the gap idempotently.

- [ ] **Idempotent event keys** — all events have a `dedupe_key` that is deterministic from the business operation. Running backfill twice produces the same database state.

- [ ] **End-to-end attribution test** — a test exists that traces signal → execution → position close → karma/PnL update as a single round-trip. This test must fail if any link in the chain is broken.

- [ ] **Pruning type-safety** — all pruning queries use the correct type for timestamp comparisons. Integer epoch columns use epoch arithmetic; text timestamp columns use datetime functions. A test verifies non-zero rows are deleted on a populated database.

- [ ] **FK-safe deletion order** — pruning deletes child rows (foreign key references) before parent rows. A test verifies this order is preserved when `PRAGMA foreign_keys=ON`.

- [ ] **Reconciliation at startup** — the daemon checks for orphaned records (positions without provenance events) on startup and repairs them before accepting new work.

---

## Closing Note

The failure described here isn't exotic. Identity key inconsistency, silent defensive guards, and non-atomic persistence are among the most common bugs in event-sourced systems — precisely because each one looks reasonable in isolation, each one fails silently, and each one is only detectable when you trace the full round-trip from emission to outcome.

The test that finally caught all three — `test_producer_karma_updates_after_position_close` — was written as part of the fix, not before it. That's backwards. The invariant checklist above exists so that next time, the test is written first, and the bugs never reach production.

---

*Published by Permanent Upper Class validator operation.*  
*Task completed for the Post Fiat Network.*

*Fix PRs: [#402](https://github.com/P-U-C/b1e55ed/pull/402) · [#404](https://github.com/P-U-C/b1e55ed/pull/404) · [#405](https://github.com/P-U-C/b1e55ed/pull/405) · [#407](https://github.com/P-U-C/b1e55ed/pull/407) · [#408](https://github.com/P-U-C/b1e55ed/pull/408)*
