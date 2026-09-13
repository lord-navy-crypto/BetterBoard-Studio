# Engineering Lab Experiments v2 Roadmap

The enhancement era is a sequence of implementation batches, not a one-off documentation pass.

## Batch 1 — richer observables

Implemented on this branch: vector-direction diagnostics for MLX90393/RADIA and phase/revolution observables for encoder dynamics, with additive schemas and explicit scientific boundaries.

## Batch 2 — evidence quality

Add machine-readable validity state, stale/read-failure handling, requested-versus-actual timing diagnostics, and calibration/configuration provenance across all nine experiments.

## Batch 3 — synchronization

Strengthen dual-sensor timing for ADXL345 x2 and LSM6DSOX + VL53L1X; preserve acquisition-time relationships needed for phase, transfer-function, and residual analysis.

## Batch 4 — reproducibility

Add run identity, configuration fingerprints, stable schema/version metadata, and deterministic host-side fixtures for filters and finite differences.

## Batch 5 — experiment depth

Add scientifically useful but auditable observables per experiment: event jitter for photogate, ADC quantization/reference context, HX711 settling/quality evidence, INA219 integration timing, and BME280 environmental drift baselines.

## Merge discipline

Every batch must pass Engineering Lab Experiments, BetterBoard C++ Core, BetterBoard CI, and Sensor Suite v1 Integrity on the exact unchanged PR head before a normal merge.
