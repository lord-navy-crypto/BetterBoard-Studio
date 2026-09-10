from pathlib import Path

text = Path('src/ArduinoEcosystemManager.tsx').read_text(encoding='utf-8')

required = [
    'function uninstallTarget(value: string)',
    ".replace(/@[^@]+$/, '')",
    'const normalized = uninstallTarget(target);',
    "{ core: normalized }",
    "{ name: normalized }",
    '`Uninstall package · ${normalized}`',
    'Uninstall strips @version',
]
missing = [item for item in required if item not in text]
if missing:
    raise SystemExit('Developer uninstall target contract missing: ' + ', '.join(missing))

install_start = text.index('async function install()')
install_end = text.index('async function uninstall()', install_start)
install_body = text[install_start:install_end]
if 'target.trim()' not in install_body:
    raise SystemExit('Install must preserve the user-supplied versioned package specification')
if 'uninstallTarget(target)' in install_body:
    raise SystemExit('Install must not strip @version from a valid install specification')

uninstall_start = text.index('async function uninstall()')
uninstall_end = text.index('async function updateIndex()', uninstall_start)
uninstall_body = text[uninstall_start:uninstall_end]
if uninstall_body.index('uninstallTarget(target)') > uninstall_body.index("arduino_core_uninstall"):
    raise SystemExit('Uninstall target must be normalized before choosing command arguments')

print('Developer Arduino uninstall target contract OK')
