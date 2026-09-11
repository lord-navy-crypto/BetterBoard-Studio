#!/usr/bin/env python3
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TOOL = ROOT / 'scripts' / 'esp32_attestation_capabilities.py'


def run(fqbn: str) -> dict:
    proc = subprocess.run([sys.executable, str(TOOL), '--fqbn', fqbn], text=True, capture_output=True, check=True)
    return json.loads(proc.stdout)


def main() -> int:
    s3 = run('esp32:esp32:esp32s3')
    assert s3['schema'] == 'betterboard.esp32-attestation-capability/1'
    assert s3['family'] == 'ESP32-S3'
    assert s3['hmac_efuse_key'] == 'supported'
    assert s3['rsa_ds'] == 'supported'
    assert s3['public_key_attestation_candidate'] is True
    assert s3['prototype_attestation_level'] == 'hardware-key-backed-prototype-candidate'

    c3 = run('esp32:esp32:esp32c3')
    assert c3['family'] == 'ESP32-C3'
    assert c3['hmac_efuse_key'] == 'supported'
    assert c3['rsa_ds'] == 'supported'
    assert c3['challenge_response_candidate'] is True

    classic = run('esp32:esp32:esp32')
    assert classic['family'] == 'ESP32'
    assert classic['public_key_attestation_candidate'] is False
    assert 'revision-dependent' in classic['secure_boot_v2']
    assert classic['prototype_attestation_level'] == 'no-hardware-key-attestation-claim'

    unknown = run('esp32:esp32:futurechip')
    assert unknown['known_profile'] is False
    assert unknown['prototype_attestation_level'] == 'unsupported-until-characterized'

    print('ESP32 attestation-capability self-check: PASS')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
