#!/usr/bin/env python3
"""Guard the #67 capability layer after migration to the current four-workspace shell."""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"

main = (SRC / "main.tsx").read_text(encoding="utf-8")
launcher = (SRC / "CapabilityLauncher.tsx").read_text(encoding="utf-8")
routes = (SRC / "capabilityCurrentRoutes.ts").read_text(encoding="utf-8")
app = (SRC / "App.tsx").read_text(encoding="utf-8")
labs = (SRC / "LabsHub.tsx").read_text(encoding="utf-8")
experiments = (SRC / "ExperimentsHub.tsx").read_text(encoding="utf-8")
tasks = (SRC / "TaskCenter.tsx").read_text(encoding="utf-8")
analysis = (SRC / "AnalysisVisualizationHub.tsx").read_text(encoding="utf-8")

# Never regress to the retired #67 three-workspace shell.
for token in ["'studio' | 'labs' | 'analysis' | 'observatory'", "Studio", "Labs", "Analysis", "Observatory"]:
    assert token in main, f"current four-workspace shell lost {token}"
assert "type Workspace = 'studio' | 'observatory' | 'experiments'" not in main

# #67's useful semantic layer is now absorbed into current navigation.
for token in [
    "AdvancedCapabilityLauncher",
    "EngineeringFlowLauncher",
    "currentTargetForCapability",
    "SEMANTIC_CAPABILITIES",
    "CAPABILITY_SHORTCUTS",
    "Detailed tools",
    "getCapabilityTier",
]:
    assert token in main + launcher, f"missing migrated #67 capability token: {token}"

# Deep capability families resolve into current canonical owners.
for token in [
    "labs:numerical-expert",
    "labs:magnet-expert",
    "labs:campaign-library",
    "labs:handoff",
    "analysis:evidence",
    "analysis:statistics",
    "analysis:models",
    "analysis:design",
    "analysis:numerical",
    "studio:developer",
    "studio:data",
]:
    assert token in routes, f"semantic route bridge lost {token}"

# Campaigns and background tasks now have direct current-navigation actions.
for token in ["Open campaign tools", "Open Monitor & Data", "Open evidence handoff"]:
    assert token in experiments, f"campaign direct-navigation action missing: {token}"
assert "onNavigate={onNavigate}" in labs
assert "TASK_TARGET" in tasks and "Go to" in tasks
assert "onNavigate={onNavigate}" in app

# Already-restored #70 analysis reachability must remain intact.
for token in ["EvidenceSourcePicker", "MagnetResultVisualization", "analysis-magnet-results"]:
    assert token in analysis, f"current analysis restoration regressed: {token}"

print("BetterBoard #67 capability migration contract: PASS")
print("- current Studio/Labs/Analysis/Observatory shell preserved")
print("- semantic registry + shortcuts absorbed into current All Tools")
print("- Engineering Flow + Advanced capabilities reachable")
print("- campaign and Task Center direct navigation restored")
print("- #70 Evidence Source / Magnetic Result restoration preserved")
