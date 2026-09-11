#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path


def parse_info_build_id(path: Path) -> str | None:
    for raw in path.read_text(errors='replace').splitlines():
        line = raw.strip()
        if line.startswith('#BUILD_ID,'):
            value = line.split(',', 1)[1].strip()
            return value or None
    return None


def main() -> int:
    ap = argparse.ArgumentParser(description='Compare a BetterBoard firmware build manifest with device INFO output.')
    ap.add_argument('--manifest', type=Path, required=True)
    ap.add_argument('--capture', type=Path, required=True, help='Text capture containing INFO output with #BUILD_ID,<id>')
    args = ap.parse_args()

    manifest = json.loads(args.manifest.read_text())
    expected = manifest.get('build_identity', {}).get('build_id')
    if not expected:
        raise SystemExit('Manifest has no build_identity.build_id (requires betterboard.firmware-build/2).')

    observed = parse_info_build_id(args.capture)
    if not observed:
        raise SystemExit('Capture has no #BUILD_ID line. Firmware may be unstamped or too old for device build identity.')

    result = {
        'schema': 'betterboard.device-build-match/1',
        'expected_build_id': expected,
        'observed_build_id': observed,
        'matched': expected == observed,
        'boundary': (
            'A match means the firmware self-reported the build identity expected by this manifest. '
            'It is not cryptographic device attestation and does not independently hash flash contents.'
        ),
    }
    print(json.dumps(result, indent=2))
    return 0 if result['matched'] else 2


if __name__ == '__main__':
    raise SystemExit(main())
