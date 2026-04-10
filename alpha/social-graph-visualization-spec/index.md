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

This specification defines a public visualization layer for the Post Fiat task network's on-chain social graph. It turns raw transaction data into auditable, interactive relationship maps — showing who collaborates with whom, where trust concentrates, where risk accumulates, and where value flows.

**What this is:** A frontend specification grounded in real indexed chain data (53 accounts, 885 transactions, 105 interaction edges, 2 sybil clusters) from the live PFTL network. Every example in this spec maps to actual data in the Lens chain index.

**What this is not:** A mockup divorced from reality. The data model, edge taxonomy, and example JSON blocks are all derived from the production Lens indexer running against the PFTL testnet.

**Data source principle:** Public signals only. All visualized data is derived from on-chain transactions — no private roadmap, no decrypted message content, no self-reported profiles. This ensures the graph is reproducible by any reviewer, safe for external audit, and suitable for cross-operator fairness analysis.

---

## 1. Target Audience and Use Cases

### Primary Audiences

| Audience | Use Case | Key View |
|----------|----------|----------|
| **Network operators** | Monitor contributor health, detect sybil clusters, identify bus-factor risks | Global graph + sybil overlay |
| **Task issuers** | Find active contributors, assess collaboration history before assigning work | Contributor detail + relationship strength |
| **Contributors** | Understand their network position, see reputation, discover collaboration opportunities | Ego-network view |
| **Reviewers/auditors** | Verify payout decisions, audit concentration, check for collusion | Subgraph isolation + edge-weight analysis |
| **New participants** | Understand the network landscape before joining | Overview + rich list + activity heatmap |

### Core Use Cases

1. **"Who is the most connected contributor?"** — Degree centrality ranking with visual node sizing
2. **"Are these wallets controlled by the same person?"** — Sybil cluster highlighting with evidence overlay
3. **"Where does value concentrate?"** — PFT flow visualization with edge-weight encoding
4. **"Who should I collaborate with?"** — Ego-network expansion showing 2nd-degree connections
5. **"Is this network healthy?"** — Dashboard view: concentration index, diversity metrics, growth trends
6. **"What happened this week?"** — Temporal activity replay showing new edges, new nodes, value flows

---

## 2. Node and Edge Taxonomy

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
| **Memo exchange** | Solid line | memo_tx_count (thickness) | Gray → blue (by frequency) | `edges.memo_tx_count > 0` |
| **Value transfer** | Solid line with arrow | total_amount_drops | Green (by amount) | `edges.total_amount_drops > 0` |
| **Sybil link** | Dashed red line | Confidence score | Red (intensity = confidence) | `sybil_clusters` membership |
| **Infrastructure flow** | Dotted line | Transaction count | Blue, semi-transparent | Source or dest is infrastructure |

### Edge Properties

```json
{
  "source": "rsS2Y6CK9dz9dVFjJvRyD2gBdoLPqjaXRZ",
  "target": "rwdm72S9YVKkZjeADKU2bbUMuY4vPnSfH7",
  "type": "memo_exchange",
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

---

## 3. Visualization Views

### View 1: Global Network Overview

**Purpose:** Bird's-eye view of the entire PFTL social graph. First thing a user sees.

```
┌─────────────────────────────────────────────────────────┐
│  Lens Network Graph              [7d] [30d] [All]  🔍  │
│                                                         │
│                    ◇ Task Node                          │
│                   /||\                                  │
│                  / || \                                 │
│                 /  ||  \                                │
│              ●──●  ||  ●──●                             │
│             /   \  ||  /   \                            │
│            ●     ● || ●     ●                           │
│                    ||                                   │
│              ⬡ Lens Bot                                 │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │Nodes: 21 │  │Edges: 105│  │Clusters:2│              │
│  │Active    │  │Memo: 626 │  │Sybil     │              │
│  └──────────┘  └──────────┘  └──────────┘              │
│                                                         │
│  [Rich List] [Sybil Report] [Activity Heatmap]         │
└─────────────────────────────────────────────────────────┘
```

**Layout:** Cytoscape.js with `cose-bilkent` layout (force-directed with compound node support). Infrastructure nodes pinned to center. Contributor nodes orbit based on interaction frequency with the hub.

**Interactions:**
- **Hover node:** Tooltip with address, balance, activity score, peer count
- **Click node:** Expand to ego-network view (View 2)
- **Hover edge:** Show memo count, total PFT transferred, relationship duration
- **Time slider:** Filter edges by time window (7d / 30d / all-time)
- **Zoom:** Scroll to zoom. Double-click to focus on subgraph.
- **Sybil toggle:** Overlay/hide sybil cluster highlighting

**Color Legend:**
- Green nodes: high activity (score > 0.5)
- Gray nodes: low activity (score < 0.2)
- Blue diamonds: infrastructure
- Red dashed border: sybil-flagged
- Edge thickness: relationship strength (memo count)
- Edge color: gray (memos) → green (value transfer)

### View 2: Ego-Network / Contributor Detail

**Purpose:** Deep-dive into a single contributor's network position and relationships.

```
┌─────────────────────────────────────────────────────────┐
│  ← Back to Overview                                     │
│                                                         │
│  rsS2Y6CK...jaXRZ                                      │
│  ┌─────────────────────────────────────┐                │
│  │ Balance: 641,243 PFT               │                │
│  │ Activity Score: 0.33               │                │
│  │ Memos: 101  |  Peers: 9           │                │
│  │ First seen: 2026-03-14             │                │
│  │ Sybil: Clean                       │                │
│  └─────────────────────────────────────┘                │
│                                                         │
│              ●──── 23 memos ────◇ Task Node             │
│             /                                           │
│  rsS2Y6CK ●──── 10 memos ────● rH3dfGif               │
│             \                                           │
│              ●──── 4 memos ────● rsqZiJ6v              │
│                                                         │
│  ┌─────────────────────────────────────┐                │
│  │ Top Peers            Memo  PFT      │                │
│  │ 1. rwdm72S9 (hub)    23    0       │                │
│  │ 2. rH3dfGif           10    0       │                │
│  │ 3. rsqZiJ6v            4    0       │                │
│  └─────────────────────────────────────┘                │
│                                                         │
│  Activity Timeline ───────────────────                  │
│  Mar 14 ▏▏▏▏▏▏  Mar 28 ▏▏▏▏▏  Apr 10 ▏▏▏             │
│                                                         │
│  [View Full Transaction History]  [Compare Wallets]     │
└─────────────────────────────────────────────────────────┘
```

**Layout:** Concentric layout with the selected node at center. 1st-degree connections in inner ring, 2nd-degree in outer ring.

**Interactions:**
- **Click peer:** Navigate to their ego-network
- **Activity timeline:** Sparkline showing daily memo activity
- **Compare wallets:** Side-by-side comparison of two contributors

### View 3: Sybil Cluster Inspector

**Purpose:** Isolate and examine flagged sybil clusters with evidence breakdown.

```
┌─────────────────────────────────────────────────────────┐
│  Sybil Cluster: sybil_001                               │
│  Confidence: 100%  |  Members: 3  |  Signals: 2        │
│                                                         │
│     ●─────────●                                         │
│      \       /                                          │
│       \     /   (amount_fingerprint +                   │
│        \   /     counterparty_overlap)                  │
│         ● ●                                             │
│                                                         │
│  ┌─────────────────────────────────────┐                │
│  │ Evidence Breakdown                  │                │
│  │                                     │                │
│  │ Signal              Score  Pairs    │                │
│  │ amount_fingerprint   0.60  3        │                │
│  │ counterparty_overlap 0.65  1        │                │
│  │                                     │                │
│  │ Shared Counterparties:              │                │
│  │   rsVf8gQu, rJLXZVdG, rwdm72S9    │                │
│  │                                     │                │
│  │ Matching Amounts:                   │                │
│  │   12,500,000 drops → same dest x3  │                │
│  └─────────────────────────────────────┘                │
│                                                         │
│  [Mark as False Positive]  [Escalate to Review]         │
└─────────────────────────────────────────────────────────┘
```

---

## 4. Story Modules — Real-Time Narrative Views

Beyond static graph inspection, Lens tells stories from temporal patterns:

### Story: Trust Formation

Track the evolution of a relationship over time.

```
Week 1:  A ──(1 memo)──→ B           [First contact]
Week 2:  A ──(3 memos)──→ B          [Working together]
Week 3:  A ←──(2 memos)──  B         [Reciprocal]
Week 4:  A ←──(5 memos)──→ B + 500 PFT [Trust + value]
```

**Visual:** Animated edge that thickens over time. A timeline scrubber lets the user watch the relationship form.

### Story: Cluster Emergence

Detect when a new working group forms.

```
Day 1:  A──B (isolated pair)
Day 3:  A──B──C (chain)
Day 7:  A──B──C, A──C (triangle = cluster)
Day 14: A──B──C──D, A──D (growing cluster)
```

**Visual:** New edges flash briefly when they form. Clusters pulse when they become triangulated (indicating real working groups vs linear chains).

### Story: Whale Movements

Track large PFT transfers between wallets.

**Visual:** Particle animation along edges for high-value transfers. Size of particles proportional to PFT amount. Dashboard alert for transfers above threshold.

### Story: Activity Heatmap

When does the network work?

```
        Mon  Tue  Wed  Thu  Fri  Sat  Sun
 00:00  ░░   ░░   ░░   ░░   ░░   ░░   ░░
 06:00  ▓▓   ▓▓   ▓▓   ▓▓   ▓▓   ░░   ░░
 12:00  ██   ██   ██   ██   ██   ▓▓   ░░
 18:00  ▓▓   ▓▓   ▓▓   ▓▓   ░░   ░░   ░░
```

**Visual:** Heatmap grid derived from transaction timestamps. Reveals timezone clustering, work patterns, and peak activity hours.

---

## 5. Privacy, Redaction, and Abuse Prevention

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
- Offensive labels can be flagged and removed by moderators

### Abuse Prevention

| Risk | Mitigation |
|------|-----------|
| Doxxing via graph analysis | No real-world identity data. Wallet addresses are already public on-chain. |
| Sybil false positives | Sybil clusters show confidence scores + evidence signals. "Mark as false positive" action for moderators. |
| Stalking via activity patterns | Heatmap shows aggregate network patterns, not per-wallet timing. Per-wallet timeline only visible in profile view (which requires 1 PFT). |
| Gaming the graph (fake relationships) | Each memo transaction costs gas + minimum PFT. Economic cost prevents spam edges. |

---

## 6. Technology Stack Recommendation

### Frontend

| Layer | Tool | Rationale |
|-------|------|-----------|
| **Graph rendering** | Cytoscape.js | Best balance of features, performance, and graph analytics. Handles 500+ nodes. Built-in layouts (cose-bilkent, concentric, breadthfirst). |
| **Large-scale fallback** | Sigma.js v3 | WebGL-powered for 5,000+ node views. Use for "zoomed out" network overview when node count exceeds Cytoscape comfort zone. |
| **Charts/heatmaps** | Observable Plot or Chart.js | Activity timelines, heatmaps, distribution charts. Lightweight. |
| **3D exploration** | 3d-force-graph (optional) | "Wow factor" view for demos. WebGL/Three.js. Not primary. |
| **Framework** | React + TypeScript | Component architecture for view switching, state management, filter controls. |
| **Real-time updates** | WebSocket subscription to PFTL node | Subscribe to `transactions` stream. New edges animate into the graph live. |

### Backend

| Layer | Tool | Rationale |
|-------|------|-----------|
| **Data store** | SQLite (chain-index.db) → PostgreSQL for production | Current Lens indexer uses SQLite. Migrate to Postgres for concurrent read/write under load. |
| **API** | FastAPI (current scout-api) | Already running. Extend `/chain/*` endpoints with graph-formatted responses. |
| **Graph algorithms** | Graphology.js (frontend) or NetworkX (backend) | Centrality, clustering coefficient, community detection, shortest path. |
| **Indexer** | PFTL chain crawler (current) | Already running daily. Add WebSocket subscriber for real-time. |

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
          "sybil_flagged": false
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

---

## 7. Example: Graph JSON to Rendered UI States

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
];
```

### Result

The 5-wallet API response transforms into a Cytoscape graph where:
- rwdm72S9 renders as a large green node (high activity) at the center
- rsS2Y6CK renders as a medium green node
- rGBKxoTc renders with a red dashed border (sybil-flagged)
- Edges between them vary in thickness (1-5px based on memo count)
- Value-transfer edges get green arrows

---

## 8. Metrics Dashboard

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

---

## 9. Real-Time Pipeline

```
PFTL Node (WSS)
    │
    │ subscribe("transactions")
    ▼
WebSocket Listener
    │
    ├─→ New transaction → Update chain-index.db
    │                    → Push to frontend via Server-Sent Events
    │
    ├─→ New memo edge  → Animate new edge in graph
    │                    → Flash connected nodes
    │
    ├─→ Large transfer → Particle animation along edge
    │                    → Dashboard alert
    │
    └─→ New account    → Add node with entrance animation
                         → Update node count badge
```

**Implementation:** The existing Lens indexer runs daily via cron. For real-time, add a WebSocket subscriber process that:
1. Connects to `wss://ws.testnet.postfiat.org`
2. Subscribes to `transactions` stream
3. Filters for Payment transactions with Memos
4. Updates SQLite/Postgres incrementally
5. Pushes diffs to connected frontends via SSE or WebSocket

---

## 10. Handoff Notes for Next Builder

### To implement this spec, a frontend developer needs:

1. **Data source:** The Lens chain API is running at `http://localhost:8420/chain/`. Endpoints: `/list`, `/richlist`, `/profile/{address}`, `/stats`, `/sybil`, `/infra`, `/labels`. All return JSON.

2. **Graph format:** Transform API responses into Cytoscape.js elements format using the `apiToCytoscape` function in Section 7. The edge data comes from the SQLite `edges` table (add an API endpoint for this: `GET /chain/edges`).

3. **Layout:** Start with `cose-bilkent` for the global view, `concentric` for ego-network. Pin infrastructure nodes to prevent layout thrashing.

4. **Styling:** Use the Cytoscape stylesheet in Section 7 as a starting point. All visual encodings (size, color, border) map directly to data fields.

5. **Interactions:** Cytoscape.js has built-in event handling (`cy.on('tap', 'node', ...)`) for click, hover, and zoom. The view-switching (Overview → Detail → Sybil) is standard React routing.

6. **Privacy:** Never display decrypted message content. Never fetch from `/ipfs/` endpoints. Only use the `/chain/*` API which serves public-only data.

7. **Sybil overlay:** The `/chain/sybil` endpoint returns cluster membership. Draw dashed red borders on flagged nodes and dashed red edges between cluster members.

8. **Performance:** For the current network (53 nodes, 105 edges), any renderer works. If the network grows beyond 500 nodes, switch the overview to Sigma.js (WebGL) and keep Cytoscape for detail views.

9. **Real-time:** Not required for v1. The daily indexer crawl is sufficient. Add WebSocket subscription in v2.

### Files to create:

```
lens-frontend/
  src/
    components/
      NetworkGraph.tsx      # Cytoscape wrapper
      EgoNetwork.tsx        # Contributor detail view
      SybilInspector.tsx    # Cluster analysis view
      MetricsDashboard.tsx  # Stats panel
      ActivityHeatmap.tsx   # Temporal patterns
      RichList.tsx          # Balance leaderboard
    hooks/
      useChainData.ts       # API client for /chain/* endpoints
      useGraphLayout.ts     # Layout management
    utils/
      apiToCytoscape.ts     # JSON transform (Section 7)
      colorScale.ts         # Activity score → color
    App.tsx                 # View routing
```

---

## 11. Integration with Existing Lens Modules

This visualization consumes data from the broader Lens ecosystem:

| Lens Component | Role in Visualization |
|----------------|----------------------|
| **Chain indexer** (crawler.ts) | Populates accounts, transactions, edges tables |
| **Sybil detector** (sybil.ts) | Populates sybil_clusters table → red overlays |
| **Wallet labels** (wallet_labels table) | Display names, infrastructure tags |
| **Balance index** | Rich list, node sizing by wealth |
| **Cross-task graph generator** (PFT module) | Task dependency edges (future: overlay task relationships on social graph) |
| **Operator reputation ledger** (PFT module) | Trust tier → node color/badge (future integration) |

---

*Published by Zoz via the Permanent Upper Class validator operation.*  
*Task completed for the Post Fiat Network.*
