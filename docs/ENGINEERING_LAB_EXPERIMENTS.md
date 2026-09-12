# BetterBoard Engineering Lab Experiments

## Purpose

This suite is the measurement-facing layer between the user's planned BetterBoard hardware and Engineering Lab. It is deliberately different from the general Sensor Suite: these programs are not primarily demonstrations of individual sensors. Each program emits a stable, model-oriented data stream chosen so that Engineering Lab can ingest real evidence beside a simulation or numerical model.

The intended chain is:

```text
physical system
→ sensor / encoder / photogate
→ BetterBoard Embedded C++ Core
→ EngineeringLabStream metadata + CSV rows
→ BetterBoard capture
→ LabBridge measurement asset
→ Engineering Lab model / residual / V&V workflow
```

Engineering Lab remains the scientific authority for calibration interpretation, uncertainty, V&V, model fitting, and conclusions. Firmware may timestamp, filter, differentiate, integrate, and summarize, but must not silently claim that a derived observable is ground truth.

## Hardware covered in v1

The first Engineering Lab experiment set targets the hardware already planned for BetterBoard:

| Hardware | Engineering Lab use |
| --- | --- |
| MLX90393 | RADIA field evidence and magnet-model comparison |
| LSM6DSOX + VL53L1X | oscillation displacement + inertial motion evidence |
| ADXL345 x2 | two-point vibration evidence for lattice / structural response |
| Quadrature encoder | rotational state-space evidence for nonlinear dynamics |
| Photogate | event timing, period, and frequency evidence |
| 10k potentiometer / MCU ADC | real ADC quantization and numerical-error evidence |
| Load cell + HX711 | force-time evidence for oscillation / mechanics experiments |
| INA219 | electrical power and integrated-energy context for driven experiments |
| BME280 | environmental drift context for numerical-error and calibration studies |

The planned duplicate hardware (for example multiple MLX90393, ADXL345, encoders, photogates, INA219, and VL53L1X devices) can later support synchronized differential and cross-check experiments. v1 establishes the stream contract and single/paired reference programs first.

## Stream contract

All programs use `betterboard::experiments::EngineeringLabStream`.

At startup, firmware emits comment-prefixed metadata followed by ordinary CSV rows:

```text
#bb-engineering-lab-stream,1
#experiment_id,el-radia-mlx90393-field
#model_target,RADIA Magnet Studio
#sample_interval_us,50000
#columns,time_us,bx_uT,by_uT,bz_uT,bmag_uT
#units,us,uT,uT,uT,uT
#data
123456,10.2,-3.1,41.8,43.1
```

The metadata is designed to make the serial stream self-describing while preserving simple CSV capture. BetterBoard/LabBridge should retain the experiment id, columns, units, board profile, firmware identity, sample interval, and primary observable in the eventual measurement asset.

## Experiments

### 1. `EL_Radia_MLX90393_Field`

**Target:** RADIA Magnet Studio  
**Sensor:** MLX90393  
**Primary observable:** magnetic-field magnitude, with the three measured axes preserved.

This is the strongest direct hardware-to-model path in the suite. Engineering Lab can compare measured field components against RADIA predictions only after the sensor coordinate frame, probe position, background field, and calibration are defined. The firmware therefore transmits the raw field components instead of rotating them into an assumed laboratory frame.

### 2. `EL_Oscillation_LSM6DSOX_VL53L1X`

**Target:** Oscillation & Numerical Integration  
**Sensors:** LSM6DSOX + VL53L1X  
**Primary observable:** distance in metres.

The ToF channel supplies an external displacement-like measurement while the IMU supplies acceleration and angular velocity. The firmware does not double-integrate acceleration into absolute position. Engineering Lab can compare the channels, estimate phase, fit an oscillator, and study numerical integration with explicit awareness of sensor noise and geometry.

### 3. `EL_Honeycomb_Dual_ADXL345`

**Target:** Multilayer Honeycomb Lattice  
**Sensors:** two ADXL345 accelerometers  
**Primary observable:** first sensor's z-axis acceleration, with both full 3-axis vectors retained.

Two spatially separated acceleration measurements are more useful for lattice response than a single scalar RMS value. The sketch therefore preserves both sensor vectors for modal / transfer-response analysis downstream.

### 4. `EL_Chaos_Encoder_Kinematics`

**Target:** Nonlinear Dynamics & Chaos  
**Sensor:** quadrature encoder  
**Primary observable:** angle in radians.

The C++ Core converts count to angle and uses timestamp-aware finite differences for angular velocity and angular acceleration. Engineering Lab should still treat differentiated quantities as derived and noise-sensitive.

### 5. `EL_Oscillation_Photogate_Period`

**Target:** Oscillation & Numerical Integration  
**Sensor:** photogate  
**Primary observable:** event-to-event period.

This is event-driven rather than fixed-rate acquisition. It is useful as an independent timing reference for oscillators, pendula, rotating flags, and repeatability studies.

### 6. `EL_Numerical_ADC_Reference`

**Target:** Numerical Error Analysis  
**Hardware:** 10k linear potentiometer + MCU ADC  
**Primary observable:** raw ADC code.

The sketch transmits raw code, normalized code, and a nominal voltage based on configurable ADC full-scale assumptions. The nominal voltage is explicitly not a calibrated voltmeter reading. This experiment is useful for quantization, repeatability, oversampling, rounding, and model-vs-measurement error studies.

### 7. `EL_ForceDynamics_HX711`

**Target:** Oscillation & Numerical Integration  
**Hardware:** load cell + HX711  
**Primary observable:** force in newtons after a user-supplied counts-per-newton calibration.

The program also emits raw counts, an EMA-filtered force, and a timestamp-aware force derivative. Keeping raw counts makes recalibration possible downstream.

### 8. `EL_PowerContext_INA219`

**Target:** driven oscillation / experimental context  
**Sensor:** INA219  
**Primary observable:** electrical power.

Bus voltage, current, power, and trapezoid-integrated energy are transmitted together. The integrated value follows `mW × s = mJ`. This channel is context for actuator-driven experiments; it does not by itself identify mechanical work or efficiency.

### 9. `EL_Numerical_BME280_Context`

**Target:** Numerical Error Analysis  
**Sensor:** BME280  
**Primary observable:** temperature.

Temperature, pressure, and humidity are environmental covariates for drift analysis. They should be used to test whether apparent measurement changes correlate with environment, not to retroactively 'correct' data without a justified calibration model.

## Models that should not be force-mapped to current sensors

Current hardware does not provide a defensible direct measurement channel for Kerr Black Hole Geodesics, Sun–Jupiter–Saturn Dynamics, or Ising Monte Carlo. Random Walk & Monte Carlo can receive robot-motion evidence only when the experiment has a real position/trajectory observable rather than relying on IMU double integration alone. Radiation Platform should not be presented as directly measured until an appropriate radiation/spectral detector exists; magnet-field evidence can support the upstream undulator/magnet model but is not a radiation measurement.

## Next expansion

The next useful layer is synchronized multi-sensor evidence: dual MLX90393 differential field scans, three-photogate timing, encoder + IMU cross-checks, dual INA219 source/load power accounting, and ToF + encoder motion validation. Those should reuse this same metadata/CSV contract rather than inventing new serial formats.
