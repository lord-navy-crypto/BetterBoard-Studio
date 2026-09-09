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
MAIN = ROOT / 'src' / 'main.tsx'

EXPECTED = {
    'blink': ('Blink_LED', 'Blink_LED.ino'),
    'synthetic': ('SyntheticSignal', 'SyntheticSignal.ino'),
    'analog_a0': ('AnalogDAQ', 'AnalogDAQ.ino'),
    'numerical_embedded': ('EmbeddedNumericalReliability', 'EmbeddedNumericalReliability.ino'),
    'magnetic_mlx90393': ('MagneticField_MLX90393', 'MagneticField_MLX90393.ino'),
    'acceleration_adxl345': ('Accelerometer_ADXL345', 'Accelerometer_ADXL345.ino'),
    'photogate': ('PhotogateTimer', 'PhotogateTimer.ino'),
    'quadrature_encoder': ('QuadratureEncoder', 'QuadratureEncoder.ino'),
    'pulse_rpm': ('PulseRPM', 'PulseRPM.ino'),
    'random_walk_robot': ('RandomWalkRobot', 'RandomWalkRobot.ino'),
    'i2c_scanner': ('I2CScanner', 'I2CScanner.ino'),
}

V04_BYTE_IDENTICAL = {
    'synthetic',
    'acceleration_adxl345',
    'photogate',
    'quadrature_encoder',
    'pulse_rpm',
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
    assert len(catalog) == 11, len(catalog)
    assert len({r['id'] for r in catalog}) == 11
    assert set(EXPECTED) == {r['id'] for r in catalog}
    assert any(b['fqbn'] == 'arduino:avr:uno' for b in boards)
    assert any(d['id'] == 'mlx90393' for d in devices)
    assert 'uT' in units and 'm/s^2' in units and 'V' in units

    for required in [APP, MONITOR_DATA, NUMERICAL_SUITE, MAGNET_SUITE, EXPERIMENTS_HUB, HARDWARE_SESSION, MAIN]:
        assert required.is_file(), required

    # The duplicated pre-refactor lab components must stay gone.
    assert not (ROOT / 'src' / 'NumericalBenchSuite.tsx').exists()
    assert not (ROOT / 'src' / 'MagnetBenchSuite.tsx').exists()

    rust = LIB.read_text()
    frontend = '\n'.join(path.read_text() for path in [
        APP, MONITOR_DATA, NUMERICAL_SUITE, MAGNET_SUITE,
        EXPERIMENTS_HUB, HARDWARE_SESSION, MAIN,
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
    main = MAIN.read_text()
    hub = EXPERIMENTS_HUB.read_text()
    hardware = HARDWARE_SESSION.read_text()
    numerical = NUMERICAL_SUITE.read_text()
    magnet_ui = MAGNET_SUITE.read_text()

    assert 'serial_stream_start' in monitor_text
    assert 'serial_stream_stop' in monitor_text
    assert 'Monitor & Data' in app_text
    assert 'Shared hardware session' in app_text
    assert 'Verify & Diagnose' in app_text
    assert 'Numerical & Measurement' in app_text
    assert 'Magnetism & Fields' in app_text

    assert "type Workspace = 'studio' | 'experiments'" in main
    assert "label: 'Studio'" in main
    assert "label: 'Experiments'" in main
    assert 'HardwareSessionProvider' in main
    assert 'useHardwareSession' in main
    assert 'Numerical Analysis' in hub and 'Magnetism & Fields' in hub
    assert 'Capture 7 s & Analyze' in numerical
    assert 'Capture Complete Campaign & Analyze' in numerical
    assert 'Downsampling convergence' in numerical
    assert 'Method comparison' in numerical
    assert 'Spatial scan' in magnet_ui
    assert 'Measured ↔ model profile' in magnet_ui
    assert "invoke<BoardPort[]>('board_list')" in hardware
    assert "invoke<BoardProfile[]>('board_profiles')" in hardware

    package = json.loads((ROOT / 'package.json').read_text())
    tauri = json.loads((ROOT / 'src-tauri' / 'tauri.conf.json').read_text())
    assert package['version'] == '0.2.0-alpha.1'
    assert tauri['version'] == '0.2.0-alpha.1'
    assert '0.2.0-alpha.1' in (ROOT / 'src-tauri' / 'Cargo.toml').read_text()

    print('BetterBoard Studio v0.2 self-check: PASS')
    print('- 11 canonical recipes registered')
    print('- persistent live Serial Monitor handlers registered')
    print('- unified Monitor & Data workspace registered')
    print('- Studio / Experiments top-level information architecture registered')
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