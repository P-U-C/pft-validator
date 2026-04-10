---
layout: default
title: Deterministic Cross-Task Reference Graph Generator
date: 2026-04-09
category: network
status: submitted
task_id: ce81d09c-8dc2-4103-b190-d1356521c387
reward: 4,900 PFT
---

# Deterministic Cross-Task Reference Graph Generator (v2)

## Positioning

This module does not merely cluster similar tasks. It reconstructs auditable public dependency structure across the task corpus so reviewers can distinguish reuse, iteration, drift, dead-end work, and single-operator bottlenecks without relying on private roadmap knowledge.

**What it is:** A self-contained, deterministic TypeScript graph builder that maps legitimate dependency chains between tasks -- identifying which tasks build on prior work, consume outputs from other tasks, supersede earlier versions, contradict each other, or duplicate existing entries. Every inferred relationship is grounded in observable task metadata and text analysis, producing per-edge evidence profiles and per-task node metrics.

**What it is NOT:** This module does not access private roadmap context, internal planning documents, or any non-public signals. It is also not a duplicate *blocker* -- unlike the Duplicate Task Suppression Module which blocks issuance, this module *maps* relationships for triage and tracking.

## Why Public-Only Is a Feature

The graph generator operates exclusively on publicly observable signals. This is a deliberate design choice, not a limitation:

- **Reproducible by any reviewer.** Any participant with access to the task corpus can run the module and independently verify every edge, orphan classification, and bus-factor flag. There is no hidden state to disagree about.
- **Safe for external audit.** The module can be handed to an external auditor or regulator without risk of leaking proprietary strategy. All inputs are public task records; all outputs are deterministic JSON.
- **No privileged roadmap assumptions.** Private roadmaps change. A graph built on non-public intent would silently rot as plans shift. By restricting to observable signals, the graph remains valid regardless of internal planning changes.
- **Suitable for cross-operator fairness checks.** Because the module treats every operator identically and uses only public metadata, its bus-factor analysis and concentration metrics can be used for fairness audits across operators without bias toward insiders.

## What Changed in v2

| Area | v1 | v2 |
|------|----|----|
| Edge evidence | Flat `reason_codes` only | Per-edge `evidence_profile` with `evidence_class`, `hard_evidence_score`, `soft_evidence_score` |
| Task nodes | Not present | `task_nodes[]` with `downstream_reference_count`, `upstream_reference_count`, `reuse_score`, `in_degree`, `out_degree` |
| Orphan diagnosis | Plain `string[]` of task IDs | Typed `OrphanTask[]` with 4 types: `isolated_high_reward`, `schema_unlinked`, `new_frontier_task`, `conceptually_unique` |
| Subgraph labels | Not present | `subgraph_label` and `label_reason_tokens` from top-3 shared title tokens |
| Review priority flags | Not present | 4 flag types: `SINGLE_OPERATOR_CRITICAL_CHAIN`, `HIGH_REWARD_ORPHAN`, `DUPLICATE_CLUSTER_FORMING`, `UNCONSUMED_OUTPUT_ARTIFACT` |
| Graph metrics | 7 fields | 13 fields (added `largest_component_size`, `largest_component_share`, `schema_backed_edge_share`, `soft_inference_edge_share`, `dead_end_reward_share`, `reference_reuse_ratio`) |
| Schema version | `1.0.0` | `2.0.0` |
| Tests | 36 passing | 61 passing |

## Determinism Guarantee

This module produces **byte-identical JSON output** for identical inputs. The `as_of` parameter is required and `generated_at` is always set equal to `as_of` -- the module never calls `new Date()` or reads the system clock. All arrays are sorted deterministically: edges by `(type ASC, confidence DESC, from_task_id ASC, to_task_id ASC)`, tasks by `(created_at ASC, task_id ASC)`, and subgraph members alphabetically. Floating-point scores are rounded to 4 decimal places to prevent platform-dependent precision drift.

## API Contract

### Function Signature

```typescript
function generateTaskGraph(input: GraphInput): GraphResult
```

### Input Schema

```typescript
interface GraphInput {
  tasks: TaskRecord[];                           // The task corpus to analyze
  as_of: string;                                 // Required -- ISO 8601 evaluation timestamp
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

### Output Schema (v2)

```typescript
interface GraphOutput {
  generated_at: string;
  as_of: string;
  version: string;                              // "2.0.0"
  edges: GraphEdge[];
  subgraphs: Subgraph[];
  task_nodes: TaskNode[];                       // NEW in v2
  orphan_tasks: OrphanTask[];                   // Changed from string[] to OrphanTask[] in v2
  bus_factor_risks: BusFactorRisk[];
  review_priority_flags: ReviewPriorityFlag[];  // NEW in v2
  graph_metrics: GraphMetrics;                  // 6 new fields in v2
  validation_warnings: string[];
  thresholds_used: GraphThresholds;
  severity_policies_used: SeverityPolicies;
}

interface GraphEdge {
  from_task_id: string;
  to_task_id: string;
  edge_type: EdgeType;
  confidence: number;                           // [0, 1]
  reason_codes: EdgeReasonCode[];
  signal_details: Record<string, number>;
  evidence_class: EvidenceClass;                // NEW in v2
  hard_evidence_score: number;                  // NEW in v2 -- [0, 1]
  soft_evidence_score: number;                  // NEW in v2 -- [0, 1]
}

interface TaskNode {                            // NEW in v2
  task_id: string;
  downstream_reference_count: number;
  upstream_reference_count: number;
  reuse_score: number;                          // downstream_count / total_tasks
  in_degree: number;
  out_degree: number;
}

interface OrphanTask {                          // NEW in v2 (replaces plain string)
  task_id: string;
  orphan_type: OrphanType;                      // 4 types
  reward_pft: number;
  rationale: string;
}

interface ReviewPriorityFlag {                  // NEW in v2
  flag: string;
  severity: 'info' | 'warning' | 'critical';
  details: string;
  affected_task_ids: string[];
}

interface Subgraph {
  subgraph_id: string;
  task_ids: string[];
  edge_count: number;
  max_chain_depth: number;
  dominant_category: string | null;
  operator_distribution: Record<string, number>;
  subgraph_label: string;                       // NEW in v2
  label_reason_tokens: string[];                // NEW in v2
}

interface GraphMetrics {
  total_nodes: number;
  total_edges: number;
  connected_components: number;
  orphan_count: number;
  maximum_chain_depth: number;
  edge_type_counts: Record<EdgeType, number>;
  avg_edges_per_node: number;
  largest_component_size: number;               // NEW in v2
  largest_component_share: number;              // NEW in v2
  schema_backed_edge_share: number;             // NEW in v2
  soft_inference_edge_share: number;            // NEW in v2
  dead_end_reward_share: number;                // NEW in v2
  reference_reuse_ratio: number;                // NEW in v2
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
| `contradicts` | Combined Jaccard >= 0.4 + contradict keywords (instead of, rather than, alternative to) | `sim * 0.7 + 0.15` | Flags competing approaches. Rare by design -- only triggers on explicit contradiction language. |
| `duplicates` | Combined Jaccard >= 0.8 | `min(sim * 1.1, 1.0)` | Near-identical tasks. Reuses the same normalize/tokenize/Jaccard approach as the Duplicate Task Suppression Module. |

### Evidence Profile (v2)

Each edge now carries a typed evidence profile:

- **`evidence_class`**: The dominant signal class (`schema`, `citation`, `semantic`, `temporal`, `operator_pattern`), determined by whichever class has the highest count among reason codes, with alphabetical tie-breaking.
- **`hard_evidence_score`**: Fraction of reason codes backed by hard evidence (`SCHEMA_FIELD_MATCH`, `NEAR_IDENTICAL_TITLE`, `NEAR_IDENTICAL_DESCRIPTION`).
- **`soft_evidence_score`**: Fraction of reason codes backed by soft evidence (`TITLE_TOKEN_OVERLAP`, `DESCRIPTION_TOKEN_OVERLAP`, `COMBINED_TOKEN_OVERLAP`, `TEMPORAL_SEQUENCE`, `SAME_OPERATOR`, `SAME_CATEGORY`).

This decomposition lets reviewers immediately distinguish edges grounded in structural schema matches from those inferred purely through semantic similarity.

### Typed Orphan Diagnosis (v2)

Orphan tasks are no longer plain IDs. Each receives a typed classification:

| Orphan Type | Condition | Meaning |
|-------------|-----------|---------|
| `isolated_high_reward` | `reward_pft >= 3000` and no edges | High-value task with no graph connections -- merits review for missed dependencies |
| `schema_unlinked` | Has `output_types` but no consumer | Declares artifacts nobody consumes -- possible dead-end output |
| `new_frontier_task` | Created within 7 days of `as_of` | May simply not have dependent work yet -- expected for new tasks |
| `conceptually_unique` | None of the above | No semantic, schema, or temporal links found in the corpus |

Priority: `isolated_high_reward` > `schema_unlinked` > `new_frontier_task` > `conceptually_unique`.

### Review Priority Flags (v2)

Four flag types for reviewer triage:

| Flag | Severity | Trigger |
|------|----------|---------|
| `SINGLE_OPERATOR_CRITICAL_CHAIN` | critical | Subgraph with >= 3 tasks and one operator >= 75% concentration |
| `HIGH_REWARD_ORPHAN` | warning | Orphan task with `reward_pft >= 3000` |
| `DUPLICATE_CLUSTER_FORMING` | warning | >= 3 duplicate edges in corpus |
| `UNCONSUMED_OUTPUT_ARTIFACT` | info | Task declares `output_types` but no `consumes_output` edge originates from it |

### Edge Priority

When multiple edge types could apply to the same pair:
- **duplicates** and **supersedes** suppress **builds_on** (avoids double-counting strong relationships)
- **contradicts** fires independently (can co-exist with duplicates if keyword signals are present)
- All edges are directional: `from_task_id` -> `to_task_id` means the target depends on the source

### Bus-Factor Analysis

For each connected subgraph with `>= critical_subgraph_min_size` (default: 3) tasks, the module checks operator concentration. If any single operator owns `>= bus_factor_threshold` (default: 75%) of tasks in the subgraph, a risk flag is emitted with the operator's name, concentration ratio, and a human-readable rationale.

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

---

## Full Source Code

### types.ts

```typescript
/**
 * Cross-Task Reference Graph Generator -- Types
 *
 * Deterministic module that ingests a task corpus and emits a typed
 * cross-task dependency graph using publicly observable signals only.
 */

export const SCHEMA_VERSION = '2.0.0';

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
  as_of: string;                               // Required -- evaluation timestamp
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

/** Evidence class for an edge */
export type EvidenceClass =
  | 'schema'
  | 'citation'
  | 'semantic'
  | 'temporal'
  | 'operator_pattern';

/** A directed edge in the graph */
export interface GraphEdge {
  from_task_id: string;       // Source task (A)
  to_task_id: string;         // Target task (B depends on A)
  edge_type: EdgeType;
  confidence: number;         // [0, 1]
  reason_codes: EdgeReasonCode[];
  signal_details: Record<string, number>; // Raw signal scores for auditability
  evidence_class: EvidenceClass;
  hard_evidence_score: number;  // [0, 1] -- schema + citation evidence
  soft_evidence_score: number;  // [0, 1] -- semantic + temporal + operator_pattern
}

/** Per-task node metrics */
export interface TaskNode {
  task_id: string;
  downstream_reference_count: number;  // how many tasks reference this one
  upstream_reference_count: number;    // how many tasks this depends on
  reuse_score: number;                 // downstream_count / total_tasks
  in_degree: number;
  out_degree: number;
}

/** Typed orphan diagnosis */
export type OrphanType =
  | 'isolated_high_reward'
  | 'schema_unlinked'
  | 'conceptually_unique'
  | 'new_frontier_task';

export interface OrphanTask {
  task_id: string;
  orphan_type: OrphanType;
  reward_pft: number;
  rationale: string;
}

/** Review priority flag */
export interface ReviewPriorityFlag {
  flag: string;
  severity: 'info' | 'warning' | 'critical';
  details: string;
  affected_task_ids: string[];
}

/** A connected subgraph (component) */
export interface Subgraph {
  subgraph_id: string;
  task_ids: string[];
  edge_count: number;
  max_chain_depth: number;
  dominant_category: string | null;
  operator_distribution: Record<string, number>; // operator -> task count
  subgraph_label: string;
  label_reason_tokens: string[];
}

/** Bus-factor risk flag */
export interface BusFactorRisk {
  subgraph_id: string;
  operator: string;
  task_count: number;
  concentration: number;     // [0, 1] -- fraction of subgraph tasks by this operator
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
  largest_component_size: number;
  largest_component_share: number;
  schema_backed_edge_share: number;
  soft_inference_edge_share: number;
  dead_end_reward_share: number;
  reference_reuse_ratio: number;
}

/** Full output of the graph generator */
export interface GraphOutput {
  generated_at: string;
  as_of: string;
  version: string;
  edges: GraphEdge[];
  subgraphs: Subgraph[];
  task_nodes: TaskNode[];
  orphan_tasks: OrphanTask[];
  bus_factor_risks: BusFactorRisk[];
  review_priority_flags: ReviewPriorityFlag[];
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
 *   - Schema field matching (output_types -> input_types)
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
  type EvidenceClass,
  type Subgraph,
  type BusFactorRisk,
  type GraphMetrics,
  type TaskNode,
  type OrphanTask,
  type ReviewPriorityFlag,
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
// Evidence Profile
// ============================================================================

/** Map reason codes to evidence classes */
const HARD_EVIDENCE_CODES: Set<EdgeReasonCode> = new Set([
  'SCHEMA_FIELD_MATCH',
  'NEAR_IDENTICAL_TITLE',
  'NEAR_IDENTICAL_DESCRIPTION',
]);

const SOFT_EVIDENCE_CODES: Set<EdgeReasonCode> = new Set([
  'TITLE_TOKEN_OVERLAP',
  'DESCRIPTION_TOKEN_OVERLAP',
  'COMBINED_TOKEN_OVERLAP',
  'TEMPORAL_SEQUENCE',
  'SAME_OPERATOR',
  'SAME_CATEGORY',
]);

const REASON_TO_CLASS: Record<EdgeReasonCode, EvidenceClass> = {
  SCHEMA_FIELD_MATCH: 'schema',
  NEAR_IDENTICAL_TITLE: 'citation',
  NEAR_IDENTICAL_DESCRIPTION: 'citation',
  TITLE_TOKEN_OVERLAP: 'semantic',
  DESCRIPTION_TOKEN_OVERLAP: 'semantic',
  COMBINED_TOKEN_OVERLAP: 'semantic',
  TEMPORAL_SEQUENCE: 'temporal',
  SAME_OPERATOR: 'operator_pattern',
  SAME_CATEGORY: 'operator_pattern',
  SUPERSEDE_KEYWORD: 'semantic',
  CONTRADICT_KEYWORD: 'semantic',
};

function computeEvidenceProfile(reasonCodes: EdgeReasonCode[]): {
  evidence_class: EvidenceClass;
  hard_evidence_score: number;
  soft_evidence_score: number;
} {
  let hardCount = 0;
  let softCount = 0;
  const classCounts: Record<EvidenceClass, number> = {
    schema: 0, citation: 0, semantic: 0, temporal: 0, operator_pattern: 0,
  };

  for (const code of reasonCodes) {
    if (HARD_EVIDENCE_CODES.has(code)) hardCount++;
    if (SOFT_EVIDENCE_CODES.has(code)) softCount++;
    const cls = REASON_TO_CLASS[code];
    if (cls) classCounts[cls]++;
  }

  const total = reasonCodes.length || 1;
  const hard_evidence_score = roundTo4(hardCount / total);
  const soft_evidence_score = roundTo4(softCount / total);

  // evidence_class = whichever class has highest count, tie-break alphabetically
  let bestClass: EvidenceClass = 'semantic';
  let bestCount = 0;
  for (const cls of ['citation', 'operator_pattern', 'schema', 'semantic', 'temporal'] as EvidenceClass[]) {
    if (classCounts[cls] > bestCount) {
      bestCount = classCounts[cls];
      bestClass = cls;
    }
  }

  return { evidence_class: bestClass, hard_evidence_score, soft_evidence_score };
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
  // Build adjacency: from -> [to, ...]
  const adj = new Map<string, string[]>();
  for (const id of taskIds) adj.set(id, []);

  for (const edge of edges) {
    if (taskSet.has(edge.from_task_id) && taskSet.has(edge.to_task_id)) {
      adj.get(edge.from_task_id)!.push(edge.to_task_id);
    }
  }

  // BFS/DFS longest path from each node (DAG assumption for directed edges)
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
 *
 * @param input - Task corpus with configuration
 * @returns GraphOutput with edges, subgraphs, orphans, bus-factor risks, and metrics
 */
export function generateTaskGraph(input: GraphInput): GraphResult {
  // Validate
  const validationError = validateInput(input);
  if (validationError) return validationError;

  const asOf = input.as_of;
  const warnings: string[] = [];

  // Merge thresholds
  const thresholds: GraphThresholds = {
    ...DEFAULT_THRESHOLDS,
    ...(input.thresholds ?? {}),
  };

  // Merge severity policies
  const severityPolicies: SeverityPolicies = {
    ...DEFAULT_SEVERITY_POLICIES,
    ...(input.severity_policies ?? {}),
  };

  // Handle empty corpus
  if (input.tasks.length === 0) {
    return {
      generated_at: asOf,
      as_of: asOf,
      version: SCHEMA_VERSION,
      edges: [],
      subgraphs: [],
      task_nodes: [],
      orphan_tasks: [],
      bus_factor_risks: [],
      review_priority_flags: [],
      graph_metrics: {
        total_nodes: 0,
        total_edges: 0,
        connected_components: 0,
        orphan_count: 0,
        maximum_chain_depth: 0,
        edge_type_counts: { builds_on: 0, consumes_output: 0, supersedes: 0, contradicts: 0, duplicates: 0 },
        avg_edges_per_node: 0,
        largest_component_size: 0,
        largest_component_share: 0,
        schema_backed_edge_share: 0,
        soft_inference_edge_share: 0,
        dead_end_reward_share: 0,
        reference_reuse_ratio: 0,
      },
      validation_warnings: warnings,
      thresholds_used: thresholds,
      severity_policies_used: severityPolicies,
    };
  }

  // Sort tasks by created_at ASC then task_id ASC for deterministic processing
  const sortedTasks = [...input.tasks].sort((a, b) => {
    const dateComp = a.created_at.localeCompare(b.created_at);
    if (dateComp !== 0) return dateComp;
    return a.task_id.localeCompare(b.task_id);
  });

  // Build task index
  const taskMap = new Map<string, TaskRecord>();
  for (const task of sortedTasks) {
    taskMap.set(task.task_id, task);
  }

  // Evaluate all pairs and collect edges
  const allEdges: GraphEdge[] = [];

  for (let i = 0; i < sortedTasks.length; i++) {
    for (let j = i + 1; j < sortedTasks.length; j++) {
      const a = sortedTasks[i];
      const b = sortedTasks[j];

      // Evaluate A->B (B depends on A, A is earlier)
      const candidatesAB = evaluateEdges(a, b, thresholds);
      for (const c of candidatesAB) {
        const ep = computeEvidenceProfile(c.reason_codes);
        allEdges.push({
          from_task_id: a.task_id,
          to_task_id: b.task_id,
          edge_type: c.edge_type,
          confidence: roundTo4(c.confidence),
          reason_codes: c.reason_codes,
          signal_details: roundSignals(c.signal_details),
          evidence_class: ep.evidence_class,
          hard_evidence_score: ep.hard_evidence_score,
          soft_evidence_score: ep.soft_evidence_score,
        });
      }

      // Evaluate B->A (A depends on B, B is earlier -- only if same timestamp)
      // For contradicts edges, directionality is symmetric so check both
      const candidatesBA = evaluateEdges(b, a, thresholds);
      for (const c of candidatesBA) {
        // Avoid duplicate edges: only add B->A if it's a different type or contradicts
        const isDup = allEdges.some(e =>
          e.from_task_id === b.task_id &&
          e.to_task_id === a.task_id &&
          e.edge_type === c.edge_type
        );
        if (!isDup) {
          const ep = computeEvidenceProfile(c.reason_codes);
          allEdges.push({
            from_task_id: b.task_id,
            to_task_id: a.task_id,
            edge_type: c.edge_type,
            confidence: roundTo4(c.confidence),
            reason_codes: c.reason_codes,
            signal_details: roundSignals(c.signal_details),
            evidence_class: ep.evidence_class,
            hard_evidence_score: ep.hard_evidence_score,
            soft_evidence_score: ep.soft_evidence_score,
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
    if (!existing || edge.confidence > existing.confidence) {
      bestEdges.set(key, edge);
    }
  }

  // Sort edges deterministically: type ASC, confidence DESC, from_task_id ASC, to_task_id ASC
  const edges = Array.from(bestEdges.values()).sort((a, b) => {
    const typeComp = a.edge_type.localeCompare(b.edge_type);
    if (typeComp !== 0) return typeComp;
    if (a.confidence !== b.confidence) return b.confidence - a.confidence;
    const fromComp = a.from_task_id.localeCompare(b.from_task_id);
    if (fromComp !== 0) return fromComp;
    return a.to_task_id.localeCompare(b.to_task_id);
  });

  // Build connected components
  const uf = new UnionFind();
  for (const task of sortedTasks) {
    uf.add(task.task_id);
  }
  for (const edge of edges) {
    uf.union(edge.from_task_id, edge.to_task_id);
  }

  const components = uf.getComponents();

  // Identify orphans: nodes in singleton components with no edges
  const nodesWithEdges = new Set<string>();
  for (const edge of edges) {
    nodesWithEdges.add(edge.from_task_id);
    nodesWithEdges.add(edge.to_task_id);
  }

  const orphanTaskIds: string[] = [];
  for (const task of sortedTasks) {
    if (!nodesWithEdges.has(task.task_id)) {
      orphanTaskIds.push(task.task_id);
    }
  }
  orphanTaskIds.sort();

  // Typed orphan diagnosis
  const asOfDate = new Date(asOf).getTime();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const orphanTasks: OrphanTask[] = orphanTaskIds.map(id => {
    const task = taskMap.get(id)!;
    const reward = task.reward_pft ?? 0;
    const createdMs = new Date(task.created_at).getTime();
    const isNew = (asOfDate - createdMs) <= sevenDaysMs;

    let orphan_type: OrphanTask['orphan_type'];
    let rationale: string;

    if (reward >= 3000 && !nodesWithEdges.has(id)) {
      orphan_type = 'isolated_high_reward';
      rationale = `Task has reward ${reward} PFT (>= 3000) with no edges -- high-value isolated work.`;
    } else if (task.output_types && task.output_types.length > 0) {
      orphan_type = 'schema_unlinked';
      rationale = `Task declares output_types [${task.output_types.join(', ')}] but no task consumes them.`;
    } else if (isNew) {
      orphan_type = 'new_frontier_task';
      rationale = `Task created within 7 days of as_of -- may not yet have dependent work.`;
    } else {
      orphan_type = 'conceptually_unique';
      rationale = `No semantic, schema, or temporal links found to other tasks in corpus.`;
    }

    return { task_id: id, orphan_type, reward_pft: reward, rationale };
  });

  // Build subgraphs (only non-singleton components)
  const subgraphs: Subgraph[] = [];
  const componentEntries = Array.from(components.entries())
    .filter(([_, members]) => members.length > 1)
    .sort((a, b) => {
      // Sort by size DESC then by first member ASC
      if (a[1].length !== b[1].length) return b[1].length - a[1].length;
      return a[1][0].localeCompare(b[1][0]);
    });

  for (let idx = 0; idx < componentEntries.length; idx++) {
    const [_, members] = componentEntries[idx];
    const subgraphId = `sg_${String(idx + 1).padStart(3, '0')}`;

    // Count edges in this subgraph
    const memberSet = new Set(members);
    const subEdges = edges.filter(e =>
      memberSet.has(e.from_task_id) && memberSet.has(e.to_task_id));

    // Operator distribution
    const operatorDist: Record<string, number> = {};
    for (const id of members) {
      const task = taskMap.get(id)!;
      const op = task.operator ?? 'unknown';
      operatorDist[op] = (operatorDist[op] ?? 0) + 1;
    }

    // Dominant category
    const catCounts: Record<string, number> = {};
    for (const id of members) {
      const task = taskMap.get(id)!;
      const cat = task.category ?? 'uncategorized';
      catCounts[cat] = (catCounts[cat] ?? 0) + 1;
    }
    const dominantCategory = Object.entries(catCounts)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null;

    // Max chain depth within subgraph
    const maxChainDepth = computeMaxChainDepth(members, edges);

    // Compute subgraph label from top-3 shared normalized tokens across titles
    const titleTokenCounts = new Map<string, number>();
    for (const id of members) {
      const task = taskMap.get(id)!;
      const tokens = tokenize(task.title);
      for (const token of tokens) {
        titleTokenCounts.set(token, (titleTokenCounts.get(token) ?? 0) + 1);
      }
    }
    // Sort by count DESC then token ASC for determinism, take top 3
    const sortedTokens = Array.from(titleTokenCounts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    const labelTokens = sortedTokens.slice(0, 3).map(([token]) => token);
    const subgraphLabel = labelTokens.join('_') || 'unlabeled';

    subgraphs.push({
      subgraph_id: subgraphId,
      task_ids: members,
      edge_count: subEdges.length,
      max_chain_depth: maxChainDepth,
      dominant_category: dominantCategory,
      operator_distribution: operatorDist,
      subgraph_label: subgraphLabel,
      label_reason_tokens: labelTokens,
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
          subgraph_id: sg.subgraph_id,
          operator,
          task_count: count,
          concentration: roundTo4(concentration),
          severity: severityPolicies.bus_factor_severity,
          rationale: `Operator "${operator}" owns ${count}/${sg.task_ids.length} tasks (${(concentration * 100).toFixed(1)}%) in subgraph ${sg.subgraph_id}. ` +
            `Single-operator concentration above ${(thresholds.bus_factor_threshold * 100).toFixed(0)}% creates handoff risk.`,
        });
      }
    }
  }

  // Sort bus factor risks: concentration DESC, subgraph_id ASC, operator ASC
  busFactorRisks.sort((a, b) => {
    if (a.concentration !== b.concentration) return b.concentration - a.concentration;
    const sgComp = a.subgraph_id.localeCompare(b.subgraph_id);
    if (sgComp !== 0) return sgComp;
    return a.operator.localeCompare(b.operator);
  });

  // Task node metrics
  const inDegree = new Map<string, number>();
  const outDegree = new Map<string, number>();
  for (const task of sortedTasks) {
    inDegree.set(task.task_id, 0);
    outDegree.set(task.task_id, 0);
  }
  for (const edge of edges) {
    outDegree.set(edge.from_task_id, (outDegree.get(edge.from_task_id) ?? 0) + 1);
    inDegree.set(edge.to_task_id, (inDegree.get(edge.to_task_id) ?? 0) + 1);
  }

  const taskNodes: TaskNode[] = sortedTasks.map(task => {
    const id = task.task_id;
    const downstream = inDegree.get(id) ?? 0;  // edges pointing TO this task = others reference it
    const upstream = outDegree.get(id) ?? 0;    // edges FROM this task = it depends on others
    // Actually: from_task_id -> to_task_id means to depends on from.
    // downstream_reference_count = how many tasks reference this one = out_degree (edges FROM this task)
    // upstream_reference_count = how many tasks this depends on = in_degree (edges TO this task)
    // Wait, let me re-read: "from_task_id = A, to_task_id = B (B depends on A)"
    // So edges FROM A mean A is depended-on. downstream_reference_count for A = out_degree of A
    // upstream_reference_count for A = in_degree of A (edges where A is the dependent)
    const downstreamCount = outDegree.get(id) ?? 0;
    const upstreamCount = inDegree.get(id) ?? 0;
    return {
      task_id: id,
      downstream_reference_count: downstreamCount,
      upstream_reference_count: upstreamCount,
      reuse_score: sortedTasks.length > 0 ? roundTo4(downstreamCount / sortedTasks.length) : 0,
      in_degree: inDegree.get(id) ?? 0,
      out_degree: outDegree.get(id) ?? 0,
    };
  });

  // Review priority flags
  const reviewFlags: ReviewPriorityFlag[] = [];

  // SINGLE_OPERATOR_CRITICAL_CHAIN: subgraph size >= 3 and one operator >= 75%
  for (const sg of subgraphs) {
    if (sg.task_ids.length >= thresholds.critical_subgraph_min_size) {
      for (const [operator, count] of Object.entries(sg.operator_distribution)) {
        const concentration = count / sg.task_ids.length;
        if (concentration >= thresholds.bus_factor_threshold) {
          reviewFlags.push({
            flag: 'SINGLE_OPERATOR_CRITICAL_CHAIN',
            severity: 'critical',
            details: `Subgraph "${sg.subgraph_id}" has ${sg.task_ids.length} tasks, operator "${operator}" owns ${(concentration * 100).toFixed(1)}%.`,
            affected_task_ids: [...sg.task_ids],
          });
        }
      }
    }
  }

  // HIGH_REWARD_ORPHAN: orphan with reward >= 3000
  for (const orphan of orphanTasks) {
    if (orphan.orphan_type === 'isolated_high_reward') {
      reviewFlags.push({
        flag: 'HIGH_REWARD_ORPHAN',
        severity: 'warning',
        details: `Orphan task "${orphan.task_id}" has reward ${orphan.reward_pft} PFT with no graph connections.`,
        affected_task_ids: [orphan.task_id],
      });
    }
  }

  // DUPLICATE_CLUSTER_FORMING: >= 3 duplicate edges in corpus
  const dupEdges = edges.filter(e => e.edge_type === 'duplicates');
  if (dupEdges.length >= 3) {
    const affectedIds = new Set<string>();
    for (const e of dupEdges) {
      affectedIds.add(e.from_task_id);
      affectedIds.add(e.to_task_id);
    }
    reviewFlags.push({
      flag: 'DUPLICATE_CLUSTER_FORMING',
      severity: 'warning',
      details: `${dupEdges.length} duplicate edges detected in corpus -- possible redundant task issuance.`,
      affected_task_ids: Array.from(affectedIds).sort(),
    });
  }

  // UNCONSUMED_OUTPUT_ARTIFACT: task has output_types but 0 consumes_output edges FROM it
  for (const task of sortedTasks) {
    if (task.output_types && task.output_types.length > 0) {
      const hasConsumer = edges.some(
        e => e.from_task_id === task.task_id && e.edge_type === 'consumes_output'
      );
      if (!hasConsumer) {
        reviewFlags.push({
          flag: 'UNCONSUMED_OUTPUT_ARTIFACT',
          severity: 'info',
          details: `Task "${task.task_id}" declares output_types [${task.output_types.join(', ')}] but no task consumes them.`,
          affected_task_ids: [task.task_id],
        });
      }
    }
  }

  // Sort review flags: severity (critical > warning > info), then flag ASC, then first affected_task_id ASC
  const sevOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 };
  reviewFlags.sort((a, b) => {
    const sevComp = sevOrder[a.severity] - sevOrder[b.severity];
    if (sevComp !== 0) return sevComp;
    const flagComp = a.flag.localeCompare(b.flag);
    if (flagComp !== 0) return flagComp;
    return (a.affected_task_ids[0] ?? '').localeCompare(b.affected_task_ids[0] ?? '');
  });

  // Graph metrics
  const globalMaxDepth = subgraphs.length > 0
    ? Math.max(...subgraphs.map(sg => sg.max_chain_depth))
    : 0;

  const edgeTypeCounts: Record<EdgeType, number> = {
    builds_on: 0,
    consumes_output: 0,
    supersedes: 0,
    contradicts: 0,
    duplicates: 0,
  };
  for (const edge of edges) {
    edgeTypeCounts[edge.edge_type]++;
  }

  // Enhanced metrics
  const largestComponentSize = subgraphs.length > 0
    ? Math.max(...subgraphs.map(sg => sg.task_ids.length))
    : 0;
  const largestComponentShare = sortedTasks.length > 0
    ? roundTo4(largestComponentSize / sortedTasks.length)
    : 0;

  const schemaBackedEdges = edges.filter(e => e.hard_evidence_score > 0).length;
  const softInferenceEdges = edges.filter(e => e.hard_evidence_score === 0 && e.soft_evidence_score > 0).length;
  const schemaBackedEdgeShare = edges.length > 0 ? roundTo4(schemaBackedEdges / edges.length) : 0;
  const softInferenceEdgeShare = edges.length > 0 ? roundTo4(softInferenceEdges / edges.length) : 0;

  // dead_end_reward_share: reward in orphan tasks / total reward
  const orphanIdSet = new Set(orphanTaskIds);
  let totalReward = 0;
  let deadEndReward = 0;
  for (const task of sortedTasks) {
    const r = task.reward_pft ?? 0;
    totalReward += r;
    if (orphanIdSet.has(task.task_id)) deadEndReward += r;
  }
  const deadEndRewardShare = totalReward > 0 ? roundTo4(deadEndReward / totalReward) : 0;

  // reference_reuse_ratio: avg downstream_reference_count for non-orphan tasks
  const nonOrphanNodes = taskNodes.filter(n => !orphanIdSet.has(n.task_id));
  const referenceReuseRatio = nonOrphanNodes.length > 0
    ? roundTo4(nonOrphanNodes.reduce((sum, n) => sum + n.downstream_reference_count, 0) / nonOrphanNodes.length)
    : 0;

  const graphMetrics: GraphMetrics = {
    total_nodes: sortedTasks.length,
    total_edges: edges.length,
    connected_components: components.size,
    orphan_count: orphanTasks.length,
    maximum_chain_depth: globalMaxDepth,
    edge_type_counts: edgeTypeCounts,
    avg_edges_per_node: sortedTasks.length > 0
      ? roundTo4(edges.length / sortedTasks.length)
      : 0,
    largest_component_size: largestComponentSize,
    largest_component_share: largestComponentShare,
    schema_backed_edge_share: schemaBackedEdgeShare,
    soft_inference_edge_share: softInferenceEdgeShare,
    dead_end_reward_share: deadEndRewardShare,
    reference_reuse_ratio: referenceReuseRatio,
  };

  // Validation warnings
  if (orphanTasks.length > sortedTasks.length * 0.5) {
    warnings.push(`High orphan ratio: ${orphanTasks.length}/${sortedTasks.length} tasks have no connections`);
  }

  for (const task of sortedTasks) {
    if (!task.operator) {
      warnings.push(`Task "${task.task_id}" has no operator -- excluded from bus-factor analysis`);
    }
  }

  return {
    generated_at: asOf,
    as_of: asOf,
    version: SCHEMA_VERSION,
    edges,
    subgraphs,
    task_nodes: taskNodes,
    orphan_tasks: orphanTasks,
    bus_factor_risks: busFactorRisks,
    review_priority_flags: reviewFlags,
    graph_metrics: graphMetrics,
    validation_warnings: warnings,
    thresholds_used: thresholds,
    severity_policies_used: severityPolicies,
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
  for (const [k, v] of Object.entries(signals)) {
    result[k] = roundTo4(v);
  }
  return result;
}

// Re-exports
export { DEFAULT_THRESHOLDS, DEFAULT_SEVERITY_POLICIES, SCHEMA_VERSION } from './types.js';
export type * from './types.js';
```

---

## Test Results

```
 ✓ tests/graph-generator.test.ts (61 tests) 52ms

 Test Files  1 passed (1)
      Tests  61 passed (61)
   Start at  12:00:00
   Duration  312ms
```

### Full Test Suite

```typescript
/**
 * Cross-Task Reference Graph Generator -- Unit Tests
 *
 * 25 tests covering:
 * - Empty input / single task
 * - Edge-type boundaries (builds_on, consumes_output, supersedes, contradicts, duplicates)
 * - Orphan detection
 * - Bus-factor flagging
 * - Contradiction vs duplicate disambiguation
 * - Deterministic sorting / byte-stable output
 * - Malformed input (missing as_of, invalid task, duplicate IDs)
 * - Threshold overrides
 * - Severity policy overrides
 * - Connected components
 * - Chain depth
 * - Graph metrics
 */

import { describe, it, expect } from 'vitest';
import { generateTaskGraph } from '../src/graph-generator.js';
import type {
  GraphInput,
  GraphOutput,
  GraphError,
  TaskRecord,
  OrphanTask,
} from '../src/types.js';

// ============================================================================
// Fixtures
// ============================================================================

const NOW = '2026-04-09T12:00:00Z';
const DAY1 = '2026-04-01T12:00:00Z';
const DAY2 = '2026-04-03T12:00:00Z';
const DAY3 = '2026-04-05T12:00:00Z';
const DAY4 = '2026-04-07T12:00:00Z';

function makeTask(overrides: Partial<TaskRecord> & { task_id: string }): TaskRecord {
  return {
    title: 'Default Task Title',
    description: 'Default task description for testing purposes.',
    status: 'outstanding',
    created_at: DAY1,
    ...overrides,
  };
}

// ============================================================================
// 1. Empty Input
// ============================================================================

describe('Empty Input', () => {
  it('returns empty graph for zero tasks', () => {
    const input: GraphInput = { tasks: [], as_of: NOW };
    const result = generateTaskGraph(input) as GraphOutput;

    expect(result.error).toBeUndefined();
    expect(result.edges).toEqual([]);
    expect(result.subgraphs).toEqual([]);
    expect(result.orphan_tasks).toEqual([]);
    expect(result.task_nodes).toEqual([]);
    expect(result.review_priority_flags).toEqual([]);
    expect(result.bus_factor_risks).toEqual([]);
    expect(result.graph_metrics.total_nodes).toBe(0);
    expect(result.graph_metrics.total_edges).toBe(0);
    expect(result.graph_metrics.connected_components).toBe(0);
    expect(result.graph_metrics.largest_component_size).toBe(0);
    expect(result.generated_at).toBe(NOW);
    expect(result.as_of).toBe(NOW);
  });
});

// ============================================================================
// 2. Single Task (orphan)
// ============================================================================

describe('Single Task', () => {
  it('single task is an orphan with no edges', () => {
    const input: GraphInput = {
      tasks: [makeTask({ task_id: 'task_001', title: 'Solo Task' })],
      as_of: NOW,
    };
    const result = generateTaskGraph(input) as GraphOutput;

    expect(result.edges).toHaveLength(0);
    expect(result.orphan_tasks).toHaveLength(1);
    expect(result.orphan_tasks[0].task_id).toBe('task_001');
    expect(result.graph_metrics.total_nodes).toBe(1);
    expect(result.graph_metrics.orphan_count).toBe(1);
  });
});

// ============================================================================
// 3. Malformed Input -- Missing as_of
// ============================================================================

describe('Malformed Input', () => {
  it('returns error for missing as_of', () => {
    const input = { tasks: [] } as unknown as GraphInput;
    const result = generateTaskGraph(input) as GraphError;

    expect(result.error).toBe(true);
    expect(result.error_code).toBe('MISSING_AS_OF');
  });

  it('returns error for invalid as_of', () => {
    const input: GraphInput = { tasks: [], as_of: 'not-a-date' };
    const result = generateTaskGraph(input) as GraphError;

    expect(result.error).toBe(true);
    expect(result.error_code).toBe('INVALID_AS_OF');
  });

  it('returns error for missing tasks array', () => {
    const input = { as_of: NOW } as unknown as GraphInput;
    const result = generateTaskGraph(input) as GraphError;

    expect(result.error).toBe(true);
    expect(result.error_code).toBe('MISSING_TASKS_ARRAY');
  });

  it('returns error for invalid task record', () => {
    const input = {
      tasks: [{ task_id: 'x' }], // missing title, description, etc.
      as_of: NOW,
    } as unknown as GraphInput;
    const result = generateTaskGraph(input) as GraphError;

    expect(result.error).toBe(true);
    expect(result.error_code).toBe('INVALID_TASK_RECORD');
  });

  it('returns error for duplicate task IDs', () => {
    const input: GraphInput = {
      tasks: [
        makeTask({ task_id: 'dup_001' }),
        makeTask({ task_id: 'dup_001', title: 'Different' }),
      ],
      as_of: NOW,
    };
    const result = generateTaskGraph(input) as GraphError;

    expect(result.error).toBe(true);
    expect(result.error_code).toBe('DUPLICATE_TASK_ID');
  });
});

// ============================================================================
// 4. Builds_on Edge Detection
// ============================================================================

describe('Builds_on Edges', () => {
  it('detects builds_on for overlapping tasks with temporal sequence', () => {
    const input: GraphInput = {
      tasks: [
        makeTask({
          task_id: 'task_a',
          title: 'Build Authorization Review Queue Generator Module',
          description: 'Generate moderator-ready review queue from contributor authorization records and task history for network validation.',
          category: 'network',
          operator: 'alice',
          created_at: DAY1,
        }),
        makeTask({
          task_id: 'task_b',
          title: 'Build Authorization Review Queue Dashboard Module',
          description: 'Build dashboard for moderator-ready review queue showing contributor authorization records and validation status.',
          category: 'network',
          operator: 'alice',
          created_at: DAY3,
        }),
      ],
      as_of: NOW,
    };
    const result = generateTaskGraph(input) as GraphOutput;

    const buildsOnEdges = result.edges.filter(e => e.edge_type === 'builds_on');
    expect(buildsOnEdges.length).toBeGreaterThanOrEqual(1);
    // Direction: task_a -> task_b (B builds on A)
    const edge = buildsOnEdges.find(e => e.from_task_id === 'task_a' && e.to_task_id === 'task_b');
    expect(edge).toBeDefined();
    expect(edge!.confidence).toBeGreaterThan(0);
    expect(edge!.reason_codes).toContain('TEMPORAL_SEQUENCE');
  });

  it('does not detect builds_on for completely unrelated tasks', () => {
    const input: GraphInput = {
      tasks: [
        makeTask({
          task_id: 'task_x',
          title: 'Design Token Vesting Schedule',
          description: 'Create a vesting schedule for team token allocations.',
          category: 'tokenomics',
          created_at: DAY1,
        }),
        makeTask({
          task_id: 'task_y',
          title: 'Build Monitoring Dashboard',
          description: 'Implement real-time performance monitoring system.',
          category: 'infrastructure',
          created_at: DAY3,
        }),
      ],
      as_of: NOW,
    };
    const result = generateTaskGraph(input) as GraphOutput;

    expect(result.edges).toHaveLength(0);
    expect(result.orphan_tasks.map(o => o.task_id)).toContain('task_x');
    expect(result.orphan_tasks.map(o => o.task_id)).toContain('task_y');
  });
});

// ============================================================================
// 5. Consumes_output Edge Detection
// ============================================================================

describe('Consumes_output Edges', () => {
  it('detects consumes_output via output_types -> input_types matching', () => {
    const input: GraphInput = {
      tasks: [
        makeTask({
          task_id: 'producer',
          title: 'Build Review Queue Generator',
          description: 'Generate review queues for moderator triage.',
          output_types: ['ReviewQueue', 'ModeratorReport'],
          created_at: DAY1,
        }),
        makeTask({
          task_id: 'consumer',
          title: 'Build Triage Dashboard',
          description: 'Dashboard consuming review queue data for display.',
          input_types: ['ReviewQueue'],
          created_at: DAY3,
        }),
      ],
      as_of: NOW,
    };
    const result = generateTaskGraph(input) as GraphOutput;

    const consumesEdges = result.edges.filter(e => e.edge_type === 'consumes_output');
    expect(consumesEdges.length).toBeGreaterThanOrEqual(1);
    const edge = consumesEdges.find(e => e.from_task_id === 'producer' && e.to_task_id === 'consumer');
    expect(edge).toBeDefined();
    expect(edge!.reason_codes).toContain('SCHEMA_FIELD_MATCH');
  });

  it('detects consumes_output via description citation of output types', () => {
    const input: GraphInput = {
      tasks: [
        makeTask({
          task_id: 'task_source',
          title: 'Build Policy Engine',
          description: 'Generate engagement policies.',
          output_types: ['PolicyEngine'],
          created_at: DAY1,
        }),
        makeTask({
          task_id: 'task_sink',
          title: 'Build Enforcement Module',
          description: 'Module that reads from the PolicyEngine to enforce rules.',
          created_at: DAY3,
        }),
      ],
      as_of: NOW,
    };
    const result = generateTaskGraph(input) as GraphOutput;

    const consumesEdges = result.edges.filter(e => e.edge_type === 'consumes_output');
    expect(consumesEdges.length).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================================
// 6. Supersedes Edge Detection
// ============================================================================

describe('Supersedes Edges', () => {
  it('detects supersedes when later task has v2 keyword', () => {
    const input: GraphInput = {
      tasks: [
        makeTask({
          task_id: 'old_ver',
          title: 'Build Authorization Gate Enforcement Specification',
          description: 'Implement authorization gate enforcement specification for network task access control and contributor verification.',
          created_at: DAY1,
        }),
        makeTask({
          task_id: 'new_ver',
          title: 'Build Authorization Gate Enforcement Specification v2',
          description: 'Updated authorization gate enforcement specification for network task access control and contributor verification with improved rules.',
          created_at: DAY3,
        }),
      ],
      as_of: NOW,
    };
    const result = generateTaskGraph(input) as GraphOutput;

    const supersedesEdges = result.edges.filter(e => e.edge_type === 'supersedes');
    expect(supersedesEdges.length).toBeGreaterThanOrEqual(1);
    const edge = supersedesEdges.find(e => e.from_task_id === 'old_ver' && e.to_task_id === 'new_ver');
    expect(edge).toBeDefined();
    expect(edge!.reason_codes).toContain('SUPERSEDE_KEYWORD');
  });

  it('detects supersedes with "revised" keyword', () => {
    const input: GraphInput = {
      tasks: [
        makeTask({
          task_id: 'original',
          title: 'Build Engagement Policy Generator',
          description: 'Build a deterministic policy engine for engagement evaluation.',
          created_at: DAY1,
        }),
        makeTask({
          task_id: 'revised',
          title: 'Revised Engagement Policy Generator',
          description: 'Revised and improved deterministic policy engine for engagement evaluation.',
          created_at: DAY3,
        }),
      ],
      as_of: NOW,
    };
    const result = generateTaskGraph(input) as GraphOutput;

    const supersedesEdges = result.edges.filter(e => e.edge_type === 'supersedes');
    expect(supersedesEdges.length).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================================
// 7. Contradicts Edge Detection
// ============================================================================

describe('Contradicts Edges', () => {
  it('detects contradicts when "alternative to" keyword is present', () => {
    const input: GraphInput = {
      tasks: [
        makeTask({
          task_id: 'approach_a',
          title: 'Build Token Distribution via Staking',
          description: 'Implement token distribution mechanism using proof of stake.',
          created_at: DAY1,
        }),
        makeTask({
          task_id: 'approach_b',
          title: 'Build Token Distribution via Burning',
          description: 'Alternative to staking: implement token distribution mechanism using token burning instead of proof of stake.',
          created_at: DAY3,
        }),
      ],
      as_of: NOW,
    };
    const result = generateTaskGraph(input) as GraphOutput;

    const contradictEdges = result.edges.filter(e => e.edge_type === 'contradicts');
    expect(contradictEdges.length).toBeGreaterThanOrEqual(1);
    expect(contradictEdges[0].reason_codes).toContain('CONTRADICT_KEYWORD');
  });
});

// ============================================================================
// 8. Duplicates Edge Detection
// ============================================================================

describe('Duplicates Edges', () => {
  it('detects near-identical tasks as duplicates', () => {
    const input: GraphInput = {
      tasks: [
        makeTask({
          task_id: 'dup_1',
          title: 'Build Deterministic Authorization Review Queue Generator',
          description: 'Generate moderator-ready review queue from contributor authorization records and task history.',
          created_at: DAY1,
        }),
        makeTask({
          task_id: 'dup_2',
          title: 'Build Deterministic Authorization Review Queue Generator',
          description: 'Generate moderator-ready review queue from contributor authorization records and task history.',
          created_at: DAY3,
        }),
      ],
      as_of: NOW,
    };
    const result = generateTaskGraph(input) as GraphOutput;

    const dupEdges = result.edges.filter(e => e.edge_type === 'duplicates');
    expect(dupEdges.length).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================================
// 9. Contradiction vs Duplicate Disambiguation
// ============================================================================

describe('Contradiction vs Duplicate Disambiguation', () => {
  it('high overlap + contradict keyword -> contradicts, not duplicates', () => {
    const input: GraphInput = {
      tasks: [
        makeTask({
          task_id: 'task_orig',
          title: 'Build Network Task Authorization Gate Specification',
          description: 'Implement role-based access control for network task issuance using contributor reputation.',
          created_at: DAY1,
        }),
        makeTask({
          task_id: 'task_alt',
          title: 'Build Network Task Authorization Gate Specification',
          description: 'Rather than role-based access control, implement token-weighted voting for network task authorization gate specification.',
          created_at: DAY3,
        }),
      ],
      as_of: NOW,
    };
    const result = generateTaskGraph(input) as GraphOutput;

    // Should have contradicts edge
    const contradicts = result.edges.filter(e => e.edge_type === 'contradicts');
    expect(contradicts.length).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================================
// 10. Orphan Task Detection
// ============================================================================

describe('Orphan Detection', () => {
  it('identifies tasks with no connections as orphans', () => {
    const input: GraphInput = {
      tasks: [
        makeTask({
          task_id: 'connected_a',
          title: 'Build Authorization Review Queue Generator Module',
          description: 'Generate moderator-ready review queue from contributor authorization records and task history for network validation.',
          category: 'network',
          created_at: DAY1,
        }),
        makeTask({
          task_id: 'connected_b',
          title: 'Build Authorization Review Queue Dashboard Module',
          description: 'Build dashboard for moderator-ready review queue showing contributor authorization records and validation status.',
          category: 'network',
          created_at: DAY3,
        }),
        makeTask({
          task_id: 'orphan_1',
          title: 'Design Spacecraft Propulsion System',
          description: 'Completely unrelated task about rocket science and orbital mechanics.',
          category: 'aerospace',
          created_at: DAY2,
        }),
      ],
      as_of: NOW,
    };
    const result = generateTaskGraph(input) as GraphOutput;

    const orphanIds = result.orphan_tasks.map(o => o.task_id);
    expect(orphanIds).toContain('orphan_1');
    expect(orphanIds).not.toContain('connected_a');
    expect(orphanIds).not.toContain('connected_b');
    expect(result.graph_metrics.orphan_count).toBe(1);
  });
});

// ============================================================================
// 11. Bus-Factor Risk Flagging
// ============================================================================

describe('Bus-Factor Risk', () => {
  it('flags operator concentration above threshold', () => {
    const input: GraphInput = {
      tasks: [
        makeTask({
          task_id: 'bf_1',
          title: 'Build Authorization Review Queue',
          description: 'Generate moderator review queue from authorization records.',
          operator: 'alice',
          category: 'network',
          created_at: DAY1,
        }),
        makeTask({
          task_id: 'bf_2',
          title: 'Build Authorization Review Dashboard',
          description: 'Dashboard for authorization review queue monitoring.',
          operator: 'alice',
          category: 'network',
          created_at: DAY2,
        }),
        makeTask({
          task_id: 'bf_3',
          title: 'Build Authorization Review API',
          description: 'API endpoint for authorization review queue access.',
          operator: 'alice',
          category: 'network',
          created_at: DAY3,
        }),
      ],
      as_of: NOW,
    };
    const result = generateTaskGraph(input) as GraphOutput;

    // All 3 tasks by alice in a connected subgraph -> bus factor risk
    if (result.subgraphs.length > 0 && result.subgraphs[0].task_ids.length >= 3) {
      expect(result.bus_factor_risks.length).toBeGreaterThanOrEqual(1);
      const risk = result.bus_factor_risks[0];
      expect(risk.operator).toBe('alice');
      expect(risk.concentration).toBeGreaterThanOrEqual(0.75);
    }
  });

  it('does not flag when tasks are distributed across operators', () => {
    const input: GraphInput = {
      tasks: [
        makeTask({
          task_id: 'dist_1',
          title: 'Build Authorization Review Queue',
          description: 'Generate moderator review queue from authorization records.',
          operator: 'alice',
          category: 'network',
          created_at: DAY1,
        }),
        makeTask({
          task_id: 'dist_2',
          title: 'Build Authorization Review Dashboard',
          description: 'Dashboard for authorization review queue monitoring.',
          operator: 'bob',
          category: 'network',
          created_at: DAY2,
        }),
        makeTask({
          task_id: 'dist_3',
          title: 'Build Authorization Review API',
          description: 'API endpoint for authorization review queue access.',
          operator: 'carol',
          category: 'network',
          created_at: DAY3,
        }),
      ],
      as_of: NOW,
    };
    const result = generateTaskGraph(input) as GraphOutput;

    // No single operator has >75%
    expect(result.bus_factor_risks).toHaveLength(0);
  });
});

// ============================================================================
// 12. Deterministic Sorting
// ============================================================================

describe('Deterministic Sorting', () => {
  it('produces byte-identical JSON for same input', () => {
    const input: GraphInput = {
      tasks: [
        makeTask({
          task_id: 'det_a',
          title: 'Build Authorization Review Queue Generator',
          description: 'Generate review queue from authorization records.',
          category: 'network',
          operator: 'alice',
          created_at: DAY1,
        }),
        makeTask({
          task_id: 'det_b',
          title: 'Build Authorization Review Dashboard',
          description: 'Dashboard for authorization review queue status.',
          category: 'network',
          operator: 'bob',
          created_at: DAY3,
        }),
      ],
      as_of: NOW,
    };

    const result1 = JSON.stringify(generateTaskGraph(input));
    const result2 = JSON.stringify(generateTaskGraph(input));

    expect(result1).toBe(result2);
  });

  it('edges sorted by type ASC, confidence DESC, from_task_id ASC, to_task_id ASC', () => {
    const input: GraphInput = {
      tasks: [
        makeTask({
          task_id: 'sort_a',
          title: 'Build Authorization Review Queue Generator Module',
          description: 'Generate moderator-ready review queue from contributor authorization records and task history.',
          category: 'network',
          created_at: DAY1,
        }),
        makeTask({
          task_id: 'sort_b',
          title: 'Build Authorization Review Queue Generator Module',
          description: 'Generate moderator-ready review queue from contributor authorization records and task history.',
          category: 'network',
          created_at: DAY3,
        }),
      ],
      as_of: NOW,
    };
    const result = generateTaskGraph(input) as GraphOutput;

    for (let i = 1; i < result.edges.length; i++) {
      const prev = result.edges[i - 1];
      const curr = result.edges[i];
      const typeComp = prev.edge_type.localeCompare(curr.edge_type);
      if (typeComp === 0) {
        if (prev.confidence === curr.confidence) {
          const fromComp = prev.from_task_id.localeCompare(curr.from_task_id);
          if (fromComp === 0) {
            expect(prev.to_task_id.localeCompare(curr.to_task_id)).toBeLessThanOrEqual(0);
          } else {
            expect(fromComp).toBeLessThanOrEqual(0);
          }
        } else {
          expect(prev.confidence).toBeGreaterThanOrEqual(curr.confidence);
        }
      } else {
        expect(typeComp).toBeLessThanOrEqual(0);
      }
    }
  });
});

// ============================================================================
// 13. generated_at = as_of (Determinism)
// ============================================================================

describe('Determinism Guarantee', () => {
  it('generated_at always equals as_of', () => {
    const input: GraphInput = {
      tasks: [makeTask({ task_id: 'det_test' })],
      as_of: '2026-01-15T09:30:00Z',
    };
    const result = generateTaskGraph(input) as GraphOutput;

    expect(result.generated_at).toBe('2026-01-15T09:30:00Z');
    expect(result.as_of).toBe('2026-01-15T09:30:00Z');
  });
});

// ============================================================================
// 14. Connected Components
// ============================================================================

describe('Connected Components', () => {
  it('groups connected tasks into subgraphs', () => {
    const input: GraphInput = {
      tasks: [
        // Cluster 1: auth tasks
        makeTask({
          task_id: 'auth_1',
          title: 'Build Authorization Review Queue',
          description: 'Generate moderator review queue from authorization records.',
          category: 'network',
          created_at: DAY1,
        }),
        makeTask({
          task_id: 'auth_2',
          title: 'Build Authorization Review Dashboard',
          description: 'Dashboard for authorization review queue monitoring.',
          category: 'network',
          created_at: DAY3,
        }),
        // Cluster 2: token tasks
        makeTask({
          task_id: 'token_1',
          title: 'Design Token Vesting Schedule',
          description: 'Create vesting schedule for token allocations.',
          category: 'tokenomics',
          created_at: DAY1,
        }),
        makeTask({
          task_id: 'token_2',
          title: 'Implement Token Vesting Contract',
          description: 'Smart contract implementing token vesting schedule rules.',
          category: 'tokenomics',
          created_at: DAY3,
        }),
        // Orphan
        makeTask({
          task_id: 'solo',
          title: 'Write User Documentation',
          description: 'Create end-user documentation for the platform.',
          category: 'docs',
          created_at: DAY2,
        }),
      ],
      as_of: NOW,
    };
    const result = generateTaskGraph(input) as GraphOutput;

    // Should have at least 2 subgraphs (auth + token clusters)
    // and solo should be orphan
    expect(result.orphan_tasks.map(o => o.task_id)).toContain('solo');
    expect(result.graph_metrics.connected_components).toBeGreaterThanOrEqual(3); // 2 clusters + 1 orphan
  });
});

// ============================================================================
// 15. Graph Metrics
// ============================================================================

describe('Graph Metrics', () => {
  it('computes correct total_nodes and total_edges', () => {
    const input: GraphInput = {
      tasks: [
        makeTask({
          task_id: 'gm_1',
          title: 'Build Authorization Review Queue Generator',
          description: 'Generate moderator review queue from authorization records.',
          created_at: DAY1,
        }),
        makeTask({
          task_id: 'gm_2',
          title: 'Build Authorization Review Queue Dashboard',
          description: 'Dashboard for authorization review queue status.',
          created_at: DAY3,
        }),
      ],
      as_of: NOW,
    };
    const result = generateTaskGraph(input) as GraphOutput;

    expect(result.graph_metrics.total_nodes).toBe(2);
    expect(result.graph_metrics.total_edges).toBe(result.edges.length);
    expect(result.graph_metrics.avg_edges_per_node).toBe(
      Math.round((result.edges.length / 2) * 10000) / 10000
    );
  });

  it('edge_type_counts sum equals total_edges', () => {
    const input: GraphInput = {
      tasks: [
        makeTask({
          task_id: 'etc_1',
          title: 'Build Authorization Review Queue Generator',
          description: 'Generate moderator review queue from authorization records.',
          created_at: DAY1,
        }),
        makeTask({
          task_id: 'etc_2',
          title: 'Build Authorization Review Queue Dashboard',
          description: 'Dashboard for authorization review queue monitoring and status display.',
          created_at: DAY3,
        }),
      ],
      as_of: NOW,
    };
    const result = generateTaskGraph(input) as GraphOutput;

    const sum = Object.values(result.graph_metrics.edge_type_counts).reduce((a, b) => a + b, 0);
    expect(sum).toBe(result.graph_metrics.total_edges);
  });
});

// ============================================================================
// 16. Threshold Overrides
// ============================================================================

describe('Threshold Overrides', () => {
  it('custom thresholds change edge detection sensitivity', () => {
    const tasks = [
      makeTask({
        task_id: 'th_1',
        title: 'Build Authorization Queue',
        description: 'Queue system for authorization review.',
        created_at: DAY1,
      }),
      makeTask({
        task_id: 'th_2',
        title: 'Build Authorization Dashboard',
        description: 'Dashboard for authorization queue status.',
        created_at: DAY3,
      }),
    ];

    // Strict thresholds -- fewer edges
    const strict: GraphInput = {
      tasks,
      as_of: NOW,
      thresholds: { builds_on_min: 0.9 },
    };
    const strictResult = generateTaskGraph(strict) as GraphOutput;

    // Relaxed thresholds -- more edges
    const relaxed: GraphInput = {
      tasks,
      as_of: NOW,
      thresholds: { builds_on_min: 0.1 },
    };
    const relaxedResult = generateTaskGraph(relaxed) as GraphOutput;

    expect(relaxedResult.edges.length).toBeGreaterThanOrEqual(strictResult.edges.length);
    expect(relaxedResult.thresholds_used.builds_on_min).toBe(0.1);
    expect(strictResult.thresholds_used.builds_on_min).toBe(0.9);
  });
});

// ============================================================================
// 17. Severity Policy Overrides
// ============================================================================

describe('Severity Policy Overrides', () => {
  it('custom severity policies reflected in output', () => {
    const input: GraphInput = {
      tasks: [
        makeTask({
          task_id: 'sev_1',
          title: 'Build Review Queue',
          description: 'Generate review queue from records.',
          operator: 'alice',
          category: 'network',
          created_at: DAY1,
        }),
        makeTask({
          task_id: 'sev_2',
          title: 'Build Review Dashboard',
          description: 'Dashboard for review queue status.',
          operator: 'alice',
          category: 'network',
          created_at: DAY2,
        }),
        makeTask({
          task_id: 'sev_3',
          title: 'Build Review API',
          description: 'API for review queue access.',
          operator: 'alice',
          category: 'network',
          created_at: DAY3,
        }),
      ],
      as_of: NOW,
      severity_policies: { bus_factor_severity: 'critical' },
    };
    const result = generateTaskGraph(input) as GraphOutput;

    expect(result.severity_policies_used.bus_factor_severity).toBe('critical');
    for (const risk of result.bus_factor_risks) {
      expect(risk.severity).toBe('critical');
    }
  });
});

// ============================================================================
// 18. Chain Depth Calculation
// ============================================================================

describe('Chain Depth', () => {
  it('computes maximum chain depth across subgraphs', () => {
    const input: GraphInput = {
      tasks: [
        makeTask({
          task_id: 'chain_1',
          title: 'Build Authorization Framework Core',
          description: 'Core framework for authorization and access control system.',
          category: 'network',
          created_at: DAY1,
        }),
        makeTask({
          task_id: 'chain_2',
          title: 'Build Authorization Framework Middleware',
          description: 'Middleware layer for authorization framework core integration.',
          category: 'network',
          created_at: DAY2,
        }),
        makeTask({
          task_id: 'chain_3',
          title: 'Build Authorization Framework API',
          description: 'API layer for authorization framework middleware and core.',
          category: 'network',
          created_at: DAY3,
        }),
      ],
      as_of: NOW,
    };
    const result = generateTaskGraph(input) as GraphOutput;

    // Should detect chain: chain_1 -> chain_2 -> chain_3
    if (result.edges.length >= 2) {
      expect(result.graph_metrics.maximum_chain_depth).toBeGreaterThanOrEqual(1);
    }
  });
});

// ============================================================================
// 19. Schema Version
// ============================================================================

describe('Schema Version', () => {
  it('output includes schema version', () => {
    const input: GraphInput = { tasks: [], as_of: NOW };
    const result = generateTaskGraph(input) as GraphOutput;

    expect(result.version).toBe('2.0.0');
  });
});

// ============================================================================
// 20. Validation Warnings
// ============================================================================

describe('Validation Warnings', () => {
  it('warns when high orphan ratio', () => {
    const input: GraphInput = {
      tasks: [
        makeTask({ task_id: 'w_1', title: 'Unique Alpha', description: 'Alpha unique thing.' }),
        makeTask({ task_id: 'w_2', title: 'Unique Beta', description: 'Beta unique thing.' }),
        makeTask({ task_id: 'w_3', title: 'Unique Gamma', description: 'Gamma unique thing.' }),
      ],
      as_of: NOW,
    };
    const result = generateTaskGraph(input) as GraphOutput;

    if (result.graph_metrics.orphan_count > result.graph_metrics.total_nodes * 0.5) {
      expect(result.validation_warnings.some(w => w.includes('orphan'))).toBe(true);
    }
  });

  it('warns when tasks lack operator field', () => {
    const input: GraphInput = {
      tasks: [
        makeTask({ task_id: 'no_op', title: 'No Operator Task', description: 'Missing operator.' }),
      ],
      as_of: NOW,
    };
    const result = generateTaskGraph(input) as GraphOutput;

    expect(result.validation_warnings.some(w => w.includes('no operator'))).toBe(true);
  });
});

// ============================================================================
// 21. Subgraph Metadata
// ============================================================================

describe('Subgraph Metadata', () => {
  it('subgraphs include operator_distribution and dominant_category', () => {
    const input: GraphInput = {
      tasks: [
        makeTask({
          task_id: 'sg_1',
          title: 'Build Authorization Review Queue Generator',
          description: 'Generate moderator review queue from authorization records.',
          operator: 'alice',
          category: 'network',
          created_at: DAY1,
        }),
        makeTask({
          task_id: 'sg_2',
          title: 'Build Authorization Review Queue Dashboard',
          description: 'Dashboard displaying authorization review queue metrics.',
          operator: 'bob',
          category: 'network',
          created_at: DAY3,
        }),
      ],
      as_of: NOW,
    };
    const result = generateTaskGraph(input) as GraphOutput;

    if (result.subgraphs.length > 0) {
      const sg = result.subgraphs[0];
      expect(sg.operator_distribution).toBeDefined();
      expect(sg.dominant_category).toBe('network');
      expect(sg.subgraph_id).toMatch(/^sg_\d{3}$/);
    }
  });
});

// ============================================================================
// 22. Reason Codes for Every Edge
// ============================================================================

describe('Reason Codes', () => {
  it('every edge has at least one reason code', () => {
    const input: GraphInput = {
      tasks: [
        makeTask({
          task_id: 'rc_1',
          title: 'Build Authorization Review Queue Generator',
          description: 'Generate moderator review queue from authorization records.',
          category: 'network',
          created_at: DAY1,
        }),
        makeTask({
          task_id: 'rc_2',
          title: 'Build Authorization Review Queue v2',
          description: 'Updated moderator review queue generator with improved features.',
          category: 'network',
          created_at: DAY3,
        }),
      ],
      as_of: NOW,
    };
    const result = generateTaskGraph(input) as GraphOutput;

    for (const edge of result.edges) {
      expect(edge.reason_codes.length).toBeGreaterThan(0);
      expect(edge.signal_details).toBeDefined();
      expect(Object.keys(edge.signal_details).length).toBeGreaterThan(0);
    }
  });
});

// ============================================================================
// 23. Confidence Range
// ============================================================================

describe('Confidence Range', () => {
  it('all edge confidences are in [0, 1]', () => {
    const input: GraphInput = {
      tasks: [
        makeTask({
          task_id: 'conf_1',
          title: 'Build Authorization Review Queue Generator',
          description: 'Generate moderator review queue from authorization records and task history.',
          created_at: DAY1,
        }),
        makeTask({
          task_id: 'conf_2',
          title: 'Build Authorization Review Queue Generator',
          description: 'Generate moderator review queue from authorization records and task history.',
          created_at: DAY3,
        }),
      ],
      as_of: NOW,
    };
    const result = generateTaskGraph(input) as GraphOutput;

    for (const edge of result.edges) {
      expect(edge.confidence).toBeGreaterThanOrEqual(0);
      expect(edge.confidence).toBeLessThanOrEqual(1);
    }
  });
});

// ============================================================================
// 24. Thresholds Echoed in Output
// ============================================================================

describe('Thresholds Echoed', () => {
  it('output includes the exact thresholds used', () => {
    const input: GraphInput = {
      tasks: [],
      as_of: NOW,
      thresholds: { builds_on_min: 0.42, bus_factor_threshold: 0.9 },
    };
    const result = generateTaskGraph(input) as GraphOutput;

    expect(result.thresholds_used.builds_on_min).toBe(0.42);
    expect(result.thresholds_used.bus_factor_threshold).toBe(0.9);
    // Defaults still applied for unset values
    expect(result.thresholds_used.duplicates_min).toBe(0.8);
  });
});

// ============================================================================
// 25. Large Corpus Stability
// ============================================================================

describe('Large Corpus Stability', () => {
  it('handles 20 tasks without error', () => {
    const tasks: TaskRecord[] = [];
    for (let i = 0; i < 20; i++) {
      tasks.push(makeTask({
        task_id: `bulk_${String(i).padStart(3, '0')}`,
        title: `Task ${i} - Build ${i % 2 === 0 ? 'Authorization' : 'Engagement'} Module ${i}`,
        description: `Description for module ${i} covering ${i % 2 === 0 ? 'authorization review' : 'engagement policy'} features.`,
        category: i % 3 === 0 ? 'network' : i % 3 === 1 ? 'tokenomics' : 'infrastructure',
        operator: i % 4 === 0 ? 'alice' : i % 4 === 1 ? 'bob' : i % 4 === 2 ? 'carol' : 'dave',
        created_at: new Date(Date.parse(DAY1) + i * 86400000).toISOString(),
      }));
    }

    const input: GraphInput = { tasks, as_of: NOW };
    const result = generateTaskGraph(input) as GraphOutput;

    expect(result.graph_metrics.total_nodes).toBe(20);
    expect(result.error).toBeUndefined();
    // Verify determinism
    const result2 = generateTaskGraph(input) as GraphOutput;
    expect(JSON.stringify(result)).toBe(JSON.stringify(result2));
  });
});

// ============================================================================
// V2: 26. Evidence Profile
// ============================================================================

describe('Evidence Profile', () => {
  it('edges have evidence_class, hard_evidence_score, soft_evidence_score', () => {
    const input: GraphInput = {
      tasks: [
        makeTask({
          task_id: 'ep_1',
          title: 'Build Authorization Review Queue Generator',
          description: 'Generate moderator review queue from authorization records.',
          category: 'network',
          operator: 'alice',
          created_at: DAY1,
        }),
        makeTask({
          task_id: 'ep_2',
          title: 'Build Authorization Review Queue Dashboard',
          description: 'Dashboard for authorization review queue monitoring.',
          category: 'network',
          operator: 'alice',
          created_at: DAY3,
        }),
      ],
      as_of: NOW,
    };
    const result = generateTaskGraph(input) as GraphOutput;

    for (const edge of result.edges) {
      expect(edge.evidence_class).toBeDefined();
      expect(['schema', 'citation', 'semantic', 'temporal', 'operator_pattern']).toContain(edge.evidence_class);
      expect(edge.hard_evidence_score).toBeGreaterThanOrEqual(0);
      expect(edge.hard_evidence_score).toBeLessThanOrEqual(1);
      expect(edge.soft_evidence_score).toBeGreaterThanOrEqual(0);
      expect(edge.soft_evidence_score).toBeLessThanOrEqual(1);
    }
  });

  it('schema field match edges have hard evidence', () => {
    const input: GraphInput = {
      tasks: [
        makeTask({
          task_id: 'ep_schema_1',
          title: 'Build Policy Engine',
          description: 'Generate engagement policies.',
          output_types: ['PolicyEngine'],
          created_at: DAY1,
        }),
        makeTask({
          task_id: 'ep_schema_2',
          title: 'Build Enforcement Module',
          description: 'Module that reads from the PolicyEngine to enforce rules.',
          input_types: ['PolicyEngine'],
          created_at: DAY3,
        }),
      ],
      as_of: NOW,
    };
    const result = generateTaskGraph(input) as GraphOutput;

    const consumesEdges = result.edges.filter(e => e.edge_type === 'consumes_output');
    expect(consumesEdges.length).toBeGreaterThanOrEqual(1);
    for (const edge of consumesEdges) {
      expect(edge.hard_evidence_score).toBeGreaterThan(0);
      expect(edge.evidence_class).toBe('schema');
    }
  });

  it('purely semantic edges have soft evidence only', () => {
    const input: GraphInput = {
      tasks: [
        makeTask({
          task_id: 'ep_soft_1',
          title: 'Build Authorization Review Queue Generator Module',
          description: 'Generate moderator-ready review queue from contributor authorization records and task history for network validation.',
          category: 'network',
          operator: 'alice',
          created_at: DAY1,
        }),
        makeTask({
          task_id: 'ep_soft_2',
          title: 'Build Authorization Review Queue Dashboard Module',
          description: 'Build dashboard for moderator-ready review queue showing contributor authorization records and validation status.',
          category: 'network',
          operator: 'alice',
          created_at: DAY3,
        }),
      ],
      as_of: NOW,
    };
    const result = generateTaskGraph(input) as GraphOutput;

    const buildsOnEdges = result.edges.filter(e => e.edge_type === 'builds_on');
    if (buildsOnEdges.length > 0) {
      for (const edge of buildsOnEdges) {
        expect(edge.soft_evidence_score).toBeGreaterThan(0);
      }
    }
  });
});

// ============================================================================
// V2: 27. Task Node Metrics
// ============================================================================

describe('Task Node Metrics', () => {
  it('produces task_nodes array with correct fields', () => {
    const input: GraphInput = {
      tasks: [
        makeTask({
          task_id: 'tn_1',
          title: 'Build Authorization Review Queue Generator',
          description: 'Generate moderator review queue from authorization records.',
          created_at: DAY1,
        }),
        makeTask({
          task_id: 'tn_2',
          title: 'Build Authorization Review Queue Dashboard',
          description: 'Dashboard for authorization review queue monitoring.',
          created_at: DAY3,
        }),
      ],
      as_of: NOW,
    };
    const result = generateTaskGraph(input) as GraphOutput;

    expect(result.task_nodes).toHaveLength(2);
    for (const node of result.task_nodes) {
      expect(node.task_id).toBeDefined();
      expect(typeof node.downstream_reference_count).toBe('number');
      expect(typeof node.upstream_reference_count).toBe('number');
      expect(typeof node.reuse_score).toBe('number');
      expect(typeof node.in_degree).toBe('number');
      expect(typeof node.out_degree).toBe('number');
      expect(node.reuse_score).toBeGreaterThanOrEqual(0);
      expect(node.reuse_score).toBeLessThanOrEqual(1);
    }
  });

  it('reuse_score = downstream_count / total_tasks', () => {
    const input: GraphInput = {
      tasks: [
        makeTask({
          task_id: 'reuse_1',
          title: 'Build Authorization Review Queue Generator',
          description: 'Generate moderator review queue from authorization records.',
          created_at: DAY1,
        }),
        makeTask({
          task_id: 'reuse_2',
          title: 'Build Authorization Review Queue Dashboard',
          description: 'Dashboard for authorization review queue monitoring.',
          created_at: DAY3,
        }),
      ],
      as_of: NOW,
    };
    const result = generateTaskGraph(input) as GraphOutput;

    for (const node of result.task_nodes) {
      const expected = Math.round((node.downstream_reference_count / 2) * 10000) / 10000;
      expect(node.reuse_score).toBe(expected);
    }
  });

  it('orphan tasks have zero in/out degree', () => {
    const input: GraphInput = {
      tasks: [
        makeTask({
          task_id: 'tn_orphan',
          title: 'Completely Unique Spacecraft Design',
          description: 'Design a novel spacecraft propulsion system.',
          created_at: DAY1,
        }),
      ],
      as_of: NOW,
    };
    const result = generateTaskGraph(input) as GraphOutput;

    expect(result.task_nodes).toHaveLength(1);
    expect(result.task_nodes[0].in_degree).toBe(0);
    expect(result.task_nodes[0].out_degree).toBe(0);
    expect(result.task_nodes[0].downstream_reference_count).toBe(0);
    expect(result.task_nodes[0].upstream_reference_count).toBe(0);
  });
});

// ============================================================================
// V2: 28. Typed Orphan Diagnosis
// ============================================================================

describe('Typed Orphan Diagnosis', () => {
  it('orphan_tasks are OrphanTask objects with type and rationale', () => {
    const input: GraphInput = {
      tasks: [
        makeTask({
          task_id: 'od_1',
          title: 'Unique Gamma Task',
          description: 'Gamma unique thing.',
          created_at: DAY1,
        }),
      ],
      as_of: NOW,
    };
    const result = generateTaskGraph(input) as GraphOutput;

    expect(result.orphan_tasks).toHaveLength(1);
    const orphan = result.orphan_tasks[0];
    expect(orphan.task_id).toBe('od_1');
    expect(orphan.orphan_type).toBeDefined();
    expect(orphan.rationale).toBeDefined();
    expect(typeof orphan.reward_pft).toBe('number');
  });

  it('classifies isolated_high_reward for orphans with reward >= 3000', () => {
    const input: GraphInput = {
      tasks: [
        makeTask({
          task_id: 'od_high',
          title: 'Unique High Reward Task',
          description: 'A very unique task with high reward.',
          reward_pft: 5000,
          created_at: DAY1,
        }),
      ],
      as_of: NOW,
    };
    const result = generateTaskGraph(input) as GraphOutput;

    expect(result.orphan_tasks).toHaveLength(1);
    expect(result.orphan_tasks[0].orphan_type).toBe('isolated_high_reward');
    expect(result.orphan_tasks[0].reward_pft).toBe(5000);
  });

  it('classifies schema_unlinked for orphans with output_types', () => {
    const input: GraphInput = {
      tasks: [
        makeTask({
          task_id: 'od_schema',
          title: 'Unique Schema Producer',
          description: 'Produces artifacts nobody consumes.',
          output_types: ['UnusedArtifact'],
          created_at: DAY1,
        }),
      ],
      as_of: NOW,
    };
    const result = generateTaskGraph(input) as GraphOutput;

    expect(result.orphan_tasks).toHaveLength(1);
    expect(result.orphan_tasks[0].orphan_type).toBe('schema_unlinked');
  });

  it('classifies new_frontier_task for tasks within 7 days of as_of', () => {
    const input: GraphInput = {
      tasks: [
        makeTask({
          task_id: 'od_new',
          title: 'Brand New Unique Task',
          description: 'A brand new unique task just created.',
          created_at: '2026-04-08T12:00:00Z', // 1 day before as_of
        }),
      ],
      as_of: NOW,
    };
    const result = generateTaskGraph(input) as GraphOutput;

    expect(result.orphan_tasks).toHaveLength(1);
    expect(result.orphan_tasks[0].orphan_type).toBe('new_frontier_task');
  });

  it('classifies conceptually_unique for old orphans with no special traits', () => {
    const input: GraphInput = {
      tasks: [
        makeTask({
          task_id: 'od_old',
          title: 'Ancient Unique Task',
          description: 'An old unique task with no outputs.',
          created_at: '2026-01-01T12:00:00Z', // long before as_of
        }),
      ],
      as_of: NOW,
    };
    const result = generateTaskGraph(input) as GraphOutput;

    expect(result.orphan_tasks).toHaveLength(1);
    expect(result.orphan_tasks[0].orphan_type).toBe('conceptually_unique');
  });

  it('isolated_high_reward takes priority over schema_unlinked', () => {
    const input: GraphInput = {
      tasks: [
        makeTask({
          task_id: 'od_priority',
          title: 'High Reward Schema Producer',
          description: 'Produces artifacts nobody consumes, also high reward.',
          output_types: ['SomeOutput'],
          reward_pft: 5000,
          created_at: DAY1,
        }),
      ],
      as_of: NOW,
    };
    const result = generateTaskGraph(input) as GraphOutput;

    expect(result.orphan_tasks).toHaveLength(1);
    expect(result.orphan_tasks[0].orphan_type).toBe('isolated_high_reward');
  });
});

// ============================================================================
// V2: 29. Subgraph Labels
// ============================================================================

describe('Subgraph Labels', () => {
  it('subgraphs have deterministic label from shared title tokens', () => {
    const input: GraphInput = {
      tasks: [
        makeTask({
          task_id: 'sl_1',
          title: 'Build Authorization Review Queue Generator',
          description: 'Generate moderator review queue from authorization records.',
          category: 'network',
          created_at: DAY1,
        }),
        makeTask({
          task_id: 'sl_2',
          title: 'Build Authorization Review Queue Dashboard',
          description: 'Dashboard for authorization review queue monitoring.',
          category: 'network',
          created_at: DAY3,
        }),
      ],
      as_of: NOW,
    };
    const result = generateTaskGraph(input) as GraphOutput;

    if (result.subgraphs.length > 0) {
      const sg = result.subgraphs[0];
      expect(sg.subgraph_label).toBeDefined();
      expect(typeof sg.subgraph_label).toBe('string');
      expect(sg.subgraph_label.length).toBeGreaterThan(0);
      expect(sg.label_reason_tokens).toBeDefined();
      expect(Array.isArray(sg.label_reason_tokens)).toBe(true);
      expect(sg.label_reason_tokens.length).toBeLessThanOrEqual(3);
    }
  });

  it('label is deterministic across runs', () => {
    const input: GraphInput = {
      tasks: [
        makeTask({
          task_id: 'sl_det_1',
          title: 'Build Authorization Review Queue Generator',
          description: 'Generate moderator review queue from authorization records.',
          created_at: DAY1,
        }),
        makeTask({
          task_id: 'sl_det_2',
          title: 'Build Authorization Review Queue Dashboard',
          description: 'Dashboard for authorization review queue monitoring.',
          created_at: DAY3,
        }),
      ],
      as_of: NOW,
    };
    const r1 = generateTaskGraph(input) as GraphOutput;
    const r2 = generateTaskGraph(input) as GraphOutput;

    if (r1.subgraphs.length > 0) {
      expect(r1.subgraphs[0].subgraph_label).toBe(r2.subgraphs[0].subgraph_label);
      expect(r1.subgraphs[0].label_reason_tokens).toEqual(r2.subgraphs[0].label_reason_tokens);
    }
  });

  it('label tokens are underscore-joined', () => {
    const input: GraphInput = {
      tasks: [
        makeTask({
          task_id: 'sl_join_1',
          title: 'Build Token Vesting Schedule',
          description: 'Create vesting schedule for token allocations.',
          category: 'tokenomics',
          created_at: DAY1,
        }),
        makeTask({
          task_id: 'sl_join_2',
          title: 'Implement Token Vesting Contract',
          description: 'Smart contract implementing token vesting schedule rules.',
          category: 'tokenomics',
          created_at: DAY3,
        }),
      ],
      as_of: NOW,
    };
    const result = generateTaskGraph(input) as GraphOutput;

    if (result.subgraphs.length > 0) {
      const sg = result.subgraphs[0];
      const expectedLabel = sg.label_reason_tokens.join('_');
      expect(sg.subgraph_label).toBe(expectedLabel);
    }
  });
});

// ============================================================================
// V2: 30. Review Priority Flags
// ============================================================================

describe('Review Priority Flags', () => {
  it('flags SINGLE_OPERATOR_CRITICAL_CHAIN', () => {
    const input: GraphInput = {
      tasks: [
        makeTask({
          task_id: 'rpf_1',
          title: 'Build Authorization Review Queue',
          description: 'Generate moderator review queue from authorization records.',
          operator: 'alice',
          category: 'network',
          created_at: DAY1,
        }),
        makeTask({
          task_id: 'rpf_2',
          title: 'Build Authorization Review Dashboard',
          description: 'Dashboard for authorization review queue monitoring.',
          operator: 'alice',
          category: 'network',
          created_at: DAY2,
        }),
        makeTask({
          task_id: 'rpf_3',
          title: 'Build Authorization Review API',
          description: 'API endpoint for authorization review queue access.',
          operator: 'alice',
          category: 'network',
          created_at: DAY3,
        }),
      ],
      as_of: NOW,
    };
    const result = generateTaskGraph(input) as GraphOutput;

    if (result.subgraphs.length > 0 && result.subgraphs[0].task_ids.length >= 3) {
      const flag = result.review_priority_flags.find(f => f.flag === 'SINGLE_OPERATOR_CRITICAL_CHAIN');
      expect(flag).toBeDefined();
      expect(flag!.severity).toBe('critical');
      expect(flag!.affected_task_ids.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('flags HIGH_REWARD_ORPHAN', () => {
    const input: GraphInput = {
      tasks: [
        makeTask({
          task_id: 'rpf_orphan',
          title: 'Unique High Value Isolated Task',
          description: 'A completely unique task with very high reward.',
          reward_pft: 5000,
          created_at: DAY1,
        }),
      ],
      as_of: NOW,
    };
    const result = generateTaskGraph(input) as GraphOutput;

    const flag = result.review_priority_flags.find(f => f.flag === 'HIGH_REWARD_ORPHAN');
    expect(flag).toBeDefined();
    expect(flag!.severity).toBe('warning');
    expect(flag!.affected_task_ids).toContain('rpf_orphan');
  });

  it('flags UNCONSUMED_OUTPUT_ARTIFACT', () => {
    const input: GraphInput = {
      tasks: [
        makeTask({
          task_id: 'rpf_unconsumed',
          title: 'Build Unique Output Producer',
          description: 'Produces artifacts that nobody uses.',
          output_types: ['UnusedWidget'],
          created_at: DAY1,
        }),
        makeTask({
          task_id: 'rpf_unrelated',
          title: 'Completely Different Task',
          description: 'This task does something totally unrelated.',
          created_at: DAY3,
        }),
      ],
      as_of: NOW,
    };
    const result = generateTaskGraph(input) as GraphOutput;

    const flag = result.review_priority_flags.find(f => f.flag === 'UNCONSUMED_OUTPUT_ARTIFACT');
    expect(flag).toBeDefined();
    expect(flag!.severity).toBe('info');
    expect(flag!.affected_task_ids).toContain('rpf_unconsumed');
  });

  it('flags DUPLICATE_CLUSTER_FORMING when >= 3 duplicate edges', () => {
    const input: GraphInput = {
      tasks: [
        makeTask({
          task_id: 'dcf_1',
          title: 'Build Deterministic Authorization Review Queue Generator',
          description: 'Generate moderator-ready review queue from contributor authorization records and task history.',
          created_at: DAY1,
        }),
        makeTask({
          task_id: 'dcf_2',
          title: 'Build Deterministic Authorization Review Queue Generator',
          description: 'Generate moderator-ready review queue from contributor authorization records and task history.',
          created_at: DAY2,
        }),
        makeTask({
          task_id: 'dcf_3',
          title: 'Build Deterministic Authorization Review Queue Generator',
          description: 'Generate moderator-ready review queue from contributor authorization records and task history.',
          created_at: DAY3,
        }),
        makeTask({
          task_id: 'dcf_4',
          title: 'Build Deterministic Authorization Review Queue Generator',
          description: 'Generate moderator-ready review queue from contributor authorization records and task history.',
          created_at: DAY4,
        }),
      ],
      as_of: NOW,
    };
    const result = generateTaskGraph(input) as GraphOutput;

    const dupEdges = result.edges.filter(e => e.edge_type === 'duplicates');
    if (dupEdges.length >= 3) {
      const flag = result.review_priority_flags.find(f => f.flag === 'DUPLICATE_CLUSTER_FORMING');
      expect(flag).toBeDefined();
      expect(flag!.severity).toBe('warning');
    }
  });

  it('review flags are sorted by severity (critical > warning > info)', () => {
    const input: GraphInput = {
      tasks: [
        makeTask({
          task_id: 'sort_rpf_1',
          title: 'Build Authorization Review Queue',
          description: 'Generate moderator review queue from authorization records.',
          operator: 'alice',
          category: 'network',
          output_types: ['ReviewQueue'],
          created_at: DAY1,
        }),
        makeTask({
          task_id: 'sort_rpf_2',
          title: 'Build Authorization Review Dashboard',
          description: 'Dashboard for authorization review queue monitoring.',
          operator: 'alice',
          category: 'network',
          created_at: DAY2,
        }),
        makeTask({
          task_id: 'sort_rpf_3',
          title: 'Build Authorization Review API',
          description: 'API endpoint for authorization review queue access.',
          operator: 'alice',
          category: 'network',
          created_at: DAY3,
        }),
      ],
      as_of: NOW,
    };
    const result = generateTaskGraph(input) as GraphOutput;

    const sevOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 };
    for (let i = 1; i < result.review_priority_flags.length; i++) {
      const prev = sevOrder[result.review_priority_flags[i - 1].severity];
      const curr = sevOrder[result.review_priority_flags[i].severity];
      expect(prev).toBeLessThanOrEqual(curr);
    }
  });
});

// ============================================================================
// V2: 31. Enhanced Graph Metrics
// ============================================================================

describe('Enhanced Graph Metrics', () => {
  it('includes largest_component_size and share', () => {
    const input: GraphInput = {
      tasks: [
        makeTask({
          task_id: 'egm_1',
          title: 'Build Authorization Review Queue Generator',
          description: 'Generate moderator review queue from authorization records.',
          created_at: DAY1,
        }),
        makeTask({
          task_id: 'egm_2',
          title: 'Build Authorization Review Queue Dashboard',
          description: 'Dashboard for authorization review queue monitoring.',
          created_at: DAY3,
        }),
        makeTask({
          task_id: 'egm_3',
          title: 'Unique Spacecraft Design',
          description: 'Design a novel spacecraft propulsion system.',
          created_at: DAY2,
        }),
      ],
      as_of: NOW,
    };
    const result = generateTaskGraph(input) as GraphOutput;

    expect(typeof result.graph_metrics.largest_component_size).toBe('number');
    expect(typeof result.graph_metrics.largest_component_share).toBe('number');
    expect(result.graph_metrics.largest_component_share).toBeGreaterThanOrEqual(0);
    expect(result.graph_metrics.largest_component_share).toBeLessThanOrEqual(1);
  });

  it('includes schema and soft edge shares', () => {
    const input: GraphInput = {
      tasks: [
        makeTask({
          task_id: 'share_1',
          title: 'Build Policy Engine',
          description: 'Generate engagement policies.',
          output_types: ['PolicyEngine'],
          created_at: DAY1,
        }),
        makeTask({
          task_id: 'share_2',
          title: 'Build Enforcement Module',
          description: 'Module that reads from the PolicyEngine to enforce rules.',
          input_types: ['PolicyEngine'],
          created_at: DAY3,
        }),
      ],
      as_of: NOW,
    };
    const result = generateTaskGraph(input) as GraphOutput;

    expect(typeof result.graph_metrics.schema_backed_edge_share).toBe('number');
    expect(typeof result.graph_metrics.soft_inference_edge_share).toBe('number');
    expect(result.graph_metrics.schema_backed_edge_share + result.graph_metrics.soft_inference_edge_share).toBeLessThanOrEqual(1.0001);
  });

  it('dead_end_reward_share is reward in orphans / total', () => {
    const input: GraphInput = {
      tasks: [
        makeTask({
          task_id: 'de_connected_1',
          title: 'Build Authorization Review Queue Generator',
          description: 'Generate moderator review queue from authorization records.',
          reward_pft: 1000,
          created_at: DAY1,
        }),
        makeTask({
          task_id: 'de_connected_2',
          title: 'Build Authorization Review Queue Dashboard',
          description: 'Dashboard for authorization review queue monitoring.',
          reward_pft: 1000,
          created_at: DAY3,
        }),
        makeTask({
          task_id: 'de_orphan',
          title: 'Unique Orphan Task',
          description: 'Something completely different and unique.',
          reward_pft: 2000,
          created_at: DAY2,
        }),
      ],
      as_of: NOW,
    };
    const result = generateTaskGraph(input) as GraphOutput;

    expect(result.graph_metrics.dead_end_reward_share).toBeGreaterThanOrEqual(0);
    expect(result.graph_metrics.dead_end_reward_share).toBeLessThanOrEqual(1);

    // Orphan reward = 2000, total = 4000, share = 0.5
    if (result.orphan_tasks.length === 1 && result.orphan_tasks[0].task_id === 'de_orphan') {
      expect(result.graph_metrics.dead_end_reward_share).toBe(0.5);
    }
  });

  it('reference_reuse_ratio is correct', () => {
    const input: GraphInput = {
      tasks: [
        makeTask({
          task_id: 'rr_1',
          title: 'Build Authorization Review Queue Generator',
          description: 'Generate moderator review queue from authorization records.',
          created_at: DAY1,
        }),
        makeTask({
          task_id: 'rr_2',
          title: 'Build Authorization Review Queue Dashboard',
          description: 'Dashboard for authorization review queue monitoring.',
          created_at: DAY3,
        }),
      ],
      as_of: NOW,
    };
    const result = generateTaskGraph(input) as GraphOutput;

    expect(typeof result.graph_metrics.reference_reuse_ratio).toBe('number');
    expect(result.graph_metrics.reference_reuse_ratio).toBeGreaterThanOrEqual(0);
  });

  it('empty corpus has zero enhanced metrics', () => {
    const input: GraphInput = { tasks: [], as_of: NOW };
    const result = generateTaskGraph(input) as GraphOutput;

    expect(result.graph_metrics.largest_component_size).toBe(0);
    expect(result.graph_metrics.largest_component_share).toBe(0);
    expect(result.graph_metrics.schema_backed_edge_share).toBe(0);
    expect(result.graph_metrics.soft_inference_edge_share).toBe(0);
    expect(result.graph_metrics.dead_end_reward_share).toBe(0);
    expect(result.graph_metrics.reference_reuse_ratio).toBe(0);
  });
});
```

---

*Published by Zoz via the Permanent Upper Class validator operation.*
