#!/usr/bin/env python3
from pathlib import Path
import re

root = Path(__file__).resolve().parents[1]
app_path = root / 'src' / 'App.tsx'
app = app_path.read_text()

old_import = "import TaskCenterPanel, { type BackgroundTask, type TaskCategory, type TaskState } from './TaskCenter';\nimport { useHardwareSession } from './HardwareSession';"
new_import = "import { useHardwareSession } from './HardwareSession';\nimport { useTaskRuntime } from './TaskRuntime';"
assert app.count(old_import) == 1, 'App task imports changed unexpectedly'
app = app.replace(old_import, new_import)

# Remove App-owned storage constant + restore helper exactly from const through helper closing brace.
pattern = re.compile(r"\nconst TASK_MEMORY_KEY = 'betterboard\.task-center\.v1';\n.*?\nfunction restoreTaskMemory\(\): BackgroundTask\[\] \{.*?\n\}\n\nexport default function App\(\) \{", re.S)
match = pattern.search(app)
assert match, 'Could not locate App-owned Task Center restore block'
# Preserve iconFor/libraryGroupFor by only removing constant and helper independently instead.
block = match.group(0)
icon_start = block.find('\nconst iconFor')
assert icon_start > 0, 'iconFor unexpectedly missing inside matched region'
prefix = block[:icon_start]
rest = block[icon_start:]
prefix = "\n"
restore_start = rest.find('\nfunction restoreTaskMemory')
assert restore_start > 0
restore_end = rest.find('\n\nexport default function App() {', restore_start)
assert restore_end > restore_start
rest = rest[:restore_start] + '\n\nexport default function App() {' + rest[restore_end + len('\n\nexport default function App() {'):]
app = app[:match.start()] + prefix + rest + app[match.end():]

old_state = "  const [measurement, setMeasurement] = useState<MeasurementResult | null>(null);\n  const [tasks, setTasks] = useState<BackgroundTask[]>(restoreTaskMemory);\n  const {\n    ports, profiles, selectedPort, setSelectedPort, fqbn, setFqbn,\n    activePort, hardwareStatus, refreshHardware,\n  } = useHardwareSession();"
new_state = "  const [measurement, setMeasurement] = useState<MeasurementResult | null>(null);\n  const {\n    ports, profiles, selectedPort, setSelectedPort, fqbn, setFqbn,\n    activePort, hardwareStatus, refreshHardware,\n  } = useHardwareSession();\n  const { addTask, logTask, finishTask } = useTaskRuntime();"
assert app.count(old_state) == 1, 'App task state block changed unexpectedly'
app = app.replace(old_state, new_state)

start = app.find("\n  useEffect(() => {\n    if (typeof localStorage === 'undefined') return;")
assert start >= 0, 'Task persistence effect not found'
end_marker = "\n  async function refresh() {"
end = app.find(end_marker, start)
assert end > start, 'Could not find refresh after App task helpers'
removed = app[start:end]
for token in ['setTasks', 'function addTask', 'function logTask', 'function finishTask', 'async function cancelTask', 'function clearFinishedTasks']:
    assert token in removed, f'Expected App-local task helper missing: {token}'
app = app[:start] + '\n' + app[end:]

old_panel = "\n      <TaskCenterPanel tasks={tasks} onCancel={cancelTask} onClearFinished={clearFinishedTasks}/>"
assert app.count(old_panel) == 1, 'App-local Task Center panel not found exactly once'
app = app.replace(old_panel, '')

for forbidden in ['TASK_MEMORY_KEY', 'restoreTaskMemory', 'setTasks(', 'TaskCenterPanel', 'BackgroundTask', 'TaskCategory', 'TaskState', 'cancelTask(', 'clearFinishedTasks']:
    assert forbidden not in app, f'App still owns global task runtime token: {forbidden}'
for required in ['useTaskRuntime', 'addTask', 'logTask', 'finishTask', '<MonitorDataStudio', '<DeveloperIDE']:
    assert required in app, f'App lost required integration token: {required}'

app_path.write_text(app)
print('App.tsx global Task Runtime refactor: PASS')
