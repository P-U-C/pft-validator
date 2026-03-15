---
layout: default
title: "Sybil-Resistant Control Graph Linking Layer"
date: 2026-03-15
category: mechanism-design
status: published
---

# Sybil-Resistant Control Graph Linking Layer

**Task ID:** [7122296e-b27f-4953-8d41-4616216633ee](https://tasknode.postfiat.org/tasks/7122296e-b27f-4953-8d41-4616216633ee/forensics)  
**Author:** Permanent Upper Class Validator (b1e55ed Oracle Node Operator)  
**Date:** 2026-03-15  
**Predecessor:** [Authorization Gate v4.0](../network-task-authorization-gate-specification/)

---

## The Gap This Closes

The [Authorization Gate v4.0](../network-task-authorization-gate-specification/) defines a 15% per-control-graph concentration cap. But that cap is only as strong as the system's ability to detect *undeclared* common control.

A sophisticated operator who spins up five wallets without declaring them as associated can capture 5 × 15% = 75% of an epoch budget while appearing to be five independent contributors — unless a linking layer catches the correlation.

This specification patches that critical gap.

---

## What's New in v4.1

### 1. Gap-Filling Incentives (Section 5.5.1–5.5.3)

The network publishes a **domain coverage map** at epoch open. Contributors filling underserved domains earn a **+0.3 CGI boost**; saturated domains incur **−0.1 drag**.

New contributors get **gap-aware task routing** based on declared preference, transitioning to demonstrated capability at 10+ completions.

**The core insight:** A sybil farm maximizing CGI must spread across gaps — the optimal attack becomes indistinguishable from genuine contribution.

### 2. Sybil-Resistant Control Graph Linking Layer (Section 12)

Four behavioral fingerprinting heuristics produce a **composite linking score** per wallet pair:

| Heuristic | What it detects | Score weight |
|-----------|-----------------|--------------|
| Submission cadence clustering | Correlated activity rhythms | 1.2 |
| Verification artifact similarity | Shared writing/structural patterns | 1.0 |
| Withdrawal pattern correlation | Destination overlap, timing patterns | 1.5 (destination overlap) |
| Memo field n-gram analysis | Linguistic fingerprints | 0.8 |

**Escalation ladder:**
- Score ≥ 1.5 → Soft flag (logged, monitored)
- Score ≥ 2.5 → Declaration prompt (14-day window)
- Score ≥ 3.5 → Provisional cap grouping + manual review
- Score ≥ 4.5 or destination overlap → Immediate grouping + expedited review

**Registration stakes** (10–200 PFT equivalent by state) make undeclared wallet creation economically costly. Stakes are slashed for confirmed undeclared control graph membership.

The 15% concentration cap is enforced against **both declared and provisionally-detected control graphs**.

---

## What This Deliverable Contains

### 1. [Full Specification v4.1](./specification-v41/)

**For:** Core team, implementers, adversarial reviewers  
**Length:** ~12,000 words  
**Purpose:** Complete Authorization Gate specification with all v4.1 additions

Includes the full v4.0 content plus:
- Network coverage map and gap-filling CGI mechanics
- Complete linking layer specification with detection thresholds
- Staking-based identity binding with slashing conditions
- Three-tier escalation workflow
- Two adversarial worked examples
- Five integration points with existing pipeline
- Extended Authorization Registry schema

### 2. [Contributor Guide Update v4.1](./contributor-guide-v41/)

**For:** New and prospective contributors  
**Length:** ~600 words  
**Purpose:** What contributors need to know about staking and linking

Addendum to the [original Contributor Guide](../network-task-authorization-gate-specification/contributor-guide/). Covers:
- Registration stake requirements
- What happens if you're flagged by the linking layer
- Gap-filling bonuses and how to earn them
- Multi-wallet team setup guidance

---

## Key Design Principles

### Declaration Is Foundational

The linking layer doesn't flag *correlation* — it flags the **gap between declared and observed**.

Example A (extractor): Five wallets claim independence, show correlated behavior → **flagged**.

Example B (legit team): Four wallets declare as team, show correlated behavior → **expected, no action**.

The difference is the declaration, not the signals.

### Behavioral Detection + Economic Deterrence

Detection is probabilistic — sophisticated operators can adapt. But staking makes undeclared wallets *expensive* even when detection fails:

- Each wallet requires 10–200 PFT equivalent stake
- PROBATIONARY wallets earn only 25% liquid; 75% vests and is forfeited on suspension
- Detection triggers stake slashing (50–100%)
- Expected value of 5-wallet sybil operation is **negative** unless P(detection) < ~15%

### The Optimal Attack Becomes the Optimal Contribution

Gap-filling incentives mean a sybil operator maximizing CGI must spread wallets across underserved domains. This is exactly what the network wants. The attack surface is neutralized because the adversarial optimum produces genuine value.

---

## Integration Summary

The linking layer connects to the Authorization Gate at five points:

1. **Authorization Registry** — adds `linking_flag`, `suspected_control_graph_id`, `linking_score`, `registration_stake` fields
2. **Eligibility Ledger** — pauses state advancement while wallet is under review
3. **Rewards Ledger** — applies 15% cap at control-graph level (declared + provisional)
4. **Concentration Cap Enforcement** — consumes both declared and detected groupings
5. **Task Node Scoring Pipeline** — routes flagged wallets to independent reviewer pool

---

## Open Questions (Carried from v4.0 + New)

1. Is 75% vesting over 30 days the right PROBATIONARY schedule?
2. Should the 15% concentration cap be higher for mainnet?
3. **New:** Are the linking score thresholds (1.5 / 2.5 / 3.5 / 4.5) correctly calibrated?
4. **New:** Should registration stakes scale with network PFT price, or be governance-adjusted?
5. **New:** What is the right appeal SLA at scale?

---

*Published by Permanent Upper Class validator operation.*  
*Task completed for the Post Fiat Network.*
