#!/usr/bin/env python3
"""Deterministic self-checks for BetterBoard Numerical Error Program Depth 1."""
from __future__ import annotations

import importlib.util
import math
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"


def load(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise AssertionError(f"Could not load {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def check_bench02() -> None:
    b2 = load("betterboard_bench02", SCRIPTS / "bench02_numerical_error.py")
    times = [0.0, 0.7, 1.9, 3.2, 5.0, 7.5]
    values = [t * t for t in times]
    derivative = b2.nonuniform_three_point_derivative(times, values)
    errors = [abs(derivative[i] - 2.0 * times[i]) for i in range(1, len(times) - 1)]
    assert max(errors) < 1e-11, errors

    result = b2.analyze(times, values, (1, 2), None)
    assert result["derivative"]["method"] == "nonuniform_quadratic_three_point"
    fp = result["floating_point_accumulation"]
    assert math.isfinite(fp["trapezoid_float32_naive"])
    assert math.isfinite(fp["trapezoid_float32_kahan"])
    assert "jitter_p95_abs_s" in result["timing"]


def check_microbenches() -> None:
    micro = load("betterboard_microbench", SCRIPTS / "numerical_microbench_analyzer.py")
    ref, _ = micro.reference_cos(micro.f32(1.0), 50)
    assert abs(ref - math.cos(1.0)) < 1e-14

    derivative_rows = [{
        "h": "0.00000001", "forward": "0", "central": "0", "mcu_cos": "0.54030228",
        "abs_err_forward": "0.5", "abs_err_central": "0.5",
    }]
    _, derivative_summary = micro.analyze_derivative(
        derivative_rows,
        {"recipe_parameters": {"x_value": "1.0"}},
        50,
    )
    assert derivative_summary["collapse_row_count"] >= 1

    cancellation_rows = [{
        "x": "0.00000005", "raw": "0", "stable": "0.000000025",
        "abs_difference": "0.000000025", "relative_difference": "1", "raw_zero": "1",
    }]
    analyzed, _ = micro.analyze_cancellation(cancellation_rows, 50)
    assert analyzed[0]["raw_failed_to_resolve"] == 1
    assert analyzed[0]["stable_abs_error_host"] < analyzed[0]["raw_abs_error_host"]

    accumulation_rows = [
        {"count": "100", "increment": "0.001", "naive": "0.10000002", "kahan": "0.1", "target_float": "0.1", "naive_error": "0", "kahan_error": "0", "naive_us": "10", "kahan_us": "20"},
        {"count": "1000", "increment": "0.001", "naive": "0.9999907", "kahan": "1.0", "target_float": "1.0", "naive_error": "0", "kahan_error": "0", "naive_us": "100", "kahan_us": "200"},
    ]
    analyzed_acc, summary_acc = micro.analyze_accumulation(accumulation_rows)
    assert len(analyzed_acc) == 2
    assert summary_acc["final_count"] == 1000
    assert analyzed_acc[-1]["kahan_abs_error_host"] < analyzed_acc[-1]["naive_abs_error_host"]


def check_bench03() -> None:
    b3 = load("betterboard_bench03", SCRIPTS / "bench03_embedded_numerical.py")
    x = b3.f32(1.0)
    bits = struct.unpack("<I", struct.pack("<f", x))[0]
    row = {
        "study_code": "1", "method_code": "1", "x_bits": str(bits), "x": "1.00000000e+00",
        "term_limit": "120", "reduced_x": "1.00000000e+00", "terms_used": "8",
        "last_term": "1e-9", "cancellation_ratio": "1.2", "stop_rule": "1", "finite": "1",
        "elapsed_us": "10", "float_bytes": "4", "double_bytes": "4",
        "float_epsilon": str(2 ** -23), "approximation": format(b3.f32(math.sin(1.0)), ".9g"),
    }
    analyzed = b3.analyze_row(row, 50)
    assert analyzed["accuracy_passed"]
    assert "argument_reduction_output_error" in analyzed
    assert "taylor_recurrence_error" in analyzed

    x80 = b3.f32(80.0)
    bits80 = struct.unpack("<I", struct.pack("<f", x80))[0]
    row80 = dict(row)
    row80["x_bits"] = str(bits80)
    row80["x"] = "8.00000000e+01"
    row80["reduced_x"] = format(b3.f32(float(b3.decimal_reduce_sine_argument_exact_binary32(x80, 50))), ".9g")
    row80["approximation"] = "0.0"
    bad = b3.analyze_row(row80, 50)
    assert bad["allowed_absolute_error"] < 1e-5
    assert not bad["accuracy_passed"]


def check_firmware_depth_markers() -> None:
    firmware = ROOT / "src-tauri" / "resources" / "firmware"
    derivative = (firmware / "NumericalDerivativeSweep" / "NumericalDerivativeSweep.ino").read_text(encoding="utf-8")
    cancellation = (firmware / "NumericalCancellation" / "NumericalCancellation.ino").read_text(encoding="utf-8")
    accumulation = (firmware / "NumericalAccumulation" / "NumericalAccumulation.ino").read_text(encoding="utf-8")
    assert "1e-8f" in derivative
    assert "emitCase(-magnitudes[i])" in cancellation and "emitCase(magnitudes[i - 1])" in cancellation
    assert "emitCheckpoint" in accumulation and "50000UL" in accumulation


def main() -> int:
    check_bench02()
    check_microbenches()
    check_bench03()
    check_firmware_depth_markers()
    print("BetterBoard numerical depth self-check: PASS")
    print("- non-uniform derivative formula verified on uneven quadratic samples")
    print("- independent microbench host oracles verified")
    print("- float32 collapse / cancellation / accumulation diagnostics verified")
    print("- Bench 03 bounded-output tolerance + error attribution verified")
    print("- deeper firmware campaign markers verified")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
