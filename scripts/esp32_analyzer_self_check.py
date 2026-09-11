#!/usr/bin/env python3
"""Offline contract checks for BetterBoard ESP32 research analyzers.

This intentionally uses synthetic captures rather than pretending to be hardware validation.
It protects the tagged serial schemas and host-analysis code paths in CI.
"""
from __future__ import annotations

import math
import tempfile
from pathlib import Path

import esp32_concurrency_numerics_analyzer as concurrency
import esp32_irregular_dt_analyzer as irregular
import esp32_numerical_research_analyzer as numerical


def check_numerical() -> None:
    lines = [
        "#READY,esp32_numerical_research_v1",
        "JITTER,1,0,1000,100,0,12,1.5,2.5,1,12345",
        "TAYLOR,2,1.0,8,0.84,0.84147,0.84,0.8414709848,0.84147,0.8414709848,10,11,12,13",
    ]
    records, comments, metadata = numerical.parse_capture(lines)
    assert len(records) == 2
    assert comments and metadata.get("READY") == "esp32_numerical_research_v1"

    enriched = [numerical.enrich(record) for record in records]
    jitter = next(row for row in enriched if row["kind"] == "JITTER")
    taylor = next(row for row in enriched if row["kind"] == "TAYLOR")
    assert math.isclose(jitter["rms_jitter_fraction_of_period"], 0.0025)
    assert math.isclose(jitter["deadline_miss_rate"], 0.01)
    assert "abs_error_reduced_f32" in taylor
    assert "range_reduction_gain_f32" in taylor

    summary = numerical.build_summary(records, enriched, metadata)
    assert summary["record_count"] == 2
    assert summary["record_types"]["JITTER"] == 1
    assert summary["record_types"]["TAYLOR"] == 1


def check_concurrency(tmp: Path) -> None:
    capture = tmp / "concurrency.txt"
    capture.write_text(
        "\n".join([
            "#READY,esp32_concurrency_numerics_v3",
            "REDUCE,1,1000,0.1001,0.1000,0.1000,0.1000,120,100,-0.0001,0.0",
            "AFFINITY,2,1000,2,0,1,0.05,0.05,0.1,90",
            "JITTER,3,1000,100,0,0,8,1.0,2.0,1",
            "JITTER,4,1000,100,1,0,18,4.0,6.0,3",
        ]) + "\n",
        encoding="utf-8",
    )
    rows, summary = concurrency.analyze(capture)
    assert summary["reduce_runs"] == 1
    assert summary["affinity_runs"] == 1
    assert summary["jitter_runs"] == 2
    assert summary["unknown_rows"] == 0
    assert summary["mean_load_to_baseline_rms_ratio"] == 3.0
    reduce_row = next(row for row in rows if row["kind"] == "reduce")
    assert math.isclose(reduce_row["seq_float32_abs_error"], 0.0001, rel_tol=0, abs_tol=1e-12)


def check_irregular(tmp: Path) -> None:
    capture = tmp / "irregular.txt"
    # Two points are enough to exercise parsing and timing/reference summary paths.
    # Values are deliberately not perfect; the analyzer should report error rather than hide it.
    capture.write_text(
        "\n".join([
            "#READY,esp32_irregular_dt_v3",
            "IRREG,1,0,IDLE,1000,1.0,1000000,0,0.000000,6.283185,6.283185,0.000000,0.000000",
            "IRREG,1,1,IDLE,1000,1.0,1001002,1002,0.006296,6.283000,6.282900,0.000003,0.000003",
            "IRREG,1,2,IDLE,1000,1.0,1001998,996,0.012554,6.282700,6.282600,0.000012,0.000012",
        ]) + "\n",
        encoding="utf-8",
    )
    rows = irregular.parse_capture(capture)
    assert len(rows) == 3
    summary, enriched = irregular.analyze_run(rows)
    assert summary["samples"] == 3
    assert summary["mode"] == "IDLE"
    assert summary["dt_error_rmse_us"] is not None
    assert len(enriched) == 3
    assert "derivative_reference" in enriched[-1]
    assert "integral_reference" in enriched[-1]


def main() -> int:
    check_numerical()
    with tempfile.TemporaryDirectory(prefix="betterboard-esp32-analyzer-check-") as directory:
        tmp = Path(directory)
        check_concurrency(tmp)
        check_irregular(tmp)
    print("BetterBoard ESP32 analyzer self-check: PASS")
    print("- numerical tagged schema + host enrichment")
    print("- concurrency REDUCE/AFFINITY/JITTER classification + comparison")
    print("- irregular-dt analytic derivative/integral reference path")
    print("- synthetic fixtures only; no hardware-validation claim")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
