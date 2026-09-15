#!/usr/bin/env python3
"""Protect BetterBoard applied-statistics phase-one contracts."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
core = (ROOT / "src" / "AppliedStatistics.ts").read_text()
ui = (ROOT / "src" / "AppliedStatisticsWorkbench.tsx").read_text()
hub = (ROOT / "src" / "AnalysisVisualizationHub.tsx").read_text()

for token in (
    "summarize",
    "sampleStd",
    "mad",
    "robustSigma",
    "trimmedMean10",
    "ci95Low",
    "ci95High",
    "linearTrend",
    "residualAnalysis",
    "uncertaintyBudget",
    "combinedStandard",
    "expanded95",
):
    assert token in core, f"Applied statistics core lost {token}"

for token in (
    "Applied Statistics & Uncertainty",
    "95% mean interval",
    "Robust outliers",
    "Linear drift",
    "Uncertainty budget",
    "Residual analysis",
    "not automatically deleted",
    "covariance-aware model",
):
    assert token in ui, f"Applied statistics workbench lost {token}"

assert "AppliedStatisticsWorkbench" in hub, "Applied Statistics workbench is no longer reachable from Studio Analysis & Visualization"
assert "Signal & Statistics" in hub, "Applied Statistics lost its Studio navigation entry"
assert "Statistics never overwrite the raw measurement record" in ui, "evidence immutability boundary was removed"

print("Applied statistics phase-one contracts: PASS")
