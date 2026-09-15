# Host Primitive Observatory — Design

Date: 2026-09-15
Branch: `ui/analysis-visualization-integration-a9`
PR: #66

## Goal

Expose BetterBoard's existing embedded numerical and signal-processing primitives as a host-side observability layer inside **Monitor & Data**. The feature analyzes the currently selected numeric channel from the same timestamped evidence already used by the live plot. It must work identically for Live, Snapshot, and Replay data while preserving raw evidence unchanged.

This phase is intentionally host-side only. Every result is labeled **HOST-DERIVED**. No firmware protocol or device-emitted result schema is added in this phase.

## Why this placement

`MonitorDataStudio` already owns the canonical acquisition views for Live, Snapshot, and Replay, preserves backend host timestamps, selects the active channel, and plots that channel against elapsed time. Primitive observability therefore belongs directly below the existing Live Plot rather than in a separate page that would need to duplicate or synchronize measurement context.

The future device-derived implementation can extend this same surface to `HOST / DEVICE / DIFFERENCE` without moving the workflow.

## Existing embedded semantics to mirror

The host implementation should mirror BetterBoard core semantics rather than use unrelated textbook variants:

- `OnlineStatistics`: count, mean, sample/population variance and standard deviation, min, max, peak-to-peak.
- `RmsAccumulator`: cumulative mean-square and RMS.
- `FiniteDifference`: derivative from consecutive `(time_seconds, sample)` pairs; derivative is unavailable until two valid time points exist.
- `TrapezoidIntegrator`: cumulative trapezoid integral using actual sample times, default initial integral `0`.
- `ExponentialMovingAverage`: first sample initializes the state; subsequent values use `alpha*x + (1-alpha)*previous`.
- `PeakHold`: persistent maximum since reset.
- `ThresholdTrigger`: threshold-based latched state.
- `HysteresisLatch`: explicit low/high thresholds with state memory; this must be shown as a state transition, not reduced to a stateless boolean comparison.
- `ChangeDetection`: EWMA monitor, positive/negative CUSUM scores, and fixed-window mean-shift diagnostics.
- `LinearRegression`: rolling trend summary where enough finite points exist.

## Architecture

### 1. Pure host primitive engine

Add a focused TypeScript module, tentatively `src/PrimitiveObservability.ts`, with no React dependency. It accepts a chronological trace:

```ts
type PrimitiveSample = { timeS: number; value: number };
```

and a parameter object. It returns one immutable result envelope containing summaries and plot-ready traces.

The engine filters non-finite samples and rejects non-monotonic time transitions for derivative/integration steps instead of silently inventing `dt`.

### 2. Result envelope

The result should carry explicit provenance and readiness:

```ts
type HostPrimitiveResult = {
  origin: 'host-derived';
  sampleCount: number;
  timeSpanS: number | null;
  statistics: ...;
  rms: ...;
  derivative: ...;
  integral: ...;
  ema: ...;
  peakHold: ...;
  threshold: ...;
  hysteresis: ...;
  regression: ...;
  changeDetection: ...;
  warnings: string[];
};
```

Unavailable outputs use `null` / empty traces plus an explicit readiness reason. They do not use placeholder numeric zero values.

### 3. React surface

Add `src/PrimitiveObservatory.tsx` and mount it in `MonitorDataStudio` directly below the current numeric Live Plot/channel controls.

Inputs:

- selected channel label and unit;
- the same `channelPoints` used by the existing plot;
- acquisition mode label (`LIVE`, `SNAPSHOT/BUFFER`, or `REPLAY`) only for context display.

The component is presentation/configuration only. Numerical calculations remain in the pure engine.

## User interface

The top bar shows:

- `HOST-DERIVED` provenance badge;
- selected channel + unit;
- number of usable samples and observed time span;
- a compact warning when timestamps or sample count limit a primitive.

The default view is organized as one observability workflow, not separate pages:

1. **Online state** — N, mean, sample std, min, max, peak-to-peak, cumulative RMS.
2. **Dynamics** — raw signal + actual-time finite derivative; cumulative trapezoid integral.
3. **Signal conditioning** — raw signal + EMA; raw signal + peak-hold envelope.
4. **Decision state** — threshold line + latched trigger state/events; low/high hysteresis lines + state trace/transitions.
5. **Trend & change** — rolling linear trend metrics, CUSUM positive/negative scores, fixed-window mean-shift trace and flagged events.

EngineeringPlot is reused for plots so axis/marker behavior remains consistent with the rest of Phase 1/2.

## Parameters

Keep parameters intentionally limited and visible:

- EMA alpha, default `0.2`.
- Threshold, default derived from the visible data midpoint when possible; user-editable.
- Hysteresis low/high thresholds, default around the same midpoint and guaranteed `low < high`.
- Rolling regression window, default `32` samples.
- CUSUM reference mean defaulting to the run mean, slack defaulting to `0.5 * sampleStd`, threshold defaulting to `5 * sampleStd` when sampleStd is positive.
- Mean-shift window default `20` samples and absolute threshold defaulting to `2 * sampleStd` when possible.

Automatic defaults are conveniences, not calibration claims. The UI must show the actual values used.

## Data and provenance rules

- Host primitives consume only the selected trace currently visible to Monitor & Data.
- Raw `MonitorRow`, saved Measurement Packages, Replay data, and recipe metadata are never modified.
- Time-domain primitives use elapsed seconds derived from the backend host timestamps already preserved by Monitor & Data.
- Host-derived results are ephemeral in this phase; saving them into Measurement Packages is deferred to the unified result-contract phase.
- No host-derived value may be presented as MCU-computed.

## Error handling

- Fewer than 1 usable sample: show empty state.
- Fewer than 2 usable samples: derivative/integration unavailable.
- Non-increasing timestamp pair: omit that derivative/integration step and emit a warning.
- Invalid parameter text: retain the last valid effective parameter and show validation feedback.
- Hysteresis low >= high: mark configuration invalid and do not compute hysteresis state until corrected.
- Zero-variance traces: CUSUM/mean-shift automatic scale parameters become unavailable or use clearly displayed deterministic fallback values; do not divide by zero.

## Testing

### Pure numerical contract tests

Add a Phase 3 self-check protecting:

- Online statistics against known sequences.
- RMS against a known sequence.
- Finite difference uses actual irregular `dt`.
- Trapezoid integration uses actual irregular `dt`.
- EMA initialization and recurrence.
- Peak hold monotonic envelope.
- Threshold latching semantics.
- Hysteresis state memory across the dead band.
- Rolling regression on an exact line.
- CUSUM and mean-shift on a synthetic step.
- Non-monotonic timestamps are reported rather than silently accepted.

### UI contract checks

Protect visible strings and integration points:

- `Host Primitive Observatory`.
- `HOST-DERIVED`.
- Online state / Dynamics / Signal conditioning / Decision state / Trend & change sections.
- Mounting in `MonitorDataStudio`.

### Existing CI

All existing checks must remain green: TypeScript/Vite build, Python contract suite, Arduino firmware compilation, and Rust check. No firmware change is expected in this phase.

## Non-goals

This phase does **not**:

- add new embedded algorithms;
- change the serial protocol;
- emit primitive results from MCU firmware;
- save host-derived primitive results into evidence packages;
- implement device-vs-host numerical comparison;
- add logarithmic EngineeringPlot axes unless required by a separate approved task.

## Future extension

The next architecture phase may define a unified primitive-result contract with provenance fields such as `origin: 'host' | 'device'`, algorithm/version identifiers, parameter values, timestamps/window definitions, and comparable result series. The current host result envelope should be shaped so this extension can be additive rather than a rewrite.
