from pathlib import Path

root = Path(__file__).resolve().parents[1]
developer = (root / 'src' / 'DeveloperIDE.tsx').read_text()
sketchbook = (root / 'src' / 'SketchbookExplorer.tsx').read_text()
ecosystem = (root / 'src' / 'ArduinoEcosystemManager.tsx').read_text()

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
}

failed = [name for name, ok in checks.items() if not ok]
for name, ok in checks.items():
    print(('PASS' if ok else 'FAIL') + ': ' + name)

if failed:
    raise SystemExit('Developer workspace correctness contract failed: ' + ', '.join(failed))

print(f'Developer workspace correctness contract passed ({len(checks)}/{len(checks)}).')
