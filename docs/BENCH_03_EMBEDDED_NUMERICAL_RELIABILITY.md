# BetterBoard Bench 03 — Embedded Numerical Reliability

Bench 03 is the hardware-in-the-loop companion to Engineering Lab / Physical Lab's **Numerical Error Analysis Studio**.

The existing Numerical Error Analysis Studio studies Taylor-series evaluation of `sin(x)`, raw versus range-reduced algorithms, float32/float64 behavior, cancellation, stopping rules, false convergence, and reference-based reliability. Bench 03 keeps that scientific question but moves the finite-precision calculation onto the actual microcontroller.

```text
Engineering Lab numerical model
          ↓
BetterBoard Bench 03
          ↓
UNO-compatible MCU executes C++ recurrence
          ↓
raw embedded evidence
          ↓
BetterBoard measurement package
          ↓
host high-precision comparison
          ↓
Numerical Error Analysis / evidence bridge
```

## Hardware

Minimum:

- UNO-compatible board
- USB data cable

No external sensor is required. Bench 03 is an embedded-computation experiment, not a sensor experiment.

## Embedded algorithm

The firmware evaluates the sine Taylor recurrence

```text
a[n+1] = a[n] * (-x²) / ((2n + 2)(2n + 3))
```

in two modes:

- `method_code = 0`: raw Taylor
- `method_code = 1`: range-reduced Taylor

The range-reduced implementation maps the argument into approximately `[-π/2, π/2]` before the recurrence. The firmware reports intermediate numerical diagnostics rather than only the final answer.

## Deterministic campaign

Each serial-open/reset runs one campaign.

### Study 1 — Parameter scan

The MCU evaluates both methods across 33 points from `x = -80` to `x = 80`, using an adaptive stopping rule and a maximum of 120 terms.

### Study 2 — Single-point convergence

The MCU evaluates `x = 80` with fixed term counts from 1 through 25 for both raw and range-reduced methods.

This mirrors the two central independent axes of the Numerical Error Analysis Studio:

- parameter scan: `x`
- convergence study: Taylor term count

The embedded campaign is intentionally bounded so it completes reliably on an UNO-class board and fits the normal BetterBoard serial-capture window. Denser command-driven scans can be added later without changing the evidence schema.

## Numeric-only evidence schema

The firmware emits:

```text
study_code,
method_code,
x_bits,
x,
term_limit,
reduced_x,
terms_used,
last_term,
cancellation_ratio,
stop_rule,
finite,
elapsed_us,
float_bytes,
double_bytes,
float_epsilon,
approximation
```

`approximation` is intentionally the final field so BetterBoard's current Physical Lab v1 compatibility exporter carries the embedded numerical result as its primary observable.

`x_bits` preserves the binary32 bit pattern of the actual MCU input, allowing the host oracle to evaluate the same represented input rather than a rounded display string.

The firmware also reports `sizeof(float)`, `sizeof(double)`, and `FLT_EPSILON`; BetterBoard therefore records the arithmetic environment actually produced by the toolchain instead of silently assuming it.

The canonical v0.2 serial pipeline requires numeric fields. If the recurrence becomes non-finite, `finite = 0` records that fact and the affected numeric payload field is emitted as a numeric placeholder instead of textual `NaN`/`Inf`, so the row is not silently discarded by the numeric parser.

## Responsibility split

The microcontroller reports only facts it can establish locally:

- approximation
- reduced argument
- term count
- last term
- cancellation ratio
- stopping-rule result
- finite/non-finite arithmetic
- execution time
- floating-point environment

The MCU does **not** claim that its answer is accurate.

The host analyzer supplies the independent reference side and computes:

- absolute error
- relative error
- ULP error
- scale-aware allowed absolute error
- normalized error
- accuracy pass/fail
- false convergence
- cancellation acceptance
- numerical reliability classification

This deliberately preserves the original Numerical Error Studio distinction:

```text
stop rule passed != answer is accurate != algorithm is numerically reliable
```

## Host analyzer

After recording a Bench 03 BetterBoard measurement package:

```bash
python3 scripts/bench03_embedded_numerical.py \
  ~/Documents/BetterBoard/measurements/<bench03-folder>
```

The preferred oracle is `mpmath` when it is already available. BetterBoard does not reinstall it. If `mpmath` is unavailable, the analyzer falls back to a bundled Python-standard-library Decimal high-precision Taylor oracle and labels that backend explicitly.

Outputs:

```text
<measurement-folder>/bench03-embedded-numerical/
├── bench03_analysis.csv
├── bench03_summary.json
└── bench03_report.md
```

## Reliability rule

The host classification follows the same structure as the Numerical Error Analysis Studio. A row is reliable only when:

- arithmetic is finite;
- the embedded stopping criterion is met;
- the approximation passes the reference-based scale-aware error bound; and
- cancellation remains below the precision-dependent threshold.

If the embedded stop rule passes while the reference accuracy test fails, the row is classified as:

```text
false_convergence
```

## Added embedded-systems dimension

Bench 03 also reports `elapsed_us`, so numerical quality can be studied together with computational cost:

```text
accuracy ↔ stability ↔ term count ↔ execution time
```

That dimension is specific to the embedded experiment and is a direct bridge from numerical analysis into ECE / embedded-systems engineering.

## Scientific boundary

Bench 03 is evidence about real microcontroller arithmetic and the tested firmware/toolchain. It is not a hardware calibration experiment and it does not establish sensor accuracy. Reference backend, firmware, board profile, and numerical assumptions must remain visible in any downstream claim.
