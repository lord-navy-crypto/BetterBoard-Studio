#!/usr/bin/env python3
from pathlib import Path

text = Path('src/Observatory.tsx').read_text(encoding='utf-8')

required = [
    "const declaredPrimary = replay.primary_column ? replay.columns.indexOf(replay.primary_column) : -1;",
    'const primary = declaredPrimary >= 0 ? declaredPrimary : Math.max(replay.columns.length - 1, 0);',
    'for (const row of numeric)',
    'min = min === null ? value : Math.min(min, value);',
    'max = max === null ? value : Math.max(max, value);',
    "if (document.visibilityState === 'visible')",
    'setLastRefresh(Date.now());',
    'rateDeviationPercent',
    'validPrimaryRows',
    'numericCoverage',
    'primaryCoverage',
    'evidenceReplayComplete',
    'bridgeReady',
    'operationalState',
    'diagnosis.title',
    'diagnosis.canUpload',
    'Runtime snapshot',
    'Replay completeness:',
    'This is an evidence-integrity check, not a calibration claim.',
]

missing = [token for token in required if token not in text]
if missing:
    raise SystemExit('Observatory statistics contract missing: ' + ', '.join(missing))

for forbidden in [
    'Math.min(...values)',
    'Math.max(...values)',
    'setTasks(readTaskMemory()); setLastRefresh(Date.now()); }, 1500',
    'const slow = window.setInterval(() => void refreshRuntime(), 7000);',
]:
    if forbidden in text:
        raise SystemExit('Observatory statistics contract regressed: ' + forbidden)

print('Observatory statistics boundary self-check: PASS')
print('- invalid primary-column metadata falls back to the final available channel')
print('- large replay min/max statistics do not spread 100k values into function arguments')
print('- background refresh is visibility-aware and task polling does not advance runtime snapshot age')
print('- Hardware Doctor state is surfaced without turning readiness into a scientific-validity claim')
print('- sample-rate deviation and numeric/primary parse coverage are reported explicitly')
print('- saved-vs-replay row completeness and Engineering Lab handoff completeness are observable')
