---
layout: default
title: "Agent-Readable Alpha Brief Schema Pack"
date: 2026-05-01
category: network
status: published
task_id: 4f7ed0a5-df7b-4d44-908a-360c6c147e9f
reward: 3957 PFT
---

# Agent-Readable Alpha Brief Schema Pack

**Date:** May 1, 2026  
**Task ID:** 4f7ed0a5-df7b-4d44-908a-360c6c147e9f

---

## 1. JSON Schema

Three brief types, one base schema with type-specific extensions.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "PostFiatAlphaBrief",
  "description": "Structured alpha brief for human evaluation and agent reuse",
  "type": "object",
  "required": [
    "brief_id", "brief_type", "thesis", "asset_or_market",
    "time_horizon", "catalyst", "data_sources", "base_case",
    "upside_case", "downside_case", "invalidation", "confidence",
    "risk_controls", "evidence_links", "agent_readable_summary"
  ],
  "properties": {
    "brief_id": {
      "type": "string",
      "description": "Unique identifier (UUID or short slug)"
    },
    "brief_type": {
      "type": "string",
      "enum": ["event_trade", "structural_thesis", "intelligence_signal"],
      "description": "Determines the actionability path and required fields"
    },
    "thesis": {
      "type": "string",
      "description": "One-paragraph core claim. What do you believe and why?",
      "maxLength": 500
    },
    "asset_or_market": {
      "type": "string",
      "description": "What asset, sector, or market this applies to"
    },
    "time_horizon": {
      "type": "object",
      "required": ["duration", "unit"],
      "properties": {
        "duration": {"type": "integer"},
        "unit": {"type": "string", "enum": ["days", "weeks", "months"]},
        "expiry_date": {"type": "string", "format": "date"},
        "urgency": {"type": "string", "enum": ["immediate", "this_week", "this_month", "this_quarter", "multi_quarter"]}
      }
    },
    "catalyst": {
      "type": "object",
      "required": ["description", "expected_timing"],
      "properties": {
        "description": {"type": "string"},
        "expected_timing": {"type": "string"},
        "probability_estimate": {"type": "number", "minimum": 0, "maximum": 1},
        "observable_trigger": {"type": "string", "description": "What specific event confirms the catalyst has fired?"}
      }
    },
    "data_sources": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["source", "type", "freshness"],
        "properties": {
          "source": {"type": "string"},
          "type": {"type": "string", "enum": ["primary_data", "public_filing", "llm_query", "chain_data", "news", "expert_observation", "quantitative_analysis"]},
          "freshness": {"type": "string", "enum": ["real_time", "today", "this_week", "this_month", "stale"]},
          "url": {"type": "string", "format": "uri"}
        }
      },
      "minItems": 1
    },
    "base_case": {
      "type": "object",
      "required": ["description", "probability"],
      "properties": {
        "description": {"type": "string"},
        "probability": {"type": "number", "minimum": 0, "maximum": 1},
        "expected_return": {"type": "string"}
      }
    },
    "upside_case": {
      "type": "object",
      "required": ["description", "probability"],
      "properties": {
        "description": {"type": "string"},
        "probability": {"type": "number", "minimum": 0, "maximum": 1},
        "expected_return": {"type": "string"},
        "what_must_go_right": {"type": "string"}
      }
    },
    "downside_case": {
      "type": "object",
      "required": ["description", "probability"],
      "properties": {
        "description": {"type": "string"},
        "probability": {"type": "number", "minimum": 0, "maximum": 1},
        "expected_loss": {"type": "string"},
        "what_goes_wrong": {"type": "string"}
      }
    },
    "invalidation": {
      "type": "object",
      "required": ["condition", "observable"],
      "properties": {
        "condition": {"type": "string", "description": "What specific outcome proves the thesis wrong?"},
        "observable": {"type": "boolean", "description": "Can this be checked without private data?"},
        "check_frequency": {"type": "string", "enum": ["daily", "weekly", "on_catalyst", "at_expiry"]}
      }
    },
    "confidence": {
      "type": "object",
      "required": ["level", "basis"],
      "properties": {
        "level": {"type": "string", "enum": ["high", "medium", "low", "speculative"]},
        "basis": {"type": "string", "description": "What gives you this confidence level?"},
        "edge_source": {"type": "string", "enum": ["proprietary_data", "timing", "framework", "contrarian_view", "domain_expertise", "convergence_analysis"]}
      }
    },
    "position_sensitivity_notes": {
      "type": "string",
      "description": "How sensitive is the thesis to position sizing, entry timing, or instrument choice?"
    },
    "risk_controls": {
      "type": "object",
      "required": ["max_loss_description"],
      "properties": {
        "max_loss_description": {"type": "string"},
        "stop_condition": {"type": "string"},
        "position_sizing_guidance": {"type": "string"},
        "kill_switch": {"type": "string", "description": "Under what condition should everything be closed?"}
      }
    },
    "evidence_links": {
      "type": "array",
      "items": {"type": "string", "format": "uri"},
      "minItems": 1,
      "description": "Public URLs supporting the thesis"
    },
    "agent_readable_summary": {
      "type": "string",
      "description": "One-paragraph summary an AI agent can parse for routing, scoring, and comparison",
      "maxLength": 300
    },
    "brief_type_extensions": {
      "type": "object",
      "description": "Type-specific fields",
      "properties": {
        "event_trade": {
          "type": "object",
          "properties": {
            "event_date": {"type": "string", "format": "date"},
            "pre_event_positioning": {"type": "string"},
            "post_event_action": {"type": "string"},
            "iv_consideration": {"type": "string"}
          }
        },
        "structural_thesis": {
          "type": "object",
          "properties": {
            "thesis_duration_months": {"type": "integer"},
            "rebalance_frequency": {"type": "string"},
            "scaling_rules": {"type": "string"},
            "sector_correlation": {"type": "string"}
          }
        },
        "intelligence_signal": {
          "type": "object",
          "properties": {
            "methodology": {"type": "string"},
            "replication_instructions": {"type": "string"},
            "refresh_cadence": {"type": "string"},
            "consumers": {"type": "string", "description": "Who should act on this signal?"}
          }
        }
      }
    }
  }
}
```

### Brief Type Paths

| Type | What it is | Path to actionability | Key fields |
|------|-----------|----------------------|------------|
| **event_trade** | Time-bound, catalyst-driven | Identify event -> position before -> manage through -> exit after | event_date, pre_event_positioning, iv_consideration |
| **structural_thesis** | Multi-month repricing | Build conviction -> size position -> scale with confirmation -> kill switch | thesis_duration_months, rebalance_frequency, scaling_rules |
| **intelligence_signal** | Data/observation others can act on | Produce signal -> document methodology -> enable replication -> refresh | methodology, replication_instructions, refresh_cadence |

---

## 2. Markdown Authoring Template

```markdown
# Alpha Brief: [Title]

**Brief ID:** [UUID or slug]
**Brief Type:** [event_trade / structural_thesis / intelligence_signal]
**Date:** [YYYY-MM-DD]
**Author:** [handle or anonymous]

## Thesis
[One paragraph. What do you believe and why? State the claim, not the background.]

## Asset / Market
[What specific asset, sector, or market does this apply to?]

## Time Horizon
- Duration: [X days/weeks/months]
- Urgency: [immediate / this_week / this_month / this_quarter / multi_quarter]
- Expiry: [date by which the thesis is invalid if nothing has happened]

## Catalyst
- What: [specific event or condition that triggers the thesis]
- When: [expected timing]
- Probability: [0-100%]
- Observable trigger: [what confirms the catalyst fired?]

## Data Sources
1. [Source name] | [type: primary_data/public_filing/llm_query/chain_data/news/expert_observation/quantitative_analysis] | [freshness: real_time/today/this_week/stale] | [URL]
2. [...]

## Scenarios

### Base Case ([X]% probability)
[What happens if the thesis partially plays out?]
Expected outcome: [return or impact]

### Upside Case ([X]% probability)
[What happens if everything goes right?]
What must go right: [specific conditions]

### Downside Case ([X]% probability)
[What happens if the thesis is wrong?]
What goes wrong: [specific failure mode]

## Invalidation
- Condition: [what proves the thesis wrong?]
- Observable: [yes/no — can this be checked without private data?]
- Check frequency: [daily / weekly / on_catalyst / at_expiry]

## Confidence
- Level: [high / medium / low / speculative]
- Basis: [what gives you this confidence?]
- Edge source: [proprietary_data / timing / framework / contrarian_view / domain_expertise / convergence_analysis]

## Position Sensitivity
[How sensitive is the outcome to entry timing, position sizing, or instrument choice?]

## Risk Controls
- Max loss: [what is the maximum acceptable loss?]
- Stop condition: [when do you exit?]
- Kill switch: [under what condition do you close everything?]

## Evidence Links
- [URL 1]
- [URL 2]

## Agent-Readable Summary
[One paragraph, max 300 chars. An AI agent uses this to route, score, and compare this brief against others.]

## Type-Specific Fields

### [If event_trade:]
- Event date: [YYYY-MM-DD]
- Pre-event positioning: [what to do before the event]
- Post-event action: [what to do after]
- IV consideration: [is implied volatility high/low, and does that matter?]

### [If structural_thesis:]
- Thesis duration: [months]
- Rebalance frequency: [weekly / monthly / quarterly]
- Scaling rules: [when and how to add to the position]
- Sector correlation: [what else moves if this thesis is right?]

### [If intelligence_signal:]
- Methodology: [how was this signal produced?]
- Replication: [how can someone else reproduce it?]
- Refresh cadence: [how often should this be re-run?]
- Consumers: [who should act on this signal?]
```

---

## 3. Example Briefs

### Example 1: Event Trade — UFO Disclosure Flow

```json
{
  "brief_id": "ufo-disclosure-flow-2026-04",
  "brief_type": "event_trade",
  "thesis": "Trump signaled imminent UFO file release. When files drop, retail asks LLMs 'what stocks benefit from UFO disclosure.' All models converge on UFOD ETF holdings. Small-cap holdings (AMTM, AMSC) get disproportionate flow because they are illiquid and LLMs surface them as canonical 'UFO stocks.' The trade is the attention spike, not the aliens.",
  "asset_or_market": "AMTM (Amentum Holdings), AMSC (American Superconductor) — small-cap UFOD ETF holdings",
  "time_horizon": {
    "duration": 60,
    "unit": "days",
    "urgency": "this_month",
    "expiry_date": "2026-07-01"
  },
  "catalyst": {
    "description": "Trump releases UFO/UAP files as publicly signaled on April 29, 2026",
    "expected_timing": "May-June 2026 ('near future' per Trump statement)",
    "probability_estimate": 0.6,
    "observable_trigger": "White House press release, congressional hearing scheduled, or Pentagon declassification order"
  },
  "data_sources": [
    {"source": "Trump press statement April 29, 2026", "type": "news", "freshness": "today", "url": "https://public-source.example.com"},
    {"source": "UFOD ETF holdings via stockanalysis.com", "type": "public_filing", "freshness": "this_week", "url": "https://stockanalysis.com/etf/ufod/holdings/"},
    {"source": "LLM convergence queries (GPT, Gemini, Grok)", "type": "llm_query", "freshness": "today"}
  ],
  "base_case": {
    "description": "Files released with moderate media coverage. UFOD inflows spike for 1-2 weeks. AMTM/AMSC move 20-30% on flow.",
    "probability": 0.35,
    "expected_return": "3-5x on OTM calls"
  },
  "upside_case": {
    "description": "Files contain genuinely surprising content. Cable news runs 24/7 for a week. Retail frenzy. AMTM/AMSC move 50-100%.",
    "probability": 0.15,
    "expected_return": "10-30x on OTM calls",
    "what_must_go_right": "Files must contain novel, visually compelling content that dominates news cycle for 5+ days"
  },
  "downside_case": {
    "description": "Trump walks back disclosure or files are mundane. No attention spike. Options expire worthless.",
    "probability": 0.50,
    "expected_loss": "100% of premium (defined risk)",
    "what_goes_wrong": "No file release, or release is boring/redacted. Media ignores."
  },
  "invalidation": {
    "condition": "Trump explicitly states no UFO file release is planned, OR 60 days pass with no catalyst",
    "observable": true,
    "check_frequency": "weekly"
  },
  "confidence": {
    "level": "speculative",
    "basis": "Trump's own public statement plus LLM convergence analysis showing predictable flow path",
    "edge_source": "convergence_analysis"
  },
  "position_sensitivity_notes": "Highly sensitive to timing. Options must be purchased BEFORE announcement date leaks, as IV will spike immediately on any scheduling news. Deep OTM calls on illiquid small-caps have wide bid-ask spreads.",
  "risk_controls": {
    "max_loss_description": "Total premium paid on all tickets. Defined risk.",
    "stop_condition": "Options expire worthless if no catalyst. No stop needed — max loss is premium.",
    "position_sizing_guidance": "Lottery-ticket sizing only. 1-2% of trading capital per ticket.",
    "kill_switch": "Close all if Trump explicitly walks back disclosure"
  },
  "evidence_links": [
    "https://stockanalysis.com/etf/ufod/holdings/",
    "https://pft.permanentupperclass.com/alpha/llm-retail-signal/"
  ],
  "agent_readable_summary": "Event trade: UFO disclosure catalyst routes retail LLM queries to UFOD ETF holdings. Small-cap holdings AMTM/AMSC get disproportionate flow. Speculative OTM calls, lottery sizing, 60-day window. Max loss = premium.",
  "brief_type_extensions": {
    "event_trade": {
      "event_date": "2026-06-01",
      "pre_event_positioning": "Buy OTM calls on AMTM and AMSC before announcement date leaks",
      "post_event_action": "Sell 50% on initial spike, trail remainder with 30% stop",
      "iv_consideration": "IV is currently low on these names (no one is positioned). Will spike on any scheduling news."
    }
  }
}
```

### Example 2: Intelligence Signal — LLM Convergence Corpus

```json
{
  "brief_id": "llm-convergence-v1-2026-04",
  "brief_type": "intelligence_signal",
  "thesis": "Consumer LLMs (GPT, Claude, Gemini, Grok) produce highly convergent stock recommendations when queried with thematic retail prompts. The top 2 tickers per theme capture 60-80% of recommendation density. This convergence predicts where retail flow will concentrate when a theme catalyst hits. The signal is the model sameness, not model intelligence.",
  "asset_or_market": "Cross-sector: AI infrastructure, GLP-1, quantum computing, nuclear/SMR, robotics (14 themes tracked)",
  "time_horizon": {
    "duration": 12,
    "unit": "months",
    "urgency": "this_quarter",
    "expiry_date": "2027-04-30"
  },
  "catalyst": {
    "description": "Any theme-specific catalyst (earnings, policy, product launch) that triggers retail LLM queries",
    "expected_timing": "Ongoing — each theme has its own catalyst timeline",
    "probability_estimate": 0.9,
    "observable_trigger": "Google Trends spike for '[theme] stocks' combined with volume spike on high-convergence tickers"
  },
  "data_sources": [
    {"source": "Direct LLM queries across GPT, Gemini, Grok (browser capture)", "type": "llm_query", "freshness": "this_week"},
    {"source": "Yahoo Finance options chains", "type": "primary_data", "freshness": "real_time"},
    {"source": "UFOD ETF holdings (stockanalysis.com)", "type": "public_filing", "freshness": "this_week", "url": "https://stockanalysis.com/etf/ufod/holdings/"}
  ],
  "base_case": {
    "description": "Convergence scores remain stable across weekly re-queries. High-convergence tickers capture measurably more retail flow on catalyst days than low-convergence peers.",
    "probability": 0.6,
    "expected_return": "Signal confirmed as predictive. Enables systematic pre-catalyst positioning."
  },
  "upside_case": {
    "description": "Convergence predicts retail flow with high accuracy across multiple themes. Becomes a reusable alpha signal for the Data Lake.",
    "probability": 0.25,
    "expected_return": "Systematic edge on every theme catalyst. Compounding returns across themes.",
    "what_must_go_right": "LLM outputs must remain stable (not rapidly re-ranked), and retail must actually use LLMs for investment decisions at scale"
  },
  "downside_case": {
    "description": "LLM outputs change rapidly between re-queries, or retail doesn't use LLMs for stock selection. Convergence is unstable and not predictive.",
    "probability": 0.15,
    "expected_loss": "Research time invested. No capital at risk in signal production.",
    "what_goes_wrong": "Models update recommendations faster than weekly re-query, or retail flow doesn't follow LLM recommendations"
  },
  "invalidation": {
    "condition": "Convergence scores are unstable across 3 consecutive weekly re-queries (top-2 tickers change in majority of themes), OR high-convergence tickers do not outperform low-convergence peers on catalyst days across 3+ themes",
    "observable": true,
    "check_frequency": "weekly"
  },
  "confidence": {
    "level": "medium",
    "basis": "Initial seed corpus shows tight convergence (NVDA and LLY at perfect 1.000 scores). Not yet validated against historical catalyst events.",
    "edge_source": "convergence_analysis"
  },
  "position_sensitivity_notes": "This is a signal, not a trade. Sensitivity depends on how the signal is consumed. Event trades derived from this signal are highly timing-sensitive. Structural positions are less so.",
  "risk_controls": {
    "max_loss_description": "No capital at risk in signal production. Only research time.",
    "stop_condition": "Discontinue if invalidation condition is met across 3 weekly checks",
    "position_sizing_guidance": "N/A — this is research infrastructure, not a position",
    "kill_switch": "If LLM providers add randomization to investment-related queries (breaking convergence)"
  },
  "evidence_links": [
    "https://pft.permanentupperclass.com/alpha/llm-retail-signal/",
    "https://gist.github.com/0xzoz/7798d5f39d9eaf2cae1d37127c479221",
    "https://pft.permanentupperclass.com/scanner/"
  ],
  "agent_readable_summary": "Intelligence signal: LLM recommendation convergence across 5 consumer models predicts retail flow concentration on theme catalysts. Top 2 tickers per theme capture 60-80% of recommendation density. Weekly re-query corpus with convergence scoring. No capital at risk. Reusable for event trade and structural thesis generation.",
  "brief_type_extensions": {
    "intelligence_signal": {
      "methodology": "Query 5 consumer LLMs with 6 prompt templates across 14 themes. Extract ticker mentions, rank, qualifying language. Compute cross-model convergence score. Adjust by capture confidence (captured_slots / 5).",
      "replication_instructions": "Run the same 6 prompts in GPT, Gemini, Grok. Record tickers, rank order, and mention type per model. Score: (models_mentioning/captured) * 0.5 + (1/avg_rank) * 0.3 + (direct_recs/total) * 0.2",
      "refresh_cadence": "Weekly. Same prompts, fresh responses. Diff against prior week for rank changes and tier migrations.",
      "consumers": "Event traders (pre-position on high-convergence names before catalysts), structural thesis builders (identify themes transitioning from emerging to peak_hype), and the Post Fiat Data Lake."
    }
  }
}
```

---

## 4. Evaluator Rubric

Score each alpha brief on 4 dimensions (1-5 scale):

| Dimension | 1 (Poor) | 3 (Adequate) | 5 (Excellent) |
|-----------|----------|-------------|---------------|
| **Source Quality** | Single unverified source. No URLs. "I heard" or "I think." | 2-3 public sources with URLs. Mix of types (news + data). | 3+ diverse sources with URLs. Includes primary data or quantitative analysis. Sources are independently verifiable. |
| **Falsifiability** | No invalidation condition. "This will work." | Invalidation stated but vague or untestable. "If the market doesn't agree..." | Specific, observable invalidation with check frequency. "If X doesn't happen by Y date, the thesis is wrong." Binary, machine-checkable. |
| **Timeliness** | Stale data (>30 days). No urgency signal. Could have been written months ago. | Data from this month. Catalyst timing estimated. | Real-time or same-week data. Specific catalyst date or trigger. Time-sensitive insight that loses value if delayed. |
| **Actionability** | No clear action path. "This is interesting." | General direction ("go long X") without sizing, timing, or risk controls. | Specific instrument, entry criteria, position sizing guidance, stop condition, and kill switch. An agent could route this to execution with no additional context. |

### Scoring by Brief Type

Different types have different emphasis:

| Type | Primary Dimension | Secondary | Must-Pass |
|------|------------------|-----------|-----------|
| event_trade | Timeliness (is the catalyst imminent?) | Actionability (can you position now?) | Falsifiability (specific invalidation date) |
| structural_thesis | Source Quality (is the thesis well-supported?) | Actionability (sizing + scaling rules) | Falsifiability (kill switch condition) |
| intelligence_signal | Source Quality (is the methodology sound?) | Timeliness (is the data fresh?) | Falsifiability (replication instructions that others can verify) |

### Agent Scoring

For automated scoring, agents should weight:

```
agent_score = (
    source_quality * 0.30 +
    falsifiability * 0.30 +
    timeliness * 0.20 +
    actionability * 0.20
)
```

Briefs scoring below 3.0 should be flagged for revision before entering the Data Lake. Briefs scoring 4.0+ should be surfaced to active traders and thesis consumers.

### Disqualifiers (auto-reject regardless of score)

- Contains personalized financial advice ("you should buy X")
- Missing invalidation condition entirely
- No public evidence links
- Thesis is tautological ("X will go up because it's going up")
- Contains MNPI, insider information, or non-public product data

---

*This schema is research infrastructure for the Post Fiat Data Lake. It does not constitute personalized financial advice. All examples use public data only.*
