# BetterBoard C++ Core

BetterBoard Core is the reusable embedded C++ layer shared by BetterBoard firmware and Engineering Lab acquisition sketches.

## Existing capabilities

- deterministic periodic sampling (`PeriodicSampler`)
- fixed-capacity buffering (`RingBuffer`)
- numerical helpers for derivatives, integration, regression, RMS, and online statistics
- signal-processing helpers such as EMA, hysteresis, threshold triggering, and peak hold
- Engineering Lab stream framing and evidence-quality flags

## C++ v3 acquisition contracts

The v3 foundation moves acquisition reliability out of individual sketches and into reusable, testable contracts:

```text
hardware / sensor
      ↓
AcquisitionResult<T>
      ↓
SampleClock
      ↓
EvidenceRecord
      ↓
EngineeringLabStream
```

### `measurement/AcquisitionResult.h`
Carries the typed sample value together with an explicit acquisition status, acquisition timestamp, and read duration. Failures such as `NotReady`, `Timeout`, `BusError`, and `InvalidValue` are represented explicitly rather than being converted into plausible numeric data.

### `core/SampleClock.h`
Tracks actual inter-sample spacing and lateness independently of the scheduler. This separates *when a sample was requested* from *what timing evidence was actually observed*.

### `experiments/EvidenceRecord.h`
Bridges acquisition status into the Engineering Lab evidence contract. It preserves sequence/timing/read-duration provenance and maps acquisition failures into composable quality flags.

### `core/Clock.h`
Provides an injectable clock interface plus a deterministic manual clock for native tests.

### `hal/FakeSensor.h`
Provides a fixed-capacity, no-heap scripted sensor source for native failure-mode testing.

## Production migration

The v3 path is already used by representative Engineering Lab firmware while preserving the existing CSV schemas:

- `EL_Numerical_ADC_Reference`: timing/provenance flow through `SampleClock`, `AcquisitionResult<int>`, and `EvidenceRecord`; rail saturation remains an evidence-quality condition while the raw ADC code is retained.
- `EL_Numerical_BME280_Context`: finite-value validation becomes an explicit `InvalidValue` acquisition failure, which maps to the Engineering Lab `SensorError` quality flag and emits blank measurements rather than fake numeric values.

The migration is intentionally incremental. Existing sketches remain source-compatible while more experiments move onto the shared acquisition contract.

## Verification

Native C++ tests exercise normal samples, late timing, explicit acquisition failures, deterministic fake-sensor replay, exhaustion/reset, provenance fields, and quality-flag mapping. CI also compiles the core and migrated firmware for Arduino UNO and ESP32-S3.
