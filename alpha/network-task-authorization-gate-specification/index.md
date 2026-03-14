---
layout: default
title: "Network Task Authorization Gate Specification"
date: 2026-03-14
category: mechanism-design
status: published
---

# Network Task Authorization Gate Specification

**Task ID:** [e16cfe55-0c94-4000-91b4-b7e55242d606](https://tasknode.postfiat.org/tasks/e16cfe55-0c94-4000-91b4-b7e55242d606/forensics)  
**Author:** Permanent Upper Class Validator (b1e55ed Oracle Node Operator)  
**Date:** 2026-03-14

---

## The Problem

The Post Fiat Network's #2 all-time earner extracted ~1M PFT without authorization, without contacting the core team, and without triggering any enforcement response until the gap was identified after the fact.

This wasn't a failure of permissionlessness. It was a failure of three specific system properties:

1. **No contributor-level authorization state** — the verification pipeline validated task completions with no concept of whether the contributor was operating within the intended participation model
2. **No entry-point communication** — the Proof of Alignment model wasn't communicated at the point of entry
3. **No emission ceiling** — PFT minted without epoch constraints creates an unbounded extraction surface

This specification defines a Task Authorization Gate that closes these gaps.

---

## What This Deliverable Contains

Three documents, progressing from accessible to comprehensive:

### 1. [Contributor Guide](./contributor-guide/)

**For:** New and prospective contributors  
**Length:** ~1,400 words  
**Purpose:** Clear, human-readable explanation of how earning works

This is the public-facing document. It explains:
- What PFT is and how earning works
- The four contributor levels (New → Probationary → Authorized → Trusted)
- How to move up and what determines your weight
- The Founder's Pledge
- FAQs

No implementation details. No mechanism design jargon. Just "here's how the system works for you."

---

### 2. [Naive Specification v3.0](./specification/)

**For:** Core team, initial reviewers  
**Length:** ~5,800 words  
**Purpose:** The straightforward version — what the system does

This is the baseline mechanism design. It covers:
- **Extraction detection and steering** — AI-driven pattern detection with redirect-first philosophy
- **Epoch-bound emission** — 28-day periods with bounded PFT budgets
- **Authorization state machine** — 5 states with defined transitions
- **The Founder's Pledge** — wallet-signed entry commitment
- **Integration points** — where gates insert into the existing pipeline
- **Rollout plan** — 4 phases from testnet to algorithmic authorization

The v3 framing: a sophisticated extractor is demonstrating capability. Redirect that capability toward alignment rather than blocking it.

---

### 3. [Battle-Tested Specification v4.0](./specification-v4/)

**For:** Core team, implementers, adversarial reviewers  
**Length:** ~7,200 words  
**Purpose:** The hardened version — what happens when smart people try to break it

This is the robust specification after attack surface analysis. It asks: "What if detection fails? What if extractors adapt? What if cartels form at TRUSTED level?"

**Key additions over v3:**

| Problem | v3 Approach | v4 Hardening |
|---------|-------------|--------------|
| Single score governs everything | 30-day composite | **Three separated ledgers** (eligibility, rewards, trust) with different time horizons |
| Early-state extraction | Detection-based | **Vesting by state** — UNKNOWN gets 0% liquid, PROBATIONARY gets 25%, rest vests over 30 days |
| Extractors adapt to detection | Entry-focused monitoring | **Detection at all tiers** — AUTHORIZED extraction is highest-damage |
| All extractors treated the same | Uniform redirect | **Extractor typology** — Type I/II redirect, Type III redesign incentives, Type IV enforce |
| Superstar captures epoch | Unbounded | **15% concentration cap** per control graph |
| Alpha classification gaming | Unspecified | **Governance hardening** — blinding, rotation, 30-day audit, published rationale |
| No room for contrarian work | Tight alignment scoring | **5% exploration allowance** for roadmap-divergent value |
| "One identity" is wrong primitive | Single wallet | **Declared control graph** — teams, automation stacks, beneficial control |
| Conflicting signals | Unspecified | **Constitutional hierarchy** — who overrides whom, logged with reason |

The v4 design principle: the bounded-risk architecture must hold even when detection fails.

---

## Core Mechanism Summary

### Authorization States

```
UNKNOWN ──► PROBATIONARY ──► AUTHORIZED ──► TRUSTED
    │              │              │              │
    └──────────────┴──────────────┴──────────────┴──► SUSPENDED

[Extraction detection active at ALL states]
[Vesting: 0% → 25% → 100% liquid by state]
```

| State | Access | Earnings | Key Gate |
|-------|--------|----------|----------|
| 🔵 UNKNOWN | Tier 1 only, 1 task/48h | 0% liquid (pending) | Sign Founder's Pledge |
| 🟡 PROBATIONARY | Tier 1+2, 3 tasks/24h | 25% liquid, 75% vests 30d | 14 days minimum |
| 🟢 AUTHORIZED | All tiers, no limit | 100% liquid | 10 completions + auth request |
| 🌟 TRUSTED | All tiers + governance | 100% liquid, 1.2× weight | 90 days + nomination + ZK identity |
| ⛔ SUSPENDED | None | Frozen | Core team action only |

### Three Ledgers (v4)

| Ledger | Governs | Updates | Gaming Resistance |
|--------|---------|---------|-------------------|
| **Eligibility** | Which state, which tasks | Per epoch (28d) | Minimum durations, slow-moving |
| **Rewards** | Epoch budget share | Daily | Concentration caps, blinded review |
| **Trust** | Governance rights | Monthly | 90+ day history, peer nomination, path-dependent |

### Vesting Schedule

| State | Immediate | Vesting |
|-------|-----------|---------|
| UNKNOWN | 0% | 100% pending (released on advancement, forfeited after 60d) |
| PROBATIONARY | 25% | 75% linear over 30 days post-epoch |
| AUTHORIZED+ | 100% | None |

This makes wallet rotation economically punishing even when detection fails.

### Task Tiers

| Tier | Type | Weight | Classification |
|------|------|--------|----------------|
| 1 | Personal | 1× | Automated |
| 2 | Network | 3× | Core team (TRUSTED reviewable) |
| 3 | Alpha | 9× | Core team only + published rationale + 30d audit |

---

## The Economic Target

For any rational high-skill newcomer:

> **NPV(cooperation through authorization) > NPV(burst extraction under best evasion strategy)**

This isn't aspirational. It's a verifiable constraint the mechanism either satisfies or doesn't.

The v4 architecture achieves this through layered containment:
1. Vesting delays liquidity for early-state contributors
2. Rate limits bound throughput before authorization
3. Concentration caps prevent epoch dominance
4. Detection adds friction (but isn't the primary defense)
5. Task routing keeps high-value surfaces locked until trust is demonstrated

---

## What Kind of Network This Is

This specification implements **Model A: a curated high-trust contributor network**.

People may arrive permissionlessly, but meaningful earning and governance is gated by demonstrated alignment and social trust.

The network is honest about being curated. It invites contribution, but it does not promise that all contribution is equal.

---

## Open Questions

These are flagged for network discussion before finalization:

1. Is 75% vesting over 30 days the right PROBATIONARY schedule?
2. Should the 15% concentration cap be higher for mainnet?
3. Is 5% exploration allowance enough to protect innovation?
4. Which ZK identity protocols should be supported first?
5. Should automation stacks have a separate governance track?
6. What are the success metrics for this mechanism?

---

*Published by Permanent Upper Class validator operation.*  
*Task completed for the Post Fiat Network.*
