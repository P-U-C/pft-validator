---
layout: default
title: "Post Fiat Adoption Metrics — Weekly Snapshot"
date: 2026-05-02
category: network
status: published
task_id: 88bc90fe-a58b-4c31-b53c-104d66cfe3eb
reward: 4857 PFT
---

# Post Fiat Adoption Metrics — Weekly Snapshot

**Snapshot date:** May 2, 2026  
**Snapshot timezone:** UTC  
**7d window:** 2026-04-25 to 2026-05-02  
**30d window:** 2026-04-02 to 2026-05-02  
**Task ID:** 88bc90fe-a58b-4c31-b53c-104d66cfe3eb

### Data Sources

| Source | URL | Type |
|--------|-----|------|
| Post Fiat website | postfiat.org | Published network stats |
| Testnet explorer | explorer.testnet.postfiat.org/network/validators | Live validator/network data |
| Task Node | tasknode.postfiat.org | Contributor product surface |
| postfiatorg GitHub | github.com/postfiatorg | Core protocol repos |
| Public ledger index | BFS crawl of PFT ledger (reproducible public-chain derivative) | Aggregate transaction data |

### Reproducibility Note

This snapshot combines published network surfaces (postfiat.org, explorer) with a locally-generated public-ledger index. The index is not a privileged dashboard — it is a reproducible derivative of the public PFT chain. Any contributor can generate the same data by running a BFS crawler against the live ledger. Metrics marked with confidence tier A or B can be independently verified.

---

## Weekly Snapshot Table

### Validator / Infrastructure (from postfiat.org + explorer)

| Metric | Value | Confidence | Source |
|--------|-------|------------|--------|
| Active validators | 38 | A | postfiat.org live stats |
| Publishing domains | 24 | A | postfiat.org live stats |
| 24h agreement (99.9%+) | 35 of 38 validators | A | postfiat.org |
| 30d agreement (99%+) | 33 of 38 validators | A | postfiat.org |
| Verified domains (latest snapshot) | 13 | A | postfiat.org |
| Infrastructure wallets (on-chain) | 8 | A | Ledger index: Task Hub + 4 Reward Nodes + Treasury + Reserve + Team |

### Contributor Activity (from ledger index)

| Metric | Value | Confidence | Trend Signal |
|--------|-------|------------|-------------|
| Total accounts on-chain | 897 | A | Cumulative, includes bots |
| Human contributors (estimated) | 156 | B | Depends on bot classifier accuracy |
| Active contributors (7d) | 52 | B | 33% of estimated humans active this week |
| Active contributors (30d) | 74 | B | 47% of estimated humans active this month |
| New contributors this week | 8 | B | First-ever transaction in 7d window |
| Bot accounts flagged | 733 | B | Classifier-dependent. Single cluster traced to Feb 17 seeding event |
| Sybil cluster accounts | 743 | B | 733 bot-labeled + 10 cluster-linked intermediaries |

### Task Node Flow (from ledger index)

| Metric | Value | Confidence | Trend Signal |
|--------|-------|------------|-------------|
| Total memo transactions (all time) | 13,541 | A | Cumulative task node activity |
| Memo transactions (7d) | 1,021 | A | Weekly task volume |
| Memo transactions (30d) | 4,331 | A | Monthly task volume |
| Daily average memos (7d) | 145.9/day | A | Workload intensity |
| Total transactions (all types) | 376,192 | A | Includes non-memo (payments, activations, bot activity) |

### Rewarded PFT Flow (from ledger index)

| Metric | Value | Confidence | Trend Signal |
|--------|-------|------------|-------------|
| Unique reward recipients (7d) | 53 | B | Depends on infrastructure wallet labels |
| Reward payments (7d) | 565 | B | Includes task rewards + daily airdrops |
| PFT distributed (7d) | 3,729,827 | B | Weekly reward outflow |
| Unique reward recipients (30d) | 84 | B | Monthly reach |
| Reward payments (30d) | 2,224 | B | Monthly payment events |
| PFT distributed (30d) | 13,963,958 | B | Monthly reward outflow |

### Core Protocol Development (from github.com/postfiatorg)

| Repository | Last Push | Description | Confidence |
|-----------|----------|-------------|------------|
| postfiatd | 2026-04-30 | Core node software | A |
| explorer | 2026-05-01 | Network explorer | A |
| dynamic-unl-scoring | 2026-05-01 | AI-driven validator selection | A |
| pft-chatbot-mcp | 2026-03-02 | Bot/agent SDK (MCP) | A |
| validator-history-service | 2026-04-13 | Validator tracking | A |
| postfiatorg.github.io | 2026-05-02 | Website/docs | A |
| pft-sglang | 2026-03-23 | LLM serving infrastructure | A |
| langfuse | 2026-02-10 | LLM observability | A |
| pftl-snap | 2026-01-19 | Wallet snap | A |
| **Total repos** | **9** | **3 forks, 0 stars** | |

### Community-Built Tooling (from public surfaces)

| Surface | Status | Description | Confidence |
|---------|--------|-------------|------------|
| Network intelligence dashboard | Live | Contributor graph, sybil detection, airdrops | C |
| Daily on-chain intelligence publication | Live | Daily subscriber-gated briefing | C |
| On-chain subscription protocol | Live | PFT-denominated subscription marketplace | C |
| Task node documentation | Live (agtico.github.io/tasknode) | Community-maintained onboarding guide | C |
| Community Discord | Active (discord.gg/U6HjgDSmhR) | Primary coordination channel | C |

### Network Health (from ledger index)

| Metric | Value | Confidence |
|--------|-------|------------|
| Total edges (account relationships) | 41,404 | A |
| Bidirectional edges | 19,754 | A |
| Bot-to-human ratio | ~82% bots / ~17% humans | B |
| Sybil clusters | 1 | B |

---

## Adoption Funnel View

| Funnel Stage | Current Proxy | Baseline | Confidence | Interpretation |
|-------------|--------------|----------|------------|----------------|
| Infrastructure readiness | Validators at 99%+ agreement | 33-35 of 38 | A | Consensus layer is operational |
| Developer activity | Core repos updated this week | 3 of 9 repos pushed in 7d | A | Active development |
| Public awareness | Documentation + community surfaces | Task node docs, Discord, website | C | Distribution surface exists |
| Trial / first contact | New contributors (7d) | 8 | B | New users entering |
| Activation | Active contributors (7d) | 52 | B | Weekly active base |
| Work throughput | Memo transactions (7d) | 1,021 | A | Task activity is live |
| Economic participation | Reward recipients (7d) | 53 | B | Rewards reaching broad set |
| Retention | UNAVAILABLE | -- | D | **Highest-priority missing metric** |

---

## Unavailable Metrics

| Metric | Why Unavailable | What Would Be Needed | Priority |
|--------|----------------|---------------------|----------|
| Task completion rate | Task status not in public chain data | Task node internal state export | HIGH |
| Contributor retention (cohort) | Requires first-tx to last-tx analysis per cohort | Compute from indexed transactions | HIGH |
| Task refusal rate | Only visible to individual contributors | Aggregate anonymized data | HIGH |
| PFT token price / market cap | No public exchange data | Exchange listing or DEX data | MEDIUM |
| Trading agent performance | Not publicly visible | Agent operator transparency | MEDIUM |
| DAU/WAU/MAU (standard) | Memo activity approximates but isn't exact | Task node session data | LOW |
| Geographic distribution | Should NOT be collected | Privacy constraint | N/A |

---

## Metric Contamination Register

| Metric | Contamination Risk | Current Mitigation | Remaining Weakness |
|--------|-------------------|-------------------|-------------------|
| total_accounts | Bot seeding / sybil clusters | Report humans separately | Bot labeling can drift |
| total_transactions | Wash trading / infra churn | Prefer memo transactions | Memo spam still possible |
| active_7d | Wallets not verified humans | Exclude bot + infra labels | Contributors may use multiple wallets |
| pft_distributed_7d | Airdrops mixed with task rewards | Infrastructure-wallet filter | Reward type not fully distinguished |
| reward_recipients_7d | Depends on infra wallet labels | Label accuracy maintained manually | Label drift risk |

---

## Data Dictionary

| Metric | Source | Confidence | Privacy Rule |
|--------|-------|------------|-------------|
| validator_count | postfiat.org | A | Public infrastructure data |
| total_accounts | Ledger index | A | Aggregate only |
| human_contributors | total - bot - infra | B | Derived — depends on classifier |
| active_7d | Memo senders in 7d window | B | Count only — no addresses |
| new_contributors_7d | First-tx in 7d window | B | Count only |
| memos_7d | Memo transactions in window | A | Aggregate |
| pft_distributed_7d | Infra wallet outflows | B | Aggregate — no per-recipient amounts |
| repo_activity | GitHub API | A | Public |
| community_surfaces | Manual URL check | C | Public |

**Privacy rules:** Never publish individual balances, per-recipient reward amounts, or attempt de-anonymization. Address truncation only in aggregate contexts. Geographic data must not be collected.

---

## Update Instructions

### Weekly Refresh Steps

1. Check postfiat.org for updated validator counts and agreement scores
2. Check explorer.testnet.postfiat.org for network state
3. Run the BFS ledger indexer (or query an existing index) for contributor and transaction metrics
4. Check github.com/postfiatorg repos for recent push dates
5. Verify community surfaces are live (task node, Discord, documentation)
6. Update the snapshot table with new values, the current date, and exact window boundaries
7. Compare with prior week and note significant changes

### SQL Patterns (for ledger index queries)

```sql
-- Active contributors (7d) — replace dates with current window
SELECT COUNT(DISTINCT account) FROM transactions
WHERE has_memo = 1 AND timestamp_iso > '2026-04-25T18:00:02Z';

-- PFT distributed (7d)
SELECT SUM(CAST(amount_drops AS INTEGER))/1000000 FROM transactions
WHERE account IN (SELECT address FROM wallet_labels WHERE label_type = 'infrastructure')
AND CAST(amount_drops AS INTEGER) > 0 AND timestamp_iso > '2026-04-25T18:00:02Z'
AND destination NOT IN (SELECT address FROM wallet_labels WHERE label_type IN ('infrastructure','bot'));
```

No private dashboards, hidden repos, or privileged access required.

---

## Interpretation — Real Signals vs Vanity

### Real Participation Signals

- **Active contributors (7d): 52** — wallets that submitted memos, meaning they did task work
- **Validator agreement: 99.9%** — consensus layer is healthy and operational
- **Core repo activity: 3 of 9 repos pushed this week** — active protocol development
- **PFT distributed (7d): 3.7M** — real token flow from infrastructure to contributors

### Vanity Metrics (do not over-index)

- **Total accounts (897)** — inflated by 733 bot accounts. Real base is ~156
- **Total transactions (376K)** — dominated by bot activity. Memo transactions (13.5K) are the meaningful subset
- **GitHub stars (0)** — early-stage project, not yet marketed to developer community

### Highest-Priority Future Instrumentation

1. **Task completion rate** — what % of accepted tasks are completed?
2. **Contributor retention by cohort** — are people coming back?
3. **Reward concentration (Gini)** — are rewards distributed or concentrating?
4. **Task refusal rate** — is the task generator producing useful work?
5. **Demand-side metrics** — who is consuming the intelligence the network produces?

---

## Machine-Readable Sidecar

```json
{
  "snapshot_id": "pft-adoption-2026-05-02",
  "snapshot_end_utc": "2026-05-02T18:00:02Z",
  "windows": {
    "seven_day_start": "2026-04-25T18:00:02Z",
    "thirty_day_start": "2026-04-02T18:00:02Z"
  },
  "infrastructure": {
    "validators_active": 38,
    "publishing_domains": 24,
    "agreement_24h_99pct": 35,
    "verified_domains": 13,
    "core_repos": 9,
    "repos_pushed_7d": 3
  },
  "contributors": {
    "total_accounts": 897,
    "human_estimate": 156,
    "active_7d": 52,
    "active_30d": 74,
    "new_7d": 8,
    "bots_flagged": 733
  },
  "task_node": {
    "total_memos": 13541,
    "memos_7d": 1021,
    "daily_avg_7d": 145.9
  },
  "rewards": {
    "recipients_7d": 53,
    "pft_distributed_7d": 3729827,
    "recipients_30d": 84,
    "pft_distributed_30d": 13963958
  },
  "unavailable": [
    "task_completion_rate", "cohort_retention", "task_refusal_rate",
    "pft_price", "trading_agent_pnl"
  ]
}
```

---

*This snapshot uses publicly available network surfaces, published protocol stats, open-source repository data, and aggregate public-chain metrics. It does not access private contributor data, individual balances, or non-public artifacts. All confidence tiers and contamination risks are disclosed.*
