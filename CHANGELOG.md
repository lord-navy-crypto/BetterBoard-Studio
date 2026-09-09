# Changelog

## 0.2.0-alpha.7

- Added reusable one-click Copy controls with clipboard fallback for Developer run output, Monitor serial/data rows, filtered Runtime Log output, and OpenPenguin answers.
- Added a top-level **OpenPenguin** launcher and persistent local-AI drawer so the bridge is globally reachable instead of being hidden only inside Developer.
- OpenPenguin now exposes its loopback endpoint explicitly and uses a **Connect / reload OpenPenguin** action before local model selection.
- Preserved all Alpha 0.6 IDE parity, experiment, evidence, and hardware-session behavior while adding no-regression contracts for copy/AI entry surfaces.

## 0.2.0-alpha.6

- Added durable **Developer Draft Recovery** in local app storage. Unsaved source is debounced to a bounded draft and restored after app restart/crash instead of being lost. Explicit Save/Reset remains authoritative and clears the draft.
- Added project-management operations in Sketchbook: create project, rename project (including its required main `.ino`), create source/header files, rename non-main files, and delete non-main files. All operations remain restricted to Arduino/BetterBoard sketchbook roots.
- Added current-file **Go to Definition / F12** for common C/C++ declarations and `#define` symbols, plus Arduino API hover documentation in Monaco.
- Added a real **Format** action backed by `clang-format`; if no formatter executable is available BetterBoard reports that boundary instead of applying a lossy home-grown formatter.
- Preserved Alpha 0.5 persistent panes and engineering axes while extending the IDE no-regression contracts for the new Phase 2 capabilities.

## 0.2.0-alpha.5

- Added a shared **EngineeringPlot** surface with real horizontal/vertical axes, ticks, grid lines, engineering units, and axis titles.
- Replaced the floating normalized polyline in Monitor & Data with a time-domain plot: `time (s)` versus the selected channel and declared unit.
- Replaced the Magnet model-validation floating polyline with `position (mm)` versus corrected field `(µT)`, preserving measured/model distinction.
- Studio stateful pages now remain mounted while hidden, so switching Hardware/Circuit/Library/Monitor/Developer no longer destroys page state; a live Serial Monitor is no longer stopped just because another Studio page is opened.
- Numerical, Magnet, and expert experiment surfaces likewise remain mounted across domain switching, preserving in-progress parameters, captures, imports, and analysis state.
- Corrected the Studio sidebar version label to Alpha 0.5.

## 0.2.0-alpha.4

- Began **IDE Parity Phase 1** so BetterBoard can replace the Arduino IDE for normal local development rather than requiring users to leave the app.
- Replaced the plain Developer textarea with a Monaco-based Arduino/C++ smart editor: syntax highlighting, line numbers, folding, bracket-pair colorization, find/replace, Arduino starter autocomplete, and compile-error/warning markers.
- Added Developer sub-workspaces for **Editor**, **Boards & Libraries**, and **Sketchbook**.
- Added Arduino CLI-backed Board Manager operations: installed/search, index update, install/uninstall, and additional package-index URL configuration.
- Added Arduino CLI-backed Library Manager operations: installed/search, index update, install/uninstall, and library examples.
- Added local Sketchbook discovery across `~/Documents/Arduino` and `~/Documents/BetterBoard/sketches`.
- Added bounded multi-file project editing for `.ino`, `.cpp`, `.c`, `.h`, and `.hpp`; project files save back to the selected sketch directory and Verify/Upload compiles the whole project.
- Kept Recipe templates, My Library, OpenPenguin, Runtime Facts, Task Center, Monitor/Data, Evidence, Numerical and Magnet workflows intact.

## 0.2.0-alpha.3

- Added compile-time parameter controls for canonical recipes with validated sliders/number inputs that affect real generated firmware.
- Added **My Library** user presets under `~/Documents/BetterBoard/library` and Developer-derived reusable recipes.
- Upgraded Developer into a template-first Arduino-style free editor with Save / Verify / Run / Upload / Save to Library.
- Added a searchable Runtime Log inside Monitor & Data backed by Task Center operation logs.
- Added a loopback-only **OpenPenguin · Local AI** bridge to the private local runtime at `127.0.0.1:11435`; no automatic cloud upload.
- Added four numerical-error firmware programs: step-size differentiation, catastrophic cancellation, accumulation/Kahan summation, and MPU6050 rectangle-vs-trapezoidal gyro integration.
- Added MPU6050, PIR, optical pulse/motor-speed, and driver-dependent rotary/stepper hardware profiles with explicit hardware-boundary warnings.
- Moved Advanced Tools out of the experiment-domain navigation; legacy full-control workflows remain folded as an expert compatibility escape hatch while useful controls live in the normal Numerical/Magnet labs.
- Measurement Evidence now carries effective recipe parameters and hashes the parameter-rendered firmware source.

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
- Upgraded `magnetic_mlx90393` into **Magnet Bench 01 — Vector Field Acquisition**, preserving Bx/By/Bz plus derived |B| and a primary axis without silently subtracting ambient field.
- Added **Magnet Bench 02 — Characterization & Spatial Mapping** with explicit ambient-vector subtraction, fixed-position scan aggregation, timing/stability metrics, field gradient, field integral and repeatability evidence.
- Added **Magnet Bench 03 — RADIA Model ↔ Measurement Validation** with interpolation onto measured positions, MAE/RMSE/bias/max residual, relative RMSE, R², field-integral comparison, affine discrepancy fit and residual-guided follow-up measurement suggestions.
- Added the **Magnet Bench 01–03** desktop workspace and top-level switch beside BetterBoard Studio and Numerical Bench 01–03.
- Added `scripts/magnet02_characterization.py`, `scripts/magnet03_model_validation.py`, `scripts/magnet_bench_self_check.py`, and `docs/MAGNET_BENCH_01_03.md`.
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
