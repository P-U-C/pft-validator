---
layout: default
title: "Privacy-Safe Validator Diversity Evidence Standard v1"
subtitle: "Scoring fixtures for distinguishing missing metadata, cloud concentration, sentry topology, and privacy-preserving non-cloud validators"
date: 2026-05-06
category: alpha
status: draft
author: Permanent Upper Class (PFT Validator)
---

# Privacy-Safe Validator Diversity Evidence Standard v1
## Scoring fixtures for distinguishing missing metadata, cloud concentration, sentry topology, and privacy-preserving non-cloud validators

**Author:** Permanent Upper Class (PFT Validator)
**Date:** 2026-05-06
**Scope:** Dynamic UNL diversity scoring methodology
**Audience:** Post Fiat validator operators, scoring-pipeline maintainers, UNL publishers

---

## Executive Summary

Post Fiat's Dynamic UNL scoring pipeline currently **conflates two distinct failure modes** under a single low-diversity penalty:

1. **Genuinely opaque infrastructure** — operator publishes nothing, no attestation path attempted, no peer reachability.
2. **Privacy-safe non-cloud infrastructure** — operator runs homelab, residential, or sentry-fronted topology and cannot publish a directly-resolvable IP without exposing residential or operational details.

Treating these cases identically produces a perverse outcome: **the validators that contribute the most genuine diversity to the network are scored as if they contributed the least.** A network crawl of 49 unique IPs on 2026-05-05 found that 46.9% of nodes run on a single provider (Hetzner) and 69.4% run on just two (Hetzner + Vultr). Of the five non-datacenter nodes on the network, every one occupies a unique ASN and a non-correlated jurisdiction — yet under the current scoring methodology the same five nodes are flagged as having unverifiable infrastructure.

This document proposes **v1 of a privacy-safe diversity evidence standard**: a taxonomy of evidence classes that allow operators to attest to diversity-relevant infrastructure properties **without** exposing residential IPs, precise physical locations, or private peer maps. Six representative validators are audited under both the current scorer's observed treatment and the proposed v1 treatment. Eight mismatch cases are converted into machine-readable fixtures (`diversity-mismatch-fixtures.json`) for use as scorer regression tests, including three adversarial fixtures that prevent the standard from rewarding unverifiable privacy claims or ignoring set-level cloud concentration.

This is not a request to adjust any individual operator's score. It is a proposal to upgrade the evidence standard the scorer uses, so that validator/AI credibility tracks measurable diversity rather than measurable transparency.

---

## 1. The Mismatch in One Number

> 46.9% Hetzner. 69.4% on two providers. 10.2% non-datacenter. The 10.2% scores lowest on diversity.

Source: network crawl of 49 unique peer IPs observed on the Post Fiat network on 2026-05-05. ASN distribution and country distribution reproduced in §2 below.

The scoring pipeline penalizes exactly the operators who diversify the network most. A correlated-failure event at Hetzner — an outage, a regulator action, a BGP misconfiguration — would degrade nearly half the network simultaneously. The five operators who insulate the network from that single point of failure are scored as having "unverifiable" infrastructure.

The mismatch is not a bug in any individual scorer prompt. It is a **gap in the evidence standard** the scorer is asked to evaluate against. The scorer can only consider what the standard tells it to consider. Today the standard says *publish your IP and ASN or be penalized*. This document proposes additions to the standard that satisfy auditability without forcing operators to choose between security and a passing score.

---

## 2. Network Concentration Snapshot

Public network crawl, 2026-05-05, 49 unique IPs observed (full crawl preserved in audit input `external-inputs/network-diversity-crawl.md`):

### ASN Distribution (top providers)

| Rank | ASN | Provider | Nodes | Share |
|------|------|----------|-------|-------|
| 1 | AS24940 | Hetzner Online GmbH (DE) | 17 | 34.7% |
| 2 | AS20473 | The Constant Company (Vultr) | 11 | 22.4% |
| 3 | AS213230 | Hetzner Online GmbH (US) | 4 | 8.2% |
| 4 | AS40021 | Contabo Inc. | 3 | 6.1% |
| 4 | AS51167 | Contabo GmbH | 3 | 6.1% |
| 6 | AS212317 | Hetzner Online GmbH (US) | 2 | 4.1% |
| 6 | AS14061 | DigitalOcean, LLC | 2 | 4.1% |
| 6 | AS204770 | Cherry Servers | 2 | 4.1% |
| 9–14 | (six ASNs, 1 node each) | mixed residential/regional | 1 each | 2.0% each |

**Hetzner across all three Hetzner ASNs: 23 nodes / 46.9%.**
**Top two providers (Hetzner + Vultr): 34 nodes / 69.4%.**

### Country Distribution

| Country | Nodes | Share |
|---------|-------|-------|
| US | 28 | 57.1% |
| DE | 9 | 18.4% |
| FI | 4 | 8.2% |
| GB | 3 | 6.1% |
| FR | 3 | 6.1% |
| CA | 1 | 2.0% |
| ES | 1 | 2.0% |
| BG | 1 | 2.0% |

### Non-Datacenter / Residential Footprint

5 of 49 nodes (10.2%) operate on non-datacenter ISPs. Each occupies a **unique ASN** and is in a **distinct country bucket from at least three of the other four**. Specific IPs and city-precision locations are deliberately omitted from this artifact; ASN class and country bucket are sufficient for the diversity argument and do not expose operator identity.

| Class | ASN class | Country bucket |
|-------|-----------|----------------|
| Residential ISP | AS-residential-1 | NA-West |
| Residential ISP | AS-residential-2 | NA-East |
| Residential ISP | AS-residential-3 | NA-Mountain |
| Residential ISP | AS-residential-4 | EU-South |
| Residential ISP | AS-residential-5 | EU-East |

These are exactly the operators most likely to be scored as "missing ASN/geolocation data" under the current pipeline despite occupying the network's most diversifying positions.

---

## 3. Six-Validator Audit Matrix

Six validators chosen as representatives of the network's ASN distribution. Operator identity, residential IPs, and city-precision locations are deliberately excluded.

| # | Validator class | ASN class | Cloud / Non-cloud | TOML/domain | Public IP | Region bucket | Current scorer "diversity" | Current "identity" | Proposed v1 effective diversity contribution |
|---|-----------------|-----------|-------------------|-------------|-----------|---------------|----------------------------|--------------------|----------------------------------------------|
| V1 | Homelab residential, single host, non-cloud | residential ISP (1 node at this ASN) | non-cloud | yes (signed) | no (VPN/sentry) | NA-West | **20** | 80 | **95** |
| V2 | Residential ISP, separate jurisdiction | residential ISP (1 node at this ASN) | non-cloud | partial | no | EU-South | **20** | 70 | **95** |
| V3 | Mainline cloud, dominant ASN | AS24940 Hetzner (17 nodes) | cloud | yes | yes | EU-Central | **80** | 90 | **55** |
| V4 | Second-largest cloud ASN | AS20473 Vultr (11 nodes) | cloud | yes | yes | mixed US | **80** | 85 | **55** |
| V5 | Mid-tier cloud | Contabo (6 nodes across two ASNs) | cloud | yes | yes | EU-Central / US | **75** | 85 | **65** |
| V6 | Lower-concentration cloud, sentry-fronted | DigitalOcean + others | cloud | yes (signed) | sentry-only | NA-East | **50** | 70 | **80** |

**Reading the matrix:** V1 and V2 are the most-diversifying nodes on the network; the current scorer ranks them last on diversity. V3 and V4 sit inside the largest concentration clusters; the current scorer ranks them highest. The proposed v1 contribution column inverts the misalignment. Per-validator transparency, identity, and reliability scores are unaffected.

The "Proposed v1 effective diversity contribution" column is the per-validator diversity score combined with set-level concentration penalties and homelab/attestation credit, as defined in §5.

---

## 4. Evidence Class Taxonomy

The following evidence classes are proposed as the v1 inputs the scorer accepts when assessing diversity. **Operators may supply any combination.** The scorer counts classes that materially establish non-correlation; classes are not summed naively.

### 4.1 Public-resolution evidence (existing)

| Class | Description | Privacy cost |
|-------|-------------|--------------|
| `asn_public` | ASN resolves cleanly from a public peer-list IP via WHOIS or stable BGP-table lookup | None for cloud; high for residential |
| `ip_resolved` | Public IP listed in peer reachability data | None for cloud; high for residential |
| `toml_domain` | Operator-controlled domain hosts xrp-ledger.toml or equivalent, with a manifest signed by the validator key | Minimal — domain is already public |

### 4.2 Privacy-safe attestation evidence (new in v1)

| Class | Description | Required signature |
|-------|-------------|--------------------|
| `homelab_attestation` | Signed message: residential / homelab class, country bucket, single-host non-cloud, ASN-when-safe | Validator key |
| `vps_sentry_topology` | Signed message: validator-host-non-public-by-design + list of sentry ASNs | Validator key |
| `region_bucket` | Continent or country-precision region. No city, no precise geo | Validator key |
| `cloud_classification` | Binary cloud / non-cloud, signed | Validator key |

### 4.3 Set-level evidence (computed by scorer, not operator-supplied)

| Class | Description |
|-------|-------------|
| `concentration_share_at_asn` | Fraction of UNL on the same ASN as this validator |
| `concentration_share_top_two_providers` | Fraction of UNL on the top two providers combined |
| `country_concentration_share` | Fraction of UNL in the same country bucket |

### 4.4 Fields that remain private

The standard explicitly does **not** require, request, or accept the following:

- Residential IP addresses (operator-side or peer-side)
- Precise physical locations (city or finer)
- Private peer maps or sentry network internals beyond ASN list
- Operator legal identity beyond what the operator chooses to publish in TOML
- ISP account-level identifiers

Any scoring pipeline that requires these to award a passing diversity score is outside the scope of this standard.

---

## 4.5 Threat Model and Non-Goals

This standard does not assume that missing infrastructure metadata means a validator is diverse. Missing data can represent legitimate privacy protection, but it can also represent misconfiguration, stale metadata, operator negligence, or deliberate concentration hiding.

The scoring goal is therefore not to reward secrecy. The goal is to distinguish cases that current observability collapses into a single "low diversity" bucket:

1. Publicly verifiable infrastructure diversity.
2. Publicly verifiable cloud / provider concentration.
3. Missing metadata with no reproducible attestation.
4. Privacy-preserving homelab or non-cloud attestation.
5. Sentry-masked or partially observable topology where the public endpoint does not fully represent validator origin.

The scorer should never award full diversity credit for unverifiable claims. It should, however, avoid treating privacy-preserving non-cloud operation as equivalent to known cloud concentration when reproducible evidence classes exist.

This artifact does not recommend manually changing any validator's score. It recommends changing the evidence model so that future scores are more reproducible, less privacy-invasive, and less biased toward easily observable cloud infrastructure.

### Typed Missingness

"Missing" is not one condition. The proposed standard splits it into seven typed cases, each with a distinct scoring treatment:

| Missingness class | Meaning | Score treatment |
|-------------------|---------|-----------------|
| `unknown_unexplained` | No ASN/geo/provider data and no attestation attempted | Penalize moderately |
| `privacy_preserving_attested` | Operator publishes a reproducible non-public or semi-public attestation | Penalize lightly; allow partial diversity credit proportional to evidence confidence |
| `sentry_masked` | Public endpoint is not the validator origin; sentry topology declared | Score endpoint separately from origin |
| `stale_metadata` | TOML / domain / scorer data appears outdated past a freshness window | Mark stale; do not infer diversity in either direction |
| `known_cloud_concentration` | Public data maps to dominant provider / ASN bucket | Penalize at the set level |
| `known_non_cloud_public` | Publicly observable non-datacenter / non-cloud classification | Award diversity credit |
| `unreachable_or_unverifiable` | Validator cannot be publicly resolved or checked, no attestation path attempted | Penalize more heavily |

This typed table replaces a single `missing_infra_data` flag in the current scorer. **Unavailable is a first-class value, not a failed lookup.**

---

### 5.1 Per-validator diversity contribution

```
per_validator_diversity =
    base_evidence_score
    + homelab_credit (if homelab_attestation verified)
    + sentry_credit (if vps_sentry_topology verified)
    - unverifiable_penalty (if no attestation path attempted AND no public resolution)
```

`base_evidence_score` is awarded equally for `asn_public` resolution OR a verified `homelab_attestation` / `vps_sentry_topology`. **Public-cloud-IP transparency and signed-non-cloud attestation are treated as equivalent evidence classes** for the purpose of establishing that the validator's infrastructure is real and identifiable to the scorer.

### 5.2 Set-level concentration penalty

```
set_concentration_penalty =
    -alpha * (concentration_share_at_asn - 0.25)   if share > 0.25, else 0
    -beta  * (concentration_share_top_two_providers - 0.50)  if share > 0.50, else 0
    -gamma * (country_concentration_share - 0.50)  if share > 0.50, else 0
```

The penalty is applied to **the network-level diversity score** and is reflected proportionally in each cloud-concentrated validator's effective contribution. It does **not** penalize the per-validator transparency, identity, or reliability scores — those measure different properties.

### 5.3 Homelab / non-cloud credit

```
homelab_credit =
    +delta if cloud_classification = non-cloud AND ASN appears <=1 time in UNL
    +epsilon * (1 - country_concentration_share)
        if country_bucket appears in <50% of UNL
```

Magnitudes (`alpha, beta, gamma, delta, epsilon`) are scorer-governance parameters, not specified by this standard. The standard prescribes only the **shape** of the function and the **ordering invariants** (§5.4).

### 5.4 Required ordering invariants

A scoring pipeline conformant with this standard must satisfy, for any UNL configuration:

1. A validator with `homelab_attestation` verified and unique-ASN-bucket scores **strictly higher** on effective diversity contribution than a validator inside the largest ASN cluster.
2. A validator with no attestation attempted scores **strictly lower** than a validator with `homelab_attestation` verified, even if the unattested validator has a public IP in a concentrated ASN.
3. Two validators with public IPs in the same dominant ASN have **diminishing** effective diversity contribution as that ASN's UNL share grows.
4. Adding a validator from a previously-unrepresented country bucket increases the network-level diversity score.

Fixtures `F1`–`F5` in `diversity-mismatch-fixtures.json` encode these invariants as test cases.

### 5.5 What this standard does NOT do

- It does not bypass identity, reliability, software-version, or consensus checks. Those are independent axes.
- It does not award diversity credit for unverifiable claims. Every privacy-safe class requires a signature from the validator key.
- It does not require any operator to migrate hosting, change topology, or expose private infrastructure.
- It does not prescribe absolute score values. Calibration is governance.

---

## 6. Mismatch Fixtures

### How to use these fixtures

A scorer implementation should load `diversity-mismatch-fixtures.json`, compute its proposed diversity treatment for each fixture input, and assert that the resulting ordering satisfies `test_invariants`. The fixture values are illustrative; the **required behavior is the ordering**. Privacy-safe attested non-cloud validators must not be ranked below known cloud-concentrated validators merely because cloud infrastructure exposes more public metadata. Pass/fail is determined entirely by the invariants list, not by absolute score equality with the example numbers.

Eight reusable fixtures are published as `diversity-mismatch-fixtures.json` alongside this artifact. Each fixture pairs an `input` (observable validator metadata under the v1 evidence taxonomy) with a `current_scorer_observed` snapshot and a `proposed_scorer_v1` treatment, plus rationale and a `guard_action` keyword for scorer implementations.

| ID | Case class | Summary |
|----|------------|---------|
| F1 | `verified-public` | Cloud validator inside a 46.9% ASN concentration. Per-validator score high, set-level contribution reduced. |
| F2 | `unverifiable-missing` | No attestation attempted, no public IP. Penalty correctly applies under both current and v1. |
| F3 | `privacy-safe-homelab` | Non-cloud / homelab operator with signed attestation. **The mismatch case.** Current scorer treats this identically to F2; v1 awards highest effective diversity contribution. |
| F4 | `cloud-concentration` | Multiple verified-public validators on same ASN. Per-validator scores fine, set-level penalty applied. |
| F5 | `partial-evidence` | Sentry topology operator with attestation. Current scorer reads as "partial transparency"; v1 treats sentry-with-attestation as a recognized operational class. |
| F6 | `privacy_claim_without_reproducible_attestation` | Operator claims non-cloud / homelab class but has not signed an attestation. **Adversarial.** Prevents "trust me, I'm homelab" credit. Treatment sits between F2 and F3, closer to F2. |
| F7 | `individually_valid_but_set_concentrated` | Fully verified public validator inside a top-2-provider bucket. **Adversarial.** Tests that per-validator scoring does not mask set-level concentration risk. |
| F8 | `sentry_masked_validator_origin` | Sentry / relay endpoint with private validator origin. **Adversarial.** Tests that sentry ASN is not falsely equated with validator custody location. Endpoint and origin are scored separately. |

Test invariants encoded in the JSON:

- `F1.effective_diversity_contribution < F3.effective_diversity_contribution`
- `F3.effective_diversity_contribution > F2.effective_diversity_contribution + 20`
- `F4.set_concentration_penalty < 0`
- `F5.effective_diversity_contribution > current_scorer_observed.diversity`
- `F6.effective_diversity_contribution < F3.effective_diversity_contribution` and `F6 > F2`
- `F7.set_level_adjustment < 0` and `F7.per_validator_score > F7.effective_diversity_contribution`
- `F8.public_endpoint_score != F8.origin_score_partial`
- `F8.effective_diversity_contribution > F8.current_scorer_observed.diversity`

These are minimum-bar invariants. A v1-conformant scorer is free to choose any specific magnitudes consistent with the ordering. F6, F7, and F8 are explicitly adversarial: they test that the standard does not collapse into "always credit the privacy-preserving claim" or "always credit the well-documented validator."

---

## 7. Scoring Pipeline Output Sample (Source of Mismatch Signal)

The following JSON shape is observed in the current Post Fiat Dynamic UNL scoring pipeline (private bot output, sample posted publicly to `#validator-ops` on 2026-05-05). Operator pubkey and master key are anonymized here:

```json
{
  "score": 72,
  "identity": 80,
  "software": 100,
  "consensus": 95,
  "diversity": 20,
  "reliability": 75,
  "reasoning": "Strong consensus and verified domain, but missing ASN/geolocation data prevents diversity assessment and raises operational uncertainty. The lack of IP resolution is a significant penalty for infrastructure transparency.",
  "master_key": "[anonymized]"
}
```

The `reasoning` field correctly identifies the scorer's input limitation: **the absence of an IP-to-ASN resolution**. The proposed v1 standard supplies an alternative input — signed attestation — that satisfies the underlying transparency requirement (knowing that the validator's infrastructure is real, classifiable, and non-correlated with peers) without forcing the operator to expose what the standard explicitly leaves private.

---

## 8. Adoption Path

This standard is non-blocking: it can be adopted incrementally without breaking existing scorer behavior on operators who continue to use `asn_public` + `ip_resolved` evidence classes alone.

1. **Scorer prompt update** — accept `homelab_attestation` and `vps_sentry_topology` evidence classes as inputs equivalent to `asn_public` for diversity assessment. Run the published fixtures (`diversity-mismatch-fixtures.json`) as regression tests.
2. **Operator-side spec** — publish the signed-attestation message format. Validators sign and host alongside their TOML.
3. **Set-level concentration warnings** — surface ASN / country concentration shares as a network-level field independent of per-validator scores. This already produces value before any per-validator change ships.
4. **Calibration governance** — magnitude parameters (`alpha, beta, gamma, delta, epsilon`) chosen by UNL publisher governance; ordering invariants preserved across calibrations.

### 8.1 Minimum Viable Scorer Patch

A first implementation does not need private verification, complex cryptographic attestations, or new operator tooling. It can ship with three changes alone:

1. **Replace** the single `missing_infra_data` bucket with **typed missingness**:
   - `unknown_unexplained`
   - `privacy_attested`
   - `sentry_masked`
   - `stale_or_unreachable`
2. **Add** a separate `evidence_confidence` field so privacy-safe claims receive partial credit without being treated as fully public proof. Confidence is monotonic in the number of independently verifiable evidence classes a validator publishes.
3. **Move** provider / ASN concentration to a **set-level penalty** so that a well-documented validator inside a dominant provider bucket does not automatically outrank a privacy-preserving non-cloud validator.

These three changes are sufficient to invert the F1 ↔ F3 mismatch in the published fixtures and surface the 46.9% Hetzner concentration as a network-level signal, without touching identity, reliability, software-version, or consensus scoring.

---

## 9. References

- Network crawl input: ASN/country distribution from 49 unique IPs observed 2026-05-05 (audit input, this task folder)
- Post Fiat Dynamic UNL scoring pipeline output sample: private bot, 2026-05-05 (audit input, anonymized excerpt §7)
- XRPL Validator Operations Guide — sentry topology pattern reference: <https://xrpl.org/run-rippled-as-a-validator.html>
- Post Fiat task: `04e916bb-fe90-4c22-90a6-1ca9ba0099ed`

## Appendix: Machine-Readable Fixtures

The full JSON fixtures referenced in §6 are published at `diversity-mismatch-fixtures.json` adjacent to this document. Schema version `1.0.0`. Spec version reference `validator-diversity-evidence-standard.v1`.
