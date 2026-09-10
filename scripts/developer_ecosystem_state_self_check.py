from pathlib import Path

text = Path('src/ArduinoEcosystemManager.tsx').read_text(encoding='utf-8')

required = [
    'async function loadExamples(libraryName: string)',
    'setRaw(null);',
    "const result = await run<JsonValue>('List examples', 'arduino_library_examples'",
    "setTarget('');",
    'setTarget(library);',
    'await loadExamples(query.trim() || target.trim());',
    "if (tab === 'examples') {\n      await loadExamples(query);",
    '// A search changes the candidate set.',
    'setOutput(`Board profile is now ${fqbn}. Reload library examples for this board before importing.`);',
    "disabled={busy || (tab === 'examples' && !query.trim() && !target.trim())}",
]

missing = [item for item in required if item not in text]
if missing:
    raise SystemExit('Developer ecosystem target-state contract missing: ' + ', '.join(missing))

load_start = text.index('async function loadExamples')
load_end = text.index('async function refreshInstalled', load_start)
load_body = text[load_start:load_end]
if load_body.index('setRaw(null);') > load_body.index("run<JsonValue>('List examples'"):
    raise SystemExit('Examples must clear stale rows before requesting a new library')
if load_body.index("if (result === null)") > load_body.index('setTarget(library);'):
    raise SystemExit('Examples target must become authoritative only after a successful list request')

search_start = text.index('async function search()')
search_end = text.index('async function importExample', search_start)
search_body = text[search_start:search_end]
if 'setTarget(\'\');' not in search_body or 'setRaw(null);' not in search_body:
    raise SystemExit('Boards/Libraries search must disarm stale package targets and rows')

print('Developer ecosystem target-state contract OK')
