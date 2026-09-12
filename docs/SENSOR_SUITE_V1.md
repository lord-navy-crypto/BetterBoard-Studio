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

The suite now ships **36 installable experiments** across acquisition, dynamics, numerical methods, V&V, mechanics, timing, electrical power, environment, magnetics, calibration, sensor fusion, reliability, and low-voltage control.

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

### Analysis, numerical, and V&V programs

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

### Instrumentation museum expansion

| Recipe | Main purpose |
|---|---|
| MLX90393 Field Statistics | magnetic vector mean/std for stability and repeatability |
| MLX90393 Baseline Delta | explicit ambient baseline and vector field change |
| ADXL345 Static Tilt Estimate | gravity-vector roll/pitch plus raw acceleration |
| LSM6DSOX Bias Survey | stationary acceleration/gyro bias and gyro-noise windows |
| Pendulum IMU + Encoder | synchronized encoder angle and 6-axis inertial data |
| Oscillator ToF + ADXL345 | synchronized direct displacement and acceleration |
| HX711 Creep Monitor | load-cell creep / relaxation / zero-drift evidence |
| INA219 Power Stability | rolling voltage/current/power mean and standard deviation |

### Reliability, fusion, and control expansion

| Recipe | Main purpose |
|---|---|
| ADC Noise Statistics | ADC mean/std/min/max/peak-to-peak characterization |
| ADC Oversampling Comparison | single-sample vs 4x/16x averaging on the same analog source |
| LSM6DSOX Impact Trigger | acceleration transient capture with explicit threshold flag |
| ADXL345 Vibration RMS | windowed acceleration RMS and peak response |
| Photogate Gate Timing | blocked/open dwell time and optical duty fraction |
| LSM6DSOX Complementary Tilt | accelerometer tilt vs gyro/accelerometer fused estimate |
| BME280 Relative Altitude Trend | pressure-derived relative height trend from startup baseline |
| HX711 Load Repeatability | repeated calibrated force mean/std windows |
| Motor Step Response + Encoder + Power | bounded PWM step with RPM/current/power transient capture |
| Motor Ramp Hysteresis + Encoder + Power | ascending/descending PWM response comparison |
| IMU + ToF Motion Trigger | synchronized distance and acceleration-change trigger evidence |

## Existing BetterBoard hardware remains first-class

Sensor Suite complements rather than replaces the existing recipes:

- MLX90393 -> Magnet Bench 01-03 -> Engineering Lab RADIA / Digital Twin.
- ADXL345 -> vibration / acceleration -> Oscillation / Honeycomb analogue.
- Photogate -> event time / period / frequency -> Oscillation / Chaos.
- Quadrature Encoder -> count / angle -> rotational dynamics.
- Random Walk Robot -> bounded motor commands; actual trajectory still requires independent position evidence.

The expanded programs deliberately reuse the same instruments in richer combinations rather than requiring a new sensor for every experiment.

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
- accelerometer-only tilt is primarily a static/slow-motion estimate;
- complementary-filter orientation remains model-dependent and can drift or be distorted by motion;
- gyro integration drifts and should be cross-checked with encoder/optical angle evidence;
- ADC statistics and oversampling do not by themselves establish calibrated voltage accuracy;
- photogate dwell time is not speed unless object width and geometry are measured;
- INA219 energy is a numerical integral of sampled sensor power;
- INA219 rolling variability describes the measured electrical path, not a calibrated spectrum analyzer;
- BME280 drift and relative altitude are relative/model-derived environmental quantities, not reference standards;
- MLX90393 baseline subtraction does not automatically remove every background or sensor offset;
- magnetic stability windows do not establish calibration traceability;
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

### Pendulum / rotational dynamics bench

```text
LSM6DSOX + quadrature encoder
        -> theta(t) + a(t) + gyro(t)
        -> cross-sensor rotational dynamics evidence
        -> Engineering Lab Oscillation / Chaos
```

### Cross-sensor V&V bench

```text
ADXL345 + LSM6DSOX on one rigid fixture
        -> two independent acceleration streams
        -> disagreement vector
        -> Engineering Lab calibration / V&V evidence
```

### Magnetic digital-twin bench

```text
MLX90393 + controlled non-magnetic positioning fixture
        -> raw B(position)
        -> baseline delta + repeatability statistics
        -> BetterBoard Magnet Bench
        -> Engineering Lab RADIA / Digital Twin residuals
```

### Robotics / control bench

```text
TB6612 + encoder gearmotor + INA219 + ToF
        -> step/ramp command + RPM + electrical input + displacement
        -> BetterBoard
        -> Engineering Lab control / quality / reliability evidence
```

### Structural vibration bench

```text
ADXL345 / LSM6DSOX + bounded actuator
        -> raw acceleration + RMS/peak + event triggers
        -> frequency-domain analysis on host
        -> Engineering Lab Oscillation / Honeycomb mechanical analogue
```

### Calibration / ADC bench

```text
stable analog source + A0
        -> raw codes + noise windows + oversampling comparison
        -> BetterBoard
        -> Engineering Lab numerical / measurement reliability evidence
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

`Sensor Suite v1 Integrity` validates all expansion catalogs, proves installer materialization, installs the declared libraries, and compiles all **36** firmware programs for both the UNO reference target and `esp32:esp32:esp32s3`.
