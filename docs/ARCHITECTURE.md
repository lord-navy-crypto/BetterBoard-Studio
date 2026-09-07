# BetterBoard Studio v0.2 architecture

```text
                         BetterBoard Studio
                                │
              ┌─────────────────┼─────────────────┐
              │                 │                 │
        Goal-first UI      Recipe Registry    Task Center
              │                 │                 │
              └─────────────────┼─────────────────┘
                                │ Tauri invoke
                                ▼
                        Hardware Core (Rust)
              ┌─────────────────┼──────────────────────┐
              │                 │                      │
       Arduino CLI adapter   Serial acquisition   Measurement packager
              │                 │                      │
              ▼                 ▼                      ▼
      compile / upload       numeric/text       full CSV + metadata
                                                  + Physical Lab v1 CSV
                                                        │
                                                        ▼
                                                  Physical Lab
```

## Boundary decisions

1. **Goal-first, not editor-first.** The user chooses a measurement/control goal; BetterBoard selects the canonical firmware recipe and exposes code only when wanted.
2. **Arduino CLI remains external.** BetterBoard does not duplicate compiler/upload logic and does not automatically reinstall packages that are already present.
3. **Canonical hardware code is embedded.** All firmware from the previous Physical Lab Hardware Pack v0.4 plus the standalone UNO Blink test is now a first-class BetterBoard recipe library.
4. **Previous generated packs are preserved.** v0.1, v0.2, v0.3, v0.4 ZIPs are kept under `archive/physical-lab-hardware-packs/` for provenance. The UI uses v0.4-derived canonical sources, not obsolete duplicates.
5. **Physical Lab stays independent.** BetterBoard owns board/sensor/firmware/serial workflows. Physical Lab owns scientific model comparison, calibration evidence, Digital Twin/V&V and engineering decisions.
6. **Two-layer measurement output.** `data.csv` preserves every channel; `physical_lab_v1.csv` preserves the current Physical Lab `timestamp,value` primary-observable contract.
7. **No sensor identity guessing.** A responding I2C address is diagnostic evidence, not proof of an exact sensor model. The photographed XYZ module remains unconfirmed until its marking/pinout is known.
8. **Scientific boundaries remain explicit.** Acquisition does not establish calibration, traceability, uncertainty or model validity.

## Canonical recipe set

- Blink LED
- Synthetic Signal
- Analog A0 / Potentiometer
- MLX90393 3-axis magnetic field
- ADXL345 3-axis acceleration template
- Photogate Timer
- Quadrature Encoder
- Pulse / RPM
- Random Walk Robot
- I2C Scanner

## Next architectural step

v0.3 should turn the static device registry into a schema-aware Hardware Knowledge Layer:

```text
board + device + interface + pin map + voltage boundary
                         ↓
              generated configuration
                         ↓
        firmware + preflight + data schema
```

That is the right place to add guided wiring and sensor identification without hard-coding wiring assumptions into the UI.
