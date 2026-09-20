#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'src'
RUST = ROOT / 'src-tauri' / 'src' / 'lib.rs'

required_files = {
    'new Studio': SRC / 'App.tsx',
    'Evidence Handoff': SRC / 'EngineeringPreparationStudio.tsx',
    'Labs Hub': SRC / 'LabsHub.tsx',
    'Analysis Hub': SRC / 'AnalysisVisualizationHub.tsx',
    'Circuit Lab': SRC / 'CircuitLab.tsx',
    'Monitor & Data': SRC / 'MonitorDataStudio.tsx',
    'Developer IDE': SRC / 'DeveloperIDE.tsx',
    'Task Center': SRC / 'TaskCenter.tsx',
    'Observatory': SRC / 'Observatory.tsx',
    'Recipe Parameters': SRC / 'RecipeParameterPanel.tsx',
    'Runtime Log': SRC / 'RuntimeLog.tsx',
    'OpenPenguin Bridge': SRC / 'OpenPenguinBridge.tsx',
    'Engineering Plot': SRC / 'EngineeringPlot.tsx',
    'Smart Arduino Editor': SRC / 'SmartArduinoEditor.tsx',
    'Arduino Ecosystem Manager': SRC / 'ArduinoEcosystemManager.tsx',
    'Sketchbook Explorer': SRC / 'SketchbookExplorer.tsx',
    'Numerical V2': SRC / 'NumericalBenchSuiteV2.tsx',
    'Magnet V2': SRC / 'MagnetBenchSuiteV2.tsx',
    'Advanced Numerical': SRC / 'NumericalBenchAdvanced.tsx',
    'Advanced Magnet': SRC / 'MagnetBenchAdvanced.tsx',
    'Experiments Hub': SRC / 'ExperimentsHub.tsx',
}

for label, path in required_files.items():
    assert path.is_file(), f'{label} missing: {path}'

main = (SRC / 'main.tsx').read_text()
app = (SRC / 'App.tsx').read_text()
preparation = (SRC / 'EngineeringPreparationStudio.tsx').read_text()
labs = (SRC / 'LabsHub.tsx').read_text()
analysis = (SRC / 'AnalysisVisualizationHub.tsx').read_text()
circuit = (SRC / 'CircuitLab.tsx').read_text()
hub = (SRC / 'ExperimentsHub.tsx').read_text()
numerical = (SRC / 'NumericalBenchAdvanced.tsx').read_text()
magnet = (SRC / 'MagnetBenchAdvanced.tsx').read_text()
monitor = (SRC / 'MonitorDataStudio.tsx').read_text()
developer = (SRC / 'DeveloperIDE.tsx').read_text()
task_center = (SRC / 'TaskCenter.tsx').read_text()
observatory = (SRC / 'Observatory.tsx').read_text()
numerical_v2 = (SRC / 'NumericalBenchSuiteV2.tsx').read_text()
magnet_v2 = (SRC / 'MagnetBenchSuiteV2.tsx').read_text()
magnet_result = (SRC / 'MagnetResultVisualization.tsx').read_text()
rust = RUST.read_text()

# Retired compatibility UI must stay gone; its capabilities live in canonical surfaces.
assert not (SRC / 'StudioAdvanced.tsx').exists(), 'Retired StudioAdvanced compatibility UI returned'
assert 'StudioAdvanced' not in preparation, 'Engineering Preparation remounted retired StudioAdvanced UI'
assert 'Studio compatibility tools' not in preparation, 'Legacy compatibility shell returned to Engineering Preparation'

# Global workspace/mission/hardware hierarchy must not collapse back into a flat shell.
for token in [
    "'studio' | 'labs' | 'analysis' | 'observatory'",
    'connect · program · monitor',
    'run · measure · inspect',
    'evidence · statistics · models',
    'runtime · provenance · system',
    'bb-context-strip',
    'No board selected',
    'Acquisition',
    'Tasks',
    'LabsHub',
    'AnalysisVisualizationHub',
]:
    assert token in main, f'Global workspace/status layer lost {token}'

# Observatory remains the whole-system read-mostly observability surface.
for token in [
    'System Observatory', 'arduino_cli_discovery', 'measurement_sessions', 'measurement_session_load',
    'recipe_catalog', 'device_catalog', 'openguin_probe', 'Latest data observation',
    'Engineering Lab bridge readiness', 'Background operations', 'Recent measurement evidence',
    'Recipe & device inventory', 'Copy latest data', 'Scientific boundaries',
]:
    assert token in observatory, f'Observatory lost {token}'

# Learning was intentionally removed; guidance belongs in the unified Library / Studio.
assert not (SRC / 'LearningHub.tsx').exists(), 'Learning workspace should stay removed after IA refocus'
assert "id: 'learning'" not in main, 'Learning regressed into top-level navigation'

# Experiments is campaign-only. Generic preparation/expert tools must not be mounted here.
for token in [
    'Experiment Library', 'same complete program inventory',
    'Numeric Error Depth', 'Oscillation & Numerical Integration', 'Magnetic Model Validation',
    'Campaign families', 'Independent host validation', 'RAW vs REDUCED campaign',
]:
    assert token in hub, f'Engineering Lab Experiments lost campaign surface {token}'
for forbidden in ['<NumericalBenchSuiteV2', '<MagnetBenchSuiteV2', '<NumericalBenchAdvanced', '<MagnetBenchAdvanced']:
    assert forbidden not in hub, f'Preparation/expert surface regressed into Experiments: {forbidden}'

# Hardware-facing labs are first-class in Labs; handoff remains a separate downstream surface.
for token in [
    'Numerical Lab', 'Magnet Lab', 'Experiment Library', 'Evidence Handoff',
    'NumericalBenchSuiteV2', 'MagnetBenchSuiteV2', 'NumericalBenchAdvanced', 'MagnetBenchAdvanced',
    'initialMode="bench02"', 'Recommended demo',
]:
    assert token in labs, f'Labs workspace lost {token}'
for token in [
    'BetterBoard → Engineering Lab handoff', 'Choose saved evidence', 'Refresh saved evidence',
    'Evidence handoff', 'Research context', 'Ask OpenPenguin about this evidence',
    'Copy handoff', 'betterboard.research-bridge/1.0',
]:
    assert token in preparation, f'Evidence Handoff lost {token}'
for forbidden in ['NumericalBenchSuiteV2', 'MagnetBenchSuiteV2', 'NumericalBenchAdvanced', 'MagnetBenchAdvanced']:
    assert forbidden not in preparation, f'Evidence Handoff remounted lab implementation: {forbidden}'
for token in ['Evidence', 'Signal & Statistics', 'Models', 'Experiment Design', 'Numerical Analysis']:
    assert token in analysis, f'Analysis workspace lost {token}'
assert 'Engineering Preparation' not in analysis, 'Analysis regressed to nesting hardware preparation'
for token in ['MagnetResultVisualization', 'analysis-magnet-results', 'magnet-results']:
    assert token in analysis, f'Analysis lost restored magnetic result visualization route: {token}'
for token in ['Magnetic Analyzer Results', 'magnet02_summary.json', 'magnet03_residuals.csv', 'Measured ↔ model field profile', 'Residual structure']:
    assert token in magnet_result, f'Magnetic result viewer lost {token}'

# Streamlined preparation workflows must remain real.
for token in ['Start Live', 'Snapshot 3 s', 'Measurement sessions', 'Physical Lab export & bridge', 'serial_stream_write']:
    assert token in monitor, f'Monitor & Data lost {token}'
for token in ['Capture 7 s & Analyze', 'Downsampling convergence', 'Capture Complete Campaign & Analyze']:
    assert token in numerical_v2, f'Numerical V2 lost {token}'
for token in ['Spatial scan', 'Measured ↔ model profile']:
    assert token in magnet_v2, f'Magnet V2 lost {token}'

# Numerical V2 must be source-driven: capture once, analyze many times.
for token in [
    'Capture once, then re-analyze the same evidence', 'Import saved data.csv',
    'Import saved campaign CSV', 'Re-analyze current source', 'Target sample rate (Hz)',
    'analyzeBench02Source', 'analyzeBench03Source', 'Imported ${file.name}',
    'Changing target rate changes the timing-jitter reference', 'previously saved BetterBoard `data.csv`',
]:
    assert token in numerical_v2, f'Numerical V2 source/re-analysis lost {token}'

# Magnet V2 must preserve repeatability and historical scan re-analysis.
for token in [
    'Capture repeat', 'Rep 1 / Rep 2 / Rep 3', 'Between-capture repeatability',
    'between-capture σ', 'sampleStd', 'aggregateScan', 'Import measured scan CSV',
    'Measured scan CSV', 'corrected_Bx_uT', 'corrected_Bmag_uT',
    'validation uses the repeat mean at each position', 'magnet02_scan.csv',
]:
    assert token in magnet_v2, f'Magnet V2 repeatability/reanalysis lost {token}'
assert 'Capture / replace point' not in magnet_v2, 'Magnet V2 regressed to replacing repeated-position evidence'
assert 'current.filter(p => p.positionMm !== position)' not in magnet_v2, 'Magnet V2 silently deduplicates repeated positions'

# Canonical Studio owns the old compatibility capabilities now.
for token in [
    'Circuit Lab', 'Library', 'Monitor & Data', 'Developer',
    'TaskCenterPanel', 'onTaskStart', 'onTaskLog', 'onTaskFinish',
]:
    assert token in app, f'Current Studio lost canonical capability wiring: {token}'
for token in ['Start Live', 'Snapshot 3 s', 'Record evidence', 'Physical Lab export & bridge', 'Measurement sessions']:
    assert token in monitor, f'Monitor/Data lost capability previously duplicated by StudioAdvanced: {token}'
for token in ['Arduino-style free edit', 'Load template', 'Verify', 'Run / Upload', 'Runtime facts']:
    assert token in developer, f'Developer lost capability previously duplicated by StudioAdvanced: {token}'
for token in ['Program', 'Monitor', 'Evidence', 'Analysis', 'Export', 'System', 'Cancel', 'Clear finished']:
    assert token in task_center, f'Task Center lost canonical task capability: {token}'

# Circuit Lab Phase A/B stays real and reachable.
for token in [
    'betterboard.circuit-design/0.1', 'UNO R3 Wiring Studio',
    'Arduino UNO R3', 'Solderless Breadboard', 'BME280', 'ADXL345', 'MLX90393', 'INA219', 'HC-SR04', 'Hobby Servo',
    'Direct power-to-ground connection', 'LED is directly connected without a series resistor',
    'Use Bench 01 firmware', 'localStorage.setItem',
]:
    assert token in circuit, f'Circuit Lab lost {token}'

# Developer backend remains unrestricted and persistent.
for token in ['developer_sketch_save', 'compile_sketch', 'upload_sketch', 'Run output']:
    assert token in developer, f'Developer IDE lost {token}'
for token in ['developer_sketch_save', 'Documents', 'BetterBoard', 'sketches', '2 MB editor limit']:
    assert token in rust, f'Developer backend lost {token}'

# Task Center remains classified, logged, persistent and cancel-aware.
for token in ['betterboard.task-center.v1', 'Cancellation requested', 'logs:', 'startedAt']:
    assert token in app, f'Task Center persistence/tracking lost {token}'
for token in ['Live serial', 'Snapshot', 'Record evidence', 'Replay', 'serial_stream_stop']:
    assert token in monitor, f'Monitor no longer reports background work to Task Center: {token}'

# Bridge docs remain broader than a single preview. Legacy export is still live and must not be removed casually.
for token in ['Physical Lab hardware map', 'Physical Lab serial protocol', 'Honeycomb / integration guide', 'Physical Lab v1', 'physical_lab_bridge_path']:
    assert token in monitor, f'Physical Lab Bridge surface lost {token}'
for token in ['physical_lab_csv_path', 'physical_lab_bridge_path']:
    assert token in rust, f'Live Physical Lab compatibility export lost {token}'

# Advanced scientific analyzers remain available without the retired whole-app compatibility UI.
for token in ['Preview campaign', 'bench02_numerical_error.py', 'bench03_embedded_numerical.py', 'Record / replace source dataset', 'Record evidence package']:
    assert token in numerical, f'Advanced Numerical lost {token}'
for token in [
    'Record ambient baseline', 'Record magnet capture', 'magnet02_characterization.py',
    'Magnet Bench 02 scan CSV', 'RADIA/model CSV', 'measured-column', 'model-column', 'model-unit',
    'Repeating a position provides between-capture repeatability evidence',
]:
    assert token in magnet, f'Advanced Magnet lost {token}'

# Parameterized Recipe → compile → evidence and user-library loops are protected.
parameter_panel = (SRC / 'RecipeParameterPanel.tsx').read_text()
runtime_log = (SRC / 'RuntimeLog.tsx').read_text()
openguin = (SRC / 'OpenPenguinBridge.tsx').read_text()
for token in ['Recipe settings', 'slider', 'macro_name', 'Defaults']:
    assert token in parameter_panel, f'Recipe parameter UI lost {token}'
for token in ['prepare_recipe_with_params', 'user_recipe_save', 'Save preset to My Library', 'My Library']:
    assert token in app + rust, f'Parameterized/user recipe loop lost {token}'
for token in ['Load template', 'Save to Library', 'OpenPenguinBridge', 'ProgramLibraryCatalog', 'ALL_PROGRAM_ASSETS']:
    assert token in developer, f'Developer template/library loop lost {token}'
for token in ['Runtime log', 'Task Center / Arduino CLI / monitor / evidence operations']:
    assert token in runtime_log, f'Runtime log lost {token}'
assert '[...task.logs].reverse()' in runtime_log, 'Runtime log no longer prioritizes newest lines inside each newest-first task'
assert '.slice(0, 300)' in runtime_log, 'Runtime log must retain the newest 300-line window'
assert '.slice(-300)' not in runtime_log, 'Runtime log regressed to retaining the oldest 300-line tail'
for token in ['Connect OpenPenguin', '127.0.0.1:11435', 'Ask local AI']:
    assert token in openguin, f'OpenPenguin UI bridge lost {token}'
for token in ['openguin_probe', 'openguin_generate', 'Ipv4Addr::LOCALHOST']:
    bridge = (ROOT / 'src-tauri' / 'src' / 'openguin_bridge.rs').read_text()
    assert token in rust or token in bridge, f'OpenPenguin backend lost {token}'
for token in ['numerical_derivative', 'numerical_cancellation', 'numerical_accumulation', 'mpu6050_numerics']:
    assert token in rust, f'New numerical recipe backend lost {token}'

# Arduino IDE parity Phase 1 is a baseline capability contract.
smart_editor = (SRC / 'SmartArduinoEditor.tsx').read_text()
ecosystem_manager = (SRC / 'ArduinoEcosystemManager.tsx').read_text()
sketchbook_explorer = (SRC / 'SketchbookExplorer.tsx').read_text()
ide_manager = (ROOT / 'src-tauri' / 'src' / 'ide_manager.rs').read_text()
for token in ['@monaco-editor/react', 'registerCompletionItemProvider', 'MarkerSeverity', 'lineNumbers', 'folding']:
    assert token in smart_editor, f'Smart editor lost {token}'
for token in ['Boards', 'Libraries', 'Examples', 'arduino_core_install', 'arduino_library_install', 'arduino_board_url_add']:
    assert token in ecosystem_manager, f'Arduino ecosystem manager lost {token}'
for token in ['developer_sketchbook_list', 'developer_project_files', 'Sketchbook & project files']:
    assert token in sketchbook_explorer, f'Sketchbook explorer lost {token}'
for token in ['arduino_core_list', 'arduino_core_search', 'arduino_library_list', 'arduino_library_search', 'developer_project_file_save']:
    assert token in ide_manager, f'IDE backend lost {token}'
for token in ['SmartArduinoEditor', 'Boards & Libraries', 'Sketchbook', 'compileDiagnostics', 'developer_project_file_save']:
    assert token in developer, f'Developer IDE parity surface lost {token}'

# Persistent-page and plotted-axis contracts.
engineering_plot = (SRC / 'EngineeringPlot.tsx').read_text()
for token in ['xLabel', 'yLabel', 'xTicks', 'yTicks', 'axisTitle', 'engineering-grid-line']:
    assert token in engineering_plot, f'Engineering plot lost {token}'
for token in ["hidden={tab !== 'developer'}", "hidden={tab !== 'data'}", "hidden={tab !== 'circuit'}"]:
    assert token in app, f'Studio persistence lost {token}'
assert 'xLabel="time"' in monitor and 'yLabel={selectedColumn}' in monitor
assert 'xLabel="position"' in magnet_v2 and 'yUnit="µT"' in magnet_v2

print('BetterBoard functionality surface check: PASS')
print('- retired StudioAdvanced compatibility UI stays removed')
print('- canonical Studio / Monitor / Developer / Task Center own its former product capabilities')
print('- four-workspace hierarchy protected: Studio / Labs / Analysis / Observatory')
print('- Labs owns hardware experiments; Evidence Handoff owns provenance/context transfer')
print('- live Physical Lab compatibility export remains protected until explicitly migrated')
print('- Numerical and Magnet V2 evidence/re-analysis contracts remain protected')
print('- Developer, Task Center, Circuit, Monitor and IDE-parity capabilities protected')
print('- simplification may move features, but cannot silently delete them')