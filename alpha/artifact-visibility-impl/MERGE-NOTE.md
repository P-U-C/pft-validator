# Artifact Visibility States — Merge Note

**Task ID:** 5a3e0e52-3714-4e9f-928e-8eec74b40bab  
**Spec:** [Protocol-Safe Artifact Discovery UX Specification v1.0](../artifact-discovery-spec/)

## What This Contains

- `artifact-visibility.ts` — Typed contract + mapper/reducer + render logic
- `artifact-visibility.test.ts` — 20 test cases covering all states and roles

## Thin-Contract Assumptions

1. **SHA-256 for content hashing.** The spec says SHA-256. If the product uses a different hash function, change `artifact_content_hash` type accordingly.

2. **Viewer role is known at render time.** The mapper requires a `ViewerRole` ("submitter" | "collaborator" | "reviewer"). The caller must resolve the current user's role before calling `mapToRenderState`.

3. **URL liveness is checked externally.** The `artifact_url_status` field is assumed to be populated by an external periodic check (daily cron). The render logic consumes it but does not perform liveness checks.

4. **Obfuscation subtype is submitter-selected.** The three subtypes (clear_metadata, partial_metadata, sealed) are set at submission time. There is no auto-detection of which subtype applies.

5. **Legacy confidence tier is system-assigned.** Based on reviewer history and producer activity. The exact scoring logic is outside this contract's scope.

## Follow-Up Questions for Policy Confirmation

1. **Should the system allow downgrading from public to private after a cross-check task has been generated against the artifact?** Current implementation: blocked by spec invariant. Needs explicit product confirmation.

2. **What is the escrow mechanism for sealed artifacts?** The contract defines the `escrow` access mode but does not implement the key exchange. Needs infra team input.

3. **Should legacy artifacts with `grace_expired` status be periodically re-prompted, or is one notification sufficient?** Current assumption: one notification, then the artifact stays as `historical_reference` permanently.

4. **Metadata leakage detection for `forbidden_derivative` class.** The contract defines the class but does not implement auto-detection of when a metadata combination creates derivative exposure. This requires a separate analysis pass.

## Integration Points

- **Submission form:** Call `mapToRenderState(envelope, "submitter")` to render the submitter's view of their own artifact after submission.
- **Collaboration panel:** Call `renderSubmissionList(cohortArtifacts, "collaborator")` to render all cohort artifacts with correct visibility scoping.
- **Reviewer queue:** Call `renderReviewerQueue(artifacts)` to get manual review flags and render states.
- **Task generator:** Call `preflightCrossCheck(cohortArtifacts)` before generating any cross-check task. Block if `eligible === false`.
