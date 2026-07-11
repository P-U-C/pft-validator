# Reward Integrity Board — Open-Task Triage & Closeout Decision

**Task:** `task_62aaf38dfdda86543ecc72f324c5c195` · Reward Integrity and Network Verification board (`reward_integrity_sybil_defense`)
**Author:** zoz (`zozDOTeth`) · Project Leader badge · author of 16 rewarded deliverables on this board
**Date:** 2026-07-11 · Snapshot: task payload ~22:30 UTC + local XRPL chain index (current to 21:29 UTC)
**Decision owner:** @goodalexander

---

## 0. Executive summary

**Recommendation: CLOSE the board** — the evidence supports goodalexander's read ("basically already done") — **but only via the sequenced closeout in §6**, because one live dependency must not be orphaned: **the 153,002.5 PFT duplicate-payment recovery has not been executed to the labeled Treasury account** (§4). The board holds **4 open proposed tasks — 2 genuinely stale since June, 2 same-day items**. Dispositions: **cancel 3** (two June tasks are near-duplicates of each other, both superseded by rewarded work; one July task re-generates a deliverable that already exists), **keep 1** (wallet-graph update — the only live, non-duplicated item), resolved either way inside the 72 h closeout window. Replace the open board with **one targeted task** covering the two known detection blind spots (§5).

## 1. Board state (verified from the signed packet)

- Board packet: **4 proposed tasks**, 4 in flight, 26 contributors. Project document (written before the 4th task appeared today): **77 of 80 tasks terminal**, status *stalled*, and Project Leader goodalexander quoted verbatim: "I think this is basically already done so it's not productive to have open as a board anymore."
- Timing nuance, stated plainly: the task description says "4 stale proposed tasks (zero acceptance since June 21–26)." The snapshot supports that fully for the two June tasks (no state change since 2026-06-26). The other two carry 2026-07-11 `updatedAt` stamps — one is a same-day re-generation of already-delivered work (§2.3), one is a same-day re-route of real work (§2.4). Staleness is therefore not uniform, and the dispositions below treat each on its own facts.

## 2. Per-task triage

| Task | Assignee | In proposed | Disposition |
|---|---|---|---|
| `task_2c11d93d` Audit Routing Eligibility Filter and Propose Code Fix (20,000) | donravle | since 2026-06-26 (15+ d) | **CANCEL → REROUTE to Core Product** only if the code fix is still wanted |
| `task_45ca9940` Define Routing Eligibility Diagnostic and Fix Proposal (20,000) | diamond-hand-honcho | since 2026-06-26 (15+ d) | **CANCEL** (near-duplicate of the above) |
| `task_9113656` Map Duplicate Payment Leak Paths and Write Prevention Framework (16,000) | georgl0nggamma | created/re-proposed 2026-07-11 | **CANCEL — deliverable already exists** |
| `task_085cf059` Build XRPL Wallet Graph Update Script (24,000) | nydiokar | touched 2026-07-11 | **KEEP**, 72 h accept-by, resolved before archive (§2.4) |

**2.1 `task_2c11d93d` — CANCEL.** The routing-eligibility need this task was opened for has been overtaken: the *Routing Eligibility Gap Project Proposal* (`task_cf1feb9`, rewarded) and the *Routing Unblock Action Plan* (`task_1799486`, rewarded 2026-07-11, incl. the concrete `active_tasks <= 1` two-tier rule and expiry policy) delivered the diagnostic and the decision framework. What remains is a **code change in the routing engine**, which is Task Node Core Product territory — the engine's other fixes (e.g. the accepted task-state sync spec, `task_9bd536d8`) live there. If maintainers still want the code audit, reopen it **on that board**, scoped to implementing the already-approved threshold policy. Keeping it here keeps a dead board alive.

**2.2 `task_45ca9940` — CANCEL.** "Define Routing Eligibility Diagnostic and Fix Proposal" vs 2.1's "Audit Routing Eligibility Filter and Propose Code Fix": two phrasings of one need, both proposed the same week, both unaccepted for 15+ days, both superseded by the same rewarded work. Cancel outright; nothing to re-scope that 2.1's note doesn't cover.

**2.3 `task_9113656` — CANCEL as duplicate generation.** This board already paid for exactly this deliverable, twice over: the *Duplicate Payment Prevention Specification for V3* (`task_715ea1e`, rewarded) maps leak paths and specifies prevention; the *Duplicate Reward Payment Remediation and Prevention Plan* (`task_fdbeddf`, rewarded) covers remediation and process. A new "map leak paths and write prevention framework" task generated today is a taskgen dedup miss — cancel it and flag the miss to whoever owns taskgen quality (same failure class as the taskgen-hallucination reviews pending on Core Product). **Control recommendation:** taskgen should check new task intents against rewarded-task titles/summaries (exact and semantic) on the same board before proposing — `task_9113656` is live evidence this control is missing.

**2.4 `task_085cf059` — KEEP with a 72 h accept-by, resolved before archive.** The one live, non-duplicated item. Graph freshness is an operational dependency of already-delivered detection tooling (fund-flow graph `task_2ec03c1`, contagion risk `task_2285dae`, behavioral fingerprinting `task_9647b8e` — all rewarded). It was routed to nydiokar today; give it 72 h. Explicit terminal logic so archive orphans nothing: **accepted within 72 h → migrate the task to the maintenance lane/board where §5's work lands and let it finish there; not accepted → one re-route attempt with a further 72 h; still unaccepted → cancel and fold the need into §5's task.** Archive proceeds after this window resolves either way — closure waits at most ~6 days on it, and never indefinitely.

## 3. Has the rewarded work closed the integrity gaps? Mostly yes.

Sixteen rewarded deliverables by this author alone — **~461,500 PFT** of board spend, and a *lower bound* on board output since other contributors' rewarded work is not counted here — cover the pipeline end to end: detection (fund-flow graph, contagion risk, behavioral fingerprinting, event-sequence hashing, validator tier calibration), decisioning (blocklist patches + generator, ban config, auto-quarantine middleware), execution tooling (reward-adjustment script, clawback execution script), process & comms (prevention spec V3, remediation plan, identity-drift binding fix, investigation + clawback Discord messages). This sample alone is sufficient evidence that the board's stated purpose — "make reward eligibility, evidence, duplicate-payment, wallet-drift, badge, and Sybil decisions auditable" — is substantially delivered; the full board record (77/80 terminal) points the same way. What is **not** delivered is in §4 and §5. The full per-deliverable list ships with this document as [`closure-ledger.csv`](./closure-ledger.csv) so the board can be archived without reconstructing context later.

## 4. The 153,002.5 PFT — tooling delivered, recovery not executed to the labeled Treasury

Independently verified against the local XRPL chain index (full payment history, current to 2026-07-11 21:29 UTC): **no payment above 100 PFT has entered the labeled Treasury account since 2026-06-15.** As far as the labeled recovery destination shows, the confirmed 153,002.5 PFT duplicate-payment leakage **has not been recovered**, despite the clawback execution script (`task_537fcfb`), the reward-adjustment script (`task_20b7f7d`), and the drafted clawback announcement (`task_e4b9ac0`) all being rewarded and ready. If recovery was routed to a different account, this check would miss it — the founder can confirm the intended destination in seconds, and §6.3 is written to survive either answer.

**Closing the board without assigning this is how a known 153k PFT liability becomes permanent.** Two distinct bars, so archive is not held hostage: (a) **integrity closeout** — declaring the leakage handled — requires the decision *executed or waived*; (b) **board archive** only requires the decision to be *assigned*: a named owner (founder or delegate) and a date, recorded durably. Execute recovery (run the delivered scripts against the documented duplicate set), waive it with reasons, or assign it with a deadline — any of the three unblocks archive; silence does not.

## 5. Remaining gaps → one targeted task, not an open board

Detection coverage has two **known, documented blind spots**, identified 2026-06-15 during the Lens anomaly-rule work: **value-concentration** (rewards pooling into few sinks under distinct-looking earners) and **reward-velocity** (rate-anomalies that per-event rules miss). Neither requires a standing board — they need **one scoped task**: "Add value-concentration and reward-velocity anomaly rules to the Lens suite" (est. 15,000–20,000 PFT; assignee class: operators with prior Lens deliverables — this author and the QA/analytics contributors on the existing anomaly rules). Optional second line in the same task: a refresh-cadence note for the wallet graph if `task_085cf059` dies in §2.4.

## 6. Board-level recommendation: CLOSE, via this checklist

1. **Cancel** `task_2c11d93d`, `task_45ca9940`, `task_9113656` (§2.1–2.3) — frees 56,000 PFT of open offers. Reroute 2c11d93d's code-fix need to Core Product only if maintainers still want it.
2. **Resolve** `task_085cf059` inside the 72 h (+72 h re-route) window per §2.4 — migrate on acceptance, cancel on double timeout. Archive proceeds after resolution either way.
3. **Assign the 153,002.5 PFT recovery decision** — owner + date recorded durably; execute with the delivered scripts, or waive with reasons (§4). *Assignment (not execution) is the bar that precedes archive; execution or waiver is the bar for calling the leakage closed.*
4. **Open the single Lens blind-spot task** (§5) on whichever board carries maintenance work — no new board needed.
5. **Archive** the Reward Integrity board with the closure ledger attached. **Reopen trigger — proposed thresholds, for goodalexander to adjust:** any new duplicate-payment or Lens anomaly signal exceeding 10,000 PFT, or a failed **monthly negative-control check** (re-run the known duplicate-payment patterns from the `task_715ea1e` spec against the live pipeline and confirm they still alert — detection that silently rots is how the next 153k happens).

## 7. Sources & evidence gaps

**Sources:** signed task payload (board packet, project document incl. goodalexander's verbatim assessment); Task Node rewarded-task records for every deliverable cited by ID; local XRPL chain index for §4 (payment table, verified current to 2026-07-11 21:29 UTC).
**Gaps:** (a) project-document counts (77/80) predate today's 4th proposed task; (b) §4's chain check is against the *labeled* Treasury account — an alternate recovery destination would evade it (stated in-line, handled by §6.3's assignment bar); (c) "zero acceptance since June 21–26" is packet-verified for the two June tasks only — the July timestamps on the other two are stated as observed; (d) rewarded-work inventory counts this author's deliverables only, so §3 *understates* total board output; (e) the §6.5 reopen thresholds are proposed values, not derived from data.

---
*Prepared by zoz for `task_62aaf38dfdda86543ecc72f324c5c195`. Decision requested: @goodalexander executes §6 (or amends dispositions with reasons on the board).*
