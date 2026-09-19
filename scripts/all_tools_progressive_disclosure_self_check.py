#!/usr/bin/env python3
"""Protect progressive disclosure in All Tools without reducing full semantic reachability."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NAVIGATOR = ROOT / "src/CapabilityNavigator.tsx"
TIER_MODEL = ROOT / "src/capabilityTierModel.ts"
STYLES = ROOT / "src/capability-navigation.css"
REGISTRY = (ROOT / "src/capabilityRegistry.ts").read_text(encoding="utf-8")
SHORTCUTS = (ROOT / "src/capabilityShortcuts.ts").read_text(encoding="utf-8")

assert NAVIGATOR.is_file(), "missing CapabilityNavigator.tsx"
assert TIER_MODEL.is_file(), "missing capabilityTierModel.ts"
assert STYLES.is_file(), "missing capability-navigation.css"

navigator = NAVIGATOR.read_text(encoding="utf-8")
tier_model = TIER_MODEL.read_text(encoding="utf-8")
styles = STYLES.read_text(encoding="utf-8")

for tier in ("Common", "Advanced", "Expert", "All"):
    assert tier in navigator or tier in tier_model, f"missing All Tools tier: {tier}"

assert "CapabilityTier" in tier_model, "tier model needs a typed CapabilityTier"
assert "COMMON_CAPABILITY_IDS" in tier_model, "tier model must identify the primary everyday surface"
assert "ADVANCED_CAPABILITY_IDS" in tier_model, "tier model must identify deeper engineering surfaces"
assert "getCapabilityTier" in tier_model, "tier assignment must be centralized"
assert "getCapabilityTier" in navigator, "All Tools must consume centralized tier assignment"
assert "query.trim()" in navigator, "All Tools must retain text search"
assert "!needle" in navigator, "tier filtering must distinguish browsing from active search"
assert "item.tier" in navigator, "navigator items must carry their disclosure tier"
assert "capability-tier-filter" in navigator, "All Tools needs visible tier controls"
assert ".capability-tier-filter" in styles, "tier controls need a visual treatment"

# The tier model must reference only real semantic IDs. Full completeness remains owned by the reachability contract.
for line in tier_model.splitlines():
    stripped = line.strip()
    if not stripped.startswith("'"):
        continue
    capability_id = stripped.split("'", 2)[1]
    if not capability_id or capability_id in {"common", "advanced", "expert"}:
        continue
    known = f"id: '{capability_id}'" in REGISTRY or f"id: '{capability_id}'" in SHORTCUTS
    assert known, f"tier model references unknown semantic destination: {capability_id}"

print("All Tools progressive disclosure contract: PASS")
print("- Common / Advanced / Expert / All browsing tiers are explicit")
print("- active text search can still discover the full semantic index")
print("- tier metadata is centralized and does not duplicate backend ownership")
