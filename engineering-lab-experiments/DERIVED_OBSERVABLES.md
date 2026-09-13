# Derived Observable Definitions

## RADIA / MLX90393

Given measured field components `Bx`, `By`, and `Bz` in microtesla:

- `bxy_uT = sqrt(Bx^2 + By^2)`
- `bmag_uT = sqrt(Bx^2 + By^2 + Bz^2)`
- `azimuth_rad = atan2(By, Bx)`
- `elevation_rad = atan2(Bz, bxy_uT)`

The angles describe the sensor-frame field vector. They do not apply a lab-frame alignment transform.

## Encoder kinematics

Given signed encoder count `count` and configured `BB_COUNTS_PER_REVOLUTION`:

- `revolutions = count / BB_COUNTS_PER_REVOLUTION`
- `angle_rad = 2π * revolutions`
- `phase_rad = angle_rad mod 2π`, normalized to `[0, 2π)`

Angular velocity and acceleration continue to use the BetterBoard finite-difference pipeline. The emitted raw count remains the audit source for the angle conversion.
