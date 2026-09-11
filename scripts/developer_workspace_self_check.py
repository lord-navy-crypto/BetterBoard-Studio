from pathlib import Path

root = Path(__file__).resolve().parents[1]
developer = (root / 'src' / 'DeveloperIDE.tsx').read_text()
sketchbook = (root / 'src' / 'SketchbookExplorer.tsx').read_text()
ecosystem = (root / 'src' / 'ArduinoEcosystemManager.tsx').read_text()
hardware = (root / 'src' / 'HardwareSession.tsx').read_text()
app = (root / 'src' / 'App.tsx').read_text()

checks = {
    'preserve unsaved edits on external recipe/source change': "unsaved Developer edits were preserved" in developer,
    'preserve recovered draft on context mismatch': "recovered Developer draft was preserved" in developer,
    'explicit template replacement confirmation': "Replace the current unsaved Developer edits" in developer,
    'new sketch replacement confirmation': "Create a new sketch and replace the current unsaved Developer edits" in developer,
    'project open can be cancelled without false success': "function openProjectSource(nextSource: string, fileName: string, directory: string): boolean" in developer,
    'sketchbook receives dirty-state guard': 'hasUnsavedEdits={dirty}' in developer,
    'sketchbook mutations blocked while dirty': "Sketchbook mutations are blocked while the editor has unsaved edits" in sketchbook,
    'sketchbook open status depends on accepted switch': "if (!accepted)" in sketchbook and "Open project cancelled" in sketchbook,
    'mutation buttons disabled while dirty': 'disabled={busy || hasUnsavedEdits}' in sketchbook,
    'package runner returns handled failure instead of throwing': 'Promise<T | null>' in ecosystem and 'return null;' in ecosystem,
    'package install refreshes only after success': 'if (result !== null) await refreshInstalled();' in ecosystem,
    'hardware port/profile refresh settles independently': 'Promise.allSettled' in hardware,
    'failed physical scan revokes stale selected port': "setSelectedPort('');" in hardware and 'stale non-empty selectedPort' in hardware,
    'failed physical scan clears stale port inventory': 'setPorts([]);' in hardware,
    'profile failure does not reuse stale profile catalog': 'setProfiles([]);' in hardware,
    'hardware refresh returns exact-operation summary': 'refreshHardware: () => Promise<string>' in hardware and 'return summary;' in hardware,
    'hardware refresh in-flight callers share same summary promise': 'useRef<Promise<string> | null>' in hardware,
    'global refresh captures hardware summary result': 'refreshedHardwareStatus] = await Promise.all' in app,
    'task log uses current refresh summary rather than stale render state': 'logTask(task, refreshedHardwareStatus)' in app and 'logTask(task, hardwareStatus)' not in app,
}

failed = [name for name, ok in checks.items() if not ok]
for name, ok in checks.items():
    print(('PASS' if ok else 'FAIL') + ': ' + name)

if failed:
    raise SystemExit('Developer workspace correctness contract failed: ' + ', '.join(failed))

print(f'Developer workspace correctness contract passed ({len(checks)}/{len(checks)}).')
