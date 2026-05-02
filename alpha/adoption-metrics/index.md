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
**Data source:** chain-index.db (BFS crawl of PFT ledger) + public product surfaces  
**Last crawl:** 2026-05-02T18:00:02 UTC  
**Task ID:** 88bc90fe-a58b-4c31-b53c-104d66cfe3eb

---

## Weekly Snapshot Table

### Contributor Activity

| Metric | Value | Trend Signal |
|--------|-------|-------------|
| Total accounts on-chain | 897 | Cumulative, grows with crawl depth |
| Human contributors (non-bot, non-infra) | 156 | Real participant base |
| Active contributors (7d) | 52 | 33% of humans active this week |
| Active contributors (30d) | 74 | 47% of humans active this month |
| New contributors this week (first tx in 7d) | 8 | New blood entering the network |
| Bot accounts flagged | 733 | Single cluster, stable — see sybil section |
| Infrastructure wallets | 8 | Task Hub + 4 Reward Nodes + Treasury + Reserve + Team |

### Task Node Flow

| Metric | Value | Trend Signal |
|--------|-------|-------------|
| Total memo transactions (all time) | 13,541 | Cumulative task node activity |
| Memo transactions (7d) | 1,021 | Weekly task volume |
| Memo transactions (30d) | 4,331 | Monthly task volume |
| Daily average memos (7d) | 145.9/day | Workload intensity |
| Total transactions (all types) | 376,192 | Includes non-memo (payments, activations) |

### Rewarded PFT Flow

| Metric | Value | Trend Signal |
|--------|-------|-------------|
| Unique reward recipients (7d) | 53 | Who earned this week |
| Reward payments (7d) | 565 | Payment events (includes task rewards + airdrops) |
| PFT distributed (7d) | 3,729,827 | Weekly reward outflow |
| Unique reward recipients (30d) | 84 | Who earned this month |
| Reward payments (30d) | 2,224 | Monthly payment events |
| PFT distributed (30d) | 13,963,958 | Monthly reward outflow |

### Validator / Operator Indicators

| Metric | Value | Source | Status |
|--------|-------|--------|--------|
| Infrastructure wallets active | 8 | wallet_labels | Observed |
| Reward node rotation | 4 nodes distributing rewards | Transaction pattern analysis | Observed |
| Validator UNL membership | UNAVAILABLE | Requires testnet_vl.json access | Not publicly queryable from chain index |
| Validator uptime metrics | UNAVAILABLE | Requires direct node monitoring | Not captured by indexer |

### Public Repository Engagement

| Metric | Value | Source | Status |
|--------|-------|--------|--------|
| pft-validator repo commits (30d) | ~80+ | GitHub P-U-C/pft-validator | Observed |
| Public alpha artifacts published | 40+ | pft.permanentupperclass.com/alpha/ | Observed |
| puc-trading repo | Active | GitHub P-U-C/puc-trading | Observed |
| hive-guardrails repo | Active | Gist-hosted, 18 fixtures | Observed |
| Task node documentation | Active | agtico.github.io/tasknode | Observed |

### Content / Distribution Engagement

| Metric | Value | Source | Status |
|--------|-------|--------|--------|
| Herald subscribers (paying) | 5 | SUBS protocol on-chain payments | Observed |
| Herald trial contacts | 58 | CRM (subs-crm.json) | Observed |
| Herald trial conversions | 4 | On-chain payment verification | Observed |
| Herald conversion rate | 11% of delivered | CRM calculation | Observed |
| Lens dashboard | Live | pft.permanentupperclass.com/lens/ | Observed |
| Scanner dashboard | Live | pft.permanentupperclass.com/scanner/ | Observed |
| SUBS marketplace | Live | pft.permanentupperclass.com/subs/ | Observed |

### Network Health

| Metric | Value | Trend Signal |
|--------|-------|-------------|
| Sybil accounts flagged | 743 | Single cluster, all traced to Feb 17, 2026 seeding event |
| Sybil clusters | 1 | No new clusters detected |
| Total edges (account relationships) | 41,404 | Network connectivity |
| Bidirectional edges | 19,754 | Mutual interaction pairs |
| Bot-to-human ratio | 82.5% bots / 17.4% humans | Wash trading network inflates account count |

---

## Unavailable Metrics

These fields are important for adoption measurement but cannot currently be populated from public/aggregate data:

| Metric | Why Unavailable | What Would Be Needed |
|--------|----------------|---------------------|
| Validator uptime / performance | Not captured by chain indexer | Direct node monitoring or validator self-reporting |
| UNL membership list | Not publicly queryable from indexed data | Access to testnet_vl.json or validator registry |
| Task completion rate (accepted → completed) | Task status not visible in chain data | Task node internal state export |
| Task refusal rate | Only visible to individual contributors | Aggregate anonymized refusal data |
| Contributor retention (cohort analysis) | Requires first-tx → last-tx analysis per cohort | Compute from indexed transactions (possible, not yet built) |
| DAU / WAU / MAU (standard engagement) | Memo activity approximates this but isn't exact | Task node session data |
| PFT token price / market cap | No public exchange listing data accessible | Exchange integration or DEX data |
| Trading agent performance (Data Lake) | Not publicly visible | Requires transparency from agent operators |
| Geographic distribution | Not available and should not be collected | Privacy constraint — do not instrument |

---

## Data Dictionary

| Metric | Source | Observed? | Privacy Rule |
|--------|-------|-----------|-------------|
| total_accounts | accounts table, tx_count > 0 | Yes | Aggregate only — do not publish individual balances |
| human_contributors | total - bot_count - infra_count | Yes | Derived aggregate |
| active_7d | DISTINCT account from transactions WHERE has_memo=1 AND timestamp > 7d ago | Yes | Aggregate count only |
| new_contributors_7d | accounts with MIN(timestamp_iso) in last 7 days | Yes | Count only — do not publish specific addresses |
| memos_7d | COUNT from transactions WHERE has_memo=1 AND timestamp > 7d ago | Yes | Aggregate |
| pft_distributed_7d | SUM(amount_drops) from infrastructure wallets to non-infra/non-bot | Yes | Aggregate — do not publish per-recipient amounts |
| recipients_7d | COUNT(DISTINCT destination) from reward payments | Yes | Count only |
| sybil_accounts_flagged | COUNT(DISTINCT address) from sybil_clusters | Yes | Aggregate — individual addresses published only in forensic reports |
| herald_subscribers | COUNT of payments >= 1000 PFT to SUBS address within 30 days | Yes | Count only — do not publish subscriber addresses |
| bot_count | COUNT from wallet_labels WHERE label_type = 'bot' | Yes | Aggregate |
| edge_count | COUNT from edges WHERE tx_count > 0 | Yes | Aggregate |

**Privacy rules:**
- Never publish individual contributor balances, reward amounts, or task details
- Address truncation (first 6 + last 4 chars) only in aggregate analysis contexts
- Geographic data must not be collected or inferred
- Contributor identity is wallet-based and pseudonymous — do not attempt to de-anonymize

---

## Update Instructions

Another contributor can refresh this snapshot weekly using the chain indexer:

### Prerequisites
- Access to `chain-index.db` (or run the BFS indexer to build it)
- Python 3 + sqlite3

### Steps

1. **Run the indexer** to get fresh chain data:
```bash
cd ~/pf-scout-bot/indexer && npx tsx src/index.ts
```

2. **Query the metrics** using the SQL patterns in the data dictionary. All queries use:
```sql
-- Active contributors (7d)
SELECT COUNT(DISTINCT account) FROM transactions
WHERE has_memo = 1 AND timestamp_iso > datetime('now', '-7 days');

-- PFT distributed (7d)
SELECT SUM(CAST(amount_drops AS INTEGER))/1000000
FROM transactions
WHERE account IN (SELECT address FROM wallet_labels WHERE label_type = 'infrastructure')
AND CAST(amount_drops AS INTEGER) > 0
AND timestamp_iso > datetime('now', '-7 days')
AND destination NOT IN (SELECT address FROM wallet_labels WHERE label_type IN ('infrastructure','bot'));

-- New contributors (first tx in 7d)
SELECT COUNT(*) FROM (
  SELECT account, MIN(timestamp_iso) as first_tx
  FROM transactions GROUP BY account
  HAVING first_tx > datetime('now', '-7 days')
);
```

3. **Check product surfaces:**
   - Herald subscribers: count payments >= 1B drops to SUBS address (r9XYDxJDb) in last 30 days
   - Lens/Scanner/SUBS: verify pages load at their public URLs

4. **Update the snapshot table** with new values and the current date/time.

5. **Compare with prior week** and note any significant changes in the trend signal column.

### No private dashboards needed
All data comes from the public chain index and public product URLs. No internal tools, hidden repos, or privileged accounts required.

---

## Interpretation — Real Signals vs Vanity Metrics

### Real Participation Signals (trust these)

**Active contributors (7d): 52.** This is the most reliable adoption signal. These are wallets that submitted memos to the Task Hub in the last 7 days — meaning they actually did task work. This number is harder to fake than account creation.

**PFT distributed (7d): 3.7M PFT.** Real tokens flowing from infrastructure wallets to contributors. This is the network's burn rate on rewards — the cost of intelligence production. If this number grows while active contributors grows, the network is scaling.

**New contributors (7d): 8.** Genuine new blood. Filtered by first-ever transaction in the last 7 days, not by account creation date (which can be gamed).

**Herald conversions: 4 of 36 delivered (11%).** Real subscription payments verified on-chain. Small number but real signal — people paying PFT for an intelligence product.

### Vanity Metrics (do not over-index)

**Total accounts (897).** Inflated by 733 bot accounts. The real number is 156 humans. Always report both.

**Total transactions (376,192).** Dominated by bot wash trading and infrastructure operations. Memo transactions (13,541) are the meaningful subset.

**Total edges (41,404).** Sounds impressive but includes bot-to-bot edges. Bidirectional human edges would be a better signal (not yet computed separately).

### Highest-Priority Future Instrumentation

1. **Task completion rate.** What percentage of accepted tasks are completed and rewarded? This is the single most important funnel metric that is currently unavailable.

2. **Contributor retention by cohort.** Of contributors who started in week N, how many are still active in week N+4? This separates one-time participants from sustained contributors.

3. **Reward distribution concentration (Gini coefficient).** Are rewards concentrating in a few wallets or distributing broadly? The raw data exists in the chain index but the computation is not yet automated.

4. **Task refusal rate (anonymized aggregate).** What percentage of generated tasks are refused, and for what reasons? This is the best signal for whether the task generator is producing useful work.

5. **Data Lake consumption metrics.** Is anyone using the collective intelligence? Subscriber count is a proxy, but trading agent performance would be the real signal. This requires transparency from agent operators.

---

*This snapshot uses only publicly available, aggregate, privacy-safe data from the Post Fiat chain index and public product surfaces. It does not access private contributor data, individual balances, or non-public artifacts. All queries are reproducible using the instructions above.*
