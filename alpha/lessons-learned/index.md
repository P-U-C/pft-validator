# Building on Post Fiat — What Worked, What Didn't, What We'd Do Differently

*Lessons from 3 months of building: chain indexer, bot classifier, Lens dashboard, Hive Herald newspaper, SUBS subscription protocol, sybil forensics, and 95+ tasks on the task node. April 2026.*

---

## Project 1: Chain Indexer

**What it is:** BFS crawler that starts from seed accounts and walks the transaction graph, indexing everything into SQLite (chain-index.db). Powers all downstream products.

### What Worked

- **SQLite + WAL mode.** Simple, fast, no infra overhead. 13,568 transactions across 1,003 wallets, queries return in milliseconds. Don't overthink the database choice for this scale.
- **BFS from seed accounts.** Starting from known infrastructure wallets and expanding outward gives you the full connected graph without needing to enumerate all accounts. Clean approach.
- **Edge table separate from transactions.** Tracking edges (from_address → to_address with aggregate counts) separately from individual transactions enables graph visualization without scanning the full tx table.

### What Didn't Work

- **Forgetting to add new bot addresses to seed accounts.** When we deployed the SUBS bot (r9XYDxJD), we didn't add it to the crawler's seed set. Result: subscriber payments were never indexed. The bot was running, processing commands, but the indexer had no idea it existed. Subscribers appeared to not exist. **Lesson: every new on-chain entity needs to be a seed.**
- **Edge creation coupled to transaction INSERT.** Originally, edges were only created when a new transaction was indexed. If the transaction already existed (re-crawl), the edge was skipped. Result: 2,944 edges when there should have been 41,292. Had to rebuild the entire edge table from the transactions table. **Lesson: decouple derived data from primary data ingestion.**
- **Discovered_at vs first-memo timestamp.** The `discovered_at` field records when the crawler first saw the account, not when the account was actually created on the network. This makes "new account" detection unreliable — an account created months ago but only recently crawled looks "new." **Lesson: use the first transaction timestamp as the account birthday, not the crawl time.**

### What We'd Do Differently

- Add a `first_tx_at` field computed from the earliest transaction, not the crawl time.
- Make edge rebuilding a periodic maintenance task, not a one-time fix.
- Auto-discover new seed accounts from transactions with infrastructure wallets instead of hardcoding.

---

## Project 2: Bot Classifier / Sybil Detection

**What it is:** 5-heuristic behavioral classifier that flags bot accounts. Powers the WATCH section of the Herald and the sybil cluster visualization in Lens.

### What Worked

- **Behavioral heuristics over simple rules.** Five independent signals (zero_memo_high_tx, uniform_balance, peer_cluster_density, high_tx_low_balance, nft_no_memos) catch real bots without overfitting to any single pattern. Found the 733-bot wash trading network.
- **Funding chain tracing.** Following the money backward from bots to their funding source revealed the entire network topology: Distribution 2 → raPDi83 middleman → bot master → 733 bots. This was the most valuable forensic finding.
- **Only classifying fully-crawled accounts.** After getting burned by false positives, we added a `last_crawled_at IS NOT NULL` filter. Uncrawled accounts have tx_count>0 but memo_tx_count=0 by definition — they look like bots but aren't. **This single filter reduced false positives from 671 to near zero.**

### What Didn't Work

- **Catch-all "tx_count > 10 → bot" rule.** We initially added this as a safety net. It flagged every active human contributor as a bot. Removed immediately. **Lesson: aggressive catch-all rules are worse than missed detections.**
- **Sybil analyzer re-inserting all cluster members every run.** The analyzer DELETE + re-INSERT pattern made every member appear "newly detected" on each run. The Herald reported "743 new sybil detections" daily when nothing had changed. **Lesson: use upsert, not delete-and-reinsert, for incremental detection.**
- **False positive on real contributors with sybil-like patterns.** The amount fingerprint + temporal correlation heuristic flagged real contributors (including ourselves) because they received similar-sized payments at similar times. **Fix: reject clusters where >30% of members have >10 memos.** Real contributors have memos; bots don't.

### What We'd Do Differently

- Implement incremental detection with a changelog instead of full re-analysis.
- Add a false-positive rate measurement framework.
- Build automated funding-chain tracing instead of manual investigation.

---

## Project 3: Lens Dashboard

**What it is:** Network intelligence dashboard with Cytoscape.js graph visualization, health scoring, airdrop tracking, hustler detection, sybil forensics.

### What Worked

- **Cytoscape.js with cose-bilkent layout.** The only layout engine that handles 850+ nodes without crashing or becoming illegible. Standard cose layout couldn't cope.
- **Graph.json as the data contract.** A single JSON file exported by a cron job, consumed by a static HTML page on GitHub Pages. Zero backend, zero API, zero auth. Deploy by git push.
- **"Hustlers" section.** Tracking new accounts by memos/day gave us a real-time feed of who's ramping fast on the network. Immediately useful for outreach.
- **Yesterday's airdrops fallback.** Airdrops happen at 21:08 UTC but the graph export runs at 00:00. Without a fallback, "today's airdrops" always showed "pending." **Fix: when today_pft is 0, show yesterday's data with "Last Drop" label.**

### What Didn't Work

- **Cytoscape.use() registration.** Loaded the cose-bilkent plugin via script tag but forgot to call `cytoscape.use()`. The graph silently fell back to default layout with 850 nodes piled on top of each other. No error message. **Lesson: library registration is not automatic. Always verify the plugin loaded.**
- **"Hide bots" toggle not applied on initial load.** The button existed and worked on click, but the initial render showed all 733 bots. Users saw a hairball instead of the meaningful 130-node human graph. **Fix: apply filters in the initial render, not just on toggle.**
- **Hardcoded reward wallet addresses.** The airdrop section initially only checked 2 of 4 reward nodes. When airdrops rotated to the other two, they disappeared from the dashboard. **Fix: dynamically load all infrastructure wallets from the DB labels.**
- **New wallets count capped by LIMIT 5.** The SQL query had `LIMIT 5` on the results, then used `len(results)` as the count. Always showed "5 new wallets this week" when the real number was 59. **Fix: separate COUNT(*) query for the narrative, keep LIMIT for the display list.**

### What We'd Do Differently

- Test with all filters applied on initial load, not just after interaction.
- Never hardcode infrastructure addresses. Always load from labels.
- Add a data freshness indicator showing when graph.json was last exported.

---

## Project 4: The Hive Herald

**What it is:** Daily on-chain intelligence newspaper. 6 sections: Pulse, Flow, Airdrops, Movers (including hustlers), Watch, Deep Cut. Delivered on-chain to subscribers and published at a web reader.

### What Worked

- **Vintage newspaper aesthetic.** UnifrakturMaguntia + Playfair Display + Lora fonts. Users loved it — it differentiated from every other crypto dashboard. The Herald feels like a publication, not a data dump.
- **Herald as structured JSON.** The export script generates hive-herald.json which the web reader consumes. Machine-readable from day one. An AI agent asking "what's happening on PFT?" can ingest the Herald directly.
- **Yesterday's numbers for the daily report.** The Herald runs at 00:05 UTC. "Today" has 0 memos because the day just started. Using yesterday's data with a "yesterday" label eliminated the confusing "0 memos today" reports. **Lesson: time your reporting relative to your data collection schedule.**
- **Airdrop detection by time window.** Daily airdrops happen at exactly 21:08:11 UTC from infrastructure wallets. Filtering by 21:05-21:12 window + has_memo=0 distinguishes airdrops from task rewards (which have memos and happen at various times).

### What Didn't Work

- **Herald gate asking for "wallet address" confused users.** Someone tried to enter their email. The gate said "Enter your r-address" but users don't think in terms of XRPL wallet addresses. **Fix: "Enter your XRPL wallet address (starts with r). This is your on-chain address, not an email." + specific error message for @ symbols.**
- **Sybil count showing "743 new detections" daily.** The sybil analyzer's delete-and-reinsert pattern made every member look new every day. The Herald dutifully reported them as new. **Fix: report total tracked count, not "new in 24h."**
- **Mobile readability.** Initial version had 14px body text and horizontal overflow. Unreadable on phone. **Fix: 17px body, overflow-x hidden, single-column layout, darker ink colors for contrast.**

### What We'd Do Differently

- Build mobile-first from day one. Most users check the Herald on their phone.
- Include a feedback mechanism in the Herald itself (reply with comments).
- Add a machine-readable API endpoint alongside the web reader.

---

## Project 5: SUBS Subscription Protocol

**What it is:** On-chain subscription system. 2.5% protocol fee. Payment verification by amount + destination. Currently one service (Herald, 1,000 PFT/30 days).

### What Worked

- **Amount-based verification.** Since keystone encrypts all memos, we can't check `memo_type = 'subs.subscribe'`. Matching on destination + sender + amount >= price works reliably. **This is the single most important lesson about building on PFT: never rely on memo content for verification.**
- **Processed tx hash persistence.** The SUBS bot saves processed transaction hashes to disk (JSON file). Without this, every restart replayed all messages — the bot would re-respond to weeks of old commands. **Lesson: any polling bot needs crash-safe dedup.**
- **Follow-up discount offers.** Automatically sending a 100 PFT discount to people who interacted but didn't subscribe, 7 days after their first interaction. Converts interested-but-hesitant users.
- **Auto-trigger subs.json re-export.** When the bot detects a new subscription payment, it shells out to the export script. The website updates within 60 seconds instead of waiting for the next cron run.

### What Didn't Work

- **Checking memo_type for subscription detection.** The original handleStatus() had `AND memo_type = 'subs.subscribe'`. Returned zero results because all memos are keystone-encrypted. Subscriptions appeared not to exist. **Took hours to diagnose because the query didn't error — it just returned empty results.** The fix was removing the memo_type filter entirely.
- **Shared keystone API key between bots.** Lens bot and SUBS bot shared the same keystone key, producing the same agent_id. Identity collision. **Fix: provision a separate keystone key per bot wallet.**
- **Bot freezing on restart.** In-memory dedup set was lost on restart, causing the bot to replay and re-respond to every historical message. Users got duplicate responses. **Fix: persist to ~/.pf-scout/subs-bot-processed.json, keep only last 500 hashes.**
- **5 of 23 outreach messages failed.** Recipients without a MessageKey set on their XRPL account can't receive encrypted messages. No error until you try to send. **Lesson: check encryption key availability before attempting to send, or batch-verify targets first.**
- **subs.json not updating after new subscriptions.** The subscriber count on the website lagged behind reality because subs.json was only exported on a daily cron. A user subscribed and the site still showed the old count. **Fix: trigger re-export from the bot on new subscription detection.**

### What We'd Do Differently

- Never assume memo content is readable. Design all verification around amount + destination from the start.
- Provision unique keystone keys for every bot at deployment time, not as a fix.
- Build a pre-send check that verifies the recipient can receive encrypted messages before attempting delivery.

---

## Project 6: Subscriber Acquisition (CRM + Outreach)

**What it is:** Two-wave outreach campaign to active contributors, offering free Herald trials. CRM tracking engagement and conversions.

### What Worked

- **Targeting by memo count.** Wave 1: 50+ memos in 30 days. Wave 2: anyone receiving airdrops in last 7 days. Both criteria identified genuinely active contributors, not dormant wallets.
- **Crash-safe CRM saves.** Save after every individual message send. If the script crashes at message 15 of 35, the first 14 are recorded and won't be re-sent. **Lesson: any batch operation should checkpoint after each item.**
- **Daily CRM report via Telegram.** Automated daily status update with conversion count, trial status, engagement metrics. Makes the campaign feel alive without manual checking.
- **Removing SUBS branding from outreach.** Initial message mentioned the SUBS bot. Chad said remove it — the outreach should be about the Herald, not about the subscription mechanism. The product sells; the plumbing doesn't.

### What Didn't Work

- **17 of 35 Wave 2 messages failed.** Most Tier 2 targets (brand new 12-PFT accounts) don't have MessageKey set. We knew this was likely but sent anyway. **Lesson: filter targets by encryption key availability before batching.**
- **No feedback mechanism.** We asked "we'd love your feedback" but provided no easy way to respond. Contributors would need to message the SUBS bot or find us on Discord. **Should have included a direct reply path.**
- **Conversion tracking depends on chain indexer freshness.** A subscriber pays, but the CRM doesn't see it until the next crawl. The "conversion" shows up hours late. **Fix: the SUBS bot now triggers re-export on new subscriptions, but the CRM still lags.**

### Results

- Wave 1: 23 targets, 18 sent, 5 failed (no encryption key). 3 conversions (13% of delivered).
- Wave 2: 35 targets, 18 sent, 17 failed. 1 conversion from wave 2 so far.
- Total: 58 contacts, 36 delivered, 4 conversions (11% of delivered).
- Revenue: 4,000 PFT in subscription payments.

---

## Project 7: Task Node — What We Learned Operating It

### What Worked

- **Being specific in task requests.** "I want to do a task that builds upon my previous and is related to tokenomics" generated a perfectly matched reward-cap reducer task. Vague requests get generic tasks.
- **The verification question as learning tool.** "Paste the code snippet showing how the sealed-state renderer restricts collaborators to hash-only visibility." This question tested real understanding. If you built it, you can answer it instantly. If you generated docs, you can't.
- **Iterating with external review.** The alpha task review system rated our initial draft 7.8/10 and gave specific structural feedback. Three iterations later it was 9.5+. The feedback loop is the most valuable part of the system.
- **Earning multipliers through depth.** Listed 4,400 PFT → earned 8,800 PFT (2x) on the LLM breakpoints alpha. Listed 4,800 PFT → earned 8,500 PFT (1.77x) on the confidence-calibration alpha. The pattern: ground your work in something the LLM can't produce alone.

### What Didn't Work

- **Alpha budget blocks AFTER acceptance.** Accepted a task, then saw "You have reached this week's alpha task budget." The chat window became unavailable. Budget should be checked before the accept button is clickable.
- **Collaborative tasks assume artifact discoverability that doesn't exist.** "Pick one public note from the current cohort" — but there's no way to find cohort artifacts. No links in the collaboration panel. External search found nothing. The task was structurally impossible. **This became our most valuable finding: we documented the discovery failure and spawned a spec task to fix it.**
- **Producer timeline inconsistency.** The forensic timeline showed producers joining a task before the task was generated. Either the task was re-versioned (show history) or the UI is pulling from a predecessor task ID.
- **The 7/12 collaboration ratio is unexplained.** No tooltip, no legend, no documentation. Visible producers don't add up to the displayed numbers.

### Patterns That Earn

- **Code with tests earns more than specs without code.** Every code submission with test coverage received positive reviewer feedback. Specs alone are worth less.
- **Adversarial tests surprise reviewers.** Protocol invariant tests ("sybil block NEVER allows cross-check," "dead URL NEVER produces can_open=true") were specifically called out as quality signals.
- **Grounding observations in engineering artifacts.** The reviewer on our LLM breakpoints alpha specifically cited "the TypeScript snippet grounded high-level observations in engineering reality" as what elevated the submission.
- **Answering verification questions with precision.** When asked about obfuscated renderer control flow, a specific code walkthrough with collaborator vs reviewer behavior mapping earned immediate approval.

---

## Cross-Cutting Lessons

1. **Never rely on memo content on PFT.** Keystone encrypts everything. Design all verification around amount + destination + timestamp.

2. **Infrastructure wallet addresses rotate.** Don't hardcode them. Load dynamically from wallet_labels.

3. **Time your reports relative to your data.** If you export at 00:05 UTC, "today" is empty. Use yesterday's data.

4. **Dedup everything on disk, not in memory.** Bot restarts lose in-memory state. Persist processed IDs.

5. **Your operating failures are your most valuable contributions.** The 671 false positives, the silent subscription failure, the impossible collaborative task — each failure produced a finding worth more than the original task.

6. **The reward multiplier correlates with non-replicability.** Ask yourself: could an LLM produce this from public data? If yes, it's 1x. If no, it's 1.5-2x.

7. **Ship working systems, not specs.** The Herald with 5 real subscribers beats a perfect subscription protocol spec with zero users.

8. **Checkpoint batch operations.** Save after each item, not at the end. Crashes happen.

9. **Filter targets before sending.** Check encryption key availability, check if already contacted, check if already subscribed.

10. **Document the discovery failure.** When a task is impossible, the impossibility is the finding. Don't skip it — escalate it.

---

*Built on Post Fiat Network, Feb-Apr 2026. All observations from public on-chain data and direct task node interaction.*
