# BetterBoard Bench 02 — Sampling & Numerical Error

Bench 02 turns an ordinary BetterBoard real measurement into a numerical-analysis experiment.

It intentionally reuses the existing **Bench 01 — Analog Control & Instrumentation** acquisition path instead of duplicating firmware. The same UNO-compatible board and potentiometer can therefore support two different experiments:

```text
Bench 01: physical input -> ADC -> filtering / PWM -> measurement
Bench 02: measured time series -> sampling / discretization / accumulation analysis
```

## Why this is a real-data numerical experiment

Physical Lab's existing **Numerical Error Analysis** module is primarily a numerical-computation laboratory: Taylor-series evaluation of `sin(x)`, float32/float64 behavior, range reduction, cancellation, stopping criteria, false convergence, and comparison against a high-precision oracle.

Bench 02 does not pretend that a potentiometer validates those Taylor-series identities. Instead it adds a complementary experimental path using measured data. It asks a different family of numerical questions:

- How regular is the actual sample timing?
- What happens when the same measured record is downsampled?
- How sensitive is a finite-difference derivative to sample spacing?
- How sensitive is trapezoidal integration to sample spacing?
- What visible quantization structure exists in the ADC record?
- How much does repeated float32 accumulation differ from float64 accumulation on the same measured samples?

This is a legitimate numerical-error experiment, but its error reference is bounded: the finest available measured series is an **empirical baseline**, not exact physical truth.

## Hardware you already need

Minimum:

- UNO-compatible board
- USB data cable
- the already-identified low-voltage potentiometer module

Use the Bench 01 wiring once the exact module pin labels are confirmed:

```text
pot signal -> A0
pot supply -> compatible board supply
pot ground -> board GND
```

The optional Bench 01 LED/PWM output is not required for Bench 02.

## Recommended experimental campaign

### Trial A — stationary knob

Hold the potentiometer as still as practical and record a BetterBoard measurement package.

Use this record to inspect:

- repeated ADC codes
- minimum observed code step
- short-term spread
- sample-interval jitter

This does **not** measure absolute sensor accuracy. It characterizes the acquired digital record.

### Trial B — slow sweep

Move the knob smoothly from one end of its usable range toward the other during the capture.

Use this record to study:

- downsampling sensitivity
- trapezoidal integral convergence
- derivative sensitivity

### Trial C — changing-direction motion

Move the knob gradually upward, reverse, and return.

This gives a time series with sign changes in the derivative and is useful for showing why numerical differentiation is more sensitive to sampling and noise than integration.

### Trial D — repeated captures

Repeat the same intended motion several times. These are independent real measurement records. Human motion will not be exactly reproducible, so differences between trials are not purely numerical error; treat repeatability and numerical-discretization effects separately.

## Capture in BetterBoard

1. Open **Bench 01 — Analog Control & Instrumentation**.
2. Preflight.
3. Compile & Upload.
4. Record a measurement package.
5. BetterBoard writes the full multichannel `data.csv` plus metadata.

Bench 02 then analyzes that package:

```bash
python3 scripts/bench02_numerical_error.py \
  ~/Documents/BetterBoard/measurements/<measurement-folder>
```

The analyzer is Python-standard-library only and does not install anything.

By default it prefers `raw_adc` as the value series. A different channel can be selected explicitly:

```bash
python3 scripts/bench02_numerical_error.py <measurement-folder> \
  --value filtered_voltage_v
```

## Outputs

The analyzer creates:

```text
<measurement-folder>/bench02-numerical-error/
├── bench02_summary.json
├── bench02_convergence.csv
└── bench02_report.md
```

### `bench02_summary.json`

Machine-readable evidence including:

- sample count and duration
- requested and observed sample rate
- median / mean / min / max sample interval
- timing-jitter statistics
- value min / max / mean / standard deviation
- observed quantization-step structure
- float32-vs-float64 trapezoidal accumulation difference
- convergence metrics for multiple downsample factors

### `bench02_convergence.csv`

For each downsample factor it reports:

- retained sample count
- effective sample rate
- trapezoidal integral
- integral difference relative to the finest record
- finite-difference derivative RMSE relative to the derivative computed on the finest record at matching timestamps

### `bench02_report.md`

A human-readable report with the same scientific boundary stated explicitly.

## Default convergence ladder

Bench 02 uses:

```text
factor 1  -> finest available record
factor 2
factor 4
factor 5
factor 10
```

For a 50 Hz Bench 01 capture this corresponds approximately to:

```text
50 Hz
25 Hz
12.5 Hz
10 Hz
5 Hz
```

when enough samples are available.

## What counts as a reference?

The full-rate record is used as a **numerical baseline** only.

It is not exact physical truth because the record itself still contains:

- ADC quantization
- input noise
- timing uncertainty
- reference-voltage uncertainty
- potentiometer nonlinearity / contact effects
- any uncharacterized acquisition-system behavior

Therefore phrases such as “integral error versus finest record” mean numerical difference relative to that baseline, not absolute physical error.

## Relationship to Physical Lab Numerical Error Analysis

Physical Lab currently identifies its Numerical Error Analysis module as a lab for Taylor-series evaluation, floating-point error, cancellation, convergence, and reliability diagnostics. Bench 02 extends the overall project with a **measured-data numerical-analysis path** rather than relabeling the existing Taylor experiment.

The long-term bridge can become:

```text
real hardware
   ↓
BetterBoard measurement package
   ↓
Bench 02 sampling / discretization evidence
   ↓
Physical Lab Numerical Error Analysis
   ↓
combined computational + experimental numerical reliability study
```

A later Physical Lab update can add a dedicated “Measured Series” page that imports Bench 02 outputs directly. Until then, Bench 02 produces deterministic CSV/JSON/Markdown evidence that can be registered or inspected independently.

## Scientific boundary

Bench 02 studies numerical behavior of a measured sequence. It does not establish calibration traceability, absolute physical truth, sensor accuracy, or an exact experimental oracle. It also does not replace the existing high-precision oracle used by the Taylor-series Numerical Error Analysis module.
