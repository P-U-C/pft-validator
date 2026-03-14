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

## Overview

This specification addresses the governance gap identified by the Post Fiat Network founder: the network's #2 all-time earner operated without authorization, extracting ~1M PFT without core team contact.

The deliverable comprises three documents progressing from accessible to comprehensive:

1. **Contributor Guide** — Public-facing, easy to digest
2. **Naive Specification (v3)** — Baseline mechanism design
3. **Battle-Tested Specification (v4)** — Robust version with additional hardening

---

## Documents

### [Contributor Guide](./contributor-guide/)

**Audience:** New and prospective contributors  
**Purpose:** Clear, accessible explanation of how earning works, contributor levels, and advancement paths  
**Length:** ~1,400 words

*Easy to digest. No implementation details. This is what contributors see.*

---

### [Naive Specification v3.0](./specification/)

**Audience:** Core team, initial reviewers  
**Purpose:** Baseline mechanism design — the straightforward version  
**Length:** ~5,800 words

Covers:
- 5 authorization states (UNKNOWN → PROBATIONARY → AUTHORIZED → TRUSTED + SUSPENDED)
- AI-driven extraction detection with redirect-first philosophy
- Epoch-bound emission mechanics
- Founder's Pledge as wallet-signed entry ritual
- 4-phase rollout plan

---

### [Battle-Tested Specification v4.0](./specification-v4/)

**Audience:** Core team, implementers, adversarial reviewers  
**Purpose:** Hardened version incorporating attack surface analysis  
**Length:** ~7,200 words

**Key additions over v3:**

| Feature | v3 | v4 |
|---------|----|----|
| Scoring architecture | Single 30-day composite | **Three separated ledgers** (eligibility, rewards, trust) |
| Early-state containment | Detection-based | **Vesting by authorization state** (0%/25%/100% liquid) |
| Detection scope | Entry-focused | **All tiers continuously** (AUTHORIZED extraction is highest-damage) |
| Extractor response | Uniform redirect | **Typology-based** (I/II redirect, III redesign, IV enforce) |
| Epoch concentration | Unbounded | **15% cap per control graph** |
| Task classification | Unspecified | **Governance hardening** (blinding, rotation, 30-day audit) |
| Innovation protection | None | **5% exploration allowance** |
| Identity model | "One identity" | **Declared control graph** (teams, automation stacks) |
| Conflict resolution | Unspecified | **Constitutional hierarchy** |

---

## State Machine Summary

```
UNKNOWN ──► PROBATIONARY ──► AUTHORIZED ──► TRUSTED
    │              │              │              │
    └──────────────┴──────────────┴──────────────┴──► SUSPENDED

[Extraction detection active at ALL states]
[Vesting: 0% → 25% → 100% liquid by state]
```

---

## Three Ledgers (v4 Architecture)

| Ledger | Purpose | Time Horizon | Gaming Resistance |
|--------|---------|--------------|-------------------|
| **Eligibility** | Which state, which tasks | Per epoch (28d) | Slow-moving, minimum durations |
| **Rewards** | Epoch budget share | Daily, settled at epoch close | Concentration caps, blinded review |
| **Trust** | Governance rights | Monthly, path-dependent | 90+ day history, peer nomination |

---

## Vesting by State (v4)

| State | Liquid | Vesting |
|-------|--------|---------|
| UNKNOWN | 0% | 100% pending (released on advancement, forfeited after 60d) |
| PROBATIONARY | 25% | 75% over 30 days post-epoch |
| AUTHORIZED | 100% | None |
| TRUSTED | 100% | None |

---

## Verification

- **Format:** Publicly accessible URL
- **Word count:** 14,400+ words across all documents (requirement: 1,200+)
- **Coverage:** ✅ Authorization flow (5 states) ✅ Cooldown mechanics ✅ Escalation paths ✅ Integration points

---

*Published by Permanent Upper Class validator operation.*  
*Task completed for the Post Fiat Network.*
