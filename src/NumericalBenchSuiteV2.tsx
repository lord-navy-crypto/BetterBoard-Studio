import { useMemo, useState, type CSSProperties } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useHardwareSession } from './HardwareSession';
import { Activity, BarChart3, CheckCircle2, CircleAlert, Cpu, Database, Play, RefreshCw, Save, Sigma, Upload, Waves } from 'lucide-react';

type MeasurementResult = {
  directory: string;
  csv_path: string;
  metadata_path: string;
  physical_lab_csv_path: string;
  physical_lab_bridge_path: string;
  samples: number;
};
type CaptureResult = { lines: string[]; numeric_rows: number; ignored_rows: number };
type Mode = 'bench01' | 'bench02' | 'bench03';

type Bench02Convergence = {
  factor: number;
  samples: number;
  effectiveRateHz: number | null;
  trapezoidIntegral: number;
  integralDeltaVsFine: number;
  relativeIntegralDeltaVsFine: number | null;
  derivativeRmseVsFine: number | null;
};

type Bench02Result = {
  sampleCount: number;
  durationS: number;
  rejectedRows: number;
  timing: {
    targetRateHz: number;
    observedRateHz: number | null;
    medianDtS: number;
    meanDtS: number;
    minDtS: number;
    maxDtS: number;
    dtStdS: number;
    jitterRmsS: number;
  };
  value: {
    min: number;
    max: number;
    mean: number;
    std: number;
    uniqueValues: number;
    minimumObservedPositiveStep: number | null;
  };
  accumulation: {
    float64: number;
    float32: number;
    absoluteDifference: number;
    relativeDifference: number | null;
  };
  convergence: Bench02Convergence[];
};

type Bench03Row = {
  studyCode: number;
  methodCode: number;
  x: number;
  termLimit: number;
  termsUsed: number;
  cancellationRatio: number;
  stopRule: boolean;
  finite: boolean;
  elapsedUs: number;
  floatBytes: number;
  doubleBytes: number;
  epsilon: number;
  approximation: number;
  reference: number;
  absoluteError: number;
  relativeError: number;
  ulpError: number;
  allowedError: number;
  accuracyPassed: boolean;
  cancellationOk: boolean;
  falseConvergence: boolean;
  reliable: boolean;
  status: string;
};

type MethodSummary = {
  points: number;
  maximumAbsoluteError: number;
  medianAbsoluteError: number;
  worstX: number;
  accuracyPassRate: number;
  reliabilityRate: number;
  falseConvergenceCount: number;
  medianRuntimeUs: number;
};

type Bench03Result = {
  rows: Bench03Row[];
  parameterRows: number;
  convergenceRows: number;
  raw: MethodSummary;
  reduced: MethodSummary;
  floatBytes: number[];
  doubleBytes: number[];
  epsilons: number[];
};

const MODES: Array<{ id: Mode; title: string; subtitle: string }> = [
  { id: 'bench01', title: 'Bench 01 — Acquisition', subtitle: 'real potentiometer → ADC → measurement' },
  { id: 'bench02', title: 'Bench 02 — Sampling Error', subtitle: 'real sampled series → discretization / jitter / accumulation' },
  { id: 'bench03', title: 'Bench 03 — MCU Reliability', subtitle: 'embedded Taylor arithmetic → host reference → reliability' },
];

const panel: CSSProperties = {
  background: 'rgba(11,23,34,.86)',
  border: '1px solid rgba(255,255,255,.085)',
  borderRadius: 16,
  padding: 18,
};
const muted: CSSProperties = { color: '#8395aa', lineHeight: 1.55 };

function mean(values: number[]): number {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : Number.NaN;
}
function median(values: number[]): number {
  if (!values.length) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
function stdPopulation(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(mean(values.map(value => (value - m) ** 2)));
}
function rms(values: number[]): number | null {
  const finite = values.filter(Number.isFinite);
  return finite.length ? Math.sqrt(mean(finite.map(value => value * value))) : null;
}
function f32(value: number): number { return new Float32Array([value])[0]; }
function trapz64(times: number[], values: number[]): number {
  let total = 0;
  for (let i = 1; i < times.length; i++) total += 0.5 * (values[i - 1] + values[i]) * (times[i] - times[i - 1]);
  return total;
}
function trapz32(times: number[], values: number[]): number {
  let total = f32(0);
  for (let i = 1; i < times.length; i++) {
    const ySum = f32(f32(values[i - 1]) + f32(values[i]));
    const halfSum = f32(f32(0.5) * ySum);
    const dt = f32(f32(times[i]) - f32(times[i - 1]));
    total = f32(total + f32(halfSum * dt));
  }
  return total;
}
function centralDerivative(times: number[], values: number[]): number[] {
  const result = Array(times.length).fill(Number.NaN) as number[];
  for (let i = 1; i < times.length - 1; i++) {
    const dt = times[i + 1] - times[i - 1];
    if (dt > 0) result[i] = (values[i + 1] - values[i - 1]) / dt;
  }
  return result;
}
function minimumPositiveStep(values: number[]): number | null {
  const unique = [...new Set(values)].sort((a, b) => a - b);
  let result = Number.POSITIVE_INFINITY;
  for (let i = 1; i < unique.length; i++) {
    const step = unique[i] - unique[i - 1];
    if (step > 0 && step < result) result = step;
  }
  return Number.isFinite(result) ? result : null;
}
function analyzeBench02(lines: string[], targetRateHz = 50): Bench02Result {
  const times: number[] = [];
  const values: number[] = [];
  let rejectedRows = 0;
  for (const line of lines) {
    const parts = line.split(',').map(part => Number(part.trim()));
    if (parts.length !== 6 || parts.some(value => !Number.isFinite(value))) { rejectedRows++; continue; }
    const t = parts[0] * 1e-6;
    const y = parts[1];
    if (times.length && t <= times.at(-1)!) { rejectedRows++; continue; }
    times.push(t); values.push(y);
  }
  if (times.length < 5) throw new Error(`Need at least 5 valid monotonic rows; found ${times.length}.`);

  const dt = times.slice(1).map((value, i) => value - times[i]);
  const targetDt = 1 / targetRateHz;
  const baselineIntegral = trapz64(times, values);
  const baselineDerivative = centralDerivative(times, values);
  const factors = [1, 2, 4, 5, 10];
  const convergence: Bench02Convergence[] = [];

  for (const factor of factors) {
    const indices = Array.from({ length: Math.ceil(times.length / factor) }, (_, i) => i * factor).filter(i => i < times.length);
    if (indices.at(-1) !== times.length - 1) indices.push(times.length - 1);
    if (indices.length < 5) continue;
    const tSub = indices.map(i => times[i]);
    const ySub = indices.map(i => values[i]);
    const derivative = centralDerivative(tSub, ySub);
    const errors: number[] = [];
    for (let local = 1; local < indices.length - 1; local++) {
      const original = indices[local];
      const coarse = derivative[local];
      const fine = baselineDerivative[original];
      if (Number.isFinite(coarse) && Number.isFinite(fine)) errors.push(coarse - fine);
    }
    const subDt = tSub.slice(1).map((value, i) => value - tSub[i]);
    const integral = trapz64(tSub, ySub);
    const delta = integral - baselineIntegral;
    convergence.push({
      factor,
      samples: tSub.length,
      effectiveRateHz: median(subDt) > 0 ? 1 / median(subDt) : null,
      trapezoidIntegral: integral,
      integralDeltaVsFine: delta,
      relativeIntegralDeltaVsFine: baselineIntegral !== 0 ? delta / baselineIntegral : null,
      derivativeRmseVsFine: rms(errors),
    });
  }

  const integral32 = trapz32(times, values);
  return {
    sampleCount: times.length,
    durationS: times.at(-1)! - times[0],
    rejectedRows,
    timing: {
      targetRateHz,
      observedRateHz: median(dt) > 0 ? 1 / median(dt) : null,
      medianDtS: median(dt), meanDtS: mean(dt), minDtS: Math.min(...dt), maxDtS: Math.max(...dt),
      dtStdS: stdPopulation(dt), jitterRmsS: rms(dt.map(value => value - targetDt)) ?? Number.NaN,
    },
    value: {
      min: Math.min(...values), max: Math.max(...values), mean: mean(values), std: stdPopulation(values),
      uniqueValues: new Set(values).size, minimumObservedPositiveStep: minimumPositiveStep(values),
    },
    accumulation: {
      float64: baselineIntegral,
      float32: integral32,
      absoluteDifference: integral32 - baselineIntegral,
      relativeDifference: baselineIntegral !== 0 ? (integral32 - baselineIntegral) / baselineIntegral : null,
    },
    convergence,
  };
}

function floatFromBits(bits: number): number {
  const buffer = new ArrayBuffer(4);
  const view = new DataView(buffer);
  view.setUint32(0, bits >>> 0, true);
  return view.getFloat32(0, true);
}
function bitsFromFloat(value: number): number {
  const buffer = new ArrayBuffer(4);
  const view = new DataView(buffer);
  view.setFloat32(0, value, true);
  return view.getUint32(0, true);
}
function nextF32Up(value: number): number {
  const rounded = f32(value);
  if (!Number.isFinite(rounded) || rounded === Number.POSITIVE_INFINITY) return rounded;
  if (rounded === 0) return floatFromBits(1);
  let bits = bitsFromFloat(rounded);
  bits = rounded > 0 ? bits + 1 : bits - 1;
  return floatFromBits(bits);
}
function f32Ulp(reference: number): number {
  const rounded = f32(reference);
  const spacing = Math.abs(nextF32Up(rounded) - rounded);
  return spacing || 2 ** -149;
}
function statusFor(finite: boolean, stop: boolean, accuracy: boolean, cancellationOk: boolean): string {
  if (!finite) return 'non_finite_arithmetic';
  if (stop && !accuracy) return 'false_convergence';
  if (!stop) return 'term_limit_reached';
  if (!accuracy) return 'accuracy_failure';
  if (!cancellationOk) return 'excessive_cancellation';
  return 'reliable';
}
function analyzeBench03(lines: string[]): Bench03Result {
  const rows: Bench03Row[] = [];
  for (const line of lines) {
    const p = line.split(',').map(part => Number(part.trim()));
    if (p.length !== 16 || p.some(value => !Number.isFinite(value))) continue;
    const x = floatFromBits(p[2]);
    const approximation = p[15];
    const finite = Boolean(p[10]) && Number.isFinite(approximation);
    const stopRule = Boolean(p[9]);
    const epsilon = p[14];
    const cancellationRatio = p[8];
    const reference = Math.sin(x);
    const absoluteError = finite ? Math.abs(approximation - reference) : Number.POSITIVE_INFINITY;
    const relativeError = absoluteError / Math.max(Math.abs(reference), 2 ** -126);
    const ulpError = absoluteError / f32Ulp(reference);
    const allowedError = 8 * epsilon * Math.max(1, Math.abs(x), Math.abs(reference));
    const accuracyPassed = finite && absoluteError <= allowedError;
    const cancellationLimit = 1 / Math.sqrt(epsilon);
    const cancellationOk = finite && Number.isFinite(cancellationRatio) && cancellationRatio <= cancellationLimit;
    const reliable = finite && stopRule && accuracyPassed && cancellationOk;
    rows.push({
      studyCode: p[0], methodCode: p[1], x, termLimit: p[4], termsUsed: p[6], cancellationRatio,
      stopRule, finite, elapsedUs: p[11], floatBytes: p[12], doubleBytes: p[13], epsilon, approximation,
      reference, absoluteError, relativeError, ulpError, allowedError, accuracyPassed, cancellationOk,
      falseConvergence: stopRule && !accuracyPassed, reliable,
      status: statusFor(finite, stopRule, accuracyPassed, cancellationOk),
    });
  }
  if (!rows.length) throw new Error('No valid 16-column Bench 03 rows were captured.');
  const parameter = rows.filter(row => row.studyCode === 1);
  const convergence = rows.filter(row => row.studyCode === 2);
  function summarize(methodCode: number): MethodSummary {
    const subset = parameter.filter(row => row.methodCode === methodCode);
    if (!subset.length) return { points: 0, maximumAbsoluteError: Number.NaN, medianAbsoluteError: Number.NaN, worstX: Number.NaN, accuracyPassRate: 0, reliabilityRate: 0, falseConvergenceCount: 0, medianRuntimeUs: Number.NaN };
    const worst = subset.reduce((a, b) => a.absoluteError >= b.absoluteError ? a : b);
    return {
      points: subset.length,
      maximumAbsoluteError: Math.max(...subset.map(row => row.absoluteError)),
      medianAbsoluteError: median(subset.map(row => row.absoluteError)),
      worstX: worst.x,
      accuracyPassRate: subset.filter(row => row.accuracyPassed).length / subset.length,
      reliabilityRate: subset.filter(row => row.reliable).length / subset.length,
      falseConvergenceCount: subset.filter(row => row.falseConvergence).length,
      medianRuntimeUs: median(subset.map(row => row.elapsedUs)),
    };
  }
  return {
    rows,
    parameterRows: parameter.length,
    convergenceRows: convergence.length,
    raw: summarize(0),
    reduced: summarize(1),
    floatBytes: [...new Set(rows.map(row => row.floatBytes))].sort((a, b) => a - b),
    doubleBytes: [...new Set(rows.map(row => row.doubleBytes))].sort((a, b) => a - b),
    epsilons: [...new Set(rows.map(row => row.epsilon))].sort((a, b) => a - b),
  };
}

function fmt(value: number | null | undefined, digits = 5): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  if ((abs !== 0 && abs < 1e-3) || abs >= 1e5) return value.toExponential(3);
  return value.toFixed(digits);
}
function pct(value: number): string { return `${(value * 100).toFixed(1)}%`; }
function textLines(text: string) { return text.split(/\r?\n/).filter(line => line.trim()); }

function Metric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return <div style={{ border: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.025)', borderRadius: 12, padding: 12 }}>
    <span style={{ display: 'block', color: '#8395aa', fontSize: 10 }}>{label}</span>
    <b style={{ display: 'block', fontSize: 20, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{value}</b>
    {detail && <small style={{ color: '#8395aa' }}>{detail}</small>}
  </div>;
}

export default function NumericalBenchSuiteV2() {
  const [mode, setMode] = useState<Mode>('bench01');
  const { ports, profiles, selectedPort, setSelectedPort, fqbn, setFqbn, hardwareStatus, refreshHardware } = useHardwareSession();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('Ready');
  const [bench1Measurement, setBench1Measurement] = useState<MeasurementResult | null>(null);
  const [bench3Measurement, setBench3Measurement] = useState<MeasurementResult | null>(null);
  const [bench02Lines, setBench02Lines] = useState<string[]>([]);
  const [bench02Result, setBench02Result] = useState<Bench02Result | null>(null);
  const [bench02Source, setBench02Source] = useState('No source loaded');
  const [bench02TargetRate, setBench02TargetRate] = useState('50');
  const [bench03Lines, setBench03Lines] = useState<string[]>([]);
  const [bench03Result, setBench03Result] = useState<Bench03Result | null>(null);
  const [bench03Source, setBench03Source] = useState('No source loaded');

  const activeMode = useMemo(() => MODES.find(item => item.id === mode)!, [mode]);

  async function refresh() {
    setStatus('Refreshing shared hardware session…');
    try {
      await refreshHardware();
      setStatus('Shared hardware session refreshed.');
    } catch (error) { setStatus(String(error)); }
  }

  async function uploadRecipe(recipeId: string) {
    if (!selectedPort) { setStatus('Select a serial device first.'); return; }
    setBusy(true);
    try {
      setStatus('Preparing firmware…');
      const sketchDir = await invoke<string>('prepare_recipe', { recipeId });
      setStatus('Compiling…'); await invoke<string>('compile_sketch', { sketchDir, fqbn });
      setStatus('Uploading…');
      const result = await invoke<string>('upload_sketch', { sketchDir, fqbn, port: selectedPort });
      setStatus(result.split('\n').filter(Boolean).slice(-2).join(' · ') || 'Upload succeeded');
    } catch (error) { setStatus(`Upload failed: ${error}`); }
    finally { setBusy(false); }
  }

  async function recordRecipe(recipeId: 'analog_a0' | 'numerical_embedded', durationMs: number) {
    if (!selectedPort) { setStatus('Select a serial device first.'); return; }
    setBusy(true);
    try {
      setStatus('Recording Measurement Package…');
      const result = await invoke<MeasurementResult>('capture_measurement', { port: selectedPort, durationMs, maxLines: 10000, boardProfile: fqbn, recipeId });
      if (recipeId === 'analog_a0') setBench1Measurement(result); else setBench3Measurement(result);
      setStatus(`${result.samples} samples saved · ${result.directory}`);
    } catch (error) { setStatus(`Measurement failed: ${error}`); }
    finally { setBusy(false); }
  }

  function analyzeBench02Source(lines: string[], source: string) {
    const targetRate = Number(bench02TargetRate);
    if (!Number.isFinite(targetRate) || targetRate <= 0) throw new Error('Target sample rate must be a positive finite number.');
    const result = analyzeBench02(lines, targetRate);
    setBench02Lines(lines);
    setBench02Result(result);
    setBench02Source(source);
    setStatus(`Bench 02 complete · ${result.sampleCount} accepted samples · ${result.rejectedRows} rejected · ${source}`);
  }

  async function captureAndAnalyzeBench02() {
    if (!selectedPort) { setStatus('Select a serial device first.'); return; }
    setBusy(true); setBench02Result(null);
    try {
      setStatus('Capturing 7 s real ADC series for in-app analysis…');
      const capture = await invoke<CaptureResult>('serial_capture', { port: selectedPort, baud: 115200, durationMs: 7000, maxLines: 10000, numericOnly: true });
      analyzeBench02Source(capture.lines, 'Live serial capture');
    } catch (error) { setStatus(`Bench 02 failed: ${error}`); }
    finally { setBusy(false); }
  }

  async function importBench02(file: File | null) {
    if (!file) return;
    try {
      const lines = textLines(await file.text());
      analyzeBench02Source(lines, `Imported ${file.name}`);
    } catch (error) { setStatus(`Bench 02 import failed: ${error}`); }
  }

  function reanalyzeBench02() {
    try {
      if (!bench02Lines.length) throw new Error('Load or capture a Bench 02 source first.');
      analyzeBench02Source(bench02Lines, `${bench02Source} · re-analyzed`);
    } catch (error) { setStatus(`Bench 02 re-analysis failed: ${error}`); }
  }

  function analyzeBench03Source(lines: string[], source: string) {
    const result = analyzeBench03(lines);
    setBench03Lines(lines);
    setBench03Result(result);
    setBench03Source(source);
    setStatus(`Bench 03 complete · ${result.rows.length} rows · ${result.parameterRows} scan + ${result.convergenceRows} convergence · ${source}`);
  }

  async function captureAndAnalyzeBench03() {
    if (!selectedPort) { setStatus('Select a serial device first.'); return; }
    setBusy(true); setBench03Result(null);
    try {
      setStatus('Capturing complete embedded numerical campaign…');
      const capture = await invoke<CaptureResult>('serial_capture', { port: selectedPort, baud: 115200, durationMs: 7200, maxLines: 1000, numericOnly: true });
      analyzeBench03Source(capture.lines, 'Live MCU campaign');
    } catch (error) { setStatus(`Bench 03 failed: ${error}`); }
    finally { setBusy(false); }
  }

  async function importBench03(file: File | null) {
    if (!file) return;
    try {
      analyzeBench03Source(textLines(await file.text()), `Imported ${file.name}`);
    } catch (error) { setStatus(`Bench 03 import failed: ${error}`); }
  }

  function reanalyzeBench03() {
    try {
      if (!bench03Lines.length) throw new Error('Load or capture a Bench 03 source first.');
      analyzeBench03Source(bench03Lines, `${bench03Source} · re-analyzed`);
    } catch (error) { setStatus(`Bench 03 re-analysis failed: ${error}`); }
  }

  return <div style={{ minHeight: '100vh', padding: '28px 34px 70px', color: '#edf5ff' }}>
    <div style={{ maxWidth: 1420, margin: '0 auto' }}>
      <header style={{ ...panel, marginBottom: 14, display: 'flex', justifyContent: 'space-between', gap: 20, alignItems: 'center' }}>
        <div><div style={{ textTransform: 'uppercase', fontSize: 10, letterSpacing: '.14em', color: '#70dcff' }}>Numerical Analysis</div><h1 style={{ margin: '6px 0 4px' }}>Numerical Lab</h1><p style={{ ...muted, margin: 0 }}>Source → analyze → inspect complete results. Capture once, then re-analyze the same evidence without touching the hardware.</p></div>
        <button className="ghost" onClick={refresh}><RefreshCw size={15}/> Refresh hardware</button>
      </header>

      <section style={{ ...panel, marginBottom: 14, display: 'grid', gridTemplateColumns: 'minmax(300px,420px) 1fr', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}><Cpu size={17}/><b>Shared lab connection</b></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <label>Serial device<select value={selectedPort} onChange={event => setSelectedPort(event.target.value)}>{!ports.length && <option value="">No USB serial device</option>}{ports.map(port => <option key={port.port} value={port.port}>{port.port} · {port.board_name || 'Unknown'}</option>)}</select></label>
            <label>Board profile<select value={fqbn} onChange={event => setFqbn(event.target.value)}>{profiles.map(profile => <option key={profile.fqbn} value={profile.fqbn}>{profile.label}</option>)}</select></label>
          </div>
          <div style={{ ...muted, fontSize: 11, marginTop: 10 }}>{status} · {hardwareStatus}</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
          {MODES.map(item => <button key={item.id} onClick={() => setMode(item.id)} style={{ minHeight: 82, padding: 12, textAlign: 'left', borderRadius: 12, border: mode === item.id ? '1px solid rgba(112,220,255,.5)' : '1px solid rgba(255,255,255,.08)', background: mode === item.id ? 'rgba(59,123,255,.16)' : 'rgba(255,255,255,.025)', color: '#edf5ff', display: 'block' }}><b style={{ display: 'block', fontSize: 12 }}>{item.title}</b><span style={{ display: 'block', ...muted, fontSize: 10, marginTop: 5 }}>{item.subtitle}</span></button>)}
        </div>
      </section>

      <section style={{ ...panel, marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'start' }}><div><div style={{ color: '#70dcff', fontSize: 10, letterSpacing: '.12em' }}>CURRENT EXPERIMENT</div><h2 style={{ margin: '6px 0' }}>{activeMode.title}</h2><p style={{ ...muted, margin: 0 }}>{activeMode.subtitle}</p></div><Sigma size={28}/></div>

        {mode === 'bench01' && <div style={{ marginTop: 18 }}>
          <div className="bridge-flow" style={{ justifyContent: 'flex-start' }}><div>potentiometer</div><b>→</b><div>A0 / ADC</div><b>→</b><div>filter + PWM</div><b>→</b><div>measurement</div></div>
          <div className="action-row"><button className="primary" disabled={busy || !selectedPort} onClick={() => uploadRecipe('analog_a0')}><Upload size={15}/> Compile & Upload</button><button className="ghost" disabled={busy || !selectedPort} onClick={() => recordRecipe('analog_a0', 5000)}><Save size={15}/> Record 5 s evidence</button></div>
          {bench1Measurement && <div className="measurement big"><b>{bench1Measurement.samples} samples</b><span>{bench1Measurement.directory}</span><span>{bench1Measurement.csv_path}</span></div>}
          <div className="boundary">Bench 01 acquires a real low-voltage analog record. Nominal voltage conversion is not automatically a traceable calibration.</div>
        </div>}

        {mode === 'bench02' && <div style={{ marginTop: 18 }}>
          <div className="bridge-flow" style={{ justifyContent: 'flex-start' }}><div>live capture / saved data.csv</div><b>→</b><div>timing / quantization</div><b>→</b><div>downsample</div><b>→</b><div>differentiate + integrate</div><b>→</b><div>results</div></div>
          <div className="action-row">
            <button className="ghost" disabled={busy || !selectedPort} onClick={() => uploadRecipe('analog_a0')}><Upload size={15}/> Upload acquisition firmware</button>
            <button className="primary" disabled={busy || !selectedPort} onClick={captureAndAnalyzeBench02}><Play size={15}/> Capture 7 s & Analyze</button>
            <label className="ghost" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, cursor: 'pointer' }}><Database size={15}/> Import saved data.csv<input style={{ display: 'none' }} type="file" accept=".csv,text/csv" onChange={event => void importBench02(event.target.files?.[0] ?? null)}/></label>
            <button className="ghost" disabled={!bench02Lines.length} onClick={reanalyzeBench02}><RefreshCw size={14}/> Re-analyze current source</button>
            <button className="ghost" disabled={busy || !selectedPort} onClick={() => recordRecipe('analog_a0', 7000)}><Save size={15}/> Record evidence package</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 10, alignItems: 'end', marginTop: 10 }}><label>Target sample rate (Hz)<input value={bench02TargetRate} onChange={event => setBench02TargetRate(event.target.value)}/></label><div style={{ ...muted, fontSize: 10 }}><b style={{ color: '#c7d8e8' }}>Source:</b> {bench02Source}. Changing target rate changes the timing-jitter reference; it does not resample the captured evidence.</div></div>
          {!bench02Result ? <div className="empty">No Bench 02 result yet. Capture live data or import a previously saved BetterBoard `data.csv`; the same source can be analyzed repeatedly.</div> : <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginTop: 16 }}><Metric label="Accepted samples" value={String(bench02Result.sampleCount)} detail={`${bench02Result.rejectedRows} rejected`}/><Metric label="Observed rate" value={`${fmt(bench02Result.timing.observedRateHz,2)} Hz`} detail={`target ${bench02Result.timing.targetRateHz} Hz`}/><Metric label="RMS timing jitter" value={`${fmt(bench02Result.timing.jitterRmsS * 1000,3)} ms`}/><Metric label="Unique ADC codes" value={String(bench02Result.value.uniqueValues)} detail={`min step ${fmt(bench02Result.value.minimumObservedPositiveStep,2)}`}/></div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginTop: 8 }}><Metric label="ADC mean" value={fmt(bench02Result.value.mean,3)}/><Metric label="ADC std" value={fmt(bench02Result.value.std,3)}/><Metric label="Trapz float64" value={fmt(bench02Result.accumulation.float64,5)}/><Metric label="float32 − float64" value={fmt(bench02Result.accumulation.absoluteDifference,6)}/></div>
            <div style={{ marginTop: 16, overflow: 'auto' }}><h3 style={{ fontSize: 13 }}><BarChart3 size={15}/> Downsampling convergence</h3><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}><thead><tr><th>factor</th><th>samples</th><th>effective Hz</th><th>integral</th><th>Δ integral vs finest</th><th>derivative RMSE vs finest</th></tr></thead><tbody>{bench02Result.convergence.map(row => <tr key={row.factor}><td>{row.factor}×</td><td>{row.samples}</td><td>{fmt(row.effectiveRateHz,2)}</td><td>{fmt(row.trapezoidIntegral,5)}</td><td>{fmt(row.integralDeltaVsFine,6)}</td><td>{fmt(row.derivativeRmseVsFine,5)}</td></tr>)}</tbody></table></div>
            <details style={{ marginTop: 14 }}><summary>{bench02Lines.length} source rows · {bench02Source}</summary><pre className="terminal" style={{ height: 220 }}>{bench02Lines.join('\n')}</pre></details>
          </>}
          <div className="boundary">The finest measured series is an empirical numerical baseline, not physical ground truth. These are sampling/discretization/accumulation differences, not absolute sensor error. Re-analysis intentionally reuses the same evidence so algorithm choices can be compared without changing the physical trial.</div>
        </div>}

        {mode === 'bench03' && <div style={{ marginTop: 18 }}>
          <div className="bridge-flow" style={{ justifyContent: 'flex-start' }}><div>live MCU / saved campaign</div><b>→</b><div>Taylor recurrence</div><b>→</b><div>host float64 reference</div><b>→</b><div>accuracy + reliability</div></div>
          <div className="action-row">
            <button className="ghost" disabled={busy || !selectedPort} onClick={() => uploadRecipe('numerical_embedded')}><Upload size={15}/> Compile & Upload</button>
            <button className="primary" disabled={busy || !selectedPort} onClick={captureAndAnalyzeBench03}><Activity size={15}/> Capture Complete Campaign & Analyze</button>
            <label className="ghost" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, cursor: 'pointer' }}><Database size={15}/> Import saved campaign CSV<input style={{ display: 'none' }} type="file" accept=".csv,text/csv" onChange={event => void importBench03(event.target.files?.[0] ?? null)}/></label>
            <button className="ghost" disabled={!bench03Lines.length} onClick={reanalyzeBench03}><RefreshCw size={14}/> Re-analyze current source</button>
            <button className="ghost" disabled={busy || !selectedPort} onClick={() => recordRecipe('numerical_embedded', 7200)}><Save size={15}/> Record evidence package</button>
          </div>
          <div style={{ ...muted, fontSize: 10, marginTop: 10 }}><b style={{ color: '#c7d8e8' }}>Source:</b> {bench03Source}. A saved BetterBoard Bench 03 `data.csv` can be re-opened later and re-evaluated against the current host reference logic.</div>
          {!bench03Result ? <div className="empty">No Bench 03 result yet. Capture the MCU campaign or import an existing 16-column campaign CSV. The complete source remains available for repeated analysis.</div> : <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginTop: 16 }}><Metric label="Complete rows" value={String(bench03Result.rows.length)} detail={`${bench03Result.parameterRows} scan + ${bench03Result.convergenceRows} convergence`}/><Metric label="MCU float / double" value={`${bench03Result.floatBytes.join('/')} / ${bench03Result.doubleBytes.join('/')}`} detail="bytes observed"/><Metric label="Raw reliability" value={pct(bench03Result.raw.reliabilityRate)} detail={`${bench03Result.raw.falseConvergenceCount} false convergence`}/><Metric label="Range-reduced reliability" value={pct(bench03Result.reduced.reliabilityRate)} detail={`${bench03Result.reduced.falseConvergenceCount} false convergence`}/></div>
            <div style={{ overflow: 'auto', marginTop: 16 }}><h3 style={{ fontSize: 13 }}><Waves size={15}/> Method comparison</h3><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}><thead><tr><th>method</th><th>points</th><th>max abs error</th><th>median abs error</th><th>worst x</th><th>accuracy pass</th><th>reliability</th><th>false convergence</th><th>median runtime µs</th></tr></thead><tbody><tr><td>Raw Taylor</td><td>{bench03Result.raw.points}</td><td>{fmt(bench03Result.raw.maximumAbsoluteError,6)}</td><td>{fmt(bench03Result.raw.medianAbsoluteError,6)}</td><td>{fmt(bench03Result.raw.worstX,2)}</td><td>{pct(bench03Result.raw.accuracyPassRate)}</td><td>{pct(bench03Result.raw.reliabilityRate)}</td><td>{bench03Result.raw.falseConvergenceCount}</td><td>{fmt(bench03Result.raw.medianRuntimeUs,1)}</td></tr><tr><td>Range reduced</td><td>{bench03Result.reduced.points}</td><td>{fmt(bench03Result.reduced.maximumAbsoluteError,6)}</td><td>{fmt(bench03Result.reduced.medianAbsoluteError,6)}</td><td>{fmt(bench03Result.reduced.worstX,2)}</td><td>{pct(bench03Result.reduced.accuracyPassRate)}</td><td>{pct(bench03Result.reduced.reliabilityRate)}</td><td>{bench03Result.reduced.falseConvergenceCount}</td><td>{fmt(bench03Result.reduced.medianRuntimeUs,1)}</td></tr></tbody></table></div>
            <details style={{ marginTop: 14 }}><summary>All {bench03Result.rows.length} analyzed rows</summary><div style={{ maxHeight: 380, overflow: 'auto', marginTop: 8 }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}><thead><tr><th>study</th><th>method</th><th>x</th><th>terms</th><th>approx</th><th>reference</th><th>abs error</th><th>ULP error</th><th>cancel</th><th>runtime µs</th><th>status</th></tr></thead><tbody>{bench03Result.rows.map((row, index) => <tr key={index}><td>{row.studyCode}</td><td>{row.methodCode === 0 ? 'raw' : 'reduced'}</td><td>{fmt(row.x,3)}</td><td>{row.termsUsed}</td><td>{fmt(row.approximation,6)}</td><td>{fmt(row.reference,6)}</td><td>{fmt(row.absoluteError,6)}</td><td>{fmt(row.ulpError,2)}</td><td>{fmt(row.cancellationRatio,3)}</td><td>{fmt(row.elapsedUs,0)}</td><td>{row.reliable ? <span style={{ color: '#55e2a7' }}><CheckCircle2 size={12}/> reliable</span> : <span style={{ color: '#ffc36d' }}><CircleAlert size={12}/> {row.status}</span>}</td></tr>)}</tbody></table></div></details>
            <details style={{ marginTop: 10 }}><summary>Raw source campaign ({bench03Lines.length} rows) · {bench03Source}</summary><pre className="terminal" style={{ height: 220 }}>{bench03Lines.join('\n')}</pre></details>
          </>}
          {bench3Measurement && <div className="measurement big" style={{ marginTop: 12 }}><b>{bench3Measurement.samples} saved evidence rows</b><span>{bench3Measurement.directory}</span></div>}
          <div className="boundary">Immediate in-app accuracy uses the host JavaScript float64 Math.sin reference. The saved evidence package remains suitable for the higher-precision Python oracle analyzer. The UI labels this distinction instead of pretending they are identical references.</div>
        </div>}
      </section>
    </div>
  </div>;
}
