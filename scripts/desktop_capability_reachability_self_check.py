#!/usr/bin/env python3
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'src'

required = [
    SRC / 'capabilityRegistry.ts',
    SRC / 'capabilityShortcuts.ts',
    SRC / 'CapabilityNavigationContext.tsx',
    SRC / 'CapabilityNavigator.tsx',
]
for path in required:
    assert path.is_file(), f'missing desktop reachability file: {path.name}'

registry = (SRC / 'capabilityRegistry.ts').read_text()
shortcuts = (SRC / 'capabilityShortcuts.ts').read_text()
navigation = (SRC / 'CapabilityNavigationContext.tsx').read_text()
navigator = (SRC / 'CapabilityNavigator.tsx').read_text()
main = (SRC / 'main.tsx').read_text()
app = (SRC / 'App.tsx').read_text()
analysis = (SRC / 'AnalysisVisualizationHub.tsx').read_text()
experiments = (SRC / 'ExperimentsHub.tsx').read_text()
task_center = (SRC / 'TaskCenter.tsx').read_text()
production_tsx = '\n'.join(path.read_text() for path in SRC.glob('*.tsx'))

required_ids = [
    'hardware-session', 'hardware-doctor', 'recipe-preflight', 'program-firmware',
    'recipe-library', 'circuit-lab', 'circuit-diagnostics',
    'monitor-live', 'monitor-snapshot', 'measurement-evidence', 'measurement-replay',
    'primitive-observatory', 'analysis-evidence', 'analysis-run-compare',
    'analysis-annotations', 'analysis-statistics', 'analysis-models',
    'analysis-experiment-design', 'analysis-numerical', 'analysis-preparation',
    'numerical-advanced', 'magnet-advanced', 'engineering-handoff', 'research-context',
    'developer-editor', 'developer-verify-upload', 'developer-ecosystem',
    'developer-sketchbook', 'developer-diagnostics', 'experiments-campaigns',
    'experiment-code-library', 'numeric-error-depth', 'esp32-capabilities',
    'observatory-mission', 'observatory-system', 'hardware-topology', 'task-center',
    'openguin', 'focus-mode',
]
for capability_id in required_ids:
    assert capability_id in registry, f'capability registry lost {capability_id}'

required_shortcuts = [
    'runtime-log', 'recipe-settings', 'serial-console', 'serial-transmit',
    'engineering-export-package', 'measurement-session-context',
    'observatory-operational-visualization',
]
for shortcut_id in required_shortcuts:
    assert shortcut_id in shortcuts, f'capability shortcut lost {shortcut_id}'

ids = re.findall(r"id:\s*'([^']+)'", registry)
shortcut_ids = re.findall(r"id:\s*'([^']+)'", shortcuts)
assert ids, 'capability registry has no capability ids'
assert shortcut_ids, 'capability shortcut registry has no shortcut ids'
assert len(ids) == len(set(ids)), 'duplicate capability ids'
assert len(shortcut_ids) == len(set(shortcut_ids)), 'duplicate capability shortcut ids'
assert not (set(ids) & set(shortcut_ids)), 'capability and shortcut ids must not collide'
for token in ['owner:', 'keywords:', 'destination:', 'CAPABILITY_BY_ID']:
    assert token in registry, f'capability registry lost {token}'
for token in ['targetCapabilityId:', 'anchor:', 'CAPABILITY_SHORTCUT_BY_ID']:
    assert token in shortcuts, f'capability shortcuts lost {token}'

shortcut_targets = re.findall(r"targetCapabilityId:\s*'([^']+)'", shortcuts)
for target in shortcut_targets:
    assert target in ids, f'capability shortcut points to unknown canonical capability: {target}'

assert 'CapabilityNavigationProvider' in main, 'main lost capability navigation provider'
assert 'CapabilityNavigator' in main and 'All Tools' in main, 'first-layer All Tools entry missing'
assert 'CAPABILITY_SHORTCUTS' in navigator and 'direct sub-tool shortcuts' in navigator, 'All Tools does not expose direct shortcuts'
assert 'registerStudioTabSetter' in app, 'Studio tab setter is not registered with semantic navigation'
assert 'registerAnalysisViewSetter' in analysis, 'analysis view setter is not registered with semantic navigation'
assert 'openCapability' in main, 'status/global navigation is not routed through semantic capabilities'
assert 'openCapability' in experiments, 'experiment cards are not actionable capability links'
assert 'Open campaign tools' in experiments or 'Open code library' in experiments, 'experiment campaign action copy missing'

# A semantic destination must resolve either to a stable product anchor or to an explicit,
# conservative canonical-surface fallback in CapabilityNavigationContext. Fallback objects may
# span multiple lines and may use sequenced activationSteps/selectorText for nested sub-tools.
anchors = re.findall(r"anchor:\s*'([^']+)'", registry)
shortcut_anchors = re.findall(r"anchor:\s*'([^']+)'", shortcuts)
fallback_ids = set(re.findall(r"^\s*'([^']+)'\s*:\s*\{\s*selector\s*:", navigation, re.MULTILINE))
resolved_by_anchor = 0
resolved_by_fallback = 0
for anchor in [*anchors, *shortcut_anchors]:
    has_anchor = f'data-capability-anchor="{anchor}"' in production_tsx or f"data-capability-anchor='{anchor}'" in production_tsx
    has_fallback = anchor in fallback_ids
    assert has_anchor or has_fallback, f'missing production anchor/fallback: {anchor}'
    resolved_by_anchor += int(has_anchor)
    resolved_by_fallback += int(not has_anchor and has_fallback)

for token in [
    'CAPABILITY_ANCHOR_FALLBACKS', 'revealCapabilityTarget', 'activateButtonText',
    'registerCapabilityActivator', 'CAPABILITY_SHORTCUT_BY_ID', 'shortcut?.anchor',
]:
    assert token in navigation, f'semantic navigation lost {token}'

# Task Center deep links are safe only for categories with canonical owners. System/Export are
# intentionally not guessed, so no misleading button is fabricated for them.
for token in [
    "Program: 'program-firmware'", "Monitor: 'monitor-live'",
    "Evidence: 'measurement-evidence'", "Analysis: 'analysis-evidence'",
    'Go to', 'useCapabilityNavigation', 'openCapability(targetCapability)',
]:
    assert token in task_center, f'Task Center reachability lost {token}'
assert "System: '" not in task_center, 'Task Center must not fabricate a generic System destination'
assert "Export: '" not in task_center, 'Task Center must not fabricate a generic Export destination'

# Explicitly protect second-audit user-facing sub-tools.
runtime_log = (SRC / 'RuntimeLog.tsx').read_text()
visual_summary = (SRC / 'ObservatoryVisualSummary.tsx').read_text()
assert 'data-capability-anchor="runtime-log"' in runtime_log, 'Runtime Log lost its stable destination'
assert 'data-capability-anchor="observatory-operational-visualization"' in visual_summary, 'Operational Visualization lost its stable destination'
for selector in ['.monitor-console-panel', '.monitor-transmit', '.monitor-export-panel', '.monitor-context-panel']:
    assert selector in navigation, f'Monitor/Data direct shortcut lost canonical selector {selector}'
assert '.recipe-parameter-panel, [data-capability-anchor="program-firmware"]' in navigation, 'Recipe Settings must fall back to Program when a recipe has no parameters'

# Canonical backends must remain owned by existing feature surfaces, not the navigation layer.
monitor = (SRC / 'MonitorDataStudio.tsx').read_text()
developer = (SRC / 'DeveloperIDE.tsx').read_text()
circuit = (SRC / 'CircuitLab.tsx').read_text()
for token in ['serial_stream_start', 'measurement_sessions']:
    assert token in monitor, f'Monitor/Data lost canonical backend token {token}'
for token in ['compile_sketch', 'upload_sketch']:
    assert token in developer, f'Developer lost canonical backend token {token}'
assert 'runRuleChecker' in circuit, 'Circuit Lab lost canonical rule checker'
for path in [SRC / 'CapabilityNavigationContext.tsx', SRC / 'CapabilityNavigator.tsx', SRC / 'capabilityShortcuts.ts']:
    text = path.read_text()
    for forbidden in ['compile_sketch', 'upload_sketch', 'serial_stream_start', 'measurement_sessions', 'runRuleChecker']:
        assert forbidden not in text, f'navigation/discovery layer duplicated canonical backend token {forbidden}'

print('Desktop capability reachability self-check: PASS')
print(f'- {len(ids)} canonical capabilities + {len(shortcut_ids)} direct shortcuts have unique non-colliding ids')
print(f'- {len(anchors) + len(shortcut_anchors)} semantic destinations resolve: {resolved_by_anchor} stable anchors + {resolved_by_fallback} canonical fallbacks')
print('- All Tools, semantic Studio/analysis routing, campaign actions, task deep links, audited sub-tools and canonical backend ownership protected')
