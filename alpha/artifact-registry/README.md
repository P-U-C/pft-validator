# Post Fiat Artifact Reuse Registry

A privacy-safe index of shipped Post Fiat artifacts so contributors can extend, reproduce, or distribute existing work instead of duplicating it.

## Purpose

This registry answers three questions:

1. **"Does this already exist?"** — Before building, check if the artifact is already shipped.
2. **"How do I reuse it?"** — Each entry has specific reuse instructions.
3. **"What would duplicate it?"** — Each entry has duplicate-risk notes for task generators.

## Privacy Rules

- All entries use **public URLs only** — no private repos, no authenticated endpoints
- No individual wallet balances, per-recipient rewards, or personal information
- Project-scoped artifacts (not yet public) use `project-scoped://` placeholder URLs
- Maintainer identified by category (community_contributor, ecosystem_developer), never by wallet address or personal identity
- No de-anonymization of pseudonymous contributors

## Entry Format

Each registry entry contains:

| Field | Description |
|-------|-------------|
| `id` | Unique identifier (ART-XX) |
| `asset_name` | Human-readable name |
| `lane` | Work lane: agent_reliability, market_intelligence, network_analytics, etc. |
| `artifact_type` | What it is: test_fixtures, json_schema, dashboard, pipeline_script, etc. |
| `public_url` | Direct link (or project-scoped placeholder) |
| `status` | live, shipped, in_development |
| `maintainer_category` | Who maintains it (no personal info) |
| `reuse_instructions` | How to use or extend the artifact |
| `suggested_reproduction_task` | A concrete beginner task that tests/validates this artifact |
| `duplicate_risk_notes` | What NOT to build — guards against wasted work |
| `evidence_standard` | How to prove you've successfully reused/tested it |

## Files

| File | Format | Purpose |
|------|--------|---------|
| `registry.json` | JSON | Machine-readable registry with full metadata |
| `registry.csv` | CSV | Spreadsheet-friendly flat format |
| `README.md` | Markdown | This documentation |

## How Contributors Use This Registry

### Finding Work

1. Browse entries by `lane` to find your area of interest
2. Check `suggested_reproduction_task` for beginner-friendly entry points
3. Check `reuse_instructions` to understand how to extend an existing artifact

### Avoiding Duplication

Before accepting or proposing a task:

1. Search the registry by keyword (asset_name, lane, artifact_type)
2. Read `duplicate_risk_notes` for any matching entries
3. If your proposed work overlaps, reframe as an **extension** rather than a rebuild

### Submitting Evidence

Use the `evidence_standard` field to understand what proof is expected when you reproduce or extend an artifact.

## How Task Generators Use This Registry

### Pre-Issuance Check

Before issuing a task, query the registry:

```python
import json

with open("registry.json") as f:
    registry = json.load(f)

def check_duplicate_risk(proposed_task_title, proposed_task_description):
    """Check if proposed task duplicates an existing artifact."""
    risks = []
    keywords = proposed_task_title.lower().split() + proposed_task_description.lower().split()

    for entry in registry["entries"]:
        entry_keywords = (
            entry["asset_name"].lower().split() +
            entry["lane"].lower().split() +
            entry["duplicate_risk_notes"].lower().split()
        )
        overlap = set(keywords) & set(entry_keywords)
        if len(overlap) > 3:
            risks.append({
                "matching_artifact": entry["id"],
                "asset_name": entry["asset_name"],
                "duplicate_risk": entry["duplicate_risk_notes"],
                "reuse_path": entry["reuse_instructions"]
            })

    return risks
```

### Generating Reproduction Tasks

The `suggested_reproduction_task` field provides ready-made beginner tasks:

```python
beginner_tasks = [
    {
        "source_artifact": entry["id"],
        "task": entry["suggested_reproduction_task"],
        "evidence_standard": entry["evidence_standard"]
    }
    for entry in registry["entries"]
    if entry["status"] in ("shipped", "live")
]
```

## Update Process

1. Ship a new artifact (gist, repo, dashboard, schema)
2. Add an entry to both `registry.json` and `registry.csv`
3. Include: public URL, reuse instructions, duplicate-risk notes
4. Submit PR or update directly

### What Qualifies as a Registry Entry

- Must be **publicly accessible** (or have a clear path to public)
- Must be **reusable** — others can extend, test, or reproduce it
- Must have been **rewarded or actively used** on the network
- Must NOT contain private data, individual balances, or personal info

### What Does NOT Qualify

- One-off task submissions with no reuse value
- Private infrastructure that can't be shared
- Deprecated artifacts that have been superseded (unless noted as "deprecated, see X instead")

## Lanes

| Lane | Description | Example Artifacts |
|------|-------------|-------------------|
| `agent_reliability` | Test fixtures and guards for AI agent behavior | Guardrail pack, scope regression fixtures |
| `market_intelligence` | Alpha generation, signal corpora, research schemas | Alpha brief schema, LLM convergence corpus |
| `network_analytics` | Dashboards, metrics, visualizations | Lens, Herald, adoption metrics |
| `task_generation_quality` | Task issuance quality, reviewer tooling | Scope fixtures, reviewer queue reducer |
| `task_lifecycle` | Task friction, stalled recovery, contributor UX | Friction triage, stalled task triage |
| `publication_infrastructure` | Encryption, IPFS, subscriber gating | pft_indexing, Herald v2 converter |
| `subscription_infrastructure` | On-chain subscriptions, access control | SUBS protocol |
| `growth_content` | Explainers, recruiting, social distribution | Retail explainer pack |
| `onboarding` | Documentation, first-contribution guides | Task Node docs |
| `community_reference` | Curated indices, project directories | Awesome Post Fiat |
| `reward_mechanism` | Reward scaling, evidence evaluation | Reward cap reducer |
| `alpha_tooling` | Scanners, scoring engines, trading tools | LLM convergence scanner |

## Duplicate-Risk Decision Matrix

| Proposed task type | Registry match exists? | Correct action |
|---|---:|---|
| Same artifact, same purpose | Yes | Reject as duplicate |
| Same artifact, new fixtures/tests | Yes | Allow as test extension |
| Same artifact, new lane integration | Yes | Allow as integration extension |
| Same artifact, beginner walkthrough | Yes | Allow as reproduction |
| Same problem, no reference to canonical artifact | Yes | Rewrite before issuance — must reference existing |
| Deprecated/superseded artifact | Yes | Redirect to successor |
| Private-only artifact | Project-scoped | Require sanitized placeholder or public equivalent |
| No registry match | No | Allow (new work) |

## Duplicate-Risk Integration with Scope Regression Fixtures

This registry works alongside the [scope regression fixtures](../scope-regression-fixtures/). The fixtures catch duplicate-risk at the classification level (SR-07, SR-08, SR-09 are all `already_shipped`). This registry provides the **specific artifact** that would be duplicated, plus the **reuse path** to redirect contributor effort productively.

Example flow:
1. Task generator proposes: "Build encrypted IPFS publishing pipeline"
2. Scope guard matches SR-09 → `reject_and_redirect`
3. Registry lookup finds ART-12 (pft_indexing) → provides reuse instructions
4. Redirected task: "Extend pft_indexing with intelligence schema" → `allow`

## Machine Access

Use raw files for agents and scripts — do not scrape GitHub HTML:

- **JSON**: `https://raw.githubusercontent.com/P-U-C/pft-validator/main/alpha/artifact-registry/registry.json`
- **CSV**: `https://raw.githubusercontent.com/P-U-C/pft-validator/main/alpha/artifact-registry/registry.csv`
- **Schema**: `https://raw.githubusercontent.com/P-U-C/pft-validator/main/alpha/artifact-registry/registry.schema.json`

Agents should consume `registry.json` first and use `registry.csv` only for spreadsheet review.

## Validation

The registry is machine-checkable and self-verifying:

```bash
python validate_registry.py
```

Expected output:

```text
OK: registry.json parses
OK: registry.csv parses
OK: 18 CSV rows match 18 JSON entries (declared: 18)
OK: CSV/JSON ID order matches
OK: all required fields present and non-empty
OK: no duplicate IDs
OK: no duplicate asset names
OK: all URLs use allowed schemes (https:// or project-scoped://)
OK: privacy pattern checks passed (no wallets, emails, private hosts)
OK: no bidirectional Unicode control characters
OK: registry.json validates against registry.schema.json

==================================================
PASSED: all checks green, 0 warning(s)
```

Checks performed:
- JSON and CSV parse without error
- Entry counts match across declared, JSON, and CSV
- IDs are unique, non-duplicate, and in matching order
- All 11 required fields present and non-empty in both formats
- URL schemes restricted to `https://` and `project-scoped://`
- No XRPL wallet patterns, email addresses, or private hostnames
- No bidirectional Unicode control characters
- Full JSON Schema validation

## Files

| File | Format | Purpose |
|------|--------|---------|
| `registry.json` | JSON | Machine-readable registry with 18 entries and full metadata |
| `registry.csv` | CSV | Spreadsheet-friendly flat format with all required fields |
| `registry.schema.json` | JSON Schema | Validates registry structure, field types, and allowed values |
| `validate_registry.py` | Python | Self-verification script (privacy, parity, schema, bidi checks) |
| `README.md` | Markdown | This documentation |
