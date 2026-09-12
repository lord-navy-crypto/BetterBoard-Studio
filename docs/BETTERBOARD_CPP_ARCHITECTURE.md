# BetterBoard Embedded C++ Architecture

## Purpose

BetterBoard Studio already contains a large body of Arduino firmware, numerical experiments, ESP32 research programs, and Sensor Suite recipes. The next architectural step is not to multiply isolated sketches indefinitely. It is to make embedded C++ a first-class, reusable scientific layer of the project.

The goal of the BetterBoard C++ Core is therefore twofold: improve firmware quality and make the repository's C++ content represent real engineering structure rather than duplicated example code.

The target architecture is:

```text
physical system
    ↓
sensor / actuator hardware
    ↓
C++ device adapter
    ↓
timestamped measurement
    ↓
C++ numerical and signal-processing primitives
    ↓
quality / validity state
    ↓
serial telemetry
    ↓
BetterBoard capture
    ↓
LabBridge measurement asset
    ↓
Engineering Lab calibration, V&V, UQ, and model comparison
```

This boundary matters. BetterBoard firmware is allowed to acquire, timestamp, filter, integrate, differentiate, summarize, and label measurements. It must not silently convert an uncalibrated observation into scientific truth. Calibration interpretation, uncertainty, residual analysis, and model validation remain explicit downstream work.

## Why a C++ core is needed

Many existing sketches independently implement the same classes of behavior: periodic sampling, timing with `micros()`, moving statistics, derivatives, numerical integration, threshold events, peak holding, encoder kinematics, and repeated `Serial.print()` output. Repetition makes individual sketches easy to create but expensive to maintain. A bug in timing logic can appear in many files; a numerical improvement must be copied manually; and testing is mostly limited to whether the sketch compiles.

A reusable C++ layer changes that. Algorithms become ordinary `.h/.cpp` code, can be exercised on a desktop compiler, and can then be reused by UNO and ESP32 sketches. Arduino programs become experiment entry points rather than containers for every implementation detail.

## Layer model

### 1. Core timing

The core timing layer owns non-blocking scheduling primitives. The first implementation is `betterboard::core::PeriodicSampler`. It accepts externally supplied microsecond timestamps, which keeps the class independent of Arduino and therefore native-testable. Wrap-safe unsigned arithmetic is used so sketches do not need custom scheduling loops.

Future timing components should include timestamp normalization, elapsed-time helpers, bounded jitter measurement, event clocks, and optional fixed-rate catch-up policies. Timing policy must remain explicit because irregular `dt` is scientifically relevant for derivatives and integrals.

### 2. Numerical measurement primitives

The first numerical layer contains `OnlineStatistics`, `TrapezoidIntegrator`, and `FiniteDifference`.

`OnlineStatistics` uses a numerically stable one-pass update rather than accumulating `sum` and `sumSquares`. It produces mean, population/sample variance, standard deviation, extrema, and peak-to-peak without storing a full window.

`TrapezoidIntegrator` consumes explicit timestamps. This is important because embedded sampling is not perfectly uniform. A power experiment can integrate power into energy; a magnetic scan can integrate field over position; and a gyro experiment can integrate angular rate. The class rejects non-positive time steps instead of silently integrating invalid ordering.

`FiniteDifference` likewise uses the actual interval between samples. Derived velocity, acceleration, jerk, angular acceleration, and current-step rates can all reuse the same primitive. A derivative should always remain labeled as derived data because differentiation amplifies noise.

Future numerical modules can include bounded ring buffers, RMS windows, covariance, linear regression, least-squares system identification, interpolation, robust statistics, and uncertainty-friendly summary objects.

### 3. Signal processing

The first signal layer provides `ExponentialMovingAverage` and `PeakHold`. They are intentionally small and transparent. Filters should never hide their parameters, and firmware should expose enough metadata for later interpretation.

The planned signal layer can later add moving-average windows, hysteresis comparators, debounce state machines, threshold triggers, edge detectors, simple biquad filters where justified, and windowed spectral front ends. Heavy model fitting and final spectral interpretation belong in Engineering Lab rather than inside small microcontrollers.

### 4. Measurement quality

A measurement pipeline needs more than a number. `measurement::Quality` introduces a minimal explicit state: valid, warming up, out of range, sensor error, timing invalid, or calibration missing.

This is the beginning of a larger principle: failure and uncertainty should be represented in data, not hidden in control flow. A sensor returning stale or invalid data should not quietly emit a plausible zero. A missing calibration should remain distinguishable from a sensor fault.

### 5. Device adapters

The first C++ Core release is deliberately sensor-neutral. The next major layer should introduce adapters for the hardware already used by BetterBoard: LSM6DSOX, ADXL345, MLX90393, VL53L1X, INA219, BME280, HX711, quadrature encoders, photogates, and TB6612-class low-voltage motor drivers.

Adapters should normalize device initialization and raw acquisition while preserving the manufacturer's observable. For example, an IMU adapter may expose acceleration and angular rate, but it should not silently claim absolute position. A magnetometer adapter may expose vector magnetic field, but background subtraction and coordinate-frame interpretation must be explicit experiment choices.

### 6. Experiment layer

The long-term objective is to let sketches express experiments in a compact way. A sketch should declare hardware, schedule, and output behavior, while reusable implementation stays in C++ modules.

A future pendulum sketch might only configure an encoder and IMU, call a scheduler, read a synchronized sample, and stream the result. The same statistics, derivative, and integration code can then serve oscillation, motor characterization, magnet scans, and reliability experiments.

### 7. Telemetry layer

The present BetterBoard capture path depends on serial numeric data. A future C++ telemetry layer should centralize CSV framing, headers, schema/version identifiers, validity flags, and optional structured packets. It should remain deterministic and simple enough to inspect manually.

The telemetry layer must preserve a distinction between direct observations and derived values. Column naming and units should be part of the declared contract. BetterBoard may then package those columns into a LabBridge measurement asset without inventing scientific meaning.

## Host-testable embedded code

The architecture deliberately separates Arduino-independent computation from hardware APIs. This enables two verification paths for the same code.

```text
shared C++ source
   ├─ native g++ tests
   ├─ Arduino UNO compile
   └─ ESP32-S3 compile
```

Native tests give deterministic checks for numerical behavior. Arduino compilation proves the same code remains compatible with embedded targets. Hardware-in-the-loop tests can be added later when physical devices are available.

This is stronger than compile-only firmware validation because algorithms such as integration and variance can be checked against known values before real sensors are attached.

## Migration strategy for the existing firmware museum

The 56 Sensor Suite recipes should not be rewritten all at once. Migration should be incremental and behavior-preserving.

Phase A extracts neutral primitives: scheduling, statistics, derivatives, integration, filtering, peak detection, and quality state. That is the purpose of C++ Core v0.1.

Phase B selects representative sketches from each domain and converts them into thin entry points: one ADC statistics experiment, one IMU experiment, one magnetometer experiment, one encoder experiment, one power experiment, and one actuator characterization experiment. Their existing serial columns and scientific boundaries should remain unchanged.

Phase C adds device adapters and common telemetry. Once the adapters are stable, additional sketches can migrate with much less code.

Phase D introduces reusable experiment components such as synchronized multi-sensor capture, step/ramp campaigns, repeatability windows, and system-identification stimulus generators.

Phase E adds stronger host tests and selected hardware-in-the-loop acceptance tests.

At every phase, the existing Program Library remains usable. The C++ Core is an implementation improvement, not a reason to invalidate working recipes.

## Repository language strategy

Making C++ the leading GitHub language should be a consequence of real architecture. The repository should gain `.cpp/.h` source because algorithms, drivers, tests, and experiment infrastructure genuinely belong there. Artificial filler files would make the language bar change without improving BetterBoard.

A healthy long-term distribution is a C++-heavy embedded/scientific core, Rust for trusted desktop/backend integration, TypeScript for UI, and Python for analysis/build tooling. These languages have different jobs. The objective is not to delete the others; it is to make C++ represent the project's physical-computing center of gravity.

## Design rules

1. Shared scientific algorithms belong in `.h/.cpp`, not copied between sketches.
2. Arduino sketches should remain thin and readable.
3. Timing must be explicit; `delay()` should not be the default scheduler for research acquisition.
4. Derived quantities must be identifiable as derived.
5. Invalid samples must not masquerade as valid zeros.
6. Calibration state must be explicit.
7. The same numerical code should be native-testable whenever possible.
8. UNO and ESP32-S3 remain reference compile targets unless a module is intentionally platform-specific.
9. Hardware adapters must preserve the sensor's actual observable and avoid exaggerated claims.
10. Engineering Lab remains the authority for calibration interpretation, uncertainty, V&V, and model-to-measurement conclusions.

## C++ Core v0.1 scope

The initial implementation intentionally stays small enough to audit. It includes a periodic sampler, stable online statistics, trapezoid integration, finite differences, EMA filtering, peak hold, and basic quality flags. It also includes a native unit test program and an Arduino example that compiles for both UNO and ESP32-S3.

This creates the structural foundation required for a much larger migration while avoiding a risky rewrite of the existing 56-program Sensor Suite.
