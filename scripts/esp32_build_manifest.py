#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import subprocess
import tempfile
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / 'src-tauri' / 'resources' / 'recipes' / 'catalog.json'
FIRMWARE_ROOT = ROOT / 'src-tauri' / 'resources' / 'firmware'


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open('rb') as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def run(cmd: list[str]) -> str:
    proc = subprocess.run(cmd, text=True, capture_output=True)
    if proc.returncode != 0:
        raise RuntimeError((proc.stdout + '\n' + proc.stderr).strip())
    return (proc.stdout or proc.stderr).strip()


def recipe_by_id(recipe_id: str) -> dict:
    catalog = json.loads(CATALOG.read_text())
    for recipe in catalog:
        if recipe.get('id') == recipe_id:
            return recipe
    raise SystemExit(f'Unknown recipe: {recipe_id}')


def core_from_fqbn(fqbn: str) -> str:
    parts = fqbn.split(':')
    return ':'.join(parts[:2]) if len(parts) >= 2 else fqbn


def core_version(cli: str, core: str) -> str | None:
    try:
        raw = run([cli, 'core', 'list', '--format', 'json'])
        data = json.loads(raw)
        rows = data if isinstance(data, list) else data.get('platforms', data.get('installed_platforms', []))
        for row in rows or []:
            ident = row.get('id') or row.get('ID') or row.get('platform')
            if ident == core:
                return str(row.get('installed') or row.get('version') or row.get('latest') or '') or None
    except Exception:
        pass
    try:
        text = run([cli, 'core', 'list'])
        for line in text.splitlines():
            if core in line:
                fields = line.split()
                if len(fields) >= 2:
                    return fields[1]
    except Exception:
        pass
    return None


def main() -> int:
    ap = argparse.ArgumentParser(description='Compile one BetterBoard recipe and emit a reproducible build-provenance manifest.')
    ap.add_argument('--recipe', required=True, help='BetterBoard recipe id')
    ap.add_argument('--fqbn', required=True, help='Exact Arduino FQBN')
    ap.add_argument('--arduino-cli', default=shutil.which('arduino-cli') or 'arduino-cli')
    ap.add_argument('--out-dir', type=Path, required=True)
    args = ap.parse_args()

    recipe = recipe_by_id(args.recipe)
    sketch_name = recipe['sketch_name']
    source = FIRMWARE_ROOT / sketch_name / f'{sketch_name}.ino'
    if not source.is_file():
        raise SystemExit(f'Firmware source missing: {source}')

    args.out_dir.mkdir(parents=True, exist_ok=True)
    build_dir = args.out_dir / 'build'
    if build_dir.exists():
        shutil.rmtree(build_dir)
    build_dir.mkdir(parents=True)

    with tempfile.TemporaryDirectory(prefix='betterboard-build-') as tmp:
        sketch_dir = Path(tmp) / sketch_name
        sketch_dir.mkdir()
        sketch_copy = sketch_dir / source.name
        shutil.copy2(source, sketch_copy)

        cli_version = run([args.arduino_cli, 'version'])
        compile_cmd = [
            args.arduino_cli,
            'compile',
            '--fqbn', args.fqbn,
            '--build-path', str(build_dir),
            str(sketch_dir),
        ]
        compile_output = run(compile_cmd)

    artifacts = []
    for path in sorted(p for p in build_dir.rglob('*') if p.is_file()):
        if path.suffix.lower() not in {'.bin', '.elf', '.hex', '.map'}:
            continue
        artifacts.append({
            'path': str(path.relative_to(args.out_dir)),
            'bytes': path.stat().st_size,
            'sha256': sha256_file(path),
        })

    if not artifacts:
        raise RuntimeError('Compile succeeded but no .bin/.elf/.hex/.map build artifacts were found.')

    manifest = {
        'schema': 'betterboard.firmware-build/1',
        'created_at_utc': datetime.now(timezone.utc).isoformat(),
        'producer': 'scripts/esp32_build_manifest.py',
        'recipe': {
            'id': recipe['id'],
            'title': recipe['title'],
            'sketch_name': sketch_name,
        },
        'target': {
            'fqbn': args.fqbn,
            'core': core_from_fqbn(args.fqbn),
            'core_version': core_version(args.arduino_cli, core_from_fqbn(args.fqbn)),
        },
        'toolchain': {
            'arduino_cli': args.arduino_cli,
            'arduino_cli_version': cli_version,
            'compile_command': compile_cmd,
        },
        'source': {
            'repository_path': str(source.relative_to(ROOT)),
            'sha256': sha256_file(source),
            'bytes': source.stat().st_size,
        },
        'artifacts': artifacts,
        'compile_output': compile_output,
        'attestation_boundary': (
            'Artifact hashes identify this local compile output only. They do not prove that a connected ESP32 currently '
            'contains this binary. Device-side attestation would require an independently reported build identifier or flash digest.'
        ),
    }

    manifest_path = args.out_dir / 'firmware_build_manifest.json'
    manifest_path.write_text(json.dumps(manifest, indent=2) + '\n')
    print(manifest_path)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
