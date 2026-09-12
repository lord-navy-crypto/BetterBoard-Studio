# BetterBoard C++ Firmware Developer Guide

## Scope

This guide defines how new and existing BetterBoard Arduino/ESP32 firmware should use the reusable C++ Core. It is written for contributors who are adding experiments, migrating older sketches, or building device adapters.

## The main rule

A sketch should describe an experiment. A reusable algorithm should live in the C++ library.

Good sketch responsibilities include selecting pins, initializing a device, choosing a sample rate, deciding which observables to emit, and defining experiment-specific parameters. Repeated statistics, derivative, integral, filtering, scheduling, validity handling, buffering, threshold logic, and regression should not be copied into many `.ino` files.

## Include the library

Use the umbrella header for ordinary sketches:

```cpp
#include <BetterBoard.h>
```

For highly constrained code, individual component headers may be included instead.

## Periodic sampling

Avoid using `delay()` as the main timing mechanism for research acquisition when timestamp quality matters. Use `PeriodicSampler` with `micros()`:

```cpp
betterboard::core::PeriodicSampler sampler(10000U);  // 100 Hz

void setup() {
    sampler.reset(micros());
}

void loop() {
    const uint32_t now_us = micros();
    if (!sampler.ready(now_us)) return;

    // acquire and emit one sample
}
```

Calling `reset(micros())` in `setup()` preserves the common legacy behavior of waiting one full sample period before the first acquisition. The scheduler advances its next deadline rather than resetting cadence from the current instant, reducing accumulated phase drift from ordinary loop overhead.

## Online statistics and RMS

Use `OnlineStatistics` for windows where retaining every sample is unnecessary:

```cpp
betterboard::math::OnlineStatistics stats;
stats.push(value);
```

The implementation uses Welford-style updates and provides population/sample variance, standard deviation, extrema, and peak-to-peak. Use `RmsAccumulator` when RMS is the actual experiment quantity rather than reconstructing it ad hoc in each sketch.

The current migration set uses these primitives for ADC noise, six-channel IMU bias/noise windows, three-axis magnetometer statistics, and ADXL345 vibration RMS. This removes several independent implementations of sum, sum-of-squares, min/max, and reset logic.

## Numerical integration and finite differences

Use explicit timestamps:

```cpp
betterboard::math::TrapezoidIntegrator energy;
energy.push(time_s, power_w);
const double energy_j = energy.value();
```

Do not assume constant `dt` unless the experiment contract explicitly establishes it. The integrator ignores non-positive time steps so reversed or duplicate timestamps do not silently corrupt the result. INA219 energy integration now uses this primitive while retaining the physical identity `mW × s = mJ`.

Derived rates should also use the actual timestamp:

```cpp
betterboard::math::FiniteDifference velocity;
if (velocity.push(time_s, position_m)) {
    const double velocity_mps = velocity.derivative();
}
```

Remember that differentiation amplifies noise. A firmware-derived velocity, angular velocity, acceleration, or jerk is not equivalent to a directly measured quantity. Preserve this distinction in column names and recipe notes. Encoder kinematics now uses staged finite differences for angle → angular velocity → angular acceleration instead of duplicating elapsed-time arithmetic.

## Linear regression

`LinearRegression` provides a small streaming least-squares primitive for experiments such as calibration previews, trend estimation, and first-pass system identification:

```cpp
betterboard::math::LinearRegression fit;
fit.push(command, response);
if (fit.valid()) {
    const double gain = fit.slope();
    const double offset = fit.intercept();
}
```

Firmware regression is a compact derived summary, not a replacement for downstream uncertainty analysis or model validation.

## Lightweight filtering and event logic

For a transparent one-pole smoother:

```cpp
betterboard::signal::ExponentialMovingAverage filter(0.2);
const double filtered = filter.push(raw);
```

The filter coefficient is part of the experiment and should be exposed or documented. Do not hide aggressive filtering that changes the apparent dynamics of a signal.

`PeakHold`, `ThresholdTrigger`, and `HysteresisLatch` cover common transient and state-detection patterns. Trigger and hysteresis thresholds must remain explicit experiment parameters rather than invisible magic numbers. A latched trigger must not be substituted for a one-sample event detector because persistent-state semantics and event semantics are different data contracts.

## Bounded buffering

Use `core::RingBuffer<T, N>` when recent history is required. It has fixed compile-time capacity and performs no dynamic allocation. This is preferred over unbounded containers for small microcontroller targets.

## Timestamped samples

`measurement::Sample<T>` is a minimal carrier for a timestamp, a value, and an explicit validity flag. It is intentionally small so future device adapters can return observations without inventing a plausible numeric value after a failed sensor read.

## Measurement quality

A future sensor-adapter layer should attach `measurement::Quality` to observations. Until adapters are introduced, sketches can still use the enum explicitly when producing state columns or deciding whether a derived quantity is valid.

Important principle: a failed sensor read must not be converted into a plausible numeric zero unless zero is actually the measured value.

## Migrating an existing sketch

Migrate one concern at a time. First replace duplicated scheduling. Then move statistics. Then move derivative/integration code. Keep serial column names, units, and recipe metadata stable during each migration unless there is a separate reason to change the data contract.

The first representative migration set now spans six different experiment patterns:

```text
ADC_NoiseStatistics
  → PeriodicSampler + OnlineStatistics

ADXL345_VibrationRMS
  → PeriodicSampler + RmsAccumulator + PeakHold

INA219_Energy
  → PeriodicSampler + TrapezoidIntegrator

LSM6DSOX_BiasSurvey
  → PeriodicSampler + six OnlineStatistics windows

MLX90393_FieldStatistics
  → PeriodicSampler + three OnlineStatistics windows

EncoderKinematics
  → PeriodicSampler + staged FiniteDifference derivatives
```

This diversity matters more than rewriting many nearly identical sketches at once: each migrated family exercises a different reusable primitive and exposes different portability risks.

A migration is complete only when the sketch still compiles for its supported board targets and the C++ primitive has a deterministic native test where practical.

## Device adapter design

When sensor wrappers are added, each adapter should have a narrow job:

```text
initialize hardware
read the device's actual observables
report validity / error state
expose configuration that materially affects the reading
```

An adapter should not over-interpret the measurement. An IMU does not know absolute position. A magnetometer does not know the user's laboratory coordinate frame unless that frame is explicitly defined. A load cell does not know newtons without calibration information.

## Experiment composition

As the library grows, an experiment should become a composition of reusable pieces:

```text
device adapter
+ scheduler
+ bounded buffer
+ optional filter / trigger / hysteresis
+ derivative / integral / regression
+ window statistics
+ validity state
+ telemetry
```

That structure is the basis for synchronized multi-sensor experiments and system-identification campaigns.

## Testing expectations

Every platform-neutral C++ component should be testable with a desktop compiler. Tests should check simple known cases, edge cases, invalid timing, and state-machine semantics.

The C++ Core workflow runs:

```text
native g++ compile with warnings-as-errors
→ native unit tests
→ Arduino UNO core example compile
→ ESP32-S3 core example compile
→ selected migrated firmware compile on both targets
```

The frozen Sensor Suite integrity workflow must also compile all 56 sketches with the local `firmware/betterboard-core` library in the Arduino CLI search path. This catches breakage that a single example sketch cannot reveal.

Hardware-in-the-loop acceptance should be added only when real hardware is available and the test is reproducible.

## What stays outside the embedded core

The firmware core should not absorb all of Engineering Lab. Keep large-scale model fitting, uncertainty propagation, publication plots, residual studies, Monte Carlo analysis, and final scientific validation downstream.

Likewise, do not move desktop UI responsibilities into C++ merely to increase the repository's C++ percentage. C++ should grow where it is the appropriate implementation language: embedded acquisition, numerical primitives, hardware abstractions, and deterministic experiment infrastructure.

## Near-term migration candidates

Continue domain-by-domain rather than mass rewriting all 56 recipes. Good next candidates are magnetometer baseline/integral scans, gyro integration, ToF kinematics, current-step detection, and motor step-response characterization. Each should preserve its existing recipe/data contract while moving reusable timing, numerical, and signal-processing logic into the shared library.
