#!/usr/bin/env python3
from __future__ import annotations

import csv
import json
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ANALYZER = ROOT / "scripts" / "numeric_error_research_analyzer.py"


def run_case(name: str, header: list[str], rows: list[list[object]], expected: str) -> None:
    with tempfile.TemporaryDirectory(prefix=f"betterboard-{name}-") as tmp:
        root = Path(tmp)
        source = root / f"{name}.csv"
        with source.open("w", newline="") as handle:
            writer = csv.writer(handle)
            writer.writerow(header)
            writer.writerows(rows)

        proc = subprocess.run(
            [sys.executable, str(ANALYZER), str(source)],
            text=True,
            capture_output=True,
        )
        if proc.returncode:
            raise AssertionError(f"{name} analyzer failed:\n{proc.stdout}\n{proc.stderr}")

        summary = json.loads((root / "numeric-error-research-analysis" / "summary.json").read_text())
        assert summary["schema"] == "betterboard.numeric-error-research/0.1"
        assert summary["experiment"] == expected, (name, summary)
        assert (root / "numeric-error-research-analysis" / "report.md").is_file()


def main() -> int:
    assert ANALYZER.is_file(), ANALYZER

    run_case(
        "quantization",
        ["time_us", "raw10", "q8", "recon8", "error8_counts", "q6", "recon6", "error6_counts", "q4", "recon4", "error4_counts"],
        [
            [0, 100, 25, 100.29, 0.29, 6, 97.43, -2.57, 1, 68.2, -31.8],
            [50000, 500, 125, 501.47, 1.47, 31, 503.38, 3.38, 7, 477.4, -22.6],
        ],
        "requantization",
    )

    run_case(
        "integration",
        ["n", "left", "trapezoid", "simpson", "reference", "error_left", "error_trapezoid", "error_simpson"],
        [
            [4, 1.5, 1.9, 2.01, 2.0, 0.5, 0.1, 0.01],
            [8, 1.75, 1.975, 2.000625, 2.0, 0.25, 0.025, 0.000625],
            [16, 1.875, 1.99375, 2.0000390625, 2.0, 0.125, 0.00625, 0.0000390625],
        ],
        "integration_convergence",
    )

    run_case(
        "photogate",
        ["event_index", "event_us", "period_us", "frequency_hz", "period_ms", "rejected_since_last"],
        [
            [2, 100000, 50000, 20.0, 50.0, 1],
            [3, 150100, 50100, 19.96008, 50.1, 0],
            [4, 200000, 49900, 20.04008, 49.9, 2],
        ],
        "photogate_timing",
    )

    print("BetterBoard focused Numeric Error analyzer self-check: PASS")
    print("- quantization analysis exercised")
    print("- integration convergence/order analysis exercised")
    print("- photogate timing/rejection analysis exercised")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
