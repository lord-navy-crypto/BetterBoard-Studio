#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'src'

shortcuts = (SRC / 'capabilityShortcuts.ts').read_text()
navigation = (SRC / 'CapabilityNavigationContext.tsx').read_text()
developer = (SRC / 'DeveloperIDE.tsx').read_text()
sketchbook = (SRC / 'SketchbookExplorer.tsx').read_text()
ecosystem = (SRC / 'ArduinoEcosystemManager.tsx').read_text()

required = {
    'developer-new-sketch': ('Developer · New Sketch', 'New'),
    'developer-load-template': ('Developer · Load Recipe Template', 'Load recipe template'),
    'developer-format-source': ('Developer · Format Source', 'Format'),
    'developer-save-sketch': ('Developer · Save Sketch', 'Save'),
    'developer-save-library': ('Developer · Save Source to Library', 'Save to Library'),
    'developer-verify': ('Developer · Verify', 'Verify'),
    'developer-run-upload': ('Developer · Run / Upload', 'Run / Upload'),
    'sketchbook-new-project': ('Sketchbook · New Project', 'New project'),
    'arduino-board-index-url': ('Arduino · Boards Manager URL', 'Additional Boards Manager package index URL'),
}

for shortcut_id, (label, target_text) in required.items():
    assert f"id: '{shortcut_id}'" in shortcuts, f'missing developer action shortcut: {shortcut_id}'
    assert label in shortcuts, f'missing developer action label: {label}'
    assert f"'{shortcut_id}':" in navigation, f'missing developer action semantic fallback: {shortcut_id}'
    assert target_text in navigation, f'navigation no longer targets action surface: {target_text}'

# Direct shortcuts must activate the canonical parent surface first. This is what makes
# Boards/Libraries/Examples and future nested actions work even when Developer is currently
# on Editor, Sketchbook, or another subview.
assert 'parentAnchor' in navigation, 'semantic navigation lost canonical parent activation parameter'
assert 'parentFallback' in navigation, 'semantic navigation lost canonical parent fallback lookup'
assert 'await activateDomTarget(parentFallback)' in navigation, 'child reveal no longer waits for canonical parent activation'
assert 'shortcut ? destination.anchor' in navigation, 'shortcut navigation no longer supplies canonical parent anchor'

# Exact one-word toolbar actions such as Save must not accidentally resolve to Save to Library.
assert 'selectorExactText?: string' in navigation, 'exact button targeting support missing'
assert 'fallback.selectorExactText' in navigation, 'exact button targeting is not used by DOM resolution'

for token in ['New</button>', 'Load recipe template', 'Format</button>', 'Save</button>', 'Save to Library', 'Verify</button>', 'Run / Upload']:
    assert token in developer, f'Developer action disappeared: {token}'
assert 'New project' in sketchbook and 'developer_project_create' in sketchbook, 'Sketchbook project creation workflow missing'
assert 'Additional Boards Manager package index URL' in ecosystem and 'arduino_board_url_add' in ecosystem, 'Boards Manager URL workflow missing'
assert "selectorText: 'Additional Boards Manager package index URL'" in navigation, 'Boards Manager URL shortcut must focus the configuration row instead of executing Add URL'
assert "activationSteps: [{ buttonText: 'Boards', within: '.ide-manager .ide-subtabs' }]" in navigation, 'Boards Manager URL shortcut must activate Boards first'

# Discovery/navigation can point at the actions but must not execute their backends itself.
for forbidden in ['developer_format_source', 'user_recipe_save', 'developer_project_create', 'arduino_board_url_add', 'compile_sketch', 'upload_sketch']:
    assert forbidden not in navigation, f'navigation duplicated backend token: {forbidden}'
    assert forbidden not in shortcuts, f'discovery duplicated backend token: {forbidden}'

print('Developer action surface reachability self-check: PASS')
print('- Developer New/Template/Format/Save/Library/Verify/Run actions are directly discoverable')
print('- Sketchbook New Project and Boards Manager URL are directly discoverable')
print('- Boards Manager URL focuses its configuration row without executing Add URL')
print('- Canonical parent surface activates before nested child targeting')
print('- Exact button matching prevents ambiguous toolbar destinations')
