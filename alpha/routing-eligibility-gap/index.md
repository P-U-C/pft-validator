---
layout: default
title: "Routing Eligibility Gap — Diagnosis and Remediation"
subtitle: "Why verified contributors stopped being routed Network Tasks after the Network Badges release, and a prioritized fix plan for the Task Node Core Product board"
date: 2026-06-26
category: alpha
status: draft
author: zoz (Project Leader, Post Fiat)
---


# Routing Eligibility Gap — Diagnosis and Remediation

**Board:** Task Node Core Product
**Originating task:** `task_cf1feb919c166eac4d494c6c9aa09107`
**Confirmed affected contributors:** @zoz, @goodalexander, @snakespartan
**Sources:** QA report `hiverep_7943da7e-3b3f-4d47-90f3-ca2d8e5b9eb2`, Executive report `hiverep_abe5eb3b-9c24-484b-bee5-44bc66827a40`, Development report `hiverep_8c4f49b7-29fb-4f71-bef9-31eda0487583`

---

## 1. Problem statement

Verified Project Leaders and core contributors stopped receiving Network Task routing after the Network Badges feature shipped, despite the system reporting them as eligible. The QA report (`hiverep_7943da7e`) confirms three contributors reporting ineligibility (@zoz, @goodalexander, @snakespartan); the Executive report (`hiverep_abe5eb3b`) records the specific Project-Leader complaints; the Development report (`hiverep_8c4f49b7`) documents the badge projection pipeline that sits between a contributor's on-chain/account state and the routing engine.

The defining symptom is **a contradiction between two subsystems that each claim to answer "is this contributor eligible to be routed?"** and never reconcile:

- The **Hive Chat / Account Live State** path reports `network_task_eligibility = available_for_routing`, with zero blocked gates. This is the answer contributors are given when they ask.
- The **routing engine's candidate filter** evaluates the **badge projection**, which for the same contributor reads as unfilled or unsanctioned (e.g. KOL *below threshold*, Core Contributor *not sanctioned*, Expert *needs tasks* — "1 verified routing badge recorded").

Because the routing engine gates on the second source and the contributor is only ever shown the first, an affected user is told "you are eligible, the board is just congested" while being silently excluded from every routing run. There is no surface that reveals the disagreement, so the issue is undiagnosable from the contributor side and presents as an unbounded "just wait."

## 2. Root-cause analysis

Three contributing factors, in order of routing impact:

### 2.1 Eligibility-filter logic gates on badge projection without a reconciliation against live state (PRIMARY)
The pre-badges routing engine treated account eligibility (diagnostic complete, wallet linked, capacity clear) as sufficient to enter the candidate pool. The badges release added a **badge-state predicate** to the candidate filter. A contributor whose badges are below-threshold or unsanctioned now fails the predicate and is dropped from routing — even when `available_for_routing` is true on the live-state record the chat reads. The two checks were never wired to the same source of truth, so they can (and do) disagree silently. This is the direct cause of zero-routing for otherwise-eligible contributors.

### 2.2 Badge projection refresh cycles lag the chain pointer (AMPLIFIER)
The Development report describes a projection pipeline: account/credential events → indexed badge projection → routing engine read. This projection is **cache-behind-pointer**, the same failure class already observed elsewhere on the platform — a contributor's personal task sat >24h at `submitted` with the explicit message *"the indexed projection has not caught up to the newest cached PFTL pointer."* The badge projection inherits this lag: a contributor can complete the action that should fill a badge (e.g. get added to the sanctioned Core Contributor list) and remain excluded from routing for as long as the projection is stale, with no visible ETA. Refresh cadence is not aligned to the routing engine's evaluation window, so a routing run can read a projection that is hours-to-days out of date.

### 2.3 No user-facing eligibility diagnostic (DETECTABILITY)
There is no UI or chat surface that tells a contributor *why* they are not being routed in terms of the predicate that actually gates routing. The only available answer comes from the live-state path, which reports `available_for_routing` and therefore actively misleads. An affected contributor cannot self-serve a diagnosis, cannot tell a transient projection lag from a permanent sanctioning gap, and cannot see which specific badge is blocking them. This converts a one-line fixable condition ("your GitHub handle is not on the sanctioned Core Contributor list") into multi-day back-and-forth in chat.

### 2.4 Corroborating evidence
- **Badge panel (direct observation):** KOL *below threshold* (1,534 / 5,000 followers), Core Contributor *not sanctioned* ("GitHub handle is not on the sanctioned Core Contributor list"), Expert *needs tasks* (0/25), "1 verified routing badge recorded" — yet Telegram/X/GitHub/Discord all show *Verified*. Identity verification is satisfied; **routing** badges are not, and routing reads the latter.
- **Operator workaround confirms the mechanism:** the proposed fix from @goodalexander — "I add you to postfiatorg and you get something up, that would mark you as core contributor" — is precisely flipping the Core Contributor badge from *not sanctioned* to *sanctioned*. That this is expected to restore routing confirms routing gates on the badge predicate.
- **Manual override confirms the engine is alive:** this very proposal task (`task_cf1feb919c166eac4d494c6c9aa09107`) was routed to an affected contributor only after operators forced it through. The engine routes; the badge filter was suppressing it.

## 3. Where the eligibility diagnostic should surface in the UI

1. **Tasks panel — inline eligibility chip.** Next to the (empty) routed-task list, render the contributor's *effective routing eligibility* computed from the **same predicate the routing engine uses**, not from live state. States: `eligible` / `filtered (reason)` / `pending projection refresh (as-of timestamp)`.
2. **Network Badges panel — "routing impact" annotation per badge.** Each badge already shows Verified/Below threshold/Not sanctioned; add whether that badge is *required for routing* and, if unmet, the exact unmet condition and the single action that resolves it.
3. **Hive Chat — read from the routing predicate.** The chat must answer eligibility questions from the routing-engine candidate check, including projection as-of time, rather than from `available_for_routing`. The current divergence is the core trap and must be closed at the source.

## 4. Proposed fixes, in priority order

| # | Fix | Addresses | Why prioritized |
|---|-----|-----------|-----------------|
| P0 | Make routing eligibility and reported eligibility read the **same predicate** (single source of truth); expose it via an eligibility-diagnostic endpoint. | §2.1, §2.3 | Stops the silent-exclusion-while-reported-eligible contradiction; everything else is observability on top. |
| P1 | Reconcile badge-projection refresh cadence with the routing engine's evaluation window; stamp every projection with an as-of/pointer height and refuse to gate on a stale projection past a threshold (or flag it). | §2.2 | Removes the cache-behind-pointer lag that strands contributors after they complete the unblocking action. |
| P2 | Surface the eligibility diagnostic in the Tasks panel and Network Badges panel (§3). | §2.3 | Converts multi-day chat loops into a one-line self-serve fix. |
| P3 | Distinguish identity-verification badges from routing-eligibility badges in both data model and UI, so "Telegram/X/GitHub Verified" is never mistaken for "routable." | §2.4 | Removes the conceptual trap that makes the bug invisible. |

## 5. Work breakdown structure

1. **WBS-1 — Eligibility diagnostic endpoint.** Add a read endpoint returning the active user's effective routing eligibility computed from the routing engine's own candidate predicate: overall `eligible|filtered|pending`, per-badge required/met/unmet-reason, and the badge-projection as-of timestamp + pointer height. Acceptance: for an affected contributor it returns `filtered` with the specific unmet badge condition while live-state still reads `available_for_routing` — demonstrating the divergence the endpoint exists to expose.

2. **WBS-2 — Reconcile badge-refresh cadence with routing evaluation window.** Instrument the badge projection with as-of/pointer-height metadata; align refresh to fire before (or invalidate) each routing evaluation; add a staleness guard so a routing run either refreshes or flags a projection older than a configured bound rather than silently gating on it. Acceptance: a badge that becomes sanctioned is reflected in routing within one refresh window, and staleness beyond the bound is observable.

3. **WBS-3 — Inline eligibility chip in the Tasks panel.** Render the WBS-1 result beside the routed-task list: `eligible` / `filtered (reason)` / `pending projection refresh (as-of …)`, with the single resolving action when filtered. Acceptance: an affected contributor sees the blocking reason without entering chat.

4. **WBS-4 — Routing-impact annotations in the Network Badges panel.** For each badge, show whether it is required for routing and the exact unmet condition + resolving action; visually separate identity-verification badges from routing-eligibility badges. Acceptance: the panel makes clear that "all identities Verified" ≠ "routable," and names the specific badge blocking routing.

5. **WBS-5 — Reconcile Hive Chat eligibility answers to the routing predicate.** Point the chat's eligibility responses at the WBS-1 predicate (including projection as-of time) instead of `available_for_routing`. Acceptance: asked "am I eligible," the chat returns the same verdict and reason as the Tasks panel — the two can no longer contradict.

6. **WBS-6 (validation) — Regression fixtures for the divergence cases.** Capture the three confirmed contributors' states as fixtures (eligible-but-filtered, stale-projection-pending, identity-verified-but-unsanctioned) so the single-source-of-truth and staleness guarantees are protected against regression. Acceptance: each fixture asserts reported eligibility == routing eligibility.

## 6. Scope and constraints

All proposed changes are implementable within the current Task Node product architecture: WBS-1/2/6 are server-side reconciliations of existing data (badge projection, routing candidate filter, live-state record); WBS-3/4/5 are read-only surfaces over WBS-1. No change to badge issuance rules, reward economics, or the routing policy itself is required — the goal is to make the *existing* policy consistent and legible, not to relax eligibility. The sanctioning decision for any individual contributor (e.g. adding a handle to the Core Contributor list) remains a core-team action and is out of scope; this proposal ensures that once such an action is taken it propagates to routing predictably and visibly.

---

*Diagnosis grounded in: QA report `hiverep_7943da7e-3b3f-4d47-90f3-ca2d8e5b9eb2`, Executive report `hiverep_abe5eb3b-9c24-484b-bee5-44bc66827a40`, Development report `hiverep_8c4f49b7-29fb-4f71-bef9-31eda0487583`, and direct observation of the Network Badges panel and projection-lag behavior for affected contributor @zoz.*
