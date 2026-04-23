/**
 * Tests for Artifact Visibility States
 *
 * Deterministic handling for public, private, obfuscated, and legacy
 * cases, including reviewer-safe indicators. Covers all viewer roles
 * and edge cases.
 */

import { describe, it, expect } from "vitest";
import {
  mapToRenderState,
  preflightCrossCheck,
  renderSubmissionList,
  renderReviewerQueue,
  renderSubmissionDetail,
  detectForbiddenDerivativeExposure,
  type ArtifactEnvelope,
  type ViewerRole,
} from "./artifact-visibility.js";

// ─── Fixtures ─────────────────────────────────────────────────────

const PUBLIC_ARTIFACT: ArtifactEnvelope = {
  artifact_id: "art-001",
  task_id: "task-001",
  visibility_state: "public",
  obfuscation_subtype: null,
  created_at: "2026-04-20T14:30:00Z",
  created_by_role: "producer",
  collaborator_discoverable: true,
  collaboration_eligibility: "open",
  reviewer_access_mode: "direct",
  artifact_title: "Test Private Profile Portfolio Edit and Reload Flow",
  artifact_url: "https://hackmd.io/@wizbubba/cmc-portfolio-qa",
  artifact_redacted_url: null,
  artifact_content_hash: "b4e1a3f7c29e1b44d8e6f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8091011",
  artifact_url_status: "live",
  artifact_verified_at: "2026-04-22T10:00:00Z",
  proof: { existence: "verified", relevance: "verified", completion: "verified" },
  legacy_status: "n/a",
  legacy_confidence_tier: null,
  legacy_allowed_use: null,
  notes_for_reviewer: null,
};

const PRIVATE_ARTIFACT: ArtifactEnvelope = {
  ...PUBLIC_ARTIFACT,
  artifact_id: "art-002",
  visibility_state: "private",
  collaborator_discoverable: false,
  collaboration_eligibility: "reviewer_only",
  reviewer_access_mode: "direct",
  artifact_title: "Run One Portfolio-Import QA and Brainstorm Pass",
  artifact_url: "https://private-gist.example.com/abc123",
};

const OBFUSCATED_CLEAR: ArtifactEnvelope = {
  ...PUBLIC_ARTIFACT,
  artifact_id: "art-003",
  visibility_state: "obfuscated",
  obfuscation_subtype: "clear_metadata",
  collaborator_discoverable: true,
  collaboration_eligibility: "constrained",
  reviewer_access_mode: "direct",
  artifact_title: "Sensitive Portfolio QA With Redactions",
  artifact_url: "https://private-gist.example.com/full-version",
  artifact_redacted_url: "https://hackmd.io/@user/redacted-qa",
};

const OBFUSCATED_SEALED: ArtifactEnvelope = {
  ...OBFUSCATED_CLEAR,
  artifact_id: "art-004",
  obfuscation_subtype: "sealed",
  collaborator_discoverable: false,
  collaboration_eligibility: "reviewer_only",
  reviewer_access_mode: "escrow",
  artifact_redacted_url: null,
};

const LEGACY_ARTIFACT: ArtifactEnvelope = {
  ...PUBLIC_ARTIFACT,
  artifact_id: "art-005",
  visibility_state: "legacy",
  collaborator_discoverable: false,
  collaboration_eligibility: "not_eligible",
  reviewer_access_mode: "attested",
  artifact_url: null,
  artifact_url_status: "unknown",
  artifact_verified_at: null,
  proof: { existence: "attested", relevance: "attested", completion: "attested" },
  legacy_status: "pending_migration",
  legacy_confidence_tier: "low",
  legacy_allowed_use: "historical_reference",
  notes_for_reviewer: "Submitted before common sharing norms. Producer inactive.",
};

const DEAD_URL_ARTIFACT: ArtifactEnvelope = {
  ...PUBLIC_ARTIFACT,
  artifact_id: "art-006",
  artifact_url_status: "dead",
  artifact_verified_at: "2026-04-15T10:00:00Z",
};

// ─── PUBLIC STATE TESTS ───────────────────────────────────────────

describe("Public artifact", () => {
  it("shows full artifact to all roles", () => {
    for (const role of ["submitter", "collaborator", "reviewer"] as ViewerRole[]) {
      const state = mapToRenderState(PUBLIC_ARTIFACT, role);
      expect(state.badge).toBe("🌐 PUBLIC");
      expect(state.show_url).toBe(true);
      expect(state.url_to_show).toBe(PUBLIC_ARTIFACT.artifact_url);
      expect(state.show_title).toBe(true);
      expect(state.show_hash).toBe(true);
      expect(state.can_cross_check).toBe(true);
      expect(state.can_open).toBe(true);
      expect(state.is_empty_state).toBe(false);
    }
  });

  it("shows proof layers only to reviewer", () => {
    const collab = mapToRenderState(PUBLIC_ARTIFACT, "collaborator");
    const reviewer = mapToRenderState(PUBLIC_ARTIFACT, "reviewer");
    expect(collab.show_proof_layers).toBe(false);
    expect(collab.proof).toBeNull();
    expect(reviewer.show_proof_layers).toBe(true);
    expect(reviewer.proof).toEqual({ existence: "verified", relevance: "verified", completion: "verified" });
  });

  it("marks dead URL as empty state", () => {
    const state = mapToRenderState(DEAD_URL_ARTIFACT, "collaborator");
    expect(state.can_cross_check).toBe(false);
    expect(state.is_empty_state).toBe(true);
    expect(state.url_status_indicator).toBe("✗ dead");
    expect(state.empty_state_reason).toContain("URL no longer resolves");
  });
});

// ─── PRIVATE STATE TESTS ──────────────────────────────────────────

describe("Private artifact", () => {
  it("hides URL and title from collaborator", () => {
    const state = mapToRenderState(PRIVATE_ARTIFACT, "collaborator");
    expect(state.badge).toBe("🔒 PRIVATE");
    expect(state.show_url).toBe(false);
    expect(state.url_to_show).toBeNull();
    expect(state.show_title).toBe(false);
    expect(state.title_to_show).toBeNull();
    expect(state.can_cross_check).toBe(false);
    expect(state.can_open).toBe(false);
  });

  it("shows hash and date to collaborator (safe-public metadata)", () => {
    const state = mapToRenderState(PRIVATE_ARTIFACT, "collaborator");
    expect(state.show_hash).toBe(true);
    expect(state.hash_to_show).toBe(PRIVATE_ARTIFACT.artifact_content_hash);
    expect(state.show_date).toBe(true);
  });

  it("shows URL and title to reviewer", () => {
    const state = mapToRenderState(PRIVATE_ARTIFACT, "reviewer");
    expect(state.show_url).toBe(true);
    expect(state.url_to_show).toBe(PRIVATE_ARTIFACT.artifact_url);
    expect(state.show_title).toBe(true);
    expect(state.title_to_show).toBe(PRIVATE_ARTIFACT.artifact_title);
    expect(state.show_proof_layers).toBe(true);
    expect(state.reviewer_access_note).toContain("Content hash verified");
  });

  it("shows URL to submitter (own artifact)", () => {
    const state = mapToRenderState(PRIVATE_ARTIFACT, "submitter");
    expect(state.show_url).toBe(true);
    expect(state.can_open).toBe(true);
  });

  it("sets collaborator empty state with reason", () => {
    const state = mapToRenderState(PRIVATE_ARTIFACT, "collaborator");
    expect(state.is_empty_state).toBe(true);
    expect(state.empty_state_reason).toContain("Restricted evidence");
  });
});

// ─── OBFUSCATED STATE TESTS ───────────────────────────────────────

describe("Obfuscated artifact (clear-metadata)", () => {
  it("shows redacted URL to collaborator", () => {
    const state = mapToRenderState(OBFUSCATED_CLEAR, "collaborator");
    expect(state.badge).toBe("🔍 OBFUSCATED");
    expect(state.url_to_show).toBe(OBFUSCATED_CLEAR.artifact_redacted_url);
    expect(state.show_title).toBe(true); // clear-metadata exposes title
    expect(state.can_cross_check).toBe(true); // constrained eligibility allows reference
    expect(state.is_empty_state).toBe(false);
  });

  it("shows full URL to reviewer", () => {
    const state = mapToRenderState(OBFUSCATED_CLEAR, "reviewer");
    expect(state.url_to_show).toBe(OBFUSCATED_CLEAR.artifact_url);
    expect(state.reviewer_access_note).toContain("Verify redaction");
  });
});

describe("Obfuscated artifact (sealed)", () => {
  it("hides everything from collaborator except hash", () => {
    const state = mapToRenderState(OBFUSCATED_SEALED, "collaborator");
    expect(state.url_to_show).toBeNull();
    expect(state.show_title).toBe(false);
    expect(state.show_hash).toBe(true);
    expect(state.can_cross_check).toBe(false);
    expect(state.is_empty_state).toBe(true);
    expect(state.empty_state_reason).toContain("Sealed artifact");
  });

  it("shows full access to reviewer with escrow note", () => {
    const state = mapToRenderState(OBFUSCATED_SEALED, "reviewer");
    expect(state.url_to_show).toBe(OBFUSCATED_SEALED.artifact_url);
    expect(state.show_title).toBe(true);
    expect(state.reviewer_access_note).toContain("escrow");
  });
});

// ─── LEGACY STATE TESTS ──────────────────────────────────────────

describe("Legacy artifact", () => {
  it("shows nothing to collaborator with explanation", () => {
    const state = mapToRenderState(LEGACY_ARTIFACT, "collaborator");
    expect(state.badge).toBe("📦 LEGACY");
    expect(state.show_url).toBe(false);
    expect(state.show_title).toBe(false);
    expect(state.can_cross_check).toBe(false);
    expect(state.can_open).toBe(false);
    expect(state.is_empty_state).toBe(true);
    expect(state.empty_state_reason).toContain("Legacy artifact lacks minimum provenance");
  });

  it("shows confidence tier and allowed use in legacy badge", () => {
    const state = mapToRenderState(LEGACY_ARTIFACT, "collaborator");
    expect(state.legacy_badge).toContain("low confidence");
    expect(state.legacy_badge).toContain("historical_reference");
  });

  it("shows full context to reviewer with attestation requirement", () => {
    const state = mapToRenderState(LEGACY_ARTIFACT, "reviewer");
    expect(state.show_title).toBe(true);
    expect(state.show_proof_layers).toBe(true);
    expect(state.proof?.existence).toBe("attested");
    expect(state.reviewer_access_note).toContain("Legacy status: pending_migration");
    expect(state.reviewer_access_note).toContain("attestation basis");
    expect(state.status_message).toContain("Reviewer attestation required");
  });
});

// ─── PREFLIGHT CROSS-CHECK TESTS ──────────────────────────────────

describe("preflightCrossCheck", () => {
  it("allows cross-check when open artifacts exist", () => {
    const result = preflightCrossCheck([PUBLIC_ARTIFACT, PRIVATE_ARTIFACT]);
    expect(result.eligible).toBe(true);
    expect(result.open_count).toBe(1);
    expect(result.reroute_to).toBe("cross_check");
  });

  it("blocks cross-check with only constrained artifacts", () => {
    const result = preflightCrossCheck([OBFUSCATED_CLEAR, PRIVATE_ARTIFACT]);
    expect(result.eligible).toBe(false);
    expect(result.reroute_to).toBe("fresh_pass");
    expect(result.reason).toContain("Constrained artifacts exist");
  });

  it("reroutes to normalization when no discoverable artifacts", () => {
    const result = preflightCrossCheck([PRIVATE_ARTIFACT, LEGACY_ARTIFACT]);
    expect(result.eligible).toBe(false);
    expect(result.reroute_to).toBe("normalization_request");
    expect(result.reason).toContain("No discoverable artifacts");
  });

  it("blocks when only dead-URL public artifacts exist", () => {
    const result = preflightCrossCheck([DEAD_URL_ARTIFACT, PRIVATE_ARTIFACT]);
    expect(result.eligible).toBe(false);
  });

  it("handles empty cohort", () => {
    const result = preflightCrossCheck([]);
    expect(result.eligible).toBe(false);
    expect(result.reroute_to).toBe("normalization_request");
  });
});

// ─── SUBMISSION LIST TESTS ────────────────────────────────────────

describe("renderSubmissionList", () => {
  it("produces correct summary for mixed cohort", () => {
    const { cards, summary } = renderSubmissionList(
      [PUBLIC_ARTIFACT, PRIVATE_ARTIFACT, LEGACY_ARTIFACT],
      "collaborator",
    );
    expect(cards).toHaveLength(3);
    expect(summary).toContain("1 of 3");
  });

  it("produces warning when no open artifacts", () => {
    const { summary } = renderSubmissionList(
      [PRIVATE_ARTIFACT, LEGACY_ARTIFACT],
      "collaborator",
    );
    expect(summary).toContain("Cross-check tasks cannot be generated");
  });
});

// ─── REVIEWER QUEUE TESTS ─────────────────────────────────────────

describe("renderReviewerQueue", () => {
  it("flags legacy artifacts for manual review", () => {
    const queue = renderReviewerQueue([LEGACY_ARTIFACT]);
    expect(queue[0].requires_manual_review).toBe(true);
    expect(queue[0].manual_review_reason).toContain("attestation");
  });

  it("flags dead URLs for manual review", () => {
    const queue = renderReviewerQueue([DEAD_URL_ARTIFACT]);
    expect(queue[0].requires_manual_review).toBe(true);
    expect(queue[0].manual_review_reason).toContain("URL no longer resolves");
  });

  it("flags private artifacts for manual review", () => {
    const queue = renderReviewerQueue([PRIVATE_ARTIFACT]);
    expect(queue[0].requires_manual_review).toBe(true);
    expect(queue[0].manual_review_reason).toContain("gated access");
  });

  it("flags sealed artifacts for manual review", () => {
    const queue = renderReviewerQueue([OBFUSCATED_SEALED]);
    expect(queue[0].requires_manual_review).toBe(true);
    expect(queue[0].manual_review_reason).toContain("escrow");
  });

  it("does not flag healthy public artifacts", () => {
    const queue = renderReviewerQueue([PUBLIC_ARTIFACT]);
    expect(queue[0].requires_manual_review).toBe(false);
    expect(queue[0].manual_review_reason).toBeNull();
  });

  it("flags artifacts with unverified proof layers", () => {
    const unverified: ArtifactEnvelope = {
      ...PUBLIC_ARTIFACT,
      proof: { existence: "verified", relevance: "unverified", completion: "verified" },
    };
    const queue = renderReviewerQueue([unverified]);
    expect(queue[0].requires_manual_review).toBe(true);
    expect(queue[0].manual_review_reason).toContain("proof layers unverified");
  });
});

// ─── SUBMISSION DETAIL TESTS ──────────────────────────────────────

describe("renderSubmissionDetail", () => {
  it("renders public artifact detail with action buttons for submitter", () => {
    const detail = renderSubmissionDetail(PUBLIC_ARTIFACT, "submitter");
    expect(detail.render.badge).toBe("🌐 PUBLIC");
    expect(detail.action_buttons).toContain("Edit Visibility");
    expect(detail.verification_envelope_summary).toContain("Visibility: public");
    expect(detail.verification_envelope_summary).toContain("Existence: verified");
    expect(detail.metadata_leakage_warning).toBeNull();
  });

  it("renders collaborator detail with cross-check action", () => {
    const detail = renderSubmissionDetail(PUBLIC_ARTIFACT, "collaborator");
    expect(detail.action_buttons).toContain("Use for Cross-Check");
    expect(detail.action_buttons).toContain("Open");
  });

  it("renders reviewer detail with full action set", () => {
    const detail = renderSubmissionDetail(PUBLIC_ARTIFACT, "reviewer");
    expect(detail.action_buttons).toContain("Verify");
    expect(detail.action_buttons).toContain("Approve");
    expect(detail.action_buttons).toContain("Reject");
  });

  it("offers 'Upgrade to Public' for private artifact submitter", () => {
    const detail = renderSubmissionDetail(PRIVATE_ARTIFACT, "submitter");
    expect(detail.action_buttons).toContain("Upgrade to Public");
  });

  it("shows legacy envelope summary with confidence tier", () => {
    const detail = renderSubmissionDetail(LEGACY_ARTIFACT, "reviewer");
    expect(detail.verification_envelope_summary).toContain("Legacy: pending_migration");
  });
});

// ─── METADATA LEAKAGE GUARD TESTS ─────────────────────────────────

describe("detectForbiddenDerivativeExposure", () => {
  it("flags sensitive title in small cohort", () => {
    const result = detectForbiddenDerivativeExposure("Trading Strategy QA — April 2026", 2);
    expect(result.exposed).toBe(true);
    expect(result.reason).toContain("risks re-identification");
  });

  it("warns but does not block in large cohort", () => {
    const result = detectForbiddenDerivativeExposure("Portfolio Import QA Pass", 12);
    expect(result.exposed).toBe(false);
    expect(result.reason).toContain("potentially sensitive");
  });

  it("passes clean titles", () => {
    const result = detectForbiddenDerivativeExposure("Test Profile Edit and Reload Flow", 5);
    expect(result.exposed).toBe(false);
    expect(result.reason).toBeNull();
  });

  it("handles null title", () => {
    const result = detectForbiddenDerivativeExposure(null, 5);
    expect(result.exposed).toBe(false);
    expect(result.reason).toBeNull();
  });

  it("detects MNPI-related terms", () => {
    const result = detectForbiddenDerivativeExposure("Merger Analysis — Confidential", 3);
    expect(result.exposed).toBe(true);
  });
});

describe("renderSubmissionDetail with leakage guard", () => {
  it("downgrades title for collaborator in small cohort with sensitive title", () => {
    const sensitive: ArtifactEnvelope = {
      ...OBFUSCATED_CLEAR,
      artifact_title: "Trading Portfolio QA — Internal",
    };
    const detail = renderSubmissionDetail(sensitive, "collaborator", 2);
    expect(detail.render.title_to_show).toBeNull(); // title downgraded
    expect(detail.metadata_leakage_warning).toContain("risks re-identification");
  });

  it("preserves title for submitter even with sensitive content", () => {
    const sensitive: ArtifactEnvelope = {
      ...OBFUSCATED_CLEAR,
      artifact_title: "Trading Portfolio QA — Internal",
    };
    const detail = renderSubmissionDetail(sensitive, "submitter", 2);
    // Submitter always sees their own title, no warning
    expect(detail.metadata_leakage_warning).toBeNull();
  });
});

// ─── PROTOCOL INVARIANT TESTS ─────────────────────────────────────
//
// These verify protocol-safety guarantees that must hold regardless
// of input. Adversarial conditions tested.

describe("Protocol invariants", () => {
  it("collaborator NEVER sees direct URL for private artifact", () => {
    const state = mapToRenderState(PRIVATE_ARTIFACT, "collaborator");
    expect(state.show_url).toBe(false);
    expect(state.url_to_show).toBeNull();
  });

  it("collaborator NEVER sees title for sealed artifact", () => {
    const state = mapToRenderState(OBFUSCATED_SEALED, "collaborator");
    expect(state.show_title).toBe(false);
    expect(state.title_to_show).toBeNull();
  });

  it("reviewer_only eligibility NEVER produces can_cross_check = true", () => {
    for (const artifact of [PRIVATE_ARTIFACT, OBFUSCATED_SEALED, LEGACY_ARTIFACT]) {
      for (const role of ["submitter", "collaborator", "reviewer"] as ViewerRole[]) {
        const state = mapToRenderState(artifact, role);
        if (artifact.collaboration_eligibility === "reviewer_only" || artifact.collaboration_eligibility === "not_eligible") {
          expect(state.can_cross_check).toBe(false);
        }
      }
    }
  });

  it("dead URL NEVER produces can_open = true for collaborator", () => {
    const state = mapToRenderState(DEAD_URL_ARTIFACT, "collaborator");
    expect(state.can_open).toBe(false);
  });

  it("legacy artifact NEVER surfaces as open collaboration", () => {
    for (const role of ["submitter", "collaborator", "reviewer"] as ViewerRole[]) {
      const state = mapToRenderState(LEGACY_ARTIFACT, role);
      expect(state.can_cross_check).toBe(false);
      expect(state.can_open).toBe(false);
    }
  });

  it("private artifact incorrectly marked open still cannot cross-check", () => {
    // Adversarial: someone manually sets eligibility to open on a private artifact
    const tampered: ArtifactEnvelope = {
      ...PRIVATE_ARTIFACT,
      collaboration_eligibility: "open", // should not matter — render logic enforces
    };
    const state = mapToRenderState(tampered, "collaborator");
    // Even with open eligibility, private artifacts hide URL from collaborators
    expect(state.show_url).toBe(false);
    expect(state.can_cross_check).toBe(false);
  });

  it("obfuscated artifact with missing redacted URL shows empty state", () => {
    const broken: ArtifactEnvelope = {
      ...OBFUSCATED_CLEAR,
      artifact_redacted_url: null,
    };
    const state = mapToRenderState(broken, "collaborator");
    expect(state.url_to_show).toBeNull();
    expect(state.can_open).toBe(false);
    expect(state.can_cross_check).toBe(false);
    expect(state.show_url).toBe(false);
    expect(state.status_message).toContain("redacted URL missing");
  });

  it("grace_expired legacy has no reviewer upgrade prompt", () => {
    const expired: ArtifactEnvelope = {
      ...LEGACY_ARTIFACT,
      legacy_status: "grace_expired",
      legacy_allowed_use: "historical_reference",
    };
    const state = mapToRenderState(expired, "reviewer");
    expect(state.status_message).toContain("historical_reference");
  });
});

// ─── FIXTURE MATRIX ───────────────────────────────────────────────
//
// viewerRole × visibility_state × key fields shown
//
// | Role         | public          | private         | obfuscated-clear | obfuscated-sealed | legacy          |
// |--------------|-----------------|-----------------|------------------|-------------------|-----------------|
// | submitter    | url,title,hash  | url,hash,date   | url,title,hash   | url,title,hash    | hash,date       |
// | collaborator | url,title,hash  | hash,date       | redacted,title   | hash only         | date only       |
// | reviewer     | url,title,proof | url,title,proof | url,title,proof  | url,title,proof   | title,proof,att |

describe("Fixture matrix — field visibility by role × state", () => {
  const matrix: Array<{
    role: ViewerRole;
    artifact: ArtifactEnvelope;
    label: string;
    expectUrl: boolean;
    expectTitle: boolean;
    expectHash: boolean;
    expectProof: boolean;
  }> = [
    { role: "submitter",    artifact: PUBLIC_ARTIFACT,    label: "submitter×public",           expectUrl: true,  expectTitle: true,  expectHash: true,  expectProof: false },
    { role: "collaborator", artifact: PUBLIC_ARTIFACT,    label: "collaborator×public",        expectUrl: true,  expectTitle: true,  expectHash: true,  expectProof: false },
    { role: "reviewer",     artifact: PUBLIC_ARTIFACT,    label: "reviewer×public",            expectUrl: true,  expectTitle: true,  expectHash: true,  expectProof: true  },
    { role: "submitter",    artifact: PRIVATE_ARTIFACT,   label: "submitter×private",          expectUrl: true,  expectTitle: false, expectHash: true,  expectProof: false },
    { role: "collaborator", artifact: PRIVATE_ARTIFACT,   label: "collaborator×private",       expectUrl: false, expectTitle: false, expectHash: true,  expectProof: false },
    { role: "reviewer",     artifact: PRIVATE_ARTIFACT,   label: "reviewer×private",           expectUrl: true,  expectTitle: true,  expectHash: true,  expectProof: true  },
    { role: "submitter",    artifact: OBFUSCATED_CLEAR,   label: "submitter×obfuscated-clear", expectUrl: true,  expectTitle: true,  expectHash: true,  expectProof: false },
    { role: "collaborator", artifact: OBFUSCATED_CLEAR,   label: "collab×obfuscated-clear",    expectUrl: true,  expectTitle: true,  expectHash: true,  expectProof: false },
    { role: "reviewer",     artifact: OBFUSCATED_CLEAR,   label: "reviewer×obfuscated-clear",  expectUrl: true,  expectTitle: true,  expectHash: true,  expectProof: true  },
    { role: "collaborator", artifact: OBFUSCATED_SEALED,  label: "collab×obfuscated-sealed",   expectUrl: false, expectTitle: false, expectHash: true,  expectProof: false },
    { role: "reviewer",     artifact: OBFUSCATED_SEALED,  label: "reviewer×obfuscated-sealed", expectUrl: true,  expectTitle: true,  expectHash: true,  expectProof: true  },
    { role: "collaborator", artifact: LEGACY_ARTIFACT,    label: "collaborator×legacy",        expectUrl: false, expectTitle: false, expectHash: true,  expectProof: false },
    { role: "reviewer",     artifact: LEGACY_ARTIFACT,    label: "reviewer×legacy",            expectUrl: false, expectTitle: true,  expectHash: true,  expectProof: true  },
  ];

  for (const { role, artifact, label, expectUrl, expectTitle, expectHash, expectProof } of matrix) {
    it(`${label}`, () => {
      const state = mapToRenderState(artifact, role);
      expect(state.show_url).toBe(expectUrl);
      expect(state.show_title).toBe(expectTitle);
      expect(state.show_hash).toBe(expectHash);
      expect(state.show_proof_layers).toBe(expectProof);
    });
  }
});
