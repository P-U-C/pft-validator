# Off-Grid Scope Regression Fixtures

Fixture pack for Hive Mind task generation guards. Catches deprecated, duplicate, stale, and off-mission work before tasks reach contributors.

## Guard Philosophy

A scope rejection is not a contributor rejection. The guard rejects **task shapes**, not people or intent.

When possible, rejected tasks should be redirected into one of three safe forms:

1. **Build on existing infrastructure** instead of duplicating it.
2. **Produce an artifact within contributor control** instead of requiring external response.
3. **Use public, currently available data** instead of inaccessible or unstable sources.

The goal is to preserve contributor momentum by catching impossible/wasteful tasks early and redirecting valid intent toward achievable work.

## Classification Labels

| Label | Meaning | Guard Action |
|-------|---------|--------------|
| `on-mission` | Valid network work | `allow` |
| `off-grid` | Outside network mission scope | `reject` or `reject_and_redirect` |

### Scope Classifications (Fine-Grained)

| scope_classification | Signal | Typical Action |
|---------------------|--------|----------------|
| `on_mission` | Valid, achievable, non-duplicate | `allow` |
| `off_grid` | Unrelated vertical, wrong domain | `reject` |
| `duplicate` | Describes existing production functionality | `reject` or `reject_and_redirect` |
| `stale` | Targets unstable interface or premature optimization | `reject_and_redirect` |
| `deprecated` | Assumes superseded architecture | `reject_and_redirect` |
| `unverifiable` | Completion depends on uncontrollable external factors | `reject_and_redirect` |
| `policy_violation` | Violates explicit network rules | `reject` |
| `adversarial` | Describes gaming/sybil strategy | `reject` |

## Fixture Structure

Each fixture in `fixtures.json` conforms to `fixtures.schema.json`:

```json
{
  "id": "SR-XX",
  "title": "Task title as generator would issue it",
  "description": "Full task description",
  "classification": "off-grid | on-mission",
  "scope_classification": "on_mission | off_grid | duplicate | stale | deprecated | unverifiable | policy_violation | adversarial",
  "category": "human-readable subcategory",
  "rationale": "Why this classification is correct",
  "expected_guard_action": "allow | reject | reject_and_redirect | manual_review",
  "expected_guard_output": {
    "decision": "reject_and_redirect",
    "scope_classification": "duplicate",
    "matched_fixture_ids": ["SR-09"],
    "confidence": "high",
    "reason_codes": ["ALREADY_SHIPPED", "DUPLICATES_EXISTING_TOOLING"],
    "safe_reframe_required": true,
    "reviewer_note": "Only issue extension task if existing implementation is referenced."
  },
  "regression_signal": "The detectable pattern (null for on-mission)",
  "boundary_pair": "SR-XX (paired fixture showing the valid/invalid boundary)"
}
```

## Boundary Pairs

Boundary pairs prove the guard has judgment, not just a blunt refusal reflex. Each pair shows a rejected task alongside its valid near-neighbor:

| Reject | Allow | Boundary |
|--------|-------|----------|
| SR-04: Regex memo parser | SR-19: Metadata activity classifier | Deprecated architecture vs working with current constraints |
| SR-05: Static API docs for unstable endpoints | SR-20: Schema-change watchlist | Pretending stability vs acknowledging churn |
| SR-09: Rebuild encrypted IPFS pipeline | SR-11: Extend pft_indexing with intelligence schema | Duplicating shipped work vs composing on top of it |
| SR-17: Get 20 signups | SR-18: Create outreach artifact pack | Outcome-dependent vs artifact-dependent |

## Refusal Patterns

`refusal-patterns.json` contains 4 structural anti-patterns:

1. **no_response_risk** — Completion depends on uncontrollable external party
2. **wrong_scope_dressed_up** — Unrelated work wrapped in network terminology
3. **already_done_duplication** — Shipped functionality proposed as new work
4. **context_verification_mismatch** — Task references inaccessible/non-existent data sources

Each pattern includes a classifier signal (what to detect) and a guard message (what to tell the generator).

## How to Consume These Fixtures

### As a Prompt-Level Guard

Inject the fixture pack into the task generator's system prompt as few-shot examples:

```
Before issuing any task, classify it against these scope regression fixtures.
If the proposed task matches any off-grid pattern:
1. Identify which fixture(s) it matches
2. Apply the expected_guard_action
3. If reject_and_redirect: reframe using the regression_signal as guidance
4. Output the expected_guard_output structure

[fixtures.json contents here]
```

### As a Regression Test Suite

```python
import json

def load_fixtures():
    with open("fixtures.json") as f:
        return json.load(f)

def load_expected():
    with open("expected-results.json") as f:
        return json.load(f)["results"]

def test_scope_guard(classifier_fn):
    """Run all fixtures through classifier and check against expected results."""
    fixtures = load_fixtures()
    expected = load_expected()
    failures = []

    for fixture in fixtures:
        result = classifier_fn(fixture["title"], fixture["description"])
        expected_action = expected[fixture["id"]]

        if result["decision"] != expected_action:
            failures.append({
                "id": fixture["id"],
                "expected": expected_action,
                "got": result["decision"],
                "signal": fixture["regression_signal"]
            })

    assert not failures, f"REGRESSION: {len(failures)} fixtures misclassified: {failures}"

def test_boundary_pairs(classifier_fn):
    """Verify guard distinguishes reject/allow boundaries correctly."""
    fixtures = {f["id"]: f for f in load_fixtures()}
    pairs = [
        ("SR-04", "SR-19"),
        ("SR-05", "SR-20"),
        ("SR-09", "SR-11"),
        ("SR-17", "SR-18"),
    ]
    for reject_id, allow_id in pairs:
        reject_fixture = fixtures[reject_id]
        allow_fixture = fixtures[allow_id]

        reject_result = classifier_fn(reject_fixture["title"], reject_fixture["description"])
        allow_result = classifier_fn(allow_fixture["title"], allow_fixture["description"])

        assert reject_result["decision"] in ("reject", "reject_and_redirect"), (
            f"BOUNDARY FAIL: {reject_id} should be rejected but got {reject_result['decision']}"
        )
        assert allow_result["decision"] == "allow", (
            f"FALSE POSITIVE: {allow_id} should be allowed but got {allow_result['decision']}"
        )
```

### As a Before/After Evaluation

`before-after-demo.json` shows 4 scenarios where:
- **Unguided generator** issues a problematic task (with failure cost analysis)
- **Fixture-backed guard** catches it, classifies it, and either rejects or reframes

Use these for evaluating guard effectiveness: the guard should match or exceed the demonstrated catch rate.

### Using expected-results.json

For minimal integration, `expected-results.json` provides a flat ID→action lookup:

```python
expected = json.load(open("expected-results.json"))["results"]
assert classifier_output["decision"] == expected["SR-04"]
```

## Classification Logic (Decision Tree)

```
1. Does the task assume architecture that no longer exists?
   → YES: reject_and_redirect (deprecated)

2. Does the task describe functionality already in production?
   → YES: reject or reject_and_redirect (duplicate)

3. Remove all PFT/network references. Does remaining work overlap with:
   - AI coordination
   - Financial intelligence
   - Contributor/validator tooling
   - Network growth infrastructure
   → NO to all: reject (off_grid)

4. Does completion depend on uncontrollable external response?
   → YES: reject_and_redirect (unverifiable)

5. Does it target a rapidly-changing interface where docs have negative EV?
   → YES: reject_and_redirect (stale)

6. Does it violate explicit network policy?
   → YES: reject (policy_violation)

7. Does it describe a gaming/sybil strategy?
   → YES: reject (adversarial)

8. Otherwise → allow (on_mission)
```

## Reviewer Checklist

Before accepting this artifact, verify:

- [ ] All JSON files parse cleanly (`python -m json.tool <file> >/dev/null`)
- [ ] fixtures.json contains ≥12 synthetic fixtures with expected classifications
- [ ] Covers: off-grid, duplicate, stale, deprecated, unverifiable, policy_violation, adversarial, on-mission
- [ ] refusal-patterns.json contains 4 anonymized refusal-pattern examples
- [ ] before-after-demo.json shows unguided vs fixture-backed comparison
- [ ] README explains classification logic and guard consumption
- [ ] Boundary pairs demonstrate guard judgment (not just blanket rejection)
- [ ] fixtures.schema.json enables machine validation
- [ ] expected-results.json enables minimal test integration

## File Manifest

| File | Contents |
|------|----------|
| `fixtures.json` | 20 synthetic task fixtures (12 off-grid + 8 on-mission with boundary pairs) |
| `fixtures.schema.json` | JSON Schema for fixture validation |
| `expected-results.json` | Flat ID→action lookup for test runners |
| `refusal-patterns.json` | 4 structural anti-patterns with classifier signals |
| `before-after-demo.json` | 4 before/after scenarios showing guard value |
| `README.md` | This file — classification logic, consumption guide, reviewer checklist |

## Design Principles

- **Grounded in real failures**: Every off-grid fixture maps to an actual task generation failure observed on the network (anonymized).
- **Balanced**: Includes on-mission positive controls and boundary pairs to catch false-positive regressions.
- **Deterministic**: `expected_guard_output` turns fixtures into executable contracts, not just examples.
- **Self-contained**: No external dependencies. Copy the JSON files into any test harness.
- **Composable**: Works alongside (not replacing) the existing guardrail replay pack and RAG reliability fixtures.
- **Machine-consumable**: JSON Schema + expected-results enable automated validation without human parsing.
