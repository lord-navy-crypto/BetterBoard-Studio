# BetterBoard Studio — DIY-First Expansion Architecture

## Goal

Evolve BetterBoard from a curated recipe launcher into a configurable physical-computing workbench while preserving the existing evidence-first chain:

`Goal → Board → Recipe → Preflight → Compile → Upload → Capture → Measurement`

The extension should not replace canonical recipes. It should add a user-defined layer on top of them.

## 1. Recipe = template + parameters + hardware map + schema

A canonical recipe should become a reusable template rather than a frozen sketch.

Suggested user-editable manifest fields:

```json
{
  "recipe_id": "user.analog-control",
  "base_recipe": "analog_a0",
  "board": "arduino:avr:uno",
  "pins": {
    "analog_input": "A0",
    "led_pwm": "D9",
    "switch": "D4"
  },
  "parameters": {
    "sample_hz": 50,
    "ema_alpha": 0.2,
    "vref_nominal_v": 5.0,
    "pwm_bits": 8
  },
  "channels": [
    {"name":"raw_adc","type":"int","unit":"count"},
    {"name":"voltage_v","type":"float","unit":"V"},
    {"name":"filtered_voltage_v","type":"float","unit":"V"}
  ]
}
```

BetterBoard should generate the final firmware from the template and manifest, while keeping the generated `.ino` visible and exportable.

## 2. Parameter panel generated from firmware metadata

Firmware should expose bounded editable parameters via a small metadata block rather than requiring source edits.

Example:

```text
sample_hz      integer   1..500      default 50
ema_alpha      float     0.01..1.0   default 0.20
vref_nominal   float     1.0..5.5    default 5.0
pwm_pin        pin       PWM-capable default D9
```

The UI can render sliders, numeric fields, toggles and pin selectors automatically.

## 3. Pin remapping as a first-class capability

Do not hard-code A0/D2/D3/D4/D9 in every recipe.

Add a pin capability registry:

- analog input
- digital input
- interrupt-capable
- PWM-capable
- I2C SDA/SCL
- SPI
- power / ground

Then a recipe asks for capabilities, e.g. `interrupt_input`, and the user selects any compatible physical pin.

Preflight must reject impossible mappings before compile.

## 4. Channel Builder

Allow users to assemble a measurement row from reusable channel blocks:

- analog read
- digital state
- edge/event count
- period/frequency
- filtered value
- derived expression
- PWM command
- timestamp
- run/trial id

Each channel declares:

- name
- type
- unit
- source
- transform
- expected range
- whether it is raw, derived or context-only

The resulting schema must be stored in `metadata.json`.

## 5. Transform pipeline

A channel should be able to pass through a declared pipeline:

`source → normalize → calibrate(optional) → filter → derived expression → output`

Initial safe transforms:

- scale / offset
- clamp
- moving average
- EMA
- median window
- difference
- integral accumulator
- frequency from period
- map range
- quantize to N bits

Transforms should be visible and ordered; no hidden processing.

## 6. Trigger Builder

Support multiple acquisition modes:

- periodic sampling
- edge-triggered
- threshold-triggered
- switch/manual marker
- photogate event
- command-triggered single shot
- bounded burst

A trigger definition should be separate from the measured channels.

## 7. Experiment Composer

Move beyond one recipe = one sketch.

An Experiment Composer should let the user choose:

- inputs
- outputs
- processing blocks
- trigger
- sampling policy
- serial schema
- visualization

Example:

`potentiometer → EMA → threshold compare → LED PWM`

plus

`photogate → period → frequency`

in the same experiment.

The composer should generate a deterministic firmware bundle and manifest.

## 8. Serial Protocol V2

Keep the current numeric-only CSV compatibility, but add an optional structured protocol mode.

Control/metadata messages:

```text
#SCHEMA,...
#RUN_START,...
#RUN_END,...
#EVENT,...
#WARNING,...
```

Measurement rows remain numeric CSV for compatibility.

For advanced recipes, optionally support JSON Lines in a separate mode, never mixed silently with canonical numeric CSV.

## 9. Live Serial Console + command controls

Interactive firmware should declare supported commands so BetterBoard can generate controls automatically:

- buttons for `RUN SINGLE`, `STOP`, `RESET`
- dropdown for `METHOD`
- sliders for `TERMS`, `TOL`, `PERIOD`
- text/numeric input for `X`, ranges and thresholds

The console remains available for direct manual commands.

## 10. Visualization Builder

Users should be able to select any captured channels and create:

- time-series plot
- XY plot
- scatter
- histogram
- event raster
- raw vs filtered overlay
- reference vs measured overlay
- error plot

Visualizations should be saved as part of the experiment definition, not only as transient UI state.

## 11. Derived-analysis plugins

Separate acquisition from analysis.

A recipe or experiment can declare optional analyzers:

- ADC stability
- quantization
- filter lag
- numerical derivative
- numerical integration
- FFT / dominant frequency
- photogate period statistics
- switch bounce
- Arduino Numerical Error bridge
- magnetic characterization

Analyzers consume named channels and produce JSON/CSV/Markdown evidence artifacts.

## 12. Canonical / Research / User layers

BetterBoard should explicitly distinguish:

1. Canonical recipes — validated and shipped.
2. Research recipes — experimental, source-visible, not yet fully validated.
3. User recipes — locally created or modified DIY experiments.

Never silently promote a user/research recipe to canonical.

## 13. Fork Recipe

Every canonical recipe should have:

`Fork as DIY Recipe`

This copies its manifest into the user's workspace and allows:

- pin remap
- parameter changes
- added channels
- changed transforms
- alternate triggers
- extra outputs

The original canonical recipe remains unchanged.

## 14. Hardware capability profiles

Device definitions should describe capabilities, not only names.

Example photogate profile:

```json
{
  "id":"generic-photogate-digital",
  "interfaces":["digital_input"],
  "recommended_capability":"interrupt_input",
  "signal_semantics":"edge/event",
  "calibration_claim":false
}
```

This lets the same firmware work with multiple compatible modules.

## 15. Circuit Lab ↔ Recipe Composer integration

Circuit Lab should become a live source of the hardware map.

`Visual circuit → validated pin map → generated recipe manifest → firmware`

The user should not enter the same pin assignments twice.

Rule Checker should validate both electrical graph constraints and firmware capability requirements.

## 16. Capture Profiles

Let users define:

- duration
- row limit
- expected sample rate
- stop condition
- filename label
- trial id
- notes

Profiles can be reused across repeated experiments.

## 17. Trial / Campaign mode

Add a bounded repeated-trial layer:

- repeat N times
- sweep one parameter
- randomize trial order
- attach trial metadata
- generate one manifest across all runs

This should be generic so Numerical Bench, Magnet Bench and ordinary Arduino recipes all reuse it.

## 18. Provenance for DIY experiments

Every generated measurement package should include:

- base recipe id + revision
- user manifest
- generated firmware SHA-256
- board/FQBN
- selected port
- compile/upload timestamps
- parameter values
- hardware mapping
- channel schema
- analyzer versions

DIY must increase flexibility without reducing reproducibility.

## 19. Safety / claim boundaries

DIY mode must remain low-voltage physical-computing focused.

Preflight should continue blocking known-invalid pin/power mappings. UI labels must distinguish nominal conversion from calibration and measurement evidence from physical truth.

## 20. Recommended implementation sequence

### Phase A — high value / low architecture risk

- Fork Recipe
- editable recipe parameters
- pin remapping with capability checks
- generic Channel Builder
- generated serial schema
- saved visualization definitions

### Phase B — experiment composition

- Transform pipeline
- Trigger Builder
- reusable capture profiles
- analyzer selection
- Circuit Lab → recipe hardware-map handoff

### Phase C — advanced DIY

- multi-source Experiment Composer
- campaign / parameter sweep
- interactive command controls generated from firmware metadata
- local user recipe library
- export/import complete experiment bundles

### Phase D — cross-Lab evidence

- one-click Arduino Numeric Error bridge
- one-click Magnet Bench characterization/model-validation bridge
- Physical Lab Project export with complete provenance

## Core product principle

BetterBoard should move from:

`choose a prepared sketch`

into:

`compose a reproducible physical-computing experiment`

without giving up the existing canonical workflows.
