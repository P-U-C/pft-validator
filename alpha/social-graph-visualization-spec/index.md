---
layout: default
title: "Lens Social Graph Visualization Specification"
date: 2026-04-10
category: network
status: submitted
task_id: 70980bb5-d436-4c38-b61d-eef9e4e9bc0a
---

# Lens Social Graph Visualization Specification

**Task ID:** `70980bb5-d436-4c38-b61d-eef9e4e9bc0a`  
**Reward:** 2,800 PFT  
**Verification:** URL  
**Date:** 2026-04-10

This document is a deterministic public rendering contract for Lens social-graph output, not a product concept, and every visible state is derived only from auditable public chain data.

This specification defines a public visualization layer for the Post Fiat task network's on-chain social graph. It turns raw transaction data into auditable, interactive relationship maps -- showing who collaborates with whom, where trust concentrates, where risk accumulates, and where value flows.

**What this is:** A frontend specification grounded in real indexed chain data (53 accounts, 885 transactions, 105 interaction edges, 2 sybil clusters) from the live PFTL network. Every example in this spec maps to actual data in the Lens chain index.

**What this is not:** A mockup divorced from reality. The data model, edge taxonomy, and example JSON blocks are all derived from the production Lens indexer running against the PFTL testnet.

**Data source principle:** Public signals only. All visualized data is derived from on-chain transactions -- no private roadmap, no decrypted message content, no self-reported profiles. This ensures the graph is reproducible by any reviewer, safe for external audit, and suitable for cross-operator fairness analysis.

---

## 1. Purpose and Canonical Input Surface

### Purpose

Provide a deterministic, non-interactive rendering of the PFTL social graph that any auditor can reproduce from the same chain-index data. The visualization encodes node importance, edge strength, risk signals, and privacy constraints into a fixed set of visual rules with no ambiguity.

### Canonical Input Surface

All data enters the visualization through a single API surface backed by the Lens chain index (`chain-index.db`). The following endpoints constitute the complete input contract:

| Endpoint | Returns | Used By |
|----------|---------|---------|
| `GET /chain/list` | Account list with activity metrics | Node generation |
| `GET /chain/edges` | Pairwise interaction edges | Edge generation |
| `GET /chain/richlist` | Accounts sorted by PFT balance | Node sizing (wealth) |
| `GET /chain/profile/{address}` | Single-account detail | Contributor detail view |
| `GET /chain/stats` | Aggregate network statistics | Metrics dashboard |
| `GET /chain/sybil` | Sybil cluster membership and evidence | Risk overlays |
| `GET /chain/infra` | Infrastructure-labeled wallets | Node type classification |
| `GET /chain/labels` | User-applied and system-applied wallet labels | Display names |

No other data source is permitted. If a field is not available from these endpoints, it is not rendered.

---

## 2. Target Audience and Audit Use Cases

### Primary Audiences

| Audience | Use Case | Key View |
|----------|----------|----------|
| **Network operators** | Monitor contributor health, detect sybil clusters, identify bus-factor risks | Global graph + risk hotspot overlay |
| **Task issuers** | Find active contributors, assess collaboration history before assigning work | Contributor detail + relationship strength |
| **Contributors** | Understand their network position, see reputation, discover collaboration opportunities | Ego-network view |
| **Reviewers/auditors** | Verify payout decisions, audit concentration, check for collusion | Subgraph isolation + edge-weight analysis |
| **New participants** | Understand the network landscape before joining | Overview + rich list + activity heatmap |

### Core Audit Use Cases

1. **"Who is the most connected contributor?"** -- Degree centrality ranking with visual node sizing
2. **"Are these wallets controlled by the same person?"** -- Sybil cluster highlighting with evidence overlay
3. **"Where does value concentrate?"** -- PFT flow visualization with edge-weight encoding
4. **"Who should I collaborate with?"** -- Ego-network expansion showing 2nd-degree connections
5. **"Is this network healthy?"** -- Dashboard view: concentration index, diversity metrics, growth trends
6. **"What breaks if this node disappears?"** -- Bus-factor counterfactual removal panel
7. **"Which edges carry trust vs. which carry only value?"** -- Trust/flow edge distinction overlay

---

## 3. Public-Safe Entity Taxonomy

### Node Types

| Type | Visual | Size Encoding | Color Encoding | Data Source |
|------|--------|---------------|----------------|-------------|
| **Contributor** | Circle | Memo transaction count (activity) | Activity score (green=high, gray=low) | `accounts.memo_tx_count` |
| **Infrastructure** | Diamond | Balance (PFT holdings) | Fixed: blue | `wallet_labels.label_type = 'infrastructure'` |
| **Sybil-flagged** | Circle with warning border | Same as contributor | Red border, 2px dashed | `sybil_clusters` table |
| **Bot/Agent** | Hexagon | Memo count | Purple | `wallet_labels.label_type = 'bot'` |

### Node Properties (from chain-index.db)

```json
{
  "id": "rsS2Y6CK9dz9dVFjJvRyD2gBdoLPqjaXRZ",
  "type": "contributor",
  "label": null,
  "metrics": {
    "tx_count": 101,
    "memo_tx_count": 101,
    "peer_count": 9,
    "balance_pft": 641243.09,
    "activity_score": 0.3313,
    "first_seen": "2026-03-14T12:00:00Z",
    "last_seen": "2026-04-10T01:30:00Z"
  },
  "sybil": {
    "flagged": false,
    "cluster_id": null,
    "confidence": null
  },
  "display": {
    "short_address": "rsS2Y6...jaXRZ",
    "user_label": null,
    "size": 28,
    "color": "#4CAF50"
  }
}
```

### Edge Types

| Type | Visual | Weight Encoding | Color | Detection Signal |
|------|--------|----------------|-------|------------------|
| **Memo exchange** | Solid line | memo_tx_count (thickness) | Gray to blue (by frequency) | `edges.memo_tx_count > 0` |
| **Value transfer** | Solid line with arrow | total_amount_drops | Green (by amount) | `edges.total_amount_drops > 0` |
| **Sybil link** | Dashed red line | Confidence score | Red (intensity = confidence) | `sybil_clusters` membership |
| **Infrastructure flow** | Dotted line | Transaction count | Blue, semi-transparent | Source or dest is infrastructure |

### Trust vs Flow Edge Distinction

Every edge is further classified by the co-occurrence of trust signals and value signals:

| Classification | Definition | Visual Modifier |
|----------------|-----------|-----------------|
| **FLOW_WITHOUT_TRUST** | Value transfer exists but fewer than 3 memo exchanges | Green arrow, no trust underline |
| **TRUST_WITHOUT_VALUE** | 3+ memo exchanges but zero PFT transferred | Blue line, no arrow |
| **TRUST_PLUS_VALUE** | 3+ memo exchanges AND non-zero PFT transferred | Green arrow with blue underline |

These classifications are derived mechanically from `edges.memo_tx_count` and `edges.total_amount_drops`. No manual labeling is involved.

### Edge Properties

```json
{
  "source": "rsS2Y6CK9dz9dVFjJvRyD2gBdoLPqjaXRZ",
  "target": "rwdm72S9YVKkZjeADKU2bbUMuY4vPnSfH7",
  "type": "memo_exchange",
  "trust_flow_class": "TRUST_WITHOUT_VALUE",
  "metrics": {
    "tx_count": 25,
    "memo_tx_count": 23,
    "total_amount_pft": 0,
    "first_interaction": "2026-03-14T12:00:00Z",
    "last_interaction": "2026-04-09T18:00:00Z"
  },
  "display": {
    "width": 4.6,
    "color": "#2196F3",
    "opacity": 0.8,
    "label": "23 memos"
  }
}
```

### Edge Weight Scale

Based on real network data (edge memo counts range 1-23, mean 2.3):

| Memo Count | Visual Width | Relationship Strength |
|------------|-------------|----------------------|
| 1 | 1px | Acquaintance |
| 2-5 | 2px | Working relationship |
| 6-10 | 3px | Regular collaborator |
| 11-20 | 4px | Strong bond |
| 21+ | 5px | Core partnership |

### Risk Badge Taxonomy

Every node may carry zero or more risk badges. Badges are computed deterministically from chain data and graph metrics.

| Badge | Trigger Condition | Visual |
|-------|-------------------|--------|
| **HUB** | Degree centrality in top 10% of active nodes | Blue ring |
| **BRIDGE** | Betweenness centrality in top 10% of active nodes | Orange ring |
| **WHALE_FLOW** | Participant in at least one edge above the 95th percentile by amount | Green diamond icon |
| **BUS_FACTOR_1** | Removing node increases connected components by >=2 or disconnects >=15% of nodes | Red exclamation |
| **ORPHAN** | Zero edges in the selected time window | Gray dashed border |
| **LOW_CONF** | Confidence score < 0.50 on any associated sybil or identity signal | Muted gray fill |
| **SYBIL_REVIEW** | Member of a sybil cluster with confidence >= 0.50 | Red dashed border |
| **INFRA** | System-labeled infrastructure wallet | Blue diamond shape (replaces circle) |

A node may carry multiple badges simultaneously (e.g., HUB + BUS_FACTOR_1). Badge icons are rendered clockwise around the node starting from the top-right.

---

## 4. Three Required Views

### View 1: Global Network Overview

**Purpose:** Bird's-eye view of the entire PFTL social graph. First thing a viewer sees.

```
+-----------------------------------------------------------+
|  Lens Network Graph              [7d] [30d] [All]  Search |
|                                                           |
|                    <> Task Node                           |
|                   /||\                                    |
|                  / || \                                   |
|                 /  ||  \                                  |
|              o--o  ||  o--o                               |
|             /   \  ||  /   \                              |
|            o     o || o     o                             |
|                    ||                                     |
|              [H] Lens Bot                                 |
|                                                           |
|  +----------+  +----------+  +----------+                 |
|  |Nodes: 21 |  |Edges: 105|  |Clusters:2|                 |
|  |Active    |  |Memo: 626 |  |Sybil     |                 |
|  +----------+  +----------+  +----------+                 |
|                                                           |
|  [Rich List] [Risk Hotspot Report] [Activity Heatmap]     |
+-----------------------------------------------------------+
```

**Layout:** Cytoscape.js with `cose-bilkent` layout (force-directed with compound node support). Infrastructure nodes pinned to center. Contributor nodes orbit based on interaction frequency with the hub.

**Interactions:**
- **Hover node:** Tooltip with address, balance, activity score, peer count, risk badges
- **Click node:** Expand to ego-network view (View 2)
- **Hover edge:** Show memo count, total PFT transferred, relationship duration, trust/flow class
- **Time slider:** Filter edges by time window (7d / 30d / all-time)
- **Zoom:** Scroll to zoom. Double-click to focus on subgraph.
- **Risk badge toggle:** Overlay/hide risk badge highlighting per badge type

**Color Legend:**
- Green nodes: high activity (score > 0.5)
- Gray nodes: low activity (score < 0.2)
- Blue diamonds: infrastructure
- Red dashed border: sybil-flagged
- Edge thickness: relationship strength (memo count)
- Edge color: gray (memos only) to green (value transfer)

**Metrics Dashboard:**

Alongside the graph, a metrics panel provides at-a-glance network health:

| Metric | Source | Visualization |
|--------|--------|--------------|
| Active wallets (7d/30d) | `accounts` table | Trend line |
| Memo velocity (memos/day) | `transactions` table | Sparkline |
| HHI concentration | Computed from edge weights | Gauge (0-1) |
| Top contributor share | Max(memo_count) / total memos | Percentage bar |
| Sybil cluster count | `sybil_clusters` table | Badge counter |
| Network diameter | Longest shortest path | Number |
| Clustering coefficient | Triangle count / possible triangles | Number (0-1) |
| Rich list top-5 | `accounts.balance_drops` | Mini leaderboard |

### View 2: Ego-Network / Contributor Detail

**Purpose:** Deep-dive into a single contributor's network position and relationships.

```
+-----------------------------------------------------------+
|  <- Back to Overview                                       |
|                                                           |
|  rsS2Y6CK...jaXRZ                                        |
|  +-----------------------------------------+              |
|  | Balance: 641,243 PFT                   |              |
|  | Activity Score: 0.33                   |              |
|  | Memos: 101  |  Peers: 9               |              |
|  | First seen: 2026-03-14                 |              |
|  | Sybil: Clean                           |              |
|  | Badges: (none)                         |              |
|  | Trust/Flow: 7 TRUST_WITHOUT_VALUE,     |              |
|  |             2 TRUST_PLUS_VALUE          |              |
|  +-----------------------------------------+              |
|                                                           |
|              o---- 23 memos ----<> Task Node              |
|             /                                             |
|  rsS2Y6CK o---- 10 memos ----o rH3dfGif                  |
|             \                                             |
|              o---- 4 memos ----o rsqZiJ6v                 |
|                                                           |
|  +-----------------------------------------+              |
|  | Top Peers            Memo  PFT   Class  |              |
|  | 1. rwdm72S9 (hub)    23    0     TRUST  |              |
|  | 2. rH3dfGif           10    0     TRUST  |              |
|  | 3. rsqZiJ6v            4    0     TRUST  |              |
|  +-----------------------------------------+              |
|                                                           |
|  Activity Timeline ----------------------------           |
|  Mar 14 |||||  Mar 28 |||||  Apr 10 |||                   |
|                                                           |
|  [View Full Transaction History]  [Compare Wallets]       |
+-----------------------------------------------------------+
```

**Layout:** Concentric layout with the selected node at center. 1st-degree connections in inner ring, 2nd-degree in outer ring.

**Interactions:**
- **Click peer:** Navigate to their ego-network
- **Activity timeline:** Sparkline showing daily memo activity
- **Compare wallets:** Side-by-side comparison of two contributors

### View 3: Risk Hotspot Inspector

**Purpose:** Isolate and examine risk concentrations across three modes: sybil detection, flow concentration, and bus-factor fragility.

The Risk Hotspot Inspector presents three tabs. Each tab renders a filtered subgraph with its own analysis panel.

#### Tab 1: Sybil Mode

Isolate and examine flagged sybil clusters with evidence breakdown.

```
+-----------------------------------------------------------+
|  Risk Hotspot Inspector    [Sybil] [Concentration] [Bus]  |
|                                                           |
|  Sybil Cluster: sybil_001                                 |
|  Confidence: 100%  |  Members: 3  |  Signals: 2          |
|                                                           |
|     o---------o                                           |
|      \       /                                            |
|       \     /   (amount_fingerprint +                     |
|        \   /     counterparty_overlap)                    |
|         o o                                               |
|                                                           |
|  +-----------------------------------------+              |
|  | Evidence Breakdown                      |              |
|  |                                         |              |
|  | Signal              Score  Pairs        |              |
|  | amount_fingerprint   0.60  3            |              |
|  | counterparty_overlap 0.65  1            |              |
|  |                                         |              |
|  | Shared Counterparties:                  |              |
|  |   rsVf8gQu, rJLXZVdG, rwdm72S9        |              |
|  |                                         |              |
|  | Matching Amounts:                       |              |
|  |   12,500,000 drops -> same dest x3     |              |
|  +-----------------------------------------+              |
|                                                           |
|  Status: SYBIL_REVIEW (confidence >= 0.50)                |
+-----------------------------------------------------------+
```

#### Tab 2: Concentration Mode

Identify nodes and edges where flow or influence is disproportionately concentrated.

```
+-----------------------------------------------------------+
|  Risk Hotspot Inspector    [Sybil] [Concentration] [Bus]  |
|                                                           |
|  Concentration Alerts                                     |
|                                                           |
|  +-----------------------------------------+              |
|  | High Inbound Share                      |              |
|  | rwdm72S9: receives 48% of all memos    |              |
|  | rGBKxoTc: receives 22% of all memos    |              |
|  +-----------------------------------------+              |
|                                                           |
|  +-----------------------------------------+              |
|  | Dominant Counterparty Pairs             |              |
|  | rsS2Y6CK -> rwdm72S9: 23 of 101 memos |              |
|  |   (23% of rsS2Y6CK outbound)           |              |
|  +-----------------------------------------+              |
|                                                           |
|  +-----------------------------------------+              |
|  | Top-3 Control Check                     |              |
|  | Top 3 nodes control 62% of weighted     |              |
|  | flow -> CONCENTRATION ALERT             |              |
|  +-----------------------------------------+              |
+-----------------------------------------------------------+
```

**Concentration alert** fires when the top 3 nodes by weighted degree control more than 50% of total weighted flow in the selected time window.

#### Tab 3: Bus-Factor Mode

Identify nodes whose removal would fragment the network graph.

```
+-----------------------------------------------------------+
|  Risk Hotspot Inspector    [Sybil] [Concentration] [Bus]  |
|                                                           |
|  Bus-Factor Analysis                                      |
|                                                           |
|  +-----------------------------------------+              |
|  | Fragility-Ranked Nodes                  |              |
|  |                                         |              |
|  | Node        Components  Disconnected    |              |
|  |             +delta      nodes           |              |
|  | rwdm72S9    +4          12 (57%)        |              |
|  | rGBKxoTc    +2          6 (29%)         |              |
|  +-----------------------------------------+              |
|                                                           |
|  Counterfactual Removal Panel: rwdm72S9                   |
|  +-----------------------------------------+              |
|  | Metric          Before    After         |              |
|  | Components      1         5             |              |
|  | Disconnected    0         12            |              |
|  | Avg path len    2.3       4.7           |              |
|  | Largest comp    21        9             |              |
|  +-----------------------------------------+              |
|                                                           |
|  Badge: BUS_FACTOR_1 assigned to rwdm72S9, rGBKxoTc      |
+-----------------------------------------------------------+
```

**Counterfactual removal panel** displays for any node with the BUS_FACTOR_1 badge:
- Connected components before and after removal
- Count of disconnected nodes after removal
- Change in average shortest path length
- Size of largest remaining component

---

## 5. Deterministic Visual Encoding Rules

### Threshold Definitions

All thresholds are computed from the current dataset in the selected time window. There are no manually tuned constants -- only percentile-based or structural definitions.

| Metric | Threshold | Badge or State |
|--------|-----------|---------------|
| **Hotspot** | Top 10% of active nodes by betweenness centrality OR degree centrality | HUB or BRIDGE badge |
| **Whale flow** | Edge amount (total_amount_drops) above the 95th percentile of all edges with non-zero amount | WHALE_FLOW badge on both endpoints |
| **Bus-factor** | Removing the node increases the number of connected components by >= 2, OR disconnects >= 15% of all nodes | BUS_FACTOR_1 badge |
| **Orphan** | Zero edges in the selected time window | ORPHAN badge |
| **Concentration alert** | Top 3 nodes by weighted degree control > 50% of total weighted flow | Displayed in Concentration tab; no per-node badge |

### Render Precedence

When multiple visual rules apply to the same node or edge, the following precedence determines which rule wins (highest priority first):

1. **Privacy redaction** -- if data must be hidden, it is hidden regardless of all other rules
2. **Data confidence** -- low-confidence overrides (muted gray, LOW_CONF badge) take priority over type-based styling
3. **Node/edge type** -- contributor, infrastructure, sybil-flagged, bot shapes and base colors
4. **Risk badges** -- HUB, BRIDGE, WHALE_FLOW, BUS_FACTOR_1, ORPHAN, SYBIL_REVIEW, INFRA rings and icons
5. **Selection/highlight** -- the currently selected or hovered node/edge gets a bright outline
6. **Search/filter dimming** -- unmatched nodes during search or filter are dimmed to 20% opacity

When a node carries multiple risk badges of equal priority, all badges are rendered (clockwise icon placement). When a node's type style and badge style conflict on the same visual channel (e.g., both set border color), the badge wins.

### Node Sizing

```
size = clamp(10, memo_tx_count / 5, 50)
```

### Edge Width

```
width = clamp(1, memo_tx_count / 5, 5)
```

### Color Functions

```
activityColor(score):
  score > 0.5  -> #4CAF50 (green)
  score > 0.2  -> #FFC107 (amber)
  otherwise    -> #9E9E9E (gray)
```

---

## 6. View-State and Interaction Matrix

This table defines every entity/condition combination and its deterministic rendered output. Implementations must handle all rows.

| Entity | Condition | Rendered State | Badge | Tooltip | Click Result |
|--------|-----------|---------------|-------|---------|--------------|
| Contributor | Active (activity_score > 0.2) | Green or amber circle, size by memo count | Per computed badges | Address, balance, score, peer count, badges | Navigate to View 2 ego-network |
| Contributor | Inactive (activity_score <= 0.2, edges > 0) | Gray circle, size by memo count | Per computed badges | Address, balance, score, last active date | Navigate to View 2 ego-network |
| Infrastructure node | Any | Blue diamond, size by balance | INFRA | Address, label, balance, connected node count | Navigate to View 2 centered on infra node |
| Sybil-flagged | Confidence < 0.50 | Muted gray circle, dashed border | LOW_CONF + SYBIL_REVIEW | Address, cluster ID, confidence, "low confidence" | Navigate to View 3 Sybil tab filtered to cluster |
| Sybil-flagged | Confidence >= 0.50 | Red dashed border circle | SYBIL_REVIEW | Address, cluster ID, confidence, signal summary | Navigate to View 3 Sybil tab filtered to cluster |
| High-centrality node | Top 10% by degree | Normal type styling + blue ring | HUB | Address, degree rank, "hub node" | Navigate to View 2 ego-network |
| High-centrality node | Top 10% by betweenness | Normal type styling + orange ring | BRIDGE | Address, betweenness rank, "bridge node" | Navigate to View 2 ego-network |
| Bus-factor chokepoint | Removal fragments graph per threshold | Normal type styling + red exclamation | BUS_FACTOR_1 | Address, components delta, disconnected count | Navigate to View 3 Bus-Factor tab with removal panel |
| Orphan node | Zero edges in window | Gray circle, dashed border, dimmed | ORPHAN | Address, balance, "no activity in window" | Navigate to View 2 (empty ego-network) |
| Memo edge | memo_tx_count > 0, amount = 0 | Solid gray-to-blue line, width by count | -- | Memo count, first/last interaction, class: TRUST_WITHOUT_VALUE or FLOW_WITHOUT_TRUST | Highlight both endpoints |
| Value edge | total_amount_drops > 0 | Solid green line with arrow | -- | Amount, memo count, class: TRUST_PLUS_VALUE or FLOW_WITHOUT_TRUST | Highlight both endpoints |
| Infrastructure edge | One endpoint is infra | Dotted blue line, semi-transparent | -- | Transaction count, infra label | Highlight both endpoints |
| Low-confidence edge | Linked to LOW_CONF node | Dotted line, muted gray, no badge | -- | "Low confidence -- insufficient evidence" | Highlight both endpoints |
| Empty filter result | Filter/search yields zero matches | "No matching nodes" message in graph area | -- | -- | Clear filter button |
| Missing profile data | Address exists but label/metrics incomplete | Truncated address only, gray circle, minimum size | -- | Address, "incomplete data" | Navigate to View 2 with partial data |
| Backend error | API endpoint returns error | "Data unavailable" overlay on affected panel | -- | -- | Retry button |

---

## 7. Privacy, Redaction, and Low-Confidence Rules

### Public-Data-Only Rules

| Data | Visible | Justification |
|------|---------|---------------|
| Wallet addresses | Yes (truncated by default, full on click) | On-chain, public |
| Transaction counts | Yes | On-chain, public |
| Memo counts | Yes | On-chain, public |
| PFT balances | Yes | On-chain, public |
| Transfer amounts | Yes | On-chain, public |
| Interaction timestamps | Yes | On-chain, public |
| Message content | **NO** | Encrypted, private |
| Task descriptions | **NO** | Encrypted, private |
| IP addresses | **NO** | Not on-chain |
| Real-world identity | **NO** | Not on-chain |

### User-Applied Labels

- Labels applied via `/tag` are public and visible to all viewers
- Infrastructure labels (system-applied) cannot be overwritten by users
- Users can label their OWN wallet with a display name

### Low-Confidence Rendering Rules

These rules govern how uncertain or incomplete data is displayed. They take priority over type-based styling per the render precedence order.

| Condition | Rendered State |
|-----------|---------------|
| Confidence score < 0.50 on any signal | Muted gray fill, LOW_CONF badge applied |
| Missing label (no user-set or system-set label) | Truncated address only (e.g., "rsS2Y6...jaXRZ") |
| Incomplete evidence (sybil cluster with only 1 signal) | Dotted edge between cluster members, no SYBIL_REVIEW badge |
| Fewer than 2 confirmed edges in the selected time window | Tooltip displays "insufficient public evidence" |
| Wallet proximity pattern (shared funding source, similar creation time) | NEVER infer identity from wallet proximity alone; no visual link unless explicit sybil signal exists |

### Privacy Redaction Precedence

Privacy redaction is the highest-priority rendering rule. If any of the following conditions hold, the corresponding data is suppressed regardless of other visual rules:

- Encrypted memo content is never decoded or displayed, even if the decryption key is available to the viewer
- No per-wallet activity timing is exposed outside of View 2 (aggregate network timing only in View 1)
- No cross-referencing with off-chain identity databases

### Abuse Prevention

| Risk | Mitigation |
|------|-----------|
| Doxxing via graph analysis | No real-world identity data. Wallet addresses are already public on-chain. |
| Sybil false positives | Sybil clusters show confidence scores + evidence signals. Low-confidence clusters are visually muted and carry no actionable badge. |
| Stalking via activity patterns | Per-wallet timeline only visible in View 2 contributor detail. Aggregate network patterns only in View 1. |
| Gaming the graph (fake relationships) | Each memo transaction costs gas + minimum PFT. Economic cost prevents spam edges. |

---

## 8. Worked JSON-to-UI Example

### Input: Lens Chain API Response

```json
GET /chain/list?limit=5

[
  {"address": "rwdm72S9...", "tx_count": 301, "memo_tx_count": 293, "peer_count": 6, "activity_score": 0.76, "sybil_flagged": false},
  {"address": "rsS2Y6CK...", "tx_count": 101, "memo_tx_count": 101, "peer_count": 9, "activity_score": 0.33, "sybil_flagged": false},
  {"address": "rGBKxoTc...", "tx_count": 106, "memo_tx_count": 59, "peer_count": 33, "activity_score": 0.44, "sybil_flagged": true},
  {"address": "rnmLkDT2...", "tx_count": 33, "memo_tx_count": 26, "peer_count": 4, "activity_score": 0.10, "sybil_flagged": false},
  {"address": "rKt4peDo...", "tx_count": 57, "memo_tx_count": 25, "peer_count": 26, "activity_score": 0.32, "sybil_flagged": true}
]
```

### Transform: JSON to Cytoscape Elements

```javascript
function apiToCytoscape(wallets, edges) {
  return {
    elements: {
      nodes: wallets.map(w => ({
        data: {
          id: w.address,
          label: w.label || w.address.substring(0, 8) + '...',
          type: w.sybil_flagged ? 'sybil' : 'contributor',
          size: Math.max(10, Math.min(50, w.memo_tx_count / 5)),
          color: activityColor(w.activity_score),
          ...w,
        },
        classes: [
          w.sybil_flagged ? 'sybil' : 'clean',
          w.activity_score > 0.5 ? 'active' : 'inactive',
        ].join(' '),
      })),
      edges: edges.map(e => ({
        data: {
          id: `e_${e.from_address.substring(0, 6)}_${e.to_address.substring(0, 6)}`,
          source: e.from_address,
          target: e.to_address,
          weight: Math.max(1, e.memo_tx_count / 5),
          memo_count: e.memo_tx_count,
          amount_pft: parseInt(e.total_amount_drops || '0') / 1e6,
          trust_flow_class: classifyTrustFlow(e),
        },
        classes: e.memo_tx_count > 10 ? 'strong' : 'weak',
      })),
    },
  };
}

function activityColor(score) {
  if (score > 0.5) return '#4CAF50';  // Green
  if (score > 0.2) return '#FFC107';  // Amber
  return '#9E9E9E';                    // Gray
}

function classifyTrustFlow(edge) {
  const hasTrust = edge.memo_tx_count >= 3;
  const hasValue = parseInt(edge.total_amount_drops || '0') > 0;
  if (hasTrust && hasValue) return 'TRUST_PLUS_VALUE';
  if (hasTrust) return 'TRUST_WITHOUT_VALUE';
  if (hasValue) return 'FLOW_WITHOUT_TRUST';
  return 'TRUST_WITHOUT_VALUE'; // memo-only edges with <3 memos still render as trust-class
}
```

### Rendered State: Cytoscape Stylesheet

```javascript
const style = [
  { selector: 'node',
    style: {
      'label': 'data(label)',
      'width': 'data(size)',
      'height': 'data(size)',
      'background-color': 'data(color)',
      'font-size': '10px',
      'text-valign': 'bottom',
    }},
  { selector: 'node.sybil',
    style: {
      'border-width': 2,
      'border-color': '#F44336',
      'border-style': 'dashed',
    }},
  { selector: 'node[type="infrastructure"]',
    style: {
      'shape': 'diamond',
      'background-color': '#2196F3',
    }},
  { selector: 'node.orphan',
    style: {
      'border-width': 1,
      'border-color': '#9E9E9E',
      'border-style': 'dashed',
      'opacity': 0.5,
    }},
  { selector: 'node.low-conf',
    style: {
      'background-color': '#BDBDBD',
      'opacity': 0.6,
    }},
  { selector: 'node.dimmed',
    style: {
      'opacity': 0.2,
    }},
  { selector: 'edge',
    style: {
      'width': 'data(weight)',
      'line-color': '#BDBDBD',
      'curve-style': 'bezier',
      'opacity': 0.6,
    }},
  { selector: 'edge.strong',
    style: {
      'line-color': '#2196F3',
      'opacity': 0.9,
    }},
  { selector: 'edge[amount_pft > 0]',
    style: {
      'line-color': '#4CAF50',
      'target-arrow-shape': 'triangle',
      'target-arrow-color': '#4CAF50',
    }},
  { selector: 'edge.low-confidence',
    style: {
      'line-style': 'dotted',
      'line-color': '#BDBDBD',
      'opacity': 0.4,
    }},
];
```

### Graph Data Format

Cytoscape.js and Sigma.js both consume a standard elements format:

```json
{
  "elements": {
    "nodes": [
      {
        "data": {
          "id": "rsS2Y6CK9dz9dVFjJvRyD2gBdoLPqjaXRZ",
          "label": "rsS2Y6...jaXRZ",
          "type": "contributor",
          "memo_count": 101,
          "balance_pft": 641243,
          "activity_score": 0.33,
          "peer_count": 9,
          "sybil_flagged": false,
          "badges": []
        },
        "classes": "contributor active"
      }
    ],
    "edges": [
      {
        "data": {
          "id": "e_rsS2Y6_rwdm72",
          "source": "rsS2Y6CK9dz9dVFjJvRyD2gBdoLPqjaXRZ",
          "target": "rwdm72S9YVKkZjeADKU2bbUMuY4vPnSfH7",
          "type": "memo_exchange",
          "trust_flow_class": "TRUST_WITHOUT_VALUE",
          "memo_count": 23,
          "amount_pft": 0,
          "weight": 4.6
        },
        "classes": "memo strong"
      }
    ]
  }
}
```

### Result

The 5-wallet API response transforms into a Cytoscape graph where:
- rwdm72S9 renders as a large green node (high activity) at the center
- rsS2Y6CK renders as a medium amber node (activity 0.33)
- rGBKxoTc renders with a red dashed border (sybil-flagged, SYBIL_REVIEW badge)
- rnmLkDT2 renders as a small gray node (low activity, score 0.10)
- Edges between them vary in thickness (1-5px based on memo count)
- Value-transfer edges get green arrows and FLOW_WITHOUT_TRUST or TRUST_PLUS_VALUE classification
- If rwdm72S9 is in the top 10% by degree, it also receives a HUB badge (blue ring)

---

## 9. Non-Goals and Implementation Notes

### Non-Goals

The following are explicitly out of scope for this specification:

- **Product features**: This spec defines rendering rules, not user flows or monetization
- **Identity resolution**: The visualization never infers real-world identity from on-chain data
- **Moderation actions**: The UI displays state but does not provide action buttons for moderation (e.g., no "mark as false positive" or "escalate" controls)
- **Decrypted content display**: Memo content is never shown, even when decryption keys are available
- **3D rendering**: Optional 3D exploration views are not part of the core specification

### Technology Stack Recommendation

#### Frontend

| Layer | Tool | Rationale |
|-------|------|-----------|
| **Graph rendering** | Cytoscape.js | Best balance of features, performance, and graph analytics. Handles 500+ nodes. Built-in layouts (cose-bilkent, concentric, breadthfirst). |
| **Large-scale fallback** | Sigma.js v3 | WebGL-powered for 5,000+ node views. Use for "zoomed out" network overview when node count exceeds Cytoscape comfort zone. |
| **Charts/heatmaps** | Observable Plot or Chart.js | Activity timelines, heatmaps, distribution charts. Lightweight. |
| **Framework** | React + TypeScript | Component architecture for view switching, state management, filter controls. |

#### Backend

| Layer | Tool | Rationale |
|-------|------|-----------|
| **Data store** | SQLite (chain-index.db) to PostgreSQL for production | Current Lens indexer uses SQLite. Migrate to Postgres for concurrent read/write under load. |
| **API** | FastAPI (current scout-api) | Already running. Extend `/chain/*` endpoints with graph-formatted responses. |
| **Graph algorithms** | Graphology.js (frontend) or NetworkX (backend) | Centrality, clustering coefficient, community detection, shortest path, component analysis. |
| **Indexer** | PFTL chain crawler (current) | Already running daily. |

### Integration with Existing Lens Modules

This visualization consumes data from the broader Lens ecosystem:

| Lens Component | Role in Visualization |
|----------------|----------------------|
| **Chain indexer** (crawler.ts) | Populates accounts, transactions, edges tables |
| **Sybil detector** (sybil.ts) | Populates sybil_clusters table, feeds risk badges |
| **Wallet labels** (wallet_labels table) | Display names, infrastructure tags |
| **Balance index** | Rich list, node sizing by wealth |

---

## 10. Builder Handoff Checklist

To implement this spec, a frontend developer must verify each item:

- [ ] All node types from Section 3 render with correct shape, size encoding, and color encoding
- [ ] All edge types from Section 3 render with correct style, width, and color
- [ ] Trust/flow edge classification (FLOW_WITHOUT_TRUST, TRUST_WITHOUT_VALUE, TRUST_PLUS_VALUE) is computed and displayed
- [ ] All 8 risk badges from Section 3 are computed and rendered per threshold definitions in Section 5
- [ ] Render precedence from Section 5 is respected (privacy > confidence > type > badges > selection > dimming)
- [ ] Every row in the View-State Matrix (Section 6) produces the specified rendered state, badge, tooltip, and click result
- [ ] All low-confidence rules from Section 7 are enforced, including the prohibition on identity inference from wallet proximity
- [ ] View 1 (Global Overview) renders with cose-bilkent layout and metrics dashboard
- [ ] View 2 (Contributor Detail) renders with concentric layout and trust/flow breakdown
- [ ] View 3 (Risk Hotspot Inspector) implements all three tabs: Sybil, Concentration, Bus-Factor
- [ ] Bus-factor counterfactual removal panel displays components before/after, disconnected count, path length change
- [ ] Concentration alert fires when top 3 nodes control > 50% of weighted flow
- [ ] Privacy redaction rules prevent display of encrypted content, IP addresses, and real-world identity
- [ ] Backend error and empty filter states render per the View-State Matrix
- [ ] No gated UX (no PFT requirements for viewing any state)
- [ ] `apiToCytoscape` transform handles all node types, edge types, and badge assignments

### Data Source

The Lens chain API runs at `http://localhost:8420/chain/`. Endpoints: `/list`, `/richlist`, `/profile/{address}`, `/stats`, `/sybil`, `/infra`, `/labels`, `/edges`. All return JSON.

### Key Files

```
lens-frontend/
  src/
    components/
      NetworkGraph.tsx        # Cytoscape wrapper (View 1)
      EgoNetwork.tsx          # Contributor detail view (View 2)
      RiskHotspotInspector.tsx # Risk analysis view (View 3)
      MetricsDashboard.tsx    # Stats panel
      BusFactorPanel.tsx      # Counterfactual removal analysis
      ConcentrationPanel.tsx  # Flow concentration analysis
    hooks/
      useChainData.ts         # API client for /chain/* endpoints
      useGraphLayout.ts       # Layout management
      useBadgeComputation.ts  # Risk badge assignment from metrics
    utils/
      apiToCytoscape.ts       # JSON transform (Section 8)
      colorScale.ts           # Activity score to color
      thresholds.ts           # Percentile and structural threshold computation
      trustFlowClassifier.ts  # Edge trust/flow classification
    App.tsx                   # View routing
```

---

## Appendix: Future Enhancements

The following concepts were evaluated during specification development but are deferred to future iterations. They are recorded here for completeness.

### Story Modules -- Temporal Narrative Views

Beyond static graph inspection, temporal patterns can tell stories:

**Trust Formation:** Track the evolution of a relationship over time.

```
Week 1:  A --(1 memo)--> B           [First contact]
Week 2:  A --(3 memos)--> B          [Working together]
Week 3:  A <--(2 memos)--  B         [Reciprocal]
Week 4:  A <--(5 memos)--> B + 500 PFT [Trust + value]
```

Animated edge that thickens over time. A timeline scrubber lets the viewer watch the relationship form.

**Cluster Emergence:** Detect when a new working group forms.

```
Day 1:  A--B (isolated pair)
Day 3:  A--B--C (chain)
Day 7:  A--B--C, A--C (triangle = cluster)
Day 14: A--B--C--D, A--D (growing cluster)
```

New edges flash briefly when they form. Clusters pulse when they become triangulated.

**Activity Heatmap:** When does the network work?

```
        Mon  Tue  Wed  Thu  Fri  Sat  Sun
 00:00  ..   ..   ..   ..   ..   ..   ..
 06:00  ##   ##   ##   ##   ##   ..   ..
 12:00  XX   XX   XX   XX   XX   ##   ..
 18:00  ##   ##   ##   ##   ..   ..   ..
```

Heatmap grid derived from transaction timestamps. Reveals timezone clustering and peak activity hours.

### Real-Time Pipeline

```
PFTL Node (WSS)
    |
    | subscribe("transactions")
    v
WebSocket Listener
    |
    |-> New transaction -> Update chain-index.db
    |                   -> Push to frontend via Server-Sent Events
    |
    |-> New memo edge  -> Animate new edge in graph
    |                   -> Flash connected nodes
    |
    |-> Large transfer -> Particle animation along edge
    |                   -> Dashboard alert
    |
    +-> New account    -> Add node with entrance animation
                        -> Update node count badge
```

For real-time support, add a WebSocket subscriber process that connects to `wss://ws.testnet.postfiat.org`, subscribes to the `transactions` stream, filters for Payment transactions with Memos, updates the data store incrementally, and pushes diffs to connected frontends via SSE or WebSocket.

---

*Published by Zoz via the Permanent Upper Class validator operation.*
