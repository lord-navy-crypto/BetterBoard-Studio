# ESP32 Numerical Error Phase 2 — Draft

Status: RESEARCH DRAFT / NOT CANONICAL / NOT REGISTERED AS A BETTERBOARD RECIPE

This phase extends BetterBoard numerical-error research from scalar floating-point accuracy into scheduler-aware and concurrency-aware numerical reliability.

## Research thesis

On a more capable MCU, numerical reliability is not only a question of `float` versus `double`. The execution model itself can change the result. Grouping, task partitioning, scheduling, background load, timer behavior, memory placement, and communication activity can all change either the arithmetic result, the timing of a measurement, or both.

ESP32-family boards are especially useful because they expose substantially more compute, memory, RTOS functionality, timers, and often wireless subsystems than an AVR UNO. Exact capabilities still depend on the specific ESP32 family member and board.

## New experimental axis: operation topology

A mathematical sum such as

`x1 + x2 + ... + xn`

can be evaluated serially, in two grouped halves, with pairwise reduction, with Kahan compensation, or by independent tasks whose partial results are combined later. Floating-point addition is not associative, so these execution topologies can produce distinct finite-precision results even when they represent the same mathematical expression.

The first Phase-2 firmware therefore records sequential versus grouped reduction and an RTOS-partitioned reduction.

Questions:

- How large is the result delta caused only by changing grouping?
- Does float64 reduce that delta compared with float32?
- At what `n` does grouping change become measurable?
- Is an algorithmic change such as compensated summation more effective than simply increasing precision?
- When two RTOS tasks compute partial reductions, is the final result reproducible across repeated runs?

## New experimental axis: task placement

On multi-core ESP32 variants, independent numerical tasks may run on different cores. On single-core variants, the same interface still allows a grouped-task experiment, but it must not be described as dual-core acceleration.

The firmware reports the observed chip core count and requested task placement. Analysis must distinguish:

- grouped execution on one core;
- two tasks on one core;
- tasks pinned to distinct cores;
- task creation failure or unsupported topology.

No BetterBoard result should claim a universal ESP32 speedup from one board-specific observation.

## New experimental axis: scheduler-induced timing error

A numerical algorithm may be arithmetically accurate but still produce poor physical results when acquisition timing is irregular.

Phase 2 therefore treats lateness as numerical evidence. For a requested period `T`, the firmware measures each deadline against a microsecond timer and derives:

- minimum lateness;
- maximum lateness;
- mean lateness;
- RMS lateness;
- deadline misses;
- normalized RMS lateness (`RMS/T`).

The same test can run with and without a background numerical task.

This enables a key BetterBoard experiment:

`same requested sampling period + same arithmetic + different scheduler load -> different timing uncertainty`

## Phase-3 bridge: irregular-dt physics numerics

Once a safe board-specific GPIO/ADC profile is known, measured timestamp irregularity should be connected to physical numerical methods.

Candidate chain:

1. acquire a real or synthetic signal with timestamp for every sample;
2. compute derivative assuming constant `dt`;
3. compute derivative using measured `dt_i`;
4. integrate using constant `dt`;
5. integrate using measured `dt_i`;
6. compare both with a host reference;
7. repeat under idle, CPU-load, and wireless-load conditions.

This would connect embedded scheduling directly to Physical Lab derivative/integration error.

## ESP32-specific experiments to add after exact board identification

### ADC characterization

Do not assume a universal ESP32 ADC model. Once the exact target is known, add an ADC capability profile and study:

- repeated-code stability;
- code histogram;
- effective quantization step;
- oversampling/averaging;
- sample-rate versus noise;
- attenuation/range settings where supported;
- calibration metadata when the platform exposes it.

Boundary: ADC code is not calibrated voltage unless a valid calibration path is explicitly used.

### High-rate buffered acquisition

Use a ring buffer so sampling and host transmission are separate stages. Compare:

- direct serial print inside the sampling loop;
- buffered serial output;
- local buffer followed by burst transfer;
- Wi-Fi streaming versus local buffering.

Metrics:

- effective sample interval distribution;
- dropped samples;
- buffer occupancy;
- deadline misses;
- host-received sequence gaps.

### Networked numerical integrity

Wireless transport can be studied without treating network delay as sensor error.

Each packet should carry:

- run id;
- sequence number;
- device timestamp;
- host receipt timestamp;
- payload checksum or integrity marker where appropriate.

Then BetterBoard can separate:

`device acquisition timing` from `transport latency` from `host rendering delay`.

### Core affinity and sensor tasks

On boards with multiple cores, compare:

- sensor acquisition and analysis on the same core;
- acquisition pinned to one core and analysis to another;
- Wi-Fi activity sharing versus not sharing the acquisition core.

The scientific question is not merely throughput. It is whether core placement changes timing regularity or reproducibility.

### Large-N memory experiments

If PSRAM is present, use it for intentionally large arrays and compare:

- in-place versus buffered algorithms;
- naive versus pairwise/Kahan reductions;
- streaming reduction versus retained-array reduction;
- RAM/PSRAM placement where observable;
- accuracy-time-memory tradeoffs.

PSRAM presence must be detected at runtime; absence is a valid experimental outcome.

## BetterBoard UI concept

Future Numerical Bench UI could expose an `Execution Environment` panel rather than hiding system state.

Suggested fields:

- board/chip model;
- CPU frequency;
- detected core count;
- float/double sizes;
- free heap;
- PSRAM availability;
- transport mode;
- scheduler-load mode;
- selected numerical method;
- requested period;
- measured timing quality.

This turns hardware/runtime configuration into provenance instead of undocumented background context.

## Data model extension

Future ESP32 numerical rows should carry enough provenance to avoid mixing incompatible runs. Candidate metadata:

- `board_profile_id`
- `chip_model`
- `chip_revision`
- `cpu_freq_mhz`
- `core_count`
- `arduino_esp32_core_version`
- `firmware_sha256`
- `transport`
- `background_load_mode`
- `timer_source`
- `precision_mode`
- `algorithm_id`
- `run_id`

## Promotion gate

No Phase-2 firmware should become canonical until it passes:

1. static review;
2. compile against the exact selected ESP32 FQBN;
3. successful upload;
4. protocol smoke test;
5. repeated deterministic runs;
6. host analyzer verification;
7. board-specific boundary review;
8. evidence package with firmware hash and environment metadata.

Current status: code exists only on the research branch and has not been claimed as hardware-validated.
