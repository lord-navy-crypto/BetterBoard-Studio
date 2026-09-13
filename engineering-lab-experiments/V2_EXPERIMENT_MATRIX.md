# Engineering Lab v2 Experiment Matrix

| Experiment | v1 evidence | v2 enhancement direction |
|---|---|---|
| MLX90393 / RADIA | Bx, By, Bz, magnitude | transverse magnitude + sensor-frame direction; later validity/timing/provenance |
| LSM6DSOX + VL53L1X | distance + accel + gyro | cross-sensor acquisition timing, validity, range/state metadata |
| Dual ADXL345 | two 3-axis acceleration vectors | synchronization/skew evidence, per-sensor validity, configuration provenance |
| Encoder | count, angle, omega, alpha | revolutions + wrapped phase; later event/timing quality |
| Photogate | period, frequency, event index | edge timing/jitter and missed-event diagnostics |
| ADC reference | code, normalized value, nominal voltage | reference/config provenance, quantization context, saturation flags |
| HX711 | raw, force, filtered force, derivative | readiness/settling quality, calibration provenance, filter configuration |
| INA219 | voltage, current, power, energy | actual integration interval, read validity, range/config provenance |
| BME280 | temperature, pressure, humidity | baseline/drift context, read validity, acquisition cadence |

The matrix is intentionally evidence-centered. Model fitting and scientific conclusions remain in Engineering Lab.
