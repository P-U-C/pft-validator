---
layout: default
title: "Protocol-Safe Artifact Discovery UX Specification v1.0"
date: 2026-04-22
category: network
status: published
task_id: 9b5c1287-9589-403b-aa76-2cfe460f9570
reward: 4800 PFT
---

# Protocol-Safe Artifact Discovery UX Specification v1.0

**Author:** Zoz (Permanent Upper Class Validator)  
**Date:** April 22, 2026  
**Task ID:** 9b5c1287-9589-403b-aa76-2cfe460f9570  
**Status:** Implementation guidance for core-team signoff  
**Public URL:** [pft.permanentupperclass.com/alpha/artifact-discovery-spec/](https://pft.permanentupperclass.com/alpha/artifact-discovery-spec/)

> The purpose of artifact discovery UX is not to maximize visibility; it is to maximize safe coordination under asymmetric evidence access.

---

## 1. Problem Statement

### The Failure Mode We Lived

On April 22, 2026, the task node generated a collaborative cross-check task: *"Pick one public note from the current Private Profile CMC portfolio cohort that is not your own prior artifact, rerun the same live add-or-update flow, and publish a delta report."*

The task was structurally impossible to complete. Six discovery methods were attempted over 30 minutes — task UI, GitHub profile search, HackMD search, public gist search, task node chat, direct inquiry — and zero public cohort artifacts were found. The system generated a task that assumed artifact discoverability the protocol does not provide.

This is not an edge case. It is a structural gap that affects every collaborative task on the network.

### Five Root Causes

1. **No artifact visibility model.** The protocol has no concept of whether a submitted artifact is public, private, obfuscated, or legacy. When a producer submits evidence, the system records completion but not the artifact's accessibility state.

2. **No discovery surface.** The collaboration panel shows producer names and completion status but not submission URLs. A producer joining a collaborative task has zero visibility into what other producers submitted.

3. **No privacy-safe metadata layer.** Some artifacts legitimately cannot be public — they may contain proprietary data, MNPI, or sensitive operational details. The system has no model for surfacing proof-of-existence without leaking restricted content.

4. **Legacy submission gap.** Artifacts created before common sharing norms (repos, gists, public URLs) have no migration path. The system treats all completions identically regardless of when or how evidence was submitted.

5. **No impossible-task detection.** The task generator does not check whether prerequisite conditions (e.g., "find a public cohort note") are satisfiable before creating the task. **The system must block generation of tasks whose required evidence path is impossible under current visibility constraints.**

### Bad Outcomes This Spec Must Prevent

- A collaborator is asked to work from evidence they cannot legally or practically see
- A reviewer is forced to infer validity from missing or restricted artifacts
- Private evidence leaks through "helpful" metadata
- Legacy tasks contaminate current verification rules
- The product allows tasks to be created that are impossible to verify under the stated visibility state

---

## 2. Artifact Visibility State Model

Every submitted artifact has exactly one visibility state. The submitter sets it at submission time. The system enforces access rules based on state.

**Core principle:** Discovery is role-scoped. Visibility state and verification state are related but not identical. Restricted artifacts may support review without supporting open collaboration.

### Visibility-State Matrix

| State | Definition | Who Can See URL | Who Can See Metadata | Collaborator Access | Reviewer Access |
|-------|-----------|----------------|---------------------|-------------------|----------------|
| **public** | URL loads without login | Everyone | Everyone | Full artifact | Full artifact |
| **private** | Exists but URL is restricted | Nobody external | Cohort + reviewers | Metadata only (title, date, hash) | Full artifact (gated) |
| **obfuscated** | Redacted version available | Everyone (redacted) | Cohort + reviewers | Redacted version | Full artifact (gated) |
| **legacy** | Pre-dates sharing norms | Nobody | Reviewers only | Not available | Manual review |

### Obfuscation Subtypes

Obfuscation is not one state — it is a verification spectrum. Three subtypes, ordered by information exposure:

| Subtype | Content | Metadata | Verification Path |
|---------|---------|----------|-------------------|
| **obfuscated-content / clear-metadata** | Restricted | Title, date, task ID, hash — all public | Reviewer verifies full content via gated link |
| **obfuscated-content / partial-metadata** | Restricted | Only date and hash public; title/task redacted | Reviewer verifies full content + metadata via gated link |
| **sealed with verifier escrow** | Restricted | Nothing public | Designated verifier holds escrow key; existence proved by hash only |

The submitter selects the subtype at submission time. The system enforces the corresponding metadata exposure rules.

### State Transition Rules

```
                    ┌──────────┐
     submission ───>│  public  │───> discoverable by all
                    └──────────┘
                         │
                   submitter can
                   downgrade to:
                         │
                    ┌──────────┐
                    │ private  │───> metadata visible to cohort
                    └──────────┘
                         │
                   submitter can
                    publish a:
                         │
                    ┌────────────┐
                    │ obfuscated │───> redacted version public
                    └────────────┘

                    ┌──────────┐
     pre-norm  ───>│  legacy  │───> reviewer attestation only
     submission    └──────────┘
                         │
                    submitter can
                    upgrade to any
                    state above
```

**Invariants:**
- A submitter can always upgrade visibility (private → public)
- A submitter can downgrade visibility only if no active collaborative task depends on the artifact being public
- The system never forces an artifact public — it may flag, warn, or reroute, but never override the submitter's privacy choice
- Legacy artifacts default to `legacy` state until the submitter explicitly upgrades
- Legacy artifacts are not grandfathered into full trust; they are admitted under declared limitations

---

## 3. Three-Layer Proof Model

Every artifact must satisfy three proof layers. Each visibility state has different requirements for how each proof is delivered.

| Proof Layer | What It Proves | Example |
|-------------|---------------|---------|
| **Existence proof** | This artifact existed at the claimed time | Content hash + timestamp, URL snapshot, blockchain anchor |
| **Relevance proof** | This artifact pertains to the claimed task | Task ID reference, content headings match verification criteria |
| **Completion proof** | This artifact is sufficient to support the claimed output | Meets all verification requirements, reviewer sign-off |

### Proof Requirements by Visibility State

| State | Existence Proof | Relevance Proof | Completion Proof |
|-------|----------------|-----------------|------------------|
| **public** | URL resolves + content hash matches | Public content shows task reference | Reviewer checks against verification criteria |
| **private** | Content hash + timestamp recorded at submission | Task ID in metadata (visible to cohort) | Reviewer verifies via gated link |
| **obfuscated** | Redacted URL resolves + full hash matches | Redacted version shows task reference | Reviewer verifies full version; confirms redaction preserves verification-critical content |
| **legacy** | Reviewer attestation only | Reviewer attestation only | Reviewer attestation; 30-day grace to provide machine-verifiable proof |

---

## 4. Collaboration Eligibility

**Discoverable does not mean reusable. Reusable does not mean reviewable. Reviewable does not mean collaborator-visible.**

Collaboration eligibility is a first-class field, distinct from visibility. It determines whether an artifact can participate in collaborative task flows.

| Eligibility | Meaning | Visibility States That Can Qualify |
|-------------|---------|-----------------------------------|
| **open** | Available for cross-check, co-development, and cohort reference | `public` |
| **constrained** | Available for reference but not direct cross-check (cohort can see metadata, not content) | `obfuscated` (clear-metadata subtype) |
| **reviewer-only** | Available for adjudication but not collaboration | `private`, `obfuscated` (sealed subtype) |
| **not-eligible** | Cannot support any collaborative flow | `legacy` (until upgraded) |

**System rule:** A task requiring `open` collaboration eligibility cannot be published if all supporting artifacts are `reviewer-only` or `not-eligible`.

---

## 5. Metadata Leakage Classes

A private artifact can leak information through title, filename, repo path, timestamp clustering, or collaborator identity. The spec defines four metadata classes:

| Class | Examples | Exposure Rule |
|-------|----------|---------------|
| **safe-public** | Content hash, submission date, visibility state badge, collaboration eligibility | Always visible to cohort and reviewers |
| **sensitive-operational** | Artifact title, task ID reference, word count, file type | Visible to cohort for `public` and `obfuscated-clear-metadata`; hidden for `private` and `sealed` |
| **identity-revealing** | Submitter handle, repo path, filename, linked profile | Visible only when submitter has opted into public visibility; otherwise anonymized to role-based identifier |
| **forbidden-derivative** | Inferred content from metadata combinations (e.g., title + date + task category reveals proprietary work) | System must flag when metadata combination creates derivative exposure risk; submitter warned before surfacing |

---

## 6. Artifact Verification Envelope

Every artifact discovery object carries a normalized envelope, even if the payload is hidden. This turns the spec from a UX recommendation into a data contract.

```
{
  artifact_id:                  string (UUID)
  task_id:                      string (UUID)
  visibility_state:             "public" | "private" | "obfuscated" | "legacy"
  obfuscation_subtype:          "clear_metadata" | "partial_metadata" | "sealed" | null
  evidence_class:               string
  created_at:                   timestamp
  created_by_role:              "producer" | "reviewer" | "system"

  // Discovery fields
  collaborator_discoverable:    boolean
  collaboration_eligibility:    "open" | "constrained" | "reviewer_only" | "not_eligible"
  reviewer_access_mode:         "direct" | "attested" | "escrow" | "unavailable"

  // Metadata (role-scoped)
  public_metadata_fields:       string[]   // e.g., ["title", "date", "hash"]
  artifact_title:               string | null  // null if sensitive-operational
  artifact_url:                 string | null  // null if private/sealed
  artifact_redacted_url:        string | null  // populated if obfuscated
  artifact_content_hash:        string (SHA-256)
  artifact_url_status:          "live" | "dead" | "unknown"
  artifact_verified_at:         timestamp | null

  // Proof layers
  proof_of_existence_method:    "url_resolve" | "hash_timestamp" | "reviewer_attestation"
  proof_of_integrity_method:    "hash_match" | "reviewer_attestation" | "escrow_verify"
  proof_of_relevance_method:    "content_reference" | "metadata_reference" | "reviewer_attestation"

  // Legacy handling
  legacy_status:                "n/a" | "pending_migration" | "migrated" | "grace_expired"
  legacy_confidence_tier:       "high" | "medium" | "low" | null
  legacy_normalization_status:  "normalized" | "partial" | "unnormalized" | null
  legacy_allowed_use:           "collaboration" | "adjudication_only" | "historical_reference" | null

  // Review
  review_eligibility:           "standard" | "manual_required" | "attestation_only"
  notes_for_reviewer:           string | null
}
```

---

## 7. UX Flows

### Flow 1: Submitter — Evidence Submission with Visibility Selection

```
┌─────────────────────────────────────────────────────────┐
│                   SUBMIT EVIDENCE                        │
│                                                          │
│  Evidence URL: [________________________________]        │
│                                                          │
│  Visibility:                                             │
│  ┌──────────────────────────────────────────────────┐    │
│  │ ○ Public — URL loads without login               │    │
│  │   Collaboration eligibility: OPEN                │    │
│  │                                                  │    │
│  │ ○ Private — exists but restricted                │    │
│  │   Collaboration eligibility: REVIEWER-ONLY       │    │
│  │   ⚠ Cannot be used for cross-check tasks        │    │
│  │                                                  │    │
│  │ ○ Obfuscated — redacted version available        │    │
│  │   Subtype: [clear-metadata ▼]                    │    │
│  │   Redacted URL: [____________________________]   │    │
│  │   Collaboration eligibility: CONSTRAINED         │    │
│  └──────────────────────────────────────────────────┘    │
│                                                          │
│  [ Submit ]                                              │
└─────────────────────────────────────────────────────────┘

         ┌──────────────────────────────────────┐
         │  ⚠ COLLABORATIVE TASK WARNING         │
         │                                        │
         │  This task is part of a collaborative  │
         │  cohort. Selecting "Private" means     │
         │  your artifact cannot be used for      │
         │  cross-check tasks by other producers. │
         │                                        │
         │  [ Continue as Private ]               │
         │  [ Switch to Public ]                  │
         └──────────────────────────────────────┘
```

**Empty/Failure States:**
- URL empty: *"Evidence URL is required."*
- URL unreachable + state is public: *"URL does not resolve. Verify the link loads without login."*
- Obfuscated + no redacted URL: *"Provide a redacted URL for the public version."*
- Metadata combination flagged: *"⚠ The combination of title + task category may reveal restricted content. Review before surfacing."*

### Flow 2: Collaborator — Cohort Artifact Discovery

```
┌─────────────────────────────────────────────────────────┐
│            COLLABORATION PANEL — 7/12                    │
│                                                          │
│  ┌─ Wizbubba ─────────────────────────────────────────┐  │
│  │  Status: Rewarded  │  Eligibility: OPEN             │  │
│  │  Artifact: 🌐 PUBLIC                                │  │
│  │  ┌────────────────────────────────────────────┐     │  │
│  │  │ "Test Private Profile Portfolio Edit and   │     │  │
│  │  │  Reload Flow"                              │     │  │
│  │  │  hackmd.io/@wizbubba/cmc-portfolio-qa      │     │  │
│  │  │  Hash: b4e1...c7f2  Verified: 2h ago       │     │  │
│  │  │  [ Open ] [ Use for Cross-Check ]          │     │  │
│  │  └────────────────────────────────────────────┘     │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                          │
│  ┌─ r9oHNN...Sa32 ───────────────────────────────────┐   │
│  │  Status: Rewarded  │  Eligibility: REVIEWER-ONLY   │   │
│  │  Artifact: 🔒 PRIVATE                              │   │
│  │  ┌────────────────────────────────────────────┐    │   │
│  │  │ Hash: a3f7c2...9e1b                        │    │   │
│  │  │ Date: 2026-04-19                           │    │   │
│  │  │ ⚠ Artifact exists but cannot be used       │    │   │
│  │  │   for open collaboration                   │    │   │
│  │  └────────────────────────────────────────────┘    │   │
│  └────────────────────────────────────────────────────┘   │
│                                                          │
│  ┌─ Nydiokar ────────────────────────────────────────┐   │
│  │  Status: Rewarded  │  Eligibility: NOT-ELIGIBLE    │   │
│  │  Artifact: 📦 LEGACY (low confidence)               │   │
│  │  ┌────────────────────────────────────────────┐    │   │
│  │  │ Pre-dates common sharing norms.            │    │   │
│  │  │ Reviewer-verified completion.              │    │   │
│  │  │ Allowed use: historical reference only     │    │   │
│  │  └────────────────────────────────────────────┘    │   │
│  └────────────────────────────────────────────────────┘   │
│                                                          │
│  OPEN ARTIFACTS: 1 of 5                                  │
│  ⚠ Cross-check tasks require ≥1 artifact with OPEN      │
│    collaboration eligibility                             │
└─────────────────────────────────────────────────────────┘
```

**Empty/Failure States:**
- 0 open artifacts: *"No artifacts with open collaboration eligibility in this cohort. Cross-check tasks cannot be generated."*
- Dead URL: *"⚠ URL no longer resolves. Last verified: [date]. Reviewer access path: missing; submission can proceed only as manual review."*
- Restricted evidence: *"Restricted evidence detected; public discovery limited to existence-only metadata."*

### Flow 3: Reviewer — Verification with Three-Layer Proof Checks

```
┌─────────────────────────────────────────────────────────┐
│              REVIEWER VERIFICATION PANEL                  │
│                                                          │
│  Submitter: Zoz                                          │
│  Visibility: 🌐 PUBLIC  │  Eligibility: OPEN             │
│  Access mode: direct                                     │
│                                                          │
│  ┌── Three-Layer Proof ─────────────────────────────┐    │
│  │                                                   │    │
│  │  Existence:                                       │    │
│  │  ✓ URL resolves (200 OK, checked 30s ago)         │    │
│  │  ✓ Content hash matches submission record         │    │
│  │                                                   │    │
│  │  Relevance:                                       │    │
│  │  ✓ Content references task ID 7af25b17            │    │
│  │  ✓ Contains required headings                     │    │
│  │                                                   │    │
│  │  Completion:                                      │    │
│  │  ✓ Scenario label present                         │    │
│  │  ✓ Request text included                          │    │
│  │  ✗ Cohort note URL referenced: NOT FOUND          │    │
│  │    → Submitter documented discovery failure        │    │
│  │    → Manual review required                        │    │
│  └──────────────────────────────────────────────────┘    │
│                                                          │
│  Decision: [ Approve ] [ Request Changes ] [ Reject ]    │
└─────────────────────────────────────────────────────────┘
```

**Empty/Failure States:**
- Legacy artifact lacks minimum provenance: *"Legacy artifact lacks minimum provenance; attach normalization note or replace."*
- Obfuscated without proof: *"Obfuscated artifact must expose at least one approved proof-of-existence or proof-of-integrity mechanism before it can support adjudication."*
- Permissions failure: *"Reviewer access path missing; submission can proceed only as manual review."*

---

## 8. Policy Execution Pipeline

Before any collaborative task is generated or reviewed, this pipeline executes:

```
1. ARTIFACT REGISTERED
   └─→ Submitter provides URL + selects visibility state
   └─→ System computes content hash (SHA-256)
   └─→ Verification envelope created

2. VISIBILITY CLASSIFIED
   └─→ State = public | private | obfuscated (subtype) | legacy
   └─→ Obfuscation subtype resolved if applicable

3. METADATA MINIMIZATION APPLIED
   └─→ Safe-public fields: always exposed
   └─→ Sensitive-operational: gated by visibility state
   └─→ Identity-revealing: gated by submitter opt-in
   └─→ Forbidden-derivative: system flags if combination leaks

4. COLLABORATION ELIGIBILITY DERIVED
   └─→ open | constrained | reviewer-only | not-eligible
   └─→ Derived from visibility state + obfuscation subtype

5. REVIEWER ACCESS MODE DERIVED
   └─→ direct | attested | escrow | unavailable
   └─→ Determines how reviewer accesses full content

6. TASK ELIGIBILITY EVALUATED (preflight)
   └─→ Does ≥1 artifact with required eligibility exist?
   │     YES → generate task, link to available artifacts
   │     NO  → block task creation
   │           └─→ downgrade to solo/manual review task
   │           └─→ OR reroute to artifact normalization request
   └─→ Does visibility state conflict with task requirements?
   │     YES → manual review required
   └─→ Is legacy evidence acceptable for this task class?
         YES (historical reference) → allow with constraints
         YES (adjudication) → allow with reviewer attestation
         NO (collaboration) → block, prompt upgrade

7. SURFACE TO ROLES
   └─→ Submitter sees: full artifact + visibility controls
   └─→ Collaborator sees: role-scoped metadata per eligibility
   └─→ Reviewer sees: full verification envelope + proof status
```

---

## 9. Protocol Decision Outcomes

Every artifact + task combination resolves to exactly one decision outcome:

| Outcome | When | System Action |
|---------|------|---------------|
| **Allowed** | Public artifact, open eligibility, all proofs satisfied | Standard collaborative flow proceeds |
| **Allowed with constraints** | Obfuscated (clear-metadata), constrained eligibility | Collaborative flow proceeds; cross-check limited to metadata + redacted version |
| **Manual review required** | Private artifact in collaborative context; visibility state changed post-completion; hash mismatch; reviewer access failure | Route to manual reviewer queue; flag reason |
| **Non-collaborative only** | Private or sealed artifact with reviewer-only eligibility | Artifact can be reviewed and rewarded; excluded from cross-check task generation |
| **Legacy-limited** | Legacy artifact, not-eligible | Historical reference or adjudication only; prompt submitter to upgrade; 30-day grace |
| **Blocked / reroute required** | Task requires open eligibility but 0 open artifacts exist; impossible evidence path | Block task generation; reroute to solo pass, artifact normalization, or fresh-pass task shape |

---

## 10. Legacy Handling Rules

Legacy artifacts are not grandfathered into full trust. They are admitted under declared limitations.

### Legacy Artifact Properties

| Property | Value |
|----------|-------|
| `legacy_status` | `pending_migration` (default) → `migrated` or `grace_expired` |
| `legacy_confidence_tier` | `high` (reviewer attested + producer active), `medium` (reviewer attested, producer inactive), `low` (no attestation) |
| `legacy_normalization_status` | `normalized` (hash + URL provided), `partial` (hash only), `unnormalized` (no verifiable data) |
| `legacy_allowed_use` | `collaboration` (if normalized + high confidence), `adjudication_only` (if partial + medium), `historical_reference` (all others) |
| Reviewer burden note | Legacy review requires manual verification; reviewer should document attestation basis |

### Migration Path

```
Legacy artifact detected (no visibility state)
         │
         ▼
  System assigns: legacy_status = pending_migration
  System assigns: legacy_confidence_tier (based on reviewer history)
         │
         ▼
  Submitter notified: "Your artifact from [task] has no
  visibility state. Would you like to set one?"
         │
         ├─── Sets PUBLIC ──→ URL verified, indexed, normalized
         │                    legacy_status = migrated
         │
         ├─── Sets PRIVATE ──→ Hash recorded, metadata indexed
         │                     legacy_status = migrated
         │
         ├─── Sets OBFUSCATED ──→ Redacted URL provided
         │                        legacy_status = migrated
         │
         └─── No response (30 days) ──→ legacy_status = grace_expired
                                          legacy_allowed_use = historical_reference
                                          Excluded from collaborative task generation
                                          Reviewer attestation stands
```

---

## 11. Implementation Handoff

### Required UI Surfaces

1. **Submission form** — visibility selector with collaborative task warning, obfuscation subtype picker, metadata leakage flag (Flow 1)
2. **Collaboration panel** — artifact cards with visibility badges, eligibility indicators, proof status (Flow 2)
3. **Reviewer panel** — three-layer proof checklist, visibility-aware rules, access mode indicator (Flow 3)
4. **Task generator** — artifact viability preflight (Pipeline step 6)
5. **Legacy migration prompt** — confidence tier, normalization status, allowed-use scope

### Acceptance Criteria

Role-specific and testable:

**Submitter:**
- [ ] Can select visibility state (public/private/obfuscated) at submission time
- [ ] Can select obfuscation subtype when obfuscated is chosen
- [ ] Sees collaborative task warning when selecting private in a collaborative context
- [ ] Is warned when metadata combination creates derivative exposure risk

**Collaborator:**
- [ ] Cannot discover content-bearing metadata for artifacts marked private or reviewer-only
- [ ] Can see safe-public metadata (hash, date, eligibility badge) for all artifacts
- [ ] Can click through to public artifacts directly
- [ ] Sees "artifact exists but cannot be used for open collaboration" for private artifacts

**Reviewer:**
- [ ] Can always see the verification path and eligibility reason for non-public artifacts
- [ ] Three-layer proof (existence/relevance/completion) shown per artifact
- [ ] Can access gated artifacts for private/obfuscated states
- [ ] Manual review triggered when artifact state changes post-completion

**Task Generator:**
- [ ] Cross-check tasks only generated when ≥1 artifact with open eligibility exists
- [ ] Task description includes links to available open artifacts
- [ ] Impossible evidence paths blocked at generation time with reroute to alternative task shape
- [ ] Legacy artifacts with `not-eligible` status excluded from collaborative task generation

**Legacy:**
- [ ] Legacy artifacts render with legacy badge, confidence tier, and allowed-use scope
- [ ] Submitters prompted to upgrade with 30-day grace period
- [ ] Grace-expired artifacts restricted to historical reference only

**Empty States:**
- [ ] Empty states explain whether failure is due to permissions, policy, missing provenance, or missing reviewer path
- [ ] Obfuscated artifacts must expose ≥1 approved proof-of-existence mechanism before supporting adjudication

### Implementation Priority

| Priority | Surface | Effort | Impact |
|----------|---------|--------|--------|
| P0 | Task generator preflight check | Low | Prevents impossible tasks immediately |
| P0 | Collaboration panel artifact cards | Medium | Enables cross-checking |
| P0 | Verification envelope schema | Low | Data contract for all downstream surfaces |
| P1 | Submission visibility selector | Low | Captures state at source |
| P1 | Content hash computation | Low | Enables verification |
| P1 | Collaboration eligibility derivation | Low | Decouples visibility from usability |
| P2 | Reviewer three-layer proof panel | Medium | Improves review quality |
| P2 | URL liveness monitoring | Low | Catches dead links |
| P2 | Metadata leakage flagging | Medium | Prevents unintended exposure |
| P3 | Legacy migration prompts + tiers | Low | Cleans up historical data |
| P3 | Obfuscation subtype flows | Medium | Important for sensitive work |
| P3 | Sealed artifact escrow path | High | Niche but protocol-complete |

---

## 12. Decision Log

| Decision | Rationale | Alternative Considered |
|----------|-----------|----------------------|
| Default visibility = `public` | Collaborative tasks are the primary use case. Public-by-default encourages discoverability. Submitter can always downgrade. | Default = `private` — rejected because it would make most collaborative tasks impossible |
| Never force artifacts public | Protocol must respect submitter privacy. Forcing public creates legal/compliance risk. | Require public for collaborative — rejected because some cohort work involves sensitive data |
| Content hash required for all states | Enables verification without exposing content. Proves existence and integrity across all visibility states. | No hash — rejected because private artifacts would be unverifiable |
| Three proof layers (existence/relevance/completion) | Separates verification concerns. A reviewer needs different evidence for "did this exist?" vs "is this sufficient?" | Single proof — rejected because it conflates existence with quality |
| Collaboration eligibility ≠ visibility | An artifact can be visible to reviewers but not eligible for collaboration. Decoupling prevents the system from treating all non-public artifacts identically. | Derive eligibility from visibility alone — rejected because obfuscated artifacts have nuanced eligibility |
| Obfuscation subtypes | "Obfuscated" is a spectrum, not a binary. Clear-metadata, partial-metadata, and sealed represent meaningfully different verification paths. | Single obfuscated state — rejected as underspecified for implementation |
| Legacy = bounded admission, not grandfathering | Pre-norm artifacts need different handling. Confidence tiers prevent legacy from silently degrading verification standards. | Treat legacy as private — rejected because legacy has no hash, no metadata, and different trust basis |
| Block impossible tasks at generation | Prevents structural failures at the cheapest intervention point. The CMC cross-check failure proved warnings don't work. | Allow with warning — rejected because it demonstrably fails in practice |
| Metadata leakage classes | A private artifact can leak through title, path, or timestamp clustering. Explicit classification prevents unintended exposure. | No leakage model — rejected because it creates false sense of privacy |

---

*This spec does not redefine evidence policy. It operationalizes safe discovery under current product constraints. Discovery is role-scoped. Restricted artifacts may support review without supporting open collaboration. The system must block generation of tasks whose required evidence path is impossible under current visibility constraints.*

*Implementation guidance for core-team signoff. Designed to complement existing collaborator-link work and provide a clean decision surface for what must be public, what can stay private, and how legacy artifacts are handled.*
