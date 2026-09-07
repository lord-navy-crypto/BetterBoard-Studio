# BetterBoard Bench 01 — Analog Control & Instrumentation

Bench 01 is BetterBoard's first reference physical-computing experiment. It uses the existing `analog_a0` recipe and turns a simple potentiometer input into a complete measurement-and-control path:

```text
physical input
  → analog voltage
  → Arduino A0 / ADC
  → endpoint normalization
  → nominal voltage conversion
  → exponential smoothing
  → PWM command
  → serial measurement stream
  → BetterBoard Data Studio
  → reproducible measurement package
  → optional Physical Lab import
```

## Minimum hardware

- UNO-compatible board
- USB data cable
- Potentiometer or another already-identified, known-safe low-voltage analog source

Optional:

- LED with an appropriate series resistor on PWM pin D9

The built-in LED is used as a simple status indicator: it is on when normalized input is at or above 50%.

## Firmware contract

The canonical sketch remains at:

```text
src-tauri/resources/firmware/AnalogDAQ/AnalogDAQ.ino
```

The recipe id remains `analog_a0`, so existing BetterBoard Rust integration does not need a special-case command.

Serial settings:

- 115200 baud
- nominal 50 Hz sample rate
- numeric CSV-like records

Columns:

```text
time_us,raw_adc,normalized,nominal_voltage_v,pwm_command,filtered_voltage_v
```

`filtered_voltage_v` is intentionally the final column so the current Physical Lab v1 compatibility export can retain it as the primary observable.

## Signal processing

### Endpoint normalization

By default the firmware uses the full 10-bit UNO ADC range:

```text
ADC_MIN_COUNTS = 0
ADC_MAX_COUNTS = 1023
```

The normalized signal is:

```text
normalized = clamp((raw_adc - min) / (max - min), 0, 1)
```

The constants can later be replaced by measured endpoints from a two-point calibration workflow.

### Nominal voltage

The firmware reports:

```text
nominal_voltage_v = raw_adc / 1023 * 5.0
```

This is explicitly a nominal engineering conversion, not a calibrated voltage measurement. Accurate voltage requires characterization of the actual ADC reference and input path.

### Filtering

Bench 01 uses a first-order exponential smoother:

```text
filtered += alpha * (new_value - filtered)
```

with `alpha = 0.20` in the first reference firmware.

### PWM command

The normalized input is mapped to an 8-bit PWM command:

```text
pwm_command = round(normalized * 255)
```

D9 is the optional PWM output. A motor must not be connected directly to this pin; motor experiments require an identified compatible driver and belong to a later bench.

## BetterBoard workflow

1. Connect the board and select the explicit board profile.
2. Select **Bench 01 — Analog Control & Instrumentation** in Recipe Library.
3. Run Preflight.
4. Prepare / Compile / Upload the canonical firmware.
5. Capture a short stream in Data Studio.
6. Record a measurement package.
7. Inspect all channels and metadata.
8. Export through the existing Physical Lab bridge when useful.

## What Bench 01 validates

Bench 01 is intentionally simple hardware with a large software surface. It exercises:

- board/port handling
- Arduino CLI compile/upload
- real analog acquisition
- multichannel serial parsing
- engineering units
- raw vs processed channels
- simple filtering
- command generation
- live plotting
- measurement packaging
- provenance
- Physical Lab compatibility export

## Scientific and safety boundary

Bench 01 is for ordinary low-voltage Arduino-class signals. It does not establish calibration accuracy, traceability, sensor accuracy, or experimental truth by itself. The potentiometer module's exact pin labels and supported supply voltage should be confirmed before wiring. Unknown modules should not be connected until identified.
