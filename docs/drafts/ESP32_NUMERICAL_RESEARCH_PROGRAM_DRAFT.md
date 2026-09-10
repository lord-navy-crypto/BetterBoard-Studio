# ESP32 Numerical Research Program — DRAFT

Status: **research preparation only**. Not canonical, not registered in the BetterBoard recipe catalog, not merged to `main`, and not hardware-validated yet.

## Why ESP32 should not be treated as a faster UNO

The ESP32 family creates numerical experiments that are difficult or artificial on an AVR UNO: real 64-bit `double` on common ESP32 toolchains, FreeRTOS scheduling, multicore on some variants, a 64-bit high-resolution ESP timer, Wi-Fi radio/background work, much larger RAM, and optional external PSRAM. BetterBoard should use those capabilities to study how numerical behavior changes when computation shares a real embedded system with scheduling, transport, memory, and concurrency.

The central research question becomes:

> When an embedded algorithm moves from a tiny single-loop MCU into a multitasking, network-capable system, which errors come from arithmetic, which come from the algorithm, and which come from the execution environment?

## Research tracks

### 1. Float32 vs float64 precision/throughput

Measure the same deterministic workload in `float` and `double`. Record result, elapsed time, machine epsilon, and host-reference error. Do not assume float64 is automatically preferable: the correct engineering question is the accuracy/time/resource tradeoff.

Candidate metrics:
- absolute and relative error;
- ULP error where the host analyzer can compute it safely;
- elapsed microseconds;
- throughput per iteration;
- RAM/stack impact in future versions.

### 2. Naive vs compensated summation

Use a cancellation-heavy deterministic sequence and compare:
- naive float32;
- Kahan float32;
- naive float64;
- Kahan float64;
- host Decimal/high-precision reference.

This separates precision from algorithm design. A better algorithm in lower precision may outperform a worse algorithm in higher precision.

### 3. Order and associativity study

Evaluate the same series in:
- forward order;
- reverse order;
- pairwise reduction;
- later: magnitude-sorted order on the host.

The mathematical sum is unchanged, but finite-precision results can move. This provides a direct embedded demonstration that floating-point addition is not associative.

### 4. Range reduction and Taylor reliability

Run sine approximation with:
- raw argument, float32;
- range-reduced argument, float32;
- raw argument, float64;
- range-reduced argument, float64;
- MCU `sinf` / `sin` only as local comparisons;
- host mpmath as the preferred truth reference.

Scan small and extreme arguments. Record runtime and error to show that precision alone cannot repair a numerically poor formulation.

### 5. FreeRTOS timing jitter

Use `esp_timer_get_time()` to schedule repeated deadlines. Compare baseline timing against a compute-heavy background task. Record:
- requested period;
- min/max lateness;
- mean lateness;
- RMS lateness;
- deadline misses;
- background-work iterations.

This converts timing error from a vague software effect into a measurable component of the experiment uncertainty chain.

### 6. Radio-induced timing perturbation

Start an asynchronous Wi-Fi scan while the timing loop runs. Compare it with baseline jitter and CPU-load jitter.

Scientific boundary: this does **not** establish a universal Wi-Fi penalty. Scan behavior depends on chip variant, core version, radio environment, scheduler state, and power settings. The result is evidence for one run and one configuration.

### 7. Multicore/grouped reduction

On dual-core ESP32 variants, split a deterministic sum into two chunks and run workers on separate cores. On single-core variants, preserve the same grouped algorithm but both tasks remain on core 0.

Compare:
- sequential result;
- grouped result;
- sequential time;
- worker/grouped time;
- core count.

The key result is not merely speedup. Grouping changes the floating-point operation tree and may change the numerical answer.

### 8. Timer semantics

Compare Arduino `micros()` and ESP-IDF `esp_timer_get_time()`:
- elapsed-time agreement over a short interval;
- approximate read overhead;
- 32-bit vs 64-bit timestamp semantics;
- later campaign: explicit rollover-safe subtraction tests for `micros()`.

This is valuable for photogate and event-timing experiments because timestamp representation itself is part of numerical correctness.

### 9. PSRAM-backed numerical workloads

If PSRAM is detected, allocate a large deterministic float dataset and compare naive vs compensated summation. This adds a memory-system dimension:
- large N impossible or inconvenient on UNO;
- external-memory latency;
- numerical error accumulation over long sequences;
- algorithmic accuracy versus memory/compute cost.

If PSRAM is absent, the experiment must emit SKIP/absence evidence rather than pretending the capability exists.

### 10. Accuracy × time × memory Pareto study

Future BetterBoard analysis should combine multiple methods into a Pareto view rather than naming one universal winner. For example:
- float32 naive: fastest/smallest but less accurate;
- float32 Kahan: more operations, often much lower error;
- float64 naive: higher precision but potentially slower;
- float64 Kahan: strongest arithmetic result but highest compute cost;
- pairwise: parallel-friendly and often numerically improved.

### 11. Scheduler-aware sensor numerics

After the exact board/pins are known, connect numerical timing to real sensors:
- ADC sample interval jitter;
- photogate timestamp error;
- I2C acquisition timing;
- filtering with irregular `dt`;
- derivative/integration error under nonuniform sampling.

The correct model should use measured timestamps rather than assuming a perfectly constant sample period.

### 12. Networked measurement integrity

A later Wi-Fi transport experiment should distinguish:
- acquisition timestamp;
- queue timestamp;
- transmission timestamp;
- host receipt timestamp.

Network latency must never be confused with sensor timing. ESP32 makes this distinction especially important because acquisition and transport can run asynchronously.

## Current research firmware

`src-tauri/resources/firmware/ESP32NumericalResearchSuite/ESP32NumericalResearchSuite.ino`

Commands currently drafted:

```text
INFO
PRECISION
SUM <n>
SERIES <n>
TAYLOR <x> <terms>
JITTER <period_us> <samples>
LOADJITTER <period_us> <samples>
WIFIJITTER <period_us> <samples>
TIMER <samples>
DUALCORE <n>
PSRAM <n>
SCHEMA
HELP
```

No command touches external GPIO.

## Host analysis

`scripts/esp32_numerical_research_analyzer.py` parses captured output and adds independent references. Deterministic sums use Decimal precision; transcendental reference prefers mpmath at 80 decimal digits when available. MCU `sin`/`sinf` must remain comparison implementations, not truth.

## BetterBoard future integration

Do not expose this as one giant permanent recipe. After hardware validation, split it into experiment cards sharing one ESP32 numerical backend:

- Precision & Representation;
- Summation Reliability;
- Reduction Order;
- Taylor / Range Reduction;
- Scheduler Jitter;
- Radio Interference;
- Multicore Reduction;
- Timer Semantics;
- PSRAM Large-N;
- Accuracy-Time-Memory Campaign.

The UI should show capability gates. `DUALCORE` should say whether the target has one or multiple cores. `PSRAM` should show detected/absent. Wi-Fi experiments should be labeled environment-dependent.

## Promotion gate

Before any ESP32 numerical experiment becomes canonical:

1. identify exact board/chip and FQBN;
2. compile under the selected Arduino-ESP32 core;
3. upload and verify serial protocol;
4. run deterministic host-reference checks;
5. capture at least three replicates for timing experiments;
6. compare baseline/load/radio timing under the same period/sample count;
7. record chip model, revision, CPU frequency, core count, core version, and PSRAM status;
8. verify no hidden GPIO assumption;
9. document known variant limitations;
10. only then register the recipe in BetterBoard.

## Explicit non-claims

This draft does not claim that ESP32 is more accurate than UNO, that float64 is always better, that dual-core is always faster, that Wi-Fi always worsens timing, or that all ESP32 boards have PSRAM/two cores/the same ADC/timer behavior. Those are hypotheses to test, not assumptions to encode.
