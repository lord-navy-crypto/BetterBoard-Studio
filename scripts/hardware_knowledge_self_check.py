#!/usr/bin/env python3
from pathlib import Path
import json

root = Path(__file__).resolve().parents[1]
knowledge = (root / 'src' / 'HardwareKnowledge.ts').read_text(encoding='utf-8')
panel = (root / 'src' / 'EspressifCapabilityPanel.tsx').read_text(encoding='utf-8')
experiments = (root / 'src' / 'ExperimentsHub.tsx').read_text(encoding='utf-8')
boards = json.loads((root / 'src-tauri' / 'resources' / 'boards' / 'boards.json').read_text(encoding='utf-8'))

required_tokens = [
    "'Classic ESP32'",
    "'ESP32-S2'",
    "'ESP32-S3'",
    "'ESP32-C3'",
    "'ESP32-C6'",
    "'ESP32-H2'",
    'USB Serial/JTAG capability exists',
    'USB serial identity alone does not reliably identify the MCU variant',
]
missing = [token for token in required_tokens if token not in knowledge and token not in json.dumps(boards)]
if missing:
    raise SystemExit('Hardware knowledge contract missing: ' + ', '.join(missing))

fqbns = {item['fqbn'] for item in boards}
for fqbn in [
    'esp32:esp32:esp32',
    'esp32:esp32:esp32s2',
    'esp32:esp32:esp32s3',
    'esp32:esp32:esp32c3',
    'esp32:esp32:esp32c6',
    'esp32:esp32:esp32h2',
]:
    if fqbn not in fqbns:
        raise SystemExit(f'Missing ESP profile: {fqbn}')

if 'BetterBoard will not infer safe GPIO pins' not in panel:
    raise SystemExit('Capability panel lost electrical safety boundary')
if 'EspressifCapabilityPanel' not in experiments:
    raise SystemExit('Experiments no longer surfaces hardware capability research')
if 'erase' in panel.lower() or 'efuse' in panel.lower():
    raise SystemExit('Capability panel must remain descriptive/read-only')

print('Hardware knowledge self-check: PASS')
print('- generic ESP32/S2/S3/C3/C6/H2 profiles present')
print('- USB transport is described as capability, not exact-board proof')
print('- electrical safety remains board-specific')
print('- capability research is surfaced in Experiments')
