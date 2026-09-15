# Device Primitive Observability Design

## Goal

Add a device-derived primitive observability lane to BetterBoard without changing the raw measurement CSV/evidence contract. Embedded primitives should be able to publish structured derived results that the desktop can parse, label as `DEVICE-DERIVED`, visualize beside the existing `HOST-DERIVED` Primitive Observatory results, and compare where semantics are deterministic and equivalent.

This phase must preserve the existing separation between raw evidence and derived analysis. It must also remain compatible with firmware that emits no primitive-result frames.

## Scope

Phase 4 adds:

- a versioned device primitive result envelope carried as metadata-style serial lines;
- a lightweight firmware formatter/API for emitting those frames;
- a TypeScript parser and normalized device-derived result model;
- Monitor & Data integration that observes primitive frames without treating them as numeric evidence rows;
- Primitive Observatory UI support for host/device provenance and selected comparisons;
- tests protecting protocol compatibility, primitive semantics, and the raw-evidence boundary.

Phase 4 does not:

- replace the existing CSV measurement stream;
- modify saved raw evidence into a mixed raw/derived table;
- require every embedded primitive to be emitted on every sample;
- introduce a binary transport;
- claim device-derived results are more authoritative than host-derived results;
- redesign the Math Runtime Capabilities protocol.

## Existing Boundaries

`EngineeringLabStream` already establishes a useful transport convention: metadata lines begin with `#` while data rows remain ordinary CSV. That convention is retained.

`MathRuntimeCapabilities` remains a capability announcement. It answers what the active embedded runtime can support. The new primitive-result envelope answers what a device actually emitted for the current run. These lifecycles remain independent.

The existing Host Primitive Observatory consumes selected-channel `channelPoints` derived from the same Monitor Live / Buffer / Replay evidence path and labels its output `HOST-DERIVED`. Device-derived results join that observatory as an additional derived lane; they never replace or rewrite host evidence.

## Protocol Choice

Use an additive, metadata-style side channel with prefix:

```text
#BB_PRIMITIVE,
```

Protocol version 1 uses a fixed CSV-like envelope so AVR-class firmware can emit it without JSON allocation or a larger parser dependency.

Canonical frame shape:

```text
#BB_PRIMITIVE,1,<kind>,<source>,<time_us>,<value>,<state>,<parameter_key>,<parameter_value>
```

Fields:

- `1`: primitive result protocol version;
- `kind`: stable primitive identifier;
- `source`: source channel identifier used to bind the result to a measurement channel;
- `time_us`: device-side timestamp in microseconds;
- `value`: primary numeric primitive result or empty when the frame is state-only;
- `state`: `0`, `1`, or empty when no Boolean state applies;
- `parameter_key`: optional parameter name relevant to this frame;
- `parameter_value`: optional parameter value.

A frame always has the same field count. Empty optional fields are represented by adjacent commas. Unknown future `kind` values or unsupported protocol versions are ignored by the scientific result pipeline and surfaced as diagnostics.

Examples:

```text
#BB_PRIMITIVE,1,rms,magnetic_field,250000,0.183420,,,
#BB_PRIMITIVE,1,derivative,magnetic_field,250000,-0.012500,,,
#BB_PRIMITIVE,1,threshold,magnetic_field,250000,,1,threshold,0.150000
#BB_PRIMITIVE,1,hysteresis,magnetic_field,250000,,1,low_high,0.140000|0.160000
```

The first protocol version intentionally favors a compact, fixed envelope over an unrestricted key/value payload. If later primitives need multiple simultaneous numeric outputs, a future protocol version can add a descriptor/result model without changing version 1 parsing.

## Primitive Kinds in Phase 4

The initial device-result kinds are:

- `stats_mean`
- `stats_std`
- `stats_min`
- `stats_max`
- `rms`
- `derivative`
- `integral`
- `ema`
- `peak_hold`
- `threshold`
- `hysteresis`

`threshold` and `hysteresis` primarily use the `state` field. Their configuration must be visible through the parameter fields so the desktop never has to infer thresholds.

Change detection is included in the protocol namespace design but deferred from first quantitative device-host comparison because its alarm behavior depends more strongly on run initialization and configured reference/noise parameters. Adding `cusum` or `mean_shift` later must be additive.

## Firmware API

Add a focused formatter class in the embedded core, separate from `EngineeringLabStream` raw row formatting. A suitable shape is:

```cpp
class PrimitiveResultStream {
 public:
  explicit PrimitiveResultStream(Print& output);

  void value(const char* kind,
             const char* source,
             uint32_t time_us,
             double value,
             const char* parameter_key = nullptr,
             const char* parameter_value = nullptr,
             int digits = 6);

  void state(const char* kind,
             const char* source,
             uint32_t time_us,
             bool state,
             const char* parameter_key = nullptr,
             const char* parameter_value = nullptr);
};
```

This class only serializes device-derived results. It does not own primitive state, sample acquisition, or experiment scheduling.

Firmware examples/tests wire the formatter to existing primitive classes. The primitive implementations remain the semantic source of truth; the formatter does not recompute them.

## Host Parser and Result Model

Create a pure TypeScript parser independent from `MonitorDataStudio` rendering logic.

Normalized result shape:

```ts
export type DevicePrimitiveResult = {
  producer: 'device';
  protocolVersion: number;
  kind: DevicePrimitiveKind;
  source: string;
  timeUs: number;
  value: number | null;
  state: boolean | null;
  parameterKey: string | null;
  parameterValue: string | null;
};
```

Parser rules:

- only lines beginning with `#BB_PRIMITIVE,` are candidates;
- protocol version must be a positive integer and version 1 must have the exact expected field count;
- `kind` and `source` must be non-empty;
- `time_us` must be an integer >= 0;
- numeric `value`, when present, must be finite;
- `state`, when present, must be exactly `0` or `1`;
- parameter key/value must either both be present or both be absent;
- malformed frames return a structured parse diagnostic rather than a scientific result;
- unsupported protocol versions return an unsupported-version diagnostic;
- unknown primitive kinds return an unknown-kind diagnostic.

No primitive frame may enter the normal numeric row parser or the saved raw measurement buffer as a numeric data row.

## Data Flow

For each received serial line:

```text
serial line
  -> capability parser, if #BB_MATH_CAPS
  -> primitive-result parser, if #BB_PRIMITIVE
  -> raw numeric/text path otherwise
```

Raw measurement rows continue through the existing Live / Snapshot / Replay evidence path.

Primitive frames are held as an in-memory derived stream associated with the current acquisition context. They use device timestamps and source names for scientific binding. They are not used to relabel raw rows.

In the first implementation, historical replay only shows device-derived results when the replay source actually contains preserved primitive metadata. If the current persisted measurement package does not retain metadata/control lines, Phase 4 must not fabricate device-derived replay. Host-derived replay remains available as today.

## Timestamp Semantics

Device-result timestamps are always declared as microseconds in protocol v1 and stored as integer `timeUs`.

For display and comparison, the UI converts device time to elapsed seconds using the first valid device result in the relevant source/run as the origin. Host-derived results continue using the existing host-timestamp-based elapsed axis.

A device-host comparison must not imply timestamp identity. Comparisons are performed only where the series can be meaningfully aligned by sequence/time tolerance. If alignment is not reliable, the UI shows both traces separately and reports the comparison as unavailable.

## Source Binding

`source` must match a declared measurement channel name when a device result is compared to the selected Host Primitive Observatory channel.

If a device frame names an unknown source:

- retain it as a diagnostic device result;
- do not compare it to the selected host channel;
- surface `unbound source` status.

The host must never silently map a primitive result to a different column by position.

## Primitive Observatory Integration

The existing Host Primitive Observatory remains the primary component and gains a producer-aware view model.

Header provenance becomes explicit:

- `HOST-DERIVED`
- `DEVICE-DERIVED`
- `HOST ↔ DEVICE` comparison status when applicable.

For Phase 4, quantitative comparison is supported for:

- RMS;
- derivative;
- integral;
- EMA;
- peak hold;
- threshold state;
- hysteresis state;
- scalar statistics where matching device statistic frames exist.

The UI may overlay host and device traces when units/semantics match. It must also display parameter mismatches. If host EMA alpha differs from the device EMA alpha, for example, the UI must not report a numerical discrepancy as an implementation mismatch; it reports `parameter mismatch` and disables direct consistency scoring.

No device-result lane is shown when the current stream contains no valid device primitive frames for the selected source.

## Consistency Comparison

Device-host comparison is diagnostic, not an authority decision.

Comparison states:

- `MATCHABLE`: same primitive semantics, source, and relevant parameters;
- `PARAMETER_MISMATCH`: same primitive but incompatible configured parameters;
- `UNBOUND_SOURCE`: device source does not map to selected channel;
- `INSUFFICIENT_ALIGNMENT`: timing/sequence cannot be aligned safely;
- `UNAVAILABLE`: one producer has no comparable output.

For matchable numeric results, show:

- absolute difference;
- relative difference when denominator is safely non-zero;
- maximum absolute difference across aligned series;
- aligned sample count.

Threshold/hysteresis comparison uses state disagreement count rather than relative numeric error.

The UI must say `difference`, `agreement`, or `consistency`; it must not say either producer is automatically correct.

## Error Handling

Malformed or unsupported primitive frames must never:

- be parsed as measurement CSV;
- change acquisition schema;
- mutate saved evidence;
- crash the serial monitor;
- create fake zero-valued results.

Diagnostics are categorized as:

- malformed frame;
- unsupported protocol version;
- unknown primitive kind;
- invalid timestamp;
- invalid numeric value/state;
- parameter-pair mismatch;
- unbound source.

Repeated identical diagnostics may be de-duplicated or counted to avoid flooding the UI.

## Backward Compatibility

Firmware that emits no `#BB_PRIMITIVE` lines behaves exactly as before.

Existing `#BB_MATH_CAPS` lines keep their current parser and semantics.

Existing `EngineeringLabStream` raw CSV format remains version 2 and is not bumped solely because primitive-result lines are added outside the raw data rows.

Primitive-result protocol versioning is independent from both Engineering Lab stream versioning and Math Runtime Capabilities versioning.

## Testing Strategy

### Protocol tests

Add C++ tests for the formatter output:

- value result;
- state result;
- optional parameter pair;
- stable fixed field count;
- no mutation of normal EngineeringLabStream row output.

Add TypeScript/parser contract tests for:

- valid v1 frames;
- missing fields;
- non-finite numeric values;
- invalid state values;
- unsupported versions;
- unknown kinds;
- parameter key/value mismatch.

### Semantic tests

Use deterministic sample sequences to exercise the actual existing embedded primitive classes and compare expected protocol values against Host Primitive Observatory semantics for:

- running RMS;
- finite difference with explicit dt;
- trapezoid integration;
- EMA;
- peak hold;
- threshold latch;
- hysteresis state.

Tests must include irregular sample intervals for derivative/integration and hysteresis dead-band samples.

### Boundary tests

Protect that:

- `#BB_PRIMITIVE` lines cannot become numeric evidence rows;
- raw CSV schema remains unchanged;
- the Monitor passes parsed device results to Primitive Observatory separately from `channelPoints`;
- no device frame means no device-derived UI lane;
- parameter mismatch disables direct consistency scoring.

### Full verification

Completion requires a fresh green branch-head run covering:

- TypeScript/Vite build;
- full Python contract suite including new primitive-result contract checks;
- Arduino AVR core setup;
- numerical microbench UNO compile;
- Numeric Error Depth UNO compile;
- any added primitive-result example/test firmware compile;
- Tauri Linux dependency setup;
- Rust check.

## Implementation Boundaries

Likely files:

- create `firmware/betterboard-core/src/experiments/PrimitiveResultStream.h`
- create `firmware/betterboard-core/src/experiments/PrimitiveResultStream.cpp`
- modify embedded core tests
- create `src/devicePrimitiveResults.ts`
- modify `src/MonitorDataStudio.tsx`
- modify `src/PrimitiveObservatory.tsx`
- possibly extend `src/PrimitiveObservability.ts` only with comparison helpers, not device parsing
- create/extend Python contract self-checks

Avoid putting parser logic or comparison mathematics directly into `MonitorDataStudio.tsx`.

## Deferred Work

The following are deliberately deferred:

- binary telemetry;
- persistent device-result metadata in measurement packages if current package storage does not preserve control lines;
- device-side CUSUM/mean-shift comparison UI;
- generalized arbitrary multi-output primitive payloads;
- automatic calibration or authority decisions from device-host differences;
- protocol negotiation beyond explicit version rejection/diagnostics.

These can be added later without breaking protocol v1 or the raw-evidence boundary.
