# Off-Grid Scope Regression Fixtures

Fixture pack for Hive Mind task generation guards. Catches deprecated, duplicate, stale, and off-mission work before tasks reach contributors.

## Classification Labels

| Label | Meaning | Guard Action |
|-------|---------|--------------|
| `on-mission` | Valid network work | `allow` |
| `off-grid` | Outside network mission scope | `reject` |

### Off-Grid Subcategories

| Subcategory | Signal | Example |
|-------------|--------|---------|
| `deprecated_sidecar` | References abandoned/deprioritized workstream | Nostr relay for encrypted memos |
| `wrong_scope` | Unrelated vertical dressed in network terminology | Esports coaching, AEC tools, proptech |
| `deprecated_approach` | Assumes superseded architecture | Regex parsing of keystone-encrypted memos |
| `stale_surface` | Targets unstable interface or premature optimization | API docs for rapidly-changing endpoints |
| `already_shipped` | Describes existing production functionality | Rebuilding pft_indexing from scratch |
| `policy_violation` | Violates explicit network rules | Price predictions, financial advice |
| `adversarial` | Describes gaming/sybil strategy as legitimate work | Auto-accept-and-submit bots |

### On-Mission Subcategories

| Subcategory | Signal |
|-------------|--------|
| `valid_network_infra` | Builds coordination, reputation, or contributor tooling |
| `valid_schema_extension` | Extends existing primitives compositionally |
| `valid_alpha_tooling` | Produces verifiable financial intelligence artifacts |

## Fixture Structure

Each fixture in `fixtures.json`:

```json
{
  "id": "SR-XX",
  "title": "Task title as generator would issue it",
  "description": "Full task description",
  "classification": "off-grid | on-mission",
  "category": "subcategory from tables above",
  "rationale": "Why this classification is correct",
  "expected_guard_action": "reject | allow",
  "regression_signal": "The detectable pattern (null for on-mission)"
}
```

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
3. If reject: either refuse or reframe using the regression_signal as guidance

[fixtures.json contents here]
```

### As a Regression Test Suite

```python
import json

def load_fixtures():
    with open("fixtures.json") as f:
        return json.load(f)

def test_classifier_catches_off_grid(classifier_fn):
    """Verify classifier rejects all off-grid fixtures."""
    fixtures = load_fixtures()
    for fixture in fixtures:
        result = classifier_fn(fixture["title"], fixture["description"])
        if fixture["classification"] == "off-grid":
            assert result["action"] == "reject", (
                f"REGRESSION: {fixture['id']} ({fixture['category']}) "
                f"was allowed but should be rejected. "
                f"Signal: {fixture['regression_signal']}"
            )
        else:
            assert result["action"] == "allow", (
                f"FALSE POSITIVE: {fixture['id']} was rejected "
                f"but is valid on-mission work."
            )

def test_classifier_allows_on_mission(classifier_fn):
    """Verify classifier doesn't block valid network work."""
    fixtures = load_fixtures()
    on_mission = [f for f in fixtures if f["classification"] == "on-mission"]
    for fixture in on_mission:
        result = classifier_fn(fixture["title"], fixture["description"])
        assert result["action"] == "allow", (
            f"FALSE POSITIVE: {fixture['id']} blocked valid work. "
            f"Category: {fixture['category']}"
        )
```

### As a Before/After Evaluation

`before-after-demo.json` shows 4 scenarios where:
- **Unguided generator** issues a problematic task (with failure cost analysis)
- **Fixture-backed guard** catches it, classifies it, and either rejects or reframes

Use these for evaluating guard effectiveness: the guard should match or exceed the demonstrated catch rate.

## Classification Logic (Decision Tree)

```
1. Does the task assume architecture that no longer exists?
   → YES: reject (deprecated_approach)

2. Does the task describe functionality already in production?
   → YES: reject (already_shipped)

3. Remove all PFT/network references. Does remaining work overlap with:
   - AI coordination
   - Financial intelligence
   - Contributor/validator tooling
   - Network growth infrastructure
   → NO to all: reject (wrong_scope)

4. Does completion depend on uncontrollable external response?
   → YES: reject (no_response_risk) or reframe to artifact-based completion

5. Does it target a rapidly-changing interface where docs have negative EV?
   → YES: reject (stale_surface)

6. Does it violate explicit network policy?
   → YES: reject (policy_violation)

7. Does it describe a gaming/sybil strategy?
   → YES: reject (adversarial)

8. Otherwise → allow (on-mission)
```

## File Manifest

| File | Contents |
|------|----------|
| `fixtures.json` | 16 synthetic task fixtures (12 off-grid + 4 on-mission) |
| `refusal-patterns.json` | 4 structural anti-patterns with classifier signals |
| `before-after-demo.json` | 4 before/after scenarios showing guard value |
| `README.md` | This file — classification logic and consumption guide |

## Design Principles

- **Grounded in real failures**: Every off-grid fixture maps to an actual task generation failure observed on the network (anonymized).
- **Balanced**: Includes on-mission positive controls to catch false-positive regressions.
- **Self-contained**: No external dependencies. Copy the JSON files into any test harness.
- **Composable**: Works alongside (not replacing) the existing guardrail replay pack and RAG reliability fixtures.
