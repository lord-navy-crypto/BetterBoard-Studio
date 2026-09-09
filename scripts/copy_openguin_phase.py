#!/usr/bin/env python3
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]


def replace(path: str, old: str, new: str):
    p = ROOT / path
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'missing patch anchor in {path}: {old[:100]!r}')
    p.write_text(text.replace(old, new, 1))


# Developer run output: one-click copy.
replace(
    'src/DeveloperIDE.tsx',
    "import SketchbookExplorer from './SketchbookExplorer';\n",
    "import SketchbookExplorer from './SketchbookExplorer';\nimport CopyButton from './CopyButton';\n",
)
replace(
    'src/DeveloperIDE.tsx',
    '<div className="panel developer-output-panel"><div className="panel-title"><Play size={18}/> Run output</div><pre className="terminal developer-output">{output}</pre></div>',
    '<div className="panel developer-output-panel"><div className="panel-title panel-title-with-action"><span><Play size={18}/> Run output</span><CopyButton text={output} label="Copy output" /></div><pre className="terminal developer-output">{output}</pre></div>',
)

# Runtime log: copy visible filtered log in chronological order.
replace(
    'src/RuntimeLog.tsx',
    "import type { BackgroundTask } from './TaskCenter';\n",
    "import type { BackgroundTask } from './TaskCenter';\nimport CopyButton from './CopyButton';\n",
)
replace(
    'src/RuntimeLog.tsx',
    "  }))).filter(item => !filter || `${item.category} ${item.title} ${item.line}`.toLowerCase().includes(filter.toLowerCase())).slice(-300).reverse(), [tasks, filter]);\n\n  return <div className=\"panel\" style={{ marginTop: 14 }}>\n    <div className=\"panel-title\" style={{ justifyContent: 'space-between' }}><span style={{ display: 'flex', alignItems: 'center', gap: 7 }}><TerminalSquare size={17}/> Runtime log</span><small className=\"muted\">Task Center / Arduino CLI / monitor / evidence operations</small></div>",
    "  }))).filter(item => !filter || `${item.category} ${item.title} ${item.line}`.toLowerCase().includes(filter.toLowerCase())).slice(-300).reverse(), [tasks, filter]);\n  const copyText = useMemo(() => [...lines].reverse().map(item => `[${item.category}] ${item.title} · ${item.line}`).join('\\n'), [lines]);\n\n  return <div className=\"panel\" style={{ marginTop: 14 }}>\n    <div className=\"panel-title panel-title-with-action\"><span style={{ display: 'flex', alignItems: 'center', gap: 7 }}><TerminalSquare size={17}/> Runtime log</span><span className=\"copy-data-actions\"><small className=\"muted\">Task Center / Arduino CLI / monitor / evidence operations</small><CopyButton text={copyText} label=\"Copy log\" /></span></div>",
)

# Monitor: copy raw/replay data rows without timestamps so pasted content stays CSV-friendly.
replace(
    'src/MonitorDataStudio.tsx',
    "import EngineeringPlot from './EngineeringPlot';\n",
    "import EngineeringPlot from './EngineeringPlot';\nimport CopyButton from './CopyButton';\n",
)
replace(
    'src/MonitorDataStudio.tsx',
    "  const activePrimary = replay?.primary_column ?? recipe?.primary_column;\n\n  const numericRows = useMemo(() => displayRows",
    "  const activePrimary = replay?.primary_column ?? recipe?.primary_column;\n  const serialCopyText = useMemo(() => displayRows.map(row => row.line).join('\\n'), [displayRows]);\n\n  const numericRows = useMemo(() => displayRows",
)
replace(
    'src/MonitorDataStudio.tsx',
    '<div className="panel-title"><TerminalSquare size={18}/> Serial monitor</div>',
    '<div className="panel-title panel-title-with-action"><span><TerminalSquare size={18}/> Serial monitor</span><CopyButton text={serialCopyText} label="Copy data" /></div>',
)

# OpenPenguin: make endpoint explicit and make answers copyable.
replace(
    'src/OpenPenguinBridge.tsx',
    "import { invoke } from '@tauri-apps/api/core';\n",
    "import { invoke } from '@tauri-apps/api/core';\nimport CopyButton from './CopyButton';\n",
)
replace(
    'src/OpenPenguinBridge.tsx',
    "    <p className=\"muted\">Optional loopback-only bridge to OpenPenguin's private local runtime. BetterBoard only connects to <code>127.0.0.1:11435</code>; it does not upload experiment data to a cloud service.</p>\n    <div className=\"action-row\"><button className=\"ghost\" disabled={busy} onClick={() => void probe()}><RefreshCw size={14}/> Connect OpenPenguin</button>{status && <span className={status.found ? 'ok' : 'warn'}>{status.found ? `${status.models.length} local model(s)` : status.error || 'not detected'}</span>}</div>",
    "    <p className=\"muted\">Optional loopback-only bridge to OpenPenguin's private local runtime. BetterBoard never sends this context to a cloud service.</p>\n    <div className=\"facts\"><span>Local endpoint</span><b><code>{status?.endpoint || 'http://127.0.0.1:11435'}</code></b><span>Bridge</span><b>{status?.found ? 'Connected' : 'Not connected'}</b></div>\n    <div className=\"action-row\"><button className=\"ghost\" disabled={busy} onClick={() => void probe()}><RefreshCw size={14}/> Connect / reload OpenPenguin</button>{status && <span className={status.found ? 'ok' : 'warn'}>{status.found ? `${status.models.length} local model(s) loaded` : status.error || 'not detected'}</span>}</div>",
)
replace(
    'src/OpenPenguinBridge.tsx',
    "      {answer && <pre className=\"terminal\" style={{ maxHeight: 260, whiteSpace: 'pre-wrap' }}>{answer}</pre>}\n",
    "      {answer && <><div className=\"copy-data-actions\" style={{ marginTop: 8 }}><CopyButton text={answer} label=\"Copy answer\" /></div><pre className=\"terminal\" style={{ maxHeight: 260, whiteSpace: 'pre-wrap' }}>{answer}</pre></>}\n",
)

# Global OpenPenguin entry/drawer so AI is not hidden inside Developer.
replace(
    'src/main.tsx',
    "import { BookOpen, CircuitBoard, FlaskConical, RadioTower } from 'lucide-react';\n",
    "import { BookOpen, Bot, CircuitBoard, FlaskConical, RadioTower, X } from 'lucide-react';\n",
)
replace(
    'src/main.tsx',
    "import LearningHub from './LearningHub';\n",
    "import LearningHub from './LearningHub';\nimport OpenPenguinBridge from './OpenPenguinBridge';\n",
)
replace(
    'src/main.tsx',
    "import './developer-task.css';\n",
    "import './developer-task.css';\nimport './copy-ai.css';\n",
)
replace(
    'src/main.tsx',
    "  const [tasks, setTasks] = useState<BackgroundTask[]>(readTaskMemory);\n",
    "  const [tasks, setTasks] = useState<BackgroundTask[]>(readTaskMemory);\n  const [aiOpen, setAiOpen] = useState(false);\n",
)
replace(
    'src/main.tsx',
    "  const liveSerial = runningTasks.find(task => task.category === 'Monitor' && /live serial/i.test(task.title));\n\n  function openExperiment",
    "  const liveSerial = runningTasks.find(task => task.category === 'Monitor' && /live serial/i.test(task.title));\n  const openPenguinContext = useMemo(() => [\n    `Workspace: ${workspace}`,\n    `Arduino CLI: ${cli?.found ? 'ready' : 'unavailable'}`,\n    `Board profile: ${fqbn}`,\n    `Hardware: ${selectedPort ? `${activePort?.board_name || 'Board'} · ${selectedPort}` : 'none selected'}`,\n    `Acquisition: ${liveSerial ? 'LIVE' : 'idle'}`,\n    `Running tasks: ${runningTasks.length}`,\n    `Current status: ${latestRunning?.detail || hardwareStatus}`,\n  ].join('\\n'), [workspace, cli?.found, fqbn, selectedPort, activePort?.board_name, liveSerial, runningTasks.length, latestRunning?.detail, hardwareStatus]);\n\n  function openExperiment",
)
replace(
    'src/main.tsx',
    "      <div className={`bb-local-state ${selectedPort ? 'connected' : 'disconnected'}`} title={hardwareStatus}>",
    "      <button className={`bb-ai-launch ${aiOpen ? 'active' : ''}`} onClick={() => setAiOpen(value => !value)} aria-pressed={aiOpen} title=\"Open OpenPenguin local AI bridge\"><Bot size={16}/><span><b>OpenPenguin</b><small>local AI bridge</small></span></button>\n\n      <div className={`bb-local-state ${selectedPort ? 'connected' : 'disconnected'}`} title={hardwareStatus}>",
)
replace(
    'src/main.tsx',
    "    </div>\n\n    <div className=\"bb-workspace-frame\">",
    "    </div>\n\n    <div className=\"bb-ai-drawer-backdrop\" hidden={!aiOpen} onClick={() => setAiOpen(false)} />\n    <aside className=\"bb-ai-drawer\" hidden={!aiOpen} aria-label=\"OpenPenguin local AI bridge\">\n      <div className=\"bb-ai-drawer-head\"><span><Bot size={17}/><b>OpenPenguin · Local AI</b></span><button className=\"ghost mini\" onClick={() => setAiOpen(false)}><X size={13}/> Close</button></div>\n      <OpenPenguinBridge context={openPenguinContext} />\n    </aside>\n\n    <div className=\"bb-workspace-frame\">",
)

# Alpha 0.7 label/version.
replace('src/App.tsx', '<span>Studio · Alpha 0.6</span>', '<span>Studio · Alpha 0.7</span>')
replace('src-tauri/src/lib.rs', 'const APP_VERSION: &str = "0.2.0-alpha.6";', 'const APP_VERSION: &str = "0.2.0-alpha.7";')
replace('src-tauri/Cargo.toml', 'version = "0.2.0-alpha.6"', 'version = "0.2.0-alpha.7"')
replace('src-tauri/Cargo.lock', 'name = "betterboard-studio"\nversion = "0.2.0-alpha.6"', 'name = "betterboard-studio"\nversion = "0.2.0-alpha.7"')

package_path = ROOT / 'package.json'
package = json.loads(package_path.read_text())
package['version'] = '0.2.0-alpha.7'
package_path.write_text(json.dumps(package, indent=2) + '\n')

lock_path = ROOT / 'package-lock.json'
lock = json.loads(lock_path.read_text())
lock['version'] = '0.2.0-alpha.7'
if '' in lock.get('packages', {}):
    lock['packages']['']['version'] = '0.2.0-alpha.7'
lock_path.write_text(json.dumps(lock, indent=2) + '\n')

tauri_path = ROOT / 'src-tauri/tauri.conf.json'
tauri = json.loads(tauri_path.read_text())
tauri['version'] = '0.2.0-alpha.7'
tauri_path.write_text(json.dumps(tauri, indent=2) + '\n')

# No-regression contracts.
self_path = ROOT / 'scripts/self_check.py'
s = self_path.read_text()
s = s.replace("SKETCHBOOK_EXPLORER = ROOT / 'src' / 'SketchbookExplorer.tsx'\n", "SKETCHBOOK_EXPLORER = ROOT / 'src' / 'SketchbookExplorer.tsx'\nCOPY_BUTTON = ROOT / 'src' / 'CopyButton.tsx'\n", 1)
s = s.replace('SMART_EDITOR, ECOSYSTEM_MANAGER, SKETCHBOOK_EXPLORER, DEVELOPER_DRAFT_STORE, IDE_MANAGER_RUST, MAIN,', 'SMART_EDITOR, ECOSYSTEM_MANAGER, SKETCHBOOK_EXPLORER, COPY_BUTTON, DEVELOPER_DRAFT_STORE, IDE_MANAGER_RUST, MAIN,', 1)
anchor = "    for token in ['ide_manager::developer_project_create', 'ide_manager::developer_project_rename', 'ide_manager::developer_project_file_create', 'ide_manager::developer_project_file_rename', 'ide_manager::developer_project_file_delete', 'ide_manager::developer_format_source']:\n        assert token in rust, token\n"
extra = "    # Alpha 0.7: one-click copy surfaces and globally reachable OpenPenguin bridge.\n    assert COPY_BUTTON.is_file()\n    copy_button = COPY_BUTTON.read_text()\n    for token in ['navigator.clipboard', 'execCommand', 'Copied', 'Copy failed']:\n        assert token in copy_button, token\n    for token in ['Copy output', 'CopyButton']:\n        assert token in developer_text, token\n    for token in ['Copy data', 'serialCopyText']:\n        assert token in monitor_text, token\n    runtime_text = RUNTIME_LOG.read_text()\n    assert 'Copy log' in runtime_text and 'CopyButton' in runtime_text\n    for token in ['Connect / reload OpenPenguin', 'Copy answer', 'Local endpoint']:\n        assert token in OPENGUIN_BRIDGE.read_text(), token\n    for token in ['bb-ai-launch', 'bb-ai-drawer', 'OpenPenguinBridge', 'openPenguinContext']:\n        assert token in main_text, token\n"
if anchor not in s:
    raise SystemExit('self_check Alpha 0.6 anchor missing')
s = s.replace(anchor, anchor + extra, 1)
s = s.replace("assert package['version'] == '0.2.0-alpha.6'", "assert package['version'] == '0.2.0-alpha.7'")
s = s.replace("assert tauri['version'] == '0.2.0-alpha.6'", "assert tauri['version'] == '0.2.0-alpha.7'")
s = s.replace("assert '0.2.0-alpha.6' in (ROOT / 'src-tauri' / 'Cargo.toml').read_text()", "assert '0.2.0-alpha.7' in (ROOT / 'src-tauri' / 'Cargo.toml').read_text()")
s = s.replace("print('BetterBoard Studio v0.2.0-alpha.6 self-check: PASS')", "print('BetterBoard Studio v0.2.0-alpha.7 self-check: PASS')")
self_path.write_text(s)

changelog_path = ROOT / 'CHANGELOG.md'
changelog = changelog_path.read_text()
section = '''## 0.2.0-alpha.7\n\n- Added reusable one-click Copy controls with clipboard fallback for Developer run output, Monitor serial/data rows, filtered Runtime Log output, and OpenPenguin answers.\n- Added a top-level **OpenPenguin** launcher and persistent local-AI drawer so the bridge is globally reachable instead of being hidden only inside Developer.\n- OpenPenguin now exposes its loopback endpoint explicitly and uses a **Connect / reload OpenPenguin** action before local model selection.\n- Preserved all Alpha 0.6 IDE parity, experiment, evidence, and hardware-session behavior while adding no-regression contracts for copy/AI entry surfaces.\n\n'''
if '# Changelog\n\n' not in changelog:
    raise SystemExit('changelog header missing')
changelog_path.write_text(changelog.replace('# Changelog\n\n', '# Changelog\n\n' + section, 1))

print('Alpha 0.7 copy/OpenPenguin patch applied')
