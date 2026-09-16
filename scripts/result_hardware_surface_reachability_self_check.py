#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'src'

shortcuts = (SRC / 'capabilityShortcuts.ts').read_text()
numerical = (SRC / 'NumericalResultVisualization.tsx').read_text()
magnet = (SRC / 'MagnetResultVisualization.tsx').read_text()
espressif = (SRC / 'EspressifCapabilityPanel.tsx').read_text()

required = {
    'numerical-result-viewer': ('Numerical Analyzer Result Viewer', numerical, 'numerical-result-viewer'),
    'magnet-result-viewer': ('Magnetic Analyzer Result Viewer', magnet, 'magnet-result-viewer'),
    'esp32-core-audit': ('ESP32 / Arduino Core Audit', espressif, 'esp32-core-audit'),
    'esp32-board-details': ('Arduino CLI Board Details', espressif, 'esp32-board-details'),
    'esp32-configuration-risk': ('Board Configuration Risk Audit', espressif, 'esp32-configuration-risk'),
}

for shortcut_id, (label, source, anchor) in required.items():
    assert f"id: '{shortcut_id}'" in shortcuts, f'missing All Tools shortcut: {shortcut_id}'
    assert label in shortcuts, f'missing user-facing shortcut label: {label}'
    assert f'data-capability-anchor="{anchor}"' in source, f'missing stable production anchor: {anchor}'

assert "Open analyzer result" in numerical, 'numerical result viewer lost its file-open action'
assert "Open magnetic analyzer result" in magnet, 'magnetic result viewer lost its file-open action'
assert "arduino_core_list" in espressif, 'ESP32 core audit lost canonical Arduino CLI backend'
assert "arduino_board_details" in espressif, 'ESP32 board-details audit lost canonical Arduino CLI backend'

print('Result + hardware surface reachability self-check: PASS')
print('- Numerical and magnetic analyzer result viewers are directly discoverable')
print('- ESP32 core, board-details and configuration-risk audits are directly discoverable')
print('- Existing analyzer and Arduino CLI backends remain canonical')
