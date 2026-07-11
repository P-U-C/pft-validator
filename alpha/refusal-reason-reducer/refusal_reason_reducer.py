#!/usr/bin/env python3
"""
Refusal Reason Capture Reducer
===============================

Turns declined and expired task offers into structured routing data.

Defines canonical refusal categories, typed input/output contracts,
pure reducer logic with backfill mapping, export serialization, and
privacy-safe note handling.

Self-contained: no external dependencies beyond Python 3.10+ stdlib.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from enum import Enum
from typing import Optional, Callable


# =============================================================================
# CONSTANTS
# =============================================================================

SCHEMA_VERSION = "refusal_reason_capture.v1"
METHODOLOGY_VERSION = "2026-05-04"
NOTE_MAX_LENGTH = 140


# =============================================================================
# CANONICAL REFUSAL CATEGORIES
# =============================================================================

class RefusalCategory(str, Enum):
    """Canonical refusal reasons for task offer termination.

    14 categories: 9 manual + 3 system-generated + 2 fallback.
    """
    # Manual refusal categories (contributor-initiated)
    WRONG_SCOPE = "wrong_scope"
    ALREADY_DONE = "already_done"
    INSUFFICIENT_CONTEXT = "insufficient_context"
    SKILL_MISMATCH = "skill_mismatch"
    TIME_CONSTRAINT = "time_constraint"
    REWARD_INADEQUATE = "reward_inadequate"
    UNCLEAR_ACCEPTANCE = "unclear_acceptance"
    DUPLICATE_REQUEST = "duplicate_request"
    PRIVACY_CONCERN = "privacy_concern"

    # System-generated categories (no human action required)
    NO_RESPONSE = "no_response"       # Offer ended because contributor never responded
    EXPIRY = "expiry"                  # Offer/task expired due to deadline/window closure
    SYSTEM_CANCELLED = "system_cancelled"  # System withdrew the offer

    # Fallback categories
    OTHER = "other"       # Contributor declined with an unmapped label
    UNKNOWN = "unknown"   # Declined with no label at all


class ActorType(str, Enum):
    """Who or what generated the refusal."""
    CONTRIBUTOR = "contributor"
    SYSTEM_EXPIRY = "system_expiry"
    SYSTEM_CANCEL = "system_cancel"
    VALIDATOR = "validator"
    BACKFILL = "backfill"


class TerminalStatus(str, Enum):
    """Terminal states for task offers."""
    DECLINED = "declined"
    NO_RESPONSE = "no_response"
    EXPIRED = "expired"
    CANCELLED = "cancelled"


class MappingRule(str, Enum):
    """How the canonical category was resolved."""
    TERMINAL_STATUS = "terminal_status"
    NORMALIZED_EXACT_MATCH = "normalized_exact_match"
    ALIAS_EXACT_MATCH = "alias_exact_match"
    TOKEN_SUBSET_MATCH = "token_subset_match"
    NO_LABEL_FALLBACK = "no_label_fallback"
    UNKNOWN_LABEL_FALLBACK = "unknown_label_fallback"


# =============================================================================
# BACKFILL MAPPING
# =============================================================================

BACKFILL_MAP: dict[str, RefusalCategory] = {
    # Direct canonical labels
    "wrong_scope": RefusalCategory.WRONG_SCOPE,
    "already_done": RefusalCategory.ALREADY_DONE,
    "insufficient_context": RefusalCategory.INSUFFICIENT_CONTEXT,
    "skill_mismatch": RefusalCategory.SKILL_MISMATCH,
    "time_constraint": RefusalCategory.TIME_CONSTRAINT,
    "reward_inadequate": RefusalCategory.REWARD_INADEQUATE,
    "unclear_acceptance": RefusalCategory.UNCLEAR_ACCEPTANCE,
    "duplicate_request": RefusalCategory.DUPLICATE_REQUEST,
    "privacy_concern": RefusalCategory.PRIVACY_CONCERN,
    "no_response": RefusalCategory.NO_RESPONSE,
    "expired": RefusalCategory.EXPIRY,
    "expiry": RefusalCategory.EXPIRY,
    "cancelled": RefusalCategory.SYSTEM_CANCELLED,
    "system_cancelled": RefusalCategory.SYSTEM_CANCELLED,
    # Aliases
    "reward_too_low": RefusalCategory.REWARD_INADEQUATE,
    "unclear_criteria": RefusalCategory.UNCLEAR_ACCEPTANCE,
    "duplicate": RefusalCategory.DUPLICATE_REQUEST,
    "scope": RefusalCategory.WRONG_SCOPE,
    "done": RefusalCategory.ALREADY_DONE,
    "context": RefusalCategory.INSUFFICIENT_CONTEXT,
    "skills": RefusalCategory.SKILL_MISMATCH,
    "time": RefusalCategory.TIME_CONSTRAINT,
    "reward": RefusalCategory.REWARD_INADEQUATE,
    "unclear": RefusalCategory.UNCLEAR_ACCEPTANCE,
    "dupe": RefusalCategory.DUPLICATE_REQUEST,
    "privacy": RefusalCategory.PRIVACY_CONCERN,
}

# Token-based matching: category -> required token sets
TOKEN_MATCH_RULES: dict[frozenset[str], RefusalCategory] = {
    frozenset({"wrong", "scope"}): RefusalCategory.WRONG_SCOPE,
    frozenset({"already", "done"}): RefusalCategory.ALREADY_DONE,
    frozenset({"insufficient", "context"}): RefusalCategory.INSUFFICIENT_CONTEXT,
    frozenset({"skill", "mismatch"}): RefusalCategory.SKILL_MISMATCH,
    frozenset({"time", "constraint"}): RefusalCategory.TIME_CONSTRAINT,
    frozenset({"reward", "inadequate"}): RefusalCategory.REWARD_INADEQUATE,
    frozenset({"unclear", "acceptance"}): RefusalCategory.UNCLEAR_ACCEPTANCE,
    frozenset({"duplicate", "request"}): RefusalCategory.DUPLICATE_REQUEST,
    frozenset({"privacy", "concern"}): RefusalCategory.PRIVACY_CONCERN,
}

# Routing recommendations per category
ROUTING_RECOMMENDATIONS: dict[RefusalCategory, dict] = {
    RefusalCategory.WRONG_SCOPE: {
        "adjustment": "tighten_scope",
        "reoffer_policy": "do_not_reoffer_same_contributor",
        "suppress_similar": True,
    },
    RefusalCategory.ALREADY_DONE: {
        "adjustment": "dedupe_before_reissue",
        "reoffer_policy": "do_not_reissue",
        "suppress_similar": True,
    },
    RefusalCategory.INSUFFICIENT_CONTEXT: {
        "adjustment": "improve_brief",
        "reoffer_policy": "reoffer_after_improvement",
        "suppress_similar": False,
    },
    RefusalCategory.SKILL_MISMATCH: {
        "adjustment": "update_capability_matching",
        "reoffer_policy": "reoffer_different_contributor",
        "suppress_similar": False,
    },
    RefusalCategory.TIME_CONSTRAINT: {
        "adjustment": "respect_availability_window",
        "reoffer_policy": "reoffer_after_delay",
        "suppress_similar": False,
    },
    RefusalCategory.REWARD_INADEQUATE: {
        "adjustment": "review_reward_band",
        "reoffer_policy": "reoffer_after_adjustment",
        "suppress_similar": False,
    },
    RefusalCategory.UNCLEAR_ACCEPTANCE: {
        "adjustment": "improve_brief",
        "reoffer_policy": "reoffer_after_improvement",
        "suppress_similar": False,
    },
    RefusalCategory.DUPLICATE_REQUEST: {
        "adjustment": "dedupe_before_reissue",
        "reoffer_policy": "do_not_reissue",
        "suppress_similar": True,
    },
    RefusalCategory.PRIVACY_CONCERN: {
        "adjustment": "manual_review_required",
        "reoffer_policy": "requires_reviewer_triage",
        "suppress_similar": False,
    },
    RefusalCategory.NO_RESPONSE: {
        "adjustment": "cooldown_or_reoffer_after_delay",
        "reoffer_policy": "reoffer_after_cooldown",
        "suppress_similar": False,
    },
    RefusalCategory.EXPIRY: {
        "adjustment": "check_offer_window",
        "reoffer_policy": "extend_deadline_or_reoffer",
        "suppress_similar": False,
    },
    RefusalCategory.SYSTEM_CANCELLED: {
        "adjustment": "none",
        "reoffer_policy": "system_decision",
        "suppress_similar": False,
    },
    RefusalCategory.OTHER: {
        "adjustment": "needs_label_taxonomy_review",
        "reoffer_policy": "manual_review",
        "suppress_similar": False,
    },
    RefusalCategory.UNKNOWN: {
        "adjustment": "needs_label_taxonomy_review",
        "reoffer_policy": "manual_review",
        "suppress_similar": False,
    },
}


# =============================================================================
# NOTE PRIVACY
# =============================================================================

NOTE_FORBIDDEN_PATTERNS = [
    (re.compile(r'\br[A-Za-z0-9]{24,34}\b'), "wallet_address"),
    (re.compile(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'), "email"),
    (re.compile(r'\b\d{3}[-.]?\d{3}[-.]?\d{4}\b'), "phone_number"),
]


@dataclass(frozen=True)
class NoteResult:
    """Privacy-safe note processing result."""
    text: Optional[str]
    present: bool
    truncated: bool = False
    redacted: bool = False
    redaction_reason: Optional[str] = None


def validate_note(note: Optional[str]) -> NoteResult:
    """Validate and truncate optional note. Privacy-safe enforcement."""
    if note is None or not note.strip():
        return NoteResult(text=None, present=False)

    note = note.strip()
    truncated = False

    # Truncate to max length
    if len(note) > NOTE_MAX_LENGTH:
        note = note[:NOTE_MAX_LENGTH].rsplit(" ", 1)[0] + "..."
        truncated = True

    # Check for forbidden patterns
    for pattern, reason in NOTE_FORBIDDEN_PATTERNS:
        if pattern.search(note):
            return NoteResult(
                text="[redacted: contains sensitive data]",
                present=True,
                truncated=truncated,
                redacted=True,
                redaction_reason=reason,
            )

    return NoteResult(text=note, present=True, truncated=truncated)


# =============================================================================
# INPUT CONTRACT
# =============================================================================

@dataclass(frozen=True)
class RefusalInput:
    """Input contract for refusal reason capture.

    Represents a raw task-offer termination event before normalization.
    offer_id distinguishes multiple offers of the same task to different
    contributors or re-offers after expiry.
    """
    task_id: str
    offer_id: str
    terminal_status: TerminalStatus
    source_label: Optional[str] = None
    note: Optional[str] = None
    actor_type: Optional[ActorType] = None
    occurred_at: Optional[str] = None
    captured_at: Optional[str] = None


# =============================================================================
# OUTPUT CONTRACT
# =============================================================================

@dataclass(frozen=True)
class RefusalOutput:
    """Output contract for normalized refusal reason.

    Ready for downstream task-generation analysis and routing.
    """
    task_id: str
    offer_id: str
    terminal_status: TerminalStatus
    canonical_category: RefusalCategory
    source_label: Optional[str]
    note: NoteResult
    actor_type: ActorType
    timestamp: str
    backfilled: bool = False
    backfill_source: Optional[str] = None
    mapping_rule: MappingRule = MappingRule.NO_LABEL_FALLBACK
    confidence: str = "high"


# =============================================================================
# REDUCER LOGIC
# =============================================================================

def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def infer_actor_type(terminal_status: TerminalStatus) -> ActorType:
    """Infer actor type from terminal status."""
    if terminal_status == TerminalStatus.NO_RESPONSE:
        return ActorType.SYSTEM_EXPIRY
    if terminal_status == TerminalStatus.EXPIRED:
        return ActorType.SYSTEM_EXPIRY
    if terminal_status == TerminalStatus.CANCELLED:
        return ActorType.SYSTEM_CANCEL
    return ActorType.CONTRIBUTOR


def _token_subset_match(normalized: str) -> Optional[RefusalCategory]:
    """Safe token-based matching. Requires ALL tokens in rule to be present."""
    tokens = set(normalized.split("_"))
    for required_tokens, category in TOKEN_MATCH_RULES.items():
        if required_tokens.issubset(tokens):
            return category
    return None


def resolve_category(
    terminal_status: TerminalStatus,
    source_label: Optional[str],
) -> tuple[RefusalCategory, bool, str, Optional[str], MappingRule]:
    """Resolve canonical category from terminal status and source label.

    Returns: (category, was_backfilled, confidence, backfill_source, mapping_rule)
    """
    # System-generated categories from terminal status (distinct semantics)
    if terminal_status == TerminalStatus.NO_RESPONSE:
        return RefusalCategory.NO_RESPONSE, False, "high", None, MappingRule.TERMINAL_STATUS

    if terminal_status == TerminalStatus.EXPIRED:
        # Expiry = deadline/window closure (distinct from no_response)
        if source_label:
            # Contributor may have provided a reason before expiry
            normalized = source_label.lower().strip().replace("-", "_").replace(" ", "_")
            if normalized in BACKFILL_MAP:
                return BACKFILL_MAP[normalized], True, "medium", "source_label", MappingRule.NORMALIZED_EXACT_MATCH
        return RefusalCategory.EXPIRY, False, "high", None, MappingRule.TERMINAL_STATUS

    if terminal_status == TerminalStatus.CANCELLED:
        return RefusalCategory.SYSTEM_CANCELLED, False, "high", None, MappingRule.TERMINAL_STATUS

    # Manual refusal (DECLINED) - resolve from source label
    if source_label:
        normalized = source_label.lower().strip().replace("-", "_").replace(" ", "_")

        # Exact match in backfill map
        if normalized in BACKFILL_MAP:
            return BACKFILL_MAP[normalized], True, "high", "source_label", MappingRule.NORMALIZED_EXACT_MATCH

        # Alias exact match (check if the label itself is a known alias key)
        for key, category in BACKFILL_MAP.items():
            if normalized == key:
                return category, True, "high", "source_label", MappingRule.ALIAS_EXACT_MATCH

        # Token-subset match (safe: requires all rule tokens present)
        token_match = _token_subset_match(normalized)
        if token_match:
            return token_match, True, "medium", "source_label", MappingRule.TOKEN_SUBSET_MATCH

        # Unknown label
        return RefusalCategory.OTHER, False, "low", None, MappingRule.UNKNOWN_LABEL_FALLBACK

    # No label, manually declined
    return RefusalCategory.UNKNOWN, False, "low", None, MappingRule.NO_LABEL_FALLBACK


def reduce_refusal(
    input: RefusalInput,
    now_fn: Callable[[], str] = _utc_now_iso,
) -> RefusalOutput:
    """Core reducer: normalize a raw refusal event into canonical output.

    Pure function. No side effects. No I/O. Time injection via now_fn.
    """
    category, backfilled, confidence, backfill_source, mapping_rule = resolve_category(
        input.terminal_status,
        input.source_label,
    )

    actor = input.actor_type or infer_actor_type(input.terminal_status)

    note_result = validate_note(input.note)

    # System-generated events don't require or preserve contributor notes
    if category in (RefusalCategory.NO_RESPONSE, RefusalCategory.EXPIRY, RefusalCategory.SYSTEM_CANCELLED):
        if actor in (ActorType.SYSTEM_EXPIRY, ActorType.SYSTEM_CANCEL):
            note_result = NoteResult(text=None, present=False)

    timestamp = input.captured_at or input.occurred_at or now_fn()

    return RefusalOutput(
        task_id=input.task_id,
        offer_id=input.offer_id,
        terminal_status=input.terminal_status,
        canonical_category=category,
        source_label=input.source_label,
        note=note_result,
        actor_type=actor,
        timestamp=timestamp,
        backfilled=backfilled,
        backfill_source=backfill_source,
        mapping_rule=mapping_rule,
        confidence=confidence,
    )


# =============================================================================
# EXPORT SERIALIZER
# =============================================================================

def serialize_for_export(output: RefusalOutput) -> dict:
    """Serialize refusal output for downstream task-generation analysis.

    Privacy-safe: includes note metadata for distinguishing redaction from absence.
    """
    category = output.canonical_category
    routing = ROUTING_RECOMMENDATIONS.get(category, {})

    return {
        "schema_version": SCHEMA_VERSION,
        "methodology_version": METHODOLOGY_VERSION,
        "task_id": output.task_id,
        "offer_id": output.offer_id,
        "terminal_status": output.terminal_status.value,
        "canonical_category": category.value,
        "source_label": output.source_label,
        "note": output.note.text,
        "note_meta": {
            "present": output.note.present,
            "truncated": output.note.truncated,
            "redacted": output.note.redacted,
            "redaction_reason": output.note.redaction_reason,
        },
        "actor_type": output.actor_type.value,
        "timestamp": output.timestamp,
        "backfill": {
            "backfilled": output.backfilled,
            "backfill_source": output.backfill_source,
            "mapping_rule": output.mapping_rule.value,
            "confidence": output.confidence,
        },
        "routing_signals": {
            "is_scope_issue": category in (
                RefusalCategory.WRONG_SCOPE,
                RefusalCategory.DUPLICATE_REQUEST,
            ),
            "is_capacity_issue": category in (
                RefusalCategory.TIME_CONSTRAINT,
                RefusalCategory.SKILL_MISMATCH,
            ),
            "is_design_issue": category in (
                RefusalCategory.INSUFFICIENT_CONTEXT,
                RefusalCategory.UNCLEAR_ACCEPTANCE,
                RefusalCategory.REWARD_INADEQUATE,
            ),
            "is_system_generated": category in (
                RefusalCategory.NO_RESPONSE,
                RefusalCategory.EXPIRY,
                RefusalCategory.SYSTEM_CANCELLED,
            ),
            "is_actionable": category not in (
                RefusalCategory.NO_RESPONSE,
                RefusalCategory.EXPIRY,
                RefusalCategory.SYSTEM_CANCELLED,
                RefusalCategory.OTHER,
                RefusalCategory.UNKNOWN,
            ),
        },
        "routing_recommendation": {
            "adjustment": routing.get("adjustment", "none"),
            "reoffer_policy": routing.get("reoffer_policy", "manual_review"),
            "suppress_similar": routing.get("suppress_similar", False),
        },
    }


def serialize_batch(outputs: list[RefusalOutput]) -> dict:
    """Serialize a batch of refusal outputs with summary statistics."""
    serialized = [serialize_for_export(o) for o in outputs]

    category_counts: dict[str, int] = {}
    for o in outputs:
        cat = o.canonical_category.value
        category_counts[cat] = category_counts.get(cat, 0) + 1

    return {
        "schema_version": SCHEMA_VERSION,
        "methodology_version": METHODOLOGY_VERSION,
        "export_timestamp": _utc_now_iso(),
        "total_refusals": len(outputs),
        "category_distribution": category_counts,
        "actionable_count": sum(
            1 for o in outputs
            if o.canonical_category not in (
                RefusalCategory.NO_RESPONSE,
                RefusalCategory.EXPIRY,
                RefusalCategory.SYSTEM_CANCELLED,
                RefusalCategory.OTHER,
                RefusalCategory.UNKNOWN,
            )
        ),
        "entries": serialized,
    }


# =============================================================================
# INLINE TESTS
# =============================================================================

def run_tests():
    """Inline test suite covering all required scenarios."""
    passed = 0
    failed = 0
    fixed_time = "2026-05-04T12:00:00Z"

    def now_fixed() -> str:
        return fixed_time

    def assert_eq(actual, expected, test_name):
        nonlocal passed, failed
        if actual == expected:
            passed += 1
            print(f"  PASS: {test_name}")
        else:
            failed += 1
            print(f"  FAIL: {test_name}")
            print(f"    expected: {expected}")
            print(f"    actual:   {actual}")

    def assert_true(condition, test_name):
        nonlocal passed, failed
        if condition:
            passed += 1
            print(f"  PASS: {test_name}")
        else:
            failed += 1
            print(f"  FAIL: {test_name}")

    print("=" * 60)
    print("REFUSAL REASON REDUCER - INLINE TESTS")
    print("=" * 60)

    # -------------------------------------------------------------------------
    print("\n[1] Manual refusal with known label")
    # -------------------------------------------------------------------------
    result = reduce_refusal(RefusalInput(
        task_id="task-001",
        offer_id="offer-001a",
        terminal_status=TerminalStatus.DECLINED,
        source_label="wrong_scope",
        note="Task requires Solana expertise.",
    ), now_fn=now_fixed)
    assert_eq(result.canonical_category, RefusalCategory.WRONG_SCOPE, "category = wrong_scope")
    assert_eq(result.actor_type, ActorType.CONTRIBUTOR, "actor = contributor")
    assert_eq(result.backfilled, True, "backfilled = True")
    assert_eq(result.mapping_rule, MappingRule.NORMALIZED_EXACT_MATCH, "mapping = exact")
    assert_eq(result.confidence, "high", "confidence = high")
    assert_eq(result.note.text, "Task requires Solana expertise.", "note preserved")
    assert_eq(result.note.truncated, False, "not truncated")
    assert_eq(result.note.redacted, False, "not redacted")
    assert_eq(result.offer_id, "offer-001a", "offer_id preserved")

    # -------------------------------------------------------------------------
    print("\n[2] Automatic no-response (distinct from expiry)")
    # -------------------------------------------------------------------------
    result = reduce_refusal(RefusalInput(
        task_id="task-002",
        offer_id="offer-002a",
        terminal_status=TerminalStatus.NO_RESPONSE,
    ), now_fn=now_fixed)
    assert_eq(result.canonical_category, RefusalCategory.NO_RESPONSE, "category = no_response")
    assert_eq(result.actor_type, ActorType.SYSTEM_EXPIRY, "actor = system_expiry")
    assert_eq(result.backfilled, False, "backfilled = False")
    assert_eq(result.note.present, False, "note not present (system event)")
    assert_eq(result.confidence, "high", "confidence = high")
    assert_eq(result.mapping_rule, MappingRule.TERMINAL_STATUS, "mapping = terminal_status")

    # -------------------------------------------------------------------------
    print("\n[3] Automatic expiry (distinct from no_response)")
    # -------------------------------------------------------------------------
    result = reduce_refusal(RefusalInput(
        task_id="task-003",
        offer_id="offer-003a",
        terminal_status=TerminalStatus.EXPIRED,
    ), now_fn=now_fixed)
    assert_eq(result.canonical_category, RefusalCategory.EXPIRY, "category = expiry (not no_response)")
    assert_eq(result.actor_type, ActorType.SYSTEM_EXPIRY, "actor = system_expiry")
    assert_eq(result.mapping_rule, MappingRule.TERMINAL_STATUS, "mapping = terminal_status")

    # -------------------------------------------------------------------------
    print("\n[4] Expiry with existing label (contributor declined before expiry)")
    # -------------------------------------------------------------------------
    result = reduce_refusal(RefusalInput(
        task_id="task-004",
        offer_id="offer-004a",
        terminal_status=TerminalStatus.EXPIRED,
        source_label="skill_mismatch",
    ), now_fn=now_fixed)
    assert_eq(result.canonical_category, RefusalCategory.SKILL_MISMATCH, "category from label despite expiry")
    assert_eq(result.backfilled, True, "backfilled = True")
    assert_eq(result.confidence, "medium", "confidence = medium (expired + label)")
    assert_eq(result.backfill_source, "source_label", "backfill_source = source_label")

    # -------------------------------------------------------------------------
    print("\n[5] Known-label backfill (alias)")
    # -------------------------------------------------------------------------
    result = reduce_refusal(RefusalInput(
        task_id="task-005",
        offer_id="offer-005a",
        terminal_status=TerminalStatus.DECLINED,
        source_label="dupe",
    ), now_fn=now_fixed)
    assert_eq(result.canonical_category, RefusalCategory.DUPLICATE_REQUEST, "alias 'dupe' -> duplicate_request")
    assert_eq(result.backfilled, True, "backfilled from alias")
    assert_eq(result.backfill_source, "source_label", "source = source_label")

    # -------------------------------------------------------------------------
    print("\n[6] Known-label backfill (normalized casing/spacing)")
    # -------------------------------------------------------------------------
    result = reduce_refusal(RefusalInput(
        task_id="task-006",
        offer_id="offer-006a",
        terminal_status=TerminalStatus.DECLINED,
        source_label="Reward Too Low",
    ), now_fn=now_fixed)
    assert_eq(result.canonical_category, RefusalCategory.REWARD_INADEQUATE, "'Reward Too Low' normalized")
    assert_eq(result.mapping_rule, MappingRule.NORMALIZED_EXACT_MATCH, "exact match after normalization")

    # -------------------------------------------------------------------------
    print("\n[7] Unknown-label fallback")
    # -------------------------------------------------------------------------
    result = reduce_refusal(RefusalInput(
        task_id="task-007",
        offer_id="offer-007a",
        terminal_status=TerminalStatus.DECLINED,
        source_label="vibes_off",
        note="Not feeling it.",
    ), now_fn=now_fixed)
    assert_eq(result.canonical_category, RefusalCategory.OTHER, "unknown label -> other")
    assert_eq(result.confidence, "low", "confidence = low for unknown")
    assert_eq(result.backfilled, False, "not backfilled")
    assert_eq(result.mapping_rule, MappingRule.UNKNOWN_LABEL_FALLBACK, "mapping = unknown_label_fallback")

    # -------------------------------------------------------------------------
    print("\n[8] Note truncation with metadata")
    # -------------------------------------------------------------------------
    long_note = "A" * 200
    result = reduce_refusal(RefusalInput(
        task_id="task-008",
        offer_id="offer-008a",
        terminal_status=TerminalStatus.DECLINED,
        source_label="time_constraint",
        note=long_note,
    ), now_fn=now_fixed)
    assert_true(len(result.note.text) <= NOTE_MAX_LENGTH + 3, "note truncated to max length")
    assert_true(result.note.text.endswith("..."), "truncated note ends with ellipsis")
    assert_eq(result.note.truncated, True, "note_meta.truncated = True")
    assert_eq(result.note.redacted, False, "note_meta.redacted = False")

    # -------------------------------------------------------------------------
    print("\n[9] Note privacy: wallet address redaction")
    # -------------------------------------------------------------------------
    result = reduce_refusal(RefusalInput(
        task_id="task-009",
        offer_id="offer-009a",
        terminal_status=TerminalStatus.DECLINED,
        source_label="privacy_concern",
        note="Check rDVKRNp3kWE1a1dJPYfiaR8dPfQEPoVGCx for details.",
    ), now_fn=now_fixed)
    assert_eq(result.note.text, "[redacted: contains sensitive data]", "wallet -> redacted")
    assert_eq(result.note.redacted, True, "note_meta.redacted = True")
    assert_eq(result.note.redaction_reason, "wallet_address", "reason = wallet_address")

    # -------------------------------------------------------------------------
    print("\n[10] Note privacy: email redaction")
    # -------------------------------------------------------------------------
    result = reduce_refusal(RefusalInput(
        task_id="task-010",
        offer_id="offer-010a",
        terminal_status=TerminalStatus.DECLINED,
        source_label="other",
        note="Contact me at user@example.com for details.",
    ), now_fn=now_fixed)
    assert_eq(result.note.redacted, True, "email -> redacted")
    assert_eq(result.note.redaction_reason, "email", "reason = email")

    # -------------------------------------------------------------------------
    print("\n[11] System cancellation")
    # -------------------------------------------------------------------------
    result = reduce_refusal(RefusalInput(
        task_id="task-011",
        offer_id="offer-011a",
        terminal_status=TerminalStatus.CANCELLED,
    ), now_fn=now_fixed)
    assert_eq(result.canonical_category, RefusalCategory.SYSTEM_CANCELLED, "cancelled -> system_cancelled")
    assert_eq(result.actor_type, ActorType.SYSTEM_CANCEL, "actor = system_cancel")
    assert_eq(result.note.present, False, "system event has no note")

    # -------------------------------------------------------------------------
    print("\n[12] Export serialization - structure")
    # -------------------------------------------------------------------------
    result = reduce_refusal(RefusalInput(
        task_id="task-012",
        offer_id="offer-012a",
        terminal_status=TerminalStatus.DECLINED,
        source_label="wrong_scope",
        note="AEC work, not network-related.",
    ), now_fn=now_fixed)
    exported = serialize_for_export(result)
    assert_eq(exported["schema_version"], SCHEMA_VERSION, "export has schema_version")
    assert_eq(exported["methodology_version"], METHODOLOGY_VERSION, "export has methodology_version")
    assert_eq(exported["canonical_category"], "wrong_scope", "export category is string")
    assert_eq(exported["offer_id"], "offer-012a", "export has offer_id")
    assert_eq(exported["routing_signals"]["is_scope_issue"], True, "routing: scope issue")
    assert_eq(exported["routing_signals"]["is_actionable"], True, "routing: actionable")
    assert_eq(exported["routing_recommendation"]["adjustment"], "tighten_scope", "rec: tighten_scope")
    assert_eq(exported["routing_recommendation"]["suppress_similar"], True, "rec: suppress similar")
    assert_eq(exported["note_meta"]["present"], True, "note_meta.present")
    assert_eq(exported["note_meta"]["redacted"], False, "note_meta.redacted = False")
    assert_eq(exported["backfill"]["mapping_rule"], "normalized_exact_match", "backfill.mapping_rule")

    # -------------------------------------------------------------------------
    print("\n[13] Export serialization - system event not actionable")
    # -------------------------------------------------------------------------
    result = reduce_refusal(RefusalInput(
        task_id="task-013",
        offer_id="offer-013a",
        terminal_status=TerminalStatus.NO_RESPONSE,
    ), now_fn=now_fixed)
    exported = serialize_for_export(result)
    assert_eq(exported["routing_signals"]["is_actionable"], False, "no-response not actionable")
    assert_eq(exported["routing_signals"]["is_system_generated"], True, "no-response is system")
    assert_eq(exported["routing_recommendation"]["adjustment"], "cooldown_or_reoffer_after_delay", "rec: cooldown")

    # -------------------------------------------------------------------------
    print("\n[14] Batch export with statistics")
    # -------------------------------------------------------------------------
    batch_inputs = [
        RefusalInput("b-1", "o-1", TerminalStatus.DECLINED, "wrong_scope"),
        RefusalInput("b-2", "o-2", TerminalStatus.NO_RESPONSE),
        RefusalInput("b-3", "o-3", TerminalStatus.DECLINED, "skill_mismatch"),
        RefusalInput("b-4", "o-4", TerminalStatus.EXPIRED),
        RefusalInput("b-5", "o-5", TerminalStatus.DECLINED, "already_done"),
    ]
    batch_outputs = [reduce_refusal(i, now_fn=now_fixed) for i in batch_inputs]
    batch_export = serialize_batch(batch_outputs)
    assert_eq(batch_export["total_refusals"], 5, "batch total = 5")
    assert_eq(batch_export["actionable_count"], 3, "actionable = 3")
    assert_eq(batch_export["schema_version"], SCHEMA_VERSION, "batch has schema_version")
    assert_eq(batch_export["methodology_version"], METHODOLOGY_VERSION, "batch has methodology_version")
    assert_true("category_distribution" in batch_export, "has category distribution")
    assert_true("entries" in batch_export, "has entries array")

    # -------------------------------------------------------------------------
    print("\n[15] No label, manually declined -> unknown")
    # -------------------------------------------------------------------------
    result = reduce_refusal(RefusalInput(
        task_id="task-015",
        offer_id="offer-015a",
        terminal_status=TerminalStatus.DECLINED,
    ), now_fn=now_fixed)
    assert_eq(result.canonical_category, RefusalCategory.UNKNOWN, "no label -> unknown")
    assert_eq(result.confidence, "low", "confidence = low")
    assert_eq(result.mapping_rule, MappingRule.NO_LABEL_FALLBACK, "mapping = no_label_fallback")

    # -------------------------------------------------------------------------
    print("\n[16] Token-subset match (safe partial matching)")
    # -------------------------------------------------------------------------
    result = reduce_refusal(RefusalInput(
        task_id="task-016",
        offer_id="offer-016a",
        terminal_status=TerminalStatus.DECLINED,
        source_label="wrong_scope_aec_vertical",
    ), now_fn=now_fixed)
    assert_eq(result.canonical_category, RefusalCategory.WRONG_SCOPE, "token match: wrong+scope present")
    assert_eq(result.mapping_rule, MappingRule.TOKEN_SUBSET_MATCH, "mapping = token_subset_match")
    assert_eq(result.confidence, "medium", "token match = medium confidence")

    # -------------------------------------------------------------------------
    print("\n[17] Partial-match safety: 'timebox_design_issue' != time_constraint")
    # -------------------------------------------------------------------------
    result = reduce_refusal(RefusalInput(
        task_id="task-017",
        offer_id="offer-017a",
        terminal_status=TerminalStatus.DECLINED,
        source_label="timebox_design_issue",
    ), now_fn=now_fixed)
    # "timebox" contains "time" as substring but token set is {timebox, design, issue}
    # which does NOT match {time, constraint}
    assert_true(
        result.canonical_category != RefusalCategory.TIME_CONSTRAINT,
        "'timebox_design_issue' does NOT match time_constraint"
    )
    assert_eq(result.mapping_rule, MappingRule.UNKNOWN_LABEL_FALLBACK, "falls to unknown, not false match")

    # -------------------------------------------------------------------------
    print("\n[18] Offer-level identity: same task, different offers")
    # -------------------------------------------------------------------------
    result_a = reduce_refusal(RefusalInput(
        task_id="task-018",
        offer_id="offer-018a",
        terminal_status=TerminalStatus.DECLINED,
        source_label="wrong_scope",
    ), now_fn=now_fixed)
    result_b = reduce_refusal(RefusalInput(
        task_id="task-018",
        offer_id="offer-018b",
        terminal_status=TerminalStatus.NO_RESPONSE,
    ), now_fn=now_fixed)
    assert_eq(result_a.task_id, result_b.task_id, "same task_id")
    assert_true(result_a.offer_id != result_b.offer_id, "different offer_ids")
    assert_true(result_a.canonical_category != result_b.canonical_category, "different categories")
    # Verify they serialize as separate entries
    batch = serialize_batch([result_a, result_b])
    assert_eq(len(batch["entries"]), 2, "batch has 2 separate entries")

    # -------------------------------------------------------------------------
    print("\n[19] JSON round-trip serialization")
    # -------------------------------------------------------------------------
    result = reduce_refusal(RefusalInput(
        task_id="task-019",
        offer_id="offer-019a",
        terminal_status=TerminalStatus.DECLINED,
        source_label="time_constraint",
        note="Deadline too tight.",
    ), now_fn=now_fixed)
    exported = serialize_for_export(result)
    json_str = json.dumps(exported)
    roundtrip = json.loads(json_str)
    assert_eq(roundtrip, exported, "JSON round-trip preserves all fields")

    # -------------------------------------------------------------------------
    print("\n[20] Deterministic timestamp via now_fn injection")
    # -------------------------------------------------------------------------
    result = reduce_refusal(RefusalInput(
        task_id="task-020",
        offer_id="offer-020a",
        terminal_status=TerminalStatus.DECLINED,
        source_label="scope",
    ), now_fn=now_fixed)
    assert_eq(result.timestamp, fixed_time, "timestamp from injected now_fn")

    # With explicit captured_at
    result2 = reduce_refusal(RefusalInput(
        task_id="task-020b",
        offer_id="offer-020b",
        terminal_status=TerminalStatus.DECLINED,
        source_label="scope",
        captured_at="2026-05-01T08:00:00Z",
    ), now_fn=now_fixed)
    assert_eq(result2.timestamp, "2026-05-01T08:00:00Z", "captured_at takes precedence")

    # -------------------------------------------------------------------------
    print("\n[21] Export schema stability: all required keys present")
    # -------------------------------------------------------------------------
    result = reduce_refusal(RefusalInput(
        task_id="task-021",
        offer_id="offer-021a",
        terminal_status=TerminalStatus.DECLINED,
        source_label="already_done",
    ), now_fn=now_fixed)
    exported = serialize_for_export(result)
    required_keys = {
        "schema_version", "methodology_version", "task_id", "offer_id",
        "terminal_status", "canonical_category", "source_label", "note",
        "note_meta", "actor_type", "timestamp", "backfill",
        "routing_signals", "routing_recommendation",
    }
    actual_keys = set(exported.keys())
    assert_eq(actual_keys, required_keys, "export has exactly required keys")

    # -------------------------------------------------------------------------
    # Summary
    # -------------------------------------------------------------------------
    print(f"\n{'=' * 60}")
    print(f"RESULTS: {passed} passed, {failed} failed, {passed + failed} total")
    print(f"{'=' * 60}")

    return failed == 0


# =============================================================================
# MAIN
# =============================================================================

if __name__ == "__main__":
    import sys
    success = run_tests()
    sys.exit(0 if success else 1)
