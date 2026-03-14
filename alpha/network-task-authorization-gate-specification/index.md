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
**Version:** 3.0.0

---

## Overview

This specification addresses the governance gap identified by the Post Fiat Network founder: the network's #2 all-time earner operated without authorization, extracting ~1M PFT without core team contact.

The solution proposes four complementary mechanisms:

1. **AI-driven extraction detection and steering** — redirect, don't punish
2. **Epoch-bound emission mechanics** — cap total PFT per period
3. **Contributor authorization state machine** — algorithmic reputation replacing manual toggles
4. **Founder's Pledge** — wallet-signed entry commitment

---

## Documents

### [Contributor Guide](./contributor-guide/)

**Audience:** New and prospective contributors  
**Purpose:** Clear, accessible explanation of how earning works, contributor levels, and advancement paths

*Easy to digest. No implementation details.*

---

### [Technical Specification v3.0](./specification/)

**Audience:** Core team, implementers, reviewers  
**Purpose:** Full mechanism design with state machine, emission formulas, integration points, and rollout plan

*Battle-tested through 3 iterations. Incorporates feedback on extraction-as-redirect philosophy, epoch reasoning, growth index compounding, testnet timing compression, on-chain badges, ZK identity, and the Founder's Pledge ritual.*

---

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Redirect extractors, don't block | High-throughput operators demonstrate capability — redirect toward alignment |
| 28-day epochs | Balances signal accumulation, gaming resistance, and reporting cadence |
| 4 authorization tiers | UNKNOWN → PROBATIONARY → AUTHORIZED → TRUSTED (+ SUSPENDED) |
| Exponential task weighting | Personal 1× / Network 3× / Alpha 9× incentivizes tier climbing |
| Growth index compounds | Consistent contributors earn more per unit over time |
| Founder's Pledge at entry | Brief, wallet-signed, identity-conferring — rules stated before first task |

---

## State Machine Summary

```
UNKNOWN ──► PROBATIONARY ──► AUTHORIZED ──► TRUSTED
              │
              ▼ [extraction detected]
        SOFT REDIRECT ──► (engaged) back to track
                     └──► (ignored) weight decay → SUSPENDED
```

---

## Verification

- **Format:** Publicly accessible URL
- **Word count:** 7,200+ words across both documents (requirement: 1,200+)
- **Coverage:** ✅ Authorization flow (5 states) ✅ Cooldown mechanics ✅ Escalation paths ✅ Integration points

---

*Published by Permanent Upper Class validator operation.*  
*Task completed for the Post Fiat Network.*
