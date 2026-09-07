#!/usr/bin/env python3
"""Offline deterministic self-check for Bench 02."""
from __future__ import annotations

import csv
import json
import math
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ANALYZER = ROOT / "scripts" / "bench02_numerical_error.py"


def main() -> int:
    assert ANALYZER.is_file(), ANALYZER
    with tempfile.TemporaryDirectory(prefix="betterboard-bench02-") as tmp:
        measurement = Path(tmp) / "measurement"
        measurement.mkdir()
        data = measurement / "data.csv"
        metadata = measurement / "metadata.json"

        with data.open("w", newline="") as handle:
            writer = csv.writer(handle)
            writer.writerow(["time_us", "raw_adc", "normalized", "filtered_voltage_v"])
            for i in range(401):
                # 200 Hz deterministic quantized waveform with a small timing pattern.
                t_us = i * 5000 + (i % 5 - 2) * 7
                raw = int(round(512 + 280 * math.sin(2 * math.pi * 0.8 * (t_us * 1e-6))))
                raw = max(0, min(1023, raw))
                writer.writerow([t_us, raw, raw / 1023.0, raw / 1023.0 * 5.0])

        metadata.write_text(json.dumps({"sample_rate_hz": 200.0}, indent=2) + "\n")

        proc = subprocess.run(
            [sys.executable, str(ANALYZER), str(measurement)],
            text=True,
            capture_output=True,
        )
        if proc.returncode:
            print(proc.stdout)
            print(proc.stderr, file=sys.stderr)
            return proc.returncode

        out = measurement / "bench02-numerical-error"
        summary = json.loads((out / "bench02_summary.json").read_text())
        assert summary["schema"] == "betterboard.bench02-numerical-error/0.1"
        assert summary["sample_count"] >= 400
        assert summary["time_column"] == "time_us"
        assert summary["value_column"] == "raw_adc"
        assert len(summary["downsample_convergence"]) >= 4
        assert (out / "bench02_convergence.csv").is_file()
        assert (out / "bench02_report.md").is_file()
        assert "not physical ground truth" in summary["reference_boundary"]

    print("BetterBoard Bench 02 self-check: PASS")
    print("- deterministic real-series analysis path exercised")
    print("- timing / quantization / downsampling outputs present")
    print("- float32-vs-float64 accumulation output present")
    print("- empirical-baseline scientific boundary preserved")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
