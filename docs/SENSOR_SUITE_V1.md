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

The installer reads every `sensor-suite/catalog*.json` expansion catalog and writes stable recipe files to `~/Documents/BetterBoard/library/`. BetterBoard already loads that directory as its user recipe library. Refresh the Recipe Library after installation.

## Program museum

The suite now ships **56 installable experiments** across acquisition, dynamics, numerical methods, V&V, mechanics, timing, electrical power, environment, magnetics, calibration, sensor fusion, reliability, low-voltage control, advanced measurement, and system identification.

The original 46-program museum remains intact. This expansion adds a dedicated system-identification and metrology layer:

| Recipe | Main purpose |
|---|---|
| ADC RC Step Response | low-voltage PWM step -> ADC transient for RC/time-constant studies |
| Encoder Reversal / Deadband Evidence | signed count increments through manual reversals |
| LSM6DSOX Shock Peak Hold | short-window acceleration peak capture |
| VL53L1X Stability Window | stationary distance mean/std repeatability |
| MLX90393 Manual Field-Integral Scan | button-confirmed B(z) scan plus cumulative trapezoidal integral |
| BME280 Dew-Point Estimate | temperature/humidity-derived dew-point estimate |
| HX711 Load-Cycle Marker | force stream with explicit loading/unloading phase marker |
| Photogate Energy per Unit Mass | measured blocking width -> speed -> kinetic energy per mass |
| Encoder / Gyro Angular Consistency | encoder-derived angular velocity vs gyro rate |
| INA219 Current-Step Detector | current-change event evidence with voltage/current/power preserved |

## Existing program families

The museum also includes raw IMU/ToF/power/environment/force acquisition; vibration statistics; gyro integration; discrete kinematics; electrical energy integration; environmental drift; force dynamics; encoder angular kinematics; photogate period statistics; ADXL345/LSM6DSOX cross-checking; motor power/RPM characterization; magnetic statistics and baseline delta; static tilt; IMU bias survey; pendulum IMU + encoder; oscillator ToF + acceleration; creep and power stability; ADC noise and oversampling; impact triggering; vibration RMS; gate timing; complementary tilt; relative pressure-altitude; load repeatability; bounded motor step/ramp response; motion triggering; known-width photogate speed; encoder/gyro angle cross-check; jerk monitoring; ToF free-decay; field-direction stability; thermal stability; electrical load transient; HX711 zero drift; ADC step detection; and rotation repeatability.

## Scientific boundaries

The museum is evidence-first. Derived quantities remain explicitly derived: IMU integration is not absolute position or angle truth; numerical differentiation amplifies noise; ADC codes are not calibrated voltage without ADC/reference characterization; PWM command is not torque or speed; photogate speed depends on measured geometry; kinetic energy per unit mass omits other energy terms; ToF repeatability does not establish absolute range accuracy; magnetic field integration assumes the declared spatial step and stable sensor orientation; load-cell hysteresis can include fixture and calibration effects; dew point inherits temperature/humidity uncertainty; and INA219 step timing is bandwidth-limited.

Engineering Lab should own calibration metadata, uncertainty, V&V, model-to-measurement comparison, and final scientific interpretation.

## Recommended bundles

### Motion / dynamics

```text
LSM6DSOX + VL53L1X + photogate + quadrature encoder
        -> x(t), a(t), omega(t), events, theta(t)
        -> direct + derived kinematics + repeatability
        -> BetterBoard measurement package
        -> Engineering Lab Oscillation / Chaos comparison
```

### Magnetic digital twin

```text
MLX90393 + non-magnetic positioning fixture + step-confirm button
        -> B(position) + field integral
        -> BetterBoard Magnet Bench
        -> Engineering Lab RADIA / Digital Twin residuals
```

### System identification

```text
low-voltage RC + PWM + ADC
        -> known command step + measured transient
        -> time-domain response evidence
        -> Engineering Lab model fitting / V&V
```

### Cross-sensor rotational V&V

```text
LSM6DSOX + quadrature encoder
        -> encoder omega + gyro omega
        -> disagreement(t)
        -> Engineering Lab calibration / V&V evidence
```

### Mechanics / reliability

```text
load cell + HX711 + phase marker
        -> loading / unloading force stream
        -> repeatability + creep + hysteresis evidence
```

## First-day checkout sequence

For every new module: verify the exact breakout and voltage/logic limits; run BetterBoard I2C Scanner for I2C devices; run Recipe Preflight; install only reported missing libraries; compile/upload; preview a short serial capture; record a BetterBoard measurement package only after the stream is physically plausible; then ingest through LabBridge / Engineering Lab.

For low-voltage control experiments, keep the electrical setup within the board/module ratings and document the actual wiring, supply, load, geometry, and calibration constants used in each run.

## Libraries and CI

Expected Arduino Library Manager names include `Adafruit LSM6DS`, `Adafruit Unified Sensor`, `Adafruit VL53L1X`, `Adafruit INA219`, `Adafruit BME280 Library`, `Adafruit ADXL345`, `Adafruit MLX90393`, and `HX711`.

`Sensor Suite v1 Integrity` validates all expansion catalogs, proves installer materialization, installs the declared libraries, and compiles all **56** firmware programs for both the UNO reference target and `esp32:esp32:esp32s3`.
