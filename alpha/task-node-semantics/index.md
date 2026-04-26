---
layout: default
title: "How the Post Fiat Task Node Works — An Operator's Semantic Guide"
date: 2026-04-26
category: network
status: published
---

# How the Post Fiat Task Node Works

*An operator's semantic guide, built from indexing 13,568 transactions across 1,003 wallets, running two on-chain bots, and discovering what the documentation doesn't tell you.*

---

## What the Task Node Is

The Post Fiat Task Node is an on-chain work coordination system. Humans request tasks, an AI agent decomposes them into verifiable steps, humans execute the work, reviewers verify it, and rewards are paid on-chain. The entire lifecycle — request, proposal, acceptance, execution, review, payment — is recorded as encrypted memos on the PFT ledger.

The ledger is an XRPL fork (network_id: 2025) running `postfiatd` nodes. It uses the same transaction primitives as XRP (Payments, TrustLines, NFTs) but exists as a separate network with its own validators, its own token (PFT), and its own UNL.

**The task node is not a smart contract.** It is a centralized AI agent that reads and writes to a decentralized ledger. The ledger provides the settlement layer and the audit trail. The agent provides the intelligence.

---

## The Wallet Topology

Eight infrastructure wallets form the backbone. Understanding their roles is essential to reading the chain correctly.

| Wallet | Role | Behavior |
|--------|------|----------|
| **Task Hub** (rwdm72...) | The brain. Receives all task memos from contributors. | 8,098 inbound transactions. The single busiest destination on the network. Every task request, status update, and submission flows here. |
| **Task Node Reward 1** (rGBKxo...) | Primary reward distributor. | 2,385 payments to 72 recipients. ~15M PFT distributed. Handles the majority of task reward payouts. |
| **Task Node Reward 2** (rKt4pe...) | Secondary reward distributor. | 1,165 payments to 63 recipients. ~7.2M PFT. |
| **Task Node Reward 3** (rJNwqD...) | Tertiary reward distributor. | 477 payments to 53 recipients. ~2.9M PFT. |
| **Task Node Reward 4** (rKddMw...) | Newest reward node. | 36 payments to 19 recipients. ~222K PFT. Recently activated. |
| **Treasury** (rhczhW...) | Holds reserve PFT. | 12 outbound transactions. Rarely active. |
| **Reserve** (rBDbRY...) | Additional reserve. | 5 outbound transactions. |
| **Team** (r4vhrM...) | Team operations wallet. | 4 outbound, 2 inbound. |

**Key insight:** Reward payments rotate across all four reward nodes. There is no fixed mapping of "Reward 1 pays person X." The rotation appears to be load-balancing or key-rotation for operational security. Any analysis that hardcodes a single reward address will miss payments.

---

## How a Task Flows

### Step 1: Request

A contributor sends a memo to the Task Hub with a natural-language request:

> "I want to build a network monitoring dashboard"

or simply:

> "I want a collaborative task"

The memo is encrypted using keystone protocol before transmission. On-chain, all memos appear as keystone-encrypted envelopes — there is no way to distinguish a task request from a status update from a submission by looking at `memo_type`. This is a critical implementation detail: **you cannot filter by memo_type to find specific message types.** Everything is `keystone`.

### Step 2: Task Generation

The Task Hub's AI agent reads the request, considers the contributor's history and operating profile, and generates a task proposal. The proposal includes:

- **Title and description** — what needs to be done
- **Steps** — decomposed execution plan
- **Verification criteria** — how completion will be judged
- **Reward** — PFT amount (may be adjusted at review time)
- **Deadline** — when the work is due
- **Alignment** — how this connects to network priorities
- **Category** — Network, Alpha, Personal, etc.

The proposal is sent back as an encrypted memo to the contributor.

**What we learned:** The task generator is remarkably good at matching requests to contributor profiles. When we submitted a vague "I want a collaborative task" after weeks of building sybil classifiers and trading signal systems, it routed us to a confidence-calibration alpha task that directly leveraged our operating experience. The routing appears to use the contributor's full memo history as context.

### Step 3: Acceptance

The contributor reviews the proposal and accepts or rejects. Acceptance is recorded on-chain. The task moves to "In Progress."

**Bug we found:** The system checks the contributor's weekly alpha budget *after* acceptance, not before. A contributor can accept a task, then discover they're blocked by a "You have reached this week's alpha task budget" banner — with the chat window now unavailable. The budget check should run before the accept button is clickable.

### Step 4: Execution

The contributor does the work. For many tasks, this involves iterating with the task node's AI through the chat interface — drafting, getting feedback, revising, and refining. The chat is the workspace.

**Categories of work we've observed:**

- **Network tasks** — infrastructure, governance, verification integrity. Example: "Build a reviewer queue aging triage reducer." These tend to produce code or specs.
- **Alpha tasks** — research and analysis for the network's intelligence layer. Example: "Map LLM-first research workflow breakpoints." These produce practitioner observations.
- **Collaborative tasks** — multi-contributor work with cross-referencing. Example: "Complete a distinct alpha submission with four-section feedback." These require artifact discoverability (which is currently broken — see below).
- **Personal tasks** — individual growth or operational work. These are not publicly visible.

### Step 5: Submission

The contributor submits evidence — typically a URL to a public artifact (gist, HackMD, GitHub Pages, repo). The submission is sent as an encrypted memo to the Task Hub.

**Verification requirements vary by task.** Some require a URL to a public Markdown file. Some require code with tests. Some require screenshots. The task proposal specifies exactly what the reviewer needs to see.

### Step 6: Review

A reviewer (human or AI-assisted) evaluates the submission against the verification criteria. The review may include:

- **Verification questions** — specific technical challenges to test the contributor's understanding. Example: "Provide the TypeScript snippet showing how the sealed-state renderer restricts collaborators to hash-only visibility."
- **Novelty search** — automated check for plagiarism or overlap with existing submissions. Returns sources found and excerpts matched.
- **Sybil similarity score** — measures how similar the submission is to other submissions, flagging potential coordinated activity. Score < 0.5 is typical for genuine independent work.

**What we learned:** Verification questions are the most valuable part of the review process. They test whether the contributor actually built the thing or just generated documentation. The question about our sealed-state renderer code was directly answerable because we wrote the code. A contributor who only generated a spec would struggle.

### Step 7: Reward

If approved, the reward is paid from one of the four Reward Node wallets. The payment amount may differ from the listed reward:

- **Listed 4,400 PFT, paid 8,800 PFT** — our LLM breakpoints alpha was rewarded at 2x for grounding observations in actual code
- **Listed 4,800 PFT, paid 8,500 PFT** — our confidence-calibration alpha was rewarded at 1.77x

The reward multiplier appears to correlate with depth, originality, and practical grounding. Surface-level submissions that meet minimum requirements get the listed amount. Submissions with original research, working code, or surprising insights earn multipliers.

**Daily airdrops** are a separate mechanism from task rewards. They occur at exactly 21:08:11 UTC from the Reward Node wallets, distributing PFT to 2-3 active contributors based on reputation. These are not task-specific — they're recognition payments for sustained contribution.

---

## The Encryption Layer

All task node communication uses keystone encryption. This has several consequences:

1. **No public memo inspection.** You cannot read task content from the ledger without the decryption key. The chain records that a memo was sent, when, and between whom — but not what it says.

2. **No memo_type filtering.** Before keystone, memos had types like `subs.subscribe` or `task.submit`. After keystone, everything is encrypted into the same envelope format. Any code that filters on `memo_type` to find specific interactions will fail silently. We discovered this when our subscription verification was checking for `memo_type = 'subs.subscribe'` and finding nothing — because all memos appeared as keystone envelopes.

3. **Subscription detection by amount, not memo.** Since you can't read the memo content, subscription payments must be identified by the payment amount + destination address. A payment of exactly 1,000 PFT (1,000,000,000 drops) to the SUBS protocol address is a Herald subscription, regardless of what the memo says.

4. **Bot identity requires separate keystone keys.** Two bots sharing the same keystone API key will have the same agent_id, causing identity collisions. Each bot needs its own provisioned key.

---

## What the Network Looks Like

From indexing the full ledger:

| Metric | Value |
|--------|-------|
| Total accounts | ~1,003 |
| Bots (classifier-detected) | 733 |
| Humans (active contributors) | ~130 |
| Infrastructure wallets | 8 |
| Total transactions indexed | 13,568 |
| Memo transactions | 12,455 |
| Sybil clusters | 1 |
| Daily memo average | ~126/day |

**The 733-bot network** is a single cluster traced to a Feb 17, 2026 seeding event. 222K PFT was distributed from a Distribution wallet through a middleman (raPDi83) to a bot master that funded the entire network. The bots exhibit: zero memo activity despite high transaction counts, uniform balance patterns, high peer cluster density, and concentrated funding sources. They are wash-trading bots, not task contributors.

**130 real humans** produce all 12,455 memo transactions. The network's actual activity is entirely human-driven despite the bot count inflating the wallet numbers.

---

## Collaborative Tasks — The Discovery Problem

Collaborative tasks are the network's coordination primitive. Multiple contributors work on related tasks, and later contributors are expected to cross-reference earlier work.

**The problem:** there is no mechanism to discover what other contributors submitted. The collaboration panel shows names and completion status but not submission URLs. A contributor asked to "pick one public note from the current cohort" has no way to find that note. We spent 30 minutes searching GitHub, HackMD, gists, and the task node chat — and found nothing.

This is a structural gap, not a missing feature. The system generates collaborative tasks that are impossible to complete because artifact discoverability does not exist. We documented this as a finding and escalated it into a spec for protocol-safe artifact discovery with visibility states (public, private, obfuscated, legacy).

---

## The Products Built on Top

### Lens (pft.permanentupperclass.com)

Network intelligence dashboard. Cytoscape.js graph visualization of all accounts and edges, health scoring, bot detection, airdrop tracking, hustlers (fastest-growing new contributors), rich list, sybil forensics. Powered by a BFS chain indexer that crawls from seed accounts through the transaction graph.

### The Hive Herald (pft.permanentupperclass.com/herald/)

Daily on-chain intelligence newspaper. Sections: Pulse (network health), Flow (reward distribution), Airdrops (daily recognition), Movers (rising/falling contributors + hustlers), Watch (sybil detection), Deep Cut (historical analysis). Delivered on-chain as an encrypted memo to subscribers and published at a web reader with wallet-address gating.

### SUBS Protocol (pft.permanentupperclass.com/subs/)

On-chain subscription marketplace. 2.5% protocol fee. Payment verification by amount + destination (not memo type, because keystone). Currently one service (Herald, 1,000 PFT/30 days, 5 active subscribers). The SUBS bot auto-responds to /services, /status, /subscribe, /help commands and sends follow-up discount offers to interested non-subscribers after 7 days.

---

## What the Documentation Doesn't Tell You

1. **The reward nodes rotate.** Don't hardcode a single reward address. All four distribute payments, and the rotation pattern is not documented.

2. **Keystone encrypts everything.** There is no way to distinguish message types on-chain. Design all verification logic around amount + destination, not memo content.

3. **Daily airdrops have a specific fingerprint.** Exactly 21:08:11 UTC, from any reward node, to non-infrastructure/non-bot addresses, with `has_memo = 0`. Task rewards have memos; airdrops don't.

4. **The task generator uses your full history.** It's not keyword matching — it reads your entire memo history to profile your operating context and route tasks accordingly.

5. **Verification questions are the real review.** The novelty search and sybil score are automated filters. The verification question is where the reviewer tests whether you actually did the work.

6. **Reward multipliers are real.** Submissions with original research, working code, or surprising operator observations earn 1.5-2x the listed reward. The system incentivizes depth.

7. **Collaborative tasks assume artifact discoverability that doesn't exist.** If a task asks you to cross-reference a cohort note, you probably can't find it. Document the discovery failure as a finding — that's often more valuable than the cross-reference itself.

8. **The bot classifier only works on fully-crawled accounts.** Accounts with `last_crawled_at IS NULL` have no memo data and will false-positive on zero_memo_high_tx. Only classify crawled wallets.

9. **The alpha budget blocks after acceptance, not before.** Check your remaining alpha slots before requesting a task. There's no indicator in the UI.

10. **PFT uses `pft-ledger.toml`, not `xrp-ledger.toml`.** It's a fork, not the XRP mainnet. Validator domain verification uses a different file path.

---

*Written from operating experience on the Post Fiat Network, April 2026. All observations are from public on-chain data and direct task node interaction.*
