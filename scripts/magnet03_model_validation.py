#!/usr/bin/env python3
"""BetterBoard Magnet Bench 03 — RADIA Model ↔ Measurement Validation.

Compare a Magnet Bench 02 spatial scan against a co-registered or denser model
field series. This standard-library implementation mirrors the core diagnostics
used by Engineering Lab's digital-twin field comparison: MAE, RMSE, bias,
max residual, relative RMSE, R², field integrals, affine discrepancy fitting,
and residual-guided next-point suggestions.
"""
from __future__ import annotations

import argparse
import csv
import json
import math
import statistics
from pathlib import Path
from typing import Any


def finite_float(value: Any) -> float | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def read_series(path: Path, position_column: str, value_column: str, scale: float = 1.0) -> list[tuple[float, float]]:
    with path.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        if position_column not in (reader.fieldnames or []) or value_column not in (reader.fieldnames or []):
            raise ValueError(
                f"{path} must contain {position_column!r} and {value_column!r}; got {reader.fieldnames}"
            )
        rows = []
        for row in reader:
            x = finite_float(row.get(position_column))
            y = finite_float(row.get(value_column))
            if x is not None and y is not None:
                rows.append((x, y * scale))
    if len(rows) < 2:
        raise ValueError(f"{path} contains fewer than two finite rows")
    rows.sort(key=lambda pair: pair[0])
    return rows


def interpolate(rows: list[tuple[float, float]], x: float) -> float:
    if x < rows[0][0] or x > rows[-1][0]:
        raise ValueError(f"Measured position {x} is outside model range {rows[0][0]}..{rows[-1][0]}")
    for px, py in rows:
        if x == px:
            return py
    lo = rows[0]
    for hi in rows[1:]:
        if lo[0] <= x <= hi[0]:
            if hi[0] == lo[0]:
                return 0.5 * (lo[1] + hi[1])
            alpha = (x - lo[0]) / (hi[0] - lo[0])
            return lo[1] + alpha * (hi[1] - lo[1])
        lo = hi
    raise RuntimeError("Interpolation interval not found")


def mean(values: list[float]) -> float:
    return sum(values) / len(values)


def sample_stdev(values: list[float]) -> float:
    return statistics.stdev(values) if len(values) > 1 else 0.0


def trapz(x: list[float], y: list[float]) -> float:
    pairs = sorted(zip(x, y), key=lambda p: p[0])
    return sum(0.5 * (y0 + y1) * (x1 - x0) for (x0, y0), (x1, y1) in zip(pairs[:-1], pairs[1:]))


def regression(x: list[float], y: list[float]) -> tuple[float, float, float, float]:
    mx, my = mean(x), mean(y)
    sxx = sum((v - mx) ** 2 for v in x)
    if sxx <= 1e-30:
        raise ValueError("Model values have zero variance; affine fit is undefined")
    slope = sum((a - mx) * (b - my) for a, b in zip(x, y)) / sxx
    offset = my - slope * mx
    residual = [b - (slope * a + offset) for a, b in zip(x, y)]
    rmse = math.sqrt(mean([r * r for r in residual]))
    syy = sum((v - my) ** 2 for v in y)
    r2 = 1.0 - sum(r * r for r in residual) / syy if syy > 1e-30 else float("nan")
    return slope, offset, rmse, r2


def residual_guided_points(position: list[float], residual: list[float], count: int = 3) -> list[dict[str, float]]:
    if len(position) < 3:
        return []
    span = max(position) - min(position)
    scale = max(max(abs(v) for v in residual), 1e-30)
    scored = []
    for i, (x, r) in enumerate(zip(position, residual)):
        if i == 0:
            dx = position[1] - position[0]
            grad = 0.0 if dx == 0 else abs((residual[1] - residual[0]) / dx)
        elif i == len(position) - 1:
            dx = position[-1] - position[-2]
            grad = 0.0 if dx == 0 else abs((residual[-1] - residual[-2]) / dx)
        else:
            dx = position[i + 1] - position[i - 1]
            grad = 0.0 if dx == 0 else abs((residual[i + 1] - residual[i - 1]) / dx)
        score = abs(r) / scale + 0.35 * grad * (span if span > 0 else 1.0) / scale
        scored.append((score, x, r))
    minimum_spacing = 0.08 * span
    selected = []
    for score, x, r in sorted(scored, reverse=True):
        if all(abs(x - item["position_mm"]) >= minimum_spacing for item in selected):
            selected.append({"position_mm": x, "residual_uT": r, "score": score})
        if len(selected) >= count:
            break
    return selected


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
    parser.add_argument("measured_scan", type=Path, help="Magnet Bench 02 magnet02_scan.csv")
    parser.add_argument("model_csv", type=Path, help="RADIA/model CSV")
    parser.add_argument("--measured-column", default="corrected_Bz_uT")
    parser.add_argument("--model-position-column", default="position_mm")
    parser.add_argument("--model-column", default="model_uT")
    parser.add_argument("--model-unit", choices=["uT", "mT", "T"], default="uT")
    parser.add_argument("--out", type=Path)
    parser.add_argument("--suggest-count", type=int, default=3)
    args = parser.parse_args()

    unit_scale = {"uT": 1.0, "mT": 1_000.0, "T": 1_000_000.0}[args.model_unit]
    measured = read_series(args.measured_scan, "position_mm", args.measured_column)
    model = read_series(args.model_csv, args.model_position_column, args.model_column, unit_scale)

    position = [x for x, _ in measured]
    measured_values = [y for _, y in measured]
    model_values = [interpolate(model, x) for x in position]
    residual = [m - p for m, p in zip(measured_values, model_values)]

    n = len(position)
    mae = mean([abs(r) for r in residual])
    rmse = math.sqrt(mean([r * r for r in residual]))
    bias = mean(residual)
    max_abs = max(abs(r) for r in residual)
    model_scale = mean([abs(v) for v in model_values])
    relative_rmse = None if model_scale <= 1e-30 else rmse / model_scale
    model_mean = mean(model_values)
    ss_tot = sum((v - model_mean) ** 2 for v in model_values)
    ss_res = sum(r * r for r in residual)
    r2 = None if ss_tot <= 1e-30 else 1.0 - ss_res / ss_tot
    measured_integral = trapz(position, measured_values)
    model_integral = trapz(position, model_values)

    scale, offset, rmse_after, r2_after = regression(model_values, measured_values)
    improvement = None if rmse <= 1e-30 else 1.0 - rmse_after / rmse
    suggestions = residual_guided_points(position, residual, max(1, args.suggest_count))

    summary = {
        "schema": "betterboard.magnet-bench03/0.1",
        "n": n,
        "measured_column": args.measured_column,
        "model_column": args.model_column,
        "model_input_unit": args.model_unit,
        "comparison_unit": "uT",
        "mae_uT": mae,
        "rmse_uT": rmse,
        "bias_uT": bias,
        "max_abs_error_uT": max_abs,
        "relative_rmse": relative_rmse,
        "r2": r2,
        "measured_peak_abs_uT": max(abs(v) for v in measured_values),
        "model_peak_abs_uT": max(abs(v) for v in model_values),
        "measured_integral_uT_mm": measured_integral,
        "model_integral_uT_mm": model_integral,
        "integral_difference_uT_mm": measured_integral - model_integral,
        "residual_standard_deviation_uT": sample_stdev(residual),
        "affine_discrepancy_fit": {
            "model": "measured ≈ scale * model + offset",
            "scale": scale,
            "offset_uT": offset,
            "rmse_before_uT": rmse,
            "rmse_after_uT": rmse_after,
            "r2_after": r2_after,
            "improvement_fraction": improvement,
        },
        "suggested_next_measurement_points": suggestions,
        "boundary": (
            "Numerical agreement does not prove that either the measurement or RADIA/model geometry is physically correct. "
            "Position registration, sensor orientation, calibration, background subtraction, saturation, magnet geometry and material assumptions remain separate evidence."
        ),
    }

    out = args.out or (args.measured_scan.parent / "magnet03-model-validation")
    out.mkdir(parents=True, exist_ok=True)
    residual_csv = out / "magnet03_residuals.csv"
    summary_json = out / "magnet03_summary.json"
    report_md = out / "magnet03_report.md"
    bridge_json = out / "physical_lab_field_bridge.json"

    with residual_csv.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(["position_mm", "measured_uT", "model_uT", "residual_uT", "abs_residual_uT"])
        for x, m, p, r in zip(position, measured_values, model_values, residual):
            writer.writerow([x, m, p, r, abs(r)])

    summary_json.write_text(json.dumps(json_safe(summary), indent=2) + "\n", encoding="utf-8")
    bridge = {
        "schema": "betterboard.physical-lab-field-comparison/0.1",
        "source": "Magnet Bench 03",
        "measured_scan": str(args.measured_scan),
        "model_source": str(args.model_csv),
        "comparison": summary,
        "engineering_lab_alignment": [
            "compare_field_series",
            "fit_model_affine",
            "suggest_residual_measurement_points",
        ],
        "note": "This bridge records compatible evidence semantics; direct automatic import into Engineering Lab is a separate integration step.",
    }
    bridge_json.write_text(json.dumps(json_safe(bridge), indent=2) + "\n", encoding="utf-8")
    report_md.write_text(
        "# BetterBoard Magnet Bench 03 — Model ↔ Measurement Validation\n\n"
        f"Compared **{n}** measured positions against the interpolated model.\n\n"
        f"- MAE: **{mae:.6g} uT**\n"
        f"- RMSE: **{rmse:.6g} uT**\n"
        f"- Bias: **{bias:.6g} uT**\n"
        f"- Max |residual|: **{max_abs:.6g} uT**\n"
        f"- R²: **{r2}**\n"
        f"- Integral difference: **{measured_integral - model_integral:.6g} uT·mm**\n"
        f"- Affine fit: measured ≈ **{scale:.8g} × model + {offset:.8g} uT**\n\n"
        "## Suggested next measurement points\n\n"
        + "\n".join(f"- {item['position_mm']:.6g} mm (score {item['score']:.4g})" for item in suggestions)
        + "\n\n## Scientific boundary\n\n" + summary["boundary"] + "\n",
        encoding="utf-8",
    )

    print(f"Magnet Bench 03 complete: {out}")
    print(json.dumps(json_safe(summary), indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
