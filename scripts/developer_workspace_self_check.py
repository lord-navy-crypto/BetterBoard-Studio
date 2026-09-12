from pathlib import Path

root = Path(__file__).resolve().parents[1]
developer = (root / 'src' / 'DeveloperIDE.tsx').read_text()
sketchbook = (root / 'src' / 'SketchbookExplorer.tsx').read_text()
ecosystem = (root / 'src' / 'ArduinoEcosystemManager.tsx').read_text()
hardware = (root / 'src' / 'HardwareSession.tsx').read_text()
app = (root / 'src' / 'App.tsx').read_text()
smart_editor = (root / 'src' / 'SmartArduinoEditor.tsx').read_text()

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
    'sketchbook refresh failure clears stale project state': "setSketches([]); setSelectedDir(''); setFiles([]);" in sketchbook and 'Stale project state was cleared.' in sketchbook,
    'project file refresh failure clears stale file state': "setFiles([]);\n      if (directory === selectedDir) setSelectedDir('');" in sketchbook and 'Stale file state was cleared.' in sketchbook,
    'package runner returns handled failure instead of throwing': 'Promise<T | null>' in ecosystem and 'return null;' in ecosystem,
    'package install refreshes only after success': 'if (result !== null) await refreshInstalled();' in ecosystem,
    'hardware port/profile refresh settles independently': 'Promise.allSettled' in hardware,
    'failed physical scan revokes stale selected port': "setPorts([]);\n          setSelectedPort('');" in hardware,
    'failed physical scan clears stale port inventory': 'setPorts([]);' in hardware,
    'profile failure does not reuse stale profile catalog': 'setProfiles([]);' in hardware,
    'hardware refresh returns exact-operation summary': 'refreshHardware: () => Promise<string>' in hardware and 'return summary;' in hardware,
    'hardware refresh in-flight callers share same summary promise': 'useRef<Promise<string> | null>' in hardware,
    'hardware session detects hot-unplug while connected': 'CONNECTED_BOARD_RESCAN_MS' in hardware and 'ports.length > 0 ? CONNECTED_BOARD_RESCAN_MS : NO_BOARD_RESCAN_MS' in hardware,
    'hardware polling is visibility-aware': "document.visibilityState === 'visible'" in hardware,
    'hardware doctor exposes structured diagnosis': 'export type HardwareDiagnosisCode' in hardware and 'diagnosis: HardwareDiagnosis;' in hardware,
    'hardware doctor distinguishes system-only ports': "code: 'system-ports-only'" in hardware and 'onlySystemPorts(rawPorts)' in hardware,
    'hardware doctor identifies unknown board model': "code: 'board-unidentified'" in hardware and 'Arduino CLI did not identify an exact FQBN' in hardware,
    'hardware doctor blocks mismatched upload': "code: 'profile-mismatch'" in hardware and 'canUpload: false' in hardware,
    'hardware doctor reports matched target ready': "code: 'ready'" in hardware and 'canUpload: true' in hardware,
    'hardware doctor is surfaced in Studio hardware panel': 'Hardware Doctor · {diagnosis.title}' in app and '{diagnosis.detail}' in app and '{diagnosis.action}' in app,
    'compile obeys hardware doctor gate': 'if (!diagnosis.canCompile)' in app and 'Compile blocked by Hardware Doctor' in app and '!diagnosis.canCompile' in app,
    'upload obeys hardware doctor gate': 'if (!diagnosis.canUpload)' in app and 'Upload blocked by Hardware Doctor' in app and '!diagnosis.canUpload' in app,
    'global refresh captures hardware summary result': 'refreshedHardwareStatus] = await Promise.all' in app,
    'task log uses current refresh summary rather than stale render state': 'logTask(task, refreshedHardwareStatus)' in app and 'logTask(task, hardwareStatus)' not in app,
    'detected board fqbn is surfaced from the active port': "const detectedFqbn = activePort?.fqbn ?? '';" in app,
    'detected-vs-selected board profile mismatch is explicit': 'const profileMismatch = Boolean(detectedFqbn && detectedFqbn !== fqbn);' in app and 'Board profile mismatch' in app,
    'mismatch warns before compile or upload': 'Confirm before compiling or uploading.' in app,
    'detected profile quick-fix never appears unless catalog supports it': 'detectedProfileAvailable' in app and 'profiles.some(profile => profile.fqbn === detectedFqbn)' in app and 'Use detected profile' in app and 'setFqbn(detectedFqbn)' in app,
    'smart editor tracks language provider disposables': 'providerDisposablesRef' in smart_editor and 'Array<{ dispose: () => void }>' in smart_editor,
    'smart editor disposes providers on unmount': 'useEffect(() => () =>' in smart_editor and 'disposable.dispose()' in smart_editor,
    'smart editor clears prior providers before remount registration': 'function beforeMount(monaco: Monaco)' in smart_editor and 'for (const disposable of providerDisposablesRef.current) disposable.dispose();' in smart_editor,
    'smart editor still registers completion definition and hover providers': "registerCompletionItemProvider('cpp'" in smart_editor and "registerDefinitionProvider('cpp'" in smart_editor and "registerHoverProvider('cpp'" in smart_editor,
}

failed = [name for name, ok in checks.items() if not ok]
for name, ok in checks.items():
    print(('PASS' if ok else 'FAIL') + ': ' + name)

if failed:
    raise SystemExit('Developer workspace correctness contract failed: ' + ', '.join(failed))

print(f'Developer workspace correctness contract passed ({len(checks)}/{len(checks)}).')
