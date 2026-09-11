#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TOOL = ROOT / 'scripts' / 'esp32_build_manifest.py'
SOURCE = ROOT / 'src-tauri' / 'resources' / 'firmware' / 'ESP32NumericalResearchSuite' / 'ESP32NumericalResearchSuite.ino'


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> int:
    with tempfile.TemporaryDirectory(prefix='bb-build-manifest-test-') as tmp_raw:
        tmp = Path(tmp_raw)
        fake_cli = tmp / 'arduino-cli'
        fake_cli.write_text(
            '#!/usr/bin/env python3\n'
            'import json, pathlib, sys\n'
            'args = sys.argv[1:]\n'
            'if args == ["version"]:\n'
            '    print("arduino-cli Version: 1.2.3-test")\n'
            'elif args[:3] == ["core", "list", "--format"]:\n'
            '    print(json.dumps([{"id":"esp32:esp32","installed":"3.3.0-test"}]))\n'
            'elif args and args[0] == "compile":\n'
            '    build = pathlib.Path(args[args.index("--build-path") + 1])\n'
            '    build.mkdir(parents=True, exist_ok=True)\n'
            '    (build / "firmware.bin").write_bytes(b"fake-bin\\x00\\x01")\n'
            '    (build / "firmware.elf").write_bytes(b"fake-elf\\x02\\x03")\n'
            '    print("fake compile ok")\n'
            'else:\n'
            '    print("unsupported fake arduino-cli invocation", args, file=sys.stderr)\n'
            '    raise SystemExit(2)\n'
        )
        fake_cli.chmod(0o755)
        out_dir = tmp / 'out'
        subprocess.run([
            sys.executable,
            str(TOOL),
            '--recipe', 'esp32_numerical_suite',
            '--fqbn', 'esp32:esp32:esp32',
            '--arduino-cli', str(fake_cli),
            '--out-dir', str(out_dir),
        ], check=True, text=True, capture_output=True)

        manifest_path = out_dir / 'firmware_build_manifest.json'
        manifest = json.loads(manifest_path.read_text())
        assert manifest['schema'] == 'betterboard.firmware-build/1'
        assert manifest['recipe']['id'] == 'esp32_numerical_suite'
        assert manifest['target']['fqbn'] == 'esp32:esp32:esp32'
        assert manifest['target']['core'] == 'esp32:esp32'
        assert manifest['target']['core_version'] == '3.3.0-test'
        assert manifest['source']['sha256'] == sha256(SOURCE)
        assert manifest['toolchain']['arduino_cli_version'] == 'arduino-cli Version: 1.2.3-test'
        assert {item['path'] for item in manifest['artifacts']} == {'build/firmware.bin', 'build/firmware.elf'}
        for item in manifest['artifacts']:
            artifact = out_dir / item['path']
            assert item['bytes'] == artifact.stat().st_size
            assert item['sha256'] == sha256(artifact)
        assert 'do not prove' in manifest['attestation_boundary']

    print('ESP32 build-manifest self-check: PASS')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
