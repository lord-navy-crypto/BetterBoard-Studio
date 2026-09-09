#!/usr/bin/env python3
from pathlib import Path
import json

root = Path(__file__).resolve().parents[1]

lib_path = root / 'src-tauri/src/lib.rs'
lib = lib_path.read_text()
old = '''            ide_manager::developer_sketchbook_list,
            ide_manager::developer_project_files,
            ide_manager::developer_project_file_save,
'''
new = '''            ide_manager::developer_sketchbook_list,
            ide_manager::developer_project_files,
            ide_manager::developer_project_file_save,
            ide_manager::developer_project_create,
            ide_manager::developer_project_rename,
            ide_manager::developer_project_file_create,
            ide_manager::developer_project_file_rename,
            ide_manager::developer_project_file_delete,
            ide_manager::developer_format_source,
'''
assert old in lib
lib = lib.replace(old, new, 1)
lib = lib.replace('const APP_VERSION: &str = "0.2.0-alpha.5";', 'const APP_VERSION: &str = "0.2.0-alpha.6";', 1)
lib_path.write_text(lib)

app_path = root / 'src/App.tsx'
app = app_path.read_text().replace('<span>Studio · Alpha 0.5</span>', '<span>Studio · Alpha 0.6</span>', 1)
app_path.write_text(app)

package_path = root / 'package.json'
package = json.loads(package_path.read_text())
package['version'] = '0.2.0-alpha.6'
package_path.write_text(json.dumps(package, indent=2) + '\n')

lock_path = root / 'package-lock.json'
lock = json.loads(lock_path.read_text())
lock['version'] = '0.2.0-alpha.6'
if '' in lock.get('packages', {}):
    lock['packages']['']['version'] = '0.2.0-alpha.6'
lock_path.write_text(json.dumps(lock, indent=2) + '\n')

tauri_path = root / 'src-tauri/tauri.conf.json'
tauri = json.loads(tauri_path.read_text())
tauri['version'] = '0.2.0-alpha.6'
tauri_path.write_text(json.dumps(tauri, indent=2) + '\n')

cargo_path = root / 'src-tauri/Cargo.toml'
cargo_path.write_text(cargo_path.read_text().replace('version = "0.2.0-alpha.5"', 'version = "0.2.0-alpha.6"', 1))
cargo_lock = root / 'src-tauri/Cargo.lock'
cargo_lock.write_text(cargo_lock.read_text().replace('name = "betterboard-studio"\nversion = "0.2.0-alpha.5"', 'name = "betterboard-studio"\nversion = "0.2.0-alpha.6"', 1))

self_path = root / 'scripts/self_check.py'
s = self_path.read_text()
s = s.replace(
    "SKETCHBOOK_EXPLORER = ROOT / 'src' / 'SketchbookExplorer.tsx'\n",
    "SKETCHBOOK_EXPLORER = ROOT / 'src' / 'SketchbookExplorer.tsx'\nDEVELOPER_DRAFT_STORE = ROOT / 'src' / 'DeveloperDraftStore.ts'\n",
    1,
)
s = s.replace(
    'SMART_EDITOR, ECOSYSTEM_MANAGER, SKETCHBOOK_EXPLORER, IDE_MANAGER_RUST, MAIN,',
    'SMART_EDITOR, ECOSYSTEM_MANAGER, SKETCHBOOK_EXPLORER, DEVELOPER_DRAFT_STORE, IDE_MANAGER_RUST, MAIN,',
)
needle = '''    for token in ['ide_manager::arduino_core_list', 'ide_manager::arduino_library_list', 'ide_manager::developer_project_files']:
        assert token in rust, token
'''
extra = '''    # Arduino IDE parity Phase 2: durable drafts, project CRUD, formatter, and source navigation.
    assert DEVELOPER_DRAFT_STORE.is_file()
    draft_store = DEVELOPER_DRAFT_STORE.read_text()
    for token in ['betterboard.developer.draft.v1', 'loadDeveloperDraft', 'saveDeveloperDraft', 'clearDeveloperDraft']:
        assert token in draft_store, token
    for token in ['registerDefinitionProvider', 'registerHoverProvider', 'stickyScroll']:
        assert token in smart, token
    for token in ['Draft Recovery', 'autosaved draft', 'developer_format_source', 'Format']:
        assert token in developer_text, token
    for token in ['New project', 'New file', 'developer_project_create', 'developer_project_rename', 'developer_project_file_delete']:
        assert token in sketchbook, token
    for token in ['developer_project_create', 'developer_project_rename', 'developer_project_file_create', 'developer_project_file_rename', 'developer_project_file_delete', 'developer_format_source', 'clang-format']:
        assert token in ide_rust, token
    for token in ['ide_manager::developer_project_create', 'ide_manager::developer_project_rename', 'ide_manager::developer_project_file_create', 'ide_manager::developer_project_file_rename', 'ide_manager::developer_project_file_delete', 'ide_manager::developer_format_source']:
        assert token in rust, token
'''
assert needle in s
s = s.replace(needle, needle + extra, 1)
s = s.replace("assert package['version'] == '0.2.0-alpha.5'", "assert package['version'] == '0.2.0-alpha.6'")
s = s.replace("assert tauri['version'] == '0.2.0-alpha.5'", "assert tauri['version'] == '0.2.0-alpha.6'")
s = s.replace("assert '0.2.0-alpha.5' in (ROOT / 'src-tauri' / 'Cargo.toml').read_text()", "assert '0.2.0-alpha.6' in (ROOT / 'src-tauri' / 'Cargo.toml').read_text()")
s = s.replace("print('BetterBoard Studio v0.2.0-alpha.5 self-check: PASS')", "print('BetterBoard Studio v0.2.0-alpha.6 self-check: PASS')")
self_path.write_text(s)

changelog_path = root / 'CHANGELOG.md'
changelog = changelog_path.read_text()
section = '''## 0.2.0-alpha.6

- Added durable **Developer Draft Recovery** in local app storage. Unsaved source is debounced to a bounded draft and restored after app restart/crash instead of being lost. Explicit Save/Reset remains authoritative and clears the draft.
- Added project-management operations in Sketchbook: create project, rename project (including its required main `.ino`), create source/header files, rename non-main files, and delete non-main files. All operations remain restricted to Arduino/BetterBoard sketchbook roots.
- Added current-file **Go to Definition / F12** for common C/C++ declarations and `#define` symbols, plus Arduino API hover documentation in Monaco.
- Added a real **Format** action backed by `clang-format`; if no formatter executable is available BetterBoard reports that boundary instead of applying a lossy home-grown formatter.
- Preserved Alpha 0.5 persistent panes and engineering axes while extending the IDE no-regression contracts for the new Phase 2 capabilities.

'''
assert '# Changelog\n\n' in changelog
changelog_path.write_text(changelog.replace('# Changelog\n\n', '# Changelog\n\n' + section, 1))
