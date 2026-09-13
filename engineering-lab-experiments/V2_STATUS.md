# Engineering Lab v2 Status

**Branch:** `enhance/engineering-lab-experiments-v2`

**Batch 1:** richer observables implemented.

**Batch 2:** quality/timing/provenance implementation substantially landed across all nine experiments.

Implemented:

- MLX90393/RADIA vector-direction observables plus explicit read failure rows, sample timing, read duration, and quality flags;
- encoder revolution/phase observables plus timing, calibration-default provenance, and derived-readiness quality;
- LSM6DSOX + VL53L1X sequential-acquisition skew, timing, duration, and validity evidence;
- dual ADXL345 acquisition-skew timing and configuration provenance;
- photogate ISR timestamps, dispatch latency, cumulative dropped-event count, and row-local `EventDropped` quality;
- ADC quantization step, rail/saturation indication, read timing, and ADC-reference provenance;
- HX711 calibration/filter provenance, read timing, default-calibration flag, and derivative readiness;
- INA219 actual integration interval, read timing, finite-value validation, and trapezoid provenance;
- BME280 detected I2C address provenance, read timing, and finite-value validation;
- Engineering Lab stream v2 metadata with optional `#configuration` provenance;
- a shared composable quality bitmask contract;
- fail-closed catalog/firmware schema validation wired into Engineering Lab CI.

Still required before merge:

- pull-request CI on the exact final head;
- UNO and ESP32-S3 compilation of all nine sketches;
- BetterBoard C++ Core, BetterBoard CI, Engineering Lab Experiments, and Sensor Suite v1 Integrity all successful on that same unchanged head;
- final open/mergeable/head-stability check.
