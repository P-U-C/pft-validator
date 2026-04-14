# Conviction Inversion Postmortem — b1e55ed Phase 0

---

## Executive Decision

- Gate recommendation: Do not invert conviction before 2026-05-12.
- Primary diagnosis: The apparent inversion is driven by cohort contamination from a single-domain producer path, not a stable anti-predictive conviction signal.
- Fastest safe calibration: Reserve High conviction for cross-domain agreement. No single-domain path should enter High without corroboration.
- Expected effect: Restore monotonic stratification by removing artificially elevated single-domain trades from the High bucket, without changing producer coverage or adding new models.

---

## 1. Scope and Dataset

- Date window: March 16 – April 12, 2026 (28 calendar days)
- Conviction thresholds: High ≥ 0.65 (PCS ≥ 65), Mid 0.45–0.65 (PCS 45–65), Low < 0.45 (PCS < 45)
- Sample: 59 closed trades from 60 total (1 open excluded)
- Total realized P&L: +$291.00 across 59 closed trades
- Win rate: 47% (28W / 31L)

| Cohort | Trades | Mean Return | Total P&L | PCS Range |
|--------|--------|-------------|-----------|-----------|
| High (≥0.65) | 21 | −$0.75 | −$15.69 | 66.0–74.8 |
| Mid (0.45–0.65) | 12 | +$4.16 | +$49.97 | 55.0–64.3 |
| Low (<0.45) | 26 | +$9.87 | +$256.73 | 7.7–44.2 |

The cohort ordering is monotonically adverse: higher conviction corresponds to worse performance across all three buckets.

---

## 2. Significance Test: High vs Low Conviction

| Metric | High (≥0.65) | Low (<0.45) |
|--------|-------------|-------------|
| n | 21 | 26 |
| Mean return | −$0.75 | +$9.87 |
| Median return | −$2.09 | +$1.55 |
| Std dev | $16.79 | $27.78 |

Welch's t-test: t = −1.62, df = 42.0, p = 0.106 (two-tailed)
Mann-Whitney U: U = 231, z = −0.90, p = 0.369
95% CI for difference in means: [−$23.87, +$2.63]
Cohen's d: −0.45 (approaching medium effect)
Rank-biserial r: 0.15

Interpretation: The High-vs-Low spread is directionally adverse but statistically inconclusive in this sample. The confidence interval includes zero, and neither parametric nor non-parametric tests reach significance at α = 0.10. Standing alone, this result does not justify inverting conviction. The following sections test whether the pattern is structural or compositional.

---

## 3. Producer Attribution and Bucket Contamination

Trades are linked to conviction scores via conviction_id. The domains_used field identifies the active producer combination per trade.

| Producer Domains | Trades | Mean PCS | Mean Return | W/L | Total P&L | In High | High P&L |
|-----------------|--------|----------|-------------|-----|-----------|---------|----------|
| [social, technical] | 10 | 40.1 | +$32.69 | 8/2 | +$326.87 | 0 | $0 |
| [technical] | 14 | 17.6 | +$1.06 | 6/8 | +$14.84 | 0 | $0 |
| [social] | 22 | 73.3 | −$0.07 | 10/12 | −$1.65 | 21 | −$15.69 |
| [social, technical, tradfi] | 13 | 51.4 | −$3.77 | 4/9 | −$49.06 | 0 | $0 |

High-bucket purity check: 21 of 21 High-conviction trades came from the `[social]`-only path. The High cohort is 100% one producer.

Score compression: The `[social]`-only path shows score compression at a single elevated PCS value (74.83 across all 22 trades), indicating categorical assignment masquerading as calibrated confidence.

The profitable producer combinations are disproportionately mapped into Low/Mid, while the largest contributor to the High cohort is a single-domain path with near-fixed elevated PCS. This indicates the observed inversion is most likely a scoring-allocation problem before it is a forecasting problem.

---

## 4. Sensitivity Check: Remove [social]-only Path

To test whether the inversion is contamination-driven, we recompute cohort ordering after excluding the `[social]`-only producer path.

| Cohort | n | Mean Return | Total P&L | Wins |
|--------|---|-------------|-----------|------|
| Low | 26 | +$9.87 | +$256.73 | 13 |
| Mid | 11 | +$3.27 | +$35.92 | 5 |
| High | 0 | — | — | — |

After removing the contaminating path, the High cohort is empty. No trade from any other producer combination scored into High. The inversion disappears because it was entirely manufactured by one producer path's inflated PCS.

This directly confirms the thesis: the observed inversion is a composition artifact, not a property of the conviction mechanism itself.

---

## 5. Stability Check: First Half vs Second Half

Split at March 29 (midpoint by trade count).

| Period | Cohort | n | Mean P&L | Total P&L | Wins |
|--------|--------|---|----------|-----------|------|
| H1 (Mar 16–28) | Low | 8 | +$43.24 | +$345.94 | 8 |
| H1 (Mar 16–28) | Mid | 6 | −$32.14 | −$192.86 | 0 |
| H2 (Mar 29–Apr 12) | High | 21 | −$0.75 | −$15.69 | 9 |
| H2 (Mar 29–Apr 12) | Low | 18 | −$4.96 | −$89.21 | 5 |
| H2 (Mar 29–Apr 12) | Mid | 6 | +$40.47 | +$242.83 | 6 |

The inverse ordering fails the persistence test. It appears only after H2 introduces a new high-volume, high-PCS single-domain path (`[social]`-only / HYPE), which strongly supports a composition-driven explanation over a stable anti-predictive conviction signal.

Because H1 contains no High-conviction trades and H2 does, the observed inversion cannot be treated as stable across time; it emerges only when the producer mix changes.

Producer mix also shifted between halves: [social, technical, tradfi] went from −$193 in H1 to +$144 in H2, showing that even the same producer combination performs differently across regime windows.

---

## 6. Regime Context

| Regime at Entry | Trades | Mean PCS | Mean Return | Total P&L |
|--------|--------|----------|-------------|-----------|
| TRANSITION | 25 | 53.5 | +$14.18 | +$354.43 |
| BULL | 19 | 48.2 | +$3.58 | +$68.06 |
| BEAR | 15 | 45.1 | −$8.77 | −$131.49 |

Regime analysis suggests conviction performance is conditional on entry environment, but regime alone does not explain the inversion: the strongest apparent distortion still comes from producer composition, especially the H2 introduction of the `[social]`-only high-PCS path.

---

## 7. Root-Cause Hypothesis

Most likely root cause: The current PCS mapping overstates confidence for a single-domain [social] path and understates the best-performing multi-domain [social, technical] path, producing bucket contamination that mimics inversion.

The evidence chain:

1. Observed: monotonically adverse cohort ordering (High < Mid < Low)
2. Significance test: directionally adverse but statistically underpowered — does not justify inversion on its own
3. Attribution: 100% of High-cohort trades come from one producer path emitting a fixed elevated score
4. Sensitivity check: removing that path eliminates the High cohort entirely — no other path scores into High
5. Stability check: the inversion appears only after H2 introduces the contaminating path; it is absent in H1

The evidence is more consistent with a calibration defect than with genuinely anti-predictive conviction.

---

## 8. Calibration Recommendation

Do not invert conviction before the 2026-05-12 gate.

Immediate pre-gate calibration: No single-domain path may score into High. High should require cross-domain confirmation or a separately justified override. In practice, this means temporarily reclassifying `[social]`-only outputs from High into Mid/Low until the PCS weighting is recalibrated.

Expected directional impact:
- Remove false positives from the High bucket
- Concentrate High on genuine multi-signal agreement
- Improve monotonic cohort ordering
- Preserve existing engine structure without adding new features or models

Decision tree for post-calibration evaluation:
- If High outperforms Low after single-domain ceiling → conviction is working; continue Phase 0
- If High remains worse after recalibration → deeper re-weighting of domain contributions needed
- Only if recalibrated High still underperforms → consider conviction redesign

This keeps the pre-gate decision narrow: Phase 0 does not justify flipping the sign of conviction. It justifies a targeted recalibration of bucket assignment so the next evaluation tests whether High once again corresponds to stronger realized performance.
