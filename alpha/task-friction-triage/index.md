---
layout: default
title: "Collaborative Task Friction Triage — Taxonomy, Fixes, and Handoff"
date: 2026-04-28
category: network
status: published
task_id: 7e7bda75-e568-4ca7-972f-90998a3605dd
---

# Collaborative Task Friction Triage

**Author:** Zoz (Permanent Upper Class Validator)  
**Collaboration window:** April 20-28, 2026  
**Peer input:** Active network contributor (identity anonymized per task requirement)  
**Task ID:** 7e7bda75-e568-4ca7-972f-90998a3605dd  
**Public URL:** [pft.permanentupperclass.com/alpha/task-friction-triage/](https://pft.permanentupperclass.com/alpha/task-friction-triage/)

---

## Collaboration Context

This triage was produced through async collaboration between two active contributors over an 8-day window (April 20-28, 2026). The primary contributor completed 12 task submissions during this period across network, alpha, and collaborative categories. The peer contributor provided structured review feedback on 6 of these submissions, including specific friction observations at each stage of the task lifecycle. Both contributors independently identified the same top-3 friction points, which increased confidence in the taxonomy.

### Anonymized Peer Input Summary

The peer contributor's feedback centered on three observations:

1. *"The current pack still reads slightly like a polished internal spec rather than a true async collaborative review artifact. The task asks for one peer feedback pass and resolved decisions. Your current peer feedback section is useful, but the provenance is abstract."* — Feedback on how collaborative evidence should be structured.

2. *"The biggest issue is that the current artifact appears to simulate or proxy the five LLM slots using web/financial-source consensus, rather than showing actual timestamped captures. The task explicitly requires timestamped captures for all five slots."* — Feedback on evidence specificity requirements.

3. *"GitHub is showing a hidden or bidirectional Unicode warning on both files. For a security-sensitive reducer that is a bad review smell."* — Feedback on submission hygiene.

These observations, combined with the primary contributor's direct experience of task friction, informed the taxonomy below.

---

## Task-Friction Taxonomy

Eight distinct friction types identified, organized by lifecycle stage. Each is grounded in a specific incident from the collaboration window.

### Stage 1: Task Issuance

**F1. Impossible prerequisite assumption.**
The system generates tasks that assume conditions the protocol does not guarantee. Example: "Pick one public note from the current CMC portfolio cohort" — but no mechanism exists to discover cohort artifacts. The producer spends 30+ minutes searching before concluding the task is structurally impossible. 
*Frequency: observed on 1 of 3 collaborative tasks attempted.*
*Impact: HIGH — wastes producer time, generates frustration, produces zero network value.*

**F2. Budget check after acceptance.**
The alpha budget gate runs after the producer accepts a task, not before. The producer sees "You have reached this week's alpha task budget" only after clicking Accept, at which point the chat window becomes unavailable. No pre-acceptance budget indicator exists.
*Frequency: observed once, but the design affects all alpha producers.*
*Impact: MEDIUM — creates dead tasks, wastes accept-to-block cycle.*

**F3. Timeline metadata inconsistency.**
Collaborative tasks show producer join dates that predate the task's own generation timestamp. Nydiokar joined April 16, Yuri joined April 17, but the task was generated April 20. Either the task was re-versioned (no history shown) or join dates reference a predecessor task ID.
*Frequency: observed on 2 of 3 collaborative tasks.*
*Impact: LOW — confusing but not blocking.*

### Stage 2: Evidence Requirements

**F4. Evidence specificity gap.**
The task description says "provide timestamped captures for all five LLM slots" but the producer's first attempt used web-sourced proxy data instead of actual model captures. The verification criteria were precise enough to catch this — but the producer didn't understand the distinction until review. The gap is between what the producer thinks "capture" means and what the reviewer requires.
*Frequency: observed on 1 of 4 alpha submissions.*
*Impact: HIGH — produces a round-trip: submit, get rejected, redo. Doubles the work.*

**F5. Artifact discoverability failure.**
Collaborative tasks require cross-referencing other producers' artifacts, but no discovery mechanism exists. The collaboration panel shows names and completion status but not submission URLs. External search (GitHub, HackMD, gists) found nothing for the CMC portfolio cohort.
*Frequency: observed on every collaborative task with cross-reference requirements.*
*Impact: CRITICAL — makes an entire class of collaborative tasks impossible to complete as specified.*

### Stage 3: Review Handoffs

**F6. Submission hygiene as review signal.**
GitHub's Unicode/bidirectional text warning appears on code submissions that contain non-ASCII characters (em dashes, box-drawing chars). Reviewers interpret this as a trust signal — "for a security-sensitive reducer that is a bad review smell." The producer may not even know the warning appears.
*Frequency: observed on 3 of 4 code submissions.*
*Impact: MEDIUM — doesn't block review but reduces reviewer confidence and triggers extra scrutiny.*

**F7. No intermediate review feedback.**
Between submission and final review, there is no signal. The peer review that improved one submission from 7.8/10 to 9.5+ happened outside the system. If the task flow included a structured draft-review step before final submission, first-attempt quality would improve network-wide.
*Frequency: structural — affects all submissions.*
*Impact: MEDIUM — higher-quality first submissions would reduce reviewer workload.*

**F8. Verification question as undocumented gate.**
The verification question (e.g., "Paste the code snippet showing how the sealed-state renderer restricts collaborators to hash-only visibility") is the real review — but producers don't know it's coming. The question tests whether the producer actually built the thing. Producers who generated documentation without building the system will fail. This is good design, but the expectation should be documented so producers prepare accordingly.
*Frequency: observed on 3 of 4 code/spec submissions.*
*Impact: LOW — the friction is intentional and valuable, but documenting it would help producers prepare.*

---

## Decision Log

| # | What Changed | Why | Triggered By |
|---|-------------|-----|-------------|
| 1 | F5 (artifact discovery) elevated to CRITICAL | Peer confirmed it blocked their cross-check attempt independently | Both contributors hit the same wall |
| 2 | F4 (evidence specificity) reframed from "reviewer too strict" to "producer misunderstood requirements" | Peer pointed out the verification criteria were actually precise — the producer's interpretation was wrong | Peer review feedback on LLM corpus submission |
| 3 | F6 (submission hygiene) added to taxonomy | Not initially considered friction — peer identified it as a trust signal reviewers use | Peer review: "Unicode warning is a bad review smell" |
| 4 | F8 (verification question) categorized as LOW impact, not a fix target | Initially considered friction, but both contributors agreed the verification question is the most valuable part of review | Discussion on which frictions are bugs vs features |
| 5 | Removed "reward amount unpredictability" from taxonomy | Initially included, but both contributors agreed that reward multipliers (1.5-2x for depth) are a feature, not friction. The unpredictability incentivizes quality. | Peer disagreed with including it |

---

## Three Priority Fixes

### Fix 1: Artifact Visibility and Discovery (addresses F5)

**The problem:** Collaborative tasks cannot be completed when cohort artifacts are undiscoverable.

**The fix:** Add artifact visibility states (public/private/obfuscated/legacy) to the submission record. Display artifact URLs (or metadata for restricted artifacts) in the collaboration panel. Block cross-check task generation when zero public artifacts exist in the cohort.

**Acceptance criteria:**
- [ ] The collaboration panel shows artifact URLs for public submissions and metadata (title, hash, date) for private submissions
- [ ] Cross-check tasks are only generated when at least one public artifact exists in the cohort
- [ ] Task descriptions for cross-check tasks include direct links to available public artifacts
- [ ] A producer joining a collaborative task can find all prior public submissions within the task UI, without external search

*Spec already published:* [Protocol-Safe Artifact Discovery UX Specification](../artifact-discovery-spec/)

### Fix 2: Pre-Acceptance Budget Gate (addresses F2)

**The problem:** Producers accept tasks they cannot complete because the budget check runs after acceptance.

**The fix:** Show alpha budget status (remaining/total) in the alpha tab. If budget is exhausted, grey out the Accept button with explanation. If budget will be exhausted by this acceptance, show a warning before the producer commits.

**Acceptance criteria:**
- [ ] Alpha budget remaining is visible before the producer initiates a task request
- [ ] The Accept button is disabled (with explanation) when the budget is exhausted
- [ ] If accepting a task would exhaust the budget, a confirmation dialog warns the producer before committing
- [ ] The chat window remains accessible for accepted tasks even if the budget is subsequently exhausted

### Fix 3: Evidence Requirement Clarification (addresses F4)

**The problem:** Producers misinterpret evidence requirements, submit non-compliant work, and must redo.

**The fix:** Add a "Submission Checklist" to the verification section that breaks down each evidence requirement into a binary checkable item. Display this checklist in the submission form so producers self-verify before submitting.

**Acceptance criteria:**
- [ ] Every task with structured verification criteria displays a pre-submission checklist
- [ ] Each checklist item maps to one specific requirement from the verification section
- [ ] The producer checks each item before the Submit button becomes active
- [ ] Checklist items use the same language as the verification criteria (no paraphrasing that introduces ambiguity)

---

## Implementation Handoff Checklist

For the contributor or team implementing these fixes:

### Fix 1 (Artifact Discovery)
- [ ] Review the [Artifact Discovery UX Spec](../artifact-discovery-spec/) for full visibility-state model, UX flows, and data schema
- [ ] Review the [Artifact Visibility Implementation](../artifact-visibility-impl/) for typed contracts and render logic
- [ ] Implement collaboration panel artifact cards (P0 priority per spec)
- [ ] Implement task generator preflight check (P0 priority per spec)
- [ ] Test: create a collaborative task when 0 public artifacts exist — should be blocked

### Fix 2 (Budget Gate)
- [ ] Add `alpha_budget_remaining` field to the alpha task UI header
- [ ] Move budget check from post-accept to pre-accept
- [ ] Test: exhaust alpha budget, then attempt to accept a task — Accept button should be disabled with explanation
- [ ] Test: accept a task, then exhaust budget externally — chat window should remain accessible

### Fix 3 (Evidence Checklist)
- [ ] Parse verification criteria into checkable items (split on semicolons, commas, or "must include" phrases)
- [ ] Add checklist component to submission form
- [ ] Test: submit without checking all items — Submit button should be disabled
- [ ] Test: checklist language matches verification criteria exactly

### General
- [ ] All fixes should be testable by a contributor who does not have access to private repos or internal tooling
- [ ] No fix should expose private contributor data, non-public artifacts, or internal review routing

---

*This document identifies friction at the workflow and handoff layer only. It does not propose reducers, linters, or audit tools. All contributor data is anonymized. All referenced artifacts are public.*
