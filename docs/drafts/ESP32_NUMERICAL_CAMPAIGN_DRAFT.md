# ESP32 Numerical Campaign — DRAFT

Status: preparation-only. These commands are a proposed campaign for `ESP32NumericalResearchSuite`; they are not hardware-validated yet.

## Phase A — identity and arithmetic baseline

```text
INFO
PRECISION
SUM 1000
SUM 10000
SUM 100000
SUM 1000000
SERIES 1024
SERIES 8192
SERIES 65536
```

Purpose: establish chip/runtime identity, float/double representation, summation error growth, and order sensitivity.

## Phase B — range reduction and precision map

Run the same term counts over increasingly difficult arguments:

```text
TAYLOR 0.1 8
TAYLOR 1.0 8
TAYLOR 3.0 10
TAYLOR 10.0 14
TAYLOR 50.0 20
TAYLOR 80.0 24
TAYLOR 100.0 28
TAYLOR 500.0 40
```

Repeat selected x values at multiple term counts, for example 8/12/16/24/32. The host analyzer should compare raw/reduced float32/float64 against mpmath. This creates an error surface rather than a single anecdotal value.

## Phase C — timer cost and baseline jitter

```text
TIMER 10000
TIMER 100000
JITTER 100 5000
JITTER 250 5000
JITTER 500 5000
JITTER 1000 5000
JITTER 5000 2000
```

Repeat each jitter run at least three times. Timing claims should be based on distributions/replicates rather than one run.

## Phase D — compute-load interference

Use the same periods/sample counts from Phase C:

```text
LOADJITTER 100 5000
LOADJITTER 250 5000
LOADJITTER 500 5000
LOADJITTER 1000 5000
LOADJITTER 5000 2000
```

Compare RMS lateness, max lateness, and deadline-miss rate against baseline.

## Phase E — Wi-Fi background interference

```text
WIFIJITTER 250 5000
WIFIJITTER 500 5000
WIFIJITTER 1000 5000
WIFIJITTER 5000 2000
```

Run in multiple radio environments if possible. Record `networks_seen` as context, but do not treat it as a complete RF-load measure.

## Phase F — concurrency and grouping

```text
DUALCORE 10000
DUALCORE 100000
DUALCORE 1000000
```

If `INFO` reports one core, retain the data as a grouped-task comparison but do not call it a dual-core speedup result. If multiple cores are reported, compare numerical grouping delta and observed speedup separately.

## Phase G — PSRAM large-N

Only when `PSRAM_FOUND=1`:

```text
PSRAM 10000
PSRAM 100000
PSRAM 500000
PSRAM 1000000
PSRAM 2000000
```

If PSRAM is absent, keep the absence record and skip the experiment. Never silently fall back to internal RAM and label it PSRAM.

## Evidence package per hardware session

Retain:

```text
raw_serial_capture.txt
esp32_numerical_rows.csv
esp32_numerical_summary.json
esp32_numerical_comments.txt
board_identity.txt or metadata JSON
```

Recommended additional provenance for future BetterBoard integration:

```text
board_profile_id
fqbn
arduino_esp32_core_version
firmware_git_sha
firmware_sha256
host_timestamp_utc
usb_port
chip_model
chip_revision
cpu_frequency_mhz
core_count
psram_found
```

## Future experiments after exact board identification

Once the board pin map is known and electrically checked, extend into real acquisition:

```text
ADC_JITTER
ADC_QUANTIZATION
ADC_OVERSAMPLING
ADC_FILTER_COMPARISON
IRREGULAR_DT_DERIVATIVE
IRREGULAR_DT_INTEGRATION
PHOTOGATE_TIMER_32_VS_64
I2C_SAMPLE_JITTER
SENSOR_TASK_CORE_AFFINITY
WIFI_STREAM_VS_LOCAL_BUFFER
```

These should not be implemented by guessing GPIO numbers. BetterBoard's future board capability profile should choose safe pins/capabilities first.
