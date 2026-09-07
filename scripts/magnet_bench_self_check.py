#!/usr/bin/env python3
from __future__ import annotations

import csv
import json
import math
import subprocess
import sys
import tempfile
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

magnet02_path = ROOT / "scripts" / "magnet02_characterization.py"
magnet03_path = ROOT / "scripts" / "magnet03_model_validation.py"
magnet02 = magnet02_path.read_text()
for token in ["corrected_Bmag_uT", "--baseline", "--point", "magnet02_scan.csv", "repeatability"]:
    assert token in magnet02, token
magnet03 = magnet03_path.read_text()
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


def write_capture(folder: Path, vector: tuple[float, float, float]) -> None:
    folder.mkdir(parents=True, exist_ok=True)
    with (folder / "data.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(["time_us", "Bx_uT", "By_uT", "Bz_uT", "Bmag_uT", "primary_uT"])
        for i in range(12):
            bx = vector[0] + (i % 3 - 1) * 0.02
            by = vector[1] + (i % 4 - 1.5) * 0.015
            bz = vector[2] + (i % 5 - 2) * 0.025
            bmag = math.sqrt(bx * bx + by * by + bz * bz)
            writer.writerow([i * 50_000, bx, by, bz, bmag, bz])


with tempfile.TemporaryDirectory(prefix="betterboard-magnet-check-") as temp_text:
    temp = Path(temp_text)
    baseline = temp / "baseline"
    p0 = temp / "p0"
    p10 = temp / "p10"
    p20 = temp / "p20"
    write_capture(baseline, (20.0, -5.0, 42.0))
    write_capture(p0, (20.5, -4.8, 142.0))
    write_capture(p10, (20.3, -4.9, 92.0))
    write_capture(p20, (20.2, -5.0, 62.0))

    out02 = temp / "bench02"
    subprocess.run([
        sys.executable, str(magnet02_path),
        "--baseline", str(baseline),
        "--point", "0", str(p0),
        "--point", "10", str(p10),
        "--point", "20", str(p20),
        "--out", str(out02),
    ], check=True, capture_output=True, text=True)
    scan = out02 / "magnet02_scan.csv"
    summary02 = json.loads((out02 / "magnet02_summary.json").read_text())
    assert scan.is_file()
    assert summary02["captures"] == 3
    assert summary02["distinct_positions"] == 3
    assert 99.0 < summary02["peak_corrected_Bmag_uT"] < 101.0

    model = temp / "model.csv"
    with model.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(["position_mm", "model_uT"])
        writer.writerow([0, 100.0])
        writer.writerow([5, 76.0])
        writer.writerow([10, 50.0])
        writer.writerow([15, 31.0])
        writer.writerow([20, 20.0])

    out03 = temp / "bench03"
    subprocess.run([
        sys.executable, str(magnet03_path), str(scan), str(model),
        "--measured-column", "corrected_Bz_uT",
        "--model-column", "model_uT",
        "--model-unit", "uT",
        "--out", str(out03),
    ], check=True, capture_output=True, text=True)
    summary03 = json.loads((out03 / "magnet03_summary.json").read_text())
    assert summary03["n"] == 3
    assert summary03["rmse_uT"] < 0.1
    assert (out03 / "magnet03_residuals.csv").is_file()
    assert (out03 / "physical_lab_field_bridge.json").is_file()

print("BetterBoard Magnet Bench 01-03 self-check: PASS")
print("- Magnet Bench 01 vector acquisition registered")
print("- Magnet Bench 02 background/repeatability/spatial analyzer fixture passed")
print("- Magnet Bench 03 RADIA/model residual analyzer fixture passed")
print("- unified Magnet Bench workspace registered in application entry")
