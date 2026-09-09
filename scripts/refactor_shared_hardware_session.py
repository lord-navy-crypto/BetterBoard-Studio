#!/usr/bin/env python3
from __future__ import annotations
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TARGETS = [
    ROOT / 'src' / 'NumericalBenchSuiteV2.tsx',
    ROOT / 'src' / 'MagnetBenchSuiteV2.tsx',
]

IMPORT_OLD = "import { useEffect, useMemo, useState, type CSSProperties } from 'react';"
IMPORT_NEW = "import { useMemo, useState, type CSSProperties } from 'react';"
INVOKE_IMPORT = "import { invoke } from '@tauri-apps/api/core';"
SESSION_IMPORT = "import { useHardwareSession } from './HardwareSession';"

STATE_PATTERN = re.compile(
    r"  const \[ports, setPorts\] = useState<BoardPort\[\]>\(\[\]\);\n"
    r"  const \[profiles, setProfiles\] = useState<BoardProfile\[\]>\(\[\]\);\n"
    r"  const \[selectedPort, setSelectedPort\] = useState\(''\);\n"
    r"  const \[fqbn, setFqbn\] = useState\('arduino:avr:uno'\);\n"
)

REFRESH_PATTERN = re.compile(
    r"  async function refresh\(\) \{.*?\n  \}\n\n  useEffect\(\(\) => \{ refresh\(\); \}, \[\]\);\n",
    re.S,
)

REFRESH_REPLACEMENT = """  async function refresh() {
    setStatus('Refreshing shared hardware session…');
    try {
      await refreshHardware();
      setStatus('Shared hardware session refreshed.');
    } catch (error) {
      setStatus(String(error));
    }
  }
"""

for path in TARGETS:
    text = path.read_text()
    original = text

    if IMPORT_OLD not in text:
        raise SystemExit(f'{path.name}: expected React import not found')
    text = text.replace(IMPORT_OLD, IMPORT_NEW, 1)

    if SESSION_IMPORT not in text:
        if INVOKE_IMPORT not in text:
            raise SystemExit(f'{path.name}: invoke import not found')
        text = text.replace(INVOKE_IMPORT, INVOKE_IMPORT + '\n' + SESSION_IMPORT, 1)

    text, state_count = STATE_PATTERN.subn(
        "  const { ports, profiles, selectedPort, setSelectedPort, fqbn, setFqbn, hardwareStatus, refreshHardware } = useHardwareSession();\n",
        text,
        count=1,
    )
    if state_count != 1:
        raise SystemExit(f'{path.name}: expected exactly one local hardware state block, got {state_count}')

    text, refresh_count = REFRESH_PATTERN.subn(REFRESH_REPLACEMENT, text, count=1)
    if refresh_count != 1:
        raise SystemExit(f'{path.name}: expected exactly one refresh/useEffect block, got {refresh_count}')

    status_snippet = "<div style={{ ...muted, fontSize: 11, marginTop: 10 }}>{status}</div>"
    if status_snippet in text:
        text = text.replace(
            status_snippet,
            "<div style={{ ...muted, fontSize: 11, marginTop: 10 }}>{status} · {hardwareStatus}</div>",
            1,
        )

    if text == original:
        raise SystemExit(f'{path.name}: refactor made no changes')
    if "useEffect(" in text:
        raise SystemExit(f'{path.name}: stale useEffect remains')
    if "setPorts(" in text or "setProfiles(" in text:
        raise SystemExit(f'{path.name}: stale local board catalog setters remain')
    if "invoke<BoardPort[]>('board_list')" in text or "invoke<BoardProfile[]>('board_profiles')" in text:
        raise SystemExit(f'{path.name}: stale board discovery invoke remains')
    if 'useHardwareSession()' not in text:
        raise SystemExit(f'{path.name}: shared hardware session was not inserted')

    path.write_text(text)
    print(f'refactored {path.relative_to(ROOT)}')
