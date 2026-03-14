---
layout: default
title: "$BLESS — Proof of Conviction"
date: 2026-03-14
version: 7.0
category: tokenomics
status: final
---

# $BLESS — Proof of Conviction

## Tokenomics of the b1e55ed Signal Network

**v7 — March 2026**

-----

## 0. Why This Token Must Exist

In 1980, Grossman and Stiglitz proved that informationally efficient markets are impossible. If prices already reflect all available information, no one has an incentive to pay the cost of gathering that information. But if no one gathers information, prices can't reflect it. The paradox is inescapable within the standard framework.

$BLESS resolves the paradox. Signal producers — the participants who gather information, build models, and express calibrated conviction about future market states — are compensated through $BLESS emissions independent of whether they trade on their information. The payment comes from the token mechanism, not from the market.

A producer who expresses a correctly calibrated 0.78 confidence forecast on ETH direction earns $BLESS whether or not they personally hold ETH. Whether or not the market has already priced in their view.

This is not a convenience. It is the load-bearing economic mechanism. Without it, b1e55ed is a reputation system. With it, b1e55ed is a market for information production — the first system that pays people to know things, rather than to trade on what they know.

The token is required because the compensation must be:

1. Programmatic — distributed by algorithm, not by a fund manager's discretion (unlike Numerai)
2. Proportional to calibration quality — not to stake size alone (unlike Bittensor)
3. Independent of outcome resolution disputes — deterministic via on-chain price feeds (unlike UMA)
4. Measurable against a benchmark — so emissions can be gated to actual value creation

$BLESS is the right to weight in the conviction aggregation function. Without it staked, your signals exist but carry zero weight. With it staked, your conviction is included proportional to your calibrated skill.

-----

## 1. The Flywheel

Every component of $BLESS tokenomics serves one purpose: maintaining a closed loop where token emissions are justified by measurable alpha production.

```
SHADOW PRODUCERS prove calibration (free, no token required)
                    ↓
Protocol Reserve GRADUATES proven producers (100 $BLESS grant)
                    ↓
DELEGATORS back graduates with additional stake
                    ↓
STAKED PRODUCERS submit calibrated convictions
                    ↓
NETWORK aggregates into the Conviction-Weighted Portfolio (CWP)
                    ↓
CWP generates measurable NETWORK ALPHA vs. benchmark
                    ↓
Network Alpha GATES emission rate — no alpha, no emissions
                    ↓
Emissions DISTRIBUTE to producers proportional to skill
                    ↓
Producers earn → delegators earn 20% share
                    ↓
CONSUMERS pay $BLESS subscriptions for signal access
                    ↓
Subscription revenue → PROTOCOL TREASURY
                    ↓
Treasury → Buyback-and-Recycle + Reserve replenishment
                    ↓
Reserve funds next round of shadow graduations
                    ↓
→ Bad producers get slashed → funds better replacements
→ Good producers earn more → attract more delegation
→ Better signal → more consumers → more revenue → more graduates
```

The loop is self-reinforcing. Slashed tokens from miscalibrated producers literally fund the onboarding of better ones. Consumer revenue replenishes the reserve that graduates the next generation of proven talent. Every participant's incentive points toward the same outcome: better signal quality.

The fundamental claim: **$BLESS should appreciate if and only if the network produces genuine predictive alpha. If it doesn't, the token should be worthless.** That is honest tokenomics.

-----

## 2. Supply — The System Names Itself

### 2.1 Max Supply: 0xB1E55ED

**186,537,453 $BLESS.** This number is not borrowed from Bitcoin, not selected for psychological appeal, and not optimized for market comparisons. It is 0xB1E55ED read in decimal — the system's own hex literal, the seed of its generative art, the identifier in every contract and endpoint.

When someone asks "why 186,537,453?" the answer is: read it in hexadecimal. The system's name is its supply cap. No parameter is borrowed. The identity is native.

| Parameter | Value | Derivation |
|-----------|-------|------------|
| Max supply | 186,537,453 | 0xB1E55ED in decimal |
| Phase 0 retroactive allocation | 5% (9,326,873) | Earned by active participants (repo + signaling) |
| Emission pool | 95% (177,210,580) | Governed by Brier decay |
| Team allocation | 0% | No insider tokens. Phase 0 allocation is earned, not granted. |
| Epoch length | 1 week | Natural cadence of crypto conviction cycles |

### 2.2 Emission Mechanism: Brier Decay

Each epoch, 0.25% of the remaining unissued supply from the emission pool (95% of total supply, or 177,210,580 $BLESS) becomes available for emission (subject to the alpha gate in Section 4). The Phase 0 retroactive allocation (5%) is distributed separately at token launch.

```
available_emission(epoch) = remaining_supply(epoch) × 0.0025
actual_emission(epoch) = available_emission(epoch) × alpha_gate_multiplier
```

The decay rate of 0.25% is the Brier score of an uninformative forecaster — the mathematical boundary between signal and noise in b1e55ed's evaluation function. A producer who scores better than 0.25 is producing signal. A producer who scores worse is producing noise. The number that defines whether conviction has informational value is the number that governs how fast tokens enter circulation.

The supply is the name. The decay is the benchmark. Both emerge from the system's own identity.

### 2.3 Emission Curve

No halvings. No step functions. No manufactured scarcity events. The emission rate declines continuously, each epoch slightly less than the last, asymptotically approaching the cap.

| Year | Cumulative Emitted | % of Supply | Weekly Emission (100% gate) |
|------|-------------------:|------------:|----------------------------:|
| 1 | 22,766,427 | 12.2% | 409,428 |
| 2 | 42,754,269 | 22.9% | 359,458 |
| 3 | 60,302,645 | 32.3% | 315,587 |
| 5 | 89,235,585 | 47.8% | 243,255 |
| 8 | 120,690,716 | 64.7% | 164,617 |
| 10 | 135,782,748 | 72.8% | 126,887 |
| 15 | 160,062,729 | 85.8% | 66,187 |
| 20 | 172,727,679 | 92.6% | 34,524 |

**Half-life: 5.3 years (277 epochs).** Proving forecasting skill across multiple market regimes takes longer than proving computational work. The supply curve encodes the belief that building a trusted signal network is a decade-scale project.

**Un-emitted tokens defer.** When the alpha gate reduces actual emissions below 100%, the unissued tokens remain in the pool for future epochs. There is no inflation without value creation.

-----

## 3. Karma — Calibration as Reputation

Karma measures one thing: how well-calibrated is your confidence?

### 3.1 The Conviction Format

Each conviction submitted by a producer has:

- **Direction:** long or short
- **Confidence:** c ∈ [0.55, 0.99] — the producer's stated probability of being correct
- **Asset:** from the producer's declared coverage set (Section 10)
- **Magnitude class:** low (<5%), medium (5–20%), high (>20%) expected move

Resolution is binary: direction was correct (o = 1) or incorrect (o = 0), determined by on-chain price feed (Pyth/Chainlink) at the end of the evaluation window.

The signal format is minimal by design. Direction + confidence + magnitude is the least a producer can reveal while still enabling calibration measurement. Your model, data sources, methodology, and alpha generation process remain entirely private.

### 3.2 Brier Scoring

The Brier score for a single conviction:

```
BS_i = (c_i - o_i)²
```

Where c_i is stated confidence and o_i is the binary outcome (1 if direction correct, 0 if not).

An uninformative producer has an expected Brier score of 0.25. This is the benchmark — the same number that governs emission decay. Below 0.25 is signal. Above 0.25 is noise.

### 3.3 Karma Update Rule

Each epoch, a producer's karma updates based on their average Brier score:

```
epoch_BS = mean(BS_i) across all convictions in epoch
karma_delta = SCALE × (0.25 - epoch_BS)
```

Where SCALE = 1.5.

| Epoch Brier Score | Calibration Quality | Karma Change |
|-------------------|---------------------|--------------|
| 0.10 | Exceptional | +0.225 |
| 0.15 | Excellent | +0.150 |
| 0.20 | Good | +0.075 |
| 0.25 | Noise-equivalent | 0.000 |
| 0.30 | Mild miscalibration | −0.075 |
| 0.40 | Severe miscalibration | −0.225 |

### 3.4 Stratification by Confidence Tier

The existing b1e55ed codebase implements a binding falsification test stratified by confidence tier. The Brier-based karma system maps directly:

| Confidence Tier | Range | Expected Karma Trajectory (well-calibrated) | Brier Impact |
|-----------------|-------|---------------------------------------------|--------------|
| Low | 0.55 – 0.65 | Slow positive drift (+0.01 to +0.03/epoch) | Small penalties/rewards per conviction |
| Medium | 0.65 – 0.80 | Moderate drift, higher variance (+0.03 to +0.08/epoch) | Calibration errors amplified |
| High | 0.80 – 0.99 | Fast drift in either direction (+0.05 to +0.15/epoch or equivalent negative) | Maximum skin in the game |

A well-calibrated low-confidence producer outperforms an overconfident high-confidence producer over sufficient epochs.

### 3.5 Karma Boundaries and Initialization

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Starting karma | 0.50 | Neutral — neither trusted nor distrusted |
| Minimum karma | 0.01 | Cannot reach zero. Always a path back. |
| Maximum karma | 1.00 | Ceiling earned through sustained excellence |
| Confidence floor | 0.55 | Submissions below 0.55 evaluated as 0.55 |

The confidence floor addresses loss-aversion. By treating anything below 0.55 as 0.55 for Brier calculation, the system makes defensive low-confidence flooding slightly costly and encourages honest expression.

### 3.6 Magnitude Bonus (Asymmetric)

Magnitude affects rewards but NOT penalties. When a producer is correct and the realized move exceeds their magnitude class: medium move (5–20%) = 1.2× karma gain; large move (>20%) = 1.5× karma gain.

When wrong: no magnitude multiplier. The Brier penalty alone determines the damage.

### 3.7 Independence Bonus

Each epoch, the network computes pairwise correlation between producer conviction vectors. If producer A's convictions correlate >0.85 with producer B's across 4+ consecutive epochs, the lower-karma producer's emissions are halved until correlation drops below 0.70.

Contrarian signals that prove correct receive a 1.15× karma gain multiplier.

-----

## 4. Network Alpha — The Emission Gate

### 4.1 The Conviction-Weighted Portfolio

Each epoch, the network constructs a hypothetical portfolio from the aggregate conviction signal:

```
Aggregate_Conviction_a = Σ_p (karma_p³ × eff_stake_p × direction_p × confidence_p)
                         ─────────────────────────────────────────────────────────
                                    Σ_p (karma_p³ × eff_stake_p)
```

The CWP longs assets where Aggregate_Conviction > +0.15, shorts where < −0.15, neutral otherwise. Position size proportional to |Aggregate_Conviction|, equal risk allocation normalized by trailing 30-day volatility.

The CWP is hypothetical — no capital is deployed.

### 4.2 Network Alpha

```
Network Alpha = CWP return (epoch) − Benchmark return (epoch)
```

Benchmark is the equal-weight return of the tracked asset universe. Published on-chain at epoch close. Anyone can verify it.

### 4.3 Alpha-Gated Emissions

| Network Alpha (weekly) | Emission Multiplier | Interpretation |
|------------------------|---------------------|----------------|
| ≤ 0% | 10% | Network subtracting value. Survival emissions only. |
| 0% – 0.5% | 25% | Marginal edge. |
| 0.5% – 2% | 50% | Meaningful alpha. System is working. |
| 2% – 5% | 75% | Strong alpha. |
| > 5% | 100% | Exceptional. Full emissions deserved. |

Illustrative weekly emissions at different alpha levels (Year 1):

| Alpha Gate | Weekly Emission | Per Producer (10) | Per Producer (50) |
|------------|-----------------|-------------------|-------------------|
| 100% | 466,344 | 46,634 | 9,327 |
| 75% | 349,758 | 34,976 | 6,995 |
| 50% | 233,172 | 23,317 | 4,663 |
| 25% | 116,586 | 11,659 | 2,332 |
| 10% | 46,634 | 4,663 | 933 |

-----

## 5. Entering the Network — Skill First, Capital Second

The system's internal sorting mechanism is "be good, not rich" — karma³ ensures calibration quality dominates capital. The entry mechanism must match this ethos. If the only way in is to buy tokens, capital gates participation and the design contradicts itself.

b1e55ed offers multiple entry paths. Skill is always sufficient. Capital is never required.

### 5.1 Shadow Mode (Permanent Onramp)

Any participant can register as a shadow producer at any time, with no token requirement. Shadow mode is not a one-time bootstrap event — it is a permanent, permissionless skill-proving mechanism that never closes.

Shadow producers:

- Submit convictions in the same format as staked producers
- Are scored by the same Brier system on the same scale
- Build karma identically to staked producers
- Carry zero weight in the Conviction-Weighted Portfolio
- Earn zero emissions
- Are visible in the network's producer registry with a shadow status flag

Shadow status is free, permissionless, and unlimited. Anyone with a Forge identity can enter and start building a verifiable track record against live market data.

### 5.2 Graduation

After meeting defined criteria, a shadow producer graduates to full staked status:

| Requirement | Value | Rationale |
|-------------|-------|-----------|
| Minimum shadow epochs | 8 (2 months) | Sufficient sample size for calibration signal |
| Minimum karma | 0.55 | Above starting neutral (0.50), demonstrating positive calibration |
| Minimum convictions | 80 total | Prevents cherry-picking a few lucky calls |
| Coverage compliance | ≥80% of declared set in ≥6 of 8 epochs | Consistent participation |

Upon graduation:

1. The Protocol Reserve grants the graduate 100 $BLESS — exactly the minimum stake
2. The grant is automatically staked on the graduate's behalf
3. Shadow karma carries over (not reset to 0.50)
4. The producer enters full active status with CWP weight and emission eligibility

The Protocol Reserve funds this from two income streams: 60% of all slashed tokens and 5% of consumer subscription revenue (insurance reserve). In steady state, the reserve can graduate approximately 2–5 new producers per epoch — sufficient to sustain network growth without depleting reserves.

Slashed tokens from bad producers literally fund the onboarding of better ones. The recycling loop is the system's immune response: poor calibration is metabolized into fuel for the next generation of proven talent.

### 5.3 Shadow as Scouting Pipeline

Shadow conviction data is recorded and scored even though it carries zero CWP weight. After graduation, the full shadow track record becomes part of the producer's public history.

Consumers and delegators can browse shadow producer records to identify promising newcomers before they graduate. The secondary market gains an information-rich pipeline of incoming talent.

### 5.4 Delegation

Shadow graduation gets producers to the minimum stake. But 100 $BLESS earns minimal emissions — the effective stake is low relative to established producers.

Delegation solves this without requiring the new producer to buy tokens.

Any $BLESS holder can delegate tokens to a staked producer:

- Delegated tokens add to the producer's effective stake (subject to the 3× median cap)
- The producer's karma determines emission weight — delegation adds capital, not skill
- Emission split: 80% to producer, 20% to delegator
- Delegator bears proportional slashing risk (if the producer is slashed, delegated tokens are slashed at the same rate)
- Delegation can be withdrawn with the same 4-epoch cooldown as unstaking
- A producer can accept delegation from multiple delegators
- A producer cannot self-delegate through a separate wallet (Forge identity check)

The 80/20 split reflects the value contribution: the producer does the work (models, convictions, calibration), the delegator provides capital. Delegating to a high-karma producer earns more than delegating to a low-karma producer because karma³ amplifies emissions — this creates the right incentive for delegators to seek out the most skilled producers.

### 5.5 Complete Accumulation Paths

| Path | Capital Required | Skill Required | Time to Participation |
|------|------------------|----------------|----------------------|
| **Shadow → Graduate** | None | Karma > 0.55 over 8 epochs | ~2 months |
| **Shadow → Graduate → Delegation** | None (delegator provides) | Same + attract a delegator | ~2–3 months |
| **Buy → Stake** | Market price of 100+ $BLESS | None upfront (will lose stake if miscalibrated) | Immediate |
| **Earn through contribution** | None | Technical skills (code, docs, integrations) | Variable |
| **Phase 0 participant** | None (time investment) | Repo contribution + producer signaling | Duration of Phase 0 |

The "buy" path still exists for producers who want to skip the proof period. It's just no longer the only door. Once staked, karma³ treats all producers identically regardless of how they entered.

-----

## 6. Staking and Emission Distribution

### 6.1 Producer Staking

To participate as a staked producer, you must hold a minimum of 100 $BLESS in stake. This minimum is the authorization gate — below it, a producer cannot publish weighted signals to the network. The gate can be reached through shadow graduation (protocol-funded), delegation, direct purchase, or contribution bounties.

Effective stake is capped to prevent whale domination:

```
effective_stake_p = min(actual_stake_p + delegated_stake_p, 3 × median(all_effective_stakes))
```

A producer who stakes 100× the median doesn't get 100× the emission weight. They get 3×. The cap applies to combined own + delegated stake.

### 6.2 Unstaking Cooldown

Unstaking requires a 4-epoch (1 month) cooldown. Stake remains locked and at-risk during cooldown. Karma changes and slashing apply normally. After 4 epochs, the unstaked amount is released.

**Emergency exit:** Forfeit 5% of stake to exit immediately. Forfeited tokens follow slashed token flow (60% reserve, 40% unissued supply).

Partial unstaking is permitted above the 100 $BLESS minimum. Cooldown applies to the unstaked portion only.

### 6.3 Producer Liveness

Producers must submit at least 1 conviction per epoch. Two consecutive zero-conviction epochs triggers automatic deregistration. Karma preserved for re-entry.

### 6.4 Emission Distribution Formula

```
emissions_p = actual_emission × (eff_stake_p × karma_p³) / Σ_q (eff_stake_q × karma_q³)
```

For producers with delegated stake, the emission split applies: 80% to the producer, 20% distributed pro-rata to delegators. The producer's own-stake portion is not split.

Distribution example — 10 producers, Year 1, 75% alpha gate (349,758 $BLESS available):

| Producer | Karma | karma³ | Share | Weekly Earnings |
|----------|-------|--------|-------|-----------------|
| #1 | 0.90 | 0.729 | 20.9% | 72,993 |
| #2 | 0.85 | 0.614 | 17.6% | 61,491 |
| #3 | 0.80 | 0.512 | 14.7% | 51,265 |
| #4 | 0.75 | 0.422 | 12.1% | 42,241 |
| #5 | 0.70 | 0.343 | 9.8% | 34,344 |
| #6 | 0.65 | 0.275 | 7.9% | 27,498 |
| #7 | 0.60 | 0.216 | 6.2% | 21,628 |
| #8 | 0.55 | 0.166 | 4.8% | 16,659 |
| #9 | 0.50 | 0.125 | 3.6% | 12,516 |
| #10 | 0.45 | 0.091 | 2.6% | 9,124 |

*Assumes equal effective stake. Top producer earns 8× bottom producer with identical stake.*

### 6.5 Minimum Stake Decay

If stake falls below 100 $BLESS, 2-epoch grace period. If not restored, deregistration (karma preserved). Re-register at any time by restaking above 100.

-----

## 7. Slashing — Penalizing Miscalibration, Not Volatility

### 7.1 Calibration-Based Slashing

Slashing triggers only when epoch Brier score exceeds 0.35:

```
If epoch_BS > 0.35:
    slash_rate = min(0.15 × (epoch_BS − 0.35), 0.10)
    slashed_amount = (own_stake + delegated_stake) × slash_rate
```

| Epoch Brier Score | Slash Rate | On 1,000 $BLESS |
|-------------------|------------|-----------------|
| ≤ 0.35 | 0% | 0 |
| 0.40 | 0.75% | 7.5 |
| 0.50 | 2.25% | 22.5 |
| 0.70 | 5.25% | 52.5 |
| 0.90 | 8.25% | 82.5 |

Maximum slash per epoch: 10%. Delegated tokens are slashed at the same rate as own-stake — delegators bear real risk, which is what makes delegation a genuine capital allocation decision rather than a free option.

### 7.2 Slashed Token Flow

- 60% → Protocol Reserve (funds shadow graduations, insurance, cold-start subsidies)
- 40% → Unissued Supply (recycled into future emissions)

The reserve's primary ongoing function is funding shadow graduations. Bad signal is metabolized into better signal.

### 7.3 Abstention and Coverage

Producers must submit convictions on ≥80% of their declared coverage set per epoch. First miss: warning. Second consecutive: karma × 0.95. Third consecutive: deregistration (karma preserved).

Low-confidence submissions (0.55) count toward coverage.

-----

## 8. Consumer Access and Fee Capture

The conviction network produces two distinct data products: the aggregate signal (the CWP — the network's collective view) and the provider-level signal (individual producer convictions, karma histories, and decomposed contributions to the aggregate).

Consumer tiers gate access along both dimensions — what data you see, how fresh it is, and whether you can see inside the aggregate to the individual providers who compose it.

### 8.1 Consumer Tiers

| Tier | Cost / Epoch | Signal Access | Provider Access | Delivery |
|------|--------------|---------------|-----------------|----------|
| Observer | Free | 72h delayed aggregate direction only (long/short/neutral per asset) | None — aggregate is opaque | Public dashboard |
| Standard | 50 $BLESS | 24h delayed aggregate with direction + confidence values | None | Authenticated feed |
| Real-time | 200 $BLESS | Live aggregate feed + full historical CWP data | Producer count per asset (how many producers contributed to each signal) | Authenticated feed + historical API |
| Professional | 500 $BLESS | Live aggregate + full conviction decomposition | **Full provider-level access**: per-producer karma scores, individual conviction histories, contribution weight to each aggregate signal, producer coverage sets | Authenticated feed + provider API |
| Institutional | 2,000 $BLESS | Everything in Professional + backtestable datasets + custom coverage queries | Full provider-level + ability to construct custom aggregates (re-weight producers, filter by karma threshold, build sub-portfolios from specific provider subsets) | Full API access + bulk export |

The Observer tier is permanently free. Let people verify that the network produces alpha before they spend anything.

### 8.2 How Gating Works

Access is token-gated at the API and feed layer. Each consumer registers with a wallet holding $BLESS and selects a tier. The subscription is paid at the start of each epoch. If payment is missed, the consumer is downgraded to Observer at the end of the current epoch (no mid-epoch interruption — consumers who have paid for an epoch receive full access for that epoch regardless of subsequent actions).

**Aggregate gating:** Observer and Standard tiers see only the network's composite output. The aggregate conviction per asset is a single number in [−1, +1] — the result of the karma³-weighted aggregation function across all contributing producers. At these tiers, the consumer cannot determine whether a signal comes from 3 producers or 30, or whether it is driven by one high-karma producer or consensus across many. The aggregate is deliberately opaque at lower tiers to protect producer privacy and to create the commercial incentive for upgrading.

**Provider-level gating:** Professional and Institutional tiers can see through the aggregate to the individual producers. This includes each producer's karma score, their specific conviction on each asset (direction, confidence, magnitude), and their historical calibration curve. This is the data layer where sophisticated consumers — funds, trading desks, and AI agents building custom strategies — extract maximum value.

The provider-level data enables consumers to:

- Identify which producers drive the aggregate signal on specific assets
- Discover producers with edge on niche coverage sets (e.g., a producer with 0.92 karma on DeFi tokens but no coverage of L1s)
- Build custom conviction aggregates that weight certain producers more heavily based on the consumer's own assessment
- Backtest against individual producer track records, not just the network aggregate
- Evaluate whether to delegate to specific producers (Section 5.4)

### 8.3 Fee Structure

Subscription-based, not query-based. Institutional tier consumers pay 2,000 $BLESS per epoch for unlimited API access. Per-query pricing is not implemented — subscription access avoids metering complexity and per-call gas overhead. Per-query pricing may be introduced via governance after Phase 3 if demand warrants it.

Fee discounts are not offered to token holders or stakers. Consumer pricing is uniform. The token's utility for producers is emission eligibility and conviction weight, not fee reduction. This avoids securities classification risk.

### 8.4 Revenue Flow

```
Consumer subscriptions → Protocol Treasury
                            ↓
                     Treasury Split:
                80% → Quarterly Buyback-and-Recycle
                15% → Development Fund
                5% → Insurance Reserve (→ Protocol Reserve)
                            ↓
        Buyback: purchased $BLESS returns to unissued supply pool
```

The 5% insurance reserve flows into the Protocol Reserve, which funds shadow graduations and contribution bounties. All consumer fees flow to treasury — no direct distribution to holders or producers. Value accrues through buyback pressure, not dividends.

-----

## 9. Ecosystem Composition — Network-Agnostic by Design

b1e55ed is sovereign infrastructure. It is not built on, dependent on, or locked to any specific settlement layer, L1, or ecosystem token. The oracle evaluates against cross-chain price feeds. The Forge uses chain-portable EAS attestations. The signal format is protocol-agnostic.

The deployment surface is a spectrum: $BLESS can deploy on an existing EVM-compatible chain for immediate liquidity infrastructure, launch as a dedicated appchain for sovereignty over block space and fee economics, or — at sufficient scale — operate its own network layer where producers serve as oracle nodes, conviction submission is a first-class transaction type, and the CWP construction runs as a native protocol function rather than a smart contract.

The architecture supports all three. The choice is made based on network maturity, not architectural constraint.

### 9.1 Current Composition: Post Fiat

b1e55ed operates within the Post Fiat ecosystem because the fit is genuine, not because the architecture requires it.

**Complementary verification.** PFT verifies effort (proof-of-work). $BLESS verifies edge (proof-of-foresight). Neither can solve the other's problem. PFT reputation provides a useful cold-start signal for producers entering b1e55ed. $BLESS karma provides a specialized vector PFT's generalist scoring cannot replicate.

**Governance weight as strategic optionality.** PFT accumulated through b1e55ed Task Node work accrues governance weight in Post Fiat's settlement infrastructure. This is valuable as a plausible future clearing rail — but "plausible future rail" is not "required dependency." The governance weight is an option, not an obligation.

**Cultural alignment without structural coupling.** Cultural fit makes collaboration natural. But cultural alignment is a reason to work together, not a reason to merge architectures.

### 9.2 What This Means for $BLESS

$BLESS is not a subnet token. Consumer payments settle on whatever network $BLESS is deployed on — which may be an existing chain, a dedicated appchain, or b1e55ed's own network layer.

The token interaction with any ecosystem is elective composition, not structural dependency. The system's value is in signal quality and attribution integrity. The settlement layer is infrastructure — replaceable, composable, always in service of the signal.

-----

## 10. Circuit Breakers

### 10.1 Systemic Event Declaration

If >50% of producers have epoch Brier score >0.30: systemic event declared. Slashing suspended, karma changes halved, emissions reduced to 25% of alpha-gated rate. Duration: 1 epoch. Maximum 2 consecutive before governance vote.

### 10.2 Oracle Failure Mode

Oracle unavailable >4 hours: affected assets excluded. >50% of assets affected: epoch voided. Voided epochs don't affect the decay schedule.

### 10.3 Minimum Viable Network

Below 5 active producers or 20 convictions per epoch: survival emissions (10%), no slashing, karma changes apply normally, alpha gate suspended.

-----

## 11. Declared Coverage Sets

### 11.1 How Coverage Sets Work

Each producer declares ≥20 assets. Must submit on ≥80% per epoch. Karma evaluated within declared set only. Updates once per 4 epochs.

### 11.2 Network Coverage Incentive

Assets covered by <3 producers: 1.3× karma gain. Covered by 3–5: 1.1×. Covered by >5: 1.0×.

### 11.3 Minimum Universe

50 assets minimum. Changes via governance (Phase 3+) or protocol committee (Phase 0–2).

-----

## 12. Cold Start — From Shadow to Sovereignty

### Phase 0: Testing (Pre-Token)

No token exists. The focus is testing and hardening the b1e55ed software — the conviction scoring engine, the oracle evaluation pipeline, the Forge identity system, the CWP construction, and the producer registration flow.

This is not a simulation. Producers submit convictions against live market data. The system scores them with real Brier evaluation. Everything is recorded with full provenance.

Phase 0 runs until the token goes live. Duration is indeterminate — the software ships when it's ready, not on a calendar.

- Minimum 5 producers actively submitting and being scored
- Network Alpha calculated and published weekly (Observer tier, free)
- All records hash-chained and provenance-stamped
- Active participants contribute across two dimensions: repo work (code, documentation, integrations, bug reports, architecture) and producer signaling (conviction submissions scored against live markets)
- Both dimensions are tracked and attributed throughout Phase 0

**Retroactive allocation:** 5% of total supply (9,326,873 $BLESS) is reserved for Phase 0 participants. At token launch, this allocation distributes retroactively based on a composite score of repo contribution and producer signaling quality. The weighting is exponential — top contributors receive disproportionately more. The composite accounts for both building the system (repo) and proving the system works (signaling). Neither dimension alone is sufficient for a large allocation; the people who build AND signal are the ones the network most needs to retain.

**Transition criteria:** Software passes security review, ≥5 active producers with ≥12 scored epochs, AND cumulative Network Alpha > 0% across the scored window.

### Phase 1: Genesis

Token launches. Network-agnostic deployment.

- $BLESS deploys to whatever network best serves the system at launch — an existing L1/L2, a dedicated appchain, or b1e55ed's own network layer with producers acting as oracle nodes. The architecture does not assume or require a specific chain. Deployment target is a governance-level decision made during Phase 0 based on cost, throughput, oracle feed availability, and liquidity infrastructure.
- Phase 0 retroactive allocation (5% of supply) distributes to participants based on composite repo + signaling score
- Remaining 95% enters the emission pool governed by Brier decay (0.25%/epoch of remaining)
- 3× emission multiplier for first 26 epochs (boosted incentives for early post-launch commitment)
- Protocol-owned liquidity: 5% of Phase 1 boosted emissions directed to a liquidity allocation, paired with a stablecoin in a concentrated DEX position. Protocol owns this liquidity permanently and earns trading fees. Initial price set by protocol committee based on Phase 0 track record valuation.
- Shadow mode remains open — new producers continue entering via the permanent onramp
- Observer tier (free) and Standard tier (half price: 25 $BLESS/epoch) available publicly

**Transition:** ≥15 active producers, ≥3 paying consumers, 6 consecutive positive-alpha epochs.

### Phase 2: Growth

Full tiers activate. Treasury accumulates. Delegation enabled.

- All consumer tiers live at full pricing
- Producer staking by consumers and delegation both enabled
- First quarterly buyback-and-recycle executed
- Emission multiplier decays from 3× to 1× linearly
- Governance forum opens (discussion only)

**Transition:** ≥50 active producers, ≥20 paying consumers, quarterly buyback > 0.

### Phase 3: Steady State (Month 12+)

Full sovereignty. On-chain governance. Protocol committee dissolves. Contribution bounties funded from reserve. Network targets self-sustaining flywheel: buyback revenue ≥ development fund needs.

-----

## 13. Anti-Sybil and Gaming Defenses

### 13.1 Identity Anchoring

Forge identity — cryptographic attestation binding producer identity to a persistent, non-transferable key pair. Cannot register new wallet to reset bad karma.

### 13.2 Correlation Detection

Pairwise correlation >0.85 across 4+ epochs: lower-karma copycat's emissions halved.

### 13.3 Wash Prevention

Producers cannot self-delegate. Forge identity check enforced at protocol level.

### 13.4 Oracle Manipulation Defense

TWAP resolution (not spot), 4h minimum window, low-liquidity discount (0.5×), solo-signal cap (0.5× karma gain).

-----

## 14. Risk Factors and Attack Vectors

### 14.1 Risk Summary

| # | Threat | Severity | Mitigation |
|---|--------|----------|------------|
| 1 | Sybil producers | High | Forge identity anchoring, non-transferable attestations |
| 2 | Stake concentration | High | 3× median effective stake cap, karma³ exponent |
| 3 | Copycat signals | High | Correlation detection, 4-epoch lookback, emissions halving |
| 4 | Oracle manipulation | Medium | TWAP, 4h window, low-liquidity discount, solo-signal cap |
| 5 | Abstention gaming | Medium | 80% coverage, declared sets, scarcity bonus |
| 6 | Reflexive feedback | Medium | Circuit breaker, systemic event suspension |
| 7 | Shadow graduation gaming | Medium | 8-epoch minimum, 80 convictions, 0.55 karma threshold, Forge limits one track per person |
| 8 | Phase 0 allocation gaming | Medium | Composite scoring (repo + signaling, not either alone), exponential weighting rewards sustained contribution over last-minute sprints, protocol committee reviews allocation before distribution |
| 9 | Delegation collusion | Medium | Delegators bear proportional slash risk, Forge prevents self-delegation |
| 10 | Low-confidence flooding | Low | Confidence floor, karma³ makes low-karma emissions negligible |
| 11 | Regulatory classification | Medium | No direct distribution, buyback not dividends, governance stake separated |

### 14.2 Additional Risk Factors

**Demand-side risk.** Consumer subscriptions must be proven. The free Observer tier is the marketing mechanism.

**Oracle dependency.** System integrity depends on Pyth/Chainlink accuracy.

**Reflexivity.** Published CWP can create self-fulfilling loops. Circuit breaker is primary defense.

**Regime sensitivity.** Choppy markets suppress alpha and emissions. 10% survival rate prevents death spiral but not attrition.

**Regulatory exposure.** Formal legal review required before token launch.

-----

## 15. Parameter Summary

| Parameter | Value | Derivation | Governable? |
|-----------|-------|------------|-------------|
| Max supply | 186,537,453 | 0xB1E55ED | No |
| Phase 0 retroactive allocation | 5% of supply | Earned (repo + signaling) | No |
| Emission pool | 95% of supply | Brier decay on remainder | No |
| Emission decay | 0.25% / epoch | Brier noise floor | No |
| Team allocation | 0% | Fair launch | No |
| Epoch length | 1 week | — | No |
| Deployment network | TBD in Phase 0 | Network-agnostic | Yes (governance) |
| Karma exponent | 3 (cubic) | Mechanism design | Yes |
| Karma SCALE | 1.5 | Mechanism design | Yes |
| Reference Brier | 0.25 | Mathematical constant | No |
| Slash threshold | 0.35 | Mechanism design | Yes |
| Slash base | 0.15 | Mechanism design | Yes |
| Max slash / epoch | 10% | Safety cap | Yes |
| Stake cap | 3× median | Anti-whale | Yes |
| Minimum stake | 100 $BLESS | Authorization gate | Yes |
| Unstaking cooldown | 4 epochs | Anti-gaming | Yes |
| Emergency exit fee | 5% of stake | Panic-exit cost | Yes |
| Confidence floor | 0.55 | Anti-loss-aversion | Yes |
| Shadow min epochs | 8 | Graduation proof period | Yes |
| Shadow min karma | 0.55 | Graduation threshold | Yes |
| Shadow min convictions | 80 | Anti-cherry-pick | Yes |
| Graduation grant | 100 $BLESS | Minimum viable stake | Yes |
| Delegation split | 80% producer / 20% delegator | Value attribution | Yes |
| Delegation cooldown | 4 epochs | Same as unstaking | Yes |
| Phase 1 liquidity allocation | 5% of boosted emissions | Market creation | No |
| Coverage set min | 20 assets | Specialization | Yes |
| Coverage submission | 80% | Anti-cherry-pick | Yes |
| Liveness threshold | 1 conviction / epoch | Uptime equivalent | Yes |
| Systemic threshold | 50% of producers > 0.30 BS | Safety | Yes |
| Correlation threshold | 0.85 | Anti-copy | Yes |
| Independence bonus | 1.15× | Contrarian incentive | Yes |
| Consumer tiers | See Section 8 | Revenue model | Yes |
| Treasury split | 80 / 15 / 5 | Revenue allocation | Yes |
| Low-liquidity discount | 0.5× | Anti-manipulation | Yes |

Immutable parameters define what the system is. Governable parameters let the network adapt to empirical conditions.

-----

## 16. The Proof of Conviction

A forecast without skin in the game is an opinion. A forecast with capital at risk but no calibration measurement is a gamble. A forecast with capital at risk, calibration measurement, identity-anchored provenance, and deterministic resolution is a conviction.

$BLESS is the instrument that makes conviction economically real. It resolves the Grossman-Stiglitz paradox by compensating information production directly. It maintains honesty through calibration-based scoring that rewards producers for knowing what they don't know as much as for knowing what they do. It measures its own value through Network Alpha — a publicly verifiable, on-chain metric that anyone can audit.

The entry is open: prove your calibration, and the system funds your participation. The sorting is honest: skill earns more than capital. The earliest participants earn through building and testing, not through investing.

The supply is the system's own name. The emission rate is the system's own evaluation benchmark. Nothing is borrowed. Everything is earned.
