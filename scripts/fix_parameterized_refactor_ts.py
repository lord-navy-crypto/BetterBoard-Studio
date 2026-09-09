#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
path = ROOT / 'src' / 'App.tsx'
text = path.read_text()

old = '  Search, ShieldCheck, TerminalSquare, TimerReset, Upload, Waves, Wrench,\n'
new = '  Save, Search, ShieldCheck, TerminalSquare, TimerReset, Upload, Waves, Wrench,\n'
assert text.count(old) == 1, 'App lucide import shape changed'
text = text.replace(old, new, 1)

old = " defaultOpen={group === 'My Library' || group === libraryGroupFor(recipe ?? items[0])}"
assert text.count(old) == 1, 'Recipe Library details shape changed'
text = text.replace(old, '', 1)

old = "onLibrarySaved={saved => setRecipes(current => [saved, ...current.filter(item => item.id !== saved.id)])}"
new = "onLibrarySaved={() => { void refresh(); }}"
assert text.count(old) == 1, 'Developer library callback shape changed'
text = text.replace(old, new, 1)
path.write_text(text)

self_path = ROOT / 'scripts' / 'self_check.py'
self_text = self_path.read_text()
old = """    for token in ['Recipe settings', 'Save preset to My Library', 'My Library']:\n        assert token in app_text, token\n"""
new = """    for token in ['Save preset to My Library', 'My Library']:\n        assert token in app_text, token\n    assert 'Recipe settings' in RECIPE_PARAMETERS.read_text()\n"""
assert self_text.count(old) == 1, 'Parameterized recipe self-check shape changed'
self_path.write_text(self_text.replace(old, new, 1))

print('TypeScript and self-check contract fixes applied')
