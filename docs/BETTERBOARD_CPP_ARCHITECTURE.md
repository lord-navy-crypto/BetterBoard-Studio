# BetterBoard Embedded C++ Architecture

## Current status

BetterBoard C++ Core is now a reusable embedded measurement layer rather than a collection of isolated Arduino sketches. The current v3 architecture separates scheduling, hardware acquisition, evidence semantics, numerical processing, and telemetry so that experiments can preserve measurement integrity while remaining testable on both desktop and microcontroller targets.

The implemented path is:

```text
physical system
    ↓
sensor / device driver
    ↓
HAL sensor adapter
    ↓
AcquisitionResult<T>
    ↓
EvidenceRecord
    ↓
experiment-specific derived quantities
    ↓
EngineeringLabStream / CSV telemetry
    ↓
BetterBoard capture
    ↓
Engineering Lab calibration, V&V, UQ, and model comparison
```

The embedded layer may acquire, timestamp, validate, summarize, filter, differentiate, integrate, and label measurements. It must not silently turn an uncalibrated observation into scientific truth. Calibration interpretation, uncertainty propagation, residual analysis, and final model validation remain explicit downstream work.

## Architectural rules

1. A sketch describes an experiment; reusable behavior belongs in the C++ Core.
2. Scheduler time and device-read duration are different concepts and must remain separate.
3. Invalid reads are represented explicitly, never replaced with plausible zeros.
4. Direct observations and derived values remain distinguishable.
5. Sensor adapters preserve the manufacturer's observable and do not invent higher-level meaning.
6. Calibration state and assumptions remain visible in metadata or quality flags.
7. Platform-neutral components are native-testable.
8. UNO and ESP32-S3 remain reference compile targets unless a module is intentionally platform-specific.
9. CSV schema, units, and experiment IDs are treated as contracts during internal migrations.
10. Engineering Lab remains the authority for interpretation, uncertainty, V&V, and model-to-measurement conclusions.

## Layer model

### 1. Core timing

`betterboard::core::PeriodicSampler` owns non-blocking cadence. `SampleClock` turns observed timestamps into explicit sample timing, including sample interval and lateness. `IClock` provides a portable clock boundary; `ManualClock` supports deterministic host tests and `ArduinoClock` provides the embedded `micros()` implementation.

The scheduler owns the scientific sample timestamp. A slow I2C transaction must not silently move the sample's place on the experiment time axis.

### 2. HAL acquisition boundary

`betterboard::hal::ISensorAdapter<T>` defines the common acquisition interface. `ClockedSensorAdapter<T>` wraps a narrow device callback and produces a unified `AcquisitionResult<T>` while measuring read duration through an `IClock`.

A device callback has only three responsibilities:

```text
call the hardware driver
populate the device's actual observable
classify the acquisition status
```

It does not own scheduler timing, evidence flags, calibration interpretation, or downstream model meaning.

`FakeSensor<T, N>` implements the same adapter interface. Native tests can therefore feed deterministic success, timeout, bus-error, saturation, or invalid-value cases through the same boundary used by real hardware.

Real Engineering Lab migrations currently include BME280 and MLX90393 through `ClockedSensorAdapter`; additional devices can migrate incrementally without changing the upper evidence contract.

### 3. Acquisition contract

`measurement::AcquisitionResult<T>` carries:

```text
value
status
timestamp_us
read_duration_us
```

The current statuses are explicit acquisition outcomes such as `Ok`, `NotReady`, `Timeout`, `BusError`, `InvalidValue`, and `Saturated`.

This makes a failed read data, not hidden control flow.

### 4. Evidence contract

`experiments::EvidenceRecord` converts acquisition state into experiment evidence. It carries sequence identity, scheduler timestamp, sample interval, read duration, acquisition status, and quality flags.

Quality flags expose conditions such as sensor readiness/error, timing lateness, calibration defaults, saturation, warm-up state, unavailable derived values, and dropped events. Rows are timestamped from `EvidenceRecord`, not from ad-hoc print-time calls.

The current v3 audit requires every Engineering Lab sketch to use a recognized acquisition path, produce `EvidenceRecord`, emit its timestamp and quality flags, and use `SampleClock` for periodic experiments. Event-driven photogate acquisition is intentionally exempt from fixed-period timing because its scientific clock is the event timestamp itself.

### 5. Numerical measurement primitives

The reusable numerical layer includes online statistics, RMS accumulation, trapezoidal integration, finite differences, linear regression, and bounded ring buffers.

Numerical code consumes explicit timing where timing matters. For example, derivatives and integrals use actual intervals rather than assuming ideal constant `dt`. Derived quantities remain labeled as derived because differentiation, filtering, and regression change the relationship between raw observation and output.

### 6. Signal processing

Transparent primitives such as exponential moving average, peak hold, threshold triggering, and hysteresis provide reusable behavior without hiding parameters. Filtering and event thresholds remain experiment configuration, not invisible implementation details.

### 7. Experiment layer

Arduino sketches are thin composition points:

```text
device / adapter
+ scheduler or event clock
+ evidence contract
+ optional filter / statistics / derivative / integral
+ experiment-specific derived quantities
+ telemetry
```

A migration is successful when the sketch becomes simpler without changing its scientific observable, timing semantics, CSV columns, units, or documented assumptions.

### 8. Telemetry

`EngineeringLabStream` centralizes experiment metadata and CSV emission. Telemetry preserves schema identifiers, units, timing fields, read duration, and quality flags so that downstream software can distinguish a usable observation from a degraded one.

Binary transport, CRC framing, stronger schema typing, and synchronization metadata are possible future extensions, but CSV remains the inspectable compatibility surface today.

## Deterministic verification

The same architecture is verified in multiple ways:

```text
platform-neutral C++
   ├─ native g++ tests
   ├─ deterministic fake-sensor / clock tests
   ├─ Arduino UNO compile
   ├─ ESP32-S3 compile
   ├─ Engineering Lab contract audit
   └─ full Sensor Suite integrity compile
```

Native tests verify behavior rather than compilation alone. Embedded builds verify the same headers remain usable on constrained targets. The full Sensor Suite gate protects older recipes from regressions when shared C++ Core code changes.

## Migration strategy

Migration is incremental and behavior-preserving.

- Shared timing and numerical primitives are already centralized.
- All nine catalogued Engineering Lab experiments use the v3 evidence contract.
- Periodic experiments use `SampleClock`; the photogate keeps its event-driven timestamp model.
- Representative real devices now use the HAL adapter boundary.
- Additional device migrations should happen when they reduce duplicated acquisition logic without changing scientific semantics.

A device does not need to be migrated merely for consistency if an event-driven or multi-device experiment requires a different acquisition shape. The architecture defines contracts, not one mandatory class hierarchy for every sensor.

## What remains intentionally downstream

The embedded core should not absorb large-scale model fitting, Monte Carlo analysis, publication plots, uncertainty propagation, residual studies, or final scientific validation. Those belong in Engineering Lab and related desktop analysis paths.

Likewise, BetterBoard should not grow C++ simply to change a language-percentage chart. C++ is used where it improves embedded acquisition, hardware abstraction, deterministic measurement, numerical primitives, and experiment reliability.

## Near-term extensions

Future improvements should build on the current contracts rather than replace them:

- typed units and compile-time schema definitions
- explicit calibration provenance objects
- sequence IDs plus CRC for structured transport
- optional binary packets alongside CSV
- synchronized multi-sensor acquisition metadata
- uncertainty metadata where it can be represented honestly at acquisition time
- selected hardware-in-the-loop acceptance tests when reproducible hardware is available

The central design principle remains unchanged: BetterBoard should know not only a sensor number, but when it was produced, whether it is trustworthy, why it may be untrustworthy, and what assumptions surround its use.