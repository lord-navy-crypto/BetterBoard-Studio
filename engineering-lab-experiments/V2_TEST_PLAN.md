# Engineering Lab v2 Test Plan

## Automated

- Parse `catalog.json` and verify each sketch exists.
- Verify stream header columns and units match the catalog.
- Compile all nine sketches on every board in the Engineering Lab CI matrix.
- Run BetterBoard C++ Core, BetterBoard CI, Engineering Lab Experiments, and Sensor Suite v1 Integrity on the exact PR head.

## Bench checks for Batch 1

### MLX90393
- Rotate a stable field source and confirm Cartesian components and angles change coherently.
- Confirm `bxy_uT` and `bmag_uT` agree with recomputation from emitted components within formatting precision.
- Confirm azimuth/elevation remain finite for ordinary field vectors.

### Encoder
- Rotate through multiple turns in both directions and confirm raw count and cumulative revolutions retain sign.
- Confirm `phase_rad` stays in `[0, 2π)` while `angle_rad` remains unwrapped.
- Confirm downstream recomputation from count and configured counts/revolution agrees with emitted values.

Bench observations should be treated as acquisition verification, not model validation.
