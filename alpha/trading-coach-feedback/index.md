---
layout: default
title: "Trading Coach Feedback Pack — Live-Use Product Review"
date: 2026-04-29
category: network
status: published
task_id: e43a9c0f-5a3f-4db3-b8da-2a1ee9b373c3
reward: 5000 PFT
---

# Trading Coach Feedback Pack

**Test window:** April 27-29, 2026 (3 days)  
**Timezone:** UTC / US Eastern  
**Tester:** Active Post Fiat contributor, first-time options trader  
**Coach:** Post Fiat Telegram Trading Coach (via @PostFiatChat bot)  
**Task ID:** e43a9c0f-5a3f-4db3-b8da-2a1ee9b373c3

> The coach is not valuable because it predicts markets. It is valuable because it interrupts bad trading behavior at the moment of decision.

---

## Reviewer Evidence Manifest

- Public URL: this feedback pack
- Task ID: e43a9c0f-5a3f-4db3-b8da-2a1ee9b373c3
- Test window: April 27-29, 2026
- Market type: live-market, real decision workflow
- Decision cycles tested: 4
- Coach surface: Post Fiat Telegram Trading Coach
- Evidence type: redacted notes and excerpts
- Redacted fields: account balances, exact position sizing, exact P&L, exact entry/exit prices, broker/account identifiers
- Non-redacted fields: decision type, behavioral issue, coach response pattern, product friction, improvement recommendation
- Shareability confirmation: no private account data, no broker credentials, no sensitive personal details, no non-public product artifacts

---

## Overview

I used the Post Fiat Telegram trading coach as my actual trading coach over 3 days across 4 live-market decision cycles. I had limited trading experience coming in -- the coach was my primary source of structure and discipline. This is not a paper QA pass. Real capital was deployed, real losses were taken, and the coach's feedback directly influenced my decisions.

**Central insight:** The behavioral control loop -- journal, coach challenge, user decision, risk state, follow-up -- is where the product creates value. The coach transforms chaotic speculation into structured process within 48 hours.

---

## Decision Cycle 1: Leveraged Equity Entry (April 27)

**Context:** First trade. Opened a leveraged long on a healthcare equity without a written thesis, stop, or take-profit plan.

**Coach interaction:**

> *User:* "I currently don't have a trading diary"
>
> *Coach:* "Before I coach your trading, send a public trading journal link: either a Google Docs link with sharing set to anyone with the link can view, or a public GitHub Gist link. I will load it into context for each response."

**Decision impact:** WAITED -- couldn't proceed until journal was created.

**What happened next:** Created a GitHub Gist journal, sent the link, entered the trade details.

> *Coach:* "Honest self-assessment is a great start. You made money by holding, but round-tripped profits because you had no exit plan. With leverage, you're speculating -- not investing... Fix it now. Write the thesis, set a stop loss, define a target."

**Decision impact:** MANAGED -- set stop loss, wrote thesis, defined risk parameters.

**Score:**

| Dimension | Score (1-5) | Notes |
|-----------|------------|-------|
| Actionability | 5 | "Fix it now" was direct and specific |
| Market-context awareness | 3 | Didn't reference ticker-specific data or sector context |
| Risk framing | 5 | Correctly identified leverage risk and missing stops |
| Follow-up usefulness | 4 | Pushed for thesis + stop + target -- all actionable |
| Appropriate boundaries | 5 | Didn't recommend specific prices, told me to define my own |

---

## Decision Cycle 2: Stop Loss Resistance (April 27)

**Context:** After the coach told me to set a stop, I raised a concern about volatility shaking me out.

> *User:* "The issue I have with stops is volatility can screw you and miss the upside"
>
> *Coach:* "You're right to worry about wicks. The fix isn't to abandon stops but to make them smarter. Combine three exits: time stop (10-14 days), closing-candle stop (filters intraday wicks), and catastrophic hard stop as a last-resort floor."

**Decision impact:** MANAGED -- set a multi-layered stop policy. The coach correctly identified that my reluctance to set stops was the core behavioral risk.

**What I learned independently (after this interaction):** LLM convergence data showed this equity has zero convergence in its thematic space. Every model sends retail flow to different tickers. My thesis was contradicted by the data. The coach didn't have access to this analysis.

**Score:**

| Dimension | Score (1-5) | Notes |
|-----------|------------|-------|
| Actionability | 5 | Clear: set the stop, no negotiation. Offered smart stop alternatives. |
| Market-context awareness | 2 | Didn't challenge the underlying thesis |
| Risk framing | 5 | Correctly framed stop-loss resistance as behavioral risk |
| Follow-up usefulness | 4 | Good on discipline, missed the convergence angle |
| Appropriate boundaries | 5 | Pushed discipline without recommending specific levels |

---

## Decision Cycle 3: Loss Exit / New Structured Entry (April 28)

**Context:** First trade deteriorated significantly. Closed for a material loss. Opened a higher-leverage crypto position with a contrarian thesis, defined TP/SL, and calculated R:R before entry.

> *Coach:* "You've made a massive leap: thesis first, stops set, risk/reward calculated. That's the professional skeleton... Widen the price stop to something that respects actual volatility. Look at ATR over the last few days. Keep your max dollar loss the same -- reduce position size proportionally."

**Decision impact:** ENTERED -- new position with full structure. EXITED -- previous position with loss documented.

**Key improvement the coach drove:** The difference between Trade 1 (no thesis, no stops, entered blind) and Trade 2 (thesis before entry, TP/SL set at entry, R:R calculated at 6.7:1) was entirely due to the coach's intervention. Within 48 hours, the coach transformed my process from gambling to structured speculation.

> *Coach (after the subsequent stop-out):* "You followed the plan, took your stop, and walked away with a controlled loss. That's the process working."

**Decision impact:** MANAGED -- clean stop-out. The coach validated that a controlled loss is a win for the system.

**Score:**

| Dimension | Score (1-5) | Notes |
|-----------|------------|-------|
| Actionability | 5 | Validated improved structure, recommended ATR-based stop width |
| Market-context awareness | 3 | Limited insight on token-specific dynamics |
| Risk framing | 5 | Correctly identified leverage risk, suggested sizing adjustment |
| Follow-up usefulness | 5 | Before/after comparison was powerful coaching |
| Appropriate boundaries | 5 | Reviewed structure without recommending direction |

---

## Decision Cycle 4: Macro Thesis Options Portfolio (April 29)

**Context:** Developed a multi-ticker options thesis -- short SaaS + long hardware moats. Multiple lottery tickets across three time horizons.

> *Coach:* "Weight should tilt heavier toward the LEAPS. The thesis is an 18-month repricing. Near-term options will bleed theta and have a very low probability of capturing the full thesis... allocating at least 60% to the longest-dated."
>
> *Coach:* "You're risking a large share of available capital on a single macro call. Even with defined risk per ticket, a correlated black swan or IV crush could wipe the sleeve. Consider capping total risk and then scaling up only if trades start working... Dry powder is not just for adding -- it's your gun loaded when the elephant walks by."

**Decision impact:** MANAGED -- received structural feedback on position sizing and time horizon allocation. The coach correctly identified concentration risk and theta bleed on near-term options.

**Score:**

| Dimension | Score (1-5) | Notes |
|-----------|------------|-------|
| Actionability | 5 | Specific: "60% to longest-dated", "cap risk and scale up" |
| Market-context awareness | 4 | Understood theta decay, LEAPS logic, IV crush risk |
| Risk framing | 5 | Caught capital concentration -- most important feedback |
| Follow-up usefulness | 5 | Directly applicable to restructuring the trade |
| Appropriate boundaries | 4 | See boundary edge case below |

---

## Decision Delta Table

| Cycle | Before coach | Coach intervention | After coach | Product lesson |
|-------|-------------|-------------------|-------------|----------------|
| Entry setup | No journal, no thesis, no stop | Required journal, pushed thesis/stop/target | Trade became documented and risk-bounded | Journal gate works but needs onboarding support |
| Stop discussion | User resisted stop due to volatility fear | Reframed stop as leverage discipline, offered smart stop alternatives | Multi-layered stop policy defined | Coach is strongest as behavioral risk guard |
| New trade | Prior trade was unstructured | Compared process improvement, validated structure | New trade had thesis, TP, SL, R:R before entry | Coach can train better habits in 48 hours |
| Options structure | Concentrated macro thesis across short tenors | Flagged concentration and time-horizon mismatch | User reconsidered sizing/time horizon | Coach needs portfolio-level risk mode |

---

## Coach-Quality Matrix

| Dimension | Avg Score | Strengths | Weaknesses |
|-----------|----------|-----------|------------|
| Actionability | 5.0/5 | Every interaction produced a specific next action | -- |
| Market-context awareness | 3.0/5 | -- | Limited ticker-specific insight, no real-time data |
| Risk framing | 5.0/5 | Consistently caught leverage risk, missing stops, over-concentration | -- |
| Follow-up usefulness | 4.5/5 | Strong continuity between sessions via journal | Could prompt for journal update more proactively |
| Appropriate boundaries | 4.8/5 | Never recommended tickers or direction | See boundary edge case |

**Overall: 4.5/5** -- Excellent as a discipline and structure coach. Weak on market-specific context.

---

## Boundary Edge Case: When Risk Coaching Approaches Allocation Advice

One subtle boundary issue appeared in the options-structure review. The coach did not recommend a ticker or directional trade, but it provided numerical structure guidance: specific time-horizon weighting ("at least 60% to longest-dated") and a suggested capital-at-risk cap. This was useful coaching, but it sits near the boundary between process coaching and allocation advice.

**Product recommendation:** When the coach gives numeric risk structure, it should frame the output as a user-owned risk-policy check, not as a recommended allocation. For example: "A conservative risk-policy might require you to define a maximum capital-at-risk threshold before entering. Choose and document that threshold yourself -- then I'll help you pressure-test it." This preserves the coaching value without crossing into advisory territory.

---

## Safety / Risk-Control Observations

### What the coach got right

1. **Refused to engage without a journal.** The cold-start gate forces the user to create a record before getting advice. This prevents the coach from being used as a quick-tip generator.

2. **Immediately identified missing stops.** The first substantive coaching message was "fix it now." This is the right priority for a leveraged position.

3. **Caught over-concentration.** On the options portfolio, the coach identified a large share of capital committed to a single macro call. This portfolio-level risk check is valuable.

4. **Maintained appropriate boundaries.** Across all 4 cycles, the coach commented on structure, risk management, and process -- not on tickers, direction, or specific price levels.

5. **Validated controlled losses.** After the stop-out, the coach said "that's the process working." Reframing a loss as a system success is powerful behavioral coaching.

### What the coach missed

1. **No real-time position monitoring.** The coach reads the journal at conversation time but doesn't monitor positions between sessions.

2. **No leverage-specific warnings at entry.** When a high-leverage position was described, the coach should have flagged the liquidation price explicitly.

3. **No integration with market data.** The coach couldn't check volatility, volume, or upcoming events that would inform the thesis.

---

## Proposed Coach Risk Escalation State Machine

| State | Trigger | Coach behavior |
|-------|---------|---------------|
| Green | Journal present, thesis defined, stop/invalidator defined, position size within user policy | Normal coaching |
| Amber | Missing thesis, vague exit, oversized single idea, unclear time horizon | Ask clarification before analysis |
| Red | Leveraged position with no stop, user resists risk limits, high concentration, revenge-trade language | Refuse directional discussion; require risk plan first |
| Cooling-off | User repeats high-risk behavior after warning | Suggest pause, post-decision review, and journal update before new trade discussion |

---

## Minimum Viable Market Context Layer

The coach does not need to become a trading signal engine. It only needs enough read-only context to challenge obvious blind spots.

**Minimum context fields:**
- Current price and recent move (daily change)
- Volatility / ATR proxy
- Upcoming earnings or major event date
- Broad market regime flag (risk-on / risk-off)
- Liquidity/spread warning for thin markets
- Options IV / theta warning for options trades
- User journal history for repeated behavior patterns

**Guardrail:** Market data should be used to ask better questions, not to issue buy/sell recommendations.

---

## Proposed Onboarding Rescue Flow

**Current behavior:**

> User: "I don't have a trading diary."
> Coach: "Send a public journal link before I coach you."

**Proposed behavior:**

> Coach: "No problem. I can start a blank journal with you now. Answer these five fields:
> 1. What asset are you considering?
> 2. What is the thesis -- why this, why now?
> 3. What would prove the thesis wrong?
> 4. What is your maximum acceptable loss?
> 5. What will you do after the trade, win or lose?"

**Product principle:** The journal gate should block reckless coaching, not block safe onboarding.

---

## Defects and Frictions

### D1: Cold-start journal gate (HIGH friction)

The coach requires a public journal link before ANY coaching. A new user must create a Google Doc or GitHub Gist, format it, and share the link. This is a 10-15 minute detour before getting any value.

**Fix:** Accept a blank journal or offer to create one. "I'll start a journal with you" gets the user coaching immediately. See onboarding rescue flow above.

### D2: No journal template provided (MEDIUM friction)

The coach asks for a journal but doesn't provide a template. A first-time trader won't know what fields matter.

**Fix:** Provide a one-link template with pre-filled fields for thesis, entry, stop, target, and post-mortem.

### D3: No proactive check-ins (MEDIUM)

The coach only responds when prompted. Between sessions, a position deteriorated significantly. The coach didn't know until told.

**Fix:** Daily nudge: "It's been 24 hours. How are your positions? Update the journal and I'll review."

### D4: Journal link required every session (LOW)

If the journal URL changes, the coach needs to be told. Minor friction.

**Fix:** Persist the journal URL in the user's profile. Ask only once.

### D5: No connection to execution tools (LOW -- future)

The coach tells the user to set a stop, but verification happens only when the user self-reports. No confirmation that the stop was actually set.

**Fix (long-term):** Broker integration to verify stops are set, not just discussed.

---

## Prioritized Improvement List

| Priority | Improvement | Impact | Effort |
|----------|------------|--------|--------|
| P0 | Provide journal template at onboarding | Removes biggest friction | Low |
| P0 | Accept blank journal / help create one | Eliminates cold-start abandonment | Low |
| P1 | Daily check-in prompts | Catches deteriorating positions | Medium |
| P1 | Minimum viable market context layer | Challenges blind spots with data | Medium |
| P1 | Risk escalation state machine | Prevents coaching into unmanaged risk | Medium |
| P2 | Persist journal URL | Minor friction removal | Low |
| P2 | Position monitoring alerts | Proactive risk management | High |
| P3 | Broker integration | Verify stops are set, pull real P&L | High |
| P3 | LLM convergence data integration | Challenge thesis with flow data | Medium |

---

## What the Coach Does Well (Keep This)

1. **Imposes structure on chaos.** The transformation from Trade 1 (no thesis, no stops) to Trade 2 (thesis, TP, SL, R:R) happened in 48 hours because the coach demanded it.

2. **Risk discipline is relentless.** Every interaction prioritized risk management. The coach never let a missing stop slide.

3. **Journal-as-context is brilliant.** By reading the journal at each interaction, the coach maintains continuity across sessions. It remembers your positions, your thesis, your past mistakes.

4. **Validates controlled losses.** "You followed the plan, took your stop, and walked away with a controlled loss. That's the process working." This reframe is worth more than any trade recommendation.

5. **Says things the user doesn't want to hear.** When I resisted stops, pushed for exponential thinking, and over-concentrated, the coach held the line. Good coaching requires uncomfortable truth.

---

*Test conducted April 27-29, 2026. Private account data, exact position sizing, and exact P&L have been redacted. The coach was used as the primary trading advisor for the test period. No paper-only passes.*
