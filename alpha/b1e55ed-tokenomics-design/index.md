---
layout: default
title: "$BLESS — Proof of Conviction"
date: 2026-03-14
category: tokenomics
status: published
---

# $BLESS — Proof of Conviction

**Tokenomics of the b1e55ed Signal Network v6**

---

## The Problem

In 1980, Grossman and Stiglitz proved that informationally efficient markets are impossible. If prices already reflect all information, no one has an incentive to gather it. If no one gathers it, prices can't reflect it.

**$BLESS resolves the paradox.** Signal producers are compensated through token emissions independent of whether they trade on their information. The payment comes from the token mechanism, not from the market.

---

## Documents

### [Consumer Guide →](./consumers/)

**Visual infographic** covering:
- Supply architecture (0xB1E55ED = 186,537,453)
- Emission curve (smooth decay, no halvings)
- Alpha gate (no value, no inflation)
- Karma³ distribution (skill > capital)
- Entry paths (shadow → graduate → delegation)
- Consumer tiers (aggregate vs. provider-level access)
- The flywheel

*Interactive charts. Dark terminal aesthetic.*

---

### [Full Specification →](./tokenomics/)

**Complete tokenomics document** (6,000+ words) covering:
- Why the token must exist
- The flywheel mechanics
- Supply and emission (Brier decay)
- Karma system (calibration as reputation)
- Network alpha gate
- Staking and slashing
- Consumer access and fee capture
- Anti-sybil defenses
- Risk factors
- Full parameter tables

*Deep technical detail. All numerical parameters specified.*

---

## TLDR

| Parameter | Value |
|-----------|-------|
| **Max Supply** | 186,537,453 (0xB1E55ED) |
| **Team Allocation** | 0% |
| **Emission Decay** | 0.25% / epoch (= Brier noise floor) |
| **Half-Life** | 5.3 years |
| **Epoch Length** | 1 week |

### Core Mechanics

```
$BLESS should appreciate if and only if the network produces genuine predictive alpha.
If it doesn't, the token should be worthless. That is honest tokenomics.
```

**Alpha Gate:** Emissions flow proportional to measurable network alpha (CWP vs. benchmark). No alpha → 10% survival emissions. 5%+ alpha → 100% emissions.

**Karma³ Distribution:** `emissions = stake × karma³`. Same stake, different calibration → 8× earnings difference. Skill dominates capital.

**Shadow Mode:** Prove calibration with zero tokens. Graduate, and the protocol funds your participation. Entry is skill-gated, not capital-gated.

**Consumer Tiers:** Free Observer tier (72h delayed) → Institutional (2,000 $BLESS/epoch for full provider-level access + custom aggregates).

**Slashing:** Triggers on Brier > 0.35 (miscalibration). Slashed tokens fund the Protocol Reserve → graduate better producers. Bad signal → better signal.

---

## The Flywheel

```
Shadow → Graduate → Stake → Produce → Alpha → Emit → Earn
                ↑                                      ↓
                └────────── Consumers pay ─────────────┘
                           ↓
                    Treasury → Buyback → Reserve → Graduate more
```

Slashed tokens from miscalibrated producers literally fund the onboarding of better ones.

---

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Supply = 0xB1E55ED | System names itself. No borrowed parameters. |
| Decay = 0.25% | Brier noise floor. Scoring math = monetary policy. |
| Karma³ not karma¹ | Cubic exponent makes skill dominant over capital. |
| Alpha-gated emission | No inflation without value creation. |
| Shadow graduation | Skill-first entry. Protocol funds proven talent. |
| No team allocation | 100% earned through contribution or production. |
| PFT complementary | $BLESS is collateral/governance; PFT is settlement. |

---

## What $BLESS Is Not

- **Not a payment token** — fees settle elsewhere
- **Not inflationary by default** — alpha gates emission
- **Not capital-gated** — shadow mode is always open
- **Not chain-locked** — sovereign infrastructure, network-agnostic

---

*Published by Permanent Upper Class validator operation.*  
*Task completed for the Post Fiat Network.*
