#!/usr/bin/env python3
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'src'

required = [
    SRC / 'capabilityRegistry.ts',
    SRC / 'CapabilityNavigationContext.tsx',
    SRC / 'CapabilityNavigator.tsx',
]
for path in required:
    assert path.is_file(), f'missing desktop reachability file: {path.name}'

registry = (SRC / 'capabilityRegistry.ts').read_text()
main = (SRC / 'main.tsx').read_text()
app = (SRC / 'App.tsx').read_text()
analysis = (SRC / 'AnalysisVisualizationHub.tsx').read_text()
experiments = (SRC / 'ExperimentsHub.tsx').read_text()
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

ids = re.findall(r"id:\s*'([^']+)'", registry)
assert ids, 'capability registry has no capability ids'
assert len(ids) == len(set(ids)), 'duplicate capability ids'
for token in ['owner:', 'keywords:', 'destination:', 'CAPABILITY_BY_ID']:
    assert token in registry, f'capability registry lost {token}'

assert 'CapabilityNavigationProvider' in main, 'main lost capability navigation provider'
assert 'CapabilityNavigator' in main and 'All Tools' in main, 'first-layer All Tools entry missing'
assert 'registerStudioTabSetter' in app, 'Studio tab setter is not registered with semantic navigation'
assert 'registerAnalysisViewSetter' in analysis, 'analysis view setter is not registered with semantic navigation'
assert 'openCapability' in main, 'status/global navigation is not routed through semantic capabilities'
assert 'openCapability' in experiments, 'experiment cards are not actionable capability links'
assert 'Open campaign tools' in experiments or 'Open code library' in experiments, 'experiment campaign action copy missing'

anchors = re.findall(r"anchor:\s*'([^']+)'", registry)
for anchor in anchors:
    assert f'data-capability-anchor="{anchor}"' in production_tsx or f"data-capability-anchor='{anchor}'" in production_tsx, f'missing production anchor: {anchor}'

# Canonical backends must remain owned by existing feature surfaces, not the navigation layer.
monitor = (SRC / 'MonitorDataStudio.tsx').read_text()
developer = (SRC / 'DeveloperIDE.tsx').read_text()
circuit = (SRC / 'CircuitLab.tsx').read_text()
for token in ['serial_stream_start', 'measurement_sessions']:
    assert token in monitor, f'Monitor/Data lost canonical backend token {token}'
for token in ['compile_sketch', 'upload_sketch']:
    assert token in developer, f'Developer lost canonical backend token {token}'
assert 'runRuleChecker' in circuit, 'Circuit Lab lost canonical rule checker'
for path in [SRC / 'CapabilityNavigationContext.tsx', SRC / 'CapabilityNavigator.tsx']:
    text = path.read_text()
    for forbidden in ['compile_sketch', 'upload_sketch', 'serial_stream_start', 'measurement_sessions', 'runRuleChecker']:
        assert forbidden not in text, f'navigation layer duplicated canonical backend token {forbidden}'

print('Desktop capability reachability self-check: PASS')
print(f'- {len(ids)} registered user-facing capabilities have unique ids')
print(f'- {len(anchors)} semantic destinations have production anchors')
print('- All Tools, semantic Studio/analysis routing, campaign actions and canonical backend ownership protected')
