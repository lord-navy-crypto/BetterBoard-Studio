#!/usr/bin/env python3
"""Condition-aware comparison for BetterBoard ESP32 research captures.

This analyzer is intentionally host-side. It groups runs only when their experimental
parameters match, then compares IDLE/baseline against CPU-load and Wi-Fi conditions.
It does not treat cross-configuration ratios as meaningful evidence.

Supported evidence:
- Numerical/Concurrency JITTER rows (baseline/load)
- WIFIJITTER rows
- IRREG rows (IDLE/LOAD/WIFI), using the existing analytic host analyzer

Usage:
  python3 scripts/esp32_condition_compare.py capture1.txt capture2.txt ... --out out/conditions
"""
from __future__ import annotations

import argparse
import json
import math
from collections import defaultdict
from pathlib import Path
from statistics import mean

import esp32_irregular_dt_analyzer as irregular


def safe_ratio(value: float | None, baseline: float | None) -> float | None:
    if value is None or baseline is None or baseline == 0:
        return None
    if not math.isfinite(value) or not math.isfinite(baseline):
        return None
    return value / baseline


def parse_jitter_line(parts: list[str], source: str) -> dict | None:
    kind = parts[0].upper()
    try:
        if kind == "WIFIJITTER" and len(parts) == 10:
            return {
                "family": "jitter",
                "condition": "WIFI",
                "period_us": int(parts[2]),
                "samples": int(parts[3]),
                "rms_us": float(parts[7]),
                "misses": int(parts[8]),
                "source": source,
            }
        if kind != "JITTER":
            return None

        payload = parts[1:]
        # Numerical suite schema:
        # run_id,mode,period_us,samples,min,max,mean,rms,misses,load_iterations
        if len(payload) == 10:
            mode = int(payload[1])
            return {
                "family": "jitter",
                "condition": "LOAD" if mode else "IDLE",
                "period_us": int(payload[2]),
                "samples": int(payload[3]),
                "rms_us": float(payload[7]),
                "misses": int(payload[8]),
                "source": source,
            }

        # Concurrency schema:
        # run_id,period_us,samples,mode,min,max,mean,rms,misses
        if len(payload) == 9:
            mode = int(payload[3])
            return {
                "family": "jitter",
                "condition": "LOAD" if mode else "IDLE",
                "period_us": int(payload[1]),
                "samples": int(payload[2]),
                "rms_us": float(payload[7]),
                "misses": int(payload[8]),
                "source": source,
            }
    except (ValueError, IndexError):
        return None
    return None


def parse_jitter_files(paths: list[Path]) -> list[dict]:
    rows: list[dict] = []
    for path in paths:
        for raw in path.read_text(encoding="utf-8", errors="replace").splitlines():
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            row = parse_jitter_line([part.strip() for part in line.split(",")], str(path))
            if row:
                rows.append(row)
    return rows


def parse_irregular_files(paths: list[Path]) -> list[dict]:
    summaries: list[dict] = []
    for path in paths:
        rows = irregular.parse_capture(path)
        grouped: dict[int, list[dict]] = defaultdict(list)
        for row in rows:
            grouped[row["run_id"]].append(row)
        for run_id in sorted(grouped):
            summary, _ = irregular.analyze_run(grouped[run_id])
            summary = dict(summary)
            summary["family"] = "irregular_dt"
            summary["source"] = str(path)
            summaries.append(summary)
    return summaries


def compare_jitter(rows: list[dict]) -> list[dict]:
    grouped: dict[tuple[int, int], dict[str, list[dict]]] = defaultdict(lambda: defaultdict(list))
    for row in rows:
        grouped[(row["period_us"], row["samples"])][row["condition"]].append(row)

    out: list[dict] = []
    for (period_us, samples), conditions in sorted(grouped.items()):
        idle = conditions.get("IDLE", [])
        if not idle:
            continue
        idle_rms = mean(row["rms_us"] for row in idle)
        idle_miss_rate = mean(row["misses"] / row["samples"] for row in idle if row["samples"])
        for condition in ("LOAD", "WIFI"):
            candidates = conditions.get(condition, [])
            if not candidates:
                continue
            rms = mean(row["rms_us"] for row in candidates)
            miss_rate = mean(row["misses"] / row["samples"] for row in candidates if row["samples"])
            out.append({
                "family": "jitter",
                "period_us": period_us,
                "samples": samples,
                "condition": condition,
                "idle_runs": len(idle),
                "condition_runs": len(candidates),
                "idle_rms_us": idle_rms,
                "condition_rms_us": rms,
                "rms_ratio_vs_idle": safe_ratio(rms, idle_rms),
                "idle_deadline_miss_rate": idle_miss_rate,
                "condition_deadline_miss_rate": miss_rate,
                "miss_rate_delta": miss_rate - idle_miss_rate,
            })
    return out


def compare_irregular(rows: list[dict]) -> list[dict]:
    grouped: dict[tuple[int, float], dict[str, list[dict]]] = defaultdict(lambda: defaultdict(list))
    for row in rows:
        grouped[(int(row["period_us"]), float(row["freq_hz"]))][str(row["mode"]).upper()].append(row)

    out: list[dict] = []
    for (period_us, freq_hz), conditions in sorted(grouped.items()):
        idle = conditions.get("IDLE", [])
        if not idle:
            continue

        def avg(field: str, source: list[dict]) -> float | None:
            vals = [float(row[field]) for row in source if row.get(field) is not None and math.isfinite(float(row[field]))]
            return mean(vals) if vals else None

        idle_dt = avg("dt_error_rmse_us", idle)
        idle_derivative = avg("derivative_measured_rmse", idle)
        idle_integral = avg("integral_measured_rmse", idle)
        idle_d_gain = avg("derivative_measured_gain", idle)
        idle_i_gain = avg("integral_measured_gain", idle)

        for condition in ("LOAD", "WIFI"):
            candidates = conditions.get(condition, [])
            if not candidates:
                continue
            dt = avg("dt_error_rmse_us", candidates)
            derivative = avg("derivative_measured_rmse", candidates)
            integral = avg("integral_measured_rmse", candidates)
            d_gain = avg("derivative_measured_gain", candidates)
            i_gain = avg("integral_measured_gain", candidates)
            out.append({
                "family": "irregular_dt",
                "period_us": period_us,
                "freq_hz": freq_hz,
                "condition": condition,
                "idle_runs": len(idle),
                "condition_runs": len(candidates),
                "idle_dt_error_rmse_us": idle_dt,
                "condition_dt_error_rmse_us": dt,
                "dt_rmse_ratio_vs_idle": safe_ratio(dt, idle_dt),
                "idle_derivative_measured_rmse": idle_derivative,
                "condition_derivative_measured_rmse": derivative,
                "derivative_rmse_ratio_vs_idle": safe_ratio(derivative, idle_derivative),
                "idle_integral_measured_rmse": idle_integral,
                "condition_integral_measured_rmse": integral,
                "integral_rmse_ratio_vs_idle": safe_ratio(integral, idle_integral),
                "idle_derivative_measured_gain": idle_d_gain,
                "condition_derivative_measured_gain": d_gain,
                "idle_integral_measured_gain": idle_i_gain,
                "condition_integral_measured_gain": i_gain,
            })
    return out


def build_report(paths: list[Path]) -> dict:
    jitter_rows = parse_jitter_files(paths)
    irregular_rows = parse_irregular_files(paths)
    jitter_comparisons = compare_jitter(jitter_rows)
    irregular_comparisons = compare_irregular(irregular_rows)
    return {
        "schema": "betterboard-esp32-condition-compare-v1",
        "inputs": [str(path) for path in paths],
        "jitter_runs": len(jitter_rows),
        "irregular_runs": len(irregular_rows),
        "jitter_comparisons": jitter_comparisons,
        "irregular_dt_comparisons": irregular_comparisons,
        "scientific_boundary": [
            "Ratios are emitted only when experimental parameters match.",
            "IDLE is a runtime baseline, not an external calibrated reference.",
            "LOAD and WIFI effects are board/build/environment specific.",
            "IRREG derivative/integral errors use the synthetic sine analytic host reference.",
        ],
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("captures", nargs="+", type=Path)
    parser.add_argument("--out", type=Path, default=Path("esp32_condition_comparison"))
    args = parser.parse_args()

    report = build_report(args.captures)
    args.out.mkdir(parents=True, exist_ok=True)
    output = args.out / "condition_comparison.json"
    output.write_text(json.dumps(report, indent=2, allow_nan=False), encoding="utf-8")
    print(json.dumps(report, indent=2, allow_nan=False))


if __name__ == "__main__":
    main()
