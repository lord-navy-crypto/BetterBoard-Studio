#!/usr/bin/env python3
"""Compile BetterBoard firmware recipes compatible with one target FQBN.

This script never installs cores or libraries. It intentionally skips recipes whose
catalog metadata does not declare compatibility with the selected board core.
"""
from __future__ import annotations
import json
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CATALOG = json.loads((ROOT / 'src-tauri/resources/recipes/catalog.json').read_text())
FIRMWARE = ROOT / 'src-tauri/resources/firmware'
FQBN = sys.argv[1] if len(sys.argv) > 1 else 'arduino:avr:uno'


def core_from_fqbn(fqbn: str) -> str:
    parts = fqbn.split(':')
    return ':'.join(parts[:2]) if len(parts) >= 2 else fqbn


def compatible(recipe: dict, core: str) -> bool:
    declared = recipe.get('supported_cores') or []
    if declared:
        return core in declared
    # Canonical recipes predate capability metadata and are currently kept away from
    # ESP32 until a recipe-specific adapter/pin contract is reviewed.
    return core != 'esp32:esp32'


CORE = core_from_fqbn(FQBN)
RECIPES = [recipe for recipe in CATALOG if compatible(recipe, CORE)]
SKIPPED = [recipe for recipe in CATALOG if not compatible(recipe, CORE)]

cli = shutil.which('arduino-cli')
if not cli:
    raise SystemExit('arduino-cli not found; no installation was attempted.')

if not RECIPES:
    raise SystemExit(f'No BetterBoard recipes are declared compatible with core {CORE}.')

print(f'Target FQBN: {FQBN}')
print(f'Target core: {CORE}')
print(f'Compatible recipes: {len(RECIPES)}; skipped incompatible recipes: {len(SKIPPED)}')
if SKIPPED:
    print('Skipped:', ', '.join(recipe['id'] for recipe in SKIPPED))

failed = []
for recipe in RECIPES:
    sketch = FIRMWARE / recipe['sketch_name']
    print(f"\n=== {recipe['id']} :: {recipe['title']} ===")
    proc = subprocess.run(
        [cli, 'compile', '--fqbn', FQBN, str(sketch)],
        text=True,
        capture_output=True,
    )
    text = (proc.stdout + '\n' + proc.stderr).strip()
    print(text)
    if proc.returncode:
        failed.append(recipe['id'])

print('\n=== SUMMARY ===')
print(f"compatible: {len(RECIPES)}  passed: {len(RECIPES) - len(failed)}  failed: {len(failed)}  skipped: {len(SKIPPED)}")
if failed:
    print('failed:', ', '.join(failed))
    print('BetterBoard intentionally does not auto-install missing cores or libraries.')
    raise SystemExit(1)
print(f'All BetterBoard recipes declared compatible with {CORE} compiled successfully.')
