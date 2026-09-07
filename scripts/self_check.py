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
    assert 'uT' in units and 'm/s^2' in units

    rust = LIB.read_text()
    frontend = APP.read_text()
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
            # Canonical acquisition firmware must end each record with numeric println output.
            text = source.read_text()
            assert 'Serial.println' in text, source

    # The latest Physical Lab v0.4 firmware is canonical in BetterBoard.
    old = ROOT / 'archive' / 'physical-lab-hardware-packs'
    for name in [
        'PhysicalLab-Arduino-Measurement-Pack-v0.1.zip',
        'PhysicalLab-Arduino-Measurement-Pack-v0.2.zip',
        'PhysicalLab-Arduino-Measurement-Pack-v0.3.zip',
        'PhysicalLab-Hardware-Pack-v0.4.zip',
        'PhysicalLab_UNO_Blink_Test.ino',
    ]:
        assert (old / name).is_file(), name

    # Check exact canonical v0.4 sources against the archived v0.4 ZIP by extracting hashes in-memory.
    import zipfile
    with zipfile.ZipFile(old / 'PhysicalLab-Hardware-Pack-v0.4.zip') as zf:
        for rid, (folder, filename) in EXPECTED.items():
            if rid == 'blink':
                continue
            archived_name = f'PhysicalLab-Hardware-Pack-v0.4/firmware/{folder}/{filename}'
            archived = zf.read(archived_name)
            assert hashlib.sha256(archived).hexdigest() == sha(RES / 'firmware' / folder / filename), archived_name

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
    print('- Physical Lab v0.4 firmware hashes preserved exactly')
    print('- v0.1-v0.4 prior packs archived for provenance')
    print('- full multichannel + Physical Lab v1 compatibility bridge present')
    print('- frontend invoke / Rust handler contract consistent')
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
