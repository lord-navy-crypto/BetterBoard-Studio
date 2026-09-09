#!/usr/bin/env python3
"""Bridge Arduino Numeric Error Interactive Studio evidence to the Numerical Error Studio schema.

Input can be either:
1. a CSV with the firmware's canonical header, or
2. numeric-only rows captured by BetterBoard / Physical Lab.

The host computes an independent mpmath reference. MCU `library_sin` remains
comparison evidence only and is never promoted to truth.
"""
from __future__ import annotations

import argparse
import csv
import json
import math
from datetime import datetime, timezone
from pathlib import Path

try:
    import mpmath as mp
except ImportError as exc:  # Numerical Error Studio already requires mpmath.
    raise SystemExit("mpmath is required for the independent reference: pip install mpmath") from exc

ARDUINO_COLUMNS = [
    "seq", "run_id", "source_id", "method_id", "time_us", "x", "reduced_x",
    "approximation", "library_sin", "terms_used", "last_term", "cancellation_ratio",
    "stopping_met", "finite", "elapsed_us", "adc_raw", "pot_norm", "pir_state",
    "switch_state", "photo_event_count",
]

STUDIO_COLUMNS = [
    "x", "method", "dtype", "reference_backend", "reference_precision_digits",
    "reduced_x", "approximation", "reference", "reference_text", "numpy_reference",
    "absolute_error", "relative_error", "ulp_error", "allowed_absolute_error",
    "normalized_error", "terms_used", "cancellation_ratio", "stopping_criterion_met",
    "accuracy_passed", "numerically_reliable", "false_convergence", "status",
]

METHODS = {0: "raw", 1: "range_reduced"}
SOURCES = {0: "serial_single", 1: "sweep", 2: "live_pot", 3: "photogate"}
FLOAT32_EPS = 2.0 ** -23
FLOAT32_TINY = 2.0 ** -126


def read_rows(path: Path) -> list[dict[str, str]]:
    lines = []
    for raw in path.read_text().splitlines():
        value = raw.strip()
        if not value or value.startswith("#"):
            continue
        lines.append(value)
    if not lines:
        raise ValueError("no Arduino numeric rows found")

    first = [part.strip() for part in lines[0].split(",")]
    if first == ARDUINO_COLUMNS:
        data_lines = lines[1:]
    else:
        data_lines = lines

    rows: list[dict[str, str]] = []
    for line_number, line in enumerate(data_lines, start=1):
        parts = [part.strip() for part in line.split(",")]
        if len(parts) != len(ARDUINO_COLUMNS):
            raise ValueError(
                f"row {line_number} has {len(parts)} fields; expected {len(ARDUINO_COLUMNS)}"
            )
        rows.append(dict(zip(ARDUINO_COLUMNS, parts)))
    return rows


def f32_spacing(value: float) -> float:
    """Approximate IEEE-754 binary32 ULP spacing around a finite value."""
    if value == 0.0:
        return 2.0 ** -149
    _, exponent = math.frexp(abs(value))
    # frexp gives value = mantissa * 2**exponent, mantissa in [0.5,1).
    spacing = 2.0 ** (exponent - 24)
    return max(spacing, 2.0 ** -149)


def bool01(value: str) -> bool:
    return int(float(value)) != 0


def enrich(row: dict[str, str], precision: int, tolerance_multiplier: float) -> dict[str, object]:
    x = float(row["x"])
    approximation = float(row["approximation"])
    reduced_x = float(row["reduced_x"])
    library_sin = float(row["library_sin"])
    method_id = int(float(row["method_id"]))
    method = METHODS.get(method_id, f"unknown_{method_id}")
    finite = bool01(row["finite"]) and math.isfinite(approximation)
    stopping = bool01(row["stopping_met"])
    cancellation_ratio = float(row["cancellation_ratio"])

    with mp.workdps(precision):
        exact_input = mp.mpf(str(x))
        exact_reference = mp.sin(exact_input)
        reference = float(exact_reference)
        reference_text = mp.nstr(exact_reference, precision)
        if finite:
            exact_error = abs(mp.mpf(str(approximation)) - exact_reference)
            absolute_error = float(exact_error)
            relative_floor = mp.mpf(str(FLOAT32_TINY))
            relative_error = float(exact_error / max(abs(exact_reference), relative_floor))
        else:
            absolute_error = math.inf
            relative_error = math.inf

    spacing = f32_spacing(library_sin)
    ulp_error = absolute_error / spacing if math.isfinite(absolute_error) else math.inf
    allowed = tolerance_multiplier * FLOAT32_EPS * max(1.0, abs(x), abs(reference))
    normalized = absolute_error / allowed if allowed > 0 else (0.0 if absolute_error == 0 else math.inf)
    accuracy = finite and absolute_error <= allowed
    cancellation_limit = 1.0 / math.sqrt(FLOAT32_EPS)
    reliable = stopping and accuracy and finite and cancellation_ratio <= cancellation_limit
    false_convergence = stopping and not accuracy

    if not finite:
        status = "non_finite_arithmetic"
    elif false_convergence:
        status = "false_convergence"
    elif not stopping:
        status = "term_limit_reached"
    elif not accuracy:
        status = "accuracy_failure"
    elif cancellation_ratio > cancellation_limit:
        status = "excessive_cancellation"
    else:
        status = "reliable"

    output: dict[str, object] = {
        "x": x,
        "method": method,
        "dtype": "float32",
        "reference_backend": "mpmath",
        "reference_precision_digits": precision,
        "reduced_x": reduced_x,
        "approximation": approximation,
        "reference": reference,
        "reference_text": reference_text,
        "numpy_reference": library_sin,
        "absolute_error": absolute_error,
        "relative_error": relative_error,
        "ulp_error": ulp_error,
        "allowed_absolute_error": allowed,
        "normalized_error": normalized,
        "terms_used": int(float(row["terms_used"])),
        "cancellation_ratio": cancellation_ratio,
        "stopping_criterion_met": stopping,
        "accuracy_passed": accuracy,
        "numerically_reliable": reliable,
        "false_convergence": false_convergence,
        "status": status,
        # Arduino provenance / context follows the canonical Studio columns.
        "arduino_seq": int(float(row["seq"])),
        "arduino_run_id": int(float(row["run_id"])),
        "arduino_source_id": int(float(row["source_id"])),
        "arduino_source": SOURCES.get(int(float(row["source_id"])), "unknown"),
        "arduino_time_us": int(float(row["time_us"])),
        "arduino_library_sin": library_sin,
        "arduino_last_term": float(row["last_term"]),
        "arduino_elapsed_us": int(float(row["elapsed_us"])),
        "adc_raw": int(float(row["adc_raw"])),
        "pot_norm": float(row["pot_norm"]),
        "pir_state": int(float(row["pir_state"])),
        "switch_state": int(float(row["switch_state"])),
        "photo_event_count": int(float(row["photo_event_count"])),
    }
    return output


def json_safe(value):
    if isinstance(value, dict):
        return {key: json_safe(item) for key, item in value.items()}
    if isinstance(value, list):
        return [json_safe(item) for item in value]
    if isinstance(value, float) and not math.isfinite(value):
        return "infinity" if value > 0 else "-infinity" if value < 0 else "nan"
    return value


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path, help="Arduino capture CSV or numeric serial log")
    parser.add_argument("--output", type=Path, help="Output directory")
    parser.add_argument("--precision", type=int, default=80, help="mpmath decimal digits (20..500)")
    parser.add_argument("--tolerance-multiplier", type=float, default=8.0)
    args = parser.parse_args()

    if not 20 <= args.precision <= 500:
        raise SystemExit("--precision must be 20..500")
    if args.tolerance_multiplier <= 0:
        raise SystemExit("--tolerance-multiplier must be positive")

    source = args.input.expanduser().resolve()
    raw_rows = read_rows(source)
    rows = [enrich(row, args.precision, args.tolerance_multiplier) for row in raw_rows]
    out = (args.output or source.parent / "arduino-numeric-error-bridge").expanduser().resolve()
    out.mkdir(parents=True, exist_ok=True)

    all_columns = list(rows[0].keys())
    with (out / "numerical_error_studio_rows.csv").open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=all_columns)
        writer.writeheader()
        writer.writerows(rows)

    reliable = sum(bool(row["numerically_reliable"]) for row in rows)
    false_conv = sum(bool(row["false_convergence"]) for row in rows)
    finite_errors = [float(row["absolute_error"]) for row in rows if math.isfinite(float(row["absolute_error"]))]
    summary = {
        "schema": "betterboard.arduino-numerical-error-bridge/1",
        "created_utc": datetime.now(timezone.utc).isoformat(),
        "source": str(source),
        "row_count": len(rows),
        "reference_backend": "mpmath",
        "reference_precision_digits": args.precision,
        "dtype_under_test": "float32",
        "reliable_rows": reliable,
        "false_convergence_rows": false_conv,
        "maximum_absolute_error": max(finite_errors) if finite_errors else None,
        "scientific_boundary": (
            "Arduino measurements and MCU arithmetic are evidence under test. "
            "The host mpmath calculation is the independent numerical reference. "
            "ADC voltage and sensor timing are not automatically calibrated physical truth."
        ),
        "canonical_numerical_error_columns": STUDIO_COLUMNS,
    }
    (out / "bridge_summary.json").write_text(json.dumps(json_safe(summary), indent=2) + "\n")
    print(out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
