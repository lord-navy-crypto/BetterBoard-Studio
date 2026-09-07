# BetterBoard Studio

**Alpha 0.2.0-a1** — a goal-first physical-computing desktop environment.

BetterBoard does not try to be another Arduino IDE skin. It turns the setup chain into one workflow:

```text
Goal → Board → Recipe → Preflight → Compile → Upload → Capture → Measurement
```

A Circuit Lab layer adds a design-before-build path:

```text
Visual design → Rule Checker → real-hardware handoff
```

A unified Numerical Bench workspace adds a numerical-computing reference path:

```text
Bench 01 → Bench 02 → Bench 03
real acquisition → measured-data numerics → embedded numerical reliability
```

A unified Magnet Bench workspace adds a magnetic-field engineering path:

```text
Magnet Bench 01 → Magnet Bench 02 → Magnet Bench 03
vector acquisition → characterization / mapping → RADIA model validation
```

The application entry bar switches between:

```text
BetterBoard Studio | Numerical Bench 01–03 | Magnet Bench 01–03
```

## What changed in v0.2

The previous Physical Lab Arduino/hardware work is now merged into BetterBoard as a real firmware and measurement layer.

### Integrated canonical recipes

1. Blink LED
2. Synthetic Signal
3. **Bench 01 — Analog Control & Instrumentation**
4. **Bench 03 — Embedded Numerical Reliability**
5. **Magnet Bench 01 — Vector Field Acquisition**
6. ADXL345 3-axis acceleration template
7. Photogate Timer
8. Quadrature Encoder
9. Pulse / RPM
10. Random Walk Robot
11. I2C Scanner

Bench 02 intentionally reuses the Bench 01 acquisition firmware, so it is an analysis mode rather than a duplicate firmware recipe. Magnet Bench 02 and 03 likewise deepen the Magnet Bench 01 measurement path rather than creating duplicate sensor firmware.

The original measurement/control sources came from the earlier Physical Lab Hardware Pack v0.4 plus the standalone Blink test. Earlier v0.1–v0.4 generated packs remain preserved under `archive/physical-lab-hardware-packs/` for provenance. The former `analog_a0` / `AnalogDAQ` recipe is now the first BetterBoard-native evolution of that hardware layer: Bench 01. The earlier MLX90393 acquisition firmware now evolves into Magnet Bench 01.

### Bench 01 — Analog Control & Instrumentation

Bench 01 turns a potentiometer or another already-identified, known-safe low-voltage analog source into a complete reference path:

```text
physical input
→ A0 / ADC
→ normalization
→ nominal voltage conversion
→ filtering
→ PWM command
→ serial measurement
→ BetterBoard Data Studio
→ measurement package
→ optional Physical Lab bridge
```

The canonical recipe id remains `analog_a0`, so it automatically uses the existing recipe/preflight/compile/upload/capture infrastructure. See [`docs/BENCH_01_ANALOG_CONTROL.md`](docs/BENCH_01_ANALOG_CONTROL.md).

### Bench 02 — Sampling & Numerical Error

Bench 02 deliberately reuses the real measurement package produced by Bench 01 instead of duplicating firmware. It turns an actual acquired ADC time series into a numerical-analysis experiment:

```text
real potentiometer motion
→ UNO ADC samples
→ BetterBoard measurement package
→ sampling / timing / quantization analysis
→ downsampling convergence
→ finite-difference sensitivity
→ trapezoidal-integration sensitivity
→ float32-vs-float64 accumulation comparison
```

Run it on a BetterBoard measurement folder:

```bash
python3 scripts/bench02_numerical_error.py \
  ~/Documents/BetterBoard/measurements/<measurement-folder>
```

It writes `bench02_summary.json`, `bench02_convergence.csv`, and `bench02_report.md` under the measurement folder. The finest available measured series is used only as an **empirical numerical baseline**, not exact physical truth. Bench 02 therefore complements, rather than replaces, Physical Lab's existing Taylor-series / floating-point / cancellation Numerical Error Analysis module.

See [`docs/BENCH_02_NUMERICAL_ERROR.md`](docs/BENCH_02_NUMERICAL_ERROR.md).

### Bench 03 — Embedded Numerical Reliability

Bench 03 moves the core Numerical Error Analysis recurrence onto the real MCU. No sensor is required.

The embedded C++ firmware runs:

- raw Taylor evaluation
- range-reduced Taylor evaluation
- a bounded `x` parameter scan over `−80 … 80`
- fixed-term convergence at `x = 80`
- stopping-rule reporting
- cancellation-ratio reporting
- finite/non-finite arithmetic reporting
- `sizeof(float)`, `sizeof(double)`, and `FLT_EPSILON`
- per-evaluation execution time

The MCU deliberately does **not** decide whether its own answer is accurate. BetterBoard records the embedded evidence, then the host analyzer supplies the independent reference side:

```bash
python3 scripts/bench03_embedded_numerical.py \
  ~/Documents/BetterBoard/measurements/<measurement-folder>
```

The preferred oracle is `mpmath` when already available. BetterBoard does not reinstall it. When unavailable, the analyzer uses a clearly labeled standard-library Decimal high-precision fallback.

The final classification mirrors the Numerical Error Analysis Studio distinction between:

```text
stopping criterion
accuracy
numerical reliability
false convergence
```

See [`docs/BENCH_03_EMBEDDED_NUMERICAL_RELIABILITY.md`](docs/BENCH_03_EMBEDDED_NUMERICAL_RELIABILITY.md).

### Unified Numerical Bench 01–03

The dedicated Numerical Bench workspace combines the three levels as switchable modes:

```text
Mode 1 — Bench 01
physical input → measurement

Mode 2 — Bench 02
measurement → sampling / discretization analysis

Mode 3 — Bench 03
numerical problem → MCU arithmetic → host oracle / reliability
```

Bench 01 and Bench 03 can compile/upload and record packages directly from that workspace. Bench 02 and Bench 03 currently run their deterministic reference-analysis scripts after capture; the workspace prints the exact command using the latest measurement folder.

See [`docs/NUMERICAL_BENCH_SUITE.md`](docs/NUMERICAL_BENCH_SUITE.md).

### Magnet Bench 01 — Vector Field Acquisition

The existing MLX90393 path is now the first level of a dedicated magnetic-field workflow. The firmware preserves the full vector instead of reducing the magnet to a single number:

```text
time_us,Bx_uT,By_uT,Bz_uT,Bmag_uT,primary_uT
```

`Bmag_uT` is the derived vector magnitude. Ambient/background field is intentionally **not** removed in firmware because Bench 02 treats the baseline as explicit experimental evidence.

### Magnet Bench 02 — Characterization & Spatial Mapping

Magnet Bench 02 reuses Magnet Bench 01 measurement packages and adds experimental structure:

```text
ambient baseline
+
fixed-position magnet captures
→ background-corrected vector field
→ repeatability
→ spatial profile / gradient
→ peak location
→ field integral
```

Run a single-capture comparison:

```bash
python3 scripts/magnet02_characterization.py \
  <magnet-measurement> \
  --baseline <ambient-measurement>
```

For a real scan, repeat `--point POSITION_MM MEASUREMENT` for each controlled sensor position.

### Magnet Bench 03 — RADIA Model ↔ Measurement Validation

Magnet Bench 03 compares the spatial field profile against a RADIA or other forward-model CSV. It reports the same family of field-comparison diagnostics used by Engineering Lab's Digital Twin core:

- MAE / RMSE / bias / maximum residual
- relative RMSE and R²
- measured and model peak fields
- measured/model field integrals and difference
- residual standard deviation
- affine discrepancy fit `measured ≈ scale × model + offset`
- residual-guided suggestions for follow-up measurements

Run:

```bash
python3 scripts/magnet03_model_validation.py \
  magnet02-characterization/magnet02_scan.csv \
  radia_centerline.csv \
  --measured-column corrected_Bz_uT \
  --model-column model_uT \
  --model-unit uT
```

The analyzer also writes `physical_lab_field_bridge.json` with evidence semantics aligned to Engineering Lab's `compare_field_series`, `fit_model_affine`, and `suggest_residual_measurement_points`. This is an evidence bridge, not yet a claim of automatic import.

See [`docs/MAGNET_BENCH_01_03.md`](docs/MAGNET_BENCH_01_03.md).

### Circuit Lab — Phase A/B

Circuit Lab is the first design-before-build interface in BetterBoard. It intentionally starts **without electrical simulation** so the product can establish a clean circuit graph and deterministic validation layer first.

Current capabilities:

- visual Arduino component blocks with named pins
- drag-to-layout editor
- click-pin → click-pin wiring
- live wiring list and component inspector
- local save/load and circuit JSON copy
- Bench 01 reference layout
- bounded low-voltage Rule Checker
- one-click handoff from the Bench 01 design to the existing `analog_a0` firmware workflow

The current Rule Checker catches selected known mistakes such as direct power-to-ground wiring, power rail to I/O connections, incorrect potentiometer signal routing, missing expected ground/power connections, and LED output paths without a series resistor. A pass is **not** a SPICE result, safety certification, current/thermal calculation, or proof that an unknown module is safe at a chosen voltage.

See [`docs/CIRCUIT_LAB.md`](docs/CIRCUIT_LAB.md).

### Product layers

- Numerical Bench Suite: switchable Bench 01 / Bench 02 / Bench 03 workflows
- Magnet Bench Suite: switchable magnetic acquisition / characterization / RADIA-validation workflows
- Circuit Lab: Visual Wiring Editor + Rule Checker
- Recipe Library with hardware, schema, library requirements and Physical Lab target mapping
- `recipe_preflight`: reports board core and missing libraries without automatically reinstalling existing packages
- Numeric and diagnostic-text serial capture
- Data Studio with multichannel snapshot and primary-observable plot
- Bench 02 measured-series numerical-error analyzer
- Bench 03 embedded numerical-reliability firmware + host analyzer
- Magnet Bench 02 field-characterization analyzer
- Magnet Bench 03 model/measurement residual analyzer
- Task Center for preflight/prepare/compile/upload/capture/export operations
- Developer view with the exact canonical `.ino` source
- Physical Lab Measurement Bridge 0.2
- Embedded device/board/unit registries for the Hardware Knowledge Layer

## Physical Lab bridge

Numeric recipes export:

```text
~/Documents/BetterBoard/measurements/<recipe>-<timestamp>/
├── data.csv                  # full multichannel data
├── metadata.json             # provenance/schema/units/firmware hash
├── physical_lab_v1.csv       # timestamp,value compatibility export
└── physical_lab_bridge.json  # bridge descriptor
```

The full CSV keeps every channel. The compatibility CSV mirrors Physical Lab's current serial-capture assumption that the final numeric field is the primary observable. Bench 03 therefore places `approximation` last; Magnet Bench 01 keeps `primary_uT` last while retaining Bx/By/Bz/|B| in the full dataset.

BetterBoard does **not** claim that capture establishes calibration, uncertainty, traceability, sensor accuracy or experimental validation. Physical Lab / Engineering Lab keeps those scientific responsibilities.

## Build on macOS

Prerequisites already expected on the development Mac:

- Node/npm
- Rust toolchain + Tauri 2 prerequisites
- `arduino-cli`

```bash
cd BetterBoard-Studio-upload
npm install
npm run desktop:dev
```

BetterBoard does not automatically reinstall Arduino CLI or libraries that are already installed.

## First real test sequence

Use the already-known working UNO-compatible board:

1. Open **Circuit Lab** → load `Bench 01 template` → verify the Rule Checker reports no known rule violation.
2. Click `Use Bench 01 firmware` to move into the real hardware workflow.
3. Refresh → select the active USB serial device and explicit UNO profile.
4. Blink → Preflight → Compile & Upload → verify the onboard `L` LED.
5. Synthetic Signal → Compile & Upload → Capture → verify the software data path.
6. **Bench 01** → connect the identified potentiometer safely to A0 → Compile & Upload → Capture.
7. Turn the potentiometer and verify `raw_adc`, `normalized`, `nominal_voltage_v`, `pwm_command`, and `filtered_voltage_v` change coherently.
8. Record a measurement package and inspect the full multichannel CSV plus Physical Lab compatibility export.
9. **Bench 02** → run `python3 scripts/bench02_numerical_error.py <measurement-folder>` and inspect timing, quantization structure, downsampling convergence, derivative sensitivity, integration sensitivity, and float32/float64 accumulation differences.
10. Switch to **Numerical Bench 01–03 → Bench 03** → Compile & Upload → Preview campaign → Record evidence package.
11. Run `python3 scripts/bench03_embedded_numerical.py <measurement-folder>` and inspect raw-versus-reduced accuracy, false convergence, cancellation, and execution-time evidence.
12. When a **confirmed MLX90393 breakout** is available, switch to **Magnet Bench 01–03** → Magnet Bench 01 → Compile & Upload → record a stable ambient field and a magnet capture.
13. Use Magnet Bench 02 for controlled-position characterization, then Magnet Bench 03 when a co-registered RADIA/model field series is available.
14. ADXL345 comes only after the exact photographed XYZ sensor module is identified or replaced with a confirmed module.

## Project boundary

- **BetterBoard:** visual circuit design, bounded rule checking, boards, devices, firmware, upload, serial, diagnostics, measurement packaging, experiment recipes, measured-series pre-analysis, embedded numerical evidence acquisition, and magnetic-field characterization pre-analysis.
- **Physical Lab / Engineering Lab:** scientific models, high-level numerical analysis, calibration evidence, model/measurement comparison, Digital Twin, V&V.
- **OpenPenguin:** optional shared local-AI provider in future; not a hard dependency.

## License

BetterBoard Studio source in this prototype is MIT licensed. Arduino CLI and third-party Arduino libraries are separate dependencies under their own licenses. Arduino® is a trademark of Arduino S.r.l.; BetterBoard Studio is independent and not affiliated with Arduino.
