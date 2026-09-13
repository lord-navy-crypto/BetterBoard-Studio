# Engineering Lab v2 Enhancement Changelog

## Batch 1

- Extended MLX90393/RADIA evidence from vector components + magnitude to include transverse magnitude and sensor-frame field direction.
- Extended encoder dynamics evidence with cumulative revolutions and wrapped phase while retaining raw count and unwrapped angle.
- Updated the experiment catalog to make the new stream schema explicit.
- Added an evidence quality contract, derived-observable definitions, an enhancement roadmap, and strict acceptance gates.

This batch deliberately strengthens evidence fidelity before adding more firmware-side processing. Later batches should prioritize quality flags, timing diagnostics, calibration provenance, run identity, and cross-sensor synchronization.
