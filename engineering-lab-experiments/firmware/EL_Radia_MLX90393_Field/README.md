# EL_Radia_MLX90393_Field

Streams the MLX90393 magnetic-field vector as experimental evidence for RADIA Magnet Studio.

## v2 observables

In addition to `Bx`, `By`, `Bz`, and total magnitude, the stream exports:

- `bxy_uT`: transverse field magnitude `sqrt(Bx^2 + By^2)`
- `azimuth_rad`: `atan2(By, Bx)`
- `elevation_rad`: `atan2(Bz, Bxy)`

These values make field-direction comparisons possible without discarding the original sensor vector. They are directly derived observables, not a claim that the measured field agrees with a RADIA model. Alignment, background subtraction, uncertainty, coordinate transforms, and model residuals belong in Engineering Lab.
