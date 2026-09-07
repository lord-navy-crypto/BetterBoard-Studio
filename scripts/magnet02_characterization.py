#!/usr/bin/env python3
"""BetterBoard Magnet Bench 02 — Magnet Characterization & Spatial Mapping.

Analyze one or more real MLX90393 BetterBoard measurement packages. The script
uses only the Python standard library and never treats a sensor reading as an
intrinsic, geometry-independent "magnet strength". Position, orientation,
background field, repeatability and calibration remain explicit.
"""
from __future__ import annotations

import argparse
import csv
import json
import math
import statistics
from collections import defaultdict
from pathlib import Path
from typing import Any

FIELD_COLUMNS = ("Bx_uT", "By_uT", "Bz_uT")


def locate_data(path: Path) -> Path:
    if path.is_file():
        return path
    candidate = path / "data.csv"
    if candidate.is_file():
        return candidate
    raise FileNotFoundError(f"Could not find data.csv under {path}")


def finite_float(text: str) -> float | None:
    try:
        value = float(text)
    except (TypeError, ValueError):
        return None
    return value if math.isfinite(value) else None


def read_capture(path: Path) -> dict[str, Any]:
    data_path = locate_data(path)
    with data_path.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        fields = set(reader.fieldnames or [])
        missing = set(FIELD_COLUMNS) - fields
        if missing:
            raise ValueError(f"{data_path} is missing magnetic columns: {sorted(missing)}")
        rows = []
        for row in reader:
            bx = finite_float(row.get("Bx_uT", ""))
            by = finite_float(row.get("By_uT", ""))
            bz = finite_float(row.get("Bz_uT", ""))
            if bx is None or by is None or bz is None:
                continue
            time_us = finite_float(row.get("time_us", ""))
            bmag = finite_float(row.get("Bmag_uT", ""))
            if bmag is None:
                bmag = math.sqrt(bx * bx + by * by + bz * bz)
            rows.append((time_us, bx, by, bz, bmag))
    if len(rows) < 2:
        raise ValueError(f"{data_path} contains fewer than two finite magnetic samples")

    times = [r[0] for r in rows if r[0] is not None]
    dts = []
    for a, b in zip(times[:-1], times[1:]):
        dt = (b - a) / 1_000_000.0
        if dt > 0 and math.isfinite(dt):
            dts.append(dt)

    def stats(index: int) -> dict[str, float]:
        values = [r[index] for r in rows]
        return {
            "mean": statistics.fmean(values),
            "stdev": statistics.stdev(values) if len(values) > 1 else 0.0,
            "min": min(values),
            "max": max(values),
        }

    result = {
        "source": str(data_path),
        "samples": len(rows),
        "Bx": stats(1),
        "By": stats(2),
        "Bz": stats(3),
        "Bmag": stats(4),
        "duration_s": (times[-1] - times[0]) / 1_000_000.0 if len(times) >= 2 else None,
        "median_dt_s": statistics.median(dts) if dts else None,
        "mean_dt_s": statistics.fmean(dts) if dts else None,
        "sample_rate_hz": (1.0 / statistics.fmean(dts)) if dts and statistics.fmean(dts) > 0 else None,
        "timing_jitter_stdev_s": statistics.stdev(dts) if len(dts) > 1 else 0.0 if dts else None,
    }
    return result


def vector_mean(capture: dict[str, Any]) -> tuple[float, float, float]:
    return (capture["Bx"]["mean"], capture["By"]["mean"], capture["Bz"]["mean"])


def magnitude(v: tuple[float, float, float]) -> float:
    return math.sqrt(sum(x * x for x in v))


def subtract(a: tuple[float, float, float], b: tuple[float, float, float]) -> tuple[float, float, float]:
    return tuple(x - y for x, y in zip(a, b))  # type: ignore[return-value]


def trapz(x: list[float], y: list[float]) -> float | None:
    if len(x) < 2 or len(x) != len(y):
        return None
    pairs = sorted(zip(x, y), key=lambda p: p[0])
    return sum(0.5 * (y0 + y1) * (x1 - x0) for (x0, y0), (x1, y1) in zip(pairs[:-1], pairs[1:]))


def gradient_rows(points: list[dict[str, Any]], key: str) -> list[float | None]:
    if len(points) < 2:
        return [None] * len(points)
    out: list[float | None] = []
    for i, row in enumerate(points):
        if i == 0:
            a, b = points[0], points[1]
        elif i == len(points) - 1:
            a, b = points[-2], points[-1]
        else:
            a, b = points[i - 1], points[i + 1]
        dx = float(b["position_mm"]) - float(a["position_mm"])
        out.append(None if dx == 0 else (float(b[key]) - float(a[key])) / dx)
    return out


def json_safe(value: Any) -> Any:
    if isinstance(value, dict):
        return {str(k): json_safe(v) for k, v in value.items()}
    if isinstance(value, list):
        return [json_safe(v) for v in value]
    if isinstance(value, float) and not math.isfinite(value):
        return "nan" if math.isnan(value) else "infinity" if value > 0 else "-infinity"
    return value


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("measurement", nargs="?", type=Path, help="single magnetic measurement folder or data.csv")
    parser.add_argument("--baseline", type=Path, help="ambient/background measurement package")
    parser.add_argument(
        "--point", nargs=2, action="append", metavar=("POSITION_MM", "MEASUREMENT"),
        help="add one fixed-position capture; repeat for a spatial scan",
    )
    parser.add_argument("--out", type=Path, help="output directory")
    args = parser.parse_args()

    if not args.measurement and not args.point:
        raise SystemExit("Provide a measurement or at least one --point POSITION_MM MEASUREMENT")

    baseline = read_capture(args.baseline) if args.baseline else None
    baseline_vector = vector_mean(baseline) if baseline else (0.0, 0.0, 0.0)

    specs: list[tuple[float, Path]] = []
    if args.point:
        for position_text, path_text in args.point:
            position = float(position_text)
            if not math.isfinite(position):
                raise SystemExit("Position values must be finite")
            specs.append((position, Path(path_text)))
    elif args.measurement:
        specs.append((0.0, args.measurement))

    point_rows: list[dict[str, Any]] = []
    for position, path in specs:
        capture = read_capture(path)
        mean_vector = vector_mean(capture)
        corrected = subtract(mean_vector, baseline_vector)
        row = {
            "position_mm": position,
            "source": capture["source"],
            "samples": capture["samples"],
            "duration_s": capture["duration_s"],
            "sample_rate_hz": capture["sample_rate_hz"],
            "timing_jitter_stdev_s": capture["timing_jitter_stdev_s"],
            "mean_Bx_uT": mean_vector[0],
            "mean_By_uT": mean_vector[1],
            "mean_Bz_uT": mean_vector[2],
            "mean_Bmag_uT": capture["Bmag"]["mean"],
            "std_Bx_uT": capture["Bx"]["stdev"],
            "std_By_uT": capture["By"]["stdev"],
            "std_Bz_uT": capture["Bz"]["stdev"],
            "std_Bmag_uT": capture["Bmag"]["stdev"],
            "corrected_Bx_uT": corrected[0],
            "corrected_By_uT": corrected[1],
            "corrected_Bz_uT": corrected[2],
            "corrected_Bmag_uT": magnitude(corrected),
        }
        point_rows.append(row)

    point_rows.sort(key=lambda r: float(r["position_mm"]))
    gradients = gradient_rows(point_rows, "corrected_Bmag_uT")
    for row, gradient in zip(point_rows, gradients):
        row["gradient_Bmag_uT_per_mm"] = gradient

    grouped: dict[float, list[dict[str, Any]]] = defaultdict(list)
    for row in point_rows:
        grouped[float(row["position_mm"])].append(row)
    repeatability = []
    for position, rows in sorted(grouped.items()):
        if len(rows) < 2:
            continue
        values = [float(r["corrected_Bmag_uT"]) for r in rows]
        repeatability.append({
            "position_mm": position,
            "captures": len(rows),
            "mean_corrected_Bmag_uT": statistics.fmean(values),
            "between_capture_stdev_uT": statistics.stdev(values),
        })

    positions = [float(r["position_mm"]) for r in point_rows]
    corrected_magnitude = [float(r["corrected_Bmag_uT"]) for r in point_rows]
    peak = max(point_rows, key=lambda r: abs(float(r["corrected_Bmag_uT"])))
    summary = {
        "schema": "betterboard.magnet-bench02/0.1",
        "captures": len(point_rows),
        "distinct_positions": len(grouped),
        "baseline_source": baseline["source"] if baseline else None,
        "baseline_vector_uT": {
            "Bx": baseline_vector[0], "By": baseline_vector[1], "Bz": baseline_vector[2],
            "Bmag_of_mean_vector": magnitude(baseline_vector),
        },
        "peak_corrected_Bmag_uT": float(peak["corrected_Bmag_uT"]),
        "peak_position_mm": float(peak["position_mm"]),
        "corrected_Bmag_integral_uT_mm": trapz(positions, corrected_magnitude),
        "repeatability": repeatability,
        "boundary": (
            "These are field measurements in the sensor/lab frame. They do not define an intrinsic magnet strength. "
            "Distance, orientation, background field, fixture geometry, sensor calibration, saturation and temperature can affect the result."
        ),
    }

    base = locate_data(specs[0][1]).parent
    out = args.out or (base / "magnet02-characterization")
    out.mkdir(parents=True, exist_ok=True)
    scan_csv = out / "magnet02_scan.csv"
    summary_json = out / "magnet02_summary.json"
    report_md = out / "magnet02_report.md"

    fields = list(point_rows[0])
    with scan_csv.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(point_rows)
    summary_json.write_text(json.dumps(json_safe(summary), indent=2) + "\n", encoding="utf-8")
    report_md.write_text(
        "# BetterBoard Magnet Bench 02 — Characterization & Spatial Mapping\n\n"
        f"Captures: **{summary['captures']}**  \n"
        f"Distinct positions: **{summary['distinct_positions']}**  \n"
        f"Peak corrected |B|: **{summary['peak_corrected_Bmag_uT']:.6g} uT** at **{summary['peak_position_mm']:.6g} mm**  \n"
        f"Field integral: **{summary['corrected_Bmag_integral_uT_mm']} uT·mm**\n\n"
        "## Scientific boundary\n\n"
        + summary["boundary"] + "\n",
        encoding="utf-8",
    )

    print(f"Magnet Bench 02 complete: {out}")
    print(json.dumps(json_safe(summary), indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
