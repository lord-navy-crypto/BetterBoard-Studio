#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'src'

shortcuts = (SRC / 'capabilityShortcuts.ts').read_text()
navigation = (SRC / 'CapabilityNavigationContext.tsx').read_text()
app = (SRC / 'App.tsx').read_text()

required = {
    'recipe-preset-builder': ('Recipe Preset Builder', 'Save preset to My Library'),
    'my-recipe-library': ('My Recipe Library', 'My Library'),
}

for shortcut_id, (label, selector_text) in required.items():
    assert f"id: '{shortcut_id}'" in shortcuts, f'missing All Tools shortcut: {shortcut_id}'
    assert label in shortcuts, f'missing shortcut label: {label}'
    assert f"'{shortcut_id}':" in navigation, f'missing semantic fallback: {shortcut_id}'
    assert f"selectorText: '{selector_text}'" in navigation, f'missing exact surface selector text: {selector_text}'

assert "emptyFallbackSelector?: string" in navigation, 'semantic navigation lost empty-state fallback support'
assert "emptyFallbackSelector: '[data-capability-anchor=\"recipe-library\"]'" in navigation, 'empty My Library must safely fall back to Recipe Library'
assert "fallback.emptyFallbackSelector" in navigation, 'DOM resolution no longer applies empty-state fallback'

assert "invoke<RecipeSpec>('user_recipe_save'" in app, 'recipe preset workflow lost canonical persistence backend'
assert 'Save preset to My Library' in app, 'recipe preset action is no longer surfaced in Program'
assert "libraryGroupFor(item)" in app and "'My Library'" in app, 'saved user recipes are no longer grouped into My Library'

for forbidden in ['user_recipe_save', 'recipe_catalog']:
    assert forbidden not in navigation, f'navigation layer duplicated recipe backend token: {forbidden}'
    assert forbidden not in shortcuts, f'discovery layer duplicated recipe backend token: {forbidden}'

print('Recipe library surface reachability self-check: PASS')
print('- Recipe Preset Builder is directly discoverable')
print('- Existing My Library groups are directly discoverable and auto-open through ancestor reveal')
print('- Empty My Library safely lands on Recipe Library instead of becoming a dead shortcut')
print('- Recipe persistence stays owned by Studio App')
