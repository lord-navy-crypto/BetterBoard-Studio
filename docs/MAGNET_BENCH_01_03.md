# BetterBoard Magnet Bench 01–03

The Magnet Bench series turns the existing MLX90393 field-measurement path into a three-level engineering workflow:

```text
Magnet Bench 01
Vector Field Acquisition
        ↓
Magnet Bench 02
Characterization & Spatial Mapping
        ↓
Magnet Bench 03
RADIA Model ↔ Measurement Validation
```

The three levels deliberately separate **measurement**, **experimental characterization**, and **model validation**. A magnet is not assigned one universal "strength" number: measured field depends on position, orientation, geometry, background field, sensor behavior and the quantity being compared.

## Magnet Bench 01 — Vector Field Acquisition

Hardware:

- UNO-compatible board
- confirmed MLX90393 3-axis magnetometer breakout
- USB data cable
- ordinary small permanent magnet / magnetic test object

The firmware records at 20 Hz:

```text
time_us,Bx_uT,By_uT,Bz_uT,Bmag_uT,primary_uT
```

`Bmag_uT = sqrt(Bx² + By² + Bz²)` is a derived vector magnitude. `primary_uT` remains the final field so the current Physical Lab v1 bridge has one primary observable while the full BetterBoard CSV preserves all axes.

Bench 01 does not silently zero or background-subtract the sensor. This is intentional: ambient field and fixture offset remain visible evidence for Bench 02.

## Magnet Bench 02 — Characterization & Spatial Mapping

Bench 02 reuses Bench 01 measurement packages. No second firmware is required.

A useful campaign is:

1. hold the sensor in the chosen fixture/orientation and record an ambient baseline with the magnet absent;
2. place the magnet at a controlled geometry;
3. record a fixed-position capture;
4. repeat at known positions along a defined axis;
5. repeat selected positions to estimate between-capture repeatability.

Single-capture analysis:

```bash
python3 scripts/magnet02_characterization.py \
  <magnet-measurement> \
  --baseline <ambient-measurement>
```

Spatial scan:

```bash
python3 scripts/magnet02_characterization.py \
  --baseline <ambient-measurement> \
  --point -40 <capture-at-minus-40-mm> \
  --point -20 <capture-at-minus-20-mm> \
  --point 0 <capture-at-zero-mm> \
  --point 20 <capture-at-plus-20-mm> \
  --point 40 <capture-at-plus-40-mm>
```

Outputs:

```text
magnet02-characterization/
├── magnet02_scan.csv
├── magnet02_summary.json
└── magnet02_report.md
```

The analysis preserves:

- mean and standard deviation of Bx, By, Bz and |B|;
- observed timing and sample-rate statistics;
- explicit vector background subtraction;
- corrected vector magnitude;
- approximate spatial gradient;
- peak field location in the measured profile;
- trapezoidal field integral over the measured coordinate;
- between-capture repeatability when the same position is measured more than once.

The baseline should be taken with the same sensor orientation and comparable surroundings. Background subtraction is not a substitute for sensor calibration.

## Magnet Bench 03 — RADIA Model ↔ Measurement Validation

Bench 03 consumes the spatial scan produced by Bench 02 and a model field CSV, typically from RADIA or another forward model.

The model CSV needs a position column and one field column. By default:

```text
position_mm,model_uT
```

Example:

```bash
python3 scripts/magnet03_model_validation.py \
  magnet02-characterization/magnet02_scan.csv \
  radia_centerline.csv \
  --measured-column corrected_Bz_uT \
  --model-column model_uT \
  --model-unit uT
```

The model can use `uT`, `mT` or `T`; the analyzer converts the comparison to microtesla internally. A denser model grid is linearly interpolated onto the measured positions as long as all measured points lie inside the model range.

Outputs:

```text
magnet03-model-validation/
├── magnet03_residuals.csv
├── magnet03_summary.json
├── magnet03_report.md
└── physical_lab_field_bridge.json
```

Bench 03 reports the same family of field-comparison evidence already used by Engineering Lab's digital-twin core:

- MAE
- RMSE
- bias
- maximum absolute residual
- relative RMSE
- R² when defined
- measured and model peak field
- measured and model field integrals
- integral difference
- residual standard deviation
- affine discrepancy fit `measured ≈ scale × model + offset`
- residual-guided suggestions for follow-up measurement positions

Engineering Lab already implements the corresponding scientific definitions in `physical_lab_digital_twin.py` through `compare_field_series`, `fit_model_affine`, and `suggest_residual_measurement_points`.

### Independent Engineering Lab V&V

Engineering Lab now also contains:

```text
scripts/betterboard_magnet_bridge_validation.py
```

This script reads BetterBoard's `magnet03_residuals.csv`, independently recomputes the field comparison with Engineering Lab's canonical digital-twin core, and optionally checks the numbers in `physical_lab_field_bridge.json`.

Example from the Engineering Lab repository:

```bash
python3 scripts/betterboard_magnet_bridge_validation.py \
  /path/to/magnet03-model-validation/magnet03_residuals.csv \
  --bridge /path/to/magnet03-model-validation/physical_lab_field_bridge.json
```

A PASS means the two applications independently reproduced the same numerical field-comparison metrics. It does **not** prove that the sensor calibration, coordinate registration, magnet geometry, material model, or RADIA assumptions are physically correct.

## Relationship to RADIA and Radiation Platform

The safe and scientifically coherent chain is:

```text
real permanent magnet
        ↓
3-axis magnetometer
        ↓
BetterBoard Magnet Bench 01
        ↓
background / repeatability / B(z)
        ↓
Magnet Bench 02
        ↓
RADIA model comparison
        ↓
Magnet Bench 03
        ↓
Engineering Lab independent field-comparison V&V
        ↓
Digital Twin / residual-guided follow-up
        ↓
optional model-side radiation propagation
```

BetterBoard does not directly measure ionizing radiation. Radiation Platform can use a measured magnetic-field profile as an input to a software prediction/validation chain, but that remains an indirect computational path.

## Experimental discipline

For comparisons between magnets or between measurement and model, keep as many of these fixed as possible:

- sensor orientation;
- scan axis and coordinate origin;
- magnet orientation and polarity;
- sensor-to-magnet distance reference;
- fixture geometry;
- nearby magnetic/ferromagnetic objects;
- acquisition duration;
- background-measurement procedure.

Use ordinary small magnets for bench work. Very strong magnets can create pinch hazards, disturb nearby electronics, and drive sensors outside their useful range. A saturated or uncalibrated sensor reading should not be interpreted as a valid quantitative field measurement.

## Scientific boundary

The series characterizes **magnetic field under a stated measurement geometry**. It does not, by itself, infer remanence, coercivity, magnetic moment, grade, material composition, or any other intrinsic magnet property. Those require additional models, geometry/material information, calibrated references, or dedicated instrumentation.
