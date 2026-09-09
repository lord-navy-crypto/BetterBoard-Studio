# BetterBoard Numerical Error Program Depth 1

This revision strengthens the numerical-error programs without changing the existing measurement CSV schemas for the three small MCU microbenches.

## Design rule

The board produces **finite-precision evidence**. The host provides the **independent reference**.

That separation prevents a program from grading itself with another function from the same MCU math library.

## Step-size differentiation

Firmware still emits:

`h, forward, central, mcu_cos, abs_err_forward, abs_err_central`

The `mcu_cos` and MCU-computed errors remain useful diagnostics, but they are not the final accuracy oracle. The new host analyzer reconstructs the configured evaluation point as binary32, computes an independent high-precision cosine reference, and adds:

- forward / central absolute error vs host oracle
- forward / central ULP error
- effective binary32 `h` on each side
- `x + h == x` and `x - h == x` collapse flags
- best observed `h` for each method

The firmware sweep now reaches `1e-8`, deliberately crossing the float32 step-size-collapse region for ordinary `x` values.

## Catastrophic cancellation

Firmware still emits:

`x, raw, stable, abs_difference, relative_difference, raw_zero`

The campaign now approaches zero from both positive and negative sides. The host independently evaluates `sqrt(1+x)-1` at high precision and reports:

- raw and stable absolute error
- raw and stable ULP error
- stable-form improvement factor
- raw resolution failure

The stable algebraic form is therefore a candidate method, not assumed truth.

## Accumulation

Firmware still emits the existing 9-column accumulation schema, but one run now emits a checkpoint curve instead of only one endpoint. Standard checkpoints include 100 through 50,000 additions, filtered by the requested final count.

The host reconstructs the exact binary32 increment and evaluates the mathematical sum independently, then reports:

- correctly rounded float32 target
- naive / Kahan absolute error
- naive / Kahan ULP error
- Kahan improvement factor
- Kahan / naive runtime ratio

This exposes the growth of rounding error instead of hiding it behind one final value.

## Bench 02 — measured-series numerics

Bench 02 now uses a second-order three-point derivative valid for non-uniform timestamps. The older symmetric-span formula is retained only as a diagnostic comparison, so timing jitter no longer silently violates the derivative formula's equal-spacing assumption.

It also compares:

- float64 trapezoid accumulation
- emulated float32 naive accumulation
- emulated float32 Kahan accumulation

Timing evidence now includes p95 and maximum absolute jitter.

## Bench 03 — embedded numerical reliability

Bench 03 keeps the real MCU Taylor campaign and independent host oracle, but the host analysis now separates:

- argument-reduction contribution
- Taylor-recurrence contribution
- total error

The accuracy threshold for `sin(x)` is now output-scale based:

`8 * FLT_EPSILON * max(1, |reference|)`

It no longer becomes more permissive merely because `|x|` is large. Fixed-term convergence reports the first reliable term limit and the best normalized-error term limit.

## Host commands

Three MCU microbenches:

```bash
python3 scripts/numerical_microbench_analyzer.py <measurement-folder>
```

Bench 02:

```bash
python3 scripts/bench02_numerical_error.py <measurement-folder>
```

Bench 03:

```bash
python3 scripts/bench03_embedded_numerical.py <measurement-folder>
```

## Scientific boundary

Numerical error, measurement error and model error remain distinct. A high-precision host oracle can establish numerical error for a defined mathematical problem. A finest measured time series is only an empirical numerical baseline unless an independent physical reference establishes ground truth.
