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
ESP32_WORKSPACE = ROOT / 'src' / 'ESP32ResearchWorkspace.tsx'
NUMERICAL_SUITE = ROOT / 'src' / 'NumericalBenchSuite.tsx'
MAGNET_SUITE = ROOT / 'src' / 'MagnetBenchSuite.tsx'

CANONICAL_EXPECTED = {
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

ESP32_RESEARCH_EXPECTED = {
    'esp32_readiness': ('ESP32ReadinessProbe', 'ESP32ReadinessProbe.ino'),
    'esp32_numerical_suite': ('ESP32NumericalResearchSuite', 'ESP32NumericalResearchSuite.ino'),
    'esp32_concurrency_numerics': ('ESP32ConcurrencyNumerics', 'ESP32ConcurrencyNumerics.ino'),
    'esp32_irregular_dt': ('ESP32IrregularDtNumerics', 'ESP32IrregularDtNumerics.ino'),
}

EXPECTED = {**CANONICAL_EXPECTED, **ESP32_RESEARCH_EXPECTED}

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
    assert len(catalog) == len(EXPECTED), len(catalog)
    assert len({r['id'] for r in catalog}) == len(EXPECTED)
    assert set(EXPECTED) == {r['id'] for r in catalog}
    assert any(b['fqbn'] == 'arduino:avr:uno' for b in boards)
    assert any(b['fqbn'] == 'esp32:esp32:esp32' for b in boards)
    assert any(b['fqbn'] == 'esp32:esp32:esp32s3' for b in boards)
    assert any(b['fqbn'] == 'esp32:esp32:esp32c3' for b in boards)
    assert any(d['id'] == 'mlx90393' for d in devices)
    assert 'uT' in units and 'm/s^2' in units and 'V' in units

    rust = LIB.read_text()
    assert ESP32_WORKSPACE.is_file()
    frontend = APP.read_text() + '\n' + ESP32_WORKSPACE.read_text() + '\n' + NUMERICAL_SUITE.read_text() + '\n' + MAGNET_SUITE.read_text()
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

    for rid in ESP32_RESEARCH_EXPECTED:
        recipe = by_id[rid]
        assert recipe['category'] == 'ESP32 Research'
        assert recipe.get('research_stage') is True
        assert recipe.get('supported_cores') == ['esp32:esp32']
        assert recipe.get('interactive_commands')
        assert recipe['capture_mode'] == 'text'
        assert not recipe['columns'] and not recipe['units']

    assert by_id['esp32_readiness']['interactive_commands'][0] == 'INFO'
    assert any(cmd.startswith('WIFIJITTER ') for cmd in by_id['esp32_numerical_suite']['interactive_commands'])
    assert any(cmd.startswith('AFFINITY ') for cmd in by_id['esp32_concurrency_numerics']['interactive_commands'])
    assert any(cmd.endswith(' WIFI') for cmd in by_id['esp32_irregular_dt']['interactive_commands'])

    for recipe in catalog:
        rid = recipe['id']
        folder, filename = EXPECTED[rid]
        source = RES / 'firmware' / folder / filename
        assert source.is_file(), source
        assert f'"{rid}"' in rust, rid
        assert recipe['sketch_name'] == folder
        if recipe['capture_mode'] == 'numeric':
            assert len(recipe['columns']) == len(recipe['units']) > 0
            assert recipe['primary_column'] == recipe['columns'][-1]
        if rid != 'i2c_scanner' and recipe['capture_mode'] == 'numeric':
            text = source.read_text()
            assert 'Serial.println' in text, source

    for rid, (folder, filename) in ESP32_RESEARCH_EXPECTED.items():
        text = (RES / 'firmware' / folder / filename).read_text()
        assert 'ARDUINO_ARCH_ESP32' in text, rid
        assert '#READY' in text, rid
        assert '#SCHEMA' in text, rid
        assert '#ERROR' in text, rid

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
            folder, filename = CANONICAL_EXPECTED[rid]
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

    for token in ['physical_lab_v1.csv', 'timestamp,value', 'betterboard.measurement/0.2', 'source_type', 'serial_exchange', 'is_system_serial_port', 'compatible']:
        assert token in rust, token
    assert 'physical-lab-measurement-v1' in (ROOT / 'docs' / 'PHYSICAL_LAB_BRIDGE.md').read_text()

    invoked = set(re.findall(r"invoke<[^>]+>\('([^']+)'|invoke\('([^']+)'", frontend))
    invoke_names = {a or b for a, b in invoked}
    handler_match = re.search(r'tauri::generate_handler!\[(.*?)\]\)', rust, re.S)
    assert handler_match
    handlers = {x.strip() for x in handler_match.group(1).split(',') if x.strip()}
    missing = invoke_names - handlers
    assert not missing, f'frontend invokes missing Rust handlers: {sorted(missing)}'

    app_text = APP.read_text()
    assert 'interactive_commands' in app_text
    assert 'recipeCompatible' in app_text
    assert "invoke<CaptureResult>('serial_exchange'" in app_text

    esp32_text = ESP32_WORKSPACE.read_text()
    for token in ['ESP32 numerical research', 'serial_exchange', 'metricSummary', 'Compile & upload', 'Research stream']:
        assert token in esp32_text, token

    main = (ROOT / 'src' / 'main.tsx').read_text()
    assert 'Numerical Bench 01–03' in main
    assert 'Magnet Bench 01–03' in main
    assert "id: 'esp32'" in main
    assert '<ESP32ResearchWorkspace />' in main

    package = json.loads((ROOT / 'package.json').read_text())
    tauri = json.loads((ROOT / 'src-tauri' / 'tauri.conf.json').read_text())
    assert package['version'] == '0.2.0-alpha.1'
    assert tauri['version'] == '0.2.0-alpha.1'
    assert '0.2.0-alpha.1' in (ROOT / 'src-tauri' / 'Cargo.toml').read_text()

    print('BetterBoard Studio v0.2 self-check: PASS')
    print(f'- {len(CANONICAL_EXPECTED)} canonical recipes registered')
    print(f'- {len(ESP32_RESEARCH_EXPECTED)} ESP32 research recipes registered')
    print('- ESP32 / S3 / C3 explicit board profiles registered')
    print('- dedicated ESP32 Research workspace registered')
    print('- ESP32 research recipes are core-gated and command-driven')
    print('- system debug/Bluetooth serial ports are filtered in the backend')
    print('- frontend invoke / Rust handler contract consistent')
    print('- Numerical Bench 01 / 02 / 03 and Magnet Bench workflows preserved')
    print('- inherited Physical Lab v0.4 firmware hashes preserved where intended')
    print('- full multichannel + Physical Lab v1 compatibility bridge present')
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
