#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RES = ROOT / "src-tauri" / "resources"
CATALOG = json.loads((RES / "recipes" / "catalog.json").read_text())
BY_ID = {item["id"]: item for item in CATALOG}

magnet = BY_ID["magnetic_mlx90393"]
assert magnet["title"].startswith("Magnet Bench 01")
assert magnet["category"] == "Magnet Bench"
assert magnet["columns"] == [
    "time_us", "Bx_uT", "By_uT", "Bz_uT", "Bmag_uT", "primary_uT"
]
assert magnet["units"] == ["us", "uT", "uT", "uT", "uT", "uT"]
assert magnet["primary_column"] == "primary_uT"
assert magnet["sample_rate_hz"] == 20.0
assert "Adafruit MLX90393" in magnet["required_libraries"]

firmware = (RES / "firmware" / "MagneticField_MLX90393" / "MagneticField_MLX90393.ino").read_text()
for token in ["Bmag_uT", "sqrtf", "primary_uT", "mag.readData", "SAMPLE_INTERVAL_US"]:
    assert token in firmware, token

magnet02 = (ROOT / "scripts" / "magnet02_characterization.py").read_text()
for token in ["corrected_Bmag_uT", "--baseline", "--point", "magnet02_scan.csv", "repeatability"]:
    assert token in magnet02, token

magnet03 = (ROOT / "scripts" / "magnet03_model_validation.py").read_text()
for token in [
    "mae_uT", "rmse_uT", "bias_uT", "integral_difference_uT_mm",
    "affine_discrepancy_fit", "suggested_next_measurement_points",
    "physical_lab_field_bridge.json",
]:
    assert token in magnet03, token

suite = (ROOT / "src" / "MagnetBenchSuite.tsx").read_text()
for token in ["magnet01", "magnet02", "magnet03", "magnetic_mlx90393", "RADIA Field Validation"]:
    assert token in suite, token

main = (ROOT / "src" / "main.tsx").read_text()
assert "MagnetBenchSuite" in main
assert "Magnet Bench 01–03" in main

notes = (ROOT / "docs" / "MAGNET_BENCH_01_03.md").read_text()
for token in ["Vector Field Acquisition", "Characterization & Spatial Mapping", "RADIA Model", "compare_field_series"]:
    assert token in notes, token

print("BetterBoard Magnet Bench 01-03 self-check: PASS")
print("- Magnet Bench 01 vector acquisition registered")
print("- Magnet Bench 02 background/repeatability/spatial analyzer present")
print("- Magnet Bench 03 RADIA/model residual analyzer present")
print("- unified Magnet Bench workspace registered in application entry")
