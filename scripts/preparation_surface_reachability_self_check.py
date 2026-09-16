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

for shortcut_id in required_shortcuts[:3]:
    assert f"registerCapabilityActivator('{shortcut_id}'" in numerical, f"Numerical Bench cannot activate {shortcut_id}"
    assert f"registerCapabilityActivator('{shortcut_id}'" in preparation, f"Engineering Preparation cannot mount numerical lane for {shortcut_id}"

for shortcut_id in required_shortcuts[3:6]:
    assert f"registerCapabilityActivator('{shortcut_id}'" in magnet, f"Magnet Bench cannot activate {shortcut_id}"
    assert f"registerCapabilityActivator('{shortcut_id}'" in preparation, f"Engineering Preparation cannot mount magnet lane for {shortcut_id}"

assert "setMode('bench01')" in numerical, "Numerical Bench 01 activation missing"
assert "setMode('bench02')" in numerical, "Numerical Bench 02 activation missing"
assert "setMode('bench03')" in numerical, "Numerical Bench 03 activation missing"
assert 'data-capability-anchor="numerical-bench-suite"' in numerical, "Numerical Bench suite anchor missing"

assert "setMode('acquire')" in magnet, "Magnet Bench vector acquisition activation missing"
assert "setMode('characterize')" in magnet, "Magnet Bench characterization activation missing"
assert "setMode('validate')" in magnet, "Magnet Bench model validation activation missing"
assert 'data-capability-anchor="magnet-bench-suite"' in magnet, "Magnet Bench suite anchor missing"

assert 'data-capability-anchor="research-ai-review"' in preparation, "Research OpenPenguin review anchor missing"

# Parent lane activation can mount a previously absent child suite. The requested sub-tool
# activator therefore needs a second lookup after React has had a render opportunity.
assert "deferredActivator" in navigation, "semantic navigation lost deferred nested activator"
assert "capabilityActivatorsRef.current.get(requestedId)" in navigation, "requested sub-tool activator lookup missing"
assert "window.requestAnimationFrame" in navigation, "nested activation must wait for a render frame"

print("Preparation surface reachability self-check: PASS")
print("- Numerical Bench 01/02/03 are directly addressable")
print("- Magnet Bench 01/02/03 are directly addressable")
print("- Research handoff OpenPenguin review is directly addressable")
print("- Cross-lane nested activation is protected")
