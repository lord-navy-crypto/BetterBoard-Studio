#!/usr/bin/env python3
from __future__ import annotations
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RES = ROOT / 'src-tauri' / 'resources'
LIB = ROOT / 'src-tauri' / 'src' / 'lib.rs'
APP = ROOT / 'src' / 'App.tsx'
MONITOR_DATA = ROOT / 'src' / 'MonitorDataStudio.tsx'
NUMERICAL_SUITE = ROOT / 'src' / 'NumericalBenchSuiteV2.tsx'
MAGNET_SUITE = ROOT / 'src' / 'MagnetBenchSuiteV2.tsx'
EXPERIMENTS_HUB = ROOT / 'src' / 'ExperimentsHub.tsx'
HARDWARE_SESSION = ROOT / 'src' / 'HardwareSession.tsx'
OBSERVATORY = ROOT / 'src' / 'Observatory.tsx'
RECIPE_PARAMETERS = ROOT / 'src' / 'RecipeParameterPanel.tsx'
RUNTIME_LOG = ROOT / 'src' / 'RuntimeLog.tsx'
OPENGUIN_BRIDGE = ROOT / 'src' / 'OpenPenguinBridge.tsx'
ENGINEERING_PLOT = ROOT / 'src' / 'EngineeringPlot.tsx'
SMART_EDITOR = ROOT / 'src' / 'SmartArduinoEditor.tsx'
ECOSYSTEM_MANAGER = ROOT / 'src' / 'ArduinoEcosystemManager.tsx'
SKETCHBOOK_EXPLORER = ROOT / 'src' / 'SketchbookExplorer.tsx'
COPY_BUTTON = ROOT / 'src' / 'CopyButton.tsx'
DEVELOPER_DRAFT_STORE = ROOT / 'src' / 'DeveloperDraftStore.ts'
IDE_MANAGER_RUST = ROOT / 'src-tauri' / 'src' / 'ide_manager.rs'
MAIN = ROOT / 'src' / 'main.tsx'

EXPECTED = {
    'blink': ('Blink_LED', 'Blink_LED.ino'),
    'synthetic': ('SyntheticSignal', 'SyntheticSignal.ino'),
    'analog_a0': ('AnalogDAQ', 'AnalogDAQ.ino'),
    'numerical_embedded': ('EmbeddedNumericalReliability', 'EmbeddedNumericalReliability.ino'),
    'numerical_derivative': ('NumericalDerivativeSweep', 'NumericalDerivativeSweep.ino'),
    'numerical_cancellation': ('NumericalCancellation', 'NumericalCancellation.ino'),
    'numerical_accumulation': ('NumericalAccumulation', 'NumericalAccumulation.ino'),
    'mpu6050_numerics': ('MPU6050Numerics', 'MPU6050Numerics.ino'),
    'magnetic_mlx90393': ('MagneticField_MLX90393', 'MagneticField_MLX90393.ino'),
    'acceleration_adxl345': ('Accelerometer_ADXL345', 'Accelerometer_ADXL345.ino'),
    'photogate': ('PhotogateTimer', 'PhotogateTimer.ino'),
    'quadrature_encoder': ('QuadratureEncoder', 'QuadratureEncoder.ino'),
    'pulse_rpm': ('PulseRPM', 'PulseRPM.ino'),
    'random_walk_robot': ('RandomWalkRobot', 'RandomWalkRobot.ino'),
    'i2c_scanner': ('I2CScanner', 'I2CScanner.ino'),
}

V04_BYTE_IDENTICAL = {
    'acceleration_adxl345',
    'random_walk_robot',
    'i2c_scanner',
}


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> int:
    catalog = json.loads((RES / 'recipes' / 'catalog.json').read_text())
    boards = json.loads((RES / 'boards' / 'boards.json').read_text())
    devices = json.loads((RES / 'devices' / 'devices.json').read_text())
    units = json.loads((RES / 'devices' / 'units.json').read_text())
    assert len(catalog) == 15, len(catalog)
    assert len({r['id'] for r in catalog}) == 15
    assert set(EXPECTED) == {r['id'] for r in catalog}
    assert any(b['fqbn'] == 'arduino:avr:uno' for b in boards)
    assert any(d['id'] == 'mlx90393' for d in devices)
    for device_id in ['mpu6050', 'pir', 'optical_pulse_module', 'stepper_or_rotary_motor']:
        assert any(d['id'] == device_id for d in devices), device_id
    assert 'uT' in units and 'm/s^2' in units and 'V' in units

    for required in [
        APP, MONITOR_DATA, NUMERICAL_SUITE, MAGNET_SUITE, EXPERIMENTS_HUB,
        HARDWARE_SESSION, OBSERVATORY, RECIPE_PARAMETERS, RUNTIME_LOG, OPENGUIN_BRIDGE, ENGINEERING_PLOT, SMART_EDITOR, ECOSYSTEM_MANAGER, SKETCHBOOK_EXPLORER, COPY_BUTTON, DEVELOPER_DRAFT_STORE, IDE_MANAGER_RUST, MAIN,
    ]:
        assert required.is_file(), required

    # The duplicated pre-refactor lab components must stay gone.
    assert not (ROOT / 'src' / 'NumericalBenchSuite.tsx').exists()
    assert not (ROOT / 'src' / 'MagnetBenchSuite.tsx').exists()

    rust = LIB.read_text()
    frontend = '\n'.join(path.read_text() for path in [
        APP, MONITOR_DATA, NUMERICAL_SUITE, MAGNET_SUITE,
        EXPERIMENTS_HUB, HARDWARE_SESSION, OBSERVATORY, RECIPE_PARAMETERS, RUNTIME_LOG, OPENGUIN_BRIDGE, ENGINEERING_PLOT, SMART_EDITOR, ECOSYSTEM_MANAGER, SKETCHBOOK_EXPLORER, DEVELOPER_DRAFT_STORE, IDE_MANAGER_RUST, MAIN,
    ])
    by_id = {r['id']: r for r in catalog}

    bench1 = by_id['analog_a0']
    assert bench1['title'].startswith('Bench 01')
    assert bench1['category'] == 'Bench'
    assert bench1['columns'] == [
        'time_us', 'raw_adc', 'normalized', 'nominal_voltage_v',
        'pwm_command', 'filtered_voltage_v'
    ]
    assert bench1['primary_column'] == 'filtered_voltage_v'
    assert bench1['sample_rate_hz'] == 50.0

    bench3 = by_id['numerical_embedded']
    assert bench3['title'].startswith('Bench 03')
    assert bench3['sketch_name'] == 'EmbeddedNumericalReliability'
    assert 'x_bits' in bench3['columns']
    assert 'cancellation_ratio' in bench3['columns']
    assert 'elapsed_us' in bench3['columns']
    assert bench3['primary_column'] == bench3['columns'][-1]
    assert (ROOT / 'scripts' / 'bench02_numerical_error.py').is_file()
    assert (ROOT / 'scripts' / 'bench03_embedded_numerical.py').is_file()
    assert (ROOT / 'scripts' / 'bench03_self_check.py').is_file()
    assert (ROOT / 'docs' / 'BENCH_02_NUMERICAL_ERROR.md').is_file()
    assert (ROOT / 'docs' / 'BENCH_03_EMBEDDED_NUMERICAL_RELIABILITY.md').is_file()

    magnet = by_id['magnetic_mlx90393']
    assert magnet['title'].startswith('Magnet Bench 01')
    assert magnet['category'] == 'Magnet Bench'
    assert magnet['columns'] == ['time_us', 'Bx_uT', 'By_uT', 'Bz_uT', 'Bmag_uT', 'primary_uT']
    assert magnet['primary_column'] == 'primary_uT'
    assert magnet['sample_rate_hz'] == 20.0
    assert (ROOT / 'scripts' / 'magnet02_characterization.py').is_file()
    assert (ROOT / 'scripts' / 'magnet03_model_validation.py').is_file()
    assert (ROOT / 'scripts' / 'magnet_bench_self_check.py').is_file()
    assert (ROOT / 'docs' / 'MAGNET_BENCH_01_03.md').is_file()

    for recipe in catalog:
        rid = recipe['id']
        folder, filename = EXPECTED[rid]
        source = RES / 'firmware' / folder / filename
        assert source.is_file(), source
        assert f'\"{rid}\"' in rust, rid
        assert recipe['sketch_name'] == folder
        if recipe['capture_mode'] == 'numeric':
            assert len(recipe['columns']) == len(recipe['units']) > 0
            assert recipe['primary_column'] == recipe['columns'][-1]
        if rid != 'i2c_scanner' and recipe['capture_mode'] == 'numeric':
            text = source.read_text()
            assert 'Serial.println' in text, source

    old = ROOT / 'archive' / 'physical-lab-hardware-packs'
    for name in [
        'PhysicalLab-Arduino-Measurement-Pack-v0.1.zip',
        'PhysicalLab-Arduino-Measurement-Pack-v0.2.zip',
        'PhysicalLab-Arduino-Measurement-Pack-v0.3.zip',
        'PhysicalLab-Hardware-Pack-v0.4.zip',
        'PhysicalLab_UNO_Blink_Test.ino',
    ]:
        assert (old / name).is_file(), name

    import zipfile
    with zipfile.ZipFile(old / 'PhysicalLab-Hardware-Pack-v0.4.zip') as zf:
        for rid in sorted(V04_BYTE_IDENTICAL):
            folder, filename = EXPECTED[rid]
            archived_name = f'PhysicalLab-Hardware-Pack-v0.4/firmware/{folder}/{filename}'
            archived = zf.read(archived_name)
            assert hashlib.sha256(archived).hexdigest() == sha(RES / 'firmware' / folder / filename), archived_name

        old_analog = zf.read('PhysicalLab-Hardware-Pack-v0.4/firmware/AnalogDAQ/AnalogDAQ.ino')
        current_analog = (RES / 'firmware' / 'AnalogDAQ' / 'AnalogDAQ.ino').read_bytes()
        assert hashlib.sha256(old_analog).hexdigest() != hashlib.sha256(current_analog).hexdigest()
        assert b'BetterBoard Bench 01' in current_analog

        old_magnetic = zf.read('PhysicalLab-Hardware-Pack-v0.4/firmware/MagneticField_MLX90393/MagneticField_MLX90393.ino')
        current_magnetic = (RES / 'firmware' / 'MagneticField_MLX90393' / 'MagneticField_MLX90393.ino').read_bytes()
        assert hashlib.sha256(old_magnetic).hexdigest() != hashlib.sha256(current_magnetic).hexdigest()
        assert b'Magnet Bench 01' in current_magnetic
        assert b'Bmag_uT' in current_magnetic

    bench3_source = (RES / 'firmware' / 'EmbeddedNumericalReliability' / 'EmbeddedNumericalReliability.ino').read_text()
    for token in ['a * (a + 1.0f)', 'cancellation_ratio', 'FLT_EPSILON', 'elapsed_us', 'runParameterScan', 'runConvergenceStudy']:
        assert token in bench3_source, token

    for token in ['physical_lab_v1.csv', 'timestamp,value', 'betterboard.measurement/0.2', 'source_type']:
        assert token in rust, token
    assert 'physical-lab-measurement-v1' in (ROOT / 'docs' / 'PHYSICAL_LAB_BRIDGE.md').read_text()

    invoked = set(re.findall(r"invoke<[^>]+>\('([^']+)'|invoke\('([^']+)'", frontend))
    invoke_names = {a or b for a, b in invoked}
    handler_match = re.search(r'tauri::generate_handler!\[(.*?)\]\)', rust, re.S)
    assert handler_match
    handlers = {
        x.strip().split('::')[-1]
        for x in handler_match.group(1).split(',')
        if x.strip()
    }
    missing = invoke_names - handlers
    assert not missing, f'frontend invokes missing Rust handlers: {sorted(missing)}'

    monitor_text = MONITOR_DATA.read_text()
    app_text = APP.read_text()
    main_text = MAIN.read_text()
    hub = EXPERIMENTS_HUB.read_text()
    hardware = HARDWARE_SESSION.read_text()
    observatory = OBSERVATORY.read_text()
    numerical = NUMERICAL_SUITE.read_text()
    magnet_ui = MAGNET_SUITE.read_text()

    assert 'serial_stream_start' in monitor_text
    assert 'serial_stream_write' in monitor_text
    assert 'serial_stream_stop' in monitor_text
    assert 'measurement_sessions' in monitor_text
    assert 'measurement_session_load' in monitor_text
    assert 'No line ending' in monitor_text
    assert "direction === 'tx'" in monitor_text
    assert 'Measurement sessions' in monitor_text
    assert 'Physical Lab export' in monitor_text
    assert 'fn measurement_sessions(' in rust
    assert 'fn measurement_session_load(' in rust
    assert 'serial_stream::serial_stream_write' in rust
    assert 'Monitor & Data' in app_text
    assert "| 'bridge'" not in app_text
    assert "['bridge'," not in app_text
    assert "{tab === 'bridge'" not in app_text
    assert 'Shared hardware session' in app_text
    assert 'Verify & Diagnose' in app_text
    assert 'Numerical & Measurement' in app_text
    assert 'Magnetism & Fields' in app_text

    assert "type Workspace = 'studio' | 'observatory' | 'experiments'" in main_text
    for label in ['Studio', 'Observatory', 'Experiments']:
        assert f"label: '{label}'" in main_text
    assert "label: 'Learning'" not in main_text
    assert 'bb-context-strip' in main_text
    assert 'bb-workspace-pane' in main_text
    assert "hidden={workspace !== 'studio'}" in main_text
    assert 'HardwareSessionProvider' in main_text
    assert 'useHardwareSession' in main_text
    for token in ['System Observatory','measurement_sessions','measurement_session_load','recipe_catalog','device_catalog','openguin_probe','Latest data observation','Engineering Lab bridge readiness','Recipe & device inventory']:
        assert token in observatory, token
    assert not (ROOT / 'src' / 'LearningHub.tsx').exists()
    assert "id: 'learning'" not in main_text
    for token in ['Connect with Engineering Lab','BetterBoard → Engineering Lab handoff','Numerical Error Analysis','Oscillation & Numerical Integration','RADIA Magnet Studio']:
        assert token in hub, token
    assert 'Capture 7 s & Analyze' in numerical
    assert 'Capture Complete Campaign & Analyze' in numerical
    assert 'Downsampling convergence' in numerical
    assert 'Method comparison' in numerical
    assert 'Spatial scan' in magnet_ui
    assert 'Measured ↔ model profile' in magnet_ui
    assert "invoke<BoardPort[]>('board_list')" in hardware
    assert "invoke<BoardProfile[]>('board_profiles')" in hardware

    # Parameterized recipes / user library / local AI are first-class contracts.
    for rid in ['blink', 'synthetic', 'analog_a0', 'photogate', 'quadrature_encoder', 'pulse_rpm', 'numerical_derivative', 'numerical_accumulation', 'mpu6050_numerics']:
        assert by_id[rid].get('parameters'), rid
    for token in ['prepare_recipe_with_params', 'user_recipe_save', 'recipe_parameters', 'Documents', 'BetterBoard', 'library']:
        assert token in rust, token
    for token in ['Save preset to My Library', 'My Library']:
        assert token in app_text, token
    assert 'Recipe settings' in RECIPE_PARAMETERS.read_text()
    developer_text = (ROOT / 'src' / 'DeveloperIDE.tsx').read_text()
    for token in ['Template', 'Load recipe template', 'Save to Library', 'OpenPenguinBridge']:
        assert token in developer_text, token
    assert 'Runtime log' in RUNTIME_LOG.read_text()
    for token in ['parameterValues', 'capture_measurement', 'save_measurement_buffer', 'RuntimeLog']:
        assert token in monitor_text, token
    assert 'parameterValues={parameterValues}' in app_text
    assert 'recipe_parameters' in rust and 'firmware_sha256: sha256_text(&source)' in rust
    for token in ['openguin_probe', 'openguin_generate', '127.0.0.1:11435']:
        assert token in OPENGUIN_BRIDGE.read_text() or token in (ROOT / 'src-tauri' / 'src' / 'openguin_bridge.rs').read_text(), token
    assert 'Expert workflows' in hub and 'Advanced Tools' not in hub
    # Page state and engineering plot contracts.
    engineering_plot = ENGINEERING_PLOT.read_text()
    for token in ['xLabel', 'yLabel', 'xTicks', 'yTicks', 'axisTitle', 'engineering-grid-line']:
        assert token in engineering_plot, token
    assert "hidden={tab !== 'data'}" in app_text
    assert "hidden={tab !== 'developer'}" in app_text
    assert "hidden={tab !== 'circuit'}" in app_text
    assert "hidden={tool!=='numerical'}" in hub
    assert "hidden={tool!=='magnet'}" in hub
    assert 'EngineeringPlot' in monitor_text
    assert 'xLabel="time"' in monitor_text and 'xUnit="s"' in monitor_text
    assert 'EngineeringPlot' in magnet_ui
    assert 'xLabel="position"' in magnet_ui and 'xUnit="mm"' in magnet_ui and 'yUnit="µT"' in magnet_ui

    # Arduino IDE parity Phase 1 must stay reachable and real.
    smart = SMART_EDITOR.read_text()
    ecosystem = ECOSYSTEM_MANAGER.read_text()
    sketchbook = SKETCHBOOK_EXPLORER.read_text()
    ide_rust = IDE_MANAGER_RUST.read_text()
    developer_text = (ROOT / 'src' / 'DeveloperIDE.tsx').read_text()
    for token in ['@monaco-editor/react', 'registerCompletionItemProvider', 'MarkerSeverity', 'bracketPairColorization']:
        assert token in smart, token
    for token in ['Boards', 'Libraries', 'Examples', 'arduino_core_install', 'arduino_library_install', 'arduino_board_url_add']:
        assert token in ecosystem, token
    for token in ['Sketchbook & project files', 'developer_sketchbook_list', 'developer_project_files']:
        assert token in sketchbook, token
    for token in ['arduino_core_search', 'arduino_library_search', 'developer_project_file_save', 'Documents', 'Arduino']:
        assert token in ide_rust, token
    for token in ['SmartArduinoEditor', 'Boards & Libraries', 'Sketchbook', 'developer_project_file_save', 'compileDiagnostics']:
        assert token in developer_text, token
    for token in ['ide_manager::arduino_core_list', 'ide_manager::arduino_library_list', 'ide_manager::developer_project_files']:
        assert token in rust, token
    # Arduino IDE parity Phase 2: durable drafts, project CRUD, formatter, and source navigation.
    assert DEVELOPER_DRAFT_STORE.is_file()
    draft_store = DEVELOPER_DRAFT_STORE.read_text()
    for token in ['betterboard.developer.draft.v1', 'loadDeveloperDraft', 'saveDeveloperDraft', 'clearDeveloperDraft']:
        assert token in draft_store, token
    for token in ['registerDefinitionProvider', 'registerHoverProvider', 'stickyScroll']:
        assert token in smart, token
    for token in ['Draft Recovery', 'autosaved draft', 'developer_format_source', 'Format']:
        assert token in developer_text, token
    for token in ['New project', 'New file', 'developer_project_create', 'developer_project_rename', 'developer_project_file_delete']:
        assert token in sketchbook, token
    for token in ['developer_project_create', 'developer_project_rename', 'developer_project_file_create', 'developer_project_file_rename', 'developer_project_file_delete', 'developer_format_source', 'clang-format']:
        assert token in ide_rust, token
    for token in ['ide_manager::developer_project_create', 'ide_manager::developer_project_rename', 'ide_manager::developer_project_file_create', 'ide_manager::developer_project_file_rename', 'ide_manager::developer_project_file_delete', 'ide_manager::developer_format_source']:
        assert token in rust, token
    # Alpha 0.7: one-click copy surfaces and globally reachable OpenPenguin bridge.
    assert COPY_BUTTON.is_file()
    copy_button = COPY_BUTTON.read_text()
    for token in ['navigator.clipboard', 'execCommand', 'Copied', 'Copy failed']:
        assert token in copy_button, token
    for token in ['Copy output', 'CopyButton']:
        assert token in developer_text, token
    for token in ['Copy data', 'serialCopyText']:
        assert token in monitor_text, token
    runtime_text = RUNTIME_LOG.read_text()
    assert 'Copy log' in runtime_text and 'CopyButton' in runtime_text
    for token in ['Connect OpenPenguin / reload models', 'Copy answer', 'Local endpoint']:
        assert token in OPENGUIN_BRIDGE.read_text(), token
    for token in ['bb-ai-launch', 'bb-ai-drawer', 'OpenPenguinBridge', 'openPenguinContext']:
        assert token in main_text, token

    package = json.loads((ROOT / 'package.json').read_text())
    tauri = json.loads((ROOT / 'src-tauri' / 'tauri.conf.json').read_text())
    assert package['version'] == '0.2.0-alpha.8'
    assert tauri['version'] == '0.2.0-alpha.8'
    assert '0.2.0-alpha.8' in (ROOT / 'src-tauri' / 'Cargo.toml').read_text()

    print('BetterBoard Studio v0.2.0-alpha.8 self-check: PASS')
    print('- 15 canonical recipes registered, including four new numerical-error programs')
    print('- persistent bidirectional Serial Monitor handlers registered')
    print('- historical Measurement Sessions + replay registered')
    print('- Physical Lab Bridge merged into Monitor & Data')
    print('- unified Monitor & Data workspace registered')
    print('- persistent Studio / Observatory / Experiments architecture registered')
    print('- global CLI / hardware / acquisition / task context strip registered')
    print('- shared Hardware Session provider registered')
    print('- grouped Recipe Library registered')
    print('- Numerical Lab in-app complete-results workflow registered')
    print('- Magnet Lab in-app characterization/model-validation workflow registered')
    print('- obsolete duplicate Numerical/Magnet lab components removed')
    print('- inherited Physical Lab v0.4 firmware hashes preserved where intended')
    print('- full multichannel + Physical Lab v1 compatibility bridge present')
    print('- frontend invoke / Rust handler contract consistent')
    return 0

if __name__ == '__main__':
    raise SystemExit(main())

# Alpha 0.8 observatory/Engineering Lab contracts
main=(ROOT/'src/main.tsx').read_text(); obs=(ROOT/'src/Observatory.tsx').read_text(); exp=(ROOT/'src/ExperimentsHub.tsx').read_text()
assert "id: 'learning'" not in main
for token in ['System Observatory','Latest data observation','Engineering Lab bridge readiness','OpenPenguin','Recipe & device inventory']:
    assert token in obs, f'Observatory lost {token}'
for token in ['Connect with Engineering Lab','BetterBoard → Engineering Lab handoff','Numerical evidence preparation','Magnet evidence preparation']:
    assert token in exp, f'Engineering Lab Experiments lost {token}'
