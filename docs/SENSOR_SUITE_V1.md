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

## Program museum

The suite now ships **17 installable experiments** across acquisition, dynamics, numerical methods, V&V, mechanics, timing, electrical power, environment, and control.

### Core acquisition and systems programs

| Recipe | Hardware | Main outputs | Engineering Lab use |
|---|---|---|---|
| LSM6DSOX Motion IMU | LSM6DSOX | 3-axis acceleration, 3-axis angular velocity, temperature | Oscillation, Chaos, mechanical analogue |
| VL53L1X Displacement | VL53L1X | direct range / displacement | Oscillation, Chaos, robot range |
| INA219 Electrical Power | INA219 | voltage, current, power | engineering evidence, actuator characterization |
| BME280 Environment | BME280 | temperature, pressure, humidity | environmental provenance |
| HX711 Force / Load | load cell + HX711 | raw counts, calibrated force estimate | mechanics / structure / oscillation |
| Motion Fusion IMU + ToF | LSM6DSOX + VL53L1X | synchronized x(t), a(t), angular rate | measured/model dynamics validation |
| TB6612 + INA219 Motor Power Bench | motor + driver + INA219 | PWM command + electrical input | robotics/control characterization |

### Expanded analysis programs

| Recipe | Main purpose |
|---|---|
| LSM6DSOX Vibration Statistics | rolling acceleration/gyro variability for vibration and structural studies |
| LSM6DSOX Gyro Integration Methods | rectangle vs trapezoidal integration on real gyro samples |
| VL53L1X Discrete Kinematics | direct x(t) plus finite-difference velocity and acceleration |
| INA219 Energy Integration | sampled electrical power plus cumulative trapezoidal energy |
| BME280 Environmental Drift Monitor | relative environmental drift from a session baseline |
| HX711 Force Dynamics | calibrated force, filtered force, and force-rate estimate |
| Encoder Angular Kinematics | count -> angle -> angular velocity -> angular acceleration |
| Photogate Period Statistics | repeated period/frequency with rolling repeatability statistics |
| ADXL345 / LSM6DSOX Cross-Check | simultaneous two-sensor acceleration disagreement |
| Motor Encoder + Power Characterization | PWM + encoder RPM + voltage/current/power on one timeline |

## Existing BetterBoard hardware remains first-class

Sensor Suite complements rather than replaces the existing recipes:

- MLX90393 -> Magnet Bench 01-03 -> Engineering Lab RADIA / Digital Twin.
- ADXL345 -> vibration / acceleration -> Oscillation / Honeycomb analogue.
- Photogate -> event time / period / frequency -> Oscillation / Chaos.
- Quadrature Encoder -> count / angle -> rotational dynamics.
- Random Walk Robot -> bounded motor commands; actual trajectory still requires independent position evidence.

The expanded programs deliberately reuse these same instruments in richer combinations rather than requiring a new sensor for every experiment.

## First-day checkout sequence

For every new I2C module:

1. verify the exact breakout and supported supply/logic voltage;
2. connect only documented power, ground, SDA and SCL pins;
3. run BetterBoard **I2C Scanner** first;
4. run Recipe Preflight and install only reported missing Arduino libraries;
5. compile and upload the relevant Sensor Suite recipe;
6. preview a short serial capture before recording evidence;
7. record a BetterBoard measurement package;
8. ingest through LabBridge / Engineering Lab only after the raw stream looks physically plausible.

For motion experiments, keep direct displacement and inertial measurements separate in interpretation. An IMU measures acceleration and angular velocity; integration does not create reliable absolute position without bias characterization and an external reference.

## Scientific boundaries

The program museum is designed around evidence-first measurement:

- HX711 force depends on measured offset and scale using reference loads;
- ToF velocity/acceleration are numerical derivatives of measured distance and amplify noise;
- IMU acceleration includes gravity, bias, alignment and mounting effects;
- gyro integration drifts and should be cross-checked with encoder/optical angle evidence;
- INA219 energy is a numerical integral of sampled sensor power;
- BME280 drift is relative to startup, not a calibrated environmental reference;
- dual-accelerometer disagreement does not identify which instrument is correct;
- PWM command, encoder RPM and electrical input do not by themselves establish torque or mechanical efficiency.

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

### Cross-sensor V&V bench

```text
ADXL345 + LSM6DSOX on one rigid fixture
        -> two independent acceleration streams
        -> disagreement vector
        -> Engineering Lab calibration / V&V evidence
```

### Robotics / control bench

```text
TB6612 + encoder gearmotor + INA219 + ToF
        -> command + RPM + electrical input + measured displacement
        -> BetterBoard
        -> Engineering Lab control / quality / reliability evidence
```

### Structural vibration bench

```text
ADXL345 / LSM6DSOX + bounded actuator
        -> raw acceleration + window statistics
        -> frequency-domain analysis on host
        -> Engineering Lab Oscillation / Honeycomb mechanical analogue
```

### Magnetic digital-twin bench

```text
MLX90393 + controlled non-magnetic positioning fixture
        -> B(position)
        -> BetterBoard Magnet Bench
        -> Engineering Lab RADIA / Digital Twin residuals
```

## Libraries and CI

Expected Arduino Library Manager names include:

- `Adafruit LSM6DS`
- `Adafruit Unified Sensor`
- `Adafruit VL53L1X`
- `Adafruit INA219`
- `Adafruit BME280 Library`
- `Adafruit ADXL345`
- `HX711`

`Sensor Suite v1 Integrity` validates all expansion catalogs, proves installer materialization, installs the declared libraries, and compiles all 17 firmware programs for both the UNO reference target and `esp32:esp32:esp32s3`.
