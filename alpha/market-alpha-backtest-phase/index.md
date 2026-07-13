# Market Alpha Board — Backtesting Execution Phase

**Task:** `task_ee1dc5ae7e4e43fb1e24ded905c90438` · Market Alpha Tasks board (`market_alpha_tasks`)
**Author:** zoz (`zozDOTeth`) · Project Leader badge · **Date:** 2026-07-13
**Decision owner:** @goodalexander · **Board state:** 0 tasks in flight, 6 contributors, all spec work terminal · **D0** below = first routing day (assumed 2026-07-14; this document dated 2026-07-13)

---

## 0. Executive summary

The board has paid for specifications and run **zero backtests** — investment at risk of producing nothing. This document turns the delivered specs into an execution phase: a readiness-assessed inventory (§1), **four concrete backtesting execution tasks** with data sources and quantitative pass/fail metrics (§2), a mapping of verified operators to each (§3), a 30-day sequenced timeline with weekly gates (§4), and a first-batch routing recommendation for @goodalexander (§5). Two of the four tasks are free-data and routable **today**; one needs a small data-budget decision; one is the standing harness that makes every future experiment cheap to validate.

## 1. Spec inventory & backtesting-readiness assessment

**What the routing packet verifiably shows:** 7 rewarded specification tasks totaling **122,000 PFT** (table below). The task description states "12 completed specification tasks / 274,000 PFT" — the likely reconciliation is that the two "Draft Three…" bundles unpack into 6 experiments (7 tasks ≈ 12 specifications), but the PFT delta is **not verifiable from the packet**; the founder can confirm against the board's full rewarded tab in seconds. **Inventory completeness is therefore constrained:** all 7 packet-visible specs are assessed below; any specs beyond them are UNASSESSED until enumerated — the same readiness taxonomy and the mandatory spec-conformance check apply to them at routing time, and batch-2 routing (§4 W4) should not proceed until the full list is attached (§6).

**Assessment method, stated plainly:** the packet carries titles, authors, rewards, and dates — not the spec documents themselves. Readiness below is assessed from deliverable type and board metadata; each execution task in §2 therefore begins with a 1-hour **spec-conformance check** against jjj's backtesting framework before any code runs (kill early if a spec is thinner than its title).

| # | Spec (task) | Author | PFT | Readiness | Why |
|---|---|---|---|---|---|
| S1 | Design Backtesting Execution Framework for Alpha Experiment Validation | jjj | 16,000 | **ENABLER — READY** | Defines *how* every backtest runs; consumed by EX-3 |
| S2 | Specify Historical Market Data Sources for Alpha Experiment Backtesting | jjj | 20,000 | **ENABLER — READY** | Data catalog; feeds all EX tasks |
| S3 | Design Production-Ready Public Equities Mean-Reversion Alpha Experiment Specification | jjj | 16,000 | **READY** | "Production-ready" spec + free daily equities data ⇒ backtestable now (EX-1) |
| S4 | Design Production-Ready Crypto Options Volatility Alpha Experiment Specification | georgl0nggamma | 10,000 | **DATA-GATED** | Spec ready; crypto-options history is a paid/procured source (EX-2) |
| S5 | Draft Three Market Alpha Experiment Briefs | sora | 20,000 | **PARAM-GATED** | Briefs typically under-specify entry/exit/sizing; triage via EX-3 |
| S6 | Draft Three New Market Alpha Experiments | yuuki | 20,000 | **PARAM-GATED** | Same treatment as S5 |
| S7 | Define Market Alpha Production Pipeline and Work Breakdown | diamond-hand-honcho | 20,000 | **ENABLER — READY** | Process doc; governs sequencing, not itself backtestable |

Net: **1 experiment backtestable immediately** (S3), **1 data-gated** (S4 — one procurement decision away), **6 triageable** (S5+S6), **3 enablers already delivered** — the board is not short on specs; it is short on execution.

## 2. Backtesting execution tasks (route-ready definitions)

Common to all: reproducible repo (pinned deps, one-command run), results as machine-readable JSON + tearsheet, **costs always on** (fees + slippage model documented), walk-forward splits fixed *before* running (train 2015–2021 / validate 2022–2023 / test 2024–2026 for equities; 2021–2024 / 2025 / 2026 for crypto), and a negative control (shuffled-entry test must destroy the edge; if it doesn't, the harness is leaking). Thresholds below are **proposed defaults with stated rationale** — adjust once, then apply mechanically. Rationale: for daily-frequency equities strategies, net Sharpe 1.0 over a multi-year test split is a demanding but reachable bar, while below 0.5 the result is statistically hard to distinguish from noise at these trade counts; hit rate ≥ 52% fits mean-reversion specifically (short holds, many trades — edge expresses through hit rate, not skew); DD caps (15%/20%) are sizing-survivability bounds for a paper-then-live path. Options strategies carry negative skew, hence the higher Sharpe bar, wider DD allowance, and mandatory stress slices. **All pass gates are additionally relative to a null:** the strategy must beat its shuffled-entry control decisively — clearing an absolute Sharpe while the control also 'works' means the harness leaks, not that the edge is real.

**EX-1 — Backtest the equities mean-reversion spec (S3).** ~20,000 PFT
Data: free daily OHLCV (Yahoo Finance/Stooq, 10+ years). **Survivorship bias rule (hard):** a PROMOTE verdict requires point-in-time universe membership (Norgate/Sharadar-class or equivalent); results on a persistent large-cap universe are capped at REVISE and must carry a bias-severity flag (mean-reversion on survivors materially overstates edge). Quick-pass triage may use the persistent universe; promotion may not.
Pass/fail: net Sharpe ≥ 1.0 on test split (reject < 0.5), hit rate ≥ 52%, max drawdown ≤ 15%, ≥ 200 trades across splits, costs 10 bps/side + slippage; verdict = PROMOTE / REVISE / KILL with numbers attached.

**EX-2 — Backtest the crypto options volatility spec (S4).** ~25,000 PFT (includes data procurement)
Data: Deribit historical options via Tardis.dev or equivalent (paid — order-of-magnitude estimate $100–300 for the needed window, to be confirmed at procurement) **or** Deribit's own API (shorter history) + DVOL index; source choice documented with coverage dates. This is the one **founder decision** blocking routing (§5).
Pass/fail: net Sharpe ≥ 1.2 (vol-selling strategies must clear a higher bar for tail risk), max drawdown ≤ 20%, hit rate reported per regime (calm/stressed via DVOL terciles), vega-normalized PnL, ≥ 100 trades or ≥ 24 months coverage; mandatory stress slice: the worst 3 DVOL spikes in window.

**EX-3 — Stand up the validation harness + triage the six briefs (S1 + S5 + S6).** ~20,000 PFT
Build jjj's framework (S1) into a runnable harness: results schema, cost model plug-ins, split manager, negative controls, one-command experiment onboarding. Then run all six S5/S6 briefs through **param-completion → quick-pass backtest** (coarse grid, free data): each brief exits with PROMOTE (route as full EX task) / REVISE (named gaps back to author) / KILL (documented quick-pass Sharpe/DD).
Pass/fail for the harness itself: EX-1 reproduced end-to-end inside it; negative control flips EX-1 to no-edge; a new experiment onboards in < 1 day.

**EX-4 — Forward validation of the first PROMOTE.** ~10,000 PFT (route in week 4)
30-day paper-trade of the best PROMOTE from EX-1/2/3 with daily marks against the backtest's expectancy; divergence beyond 2σ triggers review. Turns a backtest into evidence the board can actually act on.

## 3. Operator skill mapping

**Verified execution operators** (badge/score facts from the routing packet):

| Operator | Verification | Fit |
|---|---|---|
| **jjj** | Expert, pipeline/workflow engineering, score 83; authored S1/S2/S3; explicitly idle and asking for work in Hive chat | **EX-1 and/or EX-3** (first pick — author-executes is the cheapest handoff) |
| **georgl0nggamma** | Expert, crypto options trading, score 86; authored S4 | **EX-2** (author-executes; check load — has other proposed reviews pending) |
| **zoz** (author) | Verified Project Leader + QA Worker badges; execution evidence is a live daily backtest/paper-book pipeline (walk-forward, cost models, yfinance signal layer) operated off-network — disclosed as practice, not a packet-scored expert badge | **EX-3** candidate; under a strict badge-evidence standard, prefer jjj as EX-3 primary (see §5) |
| **walkonwayvs** | Expert score 95 (infra/monitoring/verification) + QA Worker | **Reproducibility QA**: re-run EX-1/EX-2 from the repo, confirm numbers match JSON before reward |
| **6021023m** | Expert score 95 (quantum computing), newly verified, actively requesting alpha tasks | EX-3 param-completion support — matches their stated ask; onboarding win for the network |

**Context owners (not routed as executors):** sora and yuuki are the S5/S6 brief authors — they own the REVISE loop for their own briefs out of EX-3 triage but are not mapped to execution tasks (no expert-badge evidence in the packet). Reviewer of record for all routed work: **goodalexander**.

## 4. 30-day timeline (weekly gates; absolute dates assume D0 = 2026-07-14, shift 1:1 if routing slips)

- **W1 (Jul 14–20):** Route EX-1 (jjj) + EX-3 (zoz or jjj) — both free-data, no procurement. Founder decides EX-2 data budget. Gate: both accepted within 72 h (else re-route per the network's standard expiry discipline); spec-conformance checks passed.
- **W2 (Jul 21–27):** EX-1 running; EX-3 harness reproduces EX-1 + starts brief triage; EX-2 data procured, task routed to georgl0nggamma. Gate: EX-1 preliminary results exist; ≥ 3 briefs triaged.
- **W3 (Jul 28–Aug 3):** EX-1 final results + walkonwayvs reproducibility QA; remaining briefs triaged with verdicts; EX-2 running. Gate: EX-1 verdict issued (PROMOTE/REVISE/KILL, numbers attached); ≥ 1 brief PROMOTED or explicitly all-killed with evidence.
- **W4 (Aug 4–12):** EX-2 results + QA; route EX-4 for the best PROMOTE; board review — publish a one-page phase retro (what was promoted/killed, spend vs. verdicts) and define batch 2 or wind down with evidence in hand. Gate: every routed EX task has a verdict or a dated blocker.

## 5. Handoff note — @goodalexander

**Route today (no dependencies):** EX-1 → **jjj** (primary; author of the spec and the framework). EX-3 → your call on the standard: **jjj** if you weight packet-verified expert scoring (then zoz takes reproducibility QA with walkonwayvs), **zoz** if you weight demonstrated standing infra (disclosed in §3 as off-network evidence). Name one primary at routing; both are 72h-available. Both free-data; combined ~40,000 PFT against a board whose alternative is zero return on the spec investment.
**One decision needed from you:** EX-2 data budget (~$100–300, Tardis.dev or equivalent) — decide this week so georgl0nggamma can start in W2. If declined, EX-2 falls back to Deribit-API-only history: shorter window, verdict quality documented as reduced.
**Cleanup while you're in there:** the stale June-1 proposed task (`task_8f5e98a1…`) flagged by the board's own QA report — time it out; it predates this phase.
**Verification ask:** attach the full 12-spec rewarded list to this phase doc (packet showed 7 tasks / 122k of the claimed 274k — §1); the framework applies to the rest unchanged.
**Success definition for the phase:** by D30, at least two experiments carry evidence-backed verdicts and one PROMOTE is in forward validation — or the board winds down having converted its spend into documented kills, which is also a return.

## 6. Sources & evidence gaps

**Sources:** signed routing packet (board packet with 7 rewarded spec tasks incl. IDs withheld here for brevity but present in the packet; operative/executive/QA hive reports 2026-07-11/12 for operator badges, scores, and chat evidence); author's own production backtest practice for cost/split/negative-control defaults.
**Gaps:** (a) spec *contents* are not in the packet — mitigated by the mandatory spec-conformance check in every EX task; (b) "12 specs / 274,000 PFT" is packet-verifiable only as 7 tasks / 122,000 PFT — likely experiment-unpacking, founder to confirm; (c) all §2 thresholds are proposed defaults, labeled as such, for one-time founder adjustment; (d) operator load beyond the packet (e.g., georgl0nggamma's pending reviews) should be re-checked at routing time.

---
*Prepared by zoz for `task_ee1dc5ae7e4e43fb1e24ded905c90438`. First-batch routing decision requested: @goodalexander (§5).*
