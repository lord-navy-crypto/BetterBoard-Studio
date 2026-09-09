# BetterBoard Hardware Numeric Error Depth 2

This layer extends BetterBoard Numerical Error research onto the user's currently available low-voltage hardware: a potentiometer, an optical/encoder pulse module, a PIR digital-output module, and an optional LED/PWM output.

## Scientific rule

**Numerical transformation error, sampling/timing error, and physical sensor error are different evidence classes.**

A sensor reading is not automatically ground truth. A host recomputation can establish the numerical error of a defined digital transformation, but it cannot by itself establish the physical accuracy of the sensor.

## 1. Potentiometer / ADC numerical lab

Firmware: `HardwareNumericError_Potentiometer`

A0 is sampled on a scheduled cadence. Each output row contains:
- schedule lateness
- raw 10-bit ADC count
- oversample mean and peak-to-peak spread
- exact-integer 10-bit -> 8/6/4-bit requantization codes
- reconstructed count values
- fast and slow EMA states
- the 8-bit PWM command

Research questions:
- how requantization step size grows as bit depth is reduced;
- how much reconstruction error is introduced by 8/6/4-bit coding relative to the observed 10-bit sample;
- how oversampling-window spread behaves while the knob is held still;
- how faster/slower EMA settings trade tracking against smoothing;
- how much scheduling jitter is present in the MCU loop.

Boundary: the 10-bit ADC sample is the source digital evidence for the requantization experiment. It is not a calibrated voltage truth.

## 2. Photogate / optical pulse timing lab

Firmware: `HardwareNumericError_Photogate`

D2 uses a falling-edge interrupt. Rejected close edges do **not** move the accepted timing baseline. Each accepted period reports:
- event index and timestamp
- integer period in microseconds
- MCU float frequency and RPM
- pulses per revolution
- declared timer quantum
- rejected-edge evidence

The host independently computes frequency/RPM from the integer period and propagates half a timer quantum through the reciprocal transform.

For an Arduino Uno, `micros()` is normally quantized in 4 us increments, so a displayed period is not an infinitely precise time measurement.

Boundary: timer quantization can be analyzed numerically. Optical geometry, pulse-shape threshold, wheel pattern, and mechanical coupling remain measurement effects.

## 3. PIR interrupt-vs-polling lab

Firmware: `HardwareNumericError_PIR`

D3 records digital output changes through an interrupt while the main loop observes the same signal on a configurable polling cadence.

The experiment reports:
- interrupt edge count and timestamp
- polled state transition
- polling detection timestamp
- interrupt-to-poll delay
- edges accumulated between reports
- coalescing risk

This isolates a real embedded-systems numerical/sampling issue: a program that only polls can detect a digital transition later than the hardware edge and can hide multiple transitions inside one polling interval.

Boundary: this does **not** measure human-motion-to-PIR latency. The PIR module's internal sensing and hold-time behavior are physical/device effects unless independently referenced.

## 4. Combined sampling + asynchronous event lab

Firmware: `HardwareNumericError_MultiSensor`

Confirmed hardware path:
- A0 potentiometer
- D2 optical/photogate pulse
- D3 PIR digital output
- optional D9 LED/PWM

A fixed-rate sample row carries both sampled analog state and accumulated asynchronous event counters. This makes visible a common error in embedded data systems: sampled state alone may say "one event happened" while the counter proves that several events occurred between samples.

Research outputs include:
- sample schedule lateness;
- 10->8 bit quantization and PWM mapping;
- EMA state;
- PIR edges since sample and coalescing flag;
- photogate events since sample, rejected edges, period and frequency;
- total event counters.

## Host analysis

Run:

```bash
python3 scripts/hardware_numeric_error_analyzer.py data.csv
```

The analyzer writes `summary.json` and `report.md` beside the source measurement unless another output directory is supplied.

Deterministic regression:

```bash
python3 scripts/hardware_numeric_error_self_check.py
```

## Relationship to PR #3 (`numeric-error-research-pack`)

PR #3 supplied useful prototypes, especially its accepted-edge semantics and event counters. Depth 2 carries those ideas onto the current post-Command-66 main branch and strengthens them with:
- configurable compile-time parameters;
- declared timer quantum;
- host-side exact/Decimal recomputation;
- explicit PIR polling-vs-interrupt semantics;
- removal of unconfirmed switch hardware from the combined lab;
- deterministic regression checks;
- real Arduino Uno compile validation in CI.

## Promotion boundary

These programs can be compile-validated in CI. Canonical Recipe Library promotion should follow physical validation on the user's actual modules so pin logic levels, edge polarity, pulse geometry, and PIR behavior are confirmed rather than guessed.
