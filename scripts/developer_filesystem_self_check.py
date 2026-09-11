from pathlib import Path

root = Path(__file__).resolve().parents[1]
explorer = (root / 'src' / 'SketchbookExplorer.tsx').read_text()
backend = (root / 'src-tauri' / 'src' / 'ide_manager.rs').read_text()

required = [
    ('delete checks backend boolean result', "const deleted = await invoke<boolean>('developer_project_file_delete'" in explorer),
    ('delete refreshes project files', 'const projectFiles = await fetchProjectFiles(selectedDir);' in explorer),
    ('delete returns editor to main ino', 'editor returned to ${main.name}' in explorer and 'onOpenSource(main.source, main.name, selectedDir)' in explorer),
    ('rename failure refreshes filesystem view', 'Sketchbook was refreshed to reflect the actual filesystem state.' in explorer),
    ('project file symlinks are rejected', 'Project file symlinks are not allowed' in backend and 'fs::symlink_metadata(&path)' in backend),
    ('sketchbook listing avoids symlink-backed main files', 'regular_file_without_symlink(&preferred)' in backend),
    ('project file listing skips symlinks', 'file_type.is_symlink() || !file_type.is_file()' in backend),
    ('project file save refuses externally removed or replaced files', 'Project file no longer exists as a regular file' in backend and 'regular_file_without_symlink(&path)' in backend),
    ('project file rename requires a regular file', 'Project file not found as a regular file' in backend),
    ('project file delete rejects non-regular files', 'Project file is not a regular file' in backend),
]
failed = [name for name, ok in required if not ok]
for name, ok in required:
    print(('PASS' if ok else 'FAIL') + ': ' + name)
if failed:
    raise SystemExit('Developer filesystem contract failed: ' + ', '.join(failed))
print(f'Developer filesystem consistency contract: OK ({len(required)}/{len(required)})')
