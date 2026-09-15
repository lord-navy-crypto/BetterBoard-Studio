#!/usr/bin/env python3
"""Protect the Host Primitive Observatory numerical, provenance, and UI contract."""

from pathlib import Path
import json
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
engine_path = ROOT / "src" / "PrimitiveObservability.ts"
ui_path = ROOT / "src" / "PrimitiveObservatory.tsx"
monitor_path = ROOT / "src" / "MonitorDataStudio.tsx"

assert engine_path.is_file(), "PrimitiveObservability engine missing"
assert ui_path.is_file(), "PrimitiveObservatory UI missing"
engine = engine_path.read_text()
ui = ui_path.read_text()
monitor = monitor_path.read_text()

for token in (
    "computeHostPrimitiveObservability",
    "derivePrimitiveDefaults",
    "host-derived",
    "sampleStandardDeviation",
    "rmsTrace",
    "derivativeTrace",
    "integralTrace",
    "emaTrace",
    "peakHoldTrace",
    "thresholdStateTrace",
    "hysteresisStateTrace",
    "regression",
    "cusumPositiveTrace",
    "cusumNegativeTrace",
    "meanShiftTrace",
    "non-increasing timestamp",
):
    assert token in engine, f"Primitive engine lost {token}"

for formula in (
    "const dt = current.timeS - previous.timeS;",
    "(current.value - previous.value) / dt",
    "0.5 * (previous.value + current.value) * dt",
    "effectiveParameters.emaAlpha * sample.value + (1 - effectiveParameters.emaAlpha) * emaValue",
    "positive = Math.max(0, positive + (sample.value - referenceMean) - slack);",
    "negative = Math.min(0, negative + (sample.value - referenceMean) + slack);",
    "!hysteresisState && sample.value >= effectiveParameters.hysteresisHigh",
    "hysteresisState && sample.value <= effectiveParameters.hysteresisLow",
):
    assert formula in engine, f"Primitive engine lost numerical invariant: {formula}"

for token in (
    "Host Primitive Observatory",
    "HOST-DERIVED",
    "Online state",
    "Dynamics",
    "Signal conditioning",
    "Decision state",
    "Trend & change",
    "not MCU-emitted results",
    "do not modify the saved raw evidence",
):
    assert token in ui, f"Primitive UI lost {token}"

assert "<PrimitiveObservatory" in monitor, "Monitor & Data no longer mounts PrimitiveObservatory"
assert "samples={channelPoints.map(point => ({ timeS: point.x, value: point.y }))}" in monitor, (
    "Primitive Observatory must consume Monitor's existing selected channelPoints"
)
assert "parseNumericRow" not in ui, "Primitive Observatory must not create a second serial parsing path"

# Execute the production TypeScript engine against known sequences. The repository
# intentionally has no separate JS test framework, so compile this pure module with
# the already-installed TypeScript compiler and exercise the emitted CommonJS module.
tsc = ROOT / "node_modules" / ".bin" / "tsc"
assert tsc.is_file(), "TypeScript compiler missing; run npm install before the contract suite"

with tempfile.TemporaryDirectory(prefix="bb-primitive-observability-") as temporary:
    out_dir = Path(temporary) / "out"
    subprocess.run(
        [
            str(tsc),
            str(engine_path),
            "--target", "ES2020",
            "--module", "commonjs",
            "--outDir", str(out_dir),
            "--skipLibCheck",
        ],
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
    )
    emitted = out_dir / "PrimitiveObservability.js"
    assert emitted.is_file(), "PrimitiveObservability TypeScript did not emit a testable module"

    node_test = Path(temporary) / "primitive_test.cjs"
    node_test.write_text(r'''const engine = require(process.argv[2]);

function close(actual, expected, tolerance = 1e-9, label = 'value') {
  if (!Number.isFinite(actual) || Math.abs(actual - expected) > tolerance) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

const samples = [
  { timeS: 0, value: 0 },
  { timeS: 1, value: 2 },
  { timeS: 3, value: 6 },
];
const parameters = {
  emaAlpha: 0.5,
  threshold: 3,
  hysteresisLow: 1,
  hysteresisHigh: 4,
  regressionWindow: 3,
  cusumReferenceMean: 0,
  cusumSlack: 0,
  cusumThreshold: 100,
  meanShiftWindow: 4,
  meanShiftThreshold: 1,
};
const result = engine.computeHostPrimitiveObservability(samples, parameters);
if (result.origin !== 'host-derived') throw new Error('origin must be host-derived');
if (result.sampleCount !== 3) throw new Error(`sample count: ${result.sampleCount}`);
close(result.statistics.mean, 8 / 3, 1e-12, 'mean');
close(result.statistics.sampleStandardDeviation, Math.sqrt(28 / 3), 1e-12, 'sample std');
close(result.rms, Math.sqrt(40 / 3), 1e-12, 'rms');
if (result.derivativeTrace.length !== 2) throw new Error('derivative trace length');
close(result.derivativeTrace[0].value, 2, 1e-12, 'derivative 1');
close(result.derivativeTrace[1].value, 2, 1e-12, 'derivative irregular dt');
if (result.integralTrace.length !== 3) throw new Error('integral trace length');
close(result.integralTrace[1].value, 1, 1e-12, 'integral 1');
close(result.integralTrace[2].value, 9, 1e-12, 'integral irregular dt');
close(result.emaTrace[0].value, 0, 1e-12, 'ema initialization');
close(result.emaTrace[1].value, 1, 1e-12, 'ema recurrence 1');
close(result.emaTrace[2].value, 3.5, 1e-12, 'ema recurrence 2');
if (result.peakHoldTrace.map(point => point.value).join(',') !== '0,2,6') throw new Error('peak hold envelope');
if (result.thresholdStateTrace.map(point => point.value).join(',') !== '0,0,1') throw new Error('threshold latch');
if (result.hysteresisStateTrace.map(point => point.value).join(',') !== '0,0,1') throw new Error('hysteresis memory');
close(result.regression.slope, 2, 1e-12, 'regression slope');
close(result.regression.intercept, 0, 1e-12, 'regression intercept');
close(result.regression.rSquared, 1, 1e-12, 'regression r2');

const step = engine.computeHostPrimitiveObservability([
  { timeS: 0, value: 0 }, { timeS: 1, value: 0 },
  { timeS: 2, value: 10 }, { timeS: 3, value: 10 },
], { ...parameters, meanShiftWindow: 4, meanShiftThreshold: 5, cusumThreshold: 5 });
if (step.meanShiftTrace.length !== 1) throw new Error('mean shift readiness');
close(step.meanShiftTrace[0].value, 10, 1e-12, 'mean shift');
if (step.meanShiftEvents.length !== 1) throw new Error('mean shift event');
if (step.cusumEvents.length < 1) throw new Error('CUSUM step alarm');

const badTime = engine.computeHostPrimitiveObservability([
  { timeS: 0, value: 0 }, { timeS: 0, value: 1 }, { timeS: 1, value: 2 },
], parameters);
if (!badTime.warnings.some(value => value.includes('non-increasing timestamp'))) {
  throw new Error('non-increasing timestamp warning missing');
}
if (badTime.derivativeTrace.length !== 1) throw new Error('invalid dt transition was not omitted');

const invalidHysteresis = engine.computeHostPrimitiveObservability(samples, {
  ...parameters, hysteresisLow: 4, hysteresisHigh: 1,
});
if (invalidHysteresis.hysteresisReady || invalidHysteresis.hysteresisStateTrace.length) {
  throw new Error('invalid hysteresis bounds must be unavailable');
}

console.log('Primitive observability numerical engine: PASS');
''')
    completed = subprocess.run(
        ["node", str(node_test), str(emitted)],
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
    )
    assert "Primitive observability numerical engine: PASS" in completed.stdout

print("Primitive observability contract: PASS")
