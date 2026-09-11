#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TOOL = ROOT / 'scripts' / 'esp32_build_manifest.py'
VERIFY = ROOT / 'scripts' / 'esp32_verify_build_identity.py'
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
            '    sketch = pathlib.Path(args[-1])\n'
            '    header = sketch / "BetterBoardBuildProvenance.h"\n'
            '    sources = list(sketch.glob("*.ino"))\n'
            '    if not header.is_file() or len(sources) != 1:\n'
            '        print("missing stamped provenance inputs", file=sys.stderr)\n'
            '        raise SystemExit(3)\n'
            '    source_text = sources[0].read_text()\n'
            '    if "#BUILD_ID," not in source_text or "BetterBoardBuildProvenance.h" not in source_text:\n'
            '        print("source was not build-identity stamped", file=sys.stderr)\n'
            '        raise SystemExit(4)\n'
            '    build.mkdir(parents=True, exist_ok=True)\n'
            '    payload = header.read_bytes() + sources[0].read_bytes()\n'
            '    (build / "firmware.bin").write_bytes(b"fake-bin\\x00" + payload)\n'
            '    (build / "firmware.elf").write_bytes(b"fake-elf\\x02" + payload)\n'
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
        assert manifest['schema'] == 'betterboard.firmware-build/2'
        assert manifest['recipe']['id'] == 'esp32_numerical_suite'
        assert manifest['target']['fqbn'] == 'esp32:esp32:esp32'
        assert manifest['target']['core'] == 'esp32:esp32'
        assert manifest['target']['core_version'] == '3.3.0-test'
        assert manifest['source']['sha256'] == sha256(SOURCE)
        assert manifest['toolchain']['arduino_cli_version'] == 'arduino-cli Version: 1.2.3-test'
        build_id = manifest['build_identity']['build_id']
        assert build_id.startswith('bb-') and len(build_id) == 23
        assert len(manifest['build_identity']['identity_sha256']) == 64
        assert manifest['build_identity']['device_info_contract'] == ['BUILD_ID', 'SOURCE_SHA256', 'BUILD_IDENTITY_SHA256']

        header_path = out_dir / manifest['build_identity']['generated_header']
        header = header_path.read_text()
        assert f'#define BETTERBOARD_BUILD_ID "{build_id}"' in header
        assert manifest['source']['sha256'] in header

        stamped_path = out_dir / manifest['source']['stamped_source_path']
        stamped = stamped_path.read_text()
        assert '#include "BetterBoardBuildProvenance.h"' in stamped
        assert 'Serial.print(F("#BUILD_ID,")); Serial.println(BETTERBOARD_BUILD_ID);' in stamped
        assert 'Serial.print(F("#SOURCE_SHA256,")); Serial.println(BETTERBOARD_SOURCE_SHA256);' in stamped
        assert hashlib.sha256(stamped.encode()).hexdigest() == manifest['source']['stamped_source_sha256']

        assert {item['path'] for item in manifest['artifacts']} == {'build/firmware.bin', 'build/firmware.elf'}
        for item in manifest['artifacts']:
            artifact = out_dir / item['path']
            assert item['bytes'] == artifact.stat().st_size
            assert item['sha256'] == sha256(artifact)
        assert 'self-report' in manifest['attestation_boundary']

        good_capture = tmp / 'good.txt'
        good_capture.write_text(f'#INFO_BEGIN\n#CHIP_MODEL,ESP32-Test\n#BUILD_ID,{build_id}\n#INFO_END\n')
        good = subprocess.run([
            sys.executable, str(VERIFY), '--manifest', str(manifest_path), '--capture', str(good_capture)
        ], text=True, capture_output=True)
        assert good.returncode == 0, good.stderr
        verified = json.loads(good.stdout)
        assert verified['matched'] is True

        bad_capture = tmp / 'bad.txt'
        bad_capture.write_text('#INFO_BEGIN\n#BUILD_ID,bb-deadbeefdeadbeefdead\n#INFO_END\n')
        bad = subprocess.run([
            sys.executable, str(VERIFY), '--manifest', str(manifest_path), '--capture', str(bad_capture)
        ], text=True, capture_output=True)
        assert bad.returncode == 2
        mismatch = json.loads(bad.stdout)
        assert mismatch['matched'] is False

    print('ESP32 build-manifest self-check: PASS')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
