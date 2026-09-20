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
    "component.kind === 'uno' && item.pinId === 'gnd' ? 'gnd1' : item.pinId",
    'Legacy UNO GND references are migrated automatically to GND1.',
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


# UNO R3 pin semantics must match the official PWM set: D3/D5/D6/D9/D10/D11.
for pwm_pin in ["d3", "d5", "d6", "d9", "d10", "d11"]:
    if f"id: '{pwm_pin}'" not in src or "role: 'pwm-io'" not in src[src.index(f"id: '{pwm_pin}'"):src.index(f"id: '{pwm_pin}'") + 140]:
        raise SystemExit(f'UNO R3 PWM pin semantics missing for {pwm_pin}')
d13_start = src.index("id: 'd13'")
if "role: 'digital-io'" not in src[d13_start:d13_start + 160] or "D13~/SCK" in src[d13_start:d13_start + 160]:
    raise SystemExit('UNO R3 D13 must remain digital/SCK, not PWM')

print('Circuit Lab persisted-design correctness contract: OK')
