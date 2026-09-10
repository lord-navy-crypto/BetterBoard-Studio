#!/usr/bin/env python3
"""Host analyzer for ESP32NumericalResearchSuite.

Research-stage only. It parses captured serial text, computes independent host references,
and produces machine-readable evidence without treating MCU libm output as ground truth.

Usage:
  python3 scripts/esp32_numerical_research_analyzer.py capture.txt --out-dir out/esp32-numerical

Optional:
  pip install mpmath

If mpmath is available it is used for high-precision Taylor/sine references. Otherwise
Python's math.sin is retained as a lower-strength reference and the summary records that.
"""
from __future__ import annotations

import argparse
import csv
import json
import math
from dataclasses import dataclass, asdict
from decimal import Decimal, getcontext
from pathlib import Path
from statistics import mean
from typing import Any, Iterable

try:
    import mpmath as mp  # type: ignore
except Exception:  # pragma: no cover
    mp = None

getcontext().prec = 80


@dataclass
class Record:
    kind: str
    values: dict[str, Any]
    source_line: int


def _f(x: str) -> float:
    return float(x)


def _i(x: str) -> int:
    return int(x)


SCHEMAS: dict[str, tuple[list[str], list[Any]]] = {
    "SUM": (
        ["run_id", "n", "naive_f32", "kahan_f32", "naive_f64", "kahan_f64",
         "elapsed_naive_f32_us", "elapsed_kahan_f32_us", "elapsed_naive_f64_us", "elapsed_kahan_f64_us"],
        [_i, _i, _f, _f, _f, _f, _i, _i, _i, _i],
    ),
    "SERIES": (
        ["run_id", "n", "forward_f32", "reverse_f32", "pairwise_f32", "forward_f64", "reverse_f64", "pairwise_f64"],
        [_i, _i, _f, _f, _f, _f, _f, _f],
    ),
    "TAYLOR": (
        ["run_id", "x", "terms", "raw_f32", "reduced_f32", "raw_f64", "reduced_f64", "sinf_local", "sin_local",
         "raw_f32_us", "reduced_f32_us", "raw_f64_us", "reduced_f64_us"],
        [_i, _f, _i, _f, _f, _f, _f, _f, _f, _i, _i, _i, _i],
    ),
    "JITTER": (
        ["run_id", "mode", "period_us", "samples", "min_error_us", "max_error_us", "mean_error_us", "rms_error_us",
         "deadline_misses", "load_iterations"],
        [_i, _i, _i, _i, _i, _i, _f, _f, _i, _i],
    ),
    "TIMER": (
        ["run_id", "samples", "micros_elapsed_us", "esp_timer_elapsed_us", "micros_read_cost_ns", "esp_timer_read_cost_ns"],
        [_i, _i, _i, _i, _f, _f],
    ),
    "DUALCORE": (
        ["run_id", "n", "cores", "sequential_f32", "grouped_f32", "sequential_f64", "grouped_f64", "sequential_us", "parallel_us"],
        [_i, _i, _i, _f, _f, _f, _f, _i, _i],
    ),
    "PSRAM": (
        ["run_id", "n", "psram_found", "naive_f32", "kahan_f32", "elapsed_naive_us", "elapsed_kahan_us"],
        [_i, _i, _i, _f, _f, _i, _i],
    ),
    "WIFIJITTER": (
        ["run_id", "period_us", "samples", "min_error_us", "max_error_us", "mean_error_us", "rms_error_us", "deadline_misses", "networks_seen"],
        [_i, _i, _i, _i, _i, _f, _f, _i, _i],
    ),
}


def parse_capture(lines: Iterable[str]) -> tuple[list[Record], list[str], dict[str, str]]:
    records: list[Record] = []
    comments: list[str] = []
    metadata: dict[str, str] = {}
    for lineno, raw in enumerate(lines, 1):
        line = raw.strip()
        if not line:
            continue
        if line.startswith("#"):
            comments.append(line)
            if "," in line:
                key, value = line[1:].split(",", 1)
                if key and key not in metadata:
                    metadata[key] = value
            continue
        parts = [p.strip() for p in line.split(",")]
        kind = parts[0]
        if kind not in SCHEMAS:
            continue
        names, casts = SCHEMAS[kind]
        payload = parts[1:]
        if len(payload) != len(names):
            raise ValueError(f"line {lineno}: {kind} expected {len(names)} fields, got {len(payload)}")
        values: dict[str, Any] = {}
        for name, cast, value in zip(names, casts, payload):
            if value.lower() == "nan":
                values[name] = math.nan
            else:
                values[name] = cast(value)
        records.append(Record(kind, values, lineno))
    return records, comments, metadata


def exact_generated_sum(n: int) -> Decimal:
    total = Decimal(0)
    one = Decimal(1)
    million = Decimal(1_000_000)
    for i in range(n):
        sign = Decimal(-1 if i & 1 else 1)
        small = Decimal((i % 97) + 1) / million
        total += sign * (one + small)
    return total


def sine_reference(x: float) -> tuple[float, str]:
    if mp is not None:
        mp.mp.dps = 80
        return float(mp.sin(mp.mpf(str(x)))), "mpmath-80dps"
    return math.sin(x), "python-math-sin"


def absolute_error(value: float, reference: float) -> float:
    return abs(value - reference)


def enrich(record: Record) -> dict[str, Any]:
    row: dict[str, Any] = {"kind": record.kind, "source_line": record.source_line, **record.values}
    v = record.values

    if record.kind in {"SUM", "SERIES", "DUALCORE", "PSRAM"}:
        n = int(v["n"])
        ref_dec = exact_generated_sum(n)
        ref = float(ref_dec)
        row["host_reference_decimal"] = format(ref_dec, "f")
        row["host_reference_float"] = ref
        for key in [k for k in v if any(tag in k for tag in ("f32", "f64")) and not k.endswith("_us")]:
            value = float(v[key])
            if math.isfinite(value):
                row[f"abs_error_{key}"] = absolute_error(value, ref)
        if record.kind == "DUALCORE":
            row["f32_grouping_delta"] = float(v["grouped_f32"]) - float(v["sequential_f32"])
            row["f64_grouping_delta"] = float(v["grouped_f64"]) - float(v["sequential_f64"])
            row["parallel_speedup_observed"] = (float(v["sequential_us"]) / float(v["parallel_us"])) if v["parallel_us"] else math.nan
        if record.kind == "PSRAM" and int(v["psram_found"]) == 1:
            row["kahan_vs_naive_abs_error_ratio"] = (
                row.get("abs_error_naive_f32", math.nan) / row.get("abs_error_kahan_f32", math.nan)
                if row.get("abs_error_kahan_f32", 0.0) not in (0.0, math.nan) else math.nan
            )

    elif record.kind == "TAYLOR":
        ref, ref_kind = sine_reference(float(v["x"]))
        row["host_reference"] = ref
        row["reference_kind"] = ref_kind
        for key in ["raw_f32", "reduced_f32", "raw_f64", "reduced_f64", "sinf_local", "sin_local"]:
            row[f"abs_error_{key}"] = absolute_error(float(v[key]), ref)
        row["range_reduction_gain_f32"] = (
            row["abs_error_raw_f32"] / row["abs_error_reduced_f32"]
            if row["abs_error_reduced_f32"] != 0 else math.inf
        )
        row["range_reduction_gain_f64"] = (
            row["abs_error_raw_f64"] / row["abs_error_reduced_f64"]
            if row["abs_error_reduced_f64"] != 0 else math.inf
        )

    elif record.kind in {"JITTER", "WIFIJITTER"}:
        period = float(v["period_us"])
        row["rms_jitter_fraction_of_period"] = float(v["rms_error_us"]) / period if period else math.nan
        row["deadline_miss_rate"] = float(v["deadline_misses"]) / float(v["samples"]) if v["samples"] else math.nan

    elif record.kind == "TIMER":
        row["elapsed_disagreement_us"] = int(v["micros_elapsed_us"]) - int(v["esp_timer_elapsed_us"])
        row["read_cost_ratio_micros_over_esp_timer"] = (
            float(v["micros_read_cost_ns"]) / float(v["esp_timer_read_cost_ns"])
            if float(v["esp_timer_read_cost_ns"]) else math.nan
        )
    return row


def write_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    keys: list[str] = []
    seen: set[str] = set()
    for row in rows:
        for key in row:
            if key not in seen:
                seen.add(key)
                keys.append(key)
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=keys)
        writer.writeheader()
        writer.writerows(rows)


def build_summary(records: list[Record], enriched: list[dict[str, Any]], metadata: dict[str, str]) -> dict[str, Any]:
    kinds: dict[str, int] = {}
    for r in records:
        kinds[r.kind] = kinds.get(r.kind, 0) + 1

    summary: dict[str, Any] = {
        "schema": "betterboard-esp32-numerical-host-analysis-v1",
        "record_count": len(records),
        "record_types": kinds,
        "device_metadata": metadata,
        "high_precision_reference": "mpmath-80dps" if mp is not None else "python-math-sin for transcendental reference; Decimal-80 for deterministic sums",
        "scientific_boundary": [
            "MCU sin/sinf are comparison implementations, not truth.",
            "Timing and Wi-Fi results are run/environment specific.",
            "Grouping differences demonstrate floating-point non-associativity and scheduling/grouping effects.",
            "PSRAM results apply only when PSRAM was detected and allocated successfully.",
        ],
    }

    jitter_rows = [r for r in enriched if r["kind"] in {"JITTER", "WIFIJITTER"}]
    if jitter_rows:
        summary["jitter"] = {
            "runs": len(jitter_rows),
            "mean_rms_error_us": mean(float(r["rms_error_us"]) for r in jitter_rows),
            "total_deadline_misses": sum(int(r["deadline_misses"]) for r in jitter_rows),
        }

    taylor_rows = [r for r in enriched if r["kind"] == "TAYLOR"]
    if taylor_rows:
        summary["taylor"] = {
            "runs": len(taylor_rows),
            "best_reduced_f32_abs_error": min(float(r["abs_error_reduced_f32"]) for r in taylor_rows),
            "best_reduced_f64_abs_error": min(float(r["abs_error_reduced_f64"]) for r in taylor_rows),
        }

    return summary


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("capture", type=Path)
    parser.add_argument("--out-dir", type=Path, default=Path("esp32-numerical-analysis"))
    args = parser.parse_args()

    records, comments, metadata = parse_capture(args.capture.read_text(encoding="utf-8", errors="replace").splitlines())
    enriched = [enrich(r) for r in records]
    out = args.out_dir
    out.mkdir(parents=True, exist_ok=True)

    write_csv(out / "esp32_numerical_rows.csv", enriched)
    (out / "esp32_numerical_summary.json").write_text(
        json.dumps(build_summary(records, enriched, metadata), indent=2, allow_nan=True), encoding="utf-8"
    )
    (out / "esp32_numerical_comments.txt").write_text("\n".join(comments) + ("\n" if comments else ""), encoding="utf-8")

    print(f"parsed {len(records)} records")
    print(out / "esp32_numerical_rows.csv")
    print(out / "esp32_numerical_summary.json")


if __name__ == "__main__":
    main()
