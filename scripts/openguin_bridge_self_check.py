#!/usr/bin/env python3
from pathlib import Path

text = Path('src-tauri/src/openguin_bridge.rs').read_text(encoding='utf-8')

required = [
    'const MAX_RESPONSE_BYTES: u64 = 8 * 1024 * 1024;',
    '.take(MAX_RESPONSE_BYTES + 1)',
    'raw.len() as u64 > MAX_RESPONSE_BYTES',
    'response exceeded the {} MiB bridge limit',
    'let (port, models) = active_runtime()?;',
    'models.iter().any(|available| available == model)',
    'The selected local model is no longer available on the active runtime.',
    'Ipv4Addr::LOCALHOST',
    '#[tauri::command(async)]\npub fn openguin_probe()',
    '#[tauri::command(async)]\npub fn openguin_generate(',
]

missing = [token for token in required if token not in text]
if missing:
    raise SystemExit('OpenPenguin bridge boundary contract missing: ' + ', '.join(missing))

if 'stream.read_to_end(&mut raw)' in text:
    raise SystemExit('OpenPenguin bridge regressed to an unbounded raw response read')

print('OpenPenguin bridge boundary self-check: PASS')
print('- local HTTP response bytes are bounded before parsing')
print('- generation is restricted to models reported by the active runtime')
print('- blocking local-runtime commands are dispatched off the Tauri main thread')
print('- loopback-only runtime addressing remains intact')
