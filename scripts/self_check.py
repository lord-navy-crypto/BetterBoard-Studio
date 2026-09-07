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

EXPECTED = {
    'blink': ('Blink_LED', 'Blink_LED.ino'),
    'synthetic': ('SyntheticSignal', 'SyntheticSignal.ino'),
    'analog_a0': ('AnalogDAQ', 'AnalogDAQ.ino'),
    'magnetic_mlx90393': ('MagneticField_MLX90393', 'MagneticField_MLX90393.ino'),
    'acceleration_adxl345': ('Accelerometer_ADXL345', 'Accelerometer_ADXL345.ino'),
    'photogate': ('PhotogateTimer', 'PhotogateTimer.ino'),
    'quadrature_encoder': ('QuadratureEncoder', 'QuadratureEncoder.ino'),
    'pulse_rpm': ('PulseRPM', 'PulseRPM.ino'),
    'random_walk_robot': ('RandomWalkRobot', 'RandomWalkRobot.ino'),
    'i2c_scanner': ('I2CScanner', 'I2CScanner.ino'),
}

# These recipes remain byte-for-byte inherited from the archived Physical Lab v0.4 pack.
# analog_a0 intentionally evolved into BetterBoard Bench 01, while its v0.4 source remains
# preserved inside the archived pack for provenance.
V04_BYTE_IDENTICAL = {
    'synthetic',
    'magnetic_mlx90393',
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
    assert len(catalog) == 10, len(catalog)
    assert len({r['id'] for r in catalog}) == 10
    assert set(EXPECTED) == {r['id'] for r in catalog}
    assert any(b['fqbn'] == 'arduino:avr:uno' for b in boards)
    assert any(d['id'] == 'mlx90393' for d in devices)
    assert 'uT' in units and 'm/s^2' in units and 'V' in units

    rust = LIB.read_text()
    frontend = APP.read_text()
    by_id = {r['id']: r for r in catalog}
    bench = by_id['analog_a0']
    assert bench['title'].startswith('Bench 01')
    assert bench['category'] == 'Bench'
    assert bench['columns'] == [
        'time_us', 'raw_adc', 'normalized', 'nominal_voltage_v',
        'pwm_command', 'filtered_voltage_v'
    ]
    assert bench['primary_column'] == 'filtered_voltage_v'
    assert bench['sample_rate_hz'] == 50.0

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

    # The earlier Physical Lab hardware packs remain archived intact.
    old = ROOT / 'archive' / 'physical-lab-hardware-packs'
    for name in [
        'PhysicalLab-Arduino-Measurement-Pack-v0.1.zip',
        'PhysicalLab-Arduino-Measurement-Pack-v0.2.zip',
        'PhysicalLab-Arduino-Measurement-Pack-v0.3.zip',
        'PhysicalLab-Hardware-Pack-v0.4.zip',
        'PhysicalLab_UNO_Blink_Test.ino',
    ]:
        assert (old / name).is_file(), name

    # Verify byte-identical inherited v0.4 sources. Bench 01 is intentionally excluded
    # because it is the first BetterBoard-native evolution of the older AnalogDAQ recipe.
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

    # Current bridge contract must be explicit.
    for token in ['physical_lab_v1.csv', 'timestamp,value', 'betterboard.measurement/0.2', 'source_type']:
        assert token in rust, token
    assert 'physical-lab-measurement-v1' in (ROOT / 'docs' / 'PHYSICAL_LAB_BRIDGE.md').read_text()

    # Every frontend invoke must have a Rust command registered or be a known command function.
    invoked = set(re.findall(r"invoke<[^>]+>\('([^']+)'|invoke\('([^']+)'", frontend))
    invoke_names = {a or b for a, b in invoked}
    handler_match = re.search(r'tauri::generate_handler!\[(.*?)\]\)', rust, re.S)
    assert handler_match
    handlers = {x.strip() for x in handler_match.group(1).split(',') if x.strip()}
    missing = invoke_names - handlers
    assert not missing, f'frontend invokes missing Rust handlers: {sorted(missing)}'

    package = json.loads((ROOT / 'package.json').read_text())
    tauri = json.loads((ROOT / 'src-tauri' / 'tauri.conf.json').read_text())
    assert package['version'] == '0.2.0-alpha.1'
    assert tauri['version'] == '0.2.0-alpha.1'
    assert '0.2.0-alpha.1' in (ROOT / 'src-tauri' / 'Cargo.toml').read_text()

    print('BetterBoard Studio v0.2 self-check: PASS')
    print('- 10 canonical recipes registered')
    print('- Bench 01 analog control/instrumentation recipe registered')
    print('- inherited Physical Lab v0.4 firmware hashes preserved where intended')
    print('- archived v0.4 AnalogDAQ retained while current analog_a0 evolved into Bench 01')
    print('- full multichannel + Physical Lab v1 compatibility bridge present')
    print('- frontend invoke / Rust handler contract consistent')
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
