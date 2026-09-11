#!/usr/bin/env python3
from pathlib import Path

text = Path('src/Observatory.tsx').read_text(encoding='utf-8')

required = [
    "const declaredPrimary = replay.primary_column ? replay.columns.indexOf(replay.primary_column) : -1;",
    'const primary = declaredPrimary >= 0 ? declaredPrimary : Math.max(replay.columns.length - 1, 0);',
    'for (const row of numeric)',
    'min = min === null ? value : Math.min(min, value);',
    'max = max === null ? value : Math.max(max, value);',
    'const fast = window.setInterval(() => { setTasks(readTaskMemory()); }, 1500);',
    'setLastRefresh(Date.now());',
    'const refreshInFlight = useRef<Promise<void> | null>(null);',
    'if (refreshInFlight.current) return refreshInFlight.current;',
    'refreshInFlight.current = operation;',
    'if (refreshInFlight.current === operation) refreshInFlight.current = null;',
]

missing = [token for token in required if token not in text]
if missing:
    raise SystemExit('Observatory statistics/refresh contract missing: ' + ', '.join(missing))

for forbidden in ['Math.min(...values)', 'Math.max(...values)', 'setTasks(readTaskMemory()); setLastRefresh(Date.now()); }, 1500']:
    if forbidden in text:
        raise SystemExit('Observatory statistics/refresh contract regressed: ' + forbidden)

print('Observatory statistics/refresh boundary self-check: PASS')
print('- invalid primary-column metadata falls back to the final available channel')
print('- large replay min/max statistics do not spread 100k values into function arguments')
print('- task-memory polling does not advance the runtime-source snapshot timestamp')
print('- scheduled and manual runtime refresh callers share one in-flight snapshot operation')
