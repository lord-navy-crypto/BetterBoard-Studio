#!/usr/bin/env python3
"""Protect BetterBoard DOE and sequential-planning contracts."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
core = (ROOT / "src" / "ExperimentPlanning.ts").read_text()
ui = (ROOT / "src" / "ExperimentPlanningWorkbench.tsx").read_text()
main = (ROOT / "src" / "main.tsx").read_text()

for token in (
    "informationLeverage",
    "informationGain",
    "normalizedCoverage",
    "replicationCount",
    "summarizeDesign",
    "generateCandidateGrid",
    "planCandidates",
    "rankForInformation",
    "rankForCoverage",
    "rankForReplication",
    "Math.log1p(leverage)",
):
    assert token in core, f"Experiment planning core lost {token}"

for token in (
    "DOE & Sequential Experiment Planning",
    "Parameter information",
    "Coverage",
    "Replication",
    "Fisher",
    "Leverage hᵀ(XᵀX)⁻¹h",
    "Uncertainty-reduction proxy",
    "Recommendations are decision support",
    "not a guaranteed experimental outcome",
    "do not prove that a point is physically optimal",
):
    assert token in ui, f"Experiment planning workbench lost {token}"

assert "allowExtrapolation" in ui, "explicit extrapolation control was removed"
assert "checked={allowExtrapolation}" in ui, "extrapolation is no longer user-controlled"
assert "ExperimentPlanningWorkbench" in main, "experiment planning workbench is no longer mounted in Studio"
assert "approximately comparable independent noise" in ui, "planning noise-assumption boundary was removed"
assert "Hardware limits, safety constraints, hysteresis, drift, cost, and domain knowledge" in ui, "engineering decision boundary was removed"

print("DOE and sequential experiment planning contracts: PASS")
