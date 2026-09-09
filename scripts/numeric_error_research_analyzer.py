#!/usr/bin/env python3
"""BetterBoard focused Numeric Error Research analyzer.

Standard-library-only host analysis for the focused firmware experiments on the
numeric-error-research-pack branch. The script intentionally keeps embedded
measurements and host-side interpretation separate.
"""
from __future__ import annotations

import argparse
import csv
import json
import math
import statistics
from pathlib import Path
from typing import Callable


def fmean(xs: list[float]) -> float | None:
    return statistics.fmean(xs) if xs else None


def pstdev(xs: list[float]) -> float | None:
    return statistics.pstdev(xs) if len(xs) >= 2 else (0.0 if xs else None)


def rms(xs: list[float]) -> float | None:
    return math.sqrt(statistics.fmean(x * x for x in xs)) if xs else None


def numeric_rows(path: Path) -> tuple[list[str], list[dict[str, float]]]:
    with path.open(newline="") as handle:
        reader = csv.DictReader(handle)
        fields = reader.fieldnames or []
        rows: list[dict[str, float]] = []
        for row in reader:
            parsed: dict[str, float] = {}
            ok = True
            for key in fields:
                try:
                    value = float(row[key])
                except (TypeError, ValueError, KeyError):
                    ok = False
                    break
                if not math.isfinite(value):
                    ok = False
                    break
                parsed[key] = value
            if ok:
                rows.append(parsed)
    if not rows:
        raise ValueError(f"No complete numeric rows in {path}")
    return fields, rows


def analyze_adc(rows: list[dict[str, float]]) -> dict:
    p2p = [r["peak_to_peak_adc"] for r in rows]
    std = [r["stddev_adc"] for r in rows]
    return {
        "experiment": "adc_stability",
        "windows": len(rows),
        "mean_peak_to_peak_adc": fmean(p2p),
        "max_peak_to_peak_adc": max(p2p),
        "mean_window_stddev_adc": fmean(std),
        "max_window_stddev_adc": max(std),
        "interpretation": "Descriptive acquisition-chain stability only; no universal pass/fail threshold is asserted.",
    }


def analyze_quantization(rows: list[dict[str, float]]) -> dict:
    result: dict[str, object] = {
        "experiment": "requantization",
        "samples": len(rows),
        "native_adc_levels": 1024,
        "representations": {},
    }
    reps: dict[str, object] = {}
    for bits in (8, 6, 4):
        errors = [r[f"error{bits}_counts"] for r in rows]
        step = 1023.0 / ((1 << bits) - 1)
        reps[str(bits)] = {
            "levels": 1 << bits,
            "reconstruction_step_counts": step,
            "theoretical_half_step_bound_counts": 0.5 * step,
            "mean_signed_error_counts": fmean(errors),
            "mean_absolute_error_counts": fmean([abs(x) for x in errors]),
            "rms_error_counts": rms(errors),
            "max_absolute_error_counts": max(abs(x) for x in errors),
        }
    result["representations"] = reps
    return result


def analyze_filter(rows: list[dict[str, float]]) -> dict:
    raw = [r["voltage_v"] for r in rows]
    fast = [r["ema_fast_v"] for r in rows]
    slow = [r["ema_slow_v"] for r in rows]
    fast_res = [a - b for a, b in zip(fast, raw)]
    slow_res = [a - b for a, b in zip(slow, raw)]
    return {
        "experiment": "filter_lag",
        "samples": len(rows),
        "raw_std_v": pstdev(raw),
        "fast_ema_std_v": pstdev(fast),
        "slow_ema_std_v": pstdev(slow),
        "fast_tracking_residual_rms_v": rms(fast_res),
        "slow_tracking_residual_rms_v": rms(slow_res),
        "fast_max_abs_residual_v": max(abs(x) for x in fast_res),
        "slow_max_abs_residual_v": max(abs(x) for x in slow_res),
        "interpretation": "Residual mixes desired smoothing and dynamic lag; segment steady and moving intervals for a controlled tradeoff study.",
    }


def analyze_derivative(rows: list[dict[str, float]]) -> dict:
    forward = [(r["h"], r["abs_error_forward"]) for r in rows]
    central = [(r["h"], r["abs_error_central"]) for r in rows]
    best_f = min(forward, key=lambda x: x[1])
    best_c = min(central, key=lambda x: x[1])
    return {
        "experiment": "finite_difference",
        "samples": len(rows),
        "best_forward": {"h": best_f[0], "embedded_reference_error": best_f[1]},
        "best_central": {"h": best_c[0], "embedded_reference_error": best_c[1]},
        "reference_boundary": "Firmware currently compares against MCU libm cosf(1); use an independent high-precision host oracle before calling this absolute accuracy.",
    }


def observed_orders(ns: list[float], errors: list[float]) -> list[dict[str, float | None]]:
    out: list[dict[str, float | None]] = []
    for n1, n2, e1, e2 in zip(ns, ns[1:], errors, errors[1:]):
        p: float | None = None
        if n2 > n1 > 0 and e1 > 0 and e2 > 0:
            p = math.log(e1 / e2) / math.log(n2 / n1)
        out.append({"n_from": n1, "n_to": n2, "observed_order": p})
    return out


def analyze_integration(rows: list[dict[str, float]]) -> dict:
    ns = [r["n"] for r in rows]
    result: dict[str, object] = {"experiment": "integration_convergence", "samples": len(rows), "methods": {}}
    methods: dict[str, object] = {}
    for name, error_col in (("left", "error_left"), ("trapezoid", "error_trapezoid"), ("simpson", "error_simpson")):
        errs = [r[error_col] for r in rows]
        methods[name] = {
            "best_n": ns[min(range(len(errs)), key=errs.__getitem__)],
            "minimum_absolute_error": min(errs),
            "observed_orders": observed_orders(ns, errs),
        }
    result["methods"] = methods
    return result


def analyze_summation(rows: list[dict[str, float]]) -> dict:
    out = []
    for r in rows:
        naive = r["abs_error_naive"]
        kahan = r["abs_error_kahan"]
        improvement = None if kahan == 0 else naive / kahan
        out.append({
            "n": r["n"],
            "naive_error": naive,
            "kahan_error": kahan,
            "naive_to_kahan_error_ratio": improvement,
        })
    return {
        "experiment": "floating_point_summation",
        "rows": out,
        "reference_boundary": "Firmware reference is computed in MCU float; a rational/high-precision host reference is preferred for absolute-error claims.",
    }


def analyze_pwm(rows: list[dict[str, float]]) -> dict:
    errors = [r["error_counts"] for r in rows]
    step = 1023.0 / 255.0
    return {
        "experiment": "pwm_quantization",
        "samples": len(rows),
        "pwm_levels": 256,
        "reconstruction_step_counts": step,
        "theoretical_half_step_bound_counts": 0.5 * step,
        "mean_signed_error_counts": fmean(errors),
        "rms_error_counts": rms(errors),
        "max_absolute_error_counts": max(abs(x) for x in errors),
    }


def analyze_photogate(rows: list[dict[str, float]]) -> dict:
    periods = [r["period_us"] for r in rows if r["period_us"] > 0]
    freqs = [r["frequency_hz"] for r in rows if r["frequency_hz"] > 0]
    rejected = [r.get("rejected_since_last", 0.0) for r in rows]
    return {
        "experiment": "photogate_timing",
        "accepted_periods": len(periods),
        "mean_period_us": fmean(periods),
        "period_std_us": pstdev(periods),
        "period_cv": (pstdev(periods) / fmean(periods)) if periods and fmean(periods) else None,
        "mean_frequency_hz": fmean(freqs),
        "rejected_close_edges": sum(rejected),
        "boundary": "Timestamp repeatability is not complete physical timing accuracy; sensor threshold and geometry remain part of the experiment.",
    }


def choose(fields: list[str]) -> Callable[[list[dict[str, float]]], dict]:
    fs = set(fields)
    signatures: list[tuple[set[str], Callable[[list[dict[str, float]]], dict]]] = [
        ({"peak_to_peak_adc", "stddev_adc"}, analyze_adc),
        ({"error8_counts", "error6_counts", "error4_counts"}, analyze_quantization),
        ({"ema_fast_v", "ema_slow_v", "voltage_v"}, analyze_filter),
        ({"h", "abs_error_forward", "abs_error_central"}, analyze_derivative),
        ({"n", "error_left", "error_trapezoid", "error_simpson"}, analyze_integration),
        ({"n", "abs_error_naive", "abs_error_kahan"}, analyze_summation),
        ({"pwm8", "reconstructed10", "error_counts"}, analyze_pwm),
        ({"period_us", "frequency_hz"}, analyze_photogate),
    ]
    for required, fn in signatures:
        if required <= fs:
            return fn
    raise ValueError(f"Unrecognized Numeric Error CSV schema: {fields}")


def write_markdown(path: Path, result: dict) -> None:
    lines = [
        "# BetterBoard Numeric Error Research Report",
        "",
        f"Experiment: **{result.get('experiment', 'unknown')}**",
        "",
        "```json",
        json.dumps(result, indent=2, sort_keys=True),
        "```",
        "",
        "> This report separates measured/embedded evidence from claims of physical ground truth. Read any `boundary` or `reference_boundary` field before interpreting an error as absolute accuracy.",
        "",
    ]
    path.write_text("\n".join(lines))


def main() -> int:
    parser = argparse.ArgumentParser(description="Analyze one BetterBoard focused Numeric Error CSV.")
    parser.add_argument("csv", type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()

    csv_path = args.csv.expanduser().resolve()
    fields, rows = numeric_rows(csv_path)
    result = choose(fields)(rows)
    result["schema"] = "betterboard.numeric-error-research/0.1"
    result["source"] = str(csv_path)

    output = (args.output or csv_path.parent / "numeric-error-research-analysis").expanduser().resolve()
    output.mkdir(parents=True, exist_ok=True)
    json_path = output / "summary.json"
    md_path = output / "report.md"
    json_path.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n")
    write_markdown(md_path, result)

    print(json_path)
    print(md_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
