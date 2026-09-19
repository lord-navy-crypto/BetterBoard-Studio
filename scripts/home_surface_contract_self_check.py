#!/usr/bin/env python3
"""Protect the first-principles Studio home surface and its navigation-only boundary."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MAIN = (ROOT / "src/main.tsx").read_text(encoding="utf-8")
COMMAND = ROOT / "src/EngineeringCommandSurface.tsx"
FLOW = ROOT / "src/EngineeringFlowLauncher.tsx"
CURRENT = ROOT / "src/CurrentWorkSummary.tsx"
ADVANCED = ROOT / "src/AdvancedCapabilityLauncher.tsx"
MODEL = ROOT / "src/homeSurfaceModel.ts"
STYLES = ROOT / "src/home-surface.css"
REGISTRY = (ROOT / "src/capabilityRegistry.ts").read_text(encoding="utf-8")
SHORTCUTS = (ROOT / "src/capabilityShortcuts.ts").read_text(encoding="utf-8")

for path, label in (
    (COMMAND, "EngineeringCommandSurface.tsx"),
    (FLOW, "EngineeringFlowLauncher.tsx"),
    (CURRENT, "CurrentWorkSummary.tsx"),
    (ADVANCED, "AdvancedCapabilityLauncher.tsx"),
    (MODEL, "homeSurfaceModel.ts"),
    (STYLES, "home-surface.css"),
):
    assert path.is_file(), f"missing {label}"

command = COMMAND.read_text(encoding="utf-8")
flow = FLOW.read_text(encoding="utf-8")
current = CURRENT.read_text(encoding="utf-8")
advanced = ADVANCED.read_text(encoding="utf-8")
model = MODEL.read_text(encoding="utf-8")

assert "EngineeringCommandSurface" in MAIN, "Studio root must mount EngineeringCommandSurface"
assert "EngineeringFlowLauncher" in MAIN, "Studio root must mount EngineeringFlowLauncher"
assert "CurrentWorkSummary" in MAIN, "Studio root must mount CurrentWorkSummary"
assert "AdvancedCapabilityLauncher" in MAIN, "Studio root must mount AdvancedCapabilityLauncher"
assert "./home-surface.css" in MAIN, "main.tsx must load home-surface.css"
assert "openCapability" in MAIN, "RootContent must retain semantic capability navigation"
assert "onOpenCapability" in command, "command surface must navigate through a semantic callback"
assert "onOpenCapability" in flow, "engineering flow must navigate through a semantic callback"
assert "onOpenCapability" in current, "current work must navigate through a semantic callback"
assert "onOpenCapability" in advanced, "advanced capabilities must navigate through a semantic callback"

for stage in ("Toolchain", "Hardware", "Firmware", "Acquisition", "Evidence", "Analysis"):
    assert stage in command or stage in model, f"missing engineering stage: {stage}"

required_flow = {
    "Build": ("hardware-session", "program-firmware", "recipe-library", "circuit-lab"),
    "Measure": ("monitor-live", "monitor-snapshot", "measurement-evidence", "measurement-replay"),
    "Analyze": ("analysis-evidence", "analysis-statistics", "analysis-models", "analysis-numerical", "analysis-preparation"),
    "Experiment": ("analysis-experiment-design", "experiments-campaigns", "engineering-handoff", "research-context"),
}
for lane, capability_ids in required_flow.items():
    assert lane in model, f"missing engineering flow lane: {lane}"
    for capability_id in capability_ids:
        assert capability_id in model, f"{lane} lane missing capability: {capability_id}"
        assert f"id: '{capability_id}'" in REGISTRY, f"home flow references unknown canonical capability: {capability_id}"

required_advanced = {
    "Diagnostics": ("hardware-doctor", "circuit-diagnostics"),
    "Numerical": ("numerical-advanced", "numeric-error-depth", "numerical-result-viewer"),
    "Magnetism": ("magnet-advanced", "magnet-result-viewer"),
    "ESP32": ("esp32-capabilities", "esp32-core-audit", "esp32-board-details", "esp32-configuration-risk"),
    "Developer": ("developer-editor", "developer-diagnostics", "developer-ecosystem"),
    "Research": ("engineering-handoff", "research-context", "research-ai-review"),
    "System": ("observatory-system", "hardware-topology", "task-center"),
}
for group, capability_ids in required_advanced.items():
    assert group in model, f"missing advanced capability group: {group}"
    for capability_id in capability_ids:
        assert capability_id in model, f"{group} group missing capability: {capability_id}"
        known = f"id: '{capability_id}'" in REGISTRY or f"id: '{capability_id}'" in SHORTCUTS
        assert known, f"advanced home references unknown semantic destination: {capability_id}"

for source_name, source in (("command", command), ("flow", flow), ("current work", current), ("advanced", advanced)):
    for token in (
        "invoke(",
        "compile_sketch",
        "upload_sketch",
        "recipe_preflight",
        "prepare_recipe_with_params",
        "arduino_board_url_add",
        "serial_start",
        "serial_write",
    ):
        assert token not in source, f"home {source_name} surface must remain navigation-only: {token}"

assert "CAPABILITIES" in flow, "engineering flow must resolve labels/descriptions from canonical registry"
assert "CAPABILITIES" in advanced and "CAPABILITY_SHORTCUTS" in advanced, "advanced layer must resolve semantic metadata from canonical registries"
assert "CurrentWorkItem" in model, "home model must normalize current work items"
assert "if (!items.length) return null;" in current, "Current Work must disappear when there is no meaningful context"
assert "currentWorkItems" in MAIN, "RootContent must derive current work from existing runtime state"
assert "capabilityId" in model, "home actions must carry semantic capability IDs"
assert "workflowNextAction" in MAIN, "RootContent must derive a runtime next action"
assert "data-capability-anchor=\"engineering-command-surface\"" in command, "command surface needs a stable semantic root anchor"
assert "data-capability-anchor=\"engineering-flow\"" in flow, "engineering flow needs a stable semantic root anchor"
assert "data-capability-anchor=\"current-work\"" in current, "current work needs a stable semantic root anchor"
assert "data-capability-anchor=\"advanced-capabilities\"" in advanced, "advanced capabilities need a stable semantic root anchor"

print("First-principles home surface contract: PASS")
print("- State -> Decision is mounted before dense Studio workbenches")
print("- six engineering stages remain semantically navigable")
print("- Build / Measure / Analyze / Experiment lanes are canonical-ID driven")
print("- Current Work appears only when runtime context is useful")
print("- Diagnostics / Numerical / Magnetism / ESP32 / Developer / Research / System stay progressively discoverable")
print("- home presentation contains no direct backend execution path")
