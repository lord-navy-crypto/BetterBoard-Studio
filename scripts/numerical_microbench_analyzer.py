#!/usr/bin/env python3
"""Analyze BetterBoard's focused numerical-error MCU recipes.

Supported recipe IDs:
- numerical_derivative
- numerical_cancellation
- numerical_accumulation

The MCU remains the source of finite-precision arithmetic evidence. This host
analyzer supplies an independent higher-precision reference and adds failure
mechanism diagnostics without changing BetterBoard's measurement CSV schemas.
"""
from __future__ import annotations

import argparse
import csv
import json
import math
import statistics
import struct
from decimal import Decimal, ROUND_FLOOR, localcontext
from pathlib import Path
from typing import Any

PI_DECIMAL = Decimal(
    "3.1415926535897932384626433832795028841971693993751058209749445923078164062862089986280348253421170679"
)


def f32(value: float) -> float:
    return struct.unpack("<f", struct.pack("<f", float(value)))[0]


def next_f32_up(value: float) -> float:
    value = f32(value)
    if math.isnan(value) or value == math.inf:
        return value
    if value == 0.0:
        return struct.unpack("<f", struct.pack("<I", 1))[0]
    bits = struct.unpack("<I", struct.pack("<f", value))[0]
    bits = bits + 1 if value > 0 else bits - 1
    return struct.unpack("<f", struct.pack("<I", bits))[0]


def f32_ulp(reference: float) -> float:
    rounded = f32(reference)
    spacing = abs(next_f32_up(rounded) - rounded)
    return spacing if spacing else 2.0 ** -149


def decimal_reduce(value: float, precision: int) -> Decimal:
    exact = Decimal.from_float(float(value))
    with localcontext() as ctx:
        ctx.prec = precision + 20
        two_pi = PI_DECIMAL * 2
        turns = ((exact + PI_DECIMAL) / two_pi).to_integral_value(rounding=ROUND_FLOOR)
        y = exact - turns * two_pi
        if y > PI_DECIMAL:
            y -= two_pi
        elif y < -PI_DECIMAL:
            y += two_pi
        return +y


def decimal_cos_exact_binary32(value: float, precision: int = 90) -> Decimal:
    y = decimal_reduce(f32(value), precision)
    with localcontext() as ctx:
        ctx.prec = precision + 20
        term = Decimal(1)
        total = Decimal(1)
        n = 1
        threshold = Decimal(10) ** Decimal(-(precision + 5))
        while n < 1000:
            denominator = Decimal(2 * n - 1) * Decimal(2 * n)
            term = term * (-(y * y)) / denominator
            total += term
            if abs(term) < threshold:
                break
            n += 1
        ctx.prec = precision
        return +total


def decimal_sqrt_minus_one_exact_binary32(value: float, precision: int = 90) -> Decimal:
    exact = Decimal.from_float(float(f32(value)))
    with localcontext() as ctx:
        ctx.prec = precision + 20
        result = (Decimal(1) + exact).sqrt() - Decimal(1)
        ctx.prec = precision
        return +result


def reference_cos(value: float, precision: int) -> tuple[float, str]:
    try:
        import mpmath as mp  # type: ignore
        with mp.workdps(precision):
            ref = mp.cos(mp.mpf(float(f32(value))))
            return float(ref), "mpmath"
    except Exception:
        ref = decimal_cos_exact_binary32(value, precision)
        return float(ref), "decimal_taylor_fallback"


def reference_sqrt_minus_one(value: float, precision: int) -> tuple[float, str]:
    try:
        import mpmath as mp  # type: ignore
        with mp.workdps(precision):
            x = mp.mpf(float(f32(value)))
            ref = mp.sqrt(1 + x) - 1
            return float(ref), "mpmath"
    except Exception:
        ref = decimal_sqrt_minus_one_exact_binary32(value, precision)
        return float(ref), "decimal_sqrt_fallback"


def locate(path: Path) -> tuple[Path, Path | None]:
    path = path.expanduser().resolve()
    if path.is_dir():
        data = path / "data.csv"
        metadata = path / "metadata.json"
    else:
        data = path
        metadata = path.parent / "metadata.json"
    if not data.is_file():
        raise FileNotFoundError(data)
    return data, metadata if metadata.is_file() else None


def load_metadata(path: Path | None) -> dict[str, Any]:
    if path is None:
        return {}
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
        return value if isinstance(value, dict) else {}
    except (OSError, json.JSONDecodeError):
        return {}


def read_rows(path: Path) -> tuple[list[str], list[dict[str, str]]]:
    with path.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        return list(reader.fieldnames or []), list(reader)


def finite_float(row: dict[str, str], key: str) -> float:
    value = float(row[key])
    if not math.isfinite(value):
        raise ValueError(f"Non-finite {key}: {row[key]!r}")
    return value


def analyze_derivative(rows: list[dict[str, str]], metadata: dict[str, Any], precision: int) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    params = metadata.get("recipe_parameters") or {}
    raw_x = params.get("x_value")
    if raw_x is None:
        raise ValueError("Derivative analysis requires metadata.recipe_parameters.x_value")
    x = f32(float(raw_x))
    reference, backend = reference_cos(x, precision)
    analyzed: list[dict[str, Any]] = []

    for row in rows:
        h = f32(finite_float(row, "h"))
        forward = finite_float(row, "forward")
        central = finite_float(row, "central")
        plus = f32(x + h)
        minus = f32(x - h)
        forward_error = abs(forward - reference)
        central_error = abs(central - reference)
        analyzed.append({
            **row,
            "x_exact_f32": x,
            "h_exact_f32": h,
            "host_reference_cos": reference,
            "reference_backend": backend,
            "forward_abs_error_host": forward_error,
            "central_abs_error_host": central_error,
            "forward_ulp_error_host": forward_error / f32_ulp(reference),
            "central_ulp_error_host": central_error / f32_ulp(reference),
            "x_plus_h_f32": plus,
            "x_minus_h_f32": minus,
            "effective_h_plus": plus - x,
            "effective_h_minus": x - minus,
            "plus_collapsed": int(plus == x),
            "minus_collapsed": int(minus == x),
        })

    best_forward = min(analyzed, key=lambda r: float(r["forward_abs_error_host"]))
    best_central = min(analyzed, key=lambda r: float(r["central_abs_error_host"]))
    collapse_rows = [r for r in analyzed if r["plus_collapsed"] or r["minus_collapsed"]]
    summary = {
        "recipe_id": "numerical_derivative",
        "reference_backend": backend,
        "x_exact_f32": x,
        "best_forward_h": float(best_forward["h_exact_f32"]),
        "best_forward_abs_error": float(best_forward["forward_abs_error_host"]),
        "best_central_h": float(best_central["h_exact_f32"]),
        "best_central_abs_error": float(best_central["central_abs_error_host"]),
        "collapse_row_count": len(collapse_rows),
        "first_collapsed_h": float(collapse_rows[0]["h_exact_f32"]) if collapse_rows else None,
        "interpretation": "The host oracle is independent of MCU cosf(); collapse flags identify when x±h rounds back to x in binary32.",
    }
    return analyzed, summary


def analyze_cancellation(rows: list[dict[str, str]], precision: int) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    analyzed: list[dict[str, Any]] = []
    backends: set[str] = set()

    for row in rows:
        x = f32(finite_float(row, "x"))
        raw = finite_float(row, "raw")
        stable = finite_float(row, "stable")
        reference, backend = reference_sqrt_minus_one(x, precision)
        backends.add(backend)
        raw_error = abs(raw - reference)
        stable_error = abs(stable - reference)
        improvement = (raw_error / stable_error) if stable_error > 0 else (math.inf if raw_error > 0 else 1.0)
        analyzed.append({
            **row,
            "x_exact_f32": x,
            "host_reference": reference,
            "reference_backend": backend,
            "raw_abs_error_host": raw_error,
            "stable_abs_error_host": stable_error,
            "raw_ulp_error_host": raw_error / f32_ulp(reference),
            "stable_ulp_error_host": stable_error / f32_ulp(reference),
            "stable_improvement_factor": improvement,
            "raw_failed_to_resolve": int(raw == 0.0 and reference != 0.0),
        })

    finite_improvements = [
        float(r["stable_improvement_factor"])
        for r in analyzed
        if math.isfinite(float(r["stable_improvement_factor"]))
    ]
    failed = [r for r in analyzed if r["raw_failed_to_resolve"]]
    summary = {
        "recipe_id": "numerical_cancellation",
        "reference_backends": sorted(backends),
        "points": len(analyzed),
        "raw_zero_or_resolution_failures": len(failed),
        "first_resolution_failure_abs_x": min((abs(float(r["x_exact_f32"])) for r in failed), default=None),
        "median_stable_improvement_factor": statistics.median(finite_improvements) if finite_improvements else None,
        "max_stable_improvement_factor": max(finite_improvements) if finite_improvements else None,
        "interpretation": "Raw and stable forms are both judged against an independent host oracle; disagreement alone is not treated as truth.",
    }
    return analyzed, summary


def analyze_accumulation(rows: list[dict[str, str]]) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    analyzed: list[dict[str, Any]] = []
    for row in rows:
        n = int(float(row["count"]))
        increment = f32(finite_float(row, "increment"))
        naive = finite_float(row, "naive")
        kahan = finite_float(row, "kahan")
        exact_sum_decimal = Decimal.from_float(float(increment)) * Decimal(n)
        exact_sum = float(exact_sum_decimal)
        correctly_rounded = f32(exact_sum)
        naive_error = abs(naive - exact_sum)
        kahan_error = abs(kahan - exact_sum)
        ulp = f32_ulp(correctly_rounded)
        analyzed.append({
            **row,
            "increment_exact_f32": increment,
            "exact_sum_of_binary32_increment": exact_sum,
            "correctly_rounded_float32_target": correctly_rounded,
            "naive_abs_error_host": naive_error,
            "kahan_abs_error_host": kahan_error,
            "naive_ulp_error_host": naive_error / ulp,
            "kahan_ulp_error_host": kahan_error / ulp,
            "kahan_improvement_factor": (naive_error / kahan_error) if kahan_error > 0 else (math.inf if naive_error > 0 else 1.0),
            "runtime_ratio_kahan_over_naive": (float(row["kahan_us"]) / float(row["naive_us"])) if float(row["naive_us"]) > 0 else None,
        })

    final = max(analyzed, key=lambda r: int(float(r["count"])))
    summary = {
        "recipe_id": "numerical_accumulation",
        "checkpoints": len(analyzed),
        "final_count": int(float(final["count"])),
        "final_naive_abs_error": float(final["naive_abs_error_host"]),
        "final_kahan_abs_error": float(final["kahan_abs_error_host"]),
        "final_naive_ulp_error": float(final["naive_ulp_error_host"]),
        "final_kahan_ulp_error": float(final["kahan_ulp_error_host"]),
        "interpretation": "The target is the exact mathematical sum of the binary32 increment actually used by the MCU, not the MCU's own float multiplication.",
    }
    return analyzed, summary


def json_safe(value: Any) -> Any:
    if isinstance(value, dict):
        return {str(k): json_safe(v) for k, v in value.items()}
    if isinstance(value, list):
        return [json_safe(v) for v in value]
    if isinstance(value, float) and not math.isfinite(value):
        if math.isnan(value):
            return "nan"
        return "infinity" if value > 0 else "-infinity"
    return value


def write_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    fields: list[str] = []
    for row in rows:
        for key in row:
            if key not in fields:
                fields.append(key)
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)


def report_lines(summary: dict[str, Any]) -> list[str]:
    recipe = summary["recipe_id"]
    lines = [
        "# BetterBoard Numerical Microbench — Host Oracle Report",
        "",
        f"- Recipe: `{recipe}`",
        "",
        "> MCU outputs are finite-precision evidence. Reference accuracy is decided independently on the host; the MCU is not allowed to grade itself.",
        "",
    ]
    if recipe == "numerical_derivative":
        lines += [
            "## Step-size differentiation",
            "",
            f"- Exact binary32 x: {summary['x_exact_f32']}",
            f"- Best forward h: {summary['best_forward_h']} (abs error {summary['best_forward_abs_error']})",
            f"- Best central h: {summary['best_central_h']} (abs error {summary['best_central_abs_error']})",
            f"- Rows with x±h collapse: {summary['collapse_row_count']}",
            f"- First collapsed h: {summary['first_collapsed_h']}",
        ]
    elif recipe == "numerical_cancellation":
        lines += [
            "## Catastrophic cancellation",
            "",
            f"- Points: {summary['points']}",
            f"- Raw resolution failures: {summary['raw_zero_or_resolution_failures']}",
            f"- Median stable-form improvement: {summary['median_stable_improvement_factor']}",
            f"- Maximum finite stable-form improvement: {summary['max_stable_improvement_factor']}",
        ]
    else:
        lines += [
            "## Accumulation",
            "",
            f"- Checkpoints: {summary['checkpoints']}",
            f"- Final count: {summary['final_count']}",
            f"- Final naive abs error: {summary['final_naive_abs_error']}",
            f"- Final Kahan abs error: {summary['final_kahan_abs_error']}",
            f"- Final naive ULP error: {summary['final_naive_ulp_error']}",
            f"- Final Kahan ULP error: {summary['final_kahan_ulp_error']}",
        ]
    lines += ["", "## Interpretation", "", str(summary["interpretation"]), ""]
    return lines


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("measurement", type=Path, help="BetterBoard measurement folder or data.csv")
    parser.add_argument("--precision", type=int, default=80, help="host oracle decimal digits")
    parser.add_argument("--recipe", choices=["numerical_derivative", "numerical_cancellation", "numerical_accumulation"])
    args = parser.parse_args()
    if not 30 <= args.precision <= 200:
        raise SystemExit("--precision must be between 30 and 200")

    data_path, metadata_path = locate(args.measurement)
    metadata = load_metadata(metadata_path)
    recipe_id = args.recipe or metadata.get("recipe_id")
    if recipe_id not in {"numerical_derivative", "numerical_cancellation", "numerical_accumulation"}:
        raise SystemExit("Could not identify a supported numerical microbench recipe; use --recipe if metadata is unavailable.")

    fieldnames, rows = read_rows(data_path)
    if not rows:
        raise SystemExit("No data rows found")

    if recipe_id == "numerical_derivative":
        required = {"h", "forward", "central", "mcu_cos", "abs_err_forward", "abs_err_central"}
        if not required.issubset(fieldnames):
            raise SystemExit(f"Derivative schema mismatch; missing {sorted(required - set(fieldnames))}")
        analyzed, summary = analyze_derivative(rows, metadata, args.precision)
    elif recipe_id == "numerical_cancellation":
        required = {"x", "raw", "stable", "abs_difference", "relative_difference", "raw_zero"}
        if not required.issubset(fieldnames):
            raise SystemExit(f"Cancellation schema mismatch; missing {sorted(required - set(fieldnames))}")
        analyzed, summary = analyze_cancellation(rows, args.precision)
    else:
        required = {"count", "increment", "naive", "kahan", "target_float", "naive_error", "kahan_error", "naive_us", "kahan_us"}
        if not required.issubset(fieldnames):
            raise SystemExit(f"Accumulation schema mismatch; missing {sorted(required - set(fieldnames))}")
        analyzed, summary = analyze_accumulation(rows)

    summary["schema"] = "betterboard.numerical-microbench-analysis/0.1"
    summary["source"] = str(data_path)
    summary["row_count"] = len(analyzed)

    output = data_path.parent / "numerical-microbench-analysis"
    output.mkdir(parents=True, exist_ok=True)
    write_csv(output / "analysis.csv", analyzed)
    (output / "summary.json").write_text(json.dumps(json_safe(summary), indent=2), encoding="utf-8")
    (output / "report.md").write_text("\n".join(report_lines(json_safe(summary))), encoding="utf-8")
    print(f"Numerical microbench analysis complete: {output}")
    print(json.dumps(json_safe(summary), indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
