from pathlib import Path

path = Path('src-tauri/src/ide_manager.rs')
text = path.read_text(encoding='utf-8')

required = [
    'let mut main_renamed = false;',
    'Project rename rolled back because the main .ino rename failed',
    'let rollback = fs::rename(&target, &dir);',
    'Project rename rolled back:',
    'Project rename rolled back because the main source could not be read',
    'rollback also failed',
    'Disk state requires manual inspection',
]

missing = [item for item in required if item not in text]
if missing:
    raise SystemExit('Developer rename transaction contract missing: ' + ', '.join(missing))

rename_start = text.index('pub fn developer_project_rename')
rename_end = text.index('pub fn developer_project_file_create', rename_start)
body = text[rename_start:rename_end]

if body.count('fs::rename(&target, &dir)') < 3:
    raise SystemExit('Developer project rename must roll the directory back on every post-directory-rename failure path')

if 'let _ = fs::rename(&new_main, &old_main);' not in body:
    raise SystemExit('Developer project rename must restore the main .ino name before directory rollback')

print('Developer project rename transaction contract OK')
