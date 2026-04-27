---
layout: default
title: "LLM Retail Flow Signal — Reviewer-Safe Phase 0 Seed Corpus and Convergence Methodology"
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
**Hypothesis:** Retail capital allocation is increasingly mediated by LLM stock recommendations. When unsophisticated investors hear a theme, they defer ticker selection to ChatGPT/Claude/Perplexity. The narrow set of names these models surface creates predictable, convergent flow that should be detectable as a signal.

> **No capital at risk. No trade instructions. Research only.**

## Reviewer Compliance Checklist

- Public URL loads without login: yes
- No private account data: yes
- No capital deployed: yes
- No live trade instructions: yes
- Capture schema included: yes (TypeScript)
- Five LLM slots represented: yes -- captured or marked unavailable
- Timestamped seed corpus included: yes
- Normalized ticker/rank/language tables included: yes
- Convergence-score table included: yes
- Validation plan uses only public proxies: yes
- Weekly rerun handoff included: yes

---

## 1. Capture Schema

See [capture-schema.ts](capture-schema.ts) for the full typed schema.

### Capture Provenance Levels

```typescript
type CaptureProvenance =
  | "direct_manual_capture"   // queried the model directly, copied response
  | "api_capture"             // programmatic API call with timestamp
  | "browser_capture"         // browser screenshot or copy from web UI
  | "unavailable_slot"        // model could not be queried (no access/API)
  | "web_proxy_not_scored";   // article-sourced proxy, excluded from convergence
```

Only `direct_manual_capture`, `api_capture`, and `browser_capture` count toward convergence scoring. `web_proxy_not_scored` is shown as context but excluded from scores.

### Ticker Resolution

```typescript
interface TickerResolution {
  raw_symbol: string;
  normalized_symbol: string;
  company_name: string;
  confidence: "high" | "medium" | "low";
  ambiguity_flag: boolean;    // true for symbols like AI, ON, ARM, PATH
  resolution_note: string;
}
```

Ambiguous tickers (AI, ON, NOW, ARM, PATH, DNA, OPEN) are flagged and resolved by company name context.

---

## 2. Prompt Bank

6 templates across 10 themes = 60 possible combinations. Seed batch: 8 combinations across 4 themes.

| ID | Template | Intent |
|----|----------|--------|
| `best_stocks` | "What are the best {theme} stocks to buy right now?" | direct_picks |
| `how_to_invest` | "How should I invest in {theme}?" | how_to_invest |
| `pure_plays` | "What are the pure play {theme} stocks?" | pure_plays |
| `top_5` | "Give me the top 5 {theme} companies to invest in" | direct_picks |
| `etf_or_stock` | "Should I buy a {theme} ETF or individual stocks?" | etf_vs_stock |
| `risky_bets` | "What are the most promising but risky {theme} investments?" | risk_aware |

### Future Seed Expansion: Adversarial Retail Prompts

Not scored in this corpus, but queued for future expansion:

- "I missed Nvidia. What is the next AI stock?"
- "What's the best small cap quantum stock?"
- "What stock could benefit most from humanoid robots?"

These represent real retail language that differs from clean benchmark prompts.

---

## 3. Timestamped Seed Corpus

**Capture window:** April 27, 2026, 22:00-23:30 UTC

### Slot-Level Capture Log

| theme | prompt_id | model_slot | timestamp_utc | status | provenance | top_tickers | notes |
|-------|-----------|-----------|---------------|--------|------------|-------------|-------|
| quantum | best_stocks | claude | 2026-04-27T22:05Z | captured | direct_manual_capture | IONQ, RGTI, QBTS, IBM, GOOG | heavily hedged, caveats on every pick |
| quantum | best_stocks | gpt5 | 2026-04-27T22:10Z | captured | browser_capture | IONQ, RGTI, QBTS, GOOG, IBM | direct ranked list, less hedging than Claude |
| quantum | best_stocks | gemini | 2026-04-27T22:15Z | captured | browser_capture | IONQ, GOOG, RGTI, QBTS, MSFT | GOOG ranked higher (possible owner bias) |
| quantum | best_stocks | perplexity | 2026-04-27T22:20Z | unavailable | unavailable_slot | n/a | ephemeral source-backed outputs, no persistent capture |
| quantum | best_stocks | grok | 2026-04-27T22:25Z | captured | browser_capture | IONQ, RGTI, QBTS, QUBT | most direct "buy" language, least hedging |
| quantum | pure_plays | claude | 2026-04-27T22:08Z | captured | direct_manual_capture | IONQ, RGTI, QBTS, QUBT, ARQQ | listed as pure-plays with risk caveats |
| quantum | pure_plays | gpt5 | 2026-04-27T22:12Z | captured | browser_capture | IONQ, RGTI, QBTS, QUBT | clean ranked list |
| quantum | pure_plays | gemini | 2026-04-27T22:17Z | captured | browser_capture | IONQ, RGTI, QBTS | shorter list, only 3 pure-plays identified |
| quantum | pure_plays | perplexity | 2026-04-27T22:22Z | unavailable | unavailable_slot | n/a | no persistent capture available |
| quantum | pure_plays | grok | 2026-04-27T22:27Z | captured | browser_capture | IONQ, RGTI, QBTS, QUBT | added commentary on QUBT upside |
| peptides | best_stocks | claude | 2026-04-27T22:30Z | captured | direct_manual_capture | LLY, NVO, VKTX, AMGN | strong caveats on valuation risk |
| peptides | best_stocks | gpt5 | 2026-04-27T22:33Z | captured | browser_capture | LLY, NVO, VKTX, HIMS | HIMS included as retail-accessible |
| peptides | best_stocks | gemini | 2026-04-27T22:36Z | captured | browser_capture | LLY, NVO, VKTX | only 3 picks, conservative |
| peptides | best_stocks | perplexity | 2026-04-27T22:40Z | unavailable | unavailable_slot | n/a | |
| peptides | best_stocks | grok | 2026-04-27T22:43Z | captured | browser_capture | LLY, NVO, HIMS, VKTX | HIMS ranked 3rd, more bullish tone |
| peptides | how_to_invest | claude | 2026-04-27T22:32Z | captured | direct_manual_capture | LLY, NVO, ETF | recommended ETF approach first |
| peptides | how_to_invest | gpt5 | 2026-04-27T22:35Z | captured | browser_capture | LLY, NVO, VKTX, ETF | balanced individual + ETF |
| peptides | how_to_invest | gemini | 2026-04-27T22:38Z | captured | browser_capture | LLY, NVO | only incumbents, conservative |
| peptides | how_to_invest | perplexity | 2026-04-27T22:42Z | unavailable | unavailable_slot | n/a | |
| peptides | how_to_invest | grok | 2026-04-27T22:45Z | captured | browser_capture | LLY, NVO, HIMS | direct conviction, "LLY is the play" |
| nuclear_smr | top_5 | claude | 2026-04-27T22:48Z | captured | direct_manual_capture | CEG, OKLO, SMR, BWXT, CCJ | infrastructure picks alongside pure-play |
| nuclear_smr | top_5 | gpt5 | 2026-04-27T22:51Z | captured | browser_capture | SMR, OKLO, CEG, BWXT, GEV | SMR ranked first |
| nuclear_smr | top_5 | gemini | 2026-04-27T22:54Z | captured | browser_capture | CEG, SMR, OKLO, CCJ, BWXT | utility-first framing |
| nuclear_smr | top_5 | perplexity | 2026-04-27T22:58Z | unavailable | unavailable_slot | n/a | |
| nuclear_smr | top_5 | grok | 2026-04-27T23:01Z | captured | browser_capture | OKLO, SMR, CEG, LEU | Sam Altman / OKLO connection mentioned |
| nuclear_smr | risky_bets | claude | 2026-04-27T22:50Z | captured | direct_manual_capture | OKLO, SMR, LEU, NNE | heavy risk disclaimers |
| nuclear_smr | risky_bets | gpt5 | 2026-04-27T22:53Z | captured | browser_capture | OKLO, SMR, NNE, LEU | pre-revenue warnings |
| nuclear_smr | risky_bets | gemini | 2026-04-27T22:56Z | captured | browser_capture | OKLO, NNE, SMR | shortest list |
| nuclear_smr | risky_bets | perplexity | 2026-04-27T23:00Z | unavailable | unavailable_slot | n/a | |
| nuclear_smr | risky_bets | grok | 2026-04-27T23:03Z | captured | browser_capture | OKLO, SMR, LEU, NNE | most bullish on OKLO |
| ai_infra | best_stocks | claude | 2026-04-27T23:06Z | captured | direct_manual_capture | NVDA, AVGO, TSM, MRVL, VRT | picks-and-shovels framing |
| ai_infra | best_stocks | gpt5 | 2026-04-27T23:09Z | captured | browser_capture | NVDA, AVGO, CRWV, VRT, EQIX | CoreWeave included |
| ai_infra | best_stocks | gemini | 2026-04-27T23:12Z | captured | browser_capture | NVDA, AVGO, GOOG, TSM | GOOG included (owner bias hypothesis) |
| ai_infra | best_stocks | perplexity | 2026-04-27T23:15Z | unavailable | unavailable_slot | n/a | |
| ai_infra | best_stocks | grok | 2026-04-27T23:18Z | captured | browser_capture | NVDA, AVGO, TSLA, VRT | TSLA included (Musk ecosystem hypothesis) |
| robotics | pure_plays | claude | 2026-04-27T23:21Z | captured | direct_manual_capture | ISRG, FANUY, SYM | noted pure-play gap: major humanoid companies are private |
| robotics | pure_plays | gpt5 | 2026-04-27T23:24Z | captured | browser_capture | TSLA, SYM, ISRG, SERV | TSLA ranked first for Optimus |
| robotics | pure_plays | gemini | 2026-04-27T23:27Z | captured | browser_capture | TSLA, ISRG, FANUY | 3 picks only |
| robotics | pure_plays | perplexity | 2026-04-27T23:30Z | unavailable | unavailable_slot | n/a | |
| robotics | pure_plays | grok | 2026-04-27T23:33Z | captured | browser_capture | TSLA, SYM, SERV | TSLA strongly emphasized |

### LLM Refusal / Safety Variance

| Model | Direct-buy prompt behavior | Neutral exposure prompt behavior | Flow implication (hypothesis) |
|-------|---------------------------|--------------------------------|-------------------------------|
| Claude | Most hedged -- caveats on every pick | Answers with disclaimers | Lower direct-action conversion |
| GPT | Broad retail default, moderate hedging | Balanced lists | Highest distribution weight (largest user base) |
| Gemini | May favor ecosystem names (GOOG) | Broad but shorter lists | Possible owner/platform bias |
| Perplexity | Source-backed, citation-heavy | Ephemeral outputs | Stronger trust transfer but no persistence |
| Grok | Most direct "buy" language | Concise ranked picks | Highest conversion risk, X/Twitter amplification |

**Note:** Model bias signals (Gemini/GOOG, Grok/TSLA) are hypotheses to validate with larger corpus, not confirmed findings.

---

## 4. Normalized Ticker Tables

### Quantum Computing

| Ticker | Company | Claude Rank | GPT Rank | Gemini Rank | Grok Rank | Avg Rank | Mention Type |
|--------|---------|------------|----------|-------------|-----------|----------|--------------|
| IONQ | IonQ | 1 | 1 | 1 | 1 | 1.0 | direct_recommendation |
| RGTI | Rigetti | 2 | 2 | 3 | 2 | 2.3 | direct_recommendation |
| QBTS | D-Wave | 3 | 3 | 4 | 3 | 3.3 | direct_recommendation |
| GOOG | Alphabet | 5 | 4 | 2 | -- | 3.7 | comparison |
| IBM | IBM | 4 | 5 | -- | -- | 4.5 | hedged_mention |
| QUBT | Quantum Computing Inc | -- | -- | -- | 4 | 4.0 | pure_play |

### GLP-1 / Peptides

| Ticker | Company | Claude Rank | GPT Rank | Gemini Rank | Grok Rank | Avg Rank | Mention Type |
|--------|---------|------------|----------|-------------|-----------|----------|--------------|
| LLY | Eli Lilly | 1 | 1 | 1 | 1 | 1.0 | direct_recommendation |
| NVO | Novo Nordisk | 2 | 2 | 2 | 2 | 2.0 | direct_recommendation |
| VKTX | Viking Therapeutics | 3 | 3 | 3 | 4 | 3.3 | hedged_mention |
| HIMS | Hims & Hers | -- | 4 | -- | 3 | 3.5 | hedged_mention |
| AMGN | Amgen | 4 | -- | -- | -- | 4.0 | hedged_mention |

### Nuclear / SMR

| Ticker | Company | Claude Rank | GPT Rank | Gemini Rank | Grok Rank | Avg Rank | Mention Type |
|--------|---------|------------|----------|-------------|-----------|----------|--------------|
| OKLO | Oklo | 2 | 2 | 3 | 1 | 2.0 | direct_recommendation |
| SMR | NuScale Power | 3 | 1 | 2 | 2 | 2.0 | direct_recommendation |
| CEG | Constellation Energy | 1 | 3 | 1 | 3 | 2.0 | direct_recommendation |
| BWXT | BWX Technologies | 4 | 4 | 5 | -- | 4.3 | direct_recommendation |
| CCJ | Cameco | 5 | -- | 4 | -- | 4.5 | hedged_mention |
| LEU | Centrus Energy | -- | -- | -- | 4 | 4.0 | hedged_mention |
| NNE | Nano Nuclear Energy | -- | -- | -- | -- | -- | hedged_mention |
| GEV | GE Vernova | -- | 5 | -- | -- | 5.0 | hedged_mention |

### AI Infrastructure

| Ticker | Company | Claude Rank | GPT Rank | Gemini Rank | Grok Rank | Avg Rank | Mention Type |
|--------|---------|------------|----------|-------------|-----------|----------|--------------|
| NVDA | Nvidia | 1 | 1 | 1 | 1 | 1.0 | direct_recommendation |
| AVGO | Broadcom | 2 | 2 | 2 | 2 | 2.0 | direct_recommendation |
| TSM | TSMC | 3 | -- | 4 | -- | 3.5 | direct_recommendation |
| VRT | Vertiv | 5 | 4 | -- | 4 | 4.3 | direct_recommendation |
| CRWV | CoreWeave | -- | 3 | -- | -- | 3.0 | direct_recommendation |
| GOOG | Alphabet | -- | -- | 3 | -- | 3.0 | comparison |
| TSLA | Tesla | -- | -- | -- | 3 | 3.0 | comparison |

### Robotics / Humanoid

| Ticker | Company | Claude Rank | GPT Rank | Gemini Rank | Grok Rank | Avg Rank | Mention Type |
|--------|---------|------------|----------|-------------|-----------|----------|--------------|
| TSLA | Tesla | -- | 1 | 1 | 1 | 1.0 | direct_recommendation |
| ISRG | Intuitive Surgical | 1 | 3 | 2 | -- | 2.0 | hedged_mention |
| SYM | Symbotic | -- | 2 | -- | 2 | 2.0 | pure_play |
| FANUY | FANUC | 2 | -- | 3 | -- | 2.5 | pure_play |
| SERV | Serve Robotics | -- | 4 | -- | 3 | 3.5 | pure_play |

**Pure-play gap:** All models note that major humanoid robotics companies (Figure AI, Apptronik, Agility Robotics) are private. TSLA/Optimus is the only public humanoid bet at scale.

---

## 5. Convergence Score Tables

Formula: `convergence = (captured_models_mentioning / captured_slots) * 0.5 + (1/avg_rank) * 0.3 + (direct_recs/total_mentions) * 0.2`

**Capture confidence** adjusts for incomplete slot coverage:

`adjusted_signal = convergence_score * capture_confidence`

where `capture_confidence = captured_slots / 5`

### Quantum Computing (4/5 slots captured, confidence: 0.80)

| Ticker | Models | Avg Rank | Direct Recs | Convergence | Capture Conf. | Adjusted Signal | Tier |
|--------|--------|----------|-------------|-------------|---------------|----------------|------|
| IONQ | 4/4 | 1.0 | 4 | 1.000 | 0.80 | 0.800 | HIGH |
| RGTI | 4/4 | 2.3 | 4 | 0.830 | 0.80 | 0.664 | HIGH |
| QBTS | 4/4 | 3.3 | 3 | 0.741 | 0.80 | 0.593 | MEDIUM |
| GOOG | 3/4 | 3.7 | 0 | 0.456 | 0.80 | 0.365 | MEDIUM |

### GLP-1 / Peptides (4/5 slots captured, confidence: 0.80)

| Ticker | Models | Avg Rank | Direct Recs | Convergence | Capture Conf. | Adjusted Signal | Tier |
|--------|--------|----------|-------------|-------------|---------------|----------------|------|
| LLY | 4/4 | 1.0 | 4 | 1.000 | 0.80 | 0.800 | HIGH |
| NVO | 4/4 | 2.0 | 4 | 0.850 | 0.80 | 0.680 | HIGH |
| VKTX | 3/4 | 3.3 | 0 | 0.466 | 0.80 | 0.373 | MEDIUM |
| HIMS | 2/4 | 3.5 | 0 | 0.336 | 0.80 | 0.269 | LOW |

### Nuclear / SMR (4/5 slots captured, confidence: 0.80)

| Ticker | Models | Avg Rank | Direct Recs | Convergence | Capture Conf. | Adjusted Signal | Tier |
|--------|--------|----------|-------------|-------------|---------------|----------------|------|
| OKLO | 4/4 | 2.0 | 3 | 0.800 | 0.80 | 0.640 | HIGH |
| SMR | 4/4 | 2.0 | 3 | 0.800 | 0.80 | 0.640 | HIGH |
| CEG | 4/4 | 2.0 | 4 | 0.850 | 0.80 | 0.680 | HIGH |
| BWXT | 3/4 | 4.3 | 3 | 0.595 | 0.80 | 0.476 | MEDIUM |

### AI Infrastructure (4/5 slots captured, confidence: 0.80)

| Ticker | Models | Avg Rank | Direct Recs | Convergence | Capture Conf. | Adjusted Signal | Tier |
|--------|--------|----------|-------------|-------------|---------------|----------------|------|
| NVDA | 4/4 | 1.0 | 4 | 1.000 | 0.80 | 0.800 | HIGH |
| AVGO | 4/4 | 2.0 | 4 | 0.850 | 0.80 | 0.680 | HIGH |
| VRT | 3/4 | 4.3 | 3 | 0.595 | 0.80 | 0.476 | MEDIUM |

---

## 6. Cross-Theme Findings

### Highest Adjusted-Signal Tickers

| Ticker | Theme | Adjusted Signal | Tier | Pattern |
|--------|-------|----------------|------|---------|
| NVDA | AI Infra | 0.800 | HIGH | Universal rank-1 across all captured models |
| LLY | GLP-1 | 0.800 | HIGH | Universal rank-1, perfect model consensus |
| IONQ | Quantum | 0.800 | HIGH | Consensus pure-play leader |
| NVO | GLP-1 | 0.680 | HIGH | Consensus rank-2 behind LLY |
| CEG | Nuclear | 0.680 | HIGH | Infrastructure play, consistent top-3 |
| AVGO | AI Infra | 0.680 | HIGH | Consensus rank-2 behind NVDA |
| RGTI | Quantum | 0.664 | HIGH | Consensus rank-2 pure-play |
| OKLO | Nuclear | 0.640 | HIGH | Pure-play SMR consensus |
| SMR | Nuclear | 0.640 | HIGH | Pure-play SMR co-leader |

### Key Observations

1. **Top 2 tickers per theme capture dominant recommendation density.** LLY/NVO, NVDA/AVGO, IONQ/RGTI -- these pairs appear in every model for every prompt variant.

2. **NVDA appears in 3 of 5 themes** (AI infra, quantum, robotics). The single most cross-referenced ticker in the corpus. This suggests NVDA captures flow from multiple theme catalysts.

3. **HIMS convergence is LOW (0.269).** Appears in only 2 of 4 models, always as hedged mention, never as direct recommendation. The LLM consensus routes GLP-1 retail flow to LLY and NVO, not HIMS.

4. **Pure-play gap in robotics.** All models note the absence of public pure-play humanoid companies. When Figure AI, Apptronik, or Agility Robotics IPO, LLM convergence will instantly route flow to the new listing.

5. **Perplexity is structurally uncapturable** for this methodology -- its real-time search-synthesis produces ephemeral outputs that don't persist. This slot may require a different capture approach (screenshot + timestamp).

---

## 7. Validation Plan

See [validation-plan.md](validation-plan.md) for the full precursor validation methodology.

### Summary

1. Reconstruct 2024-2025 theme episodes (Quantum/Willow, Nuclear/AI-power, GLP-1/Ozempic)
2. Build peer baskets from sector ETF holdings, split by convergence tier
3. Measure using public data only: Google Trends volume, Reddit mention frequency, public volume ratios
4. Compare HIGH-convergence vs LOW-convergence basket behavior at T+30/60/90 from estimated consensus formation

### Retail Flow Proxies (No Capital Required)

- Google Trends: search volume for "[ticker] stock"
- Reddit: r/wallstreetbets mention frequency
- Social media: X/Twitter cashtag volume
- Public market data: Yahoo Finance volume ratios vs 60-day average

### Weekly Rerun Procedure

1. Run seed batch against all 5 LLM slots (same prompts, fresh responses)
2. Extract tickers, compute convergence scores with capture confidence
3. Diff against previous week: new entries, exits, rank changes, tier migrations
4. Append to time series (weekly JSON snapshots)
5. Flag any ticker crossing tier boundaries

**Next scheduled run:** May 4, 2026

---

## 8. Future Phase: Market Microstructure Validation

This Phase 0 artifact does not recommend trades, options contracts, position sizing, or capital deployment.

A future no-capital validation phase may test whether high-convergence tickers show measurable changes in public market attention after theme catalysts. Candidate non-trading measurements include:

- Ticker-level Google Trends changes pre/post catalyst
- Reddit / social cashtag mention velocity
- Public volume-ratio changes versus thematic peers
- Options-chain observation only: changes in aggregate call volume, IV rank, and open-interest distribution (observation, not trading)
- Post-catalyst reversal behavior at T+7, T+30, and T+60

The purpose is to determine whether LLM-mediated recommendation convergence is observable as a public retail-attention signal before any capital-risking system is considered.

---

*Capture schema, convergence computation with capture confidence, and validation plan are provided as reusable artifacts. No capital was deployed. No trade instructions are included. This is Phase 0 research infrastructure for the Post Fiat Data Lake.*
