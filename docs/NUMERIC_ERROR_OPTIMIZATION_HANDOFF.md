# BetterBoard Numerical Error Optimization Handoff

This document is a review/handoff for a second implementation pass. It separates confirmed product issues from optional research expansion so the next agent can decide what should be merged, revised, or deferred.

## Current structure

BetterBoard currently has a three-stage Numerical Bench:

1. Bench 01 — real analog acquisition (`analog_a0` / `AnalogDAQ`)
2. Bench 02 — host-side measured-data numerical analysis (`bench02_numerical_error.py`)
3. Bench 03 — one-shot embedded Taylor/reliability campaign (`numerical_embedded`)

The `numeric-error-research-pack` branch additionally contains focused firmware experiments for ADC stability, requantization, filter lag, finite difference, integration, summation, photogate timing, switch bounce, PIR timing, PWM quantization, and a mixed-sensor event lab.

## Priority 0 — product defects observed during real use

### P0.1 Serial-port candidate filtering

Observed failure: BetterBoard selected `/dev/cu.debug-console` as an upload target and Arduino upload failed with programmer-not-responding / not-in-sync errors.

Current backend `board_list()` accepts every `arduino-cli board list` port that has a non-empty address. It does not classify or suppress obvious macOS system ports.

Recommended change:

- classify ports as `likely_board`, `unknown_serial`, or `system_unlikely`
- de-prioritize or hide known system ports such as `/dev/cu.debug-console` and Bluetooth incoming ports
- prefer ports with matching board metadata and USB-like names (`usbserial`, `usbmodem`, etc.)
- never silently auto-select a system-unlikely port
- show the reason for ranking in the UI

### P0.2 Serial ownership / Resource busy

Observed failure: compile succeeded, but upload to `/dev/cu.usbserial-110` failed with `Resource busy`.

Recommended port lifecycle:

`stop/close monitor or capture -> wait for descriptor release -> upload -> optional reopen`

The backend should return a specific `PORT_BUSY` category instead of a generic upload failure when possible, and the UI should explain that another serial reader may still own the port.

### P0.3 Bench 03 looks like it stopped halfway

Bench 03 is intentionally one-shot: `setup()` runs the deterministic campaign and `loop()` does no further work. That design is scientifically reasonable, but the UI does not make completion obvious enough.

Recommended change:

- explicitly label Bench 03 as `one-shot campaign`
- display expected row count / received row count
- show `Campaign complete` when the complete schema is captured
- do not make a completed one-shot campaign look like a frozen stream
- prefer protocol/row-completion over fixed capture duration alone

## Priority 1 — Numerical Bench UX / analysis integration

### P1.1 Run Bench 02 inside BetterBoard

Current Bench 02 UI records data, then prints a shell command that the user must run manually.

Recommended change:

- add a Tauri command to launch the bundled Bench 02 analyzer safely
- expose output paths and parsed summary JSON to the frontend
- add a `Run analysis` button
- render timing jitter, quantization structure, downsampling convergence, derivative sensitivity, integration sensitivity, and float32-vs-float64 accumulation directly in BetterBoard

This removes a large workflow break: the user should not have to leave BetterBoard to turn a BetterBoard measurement into BetterBoard analysis.

### P1.2 Run Bench 03 host-oracle analysis inside BetterBoard

Same issue as Bench 02: host analysis is currently surfaced as an external command.

Recommended change:

- add `Run host oracle`
- parse the analyzer summary
- display raw vs range-reduced accuracy, ULP/error, false convergence, cancellation and stop-rule state
- clearly separate `MCU evidence` from `host reference judgment`

### P1.3 Add experiment cards, not just Bench 01/02/03 modes

Keep the three-stage conceptual structure, but add an experiment picker under Numerical Bench:

- ADC Stability
- Requantization
- Filter Lag
- Finite Difference
- Integration
- Summation
- Photogate Timing
- Switch Bounce
- PIR Event Timing
- PWM Quantization
- Multi-Sensor Event Lab
- Taylor Reliability

Each card should show hardware required, expected output schema, what numerical mechanism it demonstrates, and whether its reference is physical, empirical, analytic, libm-based, or host-oracle based.

## Priority 1 — scientific correctness / semantics

### P1.4 Distinguish physical error, numerical error, and reference type

Do not collapse all deviations into one `error` concept.

Every experiment/report should label quantities as one of:

- acquisition noise / repeatability
- timing jitter
- quantization error
- discretization / truncation error
- filtering lag/residual
- floating-point rounding / accumulation
- cancellation
- model/reference discrepancy

And every reported reference should be labeled:

- exact analytic reference
- high-precision host oracle
- MCU libm reference
- empirical finest-series baseline
- nominal conversion only

This is particularly important because Bench 02 correctly says the finest measured series is not physical ground truth.

### P1.5 Derivative experiment needs an independent reference path

Current focused derivative firmware uses `cosf(1)` on the same MCU as the reference. That is useful as a local libm comparison, but it is not an independent oracle.

Recommended change:

- rename that field semantically to `mcu_libm_reference`
- preserve raw forward/central estimates and h
- add host-side high-precision reference/error after capture
- report the h at minimum observed error
- show the classic truncation-to-roundoff U-shaped error curve

### P1.6 Summation experiment needs a stronger reference

Current firmware computes the nominal reference using the same float arithmetic family used by the experiment.

Recommended change:

- emit `n` and a rational/integer definition of the increment (for example numerator/denominator)
- let the host compute an exact/Decimal reference
- compare naive float, Kahan, pairwise/tree sum where feasible
- report absolute and relative error plus execution time

### P1.7 Integration should report observed convergence order

Current focused integration firmware already compares left rectangle, trapezoid and Simpson against the analytic value 2.

Recommended host analysis:

`p ~= log(E_n/E_2n) / log(2)`

This turns the experiment from a table into evidence of first/second/fourth-order behavior until floating-point effects dominate.

### P1.8 Quantization should include theoretical bounds

For each reduced bit depth b, report:

- number of representable levels
- LSB size in normalized/count/nominal-voltage units
- theoretical rounding bound of roughly half an LSB (when round-to-nearest is used)
- observed RMS/max reconstruction error

This lets the user compare theory with actual samples.

## Priority 1 — event/timing firmware fixes

### P1.9 Photogate debounce semantics

The focused photogate ISR currently updates `lastEdgeUs` even when an edge is inside the `MIN_EDGE_US` rejection interval. A burst of rejected edges can therefore move the timing baseline and distort the next accepted period.

Recommended fix:

- maintain `lastAcceptedEdgeUs`
- update it only when an edge is accepted
- separately count `rejected_edges`
- emit `accepted_event_index`, `period_us`, `frequency_hz`, `rejected_since_last`

### P1.10 Multi-sensor event loss accounting

The mixed lab stores only the latest photogate period and a boolean flag. Multiple events between 50 Hz loop samples can overwrite each other without evidence.

Recommended change:

- add an interrupt-side event counter
- expose `photo_event_count_total`
- expose `photo_events_since_sample`
- expose `overrun/overwrite` evidence if only the latest period is retained
- keep the atomic copy section

### P1.11 Configurable digital polarity/input mode

Photogate/PIR modules vary in active-high/active-low behavior and whether pull-ups are appropriate.

Recommended recipe parameters or documented compile-time constants:

- active edge: rising/falling
- input mode: INPUT / INPUT_PULLUP
- minimum edge interval

Do not assume all three-pin sensor modules share one electrical output style.

## Priority 2 — acquisition quality

### P2.1 Bench 01 should expose ADC stability diagnostics

Bench 01 currently reports raw ADC, normalization, nominal voltage, PWM command and EMA output.

Add optional rolling diagnostics:

- rolling mean
- standard deviation
- peak-to-peak
- derivative/slew estimate
- saturation flags near 0/1023

This would have made the user's loose-wire potentiometer fault immediately visible as `unstable input` rather than looking like legitimate motion.

### P2.2 Timing metadata should use both device and host evidence

BetterBoard already stores host timestamps internally while the firmware emits device timestamps.

Recommended analysis:

- device interval jitter
- host receive interval jitter
- host-minus-device drift trend
- serial stalls / burst delivery

Do not interpret host receive time as sensor sample time.

### P2.3 Measurement packages should retain rejected-row diagnostics

Current `capture_measurement` filters to rows that match the numeric schema and only saves valid rows.

Recommended metadata additions:

- total lines received
- numeric lines
- schema-matched lines
- ignored text lines
- wrong-column-count rows
- first/last rejection examples (bounded)

This is valuable when firmware prints reset banners, diagnostics, or transient corruption.

## Priority 2 — architecture / catalog

### P2.4 Register focused numeric-error firmware only after hardware/compile validation

Do not immediately add all research sketches to the canonical recipe catalog. First require:

1. UNO compile pass
2. upload pass
3. schema-capture pass
4. deterministic/static self-check where applicable
5. real-hardware sanity pass for sensor-based recipes

Then promote a focused experiment from `research` to `canonical`.

### P2.5 Add recipe maturity state

Suggested states:

- `experimental`
- `validated-software`
- `validated-hardware`
- `canonical`

The UI can show this instead of treating every recipe as equally mature.

### P2.6 Add a Numeric Error analyzer registry

Rather than hard-coding one Bench 02 and one Bench 03 analyzer, define metadata such as:

- analyzer id
- accepted schema
- reference type
- generated metrics
- generated plots/reports

This makes future numerical experiments extensible without bloating `NumericalBenchSuite.tsx`.

## Priority 2 — visualization

Recommended charts:

- ADC stability: raw/rolling mean + rolling std/p2p
- quantization: raw vs reconstructed staircase + error histogram
- filter lag: raw/fast EMA/slow EMA + residual
- derivative: log(error) vs log(h)
- integration: log(error) vs subdivisions with observed slope/order
- summation: error vs operation count
- photogate: period/frequency vs event index + jitter histogram
- switch bounce: edge raster over time
- Bench 03: error/ULP vs x, cancellation ratio vs x, convergence vs term count

Do not plot every available column by default. Give each experiment one primary explanatory visualization plus optional diagnostics.

## Recommended implementation order

1. Fix port candidate filtering and Resource-busy lifecycle.
2. Add explicit Bench 03 completion semantics.
3. Add in-app Bench 02 and Bench 03 analysis execution.
4. Add scientific reference/error-type metadata.
5. Fix photogate accepted-edge timing semantics and add event-loss counters.
6. Add compile/capture self-checks for focused research firmware.
7. Promote the best focused experiments into the recipe catalog/UI.
8. Add plots only after the schemas and metrics are stable.

## Merge boundary for PR #3

PR #3 should remain Draft until the newly added firmware is compiled and, for hardware-dependent recipes, tested on the real UNO setup. The firmware pack is useful research material, but canonical registration and UI wiring should be a second step after validation.
