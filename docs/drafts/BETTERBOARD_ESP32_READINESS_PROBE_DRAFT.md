# BetterBoard ESP32 Readiness Probe — DRAFT / RESEARCH STAGE

> Status: research-stage firmware only. Not canonical, not registered in the BetterBoard recipe catalog, not validated on real hardware yet, and not intended to modify `main`.
>
> Branch: `numeric-error-research-pack`

## Purpose

Provide the first conservative ESP32-family firmware for BetterBoard without guessing the exact user board, pin map, ADC pin, or peripheral wiring.

The readiness probe is deliberately pin-neutral. It does not drive external GPIO and does not assume a sensor. The goal is to establish the platform path first:

```text
ESP32 board/core
→ compile
→ upload
→ serial connection
→ runtime identification
→ timing smoke test
→ float32 vs float64 numerical smoke test
```

Firmware path:

```text
src-tauri/resources/firmware/ESP32ReadinessProbe/ESP32ReadinessProbe.ino
```

## Current commands

```text
INFO
FLOAT
TIMING <period_us> <samples>
BENCH <iterations>
SCHEMA
HELP
```

### INFO

Reports runtime evidence such as:

- chip model
- chip revision
- reported core count
- CPU frequency
- flash size
- free heap / minimum free heap
- sketch size / free sketch space
- `sizeof(float)`
- `sizeof(double)`
- `FLT_EPSILON`
- `DBL_EPSILON`

This is intended to confirm what ESP32-family target is actually connected rather than assuming a model from appearance alone.

### FLOAT

Produces a small float32/float64 comparison using `1/10` and `sin(1)`. This is a smoke test only, not a high-precision reference experiment.

### TIMING

Runs a bounded scheduler timing probe and emits:

```text
run_id,requested_us,samples,min_error_us,max_error_us,mean_error_us,rms_error_us
```

Example concept:

```text
TIMING 1000 1000
```

This asks the MCU to target a 1000 us period for 1000 iterations and reports lateness relative to the requested deadlines.

### BENCH

Runs repeated addition separately in float32 and float64 and emits:

```text
run_id,iterations,float32_sum,float64_sum,float32_elapsed_us,float64_elapsed_us
```

This provides the first simple ESP32 numerical-performance evidence path for later BetterBoard / Numerical Error comparisons.

## Why no GPIO / ADC yet

The exact ESP32 board is not yet identified. ESP32, ESP32-S3, ESP32-C3 and board-vendor variants do not share one universal safe pin map. Some GPIOs may be boot-sensitive, reserved, USB-related, flash-related, input-only, or have model-specific ADC behavior.

Therefore this first firmware intentionally does **not**:

- choose a default ADC pin;
- drive an LED pin;
- assume a BOOT button pin;
- assume I2C pins;
- assume 5 V tolerance;
- enable Wi-Fi/Bluetooth automatically.

The next hardware-specific layer should be added only after the exact board/model or a reliable pinout is known.

## BetterBoard integration gate

Before this becomes a real BetterBoard recipe, verify:

1. exact ESP32 board model;
2. correct Arduino CLI FQBN;
3. `esp32:esp32` core availability;
4. firmware compile on that FQBN;
5. successful USB upload;
6. serial output at 115200;
7. `INFO`, `FLOAT`, `TIMING`, and `BENCH` command behavior;
8. capture schema handling;
9. upload/capture port ownership behavior;
10. repeatability across at least several runs.

Only after those checks should the board profile and recipe catalog be updated.

## Future V2 candidates

After board identification:

- explicit board-profile capability map;
- safe GPIO input test;
- board-specific ADC test;
- PWM output test on a confirmed pin;
- interrupt timing test;
- FreeRTOS task jitter experiment;
- Wi-Fi measurement transport;
- float32 / float64 / fixed-point Numerical Bench;
- ESP32 vs UNO comparison campaigns.

## Evidence boundary

Compile success alone is not hardware validation. Runtime chip reports are implementation evidence, not calibration. Timing results measure the behavior of this firmware/runtime configuration and should not be generalized into a guaranteed real-time specification for every ESP32 board.
