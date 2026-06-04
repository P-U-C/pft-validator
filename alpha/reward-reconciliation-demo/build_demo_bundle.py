"""
Build the verifiable demo data bundle for the Public Reward Reconciliation Demo Page.

This script is the deterministic source of truth for the public page. It:

  1. Defines a PRIVACY-SAFE SYNTHETIC fixture (no real participants, no real
     wallets, no PII) that exercises the full range of the audited composer's
     outcomes (owed / no-delta / overpaid-informational / unverified /
     outside-window / already-settled / missing-payment).
  2. Runs the AUDITED Historical Reward Reconciliation Composer (the seed task
     artifact) over that fixture -- the composer is NOT reimplemented here; we
     import it verbatim and use it as the single source of truth.
  3. For every record, recomputes the exact canonical idempotency PRE-IMAGE the
     composer hashed, and self-checks that sha256(preimage) == the record's
     idempotency_key. This guarantees the public page (which re-hashes the same
     preimage in-browser via Web Crypto) will reproduce identical keys.
  4. Emits `bundle.json` -- the data inlined into the public page.

No network, no DB, no wallet, no payout. Deterministic: same fixture -> same bundle.

Run: python3 build_demo_bundle.py
"""
from __future__ import annotations

import hashlib
import json
import sys
from decimal import Decimal
from pathlib import Path

# Import the AUDITED composer verbatim (single source of truth). Location-robust so
# the SAME script reproduces the bundle in both layouts:
#   - audit task layout: composer lives in the sibling 2026-05-12 seed task dir.
#   - published layout:  composer (reconciliation_composer.py) sits next to this file.
HERE = Path(__file__).resolve().parent
_CANDIDATES = [
    HERE,
    HERE.parents[0] / "2026-05-12_implement-historical-reward-reconciliation-composer-seed",
]
for _c in _CANDIDATES:
    if (_c / "reconciliation_composer.py").exists():
        sys.path.insert(0, str(_c))
        break

import reconciliation_composer as rc  # noqa: E402


# ---------------------------------------------------------------------------
# Privacy-safe synthetic fixture
# ---------------------------------------------------------------------------
# Pseudonymous, clearly-labeled DEMO wallets. These are opaque tokens; the
# composer treats participant_wallet as an opaque string. No real participant
# data, no real addresses. Deliberately Post Fiat-native handles (NOT XRP/XRPL
# r-addresses) so the surface is not mistaken for an XRP product.

POLICY = rc.ReconciliationPolicy(
    policy_version="demo-reconciliation-policy-2026-q1-v1",
    effective_window_start_iso="2026-01-01T00:00:00Z",
    effective_window_end_iso="2026-04-30T23:59:59Z",
    fair_value_method=rc.FairValueMethod.FROM_RECORD,
    rounding=rc.RoundingPolicy.FLOOR,
    minimum_delta_pft=Decimal("0"),
    require_verification=True,
)

CONTRIBUTIONS = [
    # Owed: verified, fair 1000, paid 600 across 3 partials -> delta 400 owed.
    rc.HistoricalContribution(
        contribution_ref="demo-contrib-alpha",
        participant_wallet="demo-wallet-alpha",
        observed_at_iso="2026-03-01T12:00:00Z",
        verified=True,
        declared_fair_value_pft=Decimal("1000"),
    ),
    # No delta: verified, fair 500, paid 500 -> delta 0.
    rc.HistoricalContribution(
        contribution_ref="demo-contrib-beta",
        participant_wallet="demo-wallet-beta",
        observed_at_iso="2026-03-15T09:30:00Z",
        verified=True,
        declared_fair_value_pft=Decimal("500"),
    ),
    # Overpaid (informational): verified, fair 300, paid 450 -> delta -150, no obligation.
    rc.HistoricalContribution(
        contribution_ref="demo-contrib-gamma",
        participant_wallet="demo-wallet-gamma",
        observed_at_iso="2026-03-20T15:00:00Z",
        verified=True,
        declared_fair_value_pft=Decimal("300"),
    ),
    # Unverified -> ineligible_unverified.
    rc.HistoricalContribution(
        contribution_ref="demo-contrib-delta",
        participant_wallet="demo-wallet-delta",
        observed_at_iso="2026-03-22T11:00:00Z",
        verified=False,
        declared_fair_value_pft=Decimal("750"),
    ),
    # Outside window (observed before window start) -> ineligible_outside_window.
    rc.HistoricalContribution(
        contribution_ref="demo-contrib-epsilon",
        participant_wallet="demo-wallet-epsilon",
        observed_at_iso="2025-12-01T08:00:00Z",
        verified=True,
        declared_fair_value_pft=Decimal("600"),
    ),
    # Already settled -> ineligible_already_settled.
    rc.HistoricalContribution(
        contribution_ref="demo-contrib-zeta",
        participant_wallet="demo-wallet-zeta",
        observed_at_iso="2026-02-10T14:00:00Z",
        verified=True,
        declared_fair_value_pft=Decimal("900"),
    ),
    # Missing payment history: verified, fair 800, no payments -> delta 800 owed.
    rc.HistoricalContribution(
        contribution_ref="demo-contrib-eta",
        participant_wallet="demo-wallet-eta",
        observed_at_iso="2026-04-05T16:45:00Z",
        verified=True,
        declared_fair_value_pft=Decimal("800"),
    ),
]

PAYMENTS = [
    # alpha: three partial payments, must aggregate to 600 (ledger, not last-write-wins).
    rc.PaymentRecord(payment_id="demo-pay-alpha-1", contribution_ref="demo-contrib-alpha", paid_amount_pft=Decimal("100")),
    rc.PaymentRecord(payment_id="demo-pay-alpha-2", contribution_ref="demo-contrib-alpha", paid_amount_pft=Decimal("200")),
    rc.PaymentRecord(payment_id="demo-pay-alpha-3", contribution_ref="demo-contrib-alpha", paid_amount_pft=Decimal("300")),
    # beta: single payment 500.
    rc.PaymentRecord(payment_id="demo-pay-beta-1", contribution_ref="demo-contrib-beta", paid_amount_pft=Decimal("500")),
    # gamma: overpaid 450 vs fair 300.
    rc.PaymentRecord(payment_id="demo-pay-gamma-1", contribution_ref="demo-contrib-gamma", paid_amount_pft=Decimal("450")),
    # zeta: settled payment 900 (terminal).
    rc.PaymentRecord(payment_id="demo-pay-zeta-1", contribution_ref="demo-contrib-zeta", paid_amount_pft=Decimal("900"), settled=True),
    # eta: no payments (missing-payment edge case).
]

# Human-readable description per contribution, for the page (the "story" of each row).
WALLET_BLURB = {
    "demo-wallet-alpha": "Verified contribution, partially paid across three records; a balance remains.",
    "demo-wallet-beta": "Verified contribution, fully paid; nothing outstanding.",
    "demo-wallet-gamma": "Verified contribution, paid above fair value; recorded as informational, no clawback.",
    "demo-wallet-delta": "Contribution not yet verified; ineligible until verification clears.",
    "demo-wallet-epsilon": "Contribution observed before the policy window; ineligible under this window.",
    "demo-wallet-zeta": "Contribution already settled; terminal, no further obligation can be composed.",
    "demo-wallet-eta": "Verified contribution with no payment on record; full fair value is outstanding.",
}


def _decimal_str(v) -> str:
    return str(v)


def build_bundle() -> dict:
    records = rc.compose_reconciliation(CONTRIBUTIONS, PAYMENTS, POLICY)
    manifest = rc.summarize_reconciliation_batch(records, POLICY)

    summaries = rc._summarize_payments(PAYMENTS)
    contrib_by_ref = {c.contribution_ref: c for c in CONTRIBUTIONS}

    wallets = []
    for r in records:
        contribution = contrib_by_ref[r.contribution_ref]
        summary = summaries.get(
            r.contribution_ref, rc._empty_payment_summary(r.contribution_ref)
        )
        # Recompute the exact canonical pre-image the composer hashed for this
        # record. For RECONCILED/INFORMATIONAL the composer used the computed
        # fair value; for INELIGIBLE/MALFORMED it used Decimal("0") -- which is
        # exactly what computed_fair_value_pft holds for those, so this is faithful.
        fair_value_for_key = r.computed_fair_value_pft
        preimage = rc._canonicalize_for_idempotency(
            contribution, fair_value_for_key, POLICY, summary
        )
        # SELF-CHECK: sha256(preimage) must equal the record's idempotency_key,
        # otherwise the in-browser re-hash would diverge.
        recomputed = "sha256:" + hashlib.sha256(preimage.encode("utf-8")).hexdigest()
        assert recomputed == r.idempotency_key, (
            f"preimage self-check FAILED for {r.contribution_ref}: "
            f"{recomputed} != {r.idempotency_key}"
        )

        rec = r.to_dict()
        rec["idempotency_preimage"] = preimage
        rec["payment_count"] = summary.payment_count
        rec["blurb"] = WALLET_BLURB.get(contribution.participant_wallet, "")
        wallets.append(
            {
                "participant_wallet": contribution.participant_wallet,
                "observed_at_iso": contribution.observed_at_iso,
                "verified": contribution.verified,
                "record": rec,
            }
        )

    # Sorted keys for in-browser batch-root recomputation (matches the composer:
    # record_keys_root = sha256(json.dumps(sorted(keys), separators=(",",":")))).
    sorted_keys = sorted(r.idempotency_key for r in records)

    bundle = {
        "schema_version": rc.SCHEMA_VERSION,
        "composer_version": rc.MODULE_VERSION,
        "dataset": "synthetic privacy-safe demo fixture (no real participants or wallets)",
        "policy": {
            "policy_version": POLICY.policy_version,
            "effective_window_start_iso": POLICY.effective_window_start_iso,
            "effective_window_end_iso": POLICY.effective_window_end_iso,
            "fair_value_method": POLICY.fair_value_method.value,
            "rounding": POLICY.rounding.value,
            "minimum_delta_pft": _decimal_str(POLICY.minimum_delta_pft),
            "require_verification": POLICY.require_verification,
            "policy_fingerprint": rc._policy_fingerprint(POLICY),
        },
        "wallets": wallets,
        "manifest": {
            **manifest.to_dict(),
            "record_keys_sorted": sorted_keys,
        },
    }
    return bundle


def main() -> None:
    bundle = build_bundle()
    out = Path(__file__).resolve().parent / "bundle.json"
    out.write_text(json.dumps(bundle, indent=2, sort_keys=True) + "\n", encoding="utf-8")

    # Batch-root self-check: recompute the way the browser will and compare.
    keys = bundle["manifest"]["record_keys_sorted"]
    root_payload = json.dumps(keys, sort_keys=True, separators=(",", ":")).encode("utf-8")
    recomputed_root = "sha256:" + hashlib.sha256(root_payload).hexdigest()
    assert recomputed_root == bundle["manifest"]["record_keys_root"], "batch-root self-check FAILED"

    n = len(bundle["wallets"])
    statuses = bundle["manifest"]["by_status"]
    reasons = bundle["manifest"]["by_reason_code"]
    print(f"OK: wrote {out} ({n} demo wallets)")
    print(f"    by_status      = {statuses}")
    print(f"    by_reason_code = {reasons}")
    print(f"    total_delta_owed_pft = {bundle['manifest']['total_delta_owed_pft']} PFT")
    print(f"    record_keys_root = {bundle['manifest']['record_keys_root']}")
    print("    preimage self-checks: PASS (every idempotency_key == sha256(preimage))")
    print("    batch-root self-check: PASS")


if __name__ == "__main__":
    main()
