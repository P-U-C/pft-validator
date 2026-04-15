# Bot Network Forensic Report — 2026-04-15

## Post Fiat Network Sybil Intelligence
**Chain:** PFTL testnet
**Snapshot:** 2026-04-15
**Source:** Permanent Upper Class full-history archive node
**Index freshness:** 373,284 transactions indexed across 984 accounts

---

## Executive Summary

A coordinated automated wallet network of **733 accounts** has been identified on the Post Fiat testnet. The network represents **84.2%** of all active accounts but produces **zero memo participation**, no task completions, and exists in a closed wash-trading loop disconnected from the legitimate contributor economy.

**Critical finding:** Forensic trace of the initial funding reveals the bot master was seeded by a series of four memoless transfers from an infrastructure wallet on **February 17, 2026**, totaling **221,000 PFT**. This funding originated from a legitimate task-reward wallet that otherwise carries memos on 88.9% of its outflows. The four anomalous memoless transfers on that date are the only bot-directed activity in its entire history.

The bot network is isolated from reward flows — no bot has ever received a task reward or communicated with a task node. The seeding event preceded the bot fan-out by nine days.

### Key findings

| Metric | Value |
|--------|-------|
| Total active accounts | 871 |
| Accounts classified as bots | 733 (84.2%) |
| Real human contributors | 130 |
| Infrastructure wallets | 8 |
| Sybil clusters detected | 1 (confidence 100%) |
| Largest cluster size | 743 wallets |
| Bot master address | r9k51cJFVaYRST5vMUsdokiYcwdpQdUJGR |
| Initial bot master funding | 100,700 PFT (direct) + 121,000 PFT (via middleman) on 2026-02-17 |
| Gap between funding and fan-out | 9 days |
| Total bot transactions | 360,775 |
| Bot → reward wallet leaks | 0 |

---

## 1. Network Scope

- **871** active accounts on chain
- **373,284** total transactions indexed
- **11,328** memo-carrying transactions (3.0%)
- **41,292** unique edges indexed

The memo ratio (3.0%) is the key macro signal: real contributor activity always carries memos (task submissions, responses, verifications). Automated wash-trading wallets do not.

---

## 2. Bot Classification Criteria

Wallets are classified as `bot` when their on-chain behavior matches two or more of these deterministic signals:

1. **ZERO_MEMO_HIGH_TX** — 50+ transactions with zero memo participation (weight 0.4)
2. **UNIFORM_BALANCE** — holds exactly ~15 PFT (minimum XRPL reserve) despite high transaction volume (weight 0.2)
3. **PEER_CLUSTER_DENSITY** — ≥30% of peers are already-classified bots, with ≥5 total peers (weight 0.3)
4. **HIGH_TX_LOW_BALANCE** — 100+ transactions with <100 PFT current balance (weight 0.1)
5. **NFT_NO_MEMOS** — NFT activity without any memo participation (weight 0.1)

A classification requires `botScore ≥ 0.5` across multiple signals. Single-signal flags are rejected to avoid false positives. The sybil cluster filter additionally rejects clusters where more than 30% of members have significant memo activity (>10 memos), preventing false positives from real contributors who share task-reward amount patterns.

---

## 3. Bot Network Characteristics

| Metric | Value |
|--------|-------|
| Bot count | 733 |
| Avg transactions per bot | 492 |
| Min / max transactions per bot | 54 / 1,627 |
| Avg memos per bot | 0.0 |
| Avg balance | 111.9 PFT |

### Balance distribution

| Balance (PFT) | Count |
|---------------|-------|
| 15 (XRPL minimum reserve) | 719 |
| 69,427 (bot master) | 1 |
| 279 | 1 |
| 272 | 1 |
| 241 | 1 |

**719 of 733 bots hold exactly ~15 PFT** — the XRPL minimum reserve. This is a canonical wash-trading fingerprint: each wallet activated with minimum funds, receiving and sending small amounts without retaining a working balance.

### Top 10 bots by transaction volume

| Address | Txns | Memos | Balance (PFT) |
|---------|------|-------|---------------|
| r9k51cJFVaYRST5v... (bot master) | 1,627 | 0 | 69,427 |
| rBijKC7D3CiBBaTU... | 944 | 0 | 15 |
| rwkMYAymjzfJfvFY... | 900 | 0 | 15 |
| rGeDyvo1Em9doSWm... | 891 | 0 | 15 |
| rBh4GGwzrq7q2H94... | 887 | 0 | 15 |
| r3VJK1T6NYC3bEKB... | 882 | 0 | 15 |
| rB4bDDBPzyXtwu38... | 878 | 0 | 15 |
| rP6JQShEftDErHza... | 878 | 0 | 15 |
| rEULHeko5wqWc8Nx... | 876 | 0 | 15 |
| r9mQM9WJQcmnMBUY... | 873 | 0 | 15 |

The bot master (r9k51) is the only wallet in the cluster with a meaningful PFT balance. It routes the initial funding out to the other 700+ wallets and retains a ~69K reserve.

### Activity window

- **First bot transaction:** 2026-02-26
- **Most recent bot transaction:** 2026-04-14
- **Total bot transactions:** 360,775 (97% of all network activity)

### Transfer amount fingerprint

Bots send highly repetitive payment amounts — an automation signature:

| Amount (PFT) | Count |
|--------------|-------|
| 1.0000 | 115,307 |
| 1.0923 | 12,052 |
| 1.2195 | 11,214 |
| 1.3346 | 10,744 |
| 1.3521 | 9,847 |
| 1.4882 | 9,439 |
| 1.6239 | 8,763 |
| 1.6588 | 8,164 |
| 1.7827 | 7,929 |
| 1.9442 | 7,544 |

1.0 PFT transfers dominate. The remaining high-frequency amounts (1.09, 1.22, 1.33...) appear to be a deterministic sequence — likely a pseudo-random amount generator with a fixed seed.

### Most connected bot hubs

| Address | Connected bot peers |
|---------|---------------------|
| r9k51cJFVaYRST5v... (master) | 793 |
| r1Z98nc49kiMqwBj... | 76 |
| rLc2iqQGGQjfb1TW... | 74 |
| r9Xb5X5naJcJt93W... | 74 |
| rpSqPddnzWvkKoFX... | 73 |

The bot master is connected to effectively the entire cluster (793 peers out of 733 members — the excess indicates repeated edges). The sub-hubs below it are secondary routing nodes in the wash-trading mesh.

---

## 4. Sybil Cluster Detection

After the false-positive filter:

### Cluster `sybil_001`
- **Members:** 743 wallets
- **Average confidence:** 100%
- **Signal types:** funding_chain, counterparty_overlap, amount_fingerprint, temporal_correlation
- **Status:** Confirmed bot network — zero memo participation across all members

---

## 5. Infrastructure Interaction Analysis

Infrastructure wallets checked:
- Task Node hub (`rwdm72S9YVKkZjeADKU2bbUMuY4vPnSfH7`)
- Task Node 2 (`rKt4peDozpRW9zdYGiTZC54DSNU3Af6pQE`)
- Task Node 3 (`rKddMw1hqMGwfgJvzjbWQHtBQT8hDcZNCP`)
- Airdrop wallet (`rJNwqDPKSkbqDPNoNxbW6C3KCS84ZaQc96`)
- Distribution 2 (`rGBKxoTcavpfEso7ASRELZAMcCMqKa8oFk`)
- Treasury (`rhczhWeG3eSohzcH5jw8m8Ynca9cgH4eZm`)
- Reserve (`rBDbRYd8H7gB6mdNTRssgNvsw8Z6c4riDb`)
- Team holdings (`r4vhrMChCsaoFsBoCkRTRGUuc1njfr7bmA`)

**Forward flow (after fan-out):** Zero task rewards have ever been paid to any bot. No bot has submitted memos to any task node. The bot network operates in complete isolation from the reward flow.

**Backward flow (initial seeding):** One infrastructure wallet, Distribution 2, seeded the bot master with 100,000 PFT on 2026-02-17. This is the only historical instance of any infrastructure wallet transferring PFT to a bot-classified address, and it occurred before the bot cluster had been established — i.e., before the classifier could have flagged the recipient.

---

## 6. Forensic Trace: February 17 Seeding Event

The bot farm did not emerge spontaneously. The bot master was seeded through a deliberate sequence of transactions on **February 17, 2026**, involving an infrastructure reward wallet, a single real contributor, and a newly-created middleman address.

### 6.1 Wallets Involved

| Role | Address | Description |
|------|---------|-------------|
| Infrastructure | `rGBKxoTcavpfEso7ASRELZAMcCMqKa8oFk` | Distribution 2 — task reward payout wallet. 2,006 outgoing txns total, 88.9% carry memos, 12.6M PFT distributed to 67 legitimate contributors. |
| Contributor | `rDVKRNp3kWE1ykryU8ta6bBZWrFjFetyjB` | Top real contributor (rank #2 by balance, rank #1 by task earnings). 502 total txns, 499 with memos (99.4% memo rate), 1.8M PFT balance. Made exactly one non-memo outgoing transfer in its entire history: the 1,000 PFT to raPDi83 on Feb 17. |
| Middleman | `raPDi83GxWkHeytkr3pmJp28gb8Js1dAv7` | Setup wallet used as intermediary. 6 total txns, zero memos. Current balance: 121,224 PFT — almost exactly the amount it received from Distribution 2 (121,000 PFT) minus dust. |
| Bot master | `r9k51cJFVaYRST5vMUsdokiYcwdpQdUJGR` | Root of the 733-wallet cluster. Received the initial 700 + 100,000 PFT funding and fanned it out to sub-wallets starting 9 days later. |
| Test wallets | `rPvrQmCmZu6vP3CQH4E11QWVfkPNd33FJ3`, `r9RLu9ePi5HachU1TrZChQy6n9zAwCH1SA` | Scratch wallets used by raPDi83 to test the flow before executing the main transfers. |

### 6.2 Exact Timeline (all times UTC)

```
2026-02-17 09:54:51  rDVKRNp3 → raPDi83           1,000 PFT  [NO MEMO]
    rDVKRN (legitimate contributor, 499 memos) sends its one and only
    non-memo transfer. Recipient is a brand-new wallet. This is the
    funding of raPDi83 as the middleman.

2026-02-17 11:26:30  raPDi83 → r9RLu9ePi5            15 PFT  [NO MEMO]
2026-02-17 11:28:41  raPDi83 → r9RLu9ePi5             5 PFT  [NO MEMO]
2026-02-17 11:32:40  raPDi83 → rPvrQm                10 PFT  [NO MEMO]
2026-02-17 11:34:21  rPvrQm  → raPDi83                0 PFT  [NO MEMO]
2026-02-17 11:43:53  rPvrQm  → raPDi83                0 PFT  [NO MEMO]
2026-02-17 11:54:21  rPvrQm  → raPDi83                0 PFT  [NO MEMO]
    Testing phase. raPDi83 makes small transfers to two scratch
    addresses. rPvrQm ping-responds with 0-PFT transactions
    (likely signature verification). Duration: 27 minutes.

2026-02-17 12:12:20  raPDi83 → r9k51cJF              700 PFT  [NO MEMO]
    First funding of the bot master. Small — establishes that
    raPDi83 can send to r9k51 successfully.

2026-02-17 15:26:10  Distribution 2 → raPDi83     1,000 PFT  [NO MEMO]
2026-02-17 15:34:20  Distribution 2 → raPDi83    50,000 PFT  [NO MEMO]
2026-02-17 15:34:41  Distribution 2 → raPDi83    70,000 PFT  [NO MEMO]
    Three memoless transfers from the infrastructure reward wallet
    to raPDi83 in 8 minutes and 31 seconds. Total: 121,000 PFT.
    This is the only time Distribution 2 has sent memoless transfers
    of these sizes in its entire history.

2026-02-17 15:38:12  Distribution 2 → r9k51cJF  100,000 PFT  [NO MEMO]
    Final seed: Distribution 2 sends 100,000 PFT directly to the
    bot master, 3 minutes 31 seconds after the last raPDi83 transfer.
    This is the single largest memoless outflow in Distribution 2's
    entire history.
```

### 6.3 Total Initial Funding

| Source | Recipient | Amount (PFT) | Memo |
|--------|-----------|-------------:|------|
| rDVKRNp3 (contributor) | raPDi83 | 1,000 | — |
| Distribution 2 (infrastructure) | raPDi83 | 1,000 | — |
| Distribution 2 (infrastructure) | raPDi83 | 50,000 | — |
| Distribution 2 (infrastructure) | raPDi83 | 70,000 | — |
| raPDi83 (middleman) | r9k51 (bot master) | 700 | — |
| Distribution 2 (infrastructure) | r9k51 (bot master) | 100,000 | — |
| **Total injected into bot network** | | **222,700 PFT** | — |
| Retained by raPDi83 (unused) | | 121,224 | — |

### 6.4 Fan-Out Delay

After the Feb 17 seeding, the bot master was dormant for **nine days**. The first bot fan-out occurred on **2026-02-26 at 12:48:40 UTC**, when r9k51 began sending 100 PFT each to what would become the 733-wallet network.

This nine-day gap is operationally significant: the seeding transactions and the bot activation were temporally separated, reducing the visibility of the connection in real-time monitoring.

### 6.5 Post-Seed Cleanup

On **2026-03-31**, raPDi83 sent two transfers of 50 PFT each back to the Team wallet (`r4vhrMChCsaoFsBoCkRTRGUuc1njfr7bmA`) — a symbolic return gesture. raPDi83 then went dormant and has not transacted since.

### 6.6 Distribution 2 Memoless Outflow Pattern

Distribution 2 has made exactly 30 memoless outgoing transfers in its entire history:

- **4 transfers on 2026-02-17** (the seeding event — 221K PFT to raPDi83 + r9k51)
- **26 transfers from 2026-03-31 to 2026-04-03** (smaller amounts, 800-9,500 PFT, all to real labeled contributors)

The second batch appears operational and benign — small reward payments without proper memos, sent to verified contributors. The 2026-02-17 batch is structurally different: larger amounts, directed to newly-created wallets, followed by a 9-day gap before fan-out.

---

## 7. Attribution

The forensic trail points to a single operator with:

1. **Signing authority for Distribution 2** — a legitimate task-reward infrastructure wallet, capable of executing the four memoless transfers on 2026-02-17 without oversight.
2. **Control of rDVKRNp3** — the top real contributor by earnings, which made its only anomalous non-memo transfer on the same day to initialize the middleman.
3. **Familiarity with the PFTL infrastructure** — the testing phase demonstrates awareness of the transaction signing and response flow.

Based on this pattern, the operator is likely a member of the Post Fiat core team or someone with delegated access to a reward wallet. This report does not name specific individuals; the on-chain evidence is definitive and is preserved in the transaction log independent of this document.

This finding does not imply malicious intent on the part of the operator. Possible motivations include:

- Load testing the network at scale
- Stress-testing the sybil detection infrastructure
- Dogfooding the bot-classification pipeline
- Generating volume for protocol-level validation
- Creating a known adversarial baseline for red-team exercises

What is clear is that the operation:
- Was **internally seeded** (not an external attack)
- Was **deliberately isolated** from the reward flow (no task rewards were routed to bots)
- Has **not leaked any PFT** to unauthorized parties (the 100K is accounted for between the 733 bot wallets and the raPDi83 reserve)

---

## 8. Integrity Assessment

Despite the seeding trace back to an infrastructure wallet, the broader network integrity remains **intact**:

- **Reward gate:** 0 PFT has ever been paid from reward wallets to any bot address via the task submission flow. Every reward payment carries a memo and goes to a verified contributor.
- **Task node acceptance:** 0 bot-classified addresses have submitted memos to any task node. The acceptance gate is functioning.
- **Contributor economy:** The 130 real contributors have earned 100% of the PFT distributed through normal task rewards. Their work is uncorrupted.
- **Treasury exposure:** The 221K PFT seed represents 0.02% of the 1.25B PFT initially allocated to infrastructure wallets by the team. It has not grown or propagated beyond the isolated bot cluster.
- **Historical audit:** Using our full-history archive node, we can prove via on-chain data alone that no reward leaks to bots have occurred in any 30-day window.

---

## 9. What This Means for the Network

- **Task economy is clean:** No bots have infiltrated the reward flow. Every PFT paid through the task completion path has gone to a verified contributor.
- **The bot network is fully measurable:** 733 wallets performing 360,775 transactions can be filtered out of network health metrics, producer performance ratings, and any downstream analytics.
- **Real participation:** Only 130 wallets are producing actual task memos. This is the true size of the active Post Fiat contributor base.
- **Detection works:** The sybil classifier and edge indexer successfully identified the network from behavioral signals alone, without prior knowledge of the seeding event. The forensic trace was discovered retrospectively by following funding chains after the classification.
- **The seeding event is reproducible evidence:** Any third party with a full-history archive node can re-run the same queries and reach the same conclusions. This report's claims are independently verifiable.

---

## 10. Methodology

This analysis is fully deterministic and reproducible from public chain data:

1. **Index:** All transactions from genesis to present for every discovered wallet, stored in `chain-index.db`
2. **Classify:** Apply the 5 behavioral signals to each fully-crawled account; require ≥0.5 botScore across multiple signals
3. **Cluster:** Group classified bots by funding chain, temporal correlation, counterparty overlap, and amount fingerprints
4. **Filter:** Reject clusters where >30% of members have significant memo activity (prevents false positives)
5. **Forensic trace:** Follow funding chains from the bot master backward in time, identifying seed transactions and anomalies against the normal behavior of the source wallets

Every number in this report can be reproduced by running SQL queries against `~/.pf-scout/chain-index.db` on the PUC validator. No AI classification, no fuzzy matching, no off-chain data sources. The forensic trace uses only first-party chain data and wallet labels derived from on-chain behavior.

---

## 11. Data Availability

- Live graph: [pft.permanentupperclass.com/lens/](https://pft.permanentupperclass.com/lens/)
- Health API: [lens/health.json](https://pft.permanentupperclass.com/lens/health.json)
- Auth audit: [lens/auth.json](https://pft.permanentupperclass.com/lens/auth.json)
- Raw indexed data: `~/.pf-scout/chain-index.db` on the validator node

This report updates whenever the indexer pipeline runs (hourly).

---

*Generated 2026-04-15 by the Lens intelligence layer on the Permanent Upper Class validator. Forensic trace produced from public PFTL chain data.*
