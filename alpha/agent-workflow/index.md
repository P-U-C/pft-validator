# How I Ship With an AI Agent — An Operator's Workflow

*How one person built a chain indexer, bot classifier, network dashboard, daily newspaper, subscription protocol, subscriber CRM, 5 alpha submissions, a recruiting pack, and a three-reducer verification pipeline in 3 weeks — using Claude Code as a co-operator through Telegram.*

---

## The Setup

**Hardware:** A single Ubuntu VPS. Nothing special.

**The agent:** Claude Code (Opus) running as a persistent CLI session on the server. It has full filesystem access, can run bash commands, read/write files, search code, and execute scripts.

**The interface:** Telegram. I message from my phone. The agent reads my messages through an MCP plugin, does the work on the server, and replies back to Telegram. I can be at my desk, on a walk, or in bed. The work happens regardless.

**The tools the agent uses:**
- Read/Write/Edit for code and documents
- Bash for running scripts, git, npm, python, curl
- Grep/Glob for codebase search
- WebFetch for pulling external sources
- GitHub API for pushing, creating gists
- Chain indexer (SQLite) for on-chain data queries
- Telegram MCP for receiving my messages and sending replies

**What I provide:** Direction, judgment, domain context, course corrections, and the decisions the agent can't make alone.

**What the agent provides:** Execution speed, code generation, research synthesis, parallel workstream management, and never forgetting what we discussed three days ago.

---

## The Core Loop

Every piece of work follows the same pattern:

```
1. I describe what I want (Telegram, usually 2-4 sentences)
2. Agent asks clarifying questions OR just starts building
3. Agent drafts/builds/deploys
4. I review output (screenshot, Telegram summary, or live URL)
5. I course-correct ("no, the structure is wrong" / "this is good, ship it")
6. Agent iterates (usually 1-3 rounds)
7. Ship (git push, gist create, deploy)
```

The critical thing: **steps 2-3 often take 5-10 minutes while I do something else.** The agent runs background tasks, researches in parallel, and notifies me when something's ready. I'm not sitting at a terminal watching code generate. I'm directing from my phone.

### What "direction" actually looks like

Here are real messages I sent that produced real output:

> "I wonder if we could message all users that have not interacted with SUBS letting them know due to their activity on the task node they have received a free weeks trial of the HERALD"

This produced: a target sizing analysis (55 candidates → recommended 30), an outreach message draft, a CRM module (subs-crm.ts) with contact management and daily reporting, a send script with crash-safe checkpointing, and execution — 18 messages sent to real on-chain addresses.

> "Lens should have an airdrops received cumulative amount of unique accounts and pft. Also daily"

This produced: SQL queries against chain-index.db to compute airdrop stats, modifications to export-graph.sh to include airdrop data, new HTML/JS section in the Lens dashboard, deployment.

> "We really want to see people that are new and moving fast so we can network"

This produced: a "hustlers" query ranking new accounts by memos/day, integration into both Herald and Lens, deployed within 20 minutes.

**The pattern: I state the intent. The agent figures out the implementation.** I don't write SQL, don't write TypeScript, don't write HTML. I describe what the output should look like and review what comes back.

---

## How I Course-Correct

The agent's first draft is usually 70-85% right. The remaining 15-30% is where my judgment matters.

### Structural corrections

> "This is all mixed up. We are doing the task but it should be a standalone piece."

The agent had combined an alpha task submission with a four-section feedback note into one messy document. I told it to separate them. It restructured into two clean artifacts immediately.

> "Still wrong. It is only meant to be using the alpha flow we did."

The agent was conflating two different tasks — the collaborative wrapper and the actual alpha run. My correction reframed the entire submission structure. The agent can't know which task is which without my context.

> "It's passive, there's no process apart from joining the network via the task node"

The agent had written an elaborate four-stage selection gauntlet for a recruiting pack. I pointed out that none of that exists — the actual process is: get PFT, message the task node, do work. The agent rewrote from scratch around reality.

### Quality corrections

> "This is good, but not yet a world-class Alpha submission."

I forwarded the task node's review feedback (7.8/10 with specific structural recommendations). The agent incorporated every suggestion: restructured around faster/flatter/hard/infra breakpoints, added query-shaping as a surprise breakpoint, trimmed the meta-thesis. Final version scored much higher.

> "The ordering is messed up — I drafted prior to asking the task node for the original task"

The agent had the timeline wrong. I provided the correct sequence. It fixed it in one edit.

### The key insight about course correction

**I never write code or long-form text myself.** I read what the agent produces and tell it what's wrong in plain language. The correction is always about structure, intent, or factual accuracy — things I can evaluate in seconds from my phone. The agent handles the mechanical work of implementing the correction.

---

## Parallel Workstreams

On any given day, I'm typically running 3-5 workstreams simultaneously:

**Always running in background:**
- SUBS bot (polling every 30s for new messages)
- Chain indexer (daily crawl via cron)
- Herald export (daily at 00:05 UTC)
- Graph export (daily for Lens)
- CRM daily report (sends to my Telegram)

**Active during a session:**
- An alpha task in progress (research → draft → review → iterate)
- A bug fix or feature request for Lens/Herald/SUBS
- An outreach campaign execution
- Responding to task node verification questions

The agent handles all the context switching. When I say "what's the subs status?" mid-way through an alpha task, it runs the CRM report, sends me the numbers, and picks up the alpha task where we left off. I don't manage the state — the agent does.

### Real example of a multi-workstream day

April 25:
1. Started with CRM daily report (auto-sent: 3 conversions, 5.2% rate)
2. Built the reviewer queue triage reducer (c56bfbe6, 6,107 PFT)
3. Got review feedback, implemented 5 upgrades
4. Answered a verification question about the reducer's control flow
5. Started the reward-cap reducer (e18618a0, 6,429 PFT)
6. Got review feedback, added cap floor policy + adversarial tests
7. Answered verification question about cap_multiplier vs capped_reward_pft
8. Chad asked for "hustlers" in Lens and Herald — added the feature
9. Investigated who's talking to the Lens bot
10. Ran Wave 2 outreach (35 targets, 18 sent)
11. Fixed the SUBS page not updating subscriber count
12. Added auto-trigger re-export to the SUBS bot
13. Restarted SUBS bot with new code

All in one session, from Telegram. The agent maintained context across all 13 items.

---

## How I Use External Review

The task node's review system is the best forcing function I've encountered:

1. **Submit the work.** Get an initial score (usually 7-9/10 for solid work).
2. **Read the structural feedback.** The reviewer identifies exactly what's holding it back. Not vague — specific sections, specific missing elements.
3. **Forward the feedback to the agent.** The agent reads the full review and implements every recommendation.
4. **Resubmit.** Score improves by 1-2 points.
5. **Handle the verification question.** This is the real test. The reviewer asks something that requires genuine understanding of what you built.

This loop runs in 30-60 minutes per iteration. I typically do 2-3 iterations before submission.

**The multiplier effect:** The agent can incorporate feedback much faster than I could manually. A review that says "add priority_components decomposition, split evidence_accessible into two fields, add reviewer_deadlock detection, remove Unicode characters" — that's four changes I'd spend an hour on. The agent does it in 5 minutes.

---

## The Feedback Loop Speed

The tightest loop is:

```
Me (phone): "It's not fitting in the network topology chart with all the added accounts"
Agent: [diagnoses layout issue, switches to cose-bilkent, deploys]
Me: "Hide bots is on on initial load but still shows bots"
Agent: [finds the bug — filter applied on click not render, fixes, deploys]
Me: "Better"
```

Three rounds. Maybe 10 minutes total. A dashboard bug identified, diagnosed, and fixed from my phone while I was probably walking somewhere.

The longest loop is an alpha task:

```
Day 1: I identify the topic, share source material
       Agent drafts initial thesis
       I course-correct the angle
       Agent redrafts
       
Day 1: Submit to task node
       Receive review (7.8/10)
       Forward feedback to agent
       Agent implements 5 structural changes
       Resubmit
       
Day 1: Receive verification question
       Agent drafts response
       I review and approve
       Submit
       
Day 1: Rewarded (8,500 PFT, 1.77x listed)
```

Even the "long" loop fits in a single day.

---

## What I've Learned About Working This Way

### The operator's edge is real

The agent can generate code, write specs, draft analysis. What it can't do:

- **Know which problem matters.** I chose to build the Herald before anyone asked for it. I chose to investigate the bot network. I chose to do the CMC cross-check even though it would fail — because the failure was the finding.

- **Navigate ambiguity.** "I want a collaborative task" is a judgment call about what the network needs. The agent can't make that call.

- **Taste external feedback.** When the review says 7.8/10, I know which suggestions to accept and which to push back on. The agent would implement everything literally.

- **Know when to stop.** The agent will keep improving forever. I decide when it's good enough to ship.

### What works best as direction

- **Intent, not instructions.** "We want to see people that are new and moving fast" beats "write a SQL query that joins accounts and transactions."
- **Corrections, not rewrites.** "The structure is wrong, it should be standalone" is faster than explaining the right structure from scratch.
- **Forwarding external feedback verbatim.** The agent is excellent at implementing specific review notes. Don't summarize — forward the full text.
- **Screenshots of problems.** I send a screenshot of a broken UI. The agent reads the image, identifies the issue, and fixes it.

### What doesn't work

- **Leaving the agent to make judgment calls.** It will produce something reasonable but generic. The work that earns 2x multipliers always has my judgment in the loop.
- **Long, detailed specification up front.** By the time I finish explaining everything, the agent could have built a first draft. Start with intent, course-correct from there.
- **Assuming the first draft is right.** It's usually 70-85% right. The remaining 15-30% is the difference between a 7/10 and a 10/10 submission.

---

## The Numbers

Over the last 3 weeks, this workflow produced:

- **13,568 transactions indexed** across 1,003 wallets
- **733 bots identified** and forensically traced to funding source
- **5 alpha submissions** earning 8,800 + 8,500 + pending + pending + pending PFT
- **4 reducer/spec implementations** with 120+ combined tests
- **3 public products** (Lens, Herald, SUBS) with real users
- **58 outreach contacts**, 4 conversions, 5,000+ PFT subscription revenue
- **1 recruiting pack** rewritten 3 times based on review feedback
- **1 task node semantics guide**
- **~40 git commits** to the pft-validator repo

My total typing: mostly short Telegram messages, a few screenshots, and forwarded review feedback. Everything else was agent-generated and human-directed.

The bottleneck was never execution speed. It was always judgment: knowing what to build, when to stop iterating, and which course correction to give.

---

## How to Set This Up

1. **Claude Code CLI** on a server with persistent session
2. **Telegram MCP plugin** for mobile-first interaction
3. **Git repo** for deploying to GitHub Pages (zero-infra hosting)
4. **The work itself** as the forcing function — real tasks with real deadlines and real review

The tooling is simple. The workflow is simple. The hard part is being a good operator — knowing what to direct, when to intervene, and when to let the agent run.

---

*The agent didn't write this doc because it thought it should. I told it to, in one sentence, from Telegram. That's the workflow.*
