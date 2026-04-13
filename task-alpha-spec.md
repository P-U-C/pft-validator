# Task Alpha — Contributor Intelligence Platform for Post Fiat

## What It Is

A real-time intelligence layer that sits on top of the Post Fiat task economy and gives contributors an unfair advantage in earning PFT. Built on our exclusive infrastructure: the only full-history archive node, the only behavioral classification engine, and the only network health monitor on the PFTL chain.

Not analytics. Not a dashboard. A **decision engine** that tells you what to work on, when to submit, and how you compare — backed by every transaction since genesis.

---

## The Market

**53 active earners** have completed **1,091 tasks** earning **6.5M PFT** in ~25 days. The median task pays **5,460 PFT**. The top earner has completed 68 tasks for 512K PFT. The bottom quartile earns 3x less per submission than the top quartile.

The difference between earners is not talent — it's **information**:
- Completion rates range from 30% to 49%. Every rejected submission is wasted effort.
- PFT-per-submission ranges from 1,560 to 3,665. A 2.3x spread.
- The network is quieter from 05:00-08:00 UTC (40-50 submissions/hr vs 150 at peak). Less competition, same rewards.

Contributors who understand the network earn more. Task Alpha makes that understanding automatic.

---

## Architecture

```
                    ┌─────────────────────────────────────┐
                    │         PFTL Archive Node            │
                    │   (full history, ledger 1 → now)     │
                    └──────────────┬──────────────────────┘
                                   │ account_tx RPC
                    ┌──────────────▼──────────────────────┐
                    │         Chain Indexer (hourly)        │
                    │   crawler → classifier → sybil        │
                    │   chain-index.db (25K+ txns)          │
                    └──────────────┬──────────────────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              │                    │                    │
    ┌─────────▼────────┐ ┌────────▼────────┐ ┌────────▼────────┐
    │   Lens Feeds      │ │  Alpha Engine    │ │  Alpha Bot      │
    │ health.json       │ │ scoring, timing  │ │ on-chain msgs   │
    │ auth.json         │ │ profiles, alerts │ │ or Telegram      │
    │ graph.json        │ │                  │ │                  │
    └──────────────────┘ └────────┬─────────┘ └────────┬────────┘
                                  │                     │
                         ┌────────▼─────────────────────▼────────┐
                         │          Task Alpha Dashboard          │
                         │     contributor-facing intelligence     │
                         └────────────────────────────────────────┘
```

**Key principle**: everything derives from public chain data via our archive node. No private APIs, no privileged access to the task node internals. Pure informational edge from superior indexing and analysis.

---

## Core Modules

### 1. Contributor Profile Engine

Every active address gets a computed profile, updated hourly:

```json
{
  "address": "rsS2Y6CK9dz9...",
  "rank": 6,
  "percentile": 89,
  "tasks_completed": 49,
  "total_earned_pft": 291167,
  "avg_reward_pft": 5942,
  "pft_per_submission": 2671,
  "completion_rate": 0.45,
  "active_days": 24,
  "daily_earn_rate": 12132,
  "streak_days": 3,
  "peak_hours_utc": [20, 21, 22, 23, 0],
  "peer_connections": 8,
  "network_share": 0.045,
  "trend": "rising"
}
```

**What the contributor sees**: "You're #6 on the network. Your completion rate is 45% (network avg is 41%). You earn 2,671 PFT per submission — 12% above median. Your best hours are 20:00-00:00 UTC. You've been rising for 3 days."

**Data source**: Reward transactions from distribution wallets cross-referenced with submissions to task nodes. All public chain data.

### 2. Task Signal Scorer

When a reward drops to another contributor, Task Alpha reverse-engineers what made that task valuable:

```json
{
  "signal_type": "high_value_window",
  "observation": "3 rewards >7000 PFT issued in last 2 hours",
  "network_state": {
    "active_submitters_1h": 4,
    "memo_velocity": "above_average",
    "competition_level": "low"
  },
  "recommendation": "submit_now",
  "confidence": 0.82
}
```

**Scoring inputs** (all on-chain):
- Recent reward sizes and frequency (are big tasks paying out right now?)
- Active submitter count in rolling window (competition pressure)
- Time-of-day patterns (UTC 05:00-08:00 has 60% less competition)
- Contributor's own completion rate at different activity levels
- Network memo velocity vs 7-day baseline (from health.json)

### 3. Earnings Optimizer

Track PFT earned across time windows with efficiency metrics:

```json
{
  "period": "7d",
  "submissions": 14,
  "completions": 6,
  "earned_pft": 38400,
  "pft_per_completion": 6400,
  "pft_per_submission": 2743,
  "efficiency_vs_network": 1.15,
  "optimal_submit_windows": ["20:00-01:00 UTC", "03:00-04:00 UTC"],
  "estimated_weekly_at_current_rate": 38400,
  "estimated_weekly_at_optimal_timing": 46000
}
```

**The insight**: contributors who submit during low-competition windows earn ~20% more per submission. Task Alpha computes your personal optimal windows based on your history.

### 4. Network Timing Engine

Real-time network state condensed into actionable signals:

| Signal | Source | Action |
|--------|--------|--------|
| `LOW_COMPETITION` | Active submitters < p25 in rolling 2h | "Submit now — fewer competitors" |
| `HIGH_REWARD_CYCLE` | Last 3 rewards > network median | "Big tasks paying out — stay active" |
| `VELOCITY_SURGE` | Memo velocity > 1.5x 7d avg | "Network heating up — more tasks available" |
| `VELOCITY_DROP` | Memo velocity < 0.5x 7d avg | "Quiet period — save effort for later" |
| `STREAK_RISK` | No submission in 36h | "Submit something to maintain activity streak" |

### 5. Leaderboard & Comparison

Live rankings with transparent methodology:

```
 # | Contributor      | Earned    | Tasks | Rate  | PFT/Sub | Trend
---|------------------|-----------|-------|-------|---------|------
 1 | rDVKRN...        | 512,340   |  68   | 47.2% |  3,558  |  ─
 2 | raL2kv...        | 458,163   |  61   | 48.8% |  3,665  |  ↑
 3 | rfLJ4Z...        | 415,920   |  48   | 40.7% |  3,525  |  ↑
 ...
 6 | rsS2Y6... (you)  | 291,167   |  49   | 45.0% |  2,671  |  ↑
```

Contributors can see exactly where they stand and what separates them from the tier above.

---

## Delivery Channels

### Channel 1: Dashboard (lens/alpha.html)

Static page on GitHub Pages, same infrastructure as Lens. Updates hourly. Any contributor can bookmark it and check their profile.

- Personal profile lookup (paste your address)
- Live network signals
- Leaderboard
- Earnings calculator
- Timing heatmap

**Cost to build**: ~1 day. We already have the serving infrastructure.

### Channel 2: On-Chain Bot

Our existing scout bot (`r3hH6UNw1eVQYiXbDVoarp2kN6JKyTYveT`) already handles on-chain queries. Add Alpha commands:

```
/alpha                → your profile + current signal
/alpha rank           → leaderboard
/alpha timing         → optimal submit windows right now
/alpha compare <addr> → head-to-head with another contributor
/alpha streak         → your activity streak + risk
```

**Cost to build**: ~4 hours. Router + new query types in existing bot.

### Channel 3: Telegram Alerts (optional)

Push notifications for high-value signals:
- "Low competition window open — 3 active submitters (avg: 8)"
- "You dropped from #5 to #7 this week — rDVKRN passed you"
- "Your 7-day earn rate is 15% above your 30-day average"

**Cost to build**: ~2 hours. We already have the Telegram channel.

---

## Revenue Model

### Model A: PFT Subscription

Contributors pay a monthly fee in PFT for Alpha access.

- **Free tier**: Basic profile, weekly leaderboard
- **Alpha tier**: 500 PFT/month — real-time signals, timing engine, earnings optimizer, priority bot access
- **Pro tier**: 1,000 PFT/month — everything + push alerts, historical analysis, strategy recommendations

At 53 active earners with median monthly earnings of ~120K PFT, a 500 PFT subscription is 0.4% of earnings. If Alpha improves earnings by even 5% (conservative, given the 2.3x efficiency spread), the ROI is 12x.

**Target**: 20 subscribers at 500 PFT/month = 10,000 PFT/month recurring.

### Model B: Performance Fee

Take 5% of incremental PFT earned above the contributor's baseline (measured from their 30-day trailing average before subscribing).

- Zero risk for the contributor — they only pay if they earn more
- Aligns incentives perfectly
- Self-proving: if Alpha doesn't help, it costs nothing

**Target**: If Alpha improves earnings by 10% for 20 contributors averaging 100K PFT/month, that's 200K incremental × 5% = 10,000 PFT/month.

### Model C: Task Alpha as a Task

Submit Task Alpha itself as a network task. We're building infrastructure that makes the network more efficient — that's exactly what the task node rewards. The development work is the first revenue.

---

## Data Pipeline

```
Hourly cron (existing):
  indexer crawl → classify → sybil → export graph → export health → export auth
                                                                        ↓
New addition:                                                    export alpha
  ↓
alpha.json (contributor profiles, signals, leaderboard)
  ↓
alpha.html (dashboard) + bot commands + telegram alerts
```

### alpha.json Schema

```json
{
  "schema_version": "1.0.0",
  "calculated_at": "2026-04-13T02:00:00Z",
  "next_update_at": "2026-04-13T03:00:00Z",
  
  "network_state": {
    "active_submitters_1h": 4,
    "active_submitters_24h": 18,
    "memo_velocity_ratio": 0.95,
    "competition_level": "medium",
    "current_signal": "NEUTRAL",
    "reward_cycle": "normal"
  },
  
  "leaderboard": [
    {
      "rank": 1,
      "address": "rDVKRN...",
      "tasks_completed": 68,
      "total_earned_pft": 512340,
      "completion_rate": 0.472,
      "pft_per_submission": 3558,
      "trend": "stable",
      "active_days": 23
    }
  ],
  
  "timing_heatmap": {
    "utc_hours": [0,1,2,...,23],
    "submissions_by_hour": [139,132,...],
    "rewards_by_hour": [...],
    "competition_by_hour": [...],
    "optimal_windows": ["05:00-08:00", "20:00-01:00"]
  },
  
  "reward_distribution": {
    "min": 48,
    "p25": 3000,
    "median": 5460,
    "p75": 7500,
    "max": 10000,
    "mean": 5939
  }
}
```

Individual profiles served via query parameter or bot command (not in the public JSON to keep it lean).

---

## Build Plan

| Phase | What | Time | Depends On |
|-------|------|------|------------|
| 1 | `export-alpha.sh` — generate alpha.json with leaderboard, signals, timing | 3h | existing pipeline |
| 2 | `alpha.html` — dashboard with profile lookup, leaderboard, heatmap | 4h | phase 1 |
| 3 | Bot commands — /alpha, /rank, /timing, /compare | 2h | phase 1 |
| 4 | Telegram alerts for high-value signals | 2h | phase 3 |
| 5 | Subscription gate — PFT payment verification for premium features | 4h | phase 2-3 |

**Total: ~15 hours to MVP.**

Phase 1-2 can ship as a free public good (and a task submission). Phase 5 adds the revenue layer.

---

## Why Only We Can Build This

1. **Only full-history archive node** on the PFTL chain. Nobody else has transaction data before ledger ~1.8M.
2. **Only behavioral classification engine**. We know which 73 wallets are bots and which 37 are real contributors. Without this, any analytics include 62% noise.
3. **Only network health monitor**. Our health.json is the single source of truth for network state.
4. **Only sybil detection layer**. Our auth.json proves zero reward leakage — we can extend that guarantee to Alpha subscribers.
5. **Existing infrastructure**. Archive node, indexer, classifier, Lens dashboard, bot, Telegram channel — all running. Alpha is the next layer, not a new stack.

---

## The Endgame

Task Alpha starts as a contributor tool. But the real product is the **intelligence layer itself**.

As the Post Fiat network grows from 53 to 500 to 5,000 contributors:
- The leaderboard becomes the canonical reputation system
- The timing engine becomes essential for competitive earning
- The profile data becomes the basis for task matching (task node can query Alpha before assigning work)
- The subscription revenue scales linearly with network growth

We become the infrastructure that makes the task economy efficient. Not competing with the task node — augmenting it. The task node decides what work needs doing. Task Alpha helps contributors do it better.

**The one-liner**: "The task node is the exchange. Task Alpha is the Bloomberg terminal."
