# BetterBoard C++ Firmware Developer Guide

## Scope

This guide defines how BetterBoard Arduino/ESP32 firmware should use the current reusable C++ Core. It is for contributors adding experiments, migrating older sketches, or connecting new hardware.

The main rule is simple:

> A sketch should describe an experiment. Reusable acquisition, timing, evidence, numerical, and signal-processing behavior should live in the C++ Core.

## Include the library

For ordinary sketches:

```cpp
#include <BetterBoard.h>
```

The umbrella header exports the current timing, HAL, measurement, evidence, numerical, and signal-processing primitives.

## Choose the correct time model first

Before touching a sensor driver, decide whether the experiment is periodic or event-driven.

### Periodic acquisition

Use `PeriodicSampler` to decide when a sample belongs on the experiment timeline and `SampleClock` to record actual spacing and lateness:

```cpp
betterboard::core::PeriodicSampler sampler(10000U);
betterboard::core::SampleClock sample_clock(10000U);

void setup() {
  sampler.reset(micros());
}

void loop() {
  const uint32_t now = micros();
  if (!sampler.ready(now)) return;

  const auto timing = sample_clock.observe(now);
  // acquire one sample whose evidence timestamp is `now`
}
```

Do not use hardware-read completion time as the scientific sample timestamp. I2C/SPI/ADC latency belongs in `read_duration_us`.

### Event-driven acquisition

Do not force `SampleClock` onto an event experiment merely for API consistency. A photogate or interrupt-driven encoder event should preserve its event timestamp and event interval when those are the actual observables.

## Use the HAL boundary for reusable device acquisition

The current reusable hardware boundary is:

```cpp
betterboard::hal::ISensorAdapter<T>
```

For a typical synchronous device driver, use `ClockedSensorAdapter<T>`.

Define a narrow sample type:

```cpp
struct EnvironmentSample {
  float temperature_c{0.0f};
  float pressure_hpa{0.0f};
  float humidity_pct{0.0f};
};
```

Then write a device callback that does only driver I/O and status classification:

```cpp
betterboard::measurement::AcquisitionStatus readEnvironment(
    void* context, EnvironmentSample& sample) {
  auto* sensor = static_cast<Adafruit_BME280*>(context);

  sample.temperature_c = sensor->readTemperature();
  sample.pressure_hpa = sensor->readPressure() / 100.0f;
  sample.humidity_pct = sensor->readHumidity();

  if (!isfinite(sample.temperature_c) ||
      !isfinite(sample.pressure_hpa) ||
      !isfinite(sample.humidity_pct)) {
    return betterboard::measurement::AcquisitionStatus::InvalidValue;
  }

  return betterboard::measurement::AcquisitionStatus::Ok;
}
```

Connect it to an Arduino clock and adapter:

```cpp
Adafruit_BME280 bme;
betterboard::core::ArduinoClock acquisition_clock;
betterboard::hal::ClockedSensorAdapter<EnvironmentSample> sensor_adapter(
    acquisition_clock, &bme, readEnvironment);
```

At sample time:

```cpp
const auto acquisition = sensor_adapter.readAt(now);
```

The adapter preserves `now` as the evidence timestamp and measures the hardware call duration separately.

## Status classification

Use acquisition statuses deliberately:

```text
Ok            valid device observation
NotReady      device has no new observation yet
Timeout       acquisition exceeded the device/experiment timeout contract
BusError      transport or driver read failed
InvalidValue  driver returned a value that cannot be used as an observation
Saturated     device/range saturation is known
```

Do not convert a failed read into zero unless zero is actually the observed value.

## Convert acquisition into evidence

Every catalogued Engineering Lab experiment uses `EvidenceRecord`.

For a periodic sample:

```cpp
uint16_t flags = betterboard::experiments::evidence::Valid;
if (timing.late) {
  flags = betterboard::experiments::evidence::addFlag(
      flags,
      betterboard::experiments::evidence::TimingLate);
}

const auto record = betterboard::experiments::makeEvidenceRecord(
    sequence_id++, timing.sample_dt_us, acquisition, flags);
```

Emit rows from the record timestamp:

```cpp
stream.rowBegin(record.timestamp_us);
```

and emit the evidence quality flags:

```cpp
stream.field(static_cast<unsigned long>(record.quality_flags));
```

The v3 contract audit checks for these semantics.

## Preserve scientific meaning during migration

Internal architecture may change while the data contract stays stable. Unless the migration explicitly changes the experiment definition, preserve:

- experiment ID
- CSV column order
- units
- startup behavior
- calibration assumptions
- direct-vs-derived distinction
- event semantics

A migration that makes the code prettier but changes what a column means is not behavior-preserving.

## Fake sensors and deterministic testing

`FakeSensor<T, N>` implements the same `ISensorAdapter<T>` boundary as real hardware.

Use it to script success and failure cases without physical devices:

```cpp
betterboard::hal::FakeSensor<float, 3> fake;

fake.push(betterboard::measurement::AcquisitionResult<float>::success(
    3.25f, 1000U, 80U));

fake.push(betterboard::measurement::AcquisitionResult<float>::failure(
    betterboard::measurement::AcquisitionStatus::Timeout,
    1100U,
    100U));
```

This makes error propagation, quality mapping, and sequence behavior deterministic.

## Numerical primitives

Use shared numerical code instead of reimplementing formulas in sketches.

### Online statistics

```cpp
betterboard::math::OnlineStatistics stats;
stats.push(value);
```

Use `RmsAccumulator` when RMS is the actual experiment quantity.

### Integration

```cpp
betterboard::math::TrapezoidIntegrator energy;
energy.push(time_s, power_w);
const double energy_j = energy.value();
```

Use explicit time. Do not assume constant `dt` unless the experiment contract guarantees it.

### Finite differences

```cpp
betterboard::math::FiniteDifference velocity;
if (velocity.push(time_s, position_m)) {
  const double velocity_mps = velocity.derivative();
}
```

Differentiation amplifies noise; derived rates must remain identifiable as derived quantities.

### Regression

```cpp
betterboard::math::LinearRegression fit;
fit.push(command, response);
```

Firmware regression is a compact derived summary, not a substitute for downstream model validation or uncertainty analysis.

## Signal processing

Reusable transparent primitives include exponential moving average, peak hold, threshold trigger, and hysteresis latch.

Filter coefficients and thresholds are experiment parameters and must remain visible. Do not hide aggressive filtering that materially changes apparent dynamics.

## Bounded memory

Use `core::RingBuffer<T, N>` when recent history is required. It has fixed compile-time capacity and avoids dynamic allocation.

For microcontroller code, prefer bounded state and explicit ownership over heap-backed containers unless there is a clear reason otherwise.

## Multi-sensor experiments

Do not collapse multiple physical reads into a fake single timestamp if sensor skew matters.

For sequential sensor reads:

- keep the scheduler-owned experiment timestamp
- measure each device read duration when useful
- preserve inter-sensor skew explicitly when it affects interpretation
- expose partial invalidity instead of silently dropping healthy channels

The existing oscillation and dual-accelerometer experiments demonstrate why synchronization is part of scientific evidence rather than only a performance concern.

## Calibration

The HAL reports observations and acquisition state. It does not decide scientific calibration.

Examples:

- a load cell adapter may expose raw counts; newtons require explicit calibration provenance
- a magnetometer exposes vector field; laboratory-frame interpretation and background subtraction are experiment choices
- an IMU exposes acceleration/angular rate; it must not claim absolute position

Use quality flags or metadata to make default/missing calibration visible.

## Telemetry

Use `EngineeringLabStream` for Engineering Lab experiments. Telemetry should expose enough information for downstream judgment:

```text
timestamp
observable(s)
sample interval
read duration
quality flags
relevant calibration/configuration provenance
```

CSV remains the inspectable compatibility surface. Future structured/binary transport must not remove the ability to reason about evidence quality.

## Testing expectations

A change to the C++ Core is not complete merely because one sketch compiles.

The current verification stack includes:

```text
native g++ tests with warnings-as-errors
→ HAL/fake-sensor deterministic tests
→ Arduino UNO compile
→ ESP32-S3 compile
→ Engineering Lab schema audit
→ Engineering Lab v3 acquisition/evidence audit
→ Engineering Lab experiment compiles
→ full Sensor Suite integrity compile
```

When the exact PR HEAD changes, old green runs do not count. Re-run the gates for the new HEAD.

## Migration checklist

Before merging a firmware migration, verify:

1. the experiment uses the correct periodic or event-driven time model
2. acquisition failures are explicit
3. evidence timestamp semantics did not move during refactoring
4. `read_duration_us` measures device work rather than replacing the sample timestamp
5. quality flags still describe degraded conditions
6. CSV columns and units are unchanged unless intentionally versioned
7. derived quantities remain distinguishable from direct observations
8. deterministic tests cover reusable platform-neutral behavior when practical
9. UNO/ESP32 compile targets still pass where supported
10. the exact latest HEAD passes every required CI gate

## What stays outside the embedded core

Keep large-scale model fitting, Monte Carlo studies, publication plots, uncertainty propagation, residual analysis, and final scientific validation downstream in Engineering Lab or related desktop analysis tools.

The embedded layer should make evidence richer and failures more visible, not make unsupported claims about the physical system.

## Near-term extensions

Useful next extensions are evolutionary rather than architectural rewrites:

- typed units
- compile-time schema definitions
- calibration provenance objects
- sequence/CRC framing
- optional binary transport beside CSV
- synchronized multi-sensor metadata
- reproducible hardware-in-the-loop acceptance tests

The v3 HAL, acquisition, timing, and evidence contracts are the baseline these additions should build on.