# BetterBoard Virtual Circuit Mode — Design Proposal

## Product idea

BetterBoard should eventually include a visual circuit-composition mode where users place board/component blocks on a 2-D canvas, connect pins, run design checks, optionally simulate supported behavior, and then reproduce the same design on real hardware.

The important product boundary is to separate **wiring/design validation** from **electrical simulation**. A visually connected circuit is not automatically electrically safe or physically accurate.

## Proposed workflow

```text
Choose goal
  → place board
  → place components
  → wire pins
  → run Design Doctor
  → run supported simulation
  → generate wiring guide + firmware recipe
  → deploy to real board
  → capture real measurements
  → compare simulation vs reality
```

This gives BetterBoard a distinctive loop:

```text
DESIGN → SIMULATE → BUILD → MEASURE → COMPARE
```

## Layer 1 — Circuit Composer

A 2-D graph editor should represent:

- boards
- breadboards
- sensors
- potentiometers
- LEDs
- resistors
- buttons
- displays
- motor drivers
- motors
- buses and wires

Each visual part is backed by a machine-readable component definition rather than being only an image.

Suggested component schema:

```json
{
  "id": "potentiometer-generic",
  "kind": "input",
  "pins": [
    {"id":"vcc","role":"power"},
    {"id":"signal","role":"analog-output"},
    {"id":"gnd","role":"ground"}
  ],
  "electrical": {
    "supported_supply_v": [3.3, 5.0]
  },
  "simulation_model": "potentiometer"
}
```

Real modules must use exact device profiles when voltage/pin behavior matters. BetterBoard should never infer that every board labelled S/V/G is automatically 5-V safe.

## Layer 2 — Design Doctor

Before any simulation, BetterBoard can implement deterministic rules that are much easier and safer than a full circuit solver:

- unconnected required pins
- power/ground missing
- output-to-output conflicts
- analog source connected to an unsuitable pin
- I2C SDA/SCL mapping
- duplicate bus address warnings where known
- board pin capability checks
- missing motor driver between MCU GPIO and DC motor
- unsupported or unknown voltage-domain warning
- pin conflicts between recipe and wiring

A pass means "the design is internally consistent with known rules", not "the physical circuit is guaranteed safe or correct".

## Layer 3 — Behavioral simulation

The first simulator should be component-level and educational rather than a full SPICE replacement.

Initial supported models could include:

- digital HIGH/LOW
- button/switch
- LED state
- PWM duty cycle
- potentiometer position
- ADC quantization
- simple serial output
- timers
- simple I2C virtual devices

Bench 01 is a good first reference model:

```text
virtual potentiometer
  → virtual A0 ADC
  → Bench 01 firmware/model
  → normalized input
  → filter
  → PWM output
  → virtual LED brightness
```

## Layer 4 — MCU execution

A later phase may emulate supported microcontrollers or execute a compatible compiled firmware runtime. This is significantly more difficult than the visual editor and design checker and should remain modular.

The simulator must report which behavior is emulated and which is approximated.

## Layer 5 — Analog/electrical solver

A real analog circuit simulator requires solving circuit equations and component models. This is a separate subsystem from MCU emulation. It should not be faked with arbitrary animations.

If BetterBoard later supports analog simulation, the engine should have explicit models, solver tolerances, units, and unsupported-component reporting.

## Layer 6 — Real-hardware handoff

The strongest BetterBoard feature is not simulation alone. A virtual project should be able to become a real recipe:

```text
virtual project
  → wiring map
  → bill of materials
  → generated/selected firmware
  → Preflight
  → Compile
  → Upload
  → Live Data
```

Then real data can be compared with predicted data:

```text
simulation.csv
measurement.csv
residual.csv
```

This is where BetterBoard can connect naturally to Physical Lab.

## Recommended implementation order

### Phase A — Composer

- infinite/pannable 2-D canvas
- component palette
- draggable blocks
- pins and wires
- save/load project JSON
- UNO + potentiometer + LED + resistor + breadboard first

### Phase B — Design Doctor

- graph/net model
- pin capability database
- deterministic connection checks
- warnings/errors with explanations

### Phase C — Bench 01 virtual model

- virtual knob
- 10-bit ADC
- endpoint calibration
- first-order filter
- PWM duty output
- virtual LED brightness
- graph signals in Data Studio

### Phase D — Firmware integration

- map visual project to BetterBoard recipe
- compile/upload to the selected real board
- preserve project/wiring metadata in the measurement package

### Phase E — Expanded simulation

- digital logic
- timers
- serial
- I2C devices
- supported displays and sensors

### Phase F — Optional advanced solver/emulation

- MCU emulation
- analog circuit solving
- richer timing behavior

## Why this is worth building

Existing circuit tools prove that visual breadboard editors and Arduino simulation are technically feasible. BetterBoard's opportunity is to connect that idea directly to its hardware intelligence, recipe system, compile/upload path, measurement evidence, and Physical Lab bridge instead of treating simulation as an isolated toy.
