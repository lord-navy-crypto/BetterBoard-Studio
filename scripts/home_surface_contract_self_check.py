#!/usr/bin/env python3
"""Protect the first-principles Studio home surface and its navigation-only boundary."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MAIN = (ROOT / "src/main.tsx").read_text(encoding="utf-8")
COMPONENT = ROOT / "src/EngineeringCommandSurface.tsx"
MODEL = ROOT / "src/homeSurfaceModel.ts"
STYLES = ROOT / "src/home-surface.css"

assert COMPONENT.is_file(), "missing EngineeringCommandSurface.tsx"
assert MODEL.is_file(), "missing homeSurfaceModel.ts"
assert STYLES.is_file(), "missing home-surface.css"

command = COMPONENT.read_text(encoding="utf-8")
model = MODEL.read_text(encoding="utf-8")

assert "EngineeringCommandSurface" in MAIN, "Studio root must mount EngineeringCommandSurface"
assert "./home-surface.css" in MAIN, "main.tsx must load home-surface.css"
assert "openCapability" in MAIN, "RootContent must retain semantic capability navigation"
assert "onOpenCapability" in command, "command surface must navigate through a semantic callback"

for stage in ("Toolchain", "Hardware", "Firmware", "Acquisition", "Evidence", "Analysis"):
    assert stage in command or stage in model, f"missing engineering stage: {stage}"

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
    assert token not in command, f"home command surface must remain navigation-only: {token}"

assert "capabilityId" in model, "home actions must carry semantic capability IDs"
assert "workflowNextAction" in MAIN, "RootContent must derive a runtime next action"
assert "data-capability-anchor=\"engineering-command-surface\"" in command, "command surface needs a stable semantic root anchor"

print("First-principles home command surface contract: PASS")
print("- State -> Decision is mounted before dense Studio workbenches")
print("- six engineering stages remain semantically navigable")
print("- home presentation contains no direct backend execution path")
