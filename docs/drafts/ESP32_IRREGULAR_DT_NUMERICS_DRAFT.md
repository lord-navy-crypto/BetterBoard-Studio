# ESP32 Irregular-dt Numerics — DRAFT

Status: research-only. Not a canonical BetterBoard recipe. Not promoted to `main`.

## Research question

Scientific acquisition code often assumes a constant sample interval `dt`, even when the actual scheduler, Wi-Fi stack, background computation, or operating-system activity causes sample timestamps to move around that nominal period.

This experiment asks a narrower question:

> For the same sampled signal, how much derivative/integration error comes from using nominal constant `dt` instead of the measured timestamp spacing?

The ESP32 is useful here because it gives BetterBoard several capabilities that an AVR UNO cannot combine as naturally: microsecond-scale `esp_timer_get_time()` timestamps, FreeRTOS tasks, multicore variants, a Wi-Fi subsystem, much larger RAM, and enough compute to capture first and analyze/emit later.

## Firmware

`src-tauri/resources/firmware/ESP32IrregularDtNumerics/ESP32IrregularDtNumerics.ino`

Command:

```text
IRREG <period_us> <samples> <freq_hz> <IDLE|LOAD|WIFI>
```

Examples:

```text
IRREG 1000 2000 17 IDLE
IRREG 1000 2000 17 LOAD
IRREG 1000 2000 17 WIFI
```

The synthetic source is

```text
y(t) = sin(2*pi*f*t)
```

The device stores timestamped samples in RAM during acquisition and only prints them after acquisition. This avoids turning serial printing itself into the primary sample scheduler.

## Two derivative estimators

Constant-dt central difference:

```text
d_const[i] = (y[i+1] - y[i-1]) / (2 * nominal_dt)
```

Measured-dt central difference:

```text
d_measured[i] = (y[i+1] - y[i-1]) / (t[i+1] - t[i-1])
```

The host compares both against the analytic reference

```text
dy/dt = 2*pi*f*cos(2*pi*f*t)
```

## Two integration estimators

Constant-dt trapezoid:

```text
I_const[i] = I_const[i-1] + 0.5*(y[i-1]+y[i])*nominal_dt
```

Measured-dt trapezoid:

```text
I_measured[i] = I_measured[i-1] + 0.5*(y[i-1]+y[i])*(t[i]-t[i-1])
```

The host analytic reference from the first timestamp `t0` is

```text
I(t) = (cos(2*pi*f*t0) - cos(2*pi*f*t)) / (2*pi*f)
```

## ESP32-specific interference modes

### IDLE

No deliberate background interference. This establishes the board/core/runtime baseline.

### LOAD

A FreeRTOS task runs repeated floating-point work while acquisition proceeds. On multicore targets it is pinned to another core when available. This lets BetterBoard ask whether background numerical load changes timestamp regularity and whether measured-dt reconstruction recovers the derivative/integral.

### WIFI

An asynchronous Wi-Fi scan is started while acquisition proceeds. The visible networks are irrelevant; the radio/network subsystem is only used as a source of realistic background activity.

This mode must not be interpreted as a universal statement that Wi-Fi causes a fixed amount of error. Results are local to the tested board, Arduino-ESP32 core, firmware build, RF environment, CPU frequency, and run conditions.

## Output schema

```text
run_id,index,mode,period_us,freq_hz,t_us,dt_prev_us,y,d_const,d_measured,i_const,i_measured
```

The critical evidence is `t_us` and `dt_prev_us`. The experiment must preserve these raw timestamps rather than outputting only final RMSE values.

## Host analyzer

`scripts/esp32_irregular_dt_analyzer.py`

It computes an independent analytic host reference and produces:

```text
esp32_irregular_dt_rows.csv
esp32_irregular_dt_summary.json
```

Per-run metrics include:

- timestamp error RMSE and max absolute deviation from nominal period;
- constant-dt derivative RMSE;
- measured-dt derivative RMSE;
- derivative recovery gain;
- constant-dt integral RMSE;
- measured-dt integral RMSE;
- integration recovery gain.

A recovery gain greater than 1 means measured timestamps improved the corresponding numerical result for that run. It is not assumed in advance that this must happen for every frequency, period, board, or interference regime.

## Proposed campaign

A first useful campaign is a period/frequency/interference grid:

```text
period_us: 250, 500, 1000, 2000, 5000
freq_hz:   1, 5, 17, 40
mode:      IDLE, LOAD, WIFI
samples:   2000 where practical
```

Important constraint: the signal frequency must remain sensible relative to the sampling rate. Runs close to Nyquist should be labeled as combined sampling/aliasing experiments rather than pure scheduler-jitter experiments.

## Phase 3 extensions

The same framework can later be expanded into real sensor work after the exact ESP32 board/pin map is known:

1. ADC acquisition with actual timestamp spacing.
2. Photogate velocity estimates using 64-bit ESP timer timestamps.
3. IMU derivative/integration with irregular sample intervals.
4. Local ring-buffer capture versus live Wi-Fi streaming.
5. Core-affinity acquisition task versus unpinned task.
6. Priority experiments: acquisition task above/equal/below background processing priority.
7. Queue pressure and dropped-sample accounting.
8. Packet sequence integrity for networked capture.
9. PSRAM-backed long-duration acquisition where supported.
10. CPU-frequency/power-management sensitivity, only when the board/runtime exposes it safely.

## Promotion gate

Do not add this to the canonical BetterBoard recipe catalog until all of the following are satisfied:

```text
static review
-> ESP32-core compile
-> real-board upload
-> command/protocol smoke test
-> IDLE hardware capture
-> LOAD hardware capture
-> WIFI hardware capture where supported
-> host analytic analyzer check
-> repeatability check
-> board-specific interpretation
```

Until then it remains research evidence, not a production capability claim.
