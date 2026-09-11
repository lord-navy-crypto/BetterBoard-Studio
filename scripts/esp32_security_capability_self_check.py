#!/usr/bin/env python3
from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TOOL = ROOT / 'scripts' / 'esp32_security_capability.py'


def run_case(fake_esptool: Path) -> dict:
    proc = subprocess.run([
        sys.executable, str(TOOL), '--port', '/dev/ttyTEST0', '--esptool', str(fake_esptool)
    ], text=True, capture_output=True)
    assert proc.returncode == 0, proc.stderr
    return json.loads(proc.stdout)


def main() -> int:
    with tempfile.TemporaryDirectory(prefix='bb-esp32-security-') as tmp_raw:
        tmp = Path(tmp_raw)
        tool = tmp / 'esptool.py'

        tool.write_text(
            '#!/usr/bin/env python3\n'
            'import sys\n'
            'cmd = sys.argv[-1]\n'
            'if cmd == "chip_id": print("Chip is ESP32-S3")\n'
            'elif cmd == "flash_id": print("Detected flash size: 8MB")\n'
            'elif cmd == "security_info": print("Secure boot: Disabled\\nFlash encryption: Disabled\\nDownload mode: Enabled")\n'
            'else: raise SystemExit(2)\n'
        )
        tool.chmod(0o755)
        report = run_case(tool)
        assert report['schema'] == 'betterboard.esp32-security-capability/1'
        assert report['connected'] is True
        assert report['secure_boot_enabled'] is False
        assert report['flash_encryption_enabled'] is False
        assert report['independent_flash_readback_candidate'] is True

        tool.write_text(
            '#!/usr/bin/env python3\n'
            'import sys\n'
            'cmd = sys.argv[-1]\n'
            'if cmd == "chip_id": print("Chip is ESP32-S3")\n'
            'elif cmd == "flash_id": print("Detected flash size: 8MB")\n'
            'elif cmd == "security_info": print("Secure boot: Enabled\\nFlash encryption: Enabled\\nDownload mode: Disabled")\n'
            'else: raise SystemExit(2)\n'
        )
        tool.chmod(0o755)
        locked = run_case(tool)
        assert locked['secure_boot_enabled'] is True
        assert locked['flash_encryption_enabled'] is True
        assert locked['independent_flash_readback_candidate'] is False
        assert 'not a security configuration guarantee' in locked['interpretation']

    print('ESP32 security-capability self-check: PASS')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
