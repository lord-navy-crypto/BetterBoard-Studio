from pathlib import Path

text = Path('src/ArduinoEcosystemManager.tsx').read_text(encoding='utf-8')

required = [
    'async function loadExamples(libraryName: string)',
    'setRaw(null);',
    "runRead<JsonValue>(epoch, 'List examples', 'arduino_library_examples'",
    "setTarget('');",
    'setTarget(library);',
    'await loadExamples(query.trim() || target.trim());',
    "if (tab === 'examples') {\n      await loadExamples(query);",
    '// A search changes the candidate set.',
    'setOutput(`Board profile is now ${fqbn}. Reload library examples for this board before importing.`);',
    "disabled={busy || (tab === 'examples' && !query.trim() && !target.trim())}",
    'const requestEpochRef = useRef(0);',
    'async function runRead<T>(epoch: number',
    'if (epoch !== requestEpochRef.current) return null;',
    'requestEpochRef.current += 1;',
    'const epoch = ++requestEpochRef.current;',
    'if (epoch === requestEpochRef.current && result !== null) setRaw(result);',
    'if (epoch !== requestEpochRef.current) return;',
    '<button disabled={busy} className={tab ===',
    '<input disabled={busy} value={query}',
    '<input disabled={busy} value={target}',
]

missing = [item for item in required if item not in text]
if missing:
    raise SystemExit('Developer ecosystem target-state contract missing: ' + ', '.join(missing))

load_start = text.index('async function loadExamples')
load_end = text.index('async function refreshInstalled', load_start)
load_body = text[load_start:load_end]
if load_body.index('setRaw(null);') > load_body.index("runRead<JsonValue>(epoch, 'List examples'"):
    raise SystemExit('Examples must clear stale rows before requesting a new library')
if load_body.index("if (result === null)") > load_body.index('setTarget(library);'):
    raise SystemExit('Examples target must become authoritative only after a successful list request')
if 'if (epoch !== requestEpochRef.current) return;' not in load_body:
    raise SystemExit('Examples must discard responses from invalidated board/query contexts')

search_start = text.index('async function search()')
search_end = text.index('async function importExample', search_start)
search_body = text[search_start:search_end]
if "setTarget('');" not in search_body or 'setRaw(null);' not in search_body:
    raise SystemExit('Boards/Libraries search must disarm stale package targets and rows')
if 'const epoch = ++requestEpochRef.current;' not in search_body or 'runRead<JsonValue>(epoch' not in search_body:
    raise SystemExit('Boards/Libraries search results must be bound to the request epoch')

import_start = text.index('async function importExample')
import_end = text.index('async function install()', import_start)
import_body = text[import_start:import_end]
if import_body.count('if (epoch !== requestEpochRef.current) return;') < 2:
    raise SystemExit('Example import must stop after its UI/FQBN context is invalidated')

print('Developer ecosystem target-state contract OK')
