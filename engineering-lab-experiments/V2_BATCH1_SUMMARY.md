# Engineering Lab v2 — Batch 1 Summary

Batch 1 starts the enhancement era by improving the scientific usefulness of existing sensors rather than increasing sensor count.

- The MLX90393 stream now preserves field direction explicitly through transverse magnitude, azimuth, and elevation while retaining all original components.
- The encoder stream now exposes cumulative revolutions and wrapped phase while retaining raw counts and unwrapped kinematics.
- Catalog schemas were updated in lockstep.
- The suite now has explicit policies for evidence quality, derived quantities, schema evolution, compatibility, scientific boundaries, testing, review, and future enhancement gates.

The next code-heavy batch should implement quality flags, actual timing diagnostics, and calibration/configuration provenance across the suite.
