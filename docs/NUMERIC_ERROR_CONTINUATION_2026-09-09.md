# BetterBoard Numeric Error — Continuation Notes (2026-09-09)

This note records the next-stage work after the focused firmware pack and host analyzer were added on branch `numeric-error-research-pack`.

## Newly added host-side analysis

`numeric_error_research_analyzer_v2.py` recognizes focused experiment CSV schemas and computes experiment-specific metrics without third-party dependencies:

- ADC stability aggregation
- theoretical quantization step / half-step bound + observed RMS/max error
- fast/slow EMA noise-versus-tracking metrics
- derivative error against host `cos(1)` reference and best observed h
- integration error and observed order under N doubling
- naive versus Kahan summation host-side comparison
- photogate period/frequency statistics
- switch-bounce duration / edge-count statistics
- PWM quantization error
- PIR high-duration statistics
- MultiSensor filter RMSE and photogate-period summary

`numeric_error_validation_self_check.py` exercises representative quantization, derivative, integration and ADC-stability schemas deterministically.

## P0 product integration work still required

1. Port lifecycle and selection
   - suppress/rank down system ports such as `/dev/cu.debug-console`
   - do not auto-select an obviously non-board port
   - coordinate serial capture/monitor ownership with upload to prevent `Resource busy`

2. Bench 03 completion semantics
   - explicitly label the firmware as a one-shot campaign
   - show expected/received row count and `Campaign Complete`
   - distinguish completion from a stalled serial stream

3. Bench 02 and focused Numeric Error host analysis
   - invoke host analyzers from BetterBoard instead of printing terminal commands
   - render summaries inside Numerical Bench
   - preserve raw CSV/JSON/Markdown evidence packages

4. Canonical-promotion gate
   - focused firmware should remain research recipes until compile/upload/capture validation succeeds on the real UNO
   - only validated recipes should be added to the canonical recipe catalog

## Firmware semantics requiring review before canonical promotion

### Photogate timing

The current focused photogate firmware updates its edge baseline even when an edge is rejected by the minimum-spacing rule. Replace this with `lastAcceptedEdgeUs`; rejected edges should increment an explicit rejection counter without moving the accepted timing baseline.

Recommended output:

`accepted_event_index,event_us,period_us,frequency_hz,rejected_since_last,total_rejected`

### MultiSensor event retention

The current MultiSensor sketch stores only the latest photogate period and a boolean `newPhotoPeriod`. Multiple edges between 50 Hz samples can overwrite earlier evidence.

Add at minimum:

- `photo_event_count_total`
- `photo_events_since_sample`
- `photo_overrun_or_coalesced`

A zero period must be distinguishable from 'no event' and from 'events were coalesced'.

### Summation oracle

The current MCU-side `reference = n * increment` is not an independent reference. A future schema should encode the increment exactly, e.g. numerator/denominator, and let the host construct a high-precision reference.

### Derivative oracle

MCU `cosf(1)` is useful local evidence but is not an independent oracle. Host analysis should remain the reference side; a future high-precision Decimal/mpmath path may be added where already available.

## Recommended Numerical Bench taxonomy

Keep the existing top-level progression:

1. Acquire Reality
2. Analyze Sampled Reality
3. Analyze Arithmetic

Within it, group focused experiments by mechanism:

- Acquisition: ADC Stability, Quantization, Filter Lag, PWM Quantization, MultiSensor Pipeline
- Discretization: Sampling, Finite Difference, Integration
- Floating Point: Summation, Taylor, Cancellation, False Convergence
- Event / Timing: Photogate Timing, Switch Bounce, PIR Timing

The UI should ask which numerical-error mechanism the user wants to investigate rather than exposing a flat list of `.ino` files.
