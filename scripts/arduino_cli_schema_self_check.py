from pathlib import Path

src = Path('src/ArduinoEcosystemManager.tsx').read_text()

required = {
    'explicit platform wrapper': "recordsFrom(raw, 'platforms')",
    'installed library wrapper': 'installed_libraries',
    'library search wrapper': "'libraries'",
    'examples wrapper': "recordsFrom(raw, 'examples')",
    'nested installed library name': "scalar(library, 'name')",
    'tab switch clears target': "setTarget('')",
    'tab switch clears query': "setQuery('')",
    'example rows do not become execution target': "target: ''",
}

missing = [label for label, token in required.items() if token not in src]
if missing:
    raise SystemExit('Arduino CLI schema contract failed: ' + ', '.join(missing))

for forbidden in ['function flattenRecords(']:
    if forbidden in src:
        raise SystemExit(f'Arduino CLI schema contract failed: generic parser remains: {forbidden}')

print('Arduino CLI schema contract OK')
