from pathlib import Path

manager = Path('src/ArduinoEcosystemManager.tsx').read_text()
ide = Path('src/DeveloperIDE.tsx').read_text()

checks = {
    'manager requires imported-entry callback': 'onImported: (entry: SketchbookEntry) => boolean;' in manager,
    'import invokes open callback after project creation': 'const opened = onImported(entry);' in manager,
    'import preserves successful disk copy if editor switch is declined': 'current unsaved Developer draft was preserved' in manager,
    'developer routes imported entry through existing project-open guard': 'onImported={entry => openProjectSource(' in ide,
    'project-open guard still protects dirty draft': "if (dirty && !window.confirm('The current unsaved edits are protected by Draft Recovery. Open another project file now?')) return false;" in ide,
    'accepted project open switches to editor': "setView('editor');" in ide,
}

missing = [label for label, ok in checks.items() if not ok]
if missing:
    raise SystemExit('Developer imported-example open contract missing: ' + '; '.join(missing))

print('Developer imported-example open workflow contract OK')
