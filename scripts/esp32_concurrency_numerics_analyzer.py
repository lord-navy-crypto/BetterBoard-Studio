#!/usr/bin/env python3
"""Analyze BetterBoard ESP32 Concurrency Numerics captures.

Research-stage analyzer. It does not treat MCU library output as ground truth.
It derives deterministic references where possible and reports deltas caused by
summation grouping, task partitioning, and timing load.
"""

from __future__ import annotations

import argparse
import csv
import json
import math
from decimal import Decimal, getcontext
from pathlib import Path
from statistics import mean

getcontext().prec = 80


def parse_rows(path: Path):
    rows = []
    with path.open("r", encoding="utf-8", errors="replace") as f:
        for raw in f:
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            parts = [p.strip() for p in line.split(",")]
            rows.append(parts)
    return rows


def decimal_reference(n: int, inc: str = "0.0001") -> Decimal:
    return Decimal(n) * Decimal(inc)


def classify(parts):
    # REDUCE has 10 fields, AFFINITY 9 fields, JITTER 9 fields.
    if len(parts) == 10:
        return "reduce"
    if len(parts) == 9:
        # AFFINITY field 2 is n and field 3 is chip_cores; JITTER field 4 is mode 0/1.
        try:
            mode = int(parts[3])
            if mode in (0, 1):
                return "jitter"
        except ValueError:
            pass
        return "affinity"
    return "unknown"


def analyze(path: Path):
    raw_rows = parse_rows(path)
    out_rows = []
    summary = {
        "schema": "betterboard-esp32-concurrency-analysis-v1",
        "source": str(path),
        "reduce_runs": 0,
        "affinity_runs": 0,
        "jitter_runs": 0,
        "unknown_rows": 0,
    }

    jitter_groups = {"baseline": [], "load": []}

    for parts in raw_rows:
        kind = classify(parts)
        if kind == "reduce":
            run_id, n = int(parts[0]), int(parts[1])
            sf, gf = float(parts[2]), float(parts[3])
            sd, gd = float(parts[4]), float(parts[5])
            seq_us, grouped_us = int(parts[6]), int(parts[7])
            ref = decimal_reference(n)
            ref_f = float(ref)
            row = {
                "kind": kind,
                "run_id": run_id,
                "n": n,
                "reference_decimal": str(ref),
                "seq_float32": sf,
                "grouped_float32": gf,
                "seq_float64": sd,
                "grouped_float64": gd,
                "seq_float32_abs_error": abs(sf - ref_f),
                "grouped_float32_abs_error": abs(gf - ref_f),
                "seq_float64_abs_error": abs(sd - ref_f),
                "grouped_float64_abs_error": abs(gd - ref_f),
                "float32_grouping_delta": gf - sf,
                "float64_grouping_delta": gd - sd,
                "seq_us": seq_us,
                "grouped_us": grouped_us,
                "grouped_over_seq_time": grouped_us / seq_us if seq_us else None,
            }
            out_rows.append(row)
            summary["reduce_runs"] += 1

        elif kind == "affinity":
            run_id, n = int(parts[0]), int(parts[1])
            cores = int(parts[2])
            core0, core1 = int(parts[3]), int(parts[4])
            s0, s1, combined = float(parts[5]), float(parts[6]), float(parts[7])
            elapsed = int(parts[8])
            ref = decimal_reference(n)
            ref_f = float(ref)
            out_rows.append({
                "kind": kind,
                "run_id": run_id,
                "n": n,
                "chip_cores": cores,
                "task0_core": core0,
                "task1_core": core1,
                "task0_sum": s0,
                "task1_sum": s1,
                "combined_sum": combined,
                "reference_decimal": str(ref),
                "combined_abs_error": abs(combined - ref_f),
                "elapsed_us": elapsed,
                "true_cross_core": bool(cores > 1 and core0 != core1),
            })
            summary["affinity_runs"] += 1

        elif kind == "jitter":
            run_id = int(parts[0])
            period_us = int(parts[1])
            samples = int(parts[2])
            mode = int(parts[3])
            min_late = int(parts[4])
            max_late = int(parts[5])
            mean_late = float(parts[6])
            rms_late = float(parts[7])
            misses = int(parts[8])
            miss_rate = misses / samples if samples else None
            normalized_rms = rms_late / period_us if period_us else None
            label = "load" if mode else "baseline"
            jitter_groups[label].append((period_us, rms_late, miss_rate))
            out_rows.append({
                "kind": kind,
                "run_id": run_id,
                "period_us": period_us,
                "samples": samples,
                "mode": label,
                "min_late_us": min_late,
                "max_late_us": max_late,
                "mean_late_us": mean_late,
                "rms_late_us": rms_late,
                "normalized_rms": normalized_rms,
                "deadline_misses": misses,
                "deadline_miss_rate": miss_rate,
            })
            summary["jitter_runs"] += 1
        else:
            summary["unknown_rows"] += 1

    for label, values in jitter_groups.items():
        if values:
            summary[f"{label}_mean_normalized_rms"] = mean(v[1] / v[0] for v in values if v[0])
            summary[f"{label}_mean_miss_rate"] = mean(v[2] for v in values if v[2] is not None)

    if jitter_groups["baseline"] and jitter_groups["load"]:
        by_period_base = {p: (r, m) for p, r, m in jitter_groups["baseline"]}
        ratios = []
        for p, r, _m in jitter_groups["load"]:
            if p in by_period_base and by_period_base[p][0] != 0:
                ratios.append(r / by_period_base[p][0])
        if ratios:
            summary["mean_load_to_baseline_rms_ratio"] = mean(ratios)

    return out_rows, summary


def write_csv(path: Path, rows):
    if not rows:
        path.write_text("", encoding="utf-8")
        return
    keys = []
    seen = set()
    for row in rows:
        for key in row:
            if key not in seen:
                seen.add(key)
                keys.append(key)
    with path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=keys)
        w.writeheader()
        w.writerows(rows)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("capture", type=Path)
    ap.add_argument("--out", type=Path, default=Path("esp32_concurrency_analysis"))
    args = ap.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    rows, summary = analyze(args.capture)
    write_csv(args.out / "rows.csv", rows)
    (args.out / "summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
