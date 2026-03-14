---
layout: default
title: "Post Fiat Network: Task Authorization Gate Specification"
date: 2026-03-14
version: 3.0.0
status: draft
category: mechanism-design
---

# Post Fiat Network: Task Authorization Gate Specification

**Version:** 3.0.0  
**Date:** 2026-03-14  
**Status:** Draft — Iteration 3  
**Author:** b1e55ed (Oracle Node Operator, Synthesis Hackathon Participant)  
**Context:** Written in response to the founder-identified governance failure where the network's #2 all-time earner (kaiserlimp0) extracted ~1M PFT without authorization or core team contact.

---

## Executive Summary

The Post Fiat Network faces a structural governance gap: open task participation, discretionary reward issuance, and no contributor-level authorization state. The result is a permissionless system that, in practice, permits skilled operators to extract large PFT rewards with zero network accountability.

The instinct to block or punish these operators is wrong. A sophisticated actor who figures out how to extract nearly 1M PFT from a nascent network without tripping any alarms is demonstrating exactly the kind of intelligence the network needs. The goal is not to exclude them — it is to catch them early, acknowledge what they've done, and redirect that capability toward aligned contribution before the extraction becomes a problem.

This specification proposes four complementary mechanisms:

1. **AI-driven extraction detection and steering** — identify high-throughput operators early, before damage, and redirect rather than punish
2. **Epoch-bound emission mechanics** — cap total PFT per period, distribute by verified value weight, eliminate open-ended inflation
3. **A contributor authorization state machine** — transitioning from manual DB toggles toward an algorithmic reputation score, with authorization tiers celebrated as founder-status initiations
4. **A founder's pledge** — wallet-signed at entry, brief, rules-explicit, consequence-clear, identity-conferring

---

## 1. Problem Decomposition

### 1.1 The kaiserlimp0 Case

The network's #2 all-time earner operated without authorization — meaning without being in the Authorized group in the Task Node database and without direct sign-off from the founding team. This contributor earned ~1M PFT before the gap was identified.

This is not a failure of permissionlessness. It is a failure of three specific system properties:

**No contributor-level authorization state.** The verification pipeline validates individual task completions but has no concept of whether the submitting contributor is operating within the network's intended participation model.

**No entry-point communication.** The network operates a Proof of Alignment model — permissionless means anyone can apply to contribute, but work must be aligned with the roadmap before PFT is minted. This constraint was not communicated at the point of entry. A sophisticated operator had no way to know that anonymous task completion was outside the rules.

**No emission ceiling.** PFT is minted as a function of value verified by the network and the founder. Without epoch-bound caps, a high-throughput contributor can generate unlimited PFT if their completions clear verification, regardless of whether the network intended that level of emission.

### 1.2 Design Principles

**Redirect, don't exclude.** A savvy extractor is a net positive to the network if redirected. They've already demonstrated they can produce completions at scale. The mechanism should catch them early, acknowledge their skill, and steer them toward aligned contribution — converting an adversary into a high-value contributor before the extraction becomes network-material.

**Algorithm over manual toggles.** The current "Authorized group in DB + sign-off from goodalexander" model is the right emergency lever for now but the wrong permanent architecture. Authorization should become a continuously updated score derived from task history, alignment signals, and peer review — trained on live contributor data, not flipped by one person.

**Emission must be bounded.** If PFT supply is a function of arbitrary value judgments with no epoch constraint, the reward pool is structurally gameable. Epoch-bound emission converts the problem from "how much can I extract?" to "what fraction of a fixed pool can I earn?" — a fundamentally different incentive structure.

**Contribution compounds.** Contributors who consistently produce high-quality, aligned work accumulate a growth index that multiplies their epoch weight over time. Good actors compound. Extractors hit a ceiling.

**Rules stated at entry, briefly.** A contributor who does not know the rules cannot be held accountable for breaking them. The entry pledge is not a legal document — it is a brief, wallet-signed commitment that surfaces the rules, the consequences, and the identity being conferred.

---

## 2. Extraction Detection and Steering (The Redirect Layer)

### 2.1 Why Redirect Instead of Block

A high-throughput operator who produces technically valid completions at scale is demonstrating:
- They understand the task structure
- They can produce output that clears verification
- They are motivated enough to invest significant time

These are exactly the properties the network wants in an aligned contributor. The alignment component is missing — not the capability. The correct response is to redirect the capability toward alignment, not to block the operator from participating.

### 2.2 AI-Driven Pattern Detection

The system continuously monitors contributor behavior for extraction signatures — patterns that indicate optimization for reward volume rather than network value:

**Velocity signatures:** Completion rate significantly above network median, especially in early contributor tenure. A new operator producing at 5× the network median in week 1 is either exceptionally capable or optimizing for throughput.

**Quality gradient:** Alignment scores that are consistently just above verification thresholds but not improving over time. An aligned contributor's scores tend to improve as they learn the network. An extractor's scores cluster at the minimum passing threshold.

**Task type concentration:** Overconcentration in lower-tier task types (personal tasks) relative to what the contributor's apparent capability would support. High-skill extractors often stay in easy-to-game territory.

**Temporal patterns:** Unusual submission timing, clustering completions at cycle boundaries, or other patterns consistent with automated submission rather than genuine cognitive work.

When two or more extraction signatures are detected simultaneously, the system flags the contributor for steering intervention — not suspension.

### 2.3 The Steering Intervention

A steering intervention is not a punishment. It is an acknowledgment.

The message sent to a flagged contributor communicates three things:

1. **We see you:** The network has identified the pattern. The contributor is not operating anonymously even if they believe they are.
2. **We value the capability:** The throughput and technical skill demonstrated is exactly what the network needs. This is stated directly and sincerely.
3. **Here is a better path:** The contributor is invited to submit an authorization request (see Section 4), with the explicit framing that their existing track record will be considered favorably. Fast-track options are available.

The steering intervention replaces what would otherwise be an escalating enforcement action. The system gets smarter over time: each intervention and its outcome (contributor redirected, ignored, or escalated) feeds back into the detection model, improving pattern recognition for future cases.

### 2.4 The Kill Switch as Soft Redirect

The term "kill switch" is misleading for this context. What is implemented is a soft redirect gate: when the system detects extraction signatures above a confidence threshold, task assignment for that contributor is temporarily redirected — away from the task types being gamed, toward higher-value task types where aligned contribution is harder to fake.

This is not a block. It is a forcing function toward the work the network actually needs.

If the contributor produces quality output in the redirected task types, their alignment score improves and the redirect lifts automatically. If they abandon participation rather than engage with redirected tasks, the system has identified an extractor with low network value and their epoch weight decreases accordingly.

---

## 3. Emission Mechanics

### 3.1 The Current Model and Its Failure Mode

**Currently:** PFT is minted per task completion at rates determined by the founder's assessment of value. There is no fixed inflation schedule. Total supply grows as a function of task volume × reward rates × founder discretion.

**The failure mode:** a high-skill operator producing technically valid completions at high volume can generate unlimited PFT with zero relationship to whether the network intended that emission level. kaiserlimp0 is the existence proof.

### 3.2 Epoch Definition and Rationale

An **epoch** is a fixed 28-day window during which total PFT minted across all task completions is bounded by a pre-announced epoch budget.

**Why 28 days?** A 28-day epoch (four weeks, approximately monthly) is chosen for four reasons:

1. **Signal accumulation:** A single week is too short — alignment trends are noisy at that resolution and a contributor can have an outlier week without it being meaningful. 28 days provides enough data points to distinguish sustained alignment from a lucky streak.

2. **Gaming resistance:** To meaningfully influence their epoch allocation, a contributor must sustain elevated output and quality for nearly a month. Burst gaming in the final days of an epoch produces minimal weight gain because the epoch-long baseline dominates the weighting.

3. **Reporting cadence:** Monthly cycles align with how humans and organizations naturally track performance — there is cultural infrastructure for monthly accountability that weekly and quarterly periods lack.

4. **Inflation predictability:** Monthly epoch budgets are easy for contributors to reason about and for the network to communicate externally. "Here is what this month's PFT supply looks like" is a legible statement for both contributors and observers.

Testnet epochs should run at 7-day intervals to compress the feedback loop and validate mechanics before mainnet cadence.

### 3.3 Epoch Budget Formula

**Epoch budget = Base emission × Network growth multiplier × Task tier weight index**

**Base emission:** A fixed starting rate set at network launch by the founding team based on target supply schedule. This is the anchor — all other adjustments are multipliers on it.

**Network growth multiplier:** Adjusts epoch budget based on aggregate verified value delivered in epoch N versus epoch N-1. If contributors collectively produced more aligned value this epoch than last, the multiplier increases proportionally. If value creation declined, it decreases. This creates an adaptive emission schedule that rewards network growth without permitting unbounded inflation. The multiplier is bounded: minimum 0.5×, maximum 2.0×, to prevent runaway expansion or collapse.

**Task tier weight index:** A network-level adjustment reflecting the distribution of task types completed in the epoch. Epochs where contributors complete proportionally more Network and Alpha tasks get a higher index than epochs dominated by Personal tasks. This creates a network-level incentive for contributors to work on higher-value problems.

### 3.4 Task Type Tiers

Not all tasks are equal. The network recognizes three tiers with exponentially increasing value:

| Tier | Type | Base reward weight | Description |
|------|------|--------------------|-------------|
| 1 | Personal | 1.0× | Individual contributor development tasks aligned with personal roadmap |
| 2 | Network | 3.0× | Tasks that directly contribute to network infrastructure, tooling, or ecosystem |
| 3 | Alpha | 9.0× | High-stakes tasks with direct impact on network strategy, revenue, or novel capability |

These multipliers apply within the intra-epoch distribution. A contributor who completes one Alpha task earns the same base weight as a contributor who completes nine Personal tasks — but with meaningfully lower effort requirements, since Alpha tasks are harder to produce at volume.

The exponential gap creates a strong incentive to work up the tier ladder rather than optimize Personal task throughput.

### 3.5 Intra-Epoch Distribution

Within a given epoch, the epoch budget is distributed proportionally based on each contributor's verified value weight:

**Contributor weight = Task tier weight × Alignment score × Authorization tier weight × Contributor growth index**

- **Task tier weight:** Composite of tier-weighted completions (Personal 1×, Network 3×, Alpha 9×)
- **Alignment score:** Rolling 30-day score reflecting how well completed work aligns with the current roadmap (0.0–1.0)
- **Authorization tier weight:** Multiplier by state (UNKNOWN 0.05×, PROBATIONARY 0.25×, AUTHORIZED 1.0×, TRUSTED 1.2×)
- **Contributor growth index:** See Section 3.6

### 3.6 Contributor Growth Index

Each contributor maintains a growth index that starts at 1.0 and adjusts based on their track record relative to their own prior epochs — analogous to the network growth multiplier but per-contributor.

The growth index increases when a contributor's verified value weight in epoch N exceeds their trailing average. It decreases when a contributor's output or alignment declines relative to their own history.

This means:
- Consistently improving contributors compound their epoch weight over time — the network rewards trajectory, not just absolute level
- Extractors who plateau at minimum-passing alignment scores see their index stagnate or decline
- A contributor returning from suspension starts their growth index reset at 1.0 — they must rebuild

**Growth index bounds:** minimum 0.5×, maximum 3.0×. The maximum prevents runaway concentration where a single long-tenured contributor captures an outsized fraction of the epoch budget indefinitely.

### 3.7 Real-Time Epoch Visibility

Contributors can view their estimated epoch allocation at any time during the epoch. The displayed estimate is intentionally conservative — set at approximately 85% of the model's current best estimate.

This means:
- Final allocations are almost always above what contributors were shown mid-epoch (upside surprise)
- Contributors are not making financial plans based on allocations that may not materialize
- The 15% buffer absorbs late-epoch weight changes without creating downside shock

The real-time view shows: current estimated allocation, current weight versus network median, primary factors driving weight (which task tier, alignment score trajectory, growth index), and days remaining in epoch.

---

## 4. Contributor Authorization State Machine

### 4.1 Transition from Manual Toggle to Reputation Score

**Current architecture:** Authorization is a binary flag (in Authorized group in Task Node DB, or not), set manually by the founding team. This is the correct Phase 1 architecture — centralized control during the period when the network cannot yet trust its own scoring infrastructure.

**Target architecture:** Authorization is a continuously updated reputation score — derived from task history, alignment signals, peer review, and time — that automatically places contributors in one of four tiers. Manual override is retained as an emergency lever, not the primary mechanism. The score is trained on live contributor data, improving over time as the network accumulates behavioral history.

**Transition phases:** Phase 1 (now) — binary flag backed by score calculation. Phase 2 — score is primary determinant, flag is override. Phase 3 — score is fully algorithmic, council is override.

### 4.2 Authorization States

```
UNKNOWN ──► PROBATIONARY ──► AUTHORIZED ──► TRUSTED
              │ [extraction detected]
              │
              ▼
        SOFT REDIRECT ──► (if engaged) PROBATIONARY ──► (if ignored) weight decay → SUSPENDED
```

SUSPENDED accessible from any state via explicit core team action.

#### State 0: UNKNOWN

Default state for any wallet that has registered and signed the Founder's Pledge but has no verified task history.

| Property | Value (mainnet) | Value (testnet) |
|----------|----------------|-----------------|
| Authorization tier weight | 0.05× | 0.05× |
| Tasks assignable | Tier 1 (Personal) only | Tier 1 only |
| Rate limit | 1 task per 48 hours | 1 task per 12 hours |
| Exit trigger | First task submission | First task submission |

#### State 1: PROBATIONARY

Active evaluation period. Contributor is building their track record.

| Property | Value (mainnet) | Value (testnet) |
|----------|----------------|-----------------|
| Authorization tier weight | 0.25× | 0.25× |
| Tasks assignable | Tier 1 + Tier 2 | Tier 1 + Tier 2 |
| Rate limit | 3 tasks per 24 hours | 3 tasks per 8 hours |
| Minimum duration | 14 days | 3 days |
| Advancement threshold | Score ≥ 0.65 + 10 completions + auth request | Score ≥ 0.65 + 5 completions + auth request |

#### State 2: AUTHORIZED 🏛

Contributor has passed probationary review. This is a milestone — not a checkbox.

AUTHORIZED status is badged on-chain and communicated as a founder-tier designation. The contributor is recognized publicly as a network participant with full access and accountability.

| Property | Value (mainnet) | Value (testnet) |
|----------|----------------|-----------------|
| Authorization tier weight | 1.0× | 1.0× |
| Tasks assignable | All tiers, no rate limit | All tiers |
| Demotion trigger | Score < 0.45 for 30 days OR explicit revocation | Score < 0.45 for 7 days |
| On-chain badge | ✅ AUTHORIZED designation | ✅ |
| Entry path | Probationary advancement OR fast-track | Same |

All existing contributors in the Authorized DB group are backfilled to AUTHORIZED at gate launch.

#### State 3: TRUSTED 🔑

Long-tenured AUTHORIZED contributors with demonstrated alignment over sustained periods.

TRUSTED is the senior founding designation — a meaningful achievement that is intentionally rare and hard to reach.

| Property | Value |
|----------|-------|
| Authorization tier weight | 1.2× |
| On-chain badge | ✅ TRUSTED designation (visually distinct from AUTHORIZED) |
| Governance rights | Can vouch for PROBATIONARY contributors (see Section 4.4) |
| Sybil boundary | Hard: must pass enhanced sybil verification before advancement |
| Advancement trigger | 90 days AUTHORIZED + score ≥ 0.75 + ≥500 PFT lifetime + nomination by 2 existing TRUSTED + ZK identity verification |

TRUSTED governance scope is intentionally limited: TRUSTED contributors can vouch for PROBATIONARY operators (reducing manual review load) and participate in epoch governance proposals. They cannot unilaterally advance or suspend contributors, and they cannot override core team decisions.

Expanding TRUSTED governance scope is a Phase 4+ discussion, contingent on the trust system demonstrating reliable alignment over time.

**Hard sybil boundaries for TRUSTED:** Advancement to TRUSTED requires passing a sybil verification check that is more rigorous than the standard sybil score. This may include ZK proof of identity (see Section 5.2), cross-network reputation verification, or other methods. A TRUSTED contributor whose sybil score subsequently degrades is automatically flagged for review and their governance rights suspended pending investigation.

#### State: SUSPENDED

Explicit exclusion. Only accessible via core team action — the system does not auto-suspend. The soft redirect (Section 2) handles borderline cases. SUSPENDED is reserved for clear violations.

| Property | Value |
|----------|-------|
| Authorization tier weight | 0× |
| Tasks assignable | None |
| Duration | 7 days minimum (standard), 30 days (repeat), permanent (core team decision) |
| Reinstatement | Appeal → PROBATIONARY (never back to prior state directly) |

### 4.3 Authorization Score Composition

| Signal | Weight | Source |
|--------|--------|--------|
| Task alignment | 40% | Verification pipeline — how aligned are completions with current roadmap |
| Completion quality | 25% | Reviewer scoring — quality signals from task-specific verification |
| Behavioral consistency | 20% | Pattern analysis — consistency over time, flags gaming patterns |
| Sybil risk (inverse) | 15% | Sybil pipeline — high sybil risk reduces score |

Rolling 30-day window. Not a lifetime average. A contributor who was aligned 6 months ago but has drifted recently sees their current score reflect the drift.

### 4.4 Cooldown Mechanics

| Transition | Mainnet cooldown | Testnet cooldown |
|-----------|-----------------|------------------|
| UNKNOWN → PROBATIONARY | 48h hold on additional tasks | 12h |
| PROBATIONARY minimum | 14 days | 3 days |
| Auth request rate limit | 1 per 30 days | 1 per 7 days |
| AUTHORIZED epoch weight ramp | 7-day ramp to full weight | 2-day ramp |
| Suspension (score-based) | 7 days | 2 days |
| Suspension (manual flag) | 30 days | 7 days |
| Reinstatement cooldown | 7 days minimum | 2 days |

---

## 5. Authorization Request and Review

### 5.1 Standard Authorization Request

When a PROBATIONARY contributor meets thresholds, they submit an authorization request:

1. **Identity disclosure:** Primary wallet + any associated wallets operated by the same entity

2. **ZK identity proof (optional but fast-tracks review):** A zero-knowledge proof of real-world identity via a supported ZK identity protocol (e.g., Worldcoin, Proof of Humanity, or equivalent). The network never sees the underlying identity — only the proof that a unique human identity exists behind the wallet. This is not required but meaningfully accelerates the review process and increases starting authorization score.

3. **Operational context:** What the contributor does, what infrastructure they run, intended participation scope

4. **Work samples:** Links to 3-5 completed tasks

5. **Alignment statement:** 200-500 words on: "What does Post Fiat Network success look like in 12 months, and what role do you see yourself playing?"

### 5.2 Review Process and Scaling

The current review process (human adjudication by core team) does not scale. It is the correct Phase 1 architecture and the wrong Phase 3 architecture.

**The path to scaling:**

**Phase 1 (now):** Core team adjudicates all requests. SLA: 7 business days.

**Phase 2:** TRUSTED contributors can vouch for PROBATIONARY operators. A vouch from a TRUSTED contributor (who themselves passed ZK identity verification and has a clean sybil record) substitutes for a portion of the core team review. Specifically: a TRUSTED vouch plus the automated pre-screening (alignment score, sybil score, quality trajectory) is sufficient for advancement without core team review, unless any signal falls below threshold.

**Phase 3:** The algorithmic steering system (Section 2) has accumulated sufficient behavioral data that authorization advancement can be primarily algorithmic — a contributor whose score crosses the threshold and whose patterns are consistent with genuine alignment advances automatically. Human review is reserved for edge cases and contested decisions.

**Why Phase 1 is acceptable now:** The network is small. The volume of authorization requests is manageable. The cost of approving a misaligned contributor at this stage is high relative to the cost of slower review. As the network scales and the scoring infrastructure matures, the balance shifts.

### 5.3 Suspension Appeal

Suspended contributor submits: acknowledgment of reason, remediation plan, supporting evidence. Review SLA: 14 days. Successful appeal reinstates to PROBATIONARY (never directly to prior state). 14-day probationary minimum restarts.

Note: the soft redirect system (Section 2) is designed to intercept most borderline cases before suspension is warranted. If the redirect system works correctly, suspension appeals should be rare — reserved for clear violations where the contributor genuinely needs the reset period.

---

## 6. The Founder's Pledge

### 6.1 Design Principles

The entry pledge is signed by the contributor's wallet at the moment of first Task Node registration. It is not a legal agreement. It is an identity-conferring ritual — the moment the contributor becomes a participant in something they are building, not just using.

**Design constraints:**
- **Brief:** Short enough that skimming is not faster than reading. Target: 120-180 words.
- **Rules-explicit:** The three non-negotiable rules are stated plainly
- **Consequence-clear:** What happens if the rules are broken is stated plainly
- **Identity-conferring:** The contributor is explicitly told they are a founder, not a user

### 6.2 Draft Pledge Text

> **Post Fiat Network — Founder's Pledge**
>
> By signing this pledge, you join the Post Fiat Network as a founding contributor.
>
> You are not a user. You are a builder. The work you produce here shapes what this network becomes.
>
> **Three rules:**
>
> **Alignment first.** PFT rewards are earned by work that advances the network's mission. Technically valid completions that don't serve the roadmap will not mint rewards — and patterns of misalignment will be detected.
>
> **One identity.** Operating multiple wallets without disclosure is a violation. Declare all wallets you control. The network can identify coordinated behavior and will.
>
> **Engage, don't extract.** Optimizing for reward volume without contributing genuine value will redirect you — first with an invitation to do better, then with restrictions if the pattern continues.
>
> The network is watching, learning, and getting smarter. So should you.
>
> [Sign with wallet]

---

## 7. Integration with Existing Verification Pipeline

### 7.1 Integration Points

```
Registration → [FOUNDER'S PLEDGE gate]
                    ↓
Task Issuance ← [AUTHORIZATION GATE: pre-issuance check]
                    ↓
Submission ← [EXTRACTION DETECTION: pattern monitoring]
                    ↓
Verification
                    ↓
Scoring ← [AUTHORIZATION GATE: post-completion score update]
                    ↓
Epoch Distribution ← [EPOCH MECHANICS: weight application]
```

### 7.2 Authorization Registry Schema

| Field | Type | Description |
|-------|------|-------------|
| wallet_address | string | Primary wallet |
| associated_wallets | string[] | Disclosed additional wallets |
| state | enum | UNKNOWN / PROBATIONARY / AUTHORIZED / TRUSTED / SUSPENDED |
| authorization_score | float | Composite score 0.0–1.0 |
| contributor_growth_index | float | Per-contributor epoch multiplier, starts 1.0 |
| epoch_tier_weight | float | Current authorization tier weight |
| tasks_completed_by_tier | object | Count by Personal / Network / Alpha |
| pft_lifetime | float | Total PFT earned |
| pledge_signed_at | timestamp | Founder's pledge signature timestamp |
| zk_identity_verified | bool | Whether ZK identity proof submitted |
| extraction_flags | string[] | Active extraction pattern flags |
| state_entered_at | timestamp | When current state began |
| authorization_request_at | timestamp | Last authorization request |
| on_chain_badge | string | AUTHORIZED / TRUSTED badge token ID if minted |
| suspension_reason | string | If SUSPENDED |
| suspended_until | timestamp | Earliest reinstatement date |

---

## 8. Rollout Plan

### Phase 1 — Bootstrap (Weeks 1-2, Testnet)
- Deploy Founder's Pledge gate for all new registrations
- Backfill existing contributors: current Authorized DB members → AUTHORIZED
- Compress all cooldowns to testnet cadence
- Epoch mechanics run in observation mode — weights computed but not enforced
- Extraction detection runs in logging mode only

### Phase 2 — Soft Gate (Weeks 3-4, Testnet)
- Authorization check runs with enforcement
- Epoch weight distribution enforced
- Authorization request process live, core team adjudicating
- Extraction detection active with steering interventions

### Phase 3 — Hard Gate (Mainnet launch)
- Full enforcement at mainnet cooldown cadences
- TRUSTED council vouching active
- On-chain AUTHORIZED and TRUSTED badges minted
- Real-time epoch allocation dashboard live

### Phase 4 — Algorithmic Authorization (Months 3-6)
- Extraction detection model trained on sufficient behavioral data
- Authorization advancement primarily algorithmic
- Core team review reserved for edge cases
- Epoch governance proposals delegated to TRUSTED council

---

## 9. Open Questions

1. **Which ZK identity protocol?** Worldcoin has the broadest adoption. Proof of Humanity has stronger community trust. Is there a preference, or should multiple be supported?

2. **What is the right base emission rate?** The epoch framework can accommodate any base rate. The founding team's supply schedule targets should anchor this.

3. **How are Alpha tasks designated?** Who decides a task is Tier 3 Alpha rather than Tier 2 Network? Is this a founding team designation, a governance vote, or a scoring system?

4. **Contributor growth index decay.** Should the growth index decay during inactivity (contributor goes dormant for 2 epochs)? A decay prevents long-tenured contributors from banking a high index and then returning to operate at high weight after a long absence.

5. **Badge design.** AUTHORIZED and TRUSTED badges should be visually distinct and meaningful. What does the on-chain representation look like — an SBT (soulbound token), a dynamic NFT, or a simple mapping?

---

## Appendix: Glossary

| Term | Definition |
|------|------------|
| Task Node | Network infrastructure that issues, tracks, and verifies task assignments |
| PFT | Post Fiat Token — minted via verified task completion |
| Epoch | A fixed 28-day window (7-day on testnet) during which total PFT minted is bounded |
| Epoch budget | Total PFT authorized for minting in a given epoch |
| Base emission | Founding-team-set anchor rate for epoch budget |
| Network growth multiplier | Adjustment to epoch budget based on value delivered this epoch vs. prior epochs (0.5×–2.0×) |
| Contributor growth index | Per-contributor multiplier that compounds with track record (0.5×–3.0×, starts 1.0) |
| Authorization score | Composite per-contributor score (0.0–1.0): alignment 40%, quality 25%, consistency 20%, sybil 15% |
| Task tiers | Personal (1×), Network (3×), Alpha (9×) — exponentially weighted by value |
| Soft redirect gate | System response to extraction pattern detection — redirects task types rather than blocking |
| Founder's Pledge | Wallet-signed entry commitment: rules, consequences, identity conferral |
| ZK identity proof | Zero-knowledge proof of unique human identity (no underlying data disclosed to network) |
| On-chain badge | Soulbound or dynamic token marking AUTHORIZED or TRUSTED status |
| TRUSTED council | Senior contributing tier with vouching rights and epoch governance participation |
| kaiserlimp0 | Network's #2 all-time PFT earner, operated without authorization — motivating case for this specification |

---

*Version 3.0 incorporates feedback on: extraction as an asset to redirect (not punish), reasoning behind epoch duration, per-contributor growth index, task tier weighting, real-time epoch visibility with conservative estimates, testnet timing compression, AUTHORIZED/TRUSTED as celebrated initiations with on-chain badges, reduced TRUSTED governance scope with hard sybil boundaries, ZK identity for authorization requests, and the Founder's Pledge as brief wallet-signed identity ritual.*
