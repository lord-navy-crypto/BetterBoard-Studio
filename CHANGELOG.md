# Changelog

## 0.2.0-alpha.1

- Merged all previously generated Physical Lab Arduino/hardware packs into BetterBoard provenance.
- Promoted Physical Lab Hardware Pack v0.4 firmware to 9 canonical BetterBoard recipes.
- Added the standalone UNO Blink test as the 10th original canonical recipe.
- Upgraded `analog_a0` into **Bench 01 — Analog Control & Instrumentation** with normalized input, nominal voltage, PWM command and filtered primary output.
- Added **Bench 02 — Sampling & Numerical Error**, a measured-data analyzer for sample timing, jitter, ADC code structure, downsampling, derivative sensitivity, trapezoidal integration convergence, and float32-vs-float64 accumulation.
- Added **Bench 03 — Embedded Numerical Reliability** as the 11th current canonical firmware recipe. The real MCU now runs raw and range-reduced sine-Taylor recurrences, an embedded parameter scan, fixed-term convergence, stopping-rule and cancellation diagnostics, floating-point environment reporting, and per-evaluation timing.
- Added `scripts/bench03_embedded_numerical.py` with an mpmath-preferred host oracle, a clearly labeled Decimal fallback, absolute/relative/ULP error, scale-aware accuracy bounds, false-convergence classification, and numerical-reliability summaries.
- Added `scripts/bench03_self_check.py`.
- Added the **Numerical Bench 01–03** switchable workspace so acquisition, measured-data numerics, and embedded numerical reliability live in one desktop flow.
- Added top-level workspace switching between **BetterBoard Studio** and **Numerical Bench 01–03**.
- Added **Circuit Lab Phase A/B**: a Visual Wiring Editor + live deterministic Rule Checker with no electrical simulation claim.
- Added draggable UNO/potentiometer/LED/resistor/button blocks, named pins, click-to-wire graph editing, wiring list, component inspector, local save/load and circuit JSON copy.
- Added the Bench 01 reference circuit and one-click handoff from the visual design to the real `analog_a0` firmware workflow.
- Added bounded checks for power-to-ground shorts, power-to-I/O wiring, potentiometer routing, LED series-resistor paths, open resistor ends and dangling graph references.
- Added board, device and unit registries.
- Added recipe preflight for board core and required libraries; no automatic reinstall behavior.
- Added numeric and diagnostic-text capture modes.
- Added multichannel Data Studio and per-recipe schema display.
- Added Physical Lab Measurement Bridge 0.2 with full CSV, metadata, v1 compatibility CSV and bridge descriptor.
- Added firmware SHA-256 in measurement provenance.
- Added Recipe Library, Developer source view, Task Center, and embedded Physical Lab hardware documentation.
- Added `scripts/self_check.py`, `scripts/circuit_lab_self_check.py`, `scripts/compile_all.py`, and an offline synthetic bridge fixture.
