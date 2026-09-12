# BetterBoard Sensor Suite v1

Sensor Suite v1 turns the planned BetterBoard / Engineering Lab hardware set into an installable BetterBoard program library without changing the canonical built-in catalog. The suite is intentionally additive: the existing MLX90393, ADXL345, photogate, quadrature encoder, RPM, numerical, and random-walk recipes remain unchanged.

## Install

On macOS, run:

```text
INSTALL_SENSOR_SUITE.command
```

or:

```bash
python3 scripts/sensor_suite_self_check.py
python3 scripts/install_sensor_suite.py
```

The installer reads every `sensor-suite/catalog*.json` expansion catalog and writes stable recipe files to:

```text
~/Documents/BetterBoard/library/
```

BetterBoard already loads that directory as its user recipe library. Refresh the Recipe Library after installation.

Installer writes are atomic: each recipe is fully written to a temporary file, flushed to disk, and then moved into place. Re-running installation is deterministic and idempotent for an unchanged repository state.

## Program museum

The suite ships **56 installable experiments** across acquisition, dynamics, numerical methods, V&V, mechanics, timing, electrical power, environment, magnetics, calibration, sensor fusion, reliability, low-voltage control, advanced measurement, and system identification.

The v1 program count is intentionally held at 56 during the current hardening phase. Current work prioritizes correctness, metadata integrity, deterministic installation, cross-target compilation, scientific boundaries, and regression protection rather than adding more recipes.

## Quality contract

Every Sensor Suite recipe is required to satisfy the same repository-level contract before it is considered installable:

- unique, path-safe recipe and sketch identifiers;
- firmware located exactly under `sensor-suite/firmware/<sketch>/<sketch>.ino`;
- non-empty Sensor Suite title/category/description/scientific boundary metadata;
- numeric capture columns with one-to-one units and a valid primary column;
- positive baud/sample-rate metadata where applicable;
- non-empty hardware, Engineering Lab target, and experimental-note metadata;
- parameter keys/macros that are unique, range-consistent, and actually referenced by the firmware;
- firmware `Serial.begin(...)` consistent with catalog baud metadata;
- deterministic user-recipe materialization with no partial temporary files left behind;
- compilation for both Arduino UNO and ESP32-S3 reference targets.

## Scientific boundaries

The program museum is designed around evidence-first measurement. Derived quantities remain explicit. IMU integration is not absolute position/angle truth; numerical differentiation amplifies noise; ADC codes are not calibrated voltage without ADC/reference characterization; PWM is not torque/speed; photogate-derived speed requires measured geometry; energy-per-mass omits other energy terms; ToF repeatability is not absolute accuracy; field integration assumes accurate spatial stepping/orientation; load-cycle differences can include fixture/calibration effects; dew point inherits temperature/humidity uncertainty; and INA219 transient timing is bandwidth-limited.

Engineering Lab should own calibration metadata, uncertainty, model-to-measurement comparison, V&V, and final scientific interpretation.

## Recommended experiment bundles

### Motion / dynamics bench

```text
LSM6DSOX + VL53L1X + photogate + quadrature encoder
        -> x(t), a(t), omega(t), events, theta(t)
        -> direct + derived kinematics + repeatability statistics
        -> BetterBoard measurement package
        -> Engineering Lab Oscillation / Chaos comparison
```

### Cross-sensor rotational V&V

```text
LSM6DSOX + quadrature encoder
        -> gyro angle + encoder angle
        -> disagreement(t)
        -> Engineering Lab calibration / V&V evidence
```

### Magnetic digital-twin bench

```text
MLX90393 + controlled non-magnetic positioning fixture
        -> B vector + magnitude + direction stability + spatial scan
        -> BetterBoard Magnet Bench
        -> Engineering Lab RADIA / Digital Twin residuals
```

### Reliability / drift bench

```text
BME280 + HX711 + INA219
        -> thermal context + raw zero drift + electrical transient/stability evidence
        -> BetterBoard
        -> Engineering Lab quality / reliability evidence
```

### System-identification bench

```text
bounded low-voltage step/ramp stimulus
        -> ADC / encoder / current / displacement response
        -> BetterBoard synchronized evidence
        -> Engineering Lab model fitting and residual analysis
```

## Libraries and CI

Expected Arduino Library Manager names include:

- `Adafruit LSM6DS`
- `Adafruit Unified Sensor`
- `Adafruit VL53L1X`
- `Adafruit INA219`
- `Adafruit BME280 Library`
- `Adafruit ADXL345`
- `Adafruit MLX90393`
- `HX711`

`Sensor Suite v1 Integrity` validates Python tooling syntax, all expansion catalogs, parameter/metadata consistency, deterministic installer materialization, declared Arduino libraries, and all **56** firmware programs for both the UNO reference target and `esp32:esp32:esp32s3`. The normal BetterBoard CI continues to protect the application frontend, Rust backend, numerical firmware, provenance/evidence logic, and bridge contracts.
