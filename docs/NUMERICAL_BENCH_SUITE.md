# BetterBoard Numerical Bench Suite

The Numerical Bench Suite combines the first three BetterBoard reference benches behind one switchable workspace.

```text
Bench 01 — acquire a real signal
Bench 02 — study numerical behavior of the measured data
Bench 03 — study numerical behavior of the embedded computation itself
```

The desktop entry screen exposes two top-level workspaces:

```text
BetterBoard Studio | Numerical Bench 01–03
```

Inside **Numerical Bench 01–03**, the three benches are mode switches rather than separate applications.

## Mode 1 — Bench 01: Analog Control & Instrumentation

Purpose:

```text
physical input → ADC → normalization/filtering → PWM → measurement
```

Minimum current hardware:

- UNO-compatible board
- USB data cable
- already-identified low-voltage potentiometer module

This mode produces the real `data.csv` source used by Bench 02.

## Mode 2 — Bench 02: Sampling & Numerical Error

Purpose:

```text
Bench 01 real data → timing/sampling analysis → differentiation/integration → convergence evidence
```

The analyzer studies:

- actual sample intervals and jitter
- ADC code structure
- downsampling
- finite-difference derivative sensitivity
- trapezoidal-integration convergence
- float32 versus float64 accumulation

It does not call the finest record exact physical truth; that record is only an empirical numerical baseline.

## Mode 3 — Bench 03: Embedded Numerical Reliability

Purpose:

```text
numerical problem → real MCU C++ arithmetic → embedded evidence → host oracle → reliability
```

The MCU runs the same Taylor-recurrence family studied by Engineering Lab / Physical Lab Numerical Error Analysis:

- raw Taylor
- range-reduced Taylor
- x-parameter scan
- fixed-term convergence
- stopping criterion
- cancellation ratio
- finite arithmetic
- arithmetic environment
- execution time

The host then adds independent reference-based diagnostics:

- absolute / relative / ULP error
- scale-aware acceptance
- normalized error
- accuracy decision
- false convergence
- numerical reliability

## Shared engineering progression

The three modes form one increasing-depth sequence:

```text
REALITY
  ↓
Bench 01
How do I acquire and control a real signal?
  ↓
Bench 02
How do sampling and numerical processing change that measured signal?
  ↓
Bench 03
How reliable is the finite-precision computation running on the embedded processor itself?
  ↓
Engineering Lab / Physical Lab Numerical Error Analysis
Computational + measured + embedded evidence
```

Bench 01 and Bench 02 share the same acquisition firmware by design. Bench 03 has its own deterministic embedded C++ campaign and requires no external sensor.

## Current analysis commands

Bench 02:

```bash
python3 scripts/bench02_numerical_error.py <measurement-folder>
```

Bench 03:

```bash
python3 scripts/bench03_embedded_numerical.py <measurement-folder>
```

The Numerical Bench workspace displays the exact command after a measurement package is recorded.

## Current boundary

This first unified implementation switches modes and performs acquisition/upload/capture through BetterBoard. Bench 02 and Bench 03 reference analysis remains a deterministic post-capture script step. A later UI iteration can invoke those analyzers directly and render the convergence/reliability plots in the same page without changing the measurement schemas.
