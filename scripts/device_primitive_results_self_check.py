#!/usr/bin/env python3
"""Protect BetterBoard's device primitive-result protocol and evidence boundary."""

from pathlib import Path
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]


def require(path: Path, message: str) -> str:
    if not path.is_file():
        raise AssertionError(message)
    return path.read_text(encoding="utf-8")


def main() -> int:
    formatter_h = ROOT / "firmware/betterboard-core/src/experiments/PrimitiveResultStream.h"
    formatter_cpp = ROOT / "firmware/betterboard-core/src/experiments/PrimitiveResultStream.cpp"
    parser_ts = ROOT / "src/devicePrimitiveResults.ts"

    header = require(formatter_h, "PrimitiveResultStream header missing")
    formatter = require(formatter_cpp, "PrimitiveResultStream implementation missing")
    parser = require(parser_ts, "device primitive result parser missing")

    for token in (
        "PrimitiveResultStream",
        "void value(",
        "void state(",
    ):
        assert token in header, f"PrimitiveResultStream lost {token}"

    for token in (
        '#BB_PRIMITIVE,1,',
        'output_.print(time_us)',
        'output_.print(state ? 1 : 0)',
    ):
        assert token in formatter, f"PrimitiveResultStream implementation lost {token}"

    for token in (
        "#BB_PRIMITIVE,",
        "parseDevicePrimitiveResult",
        "DevicePrimitiveResult",
        "compareNumericPrimitive",
        "compareStatePrimitive",
        "PARAMETER_MISMATCH",
        "UNBOUND_SOURCE",
        "INSUFFICIENT_ALIGNMENT",
    ):
        assert token in parser, f"device primitive parser/comparison lost {token}"

    tsc = ROOT / "node_modules" / ".bin" / "tsc"
    assert tsc.is_file(), "TypeScript compiler missing; run npm install before the contract suite"

    with tempfile.TemporaryDirectory(prefix="bb-device-primitives-") as temporary:
        out_dir = Path(temporary) / "out"
        subprocess.run(
            [
                str(tsc),
                str(parser_ts),
                "--target", "ES2022",
                "--module", "commonjs",
                "--outDir", str(out_dir),
                "--skipLibCheck",
            ],
            cwd=ROOT,
            check=True,
            capture_output=True,
            text=True,
        )
        emitted = out_dir / "devicePrimitiveResults.js"
        assert emitted.is_file(), "devicePrimitiveResults TypeScript did not emit a testable module"

        node_test = Path(temporary) / "device_primitive_test.cjs"
        node_test.write_text(r'''const device = require(process.argv[2]);

function close(actual, expected, tolerance = 1e-9, label = 'value') {
  if (!Number.isFinite(actual) || Math.abs(actual - expected) > tolerance) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}
function valid(line) {
  const parsed = device.parseDevicePrimitiveResult(line);
  if (!parsed.result || parsed.diagnostic) throw new Error(`valid frame rejected: ${line}`);
  return parsed.result;
}
function reject(line, code) {
  const parsed = device.parseDevicePrimitiveResult(line);
  if (parsed.result || !parsed.diagnostic || parsed.diagnostic.code !== code) {
    throw new Error(`expected ${code} for ${line}`);
  }
}

const rms = valid('#BB_PRIMITIVE,1,rms,magnetic_field,250000,0.18342,,,');
if (rms.timeUs !== 250000 || rms.value !== 0.18342 || rms.state !== null) throw new Error('RMS parse mismatch');
const threshold = valid('#BB_PRIMITIVE,1,threshold,magnetic_field,250000,,1,threshold,0.15');
if (threshold.state !== true || threshold.parameterKey !== 'threshold' || threshold.parameterValue !== '0.15') throw new Error('threshold parse mismatch');
const ordinary = device.parseDevicePrimitiveResult('250000,0.18342');
if (ordinary.result !== null || ordinary.diagnostic !== null) throw new Error('ordinary CSV must bypass primitive parser');

reject('#BB_PRIMITIVE,2,rms,magnetic_field,250000,0.1,,,', 'unsupported-version');
reject('#BB_PRIMITIVE,1,unknown,magnetic_field,250000,0.1,,,', 'unknown-kind');
reject('#BB_PRIMITIVE,1,rms,magnetic_field,-1,0.1,,,', 'invalid-timestamp');
reject('#BB_PRIMITIVE,1,rms,magnetic_field,250000,NaN,,,', 'invalid-value');
reject('#BB_PRIMITIVE,1,threshold,magnetic_field,250000,,2,threshold,0.15', 'invalid-state');
reject('#BB_PRIMITIVE,1,ema,magnetic_field,250000,0.1,,alpha,', 'parameter-pair-mismatch');

const host = [
  { timeS: 0, value: 0 },
  { timeS: 1, value: 1 },
  { timeS: 3, value: 3.5 },
];
const emaResults = [
  valid('#BB_PRIMITIVE,1,ema,signal,0,0,,alpha,0.5'),
  valid('#BB_PRIMITIVE,1,ema,signal,1000000,1,,alpha,0.5'),
  valid('#BB_PRIMITIVE,1,ema,signal,3000000,3.5,,alpha,0.5'),
];
let comparison = device.compareNumericPrimitive({
  host,
  deviceResults: emaResults,
  kind: 'ema',
  source: 'signal',
  expectedParameter: { key: 'alpha', value: 0.5 },
});
if (comparison.status !== 'MATCHABLE' || comparison.alignedCount !== 3) throw new Error('EMA comparison should be matchable');
close(comparison.maxAbsoluteDifference, 0, 1e-12, 'EMA max absolute difference');

const perturbed = [...emaResults.slice(0, 2), valid('#BB_PRIMITIVE,1,ema,signal,3000000,3.6,,alpha,0.5')];
comparison = device.compareNumericPrimitive({
  host,
  deviceResults: perturbed,
  kind: 'ema',
  source: 'signal',
  expectedParameter: { key: 'alpha', value: 0.5 },
});
close(comparison.latestAbsoluteDifference, 0.1, 1e-12, 'EMA latest absolute difference');
close(comparison.maxAbsoluteDifference, 0.1, 1e-12, 'EMA max difference');

const mismatch = device.compareNumericPrimitive({
  host,
  deviceResults: [valid('#BB_PRIMITIVE,1,ema,signal,0,0,,alpha,0.2')],
  kind: 'ema',
  source: 'signal',
  expectedParameter: { key: 'alpha', value: 0.5 },
});
if (mismatch.status !== 'PARAMETER_MISMATCH') throw new Error('EMA parameter mismatch must disable direct scoring');

const unbound = device.compareNumericPrimitive({
  host,
  deviceResults: emaResults,
  kind: 'ema',
  source: 'other_signal',
  expectedParameter: { key: 'alpha', value: 0.5 },
});
if (unbound.status !== 'UNBOUND_SOURCE') throw new Error('unbound source must be explicit');

const thresholdResults = [
  valid('#BB_PRIMITIVE,1,threshold,signal,0,,0,threshold,3'),
  valid('#BB_PRIMITIVE,1,threshold,signal,1000000,,1,threshold,3'),
  valid('#BB_PRIMITIVE,1,threshold,signal,3000000,,1,threshold,3'),
];
const stateComparison = device.compareStatePrimitive({
  host: [{timeS:0,value:0},{timeS:1,value:0},{timeS:3,value:1}],
  deviceResults: thresholdResults,
  kind: 'threshold',
  source: 'signal',
  expectedParameter: { key: 'threshold', value: 3 },
});
if (stateComparison.status !== 'MATCHABLE' || stateComparison.disagreementCount !== 1) throw new Error('threshold state disagreement count');

console.log('Device primitive parser/comparison engine: PASS');
''')
        completed = subprocess.run(
            ["node", str(node_test), str(emitted)],
            cwd=ROOT,
            check=True,
            capture_output=True,
            text=True,
        )
        assert "Device primitive parser/comparison engine: PASS" in completed.stdout

    monitor = require(ROOT / "src/MonitorDataStudio.tsx", "MonitorDataStudio missing")
    observatory = require(ROOT / "src/PrimitiveObservatory.tsx", "PrimitiveObservatory missing")

    assert "parseDevicePrimitiveResult" in monitor, "Monitor primitive routing missing"
    assert "parseNumericRow" in monitor, "raw numeric evidence parser missing"
    assert "bufferedEvidenceRows" in monitor and "parseNumericRow" in monitor, "raw evidence boundary missing"
    assert "devicePrimitive" in monitor, "separate device primitive collection missing"
    assert "DEVICE-DERIVED" in observatory, "DEVICE-DERIVED provenance missing"
    assert "HOST ↔ DEVICE" in observatory, "HOST ↔ DEVICE comparison surface missing"
    assert "deviceResults" in observatory, "PrimitiveObservatory device result prop missing"
    assert "parameter mismatch" in observatory, "parameter mismatch UI missing"
    assert "unbound source" in observatory, "unbound source UI missing"

    print("Device primitive result contract: PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
