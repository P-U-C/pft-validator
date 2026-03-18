---
layout: default
title: "PFTL Agent Bot Architecture Specification v1.0"
description: "Architecture specification for a PFTL-native agent bot that uses pf-scout as its intelligence foundation to enable contributor discovery, task routing, and network coordination within the Post Fiat Task Node interface."
date: 2026-03-18
version: "1.0"
status: "published"
permalink: /alpha/pftl-agent-bot-architecture/
---

# PFTL Agent Bot Architecture Specification v1.0

This document specifies the architecture for a PFTL-native agent bot built on pf-scout, the open-source contributor intelligence CLI. The bot operates within the Post Fiat Task Node interface, enabling contributor discovery, task routing, and network coordination through encrypted on-chain PFTL messages. pf-scout-bot (hosted at github.com/P-U-C/pf-scout-bot) provides the runtime: a FastAPI HTTP server (Phase 1), autonomous XRPL polling (Phase 2), and a background enrichment pipeline (Phase 3).

## 1. System Architecture: pf-scout CLI to Agent Bot Capability Map

The agent bot exposes pf-scout's 21 CLI commands as categorized bot capabilities. Each command is assigned a release tier and mapped to one of five core action categories.

### Command Classification

**Core v1 — implement in first release:**

    show          → Contributor Lookup: retrieve a single scored profile
    list          → Contributor Lookup: list contacts with filtering by tier, tag, score
    rerank        → Contributor Lookup / Collaboration Matching: re-rank contacts against a context lens
    prospect      → Collaboration Matching: generate scored prospect pipeline
    seed postfiat → Collaboration Matching: seed contacts from PF leaderboard
    seed github   → Collaboration Matching: seed contacts from a GitHub org
    set-context   → Onboarding Guidance: set scoring lens for the bot operator
    update        → Network Intelligence: re-collect signals and re-score a contact
    report        → Network Intelligence: generate report from stored snapshots
    diff          → Network Intelligence: compare snapshots over time
    export        → Network Intelligence: export contacts to JSON for downstream tools

**Deferred v2:**

    add           → manual contact creation, requires structured input validation
    link          → identity linking, needs disambiguation UI
    note          → adding notes, requires content moderation layer
    tag           → tag management, needs operator approval workflow
    merge         → duplicate resolution, destructive operation needing confirmation
    seed csv      → CSV import, needs file upload mechanism over PFTL
    archive       → archive/restore, needs operator confirmation

**Out of scope (operator-only):**

    wizard        → interactive terminal wizard, not suitable for message-based interaction
    init          → workspace initialization, one-time operator setup
    doctor        → diagnostic checks, operator maintenance only

### Core Bot Action Categories

**1. Task Discovery** — The bot helps users find tasks matching their skills by cross-referencing the user's skill tags (extracted from their GitHub profile via `pf-scout show`) against open tasks in the Task Node. When a user describes their expertise, the bot runs `pf-scout rerank` with a context lens tuned to the available task pool and returns ranked task recommendations.

**2. Contributor Lookup** — Direct profile retrieval using `pf-scout show` for individual cards and `pf-scout list` for filtered lists. Users can query by handle, tag, tier, or minimum alignment score. The bot formats the response as a compact card: name, alignment score, skill tags, activity recency, and PF contribution rank.

**3. Collaboration Matching** — For multi-step tasks requiring specific skill combinations, the bot uses `pf-scout prospect` to generate a scored pipeline and `pf-scout rerank` to sort candidates by context fit. `pf-scout seed postfiat` and `pf-scout seed github` populate the candidate pool from the PF leaderboard and GitHub organizations respectively.

**4. Network Intelligence** — The bot surfaces ecosystem-level signals using `pf-scout diff` (track contributor evolution over time), `pf-scout report` (formatted summaries from stored snapshots), and `pf-scout list --tier top` (surface top-tier contributors). These queries serve operators who need a pulse on network health and contributor activity trends.

**5. Onboarding Guidance** — New users receive a guided flow: the bot explains pf-scout's scoring model, prompts them to set their context via `pf-scout set-context`, and walks them through their first contributor search. Static response templates handle FAQ-style questions about the Post Fiat network, PFT earning mechanics, and task completion workflow.

### Architecture Diagram

```
Task Node UI (Agent Directory)
         | encrypted PFTL message
         v
pft-chatbot-mcp  (chain I/O layer)
         |
         v
Bot Message Router  (intent classification)
         |
    +----+----+
    v         v
Scout API  Context Engine
(port 8420)   (set-context / rerank)
    |
    v
pf-scout contacts.db
    |
    +-- GitHub signals
    +-- PF leaderboard signals
    +-- Enrichment pipeline (6h)
```

The Bot Message Router receives decrypted PFTL messages from pft-chatbot-mcp, classifies user intent using keyword matching and lightweight NLP, and dispatches to either the Scout API (for data queries) or the Context Engine (for context-aware re-ranking). The Scout API is a FastAPI server on port 8420 that wraps pf-scout CLI commands as HTTP endpoints. The Context Engine manages operator-defined scoring lenses and applies them via `pf-scout rerank` before returning results.

## 2. Integration Contract: Agent Bot ↔ Task Node Interface

### Message Format

All communication uses PFTL on-chain memos with the following JSON structure:

```
Request:
{
  "v": 1,
  "type": "scout_query",
  "session": "<wallet_address>:<nonce>",
  "query": "<natural language or structured>",
  "params": { "limit": 10, "tier": "top", "rubric": "b1e55ed" }
}

Response:
{
  "v": 1,
  "type": "scout_response",
  "session": "<session_id>",
  "result": "<formatted string, <=400 chars>",
  "truncated": false,
  "follow_up": "Reply 'more' for next page or '@handle' for full profile"
}
```

The `v` field is a protocol version integer. The `session` field binds request to response using the sender's XRPL r-address concatenated with a monotonically increasing nonce. The `params` object is optional; when omitted, defaults apply (limit=5, no tier filter, default rubric). The `result` field is always a formatted string capped at 400 characters to fit within PFTL memo size constraints. When results exceed this limit, `truncated` is set to true and `follow_up` provides pagination instructions.

### Authentication Flow

Wallet-based session binding eliminates the need for separate authentication tokens. The sender's XRPL r-address IS their session identity. The bot resolves the sender address on every inbound message and performs a lookup against the `contributor_authorization` table in the local database.

For basic queries (Contributor Lookup, Task Discovery), any wallet can send queries regardless of authorization state. For elevated queries that expose notes, relationship graphs, or signal detail, the sender's wallet must appear in `contributor_authorization` with state AUTHORIZED or TRUSTED.

Session state is tracked in-memory as a dictionary mapping sender r-address to their last query context. This enables follow-up queries like "tell me more" or "next page" without re-specifying parameters. Session state is not persisted to disk or database and resets on bot restart.

### Rate Limiting

Rate limits are enforced per wallet address using a sliding window counter:

    UNKNOWN tier:    10 queries/hour per wallet
    AUTHORIZED tier: 60 queries/hour per wallet
    TRUSTED tier:    unlimited

When a rate limit is hit, the bot responds with: "Scout rate limit reached. Resets in Xm. Earn AUTHORIZED status via Task Node contributions." The X value is computed from the oldest request in the sliding window.

### UI Integration

The bot registers in the Task Node Agent Directory as "PF Scout" with capability tags: `contributor-discovery`, `task-routing`, `network-intelligence`. Responses render inline in the existing message thread between the user and the bot. Profile results include links to full profiles on tasknode.postfiat.org where the contributor has a public page.

## 3. Data Flow Architecture: Scoring Heuristics to Real-Time Responses

### Scoring Heuristics

pf-scout scores contributors using YAML rubrics evaluated against collected signals. The scoring dimensions are:

**Alignment score (0-100):** Measures fit between a contributor's profile and the operator's stated context (set via `pf-scout set-context`). Computed as a weighted sum of skill overlap, domain relevance, and activity alignment. A score of 80+ indicates strong contextual fit.

**Sybil risk (low/medium/high):** Assessed from account age (GitHub account creation date), activity diversity (number of distinct repositories, languages, and organizations), and funding patterns (PFT transaction graph analysis). Accounts younger than 90 days with fewer than 3 repositories default to medium risk.

**Skill tags:** Extracted from GitHub repository topics, primary languages, bio keywords, and README content. Stored as a deduplicated list on the contact record. Updated on each `pf-scout update` run.

**Activity recency:** Signals are weighted using exponential decay. A commit from yesterday carries full weight; a commit from 30 days ago carries approximately 37% weight (decay constant tau=30 days). This ensures the bot surfaces actively contributing developers over dormant accounts.

**PF contribution score:** Derived from the Post Fiat leaderboard: task completion count, total PFT earned, current leaderboard rank, and streak length. Synced every 6 hours via the enrichment pipeline (`pf-scout seed postfiat`).

### Caching Strategy

The bot operates a three-tier caching architecture to balance response latency against data freshness:

**Hot cache (in-memory):** Stores the last 100 query results as serialized response objects. TTL is 5 minutes. Keyed by a hash of the normalized query parameters. Cache hits skip the Scout API entirely and return the pre-formatted response.

**Warm cache (SQLite via contacts.db):** Contains full contact profiles as written by pf-scout. The effective TTL equals the time since the last enrichment pipeline run, nominally 6 hours. All Scout API queries that miss the hot cache read from contacts.db.

**Cold path:** When a profile request targets a contact whose last update timestamp exceeds 6 hours, the bot triggers `pf-scout update <contact>` synchronously. This re-collects GitHub signals and re-scores the contact. To prevent abuse, cold path updates are throttled to one per contact per hour.

### Staleness Thresholds

    <1h since last update:   serve from cache, no refresh triggered
    1-6h since last update:  serve from cache, schedule background refresh via task queue
    >6h since last update:   refresh before responding (adds ~2s latency)
    Leaderboard rank:        always from last 6h enrichment run, no per-query refresh

When a synchronous refresh is triggered, the bot sends an interim response: "Refreshing profile..." followed by the full result once the update completes. The 2-second latency estimate assumes GitHub API response times under 1.5 seconds and local scoring computation under 500 milliseconds.

### Data Flow Diagram

```
Inbound PFTL message
       |
       v
Intent Classifier
  +-- search_query  -> POST /search  -> pf-scout list + filter
  +-- profile_lookup -> GET /profile -> pf-scout show + enrichment
  +-- collaboration -> POST /search (prospect mode) -> rerank by context fit
  +-- network_intel -> GET /list (top tier, recent signals)
  +-- onboarding   -> static response + set-context prompt
       |
       v
Cache Check (TTL 5min hot / 6h warm)
  +-- HIT  -> format + respond
  +-- MISS -> scout-api -> contacts.db -> respond + update cache
       |
       v
Response Formatter (LLM or template)
  +-- truncate to <=400 chars
       |
       v
pft-chatbot-mcp -> PFTL chain -> Task Node UI
```

The Intent Classifier maps natural language queries to one of five intent categories. Ambiguous queries default to `search_query`. The Response Formatter applies tier-appropriate field filtering (see Section 5) and truncates output to the 400-character PFTL memo limit. When results require pagination, the formatter sets `truncated: true` and appends follow-up instructions.

## 4. Worked Interaction Scenarios

### Scenario A: New User Onboarding — Task Discovery

**Step 1:** A new contributor sends their first message to PF Scout.

User message: "hi, I'm a TypeScript developer new to Post Fiat"

PFTL memo payload:
```
{
  "v": 1,
  "type": "scout_query",
  "session": "rNewUser123abc:1",
  "query": "hi, I'm a TypeScript developer new to Post Fiat",
  "params": {}
}
```

Intent classification: `onboarding`

Scout API call: None (static response path).

**Step 2:** Bot responds with onboarding guidance.

Bot response (≤400 chars):
"Welcome to Post Fiat! I'm PF Scout — I help you find tasks and collaborators. You mentioned TypeScript — great, there's demand for that here. To personalize your results, tell me more: what domains interest you? (e.g., DeFi tooling, CLI development, data viz). I'll use that as your scoring context."

PFTL memo payload:
```
{
  "v": 1,
  "type": "scout_response",
  "session": "rNewUser123abc:1",
  "result": "Welcome to Post Fiat! I'm PF Scout -- I help you find tasks and collaborators. You mentioned TypeScript -- great, there's demand for that here. To personalize your results, tell me more: what domains interest you? (e.g., DeFi tooling, CLI development, data viz). I'll use that as your scoring context.",
  "truncated": false,
  "follow_up": null
}
```

**Step 3:** User sets context.

User message: "I'm interested in CLI tooling and XRPL integrations"

The bot internally calls `pf-scout set-context "CLI tooling, XRPL integrations, TypeScript"` to configure the scoring lens for this session. Bot confirms: "Context set: CLI tooling + XRPL integrations. Now I'll score contributors and tasks through that lens."

**Step 4:** User asks for task recommendations.

User message: "what tasks should I work on?"

Scout API request:
```
POST /search
{
  "query": "TypeScript CLI XRPL",
  "context": "CLI tooling, XRPL integrations, TypeScript",
  "mode": "task_discovery",
  "limit": 3
}
```

Scout API response (abbreviated):
```
{
  "results": [
    {"task": "pf-scout CLI plugin system", "alignment": 92, "skills_match": ["typescript", "cli"]},
    {"task": "XRPL memo parser library", "alignment": 87, "skills_match": ["typescript", "xrpl"]},
    {"task": "Task Node API client SDK", "alignment": 81, "skills_match": ["typescript", "api"]}
  ]
}
```

**Step 5:** Bot responds with top 3 tasks.

Bot response (≤400 chars):
"Top tasks for your profile: 1) pf-scout CLI plugin system (92% fit) — TypeScript + CLI, right in your lane. 2) XRPL memo parser library (87% fit) — XRPL + TS. 3) Task Node API client SDK (81% fit) — API work in TS. Reply with a task number for details or 'more' for additional options."

### Scenario B: Experienced Operator — Collaboration Matching

**Step 1:** An experienced operator sends a collaboration query.

User message: "I need a collaborator for a Rust cryptography task on XRPL, preferably someone with >80 alignment score"

PFTL memo payload:
```
{
  "v": 1,
  "type": "scout_query",
  "session": "rOperatorXYZ789:42",
  "query": "collaborator for Rust cryptography task on XRPL, >80 alignment",
  "params": { "limit": 5, "min_alignment": 80, "rubric": "default" }
}
```

Intent classification: `collaboration`

**Step 2:** Bot dispatches to Scout API.

Scout API request:
```
POST /search
{
  "query": "Rust cryptography XRPL",
  "mode": "prospect",
  "min_alignment": 80,
  "limit": 5
}
```

This triggers `pf-scout prospect` internally, followed by `pf-scout rerank` against the operator's context.

Scout API response (abbreviated):
```
{
  "results": [
    {
      "handle": "rustcryptdev",
      "alignment": 94,
      "skills": ["rust", "cryptography", "xrpl", "ed25519"],
      "sybil_risk": "low",
      "pf_rank": 12,
      "last_active": "2026-03-17"
    },
    {
      "handle": "xrpl-sec-eng",
      "alignment": 86,
      "skills": ["rust", "tls", "xrpl", "secp256k1"],
      "sybil_risk": "low",
      "pf_rank": 31,
      "last_active": "2026-03-15"
    }
  ]
}
```

**Step 3:** Bot responds with top 2 matches.

Bot response (≤400 chars):
"Top matches for Rust + crypto + XRPL: 1) @rustcryptdev — 94% alignment, rank #12, skills: rust, cryptography, xrpl, ed25519. Active yesterday. Strong pick. 2) @xrpl-sec-eng — 86% alignment, rank #31, skills: rust, tls, xrpl, secp256k1. Active 3d ago. Reply '@handle' for full profile."

**Step 4:** Operator follows up.

User message: "@rustcryptdev — tell me more"

Scout API request:
```
GET /profile/rustcryptdev?include=relationships
```

Scout API response (abbreviated):
```
{
  "handle": "rustcryptdev",
  "alignment": 94,
  "skills": ["rust", "cryptography", "xrpl", "ed25519", "no-std"],
  "sybil_risk": "low",
  "pf_rank": 12,
  "pft_earned": 4200,
  "tasks_completed": 18,
  "github_repos": 34,
  "last_active": "2026-03-17",
  "related_contacts": ["xrpl-sec-eng", "pf-core-dev"],
  "notes": "Delivered XRPL signing library ahead of schedule. Reliable."
}
```

**Step 5:** Bot returns full profile (operator has AUTHORIZED or TRUSTED tier, so notes and relationships are visible).

Bot response (≤400 chars):
"@rustcryptdev: 94% alignment | Rank #12 | 4200 PFT earned | 18 tasks done | 34 GitHub repos. Skills: rust, cryptography, xrpl, ed25519, no-std. Note: 'Delivered XRPL signing library ahead of schedule. Reliable.' Connected to: @xrpl-sec-eng, @pf-core-dev. Last active: yesterday."

## 5. Privacy and Authorization Constraints

### Contributor Visibility Rules

The bot enforces field-level access control based on the sender's tier in the `contributor_authorization` table. The tier determines which fields appear in formatted responses:

```
Tier        | Can See                                  | Cannot See
------------|------------------------------------------|----------------------------------
UNKNOWN     | Public profiles, scores, tags            | Notes, relationships, signal detail
AUTHORIZED  | All of above + notes + relationships     | Internal audit fields
TRUSTED     | Full profile + signal history             | Nothing (full access)
SUSPENDED   | Own profile only                         | All other profiles
COOLDOWN    | Reduced access (same as UNKNOWN)         | Notes, relationships
```

### Sensitive State Handling

The bot never exposes raw authorization state strings in responses. When a SUSPENDED operator is queried, the bot responds: "This contributor is not currently active in the network." This phrasing is deliberately neutral — it does not reveal whether the contributor is suspended, departed, or simply inactive. The same response is used for nonexistent handles to prevent enumeration attacks.

COOLDOWN operators receive degraded responses identical to UNKNOWN-tier access. The bot does not mention cooldown status, duration, or reason. From the user's perspective, the response simply contains fewer fields.

When an UNKNOWN-tier user queries another UNKNOWN-tier contributor, the response contains only: handle, alignment score, skill tags, and activity recency. No notes, no relationship graph, no signal detail.

### Data the Bot NEVER Surfaces

Regardless of the requester's tier, the following data is never included in bot responses:

- Raw authorization state strings (SUSPENDED, UNKNOWN, COOLDOWN) — the bot uses neutral language instead
- Internal audit log entries — these exist for operator review only, stored append-only in the audit table
- Signal payload details — raw GitHub API responses and leaderboard raw score breakdowns are internal scoring inputs, not user-facing data
- Other users' session state or query history — the bot's in-memory session map is never queryable by any user

### Authorization Check at Query Time

Every inbound query triggers a four-step authorization check before any data is returned:

1. **Tier resolution:** Look up the sender's wallet address in `contributor_authorization`. If the wallet is not found, the sender defaults to UNKNOWN tier.

2. **Visibility determination:** Based on the resolved tier, compute the set of fields that may appear in the response. UNKNOWN sees public fields only. AUTHORIZED sees public fields plus notes and relationships. TRUSTED sees all fields including signal history.

3. **Field-level filtering:** Before the Response Formatter produces output, the raw Scout API response is passed through a field filter that strips any fields not permitted for the sender's tier. This filtering happens in the bot layer, not in the Scout API, ensuring the API itself remains a complete data source for operator use.

4. **Audit logging:** The query is appended to an audit trail with timestamp, sender address, resolved tier, intent classification, and response size. This log is append-only and never exposed via the bot interface. Only the operator can access audit logs through direct database queries.

### Privacy by Design

The bot architecture enforces several privacy invariants:

**No on-chain conversation history.** PFTL memos are transactional — each request-response pair is independent. The bot does not store or reconstruct conversation threads on-chain. The chain contains only the individual memos, not a session transcript.

**Ephemeral session state.** The in-memory session map (sender address to last query context) exists solely for follow-up query convenience. It is not persisted to SQLite, not written to disk, and is lost on bot restart. There is no mechanism to export or query session state.

**Private relationship notes.** Notes on contact records can be tagged with `privacy_tier=private` by the operator. These notes are visible only to TRUSTED-tier users. AUTHORIZED users see notes without the private tag; UNKNOWN users see no notes at all.

**External prospect isolation.** Contacts tagged `external-prospect` (imported via `pf-scout seed csv` or `pf-scout add` from outside the PF network) are never surfaced in responses to UNKNOWN-tier queries. This prevents information leakage about the operator's prospect pipeline to unauthenticated network participants.

---

*Specification version 1.0. Published 2026-03-18. Authored by b1e55ed for the Post Fiat Task Ledger.*
