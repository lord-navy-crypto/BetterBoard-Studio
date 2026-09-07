#!/usr/bin/env python3
"""Analyze BetterBoard Bench 03 embedded numerical-reliability evidence.

The MCU performs the Taylor recurrence. This host analyzer supplies the
reference side and mirrors the main reliability decisions from the Numerical
Error Analysis Studio: absolute/relative/ULP error, scale-aware acceptance,
false convergence, cancellation, and reliability classification.

If mpmath is available it is used as the preferred arbitrary-precision oracle.
Otherwise a standard-library Decimal Taylor oracle is used. The fallback is
explicitly labeled in the output and does not pretend to be mpmath.
"""
from __future__ import annotations

import argparse
import csv
import json
import math
import statistics
import struct
from decimal import Decimal, localcontext
from pathlib import Path
from typing import Any

PI_DECIMAL = Decimal(
    "3.1415926535897932384626433832795028841971693993751058209749445923078164062862089986280348253421170679"
)

COLUMNS = [
    "study_code",
    "method_code",
    "x_bits",
    "x",
    "term_limit",
    "reduced_x",
    "approximation",
    "terms_used",
    "last_term",
    "cancellation_ratio",
    "stop_rule",
    "finite",
    "elapsed_us",
    "float_bytes",
    "double_bytes",
    "float_epsilon",
]


def f32(value: float) -> float:
    return struct.unpack("<f", struct.pack("<f", float(value)))[0]


def float_from_bits(bits: int) -> float:
    return struct.unpack("<f", struct.pack("<I", int(bits) & 0xFFFFFFFF))[0]


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
    if spacing == 0.0:
        return 2.0 ** -149
    return spacing


def decimal_sin_exact_binary32(value: float, precision: int = 90) -> Decimal:
    """High-precision sine of an exactly represented binary32 input."""
    exact = Decimal.from_float(float(value))
    with localcontext() as ctx:
        ctx.prec = precision + 15
        two_pi = PI_DECIMAL * 2
        y = (exact + PI_DECIMAL) % two_pi - PI_DECIMAL
        half_pi = PI_DECIMAL / 2
        if y > half_pi:
            y = PI_DECIMAL - y
        elif y < -half_pi:
            y = -PI_DECIMAL - y

        term = y
        total = y
        n = 1
        threshold = Decimal(10) ** Decimal(-(precision + 3))
        while n < 1000:
            denominator = Decimal(2 * n) * Decimal(2 * n + 1)
            term = term * (-(y * y)) / denominator
            total += term
            if abs(term) < threshold:
                break
            n += 1
        ctx.prec = precision
        return +total


def reference_value(value: float, digits: int) -> tuple[float, str, str]:
    try:
        import mpmath as mp  # type: ignore

        with mp.workdps(digits):
            exact = mp.mpf(float(value))
            ref = mp.sin(exact)
            return float(ref), mp.nstr(ref, digits), "mpmath"
    except Exception:
        ref_decimal = decimal_sin_exact_binary32(value, digits)
        return float(ref_decimal), format(ref_decimal, "f"), "decimal_taylor_fallback"


def status_for(*, finite: bool, stop: bool, accuracy: bool, cancellation_ok: bool) -> str:
    if not finite:
        return "non_finite_arithmetic"
    if stop and not accuracy:
        return "false_convergence"
    if not stop:
        return "term_limit_reached"
    if not accuracy:
        return "accuracy_failure"
    if not cancellation_ok:
        return "excessive_cancellation"
    return "reliable"


def locate_data(path: Path) -> Path:
    if path.is_file():
        return path
    candidate = path / "data.csv"
    if candidate.is_file():
        return candidate
    raise FileNotFoundError(f"Could not find data.csv under {path}")


def parse_float(text: str) -> float:
    return float(text.strip())


def analyze_row(row: dict[str, str], precision_digits: int) -> dict[str, Any]:
    x_from_bits = float_from_bits(int(row["x_bits"]))
    approximation = parse_float(row["approximation"])
    finite = bool(int(row["finite"])) and math.isfinite(approximation)
    stop_rule = bool(int(row["stop_rule"]))
    epsilon = parse_float(row["float_epsilon"])
    cancellation = parse_float(row["cancellation_ratio"])

    reference, reference_text, oracle = reference_value(x_from_bits, precision_digits)
    absolute_error = math.inf if not finite else abs(approximation - reference)
    relative_floor = 2.0 ** -126
    relative_error = absolute_error / max(abs(reference), relative_floor)
    ulp_error = absolute_error / f32_ulp(reference)
    allowed_error = 8.0 * epsilon * max(1.0, abs(x_from_bits), abs(reference))
    accuracy_passed = finite and absolute_error <= allowed_error
    cancellation_limit = 1.0 / math.sqrt(epsilon)
    cancellation_ok = math.isfinite(cancellation) and cancellation <= cancellation_limit
    reliable = finite and stop_rule and accuracy_passed and cancellation_ok
    status = status_for(
        finite=finite,
        stop=stop_rule,
        accuracy=accuracy_passed,
        cancellation_ok=cancellation_ok,
    )

    return {
        **row,
        "exact_binary32_x": repr(x_from_bits),
        "reference": reference,
        "reference_text": reference_text,
        "reference_backend": oracle,
        "absolute_error": absolute_error,
        "relative_error": relative_error,
        "ulp_error": ulp_error,
        "allowed_absolute_error": allowed_error,
        "normalized_error": absolute_error / allowed_error if allowed_error else math.inf,
        "accuracy_passed": accuracy_passed,
        "cancellation_limit": cancellation_limit,
        "cancellation_ok": cancellation_ok,
        "false_convergence": stop_rule and not accuracy_passed,
        "numerically_reliable": reliable,
        "status": status,
    }


def summarize(rows: list[dict[str, Any]]) -> dict[str, Any]:
    parameter = [r for r in rows if int(r["study_code"]) == 1]
    convergence = [r for r in rows if int(r["study_code"]) == 2]

    def method_summary(method_code: int) -> dict[str, Any]:
        subset = [r for r in parameter if int(r["method_code"]) == method_code]
        if not subset:
            return {"points": 0}
        finite_errors = [float(r["absolute_error"]) for r in subset if math.isfinite(float(r["absolute_error"]))]
        worst = max(subset, key=lambda r: float(r["absolute_error"]))
        return {
            "points": len(subset),
            "maximum_absolute_error": max(finite_errors) if finite_errors else math.inf,
            "median_absolute_error": statistics.median(finite_errors) if finite_errors else math.inf,
            "worst_x": float(worst["exact_binary32_x"]),
            "accuracy_pass_rate": sum(bool(r["accuracy_passed"]) for r in subset) / len(subset),
            "reliability_rate": sum(bool(r["numerically_reliable"]) for r in subset) / len(subset),
            "false_convergence_count": sum(bool(r["false_convergence"]) for r in subset),
            "median_runtime_us": statistics.median(float(r["elapsed_us"]) for r in subset),
        }

    return {
        "schema": "betterboard.bench03-summary/0.1",
        "rows": len(rows),
        "parameter_scan_rows": len(parameter),
        "convergence_rows": len(convergence),
        "raw_parameter_scan": method_summary(0),
        "range_reduced_parameter_scan": method_summary(1),
        "observed_float_bytes": sorted({int(r["float_bytes"]) for r in rows}),
        "observed_double_bytes": sorted({int(r["double_bytes"]) for r in rows}),
        "observed_float_epsilon": sorted({float(r["float_epsilon"]) for r in rows}),
        "reference_backends": sorted({str(r["reference_backend"]) for r in rows}),
    }


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


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("measurement", type=Path, help="Bench 03 measurement folder or data.csv")
    parser.add_argument("--precision", type=int, default=80, help="reference decimal digits")
    args = parser.parse_args()

    if not 30 <= args.precision <= 200:
        raise SystemExit("--precision must be between 30 and 200")

    data_path = locate_data(args.measurement)
    with data_path.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        if reader.fieldnames != COLUMNS:
            raise SystemExit(
                "Bench 03 schema mismatch. Expected:\n  " + ",".join(COLUMNS) +
                "\nGot:\n  " + ",".join(reader.fieldnames or [])
            )
        rows = [analyze_row(row, args.precision) for row in reader]

    if not rows:
        raise SystemExit("No Bench 03 rows found")

    output_dir = data_path.parent / "bench03-embedded-numerical"
    output_dir.mkdir(parents=True, exist_ok=True)
    analysis_csv = output_dir / "bench03_analysis.csv"
    summary_json = output_dir / "bench03_summary.json"
    report_md = output_dir / "bench03_report.md"

    fieldnames = list(rows[0])
    with analysis_csv.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    summary = summarize(rows)
    summary_json.write_text(json.dumps(json_safe(summary), indent=2), encoding="utf-8")

    raw = summary["raw_parameter_scan"]
    reduced = summary["range_reduced_parameter_scan"]
    report_md.write_text(
        "# BetterBoard Bench 03 — Embedded Numerical Reliability\n\n"
        f"Rows analyzed: **{summary['rows']}**\n\n"
        "## Embedded arithmetic environment\n\n"
        f"- float bytes: {summary['observed_float_bytes']}\n"
        f"- double bytes: {summary['observed_double_bytes']}\n"
        f"- float epsilon: {summary['observed_float_epsilon']}\n"
        f"- reference backend(s): {summary['reference_backends']}\n\n"
        "## Parameter-scan summary\n\n"
        f"- Raw Taylor: max absolute error {raw.get('maximum_absolute_error')}, "
        f"reliability {raw.get('reliability_rate')}, false convergence {raw.get('false_convergence_count')}\n"
        f"- Range-reduced Taylor: max absolute error {reduced.get('maximum_absolute_error')}, "
        f"reliability {reduced.get('reliability_rate')}, false convergence {reduced.get('false_convergence_count')}\n\n"
        "## Scientific boundary\n\n"
        "The MCU result is real embedded arithmetic evidence. The host oracle is independent of the MCU calculation, "
        "but the exact backend is recorded. When mpmath is unavailable the analyzer uses a bundled high-precision "
        "Decimal Taylor fallback and labels it explicitly. Reliability here is numerical reliability, not hardware "
        "calibration or physical-sensor accuracy.\n",
        encoding="utf-8",
    )

    print(f"Bench 03 analysis complete: {output_dir}")
    print(json.dumps(json_safe(summary), indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
