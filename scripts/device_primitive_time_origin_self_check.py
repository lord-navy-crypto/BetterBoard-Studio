#!/usr/bin/env python3
"""Verify all device primitive kinds for one source share the same run time origin."""

from pathlib import Path
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "src/devicePrimitiveResults.ts"
TSC = ROOT / "node_modules/.bin/tsc"


def main() -> int:
    assert SOURCE.is_file(), "devicePrimitiveResults.ts missing"
    assert TSC.is_file(), "TypeScript compiler missing; run npm install first"

    with tempfile.TemporaryDirectory(prefix="bb-device-origin-") as temporary:
        out_dir = Path(temporary) / "out"
        subprocess.run([
            str(TSC), str(SOURCE), "--target", "ES2022", "--module", "commonjs",
            "--outDir", str(out_dir), "--skipLibCheck",
        ], cwd=ROOT, check=True, capture_output=True, text=True)
        emitted = out_dir / "devicePrimitiveResults.js"
        test = Path(temporary) / "origin_test.cjs"
        test.write_text(r'''const device = require(process.argv[2]);
function valid(line) {
  const parsed = device.parseDevicePrimitiveResult(line);
  if (!parsed.result) throw new Error(`frame rejected: ${line}`);
  return parsed.result;
}
const results = [
  valid('#BB_PRIMITIVE,1,rms,signal,0,0,,,'),
  valid('#BB_PRIMITIVE,1,derivative,signal,1000000,2,,,'),
  valid('#BB_PRIMITIVE,1,derivative,signal,3000000,2,,,'),
];
const derivative = device.deviceElapsedPoints(results, 'derivative', 'signal');
if (derivative.length !== 2) throw new Error(`expected 2 derivative points, got ${derivative.length}`);
if (derivative[0].timeS !== 1 || derivative[1].timeS !== 3) {
  throw new Error(`device kinds must share source/run origin; got ${derivative.map(p => p.timeS).join(',')}`);
}
console.log('Device primitive shared time origin: PASS');
''', encoding="utf-8")
        completed = subprocess.run(["node", str(test), str(emitted)], cwd=ROOT, check=True, capture_output=True, text=True)
        assert "Device primitive shared time origin: PASS" in completed.stdout

    print("Device primitive shared time origin contract: PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
