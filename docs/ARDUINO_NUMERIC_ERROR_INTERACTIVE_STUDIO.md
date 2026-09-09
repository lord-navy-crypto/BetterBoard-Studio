# Arduino Numeric Error Interactive Studio

This research-stage bridge is designed after reading the current Physical Lab / Engineering Lab Numerical Error integration and the underlying `lord-navy-crypto/numerical-methods` Studio.

Physical Lab currently registers Numerical Error Analysis as module `numerical-methods`, backed by `lord-navy-crypto/numerical-methods`. That Studio studies raw versus range-reduced Taylor sine evaluation, float32/float64 behavior, cancellation, stopping rules, independent reference comparison, normalized error, false convergence and reliability status. The Arduino firmware therefore does not invent a second incompatible science model: it exposes the same core MCU-side quantities and leaves independent reference/error classification to the host.

## Files

Firmware:

`src-tauri/resources/firmware/NumericError_InteractiveStudio/NumericError_InteractiveStudio.ino`

Host bridge:

`scripts/arduino_numeric_error_bridge.py`

## Hardware

Optional hardware channels already owned by the user:

- A0 — potentiometer: maps continuously into the configured x range
- D2 — photogate / optical pulse: event-triggered numerical evaluation
- D3 — PIR: context state recorded into every row
- D4 — switch with INPUT_PULLUP: context/manual state recorded into every row
- D9 — LED PWM: live input/activity visualization

No MPU6050 dependency is included because the current I²C hardware path is not yet validated.

## Why the protocol is split into control text and numeric evidence

Interactive commands and status messages start with `#`.

Measurement rows contain only numeric CSV fields. This lets BetterBoard / Physical Lab numeric serial capture discard text while preserving every evidence row.

Canonical MCU evidence schema:

```text
seq,run_id,source_id,method_id,time_us,x,reduced_x,approximation,library_sin,terms_used,last_term,cancellation_ratio,stopping_met,finite,elapsed_us,adc_raw,pot_norm,pir_state,switch_state,photo_event_count
```

`library_sin` is explicitly MCU-local comparison evidence. It is **not** an independent oracle.

## Interactive serial commands

At 115200 baud:

```text
HELP
STATUS
SCHEMA
METHOD RAW
METHOD REDUCED
TERMS 80
TOL 8
X 1.5707963
RANGE -3.14159265 3.14159265
POINTS 101
PERIOD 100
RUN SINGLE
RUN BOTH
RUN SWEEP
RUN LIVE
RUN PHOTO
STOP
```

### RUN SINGLE

Evaluates the configured x once using the selected method.

### RUN BOTH

Evaluates the same x twice: raw Taylor and range-reduced Taylor. This is the fastest interactive cancellation comparison.

### RUN SWEEP

Evaluates evenly spaced x values across the configured range. The output is deterministic and intended for direct host reference comparison.

### RUN LIVE

A0 becomes an interactive x control. Every `PERIOD` milliseconds, the firmware maps the potentiometer into `[range_min, range_max]`, evaluates the selected Taylor method, records the digital context channels, and emits one row.

This produces a genuinely interactive numerical experiment: the physical knob changes the numerical input while the computer can simultaneously plot approximation, reference error, terms, cancellation and execution cost.

### RUN PHOTO

Each accepted D2 falling edge triggers one evaluation. The current A0 position supplies x. This connects an external physical event to a numerical-computation sample without pretending the photogate itself is a numerical oracle.

## Arduino → computer → Numerical Error Studio

The complete scientific chain is:

```text
Arduino input / serial command
        ↓
float32 Taylor arithmetic on UNO
        ↓
numeric-only evidence row
        ↓
BetterBoard / Physical Lab serial capture
        ↓
arduino_numeric_error_bridge.py
        ↓
mpmath high-precision host reference
        ↓
Numerical Error Studio-compatible columns
        ↓
plots / normalized error / false convergence / reliability
```

Run the bridge on a captured CSV or serial log:

```bash
python3 scripts/arduino_numeric_error_bridge.py capture.csv
```

Outputs:

```text
arduino-numeric-error-bridge/
├── numerical_error_studio_rows.csv
└── bridge_summary.json
```

The enriched CSV begins with the canonical Numerical Error Studio concepts:

- x
- method
- dtype
- reference backend / precision
- reduced x
- approximation
- reference
- absolute / relative / ULP error
- allowed absolute error
- normalized error
- terms used
- cancellation ratio
- stopping criterion
- accuracy passed
- numerically reliable
- false convergence
- status

Arduino provenance/context columns are appended afterward rather than replacing the Studio's scientific fields.

## Important UNO arithmetic fact

On the classic AVR Arduino UNO, `float` and `double` are both 32-bit. Therefore this firmware correctly labels the MCU arithmetic under test as `float32`. It should not claim to reproduce the desktop Studio's true float64 mode.

That difference is valuable evidence: the desktop can compare Arduino float32 results with NumPy/mpmath and with its own float64 computation.

## Recommended first experiment

1. Upload the interactive firmware.
2. Open serial at 115200.
3. Send:

```text
METHOD RAW
RANGE -80 80
POINTS 161
RUN SWEEP
```

4. Capture the numeric rows.
5. Run the host bridge.
6. Repeat with:

```text
METHOD REDUCED
RUN SWEEP
```

7. Compare raw versus range-reduced Arduino arithmetic against the same independent host reference.

This directly mirrors the central research question of the current Numerical Error Analysis Studio: a Taylor series can be mathematically valid while its direct floating-point implementation becomes numerically unreliable through cancellation.

## Canonical-promotion gate

This firmware is intentionally research-stage. Before adding it to BetterBoard's canonical recipe catalog or wiring it directly into the Physical Lab UI:

1. compile for `arduino:avr:uno`;
2. upload to the real UNO;
3. verify every command path;
4. capture SINGLE / BOTH / SWEEP / LIVE / PHOTO evidence;
5. validate the host bridge against the current `numerical-methods` implementation;
6. add deterministic protocol/self-check tests;
7. only then promote it into the canonical UI.
