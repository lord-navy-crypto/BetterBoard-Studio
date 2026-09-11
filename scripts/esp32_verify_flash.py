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


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open('rb') as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def parse_offset(value: str) -> int:
    return int(value, 0)


def resolve_build_file(build_dir: Path, raw: str) -> Path | None:
    p = Path(raw)
    candidates = []
    if p.is_absolute():
        candidates.append(p)
    else:
        candidates.append(build_dir / p)
        candidates.append(build_dir / p.name)
    for candidate in candidates:
        if candidate.is_file():
            return candidate.resolve()
    return None


def load_flash_regions(manifest_path: Path, manifest: dict) -> tuple[Path, list[dict]]:
    build_dir = manifest_path.parent / 'build'
    if not build_dir.is_dir():
        raise RuntimeError(f'Build directory not found next to manifest: {build_dir}')

    flasher = build_dir / 'flasher_args.json'
    if not flasher.is_file():
        raise RuntimeError(
            'flasher_args.json was not found in the recorded build directory. '
            'Independent flash verification fails closed because flash offsets cannot be inferred safely.'
        )

    data = json.loads(flasher.read_text())
    mapping = data.get('flash_files') or data.get('flashFiles') or data.get('flash_files_map')
    if not isinstance(mapping, dict) or not mapping:
        raise RuntimeError('flasher_args.json has no supported flash_files mapping.')

    regions = []
    for raw_offset, raw_path in mapping.items():
        if not isinstance(raw_path, str):
            continue
        try:
            offset = parse_offset(str(raw_offset))
        except ValueError:
            continue
        expected = resolve_build_file(build_dir, raw_path)
        if expected is None:
            raise RuntimeError(f'Flash image referenced by flasher_args.json is missing: {raw_path}')
        regions.append({
            'offset': offset,
            'offset_hex': hex(offset),
            'expected_path': str(expected),
            'bytes': expected.stat().st_size,
            'expected_sha256': sha256_file(expected),
        })

    if not regions:
        raise RuntimeError('No verifiable flash regions were resolved from flasher_args.json.')
    regions.sort(key=lambda item: item['offset'])
    return flasher, regions


def run(cmd: list[str]) -> str:
    proc = subprocess.run(cmd, text=True, capture_output=True)
    output = (proc.stdout + ('\n' if proc.stdout and proc.stderr else '') + proc.stderr).strip()
    if proc.returncode != 0:
        raise RuntimeError(output or f'Command failed with exit code {proc.returncode}: {cmd}')
    return output


def main() -> int:
    ap = argparse.ArgumentParser(
        description='Independently read ESP32 flash regions and compare them with the exact local build images.'
    )
    ap.add_argument('--manifest', type=Path, required=True, help='firmware_build_manifest.json')
    ap.add_argument('--port', required=True, help='ESP32 serial port used by esptool')
    ap.add_argument('--esptool', default=shutil.which('esptool') or shutil.which('esptool.py') or 'esptool.py')
    ap.add_argument('--out', type=Path, help='Optional JSON verification report path')
    args = ap.parse_args()

    manifest_path = args.manifest.resolve()
    manifest = json.loads(manifest_path.read_text())
    if manifest.get('schema') != 'betterboard.firmware-build/2':
        raise SystemExit('Expected betterboard.firmware-build/2 manifest.')

    flasher_path, regions = load_flash_regions(manifest_path, manifest)
    results = []
    with tempfile.TemporaryDirectory(prefix='betterboard-flash-verify-') as tmp_raw:
        tmp = Path(tmp_raw)
        for index, region in enumerate(regions):
            readback = tmp / f'region-{index:02d}-{region["offset"]:08x}.bin'
            command = [
                args.esptool,
                '--port', args.port,
                'read_flash',
                hex(region['offset']),
                str(region['bytes']),
                str(readback),
            ]
            output = run(command)
            observed_sha = sha256_file(readback)
            results.append({
                **region,
                'observed_sha256': observed_sha,
                'matched': observed_sha == region['expected_sha256'],
                'read_command': command,
                'esptool_output': output,
            })

    matched = bool(results) and all(item['matched'] for item in results)
    report = {
        'schema': 'betterboard.esp32-flash-verification/1',
        'verified_at_utc': datetime.now(timezone.utc).isoformat(),
        'manifest': str(manifest_path),
        'build_id': manifest.get('build_identity', {}).get('build_id'),
        'fqbn': manifest.get('target', {}).get('fqbn'),
        'port': args.port,
        'flasher_args': str(flasher_path),
        'matched': matched,
        'regions': results,
        'evidence_boundary': (
            'This report independently reads the flash byte ranges described by the local Arduino-ESP32 flasher_args.json '
            'and compares their SHA-256 digests with the exact build images. A complete match is stronger than firmware '
            'self-report, but it is not a hardware-rooted or signed attestation. Flash encryption, secure-boot policy, '
            'read protection, bootloader transformations, or unsupported uploader layouts may make this method unavailable; '
            'the verifier fails closed rather than guessing offsets.'
        ),
    }
    text = json.dumps(report, indent=2) + '\n'
    if args.out:
        args.out.write_text(text)
    print(text, end='')
    return 0 if matched else 2


if __name__ == '__main__':
    raise SystemExit(main())
