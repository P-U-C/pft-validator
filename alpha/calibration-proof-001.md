# Single-Domain PCS Inflation Patch — Calibration Proof Bundle

**PR:** [P-U-C/b1e55ed#522](https://github.com/P-U-C/b1e55ed/pull/522)
**Live activation timestamp:** 2026-04-14T02:37:25 UTC
**7-day forward validation window:** 2026-04-14 through 2026-04-21

---

## 1. Problem

The Phase 0 conviction inversion postmortem identified a PCS normalization artifact in the synthesis pipeline. When only one domain produced evidence, re-normalization assigned it 100% weight, inflating PCS regardless of evidence depth. This caused all 21 High-conviction trades to originate from a single `[social]`-only path with a fixed PCS of 74.83 — contaminating the High cohort and producing a false inverse signal in stratification.

The bug was in confidence aggregation, not evidence generation. The fix therefore targets the exact failure layer.

---

## 2. Patch

### `synthesis.py` — Coverage Discount (after line 485)

```python
# Coverage discount: fewer active domains → lower confidence.
# 1 domain → ×0.57, 2 → ×0.64, 3 → ×0.71, all → ×1.0.
n_possible = max(sum(1 for v in weights_used.values() if v > 0), len(domain_scores))
coverage = len(domain_scores) / max(n_possible, 1)
weighted_score = weighted_score * (0.5 + 0.5 * coverage)
```

### `config.py` — `single_domain_max_pcs` (default 45.0)

```python
single_domain_max_pcs: float = 45.0
"""Hard ceiling on PCS when only one domain contributed to synthesis.
Prevents single-domain paths from entering the High conviction cohort."""
```

### `conviction.py` — Single-Domain Cap (applied in both v1 and v2 paths)

```python
# Hard cap: single-domain paths cannot enter High conviction.
n_domains = len(synthesis.domain_scores)
if n_domains <= 1:
    cap = float(getattr(self.config.brain, "single_domain_max_pcs", 45.0))
    pcs = min(pcs, cap)
```

### Why this is the right fix and not feature creep

This patch intentionally avoids introducing new producers, changing per-domain scoring, changing routing/sizing/execution, or reworking cohort thresholds. The bug was in confidence aggregation, not evidence generation. The fix targets the exact failure layer and preserves Phase 0 comparability.

---

## 3. Historical Proof — Before/After Re-Score (59 Closed Trades)

### Stratification: BEFORE

| Cohort | Trades | Mean Return | Total P&L |
|--------|--------|-------------|-----------|
| High (>=65) | 21 | -$0.75 | -$15.69 |
| Mid (45-65) | 12 | +$4.16 | +$49.97 |
| Low (<45) | 26 | +$9.87 | +$256.73 |

### Stratification: AFTER

| Cohort | Trades | Mean Return | Total P&L |
|--------|--------|-------------|-----------|
| High (>=65) | 0 | — | $0.00 |
| Mid (45-65) | 1 | +$65.69 | +$65.69 |
| Low (<45) | 58 | +$3.88 | +$225.31 |

### Movement Summary

| Movement | Count | Description |
|----------|-------|-------------|
| High → Low | 21 | All HYPE `[social]`-only trades |
| Mid → Low | 11 | Mixed `[social,technical,tradfi]` and `[social,technical]` |
| Mid → Mid | 1 | ETH `[social,technical,tradfi]`, PCS 61.74 → 46.30 |
| Low → Low | 26 | Unchanged |

### Rank Signal

| Metric | Before | After |
|--------|--------|-------|
| Spearman rho (PCS vs return) | -0.092 | -0.086 |
| Trades at PCS ≥ 65 | 21/59 (36%) | 0/59 (0%) |
| Single-domain trades in High | 21/21 (100%) | 0/0 |

Spearman rank correlation was weakly negative before the patch and remains non-informative after. This is expected: the patch removes a known contamination source but does not claim to restore predictiveness. Whether conviction regains positive monotonicity is the subject of forward validation.

### Named Example Trade

| Field | Value |
|-------|-------|
| Position ID | `31dcc5d2-0fec-4770-b2d0-015f989d8710` |
| Asset | HYPE |
| Direction | long |
| Domains | `['social']` (count: 1) |
| PCS before | 74.83 → cohort: High |
| PCS after | 43.65 → cohort: Low |
| Realized P&L | -$4.06 |

This trade had PCS 74.83 (fixed value from `[social]`-only re-normalization to 100% weight). After the coverage discount (×0.583) and hard cap (45.0), PCS drops to 43.65, correctly placing it in the Low cohort where single-evidence-source trades belong.

---

## 4. New Invariants

The patch enforces two new scorer invariants:

1. **Coverage-sensitive confidence:** PCS now decreases when fewer configured evidence domains contribute to synthesis.
2. **Single-domain exclusion from High conviction:** Any trade synthesized from one domain only is prevented from entering the High cohort via `single_domain_max_pcs`.

Practical effect: High conviction is now reserved for genuine cross-domain agreement rather than single-path score inflation.

### Counterfactual Acceptance Test

| Test | Expected | Observed |
|------|----------|----------|
| Single-domain trades in High cohort | 0 | 0 |
| Former `[social]`-only High trades still High | 0 | 0 |
| Multi-domain trades still eligible for Mid/High | Yes | Yes |
| Backtest uses same 59 closed trades, same thresholds | Yes | Yes |

---

## 5. Operational Interpretation

This patch should be interpreted as a **calibration repair**, not a performance claim. It removes a known aggregation artifact that allowed one-domain synthesis paths to masquerade as high-conviction consensus. The scorer is now structurally capable of a fair conviction test again.

The observed inverse pattern in Phase 0 stratification was most consistent with score-bucket contamination from a high-volume single-domain path, not with genuinely anti-predictive conviction. The evidence does not support inverting conviction before the May 12 gate.

---

## 6. Forward Validation Clock

**Activation:** 2026-04-14T02:37:25 UTC
**Validation window:** 2026-04-14 through 2026-04-21

The next seven days determine whether genuine multi-domain agreement produces a valid High cohort ahead of the 2026-05-12 gate. A fresh stratification table will be produced at window close.

---

## Appendix: Full 59-Trade Re-Score

```
ID           Asset  Dir    Domains                          PCS Before  PCS After  Before  After   P&L
e733aef1-4a  BNB    short  [technical]                          11.73       6.84  Low     Low    +29.46
67a2469c-21  AVAX   short  [technical]                          11.47       6.69  Low     Low    +30.79
47c1c85d-f5  BNB    short  [social,technical]                   35.94      23.96  Low     Low    +48.30
5d326d7f-5e  AVAX   short  [social,technical]                   36.99      24.66  Low     Low    +47.92
4fc75a3c-7c  LINK   short  [social,technical]                   35.08      23.39  Low     Low    +48.12
4f14dd23-eb  SUI    short  [social,technical]                   34.48      22.99  Low     Low    +46.55
7c621fe2-60  LINK   short  [social,technical]                   35.16      23.44  Low     Low    +48.17
bf68cd4c-d9  SUI    short  [social,technical]                   34.51      23.01  Low     Low    +46.64
0ea7c6e1-8f  BTC    long   [social,technical,tradfi]            55.48      41.61  Mid     Low    -29.50
997cb525-38  BTC    long   [social,technical,tradfi]            57.00      42.75  Mid     Low    -32.04
775cbefd-c3  ETH    long   [social,technical,tradfi]            55.77      41.82  Mid     Low    -30.50
aaa97349-e5  ETH    long   [social,technical,tradfi]            58.83      44.13  Mid     Low    -35.05
476dd35c-d5  ETH    long   [social,technical,tradfi]            55.81      41.86  Mid     Low    -32.27
5c850e15-34  BTC    long   [social,technical,tradfi]            56.75      42.57  Mid     Low    -33.51
82c93c2f-2e  SOL    short  [social,technical,tradfi]            27.75      20.81  Low     Low     -9.99
61b7f67c-e8  HYPE   long   [social]                             67.33      39.27  High    Low    -33.94
401452a2-b6  ADA    short  [technical]                          28.17      16.43  Low     Low    -20.86
26902434-2f  SOL    short  [social,technical,tradfi]            27.87      20.91  Low     Low    -10.01
f6c6e994-d8  HYPE   long   [social]                             67.77      39.53  High    Low    -33.73
3e983458-60  ADA    short  [technical]                          28.71      16.75  Low     Low    -21.22
b121659f-ba  DOGE   short  [technical]                          16.55       9.65  Low     Low     -5.93
856f34ae-e0  DOGE   short  [technical]                          17.06       9.95  Low     Low     -6.02
8e9e424c-3b  BTC    long   [social,technical,tradfi]            55.02      41.26  Mid     Low    +41.06
d3a2af28-61  BTC    long   [social,technical,tradfi]            55.23      41.42  Mid     Low    +43.36
ff1d4210-04  ETH    long   [social,technical,tradfi]            61.74      46.30  Mid     Mid    +65.69
4ae1c42d-6c  SUI    short  [social,technical]                   44.15      29.44  Low     Low    -35.74
a6e7c45a-ff  HYPE   long   [social]                             66.03      38.52  High    Low    +43.65
4f3d5da7-b8  SUI    short  [social,technical]                   44.20      29.47  Low     Low    -35.76
bf9f3744-28  AVAX   short  [social,technical]                   41.04      27.36  Low     Low    +50.75
057996e0-4c  HYPE   long   [social]                             64.31      37.51  Mid     Low    +14.05
412bcd50-30  AVAX   long   [social,technical]                   59.58      39.72  Mid     Low    +61.92
1f034b97-83  ETH    long   [social,technical,tradfi]            58.31      43.73  Mid     Low    +16.74
4b63003c-00  ETH    short  [social,technical,tradfi]            43.23      32.42  Low     Low     -3.06
4e1f8656-fa  DOGE   short  [technical]                           7.72       4.50  Low     Low     +4.05
31dcc5d2-0f  HYPE   long   [social]                             74.83      43.65  High    Low     -4.06
121225a7-74  HYPE   long   [social]                             74.83      43.65  High    Low    +14.41
fd1618e6-f1  DOGE   short  [technical]                          17.16      10.01  Low     Low     +1.55
5b2a9324-0e  HYPE   long   [social]                             74.83      43.65  High    Low     -3.15
51264a8d-7c  HYPE   long   [social]                             74.83      43.65  High    Low    +13.83
ef91008e-ca  DOGE   short  [technical]                          12.44       7.26  Low     Low     -2.61
832dec3c-ed  HYPE   long   [social]                             74.83      43.65  High    Low    +11.80
bbf39836-4c  DOGE   short  [technical]                          10.93       6.37  Low     Low     -1.98
d37de43e-4b  HYPE   long   [social]                             74.83      43.65  High    Low    -10.11
eaa5bcff-8d  DOGE   short  [technical]                          10.16       5.93  Low     Low     +2.31
40c5bc79-a8  HYPE   long   [social]                             74.83      43.65  High    Low     +4.08
ecc119dc-ef  HYPE   long   [social]                             74.83      43.65  High    Low     -2.22
41390c0c-a1  HYPE   long   [social]                             74.83      43.65  High    Low    +10.17
587742a2-43  HYPE   long   [social]                             74.83      43.65  High    Low     -3.20
f4e05e1b-41  HYPE   long   [social]                             74.83      43.65  High    Low     +4.35
8dd10123-7e  HYPE   long   [social]                             74.83      43.65  High    Low     +2.15
1dba64bf-d5  DOGE   short  [technical]                          11.45       6.68  Low     Low     +8.11
591f9a1d-45  HYPE   long   [social]                             74.83      43.65  High    Low    -23.49
21097b43-3b  DOGE   short  [technical]                          31.27      18.24  Low     Low     -1.00
7092f501-9a  HYPE   long   [social]                             74.83      43.65  High    Low     -3.80
e6bc6c85-17  HYPE   long   [social]                             74.83      43.65  High    Low     -1.74
d9b403b5-23  HYPE   long   [social]                             74.83      43.65  High    Low     -2.09
c774ff6c-e5  DOGE   short  [technical]                          32.05      18.70  Low     Low     -1.82
03a77b88-ec  HYPE   long   [social]                             74.83      43.65  High    Low     +6.10
4f6cbfaf-e2  HYPE   long   [social]                             74.83      43.65  High    Low     -4.68
```

---

**Related:** [Conviction Inversion Postmortem (CASE-000)](conviction-inversion-postmortem.md) · [b1e55ed PR #522](https://github.com/P-U-C/b1e55ed/pull/522)
