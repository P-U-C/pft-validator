---
layout: default
title: "Post Fiat Network: Task Authorization Gate Specification"
date: 2026-03-14
version: 4.0.0
status: final
category: mechanism-design
---

# Post Fiat Network: Task Authorization Gate Specification

**Version:** 4.0.0  
**Date:** 2026-03-14  
**Status:** Draft — Iteration 4  
**Author:** b1e55ed (Oracle Node Operator, Synthesis Hackathon Participant)

---

## Executive Summary

This specification defines a Task Authorization Gate for the Post Fiat Network — a layered system that converts "permissionless" from "anyone can drain the reward pool" to "anyone can earn trust through demonstrated alignment."

The core architecture rests on four mechanisms:

1. **Three separated ledgers** — eligibility, rewards, and trust are measured and governed independently. One scalar cannot run the whole society.
2. **Vesting by authorization state** — early-state contributors earn pending credits, not liquid PFT. Extraction at low authorization levels is mechanically bounded, not just socially discouraged.
3. **Extraction detection at every tier** — sophisticated actors gain trust first, then exploit higher-value surfaces. Detection runs continuously across all authorization states, not only at entry.
4. **Epoch-bound emission with concentration caps** — total PFT per period is bounded, no single contributor or control graph captures more than a defined ceiling.

The goal is a network where the NPV of cooperating through the authorization path strictly dominates the NPV of burst extraction under any plausible evasion strategy — not just rhetorically, but mechanically.

---

## 1. The Problem, Precisely Stated

### 1.1 What Failed

The network's #2 all-time earner (kaiserlimp0) extracted ~1M PFT without authorization, without core team contact, and without triggering any enforcement response until the gap was identified ex post.

Three specific system properties failed:

**No contributor-level authorization state.** The verification pipeline validated individual task completions with no concept of whether the submitting contributor was operating within the intended participation model.

**No entry-point communication.** The Proof of Alignment model — permissionless means anyone can apply, but work must be aligned with the roadmap before PFT is minted — was not communicated at the point of entry.

**No emission ceiling.** PFT minted as a function of value verification with no epoch constraint creates an unbounded extraction surface for any high-throughput operator who can clear verification.

### 1.2 What Kind of Network This Is

This specification implements **Model A: a curated high-trust contributor network** — not Model B (open protocol with objective contribution markets).

People may arrive permissionlessly, but meaningful earning and governance is gated by demonstrated alignment and social trust. This should be stated clearly, because speaking Model B language while implementing Model A controls produces resentment.

The network is honest about being curated. It invites contribution, but it does not promise that all contribution is equal.

### 1.3 The Economic Target

For any rational high-skill newcomer, the NPV of cooperating through the authorization path must dominate the NPV of burst extraction under the best plausible evasion strategy.

Current parameters must be tuned to satisfy this inequality, not just approximate it. Specifically:

- Maximum extractable value before strong authorization must be low relative to long-term authorized earning
- Detection and response lag must be short enough that extraction windows do not compound
- Account rotation must be costly enough that it is not a viable evasion strategy
- The vesting window must make liquid gains from early extraction modest even if detection fails

These are not aspirational design principles. They are verifiable constraints that the mechanism either satisfies or does not.

### 1.4 Extractor Typology

Not all extractors are the same, and the mechanism should not treat them uniformly. The network recognizes four types:

| Type | Profile | Network response |
|------|---------|-----------------|
| I — Misaligned but valuable | High skill, operating without authorization because the rules were unclear | Recruit aggressively. Fast-track authorization. This person is an asset. |
| II — Mercenary elite | High skill, purely economic motivation, no inherent loyalty | Engage. Keep economically constrained until alignment demonstrated. May convert to Type I with time. |
| III — Score optimizer | Medium skill, optimizes for scoring metrics rather than genuine value | Redesign incentives. Do not over-celebrate. The mechanism should make score-optimization less profitable than genuine contribution. |
| IV — Coordinated farm / sybil swarm | Organized extraction via multiple wallets or automated throughput | Suppress quickly. Clawback where possible. The mechanism should make this structurally unprofitable, not just detectable. |

The redirect-first framing (v3) applies primarily to Types I and II. Type III requires incentive redesign. Type IV requires enforcement.

---

## 2. Three Ledgers

The most important structural change from prior versions: a single 30-day composite score cannot govern access control, reward weighting, and trust progression simultaneously. These serve different purposes, operate on different time horizons, and have different adversarial surfaces. They must be separate.

### 2.1 Ledger 1: Eligibility

**Purpose:** Determines which authorization state a contributor occupies and what task surfaces they can access.

**Inputs:** Minimum threshold scores on alignment, sybil risk, and declared control graph integrity. Binary pass/fail against thresholds.

**Time horizon:** Updated per epoch (28 days). Not real-time.

**Key property:** The eligibility ledger is conservative and slow-moving by design. A contributor cannot advance eligibility states in less than the minimum duration, regardless of score. This resists burst gaming.

### 2.2 Ledger 2: Rewards

**Purpose:** Determines each contributor's proportional share of the epoch budget.

**Inputs:** Task tier weights, alignment score, authorization tier weight, contributor growth index, and task classification verification. Continuously updated.

**Time horizon:** Computed daily, settled at epoch close.

**Key property:** The rewards ledger is the surface most exposed to gaming. Anti-gaming measures (concentration caps, blinded review, tier classification governance) apply primarily here.

### 2.3 Ledger 3: Trust

**Purpose:** Governs governance rights, vouching authority, and advancement to TRUSTED state.

**Inputs:** Slow-moving composite of long-term alignment history (90+ days), peer reputation signals, identity verification, and nomination by existing TRUSTED contributors.

**Time horizon:** Updated monthly. Highly path-dependent — a single bad epoch does not destroy it, but sustained misalignment does.

**Key property:** The trust ledger is intentionally hard to move. It is the one ledger that cannot be gamed on a short time horizon. This is what makes TRUSTED governance rights meaningful.

### 2.4 No Cross-Ledger Contamination

A high rewards ledger score does not automatically advance eligibility. A high trust ledger score does not increase epoch rewards directly (beyond the 1.2× tier weight). These ledgers inform each other as inputs but do not substitute for each other.

A contributor who produces high output but low alignment can earn well this epoch and still not advance authorization state.

---

## 3. Vesting by Authorization State

### 3.1 The Core Mechanism

The single most effective deterrence against early-state extraction is not detection — it is delayed liquidity. A contributor who cannot receive liquid PFT until they have demonstrated alignment over time has limited incentive to optimize for burst extraction.

| State | Immediate liquid | Vesting |
|-------|-----------------|---------|
| UNKNOWN | 0% | 100% pending — released if contributor reaches PROBATIONARY within 60 days; forfeited if not |
| PROBATIONARY | 25% | 75% vests linearly over 30 days following epoch close |
| AUTHORIZED | 100% | No vesting — full settlement at epoch close |
| TRUSTED | 100% | No vesting |
| SUSPENDED | 0% | Pending credits frozen; vesting halted |

**Why this works:** A Type IV coordinated farm running multiple wallets at PROBATIONARY earns 25% liquid PFT per epoch on capped reward weights. The remaining 75% vests only if the wallets remain in good standing for 30 days post-epoch. Rotating wallets before vesting forfeits the unvested portion. The mechanism makes account rotation economically punishing even when detection fails.

**Why this is fair to legitimate contributors:** Legitimate contributors who stay in the system advance to AUTHORIZED, at which point there is no vesting at all. The vesting burden is temporary and proportional to authorization state.

### 3.2 Clawback Window

For PROBATIONARY contributors who are subsequently suspended or found to have violated the Founder's Pledge, unvested credits are forfeited. Vested liquid amounts are not clawed back (this would require on-chain enforcement with significant complexity) but the contributor's growth index resets and their authorization state history is marked.

---

## 4. Extraction Detection at Every Tier

### 4.1 Why Detection Must Span All States

A naive detection system monitors UNKNOWN and PROBATIONARY contributors for extraction patterns. This is insufficient.

Sophisticated operators gain trust first — they invest the time to reach AUTHORIZED or even TRUSTED state, then exploit the higher-value surfaces those states unlock. The most damaging extraction happens at high authorization levels, not low ones, because AUTHORIZED contributors have uncapped epoch weights and access to Tier 3 Alpha tasks.

Detection runs continuously across all authorization states. The behavioral signature library is tuned differently by tier — what constitutes an extraction pattern for an UNKNOWN contributor differs from what constitutes one for an AUTHORIZED contributor of 6 months.

### 4.2 Behavioral Signature Library

Detection monitors for the following pattern classes, weighted by severity:

**Velocity signatures (all tiers):** Completion rate significantly above peer-group median. Calibrated per-tier — AUTHORIZED at 3× median is more suspicious than PROBATIONARY at 3× because AUTHORIZED contributors are in a smaller, more monitored peer group.

**Quality gradient (all tiers):** Alignment scores that cluster just above verification thresholds without improvement over time. Genuine contributors' scores tend to improve as they learn the network. Extractors cluster at minimum passing.

**Task tier gaming (AUTHORIZED, TRUSTED):** Overconcentration in newly-classified Alpha tasks immediately after classification. A contributor who suddenly produces 80% Alpha completions after a task is reclassified upward is a flag.

**Reviewer relationship clustering (AUTHORIZED, TRUSTED):** Correlation between a specific contributor's high scores and specific reviewers. Mutual-boost rings are a known cartel mechanism in reputation systems.

**Temporal concentration (all tiers):** Clustering submissions at epoch boundaries. This is consistent with gaming the epoch weighting and is hard to explain as genuine behavior.

**Control graph anomalies (all tiers):** Behavioral correlation between wallets in the same declared or undeclared control graph. If three wallets submit similar completions with similar timing patterns, the system flags potential hidden common control even if they are not disclosed as associated.

### 4.3 Response by Type

When detection fires, the response is calibrated to extractor type and severity:

| Severity | Response | Who acts |
|---------|----------|---------|
| Low — single flag, ambiguous | Log only. Monitor for pattern. No action. | Automated |
| Medium — two correlated flags | Soft redirect: task surface constrained toward tier type where extraction is harder. No notification. | Automated |
| Medium-high — sustained pattern | Steering intervention: acknowledgment message, fast-track authorization offer, explicit documentation of detected pattern | Core team / automated |
| High — clear extraction at AUTHORIZED level | Temporary weight reduction (not suspension). Trust ledger flagged. Core team review initiated. | Core team |
| Critical — coordinated farm / TRUSTED abuse | Immediate suspension. Vesting frozen. Trust ledger marked. | Core team |

### 4.4 The Steering Intervention (for Type I/II)

A steering intervention is not a punishment. It communicates three things:

1. **We see you:** The specific pattern detected is described. The contributor is not operating anonymously.
2. **We value the capability:** The throughput and skill demonstrated is acknowledged sincerely.
3. **Here is a better path:** The authorization request process is offered as the explicit alternative, with the contributor's existing track record noted as favorable context.

The intervention is logged and its outcome (contributor engaged, ignored, or escalated) feeds back into the detection model.

### 4.5 Detection as Secondary Containment

Detection is useful, but it is secondary containment — not the core defense.

The core defense is:
1. Bounded pre-authorization earning power (vesting mechanics, Section 3)
2. Delayed unlock of high-value surfaces (task routing by state)
3. Share caps (Section 6.3)
4. Sybil costs (control graph declaration, Section 7)
5. Task-tier governance hardening (Section 6.4)

Detection fails against sophisticated adversarial adaptation — once the detection logic is known, extractors run at 1.8× median rather than 5×, smooth their timing, and sprinkle higher-tier tasks. The bounded-risk architecture must hold even when detection fails.

---

## 5. Emission Mechanics

### 5.1 Epoch Definition and Rationale

A fixed 28-day epoch (7-day on testnet) during which total PFT minted is bounded by a pre-announced epoch budget.

**Why 28 days:** Signal accumulation requires enough data to distinguish sustained alignment from a lucky streak — one week is too noisy, one quarter is too slow to respond to drift. Gaming resistance requires that burst activity in the final days of an epoch cannot meaningfully shift the epoch-long baseline. Monthly cadence aligns with natural human and organizational reporting rhythms. Inflation predictability: "this month's PFT supply" is a legible statement for contributors and external observers.

### 5.2 Epoch Budget Formula

**Epoch budget = Base emission × Network growth multiplier × Task tier weight index**

**Base emission:** Set by the founding team based on target supply schedule. The fixed anchor.

**Network growth multiplier:** Adjusts budget based on aggregate verified value in epoch N vs. N-1. Bounded 0.5×–2.0× to prevent runaway expansion or collapse.

**Task tier weight index:** Adjusts budget based on the distribution of task types completed. Epochs where contributors complete proportionally more Network and Alpha tasks earn a higher index. Creates a network-level incentive for higher-value work.

### 5.3 Task Type Tiers

| Tier | Type | Base reward weight | Classification authority |
|------|------|--------------------|------------------------|
| 1 | Personal | 1× | Automated (predefined criteria) |
| 2 | Network | 3× | Core team, reviewable by TRUSTED council |
| 3 | Alpha | 9× | Core team only; rationale published; subject to 30-day retroactive audit |

The exponential gap between tiers creates strong incentives to work up the tier ladder rather than optimize Personal task throughput. However, classification power is itself a gameable surface — see Section 6.4.

### 5.4 Intra-Epoch Distribution (Rewards Ledger)

**Contributor weight = Task tier weight × Alignment score × Authorization tier weight × Contributor growth index**

| Factor | Source |
|--------|--------|
| Task tier weight | Composite of completed tasks weighted by tier (1×/3×/9×) |
| Alignment score | Rolling 30-day score from rewards ledger |
| Authorization tier weight | UNKNOWN 0.05×, PROBATIONARY 0.25×, AUTHORIZED 1.0×, TRUSTED 1.2× |
| Contributor growth index | Per-contributor multiplier, starts 1.0, bounded 0.5×–3.0× |

### 5.5 Contributor Growth Index

Starts at 1.0. Increases when a contributor's verified value weight in epoch N exceeds their trailing average. Decreases when output or alignment declines relative to own history.

Decays 10% per epoch of inactivity after a 2-epoch grace period — prevents banking a high index during dormancy and returning at elevated weight.

### 5.6 Real-Time Epoch Visibility (Range Decomposition)

Contributors see their epoch position in real-time, but not just a single conservative estimate. The dashboard shows:

- **Floor estimate (80th percentile pessimistic):** What you would earn if nothing improves
- **Likely range:** Current best estimate ± model uncertainty
- **Key sensitivities:** Which one or two factors would most improve your weight this epoch
- **Days remaining:** Time to act on the sensitivities

This decomposition is more useful than a single conservative number, and high-agency contributors tolerate uncertainty much better when it is explained than when it is opaque.

---

## 6. Contributor Authorization State Machine

### 6.1 States

```
UNKNOWN ──► PROBATIONARY ──► AUTHORIZED ──► TRUSTED
    │              │              │              │
    └──────────────┴──────────────┴──────────────┴──► SUSPENDED

[Extraction detection active at ALL states]
```

#### UNKNOWN (0)

| Property | Mainnet | Testnet |
|----------|---------|---------|
| Tasks assignable | Tier 1 only | Tier 1 only |
| Rate limit | 1 per 48h | 1 per 12h |
| Rewards | Pending credits only (0% liquid) | Same |
| Vesting | 100% pending; released on PROBATIONARY advancement within 60 days | Same |

#### PROBATIONARY (1)

| Property | Mainnet | Testnet |
|----------|---------|---------|
| Tasks assignable | Tier 1 + 2 | Tier 1 + 2 |
| Rate limit | 3 per 24h | 3 per 8h |
| Rewards | 25% liquid, 75% vests over 30 days post-epoch | Same |
| Minimum duration | 14 days | 3 days |
| Advancement | Score ≥ 0.65 (rewards ledger) + 10 completions + auth request | 5 completions |

#### AUTHORIZED 🏛 (2)

| Property | Value |
|----------|-------|
| Tasks assignable | All tiers, no rate limit |
| Rewards | 100% liquid at epoch close |
| On-chain badge | AUTHORIZED designation (soulbound token) |
| Demotion | Eligibility ledger score < 0.45 sustained 30 days OR explicit revocation |

AUTHORIZED is a milestone, publicly recognized, on-chain badged. All existing Authorized DB members backfilled here at launch.

#### TRUSTED 🔑 (3)

| Property | Value |
|----------|-------|
| Tasks assignable | All tiers |
| Rewards | 100% liquid, 1.2× tier weight |
| On-chain badge | TRUSTED designation (visually distinct soulbound token) |
| Governance | Vouching rights (up to 2 active vouches per epoch), epoch governance proposals |
| Sybil boundary | Enhanced verification required (ZK identity or equivalent) before advancement |
| Advancement | 90 days AUTHORIZED + trust ledger score ≥ 0.75 + ≥500 PFT lifetime + 2 TRUSTED nominations + ZK identity |

TRUSTED scope is deliberately narrow: Vouching (substitutes for human review in standard PROBATIONARY requests) and epoch governance proposals. No unilateral power. No contributor suspension authority. Hard sybil requirements.

The trust ledger, which governs advancement here, is the slowest-moving and hardest-to-game of the three ledgers.

### 6.2 Cooldown Mechanics

| Transition | Mainnet | Testnet |
|-----------|---------|---------|
| UNKNOWN → PROBATIONARY | 48h task hold | 12h |
| PROBATIONARY minimum | 14 days | 3 days |
| Auth request rate limit | 1 per 30 days | 1 per 7 days |
| AUTHORIZED epoch weight ramp | 7-day linear ramp | 2-day |
| Suspension (score-based) | 7 days | 2 days |
| Suspension (manual) | 30 days | 7 days |

### 6.3 Per-Epoch Concentration Cap

No single contributor or declared control graph may receive more than **15% of the epoch budget** without explicit core team override.

This cap:
- Prevents a single superstar or TRUSTED cartel from structurally dominating emission
- Is in effect during the bootstrap period; the percentage may be raised via governance vote as the contributor base grows
- Is enforced at the control-graph level, not the wallet level (a control graph with 3 wallets shares one 15% cap across all three)

### 6.4 Task Tier Classification Governance

Alpha classification (Tier 3) is the most gameable single point in the mechanism. A contributor who can influence which tasks receive the 9× weight multiplier can extract outsized epoch share by steering classification, not by producing more value.

**Hardening measures:**

- **Classification authority:** Tier 3 Alpha is classified by the core team only. No contributor can self-classify.
- **Published rationale:** Every Alpha classification is accompanied by a published rationale describing why the task meets the Alpha threshold.
- **30-day retroactive audit:** Any TRUSTED contributor can submit a classification challenge within 30 days of Alpha designation. Challenges are reviewed by the core team.
- **Reviewer blinding:** Where task verification involves human review of output quality, reviewers are not told the contributor's identity or authorization state.
- **Reviewer rotation:** No single reviewer evaluates the same contributor's output in consecutive epochs without a rotation exception.

### 6.5 Exploration Allowance

A mechanism that measures alignment too tightly against the current roadmap suppresses contrarian work that produces breakthrough value. The most valuable contributors are often misaligned before they are vindicated.

A fixed allocation — proposed at **5% of the epoch budget** — is reserved for the **Exploration Allowance**: tasks that are novel or roadmap-divergent but have been designated by the core team as worth incentivizing.

Exploration tasks are Tier 2 by default and are exempt from the standard alignment scoring. Contributors who complete Exploration tasks are evaluated on intellectual rigor and clarity of argument rather than roadmap fit.

This keeps the alignment mechanism from becoming an anti-innovation mechanism.

---

## 7. Declared Control Graph

### 7.1 Replace "One Identity" with Accountable Entity Declaration

"One identity" is not the right primitive for a contributor network. Teams, labs, automation stacks, and operator clusters are legitimate contributors. Pretending the unit is always one human creates a rule that either over-excludes legitimate multi-party contributors or is trivially circumvented.

The correct primitive is the **declared control graph**: a transparent declaration of who controls what, at the level of economic entity.

At registration, each contributor declares:

1. **Primary wallet:** The canonical wallet for reward settlement and identity
2. **Associated wallets:** Any additional wallets operated under common control by the same entity
3. **Entity type:** Individual, team (names optional but count required), or automation stack (operator wallet identified)
4. **Beneficial control:** If the registering entity operates on behalf of a third party for reward purposes, that relationship must be declared

The declaration is wallet-signed and submitted as part of the Founder's Pledge. It is not a legal document. It is a commitment that the network takes seriously and monitors for consistency.

### 7.2 Control Graph Monitoring

The sybil detection pipeline monitors for undisclosed common control: correlated behavior between wallets not in the same declared control graph. This includes submission timing, completion similarity, task selection patterns, and network graph analysis.

When undisclosed correlation is detected, the wallets are flagged for a control graph audit. The contributor is notified and given 14 days to amend their declaration. Failure to amend after notification is treated as a deliberate declaration violation and subject to suspension.

### 7.3 Automation Stack Treatment

Automated contributors (bots, AI agents) are legitimate and valued. They must be declared as automation stacks with an identified operator wallet.

Automation stacks are subject to the same authorization state machine as human contributors, with two modifications:
- They are not eligible for TRUSTED state (governance rights require human accountability)
- They are subject to enhanced behavioral monitoring because automated operators are more capable of adversarial adaptation

---

## 8. Authorization Request and Review

### 8.1 Standard Authorization Request

When a PROBATIONARY contributor meets eligibility thresholds:

1. **Control graph declaration:** Primary wallet, associated wallets, entity type, beneficial control (if any)

2. **ZK identity proof (optional but accelerates review):** Proof of unique human identity via supported protocol. Network sees the proof, not the underlying identity. Supported protocols: Worldcoin, Proof of Humanity, or other protocols approved by the core team. Note: protocols differ in uniqueness guarantees, geographic accessibility, and coercion resistance — multiple options are supported because no single protocol is universally appropriate.

3. **Operational context:** What the contributor does, infrastructure operated, intended scope

4. **Work samples:** 3–5 completed tasks the contributor considers representative

5. **Alignment statement:** 200–500 words on the contributor's view of network success and their role in it

### 8.2 Review Process and Scaling Path

**Phase 1 (now):** Core team adjudicates all requests. 7-business-day SLA. Automated pre-screening (eligibility ledger score, sybil score, quality trajectory) filters obvious failures before human review.

**Phase 2:** TRUSTED vouching substitutes for core team review in standard cases. A TRUSTED vouch plus clean automated pre-screening is sufficient for advancement. Core team reviews only contested cases.

**Phase 3:** Authorization advancement is primarily algorithmic. Eligibility ledger score crossing threshold triggers advancement. Human review reserved for edge cases, contested decisions, and TRUSTED advancement.

This path is conditional on the scoring infrastructure proving reliable. Phase transitions are gated by demonstrated accuracy of the eligibility ledger, not time.

### 8.3 Constitutional Hierarchy

When signals conflict — eligibility ledger says authorize, TRUSTED vouch says advance, but founder says no — the following precedence applies:

1. **Core team safety / abuse override:** Supersedes everything. No appeal within the network (legal or regulatory actions are external).
2. **Hard protocol constraints:** Minimum duration, concentration caps, sybil requirements. Cannot be waived by anyone.
3. **Algorithmic scoring outcomes:** Primary determinant in Phase 3. Overridable by core team with documented reason.
4. **TRUSTED vouch inputs:** Advisory in Phase 1, substitutive in Phase 2.
5. **Reviewer / task-level inputs:** Inform scoring; do not independently determine outcomes.

All core team overrides of algorithmic outcomes are logged with reason and identity of the authorizing team member. This creates accountability for discretion.

---

## 9. The Founder's Pledge

### 9.1 Pledge (120–150 words, wallet-signed at registration)

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
> **Declare your control graph.** Operating wallets without disclosure is a violation. Declare all wallets and entities you control. The network monitors for undisclosed coordination.
>
> **Engage, don't extract.** Optimizing for reward volume without genuine value will redirect you — first with an invitation to do better, then with restrictions if the pattern continues.
>
> The network is watching, learning, and getting smarter. So should you.
>
> [Sign with wallet]

### 9.2 Operating Rules Appendix (one screen, displayed immediately after pledge)

The pledge does identity work. This appendix does legitimacy work — procedural clarity that converts the ritual commitment into concrete, auditable rules.

> **How the network evaluates you:**
> Three separate ledgers track your eligibility (can you access this task type?), your rewards (what fraction of this epoch's budget do you earn?), and your trust (do you have governance rights?). These are independent. High output does not automatically earn governance rights. Low output in one epoch does not reset your trust history.
>
> **What can reduce your weight:**
> Alignment scores below threshold. Undisclosed wallet correlation. Task completion patterns consistent with extraction rather than genuine contribution. These are monitored continuously, including after you reach Authorized status.
>
> **What can trigger a redirect:**
> Two or more correlated extraction pattern flags. You will be notified when a steering intervention fires.
>
> **What is appealable:**
> Any suspension. Authorization request denials (once per 30 days). Task tier classification disputes (within 30 days of classification, TRUSTED tier only).
>
> **What is final:**
> Core team safety overrides. Violations of the Founder's Pledge after documented warning.
>
> **Your early rewards vest over time.** As an Unknown or Probationary contributor, a portion of your PFT credits vest 30 days after epoch close. Reaching Authorized status removes vesting requirements entirely.

---

## 10. Integration with Existing Pipeline

```
Registration → [FOUNDER'S PLEDGE + CONTROL GRAPH DECLARATION]
                              ↓
Task Issuance ← [ELIGIBILITY LEDGER CHECK: state, tier access, vesting status]
                              ↓
Active contribution ← [EXTRACTION DETECTION: behavioral monitoring, all tiers]
                              ↓
Submission → Verification → Scoring
                              ↓
              [REWARDS LEDGER UPDATE: tier weight, alignment score, growth index]
                              ↓
              [TRUST LEDGER UPDATE: slow-moving, path-dependent]
                              ↓
Epoch Close → [CONCENTRATION CAP CHECK → VESTING MECHANICS → SETTLEMENT]
```

---

## 11. Open Questions for Network Discussion

1. **Vesting parameters:** Is 75% over 30 days the right PROBATIONARY vesting schedule? Too aggressive may deter legitimate contributors. Too lenient fails to deter extractors.

2. **Concentration cap:** 15% per control graph during bootstrap. What is the right number for mainnet?

3. **Exploration allowance size:** 5% of epoch budget reserved for roadmap-divergent work. Is this enough to protect innovation without becoming a gaming surface itself?

4. **ZK identity protocol selection:** Which protocols to support first? What is the minimum acceptable uniqueness guarantee?

5. **Automation stack governance:** Automated contributors cannot reach TRUSTED. Should automation stacks have a separate governance track, or is exclusion from governance permanent?

6. **Review SLA at scale:** 7 business days for core team review works at current contributor volume. What is the trigger size for mandatory TRUSTED council delegation?

7. **Growth index decay rate:** 10% per epoch of inactivity proposed. Is this too aggressive for contributors with legitimate multi-month gaps (illness, travel, competing priorities)?

8. **Success metrics:** What does this mechanism success look like? Fewer exploit cases? Better contributor retention? Higher PFT efficiency per verified value unit? These should be defined before launch so the mechanism can be evaluated against them.

---

## Appendix: Authorization Registry Schema

| Field | Type | Description |
|-------|------|-------------|
| primary_wallet | string | Canonical wallet address |
| control_graph | object | Declared associated wallets and entity type |
| entity_type | enum | individual / team / automation |
| state | enum | UNKNOWN / PROBATIONARY / AUTHORIZED / TRUSTED / SUSPENDED |
| eligibility_score | float | Current eligibility ledger score |
| rewards_score | float | Current rewards ledger alignment score |
| trust_score | float | Current trust ledger score (slow-moving) |
| contributor_growth_index | float | Epoch weight multiplier (0.5–3.0, starts 1.0) |
| authorization_tier_weight | float | 0.05 / 0.25 / 1.0 / 1.2 by state |
| pending_credits | float | Unvested PFT (UNKNOWN / PROBATIONARY) |
| vesting_schedule | object | Upcoming vest dates and amounts |
| tasks_by_tier | object | Completion counts by Personal / Network / Alpha |
| pft_lifetime | float | Total settled PFT |
| pledge_signed_at | timestamp | Founder's Pledge signature |
| zk_identity_verified | bool | ZK proof submitted |
| extraction_flags | string[] | Active detection flags |
| on_chain_badge | string | AUTHORIZED / TRUSTED token ID if minted |
| state_entered_at | timestamp | When current state began |
| authorization_request_at | timestamp | Last request submission |
| suspension_reason | string | If SUSPENDED |
| suspended_until | timestamp | Earliest reinstatement |
| vouched_by | string[] | TRUSTED wallets that have vouched (PROBATIONARY) |
| active_vouches_given | integer | Current epoch vouches given (TRUSTED, max 2) |

---

*Version 4.0 incorporates: three separated ledgers (eligibility, rewards, trust); vesting mechanics by authorization state; extraction detection at all tiers not just entry; extractor typology (I/II/III/IV) with differentiated responses; per-epoch concentration cap (15% per control graph); task-tier classification governance with challenge rights; exploration allowance (5% epoch budget for roadmap-divergent work); declared control graph replacing "one identity"; automation stack treatment; constitutional hierarchy for conflicting signals; range decomposition for real-time epoch visibility; and operating rules appendix paired with Founder's Pledge.*
