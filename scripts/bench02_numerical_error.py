#!/usr/bin/env python3
"""BetterBoard Bench 02 — Sampling & Numerical Error, depth revision.

Analyze a real BetterBoard measurement package without third-party Python
requirements. The finest available measured series is an empirical numerical
baseline, not physical ground truth.

Depth revision 0.2 adds:
- a true second-order three-point derivative for non-uniform timestamps,
- a comparison against the old span derivative to expose timing-jitter bias,
- naive float32 vs Kahan-compensated float32 trapezoid accumulation,
- p95 / max absolute timing-jitter diagnostics.
"""
from __future__ import annotations

import argparse
import csv
import json
import math
import statistics
import struct
from pathlib import Path
from typing import Iterable

DEFAULT_FACTORS = (1, 2, 4, 5, 10)
VALUE_PRIORITY = (
    "raw_adc",
    "filtered_voltage_v",
    "nominal_voltage_v",
    "normalized",
    "value",
    "adc_counts",
)
TIME_PRIORITY = ("time_us", "timestamp_us", "event_us", "time_ms", "timestamp_ms", "time_s", "timestamp_s")


def f32(value: float) -> float:
    """Round one arithmetic result to IEEE-754 binary32."""
    return struct.unpack("!f", struct.pack("!f", float(value)))[0]


def median(values: Iterable[float]) -> float:
    seq = list(values)
    return statistics.median(seq) if seq else math.nan


def mean(values: Iterable[float]) -> float:
    seq = list(values)
    return statistics.fmean(seq) if seq else math.nan


def stdev_population(values: Iterable[float]) -> float:
    seq = list(values)
    return statistics.pstdev(seq) if len(seq) >= 2 else 0.0


def percentile(values: Iterable[float], q: float) -> float:
    seq = sorted(values)
    if not seq:
        return math.nan
    if len(seq) == 1:
        return seq[0]
    pos = (len(seq) - 1) * q
    lo = int(math.floor(pos))
    hi = int(math.ceil(pos))
    if lo == hi:
        return seq[lo]
    frac = pos - lo
    return seq[lo] * (1.0 - frac) + seq[hi] * frac


def time_scale(column: str) -> float:
    lower = column.lower()
    if lower.endswith("_us") or "microsecond" in lower:
        return 1e-6
    if lower.endswith("_ms") or "millisecond" in lower:
        return 1e-3
    return 1.0


def choose_column(fieldnames: list[str], explicit: str | None, priority: tuple[str, ...], kind: str) -> str:
    if explicit:
        if explicit not in fieldnames:
            raise ValueError(f"Requested {kind} column {explicit!r} not found. Available: {fieldnames}")
        return explicit
    for candidate in priority:
        if candidate in fieldnames:
            return candidate
    raise ValueError(f"Could not infer {kind} column. Available: {fieldnames}")


def resolve_input(path: Path) -> tuple[Path, Path | None]:
    path = path.expanduser().resolve()
    if path.is_dir():
        data = path / "data.csv"
        if not data.is_file():
            raise FileNotFoundError(f"No data.csv found in {path}")
        metadata = path / "metadata.json"
        return data, metadata if metadata.is_file() else None
    if not path.is_file():
        raise FileNotFoundError(path)
    metadata = path.parent / "metadata.json"
    return path, metadata if metadata.is_file() else None


def load_metadata(path: Path | None) -> dict:
    if path is None:
        return {}
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
        return value if isinstance(value, dict) else {}
    except (OSError, json.JSONDecodeError):
        return {}


def load_series(csv_path: Path, time_column: str | None, value_column: str | None) -> tuple[list[float], list[float], str, str, int]:
    with csv_path.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        fieldnames = reader.fieldnames or []
        t_col = choose_column(fieldnames, time_column, TIME_PRIORITY, "time")
        y_col = choose_column(fieldnames, value_column, VALUE_PRIORITY, "value")
        scale = time_scale(t_col)
        times: list[float] = []
        values: list[float] = []
        rejected = 0
        for row in reader:
            try:
                t = float(row[t_col]) * scale
                y = float(row[y_col])
            except (KeyError, TypeError, ValueError):
                rejected += 1
                continue
            if not math.isfinite(t) or not math.isfinite(y):
                rejected += 1
                continue
            if times and t <= times[-1]:
                rejected += 1
                continue
            times.append(t)
            values.append(y)
    if len(times) < 5:
        raise ValueError(f"Need at least 5 monotonic numeric samples; found {len(times)}")
    return times, values, t_col, y_col, rejected


def trapz64(times: list[float], values: list[float]) -> float:
    total = 0.0
    for i in range(1, len(times)):
        total += 0.5 * (values[i - 1] + values[i]) * (times[i] - times[i - 1])
    return total


def _trapz_area_f32(t0: float, t1: float, y0: float, y1: float) -> float:
    y_sum = f32(f32(y0) + f32(y1))
    half_sum = f32(f32(0.5) * y_sum)
    dt = f32(f32(t1) - f32(t0))
    return f32(half_sum * dt)


def trapz32(times: list[float], values: list[float]) -> float:
    total = f32(0.0)
    for i in range(1, len(times)):
        total = f32(total + _trapz_area_f32(times[i - 1], times[i], values[i - 1], values[i]))
    return float(total)


def trapz32_kahan(times: list[float], values: list[float]) -> float:
    total = f32(0.0)
    compensation = f32(0.0)
    for i in range(1, len(times)):
        area = _trapz_area_f32(times[i - 1], times[i], values[i - 1], values[i])
        y = f32(area - compensation)
        t = f32(total + y)
        compensation = f32(f32(t - total) - y)
        total = t
    return float(total)


def span_derivative(times: list[float], values: list[float]) -> list[float]:
    """Legacy symmetric-span formula. Exact only when the two local spacings match."""
    result = [math.nan] * len(times)
    for i in range(1, len(times) - 1):
        dt = times[i + 1] - times[i - 1]
        if dt > 0:
            result[i] = (values[i + 1] - values[i - 1]) / dt
    return result


def nonuniform_three_point_derivative(times: list[float], values: list[float]) -> list[float]:
    """Second-order 3-point derivative for arbitrary strictly increasing timestamps.

    The coefficients are the derivative of the local quadratic Lagrange
    interpolant at t[i]. For h0 == h1 this reduces to the usual central
    difference formula.
    """
    result = [math.nan] * len(times)
    for i in range(1, len(times) - 1):
        h0 = times[i] - times[i - 1]
        h1 = times[i + 1] - times[i]
        if h0 <= 0.0 or h1 <= 0.0:
            continue
        c_prev = -h1 / (h0 * (h0 + h1))
        c_mid = (h1 - h0) / (h0 * h1)
        c_next = h0 / (h1 * (h0 + h1))
        result[i] = c_prev * values[i - 1] + c_mid * values[i] + c_next * values[i + 1]
    return result


def rms(values: Iterable[float]) -> float:
    seq = [v for v in values if math.isfinite(v)]
    return math.sqrt(mean(v * v for v in seq)) if seq else math.nan


def minimum_positive_step(values: list[float]) -> float | None:
    unique = sorted(set(values))
    steps = [b - a for a, b in zip(unique, unique[1:]) if b > a]
    return min(steps) if steps else None


def downsample(times: list[float], values: list[float], factor: int) -> tuple[list[int], list[float], list[float]]:
    indices = list(range(0, len(times), factor))
    if indices[-1] != len(times) - 1:
        indices.append(len(times) - 1)
    return indices, [times[i] for i in indices], [values[i] for i in indices]


def analyze(times: list[float], values: list[float], factors: tuple[int, ...], target_rate_hz: float | None) -> dict:
    dt = [b - a for a, b in zip(times, times[1:])]
    dt_med = median(dt)
    target_dt = 1.0 / target_rate_hz if target_rate_hz and target_rate_hz > 0 else dt_med
    timing_error = [x - target_dt for x in dt]
    abs_timing_error = [abs(x) for x in timing_error]

    baseline_integral = trapz64(times, values)
    baseline_derivative = nonuniform_three_point_derivative(times, values)
    legacy_baseline_derivative = span_derivative(times, values)
    local_formula_disagreement = [
        a - b for a, b in zip(legacy_baseline_derivative, baseline_derivative)
        if math.isfinite(a) and math.isfinite(b)
    ]
    convergence = []

    for factor in factors:
        if factor < 1:
            continue
        idx, t_sub, y_sub = downsample(times, values, factor)
        if len(t_sub) < 5:
            continue
        derivative = nonuniform_three_point_derivative(t_sub, y_sub)
        derivative_error = []
        for local_i in range(1, len(idx) - 1):
            original_i = idx[local_i]
            coarse = derivative[local_i]
            fine = baseline_derivative[original_i] if original_i < len(baseline_derivative) else math.nan
            if math.isfinite(coarse) and math.isfinite(fine):
                derivative_error.append(coarse - fine)
        integral = trapz64(t_sub, y_sub)
        integral_delta = integral - baseline_integral
        local_dt = [b - a for a, b in zip(t_sub, t_sub[1:])]
        convergence.append({
            "factor": factor,
            "samples": len(t_sub),
            "median_dt_s": median(local_dt),
            "effective_rate_hz": (1.0 / median(local_dt)) if local_dt and median(local_dt) > 0 else None,
            "trapezoid_integral": integral,
            "integral_delta_vs_fine": integral_delta,
            "relative_integral_delta_vs_fine": (integral_delta / baseline_integral) if baseline_integral != 0 else None,
            "derivative_rmse_vs_fine": rms(derivative_error),
        })

    integral32 = trapz32(times, values)
    integral32_kahan = trapz32_kahan(times, values)
    value_step = minimum_positive_step(values)

    return {
        "sample_count": len(times),
        "duration_s": times[-1] - times[0],
        "timing": {
            "target_rate_hz": target_rate_hz,
            "target_dt_s": target_dt,
            "median_dt_s": dt_med,
            "mean_dt_s": mean(dt),
            "min_dt_s": min(dt),
            "max_dt_s": max(dt),
            "dt_std_s": stdev_population(dt),
            "jitter_rms_s": rms(timing_error),
            "jitter_p95_abs_s": percentile(abs_timing_error, 0.95),
            "jitter_max_abs_s": max(abs_timing_error),
            "observed_rate_hz": 1.0 / dt_med if dt_med > 0 else None,
            "dt_coefficient_of_variation": stdev_population(dt) / mean(dt) if mean(dt) else None,
        },
        "value": {
            "min": min(values),
            "max": max(values),
            "mean": mean(values),
            "std": stdev_population(values),
            "unique_values": len(set(values)),
            "minimum_observed_positive_step": value_step,
        },
        "derivative": {
            "method": "nonuniform_quadratic_three_point",
            "legacy_span_vs_nonuniform_rmse": rms(local_formula_disagreement),
            "interpretation": "formula disagreement isolates timestamp-spacing sensitivity; it is not physical derivative error",
        },
        "floating_point_accumulation": {
            "trapezoid_float64": baseline_integral,
            "trapezoid_float32_naive": integral32,
            "trapezoid_float32_kahan": integral32_kahan,
            "naive_absolute_difference_vs_float64": integral32 - baseline_integral,
            "kahan_absolute_difference_vs_float64": integral32_kahan - baseline_integral,
            "naive_relative_difference_vs_float64": ((integral32 - baseline_integral) / baseline_integral) if baseline_integral != 0 else None,
            "kahan_relative_difference_vs_float64": ((integral32_kahan - baseline_integral) / baseline_integral) if baseline_integral != 0 else None,
        },
        "downsample_convergence": convergence,
    }


def write_convergence_csv(path: Path, rows: list[dict]) -> None:
    fields = [
        "factor", "samples", "median_dt_s", "effective_rate_hz", "trapezoid_integral",
        "integral_delta_vs_fine", "relative_integral_delta_vs_fine", "derivative_rmse_vs_fine",
    ]
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)


def fmt(value: object) -> str:
    if value is None:
        return "—"
    if isinstance(value, float):
        if not math.isfinite(value):
            return "—"
        return f"{value:.8g}"
    return str(value)


def write_report(path: Path, source: Path, time_col: str, value_col: str, rejected: int, result: dict) -> None:
    timing = result["timing"]
    value = result["value"]
    derivative = result["derivative"]
    fp = result["floating_point_accumulation"]
    lines = [
        "# BetterBoard Bench 02 — Sampling & Numerical Error Report",
        "",
        f"- Source: `{source}`",
        f"- Time column: `{time_col}`",
        f"- Value column: `{value_col}`",
        f"- Accepted samples: **{result['sample_count']}**",
        f"- Rejected/non-monotonic rows: **{rejected}**",
        f"- Duration: **{fmt(result['duration_s'])} s**",
        "",
        "> The finest available measured series is an empirical numerical baseline, not exact physical truth. This report studies sampling/discretization/accumulation behavior; it does not establish sensor calibration or absolute physical error.",
        "",
        "## Timing",
        "",
        f"- Requested rate: {fmt(timing['target_rate_hz'])} Hz",
        f"- Observed median rate: {fmt(timing['observed_rate_hz'])} Hz",
        f"- Median Δt: {fmt(timing['median_dt_s'])} s",
        f"- Δt standard deviation: {fmt(timing['dt_std_s'])} s",
        f"- RMS timing error/jitter: {fmt(timing['jitter_rms_s'])} s",
        f"- p95 |timing error|: {fmt(timing['jitter_p95_abs_s'])} s",
        f"- max |timing error|: {fmt(timing['jitter_max_abs_s'])} s",
        "",
        "## Value statistics",
        "",
        f"- Min / max: {fmt(value['min'])} / {fmt(value['max'])}",
        f"- Mean: {fmt(value['mean'])}",
        f"- Standard deviation: {fmt(value['std'])}",
        f"- Unique values: {value['unique_values']}",
        f"- Minimum observed positive step: {fmt(value['minimum_observed_positive_step'])}",
        "",
        "## Numerical differentiation",
        "",
        "- Primary derivative: second-order 3-point Lagrange derivative for non-uniform timestamps.",
        f"- Legacy symmetric-span vs non-uniform derivative RMSE: {fmt(derivative['legacy_span_vs_nonuniform_rmse'])}",
        "- This disagreement measures sensitivity to timestamp spacing, not absolute physical derivative error.",
        "",
        "## Floating-point accumulation",
        "",
        f"- Trapezoid integral, float64: {fmt(fp['trapezoid_float64'])}",
        f"- Trapezoid integral, emulated float32 naive: {fmt(fp['trapezoid_float32_naive'])}",
        f"- Trapezoid integral, emulated float32 Kahan: {fmt(fp['trapezoid_float32_kahan'])}",
        f"- Naive Δ vs float64: {fmt(fp['naive_absolute_difference_vs_float64'])}",
        f"- Kahan Δ vs float64: {fmt(fp['kahan_absolute_difference_vs_float64'])}",
        "",
        "## Downsampling convergence",
        "",
        "| factor | samples | effective Hz | integral | Δ integral vs finest | derivative RMSE vs finest |",
        "|---:|---:|---:|---:|---:|---:|",
    ]
    for row in result["downsample_convergence"]:
        lines.append(
            f"| {row['factor']} | {row['samples']} | {fmt(row['effective_rate_hz'])} | {fmt(row['trapezoid_integral'])} | {fmt(row['integral_delta_vs_fine'])} | {fmt(row['derivative_rmse_vs_fine'])} |"
        )
    lines += [
        "",
        "## Interpretation boundary",
        "",
        "Bench 02 separates timing irregularity, derivative-formula sensitivity, downsampling sensitivity and floating-point accumulation. The full-rate measured sequence remains only an empirical baseline. No result here establishes calibration traceability, exact sensor accuracy or physical ground truth.",
        "",
    ]
    path.write_text("\n".join(lines), encoding="utf-8")


def parse_factors(text: str) -> tuple[int, ...]:
    factors = tuple(sorted({int(item.strip()) for item in text.split(",") if item.strip()}))
    if not factors or any(item < 1 for item in factors):
        raise argparse.ArgumentTypeError("factors must be positive integers, e.g. 1,2,4,5,10")
    return factors


def main() -> int:
    parser = argparse.ArgumentParser(description="Analyze a BetterBoard real measurement as Bench 02 numerical-error evidence.")
    parser.add_argument("input", type=Path, help="BetterBoard measurement directory or data.csv")
    parser.add_argument("--time", dest="time_column", help="time column; inferred when omitted")
    parser.add_argument("--value", dest="value_column", help="value column; raw_adc is preferred when present")
    parser.add_argument("--factors", type=parse_factors, default=DEFAULT_FACTORS, help="downsample factors, default: 1,2,4,5,10")
    parser.add_argument("--output", type=Path, help="output directory; default: <measurement>/bench02-numerical-error")
    args = parser.parse_args()

    csv_path, metadata_path = resolve_input(args.input)
    metadata = load_metadata(metadata_path)
    times, values, time_col, value_col, rejected = load_series(csv_path, args.time_column, args.value_column)
    target_rate = metadata.get("sample_rate_hz")
    try:
        target_rate = float(target_rate) if target_rate is not None else None
    except (TypeError, ValueError):
        target_rate = None

    result = analyze(times, values, args.factors, target_rate)
    result["schema"] = "betterboard.bench02-numerical-error/0.2"
    result["source"] = str(csv_path)
    result["time_column"] = time_col
    result["value_column"] = value_col
    result["rejected_rows"] = rejected
    result["reference_boundary"] = "finest measured series is an empirical numerical baseline, not physical ground truth"

    output = (args.output or (csv_path.parent / "bench02-numerical-error")).expanduser().resolve()
    output.mkdir(parents=True, exist_ok=True)
    summary_path = output / "bench02_summary.json"
    convergence_path = output / "bench02_convergence.csv"
    report_path = output / "bench02_report.md"
    summary_path.write_text(json.dumps(result, indent=2, allow_nan=False), encoding="utf-8")
    write_convergence_csv(convergence_path, result["downsample_convergence"])
    write_report(report_path, csv_path, time_col, value_col, rejected, result)

    print(f"Bench 02 analysis complete: {output}")
    print(json.dumps(result, indent=2, allow_nan=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
