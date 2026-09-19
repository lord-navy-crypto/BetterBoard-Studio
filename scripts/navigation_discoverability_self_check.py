#!/usr/bin/env python3
"""Protect whole-app discoverability: every primary capability must have a direct indexed route."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"

launcher = (SRC / "CapabilityLauncher.tsx").read_text(encoding="utf-8")
main = (SRC / "main.tsx").read_text(encoding="utf-8")
app = (SRC / "App.tsx").read_text(encoding="utf-8")
labs = (SRC / "LabsHub.tsx").read_text(encoding="utf-8")
analysis = (SRC / "AnalysisVisualizationHub.tsx").read_text(encoding="utf-8")
experiments = (SRC / "ExperimentsHub.tsx").read_text(encoding="utf-8")
tasks = (SRC / "TaskCenter.tsx").read_text(encoding="utf-8")
observatory = (SRC / "Observatory.tsx").read_text(encoding="utf-8")

# Every major capability must appear in the global index.
targets = [
    "studio:hardware", "studio:circuit", "studio:library", "studio:data", "studio:developer", "studio:tasks",
    "labs:numerical", "labs:numerical-expert", "labs:magnet", "labs:magnet-expert",
    "labs:campaigns", "labs:campaign-library", "labs:handoff",
    "analysis:evidence", "analysis:statistics", "analysis:models", "analysis:design", "analysis:numerical",
    "observatory:overview", "observatory:hardware", "observatory:inventory", "observatory:data",
    "observatory:live", "observatory:bridge", "observatory:tasks", "observatory:evidence",
    "ai",
]
for target in targets:
    assert f"'{target}'" in launcher, f"All Tools lost direct route {target}"

for title in [
    "Hardware & Program", "Circuit Lab", "Recipe Library", "Monitor & Data", "Developer", "Task Center",
    "Numerical Lab", "Numerical Expert Tools", "Magnet Lab", "Magnetic Expert Tools",
    "Campaigns", "Experiment Code Library", "Evidence Handoff",
    "Evidence", "Signal & Statistics", "Models", "Experiment Design", "Numerical Analysis",
    "System Observatory", "Toolchain & Hardware State", "Recipe & Device Inventory",
    "Latest Data Observation", "Live Acquisition State", "Engineering Lab Bridge Readiness",
    "Recent Measurement Evidence", "OpenPenguin",
]:
    assert title in launcher, f"All Tools lost capability label {title}"

# Root must expose the index globally and route to concrete child surfaces.
for token in [
    "All Tools", "find anything", "CapabilityLauncher", "navigateCapability",
    "navigationRequest={navigationRequest}", "key === 'j'", "studio:tasks",
]:
    assert token in main, f"Root discoverability layer lost {token}"

# Studio deep links must address all five canonical panes plus Task Center.
for token in ["studio:", "target === 'tasks'", "target === 'hardware'", "target === 'circuit'", "target === 'library'", "target === 'data'", "target === 'developer'"]:
    assert token in app, f"Studio deep navigation lost {token}"
assert 'id="task-center"' in tasks, "Task Center lost direct anchor"

# Labs direct links must include expert surfaces and the repository code library.
for token in [
    "labs:", "numerical-expert", "magnet-expert", "campaign-library",
    "setNumericalExpertOpen(true)", "setMagneticExpertOpen(true)",
    'id="campaign-code-library"',
]:
    assert token in labs + experiments, f"Labs direct navigation lost {token}"

# Analysis views are all individually addressable.
for token in ["analysis:", "evidence", "statistics", "models", "design", "numerical"]:
    assert token in analysis, f"Analysis deep navigation lost {token}"

# Long Observatory pages must expose a visible section map and direct anchors.
for anchor in [
    "observatory-hardware", "observatory-inventory", "observatory-data", "observatory-live",
    "observatory-bridge", "observatory-tasks", "observatory-evidence",
]:
    assert anchor in observatory, f"Observatory lost section anchor {anchor}"
assert "observatory-jump-nav" in observatory, "Observatory lost its visible section map"

print("Whole-app navigation discoverability contract: PASS")
print(f"- {len(targets)} indexed capability routes protected")
print("- Studio, Labs, Analysis, Observatory and OpenPenguin all have direct destinations")
print("- expert tools, Task Center and campaign code library cannot silently become scroll-only/hidden features")
