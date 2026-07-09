# Routing Unblock Action Plan — Stale Task Disposals & Threshold Recommendation

**Task:** `task_17994866ddfe34db49f31cae36c48f00` · Task Node Core Product board
**Author:** zoz (`zozDOTeth`) · Project Leader badge
**Date:** 2026-07-09 · Data snapshot: task payload board packet + hive reports, 2026-07-09 ~08:00 UTC
**Decision owner:** @goodalexander (or any operator authorized to change routing constraints)

---

## 0. Executive summary

The routing engine only offers tasks to **completely idle** contributors. As of the snapshot, **1 of 40 candidates is idle**, so routing is effectively halted network-wide — while **5 of the 6 proposed tasks on the Core Product board have sat unaccepted for 8–12 days**, locking **78,000 PFT** and consuming routing attention.

This document asks for **exactly one routing-rule change** plus two operational actions, executable together in ~15 minutes:

1. **The one threshold change:** route to contributors with **≤ 1 active task** (idle-first, two-tier), instead of idle-only. One config parameter, instantly reversible. (§3)
2. **Operational control (not a rule change):** enforce the intended proposal lifecycle — auto-expire any task in `proposed` for more than **72 h** back to the routable pool. This stops stale-task buildup recurring. (guardrail G4)
3. **Execute the 6 dispositions** in §2 (2 reassign, 2 timeout, 1 reassign+reprice, 1 keep) plus the referenced-task cleanups in §2.3.

Safety assessment and overload guardrails are in §4. Metrics and a rollback trigger are in §5.

---

## 1. Problem statement

Two compounding failures, both evidenced in the task payload:

- **Eligibility starvation.** Routing requires `active_tasks == 0`. Only 1 of 40 candidates qualifies (operative report, 2026-07-08: "Board capacity: Saturated — 0 eligible candidates available for new routing; only 1 idle eligible contributor detected"). Every new task funnels to a single operator; if that operator is busy or refuses, the task strands.
- **No proposal expiry in practice.** Tasks routed 8–12 days ago (nearly two weeks for the oldest) still sit in `proposed`, holding their reward budget and their assignee slot. The board's own project document lists tasks "in proposed since June 27" with "no code fix submitted for any blocker" and states project status: **Stalled**.

One terminology note: the operative report says both "0 eligible candidates available for new routing" and "only 1 idle eligible contributor detected." These are consistent — *idle* is the concurrency test, *eligible* is idle **plus** badge / work-type / board filters. The sole idle contributor does not clear the remaining filters for every task, so effective eligibility rounds to zero. Both figures describe the same starved pool.

The failure is circular: the tasks that would fix routing are themselves stuck in `proposed` and cannot be worked. Contributors notice — @jjj (Expert, pipeline/workflow, score 83) in Hive chat, 2026-07-08: "why does it take so long to get tasks?"

---

## 2. Stale proposed task inventory & dispositions

**Staleness rule used:** a task is *stale* if it has been in `proposed` with no state change for **> 72 h**. (Fresh network tasks carry ~24 h accept-by windows — e.g. this task's own accept-by was 24 h — so 72 h is already 3× the intended proposal lifetime.)

### 2.1 Core Product board snapshot (all 6 proposed tasks)

Durations measured from `updatedAt` to snapshot time 2026-07-09 ~08:00 UTC. `updatedAt` is the last recorded state change, so time-in-proposed is **at least** the figure shown; the board project document independently confirms the June 27 proposal dates for `task_04037f0` and `task_90ef962`.

| # | Task | ID | PFT | Assignee | Status | Last update | Stuck (min.) | Disposition |
|---|------|----|-----|----------|--------|-------------|--------------|-------------|
| 1 | Investigate and Fix Hive Tab Concurrent Load Latency | `task_04037f07…17d62b` | 20,000 | grashnuk | proposed | 2026-06-27 01:04 | **12 d 7 h** | **REASSIGN** |
| 2 | Reproduce Task History Loss After Interface Change | `task_90ef9629…72dedb` | 3,000 | snakespartan | proposed | 2026-06-27 02:17 | **12 d 6 h** | **REASSIGN + REPRICE** |
| 3 | Document Review Pipeline QA Findings | `task_b0422b85…50e055e` | 20,000 | local-maxima | proposed | 2026-06-27 19:20 | **11 d 13 h** | **TIMEOUT** |
| 4 | Document Hive Context Isolation UX Issues | `task_cca61079…c0b572` | 15,000 | ligaya | proposed | 2026-06-29 15:42 | **9 d 16 h** | **TIMEOUT** |
| 5 | Create Sybil Verification Payload From Prior Findings | `task_3c803fb4…be6c6d1` | 20,000 | kenobidesigns | proposed | 2026-06-30 22:44 | **8 d 9 h** | **REASSIGN** |
| 6 | Publish an X Thread Explaining How Post Fiat Works | `task_f40fc481…4996ae1` | 18,000 | gmoney | proposed | 2026-07-09 04:23 | ~4 h | **KEEP** (not stale) |

**Stale total: 78,000 PFT** across tasks 1–5.

### 2.2 Disposition rationale (per task)

1. **`task_04037f0` — Hive tab latency — REASSIGN, 48 h accept-by.** The board project document's next-actions list it first, calling it "the highest-impact blocker affecting all operators" (verbatim). grashnuk (Core Contributor via wallet authorization, no GitHub handle on file) has not accepted in 12 days. Do not cancel — the work is critical. Re-route to a GitHub-verified Core Contributor (donravle or goodalexander) with an enforced 48 h accept-by.
2. **`task_90ef9629` — Task history loss repro — REASSIGN + REPRICE, 48 h accept-by.** Confirmed blocker with unknown root cause, priced at 3,000 PFT — the lowest reward on the board for diagnostic work of unbounded scope, a plausible reason it has no taker. Re-route to an active QA Worker (solarnius holds the badge) at a reward consistent with peer diagnostic tasks, or fold into a combined QA sweep.
3. **`task_b0422b85` — Review pipeline QA findings — TIMEOUT.** Judgment call, not a packet fact: this is documentation output not tied to any confirmed blocker, so expiring it carries low risk. Expire to the routable pool; it will route naturally once §3 lands.
4. **`task_cca61079` — Hive context isolation UX — TIMEOUT.** Same judgment as #3: real but non-blocking documentation; expire and let the fixed router place it.
5. **`task_3c803fb4` — Sybil verification payload — REASSIGN, 48 h accept-by.** Depends on "prior findings," so it should sit with an operator who has reward-integrity context. If kenobidesigns does not accept within 48 h, re-route to an operator with a sybil/reward-integrity track record. (Disclosure: the author does sybil-analytics work and could take this; flagging the interest rather than recommending self-assignment.)
6. **`task_f40fc481` — X thread (gmoney) — KEEP.** Proposed <1 day before the snapshot; inside any reasonable accept window. Monitor; auto-expiry (G4) handles it at 72 h.

### 2.3 Stale tasks referenced by the board's project document — informational, not acceptance-critical

The required inventory for this task is §2.1 (the routing snapshot). The items below appear only in the board's project document, are single-sourced, and are **not** part of the acceptance-critical inventory — verify each against the live board before acting. Confidence: moderate.

| Task | ID | Stated state | Disposition |
|------|----|--------------|-------------|
| Mobile scroll cutoff reproduction | `task_d37c6b16…` | proposed since Jun 26 (13+ d) | **TIMEOUT**, re-route to QA Worker |
| Taskgen hallucination expert review | `task_5a20810a…` | proposed, high-severity (flagged by @wizbubba) | **REASSIGN**; if georgl0nggamma cannot accept, route to jjj (Expert, pipeline/workflow, 83) |
| Taskgen hallucination expert review (2nd) | `task_14557de2…` | proposed, high-severity | **REASSIGN** (same handling; consider merging the two into one review task) |
| Task-state sync reproduction | `task_c384768b…` | proposed; issue confirmed by @hit0ri | **KEEP + ESCALATE** acceptance — the companion spec task (`task_9bd536d8`, jjj) is already accepted |
| Badge onboarding batch | ~20 tasks @ 100 PFT | proposed since Jun 25 (14+ d) | **CANCEL in bulk**; regenerate on demand. ~2,000 PFT total, pure routing noise |

---

## 3. Threshold recommendation (one concrete change)

**Change the routing eligibility rule from `active_tasks == 0` to `active_tasks <= 1`, implemented as a two-tier preference:**

- **Tier 1 (unchanged):** idle candidates (`active_tasks == 0`) are always offered first.
- **Tier 2 (new):** candidates with exactly one active task become eligible **only when the board has zero idle candidates**.

This is the **only routing-rule change requested** — deliberately the smallest change that unblocks routing: one comparison in the eligibility predicate, no changes to scoring, badges, rewards, or verification. The proposal-expiry discipline referenced throughout (auto-expire `proposed` > 72 h) is an **operational control** (guardrail G4) enforcing the lifecycle the ~24 h accept-by windows already imply; it is not a second rule change.

---

## 4. Safety assessment & overload guardrails

### Why the change is safe

- **Routing is an offer, not an assignment.** A routed task enters `proposed` and still requires explicit acceptance; contributors can refuse (refusals are already tracked in operator task-state). Tier 2 expands who *receives offers*, not anyone's committed workload.
- **The quality gate is untouched.** Verification remains manual/mixed per task; badge reward caps and allowed-work-types still bound what any contributor can take.
- **Concurrency stays bounded.** With the ≤1 rule and guardrail G1, no contributor can ever hold more than 2 active tasks — at most 2× today's intended per-contributor load, and only for contributors who explicitly accept a second task.
- **It is instantly reversible.** One parameter; revert restores today's behavior exactly (guardrail G7).

### Guardrails

- **G1 — Hard cap.** Never route to a candidate with ≥ 2 active tasks, regardless of pool state.
- **G2 — Idle-first ordering.** Tier 2 activates only at zero idle candidates; the moment an idle candidate exists, routing prefers them.
- **G3 — One outstanding offer per contributor.** A candidate with a pending `proposed` task receives no further offers until it resolves.
- **G4 — Proposal expiry.** `proposed` > 72 h auto-expires to the pool (founder-priority tasks may use 24 h). Without this, any threshold change eventually re-clogs — expiry is what makes the system self-healing.
- **G5 — Progress filter for tier 2.** Exclude candidates whose single active task is overdue or stalled; a second offer goes only to contributors in good standing on their first.
- **G6 — Instrumentation before/after.** Record acceptance rate, median time-in-proposed, and per-contributor WIP distribution for 7 days pre/post change. The payload does not include the per-contributor active-task distribution, so the exact tier-2 pool size is unknown in advance (bounded: > 1, ≤ 40); measure it on day one rather than assuming it.
- **G7 — Rollback trigger.** Revert the threshold if, over any 3 consecutive days: acceptance rate drops > 20% relative to baseline, **or** median time-to-accept exceeds 48 h, **or** > 25% of tier-2 acceptances become overdue.
- **G8 — Anti-concentration cap.** No contributor receives more than one tier-2 offer per rolling 7 days unless every other eligible tier-2 candidate has already been tried. This directly counters the strongest plausible failure mode: tier 2 funneling all overflow to the same few strong contributors.

### Residual risks (stated, not hidden)

- **Concentration:** tier 2 may repeatedly offer to the same few strong contributors. G8 caps it directly, G3 + G5 dampen it, and the WIP distribution metric (G6) detects any residue.
- **Quality dilution:** second-task work could be slower. Verification remains manual, so degradation shows up as verification failures — visible, not silent.
- **Unknown pool math:** with 40 candidates and 30 active tasks but only 1 idle, the packet's numbers imply either concentrated multi-task holders or eligibility filters beyond idleness (badges/work-type). Either way tier 2 strictly enlarges the pool and G1 bounds the downside; G6 measures the true effect.

---

## 5. Founder action checklist (~15 minutes)

1. Approve the `active_tasks <= 1` two-tier rule (§3) — single config change.
2. Enable 72 h auto-expiry for `proposed` (G4 — operational control, not a rule change).
3. Execute dispositions 1–5 from §2.1 (2 reassign, 2 timeout, 1 reassign+reprice).
4. Verify §2.3 items against the live board; bulk-cancel the badge-onboarding batch.
5. Escalate the four confirmed blockers for immediate re-route: `task_04037f0` (Hive latency), `task_5a20810a`/`task_14557de2` (taskgen hallucination), `task_c384768b` (state sync repro).
6. Watch the G6 metrics for 7 days; apply the G7 rollback rule mechanically.

### 5.1 Operator command table (executable form of §2.1)

| Task ID | Action | New assignee class | Accept-by | Rollback if wrong |
|---------|--------|--------------------|-----------|-------------------|
| `task_04037f07…17d62b` | Re-route | GitHub-verified Core Contributor (donravle / goodalexander) | +48 h | Restore to grashnuk |
| `task_90ef9629…72dedb` | Re-route + reprice | QA Worker (solarnius) | +48 h | Restore at original 3,000 PFT |
| `task_b0422b85…50e055e` | Expire to pool | — (router places post-§3) | — | Re-propose to local-maxima |
| `task_cca61079…c0b572` | Expire to pool | — (router places post-§3) | — | Re-propose to ligaya |
| `task_3c803fb4…be6c6d1` | Re-route if unaccepted in 48 h | Operator with reward-integrity context | +48 h | Restore to kenobidesigns |
| `task_f40fc481…4996ae1` | None (keep) | gmoney | G4 expiry applies | — |

### 5.2 72-hour post-change audit (run once, day 3)

A single report proves the change is behaving. Count, from routing logs: (a) `proposed` tasks older than 24 h / 48 h / 72 h (should trend to zero at the 72 h bucket); (b) tier-2 offers sent, and to how many distinct contributors (G8 check); (c) tier-2 acceptance rate vs tier-1 baseline; (d) tier-2 acceptances that have gone overdue (feeds the G7 > 25% trigger). If (a) is non-zero at 72 h, expiry is not enforcing; if (b) shows one contributor dominating, G8 is not enforcing.

**Expected effect:** eligible routing pool grows from 1 candidate to every contributor with ≤ 1 active task **who also passes the existing badge / work-type / board eligibility filters** (measured on day one per G6); 78,000 PFT of stale board budget released or re-routed; proposal lifetime capped at 72 h so the stall cannot silently rebuild.

---

## 6. Data sources & evidence gaps

**Sources (all from the signed task payload, snapshot 2026-07-09):** Core Product board routing packet (8 tasks); board project document; operative report 2026-07-08; development report 2026-07-08; QA report 2026-07-08; executive brief 2026-07-08.

**Gaps, stated explicitly:** (a) `updatedAt` is a lower bound on time-in-proposed; two of five dates are independently corroborated by the project document. (b) Per-contributor active-task distribution is absent from the packet — tier-2 pool size is therefore instrumented (G6), not asserted. (c) §2.3 items are single-sourced from the project document and must be checked against the live board. (d) The hive reports note their source packet was partially truncated; this plan relies only on fields present, and flags inference where used.

**Machine-readable dispositions:** [`disposals.csv`](./disposals.csv) in this directory.

---

*Prepared by zoz for task `task_17994866ddfe34db49f31cae36c48f00` (Task Node Core Product). Review and routing-constraint approval: @goodalexander.*
