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

---

## 1. Problem Statement

### The Failure Mode We Lived

On April 22, 2026, the task node generated a collaborative cross-check task: *"Pick one public note from the current Private Profile CMC portfolio cohort that is not your own prior artifact, rerun the same live add-or-update flow, and publish a delta report."*

The task was structurally impossible to complete. Six discovery methods were attempted over 30 minutes — task UI, GitHub profile search, HackMD search, public gist search, task node chat, direct inquiry — and zero public cohort artifacts were found. The system generated a task that assumed artifact discoverability the protocol does not provide.

This is not an edge case. It is a structural gap that affects every collaborative task on the network.

### Root Causes

**1. No artifact visibility model.** The protocol has no concept of whether a submitted artifact is public, private, obfuscated, or legacy. When a producer submits evidence, the system records completion but not the artifact's accessibility state.

**2. No discovery surface.** The collaboration panel shows producer names and completion status but not submission URLs. A producer joining a collaborative task has zero visibility into what other producers submitted.

**3. No privacy-safe metadata layer.** Some artifacts legitimately cannot be public — they may contain proprietary data, MNPI, or sensitive operational details. The system has no model for surfacing proof-of-existence without leaking restricted content.

**4. Legacy submission gap.** Artifacts created before common sharing norms (repos, gists, public URLs) have no migration path. The system treats all completions identically regardless of when or how evidence was submitted.

**5. No impossible-task detection.** The task generator does not check whether prerequisite conditions (e.g., "find a public cohort note") are satisfiable before creating the task.

---

## 2. Artifact Visibility State Model

Every submitted artifact has exactly one visibility state. The submitter sets it at submission time. The system enforces access rules based on state.

### Visibility-State Matrix

| State | Definition | Who Can See URL | Who Can See Metadata | Minimum Proof | Collaborator Access | Reviewer Access |
|-------|-----------|----------------|---------------------|---------------|-------------------|----------------|
| **public** | URL loads without login | Everyone | Everyone | URL resolves, content matches claim | Full artifact | Full artifact |
| **private** | Exists but URL is restricted | Nobody external | Cohort + reviewers | Hash of content + timestamp | Metadata only (title, date, hash) | Full artifact (gated) |
| **obfuscated** | Redacted version available | Everyone (redacted) | Cohort + reviewers | Redacted URL + full hash | Redacted version | Full artifact (gated) |
| **legacy** | Pre-dates sharing norms | Nobody | Reviewers only | Reviewer attestation | Not available | Manual review |

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

---

## 3. UX Flows

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
│  │   Anyone can view. Required for collaborative    │    │
│  │   tasks that need cross-checking.                │    │
│  │                                                  │    │
│  │ ○ Private — exists but restricted                │    │
│  │   Only reviewers see the full artifact.          │    │
│  │   Cohort sees: title, date, content hash.        │    │
│  │   ⚠ May limit eligibility for collaborative     │    │
│  │   tasks that require public artifacts.           │    │
│  │                                                  │    │
│  │ ○ Obfuscated — redacted version available        │    │
│  │   Public URL with sensitive data removed.        │    │
│  │   Reviewers see full version via gated access.   │    │
│  │   Redacted URL: [____________________________]   │    │
│  └──────────────────────────────────────────────────┘    │
│                                                          │
│  [ Submit ]                                              │
└─────────────────────────────────────────────────────────┘

         ┌──────────────────────────┐
         │  ⚠ COLLABORATIVE CHECK   │
         │                          │
         │  This task is part of a  │
         │  collaborative cohort.   │
         │  Other producers may     │
         │  need to cross-check     │
         │  your artifact.          │
         │                          │
         │  Selecting "Private"     │
         │  means your artifact     │
         │  cannot be used for      │
         │  cross-check tasks.      │
         │                          │
         │  [ Continue as Private ] │
         │  [ Switch to Public ]    │
         └──────────────────────────┘
```

**Empty/Failure States:**
- If URL is empty: *"Evidence URL is required."*
- If URL is unreachable and state is `public`: *"URL does not resolve. Verify the link loads without login."*
- If `obfuscated` selected but no redacted URL provided: *"Provide a redacted URL for the public version."*

### Flow 2: Collaborator — Cohort Artifact Discovery

```
┌─────────────────────────────────────────────────────────┐
│            COLLABORATION PANEL — 7/12                    │
│                                                          │
│  ┌─ Wizbubba ─────────────────────────────────────────┐  │
│  │  Status: Rewarded                                   │  │
│  │  Completed: Apr 19 at 11:16 AM                      │  │
│  │  Artifact: 🌐 PUBLIC                                │  │
│  │  ┌────────────────────────────────────────────┐     │  │
│  │  │ "Test Private Profile Portfolio Edit and   │     │  │
│  │  │  Reload Flow"                              │     │  │
│  │  │  hackmd.io/@wizbubba/cmc-portfolio-qa      │     │  │
│  │  │  [ Open ] [ Use for Cross-Check ]          │     │  │
│  │  └────────────────────────────────────────────┘     │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                          │
│  ┌─ r9oHNN...Sa32 ───────────────────────────────────┐   │
│  │  Status: Rewarded                                  │   │
│  │  Completed: Apr 19 at 6:36 AM                      │   │
│  │  Artifact: 🔒 PRIVATE                              │   │
│  │  ┌────────────────────────────────────────────┐    │   │
│  │  │ Title: "Run One Portfolio-Import QA and    │    │   │
│  │  │  Brainstorm Pass"                          │    │   │
│  │  │ Hash: a3f7c2...9e1b                        │    │   │
│  │  │ Date: 2026-04-19                           │    │   │
│  │  │ ⚠ Full artifact not available for          │    │   │
│  │  │   cross-checking                           │    │   │
│  │  └────────────────────────────────────────────┘    │   │
│  └────────────────────────────────────────────────────┘   │
│                                                          │
│  ┌─ Nydiokar ────────────────────────────────────────┐   │
│  │  Status: Rewarded                                  │   │
│  │  Completed: Apr 18 at 2:03 AM                      │   │
│  │  Artifact: 📦 LEGACY                               │   │
│  │  ┌────────────────────────────────────────────┐    │   │
│  │  │ Pre-dates common sharing norms.            │    │   │
│  │  │ No public artifact available.              │    │   │
│  │  │ Reviewer-verified completion.              │    │   │
│  │  └────────────────────────────────────────────┘    │   │
│  └────────────────────────────────────────────────────┘   │
│                                                          │
│  PUBLIC ARTIFACTS AVAILABLE: 1 of 5                      │
│  ⚠ Cross-check tasks require at least 1 public artifact │
└─────────────────────────────────────────────────────────┘
```

**Empty/Failure States:**
- If 0 public artifacts exist: *"No public artifacts available in this cohort. Cross-check tasks cannot be generated."*
- If a producer's artifact URL has gone dead: *"⚠ URL no longer resolves. Last verified: [date]."*

### Flow 3: Reviewer — Verification with Visibility-Aware Rules

```
┌─────────────────────────────────────────────────────────┐
│              REVIEWER VERIFICATION PANEL                  │
│                                                          │
│  Submitter: Zoz                                          │
│  Task: Cross-Check CMC Portfolio QA                      │
│  Visibility: 🌐 PUBLIC                                   │
│  URL: pft.permanentupperclass.com/alpha/cmc-portfolio... │
│                                                          │
│  ┌── Automated Checks ──────────────────────────────┐    │
│  │  ✓ URL resolves (200 OK, last checked 30s ago)   │    │
│  │  ✓ Contains required headings (scenario label,   │    │
│  │    request text, claim checks, screenshot)        │    │
│  │  ✓ Content hash matches submission record         │    │
│  │  ✗ Cohort note URL referenced: NOT FOUND          │    │
│  │    → Submitter documented discovery failure        │    │
│  │    → Manual review required                        │    │
│  └──────────────────────────────────────────────────┘    │
│                                                          │
│  ┌── Visibility-Specific Rules ─────────────────────┐    │
│  │                                                   │    │
│  │  For PUBLIC artifacts:                            │    │
│  │  • URL must load without login ✓                  │    │
│  │  • Content must match hash at submission time     │    │
│  │  • URL will be indexed for future collaborators   │    │
│  │                                                   │    │
│  │  For PRIVATE artifacts:                           │    │
│  │  • Reviewer accesses via gated link               │    │
│  │  • Content hash verified against submission       │    │
│  │  • Cohort sees metadata only                      │    │
│  │  • Cannot be used for cross-check tasks           │    │
│  │                                                   │    │
│  │  For OBFUSCATED artifacts:                        │    │
│  │  • Redacted version verified publicly accessible  │    │
│  │  • Full version verified via gated link           │    │
│  │  • Redaction must not remove verification-        │    │
│  │    critical content                               │    │
│  │                                                   │    │
│  │  For LEGACY artifacts:                            │    │
│  │  • Reviewer attestation required                  │    │
│  │  • Submitter prompted to upgrade visibility       │    │
│  │  • Grace period: 30 days to provide URL or hash   │    │
│  └──────────────────────────────────────────────────┘    │
│                                                          │
│  Decision: [ Approve ] [ Request Changes ] [ Reject ]    │
└─────────────────────────────────────────────────────────┘
```

---

## 4. Policy-Linked Decision Rules

### Task Generation Rules

| Condition | Action |
|-----------|--------|
| Task requires cross-checking a cohort artifact | Check: does ≥1 public artifact exist in the cohort? |
| ≥1 public artifact exists | Generate cross-check task, link to available artifacts |
| 0 public artifacts exist | **Block cross-check generation.** Reroute to fresh-pass task shape instead |
| All cohort artifacts are legacy | Block cross-check. Prompt legacy producers to upgrade visibility |
| Mixed public/private cohort | Generate cross-check task, scope only to public artifacts |

### Collaboration Rules

| Scenario | Rule |
|----------|------|
| Producer submits as `public` | Artifact URL indexed immediately. Available to future collaborators |
| Producer submits as `private` | Metadata indexed (title, hash, date). Flagged as unavailable for cross-check |
| Producer submits as `obfuscated` | Redacted URL indexed. Full version gated to reviewers |
| Cross-check task generated | System pre-populates available public artifact URLs in task description |
| No cross-checkable artifacts after 72h | System sends notification: *"This cohort has no public artifacts yet. Consider upgrading your submission visibility."* |

### Review Rules

| Artifact State | Reviewer Action |
|----------------|----------------|
| `public` | Verify URL resolves, content matches hash, meets verification criteria |
| `private` | Access via gated link. Verify hash. Cannot share content externally |
| `obfuscated` | Verify redacted version is publicly accessible. Verify full version via gated link. Confirm redaction doesn't remove verification-critical data |
| `legacy` | Manual attestation. Prompt submitter to upgrade. 30-day grace period |

### Manual Review Triggers

- Artifact state changed after task completion (e.g., public → private after cross-check)
- Content hash mismatch between submission and current URL
- Reviewer cannot access gated artifact
- Legacy artifact with no upgrade after 30-day grace period
- Cross-check task completed without cohort note reference (discovery failure documented)

---

## 5. Legacy Handling Rules

### Problem

Artifacts submitted before April 2026 have no visibility state, no content hash, and may be hosted on platforms that require login or have expired links. These cannot be retroactively forced public.

### Migration Path

```
Legacy artifact detected (no visibility state)
         │
         ▼
  System assigns state: LEGACY
         │
         ▼
  Submitter notified: "Your artifact from [task] has no
  visibility state. Would you like to set one?"
         │
         ├─── Submitter sets PUBLIC ──→ URL verified, indexed
         │
         ├─── Submitter sets PRIVATE ──→ Hash recorded, metadata indexed
         │
         ├─── Submitter sets OBFUSCATED ──→ Redacted URL provided
         │
         └─── No response (30 days) ──→ Remains LEGACY
                                          │
                                          ▼
                                  Excluded from cross-check
                                  task generation. Reviewer
                                  attestation stands.
```

### Retroactive Rules

- Legacy artifacts are **never** forced public
- Legacy completions remain valid — the reward stands regardless of visibility upgrade
- Legacy artifacts are excluded from collaborative task generation until upgraded
- If a producer has only legacy artifacts, they are not penalized — new submissions establish their visibility pattern

---

## 6. Implementation Handoff

### Required Data Fields

Add to the task submission record:

| Field | Type | Required | Default |
|-------|------|----------|---------|
| `artifact_visibility` | enum: `public`, `private`, `obfuscated`, `legacy` | Yes (new submissions) | `public` |
| `artifact_url` | string | Yes | — |
| `artifact_redacted_url` | string | If obfuscated | null |
| `artifact_content_hash` | string (SHA-256) | Yes | Auto-computed |
| `artifact_title` | string | Yes | Extracted from URL or manual |
| `artifact_verified_at` | timestamp | Auto | Set on review |
| `artifact_url_status` | enum: `live`, `dead`, `unknown` | Auto | Checked periodically |

### Required UI Surfaces

1. **Submission form** — visibility selector with collaborative task warning (Flow 1)
2. **Collaboration panel** — artifact cards with visibility badges, URLs for public, metadata for private (Flow 2)
3. **Reviewer panel** — visibility-aware verification checklist with automated URL/hash checks (Flow 3)
4. **Task generator** — pre-flight check: are prerequisite artifacts discoverable?
5. **Legacy migration prompt** — notification for producers with legacy artifacts

### Acceptance Criteria

- [ ] Submitter can select visibility state at submission time
- [ ] Collaboration panel displays artifact cards with correct visibility badges
- [ ] Public artifact URLs are clickable and load without login
- [ ] Private artifacts show metadata (title, hash, date) but not URL
- [ ] Obfuscated artifacts show redacted URL publicly, full URL to reviewers
- [ ] Cross-check tasks are only generated when ≥1 public artifact exists in the cohort
- [ ] Task description for cross-check tasks includes links to available public artifacts
- [ ] Legacy artifacts are flagged and submitters prompted to upgrade
- [ ] Content hash is computed at submission and verified at review
- [ ] URL liveness is checked periodically (daily) with dead links flagged
- [ ] Reviewer can access gated artifacts for private/obfuscated states
- [ ] Manual review is triggered when artifact state changes post-completion

### Implementation Priority

| Priority | Surface | Effort | Impact |
|----------|---------|--------|--------|
| P0 | Task generator pre-flight check | Low | Prevents impossible tasks immediately |
| P0 | Collaboration panel artifact cards | Medium | Enables cross-checking |
| P1 | Submission visibility selector | Low | Captures state at source |
| P1 | Content hash computation | Low | Enables verification |
| P2 | Reviewer verification panel | Medium | Improves review quality |
| P2 | URL liveness monitoring | Low | Catches dead links |
| P3 | Legacy migration prompts | Low | Cleans up historical data |
| P3 | Obfuscated redaction flow | Medium | Niche but important for sensitive work |

---

## 7. Decision Log

| Decision | Rationale | Alternative Considered |
|----------|-----------|----------------------|
| Default visibility = `public` | Collaborative tasks are the primary use case. Public-by-default encourages discoverability. Submitter can always downgrade. | Default = `private` — rejected because it would make most collaborative tasks impossible and require constant upgrading |
| Never force artifacts public | Protocol must respect submitter privacy. Forcing public creates legal/compliance risk and discourages participation. | Require public for collaborative tasks — rejected because some cohort work legitimately involves sensitive data |
| Content hash required | Enables verification without exposing content. Proves existence and integrity. | No hash — rejected because private artifacts would be unverifiable |
| Legacy = separate state | Pre-norm artifacts need different handling than intentionally private ones. Migration should be voluntary. | Treat legacy as private — rejected because legacy has no hash, no metadata, and different verification needs |
| Block cross-check tasks when 0 public artifacts | Prevents impossible tasks at generation time. System should not create work it knows can't be completed. | Allow generation with warning — rejected because the CMC portfolio cross-check proved this fails in practice |
| 30-day grace period for legacy upgrades | Reasonable time for producers to locate and re-publish old work without pressure. | No grace period — rejected as too aggressive. 90 days — rejected as too slow |

---

*This spec is implementation guidance for core-team signoff, not a unilateral policy rewrite. It is designed to complement existing collaborator-link work and provide a clean decision surface for what must be public, what can stay private, and how legacy artifacts are handled.*
