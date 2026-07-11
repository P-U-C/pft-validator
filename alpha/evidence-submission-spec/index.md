# Evidence Submission System Improvements — Multi-Source Verification & Cap Increase

**Task:** `task_60908b578ea94b522e96d8de762e459e` · Task Node Core Product board
**Author:** zoz (`zozDOTeth`) · Project Leader badge
**Date:** 2026-07-11 · **Audience:** Core Contributors (implementation-ready), reviewed by @goodalexander
**Status:** Specification — proposed

---

## 0. Executive summary

Task Node caps evidence at **2 items per submission**. Mixed-verification tasks already require 2 (public doc URL + Discord announcement), leaving **zero slots** for anything that would make the work independently verifiable — commit hashes, data files, screenshots, corroborating links. Contributors omit artifacts, reviewers then flag the work as *self-attested*, and reward confidence drops. This is a confirmed, user-reported failure (§1.3).

This spec proposes two changes, sized for Core Contributor implementation:

1. **Raise the evidence cap to a default of 4, per-task-type configurable** (`evidence_cap` in the verification policy; technical bounds 1–8; recommended minimum 3 for mixed policies, enforced by policy linting §2.3). The enforcement contract is unchanged — only the limit's source moves from a fixed constant to task policy. (§2.1)
2. **Make Discord message URLs a first-class, automatically verified evidence type**: parse → allowlist-check → bot-fetch → store a verification record (existence, author, channel, timestamp, content hash) so reviewers see *verified* metadata instead of clicking a link they may not even have access to. Degrades gracefully to today's behavior when verification is impossible. (§2.2)

Backward compatibility is clean (append-only, no breaking API change, old clients unaffected — §3), and §4 gives concrete acceptance criteria with a test matrix.

---

## 1. Current system, cap limitation, and reported impact

### 1.1 Current evidence flow (observed behavior)

1. Contributor completes work, submits **initial evidence**: free-text summary + up to **2 artifacts** (URL or `type=value`). From the agent CLI: `pfterminal tasknode task evidence <id> --summary/--body-file … --artifact … --artifact …`.
2. For `followup_required` policies the task moves to *Verification requested*; the contributor submits a **verification response** (same shape, same 2-artifact cap).
3. A human reviewer manually inspects the artifacts and approves → *Rewarded* (or asks for follow-up).

Artifacts are opaque strings today: no type detection, no fetch, no metadata capture, no verification state. A Discord link and a GitHub URL are stored and rendered identically — as text a reviewer must click.

### 1.2 Why the 2-item cap binds immediately

The dominant verification policy on network boards — per the signed task payload — is **mixed**: "a publicly accessible document URL … **plus** a Discord announcement link or screenshot." That consumes both slots by definition. Anything else — the commit hash pinning the doc version, a machine-readable data file, a second corroborating channel, a screenshot when the message link is doubted — must be omitted or awkwardly inlined into the summary text where it is unverifiable and unrenderable.

Firsthand operator data point: every mixed-verification submission from this operator's last three rewarded tasks (`task_59f228c`, `task_1799486`, `task_2489fbc`) used exactly 2/2 slots; supplementary artifacts (commit SHA, `disposals.csv`, `registry.csv`) had to ride inside summary prose instead of being attached as evidence.

### 1.3 User-reported impact (Hive QA findings, from the signed task payload)

- **@jjj (Expert badge, pipeline/workflow engineering), Hive chat 2026-07-10:** reported being unable to attach more than 2 evidence items when the task needed 3 — a GitHub link **plus** a Discord screenshot **plus** a Discord message link.
- **The same operator received a review note** stating the "key publication and announcement artifacts are only self-attested rather than independently verifiable public evidence, so full confidence is reduced" — i.e., the cap directly caused a confidence downgrade on completed work.
- **@jjj also had to ask whether a GitHub link was acceptable evidence at all** — a symptom of artifacts having no type or verification status.
- **QA report (payload, 2026-07-10):** rates the limit "Medium — directly blocks complete evidence submission for tasks requiring mixed verification," and independently recommends raising the cap to ≥3 or per-type configurability, plus "an independent verification surface for Discord evidence."
- **Executive brief (payload):** flags the cap as "a process gap that could affect task review quality across multiple projects" and an open decision for project leaders.

The failure chain: **cap forces omission → evidence becomes self-attested → reviewer confidence drops → rewards get flagged or downgraded on work that was actually done.** Both proposals below attack this chain — one widens the pipe, the other removes the human from link verification.

---

## 2. Proposed design

### 2.1 Evidence cap: default 4, per-task-type configurable

**Config schema.** Add `evidence_cap` to the verification policy object attached to every task (the same object that already carries `mode`, `verification_type`, `followup_required`):

```json
"policy": {
  "mode": "manual",
  "verification_type": "mixed",
  "followup_required": true,
  "evidence_cap": 4
}
```

- **Default: 4** when absent (2 required mixed artifacts + 2 supplementary).
- **Technical bounds: 1 ≤ evidence_cap ≤ 8.** The hard ceiling of 8 exists so the cap cannot be configured into an evidence-spam vector; values outside bounds are clamped at task-creation time and logged. The *effective* lower bound per policy comes from linting (§2.3): a policy may never cap below the number of evidence roles it requires (mixed ⇒ ≥2; recommended ≥3).
- **Per-task-type defaults** (taskgen sets these; operators can override per task): `url`-only policies → 3; `mixed` → 4; code/build tasks → 6 (repo link, PR, commit, CI run, artifact, announcement).
- **Enforcement contract is unchanged:** the server-side validation that today rejects a 3rd artifact must read its limit from the task's policy (implementation shape is the implementer's choice — the contract is "limit comes from policy, default 4"). Error message must name the limit and its source: `evidence_cap_exceeded (cap=4, source=task_policy)`.
- **Evidence roles (reviewer-facing bundle).** Each artifact carries an optional `role`: `required_doc` | `required_announcement` | `supplementary` | `machine_readable`. The reviewer view groups the packet by role, so a higher cap adds *organized* corroboration rather than a longer flat link list. Clients that send no roles get today's flat rendering.

**Non-goals:** no unlimited evidence (reviewer attention is the scarce resource — the cap protects reviewers); no client-side enforcement (clients are already variadic, see §3).

### 2.2 Discord message URL ingestion with automated metadata verification

**Recognition.** At submission time, any artifact whose URL host is `discord.com`, `discordapp.com`, or the `ptb.`/`canary.` Discord subdomains (any scheme) with path `/channels/<guild_id>/<channel_id>/<message_id>` is classified `discord_message` and canonicalized to `https://discord.com/…` (all other artifacts remain type `url`; the classifier is a regex, not a fetch).

**Verification pipeline** (async worker, runs at submission and re-runs at review-open):

1. **Parse & sanity.** Extract the three snowflake IDs. Derive `posted_at` from the message snowflake (creation timestamp is embedded in the ID: `(id >> 22) + 1420070400000` ms). Reject-to-unverified if malformed.
2. **Allowlist.** `guild_id` must be in the network's approved-guild list and `channel_id` in the approved-channel list. **This is a new required config surface:** the notion of "approved Post Fiat channels" exists in task prose today, but no verifier-readable stored list is established — implementers must create one (and import whatever operational list exists, if any). Non-allowlisted → status `unverified_out_of_scope`.
3. **Fetch.** Using the network's existing Discord bot credentials (the bot must be a member of approved guilds with `Read Message History`), `GET /channels/{channel_id}/messages/{message_id}`. 
4. **Record + snapshot.** Persist a verification record alongside the artifact, including a normalized content snapshot captured at submission time — durable evidence that survives later deletion or editing of the message:

```json
{
  "artifact_id": "…",
  "kind": "discord_message",
  "status": "verified",            
  "guild_id": "…", "channel_id": "…", "message_id": "…",
  "author_id": "…", "author_handle": "…",
  "posted_at": "2026-07-09T12:56:46Z",
  "edited_at": null,
  "content_sha256": "…",
  "content_snapshot": "…",
  "links_in_content": ["https://github.com/…"],
  "checked_at": "…", "recheck_of": null
}
```

5. **Cross-checks** (computed, stored as booleans on the record):
   - `posted_after_accept`: message `posted_at` ≥ task acceptance time (announcement postdates the work).
   - `references_submitted_artifact`: any URL in the message content matches another artifact on the same submission (the announcement actually links the doc).
   - `author_is_submitter`: message author's linked identity matches the submitting operator, when the identity mapping exists (Discord↔operator binding is optional; absence is *not* a failure).

**Status taxonomy** (exhaustive): `pending` (queued, not yet checked), `verified`, `verified_edited` (message edited after submission — edits are normal Discord behavior, not presumed fraud; record keeps original *and* current hash + snapshot + `edited_at`, reviewer judges), `unverified_out_of_scope` (guild/channel not allowlisted), `unverified_unreachable` (bot lacks access / API error after 3 retries with backoff), `failed_not_found` (message deleted — submission-time snapshot retained).

**Degradation rule — never block submission.** Verification failure or unavailability keeps today's behavior exactly: the artifact stays attached as an opaque URL with its status displayed. Automated verification adds signal; it must never subtract capability. Manual review remains the authority (`mode: manual` is untouched).

**Reviewer surface.** Where reviewers today see a bare URL, they see the status plus the captured metadata (author, channel, timestamp, contained links, edit flag). A `verified` Discord announcement that `references_submitted_artifact` and `posted_after_accept` needs zero clicks to trust; today it needs Discord access, guild membership, and manual cross-reading.

**Anti-abuse notes.** Allowlist prevents look-alike servers; hash + snapshot + review-time recheck make post-submission edits visible (`verified_edited`) with both versions preserved; deletion between submission and review is caught by the recheck (`failed_not_found`) with the snapshot retained — all three currently invisible to a reviewer who checked the link once.

**Screenshots become optional, not obsolete:** a screenshot is `type=image` supplementary evidence (enabled by the raised cap), for cases where the message is in a channel the bot cannot read.

### 2.3 Policy linting at task creation

Task creation (taskgen or manual) validates the policy against itself: if `evidence_cap` is lower than the number of evidence roles the verification text requires (mixed ⇒ 2), creation is rejected with `evidence_policy_underprovisioned` (or warned, for operators with override rights). This prevents recreating today's failure — a policy that demands more evidence than it accepts — through bad configuration.

---

## 3. Backward compatibility & migration

| Surface | Change | Compat impact |
|---|---|---|
| Evidence API (submit) | Validation constant → policy lookup | None for existing clients: the artifact array is already variadic; requests with ≤2 artifacts are unaffected. No API version bump. |
| Evidence API (read) | New optional `verification` object per artifact | Additive field; old readers ignore it. |
| Task/verification policy schema | New optional `evidence_cap` | Absent ⇒ default 4. Existing stored tasks need **no migration** (reader-side default). |
| CLI / TUI (PfTerminal) | None required | `--artifact` is already repeatable; today's rejection happens server-side. Older CLIs gain the higher cap for free. |
| Storage | New verification-record store (table or JSONB column keyed by artifact) | Append-only, new writes only. No rewrite of historical evidence. |
| Historical submissions | Untouched | Legacy views must be behaviorally equivalent for historical evidence (same links, same order, no new required fields). Optional, low-value backfill: derive `posted_at` for historical Discord URLs from snowflakes (offline, idempotent). Explicitly **not** required for acceptance. |
| Review pipeline (incl. Orc review components) | Reads new statuses if present | Statuses are additive input; graders treating all artifacts as opaque URLs continue to work. |

**Rollout order (each step independently shippable and reversible):**
1. Cap raise + `evidence_cap` config (config/validation change only; instant rollback = restore constant).
2. Discord classifier + verification worker behind a feature flag, `verified` badge visible to reviewers only.
3. Per-task-type defaults in taskgen; cross-check booleans surfaced to contributors.

**Explicit assumptions** (implementers must confirm): (a) a network-operated Discord bot with read access to approved channels exists or can be provisioned — **this is a new operational dependency**: bot token custody, guild membership, `Read Message History` permission, Discord rate-limit handling, and secret management all land on the implementing team (the announcement workflow only presumes humans posting, not bot reads); (b) the approved-channel list must be created as verifier-readable config (§2.2); (c) evidence artifacts have stable server-side identifiers to key verification records to. If (a) fails, §2.2 still ships with statuses limited to `pending`/`unverified_unreachable` — which is precisely today's trust level, now made explicit.

---

## 4. Acceptance criteria & test matrix

**AC1 — cap default.** A mixed-verification task with no `evidence_cap` accepts 4 artifacts on initial evidence AND on verification response; a 5th is rejected with `evidence_cap_exceeded` naming cap and source. Submissions with 1–2 artifacts behave exactly as today.
**AC2 — cap config.** A task created with `evidence_cap: 6` accepts 6; `evidence_cap: 12` is clamped to 8 at creation and logged; `evidence_cap: 0` is clamped to 1. Validation order: generic bounds clamping (this AC) runs first, then policy linting (AC9) — so a mixed policy clamped to 1 subsequently fails linting.
**AC3 — Discord verified.** A real message URL in an allowlisted channel yields a `verified` record with author, `posted_at` (matching the snowflake-derived time), `content_sha256`, snapshot, and `links_in_content`. Verification is async: the artifact is `pending` immediately after submission (submission latency unchanged) and reaches a terminal status within the worker SLA — 60 s target, measured in CI against a mocked Discord API; SLA breach leaves `pending`, which decays to `unverified_unreachable` at the retry limit.
**AC4 — out of scope.** A message URL from a non-allowlisted guild attaches successfully with `unverified_out_of_scope`; submission is not blocked.
**AC5 — deletion/edit.** Deleting the message after submission → review-time recheck yields `failed_not_found` with the submission-time snapshot still shown. Editing content → `verified_edited` with original and current hashes, both timestamps, and the snapshot displayed to the reviewer.
**AC6 — degradation.** With the bot token revoked (simulated outage), submissions with Discord URLs still succeed; status `unverified_unreachable` after 3 retries; no user-facing latency added.
**AC7 — cross-checks.** For a verified message posted after task acceptance whose content contains another artifact URL from the same submission, `posted_after_accept` and `references_submitted_artifact` are both true and visible to the reviewer.
**AC8 — no regression.** Full existing evidence-submission test suite passes unmodified; historical evidence remains behaviorally equivalent in legacy views (same artifacts, same order, nothing newly required).
**AC9 — policy linting.** Creating a mixed-verification task with `evidence_cap: 1` fails with `evidence_policy_underprovisioned`; with an operator override it succeeds with a logged warning.

**Test matrix (minimum):** {initial evidence, verification response} × {1, cap, cap+1 artifacts} × {no policy, explicit cap, out-of-bounds cap, underprovisioned policy}; Discord URLs × {allowlisted, non-allowlisted, deleted, edited, malformed, discordapp.com/ptb/canary variants, bot-offline}; one end-to-end: submit → pending → verified → reviewer view → recheck.

**Definition of done:** AC1–AC9 green in CI; feature flags default-on for cap, reviewer-visible-only for Discord verification; rollback procedure documented per rollout step.

---

## 5. Implementation sketch & effort

- **Cap + roles (§2.1):** validation contract change + config plumb-through + error message + role grouping in reviewer view. *Small: 2–3 days incl. tests.*
- **Discord ingestion (§2.2):** URL classifier (regex), async worker with `pending` state, one Discord REST call with retry/backoff + rate-limit handling, verification-record + snapshot store, reviewer UI badge. *Medium: 1–2 weeks incl. tests and the allowlist config surface.*
- **Policy linting (§2.3) + taskgen defaults:** creation-time validation + template change once cap ships. *Small: 1 day.*

**New operational dependencies to provision:** Discord bot token (secret management + rotation), bot membership in approved guilds with `Read Message History`, rate-limit budget for the verification worker, and the allowlist config surface. No other external dependencies.

---

## 6. Data sources & evidence gaps

**Sources:** signed task payload (2026-07-11 snapshot): Hive QA report, executive brief, development/operative/KOL reports (all 2026-07-10), project document; firsthand operator submission records for `task_59f228c`, `task_1799486`, `task_2489fbc` (this operator's CLI transcripts).
**Gaps, stated:** (a) the Task Node server codebase is not visible to this author — §2/§3 specify behavior contracts and enforcement points, not file-level diffs; (b) the exact storage engine for evidence is unknown — the verification-record store is specified as a contract (keyed, append-only) with table/JSONB both acceptable; (c) whether a Discord↔operator identity mapping exists is unknown — `author_is_submitter` is specified as optional for that reason; (d) the count of "multiple contributors" reporting the cap issue beyond @jjj is not enumerable from the packet — impact is evidenced by the QA report's severity rating and the review-note downgrade, not a contributor count.

---

*Prepared by zoz for `task_60908b578ea94b522e96d8de762e459e` (Task Node Core Product). Implementation audience: Core Contributors. Review: @goodalexander.*
