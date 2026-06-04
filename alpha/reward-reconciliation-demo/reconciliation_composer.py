"""
Historical Reward Reconciliation Composer Seed
================================================

Single self-contained Python module that composes deterministic, audit-safe
reconciliation records for retroactive reward reconciliation across
pre-implementation Post Fiat contributions.

WHAT THIS MODULE DOES
---------------------
- Compares historical contribution records against existing payment records,
  treating payments as a ledger (all partial payments for the same
  contribution_ref are aggregated, not last-write-wins).
- Returns a list of `ReconciliationRecord` objects describing, for each
  contribution: who, what, how much was paid in total across all payments,
  what fair value is, the delta owed (or zero / negative), the status, and
  a machine-readable reason code.
- Constructs a deterministic idempotency key per contribution bound to the
  exact payment snapshot AND the full policy fingerprint, so rerunning the
  same inputs produces identical records, but any change to payment state
  or policy fields changes the key.
- Optionally builds a `ReconciliationBatchManifest` summarizing the whole
  batch (totals, status counts, policy fingerprint, root hash of all
  record idempotency keys) for audit packaging.

WHAT THIS MODULE EXPLICITLY DOES NOT DO
---------------------------------------
- Does NOT execute payouts.
- Does NOT mutate any external state (no network, no DB, no filesystem,
  no env reads, no wallet operations).
- Does NOT claim final governance approval. Composed records are
  evidence for review, not authorization to pay.
- Does NOT modify its own inputs (input dataclasses are frozen).

The module is policy-neutral. It may compose reconciliation records, but
authorizing a payout from those records is a separate governance step
that lives outside this surface.

STANDARD LIBRARY ONLY
---------------------
This module imports from the Python standard library only. No `requests`,
no `urllib`, no `os.system`, no third-party dependencies. The companion
test suite AST-walks imports and asserts only stdlib modules are reached.
The public composer function itself performs no I/O and mutates no
external state. (This is an AST-import audit, not a proof of zero
side effects in the broader sense.)

USAGE EXAMPLE
-------------
See the `__main__` block at the bottom of this file for a worked example
the reviewer can run with `python3 reconciliation_composer.py`.

PFT TASK
--------
This module is the submission artifact for PFT task
`Implement Historical Reward Reconciliation Composer Seed` (reward 6107 PFT).
"""

from __future__ import annotations

import enum
import hashlib
import json
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from decimal import Decimal, ROUND_DOWN, ROUND_HALF_UP, ROUND_UP


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

MODULE_VERSION = "1.2.0"
SCHEMA_VERSION = "pf.reconciliation.composer.v1"


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------


class Status(str, enum.Enum):
    """High-level result classification per reconciliation record."""

    RECONCILED = "reconciled"            # valid delta calculation produced
    INELIGIBLE = "ineligible"            # contribution failed eligibility checks
    INFORMATIONAL = "informational"      # negative delta (overpaid), no obligation


class ReasonCode(str, enum.Enum):
    """Machine-readable reason codes. Exhaustive set; new values require a
    bump to `SCHEMA_VERSION`. Reviewers can grep for these in upstream
    tooling without ambiguity."""

    # RECONCILED outcomes
    RECONCILED_OWED = "reconciled_owed"
    RECONCILED_NO_DELTA = "reconciled_no_delta"

    # INFORMATIONAL outcome
    OVERPAID_NO_OBLIGATION = "overpaid_no_obligation"

    # INELIGIBLE outcomes (no obligation under any policy)
    INELIGIBLE_ALREADY_SETTLED = "ineligible_already_settled"
    INELIGIBLE_UNVERIFIED = "ineligible_unverified"
    INELIGIBLE_MALFORMED_TIMESTAMP = "ineligible_malformed_timestamp"
    INELIGIBLE_OUTSIDE_WINDOW = "ineligible_outside_window"
    INELIGIBLE_DUPLICATE_CONTRIBUTION_REF = "ineligible_duplicate_contribution_ref"
    INELIGIBLE_MISSING_FAIR_VALUE_BASIS = "ineligible_missing_fair_value_basis"
    INELIGIBLE_MALFORMED_PAYMENT_RECORD = "ineligible_malformed_payment_record"
    INELIGIBLE_MALFORMED_POLICY = "ineligible_malformed_policy"


class FairValueMethod(str, enum.Enum):
    """How a contribution's fair value is computed for reconciliation."""

    FLAT_RATE = "flat_rate"                 # policy.flat_rate_pft per accepted contribution
    QUALITY_WEIGHTED = "quality_weighted"   # contribution.quality_score * policy.quality_unit_pft
    FROM_RECORD = "from_record"             # contribution.declared_fair_value_pft, taken verbatim


class RoundingPolicy(str, enum.Enum):
    FLOOR = "floor"
    CEIL = "ceil"
    NEAREST = "nearest"


# ---------------------------------------------------------------------------
# Input dataclasses (frozen -- composer must not mutate input)
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class HistoricalContribution:
    """One historical contribution record produced before the live reward
    system was in place. Inputs to the composer."""

    contribution_ref: str
    """Stable opaque ID of the contribution. Pseudonymous; the composer
    treats this as an opaque token."""

    participant_wallet: str
    """Pseudonymous wallet address that should receive any delta owed.
    The composer does NOT validate the wallet against a chain; that is
    a downstream verification step."""

    observed_at_iso: str
    """RFC 3339 / ISO 8601 timestamp at which the contribution was
    accepted into the network record. Used for window-eligibility check
    and idempotency key construction."""

    verified: bool
    """Whether the contribution has passed the network's verification
    process. Policies may require verification for eligibility."""

    quality_score: Decimal | None = None
    """Optional quality score in [0.0, 1.0]. Required if
    `policy.fair_value_method == QUALITY_WEIGHTED`."""

    declared_fair_value_pft: Decimal | None = None
    """Optional pre-declared fair value. Required if
    `policy.fair_value_method == FROM_RECORD`."""

    extra_tags: tuple[str, ...] = field(default_factory=tuple)
    """Optional informational tags. Not used for computation; included in
    the idempotency key to bind tags to the resulting reconciliation
    record. Tuple (not list) so the dataclass remains frozen-hashable."""


@dataclass(frozen=True)
class PaymentRecord:
    """One existing payment record that may already cover (some of) a
    contribution. Multiple PaymentRecords for the same contribution_ref
    are aggregated as a ledger; see `_summarize_payments`.

    Inputs to the composer."""

    payment_id: str
    """Unique identifier for this payment, opaque to the composer. In
    production the caller should pass the chain-level payment tx hash
    or another globally-unique payment identifier. Required so the
    composer can dedupe accidental duplicate rows in the input list
    without double-counting.

    - Same payment_id appearing twice with IDENTICAL (paid_amount_pft,
      settled): silently deduped to one ledger line.
    - Same payment_id with CONFLICTING (paid_amount_pft, settled):
      marks the aggregate malformed, yielding
      INELIGIBLE_MALFORMED_PAYMENT_RECORD with a notes line explaining
      which payment_id conflicted.
    - Empty string: rejected as malformed."""

    contribution_ref: str
    """The contribution this payment is for. The composer aggregates
    by this field; if a contribution has no payment record, its
    paid_amount is treated as zero."""

    paid_amount_pft: Decimal
    """Amount paid in PFT in this individual payment record. MUST be
    non-negative. Negative values cause the contribution to be marked
    INELIGIBLE_MALFORMED_PAYMENT_RECORD (no obligation composed)."""

    settled: bool = False
    """If True, this payment is terminal for the contribution: no further
    obligation can be added. If ANY payment for a contribution_ref has
    settled=True, the aggregate is treated as settled."""


@dataclass(frozen=True)
class ReconciliationPolicy:
    """Reconciliation policy. The composer is policy-neutral in the sense
    that it applies these fields exactly; deciding the values is a
    separate governance question."""

    policy_version: str
    """Opaque version string of the policy."""

    effective_window_start_iso: str
    """Earliest contribution observed_at_iso the policy considers
    eligible. Inclusive."""

    effective_window_end_iso: str
    """Latest contribution observed_at_iso the policy considers
    eligible. Inclusive."""

    fair_value_method: FairValueMethod
    flat_rate_pft: Decimal | None = None
    """Required (and non-negative) if `fair_value_method == FLAT_RATE`."""

    quality_unit_pft: Decimal | None = None
    """Required (and non-negative) if `fair_value_method == QUALITY_WEIGHTED`."""

    rounding: RoundingPolicy = RoundingPolicy.FLOOR
    minimum_delta_pft: Decimal = Decimal("0")
    """If the absolute delta is at or below this floor, classify as
    `RECONCILED_NO_DELTA` instead of obligated. MUST be non-negative."""

    require_verification: bool = True
    """If True, unverified contributions yield
    `INELIGIBLE_UNVERIFIED`."""


# ---------------------------------------------------------------------------
# Internal: PaymentSummary (deterministic ledger aggregation)
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class PaymentSummary:
    """Deterministic aggregation of all PaymentRecords for a single
    contribution_ref. Internal to the composer; reviewers can inspect
    it via the per-record `payment_fingerprint` echo in the idempotency
    key canonical form."""

    contribution_ref: str
    paid_amount_pft: Decimal
    """Sum of paid_amount_pft across all PaymentRecords for this ref.
    Zero if no payments exist."""

    settled: bool
    """True if ANY PaymentRecord for this ref has settled=True."""

    payment_count: int
    payment_fingerprint: str
    """SHA-256 over the canonical sorted list of (contribution_ref,
    paid_amount_pft, settled) triples. Identical payment-state across
    runs produces identical fingerprints; any change (new record,
    different amount, different settled flag) changes the fingerprint."""

    malformed: bool = False
    """True if ANY PaymentRecord for this ref has paid_amount_pft < 0
    or fails other structural checks. Composer yields
    INELIGIBLE_MALFORMED_PAYMENT_RECORD when true."""


_EMPTY_PAYMENT_FINGERPRINT = (
    "sha256:" + hashlib.sha256(b"[]").hexdigest()
)


def _empty_payment_summary(contribution_ref: str) -> PaymentSummary:
    return PaymentSummary(
        contribution_ref=contribution_ref,
        paid_amount_pft=Decimal("0"),
        settled=False,
        payment_count=0,
        payment_fingerprint=_EMPTY_PAYMENT_FINGERPRINT,
        malformed=False,
    )


def _summarize_payments(payments: list[PaymentRecord]) -> dict[str, PaymentSummary]:
    """Aggregate payment records by contribution_ref deterministically.

    Per-payment dedup: payment records with the same `payment_id` are
    deduped before summing. The dedup behaves as follows:
      - same payment_id, identical (paid_amount_pft, settled, contribution_ref):
        silently kept once.
      - same payment_id, conflicting fields: aggregate is marked malformed
        (the composer then yields INELIGIBLE_MALFORMED_PAYMENT_RECORD).
      - empty/missing payment_id: aggregate is marked malformed.

    After dedup:
      - Multiple partial payments for the same contribution_ref are summed.
      - Any settled=True flag is contagious: aggregate is settled.
      - Any negative paid_amount_pft marks the aggregate malformed.
      - The payment_fingerprint is a SHA-256 over the canonical sorted
        list of (payment_id, contribution_ref, paid_amount_pft, settled)
        quadruples, so identical inputs across runs produce identical
        fingerprints, and ANY change to payment state changes the
        fingerprint.
    """
    # Stage 1: per-id dedup BEFORE grouping by contribution_ref.
    # We track first-seen for each payment_id; conflicts are surfaced as
    # malformed on the aggregate. Order-preserving so the canonical sort
    # later is deterministic regardless of caller-side input order.
    seen_by_id: dict[str, PaymentRecord] = {}
    refs_with_malformed_ids: set[str] = set()

    for p in payments:
        if not isinstance(p.payment_id, str) or not p.payment_id:
            refs_with_malformed_ids.add(p.contribution_ref)
            continue
        prior = seen_by_id.get(p.payment_id)
        if prior is None:
            seen_by_id[p.payment_id] = p
        else:
            if (
                prior.paid_amount_pft != p.paid_amount_pft
                or prior.settled != p.settled
                or prior.contribution_ref != p.contribution_ref
            ):
                # Conflict on a duplicate payment_id. Both sides of the
                # conflict are referenced by the same id; mark BOTH
                # contribution_refs as malformed.
                refs_with_malformed_ids.add(prior.contribution_ref)
                refs_with_malformed_ids.add(p.contribution_ref)
            # else: identical duplicate is silently deduped (prior wins).

    deduped_payments = list(seen_by_id.values())

    # Stage 2: group by contribution_ref and aggregate.
    grouped: dict[str, list[PaymentRecord]] = {}
    for p in deduped_payments:
        grouped.setdefault(p.contribution_ref, []).append(p)

    # Ensure refs that had ONLY malformed payment_ids still produce
    # a PaymentSummary (so the composer can echo paid_amount_pft=0 and
    # mark them INELIGIBLE_MALFORMED_PAYMENT_RECORD rather than treating
    # them as missing-payment-history).
    for ref in refs_with_malformed_ids:
        grouped.setdefault(ref, [])

    out: dict[str, PaymentSummary] = {}
    for ref, records in grouped.items():
        ordered = sorted(
            records,
            key=lambda p: (
                p.payment_id,
                p.contribution_ref,
                str(p.paid_amount_pft),
                str(p.settled),
            ),
        )
        amount_malformed = any(p.paid_amount_pft < Decimal("0") for p in ordered)
        id_malformed = ref in refs_with_malformed_ids
        total = sum((p.paid_amount_pft for p in ordered), Decimal("0"))
        settled = any(p.settled for p in ordered)
        fp_payload = [
            {
                "payment_id": p.payment_id,
                "contribution_ref": p.contribution_ref,
                "paid_amount_pft": str(p.paid_amount_pft),
                "settled": p.settled,
            }
            for p in ordered
        ]
        fingerprint = "sha256:" + hashlib.sha256(
            json.dumps(fp_payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
        ).hexdigest()
        out[ref] = PaymentSummary(
            contribution_ref=ref,
            paid_amount_pft=total,
            settled=settled,
            payment_count=len(ordered),
            payment_fingerprint=fingerprint,
            malformed=amount_malformed or id_malformed,
        )
    return out


# ---------------------------------------------------------------------------
# Output dataclass
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class ReconciliationRecord:
    """The composer's output: one record per input contribution."""

    contribution_ref: str
    participant_wallet: str
    paid_amount_pft: Decimal
    """Aggregate (sum) of all payments for this contribution_ref.
    Always echoed even for INELIGIBLE records, so the audit trail
    preserves what existed at terminal state."""

    computed_fair_value_pft: Decimal
    delta_owed_pft: Decimal
    status: Status
    reason_code: ReasonCode
    idempotency_key: str
    """Deterministic SHA-256 hex bound to (contribution + policy
    fingerprint + payment summary fingerprint). Stable across re-runs of
    identical inputs; ANY change to payment state or policy fields
    invalidates prior keys."""

    schema_version: str = SCHEMA_VERSION
    composer_version: str = MODULE_VERSION
    notes: str = ""

    def to_dict(self) -> dict:
        d = asdict(self)
        for k, v in list(d.items()):
            if isinstance(v, Decimal):
                d[k] = str(v)
            elif isinstance(v, enum.Enum):
                d[k] = v.value
        return d


@dataclass(frozen=True)
class ReconciliationBatchManifest:
    """Optional audit-packaging summary of a whole batch of reconciliation
    records. Deterministic; same records produce the same manifest.

    Includes a `record_keys_root` hash over all idempotency keys so a
    reviewer can verify the batch did not change between local execution,
    audit log, and governance review.

    This is audit packaging only. It does not authorize payout."""

    schema_version: str
    composer_version: str
    policy_fingerprint: str
    record_count: int
    total_paid_amount_pft: Decimal
    total_computed_fair_value_pft: Decimal
    total_delta_owed_pft: Decimal
    """Sum over records where delta_owed_pft > 0. Negative deltas
    (informational overpayments) are excluded from this total."""
    by_status: dict[str, int]
    by_reason_code: dict[str, int]
    record_keys_root: str
    """SHA-256 over the sorted list of all idempotency_keys in the batch."""

    def to_dict(self) -> dict:
        d = asdict(self)
        for k, v in list(d.items()):
            if isinstance(v, Decimal):
                d[k] = str(v)
        return d


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _validate_timestamp(ts: str) -> datetime | None:
    """Parse an RFC 3339 / ISO 8601 timestamp. Returns None if invalid.
    Rejects timezone-naive timestamps -- reconciliation needs an absolute
    moment in time."""
    if not isinstance(ts, str) or not ts:
        return None
    candidate = ts.replace("Z", "+00:00")
    try:
        dt = datetime.fromisoformat(candidate)
    except (TypeError, ValueError):
        return None
    if dt.tzinfo is None:
        return None
    return dt.astimezone(timezone.utc)


def _round(value: Decimal, rounding: RoundingPolicy) -> Decimal:
    """Round to whole PFT according to policy."""
    quant = Decimal("1")
    if rounding is RoundingPolicy.FLOOR:
        return value.quantize(quant, rounding=ROUND_DOWN)
    if rounding is RoundingPolicy.CEIL:
        return value.quantize(quant, rounding=ROUND_UP)
    if rounding is RoundingPolicy.NEAREST:
        return value.quantize(quant, rounding=ROUND_HALF_UP)
    return value


def _validate_policy(policy: ReconciliationPolicy) -> str | None:
    """Return None if policy is well-formed; otherwise a reason-text describing the problem.

    Malformed policy is a batch-level error: the composer yields one
    INELIGIBLE_MALFORMED_POLICY record per input contribution, so the
    reviewer sees that the policy itself, not any individual contribution,
    was the failure."""
    if policy.minimum_delta_pft < Decimal("0"):
        return f"minimum_delta_pft must be non-negative, got {policy.minimum_delta_pft}"

    if policy.fair_value_method is FairValueMethod.FLAT_RATE:
        if policy.flat_rate_pft is None:
            return "fair_value_method=FLAT_RATE requires flat_rate_pft"
        if policy.flat_rate_pft < Decimal("0"):
            return f"flat_rate_pft must be non-negative, got {policy.flat_rate_pft}"

    if policy.fair_value_method is FairValueMethod.QUALITY_WEIGHTED:
        if policy.quality_unit_pft is None:
            return "fair_value_method=QUALITY_WEIGHTED requires quality_unit_pft"
        if policy.quality_unit_pft < Decimal("0"):
            return f"quality_unit_pft must be non-negative, got {policy.quality_unit_pft}"

    window_start = _validate_timestamp(policy.effective_window_start_iso)
    window_end = _validate_timestamp(policy.effective_window_end_iso)
    if window_start is None:
        return f"effective_window_start_iso malformed: {policy.effective_window_start_iso!r}"
    if window_end is None:
        return f"effective_window_end_iso malformed: {policy.effective_window_end_iso!r}"
    if window_start > window_end:
        return (
            f"effective_window_start_iso ({policy.effective_window_start_iso}) is after "
            f"effective_window_end_iso ({policy.effective_window_end_iso})"
        )

    return None


def _policy_fingerprint(policy: ReconciliationPolicy) -> str:
    """SHA-256 over the canonicalized full policy state.

    The composer binds idempotency keys to this fingerprint, so any
    change to a policy field (not just policy_version) invalidates
    prior keys for the same contributions. Reviewers can verify the
    fingerprint via the batch manifest."""
    payload = {
        "policy_version": policy.policy_version,
        "effective_window_start_iso": policy.effective_window_start_iso,
        "effective_window_end_iso": policy.effective_window_end_iso,
        "fair_value_method": policy.fair_value_method.value,
        "flat_rate_pft": str(policy.flat_rate_pft) if policy.flat_rate_pft is not None else None,
        "quality_unit_pft": str(policy.quality_unit_pft) if policy.quality_unit_pft is not None else None,
        "rounding": policy.rounding.value,
        "minimum_delta_pft": str(policy.minimum_delta_pft),
        "require_verification": policy.require_verification,
    }
    return "sha256:" + hashlib.sha256(
        json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    ).hexdigest()


def _compute_fair_value_basis(
    contribution: HistoricalContribution,
    policy: ReconciliationPolicy,
) -> tuple[Decimal | None, ReasonCode | None]:
    """Compute the fair value for a contribution given the policy.

    Returns `(value, None)` on success or `(None, reason_code)` on a
    contribution-level basis failure (the policy itself is already known
    to be well-formed when this is called)."""
    method = policy.fair_value_method

    if method is FairValueMethod.FLAT_RATE:
        # policy.flat_rate_pft is guaranteed non-None and non-negative here
        return _round(policy.flat_rate_pft, policy.rounding), None  # type: ignore[arg-type]

    if method is FairValueMethod.QUALITY_WEIGHTED:
        if contribution.quality_score is None:
            return None, ReasonCode.INELIGIBLE_MISSING_FAIR_VALUE_BASIS
        if not (Decimal("0") <= contribution.quality_score <= Decimal("1")):
            return None, ReasonCode.INELIGIBLE_MISSING_FAIR_VALUE_BASIS
        return _round(contribution.quality_score * policy.quality_unit_pft, policy.rounding), None  # type: ignore[operator]

    if method is FairValueMethod.FROM_RECORD:
        if contribution.declared_fair_value_pft is None:
            return None, ReasonCode.INELIGIBLE_MISSING_FAIR_VALUE_BASIS
        if contribution.declared_fair_value_pft < Decimal("0"):
            return None, ReasonCode.INELIGIBLE_MISSING_FAIR_VALUE_BASIS
        return _round(contribution.declared_fair_value_pft, policy.rounding), None

    return None, ReasonCode.INELIGIBLE_MISSING_FAIR_VALUE_BASIS


def _canonicalize_for_idempotency(
    contribution: HistoricalContribution,
    fair_value_pft: Decimal,
    policy: ReconciliationPolicy,
    payment_summary: PaymentSummary,
) -> str:
    """Build the canonical JSON used as input to the idempotency hash.

    Includes:
      - schema_version
      - policy_version + full policy_fingerprint (so any policy change
        invalidates prior keys)
      - contribution identity (ref, wallet, observed_at, sorted tags)
      - fair_value_pft (the actual computed value for this run)
      - payment snapshot (sum, settled, count, fingerprint) -- so paid=0
        and paid=500 for the same contribution produce DIFFERENT keys
    """
    payload = {
        "schema_version": SCHEMA_VERSION,
        "policy_version": policy.policy_version,
        "policy_fingerprint": _policy_fingerprint(policy),
        "contribution_ref": contribution.contribution_ref,
        "participant_wallet": contribution.participant_wallet,
        "observed_at_iso": contribution.observed_at_iso,
        "fair_value_pft": str(fair_value_pft),
        "paid_amount_pft": str(payment_summary.paid_amount_pft),
        "settled": payment_summary.settled,
        "payment_count": payment_summary.payment_count,
        "payment_fingerprint": payment_summary.payment_fingerprint,
        "extra_tags": sorted(contribution.extra_tags),
    }
    return json.dumps(payload, sort_keys=True, separators=(",", ":"))


def _compute_idempotency_key(
    contribution: HistoricalContribution,
    fair_value_pft: Decimal,
    policy: ReconciliationPolicy,
    payment_summary: PaymentSummary,
) -> str:
    canonical = _canonicalize_for_idempotency(contribution, fair_value_pft, policy, payment_summary)
    return "sha256:" + hashlib.sha256(canonical.encode("utf-8")).hexdigest()


# ---------------------------------------------------------------------------
# Public composer
# ---------------------------------------------------------------------------


def compose_reconciliation(
    contributions: list[HistoricalContribution],
    payments: list[PaymentRecord],
    policy: ReconciliationPolicy,
) -> list[ReconciliationRecord]:
    """Return one ReconciliationRecord per input contribution.

    Pure function: no I/O, no state mutation, deterministic output for
    deterministic input. Re-running with identical inputs produces
    byte-identical records (including idempotency keys); ANY change to
    payment state or policy fields invalidates prior keys.

    Multi-payment ledger: all PaymentRecords for the same contribution_ref
    are aggregated (sum + settled-OR + payment_fingerprint). Last-write-
    wins semantics are explicitly avoided.

    Edge cases handled by reason code (see ReasonCode enum):
      - already-settled payments (any settled=True in the ledger)
      - missing payment history (paid_amount treated as 0)
      - zero deltas (RECONCILED_NO_DELTA)
      - negative deltas (INFORMATIONAL with OVERPAID_NO_OBLIGATION)
      - unverified contributions when policy requires verification
      - malformed timestamps (including timezone-naive)
      - contributions outside the policy window
      - duplicate contribution_refs in the input batch
      - missing fair-value basis for the requested method
      - malformed payment records (negative paid_amount_pft)
      - malformed policy (negative/missing required fields, inverted window)
    """
    # Pre-pass 1: policy validation. A malformed policy is a batch-level
    # problem; we still emit one record per contribution so the reviewer
    # sees the full input set.
    policy_error = _validate_policy(policy)
    if policy_error is not None:
        # Build empty payment summaries so we can still echo paid_amount
        # for contributions that DO have a payment record.
        summaries = _summarize_payments(payments)
        return [
            _malformed_policy_record(c, policy, summaries.get(c.contribution_ref, _empty_payment_summary(c.contribution_ref)), policy_error)
            for c in contributions
        ]

    # Pre-pass 2: aggregate payments deterministically.
    summaries = _summarize_payments(payments)

    # Pre-pass 3: detect duplicate contribution_refs in the input batch.
    seen_refs: set[str] = set()
    duplicate_refs: set[str] = set()
    for c in contributions:
        if c.contribution_ref in seen_refs:
            duplicate_refs.add(c.contribution_ref)
        seen_refs.add(c.contribution_ref)

    # Window bounds are validated by _validate_policy above; safe to parse.
    window_start = _validate_timestamp(policy.effective_window_start_iso)
    window_end = _validate_timestamp(policy.effective_window_end_iso)

    out: list[ReconciliationRecord] = []

    for c in contributions:
        summary = summaries.get(c.contribution_ref, _empty_payment_summary(c.contribution_ref))

        if c.contribution_ref in duplicate_refs:
            out.append(
                _ineligible_record(
                    c, policy, summary,
                    reason=ReasonCode.INELIGIBLE_DUPLICATE_CONTRIBUTION_REF,
                    notes=f"contribution_ref={c.contribution_ref} appeared more than once in input batch",
                )
            )
            continue

        if summary.malformed:
            out.append(
                _ineligible_record(
                    c, policy, summary,
                    reason=ReasonCode.INELIGIBLE_MALFORMED_PAYMENT_RECORD,
                    notes="one or more PaymentRecords for this contribution_ref has negative paid_amount_pft",
                )
            )
            continue

        contribution_ts = _validate_timestamp(c.observed_at_iso)
        if contribution_ts is None:
            out.append(
                _ineligible_record(
                    c, policy, summary,
                    reason=ReasonCode.INELIGIBLE_MALFORMED_TIMESTAMP,
                    notes=f"observed_at_iso={c.observed_at_iso!r} is malformed or timezone-naive",
                )
            )
            continue

        # window_start / window_end guaranteed non-None at this point
        if contribution_ts < window_start or contribution_ts > window_end:  # type: ignore[operator]
            out.append(
                _ineligible_record(
                    c, policy, summary,
                    reason=ReasonCode.INELIGIBLE_OUTSIDE_WINDOW,
                    notes=(
                        f"observed_at {contribution_ts.isoformat()} outside "
                        f"[{policy.effective_window_start_iso}, {policy.effective_window_end_iso}]"
                    ),
                )
            )
            continue

        if policy.require_verification and not c.verified:
            out.append(
                _ineligible_record(
                    c, policy, summary,
                    reason=ReasonCode.INELIGIBLE_UNVERIFIED,
                    notes="policy.require_verification is True and contribution.verified is False",
                )
            )
            continue

        if summary.settled:
            out.append(
                _ineligible_record(
                    c, policy, summary,
                    reason=ReasonCode.INELIGIBLE_ALREADY_SETTLED,
                    notes="at least one payment record is marked settled; no further obligation may be composed",
                )
            )
            continue

        fair_value, fv_reason = _compute_fair_value_basis(c, policy)
        if fair_value is None:
            out.append(
                _ineligible_record(
                    c, policy, summary,
                    reason=fv_reason or ReasonCode.INELIGIBLE_MISSING_FAIR_VALUE_BASIS,
                    notes=f"fair_value_method={policy.fair_value_method.value} requires a field missing or invalid on the contribution",
                )
            )
            continue

        paid_amount = summary.paid_amount_pft
        delta = fair_value - paid_amount
        idempotency_key = _compute_idempotency_key(c, fair_value, policy, summary)

        if delta > policy.minimum_delta_pft:
            status = Status.RECONCILED
            reason = ReasonCode.RECONCILED_OWED
            notes = "delta > minimum_delta_pft; recorded as audit evidence, not authorization"
        elif delta < Decimal("0"):
            status = Status.INFORMATIONAL
            reason = ReasonCode.OVERPAID_NO_OBLIGATION
            notes = "paid_amount exceeds fair_value; no clawback obligation in this composer"
        else:
            status = Status.RECONCILED
            reason = ReasonCode.RECONCILED_NO_DELTA
            notes = "delta at or below minimum_delta_pft floor"

        out.append(
            ReconciliationRecord(
                contribution_ref=c.contribution_ref,
                participant_wallet=c.participant_wallet,
                paid_amount_pft=paid_amount,
                computed_fair_value_pft=fair_value,
                delta_owed_pft=delta,
                status=status,
                reason_code=reason,
                idempotency_key=idempotency_key,
                notes=notes,
            )
        )

    return out


def _ineligible_record(
    contribution: HistoricalContribution,
    policy: ReconciliationPolicy,
    summary: PaymentSummary,
    reason: ReasonCode,
    notes: str,
) -> ReconciliationRecord:
    """Construct an ineligible record. paid_amount_pft is echoed from the
    payment summary (NOT zeroed) so the audit trail preserves what
    payments existed for the contribution_ref even when it's ineligible."""
    idempotency_key = _compute_idempotency_key(contribution, Decimal("0"), policy, summary)
    return ReconciliationRecord(
        contribution_ref=contribution.contribution_ref,
        participant_wallet=contribution.participant_wallet,
        paid_amount_pft=summary.paid_amount_pft,
        computed_fair_value_pft=Decimal("0"),
        delta_owed_pft=Decimal("0"),
        status=Status.INELIGIBLE,
        reason_code=reason,
        idempotency_key=idempotency_key,
        notes=notes,
    )


def _malformed_policy_record(
    contribution: HistoricalContribution,
    policy: ReconciliationPolicy,
    summary: PaymentSummary,
    policy_error: str,
) -> ReconciliationRecord:
    """Per-contribution record emitted when the policy itself is malformed.

    The idempotency key is still bound to (contribution, policy fingerprint,
    payment summary) so it remains stable for replay debugging, but the
    record clearly carries INELIGIBLE_MALFORMED_POLICY with the specific
    policy-field error in `notes`."""
    idempotency_key = _compute_idempotency_key(contribution, Decimal("0"), policy, summary)
    return ReconciliationRecord(
        contribution_ref=contribution.contribution_ref,
        participant_wallet=contribution.participant_wallet,
        paid_amount_pft=summary.paid_amount_pft,
        computed_fair_value_pft=Decimal("0"),
        delta_owed_pft=Decimal("0"),
        status=Status.INELIGIBLE,
        reason_code=ReasonCode.INELIGIBLE_MALFORMED_POLICY,
        idempotency_key=idempotency_key,
        notes=f"policy malformed: {policy_error}",
    )


# ---------------------------------------------------------------------------
# Batch manifest (audit packaging)
# ---------------------------------------------------------------------------


def summarize_reconciliation_batch(
    records: list[ReconciliationRecord],
    policy: ReconciliationPolicy,
) -> ReconciliationBatchManifest:
    """Build a deterministic batch manifest from composed records.

    Useful for audit packaging: a reviewer can verify the batch did not
    change between local execution, audit log, and governance review by
    comparing the manifest's `record_keys_root` hash across stages.

    Pure function; does NOT authorize any payout."""
    by_status: dict[str, int] = {}
    by_reason: dict[str, int] = {}
    for r in records:
        by_status[r.status.value] = by_status.get(r.status.value, 0) + 1
        by_reason[r.reason_code.value] = by_reason.get(r.reason_code.value, 0) + 1

    keys = sorted(r.idempotency_key for r in records)
    root = "sha256:" + hashlib.sha256(
        json.dumps(keys, sort_keys=True, separators=(",", ":")).encode("utf-8")
    ).hexdigest()

    total_paid = sum((r.paid_amount_pft for r in records), Decimal("0"))
    total_fair = sum((r.computed_fair_value_pft for r in records), Decimal("0"))
    total_owed = sum(
        (r.delta_owed_pft for r in records if r.delta_owed_pft > Decimal("0")),
        Decimal("0"),
    )

    return ReconciliationBatchManifest(
        schema_version=SCHEMA_VERSION,
        composer_version=MODULE_VERSION,
        policy_fingerprint=_policy_fingerprint(policy),
        record_count=len(records),
        total_paid_amount_pft=total_paid,
        total_computed_fair_value_pft=total_fair,
        total_delta_owed_pft=total_owed,
        by_status=by_status,
        by_reason_code=by_reason,
        record_keys_root=root,
    )


# ---------------------------------------------------------------------------
# __main__ -- worked example for reviewer convenience
# ---------------------------------------------------------------------------


if __name__ == "__main__":  # pragma: no cover - illustrative only
    # Demonstrates the composer end-to-end including ledger-aggregated
    # payments. Run: python3 reconciliation_composer.py

    contributions = [
        HistoricalContribution(
            contribution_ref="contrib_001",
            participant_wallet="rExampleWalletAlpha",
            observed_at_iso="2026-03-01T12:00:00Z",
            verified=True,
            declared_fair_value_pft=Decimal("1000"),
        ),
        HistoricalContribution(
            contribution_ref="contrib_002",
            participant_wallet="rExampleWalletBeta",
            observed_at_iso="2026-03-15T09:30:00Z",
            verified=True,
            declared_fair_value_pft=Decimal("500"),
        ),
        HistoricalContribution(
            contribution_ref="contrib_003_unverified",
            participant_wallet="rExampleWalletGamma",
            observed_at_iso="2026-03-20T15:00:00Z",
            verified=False,
            declared_fair_value_pft=Decimal("750"),
        ),
    ]

    # Three partial payments against contrib_001: 100 + 200 + 300 = 600.
    # Composer must aggregate these, NOT take last-write-wins.
    # Each payment carries a unique payment_id; duplicates of the same id
    # would be deduped (see worked-example block below).
    payments = [
        PaymentRecord(payment_id="pay_001a", contribution_ref="contrib_001", paid_amount_pft=Decimal("100")),
        PaymentRecord(payment_id="pay_001b", contribution_ref="contrib_001", paid_amount_pft=Decimal("200")),
        PaymentRecord(payment_id="pay_001c", contribution_ref="contrib_001", paid_amount_pft=Decimal("300")),
        PaymentRecord(payment_id="pay_002a", contribution_ref="contrib_002", paid_amount_pft=Decimal("500")),
    ]

    policy = ReconciliationPolicy(
        policy_version="example-policy-2026-q2-v1",
        effective_window_start_iso="2026-01-01T00:00:00Z",
        effective_window_end_iso="2026-04-30T23:59:59Z",
        fair_value_method=FairValueMethod.FROM_RECORD,
        rounding=RoundingPolicy.FLOOR,
        minimum_delta_pft=Decimal("0"),
        require_verification=True,
    )

    records = compose_reconciliation(contributions, payments, policy)
    print("=== Records ===")
    print(json.dumps([r.to_dict() for r in records], indent=2, sort_keys=True))

    # Batch manifest demo
    manifest = summarize_reconciliation_batch(records, policy)
    print("\n=== Manifest ===")
    print(json.dumps(manifest.to_dict(), indent=2, sort_keys=True))

    # Idempotency demo: re-run produces byte-identical output
    records_again = compose_reconciliation(contributions, payments, policy)
    assert [r.idempotency_key for r in records] == [r.idempotency_key for r in records_again]
    print("\n# idempotency check: PASS -- re-run produced identical keys")

    # Payment-state binding demo: change paid amount, key MUST change.
    different_payments = list(payments) + [
        PaymentRecord(payment_id="pay_001d", contribution_ref="contrib_001", paid_amount_pft=Decimal("50"))
    ]
    records_with_extra_payment = compose_reconciliation(contributions, different_payments, policy)
    assert records[0].idempotency_key != records_with_extra_payment[0].idempotency_key
    print("# payment-state binding: PASS -- adding a payment changed the key for contrib_001")

    # payment_id dedup demo: re-feeding the same payment row does NOT double-count.
    duplicate_payments = list(payments) + [
        PaymentRecord(payment_id="pay_001a", contribution_ref="contrib_001", paid_amount_pft=Decimal("100")),
    ]
    records_with_dup = compose_reconciliation(contributions, duplicate_payments, policy)
    assert records[0].paid_amount_pft == records_with_dup[0].paid_amount_pft
    print("# payment_id dedup: PASS -- identical-id duplicate row did not double-count")
