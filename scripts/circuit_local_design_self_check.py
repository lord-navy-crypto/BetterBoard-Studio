#!/usr/bin/env python3
from pathlib import Path

src = Path('src/CircuitLab.tsx').read_text(encoding='utf-8')

required = [
    'function parseStoredCircuitDesign(raw: string): CircuitDesign',
    "root.schema !== 'betterboard.circuit-design/0.1'",
    'saved design is too large to load safely',
    'duplicate component id',
    'unsupported component kind',
    'Number.isFinite(item.x)',
    'duplicate wire id',
    'references missing component',
    'references missing pin',
    'connects a pin to itself',
    'const parsed = parseStoredCircuitDesign(raw);',
    'Loaded and validated the locally saved circuit design.',
    'Could not save design:',
]
missing = [token for token in required if token not in src]
if missing:
    raise SystemExit('Circuit Lab persisted-design contract missing: ' + ', '.join(missing))

if 'const parsed = JSON.parse(raw) as CircuitDesign;' in src:
    raise SystemExit('Circuit Lab regressed to trusting unvalidated persisted design JSON')

save_start = src.index('function saveLocal()')
save_end = src.index('function loadLocal()', save_start)
save_body = src[save_start:save_end]
if 'try {' not in save_body or 'catch (error)' not in save_body:
    raise SystemExit('Circuit Lab local save must handle localStorage failures')

print('Circuit Lab persisted-design correctness contract: OK')
