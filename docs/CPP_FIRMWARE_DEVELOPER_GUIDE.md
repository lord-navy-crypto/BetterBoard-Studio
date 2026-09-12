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
    // Optional: preserve legacy startup cadence by arming at the current timestamp.
    sampler.reset(micros());
}

void loop() {
    const uint32_t now_us = micros();
    if (!sampler.ready(now_us)) return;

    // acquire and emit one sample
}
```

The scheduler is designed around unsigned microsecond timestamps and advances its next deadline rather than resetting cadence from the current instant. This reduces accumulated phase drift from ordinary loop overhead. When migrating an older sketch that waited one complete sample interval before its first read, explicitly arm/reset the sampler in `setup()` so the startup contract stays unchanged.

## Online statistics and RMS

Use `OnlineStatistics` for windows where retaining every sample is unnecessary:

```cpp
betterboard::math::OnlineStatistics stats;
stats.push(value);
```

The implementation uses Welford-style updates and provides population/sample variance, standard deviation, extrema, and peak-to-peak. Use `RmsAccumulator` when RMS is the actual experiment quantity rather than reconstructing it ad hoc in each sketch.

Current migrations demonstrate three patterns:

- `ADC_NoiseStatistics`: one online statistics window replaces hand-maintained sum/sum-square/min/max state.
- `LSM6DSOX_BiasSurvey`: six independent online statistics windows track three accelerometer and three gyroscope axes without duplicated sum/sum-square formulas.
- `MLX90393_FieldStatistics`: three online statistics windows provide axis means and standard deviations before the sketch derives vector magnitude from the axis means.

This is safer than duplicating `sum2 / n - mean^2` logic in many sketches and gives the host-side test suite one implementation to verify.

## Numerical integration and finite differences

Use explicit timestamps:

```cpp
betterboard::math::TrapezoidIntegrator energy;
energy.push(time_s, power_w);
const double energy_j = energy.value();
```

Do not assume constant `dt` unless the experiment contract explicitly establishes it. The integrator ignores non-positive time steps so reversed or duplicate timestamps do not silently corrupt the result.

`INA219_Energy` now uses the shared integrator with `time_s` and `power_mW`; the numerical result therefore remains in mW·s, i.e. mJ, preserving the existing serial contract while removing duplicated trapezoid bookkeeping from the sketch.

Derived rates should also use the actual timestamp:

```cpp
betterboard::math::FiniteDifference velocity;
if (velocity.push(time_s, position_m)) {
    const double velocity_mps = velocity.derivative();
}
```

`EncoderKinematics` demonstrates a staged derivative chain: encoder count is converted to angle, angle is pushed into one finite-difference object to obtain angular velocity, and valid angular velocity is pushed into a second finite-difference object to obtain angular acceleration. The sketch retains zero outputs until each derivative stage has enough history, matching the previous startup behavior without duplicating time-step arithmetic.

Remember that differentiation amplifies noise. A firmware-derived velocity, acceleration, or jerk is not equivalent to a directly measured quantity. Preserve this distinction in column names and recipe notes.

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

`PeakHold`, `ThresholdTrigger`, and `HysteresisLatch` cover common transient and state-detection patterns. Trigger and hysteresis thresholds must remain explicit experiment parameters rather than invisible magic numbers.

A migration must preserve event semantics. For example, `ADC_StepDetector` uses `PeriodicSampler` for timing but keeps its existing per-sample delta comparison because a latched threshold trigger would change the output contract from "event on this sample" to "state has ever triggered". Reuse the shared primitive only when its semantics actually match the experiment.

## Bounded buffering

Use `core::RingBuffer<T, N>` when recent history is required. It has fixed compile-time capacity and performs no dynamic allocation. This is preferred over unbounded containers for small microcontroller targets.

## Timestamped samples

`measurement::Sample<T>` is a minimal carrier for a timestamp, a value, and an explicit validity flag. It is intentionally small so future device adapters can return observations without inventing a plausible numeric value after a failed sensor read.

## Measurement quality

A future sensor-adapter layer should attach `measurement::Quality` to observations. Until adapters are introduced, sketches can still use the enum explicitly when producing state columns or deciding whether a derived quantity is valid.

Important principle: a failed sensor read must not be converted into a plausible numeric zero unless zero is actually the measured value.

## Migrating an existing sketch

Migrate one concern at a time. First replace duplicated scheduling. Then move statistics. Then move derivative/integration code. Keep serial column names, units, and recipe metadata stable during each migration unless there is a separate reason to change the data contract.

The current representative migration set spans multiple domains:

```text
ADC_NoiseStatistics        -> scheduler + online statistics
ADC_StepDetector           -> scheduler only; event semantics stay local
ADXL345_VibrationRMS       -> scheduler + RMS accumulator + peak hold
INA219_Energy              -> scheduler + trapezoid integration
LSM6DSOX_BiasSurvey        -> scheduler + six online statistics windows
MLX90393_FieldStatistics   -> scheduler + three online statistics windows
EncoderKinematics          -> scheduler + two-stage finite differences
```

This is intentional. The goal is not to mass-edit all 56 recipes at once. The goal is to prove shared primitives across different measurement domains while keeping each recipe/data contract stable.

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

Every platform-neutral C++ component should be testable with a desktop compiler. Tests should check simple known cases, edge cases, and invalid timing.

The C++ Core CI covers native tests and representative migrated sketches, while the frozen Sensor Suite integrity workflow compiles all 56 recipes against the local BetterBoard Core library for both board families:

```text
native g++ compile with warnings-as-errors
→ native unit tests
→ Arduino UNO core example compile
→ ESP32-S3 core example compile
→ representative migrated sketch compiles
→ full 56-recipe UNO compile with local BetterBoard Core
→ full 56-recipe ESP32-S3 compile with local BetterBoard Core
```

That split gives fast focused feedback plus a full compatibility gate. Changes under `firmware/betterboard-core/**` must trigger the Sensor Suite workflow because a shared-library change can affect migrated recipes even when no sketch file changed.

Hardware-in-the-loop acceptance should be added only when real hardware is available and the test is reproducible.

## What stays outside the embedded core

The firmware core should not absorb all of Engineering Lab. Keep large-scale model fitting, uncertainty propagation, publication plots, residual studies, Monte Carlo analysis, and final scientific validation downstream.

Likewise, do not move desktop UI responsibilities into C++ merely to increase the repository's C++ percentage. C++ should grow where it is the appropriate implementation language: embedded acquisition, numerical primitives, hardware abstractions, and deterministic experiment infrastructure.

## Near-term migration candidates

The next representative migrations should target magnetometer baseline/field integration, IMU integration and bias-corrected motion experiments, motor step-response characterization, power stability/transient experiments, and multi-sensor synchronization. Prefer candidates that exercise an existing shared primitive or justify a new generally reusable primitive.
