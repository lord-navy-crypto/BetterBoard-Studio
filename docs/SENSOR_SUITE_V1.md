# BetterBoard Sensor Suite v1

Sensor Suite v1 turns the planned BetterBoard / Engineering Lab hardware set into installable BetterBoard user recipes without changing the canonical built-in catalog. The suite is intentionally additive: the existing MLX90393, ADXL345, photogate, quadrature encoder, RPM, numerical, and random-walk recipes remain unchanged.

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

The installer writes stable recipe files to:

```text
~/Documents/BetterBoard/library/
```

BetterBoard already loads that directory as its user recipe library. Refresh the Recipe Library and select **Sensor Suite**.

## Included experiments

| Recipe | Hardware | Measured outputs | Engineering Lab use |
|---|---|---|---|
| LSM6DSOX Motion IMU | LSM6DSOX | 3-axis acceleration, 3-axis angular velocity, temperature | Oscillation, Chaos, mechanical analogue |
| VL53L1X Displacement | VL53L1X | direct range / displacement | Oscillation, Chaos, robot range |
| INA219 Electrical Power | INA219 | voltage, current, power | engineering evidence, actuator efficiency/reliability |
| BME280 Environment | BME280 | temperature, pressure, humidity | environmental provenance and drift context |
| HX711 Force / Load | load cell + HX711 | raw counts, calibrated force estimate | force/structure/oscillation studies |
| Motion Fusion IMU + ToF | LSM6DSOX + VL53L1X | synchronized x(t), a(t), angular rate | measured/model dynamics validation |
| TB6612 + INA219 Motor Power Bench | small DC motor + TB6612 + INA219 | PWM command + electrical input | robotics/control/engineering characterization |

## Existing BetterBoard hardware that remains first-class

Sensor Suite complements rather than replaces the existing recipes:

- MLX90393 -> Magnet Bench 01-03 -> Engineering Lab RADIA / Digital Twin.
- ADXL345 -> vibration / acceleration -> Oscillation / Honeycomb analogue.
- Photogate -> event time / period / frequency -> Oscillation / Chaos.
- Quadrature Encoder -> count / angle -> rotational dynamics.
- Random Walk Robot -> bounded motor commands; actual trajectory still requires independent position evidence.

## First-day checkout sequence

For every new I2C module:

1. verify the exact breakout and supported supply/logic voltage;
2. connect only the documented power, ground, SDA and SCL pins;
3. run BetterBoard **I2C Scanner** first;
4. run Recipe Preflight and install only the reported missing Arduino libraries;
5. compile and upload the relevant Sensor Suite recipe;
6. preview a short serial capture before recording evidence;
7. record a BetterBoard measurement package;
8. ingest through LabBridge / Engineering Lab only after the raw stream looks physically plausible.

For motion experiments, keep direct displacement and inertial measurements separate in interpretation. An IMU measures acceleration and angular velocity; integrating it does not create reliable absolute position without bias characterization and an external reference.

## Calibration boundary

Sensor Suite deliberately preserves raw or minimally transformed observables. Engineering Lab should own calibration metadata and model-to-measurement validation. In particular:

- HX711 `counts_per_newton` and zero offset must be measured using known reference loads;
- ToF range depends on geometry and target properties;
- IMU acceleration includes gravity, bias and alignment effects;
- INA219 measurements require the actual breakout/load range to be respected;
- BME280 is experiment context unless independently calibrated;
- PWM command is not motor speed, torque, displacement, or efficiency.

## Recommended physical experiment bundles

### Motion / dynamics bench

```text
LSM6DSOX + VL53L1X + photogate + quadrature encoder
        -> x(t), a(t), omega(t), events, theta(t)
        -> BetterBoard measurement package
        -> Engineering Lab Oscillation / Chaos comparison
```

### Magnetic digital-twin bench

```text
MLX90393 + controlled non-magnetic positioning fixture
        -> B(position)
        -> BetterBoard Magnet Bench
        -> Engineering Lab RADIA / Digital Twin residuals
```

### Robotics / control bench

```text
TB6612 + encoder gearmotor + INA219 + ToF
        -> command + electrical input + measured motion
        -> BetterBoard
        -> Engineering Lab Random Walk / engineering evidence
```

### Structural vibration bench

```text
2x ADXL345 or ADXL345 + LSM6DSOX + bounded actuator
        -> multi-point vibration response
        -> Engineering Lab Oscillation / Honeycomb mechanical analogue
```

## Libraries

The recipes declare their dependencies so BetterBoard Preflight can report missing libraries. The suite does not silently reinstall packages.

Expected Arduino Library Manager names include:

- `Adafruit LSM6DS`
- `Adafruit Unified Sensor`
- `Adafruit VL53L1X`
- `Adafruit INA219`
- `Adafruit BME280 Library`
- `HX711`

Run `scripts/sensor_suite_self_check.py` after changes to prove the catalog, firmware paths, column/unit contracts, and generated BetterBoard user-recipe wrappers remain internally consistent.
