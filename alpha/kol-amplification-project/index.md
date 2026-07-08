# KOL Amplification Special Project — Project Definition v1.0

**Project ID (proposed):** `kol_amplification_cycle_1`
**Author:** zoz (Project Leader) · **Reviewer & routing:** @goodalexander
**Date:** 2026-07-08 · **Status:** Draft for review
**Task:** `task_59f228cd67da7e22682ba8bdf51c27f4` · Task Node Core Product board

---

## 0. Executive summary

The Post Fiat network holds **~570,000 verified X followers across 11 KOL badge holders** (verified via `x_public_metrics`; the packet summary reports 572,280, the listed roster sums to 570,280 — see §1) and has produced **zero measurable amplification artifacts** — no indexed posts, threads, engagement metrics, or Discord evidence. This is the network's single largest stranded value asset.

This document defines a **bounded, 30-day, evidence-first amplification campaign** that converts that stranded reach into verifiable artifacts. It is deliberately conservative: cycle 1 optimizes for *proving the coordination loop works* — opt-in, publish, evidence, reward — not for maximum impressions. A working loop at modest scale is worth more than an ambitious plan nobody executes, which is precisely the current failure mode (per the project need summary: two KOL tasks proposed but unaccepted, no coordination framework).

**Cycle 1 targets:** ≥7 of 11 KOLs opted in, ≥8 published artifacts, ≥150,000 combined verified impressions, 100% of artifacts with complete evidence packets, reward payout within 72h of verification.

---

## 1. KOL tier assignments (by verified reach)

Source: Hive KOL Marketing State & Amplification Report (packet `2026-07-07`), proof method `x_public_metrics`. **Data note:** the packet summary reports combined reach of *approximately* 572,280; the 11 listed roster counts sum to **570,280**. The 2,000-follower gap is unexplained source drift (e.g., jollydinger appears as 10,690 and 10,692 in different packet reports). This document uses the roster sum (570,280) for all derived figures.

### Tier 1 — Macro (100K+ followers) — 2 accounts, 459,011 followers (80.5% of roster reach)

| KOL | Handle | Followers | Notes |
|---|---|---|---|
| gmoney | *(profile URL unresolved)* | 318,687 | Largest reach in cohort; no profile URL in packet — K-0 profile confirmation |
| goodalexander | [@goodalexander](https://x.com/goodalexander) | 140,324 | Multi-badge: KOL + Core Contributor + Project Leader + QA Worker; also this project's reviewer — see §6 conflict-handling |

### Tier 2 — Mid (10K–100K) — 6 accounts, 94,103 followers

| KOL | Handle | Followers | Notes |
|---|---|---|---|
| beau | *(unresolved)* | 31,056 | No profile URL in packet — K-0 profile confirmation |
| shake | [@Notshake](https://x.com/Notshake) | 17,285 | |
| `acct_oauth_4d295ed…` | **unresolved identity** | 13,994 | No handle, profile URL, or wallet — **participation gated on identity resolution (§3, task K-0)** |
| `acct_oauth_78b86ba…` | **unresolved identity** | 10,709 | Same gate |
| jollydinger | [@JollyDinger](https://x.com/JollyDinger) | 10,690 | Multi-badge: KOL + Project Leader |
| porta | *(unresolved)* | 10,369 | No profile URL in packet — K-0 profile confirmation |

### Tier 3 — Micro (5K–10K) — 3 accounts, 17,166 followers

| KOL | Handle | Followers | Notes |
|---|---|---|---|
| solarnius | [@solarnius](https://x.com/solarnius) | 6,523 | Multi-badge: KOL + QA Worker |
| lunarfang | *(unresolved)* | 5,394 | No profile URL; operative report (2026-07-07) also flags no wallet resolved — K-0 |
| mickross | [@Mrmickross](https://x.com/Mrmickross) | 5,249 | |

**Tier design rationale.** Three tiers, not four: the reach distribution is bimodal (two accounts hold 80% of reach; the remaining nine cluster at 5K–31K). A fourth tier would add coordination overhead without changing task design. Tier boundaries (100K / 10K / 5K) are round-number thresholds that survive normal follower-count drift.

**Unresolved identities are a hard gate, not a footnote.** 24,703 followers (4.3% of roster reach) sit in two accounts with no handle, profile URL, or wallet. Given the network's documented 153,002.5 PFT duplicate-payment leak (Distribution V3, 13 known incidents — Reward Integrity board) and active Sybil-integrity workstream, paying amplification rewards to unresolvable accounts is an unforced error. They are assigned to Tier 2 by reach but **cannot accept campaign tasks until identity resolution completes (task K-0)**. In total **6 of 11 accounts lack a profile URL** (gmoney, beau, porta, lunarfang, plus the two OAuth accounts); all six route through K-0, with only the two OAuth accounts hard-gated from rewards.

---

## 2. Task breakdown per tier

Every task follows the same contract: **defined artifact → minimum evidence → coordination handshake → reward**. All rewards are proposals for reviewer ratification; caps respect existing badge reward-cap policy.

### K-0 · Identity resolution (pre-campaign; 6 accounts — 2 fully unresolved + 4 missing profile URLs)
- **Artifact:** KOL confirms X handle from the account's linked identity (post a nonce tweet or bio marker), plus wallet confirmation through the standard badge re-verification path (`x_public_metrics`).
- **Minimum evidence:** re-verified badge projection showing handle + wallet.
- **Handshake:** coordinator DMs instructions on Discord opt-in; KOL completes within onboarding week.
- **Reward:** 500 PFT (participation unblock, not amplification).

### K-1 · Tier 1 — Flagship thesis thread
- **Artifact:** an original X thread (≥5 tweets) on the Post Fiat thesis or a concrete network milestone, from the KOL's own voice, using the claims register (§7) — no copy-paste of a shared script.
- **Minimum evidence:** thread URL + author-view analytics screenshot (impressions, engagements) captured at T+72h ±12h.
- **Handshake:** coordinator proposes 3 candidate angles in the campaign Discord thread → KOL picks or counters within 48h → posts within their assigned 3-day window (§4 stagger) → drops evidence packet in Discord within 24h of the T+72h capture.
- **Reward:** 8,000 PFT per verified thread.

### K-2 · Tier 2 — Original post + engagement follow-through
- **Artifact:** one original tweet or quote-tweet of a Tier 1 thread, plus ≥3 substantive replies to genuine engagement on it over the following 72h ("substantive" = adds information; not "🔥").
- **Minimum evidence:** post URL + analytics screenshot at T+72h + links to the 3 replies.
- **Handshake:** same propose→pick→window flow; Tier 2 windows are seeded *after* the first Tier 1 thread is live, so quote-tweets have something to amplify.
- **Reward:** 3,000 PFT per verified packet.

### K-3 · Tier 3 — Amplification pack
- **Artifact:** repost of a Tier 1/Tier 2 artifact + 1 original comment tweet + 2 substantive replies in the same 72h window.
- **Minimum evidence:** URLs for all four items + analytics screenshot for the original comment tweet.
- **Handshake:** coordinator posts a "pack menu" of live artifacts in Discord; KOL claims one, executes within their window.
- **Reward:** 1,500 PFT per verified pack.

### K-4 · Cycle retrospective (coordinator task, 1 instance)
- **Artifact:** public retro doc — artifacts published vs. target, verified impressions vs. floor, per-tier participation, evidence-quality issues, restart/extend/redesign recommendation per §6 criteria.
- **Minimum evidence:** doc URL + Discord post tagging @goodalexander.
- **Reward:** 5,000 PFT.

**Cycle 1 budget envelope (worst case, full participation):** 2×8,000 + 6×3,000 + 3×1,500 + 6×500 + 5,000 = **46,500 PFT**, of which 38,500 (K-1/K-2/K-3) is contingent on verified amplification artifacts. Realistic (7 opt-ins) is ~30,000 PFT. All figures are proposals for reviewer ratification, to be checked against current badge reward-cap policy at ratification.

---

## 3. 30-day campaign calendar (3 phases)

Day 1 = first business day after reviewer sign-off + Discord kickoff announcement.

### Phase 1 — Onboarding (days 1–7)
- D1: kickoff announcement in approved PF channel (template §6); campaign Discord thread opened.
- D1–3: opt-in window — each KOL reacts/replies in-thread; K-0 identity tasks issued to the 6 accounts needing resolution.
- D3–5: content angles proposed per tier; claims register (§7) published in-thread.
- D5–7: posting windows assigned (stagger map, §4); Tier 1 confirms angles. Coordinator captures a **7-day pre-campaign baseline** per opted-in KOL (median impressions of recent posts, from author-view screenshots or public proxy) so cycle results report *lift vs. baseline*, not just raw counts.
- On reviewer sign-off, the coordinator records the actual Cycle 1 Day-1 calendar date in the artifact registry (§4) and the campaign thread.
- **Phase gate:** ≥5 opt-ins including ≥1 Tier 1 → proceed. Below that → pause, coordinator escalates to reviewer with a participation diagnosis instead of burning the calendar.

### Phase 2 — First amplification sprint (days 8–21)
- D8–14: Tier 1 threads publish (one per assigned window; gmoney and goodalexander windows do not overlap).
- D10–18: Tier 2 posts publish, staggered ≥24h apart, each within 72h of a live Tier 1 artifact.
- D12–21: Tier 3 packs execute against live artifacts.
- Rolling: evidence packets due T+72h per artifact; coordinator verifies within 48h of receipt and posts a weekly scoreboard in-thread (D14, D21).

### Phase 3 — Engagement sprint + retro (days 22–30)
- D22–27: engagement follow-through — Tier 2/3 reply obligations complete; late evidence collected; one "best performer" artifact selected for a network QT push.
- D27–29: coordinator compiles K-4 retrospective.
- D30: retro published + Discord post tagging @goodalexander with restart/extend/redesign recommendation. **Cycle 1 hard-stops at D30** — no open-ended drift; anything unfinished rolls into the cycle 2 decision, not into an extension by default.

---

## 4. Evidence requirements per task type

**Universal rules (all task types):**
1. **Post URLs must be canonical** (`x.com/<handle>/status/<id>`), posted from the KOL's verified handle. Third-party mirrors don't count.
2. **Analytics screenshots must be author-view** (post analytics page showing impressions + engagements), captured at T+72h ±12h, with the post timestamp visible. Public-view screenshots are insufficient — impressions aren't public.
3. **Artifacts must survive.** Deleted posts before T+7d forfeit the reward. Coordinator archives each URL at verification time (archive.org snapshot where X permits; fallback: full-page screenshot with SHA-256 hash logged in the artifact registry) — impressions can't be re-audited after the fact, so the archive + screenshot pair is the durable record.
4. **Evidence lands in the campaign Discord thread** as one message per artifact: URL(s) + screenshot(s) + one-line self-report (`tier / task type / window`). One message = one reviewable packet.
5. **Authenticity screen (anti-Sybil).** Engagement quality is spot-checked before payout: reply-quality sampling and follower-authenticity sanity check on outlier engagement spikes. Artifacts with clearly botted amplification (engagement >5× tier baseline with reply quality near zero) are flagged for manual review instead of auto-payout. This mirrors the network's existing reward-integrity discipline.
6. **Machine-readable artifact registry.** The coordinator maintains a public CSV alongside this document (`registry.csv`: kol, tier, task_type, artifact_url, posted_at, screenshot_sha256, impressions, engagement_rate, baseline_median, verification_status, payout_status). Every evidence packet gets a row at verification. This makes cycle 1 reusable infrastructure — future cycles, re-tiering, and audits read the registry, not Discord scrollback.

**Per task type:**

| Task | Required evidence items |
|---|---|
| K-0 identity | Re-verified badge projection (handle + wallet visible to coordinator) |
| K-1 thread | Thread URL · author-view analytics screenshot at T+72h · claims-register self-attestation line |
| K-2 post | Post URL · analytics screenshot at T+72h · 3 reply URLs |
| K-3 pack | Repost URL · comment-tweet URL + its analytics screenshot · 2 reply URLs |
| K-4 retro | Public doc URL · Discord post URL tagging @goodalexander |

**Verification mode:** manual review by coordinator, countersigned by reviewer for Tier 1 payouts; follow-up questions allowed (mirrors Task Node `mixed` verification).

---

## 5. Success metrics

Floors are deliberately conservative and **flat per tier** for operational simplicity. As a share of followers they land at ~7–8% for Tier 1 and ~6–8% for Tier 3; for Tier 2 the flat 1,000 floor spans 3.2% (beau) to 9.6% (porta) — accepted spread, since proportional floors would add per-KOL negotiation for negligible integrity gain at these sizes. Confidence in these floors: **moderate** (no historical Post Fiat amplification baseline exists; the §3 baseline capture is itself a cycle 1 output, and cycle 2 floors should be set from measured lift).

**Per-artifact minimums (payout floor):**

| Tier / task | Min impressions | Min engagement |
|---|---|---|
| K-1 thread (T1) | 25,000 (gmoney) / 10,000 (goodalexander) | ≥0.8% engagement rate on tweet 1 |
| K-2 post (T2) | 1,000 | ≥0.8% engagement rate |
| K-3 comment tweet (T3) | 400 | no floor (packs are volume plays) |

Artifacts below floor but with complete evidence earn 50% reward — the evidence loop is what cycle 1 is buying; punishing honest low reach would teach KOLs to stop submitting evidence.

**Campaign-level targets (cycle 1 pass/fail):**
- **Participation:** ≥7 of 11 KOLs opted in; ≥5 completed an artifact.
- **Volume:** ≥8 verified artifacts published (any mix of K-1/K-2/K-3).
- **Reach:** ≥150,000 combined verified impressions (≈26% of roster reach); reported alongside *lift vs. pre-campaign baseline* per KOL.
- **Evidence integrity:** 100% of paid artifacts have complete packets; 0 payouts to unresolved identities.
- **Ops latency:** median evidence→verification <48h; verification→payout <72h.

**Explicit non-goals for cycle 1:** follower growth, token-price impact, press pickup. These are unmeasurable or unattributable at this scale and would corrupt the metric set.

---

## 6. Coordination plan (first cycle)

**Roles.**
- **Campaign coordinator:** zoz (Project Leader badge) — runs the calendar, issues tasks, verifies evidence, posts scoreboards, writes the retro.
- **Reviewer & reward routing:** @goodalexander — ratifies this definition, countersigns Tier 1 payouts, routes rewards through the Task Node board (tasks issued as network tasks under a `kol_amplification` work type, or nearest existing equivalent until one exists).
- **Conflict handling:** goodalexander is both reviewer and a Tier 1 KOL. His own K-1 artifact is verified by the coordinator with the evidence packet public in-thread; he does not countersign his own payout — **backup countersigner: donravle** (Core Contributor + Project Leader, not a KOL, so no amplification conflict). Cheap to state now, awkward to improvise later.

**Reward routing.** All rewards flow through Task Node as verifiable task payouts to badge-verified wallets — no side payments. K-0 must complete before any reward routes to the two unresolved accounts. Proposed reward figures (§2) are ratified or adjusted by the reviewer before kickoff.

**Discord structure.**
- **Kickoff announcement** (approved PF channel): what the campaign is, the doc link, the opt-in instruction, the 30-day window, tagging @goodalexander. Template:
  > 📣 **KOL Amplification — Cycle 1 (30 days).** The network has ~570K verified followers and zero amplification artifacts on record. That changes now. Project definition: `<doc URL>`. KOL badge holders: opt in by reacting in the campaign thread within 72h. Tiered tasks, defined evidence, rewards routed through Task Node. Review & routing: @goodalexander.
- **Campaign thread:** one thread per cycle; all opt-ins, angle proposals, window assignments, evidence packets, and weekly scoreboards live there. One thread = one auditable campaign record.
- **Weekly scoreboard posts** (D14, D21, D30): artifacts published / verified / paid, impressions running total vs. 150K target.

**Cycle restart / extend / redesign criteria (decided at D30 retro, recommended by coordinator, decided by reviewer):**
- **Scale (restart bigger):** ≥7 participants, ≥8 artifacts, reach target hit → cycle 2 raises floors ~25%, adds a second Tier 1 thread slot, considers a dedicated `kol_amplification` work type in the task framework. **Cycle 2 re-tiers by observed performance, not follower count alone:** impressions-per-follower, evidence completeness, reply quality, and verification latency from the artifact registry decide tier placement and reward bands — follower-count theater stops paying after cycle 1.
- **Repeat (restart same-size):** 5–6 participants or reach 60–99% of target → rerun with fixes from retro; no scaling.
- **Redesign (stop and rethink):** <5 participants or <60% of reach target → the constraint is opt-in economics or KOL relationship management, not campaign mechanics; do not rerun the same design. Diagnose before spending more PFT.

---

## 7. Claims register (content guardrail)

A one-page register, published in the campaign thread during Phase 1, listing (a) network facts KOLs may cite (verified follower base, live product surfaces, rewarded-task statistics from public packets) and (b) **prohibited claim classes**: token price predictions, guaranteed rewards, unverifiable partnership or listing claims. KOLs self-attest compliance in their K-1 evidence packet. This protects the network from its own megaphone — one hallucinated claim amplified across 459K Tier 1 followers is a net-negative campaign regardless of impressions.

---

## 8. Risks & failure modes

| Risk | Likelihood | Mitigation |
|---|---|---|
| Tier 1 no-show (gmoney has no resolved profile URL and no visible engagement history) | Moderate–high | Phase 1 gate requires ≥1 Tier 1 opt-in before sprint spends anything; goodalexander is the fallback Tier 1 |
| Evidence friction kills participation | Moderate | Evidence = 1 Discord message with URL + screenshot; below-floor artifacts still earn 50%; coordinator does the archiving |
| Botted engagement to hit floors | Low–moderate | §4 authenticity screen; manual review on outliers; floors set low enough that gaming is unnecessary |
| Simultaneous posting reads as coordinated shill wave | Moderate | Stagger map: no two artifacts in the same 24h window inside a tier; voices own their angle — no shared script |
| Reviewer bottleneck (goodalexander is 4-badge and busy) | Moderate | Coordinator verifies everything; reviewer only ratifies definition + countersigns Tier 1; retro is a recommendation, not a meeting |

---

## 9. Handoff

This definition is handed to **@goodalexander** for review and routing per the task's coordination requirement. Requested from review: (1) ratify or adjust reward figures (§2), (2) confirm the approved Discord channel for kickoff, (3) confirm task-issuance mechanism (network tasks under existing work types vs. new `kol_amplification` type), (4) greenlight Day 1.

---

*Prepared by zoz (Project Leader) for the Task Node Core Product board. Source data: Hive KOL Marketing State & Amplification Report and operative report packets, 2026-07-07/08. All follower counts as verified by `x_public_metrics` at packet time.*
