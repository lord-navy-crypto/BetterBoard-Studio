from pathlib import Path

root = Path(__file__).resolve().parents[1]
explorer = (root / 'src/SketchbookExplorer.tsx').read_text()

required = [
    ('delete checks backend boolean result', "const deleted = await invoke<boolean>('developer_project_file_delete'" in explorer),
    ('delete refreshes project files', 'const projectFiles = await fetchProjectFiles(selectedDir);' in explorer),
    ('delete returns editor to main ino', 'editor returned to ${main.name}' in explorer and 'onOpenSource(main.source, main.name, selectedDir)' in explorer),
    ('rename failure refreshes filesystem view', 'Sketchbook was refreshed to reflect the actual filesystem state.' in explorer),
]
failed = [name for name, ok in required if not ok]
if failed:
    raise SystemExit('Developer filesystem contract failed: ' + ', '.join(failed))
print('Developer filesystem consistency contract: OK')
