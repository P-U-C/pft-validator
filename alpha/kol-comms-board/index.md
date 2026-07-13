# KOL Amplification & Public Communications Board — Definition and Initial Task Sequence

**Task:** `task_054a4c3646501821fc86cf4ed1779f23` · **Author:** zoz (`zozDOTeth`) · Project Leader badge · **Date:** 2026-07-13
**Decision owner:** @goodalexander · **Lineage:** operationalizes the rewarded [KOL Amplification Special Project definition](https://github.com/P-U-C/pft-validator/blob/main/alpha/kol-amplification-project/index.md) (`task_59f228c`) into a standing board
**Roster basis:** KOL Operating Report 2026-07-12 — **11 verified KOLs, 568,266 combined followers** (the task description's 582K figure predates the 07-12 re-verification; solarnius's count moved on 07-12 — the dated report is used throughout, drift flagged here once)

---

## 1. Board scope & desired outcome

**Board:** `kol_amplification_comms` — KOL Amplification & Public Communications. **Type:** standing (cycle-based), not a one-shot project.

**In scope:** (1) KOL amplification tasks — threads, posts, quote-reposts on X by badge-verified KOLs; (2) network public communications — ship announcements and a recurring "shipped this week" digest sourced from actually-rewarded network tasks; (3) KOL enablement operations — identity/wallet resolution, content kits, baseline metric capture; (4) attention measurement and per-cycle reporting.
**Out of scope, explicitly:** development work (Core Product board), paid advertising, posting from network-owned accounts (founder-controlled), and any direct off-platform contact of operators by other operators — engagement here happens through routed tasks and public Discord announcements only.

**Desired outcome:** convert the network's largest idle asset — 568K verified follower reach with **zero public amplification artifacts on record** — into a measured attention-to-adoption funnel: impressions → profile visits/follows → Task Node signups and badge verifications. Today the funnel does not exist: the packet's own KOL report calls the missing output "a significant evidence gap," and exactly **one** KOL task is active anywhere (gmoney's accepted X-thread explainer, 18,000 PFT, on the Core Product board — §3 adopts it rather than duplicating it).

## 2. Success metrics (proposed defaults — adjust once at launch, then apply mechanically)

**Per cycle (30 days):**
- ≥ 8 published amplification artifacts (links on record as task evidence)
- ≥ 500,000 cumulative impressions, with per-artifact minimums by tier (T1 ≥ 100K, T2 ≥ 15K, T3 ≥ 2K — tiers per the rewarded cycle-1 definition)
- Engagement rate ≥ 1% (engagements/impressions, per artifact, reported not gated)

**Tied to PFT adoption (the metrics that matter):**
- New Task Node signups and badge verifications per cycle vs. a **pre-cycle baseline captured before the first artifact posts** (baseline capture is a routed task, §3 B-7 — lift is unmeasurable without it). **Numeric gates:** cycle 1 passes by capturing the baseline and showing any positive lift (no baseline exists today, so cycle-1 gates would be fiction); cycle 2+ pass/fail: **≥ 15% lift** in signups+badge verifications and **≥ 10% lift** in Discord joins vs. trailing baseline
- **Concentration-risk reporting:** every cycle reports results both including and excluding gmoney + goodalexander (~80% of reach) — a cycle that only works through two accounts is a dependency, not a distribution
- Cost efficiency: PFT paid per 1,000 impressions — **proposed ceiling 50 PFT/1K, provisional**: the 18K precedent at 318K followers implies ~36 PFT/1K *if* ~50% of followers see the thread — an optimistic view rate for X; at a conservative 20% it is ~90 PFT/1K. Set the real ceiling after B-7's first report replaces assumptions with measured impressions

**Board health:** ≥ 60% of routed tasks accepted within 72 h (auto-expiry per the network's routing discipline); ≥ 70% of accepting KOLs deliver; per-KOL delivery feeds performance re-tiering at cycle end (mechanism already defined in the cycle-1 doc).

## 3. Initial task sequence (8 items, reward bands anchored to the live 18K precedent)

| # | Task | Assignee (suggested) | Band (PFT) | Depends on |
|---|---|---|---|---|
| B-1 | **KOL identity & wallet resolution sprint** — resolve 2 unattributable accounts (10,709 + 13,994 followers) and missing wallets/profiles for beau, porta, lunarfang; **5 of 11 KOLs carry unresolved attribution or rewardability blockers** | solarnius (KOL + QA) or jollydinger (KOL + PL) — whichever doesn't take B-6 | 8–12K | — (route day 1) |
| B-2 | **"How Post Fiat Works" X thread** — already accepted by gmoney (18K, Core Product board) | gmoney (318K) | 18K (set) | **Adopt onto this board; do not duplicate** |
| B-3 | **Founder flagship amplification** — original post + quote-repost of B-2 when it ships | goodalexander (140K) | 12–18K | B-2 published |
| B-4a | **Mid-tier original thread: builder's-eye view of the Task Node** | shake (17,285) | 8–12K | content kit B-6 helpful, not blocking |
| B-4b | **Mid-tier original thread: earning PFT as an operator** | beau (31,056) | 8–12K | **B-1** (no wallet on file) |
| B-5 | **T3 repost/commentary pack** — quote-repost B-2/B-4 with original commentary; evidence = post links | wave 1: jollydinger, solarnius, mickross; wave 2 after B-1: porta, lunarfang, and the 2 resolved accounts | 3–5K each | B-2 or B-4 live |
| B-6 | **Content kit & message house** — claims with evidence links, tone guide, banned-claims list; lowers activation energy for every silent KOL. *Non-KOL ops work* | jollydinger (KOL+PL) preferred; author available as fallback (disclosed) | 8–12K | — (route day 1) |
| B-7 | **Baseline capture + cycle-1 attention report** — pre-cycle metrics snapshot, then per-artifact impressions/engagement + **artifact quality scores** (claims accuracy, PFT call-to-action clarity, link + evidence completeness) and funnel lift at day 30 | solarnius (KOL + QA — measurement is a QA-shaped task) | 8–10K | baseline half routes day 1, report half day 25+ |

**Roster coverage:** all 11 KOLs have a named cycle-1 path — gmoney (B-2), goodalexander (B-3), shake (B-4a), beau (B-4b, post-B-1), jollydinger + solarnius + mickross (B-5 wave 1 + ops roles), porta + lunarfang + both unattributable accounts (B-5 wave 2, unlocked by B-1). Nobody on the roster is left without a route to their first artifact.

Sequenced spend if everything routes and delivers: **~91–129K PFT for the cycle** (upper bound assumes all seven B-5 participants across both waves deliver; the 18K for B-2 is already committed on the Core Product board and is counted here as cycle spend, not new spend) against ~568K reach — inside the cost ceiling in §2 at even conservative impression rates. Bands are proposals anchored to the one live precedent (18K/T1); goodalexander sets final numbers at launch (checklist §5).

## 4. Coordination plan — engaging 10 silent KOLs (and staying inside the rules)

Every KOL except gmoney has zero KOL-amplification task history on record. The plan is **protocol, not personal outreach** (this board never asks operators to DM each other):

1. **Enable before asking:** B-7 content kit and B-1 identity resolution route on day 1, so when amplification tasks arrive, accepting them is low-friction and every account can actually be paid.
2. **Three-touch routing protocol per KOL:** (i) board-launch Discord announcement tagging all resolvable KOL handles; (ii) task routed with a 72 h accept-by and auto-expiry — silence is a data point, not a stall; (iii) after two consecutive expiries across two cycles → **decay-and-replace rule**: re-tier down, reallocate that budget to delivering KOLs, and open a recruitment task for a replacement KOL candidate — silent reach should stop occupying budget after 60 days (re-tiering mechanics per the cycle-1 doc).
3. **Founder-minutes budget, spent where reach is:** gmoney + goodalexander hold ~80% of total reach. Direct founder engagement is rationed to that top tier only; everyone else is engaged through routing + public announcements.
4. **Public scoreboard:** each cycle report (B-8) names artifacts and reach per KOL — visible credit is the cheapest recurring incentive the board has.

## 5. Handoff — @goodalexander launch checklist (~20 minutes)

1. Create the board with §1 scope (name: `kol_amplification_comms`).
2. Approve or adjust §2 metric defaults and §3 reward bands — one pass, then they apply mechanically.
3. **Route today:** B-1 (identity/wallet sprint) and B-6 (content kit) — no dependencies, unblock everything else.
4. **Adopt** gmoney's accepted 18K thread task as this board's first live artifact — operational handoff only; whatever board-attribution mechanics exist, the point is: do not create a duplicate task.
5. Self-assign B-3 (your flagship amplification is the highest-leverage single post the network can buy).
6. After B-1 resolves: route B-4a/B-4b, then the B-5 pack, each with 72 h accept-by.
7. Route B-7's baseline capture **before** B-2 publishes (lift is unmeasurable after).
8. Day 30: cycle report lands (B-7); apply re-tiering + quality scores; decide cycle 2 or wind-down with the funnel data in hand.

## 6. Sources & evidence gaps

**Sources:** KOL Operating Report 2026-07-12 (roster, reach, data-quality flags, verbatim evidence-gap finding); Operative Report 2026-07-12 (badges, multi-badge overlaps, task-state per operator); board packet (gmoney's accepted thread task, 18K); rewarded cycle-1 definition (`task_59f228c`) for tiers, evidence requirements, and re-tiering mechanics.
**Gaps:** (a) follower counts move between reports (582K claimed vs 568,266 in the dated 07-12 report — the dated figure is used); (b) impression/engagement baselines don't exist yet — B-8 exists precisely to create them, and §2's funnel targets stay directional until one cycle of data lands; (c) reward caps for KOL-badge work types aren't visible in the packet — bands anchor to the single live precedent instead; (d) the 2 unattributable accounts may prove unresolvable — if so, re-tier the board math down by 24,703 followers and proceed (stated so the count change surprises no one).

---
*Prepared by zoz for `task_054a4c3646501821fc86cf4ed1779f23`. Launch decision: @goodalexander (§5).*
