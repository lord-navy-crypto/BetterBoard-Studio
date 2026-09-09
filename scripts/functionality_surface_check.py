#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'src'

required_files = {
    'new Studio': SRC / 'App.tsx',
    'Monitor & Data': SRC / 'MonitorDataStudio.tsx',
    'Numerical V2': SRC / 'NumericalBenchSuiteV2.tsx',
    'Magnet V2': SRC / 'MagnetBenchSuiteV2.tsx',
    'Advanced Studio': SRC / 'StudioAdvanced.tsx',
    'Advanced Numerical': SRC / 'NumericalBenchAdvanced.tsx',
    'Advanced Magnet': SRC / 'MagnetBenchAdvanced.tsx',
    'Experiments Hub': SRC / 'ExperimentsHub.tsx',
}

for label, path in required_files.items():
    assert path.is_file(), f'{label} missing: {path}'

hub = (SRC / 'ExperimentsHub.tsx').read_text()
studio = (SRC / 'StudioAdvanced.tsx').read_text()
numerical = (SRC / 'NumericalBenchAdvanced.tsx').read_text()
magnet = (SRC / 'MagnetBenchAdvanced.tsx').read_text()
monitor = (SRC / 'MonitorDataStudio.tsx').read_text()
numerical_v2 = (SRC / 'NumericalBenchSuiteV2.tsx').read_text()
magnet_v2 = (SRC / 'MagnetBenchSuiteV2.tsx').read_text()

# Streamlined defaults must remain.
for token in ['NumericalBenchSuiteV2', 'MagnetBenchSuiteV2', 'Advanced Tools']:
    assert token in hub, f'Experiments Hub lost {token}'
for token in ['Start Live', 'Snapshot 3 s', 'Measurement sessions', 'Physical Lab export', 'serial_stream_write']:
    assert token in monitor, f'Monitor & Data lost {token}'
for token in ['Capture 7 s & Analyze', 'Downsampling convergence', 'Capture Complete Campaign & Analyze']:
    assert token in numerical_v2, f'Numerical V2 lost {token}'
for token in ['Spatial scan', 'Measured ↔ model profile']:
    assert token in magnet_v2, f'Magnet V2 lost {token}'

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
print('- streamlined V2 workflows preserved')
print('- Advanced Studio full-control workflow preserved')
print('- Advanced Numerical manual/package workflows preserved')
print('- Advanced Magnet baseline/repeatability/scan/model workflows preserved')
print('- simplification may move features, but cannot silently delete them')
