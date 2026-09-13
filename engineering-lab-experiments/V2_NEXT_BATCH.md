# Engineering Lab v2 — Next Batch

The next implementation batch should focus on evidence quality rather than adding unrelated sensors.

## P0

- Add explicit validity/quality fields for experiments where reads can fail or become stale.
- Add requested-vs-actual sample timing diagnostics without breaking UNO memory limits.
- Expose important calibration/configuration constants in machine-readable metadata.

## P1

- Improve dual-sensor acquisition timing for the ADXL345 and IMU+ToF experiments.
- Add run identity/configuration fingerprints for repeatability.
- Define saturation/range indicators where supported by sensor APIs.

## P2

- Add host-side schema validation fixtures for every catalog entry.
- Add deterministic synthetic traces for checking derivative/filter pipelines.
- Add compatibility tests ensuring existing columns remain stable across enhancement batches.

The governing principle remains: do not hide uncertainty or failure behind a cleaner-looking number.
