# BetterBoard C++ Firmware Developer Guide

## Scope

This guide defines how new and existing BetterBoard Arduino/ESP32 firmware should use the reusable C++ Core. It is written for contributors who are adding experiments, migrating older sketches, or building device adapters.

## The main rule

A sketch should describe an experiment. A reusable algorithm should live in the C++ library.

Good sketch responsibilities include selecting pins, initializing a device, choosing a sample rate, deciding which observables to emit, and defining experiment-specific parameters. Repeated statistics, derivative, integral, filtering, scheduling, validity handling, and later sensor wrappers should not be copied into many `.ino` files.

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

void loop() {
    const uint32_t now_us = micros();
    if (!sampler.ready(now_us)) return;

    // acquire and emit one sample
}
```

The scheduler is designed around unsigned microsecond timestamps and advances its next deadline rather than resetting the cadence from the current instant. This reduces accumulated phase drift from ordinary loop overhead.

## Online statistics

Use `OnlineStatistics` for windows where retaining every sample is unnecessary:

```cpp
betterboard::math::OnlineStatistics stats;
stats.push(value);

if (stats.count() >= 128U) {
    Serial.println(stats.mean());
    stats.reset();
}
```

The implementation uses Welford-style updates and provides population/sample variance, standard deviation, extrema, and peak-to-peak.

## Numerical integration

Use explicit timestamps:

```cpp
betterboard::math::TrapezoidIntegrator energy;
energy.push(time_s, power_w);
const double energy_j = energy.value();
```

Do not assume constant `dt` unless the experiment contract explicitly establishes it. The integrator ignores non-positive time steps so reversed or duplicate timestamps do not silently corrupt the result.

## Finite differences

Derived rates should also use the actual timestamp:

```cpp
betterboard::math::FiniteDifference velocity;
if (velocity.push(time_s, position_m)) {
    const double velocity_mps = velocity.derivative();
}
```

Remember that differentiation amplifies noise. A firmware-derived velocity or jerk is not equivalent to a directly measured quantity. Preserve this distinction in column names and recipe notes.

## Lightweight filtering

For a transparent one-pole smoother:

```cpp
betterboard::signal::ExponentialMovingAverage filter(0.2);
const double filtered = filter.push(raw);
```

The filter coefficient is part of the experiment and should be exposed or documented. Do not hide aggressive filtering that changes the apparent dynamics of a signal.

## Peak hold

Peak hold is useful for shocks, impulses, and transient current measurements:

```cpp
betterboard::signal::PeakHold peak;
peak.push(sample);
```

Reset it at an explicit experiment boundary, not invisibly.

## Measurement quality

A future sensor-adapter layer should attach `measurement::Quality` to observations. Until adapters are introduced, sketches can still use the enum explicitly when producing state columns or deciding whether a derived quantity is valid.

Important principle: a failed sensor read must not be converted into a plausible numeric zero unless zero is actually the measured value.

## Migrating an existing sketch

Migrate one concern at a time. First replace duplicated scheduling. Then move statistics. Then move derivative/integration code. Keep serial column names, units, and recipe metadata stable during each migration unless there is a separate reason to change the data contract.

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
+ optional filter
+ optional derivative / integral
+ window statistics
+ validity state
+ telemetry
```

That structure is the basis for later synchronized multi-sensor experiments and system-identification campaigns.

## Testing expectations

Every platform-neutral C++ component should be testable with a desktop compiler. Tests should check simple known cases, edge cases, and invalid timing.

The CI sequence for the C++ Core is:

```text
native g++ compile with warnings-as-errors
→ native unit tests
→ Arduino UNO compile
→ ESP32-S3 compile
```

Hardware-in-the-loop acceptance should be added only when real hardware is available and the test is reproducible.

## What stays outside the embedded core

The firmware core should not absorb all of Engineering Lab. Keep large-scale model fitting, uncertainty propagation, publication plots, residual studies, Monte Carlo analysis, and final scientific validation downstream.

Likewise, do not move desktop UI responsibilities into C++ merely to increase the repository's C++ percentage. C++ should grow where it is the appropriate implementation language: embedded acquisition, numerical primitives, hardware abstractions, and deterministic experiment infrastructure.

## Near-term migration candidates

Representative existing firmware should be migrated before attempting a mass rewrite. Good candidates are ADC noise statistics, IMU bias/statistics, magnetometer baseline and field integration, encoder kinematics, INA219 energy integration, and motor step-response characterization. Together they exercise most of the reusable core without changing the whole Sensor Suite at once.
