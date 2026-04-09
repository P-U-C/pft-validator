---
layout: default
title: Deterministic Cross-Task Reference Graph Generator
date: 2026-04-09
category: network
status: submitted
task_id: ce81d09c-8dc2-4103-b190-d1356521c387
---

# Deterministic Cross-Task Reference Graph Generator

## Executive Summary

A deterministic TypeScript module that ingests a network task corpus and emits a typed cross-task dependency graph using **only publicly observable signals**: description token overlap, schema field matching, temporal sequencing, artifact citation, and operator concentration.

**What it is:** A self-contained graph builder that maps legitimate dependency chains between tasks — identifying which tasks build on prior work, consume outputs from other tasks, supersede earlier versions, contradict each other, or duplicate existing entries.

**What it is NOT:** This module does not access private roadmap context, internal planning documents, or any non-public signals. Every inferred relationship is grounded in observable task metadata and text analysis. It is also not a duplicate *blocker* — unlike the Duplicate Task Suppression Module which blocks issuance, this module *maps* relationships for triage and tracking.

## Determinism Guarantee

This module produces **byte-identical JSON output** for identical inputs. The `as_of` parameter is required and `generated_at` is always set equal to `as_of` — the module never calls `new Date()` or reads the system clock. All arrays are sorted deterministically: edges by `(type ASC, confidence DESC, from_task_id ASC, to_task_id ASC)`, tasks by `(created_at ASC, task_id ASC)`, and subgraph members alphabetically. Floating-point scores are rounded to 4 decimal places to prevent platform-dependent precision drift.

## API Contract

### Function Signature

```typescript
function generateTaskGraph(input: GraphInput): GraphResult
```

### Input Schema

```typescript
interface GraphInput {
  tasks: TaskRecord[];                           // The task corpus to analyze
  as_of: string;                                 // Required — ISO 8601 evaluation timestamp
  thresholds?: Partial<GraphThresholds>;          // Optional threshold overrides
  severity_policies?: Partial<SeverityPolicies>;  // Optional severity overrides
}

interface TaskRecord {
  task_id: string;
  title: string;
  description: string;
  category?: string;
  operator?: string;         // Wallet address or operator identifier
  created_at: string;        // ISO 8601
  status: TaskStatus;        // 'outstanding' | 'generated' | 'refused' | 'rewarded' | 'cancelled'
  reward_pft?: number;
  tags?: string[];
  output_types?: string[];   // Named output artifacts (e.g., "ReviewQueue", "PolicyEngine")
  input_types?: string[];    // Named input dependencies
}
```

### Output Schema

```typescript
interface GraphOutput {
  generated_at: string;
  as_of: string;
  version: string;
  edges: GraphEdge[];
  subgraphs: Subgraph[];
  orphan_tasks: string[];
  bus_factor_risks: BusFactorRisk[];
  graph_metrics: GraphMetrics;
  validation_warnings: string[];
  thresholds_used: GraphThresholds;
  severity_policies_used: SeverityPolicies;
}
```

### Error Schema (malformed input)

```typescript
interface GraphError {
  generated_at: string;
  as_of: string;
  version: string;
  error: true;
  error_code: GraphErrorCode;  // MISSING_AS_OF | INVALID_AS_OF | MISSING_TASKS_ARRAY | INVALID_TASK_RECORD | DUPLICATE_TASK_ID
  error_message: string;
}
```

## Decision Logic

### Edge Type Heuristics

All relationships are inferred from publicly observable signals only.

| Edge Type | Signal Requirements | Confidence Formula | Rationale |
|-----------|-------------------|-------------------|-----------|
| `builds_on` | Combined Jaccard >= 0.35 + temporal sequence (B after A) | `sim * 0.6 + operator_bonus(0.15) + category_bonus(0.1) + 0.05` | Detects iterative work chains where later tasks extend earlier ones. Same operator/category boosts confidence. |
| `consumes_output` | A's `output_types` matched in B's `input_types` or description | `match_ratio * 0.8 + 0.1 + temporal_bonus(0.1)` | Maps producer-consumer relationships via schema field matching and artifact citation. |
| `supersedes` | Combined Jaccard >= 0.6 + temporal sequence + supersede keywords (v2, updated, revised, replaces) | `sim * 0.8 + 0.2 + operator_bonus(0.05) + category_bonus(0.05)` | Identifies version upgrades. Requires both high overlap AND explicit supersession language. |
| `contradicts` | Combined Jaccard >= 0.4 + contradict keywords (instead of, rather than, alternative to) | `sim * 0.7 + 0.15` | Flags competing approaches. Rare by design — only triggers on explicit contradiction language. |
| `duplicates` | Combined Jaccard >= 0.8 | `min(sim * 1.1, 1.0)` | Near-identical tasks. Reuses the same normalize/tokenize/Jaccard approach as the Duplicate Task Suppression Module. |

### Edge Priority

When multiple edge types could apply to the same pair:
- **duplicates** and **supersedes** suppress **builds_on** (avoids double-counting strong relationships)
- **contradicts** fires independently (can co-exist with duplicates if keyword signals are present)
- All edges are directional: `from_task_id` → `to_task_id` means the target depends on the source

### Bus-Factor Analysis

For each connected subgraph with `>= critical_subgraph_min_size` (default: 3) tasks, the module checks operator concentration. If any single operator owns `>= bus_factor_threshold` (default: 75%) of tasks in the subgraph, a risk flag is emitted with the operator's name, concentration ratio, and a human-readable rationale.

### Orphan Detection

Tasks that appear in zero edges are flagged as orphans. A validation warning is emitted if the orphan ratio exceeds 50%.

## Configurable Thresholds

| Threshold | Default | Description |
|-----------|---------|-------------|
| `builds_on_min` | 0.35 | Minimum Jaccard similarity for builds_on edges |
| `consumes_output_min` | 0.50 | Minimum output type match ratio for consumes_output |
| `supersedes_min` | 0.60 | Minimum overlap for supersedes (plus keyword requirement) |
| `contradicts_min` | 0.40 | Minimum overlap for contradicts (plus keyword requirement) |
| `duplicates_min` | 0.80 | Minimum overlap for duplicate detection |
| `bus_factor_threshold` | 0.75 | Operator concentration triggering bus-factor risk |
| `critical_subgraph_min_size` | 3 | Minimum subgraph size for bus-factor analysis |

All thresholds are overridable via `input.thresholds`. Severity policies (`orphan_severity`, `bus_factor_severity`, `contradiction_severity`) are separately configurable via `input.severity_policies`.

## Sample Input/Output

### Example 1: Mixed Edge Types (builds_on + consumes_output + supersedes)

**Input** — 5 tasks spanning authorization review, engagement policy, and tokenomics:

```json
{
  "tasks": [
    {
      "task_id": "task_001",
      "title": "Build Authorization Review Queue Generator",
      "description": "Generate moderator-ready review queue from contributor authorization records and task history for network validation.",
      "category": "network",
      "operator": "alice",
      "created_at": "2026-03-20T12:00:00Z",
      "status": "rewarded",
      "output_types": ["ReviewQueue", "ModeratorReport"]
    },
    {
      "task_id": "task_002",
      "title": "Build Engagement Guardrail Policy Generator",
      "description": "Build deterministic policy engine that evaluates operator engagement signals for task issuance guardrails.",
      "category": "network",
      "operator": "alice",
      "created_at": "2026-03-25T12:00:00Z",
      "status": "rewarded",
      "output_types": ["PolicyEngine"]
    },
    {
      "task_id": "task_003",
      "title": "Build Authorization Review Queue Dashboard",
      "description": "Build dashboard displaying moderator-ready review queue status from contributor authorization records and validation metrics.",
      "category": "network",
      "operator": "alice",
      "created_at": "2026-04-01T12:00:00Z",
      "status": "outstanding",
      "input_types": ["ReviewQueue"]
    },
    {
      "task_id": "task_004",
      "title": "Build Engagement Guardrail Policy Generator v2",
      "description": "Updated deterministic policy engine that evaluates operator engagement signals for task issuance guardrails with revised threshold configuration.",
      "category": "network",
      "operator": "bob",
      "created_at": "2026-04-05T12:00:00Z",
      "status": "outstanding"
    },
    {
      "task_id": "task_005",
      "title": "Design Token Vesting Schedule",
      "description": "Create a vesting schedule for team token allocations with cliff periods and linear release mechanisms.",
      "category": "tokenomics",
      "operator": "carol",
      "created_at": "2026-03-28T12:00:00Z",
      "status": "outstanding"
    }
  ],
  "as_of": "2026-04-09T12:00:00Z"
}
```

**Output** — 3 edges across 3 types, 2 subgraphs, 1 orphan:

```json
{
  "generated_at": "2026-04-09T12:00:00Z",
  "as_of": "2026-04-09T12:00:00Z",
  "version": "1.0.0",
  "edges": [
    {
      "from_task_id": "task_001",
      "to_task_id": "task_003",
      "edge_type": "builds_on",
      "confidence": 0.6143,
      "reason_codes": ["TITLE_TOKEN_OVERLAP", "DESCRIPTION_TOKEN_OVERLAP", "TEMPORAL_SEQUENCE", "SAME_OPERATOR", "SAME_CATEGORY"],
      "signal_details": {
        "combined_similarity": 0.5238,
        "temporal_order": 1,
        "title_similarity": 0.6667,
        "description_similarity": 0.5,
        "same_operator": 1,
        "same_category": 1
      }
    },
    {
      "from_task_id": "task_001",
      "to_task_id": "task_003",
      "edge_type": "consumes_output",
      "confidence": 0.6,
      "reason_codes": ["SCHEMA_FIELD_MATCH", "TEMPORAL_SEQUENCE"],
      "signal_details": {
        "output_match_ratio": 0.5,
        "matched_outputs": 1,
        "total_outputs": 2,
        "temporal_order": 1
      }
    },
    {
      "from_task_id": "task_002",
      "to_task_id": "task_004",
      "edge_type": "supersedes",
      "confidence": 0.85,
      "reason_codes": ["COMBINED_TOKEN_OVERLAP", "SUPERSEDE_KEYWORD", "TEMPORAL_SEQUENCE", "SAME_CATEGORY"],
      "signal_details": {
        "combined_similarity": 0.75,
        "temporal_order": 1,
        "supersede_keyword": 1,
        "same_category": 1
      }
    }
  ],
  "subgraphs": [
    {
      "subgraph_id": "sg_001",
      "task_ids": ["task_001", "task_003"],
      "edge_count": 2,
      "max_chain_depth": 1,
      "dominant_category": "network",
      "operator_distribution": { "alice": 2 }
    },
    {
      "subgraph_id": "sg_002",
      "task_ids": ["task_002", "task_004"],
      "edge_count": 1,
      "max_chain_depth": 1,
      "dominant_category": "network",
      "operator_distribution": { "alice": 1, "bob": 1 }
    }
  ],
  "orphan_tasks": ["task_005"],
  "bus_factor_risks": [],
  "graph_metrics": {
    "total_nodes": 5,
    "total_edges": 3,
    "connected_components": 3,
    "orphan_count": 1,
    "maximum_chain_depth": 1,
    "edge_type_counts": {
      "builds_on": 1,
      "consumes_output": 1,
      "supersedes": 1,
      "contradicts": 0,
      "duplicates": 0
    },
    "avg_edges_per_node": 0.6
  },
  "validation_warnings": [],
  "thresholds_used": {
    "builds_on_min": 0.35,
    "consumes_output_min": 0.5,
    "supersedes_min": 0.6,
    "contradicts_min": 0.4,
    "duplicates_min": 0.8,
    "bus_factor_threshold": 0.75,
    "critical_subgraph_min_size": 3
  }
}
```

### Example 2: Empty Corpus

```json
// Input
{ "tasks": [], "as_of": "2026-04-09T12:00:00Z" }

// Output
{
  "generated_at": "2026-04-09T12:00:00Z",
  "as_of": "2026-04-09T12:00:00Z",
  "version": "1.0.0",
  "edges": [],
  "subgraphs": [],
  "orphan_tasks": [],
  "bus_factor_risks": [],
  "graph_metrics": {
    "total_nodes": 0, "total_edges": 0,
    "connected_components": 0, "orphan_count": 0,
    "maximum_chain_depth": 0,
    "edge_type_counts": { "builds_on": 0, "consumes_output": 0, "supersedes": 0, "contradicts": 0, "duplicates": 0 },
    "avg_edges_per_node": 0
  }
}
```

### Example 3: Malformed Input

```json
// Input — missing as_of
{ "tasks": [{ "task_id": "x", "title": "Test", "description": "Test", "created_at": "2026-04-01", "status": "outstanding" }] }

// Output
{
  "generated_at": "",
  "as_of": "",
  "version": "1.0.0",
  "error": true,
  "error_code": "MISSING_AS_OF",
  "error_message": "as_of is required and must be a string"
}
```

---

## Full Source Code

### types.ts

```typescript
/**
 * Cross-Task Reference Graph Generator — Types
 *
 * Deterministic module that ingests a task corpus and emits a typed
 * cross-task dependency graph using publicly observable signals only.
 */

export const SCHEMA_VERSION = '1.0.0';

// ============================================================================
// Input Types
// ============================================================================

/** Status of a task in the corpus */
export type TaskStatus =
  | 'outstanding'
  | 'generated'
  | 'refused'
  | 'rewarded'
  | 'cancelled';

/** A task record in the corpus */
export interface TaskRecord {
  task_id: string;
  title: string;
  description: string;
  category?: string;
  operator?: string;         // Wallet address or operator identifier
  created_at: string;        // ISO 8601
  status: TaskStatus;
  reward_pft?: number;
  tags?: string[];
  output_types?: string[];   // Named output artifacts (e.g., "ReviewQueue", "PolicyEngine")
  input_types?: string[];    // Named input dependencies
}

/** Typed relationship between two tasks */
export type EdgeType =
  | 'builds_on'
  | 'consumes_output'
  | 'supersedes'
  | 'contradicts'
  | 'duplicates';

/** Configurable thresholds for edge detection */
export interface GraphThresholds {
  builds_on_min: number;           // Minimum Jaccard similarity for builds_on (default 0.35)
  consumes_output_min: number;     // Minimum schema field match score (default 0.5)
  supersedes_min: number;          // Minimum overlap for supersedes (default 0.6)
  contradicts_min: number;         // Minimum overlap for contradicts (default 0.4)
  duplicates_min: number;          // Minimum overlap for duplicates (default 0.8)
  bus_factor_threshold: number;    // Operator concentration triggering risk (default 0.75)
  critical_subgraph_min_size: number; // Minimum subgraph size for bus-factor analysis (default 3)
}

/** Configurable severity policies */
export interface SeverityPolicies {
  orphan_severity: 'info' | 'warning' | 'critical';
  bus_factor_severity: 'info' | 'warning' | 'critical';
  contradiction_severity: 'info' | 'warning' | 'critical';
}

/** Input to the graph generator */
export interface GraphInput {
  tasks: TaskRecord[];
  as_of: string;                               // Required — evaluation timestamp
  thresholds?: Partial<GraphThresholds>;        // Optional overrides
  severity_policies?: Partial<SeverityPolicies>; // Optional overrides
}

// ============================================================================
// Output Types
// ============================================================================

/** Reason code explaining why an edge was inferred */
export type EdgeReasonCode =
  | 'TITLE_TOKEN_OVERLAP'
  | 'DESCRIPTION_TOKEN_OVERLAP'
  | 'COMBINED_TOKEN_OVERLAP'
  | 'SCHEMA_FIELD_MATCH'
  | 'TEMPORAL_SEQUENCE'
  | 'SAME_OPERATOR'
  | 'SAME_CATEGORY'
  | 'SUPERSEDE_KEYWORD'
  | 'CONTRADICT_KEYWORD'
  | 'NEAR_IDENTICAL_TITLE'
  | 'NEAR_IDENTICAL_DESCRIPTION';

/** A directed edge in the graph */
export interface GraphEdge {
  from_task_id: string;       // Source task (A)
  to_task_id: string;         // Target task (B depends on A)
  edge_type: EdgeType;
  confidence: number;         // [0, 1]
  reason_codes: EdgeReasonCode[];
  signal_details: Record<string, number>; // Raw signal scores for auditability
}

/** A connected subgraph (component) */
export interface Subgraph {
  subgraph_id: string;
  task_ids: string[];
  edge_count: number;
  max_chain_depth: number;
  dominant_category: string | null;
  operator_distribution: Record<string, number>; // operator → task count
}

/** Bus-factor risk flag */
export interface BusFactorRisk {
  subgraph_id: string;
  operator: string;
  task_count: number;
  concentration: number;     // [0, 1] — fraction of subgraph tasks by this operator
  severity: 'info' | 'warning' | 'critical';
  rationale: string;
}

/** Graph-level summary metrics */
export interface GraphMetrics {
  total_nodes: number;
  total_edges: number;
  connected_components: number;
  orphan_count: number;
  maximum_chain_depth: number;
  edge_type_counts: Record<EdgeType, number>;
  avg_edges_per_node: number;
}

/** Full output of the graph generator */
export interface GraphOutput {
  generated_at: string;
  as_of: string;
  version: string;
  edges: GraphEdge[];
  subgraphs: Subgraph[];
  orphan_tasks: string[];
  bus_factor_risks: BusFactorRisk[];
  graph_metrics: GraphMetrics;
  validation_warnings: string[];
  thresholds_used: GraphThresholds;
  severity_policies_used: SeverityPolicies;
}

/** Error output for malformed input */
export interface GraphError {
  generated_at: string;
  as_of: string;
  version: string;
  error: true;
  error_code: GraphErrorCode;
  error_message: string;
}

export type GraphErrorCode =
  | 'MISSING_AS_OF'
  | 'INVALID_AS_OF'
  | 'MISSING_TASKS_ARRAY'
  | 'INVALID_TASK_RECORD'
  | 'DUPLICATE_TASK_ID';

export type GraphResult = GraphOutput | GraphError;

// ============================================================================
// Defaults
// ============================================================================

export const DEFAULT_THRESHOLDS: GraphThresholds = {
  builds_on_min: 0.35,
  consumes_output_min: 0.5,
  supersedes_min: 0.6,
  contradicts_min: 0.4,
  duplicates_min: 0.8,
  bus_factor_threshold: 0.75,
  critical_subgraph_min_size: 3,
};

export const DEFAULT_SEVERITY_POLICIES: SeverityPolicies = {
  orphan_severity: 'info',
  bus_factor_severity: 'warning',
  contradiction_severity: 'warning',
};
```

### graph-generator.ts

```typescript
/**
 * Cross-Task Reference Graph Generator
 *
 * Deterministic module that ingests a task corpus and emits a typed
 * cross-task dependency graph using publicly observable signals:
 *   - Description token overlap (Jaccard similarity)
 *   - Schema field matching (output_types → input_types)
 *   - Temporal sequencing (created_at ordering)
 *   - Artifact citation (output type names in descriptions)
 *   - Operator concentration (bus-factor analysis)
 *
 * All output is deterministic: as_of is required, generated_at = as_of,
 * no runtime clock calls.
 *
 * @module graph-generator
 */

import {
  type GraphInput,
  type GraphOutput,
  type GraphError,
  type GraphResult,
  type GraphThresholds,
  type SeverityPolicies,
  type TaskRecord,
  type GraphEdge,
  type EdgeType,
  type EdgeReasonCode,
  type Subgraph,
  type BusFactorRisk,
  type GraphMetrics,
  DEFAULT_THRESHOLDS,
  DEFAULT_SEVERITY_POLICIES,
  SCHEMA_VERSION,
} from './types.js';

// ============================================================================
// Text Processing (same approach as duplicate suppression module)
// ============================================================================

/** Normalize text for comparison */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Extract tokens from text, filtering short words */
function tokenize(text: string): Set<string> {
  const normalized = normalize(text);
  const tokens = normalized.split(' ').filter(t => t.length > 2);
  return new Set(tokens);
}

/** Jaccard similarity between two token sets, returns [0, 1] */
function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;

  let intersectionSize = 0;
  for (const token of a) {
    if (b.has(token)) intersectionSize++;
  }
  const unionSize = a.size + b.size - intersectionSize;
  return intersectionSize / unionSize;
}

// ============================================================================
// Supersede / Contradict Keyword Detection
// ============================================================================

const SUPERSEDE_KEYWORDS = ['v2', 'updated', 'revised', 'replaces', 'replacement', 'upgrade', 'improved', 'new version'];
const CONTRADICT_KEYWORDS = ['instead of', 'rather than', 'alternative to', 'contrary to', 'opposes', 'replaces approach'];

function hasKeywords(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some(kw => lower.includes(kw));
}

// ============================================================================
// Edge Detection
// ============================================================================

interface EdgeCandidate {
  edge_type: EdgeType;
  confidence: number;
  reason_codes: EdgeReasonCode[];
  signal_details: Record<string, number>;
}

/**
 * Evaluate all possible edges between task A (earlier) and task B (later).
 * Edges are directional: from_task_id = A, to_task_id = B (B depends on A).
 */
function evaluateEdges(
  a: TaskRecord,
  b: TaskRecord,
  thresholds: GraphThresholds
): EdgeCandidate[] {
  const candidates: EdgeCandidate[] = [];

  // Pre-compute token sets
  const aTitleTokens = tokenize(a.title);
  const bTitleTokens = tokenize(b.title);
  const aDescTokens = tokenize(a.description);
  const bDescTokens = tokenize(b.description);
  const aCombinedTokens = tokenize(`${a.title} ${a.description}`);
  const bCombinedTokens = tokenize(`${b.title} ${b.description}`);

  // Compute similarities
  const titleSim = jaccardSimilarity(aTitleTokens, bTitleTokens);
  const descSim = jaccardSimilarity(aDescTokens, bDescTokens);
  const combinedSim = jaccardSimilarity(aCombinedTokens, bCombinedTokens);

  const sameOperator = !!(a.operator && b.operator && a.operator === b.operator);
  const sameCategory = !!(a.category && b.category &&
    normalize(a.category) === normalize(b.category));

  // Temporal: B must be created after or at same time as A
  const aDate = new Date(a.created_at).getTime();
  const bDate = new Date(b.created_at).getTime();
  const bIsLaterOrSame = bDate >= aDate;

  // --- DUPLICATES (highest priority, checked first) ---
  if (combinedSim >= thresholds.duplicates_min) {
    const reasons: EdgeReasonCode[] = ['COMBINED_TOKEN_OVERLAP'];
    const signals: Record<string, number> = {
      title_similarity: titleSim,
      description_similarity: descSim,
      combined_similarity: combinedSim,
    };
    if (titleSim >= 0.8) reasons.push('NEAR_IDENTICAL_TITLE');
    if (descSim >= 0.8) reasons.push('NEAR_IDENTICAL_DESCRIPTION');

    candidates.push({
      edge_type: 'duplicates',
      confidence: Math.min(combinedSim * 1.1, 1), // slight boost for near-identical
      reason_codes: reasons,
      signal_details: signals,
    });
  }

  // --- SUPERSEDES ---
  if (bIsLaterOrSame && combinedSim >= thresholds.supersedes_min) {
    const bHasSupersede = hasKeywords(b.title + ' ' + b.description, SUPERSEDE_KEYWORDS);
    if (bHasSupersede) {
      const reasons: EdgeReasonCode[] = ['COMBINED_TOKEN_OVERLAP', 'SUPERSEDE_KEYWORD', 'TEMPORAL_SEQUENCE'];
      const signals: Record<string, number> = {
        combined_similarity: combinedSim,
        temporal_order: 1,
        supersede_keyword: 1,
      };
      if (sameOperator) { reasons.push('SAME_OPERATOR'); signals['same_operator'] = 1; }
      if (sameCategory) { reasons.push('SAME_CATEGORY'); signals['same_category'] = 1; }

      let conf = combinedSim * 0.8 + 0.2; // base from overlap + keyword bonus
      if (sameOperator) conf = Math.min(conf + 0.05, 1);
      if (sameCategory) conf = Math.min(conf + 0.05, 1);

      candidates.push({
        edge_type: 'supersedes',
        confidence: Math.min(conf, 1),
        reason_codes: reasons,
        signal_details: signals,
      });
    }
  }

  // --- CONTRADICTS ---
  if (combinedSim >= thresholds.contradicts_min) {
    const bHasContradict = hasKeywords(b.title + ' ' + b.description, CONTRADICT_KEYWORDS);
    const aHasContradict = hasKeywords(a.title + ' ' + a.description, CONTRADICT_KEYWORDS);
    if (bHasContradict || aHasContradict) {
      const reasons: EdgeReasonCode[] = ['COMBINED_TOKEN_OVERLAP', 'CONTRADICT_KEYWORD'];
      const signals: Record<string, number> = {
        combined_similarity: combinedSim,
        contradict_keyword: 1,
      };

      const conf = combinedSim * 0.7 + 0.15;
      candidates.push({
        edge_type: 'contradicts',
        confidence: Math.min(conf, 1),
        reason_codes: reasons,
        signal_details: signals,
      });
    }
  }

  // --- CONSUMES_OUTPUT ---
  // Check if B's description or input_types reference A's output_types
  if (a.output_types && a.output_types.length > 0) {
    const bText = normalize(b.title + ' ' + b.description);
    const bInputTypes = (b.input_types ?? []).map(t => normalize(t));
    let matchCount = 0;
    let totalOutputs = a.output_types.length;

    for (const outType of a.output_types) {
      const normalizedOut = normalize(outType);
      // Check direct input_types match
      if (bInputTypes.includes(normalizedOut)) {
        matchCount++;
      }
      // Check description citation
      else if (bText.includes(normalizedOut)) {
        matchCount++;
      }
    }

    const matchRatio = totalOutputs > 0 ? matchCount / totalOutputs : 0;

    if (matchRatio >= thresholds.consumes_output_min) {
      const reasons: EdgeReasonCode[] = ['SCHEMA_FIELD_MATCH'];
      const signals: Record<string, number> = {
        output_match_ratio: matchRatio,
        matched_outputs: matchCount,
        total_outputs: totalOutputs,
      };
      if (bIsLaterOrSame) { reasons.push('TEMPORAL_SEQUENCE'); signals['temporal_order'] = 1; }

      let conf = matchRatio * 0.8 + 0.1;
      if (bIsLaterOrSame) conf = Math.min(conf + 0.1, 1);

      candidates.push({
        edge_type: 'consumes_output',
        confidence: Math.min(conf, 1),
        reason_codes: reasons,
        signal_details: signals,
      });
    }
  }

  // --- BUILDS_ON ---
  // High overlap + temporal sequencing + same operator or category
  if (bIsLaterOrSame && combinedSim >= thresholds.builds_on_min) {
    // Only if not already flagged as duplicates or supersedes
    const alreadyStronger = candidates.some(c =>
      c.edge_type === 'duplicates' || c.edge_type === 'supersedes');

    if (!alreadyStronger) {
      const reasons: EdgeReasonCode[] = [];
      const signals: Record<string, number> = {
        combined_similarity: combinedSim,
        temporal_order: 1,
      };

      if (titleSim >= 0.2) { reasons.push('TITLE_TOKEN_OVERLAP'); signals['title_similarity'] = titleSim; }
      if (descSim >= 0.2) { reasons.push('DESCRIPTION_TOKEN_OVERLAP'); signals['description_similarity'] = descSim; }
      if (reasons.length === 0) reasons.push('COMBINED_TOKEN_OVERLAP');
      reasons.push('TEMPORAL_SEQUENCE');

      if (sameOperator) { reasons.push('SAME_OPERATOR'); signals['same_operator'] = 1; }
      if (sameCategory) { reasons.push('SAME_CATEGORY'); signals['same_category'] = 1; }

      let conf = combinedSim * 0.6;
      if (sameOperator) conf += 0.15;
      if (sameCategory) conf += 0.1;
      conf = Math.min(conf + 0.05, 1); // base temporal bonus

      candidates.push({
        edge_type: 'builds_on',
        confidence: Math.min(conf, 1),
        reason_codes: reasons,
        signal_details: signals,
      });
    }
  }

  return candidates;
}

// ============================================================================
// Connected Components (Union-Find)
// ============================================================================

class UnionFind {
  private parent: Map<string, string> = new Map();
  private rank: Map<string, number> = new Map();

  add(x: string): void {
    if (!this.parent.has(x)) {
      this.parent.set(x, x);
      this.rank.set(x, 0);
    }
  }

  find(x: string): string {
    let root = x;
    while (this.parent.get(root) !== root) {
      root = this.parent.get(root)!;
    }
    // Path compression
    let current = x;
    while (current !== root) {
      const next = this.parent.get(current)!;
      this.parent.set(current, root);
      current = next;
    }
    return root;
  }

  union(x: string, y: string): void {
    const rx = this.find(x);
    const ry = this.find(y);
    if (rx === ry) return;

    const rankX = this.rank.get(rx)!;
    const rankY = this.rank.get(ry)!;
    if (rankX < rankY) {
      this.parent.set(rx, ry);
    } else if (rankX > rankY) {
      this.parent.set(ry, rx);
    } else {
      this.parent.set(ry, rx);
      this.rank.set(rx, rankX + 1);
    }
  }

  getComponents(): Map<string, string[]> {
    const components = new Map<string, string[]>();
    for (const node of this.parent.keys()) {
      const root = this.find(node);
      if (!components.has(root)) components.set(root, []);
      components.get(root)!.push(node);
    }
    // Sort members within each component for determinism
    for (const members of components.values()) {
      members.sort();
    }
    return components;
  }
}

// ============================================================================
// Chain Depth (DAG longest path)
// ============================================================================

function computeMaxChainDepth(
  taskIds: string[],
  edges: GraphEdge[]
): number {
  const taskSet = new Set(taskIds);
  const adj = new Map<string, string[]>();
  for (const id of taskIds) adj.set(id, []);

  for (const edge of edges) {
    if (taskSet.has(edge.from_task_id) && taskSet.has(edge.to_task_id)) {
      adj.get(edge.from_task_id)!.push(edge.to_task_id);
    }
  }

  const memo = new Map<string, number>();

  function dfs(node: string, visited: Set<string>): number {
    if (memo.has(node) && !visited.has(node)) return memo.get(node)!;
    if (visited.has(node)) return 0; // cycle protection

    visited.add(node);
    let maxDepth = 0;
    for (const next of adj.get(node) ?? []) {
      maxDepth = Math.max(maxDepth, 1 + dfs(next, visited));
    }
    visited.delete(node);
    memo.set(node, maxDepth);
    return maxDepth;
  }

  let globalMax = 0;
  for (const id of taskIds) {
    globalMax = Math.max(globalMax, dfs(id, new Set()));
  }
  return globalMax;
}

// ============================================================================
// Input Validation
// ============================================================================

function validateInput(input: unknown): GraphError | null {
  const inp = input as Record<string, unknown>;

  if (!inp || typeof inp !== 'object') {
    return makeError('MISSING_TASKS_ARRAY', 'Input must be an object', '');
  }

  if (!inp['as_of'] || typeof inp['as_of'] !== 'string') {
    return makeError('MISSING_AS_OF', 'as_of is required and must be a string', '');
  }

  const asOf = inp['as_of'] as string;

  if (isNaN(new Date(asOf).getTime())) {
    return makeError('INVALID_AS_OF', `as_of "${asOf}" is not a valid ISO 8601 date`, asOf);
  }

  if (!Array.isArray(inp['tasks'])) {
    return makeError('MISSING_TASKS_ARRAY', 'tasks must be an array', asOf);
  }

  const tasks = inp['tasks'] as unknown[];
  const seenIds = new Set<string>();

  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i] as Record<string, unknown>;
    if (!t || typeof t !== 'object') {
      return makeError('INVALID_TASK_RECORD', `Task at index ${i} is not an object`, asOf);
    }
    if (!t['task_id'] || typeof t['task_id'] !== 'string') {
      return makeError('INVALID_TASK_RECORD', `Task at index ${i} missing task_id`, asOf);
    }
    if (!t['title'] || typeof t['title'] !== 'string') {
      return makeError('INVALID_TASK_RECORD', `Task "${t['task_id']}" missing title`, asOf);
    }
    if (!t['description'] || typeof t['description'] !== 'string') {
      return makeError('INVALID_TASK_RECORD', `Task "${t['task_id']}" missing description`, asOf);
    }
    if (!t['created_at'] || typeof t['created_at'] !== 'string') {
      return makeError('INVALID_TASK_RECORD', `Task "${t['task_id']}" missing created_at`, asOf);
    }
    if (!t['status'] || typeof t['status'] !== 'string') {
      return makeError('INVALID_TASK_RECORD', `Task "${t['task_id']}" missing status`, asOf);
    }
    if (seenIds.has(t['task_id'] as string)) {
      return makeError('DUPLICATE_TASK_ID', `Duplicate task_id "${t['task_id']}"`, asOf);
    }
    seenIds.add(t['task_id'] as string);
  }

  return null;
}

function makeError(code: GraphError['error_code'], message: string, asOf: string): GraphError {
  return {
    generated_at: asOf || '',
    as_of: asOf || '',
    version: SCHEMA_VERSION,
    error: true,
    error_code: code,
    error_message: message,
  };
}

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Generate a deterministic cross-task reference graph from a task corpus.
 */
export function generateTaskGraph(input: GraphInput): GraphResult {
  const validationError = validateInput(input);
  if (validationError) return validationError;

  const asOf = input.as_of;
  const warnings: string[] = [];

  const thresholds: GraphThresholds = {
    ...DEFAULT_THRESHOLDS,
    ...(input.thresholds ?? {}),
  };

  const severityPolicies: SeverityPolicies = {
    ...DEFAULT_SEVERITY_POLICIES,
    ...(input.severity_policies ?? {}),
  };

  if (input.tasks.length === 0) {
    return {
      generated_at: asOf, as_of: asOf, version: SCHEMA_VERSION,
      edges: [], subgraphs: [], orphan_tasks: [], bus_factor_risks: [],
      graph_metrics: {
        total_nodes: 0, total_edges: 0, connected_components: 0,
        orphan_count: 0, maximum_chain_depth: 0,
        edge_type_counts: { builds_on: 0, consumes_output: 0, supersedes: 0, contradicts: 0, duplicates: 0 },
        avg_edges_per_node: 0,
      },
      validation_warnings: warnings, thresholds_used: thresholds, severity_policies_used: severityPolicies,
    };
  }

  // Sort tasks deterministically
  const sortedTasks = [...input.tasks].sort((a, b) => {
    const dateComp = a.created_at.localeCompare(b.created_at);
    if (dateComp !== 0) return dateComp;
    return a.task_id.localeCompare(b.task_id);
  });

  const taskMap = new Map<string, TaskRecord>();
  for (const task of sortedTasks) taskMap.set(task.task_id, task);

  // Evaluate all pairs
  const allEdges: GraphEdge[] = [];

  for (let i = 0; i < sortedTasks.length; i++) {
    for (let j = i + 1; j < sortedTasks.length; j++) {
      const a = sortedTasks[i];
      const b = sortedTasks[j];

      for (const c of evaluateEdges(a, b, thresholds)) {
        allEdges.push({
          from_task_id: a.task_id, to_task_id: b.task_id,
          edge_type: c.edge_type, confidence: roundTo4(c.confidence),
          reason_codes: c.reason_codes, signal_details: roundSignals(c.signal_details),
        });
      }

      for (const c of evaluateEdges(b, a, thresholds)) {
        const isDup = allEdges.some(e =>
          e.from_task_id === b.task_id && e.to_task_id === a.task_id && e.edge_type === c.edge_type);
        if (!isDup) {
          allEdges.push({
            from_task_id: b.task_id, to_task_id: a.task_id,
            edge_type: c.edge_type, confidence: roundTo4(c.confidence),
            reason_codes: c.reason_codes, signal_details: roundSignals(c.signal_details),
          });
        }
      }
    }
  }

  // Deduplicate: keep highest confidence per (from, to, type)
  const edgeKey = (e: GraphEdge) => `${e.edge_type}|${e.from_task_id}|${e.to_task_id}`;
  const bestEdges = new Map<string, GraphEdge>();
  for (const edge of allEdges) {
    const key = edgeKey(edge);
    const existing = bestEdges.get(key);
    if (!existing || edge.confidence > existing.confidence) bestEdges.set(key, edge);
  }

  // Sort edges deterministically
  const edges = Array.from(bestEdges.values()).sort((a, b) => {
    const typeComp = a.edge_type.localeCompare(b.edge_type);
    if (typeComp !== 0) return typeComp;
    if (a.confidence !== b.confidence) return b.confidence - a.confidence;
    const fromComp = a.from_task_id.localeCompare(b.from_task_id);
    if (fromComp !== 0) return fromComp;
    return a.to_task_id.localeCompare(b.to_task_id);
  });

  // Connected components via Union-Find
  const uf = new UnionFind();
  for (const task of sortedTasks) uf.add(task.task_id);
  for (const edge of edges) uf.union(edge.from_task_id, edge.to_task_id);
  const components = uf.getComponents();

  // Orphans
  const nodesWithEdges = new Set<string>();
  for (const edge of edges) {
    nodesWithEdges.add(edge.from_task_id);
    nodesWithEdges.add(edge.to_task_id);
  }
  const orphanTasks: string[] = [];
  for (const task of sortedTasks) {
    if (!nodesWithEdges.has(task.task_id)) orphanTasks.push(task.task_id);
  }
  orphanTasks.sort();

  // Subgraphs (non-singleton components)
  const subgraphs: Subgraph[] = [];
  const componentEntries = Array.from(components.entries())
    .filter(([_, members]) => members.length > 1)
    .sort((a, b) => {
      if (a[1].length !== b[1].length) return b[1].length - a[1].length;
      return a[1][0].localeCompare(b[1][0]);
    });

  for (let idx = 0; idx < componentEntries.length; idx++) {
    const [_, members] = componentEntries[idx];
    const subgraphId = `sg_${String(idx + 1).padStart(3, '0')}`;
    const memberSet = new Set(members);
    const subEdges = edges.filter(e => memberSet.has(e.from_task_id) && memberSet.has(e.to_task_id));

    const operatorDist: Record<string, number> = {};
    for (const id of members) {
      const op = taskMap.get(id)!.operator ?? 'unknown';
      operatorDist[op] = (operatorDist[op] ?? 0) + 1;
    }

    const catCounts: Record<string, number> = {};
    for (const id of members) {
      const cat = taskMap.get(id)!.category ?? 'uncategorized';
      catCounts[cat] = (catCounts[cat] ?? 0) + 1;
    }
    const dominantCategory = Object.entries(catCounts)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null;

    subgraphs.push({
      subgraph_id: subgraphId, task_ids: members,
      edge_count: subEdges.length,
      max_chain_depth: computeMaxChainDepth(members, edges),
      dominant_category: dominantCategory, operator_distribution: operatorDist,
    });
  }

  // Bus-factor analysis
  const busFactorRisks: BusFactorRisk[] = [];
  for (const sg of subgraphs) {
    if (sg.task_ids.length < thresholds.critical_subgraph_min_size) continue;
    for (const [operator, count] of Object.entries(sg.operator_distribution)) {
      const concentration = count / sg.task_ids.length;
      if (concentration >= thresholds.bus_factor_threshold) {
        busFactorRisks.push({
          subgraph_id: sg.subgraph_id, operator, task_count: count,
          concentration: roundTo4(concentration),
          severity: severityPolicies.bus_factor_severity,
          rationale: `Operator "${operator}" owns ${count}/${sg.task_ids.length} tasks (${(concentration * 100).toFixed(1)}%) in subgraph ${sg.subgraph_id}. Single-operator concentration above ${(thresholds.bus_factor_threshold * 100).toFixed(0)}% creates handoff risk.`,
        });
      }
    }
  }
  busFactorRisks.sort((a, b) => {
    if (a.concentration !== b.concentration) return b.concentration - a.concentration;
    const sgComp = a.subgraph_id.localeCompare(b.subgraph_id);
    if (sgComp !== 0) return sgComp;
    return a.operator.localeCompare(b.operator);
  });

  // Metrics
  const globalMaxDepth = subgraphs.length > 0
    ? Math.max(...subgraphs.map(sg => sg.max_chain_depth)) : 0;

  const edgeTypeCounts: Record<EdgeType, number> = {
    builds_on: 0, consumes_output: 0, supersedes: 0, contradicts: 0, duplicates: 0,
  };
  for (const edge of edges) edgeTypeCounts[edge.edge_type]++;

  const graphMetrics: GraphMetrics = {
    total_nodes: sortedTasks.length, total_edges: edges.length,
    connected_components: components.size, orphan_count: orphanTasks.length,
    maximum_chain_depth: globalMaxDepth, edge_type_counts: edgeTypeCounts,
    avg_edges_per_node: sortedTasks.length > 0 ? roundTo4(edges.length / sortedTasks.length) : 0,
  };

  if (orphanTasks.length > sortedTasks.length * 0.5) {
    warnings.push(`High orphan ratio: ${orphanTasks.length}/${sortedTasks.length} tasks have no connections`);
  }
  for (const task of sortedTasks) {
    if (!task.operator) warnings.push(`Task "${task.task_id}" has no operator — excluded from bus-factor analysis`);
  }

  return {
    generated_at: asOf, as_of: asOf, version: SCHEMA_VERSION,
    edges, subgraphs, orphan_tasks: orphanTasks, bus_factor_risks: busFactorRisks,
    graph_metrics: graphMetrics, validation_warnings: warnings,
    thresholds_used: thresholds, severity_policies_used: severityPolicies,
  };
}

// ============================================================================
// Utility
// ============================================================================

function roundTo4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function roundSignals(signals: Record<string, number>): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [k, v] of Object.entries(signals)) result[k] = roundTo4(v);
  return result;
}

export { DEFAULT_THRESHOLDS, DEFAULT_SEVERITY_POLICIES, SCHEMA_VERSION } from './types.js';
export type * from './types.js';
```

## Test Results

```
 ✓ tests/graph-generator.test.ts (36 tests) 40ms

 Test Files  1 passed (1)
      Tests  36 passed (36)
```

### Full Test Suite

```typescript
import { describe, it, expect } from 'vitest';
import { generateTaskGraph } from '../src/graph-generator.js';
import type { GraphInput, GraphOutput, GraphError, TaskRecord } from '../src/types.js';

const NOW = '2026-04-09T12:00:00Z';
const DAY1 = '2026-04-01T12:00:00Z';
const DAY2 = '2026-04-03T12:00:00Z';
const DAY3 = '2026-04-05T12:00:00Z';

function makeTask(overrides: Partial<TaskRecord> & { task_id: string }): TaskRecord {
  return {
    title: 'Default Task Title',
    description: 'Default task description for testing purposes.',
    status: 'outstanding',
    created_at: DAY1,
    ...overrides,
  };
}

// 1. Empty Input
describe('Empty Input', () => {
  it('returns empty graph for zero tasks', () => {
    const result = generateTaskGraph({ tasks: [], as_of: NOW }) as GraphOutput;
    expect(result.edges).toEqual([]);
    expect(result.subgraphs).toEqual([]);
    expect(result.orphan_tasks).toEqual([]);
    expect(result.graph_metrics.total_nodes).toBe(0);
    expect(result.generated_at).toBe(NOW);
  });
});

// 2. Single Task (orphan)
describe('Single Task', () => {
  it('single task is an orphan with no edges', () => {
    const result = generateTaskGraph({
      tasks: [makeTask({ task_id: 'task_001', title: 'Solo Task' })],
      as_of: NOW,
    }) as GraphOutput;
    expect(result.edges).toHaveLength(0);
    expect(result.orphan_tasks).toEqual(['task_001']);
  });
});

// 3-5. Malformed Input (5 sub-tests: missing as_of, invalid as_of, missing tasks, invalid record, duplicate IDs)
describe('Malformed Input', () => {
  it('returns error for missing as_of', () => {
    const result = generateTaskGraph({ tasks: [] } as any) as GraphError;
    expect(result.error_code).toBe('MISSING_AS_OF');
  });
  it('returns error for invalid as_of', () => {
    const result = generateTaskGraph({ tasks: [], as_of: 'not-a-date' }) as GraphError;
    expect(result.error_code).toBe('INVALID_AS_OF');
  });
  it('returns error for missing tasks array', () => {
    const result = generateTaskGraph({ as_of: NOW } as any) as GraphError;
    expect(result.error_code).toBe('MISSING_TASKS_ARRAY');
  });
  it('returns error for invalid task record', () => {
    const result = generateTaskGraph({ tasks: [{ task_id: 'x' }], as_of: NOW } as any) as GraphError;
    expect(result.error_code).toBe('INVALID_TASK_RECORD');
  });
  it('returns error for duplicate task IDs', () => {
    const result = generateTaskGraph({
      tasks: [makeTask({ task_id: 'dup' }), makeTask({ task_id: 'dup', title: 'Other' })],
      as_of: NOW,
    }) as GraphError;
    expect(result.error_code).toBe('DUPLICATE_TASK_ID');
  });
});

// 6-7. Builds_on edge detection (2 tests)
// 8-9. Consumes_output via input_types and description citation (2 tests)
// 10-11. Supersedes with v2 and "revised" keywords (2 tests)
// 12. Contradicts with "alternative to" keyword
// 13. Duplicates for near-identical tasks
// 14. Contradiction vs Duplicate disambiguation
// 15. Orphan detection with mixed connected/orphan tasks
// 16-17. Bus-factor: flagging concentrated operators + distributed operators pass
// 18-19. Deterministic sorting: byte-identical JSON + correct sort order
// 20. generated_at = as_of guarantee
// 21. Connected components grouping
// 22-23. Graph metrics: node/edge counts + type count sum
// 24. Threshold overrides change sensitivity
// 25. Severity policy overrides reflected in output
// 26. Chain depth calculation
// 27. Schema version in output
// 28-29. Validation warnings for high orphan ratio + missing operators
// 30. Subgraph metadata includes operator distribution and dominant category
// 31. Every edge has at least one reason code
// 32. All confidences in [0, 1]
// 33. Thresholds echoed in output
// 34. Large corpus stability (20 tasks, deterministic)

// [Full 36-test suite available in source repository]
```

---

*Published by Zoz via the Permanent Upper Class validator operation.*
*Task completed for the Post Fiat Network.*
