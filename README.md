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
3. Analog A0 / potentiometer
4. MLX90393 3-axis magnetic field
5. ADXL345 3-axis acceleration template
6. Photogate Timer
7. Quadrature Encoder
8. Pulse / RPM
9. Random Walk Robot
10. I2C Scanner

The canonical measurement/control sources come from the latest earlier Physical Lab Hardware Pack v0.4 plus the standalone Blink test. Earlier v0.1–v0.3 generated packs are preserved under `archive/physical-lab-hardware-packs/` rather than silently discarded.

### New product layers

- Recipe Library with hardware, schema, library requirements and Physical Lab target mapping
- `recipe_preflight`: reports board core and missing libraries without automatically reinstalling existing packages
- Numeric and diagnostic-text serial capture
- Data Studio with multichannel snapshot and primary-observable plot
- Task Center for preflight/prepare/compile/upload/capture/export operations
- Developer view with the exact canonical `.ino` source
- Physical Lab Measurement Bridge 0.2
- Embedded device/board/unit registries for the next Hardware Knowledge Layer

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
cd BetterBoard-Studio-v0.2a
npm install
npm run desktop:dev
```

BetterBoard does not automatically reinstall Arduino CLI or libraries that are already installed.

## First real test sequence

Use the already-known working UNO-compatible board:

1. Refresh → confirm `/dev/cu.usbserial-10` if it remains the active port.
2. Blink → Preflight → Compile & Upload → verify the onboard `L` LED.
3. Synthetic Signal → Compile & Upload → Capture → verify the graph.
4. Synthetic Signal → Record 5 s package → verify all four bridge files.
5. Analog A0 only after the potentiometer module's exact S/V/G pinout and safe voltage are confirmed.
6. MLX90393 after the quantitative magnetic sensor is available.
7. ADXL345 only after the exact acceleration sensor module is confirmed (or the recipe is adapted to the actual XYZ module).

## Project boundary

- **BetterBoard:** boards, devices, firmware, upload, serial, diagnostics, measurement packaging.
- **Physical Lab:** scientific models, calibration evidence, model/measurement comparison, Digital Twin, V&V.
- **OpenPenguin:** optional shared local-AI provider in future; not a hard dependency.

## License

BetterBoard Studio source in this prototype is MIT licensed. Arduino CLI and third-party Arduino libraries are separate dependencies under their own licenses. Arduino® is a trademark of Arduino S.r.l.; BetterBoard Studio is independent and not affiliated with Arduino.
