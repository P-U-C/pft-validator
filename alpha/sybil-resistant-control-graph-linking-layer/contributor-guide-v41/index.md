---
layout: default
title: "Contributor Guide Update v4.1"
date: 2026-03-15
category: contributor-guide
status: published
---

# Contributor Guide Update v4.1

This is an addendum to the [original Contributor Guide](../../network-task-authorization-gate-specification/contributor-guide/). Read that first if you're new.

---

## Registration Stake

Starting with v4.1, registering a wallet requires posting a small stake in PFT or equivalent:

| Your path | Stake required | Lockup |
|-----------|---------------|--------|
| New contributor (entry) | 10 PFT equivalent | Until you reach Probationary, or 60 days |
| Probationary → Authorized | 50 PFT equivalent | Until Authorized badge + 30 days |
| Automation stack | 200 PFT equivalent | Until deregistration |

**Why this exists:** The stake makes spinning up fake wallets expensive. If you're here to contribute genuinely, you get your stake back in full when you exit in good standing.

**What happens to your stake:**
- If you advance normally → returned in full
- If you're flagged as an undeclared control graph member and don't respond → 50% slashed
- If confirmed undeclared after review → 100% slashed

---

## Gap-Filling Bonuses

The network publishes a **domain coverage map** at the start of each epoch. Some task domains are underserved (gaps), others are oversaturated.

| Your focus | CGI adjustment |
|------------|----------------|
| ≥60% of your work in gap domains | +0.3 boost next epoch |
| Mixed domains | No adjustment |
| ≥60% of your work in saturated domains | −0.1 drag next epoch |

**How to use this:**
- Check the coverage map at epoch open
- If you have skills in a gap domain, prioritize work there
- You're not penalized for specializing in a saturated domain — you just don't get the bonus

New contributors get **gap-aware task suggestions** based on their stated interests. After 10 completions, the system infers your fit from your actual work rather than what you said.

---

## If You're Flagged by the Linking Layer

The network monitors behavioral patterns across wallets — submission timing, writing style, withdrawal destinations. If two wallets show correlation that isn't explained by a declared relationship, you may receive a notice.

**What the notice means:**
> "Our monitoring has detected behavioral patterns suggesting these wallets may share a control graph. If you operate multiple wallets, please review and update your control graph declaration within 14 days."

**What to do:**
- If you do operate multiple wallets: update your declaration to include all of them. No penalty if you declare accurately within 14 days.
- If you don't: respond explaining why the correlation exists (e.g., you share a timezone with another contributor, or use similar tools).

**What happens if you ignore it:**
- Escalation to manual review
- Your wallets may be grouped together for concentration cap purposes
- Your stake is at risk

---

## Running a Multi-Wallet Team

Teams are welcome. The network doesn't require one-human-one-wallet.

**How to set up correctly:**

1. **Designate a primary wallet** — this is the canonical identity for your team
2. **Declare all associated wallets** in your Founder's Pledge
3. **Specify entity type** — choose "team" and indicate how many members (names optional)
4. **Share a treasury address if you want** — the linking layer won't flag it because you declared it

**What you get:**
- All wallets share one 15% concentration cap (same as undeclared, but without the flags)
- Each team member can submit independently under their own wallet
- The team builds a shared track record

**What you don't get:**
- You can't pretend to be five independent contributors. The cap applies to your entire team.
- Individual members can't reach TRUSTED without their own ZK identity verification.

---

## Quick Reference: What's New in v4.1

| Feature | What it means for you |
|---------|----------------------|
| Registration stake | Small deposit required; returned if you exit clean |
| Gap-filling bonus | +0.3 CGI if you work in underserved domains |
| Linking layer | Behavioral monitoring for undeclared multi-wallet operation |
| 14-day declaration window | Time to correct your declaration if flagged, before penalties |
| Stake slashing | Lose some or all stake if confirmed as undeclared control graph |

---

*Post Fiat Network — you are a builder, not a user.*
