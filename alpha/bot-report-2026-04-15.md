# Bot Network Report — 2026-04-15

## Post Fiat Network Sybil Intelligence
**Chain:** PFTL testnet
**Snapshot:** 2026-04-15
**Source:** Permanent Upper Class full-history archive node
**Index freshness:** 373,284 transactions from 984 accounts

---

## Executive Summary

A coordinated bot network of **733 wallets** has been identified on the Post Fiat testnet. The network represents **84.2%** of all active accounts but produces **zero memo participation**, no task completions, and **zero interaction with task node infrastructure**. It exists in a closed wash-trading loop disconnected from the legitimate contributor economy.

### Key findings

| Metric | Value |
|--------|-------|
| Total active accounts | 871 |
| Accounts classified as bots | 733 (84.2%) |
| Real human contributors | 130 |
| Infrastructure wallets | 8 |
| Sybil clusters detected | 1 |
| Largest cluster size | 743 wallets |
| Bot → infrastructure interactions | **1** |
| Confidence (largest cluster) | 100% |

**Reward integrity:** 0 PFT has ever been paid from reward wallets to any bot. The reward gate is clean.

---

## 1. Network Scope

- **871** active accounts on chain
- **373,284** total transactions indexed
- **11,328** memo-carrying transactions (3.0%)
- **41,292** unique edges (interactions) indexed

The memo ratio (3.0%) is the key signal: real contributor activity always carries memos (task submissions, responses). Automated wallets do not.

---

## 2. Bot Classification Criteria

Wallets are classified as `bot` when their on-chain behavior matches two or more of these deterministic signals:

1. **ZERO_MEMO_HIGH_TX** — 50+ transactions with zero memo participation (weight 0.4)
2. **UNIFORM_BALANCE** — holds exactly ~15 PFT (minimum XRPL reserve) despite high transaction volume (weight 0.2)
3. **PEER_CLUSTER_DENSITY** — ≥30% of peers are already-classified bots, with ≥5 total peers (weight 0.3)
4. **HIGH_TX_LOW_BALANCE** — 100+ transactions with <100 PFT current balance (weight 0.1)
5. **NFT_NO_MEMOS** — NFT activity without any memo participation (weight 0.1)

A classification requires `botScore ≥ 0.5` across multiple signals. Single-signal flags are rejected to avoid false positives.

---

## 3. Bot Network Characteristics

| Metric | Value |
|--------|-------|
| Bot count | 733 |
| Avg transactions per bot | 492 |
| Min / max transactions per bot | 54 / 1627 |
| Avg memos per bot | 0.0 |
| Avg balance | 111.9 PFT |

### Most common bot balance buckets

| Balance (PFT) | Count |
|---------------|-------|
| 15 | 719 |
| 69427 | 1 |
| 279 | 1 |
| 272 | 1 |
| 241 | 1 |

### Top 10 bots by transaction volume

| Address | Txns | Memos | Balance (PFT) |
|---------|------|-------|---------------|
| r9k51cJFVaYRST5v... | 1627 | 0 | 69427 |
| rBijKC7D3CiBBaTU... | 944 | 0 | 15 |
| rwkMYAymjzfJfvFY... | 900 | 0 | 15 |
| rGeDyvo1Em9doSWm... | 891 | 0 | 15 |
| rBh4GGwzrq7q2H94... | 887 | 0 | 15 |
| r3VJK1T6NYC3bEKB... | 882 | 0 | 15 |
| rB4bDDBPzyXtwu38... | 878 | 0 | 15 |
| rP6JQShEftDErHza... | 878 | 0 | 15 |
| rEULHeko5wqWc8Nx... | 876 | 0 | 15 |
| r9mQM9WJQcmnMBUY... | 873 | 0 | 15 |

### Activity window

- **First bot transaction:** 2026-02-26
- **Most recent bot transaction:** 2026-04-14
- **Total bot transactions:** 360,775

---

## 4. Most Common Transfer Amounts

Bots send highly repetitive payment amounts — a fingerprint of automated activity:

| Amount (PFT) | Count |
|--------------|-------|
| 1.0000 | 115307 |
| 1.0923 | 12052 |
| 1.2195 | 11214 |
| 1.3346 | 10744 |
| 1.3521 | 9847 |
| 1.4882 | 9439 |
| 1.6239 | 8763 |
| 1.6588 | 8164 |
| 1.7827 | 7929 |
| 1.9442 | 7544 |


---

## 5. Sybil Cluster Detection

After the false-positive filter (rejecting clusters where >30% of members have >10 memos):

### Cluster `sybil_001`
- **Members:** 743 wallets
- **Average confidence:** 100%
- **Status:** Confirmed bot network — zero memo participation across all members


---

## 6. Infrastructure Interaction Analysis

**Number of bots that have EVER interacted with any infrastructure wallet:** 1

Infrastructure wallets checked:
- Task Node hub (rwdm72S9YVKkZje...)
- Airdrop wallet (rJNwqDPKSkbqDPN...)
- Distribution wallet (rGBKxoTcavpfEso...)
- Treasury (rhczhWeG3eSohzc...)
- Reserve (rBDbRYd8H7gB6md...)
- Team holdings (r4vhrMChCsaoFsB...)

**Conclusion:** The bot network is **fully isolated** from the legitimate task economy. No bot has received a task reward. No bot has submitted a memo to the task node. No bot has appeared in the authorization review queue.

This is consistent with the wash-trading hypothesis: a single operator deploying bots that transfer PFT among themselves to inflate transaction counts, without attempting to participate in task workflows.

---

## 7. Top Bot Hubs (by connected bot count)

The most connected bots in the network — likely coordinating wallets:

| Address | Bot peers |
|---------|-----------|
| r9k51cJFVaYRST5vMUsd... | 793 |
| r1Z98nc49kiMqwBjbMUb... | 76 |
| rLc2iqQGGQjfb1TWNYR1... | 74 |
| r9Xb5X5naJcJt93WfxiF... | 74 |
| rpSqPddnzWvkKoFXMLe2... | 73 |


---

## 8. Methodology

This analysis is fully deterministic and reproducible from public chain data:

1. **Index:** All transactions from genesis to present for every discovered wallet, stored in `chain-index.db`
2. **Classify:** Apply the 5 behavioral signals to each fully-crawled account
3. **Cluster:** Group classified bots by funding chain, temporal correlation, counterparty overlap, and amount fingerprints
4. **Filter:** Reject clusters where >30% of members have significant memo activity (prevents false positives for real contributors who share task-reward patterns)

Every number in this report can be reproduced by running the same SQL against the same database. No AI classification, no fuzzy matching, no privacy-invasive signals.

---

## 9. What This Means for the Network

- **Task economy is clean:** No bots have infiltrated the reward flow. Every PFT paid has gone to a verified contributor.
- **Rewards are safe:** The authorization gate correctly blocks bot addresses, and historical data shows zero leaks.
- **The bot network is measurable:** 733 wallets performing 360,775 transactions can be filtered out of network health metrics.
- **Real participation:** Only 130 wallets are producing actual task memos. This is the true size of the active Post Fiat contributor base.

---

## 10. Data Availability

- Live graph: [pft.permanentupperclass.com/lens/](https://pft.permanentupperclass.com/lens/)
- Health API: [lens/health.json](https://pft.permanentupperclass.com/lens/health.json)
- Auth audit: [lens/auth.json](https://pft.permanentupperclass.com/lens/auth.json)
- Raw indexed data: `~/.pf-scout/chain-index.db` on the validator

This report updates whenever the indexer pipeline runs (hourly).

---

*Generated 2026-04-15 by the Lens intelligence layer on the PUC validator.*
