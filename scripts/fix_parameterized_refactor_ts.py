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
print('TypeScript contract fixes applied')
