from pathlib import Path

backend = Path('src-tauri/src/ide_manager.rs').read_text(encoding='utf-8')
frontend = Path('src/ArduinoEcosystemManager.tsx').read_text(encoding='utf-8')
sketchbook = Path('src/SketchbookExplorer.tsx').read_text(encoding='utf-8')

backend_required = [
    'example_path: Option<String>',
    'example_record_by_path',
    'verified_library_example_dir',
    'library.properties',
    'betterboard_files',
    'betterboard_importable',
    'files.len() >= 32',
    'metadata.len() > 512_000',
    'total_bytes > 2_000_000',
    'pub struct ImportedProjectFile',
    'files: Option<Vec<ImportedProjectFile>>',
    '.importing-',
    'fs::rename(&staging, &dir)',
    'fs::remove_dir_all(&staging)',
    'fn nested_example_source_paths',
    'if file_type.is_symlink() { continue; }',
    'scanned_entries > 4096',
    'let nested_sources = nested_example_source_paths(&dir)?;',
    'import was refused to avoid creating an incomplete project',
]
frontend_required = [
    'Import to Sketchbook',
    'examplePath: null',
    'examplePath: row.examplePath',
    'preparedExampleFiles',
    "invoke<SketchbookEntry>('developer_project_create', { name: projectName, files })",
    'mainCount !== 1',
]
sketchbook_required = [
    "invoke<SketchbookEntry>('developer_project_create', { name, files: null })",
]

missing = [f'backend:{item}' for item in backend_required if item not in backend]
missing += [f'frontend:{item}' for item in frontend_required if item not in frontend]
missing += [f'sketchbook:{item}' for item in sketchbook_required if item not in sketchbook]
if missing:
    raise SystemExit('Developer example import contract missing: ' + ', '.join(missing))

if "example_record_by_path(&raw, &example_path)" not in backend:
    raise SystemExit('Example import must revalidate the requested path against current Arduino CLI results')
if 'declared_name != requested_name' not in backend:
    raise SystemExit('Example import must verify library.properties ownership')
if 'file_type.is_file()' not in backend:
    raise SystemExit('Example preparation must only import regular files')
if 'matches!(ext, "ino" | "h" | "hpp" | "c" | "cpp")' not in backend:
    raise SystemExit('Nested-source inspection must recognize Arduino/C/C++ project source extensions')
if 'nested_sources.join(", ")' not in backend:
    raise SystemExit('Nested-source refusal must identify the source paths that made the import incomplete')
if 'fs::create_dir(&staging)' not in backend or 'fs::rename(&staging, &dir)' not in backend:
    raise SystemExit('Imported project creation must stage before atomic commit')

print('Developer Arduino example import contract OK')
