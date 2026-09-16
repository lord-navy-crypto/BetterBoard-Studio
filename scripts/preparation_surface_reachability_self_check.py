#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"

shortcuts = (SRC / "capabilityShortcuts.ts").read_text()
navigation = (SRC / "CapabilityNavigationContext.tsx").read_text()
preparation = (SRC / "EngineeringPreparationStudio.tsx").read_text()
numerical = (SRC / "NumericalBenchSuiteV2.tsx").read_text()
magnet = (SRC / "MagnetBenchSuiteV2.tsx").read_text()

required_shortcuts = [
    "numerical-bench-acquisition",
    "numerical-bench-sampling-error",
    "numerical-bench-mcu-reliability",
    "magnet-bench-vector-acquisition",
    "magnet-bench-characterization",
    "magnet-bench-model-validation",
    "research-ai-review",
]
for shortcut_id in required_shortcuts:
    assert f"id: '{shortcut_id}'" in shortcuts, f"missing preparation surface shortcut: {shortcut_id}"
    assert f"anchor: '{shortcut_id}'" in shortcuts, f"shortcut lacks exact local destination: {shortcut_id}"
    assert f"'{shortcut_id}':" in navigation, f"semantic fallback missing for preparation surface: {shortcut_id}"

numerical_modes = [
    ("numerical-bench-acquisition", "Bench 01 — Acquisition"),
    ("numerical-bench-sampling-error", "Bench 02 — Sampling Error"),
    ("numerical-bench-mcu-reliability", "Bench 03 — MCU Reliability"),
]
for shortcut_id, title in numerical_modes:
    assert title in numerical, f"source Numerical Bench mode disappeared: {title}"
    assert f"selectorText: '{title}'" in navigation, f"navigation does not target {title}"
    assert "buttonText: 'Numerical evidence'" in navigation, "numerical lane activation missing"
    assert f"buttonText: '{title}'" in navigation, f"navigation cannot activate {title}"

magnet_modes = [
    ("magnet-bench-vector-acquisition", "Bench 01 — Vector Acquisition"),
    ("magnet-bench-characterization", "Bench 02 — Characterization"),
    ("magnet-bench-model-validation", "Bench 03 — Model Validation"),
]
for shortcut_id, title in magnet_modes:
    assert title in magnet, f"source Magnet Bench mode disappeared: {title}"
    assert f"selectorText: '{title}'" in navigation, f"navigation does not target {title}"
    assert "buttonText: 'Magnetic evidence'" in navigation, "magnetic lane activation missing"
    assert f"buttonText: '{title}'" in navigation, f"navigation cannot activate {title}"

assert "Ask OpenPenguin about this evidence" in preparation, "Research handoff OpenPenguin surface disappeared"
assert "'research-ai-review': { selector: 'section.panel', selectorText: 'Ask OpenPenguin about this evidence' }" in navigation, "Research OpenPenguin review destination missing"

# Parent analysis view, preparation lane, and nested bench mode may each mount on separate renders.
# Preserve an explicit render boundary between activation steps instead of firing hidden clicks at once.
assert "activationSteps?: DomActivationStep[]" in navigation, "sequenced nested activation type missing"
assert "async function activateDomTarget" in navigation, "sequenced nested activation implementation missing"
assert "for (const step of activationSteps)" in navigation, "nested activation steps are not executed in order"
assert "await nextRenderFrame()" in navigation, "nested activation no longer yields to React rendering"
assert "selectorText?: string" in navigation and "resolveDomTarget" in navigation, "exact text-qualified surface resolution missing"

for forbidden in ["compile_sketch", "upload_sketch", "serial_stream_start", "openguin_generate"]:
    assert forbidden not in navigation, f"navigation layer must not own backend execution: {forbidden}"

print("Preparation surface reachability self-check: PASS")
print("- Numerical Bench 01/02/03 are directly addressable through sequenced UI activation")
print("- Magnet Bench 01/02/03 are directly addressable through sequenced UI activation")
print("- Research handoff OpenPenguin review is directly addressable")
print("- Parent-lane → child-mode render boundaries and backend ownership are protected")
