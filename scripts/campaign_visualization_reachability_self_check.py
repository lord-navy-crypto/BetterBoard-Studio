#!/usr/bin/env python3
"""Protect direct semantic reachability of the Engineering Lab campaign visualization."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SHORTCUTS = (ROOT / "src/capabilityShortcuts.ts").read_text(encoding="utf-8")
CAMPAIGN = (ROOT / "src/CampaignVisualization.tsx").read_text(encoding="utf-8")
NAVIGATION = (ROOT / "src/CapabilityNavigationContext.tsx").read_text(encoding="utf-8")

shortcut_id = "campaign-visualization"
assert f"id: '{shortcut_id}'" in SHORTCUTS, "missing Campaign Visualization direct shortcut"
assert "label: 'Campaign Visualization'" in SHORTCUTS, "missing Campaign Visualization label"
assert "targetCapabilityId: 'experiments-campaigns'" in SHORTCUTS, "campaign visualization must remain owned by Experiments campaigns"
assert "owner: 'CampaignVisualization'" in SHORTCUTS, "campaign visualization shortcut must name its real owner"
assert 'data-capability-anchor="campaign-visualization"' in CAMPAIGN, "CampaignVisualization must expose a stable semantic anchor"

for forbidden in ("invoke(", "compile_sketch", "upload_sketch", "prepare_recipe_with_params", "serial_start", "serial_write"):
    assert forbidden not in NAVIGATION, f"navigation must not execute campaign backend behavior: {forbidden}"

print("Campaign visualization reachability: PASS")
print("- campaign flow + mechanism coverage has a stable direct semantic destination")
print("- Experiments campaigns remains the canonical owner")
print("- navigation remains reveal-only")
