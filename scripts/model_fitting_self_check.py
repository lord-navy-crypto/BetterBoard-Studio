#!/usr/bin/env python3
"""Protect BetterBoard parameter-estimation and model-comparison contracts."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
core = (ROOT / "src" / "ModelFittingAnalysis.ts").read_text()
ui = (ROOT / "src" / "ModelFittingWorkbench.tsx").read_text()
hub = (ROOT / "src" / "AnalysisVisualizationHub.tsx").read_text()

for token in (
    "linearRegression",
    "quadraticRegression",
    "ParameterEstimate",
    "ci95Low",
    "ci95High",
    "adjustedRSquared",
    "aicc",
    "bic",
    "deltaAicc",
    "parameterCorrelation",
):
    assert token in core, f"Model fitting core lost {token}"

for token in (
    "Parameter Estimation & Model Comparison",
    "Linear model",
    "Quadratic model",
    "Adjusted R²",
    "AICc",
    "ΔAICc",
    "BIC",
    "95% CI",
    "parameter correlation",
    "model-selection evidence",
):
    assert token in ui, f"Model fitting workbench lost {token}"

assert "does not establish causality" in ui, "model-selection evidence boundary was removed"
assert "validate the chosen model on new evidence" in ui, "out-of-sample validation boundary was removed"
assert "ModelFittingWorkbench" in hub, "Model fitting workbench is no longer reachable from Studio Analysis & Visualization"
assert "Models" in hub, "Model fitting lost its Studio navigation entry"

print("Parameter estimation and model comparison contracts: PASS")
