---
layout: default
title: "b1e55ed: Capital Allocator One-Pager"
date: 2026-03-08
category: one-pager
status: draft
---

# b1e55ed

**A Reputation Primitive for Signal Markets**

---

## The Falsification Test

Does high-confidence forecasting produce better economic outcomes than low-confidence forecasting, net of fees?

If yes, the system has edge. If no, the trading layer shuts down.

That is the commitment. b1e55ed is built to answer this question with machine-verifiable evidence — not backtests, not P&L claims, not trust. The confidence expressed by signal producers must map to realized outcomes, or the system fails its own test.

---

## The Problem Worth Solving

Most prediction systems conflate two distinct proofs:

**Proof-of-work** verifies that someone did something. Task completed. Report delivered. Code shipped. This is necessary but insufficient for capital allocation.

**Proof-of-foresight** verifies that someone's stated confidence about future market states deserves economic weight. This requires harder evidence: pre-resolution provenance, explicit probability, proper scoring, and repeated outcomes over time.

Existing systems reward effort. They do not reliably reward calibration. A participant can be productive, visible, and consistently wrong about markets. A participant can be obscure and consistently right. Without proof-of-foresight, capital systems cannot tell the difference.

b1e55ed is the attribution layer that makes this distinction measurable.

---

> **Current State: Beta — Phase 0**
>
> 13 internal producers · 4 live benchmarks · 0 monetized forecasts before proof
>
> Meta-producer activates at 500 resolved outcomes (~3-4 weeks)

---

## How It Works

Every forecast is a precise, immutable claim: asset, direction, confidence level, time horizon. Recorded in an append-only event store before the outcome is knowable. Retroactive modification breaks the hash chain.

When the horizon resolves, the system scores each forecast using proper scoring rules that reward honest probability estimates — not just directional accuracy. A producer claiming 70% confidence should be correct 70% of the time. The score measures whether they are.

Producers accumulate reputation (karma) based on contribution to profitable outcomes. Karma uses exponential decay — old accuracy fades, recent performance dominates. The system forgets slowly but forgets.

When b1e55ed synthesizes signals for capital deployment, it weights producers by earned reputation. Yesterday's outcomes shape today's weights. The loop closes.

---

## What You Can Verify

Before allocating capital, query any producer's:

- Directional accuracy by asset and regime
- Calibration score (Brier)
- Karma trajectory over time
- Full forecast history with timestamps

The oracle serves these records from the same log that drives the engine. You audit what the system trades on.

---

## The Benchmarks

b1e55ed must beat four baselines — same fees, same slippage, same data:

1. **Flat** — zero exposure
2. **Naive momentum** — simple moving average crossover
3. **Equal-weight ensemble** — average all signals, no weighting
4. **Discretionary override** — human judgment

Beat all four, or no edge claim. This is not marketing. It is the falsification condition.

---

## Three-Year Target

**100+ independent signal producers** with verified, portable track records.

Each producer's forecast history becomes an auditable on-chain CV. When their signals contribute to profitable outcomes, their reputation rises. When the system deploys capital, it deploys proportionally to proven calibration.

The goal is not one proprietary edge. It is an ecosystem of attributed, competing forecasters whose collective output is more reliable than any individual — and whose reliability is independently verifiable.

---

## Why This Matters

Capital allocation suffers from an attribution crisis. Claims of edge are cheap. Evidence is expensive. Systems that cannot distinguish calibrated foresight from confident noise will eventually mistake activity for insight.

b1e55ed imposes a stricter standard: your confidence must convert to outcomes, repeatedly, verifiably, or your weight goes to zero.

That is the primitive capital markets have been missing.

---

**Read more:**
- [Technical Whitepaper](https://pft.permanentupperclass.com/alpha/b1e55ed-whitepaper-v4/)
- [Proof of Foresight: The Attribution Layer Post Fiat Requires](https://pft.permanentupperclass.com/alpha/b1e55ed-postfiat-flagship/)

---

*Published by Permanent Upper Class Research · March 2026*
