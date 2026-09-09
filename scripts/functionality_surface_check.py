#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'src'
RUST = ROOT / 'src-tauri' / 'src' / 'lib.rs'

required_files = {
    'new Studio': SRC / 'App.tsx',
    'Circuit Lab': SRC / 'CircuitLab.tsx',
    'Monitor & Data': SRC / 'MonitorDataStudio.tsx',
    'Developer IDE': SRC / 'DeveloperIDE.tsx',
    'Task Center': SRC / 'TaskCenter.tsx',
    'Observatory': SRC / 'Observatory.tsx',
    'Learning': SRC / 'LearningHub.tsx',
    'Numerical V2': SRC / 'NumericalBenchSuiteV2.tsx',
    'Magnet V2': SRC / 'MagnetBenchSuiteV2.tsx',
    'Advanced Studio': SRC / 'StudioAdvanced.tsx',
    'Advanced Numerical': SRC / 'NumericalBenchAdvanced.tsx',
    'Advanced Magnet': SRC / 'MagnetBenchAdvanced.tsx',
    'Experiments Hub': SRC / 'ExperimentsHub.tsx',
}

for label, path in required_files.items():
    assert path.is_file(), f'{label} missing: {path}'

main = (SRC / 'main.tsx').read_text()
app = (SRC / 'App.tsx').read_text()
circuit = (SRC / 'CircuitLab.tsx').read_text()
hub = (SRC / 'ExperimentsHub.tsx').read_text()
studio = (SRC / 'StudioAdvanced.tsx').read_text()
numerical = (SRC / 'NumericalBenchAdvanced.tsx').read_text()
magnet = (SRC / 'MagnetBenchAdvanced.tsx').read_text()
monitor = (SRC / 'MonitorDataStudio.tsx').read_text()
developer = (SRC / 'DeveloperIDE.tsx').read_text()
task_center = (SRC / 'TaskCenter.tsx').read_text()
observatory = (SRC / 'Observatory.tsx').read_text()
learning = (SRC / 'LearningHub.tsx').read_text()
numerical_v2 = (SRC / 'NumericalBenchSuiteV2.tsx').read_text()
magnet_v2 = (SRC / 'MagnetBenchSuiteV2.tsx').read_text()
rust = RUST.read_text()

# Global workspace/mission/hardware hierarchy must not collapse back into a flat two-tab shell.
for token in [
    "'studio' | 'observatory' | 'experiments' | 'learning'",
    'build · upload · monitor · record',
    'runtime · evidence · system state',
    'acquire · analyze · compare',
    'concepts · guided labs · equations',
    'bb-context-strip',
    'No board selected',
    'Acquisition',
    'Tasks',
]:
    assert token in main, f'Global workspace/status layer lost {token}'

# Observatory must be a real runtime surface backed by existing system/evidence/task sources.
for token in [
    'Live runtime observatory',
    'arduino_cli_discovery',
    'measurement_sessions',
    'betterboard.task-center.v1',
    'Hardware & runtime',
    'Acquisition state',
    'Background operations',
    'Recent measurement evidence',
    'RX rows observed',
]:
    assert token in observatory, f'Observatory lost {token}'

# Learning is a concept-to-experiment bridge, not a detached tutorial page.
for token in [
    'Understand the number before trusting the number.',
    'Measurement error',
    'Numerical error',
    'Model error',
    'Roundoff',
    'Truncation',
    'Differentiation noise',
    'Repeatability',
    'Residual',
    'Verification',
    'Validation',
    'onOpenExperiment',
]:
    assert token in learning, f'Learning workspace lost {token}'
for token in ['initialDomain', 'setDomain(initialDomain)']:
    assert token in hub, f'Learning-to-experiment handoff lost {token}'

# Streamlined defaults must remain.
for token in ['NumericalBenchSuiteV2', 'MagnetBenchSuiteV2', 'Advanced Tools']:
    assert token in hub, f'Experiments Hub lost {token}'
for token in ['Start Live', 'Snapshot 3 s', 'Measurement sessions', 'Physical Lab export & bridge', 'serial_stream_write']:
    assert token in monitor, f'Monitor & Data lost {token}'
for token in ['Capture 7 s & Analyze', 'Downsampling convergence', 'Capture Complete Campaign & Analyze']:
    assert token in numerical_v2, f'Numerical V2 lost {token}'
for token in ['Spatial scan', 'Measured ↔ model profile']:
    assert token in magnet_v2, f'Magnet V2 lost {token}'

# Numerical V2 must be source-driven: capture once, analyze many times.
for token in [
    'Capture once, then re-analyze the same evidence',
    'Import saved data.csv',
    'Import saved campaign CSV',
    'Re-analyze current source',
    'Target sample rate (Hz)',
    'analyzeBench02Source',
    'analyzeBench03Source',
    'Imported ${file.name}',
    'Changing target rate changes the timing-jitter reference',
    'previously saved BetterBoard `data.csv`',
]:
    assert token in numerical_v2, f'Numerical V2 source/re-analysis lost {token}'

# Magnet V2 must preserve scientific repeatability and historical scan re-analysis.
for token in [
    'Capture repeat',
    'Rep 1 / Rep 2 / Rep 3',
    'Between-capture repeatability',
    'between-capture σ',
    'sampleStd',
    'aggregateScan',
    'Import measured scan CSV',
    'Measured scan CSV',
    'corrected_Bx_uT',
    'corrected_Bmag_uT',
    'validation uses the repeat mean at each position',
    'magnet02_scan.csv',
]:
    assert token in magnet_v2, f'Magnet V2 repeatability/reanalysis lost {token}'
assert 'Capture / replace point' not in magnet_v2, 'Magnet V2 regressed to replacing repeated-position evidence'
assert 'current.filter(p => p.positionMm !== position)' not in magnet_v2, 'Magnet V2 silently deduplicates repeated positions'

# Pre-visual v0.2a Studio capabilities are a product contract, not disposable UI.
for token in ['Circuit Lab', 'Recipe Library', 'Monitor & Data', 'Developer', 'TaskCenterPanel', 'onTaskStart', 'onTaskLog', 'onTaskFinish']:
    assert token in app, f'Current Studio lost pre-visual capability wiring: {token}'

# Circuit Lab Phase A/B must stay real and reachable.
for token in [
    'betterboard.circuit-design/0.1',
    'Visual Wiring Editor + Rule Checker',
    'Direct power-to-ground connection',
    'LED is directly connected without a series resistor',
    'Use Bench 01 firmware',
    'localStorage.setItem',
]:
    assert token in circuit, f'Circuit Lab lost {token}'

# Developer is now the Arduino-style unrestricted sketch surface rather than a read-only source viewer.
for token in [
    'Arduino-style free edit',
    'New',
    'Load recipe',
    'Save',
    'Verify',
    'Run / Upload',
    'developer_sketch_save',
    'compile_sketch',
    'upload_sketch',
    'Run output',
    'Runtime facts',
]:
    assert token in developer, f'Developer IDE lost {token}'
for token in ['developer_sketch_save', 'Documents', 'BetterBoard', 'sketches', '2 MB editor limit']:
    assert token in rust, f'Developer backend lost {token}'

# Task Center must remain classified, collapsible, logged, persistent in Studio, and cancel-aware.
for token in ['Program', 'Monitor', 'Evidence', 'Analysis', 'Export', 'System', 'Cancel', 'task-log', 'Clear finished']:
    assert token in task_center, f'Task Center lost {token}'
for token in ['betterboard.task-center.v1', 'Cancellation requested', 'logs:', 'startedAt']:
    assert token in app, f'Task Center persistence/tracking lost {token}'
for token in ['Live serial', 'Snapshot', 'Record evidence', 'Replay', 'serial_stream_stop']:
    assert token in monitor, f'Monitor no longer reports background work to Task Center: {token}'

# The original Bridge docs were broader than a single hardware-map preview.
for token in ['Physical Lab hardware map', 'Physical Lab serial protocol', 'Honeycomb / integration guide', 'Physical Lab v1', 'physical_lab_bridge_path']:
    assert token in monitor, f'Physical Lab Bridge surface lost {token}'

# Original full-control Studio capabilities must remain reachable under Advanced.
for token in [
    'Capture 3 s',
    'Run diagnostics',
    'Physical Lab Bridge',
    'Measurement package',
    'Canonical firmware source',
    'Task Center',
]:
    assert token in studio, f'Advanced Studio lost {token}'

# Original Numerical expert workflows must remain reachable.
for token in [
    'Preview campaign',
    'bench02_numerical_error.py',
    'bench03_embedded_numerical.py',
    'Record / replace source dataset',
    'Record evidence package',
]:
    assert token in numerical, f'Advanced Numerical lost {token}'

# Original Magnet expert workflows must remain reachable.
for token in [
    'Record ambient baseline',
    'Record magnet capture',
    'magnet02_characterization.py',
    'Magnet Bench 02 scan CSV',
    'RADIA/model CSV',
    'measured-column',
    'model-column',
    'model-unit',
    'Repeating a position provides between-capture repeatability evidence',
]:
    assert token in magnet, f'Advanced Magnet lost {token}'

# Hub must actually expose all three compatibility workspaces.
for token in ['StudioAdvanced', 'NumericalBenchAdvanced', 'MagnetBenchAdvanced']:
    assert token in hub, f'Advanced workspace is not reachable: {token}'

print('BetterBoard functionality surface check: PASS')
print('- four-layer global workspace / mission / hardware status hierarchy protected')
print('- Observatory is backed by real hardware, CLI, task and measurement-session sources')
print('- Learning keeps concept → experiment links for numerical and validation work')
print('- Numerical V2 supports capture-once, import and re-analysis workflows')
print('- Magnet V2 preserves repeated-position evidence and historical scan re-analysis')
print('- streamlined V2 workflows preserved')
print('- pre-visual Studio / Circuit / Bridge capabilities protected')
print('- Developer is a real editable Arduino-style sketch workflow')
print('- Task Center classification, logs, persistence and live cancellation protected')
print('- Advanced Studio / Numerical / Magnet compatibility layers preserved')
print('- simplification may move features, but cannot silently delete them')
