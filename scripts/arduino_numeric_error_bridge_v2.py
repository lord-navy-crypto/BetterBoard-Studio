#!/usr/bin/env python3
"""Convert BetterBoard Arduino Numeric Error evidence into Numerical Error Studio semantics.

Scientific boundary:
- AVR float32 arithmetic is the system under test.
- host NumPy float32 is the canonical `numpy_reference` field, matching numerical-methods.
- mpmath is the independent high-precision reference.
- MCU sinf() is retained only as `arduino_library_sin` provenance.
"""
from __future__ import annotations

import argparse
import csv
import json
import math
from datetime import datetime, timezone
from pathlib import Path

import mpmath as mp
import numpy as np

V1_COLUMNS = [
    "seq", "run_id", "source_id", "method_id", "time_us", "x", "reduced_x",
    "approximation", "library_sin", "terms_used", "last_term", "cancellation_ratio",
    "stopping_met", "finite", "elapsed_us", "adc_raw", "pot_norm", "pir_state",
    "switch_state", "photo_event_count",
]

V2_COLUMNS = [
    "seq", "run_id", "source_id", "method_id", "time_us", "trigger_time_us",
    "trigger_lag_us", "x", "reduced_x", "approximation", "library_sin", "terms_used",
    "last_term", "cancellation_ratio", "stopping_met", "finite", "elapsed_us", "adc_raw",
    "pot_norm", "pir_state", "switch_state", "photo_event_count", "photo_dropped_events",
]

METHODS = {0: "raw", 1: "range_reduced"}
SOURCES = {0: "serial_single", 1: "sweep", 2: "live_pot", 3: "photogate"}


def _read_numeric_rows(path: Path) -> tuple[list[str], list[dict[str, str]]]:
    lines = [line.strip() for line in path.read_text().splitlines()
             if line.strip() and not line.lstrip().startswith("#")]
    if not lines:
        raise ValueError("no numeric Arduino evidence rows found")

    first = [part.strip() for part in lines[0].split(",")]
    if first in (V1_COLUMNS, V2_COLUMNS):
        columns = first
        data = lines[1:]
    else:
        width = len(first)
        if width == len(V2_COLUMNS):
            columns = V2_COLUMNS
        elif width == len(V1_COLUMNS):
            columns = V1_COLUMNS
        else:
            raise ValueError(f"unsupported row width {width}")
        data = lines

    rows: list[dict[str, str]] = []
    for index, line in enumerate(data, 1):
        parts = [part.strip() for part in line.split(",")]
        if len(parts) != len(columns):
            raise ValueError(f"row {index} has {len(parts)} fields; expected {len(columns)}")
        rows.append(dict(zip(columns, parts)))
    return columns, rows


def _b01(text: str) -> bool:
    return int(float(text)) != 0


def _canonical_float32(text: str) -> np.float32:
    """Recover the MCU binary32 quantity represented by the serial decimal."""
    return np.float32(float(text))


def enrich(row: dict[str, str], precision: int, tolerance_multiplier: float) -> dict[str, object]:
    # Canonicalize serialized MCU quantities back to binary32 before comparison.
    x32 = _canonical_float32(row["x"])
    reduced32 = _canonical_float32(row["reduced_x"])
    approximation32 = _canonical_float32(row["approximation"])
    arduino_sin32 = _canonical_float32(row["library_sin"])

    x = float(x32)
    approximation = float(approximation32)
    method_id = int(float(row["method_id"]))
    method = METHODS.get(method_id, f"unknown_{method_id}")
    finite = _b01(row["finite"]) and np.isfinite(approximation32)
    stopping = _b01(row["stopping_met"])
    cancellation_ratio = float(row["cancellation_ratio"])

    # Match numerical_lab.core._reference_diagnostics semantics exactly:
    # NumPy reference and ULP spacing are host-side binary32 quantities.
    numpy_reference32 = np.sin(x32, dtype=np.float32)
    numpy_reference = float(numpy_reference32)
    spacing = abs(float(np.spacing(numpy_reference32)))
    if spacing == 0.0:
        spacing = float(np.finfo(np.float32).smallest_subnormal)

    with mp.workdps(precision):
        exact_input = mp.mpf(float(x32))
        exact_reference = mp.sin(exact_input)
        reference = float(exact_reference)
        reference_text = mp.nstr(exact_reference, precision)
        if finite:
            high_precision_error = abs(mp.mpf(float(approximation32)) - exact_reference)
            absolute_error = float(high_precision_error)
            relative_floor = mp.mpf(str(np.finfo(np.float32).tiny))
            relative_error = float(high_precision_error / max(abs(exact_reference), relative_floor))
            ulp_error = float(high_precision_error / mp.mpf(spacing))
        else:
            absolute_error = relative_error = ulp_error = math.inf

    eps = float(np.finfo(np.float32).eps)
    allowed = tolerance_multiplier * eps * max(1.0, abs(x), abs(reference))
    normalized = absolute_error / allowed if allowed else (0.0 if absolute_error == 0.0 else math.inf)
    accuracy = finite and absolute_error <= allowed
    cancellation_limit = 1.0 / math.sqrt(eps)
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
    elif not reliable:
        status = "excessive_cancellation"
    else:
        status = "reliable"

    source_id = int(float(row["source_id"]))
    output: dict[str, object] = {
        "x": x,
        "method": method,
        "dtype": "float32",
        "reference_backend": "mpmath",
        "reference_precision_digits": precision,
        "reduced_x": float(reduced32),
        "approximation": approximation,
        "reference": reference,
        "reference_text": reference_text,
        "numpy_reference": numpy_reference,
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
        "arduino_seq": int(float(row["seq"])),
        "arduino_run_id": int(float(row["run_id"])),
        "arduino_source_id": source_id,
        "arduino_source": SOURCES.get(source_id, "unknown"),
        "arduino_time_us": int(float(row["time_us"])),
        "arduino_library_sin": float(arduino_sin32),
        "arduino_library_vs_numpy_ulp": abs(float(arduino_sin32) - numpy_reference) / spacing,
        "arduino_last_term": float(_canonical_float32(row["last_term"])),
        "arduino_elapsed_us": int(float(row["elapsed_us"])),
        "adc_raw": int(float(row["adc_raw"])),
        "pot_norm": float(row["pot_norm"]),
        "pir_state": int(float(row["pir_state"])),
        "switch_state": int(float(row["switch_state"])),
        "photo_event_count": int(float(row["photo_event_count"])),
    }
    if "trigger_time_us" in row:
        output["trigger_time_us"] = int(float(row["trigger_time_us"]))
        output["trigger_lag_us"] = int(float(row["trigger_lag_us"]))
        output["photo_dropped_events"] = int(float(row["photo_dropped_events"]))
    return output


def _json_safe(value):
    if isinstance(value, dict):
        return {key: _json_safe(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_json_safe(item) for item in value]
    if isinstance(value, (np.generic,)):
        return _json_safe(value.item())
    if isinstance(value, float) and not math.isfinite(value):
        if math.isnan(value):
            return "nan"
        return "infinity" if value > 0 else "-infinity"
    return value


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--precision", type=int, default=80)
    parser.add_argument("--tolerance-multiplier", type=float, default=8.0)
    args = parser.parse_args()
    if not 20 <= args.precision <= 500:
        raise SystemExit("--precision must be 20..500")
    if args.tolerance_multiplier <= 0:
        raise SystemExit("--tolerance-multiplier must be positive")

    source = args.input.expanduser().resolve()
    schema, raw_rows = _read_numeric_rows(source)
    rows = [enrich(row, args.precision, args.tolerance_multiplier) for row in raw_rows]
    out = (args.output or source.parent / "arduino-numeric-error-bridge-v2").expanduser().resolve()
    out.mkdir(parents=True, exist_ok=True)

    with (out / "numerical_error_studio_rows.csv").open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)

    finite_errors = [float(r["absolute_error"]) for r in rows if math.isfinite(float(r["absolute_error"]))]
    summary = {
        "schema": "betterboard.arduino-numerical-error-bridge/2",
        "created_utc": datetime.now(timezone.utc).isoformat(),
        "input_schema_columns": schema,
        "source": str(source),
        "row_count": len(rows),
        "reference_backend": "mpmath",
        "reference_precision_digits": args.precision,
        "dtype_under_test": "float32",
        "reliable_rows": sum(bool(r["numerically_reliable"]) for r in rows),
        "false_convergence_rows": sum(bool(r["false_convergence"]) for r in rows),
        "maximum_absolute_error": max(finite_errors) if finite_errors else None,
        "semantic_contract": (
            "Canonical Numerical Error Studio columns follow numerical_lab.core semantics. "
            "Arduino sinf is provenance only; host NumPy float32 supplies numpy_reference; "
            "mpmath supplies the independent oracle."
        ),
    }
    (out / "bridge_summary.json").write_text(json.dumps(_json_safe(summary), indent=2) + "\n")
    print(out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
