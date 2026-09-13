# Engineering Lab Experiments v2 — Enhancement Era

The v1 suite established reliable, self-describing measurement streams. v2 moves the suite toward stronger experimental evidence without moving scientific interpretation into firmware.

## Design rule

Firmware should preserve and expose useful measured or directly derived observables. Calibration interpretation, uncertainty models, fitting, residual analysis, validation decisions, and scientific conclusions remain in Engineering Lab.

## Enhancement priorities

1. **Vector-aware magnetic evidence** — RADIA/MLX90393 now exports transverse magnitude plus field azimuth and elevation, preserving the original Cartesian components and total magnitude.
2. **Phase-aware rotational evidence** — the encoder experiment now exports cumulative revolutions and wrapped phase alongside angle, angular velocity, and angular acceleration.
3. **Timing quality** — future passes should expose sample/event timing diagnostics where sensor cadence can differ from requested cadence.
4. **Calibration provenance** — configuration constants should become explicit stream metadata rather than hidden compile-time assumptions.
5. **Quality flags** — sensor read failures, stale samples, saturation, and invalid derived values should become machine-readable evidence instead of silently disappearing.
6. **Cross-sensor synchronization** — multi-sensor experiments should preserve acquisition timing sufficiently for phase and transfer-function work.
7. **Repeatability** — experiment/run identifiers and configuration fingerprints should allow two captures to be compared without guessing firmware settings.

## Scientific boundary

These additions are diagnostics and observables, not automatic scientific claims. A field direction is not a magnet-model validation result; encoder phase is not a chaos diagnosis. Engineering Lab remains responsible for comparing these measurements against models and deciding what the comparison means.
