import { useMemo, useState } from 'react';
import { Activity, Binary, Database, Gauge, Sigma, Waves } from 'lucide-react';
import EngineeringPlot from './EngineeringPlot';

type BenchMode = 'sampling' | 'embedded';
type Point = { x: number; y: number };

type SamplingRow = { t: number; value: number };
type EmbeddedRow = {
  study: number;
  method: number;
  x: number;
  termLimit: number;
  termsUsed: number;
  cancellation: number;
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
  falseConvergence: boolean;
  reliable: boolean;
};

function finite(values: number[]) { return values.filter(Number.isFinite); }
function mean(values: number[]) { const v = finite(values); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : Number.NaN; }
function median(values: number[]) { const v = finite(values).sort((a, b) => a - b); if (!v.length) return Number.NaN; const m = Math.floor(v.length / 2); return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2; }
function rms(values: number[]) { const v = finite(values); return v.length ? Math.sqrt(mean(v.map(x => x * x))) : Number.NaN; }
function fmt(value: number | null | undefined, digits = 4) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const a = Math.abs(value);
  return a !== 0 && (a < 1e-3 || a >= 1e5) ? value.toExponential(3) : value.toFixed(digits);
}
function f32(value: number) { return new Float32Array([value])[0]; }
function bitsToF32(bits: number) { const buffer = new ArrayBuffer(4); const view = new DataView(buffer); view.setUint32(0, bits >>> 0, true); return view.getFloat32(0, true); }
function f32ToBits(value: number) { const buffer = new ArrayBuffer(4); const view = new DataView(buffer); view.setFloat32(0, value, true); return view.getUint32(0, true); }
function nextF32Up(value: number) { const rounded = f32(value); if (!Number.isFinite(rounded)) return rounded; if (rounded === 0) return bitsToF32(1); let bits = f32ToBits(rounded); bits = rounded > 0 ? bits + 1 : bits - 1; return bitsToF32(bits); }
function f32Ulp(value: number) { const rounded = f32(value); return Math.abs(nextF32Up(rounded) - rounded) || 2 ** -149; }

function parseSampling(text: string): SamplingRow[] {
  const rows: SamplingRow[] = [];
  for (const line of text.split(/\r?\n/)) {
    const p = line.split(',').map(cell => Number(cell.trim()));
    if (p.length < 2 || !Number.isFinite(p[0]) || !Number.isFinite(p[1])) continue;
    const t = p[0] * 1e-6;
    if (rows.length && t <= rows.at(-1)!.t) continue;
    rows.push({ t, value: p[1] });
  }
  if (rows.length < 5) throw new Error('Bench 02 visualization needs at least 5 monotonic numeric rows.');
  return rows;
}

function centralDerivative(rows: SamplingRow[]): Point[] {
  const out: Point[] = [];
  for (let i = 1; i < rows.length - 1; i++) {
    const dt = rows[i + 1].t - rows[i - 1].t;
    if (dt > 0) out.push({ x: rows[i].t, y: (rows[i + 1].value - rows[i - 1].value) / dt });
  }
  return out;
}

function downsample(rows: SamplingRow[], factor: number): SamplingRow[] {
  const out = rows.filter((_, i) => i % factor === 0);
  if (out.at(-1)?.t !== rows.at(-1)?.t) out.push(rows.at(-1)!);
  return out;
}

function trapz(rows: SamplingRow[]) {
  let total = 0;
  for (let i = 1; i < rows.length; i++) total += 0.5 * (rows[i - 1].value + rows[i].value) * (rows[i].t - rows[i - 1].t);
  return total;
}

function trapzF32(rows: SamplingRow[]) {
  let total = f32(0);
  for (let i = 1; i < rows.length; i++) {
    const y = f32(f32(0.5) * f32(f32(rows[i - 1].value) + f32(rows[i].value)));
    const dt = f32(f32(rows[i].t) - f32(rows[i - 1].t));
    total = f32(total + f32(y * dt));
  }
  return total;
}

function parseEmbedded(text: string): EmbeddedRow[] {
  const rows: EmbeddedRow[] = [];
  for (const line of text.split(/\r?\n/)) {
    const p = line.split(',').map(cell => Number(cell.trim()));
    if (p.length !== 16 || p.some(value => !Number.isFinite(value))) continue;
    const x = bitsToF32(p[2]);
    const approximation = p[15];
    const reference = Math.sin(x);
    const absoluteError = Math.abs(approximation - reference);
    const epsilon = p[14];
    const allowedError = 8 * epsilon * Math.max(1, Math.abs(x), Math.abs(reference));
    const relativeError = absoluteError / Math.max(Math.abs(reference), 2 ** -126);
    const ulpError = absoluteError / f32Ulp(reference);
    const finiteArithmetic = Boolean(p[10]) && Number.isFinite(approximation);
    const stopRule = Boolean(p[9]);
    const cancellationOk = p[8] <= 1 / Math.sqrt(epsilon);
    const accuracy = finiteArithmetic && absoluteError <= allowedError;
    rows.push({ study: p[0], method: p[1], x, termLimit: p[4], termsUsed: p[6], cancellation: p[8], stopRule, finite: finiteArithmetic, elapsedUs: p[11], floatBytes: p[12], doubleBytes: p[13], epsilon, approximation, reference, absoluteError, relativeError, ulpError, allowedError, falseConvergence: stopRule && !accuracy, reliable: finiteArithmetic && stopRule && accuracy && cancellationOk });
  }
  if (!rows.length) throw new Error('Bench 03 visualization needs the 16-column embedded numerical campaign CSV.');
  return rows;
}

function Metric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return <div className="panel" style={{ padding: 12 }}><span className="eyebrow">{label}</span><b style={{ display: 'block', marginTop: 4, fontSize: 19 }}>{value}</b>{detail && <small className="muted">{detail}</small>}</div>;
}

export default function NumericalErrorVisualWorkbench() {
  const [mode, setMode] = useState<BenchMode>('sampling');
  const [sampling, setSampling] = useState<SamplingRow[]>([]);
  const [embedded, setEmbedded] = useState<EmbeddedRow[]>([]);
  const [samplingSource, setSamplingSource] = useState('No Bench 02 evidence loaded');
  const [embeddedSource, setEmbeddedSource] = useState('No Bench 03 campaign loaded');
  const [error, setError] = useState('');

  async function loadSampling(file: File | null) {
    if (!file) return;
    try { setSampling(parseSampling(await file.text())); setSamplingSource(file.name); setError(''); }
    catch (cause) { setError(String(cause)); }
  }
  async function loadEmbedded(file: File | null) {
    if (!file) return;
    try { setEmbedded(parseEmbedded(await file.text())); setEmbeddedSource(file.name); setError(''); }
    catch (cause) { setError(String(cause)); }
  }

  const samplingAnalysis = useMemo(() => {
    if (!sampling.length) return null;
    const dt = sampling.slice(1).map((row, i) => row.t - sampling[i].t);
    const target = median(dt);
    const factors = [1, 2, 4, 5, 10].map(factor => {
      const rows = downsample(sampling, factor);
      return { factor, rows, integral: trapz(rows), derivative: centralDerivative(rows) };
    });
    const finest = factors[0].integral;
    return { dt, target, factors, finest, float32: trapzF32(sampling), float64: trapz(sampling) };
  }, [sampling]);

  const parameterRows = useMemo(() => embedded.filter(row => row.study === 1), [embedded]);
  const convergenceRows = useMemo(() => embedded.filter(row => row.study === 2), [embedded]);
  const falseConvergence = embedded.filter(row => row.falseConvergence);

  return <section className="panel" style={{ maxWidth: 1420, margin: '18px auto' }}>
    <div className="panel-title"><Binary size={18}/> Numerical Error & Embedded Reliability · Visual Diagnostics</div>
    <p className="muted">Visualize the numerical behavior already captured by BetterBoard Bench 02 and Bench 03: sampling/discretization error, accumulation precision, Taylor convergence, cancellation, ULP error, runtime cost and false convergence.</p>
    <div className="action-row">
      <button className={`ghost ${mode === 'sampling' ? 'active' : ''}`} onClick={() => setMode('sampling')}><Waves size={15}/> Bench 02 · Sampling & discretization</button>
      <button className={`ghost ${mode === 'embedded' ? 'active' : ''}`} onClick={() => setMode('embedded')}><Gauge size={15}/> Bench 03 · Embedded reliability</button>
    </div>
    {error && <div className="boundary">{error}</div>}

    {mode === 'sampling' && <>
      <div className="action-row" style={{ marginTop: 10 }}><label className="ghost" style={{ cursor: 'pointer' }}><Database size={14}/> Import Bench 02 data.csv<input hidden type="file" accept=".csv,text/csv" onChange={event => void loadSampling(event.target.files?.[0] ?? null)}/></label><span className="muted">{samplingSource}</span></div>
      {!samplingAnalysis ? <div className="empty compact">Load a Bench 02 measurement package CSV to reveal timing, downsampling, derivative and integration behavior.</div> : <>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 8, marginTop: 12 }}>
          <Metric label="Samples" value={String(sampling.length)} detail={`${fmt(sampling.at(-1)!.t - sampling[0].t, 3)} s record`}/>
          <Metric label="Median Δt" value={`${fmt(samplingAnalysis.target * 1000, 3)} ms`} detail={`${fmt(1 / samplingAnalysis.target, 2)} Hz observed`}/>
          <Metric label="Δt RMS spread" value={`${fmt(rms(samplingAnalysis.dt.map(v => v - samplingAnalysis.target)) * 1000, 3)} ms`}/>
          <Metric label="float32 − float64 integral" value={fmt(samplingAnalysis.float32 - samplingAnalysis.float64, 7)} detail="same measured sequence"/>
        </div>
        <section className="panel" style={{ marginTop: 12 }}><div className="panel-title"><Activity size={16}/> Actual sample timing</div><EngineeringPlot series={[{ label: 'Δt', kind: 'stem', points: samplingAnalysis.dt.map((value, i) => ({ x: i + 1, y: value * 1000 })) }]} xLabel="sample interval" yLabel="Δt" yUnit="ms" horizontalLines={[{ y: samplingAnalysis.target * 1000, label: 'median Δt' }]} zeroLine={false}/></section>
        <section className="panel" style={{ marginTop: 12 }}><div className="panel-title"><Waves size={16}/> Same evidence at multiple sampling densities</div><EngineeringPlot series={samplingAnalysis.factors.map(item => ({ label: `${item.factor}× downsample`, kind: item.factor === 1 ? 'line' as const : 'scatter' as const, opacity: item.factor === 1 ? 1 : 0.75, points: item.rows.map(row => ({ x: row.t, y: row.value })) }))} xLabel="time" xUnit="s" yLabel="measured value"/></section>
        <section className="panel" style={{ marginTop: 12 }}><div className="panel-title"><Sigma size={16}/> Trapezoidal integration convergence</div><EngineeringPlot series={[{ label: '|Δ integral vs finest|', kind: 'line', points: samplingAnalysis.factors.map(item => ({ x: item.factor, y: Math.abs(item.integral - samplingAnalysis.finest) })) }]} xLabel="downsample factor" yLabel="absolute integral difference" zeroLine/></section>
        <section className="panel" style={{ marginTop: 12 }}><div className="panel-title"><Sigma size={16}/> Finite-difference derivative sensitivity</div><EngineeringPlot series={samplingAnalysis.factors.filter(item => item.derivative.length).map(item => ({ label: `${item.factor}× derivative`, kind: 'line' as const, points: item.derivative }))} xLabel="time" xUnit="s" yLabel="finite-difference derivative" zeroLine/></section>
        <div className="boundary">The finest measured record is an empirical numerical baseline, not exact physical truth. These plots expose sensitivity to sampling and arithmetic choices; they do not establish sensor calibration or absolute physical error.</div>
      </>}
    </>}

    {mode === 'embedded' && <>
      <div className="action-row" style={{ marginTop: 10 }}><label className="ghost" style={{ cursor: 'pointer' }}><Database size={14}/> Import Bench 03 campaign CSV<input hidden type="file" accept=".csv,text/csv" onChange={event => void loadEmbedded(event.target.files?.[0] ?? null)}/></label><span className="muted">{embeddedSource}</span></div>
      {!embedded.length ? <div className="empty compact">Load the Bench 03 16-column MCU campaign to inspect error, convergence, cancellation and runtime tradeoffs.</div> : <>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 8, marginTop: 12 }}>
          <Metric label="Campaign rows" value={String(embedded.length)} detail={`${parameterRows.length} scan · ${convergenceRows.length} convergence`}/>
          <Metric label="False convergence" value={String(falseConvergence.length)} detail="stop rule passed, accuracy failed"/>
          <Metric label="Reliable rows" value={`${(100 * embedded.filter(row => row.reliable).length / embedded.length).toFixed(1)}%`}/>
          <Metric label="Arithmetic environment" value={`${[...new Set(embedded.map(row => row.floatBytes))].join('/')}B float · ${[...new Set(embedded.map(row => row.doubleBytes))].join('/')}B double`}/>
        </div>
        <section className="panel" style={{ marginTop: 12 }}><div className="panel-title"><Waves size={16}/> Parameter scan · absolute error</div><EngineeringPlot series={[0,1].map(method => ({ label: method === 0 ? 'raw Taylor' : 'range reduced', kind: 'line' as const, points: parameterRows.filter(row => row.method === method).sort((a,b) => a.x-b.x).map(row => ({ x: row.x, y: row.absoluteError })) }))} xLabel="x" yLabel="absolute error" horizontalLines={parameterRows.length ? [{ y: median(parameterRows.map(row => row.allowedError)), label: 'typical allowed-error scale' }] : []}/></section>
        <section className="panel" style={{ marginTop: 12 }}><div className="panel-title"><Binary size={16}/> ULP error and false convergence</div><EngineeringPlot series={[{ label: 'ULP error', kind: 'stem', points: parameterRows.map(row => ({ x: row.x, y: row.ulpError })) }, { label: 'false convergence', kind: 'scatter', points: parameterRows.filter(row => row.falseConvergence).map(row => ({ x: row.x, y: row.ulpError })) }]} xLabel="x" yLabel="ULP error"/></section>
        <section className="panel" style={{ marginTop: 12 }}><div className="panel-title"><Activity size={16}/> Cancellation ratio</div><EngineeringPlot series={[0,1].map(method => ({ label: method === 0 ? 'raw cancellation' : 'reduced cancellation', kind: 'line' as const, points: parameterRows.filter(row => row.method === method).sort((a,b) => a.x-b.x).map(row => ({ x: row.x, y: row.cancellation })) }))} xLabel="x" yLabel="cancellation ratio"/></section>
        <section className="panel" style={{ marginTop: 12 }}><div className="panel-title"><Gauge size={16}/> Accuracy ↔ execution-time tradeoff</div><EngineeringPlot series={[0,1].map(method => ({ label: method === 0 ? 'raw runtime/error' : 'reduced runtime/error', kind: 'scatter' as const, points: parameterRows.filter(row => row.method === method).map(row => ({ x: row.elapsedUs, y: row.absoluteError })) }))} xLabel="execution time" xUnit="µs" yLabel="absolute error"/></section>
        <section className="panel" style={{ marginTop: 12 }}><div className="panel-title"><Sigma size={16}/> Fixed-term convergence at x ≈ 80</div><EngineeringPlot series={[0,1].map(method => ({ label: method === 0 ? 'raw convergence' : 'reduced convergence', kind: 'line' as const, points: convergenceRows.filter(row => row.method === method).sort((a,b) => a.termLimit-b.termLimit).map(row => ({ x: row.termLimit, y: row.absoluteError })) }))} xLabel="Taylor term limit" yLabel="absolute error"/></section>
        <div className="boundary">Bench 03 deliberately distinguishes stopping from correctness. A passed stopping rule can still be false convergence when the independent reference test fails; reliability also requires finite arithmetic and acceptable cancellation.</div>
      </>}
    </>}
  </section>;
}
