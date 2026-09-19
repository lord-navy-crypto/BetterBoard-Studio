#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'src'

shortcuts = (SRC / 'capabilityShortcuts.ts').read_text()
navigation = (SRC / 'CapabilityNavigationContext.tsx').read_text()
app = (SRC / 'App.tsx').read_text()

required = {
    'recipe-preflight-check': ('Recipe · Check Core & Libraries', 'Check core & libraries'),
    'program-prepare-firmware': ('Program · Prepare Firmware', 'Prepare firmware'),
    'program-compile': ('Program · Compile', 'Compile'),
    'program-compile-upload': ('Program · Compile & Upload', 'Compile & Upload'),
}

for shortcut_id, (label, button_text) in required.items():
    assert f"id: '{shortcut_id}'" in shortcuts, f'missing Program action shortcut: {shortcut_id}'
    assert label in shortcuts, f'missing Program action label: {label}'
    assert f"'{shortcut_id}':" in navigation, f'missing Program action semantic fallback: {shortcut_id}'
    assert f"selectorExactText: '{button_text}'" in navigation, f'Program action must target exact button text: {button_text}'

for token in ['Check core & libraries', 'Prepare firmware', 'Compile</button>', 'Compile & Upload']:
    assert token in app, f'Program action disappeared from Studio: {token}'

# The All Tools route may focus these controls, but execution stays in Studio App and remains
# subject to busy/hardware/preflight gates. Never compile, upload, prepare, or preflight on navigation.
for forbidden in ['recipe_preflight', 'prepare_firmware', 'compile_sketch', 'upload_sketch']:
    assert forbidden not in navigation, f'navigation duplicated Program backend token: {forbidden}'
    assert forbidden not in shortcuts, f'discovery duplicated Program backend token: {forbidden}'

assert "targetCapabilityId: 'recipe-preflight'" in shortcuts, 'preflight action must reuse canonical recipe-preflight owner'
for shortcut_id in ['program-prepare-firmware', 'program-compile', 'program-compile-upload']:
    marker = f"id: '{shortcut_id}'"
    start = shortcuts.index(marker)
    block = shortcuts[start:start + 520]
    assert "targetCapabilityId: 'program-firmware'" in block, f'{shortcut_id} must reuse canonical Program owner'

print('Program action surface reachability self-check: PASS')
print('- Preflight, Prepare, Compile and Compile & Upload are directly discoverable')
print('- Action shortcuts target exact existing controls')
print('- Navigation never executes Program backends or bypasses hardware gates')
