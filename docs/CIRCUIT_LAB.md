# BetterBoard Circuit Lab — Phase A/B

Circuit Lab is the design-before-build layer of BetterBoard Studio.

The first implementation intentionally does **not** simulate voltages, currents, MCU execution, timing, or component physics. It focuses on two deterministic capabilities that are useful before simulation exists:

1. **Visual Wiring Editor** — place low-voltage Arduino components, move blocks, connect named pins, inspect components, delete wires/components, save/load a design locally, and copy the design as JSON.
2. **Rule Checker** — continuously inspect the connection graph for a bounded set of known wiring mistakes and incomplete Bench 01 connections.

## Current component library

- Arduino UNO-compatible board
- potentiometer
- LED
- resistor
- push button

The UNO block exposes a deliberately small first pin set: 5V, 3V3, GND, A0–A2, D2, D3 PWM, and D9 PWM. The library is intentionally small enough that every exposed pin can have explicit semantics instead of being a decorative image.

## Wiring interaction

Click a pin to start a wire, then click another pin to finish it. Click the same pending pin again to cancel. Blocks can be dragged around the canvas. Wires are represented as graph edges between stable component/pin identifiers, not as painted pixels.

The stored design schema is:

```text
betterboard.circuit-design/0.1
```

A design contains a name, placed components, coordinates, and graph edges. The first version can save/load the JSON in local storage and copy the JSON to the clipboard.

## Rule Checker v0.1

The current rules detect or flag:

- missing or multiple controller boards
- direct power-to-ground wires
- direct 5V/3V3 rail conflicts when rail voltage is known
- a board power rail wired directly to an I/O pin
- potentiometer VCC not connected to a power pin
- potentiometer GND not connected to GND
- potentiometer signal not connected to an analog input
- LED directly connected to a board output/power source without a series resistor
- LED cathode missing the expected GND return in the Bench 01 rule set
- resistor paths with one open end
- dangling graph references

A `Rule set passes` result means only that the bounded rules above found no known violation. It is **not** a SPICE result, current/thermal calculation, electrical-safety certification, damage prediction, or proof that an unknown module is safe at a chosen voltage.

## Bench 01 handoff

`Bench 01 template` loads the reference design:

```text
UNO 5V  -> Potentiometer VCC
UNO GND -> Potentiometer GND
Pot SIG -> UNO A0
UNO D9  -> Series resistor -> LED anode
LED cathode -> UNO GND
```

After the rule set passes, `Use Bench 01 firmware` switches BetterBoard to the existing `analog_a0` recipe. The normal BetterBoard workflow then remains authoritative for preflight, compile, upload, serial capture, and measurement packaging.

## Product boundary

Circuit Lab Phase A/B is:

```text
DESIGN -> RULE CHECK -> REAL HARDWARE HANDOFF
```

It is deliberately **not yet**:

```text
DESIGN -> ELECTRICAL SIMULATION
```

Later phases can add behavioral models or an external simulation engine without replacing the graph/editor architecture introduced here.
