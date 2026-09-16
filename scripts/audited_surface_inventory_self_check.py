#!/usr/bin/env python3
"""Require an explicit classification inventory for audited user-facing desktop surfaces."""

from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
AUDIT = ROOT / "docs/superpowers/audits/2026-09-16-user-facing-surface-inventory.md"
REGISTRY = (ROOT / "src/capabilityRegistry.ts").read_text(encoding="utf-8")
SHORTCUTS = (ROOT / "src/capabilityShortcuts.ts").read_text(encoding="utf-8")

assert AUDIT.is_file(), f"missing audited surface inventory: {AUDIT.relative_to(ROOT)}"
text = AUDIT.read_text(encoding="utf-8")

required_classes = {
    "canonical",
    "shortcut",
    "owner-internal",
    "backend-only",
    "dead-orphaned",
}
for classification in sorted(required_classes):
    assert f"`{classification}`" in text, f"missing audit classification: {classification}"

rows = re.findall(
    r"\|\s*`([^`]+)`\s*\|[^\n]*?\|\s*`(canonical|shortcut)`\s*\|\s*`([^`]+)`\s*\|",
    text,
)
assert rows, "no promoted audited surfaces found"

for surface_id, classification, nav_id in rows:
    haystack = REGISTRY if classification == "canonical" else SHORTCUTS
    assert f"id: '{nav_id}'" in haystack, (
        f"{surface_id} -> missing {classification} navigation id {nav_id}"
    )

all_rows = re.findall(
    r"\|\s*`([^`]+)`\s*\|[^\n]*?\|\s*`(canonical|shortcut|owner-internal|backend-only|dead-orphaned)`\s*\|",
    text,
)
assert len(all_rows) >= 15, f"audit inventory too small to be meaningful: {len(all_rows)} rows"

print(
    "Audited surface inventory: PASS "
    f"({len(all_rows)} classified surfaces, {len(rows)} promoted surfaces)"
)
