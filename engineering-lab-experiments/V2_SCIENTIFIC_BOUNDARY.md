# Scientific Boundary for Engineering Lab Firmware

BetterBoard firmware may calculate quantities that are direct, deterministic transforms of measurements when doing so preserves useful evidence or makes acquisition semantics explicit. Examples include vector magnitude, sensor-frame direction, encoder angle, wrapped phase, elapsed energy, or a documented finite difference.

Firmware must not turn those transforms into conclusions. In particular, it must not decide that a RADIA model is validated, that a trajectory is chaotic, that a lattice mode has been identified, or that a numerical method is accurate enough. Those conclusions require calibration, uncertainty, model assumptions, residual analysis, and experimental context that belong in Engineering Lab.

The v2 standard is therefore: **richer evidence, explicit assumptions, visible failures, downstream judgment.**
