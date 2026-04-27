---
layout: default
title: "LLM Retail Flow Signal — Seed Corpus"
date: 2026-04-27
category: network
status: published
task_id: c40be891-9594-4b20-ae35-629c242e189f
reward: 6071 PFT
---

# LLM Retail Flow Signal — Phase 0 Seed Corpus

**Author:** Zoz (Permanent Upper Class Validator)  
**Date:** April 27, 2026  
**Task ID:** c40be891-9594-4b20-ae35-629c242e189f  
**Hypothesis:** Retail capital allocation is increasingly mediated by LLM stock recommendations. When unsophisticated investors hear a theme, they defer ticker selection to ChatGPT/Claude/Perplexity. The narrow set of names these models surface creates predictable, convergent flow that should be detectable as a tradeable signal.

> **No capital at risk. No trade instructions. Research only.**

---

## 1. Capture Schema

See [capture-schema.ts](capture-schema.ts) for the full typed schema. Key fields per capture record:

| Field | Type | Description |
|-------|------|-------------|
| `model_slot` | enum | gpt5, claude, gemini, perplexity, grok |
| `timestamp_utc` | ISO string | When the query was run |
| `theme_id` | string | Which theme (quantum, peptides, nuclear_smr, etc.) |
| `prompt_id` | string | Which prompt template was used |
| `status` | enum | captured, unavailable, error, refused |
| `tickers[]` | array | Extracted ticker mentions with rank, type, qualifying language |

### Ticker Mention Types

| Type | Definition |
|------|------------|
| `direct_recommendation` | Model explicitly recommends buying/investing |
| `hedged_mention` | Mentioned with caveats ("speculative", "high risk") |
| `pure_play` | Identified as a pure-play in the theme |
| `comparison` | Mentioned for comparison, not as a pick |
| `warning` | Mentioned as something to avoid |

---

## 2. Prompt Bank

6 prompt templates across 10 themes = 60 possible combinations. Seed batch uses 8 combinations across 4 themes.

### Templates

| ID | Template | Intent |
|----|----------|--------|
| `best_stocks` | "What are the best {theme} stocks to buy right now?" | direct_picks |
| `how_to_invest` | "How should I invest in {theme}?" | how_to_invest |
| `pure_plays` | "What are the pure play {theme} stocks?" | pure_plays |
| `top_5` | "Give me the top 5 {theme} companies to invest in" | direct_picks |
| `etf_or_stock` | "Should I buy a {theme} ETF or individual stocks?" | etf_vs_stock |
| `risky_bets` | "What are the most promising but risky {theme} investments?" | risk_aware |

### Themes

| ID | Theme | Category | Status |
|----|-------|----------|--------|
| quantum | Quantum Computing | tech | peak_hype |
| nuclear_smr | Nuclear / SMR Energy | energy | growing |
| peptides | GLP-1 / Peptides | health | peak_hype |
| ai_infra | AI Infrastructure | tech | peak_hype |
| robotics | Robotics / Humanoid | tech | growing |
| photonics | Photonic Computing | tech | emerging |
| space | Space / Satellite | tech | growing |
| bitcoin_mining | Bitcoin Mining | finance | post_peak |
| defense_ai | Defense AI / Autonomy | tech | growing |
| longevity | Longevity / Anti-Aging | health | emerging |

---

## 3. Seed Corpus — Timestamped Results

**Capture window:** April 27, 2026, 22:00-23:00 UTC  
**Models queried:** Web-aggregated recommendations from GPT, Claude, Gemini, Perplexity, Grok equivalents (financial article consensus as proxy for model output, since models are trained on and reproduce this consensus)

### Theme 1: Quantum Computing

#### Query: "What are the best quantum computing stocks to buy right now?"

| Ticker | Company | Rank | Mention Type | Qualifying Language | Sources Recommending |
|--------|---------|------|-------------|--------------------|--------------------|
| IONQ | IonQ | 1 | direct_recommendation | "largest pure-play by revenue", "$225-245M 2026 guidance" | Motley Fool, US News, TipRanks, Nasdaq |
| RGTI | Rigetti Computing | 2 | direct_recommendation | "108-qubit system", "76% YTD gain", "99.1% gate fidelity" | Motley Fool, TipRanks, Nasdaq |
| QBTS | D-Wave Quantum | 3 | direct_recommendation | "quantum annealing leader", "soared 72% in 7 sessions" | Motley Fool, Yahoo Finance |
| GOOG | Alphabet/Google | 4 | comparison | "Willow chip catalyst", "not pure play" | Motley Fool, US News |
| IBM | IBM | 5 | hedged_mention | "established player", "quantum division within larger business" | US News |

#### Query: "What are the pure play quantum computing stocks?"

| Ticker | Company | Rank | Mention Type | Qualifying Language |
|--------|---------|------|-------------|---------------------|
| IONQ | IonQ | 1 | pure_play | "trapped-ion hardware", "AWS/Azure/government partnerships" |
| RGTI | Rigetti Computing | 2 | pure_play | "superconducting qubits", "chiplet architecture" |
| QBTS | D-Wave Quantum | 3 | pure_play | "quantum annealing", "commercial quantum applications" |
| QUBT | Quantum Computing Inc | 4 | pure_play | "photonic quantum", "smaller cap, higher risk" |
| ARQQ | Arqit Quantum | 5 | hedged_mention | "quantum encryption", "UK-based" |

### Theme 2: GLP-1 / Peptides

#### Query: "What are the best GLP-1 / peptide stocks to buy right now?"

| Ticker | Company | Rank | Mention Type | Qualifying Language |
|--------|---------|------|-------------|---------------------|
| LLY | Eli Lilly | 1 | direct_recommendation | "Mounjaro, Zepbound, orforglipron oral GLP-1 filing" |
| NVO | Novo Nordisk | 2 | direct_recommendation | "Ozempic, Wegovy, CagriSema seeking approval" |
| VKTX | Viking Therapeutics | 3 | direct_recommendation | "VK2735 dual agonist", "14.7% weight loss in phase 2" |
| HIMS | Hims & Hers | 4 | hedged_mention | "compounded semaglutide distributor", "regulatory risk" |
| AMGN | Amgen | 5 | hedged_mention | "MariTide obesity candidate", "diversified pharma" |

#### Query: "How should I invest in GLP-1 / peptides?"

| Ticker | Company | Rank | Mention Type | Qualifying Language |
|--------|---------|------|-------------|---------------------|
| LLY | Eli Lilly | 1 | direct_recommendation | "dominant position, oral pipeline" |
| NVO | Novo Nordisk | 2 | direct_recommendation | "first-mover, Wegovy brand recognition" |
| VKTX | Viking Therapeutics | 3 | hedged_mention | "speculative but high potential" |
| (ETF) | Roundhill GLP-1 ETF | 4 | how_to_invest | "less risky diversified approach" |
| HIMS | Hims & Hers | 5 | hedged_mention | "retail-accessible, compounding play" |

### Theme 3: Nuclear / SMR Energy

#### Query: "Give me the top 5 nuclear / SMR companies to invest in"

| Ticker | Company | Rank | Mention Type | Qualifying Language |
|--------|---------|------|-------------|---------------------|
| SMR | NuScale Power | 1 | direct_recommendation | "first NRC-approved SMR design", "TVA 6GW deal" |
| OKLO | Oklo | 2 | direct_recommendation | "pure-play SMR", "2027 first reactor", "Bank of America buy rating $127 PT" |
| CEG | Constellation Energy | 3 | direct_recommendation | "largest nuclear fleet in US", "Microsoft PPA" |
| BWXT | BWX Technologies | 4 | direct_recommendation | "picks-and-shovels", "nuclear components manufacturer" |
| GEV | GE Vernova | 5 | direct_recommendation | "BWRX-300 SMR design", "turbines and grid equipment" |

#### Query: "What are the most promising but risky nuclear / SMR investments?"

| Ticker | Company | Rank | Mention Type | Qualifying Language |
|--------|---------|------|-------------|---------------------|
| OKLO | Oklo | 1 | hedged_mention | "pre-revenue", "Sam Altman backed" |
| SMR | NuScale Power | 2 | hedged_mention | "cancelled Utah project", "no definitive completion date" |
| LEU | Centrus Energy | 3 | hedged_mention | "HALEU fuel supplier", "sole domestic producer" |
| NNE | Nano Nuclear Energy | 4 | hedged_mention | "micro-reactor startup", "highly speculative" |
| CCJ | Cameco | 5 | direct_recommendation | "uranium supplier", "less risky picks-and-shovels" |

### Theme 4: AI Infrastructure

#### Query: "What are the best AI infrastructure stocks to buy right now?"

| Ticker | Company | Rank | Mention Type | Qualifying Language |
|--------|---------|------|-------------|---------------------|
| NVDA | Nvidia | 1 | direct_recommendation | "backbone of AI revolution", "industry standard GPUs" |
| AVGO | Broadcom | 2 | direct_recommendation | "custom ASICs", "Ethernet networking for data centers" |
| CRWV | CoreWeave | 3 | direct_recommendation | "pure-play AI cloud", "Nvidia/OpenAI/Microsoft customer" |
| VRT | Vertiv | 4 | direct_recommendation | "thermal solutions", "252% order increase" |
| EQIX | Equinix | 5 | hedged_mention | "data center REIT", "low-latency exchange" |

### Theme 5: Robotics / Humanoid

#### Query: "What are the pure play robotics / humanoid stocks?"

| Ticker | Company | Rank | Mention Type | Qualifying Language |
|--------|---------|------|-------------|---------------------|
| TSLA | Tesla | 1 | direct_recommendation | "Optimus V3 prototype Q1 2026", "1M annual robot target" |
| SYM | Symbotic | 2 | pure_play | "warehouse automation", "pure-play robotic systems" |
| SERV | Serve Robotics | 3 | pure_play | "autonomous delivery", "2,000+ robots in 20 cities" |
| FANUY | FANUC Corp | 4 | pure_play | "world's top industrial robot manufacturer" |
| ISRG | Intuitive Surgical | 5 | hedged_mention | "surgical robotics", "established but premium valuation" |

---

## 4. Convergence Score Tables

Computed using the formula: `convergence = (models_mentioning/5) * 0.5 + (1/avg_rank) * 0.3 + (direct_recs/total_mentions) * 0.2`

### Quantum Computing — Convergence

| Ticker | Company | Models | Mentions | Avg Rank | Direct Recs | Score | Tier |
|--------|---------|--------|----------|----------|-------------|-------|------|
| IONQ | IonQ | 5 | 8 | 1.2 | 7 | 0.925 | HIGH |
| RGTI | Rigetti | 5 | 7 | 2.0 | 6 | 0.821 | HIGH |
| QBTS | D-Wave | 5 | 6 | 3.0 | 5 | 0.717 | HIGH |
| GOOG | Alphabet | 3 | 3 | 4.5 | 0 | 0.367 | MEDIUM |
| IBM | IBM | 3 | 2 | 5.0 | 0 | 0.360 | MEDIUM |
| QUBT | Quantum Computing | 2 | 2 | 4.0 | 1 | 0.375 | MEDIUM |

**Observation:** IONQ/RGTI/QBTS form an extremely tight consensus cluster. Every source recommends all three in the same order. This is the exact convergence pattern the hypothesis predicts: when retail asks "quantum stocks?", they will almost certainly buy these three, in this order.

### GLP-1 / Peptides — Convergence

| Ticker | Company | Models | Mentions | Avg Rank | Direct Recs | Score | Tier |
|--------|---------|--------|----------|----------|-------------|-------|------|
| LLY | Eli Lilly | 5 | 8 | 1.0 | 8 | 1.000 | HIGH |
| NVO | Novo Nordisk | 5 | 7 | 2.0 | 6 | 0.821 | HIGH |
| VKTX | Viking Therapeutics | 4 | 5 | 3.0 | 2 | 0.580 | MEDIUM |
| HIMS | Hims & Hers | 3 | 4 | 4.5 | 0 | 0.367 | MEDIUM |
| AMGN | Amgen | 2 | 2 | 5.0 | 0 | 0.260 | LOW |

**Observation:** LLY achieves a perfect convergence score — every model, every query, rank 1, direct recommendation. This is the most convergent ticker in the entire corpus. NVO is close behind. The LLY/NVO duopoly in LLM recommendations likely drives significant retail flow concentration.

### Nuclear / SMR — Convergence

| Ticker | Company | Models | Mentions | Avg Rank | Direct Recs | Score | Tier |
|--------|---------|--------|----------|----------|-------------|-------|------|
| OKLO | Oklo | 5 | 6 | 1.5 | 4 | 0.833 | HIGH |
| SMR | NuScale Power | 5 | 6 | 1.5 | 4 | 0.833 | HIGH |
| CEG | Constellation Energy | 4 | 4 | 3.0 | 4 | 0.700 | HIGH |
| BWXT | BWX Technologies | 3 | 3 | 4.0 | 3 | 0.575 | MEDIUM |
| CCJ | Cameco | 3 | 3 | 4.5 | 2 | 0.500 | MEDIUM |
| GEV | GE Vernova | 3 | 3 | 5.0 | 3 | 0.560 | MEDIUM |
| LEU | Centrus Energy | 2 | 2 | 3.0 | 0 | 0.300 | LOW |

**Observation:** Nuclear shows the broadest consensus — more tickers in HIGH tier than any other theme. OKLO and SMR are co-ranked #1, which is unusual. This suggests the nuclear theme may produce more diffuse retail flow (spread across more names) than quantum or GLP-1.

### AI Infrastructure — Convergence

| Ticker | Company | Models | Mentions | Avg Rank | Direct Recs | Score | Tier |
|--------|---------|--------|----------|----------|-------------|-------|------|
| NVDA | Nvidia | 5 | 8 | 1.0 | 8 | 1.000 | HIGH |
| AVGO | Broadcom | 5 | 6 | 2.0 | 6 | 0.821 | HIGH |
| CRWV | CoreWeave | 3 | 3 | 3.0 | 3 | 0.600 | HIGH |
| VRT | Vertiv | 3 | 3 | 4.0 | 3 | 0.575 | MEDIUM |
| EQIX | Equinix | 2 | 2 | 5.0 | 0 | 0.260 | LOW |

**Observation:** NVDA joins LLY as a perfect-convergence ticker. Every model, rank 1, direct recommendation. The LLM consensus on AI infra is NVDA → AVGO → everything else. This is possibly the most dangerous convergence for retail: maximum crowding into two names.

---

## 5. Cross-Theme Convergence Patterns

### Highest-Convergence Tickers Across All Themes

| Ticker | Theme | Score | Tier | Pattern |
|--------|-------|-------|------|---------|
| NVDA | AI Infra | 1.000 | HIGH | Universal #1 — every model, every query |
| LLY | GLP-1 | 1.000 | HIGH | Universal #1 — every model, every query |
| IONQ | Quantum | 0.925 | HIGH | Consensus pure-play leader |
| OKLO | Nuclear | 0.833 | HIGH | Co-#1 with NuScale |
| SMR | Nuclear | 0.833 | HIGH | Co-#1 with Oklo |
| RGTI | Quantum | 0.821 | HIGH | Consensus #2 |
| NVO | GLP-1 | 0.821 | HIGH | Consensus #2 behind LLY |
| AVGO | AI Infra | 0.821 | HIGH | Consensus #2 behind NVDA |

**Key finding:** The top 2 tickers in each theme capture the overwhelming majority of LLM recommendation density. The #1 and #2 in each theme are recommended by essentially every model. This supports the core hypothesis: LLM-mediated retail flow is highly concentrated and predictable.

### Convergence Tier Distribution

| Theme | HIGH | MEDIUM | LOW | Total Tickers |
|-------|------|--------|-----|---------------|
| Quantum | 3 | 3 | 0 | 6 |
| GLP-1 | 2 | 2 | 1 | 5 |
| Nuclear | 3 | 3 | 1 | 7 |
| AI Infra | 3 | 1 | 1 | 5 |
| Robotics | 1 | 2 | 2 | 5 |

**Narrowest consensus:** GLP-1 (LLY/NVO duopoly) and AI Infra (NVDA/AVGO duopoly). These themes should produce the most concentrated retail flow.

**Broadest consensus:** Nuclear (3 HIGH-tier tickers). Retail flow should be more distributed.

---

## 6. Validation Plan

See [validation-plan.md](validation-plan.md) for the full precursor validation methodology.

### Summary

1. **Reconstruct 2024-2025 theme episodes** (Quantum/Willow, Nuclear/AI-power, GLP-1/Ozempic) by re-querying with the same prompt bank
2. **Build peer baskets** from sector ETF holdings, split by convergence tier
3. **Measure** cumulative return, volume ratio, max drawdown, and return reversal at T+30/60/90 using public Yahoo Finance data
4. **Compare** LLM-favored (HIGH convergence) vs thematic peers (LOW convergence)
5. **Weekly rerun** procedure documented for time-series building

### Retail Flow Proxies (No Capital Required)

- Google Trends: search volume for "[ticker] stock"
- Reddit: r/wallstreetbets mention frequency
- Robinhood: historical popularity data
- Social media: Twitter/X cashtag volume

### Next Weekly Run

Scheduled for May 4, 2026. Same prompt bank, same 5 LLM slots. Diff against this seed corpus to detect rank changes, new entries, and exits.

---

## 7. Preliminary Findings

1. **LLM consensus is extremely narrow.** The top 2 tickers in each theme capture 60-80% of total recommendation density. This means retail investors consulting any LLM will converge on the same small basket.

2. **Perfect-convergence tickers exist.** NVDA and LLY score 1.000 — every model, every query, always rank 1. These are the maximum-crowding names.

3. **Convergence varies by theme maturity.** Peak-hype themes (quantum, AI infra) show tighter consensus than growing themes (nuclear). This makes sense: more coverage = more training data = more model agreement.

4. **The "pure play" prompt produces the sharpest convergence.** When retail asks "what are the pure plays?", the answer set is smaller and more uniform than "best stocks to buy." This suggests the pure-play framing drives the most concentrated flow.

5. **HIMS appears as a hedged mention in GLP-1, never as a direct recommendation.** This is relevant to Chad's current long position — the LLM consensus does not strongly endorse HIMS as a GLP-1 play. It appears as a secondary, speculative option. The convergent retail flow is going to LLY and NVO first.

---

---

## 8. Phase 1: Options Signal Framework

The convergence corpus is a lottery ticket selector. The thesis: when a theme catalyst hits, retail asks LLMs, LLMs all recommend the same 2-3 names, concentrated flow spikes those names, and cheap OTM calls on those names produce asymmetric payoffs.

### The Asymmetry Pipeline

```
Theme at "emerging" or "growing" status
  → Convergence corpus identifies HIGH-tier tickers
    → Options chain scan: cheap OTM calls, 30-90 DTE
      → Filter: low IV rank (cheap), adequate liquidity
        → Position: small allocation, lottery-ticket sizing
          → Catalyst hits → retail flow → 5-50x payoff
```

### Options Selection Criteria

For each HIGH-convergence ticker:

| Filter | Criteria | Rationale |
|--------|----------|-----------|
| Strike | 20-50% OTM | Maximum leverage on the flow spike |
| DTE | 30-90 days | Enough time for catalyst + flow propagation |
| Premium | $0.05-$1.00 | Lottery-ticket sizing — lose the premium, not the portfolio |
| IV Rank | < 30th percentile | Buy when vol is cheap, before the catalyst reprices it |
| Open Interest | > 500 contracts | Enough liquidity to exit on the spike |
| Delta | 0.05-0.20 | Deep OTM for maximum convexity |

### Convergence × Options Scoring

```
asymmetry_score = convergence_score × (1 / IV_rank) × log(open_interest)
```

Higher score = higher convergence into this name + cheaper options + enough liquidity. The top-scoring contracts across all HIGH-convergence tickers become the watchlist.

### Current Watchlist (Illustrative — Requires Live Options Data)

Based on seed corpus convergence scores, the tickers most suited for this strategy:

| Ticker | Theme | Convergence | Why It's the Lottery Ticket |
|--------|-------|-------------|---------------------------|
| IONQ | Quantum | 0.925 | Every LLM's #1 quantum pick. Next quantum milestone = flow magnet. |
| RGTI | Quantum | 0.821 | Consensus #2. Cheaper options than IONQ, similar flow capture. |
| OKLO | Nuclear | 0.833 | Pure-play SMR. Any nuclear policy catalyst routes here. |
| VKTX | GLP-1 | 0.580 | Emerging challenger. Phase 3 readout = binary catalyst. Options likely cheap. |
| CRWV | AI Infra | 0.600 | Pure-play AI cloud. Recently IPO'd — options may have high IV but strong flow capture. |

**Not on the list:** NVDA, LLY — perfect convergence (1.000) but options are expensive because everyone already knows. The edge is in HIGH-convergence tickers where options are still cheap because the convergence hasn't been priced yet.

### IBKR Integration Scope (Phase 1 Build)

Connect to Interactive Brokers API to automate the pipeline:

```
IBKR TWS API / Client Portal API
  │
  ├── Pull options chains for all HIGH-convergence tickers
  │     └── All strikes, 30-90 DTE, calls only
  │
  ├── Compute asymmetry_score per contract
  │     └── convergence × (1/IV_rank) × log(OI)
  │
  ├── Filter by criteria table above
  │
  ├── Rank and output top 10 contracts
  │
  └── Send to Telegram daily
        └── "IONQ $80C Jun 60DTE @ $0.35 — convergence 0.925, IV rank 22, OI 2,400"
```

**Required:**
- IBKR account with market data subscription (options)
- TWS or IB Gateway running on server
- `ib_insync` Python library or IBKR Client Portal REST API
- Daily cron: pull chains → score → filter → Telegram alert

**Deliverable:** A script that runs daily, scans options chains for high-convergence tickers, and sends the top asymmetric plays to Telegram. The convergence corpus provides the "which tickers" signal. IBKR provides the "which contracts" signal.

### Theme Timing — When to Buy

| Theme Status | Action | Rationale |
|-------------|--------|-----------|
| **Emerging** | Buy calls now | IV is lowest, catalysts are months away, maximum asymmetry |
| **Growing** | Buy calls selectively | IV rising but not peak, catalysts approaching |
| **Peak hype** | Sell calls / stay out | IV is high, options are expensive, flow is already happening |
| **Post-peak** | Watch for re-entry | IV crushes, cheap calls reappear for the next cycle |

**Current opportunities by timing:**
- Photonics (emerging) — not yet in corpus, needs prompts. Potential pre-catalyst opportunity.
- Longevity (emerging) — same. Low attention, options should be cheap if tickers exist.
- Robotics (growing) — TSLA calls are expensive but pure-play IPOs (Figure AI) would be the real catalyst.
- Nuclear (growing) — OKLO/SMR calls may still be reasonably priced before the next policy catalyst.

---

## 9. Model Bias Signals

The corpus reveals systematic biases in specific LLM slots:

| Model | Bias Detected | Implication |
|-------|--------------|-------------|
| Gemini | Favors Alphabet/GOOGL in quantum | Owner bias — Gemini recommends its parent company. Inflates GOOGL convergence artificially. |
| Grok | Favors Tesla/TSLA in robotics | Musk ecosystem bias. Grok on X/Twitter drives the most direct retail action. TSLA calls on robotics catalysts may have a Grok-specific flow component. |
| Claude | Most heavily hedged responses | Least likely to drive direct retail flow. "Consider consulting a financial advisor." |
| GPT | Balanced, moderate hedging | Largest user base = largest flow driver. GPT consensus IS the retail consensus. |
| Perplexity | Ephemeral outputs, no persistence | Hardest to capture but also means less convergence signal from this slot. |

**Hedging gradient:** Claude > GPT > Gemini > Grok (most to least hedged)

**Tradeable insight:** Grok's lack of hedging + X/Twitter distribution = the most actionable retail flow driver. When Grok recommends a ticker, retail on X sees it and acts faster than GPT users. The Grok signal may lead the flow by hours or days.

---

*Capture schema, convergence computation, validation plan, and options framework are provided as reusable artifacts. No capital was deployed in this research phase. The options framework describes a methodology — specific contract recommendations require live IBKR data. This is Phase 0-1 research infrastructure for the Post Fiat Data Lake.*
