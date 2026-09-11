#!/usr/bin/env python3
"""Analyze BetterBoard ESP32IrregularDtNumerics captures.

Current firmware emits:
IRREG,run_id,index,mode,period_us,freq_hz,t_us,dt_prev_us,y,d_const,d_measured,i_const,i_measured

Legacy untagged rows from schema v2 are also accepted. The host computes an independent
analytic reference for y(t)=sin(2*pi*f*t), its derivative, and the definite integral from
the first timestamp in each run.
"""

from __future__ import annotations

import argparse
import csv
import json
import math
from collections import defaultdict
from pathlib import Path
from statistics import mean

COLUMNS = [
    "run_id", "index", "mode", "period_us", "freq_hz", "t_us", "dt_prev_us",
    "y", "d_const", "d_measured", "i_const", "i_measured",
]


def finite(v: float) -> bool:
    return math.isfinite(v)


def rmse(errors: list[float]) -> float:
    vals = [e for e in errors if finite(e)]
    if not vals:
        return float("nan")
    return math.sqrt(sum(e * e for e in vals) / len(vals))


def parse_capture(path: Path) -> list[dict]:
    rows: list[dict] = []
    for raw in path.read_text(errors="replace").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        parts = [p.strip() for p in line.split(",")]
        if parts and parts[0].upper() == "IRREG":
            parts = parts[1:]
        if len(parts) != len(COLUMNS):
            continue
        try:
            row = dict(zip(COLUMNS, parts))
            row["run_id"] = int(row["run_id"])
            row["index"] = int(row["index"])
            row["period_us"] = int(row["period_us"])
            row["freq_hz"] = float(row["freq_hz"])
            row["t_us"] = int(row["t_us"])
            row["dt_prev_us"] = int(row["dt_prev_us"])
            for key in ("y", "d_const", "d_measured", "i_const", "i_measured"):
                row[key] = float(row[key])
            rows.append(row)
        except ValueError:
            continue
    return rows


def analyze_run(rows: list[dict]) -> tuple[dict, list[dict]]:
    rows = sorted(rows, key=lambda r: r["index"])
    first = rows[0]
    f = first["freq_hz"]
    omega = 2.0 * math.pi * f
    t0 = first["t_us"] * 1e-6

    dt_errors = []
    d_const_errors = []
    d_measured_errors = []
    i_const_errors = []
    i_measured_errors = []
    enriched = []

    for r in rows:
        t = r["t_us"] * 1e-6
        y_ref = math.sin(omega * t)
        d_ref = omega * math.cos(omega * t)
        i_ref = (math.cos(omega * t0) - math.cos(omega * t)) / omega

        if r["index"] > 0:
            dt_errors.append(r["dt_prev_us"] - r["period_us"])
        if finite(r["d_const"]):
            d_const_errors.append(r["d_const"] - d_ref)
        if finite(r["d_measured"]):
            d_measured_errors.append(r["d_measured"] - d_ref)
        if finite(r["i_const"]):
            i_const_errors.append(r["i_const"] - i_ref)
        if finite(r["i_measured"]):
            i_measured_errors.append(r["i_measured"] - i_ref)

        e = dict(r)
        e.update(
            y_reference=y_ref,
            y_abs_error=abs(r["y"] - y_ref),
            derivative_reference=d_ref,
            d_const_abs_error=abs(r["d_const"] - d_ref) if finite(r["d_const"]) else float("nan"),
            d_measured_abs_error=abs(r["d_measured"] - d_ref) if finite(r["d_measured"]) else float("nan"),
            integral_reference=i_ref,
            i_const_abs_error=abs(r["i_const"] - i_ref) if finite(r["i_const"]) else float("nan"),
            i_measured_abs_error=abs(r["i_measured"] - i_ref) if finite(r["i_measured"]) else float("nan"),
        )
        enriched.append(e)

    d_const_rmse = rmse(d_const_errors)
    d_measured_rmse = rmse(d_measured_errors)
    i_const_rmse = rmse(i_const_errors)
    i_measured_rmse = rmse(i_measured_errors)
    dt_rmse_us = rmse([float(v) for v in dt_errors])

    summary = {
        "run_id": first["run_id"],
        "mode": first["mode"],
        "period_us": first["period_us"],
        "freq_hz": f,
        "samples": len(rows),
        "mean_dt_us": mean([r["dt_prev_us"] for r in rows[1:]]) if len(rows) > 1 else None,
        "dt_error_rmse_us": dt_rmse_us,
        "dt_error_max_abs_us": max((abs(v) for v in dt_errors), default=None),
        "derivative_const_rmse": d_const_rmse,
        "derivative_measured_rmse": d_measured_rmse,
        "derivative_measured_gain": (d_const_rmse / d_measured_rmse) if finite(d_const_rmse) and finite(d_measured_rmse) and d_measured_rmse > 0 else None,
        "integral_const_rmse": i_const_rmse,
        "integral_measured_rmse": i_measured_rmse,
        "integral_measured_gain": (i_const_rmse / i_measured_rmse) if finite(i_const_rmse) and finite(i_measured_rmse) and i_measured_rmse > 0 else None,
    }
    return summary, enriched


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("capture", type=Path)
    ap.add_argument("--out", type=Path, default=Path("esp32_irregular_dt_analysis"))
    args = ap.parse_args()

    rows = parse_capture(args.capture)
    if not rows:
        raise SystemExit("No valid ESP32 irregular-dt rows found.")

    grouped: dict[int, list[dict]] = defaultdict(list)
    for row in rows:
        grouped[row["run_id"]].append(row)

    summaries = []
    enriched_all = []
    for run_id in sorted(grouped):
        summary, enriched = analyze_run(grouped[run_id])
        summaries.append(summary)
        enriched_all.extend(enriched)

    args.out.mkdir(parents=True, exist_ok=True)
    with (args.out / "esp32_irregular_dt_rows.csv").open("w", newline="") as f:
        fieldnames = list(enriched_all[0].keys())
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        w.writerows(enriched_all)

    (args.out / "esp32_irregular_dt_summary.json").write_text(
        json.dumps({
            "schema": "betterboard-esp32-irregular-dt-analysis-v2",
            "runs": summaries,
            "scientific_boundary": [
                "esp_timer timestamps are runtime evidence rather than an external calibrated time reference.",
                "Synthetic sine provides an analytic host reference for this numerical study.",
                "IDLE/LOAD/WIFI comparisons apply to the tested board, firmware, and environment."
            ],
        }, indent=2, allow_nan=True)
    )

    print(json.dumps(summaries, indent=2, allow_nan=True))


if __name__ == "__main__":
    main()
