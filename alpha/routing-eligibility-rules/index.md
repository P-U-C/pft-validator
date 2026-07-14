# Task Routing Eligibility Rules — Preventing Badge-Access Mismatches

**Task:** `task_81e76ab3287d745c8d4575af0878dd3f` · **Author:** zoz (`zozDOTeth`) · Project Leader badge · **Date:** 2026-07-14
**Handoff:** @goodalexander (Core Contributor, primary) · @donravle (Core Contributor, secondary reviewer)
**Lineage:** completes the routing-rules arc: [Routing Unblock Action Plan](https://github.com/P-U-C/pft-validator/blob/main/alpha/routing-unblock-action-plan/index.md) (who is *available*), [Taskgen Guardrails Handoff](https://github.com/P-U-C/pft-validator/blob/main/alpha/taskgen-guardrails-handoff/index.md) (what is *real*), this spec (who is *able*).

---

## 0. Executive summary

The router assigns work to operators who cannot execute it and starves operators who can. The fix is one principle enforced at one point: **eligibility = badge ∧ credential ∧ active project**, validated **before a task is proposed** — a badge authorizes a *role*, but execution needs a *capability* (a GitHub handle on file for repo work, an X handle for amplification, a wallet for anything paid), and a task must belong to a project that exists and is active. §1 catalogs the confirmed incidents, §2 gives the enforceable work-type → requirement table, §3 specifies the implementation (backend predicate + frontend visibility + structured refusal reasons), §4 is the engineers' verification checklist.

## 1. Incident catalog — confirmed mismatches and related routing symptoms (all packet-cited)

| # | Incident | Evidence | Failure class |
|---|---|---|---|
| I-1 | **Code task routed to an operator without repo access.** georgl0nggamma (Project Leader + Expert 86) refused `task_91136561406f8d32f461234e61f26274`, Hive chat 2026-07-13T14:32, verbatim: "I'm project leader but not core contributor, as such I dont have the core repo access to complete tasks like the one I just refused properly" | development + executive + QA hive reports | badge≠access: role badge present, capability absent |
| I-2 | **Contributor starved by missing badge projection.** hit0ri: "several weeks gone and I still dont have any new tasks. Seems like I'm not considered as core contributor even after almost a year non-stopping contributions" (2026-07-13T04:16); the account holds no visible badge in the projection | operative + executive reports | **symptom (projection/visibility)**: capability plausible but unverifiable, role projection absent — router can't see them; the §3.3 reconciliation is the fix, not a badge auto-grant |
| I-3 | **Tasks assigned to non-active project IDs** | task description (packet-level detail thin — implementation must confirm scope from routing logs) | referential: task→project link invalid at proposal time |
| I-4 | **Routed task IDs unretrievable from the live feed by the requester.** jjj could not fetch `task_5a20810a`/`task_14557de2` (whether jjj was their assignee is not confirmed by the packet); QA report: "If access is badge-gated, communicate that clearly rather than returning ambiguous failures" | QA + executive reports | **symptom (visibility)**: retrieval failures are ambiguous where they should be explicit states |
| I-5 | **Compound failure on one generated task.** The task georgl0nggamma refused (I-1) is the same `task_9113656` documented in the [Reward Integrity closeout](https://github.com/P-U-C/pft-validator/blob/main/alpha/reward-integrity-closeout/index.md) as a dedup regeneration of already-rewarded work | closeout (rewarded) + this packet | one task, two independent guardrail gaps: duplicate *and* mis-routed — evidence the checks compose |

Also in-class, from prior rewarded work: grashnuk holds a Core Contributor badge via **wallet-only** authorization with no GitHub handle — the badge exists, the repo capability doesn't; and multiple KOLs hold reach badges with **no wallet on file**, so paid amplification tasks routed to them cannot even be rewarded.

## 2. Routing rules: work type → required badge ∧ required credential

Semantics: badge is **necessary, never sufficient**. A work type may also require a credential (a verified external handle or wallet). Multi-badge operators get the **union** of their badges' work types, with each work type's credential test applied independently. Reward caps stay per-badge as today.

| Work type | Required badge | Required credential (beyond wallet*) | Justification |
|---|---|---|---|
| `code_task` / implementation | `core_contributor` | **GitHub handle on file** (allowlist-verified) | Repo write path; I-1 and the grashnuk case both fail exactly here |
| `code_review` | `core_contributor` (or Expert via the explicit fork/PR emergency exception, founder-authorized — per the guardrails handoff F3) | GitHub handle | Review requires repo read + PR mechanics |
| `special_project_definition` / `open_source_project_definition` / `project_management` | `project_leader` | — | Matches the badge's existing `allowedWorkTypes` projection |
| `expert_review` / `domain_analysis` | `expert`, **topic-matched** to the badge's scored topic | — | An expert badge is topic-scoped (crypto options ≠ quantum computing); routing on the badge alone re-creates I-1 in analysis form |
| `amplification_x` / KOL content | `kol` | **X handle + profile URL on file** | five KOLs lack visible X handles/profile data in packet views, and several separately lack wallets — un-postable and un-rewardable are distinct gaps, both gated here |
| `qa_report` / `product_qa` / `repro_packet` (QA family — exact enum keys observed in projections) | `qa_worker` | — | Existing verification method suffices |
| coordination / outreach | `project_leader` | — | Role-based; no external credential |
| documentation / briefs | per the operator's badge `allowedWorkTypes` union — **no open floor category** | — | An 'any badge' floor would recreate the default-open class this spec exists to kill |

*Wallet on file is a universal credential: **no task that pays PFT routes to an account without a wallet address** — today that silently produces unrewardable work.

**Coverage rule:** this table maps the work types observable in packet data; the canonical enum lives in the codebase (§6d) — at implementation, **every enum key must either appear in the config table or fall to the review queue**. A work type absent from config does not route; it queues with a machine-readable reason. Unknown ≠ unrestricted. (Non-active-project assignments, I-3, are handled by the separate `project_active` gate in §3.1 — a distinct check, not an unknown-type case.)

## 3. Implementation changes (enforce before proposal, show at surface)

**3.1 Backend — one eligibility predicate at routing time.** Before any proposal is written: `eligible(operator, task) = badge_match(work_type) ∧ credential_present(work_type) ∧ wallet_present(if paid) ∧ project_active(project_id) ∧ topic_match(if expert)`. Failures produce a **structured no-route reason** (`routing_blocked: missing_credential:github_handle`, `routing_blocked: project_inactive`, …) written to the same audit record the taskgen guardrails plan specifies (AC6 there) — the two validation layers share an enforcement point and should ship as one composable check-chain. The mapping table (§2) is **config, not code** — the badge projections already carry `allowedWorkTypes` and reward caps, so this formalizes and extends an existing structure rather than inventing one.

**3.1b Credential-source contract** (so `credential_present()` is deterministic): `github_handle` — from the `github_handle_allowlist` verification record; `x_handle` + `profileUrl` — from the `x_public_metrics` badge record; `walletAddress` — from the account projection. A credential is *present* iff the field is non-empty **and** its verification record is valid (has `verifiedAt`, not expired/revoked). Revocation or expiry re-runs the predicate on the next routing pass and blocks *new* proposals only — no retroactive cancellation of accepted tasks.

**3.1c Rollout: 30-day shadow-mode replay first.** Run the predicate against the trailing 30 days of historical proposals and publish the would-route/would-block diff before enforcement flips on. The diff is the cheapest possible test of the §2 table against reality — every would-block on a task that was in fact delivered fine is a mapping to fix in config. Additionally report **eligible-pool size per work type**: any type with a pool < 2 is a bench-depth alert (the two-person core-contributor bench is already a known instance).

**3.2 Frontend — visibility.** Task cards display required badge + credential; operators see *why* a task is or isn't available to them (I-4's ambiguous failures become explicit states). Refusals gain a structured reason picker — `access_missing` as a category — so future mismatches are measurable instead of anecdotal.

**3.3 Projection hygiene (the I-2 fix).** A monthly reconciliation lists operators with substantial delivery history but no/mismatched badge projection, for founder review — hit0ri should have been *found* by the system, not left asking in chat. This is a report, not an auto-grant: badge issuance stays human.

## 4. Verification checklist (engineers, at implementation review)

- [ ] **Correct routing:** topic-matched expert receives `expert_review`; core contributor with GitHub handle receives `code_task`
- [ ] **I-1 replay blocked:** a `code_task` can never be proposed to an operator whose badges lack `core_contributor` — assert on the georgl0nggamma case inputs
- [ ] **Credential gate:** `core_contributor` badge *without* GitHub handle (grashnuk case) → `code_task` blocked with `missing_credential:github_handle`; KOL without wallet → paid `amplification_x` blocked with `missing_credential:wallet`
- [ ] **Multi-badge union:** operator holding KOL+PL (jollydinger profile) is eligible for amplification and project definitions, **blocked** for code; four-badge operator (goodalexander profile: KOL, CC, PL, QA) eligible across those four badges' mapped types and **blocked for Expert-only work** — the union grants what badges grant, never everything
- [ ] **Topic scoping:** crypto-options expert not offered quantum-computing `expert_review`, and vice versa
- [ ] **Project liveness:** generation targeting a non-active project ID → refused pre-proposal with `project_inactive`
- [ ] **Unknown work type:** routes nowhere, queues for review, never defaults to unrestricted
- [ ] **Visibility:** blocked states render with their reason on the task surface; refusal reason `access_missing` selectable and recorded
- [ ] **Monitoring, not gating:** 7-day post-rollout report of no-route reasons + proposal volume vs. baseline; a volume drop is investigated, while zero tolerance holds for mismatch classes I-1/I-3
- [ ] **Reconciliation report:** first monthly badge-vs-history report generated and delivered to the founder (I-2)
- [ ] **Shadow-mode diff published** (§3.1c): 30-day replay reviewed, config table corrected for false blocks, eligible-pool sizes reported per work type

## 5. Handoff

**@goodalexander (primary):** approve the §2 table as routing config (adjust mappings once, in place); sequence §3.1 with the taskgen guardrails implementation — same enforcement point, natural single PR chain (donravle already holds that task); decide the I-2 reconciliation cadence.
**@donravle (secondary reviewer):** §4 is written to be executable as your test plan verbatim; flag any §2 mapping the codebase's actual work-type enum contradicts — the table follows observed task data, and the enum is the source of truth this spec couldn't see.

## 6. Sources & gaps

**Sources:** signed routing packet (operative/development/QA/executive/rewarded-task/KOL hive reports — all quoted material verbatim from those reports, 2026-07-13/14); prior rewarded artifacts for cross-referenced findings (reward-integrity closeout; taskgen guardrails handoff; KOL board definition for credential-gap roster detail).
**Gaps:** (a) the network's actual work-type enum is not in the packet — §2 names observed types and binds the rest via the unknown-type rule; (b) I-3's incident detail (which tasks, which project IDs) is asserted by the task description but not itemized in the packet — implementation should pull the routing log before building; (c) hit0ri's actual delivery history is not verifiable from the packet (the account has no badge projection — which is precisely the I-2 point); (d) badge `allowedWorkTypes` projections were observed on project_leader and expert badges — this spec assumes the structure generalizes to all badges, donravle to confirm against the schema.

---
*Prepared by zoz for `task_81e76ab3287d745c8d4575af0878dd3f`. Handoff: @goodalexander + @donravle (§5).*
