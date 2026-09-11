#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path


def run(cmd: list[str]) -> tuple[bool, str]:
    proc = subprocess.run(cmd, text=True, capture_output=True)
    text = (proc.stdout + ('\n' if proc.stdout and proc.stderr else '') + proc.stderr).strip()
    return proc.returncode == 0, text


def bool_from_text(text: str, patterns: list[str]) -> bool | None:
    lower = text.lower()
    for pattern in patterns:
        if re.search(pattern, lower):
            return True
    negative = [
        r'not enabled', r'disabled', r'false', r'none', r'0x0\b', r'no secure boot', r'no flash encryption'
    ]
    if any(re.search(pattern, lower) for pattern in negative):
        return False
    return None


def main() -> int:
    ap = argparse.ArgumentParser(description='Record ESP32 security/readback capability without claiming attestation.')
    ap.add_argument('--port', required=True)
    ap.add_argument('--esptool', default=shutil.which('esptool') or shutil.which('esptool.py') or 'esptool.py')
    ap.add_argument('--out', type=Path)
    args = ap.parse_args()

    commands = {
        'chip_id': [args.esptool, '--port', args.port, 'chip_id'],
        'flash_id': [args.esptool, '--port', args.port, 'flash_id'],
        'security_info': [args.esptool, '--port', args.port, 'security_info'],
    }
    probes: dict[str, dict] = {}
    for name, command in commands.items():
        ok, output = run(command)
        probes[name] = {'ok': ok, 'command': command, 'output': output}

    security_text = probes['security_info']['output'] if probes['security_info']['ok'] else ''
    secure_boot = bool_from_text(security_text, [r'secure boot[^\n]*(enabled|true|active)'])
    flash_encryption = bool_from_text(security_text, [r'flash encryption[^\n]*(enabled|true|active)'])
    download_mode_disabled = bool_from_text(
        security_text,
        [r'(uart|download)[^\n]*(disabled|locked)', r'download mode[^\n]*(disabled|locked)'],
    )

    connected = probes['chip_id']['ok'] or probes['flash_id']['ok'] or probes['security_info']['ok']
    independent_readback_candidate = connected and download_mode_disabled is not True and flash_encryption is not True

    report = {
        'schema': 'betterboard.esp32-security-capability/1',
        'collected_at_utc': datetime.now(timezone.utc).isoformat(),
        'port': args.port,
        'connected': connected,
        'secure_boot_enabled': secure_boot,
        'flash_encryption_enabled': flash_encryption,
        'download_mode_disabled_or_locked': download_mode_disabled,
        'independent_flash_readback_candidate': independent_readback_candidate,
        'probes': probes,
        'interpretation': (
            'This is a capability report, not a security configuration guarantee or device attestation. '
            'A true readback-candidate value only means BetterBoard did not observe an obvious blocker in these esptool probes. '
            'Actual readback still has to succeed and match the recorded build regions.'
        ),
    }
    text = json.dumps(report, indent=2) + '\n'
    if args.out:
        args.out.write_text(text)
    print(text, end='')
    return 0 if connected else 2


if __name__ == '__main__':
    raise SystemExit(main())
