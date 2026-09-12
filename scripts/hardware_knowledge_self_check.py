#!/usr/bin/env python3
from pathlib import Path
import json

root = Path(__file__).resolve().parents[1]
knowledge = (root / 'src' / 'HardwareKnowledge.ts').read_text(encoding='utf-8')
panel = (root / 'src' / 'EspressifCapabilityPanel.tsx').read_text(encoding='utf-8')
experiments = (root / 'src' / 'ExperimentsHub.tsx').read_text(encoding='utf-8')
boards = json.loads((root / 'src-tauri' / 'resources' / 'boards' / 'boards.json').read_text(encoding='utf-8'))
inspection = (root / 'src-tauri' / 'src' / 'board_inspection.rs').read_text(encoding='utf-8')
lib_rs = (root / 'src-tauri' / 'src' / 'lib.rs').read_text(encoding='utf-8')

required_tokens = [
    "'Classic ESP32'", "'ESP32-S2'", "'ESP32-S3'", "'ESP32-C3'", "'ESP32-C6'", "'ESP32-H2'",
    'USB Serial/JTAG capability exists',
    'USB serial identity alone does not reliably identify the MCU variant',
    'Flash size', 'Flash mode / flash frequency', 'Partition scheme', 'PSRAM configuration',
    'USB mode / CDC / DFU on boot', 'Upload transport and upload speed', 'CPU frequency',
    'Read-only inspection should be the default',
    'Arduino CLI board details', 'Arduino CLI FAQ', 'Arduino ESP32 Tools Menu', 'USB CDC and DFU Flashing',
    "impact: 'electrical'", "severity: 'high'", 'parseFqbnOptions',
]
missing = [token for token in required_tokens if token not in knowledge and token not in json.dumps(boards)]
if missing:
    raise SystemExit('Hardware knowledge contract missing: ' + ', '.join(missing))

fqbns = {item['fqbn'] for item in boards}
for fqbn in [
    'esp32:esp32:esp32', 'esp32:esp32:esp32s2', 'esp32:esp32:esp32s3',
    'esp32:esp32:esp32c3', 'esp32:esp32:esp32c6', 'esp32:esp32:esp32h2',
]:
    if fqbn not in fqbns:
        raise SystemExit(f'Missing ESP profile: {fqbn}')

panel_required = [
    'BetterBoard will not infer safe GPIO pins',
    'Board configuration risk audit',
    'Read-only inspection policy',
    'Runtime serial baud and upload transport/speed are separate settings',
    'Unresolved configuration', 'High-impact unresolved', 'Research basis',
    'Installed Arduino core audit', "invoke<unknown>('arduino_core_list')",
    'Arduino CLI board details', "invoke<unknown>('arduino_board_details', { fqbn })",
    'config_options', 'build_properties', 'identification_properties',
    'Selected FQBN options', 'parseFqbnOptions(fqbn)',
    'Board-details evidence can resolve target configuration questions',
]
for token in panel_required:
    if token not in panel:
        raise SystemExit('Capability panel lost research boundary: ' + token)

inspection_required = [
    'pub fn arduino_board_details',
    'board", "details", "-b"',
    'validated_fqbn',
    '"--json"',
    '"--format", "json"',
]
for token in inspection_required:
    if token not in inspection:
        raise SystemExit('Board-details backend contract missing: ' + token)

for token in ['mod board_inspection;', 'board_inspection::arduino_board_details']:
    if token not in lib_rs:
        raise SystemExit('Board-details command is not registered: ' + token)

if 'EspressifCapabilityPanel' not in experiments:
    raise SystemExit('Experiments no longer surfaces hardware capability research')

for forbidden in ['erase_flash', 'write_flash', 'burn_efuse', 'espefuse.py', 'esptool.py write_flash']:
    if forbidden in panel.lower() or forbidden in knowledge.lower() or forbidden in inspection.lower():
        raise SystemExit('Capability research must remain descriptive/read-only: ' + forbidden)

print('Hardware knowledge self-check: PASS')
print('- generic ESP32/S2/S3/C3/C6/H2 profiles present')
print('- USB transport is capability evidence, not exact-board proof')
print('- flash/partition/PSRAM/USB/upload/CPU questions remain explicit')
print('- configuration questions carry impact and severity')
print('- explicit FQBN board-menu options are parsed')
print('- first-party Arduino/Espressif research basis is surfaced')
print('- installed Arduino core inventory remains read-only')
print('- Arduino board details are inspected read-only and surfaced as target metadata')
print('- physical-board truth remains separate from Arduino target defaults')
print('- electrical safety remains board-specific')
