#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'src'

shortcuts = (SRC / 'capabilityShortcuts.ts').read_text()
navigation = (SRC / 'CapabilityNavigationContext.tsx').read_text()
numerical = (SRC / 'NumericalResultVisualization.tsx').read_text()
magnet = (SRC / 'MagnetResultVisualization.tsx').read_text()
espressif = (SRC / 'EspressifCapabilityPanel.tsx').read_text()

required = {
    'numerical-result-viewer': ('Numerical Analyzer Result Viewer', 'Depth Analyzer Results'),
    'magnet-result-viewer': ('Magnetic Analyzer Result Viewer', 'Magnetic Analyzer Results'),
    'esp32-core-audit': ('ESP32 / Arduino Core Audit', 'Installed Arduino core audit'),
    'esp32-board-details': ('Arduino CLI Board Details', 'Arduino CLI board details'),
    'esp32-configuration-risk': ('Board Configuration Risk Audit', 'Board configuration risk audit'),
}

for shortcut_id, (label, selector_text) in required.items():
    assert f"id: '{shortcut_id}'" in shortcuts, f'missing All Tools shortcut: {shortcut_id}'
    assert label in shortcuts, f'missing user-facing shortcut label: {label}'
    assert f"'{shortcut_id}':" in navigation, f'missing semantic deep-link fallback: {shortcut_id}'
    assert f"selectorText: '{selector_text}'" in navigation, f'deep link lost exact surface text: {selector_text}'

assert "Open analyzer result" in numerical, 'numerical result viewer lost its file-open action'
assert "Open magnetic analyzer result" in magnet, 'magnetic result viewer lost its file-open action'
assert "Depth Analyzer Results" in numerical, 'numerical result surface title changed without navigation update'
assert "Magnetic Analyzer Results" in magnet, 'magnetic result surface title changed without navigation update'
assert "arduino_core_list" in espressif, 'ESP32 core audit lost canonical Arduino CLI backend'
assert "arduino_board_details" in espressif, 'ESP32 board-details audit lost canonical Arduino CLI backend'
for title in ['Installed Arduino core audit', 'Arduino CLI board details', 'Board configuration risk audit']:
    assert title in espressif, f'ESP32 audit surface title changed without navigation update: {title}'

print('Result + hardware surface reachability self-check: PASS')
print('- Numerical and magnetic analyzer result viewers are directly discoverable')
print('- ESP32 core, board-details and configuration-risk audits are directly discoverable')
print('- Text-aware deep links target existing owning panels without duplicating backends')
