# Engineering Lab v2 — Batch 2 Specification

Batch 2 is the evidence-quality pass across all nine experiments.

## Common goals

- Represent read validity explicitly where sensor APIs can report failure/readiness.
- Preserve actual acquisition timing when it differs materially from loop scheduling time.
- Surface important compile-time calibration/configuration values in a stable metadata mechanism.
- Avoid emitting a synthetic zero for unavailable data.
- Keep schema growth additive where practical.

## Multi-sensor experiments

For LSM6DSOX + VL53L1X and dual ADXL345, record enough timing information to estimate acquisition skew rather than implying simultaneous samples.

## Derived pipelines

For encoder finite differences, HX711 filtering/derivative, and INA219 energy integration, document and expose the configuration or time interval required to reproduce the derived output.

## Acceptance

Batch 2 is not complete merely because code compiles. Automated checks should prove catalog/header consistency, supported-board compilation, and unchanged-head success of all four repository workflow gates.
