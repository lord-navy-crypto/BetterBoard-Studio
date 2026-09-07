# BetterBoard Studio

**Alpha 0.2.0-a1** — a goal-first physical-computing desktop environment.

BetterBoard does not try to be another Arduino IDE skin. It turns the setup chain into one workflow:

```text
Goal → Board → Recipe → Preflight → Compile → Upload → Capture → Measurement
```

## What changed in v0.2

The previous Physical Lab Arduino/hardware work is now merged into BetterBoard as a real firmware and measurement layer.

### Integrated canonical recipes

1. Blink LED
2. Synthetic Signal
3. **Bench 01 — Analog Control & Instrumentation**
4. MLX90393 3-axis magnetic field
5. ADXL345 3-axis acceleration template
6. Photogate Timer
7. Quadrature Encoder
8. Pulse / RPM
9. Random Walk Robot
10. I2C Scanner

The original measurement/control sources came from the earlier Physical Lab Hardware Pack v0.4 plus the standalone Blink test. Earlier v0.1–v0.4 generated packs remain preserved under `archive/physical-lab-hardware-packs/` for provenance. The former `analog_a0` / `AnalogDAQ` recipe is now the first BetterBoard-native evolution of that hardware layer: Bench 01.

### Bench 01

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

### Product layers

- Recipe Library with hardware, schema, library requirements and Physical Lab target mapping
- `recipe_preflight`: reports board core and missing libraries without automatically reinstalling existing packages
- Numeric and diagnostic-text serial capture
- Data Studio with multichannel snapshot and primary-observable plot
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

The full CSV keeps every channel. The compatibility CSV mirrors Physical Lab's current serial-capture assumption that the final numeric field is the primary observable.

BetterBoard does **not** claim that capture establishes calibration, uncertainty, traceability, sensor accuracy or experimental validation. Physical Lab keeps those scientific responsibilities.

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

1. Refresh → select the active USB serial device and explicit UNO profile.
2. Blink → Preflight → Compile & Upload → verify the onboard `L` LED.
3. Synthetic Signal → Compile & Upload → Capture → verify the software data path.
4. **Bench 01** → connect the identified potentiometer safely to A0 → Compile & Upload → Capture.
5. Turn the potentiometer and verify `raw_adc`, `normalized`, `nominal_voltage_v`, `pwm_command`, and `filtered_voltage_v` change coherently.
6. Record a measurement package and inspect the full multichannel CSV plus Physical Lab compatibility export.
7. MLX90393 comes later when a quantitative magnetic sensor is available.
8. ADXL345 comes only after the exact photographed XYZ sensor module is identified or replaced with a confirmed module.

## Project boundary

- **BetterBoard:** boards, devices, firmware, upload, serial, diagnostics, measurement packaging, experiment recipes.
- **Physical Lab:** scientific models, calibration evidence, model/measurement comparison, Digital Twin, V&V.
- **OpenPenguin:** optional shared local-AI provider in future; not a hard dependency.

## License

BetterBoard Studio source in this prototype is MIT licensed. Arduino CLI and third-party Arduino libraries are separate dependencies under their own licenses. Arduino® is a trademark of Arduino S.r.l.; BetterBoard Studio is independent and not affiliated with Arduino.
