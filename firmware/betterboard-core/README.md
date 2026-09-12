# BetterBoard C++ Core

`betterboard-core` is the reusable embedded C++ layer for BetterBoard Studio experiments. It exists to move repeated scientific and timing logic out of individual Arduino sketches and into tested, reusable code.

The first v0.1 surface intentionally stays sensor-neutral. It provides deterministic primitives that can be exercised both on a desktop compiler and on Arduino/ESP32 targets:

- `core::PeriodicSampler` for wrap-safe periodic scheduling without blocking `delay()` loops.
- `math::OnlineStatistics` for Welford mean/variance, standard deviation, min/max, and peak-to-peak.
- `math::TrapezoidIntegrator` for timestamp-aware numerical integration.
- `math::FiniteDifference` for timestamp-aware first derivatives.
- `signal::ExponentialMovingAverage` for lightweight low-pass filtering.
- `signal::PeakHold` for event/peak instrumentation.
- `measurement::Quality` for explicit measurement validity state.

The library is not a replacement for Engineering Lab calibration or V&V. Firmware may acquire measurements and compute clearly identified embedded derived quantities, but scientific interpretation, uncertainty propagation, model comparison, and final validation remain downstream responsibilities.

## Design rule

Sketches should become thin experiment entry points. Shared algorithms, time handling, validity semantics, and future sensor adapters belong in this library.

## Verification

Native C++ tests compile with `g++ -std=c++17 -Wall -Wextra -Werror`. The example sketch also compiles in CI for Arduino UNO and ESP32-S3 through Arduino CLI.
