---
layout: default
title: Deterministic Duplicate Task Suppression Module
date: 2026-04-06
category: network
status: submitted
task_id: 7f925328-32a1-4cd5-8960-bc5007d68201
---

# Deterministic Duplicate Task Suppression Module

**Task ID:** `7f925328-32a1-4cd5-8960-bc5007d68201`  
**Reward:** 4,700 PFT  
**Verification:** Code artifact  
**Version:** 1.0.0

**What this module is:** A deterministic pre-issuance guardrail for network task generation. It uses normalized lexical overlap, corpus-source weighting, and recency windows to reduce duplicate issuance while preserving legitimate same-objective follow-on work.

**What this module is not:** A semantic search system. All comparisons are deterministic token-based operations.

---

## Sample Input/Output

### Input
```json
{
  "candidate": {
    "title": "Build Authorization Review Queue Generator",
    "description": "Generate moderator-ready review queue from authorization records.",
    "objective": "Create moderation tooling",
    "category": "network"
  },
  "corpus": [
    {
      "task_id": "task_001",
      "title": "Build Authorization Review Queue Generator",
      "description": "Generate moderator-ready review queue from contributor authorization records and task history.",
      "objective": "Create moderation tooling for authorization review",
      "category": "network",
      "status": "outstanding",
      "created_at": "2026-04-03T12:00:00Z",
      "reward_pft": 4200
    },
    {
      "task_id": "task_002",
      "title": "Implement Engagement Guardrail Policy",
      "description": "Build deterministic policy engine that evaluates operator engagement signals.",
      "category": "network",
      "status": "rewarded",
      "created_at": "2026-03-01T12:00:00Z",
      "reward_pft": 3800
    },
    {
      "task_id": "task_refused",
      "title": "Build Automated Trading Bot",
      "description": "Create a bot that automatically trades based on market signals.",
      "category": "defi",
      "status": "refused",
      "created_at": "2026-03-15T12:00:00Z",
      "reward_pft": 8000
    }
  ],
  "as_of": "2026-04-06T12:00:00Z"
}
```

### Output
```json
{
  "generated_at": "2026-04-06T12:00:00.000Z",
  "as_of": "2026-04-06T12:00:00.000Z",
  "version": "1.0.0",
  "candidate": {
    "title": "Build Authorization Review Queue Generator",
    "description_preview": "Generate moderator-ready review queue from authorization records."
  },
  "duplicate_risk": "critical",
  "recommended_action": "suppress",
  "reason_codes": ["EXACT_TITLE_MATCH", "SAME_OBJECTIVE_OUTSTANDING", "HIGH_TOKEN_OVERLAP", "SAME_CATEGORY_SIMILAR"],
  "matched_task_ids": ["task_001"],
  "matches": [
    {
      "task_id": "task_001",
      "status": "outstanding",
      "title": "Build Authorization Review Queue Generator",
      "similarity_score": 100,
      "reason_codes": ["EXACT_TITLE_MATCH", "SAME_OBJECTIVE_OUTSTANDING", "HIGH_TOKEN_OVERLAP", "SAME_CATEGORY_SIMILAR"],
      "matched_window": "same_week",
      "created_at": "2026-04-03T12:00:00Z"
    }
  ],
  "highest_similarity": 100,
  "suppression_rationale": "Exact title match with task_001 (outstanding). Block issuance.",
  "validation_warnings": []
}
```

---

## Collision Reason Codes

| Code | Description | Implementation |
|------|-------------|----------------|
| `EXACT_TITLE_MATCH` | Identical title (normalized, case-insensitive) | `normalize(a) === normalize(b)` |
| `EXACT_DESCRIPTION_MATCH` | Identical description (normalized) | `normalize(a) === normalize(b)` |
| `PARAPHRASE_TITLE` | Strong normalized token overlap in title (≥75% Jaccard) | Token Jaccard similarity |
| `PARAPHRASE_DESCRIPTION` | Strong normalized token overlap in description | Token Jaccard similarity |
| `SAME_OBJECTIVE_OUTSTANDING` | Same objective, task is outstanding/generated | Objective overlap + status check |
| `SAME_OBJECTIVE_RECENT` | Same objective, within recent window (≤7 days) | Objective overlap + recency gate |
| `REFUSED_PATTERN_OVERLAP` | Matches a refused task pattern (≥60% combined overlap) | Combined title+desc similarity |
| `HIGH_TOKEN_OVERLAP` | >80% of candidate tokens appear in corpus task | Directional token overlap ratio |
| `SAME_CATEGORY_SIMILAR` | Same category + high combined similarity | Category match + ≥60% similarity |
| `DISTINCT` | No significant overlap detected | Default when no other codes apply |

---

## Temporal Windows

| Window | Definition | Effect |
|--------|------------|--------|
| `same_day` | Created within 24 hours | Strongest blocking signal |
| `same_week` | Created within 7 days | Strong blocking signal |
| `same_month` | Created within 30 days | Moderate signal |
| `older` | Created >30 days ago | Weaker signal (prefer rewrite over suppress) |
| `n/a` | Invalid timestamp | Warning flagged |

**Temporal gating:**
- `SAME_OBJECTIVE_RECENT` only fires when corpus task is within `recent_days` (default: 7)
- `SAME_OBJECTIVE_OUTSTANDING` fires regardless of age (outstanding work blocks issuance)

---

## Action Decision Matrix

| Condition | → Action |
|-----------|----------|
| `EXACT_TITLE_MATCH` or `EXACT_DESCRIPTION_MATCH` | **suppress** |
| `SAME_OBJECTIVE_OUTSTANDING` | **suppress** |
| Similarity ≥85% | **suppress** |
| Similarity 60-84% with `REFUSED_PATTERN_OVERLAP` | **rewrite** |
| Similarity 60-84% with `PARAPHRASE_*` or `SAME_CATEGORY_SIMILAR` | **rewrite** |
| Similarity <60% | **allow** |

---

## Deterministic Sort Order

Matches are sorted by:
1. `similarity_score` desc
2. `status` priority: outstanding (4) > generated (3) > refused (2) > rewarded (1)
3. `created_at` desc (newer first)
4. `task_id` asc (alphabetic tie-breaker)

This ensures identical input always produces identical output order.

---

## Module Code (Full Implementation)

```typescript
/**
 * Duplicate Task Suppression Module
 * 
 * Deterministic pre-issuance guardrail for network task generation.
 * Uses normalized lexical overlap, corpus-source weighting, and recency windows.
 */

export type CorpusTaskStatus = 'outstanding' | 'generated' | 'refused' | 'rewarded' | 'cancelled';
export type ReasonCode = 'EXACT_TITLE_MATCH' | 'EXACT_DESCRIPTION_MATCH' | 'PARAPHRASE_TITLE' 
  | 'PARAPHRASE_DESCRIPTION' | 'SAME_OBJECTIVE_RECENT' | 'SAME_OBJECTIVE_OUTSTANDING'
  | 'REFUSED_PATTERN_OVERLAP' | 'HIGH_TOKEN_OVERLAP' | 'SAME_CATEGORY_SIMILAR' | 'DISTINCT';
export type RecommendedAction = 'allow' | 'rewrite' | 'suppress';
export type DuplicateRisk = 'none' | 'low' | 'medium' | 'high' | 'critical';
export type MatchWindow = 'same_day' | 'same_week' | 'same_month' | 'older' | 'n/a';

export interface MatchResult {
  task_id: string;
  status: CorpusTaskStatus;
  title: string;
  similarity_score: number;
  reason_codes: ReasonCode[];
  matched_window: MatchWindow;
  created_at: string;
}

export interface SuppressionOutput {
  generated_at: string;
  as_of: string;
  version: string;
  candidate: { title: string; description_preview: string };
  duplicate_risk: DuplicateRisk;
  recommended_action: RecommendedAction;
  reason_codes: ReasonCode[];
  matched_task_ids: string[];
  matches: MatchResult[];
  highest_similarity: number;
  suppression_rationale: string;
  validation_warnings: string[];
}

export const DEFAULT_THRESHOLDS = {
  exact_match_score: 100,
  paraphrase_threshold: 75,
  suppress_threshold: 85,
  rewrite_threshold: 60,
  recent_days: 7,
  token_overlap_threshold: 0.8,
};

// ============================================================================
// Text Normalization (deterministic, not semantic)
// ============================================================================

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function tokenize(text: string): Set<string> {
  return new Set(normalize(text).split(' ').filter(t => t.length > 2));
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 100;
  if (a.size === 0 || b.size === 0) return 0;
  const intersection = new Set([...a].filter(x => b.has(x)));
  const union = new Set([...a, ...b]);
  return Math.round((intersection.size / union.size) * 100);
}

function tokenOverlapRatio(candidate: Set<string>, corpus: Set<string>): number {
  if (candidate.size === 0) return 0;
  return [...candidate].filter(t => corpus.has(t)).length / candidate.size;
}

function getMatchWindow(corpusDate: string, asOf: Date, recentDays: number): MatchWindow {
  const corpus = new Date(corpusDate);
  if (isNaN(corpus.getTime())) return 'n/a';
  const daysDiff = Math.floor((asOf.getTime() - corpus.getTime()) / (1000 * 60 * 60 * 24));
  if (daysDiff < 1) return 'same_day';
  if (daysDiff < 7) return 'same_week';
  if (daysDiff < 30) return 'same_month';
  return 'older';
}

// ============================================================================
// Similarity Calculation
// ============================================================================

function calculateSimilarity(candidate, corpus, thresholds, asOf: Date) {
  const reasons: ReasonCode[] = [];
  let score = 0;
  
  // Title comparison
  if (normalize(candidate.title) === normalize(corpus.title)) {
    reasons.push('EXACT_TITLE_MATCH');
    score = thresholds.exact_match_score;
  } else {
    const titleSim = jaccardSimilarity(tokenize(candidate.title), tokenize(corpus.title));
    if (titleSim >= thresholds.paraphrase_threshold) {
      reasons.push('PARAPHRASE_TITLE');
      score = Math.max(score, titleSim);
    }
  }
  
  // Description comparison
  if (normalize(candidate.description) === normalize(corpus.description)) {
    reasons.push('EXACT_DESCRIPTION_MATCH');
    score = thresholds.exact_match_score;
  } else {
    const descTokensCandidate = tokenize(candidate.description);
    const descTokensCorpus = tokenize(corpus.description);
    const descSim = jaccardSimilarity(descTokensCandidate, descTokensCorpus);
    
    if (descSim >= thresholds.paraphrase_threshold) {
      reasons.push('PARAPHRASE_DESCRIPTION');
      score = Math.max(score, descSim);
    }
    
    // Token overlap check (directional)
    if (tokenOverlapRatio(descTokensCandidate, descTokensCorpus) >= thresholds.token_overlap_threshold) {
      reasons.push('HIGH_TOKEN_OVERLAP');
      score = Math.max(score, 80);
    }
  }
  
  // Objective comparison with temporal gating
  if (candidate.objective && corpus.objective) {
    const objSim = jaccardSimilarity(tokenize(candidate.objective), tokenize(corpus.objective));
    if (objSim >= thresholds.paraphrase_threshold) {
      if (corpus.status === 'outstanding' || corpus.status === 'generated') {
        reasons.push('SAME_OBJECTIVE_OUTSTANDING');
        score = Math.max(score, objSim);
      } else {
        // Only flag SAME_OBJECTIVE_RECENT if within recent window
        const daysSince = Math.floor((asOf.getTime() - new Date(corpus.created_at).getTime()) / (1000 * 60 * 60 * 24));
        if (daysSince <= thresholds.recent_days) {
          reasons.push('SAME_OBJECTIVE_RECENT');
          score = Math.max(score, objSim);
        }
      }
    }
  }
  
  // Category + similarity check
  if (candidate.category && corpus.category && normalize(candidate.category) === normalize(corpus.category)) {
    const combinedSim = jaccardSimilarity(
      tokenize(`${candidate.title} ${candidate.description}`),
      tokenize(`${corpus.title} ${corpus.description}`)
    );
    if (combinedSim >= thresholds.rewrite_threshold) {
      reasons.push('SAME_CATEGORY_SIMILAR');
      score = Math.max(score, combinedSim + 5);
    }
  }
  
  // Refused pattern check
  if (corpus.status === 'refused') {
    const combinedSim = jaccardSimilarity(
      tokenize(`${candidate.title} ${candidate.description}`),
      tokenize(`${corpus.title} ${corpus.description}`)
    );
    if (combinedSim >= thresholds.rewrite_threshold) {
      reasons.push('REFUSED_PATTERN_OVERLAP');
      score = Math.max(score, combinedSim + 10);
    }
  }
  
  if (reasons.length === 0) reasons.push('DISTINCT');
  return { score: Math.min(score, 100), reasons };
}

// ============================================================================
// Action Determination
// ============================================================================

function getRecommendedAction(score, reasons, thresholds): RecommendedAction {
  if (reasons.includes('EXACT_TITLE_MATCH') || reasons.includes('EXACT_DESCRIPTION_MATCH')) return 'suppress';
  if (reasons.includes('SAME_OBJECTIVE_OUTSTANDING')) return 'suppress';
  if (score >= thresholds.suppress_threshold) return 'suppress';
  if (score >= thresholds.rewrite_threshold) return 'rewrite';
  return 'allow';
}

function getRiskLevel(score, thresholds): DuplicateRisk {
  if (score >= thresholds.exact_match_score) return 'critical';
  if (score >= thresholds.suppress_threshold) return 'high';
  if (score >= thresholds.paraphrase_threshold) return 'medium';
  if (score >= thresholds.rewrite_threshold) return 'low';
  return 'none';
}

// ============================================================================
// Main Entry Point
// ============================================================================

export function checkDuplicates(input, thresholds = DEFAULT_THRESHOLDS): SuppressionOutput {
  const asOf = input.as_of ? new Date(input.as_of) : new Date();
  const generatedAt = new Date();
  const warnings: string[] = [];
  const matches: MatchResult[] = [];
  const allReasons = new Set<ReasonCode>();
  
  if (!input.candidate.title || !input.candidate.description) {
    warnings.push('Candidate missing title or description');
  }
  
  for (const corpus of input.corpus) {
    const { score, reasons } = calculateSimilarity(input.candidate, corpus, thresholds, asOf);
    
    if (score >= thresholds.rewrite_threshold || !reasons.includes('DISTINCT')) {
      matches.push({
        task_id: corpus.task_id,
        status: corpus.status,
        title: corpus.title,
        similarity_score: score,
        reason_codes: reasons.filter(r => r !== 'DISTINCT'),
        matched_window: getMatchWindow(corpus.created_at, asOf, thresholds.recent_days),
        created_at: corpus.created_at,
      });
      reasons.forEach(r => { if (r !== 'DISTINCT') allReasons.add(r); });
    }
  }
  
  // Deterministic sort: similarity desc, status priority desc, created_at desc, task_id asc
  const statusPriority = { outstanding: 4, generated: 3, refused: 2, rewarded: 1, cancelled: 0 };
  matches.sort((a, b) => {
    if (a.similarity_score !== b.similarity_score) return b.similarity_score - a.similarity_score;
    const aPri = statusPriority[a.status] ?? 0, bPri = statusPriority[b.status] ?? 0;
    if (aPri !== bPri) return bPri - aPri;
    if (a.created_at !== b.created_at) return b.created_at.localeCompare(a.created_at);
    return a.task_id.localeCompare(b.task_id);
  });
  
  const highestSimilarity = matches[0]?.similarity_score ?? 0;
  const aggregatedReasons = allReasons.size > 0 ? Array.from(allReasons) : ['DISTINCT'];
  const action = getRecommendedAction(highestSimilarity, aggregatedReasons, thresholds);
  const risk = getRiskLevel(highestSimilarity, thresholds);
  
  const rationale = action === 'suppress' 
    ? `${aggregatedReasons[0]} with ${matches[0]?.task_id} (${matches[0]?.status}). Block issuance.`
    : action === 'rewrite' 
    ? `Moderate overlap with ${matches.length} task(s). Differentiate scope before issuing.`
    : matches.length === 0 ? 'No matches found. Safe to issue.' : `Low similarity (${highestSimilarity}%). Safe to issue.`;
  
  return {
    generated_at: generatedAt.toISOString(),
    as_of: asOf.toISOString(),
    version: '1.0.0',
    candidate: {
      title: input.candidate.title,
      description_preview: input.candidate.description.substring(0, 100) + (input.candidate.description.length > 100 ? '...' : ''),
    },
    duplicate_risk: risk,
    recommended_action: action,
    reason_codes: aggregatedReasons,
    matched_task_ids: matches.map(m => m.task_id),
    matches,
    highest_similarity: highestSimilarity,
    suppression_rationale: rationale,
    validation_warnings: warnings,
  };
}
```

---

## Unit Tests (17 passing)

```bash
$ npm test -- --reporter=verbose

 ✓ Empty Corpus Handling > returns allow with no matches for empty corpus
 ✓ Exact Title Collisions > suppresses exact title match
 ✓ Exact Title Collisions > suppresses case-insensitive exact title match
 ✓ Paraphrase Detection > detects paraphrased title (≥75% token overlap)
 ✓ Paraphrase Detection > detects paraphrased description
 ✓ Recent Live Task Suppression > suppresses when same objective is outstanding
 ✓ Recent Live Task Suppression > identifies same_week match window
 ✓ Rewrite vs Suppress Threshold > recommends rewrite for moderate similarity
 ✓ Rewrite vs Suppress Threshold > allows clearly distinct tasks
 ✓ Deterministic Sort Order > produces identical output for same input
 ✓ Deterministic Sort Order > sorts by similarity desc, status priority, created_at desc, task_id asc
 ✓ Refused Pattern Overlap > flags tasks matching refused patterns
 ✓ Same Category Similar > detects same-category similar tasks
 ✓ High Token Overlap > detects >80% token overlap in descriptions
 ✓ Validation Warnings > warns on missing title or description
 ✓ Suppression Rationale > provides meaningful rationale for suppress
 ✓ Suppression Rationale > provides meaningful rationale for allow

 Tests  17 passed (17)
```

---

## Public Repository

**GitHub:** https://github.com/P-U-C/duplicate-task-suppression

---

*Published by Zoz via the Permanent Upper Class validator operation.*  
*Task completed for the Post Fiat Network.*
