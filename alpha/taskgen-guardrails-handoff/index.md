# Taskgen Hallucination Guardrails — Implementation Handoff Plan (jjj → donravle)

**Task:** `task_782141bae42e0fb00e1904fc5efbe130` · **Author:** zoz (`zozDOTeth`) · Project Leader badge · **Date:** 2026-07-13
**Parties:** spec — **@jjj** (`task_80542449`, 20K, accepted 2026-07-13); implementation — **@donravle** (`task_91baeec`, 25K, proposed 2026-07-13); fallback — **@goodalexander** (the only other GitHub-verified Core Contributor); reviewer of record — @goodalexander.

**Why this matters now (live evidence, all 2026-07-13):** jollydinger in Hive chat: "you keep hallucinating proposed tasks (i dont have a pending ca9f task)"; jjj could not retrieve two hallucination-review tasks from the live feed; wizbubba flagged the issue high-severity; and the Reward Integrity closeout documented a same-day regeneration of already-rewarded work (`task_9113656`) — a dedup miss from the same generator. The failure is not hypothetical; the packet carries four documented data points from three operators in a single day.

---

## 1. Acceptance criteria for donravle's implementation

Each criterion is testable and maps to evidence donravle attaches at submission. jjj's spec may refine these; it may not weaken them (§2 M1).

- **AC1 — Referential integrity.** Every taskgen output surfaces only entities that exist: task IDs, operator handles, and board IDs validated against the live store before anything reaches a user. *Test:* synthetic generation batch (≥1,000, or all staging generations across a 72 h window, whichever is larger) → zero phantom references; the documented "ca9f" case class reproduces as *blocked*.
- **AC2 — Dedup control.** New task intents are checked — exact and semantic — against existing and rewarded tasks on the same board before proposal. *Test:* replay the `task_9113656` case (re-generation of the rewarded duplicate-payment spec) → blocked, with the matched prior task cited in the rejection reason.
- **AC3 — Output schema validation.** Generated tasks validate against the task schema (required fields present, reward within the assignee badge's cap, verification policy well-formed) before entering `proposed`. Malformed output is quarantined with a logged reason — never surfaced to a user.
- **AC4 — Prompt-injection resistance.** Text originating from user-generated content (chat messages, report bodies, task descriptions) is treated as data, never as instructions, at every taskgen prompt boundary. *Test:* injection suite (≥10 adversarial payloads embedded in mock chat/report inputs) — observable pass condition: no generated output contains content traceable to an injected instruction (string or semantic match, asserted by the suite), and no injected payload alters task fields relative to a clean-input control run.
- **AC5 — Context-overflow discipline.** Inputs exceeding the generation context budget are truncated deterministically with an explicit marker and logged — never silently, since silent truncation is a documented hallucination precursor (jjj's named failure modes: prompt injection, context overflow, insufficient output validation — this plan covers all three).
- **AC6 — Observability.** Every generation writes an audit record: input digest, checks passed/failed, quarantine reason if any. Guardrail rejections are queryable as a counter (the number the network watches to know the guardrails are alive).
- **AC7 — No regression (monitoring criterion, not a pass/fail gate).** Valid task generation still flows: the post-rollout 7-day generation rate is reported against baseline and any drop >20% is investigated and explained. Framed as monitoring deliberately — a hard rate target would pressure the implementation toward under-blocking, and the zero-tolerance categories (AC1 phantom refs, AC2 dup misses) remain absolute regardless of throughput.

## 2. Milestone timeline (anchored to jjj's spec delivery, `D_s`)

| Milestone | When | Gate |
|---|---|---|
| **M0 — Handoff live** | now | This plan published; donravle accepts `task_91baeec` within 72 h **of its proposal** (proposed 2026-07-13 18:04 UTC → accept by 2026-07-16 18:04 UTC) per network discipline |
| **M1 — Spec review gate** | `D_s` → +48 h | donravle + jjj joint review. The spec must include **reproducible cases** for the documented failures (phantom-reference "ca9f" class; the `task_9113656` dedup class) and map its guardrails to AC1–AC7. Gaps → back to jjj with named items, not silent acceptance |
| **M2 — Validation layer** | `D_s` + 7 d | AC1–AC3 implemented behind a feature flag; CI green; both replay tests pass in staging |
| **M3 — Hardening + eyes** | `D_s` + 14 d | AC4–AC6 implemented; staged rollout (flag on for a fraction of generations); audit records visibly accumulating |
| **M4 — Full rollout** | `D_s` + 21 d → +28 d | Flag fully on; 7-day AC7 regression watch; §4 checklist executed; reward review |

**One governing trigger hierarchy** (replaces ad-hoc slip rules; silence triggers, a declared blocker pauses):
1. Implementation unaccepted 72 h after proposal → **F1**.
2. Spec (`task_80542449`) late 7+ days past its own deadline → F4 pre-activation warning to all parties.
3. Spec expires undelivered → **F4**.
4. Implementation accepted but M2 missed by 3+ days with no declared blocker → **F2**.

## 3. Fallback routing (the honest version: the core bench is two people)

Only two operators hold GitHub-verified Core Contributor badges: **donravle** (most recently verified in the packet, 2026-07-13, no task history yet) and **goodalexander** (reviewer of record; holds KOL, Core Contributor, Project Leader, and QA badges per the operative report). grashnuk's wallet-only verification cannot take repo work. That bench depth is itself a finding this plan surfaces.

- **F1 — No acceptance:** donravle doesn't accept `task_91baeec` within 72 h of its proposal (by 2026-07-16 18:04 UTC, matching the §2 hierarchy) → re-route to goodalexander unchanged (same ACs, milestones re-anchored to the new acceptance).
- **F2 — Acceptance then stall:** M2 missed by 3+ days with no declared blocker → goodalexander either takes over or pairs; partial credit to donravle per ACs actually delivered (the ACs are separable by design).
- **F3 — Founder unavailable too (emergency exception, not core routing):** this step deliberately leaves the Core Contributor lane — it is external fork/PR work requiring explicit founder authorization, with review retained by goodalexander. Under it, AC1–AC3 (self-contained validation layer) routes as a scoped task to a vetted Expert; jjj (pipeline/workflow, score 83, spec author) is the obvious candidate, conflict (spec author implementing own spec) disclosed and accepted as better than a month of phantom tasks.
- **F4 — Spec never lands:** if `task_80542449` expires undelivered, donravle implements AC1–AC3 directly from this document's failure-case inventory (the live cases are sufficient specification for the validation layer) and AC4–AC5 wait for a spec. The network should not eat phantom tasks for another month because one document is late.
- **Structural recommendation to @goodalexander:** open a Core Contributor recruitment/verification track — every code-path fix in the network currently serializes through two people, and this is the third plan this week to hit that constraint.

## 4. Verification checklist (execute at M4, before reward)

- [ ] AC1–AC7 evidence attached: test logs, injection-suite results, staging replays, audit-record samples, rejection counter
- [ ] **Both documented live cases re-run and blocked:** phantom-reference ("ca9f" class) and dedup (`task_9113656` class)
- [ ] Feature flag + documented rollback procedure (one step, tested once)
- [ ] 7-day metrics attached: guardrail rejections, generation acceptance rate vs. baseline (AC7)
- [ ] jjj sign-off: implementation matches spec, or divergences enumerated with reasons
- [ ] jollydinger spot-check — one signal among several, alongside the rejection counters and audit records: the operator who reported the phantom task confirms none observed for 7 days
- [ ] goodalexander final review + reward decision

## 5. Sources & gaps

**Sources:** signed routing packet — board packet (both task IDs, states, rewards, dates), operative/development/QA/executive hive reports (jollydinger's and jjj's verbatim 07-13 chat evidence, wizbubba's severity flag, donravle's verification record); Reward Integrity closeout (rewarded) for the dedup case.
**Gaps:** (a) jjj's spec content doesn't exist yet — this plan constrains its *interface* (M1 gate), not its internals; (b) donravle has no delivery history — the milestone spacing and F2 partial-credit design are deliberately new-contributor-friendly; (c) taskgen's internal architecture is not in the packet — ACs specify observable behavior, leaving implementation shape to the implementer; (d) the older expert-review tasks (`task_5a20810a`, `task_14557de2`) remain proposed and are complementary review work, not substitutes for this implementation.

---
*Prepared by zoz for `task_782141bae42e0fb00e1904fc5efbe130`. Parties: @jjj (spec), @donravle (implementation), @goodalexander (fallback + review).*
