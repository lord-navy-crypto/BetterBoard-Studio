#!/usr/bin/env python3
"""Compile every canonical BetterBoard firmware recipe without installing anything."""
from __future__ import annotations
import json
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CATALOG = json.loads((ROOT/'src-tauri/resources/recipes/catalog.json').read_text())
FIRMWARE = ROOT/'src-tauri/resources/firmware'
FQBN = sys.argv[1] if len(sys.argv) > 1 else 'arduino:avr:uno'

cli = shutil.which('arduino-cli')
if not cli:
    raise SystemExit('arduino-cli not found; no installation was attempted.')

failed=[]
for recipe in CATALOG:
    sketch=FIRMWARE/recipe['sketch_name']
    print(f"\n=== {recipe['id']} :: {recipe['title']} ===")
    proc=subprocess.run([cli,'compile','--fqbn',FQBN,str(sketch)],text=True,capture_output=True)
    text=(proc.stdout+'\n'+proc.stderr).strip()
    print(text)
    if proc.returncode:
        failed.append(recipe['id'])

print('\n=== SUMMARY ===')
print(f"recipes: {len(CATALOG)}  passed: {len(CATALOG)-len(failed)}  failed: {len(failed)}")
if failed:
    print('failed:', ', '.join(failed))
    print('BetterBoard intentionally does not auto-install missing libraries.')
    raise SystemExit(1)
print('All canonical firmware recipes compiled successfully.')
