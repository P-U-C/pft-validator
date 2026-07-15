# Reward Integrity — Bounded Closure Plan (from Two Completed Audits)

**Task:** `task_bfea6cf0b55abfd451214104a7d79cf6` · **Author:** zoz (`zozDOTeth`) · Project Leader badge · **Date:** 2026-07-15
**Decision owner:** @goodalexander — §3 is written so every action is approve/assign/close, **no further diagnostics required**
**Inputs cross-referenced:** [jjj's audit](https://gist.github.com/JustOscar/fd2e45b76778a5c63e80b31c8823980c) (`task_6ad9dc08`, rewarded) · [walkonwayvs's audit](https://github.com/walkonwayvs/pft-qa-reports/blob/main/reports/2026-07-15-reward-integrity-backlog-audit.md) (`task_ef271685`, rewarded) · this author's chain-verified [Reward Integrity closeout](https://github.com/P-U-C/pft-validator/blob/main/alpha/reward-integrity-closeout/index.md) (rewarded) — local XRPL index re-checked **today 15:35 UTC**

---

## 0. Executive summary

Both audits, independently, reach the same verdict this board's own closeout reached on 07-11: **the diagnostic era is over; only execution remains.** The network spent 2,000,000+ PFT (board-stated; caveat §4) investigating a 153,002.5 PFT leak for which — chain-re-verified today — **no recovery has been observed to the labeled Treasury** (an off-label destination remains possible and takes the founder seconds to confirm; §4d). This plan converts the audits' findings into seven dispositions (§2): **three remediate-now actions** (recover-or-waive the 153K; force-archive two ghost tasks; route ONE bounded implementation task), **two closures with no action**, **two bounded verifications**, under a total forward spend cap of **≤ 30,000 PFT** and an explicit stop condition (§3) that ends reward-integrity meta-work permanently.

## 1. Cross-reference: what the two audits found, where they agree, where they diverge

**Agreements (strong — independent methods, same conclusions):**
- **Stop meta-auditing.** jjj: "All meta-auditing must cease immediately… No subsequent audits should be authorized." walkonwayvs: the only live reward-integrity spend is the two overlapping audits themselves.
- **The audits were redundant with each other** — near-identical scope, routed to two operators (both now rewarded; the 15,000 PFT saving walkonwayvs identified was not realized — see F-5).
- **Shift exclusively to code implementation** — jjj names the exact mechanism: idempotency keys in the payment engine, per the already-rewarded prevention framework (`task_922ee220`).

**Divergences and resolutions:**
| Point | jjj | walkonwayvs | Resolution |
|---|---|---|---|
| Leak figure | 153,002.5 PFT / 13 incidents (scanner-derived) | "150,000 PFT issue" (round) | **Use 153,002.5** — scanner-derived, incident-enumerated |
| 2M+ overspend | Stated as confirmed circular (founder/zoz comments) | Explicitly flagged "stated by the board; not independently verifiable" | Carry strictly as board-attested (walkonwayvs's framing) — the figure bounds nothing forward in this plan (§4) |
| `task_085cf059` / `task_45ca9940` | Open ghosts on inactive `reward_integrity_sybil_defense` board, "risking accidental allocation" | Not in his four archived boards (113K/7 tasks, closed 13–14 Jul) | **Consistent, and decisive:** the sybil-defense board is NOT among the archived four → the ghosts are live residue → F-3 force-archive |
| Archived-tier visibility | — | Archived task cards not openable in operator view (documented limitation) | Real product defect; folded into F-6, not new board work |

**Third-source additions (this author, independently verifiable):** the 153,002.5 recovery has produced **zero payments > 100 PFT into the labeled Treasury since 2026-06-15** (local full-history XRPL index, current to 2026-07-15 15:35 UTC); recovery/adjustment tooling is **already built and rewarded** (clawback execution `task_537fcfb`, reward-adjustment `task_20b7f7d`), with the prevention spec V3 (`task_715ea1e`) and remediation plan (`task_fdbeddf`) as rewarded supporting artifacts — per the closure ledger attached to the closeout.

## 2. Action table (every retained finding, classified and bounded)

| # | Finding | Class | Owner | Amount / scope | Evidence ref | Next action | Completion test | Spend cap |
|---|---|---|---|---|---|---|---|---|
| F-1 | 153,002.5 PFT duplicate payments unrecovered (13 incidents) | **REMEDIATE NOW** | goodalexander (or named delegate) | 153,002.5 PFT recoverable | jjj §1; chain check 07-15 (zero recovery to labeled Treasury); closeout §4 | Execute the delivered clawback/adjustment scripts against the documented incident set, **or record a written waiver with reasons** | Recovery tx(s) visible on-chain to the intended destination, or waiver recorded on the board | **0 new PFT** (tooling delivered & paid) |
| F-2 | 2M+ PFT meta-spend ROI deficit (~13x) | **CLOSE, no action** | goodalexander (closure owner) | Historical spend; not targeted for recovery by this plan | Both audits; board status text (attested, §4) | None — the remedy is F-5/stop condition, not recovery | No new audit/meta task routed (see stop condition) | 0 |
| F-3 | Ghost tasks `task_085cf059`, `task_45ca9940` on the un-archived sybil-defense board | **REMEDIATE NOW** | goodalexander | 2 tasks, 44,000 PFT in stale offers | jjj §2/§3-P1; absent from walkonwayvs's archived list; closeout §2 dispositions | Force-archive both + the board | Both terminal; board absent from live feeds; **no outstanding allocatable or rewardable offer remains on either task (the 44K is confirmed nonpayable)**; no reward-integrity board remains active | 0 |
| F-4 | Rewarded prevention work has **no downstream implementation** — proven by jjj's audit for `task_922ee220` (framework) and `task_02fc223d` (triage); prevention spec V3 and the remediation plan are supporting artifacts for the same control | **REMEDIATE NOW** | donravle (implementation; core contributor w/ GitHub) — goodalexander fallback per the guardrails-handoff ladder | One bounded code task: idempotency keys + duplicate-payment gate in the payment engine | jjj §3-P3; guardrails handoff + eligibility spec (same PR chain) | Route ONE implementation task scoped to the rewarded framework — composes with donravle's existing guardrails chain | Control merged; **negative-control replay: the 13 documented incidents re-run against the patched engine → all blocked**; monthly negative-control scheduled | **≤ 30,000 PFT** (badge cap; the ONLY new spend in this plan) |
| F-5 | The two meta-audits themselves (30,000 PFT, both rewarded) | **CLOSE, no action** | goodalexander (closure owner) | Spend already terminal | Board packet; both audit docs | Their value is consumed by this plan; route zero further audits | Stop condition holds for 30 days | 0 |
| F-6 | Archived-board task cards unopenable in operator view | **BOUNDED VERIFICATION** | Core Product board (existing visibility work, eligibility-spec I-4 class) | Product defect, not integrity spend | walkonwayvs §5 | Fold into the existing Core Product task-feed transparency item (the QA-reported retrieval-ambiguity class, already specified as frontend visibility work in the routing-eligibility spec §3.2) — no new reward-integrity task | Defect ticketed on Core Product; archived-tier audits become possible in operator view | 0 (existing lane) |
| F-7 | Archived tier (4 boards / 7 tasks / 113,000 PFT) reported at board level only — live obligations unverified | **BOUNDED VERIFICATION** | goodalexander (admin view) | 15 founder-minutes, once | walkonwayvs §1-B + limitation note | One admin-view pass confirming the 4 archived boards hold no live obligations | Confirmation recorded on the board; F-7 never recurs | 0 |

**Total forward spend authorized by this plan: ≤ 30,000 PFT (F-4 only).** Everything else is founder minutes and archive clicks.

## 3. Board-closure recommendation

1. **Approve the table above as-is** (or amend a row with reasons on the board — every row is independently actionable).
2. **The 153K path (F-1) is a decision, not a project:** execute-or-waive, recorded either way. Execution is scripts-already-paid-for; waiver is one paragraph. Silence is the only unacceptable state — it is how a known liability became a 2M+ PFT hole.
3. **Prevention control (F-4)** is the single funded item: idempotency keys per the rewarded framework, wired into the same PR chain as the taskgen guardrails and eligibility predicate (one implementer, one review path, three rewarded specs).
4. **Close the boards:** force-archive sybil-defense (F-3); this Network Validation board closes **on approval — meaning plan accepted and every remediate-now row assigned with an owner**, not on remediation completion (F-1/F-4 execute from their owners' queues, not from an open board); the four archived boards stay closed (F-7 confirms).
5. **Stop condition (explicit, as required):** upon approval, **no reward-integrity audit, triage, scoping, meta-review, or planning task may be routed** unless the duplicate-payment monitor or Lens anomaly rules emit a NEW signal exceeding 10,000 PFT (the closeout's reopen trigger), or the F-4 negative-control replay fails. Any such task proposed without a triggering signal is refused by policy, citing this plan. Investigation of the *historical* incident set is **over** — 2,000,000+ PFT of it is enough.

**Unresolved risks, stated:** (a) recovery may prove technically or politically infeasible — the waiver path exists precisely so infeasibility gets recorded instead of festering; (b) the F-4 implementation could stall on the two-person core bench — the guardrails handoff's fallback ladder governs; (c) the 2M figure is board-attested, not independently audited — deliberately irrelevant to forward actions, which depend only on the verified 153K and the verified zero-recovery state.

## 4. Sources & evidence gaps

**Sources:** both audit documents in full (fetched 2026-07-15, archived alongside this plan's audit trail); signed routing packet (board packet confirming both audits rewarded; hive reports); local XRPL chain index (payments table, full history, re-queried 2026-07-15 15:35 UTC); this author's rewarded closeout + closure ledger for tooling/deliverable citations.
**Gaps:** (a) the 2M+ overspend is board-status-attested — both audits and this plan carry it with that caveat; it bounds nothing forward; (b) archived-tier task detail is operator-invisible (F-6/F-7 exist to close that gap with zero spend); (c) `task_922ee220`/`task_02fc223d` contents are cited from jjj's audit — donravle should pull both rewarded artifacts when scoping F-4; (d) the labeled-Treasury caveat from the closeout still applies: if recovery was routed to a different destination, F-1's chain check misses it — the founder confirms the intended destination in seconds at decision time.

---
*Prepared by zoz for `task_bfea6cf0b55abfd451214104a7d79cf6`. Approve/assign/close: @goodalexander (§3).*
