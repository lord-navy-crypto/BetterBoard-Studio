#!/usr/bin/env python3
"""Protect BetterBoard time-series and signal-diagnostic contracts."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
core = (ROOT / "src" / "TimeSeriesAnalysis.ts").read_text()
ui = (ROOT / "src" / "AppliedStatisticsWorkbench.tsx").read_text()

for token in (
    "autocorrelation",
    "dependenceAnalysis",
    "effectiveSampleSize",
    "decorrelationLag",
    "spectrumAnalysis",
    "dominantFrequencyHz",
    "spectralCentroidHz",
    "highFrequencyPowerFraction",
    "aliasingRisk",
    "ewmaAnalysis",
    "cusumAnalysis",
    "meanShiftChangePoint",
):
    assert token in core, f"Time-series core lost {token}"

for token in (
    "Serial dependence & effective information",
    "Effective sample size",
    "Dependence-adjusted SE",
    "Autocorrelation diagnostic",
    "Frequency-domain diagnostic",
    "Dominant frequency",
    "Near-Nyquist power",
    "Process shift & stability diagnostics",
    "EWMA alarms",
    "CUSUM alarms",
    "Mean-shift candidate",
):
    assert token in ui, f"Time-series workbench lost {token}"

assert "cannot prove whether aliasing already occurred" in ui, "aliasing evidence boundary was removed"
assert "diagnostic candidate, not proof of a causal change point" in ui, "change-point evidence boundary was removed"
assert "effectiveSampleSize < stats.count * 0.5" in ui, "serial-dependence interpretation was removed"
assert "Statistics, Uncertainty & Signal Diagnostics" in ui, "integrated signal workbench title was removed"

print("Time-series and signal diagnostics contracts: PASS")
