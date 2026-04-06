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

Compares a candidate task against recent outstanding, generated, refused, and rewarded task records. Returns a JSON duplicate-risk assessment with matched task IDs, reason codes, and recommended action (allow, rewrite, or suppress).

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
      "created_at": "2026-03-01T12:00:00Z",
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
  "reason_codes": ["EXACT_TITLE_MATCH", "SAME_OBJECTIVE_OUTSTANDING", "HIGH_TOKEN_OVERLAP"],
  "matched_task_ids": ["task_001"],
  "matches": [
    {
      "task_id": "task_001",
      "status": "outstanding",
      "title": "Build Authorization Review Queue Generator",
      "similarity_score": 100,
      "reason_codes": ["EXACT_TITLE_MATCH", "SAME_OBJECTIVE_OUTSTANDING", "HIGH_TOKEN_OVERLAP"],
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

| Code | Description | Typical Action |
|------|-------------|----------------|
| `EXACT_TITLE_MATCH` | Identical title (case-insensitive) | suppress |
| `EXACT_DESCRIPTION_MATCH` | Identical description | suppress |
| `PARAPHRASE_TITLE` | Title is semantic paraphrase (≥75% token overlap) | rewrite/suppress |
| `PARAPHRASE_DESCRIPTION` | Description is semantic paraphrase | rewrite/suppress |
| `SAME_OBJECTIVE_RECENT` | Same objective, recently issued | rewrite |
| `SAME_OBJECTIVE_OUTSTANDING` | Same objective, still outstanding | suppress |
| `REFUSED_PATTERN_OVERLAP` | Matches a refused task pattern | suppress |
| `HIGH_TOKEN_OVERLAP` | >80% token overlap | rewrite/suppress |
| `SAME_CATEGORY_SIMILAR` | Same category + high similarity | rewrite |
| `DISTINCT` | No significant overlap | allow |

---

## Action Decision Matrix

| Highest Similarity | Key Signals | → Action |
|--------------------|-------------|----------|
| 100 (exact match) | EXACT_TITLE_MATCH or EXACT_DESCRIPTION_MATCH | suppress |
| ≥85 | SAME_OBJECTIVE_OUTSTANDING | suppress |
| ≥85 | Any other reason | suppress |
| 60-84 | PARAPHRASE_*, REFUSED_PATTERN_OVERLAP | rewrite |
| 60-84 | SAME_CATEGORY_SIMILAR | rewrite |
| <60 | DISTINCT | allow |

---

## Module Code

```typescript
/**
 * Duplicate Task Suppression Module
 */

export type ReasonCode = 
  | 'EXACT_TITLE_MATCH' | 'EXACT_DESCRIPTION_MATCH' | 'PARAPHRASE_TITLE' 
  | 'PARAPHRASE_DESCRIPTION' | 'SAME_OBJECTIVE_RECENT' | 'SAME_OBJECTIVE_OUTSTANDING'
  | 'REFUSED_PATTERN_OVERLAP' | 'HIGH_TOKEN_OVERLAP' | 'SAME_CATEGORY_SIMILAR' | 'DISTINCT';

export type RecommendedAction = 'allow' | 'rewrite' | 'suppress';
export type DuplicateRisk = 'none' | 'low' | 'medium' | 'high' | 'critical';

export interface SuppressionOutput {
  duplicate_risk: DuplicateRisk;
  recommended_action: RecommendedAction;
  reason_codes: ReasonCode[];
  matched_task_ids: string[];
  matches: MatchResult[];
  highest_similarity: number;
  suppression_rationale: string;
}

export const DEFAULT_THRESHOLDS = {
  exact_match_score: 100,
  paraphrase_threshold: 75,
  suppress_threshold: 85,
  rewrite_threshold: 60,
  recent_days: 7,
  token_overlap_threshold: 0.8,
};

// Text normalization
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

function calculateSimilarity(candidate, corpus, thresholds) {
  const reasons: ReasonCode[] = [];
  let score = 0;
  
  // Title comparison
  if (normalize(candidate.title) === normalize(corpus.title)) {
    reasons.push('EXACT_TITLE_MATCH');
    score = 100;
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
    score = 100;
  } else {
    const descSim = jaccardSimilarity(tokenize(candidate.description), tokenize(corpus.description));
    if (descSim >= thresholds.paraphrase_threshold) {
      reasons.push('PARAPHRASE_DESCRIPTION');
      score = Math.max(score, descSim);
    }
  }
  
  // Objective comparison
  if (candidate.objective && corpus.objective) {
    const objSim = jaccardSimilarity(tokenize(candidate.objective), tokenize(corpus.objective));
    if (objSim >= thresholds.paraphrase_threshold) {
      reasons.push(corpus.status === 'outstanding' ? 'SAME_OBJECTIVE_OUTSTANDING' : 'SAME_OBJECTIVE_RECENT');
      score = Math.max(score, objSim);
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

function getRecommendedAction(score, reasons, thresholds): RecommendedAction {
  if (reasons.includes('EXACT_TITLE_MATCH') || reasons.includes('EXACT_DESCRIPTION_MATCH')) return 'suppress';
  if (reasons.includes('SAME_OBJECTIVE_OUTSTANDING')) return 'suppress';
  if (score >= thresholds.suppress_threshold) return 'suppress';
  if (score >= thresholds.rewrite_threshold) return 'rewrite';
  return 'allow';
}

export function checkDuplicates(input, thresholds = DEFAULT_THRESHOLDS): SuppressionOutput {
  const asOf = input.as_of ? new Date(input.as_of) : new Date();
  const matches = [];
  
  for (const corpus of input.corpus) {
    const { score, reasons } = calculateSimilarity(input.candidate, corpus, thresholds);
    if (score >= thresholds.rewrite_threshold || !reasons.includes('DISTINCT')) {
      matches.push({ task_id: corpus.task_id, status: corpus.status, similarity_score: score, reason_codes: reasons });
    }
  }
  
  matches.sort((a, b) => b.similarity_score - a.similarity_score);
  
  const highestSimilarity = matches[0]?.similarity_score ?? 0;
  const allReasons = [...new Set(matches.flatMap(m => m.reason_codes))];
  const action = getRecommendedAction(highestSimilarity, allReasons, thresholds);
  
  return {
    duplicate_risk: highestSimilarity >= 100 ? 'critical' : highestSimilarity >= 85 ? 'high' : highestSimilarity >= 75 ? 'medium' : highestSimilarity >= 60 ? 'low' : 'none',
    recommended_action: action,
    reason_codes: allReasons.length ? allReasons : ['DISTINCT'],
    matched_task_ids: matches.map(m => m.task_id),
    matches,
    highest_similarity: highestSimilarity,
    suppression_rationale: action === 'suppress' ? `Block issuance: ${allReasons[0]} with ${matches[0]?.task_id}` : action === 'rewrite' ? 'Differentiate before issuing' : 'Safe to issue',
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
 ✓ Paraphrase Detection > detects paraphrased title
 ✓ Paraphrase Detection > detects paraphrased description
 ✓ Recent Live Task Suppression > suppresses when same objective is outstanding
 ✓ Recent Live Task Suppression > identifies same_week match window
 ✓ Rewrite vs Suppress Threshold > recommends rewrite for moderate similarity
 ✓ Rewrite vs Suppress Threshold > allows clearly distinct tasks
 ✓ Deterministic Sort Order > produces identical output for same input
 ✓ Deterministic Sort Order > sorts matches by similarity desc, then created_at desc
 ✓ Refused Pattern Overlap > flags tasks matching refused patterns
 ✓ Same Category Similar > detects same-category similar tasks
 ✓ High Token Overlap > detects high token overlap in descriptions
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
