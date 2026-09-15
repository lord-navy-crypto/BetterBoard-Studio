#!/usr/bin/env python3
"""Protect the Host Primitive Observatory source and UI contract."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
engine_path = ROOT / "src" / "PrimitiveObservability.ts"
ui_path = ROOT / "src" / "PrimitiveObservatory.tsx"
monitor = (ROOT / "src" / "MonitorDataStudio.tsx").read_text()

assert engine_path.is_file(), "PrimitiveObservability engine missing"
assert ui_path.is_file(), "PrimitiveObservatory UI missing"
engine = engine_path.read_text()
ui = ui_path.read_text()

for token in (
    "computeHostPrimitiveObservability",
    "host-derived",
    "sampleStandardDeviation",
    "rmsTrace",
    "derivativeTrace",
    "integralTrace",
    "emaTrace",
    "peakHoldTrace",
    "thresholdStateTrace",
    "hysteresisStateTrace",
    "regression",
    "cusumPositiveTrace",
    "cusumNegativeTrace",
    "meanShiftTrace",
    "non-increasing timestamp",
):
    assert token in engine, f"Primitive engine lost {token}"

for token in (
    "Host Primitive Observatory",
    "HOST-DERIVED",
    "Online state",
    "Dynamics",
    "Signal conditioning",
    "Decision state",
    "Trend & change",
):
    assert token in ui, f"Primitive UI lost {token}"

assert "<PrimitiveObservatory" in monitor, "Monitor & Data no longer mounts PrimitiveObservatory"
print("Primitive observability contract: PASS")
