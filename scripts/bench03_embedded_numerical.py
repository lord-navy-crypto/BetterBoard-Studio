#!/usr/bin/env python3
"""Analyze BetterBoard Bench 03 embedded numerical-reliability evidence.

Depth revision 0.2 keeps the MCU/host separation and adds explicit error-source
attribution. The MCU is evidence; the host oracle is the independent reference.
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

COLUMNS = [
    "study_code", "method_code", "x_bits", "x", "term_limit", "reduced_x",
    "terms_used", "last_term", "cancellation_ratio", "stop_rule", "finite",
    "elapsed_us", "float_bytes", "double_bytes", "float_epsilon", "approximation",
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
    return spacing if spacing != 0.0 else 2.0 ** -149


def decimal_reduce_sine_argument_exact_binary32(value: float, precision: int = 90) -> Decimal:
    exact = Decimal.from_float(float(f32(value)))
    with localcontext() as ctx:
        ctx.prec = precision + 20
        two_pi = PI_DECIMAL * 2
        turns = ((exact + PI_DECIMAL) / two_pi).to_integral_value(rounding=ROUND_FLOOR)
        y = exact - turns * two_pi
        half_pi = PI_DECIMAL / 2
        if y > half_pi:
            y = PI_DECIMAL - y
        elif y < -half_pi:
            y = -PI_DECIMAL - y
        ctx.prec = precision
        return +y


def decimal_sin_from_decimal(value: Decimal, precision: int = 90) -> Decimal:
    with localcontext() as ctx:
        ctx.prec = precision + 20
        y = value
        term = y
        total = y
        n = 1
        threshold = Decimal(10) ** Decimal(-(precision + 5))
        while n < 1200:
            denominator = Decimal(2 * n) * Decimal(2 * n + 1)
            term = term * (-(y * y)) / denominator
            total += term
            if abs(term) < threshold:
                break
            n += 1
        ctx.prec = precision
        return +total


def decimal_sin_exact_binary32(value: float, precision: int = 90) -> Decimal:
    return decimal_sin_from_decimal(decimal_reduce_sine_argument_exact_binary32(value, precision + 10), precision)


def reference_value(value: float, digits: int) -> tuple[float, str, str]:
    exact_f32 = f32(value)
    try:
        import mpmath as mp  # type: ignore
        with mp.workdps(digits):
            exact = mp.mpf(float(exact_f32))
            ref = mp.sin(exact)
            return float(ref), mp.nstr(ref, digits), "mpmath"
    except Exception:
        ref_decimal = decimal_sin_exact_binary32(exact_f32, digits)
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


def dominant_error_source(reduction_output_error: float, recurrence_error: float) -> str:
    if not math.isfinite(reduction_output_error) or not math.isfinite(recurrence_error):
        return "non_finite"
    floor = 1e-30
    a = max(reduction_output_error, floor)
    b = max(recurrence_error, floor)
    if a >= 4.0 * b:
        return "argument_reduction"
    if b >= 4.0 * a:
        return "taylor_recurrence"
    return "mixed"


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

    # sin(x) is output-bounded. Do not relax accuracy merely because |x| is large.
    allowed_error = 8.0 * epsilon * max(1.0, abs(reference))
    accuracy_passed = finite and absolute_error <= allowed_error
    cancellation_limit = 1.0 / math.sqrt(epsilon)
    cancellation_ok = finite and math.isfinite(cancellation) and cancellation <= cancellation_limit
    reliable = finite and stop_rule and accuracy_passed and cancellation_ok
    status = status_for(finite=finite, stop=stop_rule, accuracy=accuracy_passed, cancellation_ok=cancellation_ok)

    mcu_reduced = f32(parse_float(row["reduced_x"]))
    host_reduced_decimal = decimal_reduce_sine_argument_exact_binary32(x_from_bits, precision_digits)
    host_reduced = float(host_reduced_decimal)
    reduction_argument_error = abs(float(mcu_reduced) - host_reduced)

    reduced_reference, _, reduced_oracle = reference_value(mcu_reduced, precision_digits)
    reduction_output_error = abs(reduced_reference - reference)
    recurrence_error = math.inf if not finite else abs(approximation - reduced_reference)
    source = dominant_error_source(reduction_output_error, recurrence_error)

    return {
        **row,
        "exact_binary32_x": repr(x_from_bits),
        "reference": reference,
        "reference_text": reference_text,
        "reference_backend": oracle,
        "reduced_reference_backend": reduced_oracle,
        "host_reduced_argument": host_reduced,
        "reduction_argument_error": reduction_argument_error,
        "reference_at_mcu_reduced_argument": reduced_reference,
        "argument_reduction_output_error": reduction_output_error,
        "taylor_recurrence_error": recurrence_error,
        "dominant_error_source": source,
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
        finite_reduction = [float(r["argument_reduction_output_error"]) for r in subset if math.isfinite(float(r["argument_reduction_output_error"]))]
        finite_recurrence = [float(r["taylor_recurrence_error"]) for r in subset if math.isfinite(float(r["taylor_recurrence_error"]))]
        worst = max(subset, key=lambda r: float(r["absolute_error"]))
        sources: dict[str, int] = {}
        for r in subset:
            key = str(r["dominant_error_source"])
            sources[key] = sources.get(key, 0) + 1
        return {
            "points": len(subset),
            "maximum_absolute_error": max(finite_errors) if finite_errors else math.inf,
            "median_absolute_error": statistics.median(finite_errors) if finite_errors else math.inf,
            "maximum_argument_reduction_output_error": max(finite_reduction) if finite_reduction else math.inf,
            "maximum_taylor_recurrence_error": max(finite_recurrence) if finite_recurrence else math.inf,
            "worst_x": float(worst["exact_binary32_x"]),
            "accuracy_pass_rate": sum(bool(r["accuracy_passed"]) for r in subset) / len(subset),
            "reliability_rate": sum(bool(r["numerically_reliable"]) for r in subset) / len(subset),
            "false_convergence_count": sum(bool(r["false_convergence"]) for r in subset),
            "median_runtime_us": statistics.median(float(r["elapsed_us"]) for r in subset),
            "dominant_error_sources": sources,
        }

    def convergence_summary(method_code: int) -> dict[str, Any]:
        subset = [r for r in convergence if int(r["method_code"]) == method_code]
        if not subset:
            return {"points": 0}
        reliable_rows = [r for r in subset if bool(r["numerically_reliable"])]
        finite_norm = [r for r in subset if math.isfinite(float(r["normalized_error"]))]
        best = min(finite_norm, key=lambda r: float(r["normalized_error"])) if finite_norm else None
        first_reliable = min(reliable_rows, key=lambda r: int(r["term_limit"])) if reliable_rows else None
        return {
            "points": len(subset),
            "first_reliable_term_limit": int(first_reliable["term_limit"]) if first_reliable else None,
            "best_term_limit": int(best["term_limit"]) if best else None,
            "best_normalized_error": float(best["normalized_error"]) if best else None,
            "false_convergence_count": sum(bool(r["false_convergence"]) for r in subset),
        }

    return {
        "schema": "betterboard.bench03-summary/0.2",
        "rows": len(rows),
        "parameter_scan_rows": len(parameter),
        "convergence_rows": len(convergence),
        "accuracy_rule": "8*FLT_EPSILON*max(1,abs(reference)); input magnitude does not relax sin(x) accuracy",
        "raw_parameter_scan": method_summary(0),
        "range_reduced_parameter_scan": method_summary(1),
        "raw_convergence": convergence_summary(0),
        "range_reduced_convergence": convergence_summary(1),
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
    raw_conv = summary["raw_convergence"]
    reduced_conv = summary["range_reduced_convergence"]
    report_md.write_text(
        "# BetterBoard Bench 03 — Embedded Numerical Reliability\n\n"
        f"Rows analyzed: **{summary['rows']}**\n\n"
        "## Embedded arithmetic environment\n\n"
        f"- float bytes: {summary['observed_float_bytes']}\n"
        f"- double bytes: {summary['observed_double_bytes']}\n"
        f"- float epsilon: {summary['observed_float_epsilon']}\n"
        f"- reference backend(s): {summary['reference_backends']}\n"
        f"- accuracy rule: {summary['accuracy_rule']}\n\n"
        "## Parameter-scan summary\n\n"
        f"- Raw Taylor: max total error {raw.get('maximum_absolute_error')}, max reduction contribution {raw.get('maximum_argument_reduction_output_error')}, max recurrence contribution {raw.get('maximum_taylor_recurrence_error')}, reliability {raw.get('reliability_rate')}\n"
        f"- Range-reduced Taylor: max total error {reduced.get('maximum_absolute_error')}, max reduction contribution {reduced.get('maximum_argument_reduction_output_error')}, max recurrence contribution {reduced.get('maximum_taylor_recurrence_error')}, reliability {reduced.get('reliability_rate')}\n\n"
        "## Fixed-term convergence\n\n"
        f"- Raw Taylor first reliable term limit: {raw_conv.get('first_reliable_term_limit')}; best term limit: {raw_conv.get('best_term_limit')}\n"
        f"- Range-reduced Taylor first reliable term limit: {reduced_conv.get('first_reliable_term_limit')}; best term limit: {reduced_conv.get('best_term_limit')}\n\n"
        "## Error-source attribution\n\n"
        "For every row, the analyzer independently evaluates sin(original x) and sin(the MCU-reported reduced argument). This separates the contribution of argument reduction from the Taylor recurrence. The reduced argument is serialized with enough significant decimal digits to round-trip the binary32 value used by the MCU.\n\n"
        "## Scientific boundary\n\n"
        "The MCU result is real embedded arithmetic evidence. The host oracle is independent of the MCU calculation, and the backend is recorded. Reliability here is numerical reliability, not hardware calibration or physical-sensor accuracy.\n",
        encoding="utf-8",
    )

    print(f"Bench 03 analysis complete: {output_dir}")
    print(json.dumps(json_safe(summary), indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
