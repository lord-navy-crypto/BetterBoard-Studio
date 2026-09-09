import { useMemo, useState, type CSSProperties } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useHardwareSession } from './HardwareSession';
import EngineeringPlot from './EngineeringPlot';
import { Activity, BarChart3, Database, Magnet, MapPinned, RefreshCw, Save, Upload } from 'lucide-react';

type MeasurementResult = { directory: string; csv_path: string; metadata_path: string; physical_lab_csv_path: string; physical_lab_bridge_path: string; samples: number };
type CaptureResult = { lines: string[]; numeric_rows: number; ignored_rows: number };
type Mode = 'acquire' | 'characterize' | 'validate';
type Axis = 'bx' | 'by' | 'bz' | 'bmag';
type FieldSummary = {
  samples: number;
  mean: { bx: number; by: number; bz: number; bmag: number };
  std: { bx: number; by: number; bz: number; bmag: number };
};
type ScanPoint = {
  id: string;
  repeat: number;
  capturedAt: number;
  source: 'live' | 'import';
  positionMm: number;
  samples: number;
  bx: number;
  by: number;
  bz: number;
  bmag: number;
};
type AggregatedScanPoint = {
  positionMm: number;
  captures: number;
  samples: number;
  bx: number;
  by: number;
  bz: number;
  bmag: number;
};
type RepeatabilityRow = {
  positionMm: number;
  captures: number;
  meanBmag: number;
  betweenCaptureStdBmag: number;
  minBmag: number;
  maxBmag: number;
};
type ModelPoint = { position: number; valueUt: number };
type Validation = {
  pairs: Array<{ position: number; measured: number; model: number; residual: number }>;
  mae: number;
  rmse: number;
  bias: number;
  maxAbsResidual: number;
  r2: number | null;
  scale: number | null;
  offset: number | null;
  measuredIntegral: number;
  modelIntegral: number;
};

const panel: CSSProperties = { background: 'rgba(11,23,34,.86)', border: '1px solid rgba(255,255,255,.085)', borderRadius: 16, padding: 18 };
const muted: CSSProperties = { color: '#8395aa', lineHeight: 1.55 };
const MODES = [
  { id: 'acquire' as const, title: 'Bench 01 — Vector Acquisition', subtitle: 'Bx / By / Bz / |B| from the real sensor' },
  { id: 'characterize' as const, title: 'Bench 02 — Characterization', subtitle: 'ambient baseline → repeated captures → spatial profile' },
  { id: 'validate' as const, title: 'Bench 03 — Model Validation', subtitle: 'measured or imported scan ↔ model CSV → residual evidence' },
];

function mean(values: number[]) { return values.reduce((a, b) => a + b, 0) / values.length; }
function std(values: number[]) { const m = mean(values); return Math.sqrt(values.reduce((sum, value) => sum + (value - m) ** 2, 0) / values.length); }
function sampleStd(values: number[]) {
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(values.reduce((sum, value) => sum + (value - m) ** 2, 0) / (values.length - 1));
}
function fmt(value: number | null | undefined, digits = 4) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  return (abs !== 0 && (abs < 1e-3 || abs >= 1e5)) ? value.toExponential(3) : value.toFixed(digits);
}
function parseField(lines: string[]): FieldSummary {
  const rows = lines.map(line => line.split(',').map(v => Number(v.trim())))
    .filter(parts => parts.length === 6 && parts.every(Number.isFinite));
  if (!rows.length) throw new Error('No valid 6-column magnetic-field rows were captured.');
  const bx = rows.map(r => r[1]), by = rows.map(r => r[2]), bz = rows.map(r => r[3]), bmag = rows.map(r => r[4]);
  return { samples: rows.length, mean: { bx: mean(bx), by: mean(by), bz: mean(bz), bmag: mean(bmag) }, std: { bx: std(bx), by: std(by), bz: std(bz), bmag: std(bmag) } };
}
function corrected(summary: FieldSummary, baseline: FieldSummary | null) {
  const bx = summary.mean.bx - (baseline?.mean.bx ?? 0);
  const by = summary.mean.by - (baseline?.mean.by ?? 0);
  const bz = summary.mean.bz - (baseline?.mean.bz ?? 0);
  return { bx, by, bz, bmag: Math.sqrt(bx * bx + by * by + bz * bz) };
}
function groupScan(scan: ScanPoint[]) {
  const grouped = new Map<number, ScanPoint[]>();
  for (const point of scan) grouped.set(point.positionMm, [...(grouped.get(point.positionMm) ?? []), point]);
  return grouped;
}
function aggregateScan(scan: ScanPoint[]): AggregatedScanPoint[] {
  return [...groupScan(scan).entries()].map(([positionMm, rows]) => ({
    positionMm,
    captures: rows.length,
    samples: rows.reduce((sum, row) => sum + row.samples, 0),
    bx: mean(rows.map(row => row.bx)),
    by: mean(rows.map(row => row.by)),
    bz: mean(rows.map(row => row.bz)),
    bmag: mean(rows.map(row => row.bmag)),
  })).sort((a, b) => a.positionMm - b.positionMm);
}
function repeatabilityRows(scan: ScanPoint[]): RepeatabilityRow[] {
  return [...groupScan(scan).entries()].filter(([, rows]) => rows.length >= 2).map(([positionMm, rows]) => {
    const values = rows.map(row => row.bmag);
    return {
      positionMm,
      captures: rows.length,
      meanBmag: mean(values),
      betweenCaptureStdBmag: sampleStd(values),
      minBmag: Math.min(...values),
      maxBmag: Math.max(...values),
    };
  }).sort((a, b) => a.positionMm - b.positionMm);
}
function trapz(points: Array<{ x: number; y: number }>) {
  const sorted = [...points].sort((a, b) => a.x - b.x);
  let total = 0;
  for (let i = 1; i < sorted.length; i++) total += 0.5 * (sorted[i - 1].y + sorted[i].y) * (sorted[i].x - sorted[i - 1].x);
  return total;
}
function interpolate(points: ModelPoint[], x: number): number | null {
  if (points.length < 2) return null;
  const sorted = [...points].sort((a, b) => a.position - b.position);
  if (x < sorted[0].position || x > sorted.at(-1)!.position) return null;
  for (let i = 1; i < sorted.length; i++) {
    const a = sorted[i - 1], b = sorted[i];
    if (x <= b.position) {
      if (b.position === a.position) return a.valueUt;
      const f = (x - a.position) / (b.position - a.position);
      return a.valueUt + f * (b.valueUt - a.valueUt);
    }
  }
  return null;
}
function validate(scan: AggregatedScanPoint[], axis: Axis, model: ModelPoint[]): Validation | null {
  const pairs = scan.map(point => {
    const modelValue = interpolate(model, point.positionMm);
    return modelValue === null ? null : { position: point.positionMm, measured: point[axis], model: modelValue, residual: point[axis] - modelValue };
  }).filter((v): v is NonNullable<typeof v> => v !== null);
  if (pairs.length < 2) return null;
  const mae = mean(pairs.map(p => Math.abs(p.residual)));
  const rmse = Math.sqrt(mean(pairs.map(p => p.residual ** 2)));
  const bias = mean(pairs.map(p => p.residual));
  const maxAbsResidual = Math.max(...pairs.map(p => Math.abs(p.residual)));
  const measuredMean = mean(pairs.map(p => p.measured));
  const sse = pairs.reduce((s, p) => s + p.residual ** 2, 0);
  const sst = pairs.reduce((s, p) => s + (p.measured - measuredMean) ** 2, 0);
  const r2 = sst > 0 ? 1 - sse / sst : null;
  const mx = mean(pairs.map(p => p.model)), my = mean(pairs.map(p => p.measured));
  const denom = pairs.reduce((s, p) => s + (p.model - mx) ** 2, 0);
  const scale = denom > 0 ? pairs.reduce((s, p) => s + (p.model - mx) * (p.measured - my), 0) / denom : null;
  const offset = scale === null ? null : my - scale * mx;
  return {
    pairs, mae, rmse, bias, maxAbsResidual, r2, scale, offset,
    measuredIntegral: trapz(pairs.map(p => ({ x: p.position, y: p.measured }))),
    modelIntegral: trapz(pairs.map(p => ({ x: p.position, y: p.model }))),
  };
}
function Metric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return <div style={{ border: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.025)', borderRadius: 12, padding: 12 }}><span style={{ display: 'block', color: '#8395aa', fontSize: 10 }}>{label}</span><b style={{ display: 'block', fontSize: 20, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{value}</b>{detail && <small style={{ color: '#8395aa' }}>{detail}</small>}</div>;
}
function parseCsv(text: string) {
  const lines = text.split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) throw new Error('CSV needs a header and at least one data row.');
  const headers = lines[0].split(',').map(value => value.trim());
  const rows = lines.slice(1).map(line => {
    const values = line.split(',');
    return Object.fromEntries(headers.map((header, index) => [header, (values[index] ?? '').trim()]));
  });
  return { headers, rows };
}
function numberFrom(row: Record<string, string>, names: string[]): number | null {
  for (const name of names) {
    if (!(name in row)) continue;
    const value = Number(row[name]);
    if (Number.isFinite(value)) return value;
  }
  return null;
}

export default function MagnetBenchSuiteV2() {
  const [mode, setMode] = useState<Mode>('acquire');
  const { ports, profiles, selectedPort, setSelectedPort, fqbn, setFqbn, hardwareStatus, refreshHardware } = useHardwareSession();
  const [status, setStatus] = useState('Ready');
  const [busy, setBusy] = useState(false);
  const [latest, setLatest] = useState<FieldSummary | null>(null);
  const [baseline, setBaseline] = useState<FieldSummary | null>(null);
  const [magnetCapture, setMagnetCapture] = useState<FieldSummary | null>(null);
  const [measurement, setMeasurement] = useState<MeasurementResult | null>(null);
  const [positionMm, setPositionMm] = useState('0');
  const [scan, setScan] = useState<ScanPoint[]>([]);
  const [axis, setAxis] = useState<Axis>('bz');
  const [modelRows, setModelRows] = useState<Record<string, string>[]>([]);
  const [modelHeaders, setModelHeaders] = useState<string[]>([]);
  const [positionColumn, setPositionColumn] = useState('');
  const [valueColumn, setValueColumn] = useState('');
  const [modelUnit, setModelUnit] = useState<'uT' | 'mT' | 'T'>('uT');

  async function refresh() {
    setStatus('Refreshing shared hardware session…');
    try {
      await refreshHardware();
      setStatus('Shared hardware session refreshed.');
    } catch (error) {
      setStatus(String(error));
    }
  }

  async function uploadFirmware() {
    if (!selectedPort) { setStatus('Select a serial device first.'); return; }
    setBusy(true);
    try {
      setStatus('Preparing Magnet Bench firmware…');
      const sketchDir = await invoke<string>('prepare_recipe', { recipeId: 'magnetic_mlx90393' });
      setStatus('Compiling…'); await invoke<string>('compile_sketch', { sketchDir, fqbn });
      setStatus('Uploading…'); await invoke<string>('upload_sketch', { sketchDir, fqbn, port: selectedPort });
      setStatus('Magnet Bench firmware uploaded.');
    } catch (error) { setStatus(`Upload failed: ${error}`); }
    finally { setBusy(false); }
  }
  async function captureField(label: string, durationMs = 5000) {
    if (!selectedPort) throw new Error('Select a serial device first.');
    setStatus(`Capturing ${label}…`);
    const result = await invoke<CaptureResult>('serial_capture', { port: selectedPort, baud: 115200, durationMs, maxLines: 5000, numericOnly: true });
    return parseField(result.lines);
  }
  async function captureLatest() {
    setBusy(true); try { const result = await captureField('vector field'); setLatest(result); setStatus(`${result.samples} vector samples analyzed`); } catch (error) { setStatus(String(error)); } finally { setBusy(false); }
  }
  async function captureBaseline() {
    setBusy(true); try { const result = await captureField('ambient baseline'); setBaseline(result); setStatus(`${result.samples} baseline samples analyzed`); } catch (error) { setStatus(String(error)); } finally { setBusy(false); }
  }
  async function captureMagnet() {
    setBusy(true); try { const result = await captureField('magnet'); setMagnetCapture(result); setStatus(`${result.samples} magnet samples analyzed`); } catch (error) { setStatus(String(error)); } finally { setBusy(false); }
  }
  async function addScanPoint() {
    const position = Number(positionMm);
    if (!Number.isFinite(position)) { setStatus('Enter a numeric scan position in mm.'); return; }
    setBusy(true);
    try {
      const result = await captureField(`scan point ${position} mm`);
      const c = corrected(result, baseline);
      setScan(current => {
        const repeat = current.filter(point => point.positionMm === position).length + 1;
        const point: ScanPoint = {
          id: `live-${Date.now()}-${position}-${repeat}`,
          repeat,
          capturedAt: Date.now(),
          source: 'live',
          positionMm: position,
          samples: result.samples,
          ...c,
        };
        return [...current, point].sort((a, b) => a.positionMm - b.positionMm || a.repeat - b.repeat);
      });
      const repeat = scan.filter(point => point.positionMm === position).length + 1;
      setStatus(`Scan point ${position} mm · Rep ${repeat} captured · corrected Bz ${fmt(c.bz)} µT`);
    } catch (error) { setStatus(String(error)); } finally { setBusy(false); }
  }
  async function recordEvidence() {
    if (!selectedPort) { setStatus('Select a serial device first.'); return; }
    setBusy(true);
    try {
      const result = await invoke<MeasurementResult>('capture_measurement', { port: selectedPort, durationMs: 5000, maxLines: 5000, boardProfile: fqbn, recipeId: 'magnetic_mlx90393' });
      setMeasurement(result); setStatus(`${result.samples} samples saved · ${result.directory}`);
    } catch (error) { setStatus(`Measurement failed: ${error}`); } finally { setBusy(false); }
  }

  async function loadMeasuredScan(file: File | null) {
    if (!file) return;
    try {
      const { rows } = parseCsv(await file.text());
      const repeats = new Map<number, number>();
      const imported: ScanPoint[] = [];
      rows.forEach((row, index) => {
        const position = numberFrom(row, ['position_mm', 'positionMm', 'position', 'x_mm', 'z_mm']);
        const bx = numberFrom(row, ['corrected_Bx_uT', 'corrected_bx_uT', 'bx', 'Bx_uT', 'mean_Bx_uT']);
        const by = numberFrom(row, ['corrected_By_uT', 'corrected_by_uT', 'by', 'By_uT', 'mean_By_uT']);
        const bz = numberFrom(row, ['corrected_Bz_uT', 'corrected_bz_uT', 'bz', 'Bz_uT', 'mean_Bz_uT']);
        if (position === null || bx === null || by === null || bz === null) return;
        const bmag = numberFrom(row, ['corrected_Bmag_uT', 'corrected_bmag_uT', 'bmag', 'Bmag_uT', 'mean_Bmag_uT']) ?? Math.sqrt(bx * bx + by * by + bz * bz);
        const repeat = (repeats.get(position) ?? 0) + 1;
        repeats.set(position, repeat);
        imported.push({
          id: `import-${index}-${position}-${repeat}`,
          repeat,
          capturedAt: Date.now(),
          source: 'import',
          positionMm: position,
          samples: numberFrom(row, ['samples', 'sample_count']) ?? 0,
          bx, by, bz, bmag,
        });
      });
      if (!imported.length) throw new Error('No compatible measured scan rows found. Expected position_mm plus corrected_Bx_uT / corrected_By_uT / corrected_Bz_uT or compatible aliases.');
      setScan(imported.sort((a, b) => a.positionMm - b.positionMm || a.repeat - b.repeat));
      const distinct = new Set(imported.map(point => point.positionMm)).size;
      setStatus(`Imported measured scan · ${imported.length} captures · ${distinct} distinct positions`);
      setMode('validate');
    } catch (error) {
      setStatus(`Measured scan import failed: ${error}`);
    }
  }

  async function loadModel(file: File | null) {
    if (!file) return;
    try {
      const { headers, rows } = parseCsv(await file.text());
      setModelHeaders(headers); setModelRows(rows);
      const positionGuess = headers.find(h => /position|(^|_)z($|_)|(^|_)x($|_)/i.test(h)) ?? headers[0];
      const valueGuess = headers.find(h => h !== positionGuess && /model|field|bz|by|bx|bmag/i.test(h)) ?? headers.find(h => h !== positionGuess) ?? '';
      setPositionColumn(positionGuess); setValueColumn(valueGuess);
      setStatus(`Loaded model CSV · ${rows.length} rows · choose columns if needed`);
    } catch (error) {
      setStatus(`Model CSV failed: ${error}`);
    }
  }

  const aggregatedScan = useMemo(() => aggregateScan(scan), [scan]);
  const repeatability = useMemo(() => repeatabilityRows(scan), [scan]);
  const modelPoints = useMemo<ModelPoint[]>(() => {
    const scale = modelUnit === 'T' ? 1e6 : modelUnit === 'mT' ? 1e3 : 1;
    return modelRows.map(row => ({ position: Number(row[positionColumn]), valueUt: Number(row[valueColumn]) * scale }))
      .filter(point => Number.isFinite(point.position) && Number.isFinite(point.valueUt))
      .sort((a, b) => a.position - b.position);
  }, [modelRows, positionColumn, valueColumn, modelUnit]);
  const validation = useMemo(() => validate(aggregatedScan, axis, modelPoints), [aggregatedScan, axis, modelPoints]);
  const correctedMagnet = magnetCapture ? corrected(magnetCapture, baseline) : null;
  const measuredSeries = aggregatedScan.map(point => ({ x: point.positionMm, y: point[axis] }));
  const modelSeries = validation?.pairs.map(point => ({ x: point.position, y: point.model })) ?? [];
  const hasProfilePlot = measuredSeries.length > 1 || modelSeries.length > 1;
  const activeMode = MODES.find(item => item.id === mode)!;

  return <div style={{ minHeight: '100vh', padding: '28px 34px 70px', color: '#edf5ff' }}>
    <div style={{ maxWidth: 1420, margin: '0 auto' }}>
      <header style={{ ...panel, marginBottom: 14, display: 'flex', justifyContent: 'space-between', gap: 20, alignItems: 'center' }}>
        <div><div className="eyebrow">Magnetism & Fields</div><h1 style={{ margin: '6px 0 4px' }}>Magnet Lab</h1><p style={{ ...muted, margin: 0 }}>Acquire → subtract background → preserve repeats → build a spatial profile → compare directly with a model.</p></div>
        <button className="ghost" onClick={refresh}><RefreshCw size={15}/> Refresh hardware</button>
      </header>

      <section style={{ ...panel, marginBottom: 14, display: 'grid', gridTemplateColumns: 'minmax(300px,420px) 1fr', gap: 16 }}>
        <div><b>Lab connection</b><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8 }}><label>Serial device<select value={selectedPort} onChange={e => setSelectedPort(e.target.value)}>{!ports.length && <option value="">No USB serial device</option>}{ports.map(p => <option key={p.port} value={p.port}>{p.port} · {p.board_name || 'Unknown'}</option>)}</select></label><label>Board profile<select value={fqbn} onChange={e => setFqbn(e.target.value)}>{profiles.map(p => <option key={p.fqbn} value={p.fqbn}>{p.label}</option>)}</select></label></div><div style={{ ...muted, fontSize: 11, marginTop: 10 }}>{status} · {hardwareStatus}</div></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>{MODES.map(item => <button key={item.id} onClick={() => setMode(item.id)} style={{ minHeight: 78, padding: 12, textAlign: 'left', borderRadius: 12, border: mode === item.id ? '1px solid rgba(112,220,255,.5)' : '1px solid rgba(255,255,255,.08)', background: mode === item.id ? 'rgba(59,123,255,.16)' : 'rgba(255,255,255,.025)', color: '#edf5ff', display: 'block' }}><b style={{ display: 'block', fontSize: 12 }}>{item.title}</b><span style={{ display: 'block', ...muted, fontSize: 10, marginTop: 5 }}>{item.subtitle}</span></button>)}</div>
      </section>

      <section style={{ ...panel, marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}><div><div className="eyebrow">CURRENT EXPERIMENT</div><h2 style={{ margin: '6px 0' }}>{activeMode.title}</h2><p style={{ ...muted, margin: 0 }}>{activeMode.subtitle}</p></div><Magnet size={28}/></div>

        {mode === 'acquire' && <div style={{ marginTop: 18 }}>
          <div className="bridge-flow" style={{ justifyContent: 'flex-start' }}><div>magnet / environment</div><b>→</b><div>MLX90393</div><b>→</b><div>Bx / By / Bz / |B|</div><b>→</b><div>vector result</div></div>
          <div className="action-row"><button className="ghost" disabled={busy || !selectedPort} onClick={uploadFirmware}><Upload size={15}/> Compile & Upload</button><button className="primary" disabled={busy || !selectedPort} onClick={captureLatest}><Activity size={15}/> Capture & Analyze 5 s</button><button className="ghost" disabled={busy || !selectedPort} onClick={recordEvidence}><Save size={15}/> Record evidence</button></div>
          {latest && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginTop: 14 }}><Metric label="Bx mean" value={`${fmt(latest.mean.bx)} µT`} detail={`σ ${fmt(latest.std.bx)}`}/><Metric label="By mean" value={`${fmt(latest.mean.by)} µT`} detail={`σ ${fmt(latest.std.by)}`}/><Metric label="Bz mean" value={`${fmt(latest.mean.bz)} µT`} detail={`σ ${fmt(latest.std.bz)}`}/><Metric label="|B| mean" value={`${fmt(latest.mean.bmag)} µT`} detail={`${latest.samples} samples`}/></div>}
          {measurement && <div className="measurement big" style={{ marginTop: 12 }}><b>{measurement.samples} saved samples</b><span>{measurement.directory}</span></div>}
          <div className="boundary">This is field at the sensor location/orientation, not an intrinsic one-number magnet strength.</div>
        </div>}

        {mode === 'characterize' && <div style={{ marginTop: 18 }}>
          <div className="bridge-flow" style={{ justifyContent: 'flex-start' }}><div>ambient baseline</div><b>+</b><div>repeated magnet captures</div><b>→</b><div>vector subtraction</div><b>→</b><div>scan + repeatability</div></div>
          <div className="action-row"><button className="ghost" disabled={busy || !selectedPort} onClick={captureBaseline}>Capture ambient baseline</button><button className="primary" disabled={busy || !selectedPort} onClick={captureMagnet}>Capture fixed-position magnet</button></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginTop: 14 }}><Metric label="Baseline Bz" value={baseline ? `${fmt(baseline.mean.bz)} µT` : '—'} detail={baseline ? `${baseline.samples} samples` : 'capture first'}/><Metric label="Corrected Bx" value={correctedMagnet ? `${fmt(correctedMagnet.bx)} µT` : '—'}/><Metric label="Corrected By" value={correctedMagnet ? `${fmt(correctedMagnet.by)} µT` : '—'}/><Metric label="Corrected Bz / |B|" value={correctedMagnet ? `${fmt(correctedMagnet.bz)} / ${fmt(correctedMagnet.bmag)} µT` : '—'}/></div>

          <div style={{ marginTop: 18, borderTop: '1px solid rgba(255,255,255,.07)', paddingTop: 16 }}>
            <h3 style={{ fontSize: 13 }}><MapPinned size={15}/> Spatial scan & repeatability</h3>
            <div className="action-row"><label style={{ maxWidth: 180 }}>Position (mm)<input value={positionMm} onChange={e => setPositionMm(e.target.value)}/></label><button className="primary" disabled={busy || !selectedPort} onClick={addScanPoint}>Capture repeat</button><label className="ghost" style={{ display: 'inline-flex', gap: 7, alignItems: 'center', cursor: 'pointer' }}><Upload size={14}/> Import measured scan CSV<input style={{ display: 'none' }} type="file" accept=".csv,text/csv" onChange={e => void loadMeasuredScan(e.target.files?.[0] ?? null)}/></label><button className="ghost" disabled={!scan.length} onClick={() => setScan([])}>Clear scan</button></div>
            {scan.length ? <div style={{ overflow: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}><thead><tr><th>position mm</th><th>rep</th><th>source</th><th>samples</th><th>corrected Bx µT</th><th>By µT</th><th>Bz µT</th><th>|B| µT</th></tr></thead><tbody>{scan.map(point => <tr key={point.id}><td>{fmt(point.positionMm,2)}</td><td>{point.repeat}</td><td>{point.source}</td><td>{point.samples}</td><td>{fmt(point.bx)}</td><td>{fmt(point.by)}</td><td>{fmt(point.bz)}</td><td>{fmt(point.bmag)}</td></tr>)}</tbody></table></div> : <div className="empty">Capture a baseline, enter a controlled position, and add repeated captures. Repeating a position is preserved as Rep 1 / Rep 2 / Rep 3 rather than replacing evidence.</div>}

            {repeatability.length > 0 && <div style={{ marginTop: 14 }}><h3 style={{ fontSize: 12 }}>Between-capture repeatability</h3><div style={{ overflow: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}><thead><tr><th>position mm</th><th>captures</th><th>mean corrected |B| µT</th><th>between-capture σ µT</th><th>range µT</th></tr></thead><tbody>{repeatability.map(row => <tr key={row.positionMm}><td>{fmt(row.positionMm,2)}</td><td>{row.captures}</td><td>{fmt(row.meanBmag)}</td><td>{fmt(row.betweenCaptureStdBmag)}</td><td>{fmt(row.maxBmag - row.minBmag)}</td></tr>)}</tbody></table></div><p style={{ ...muted, fontSize: 10 }}>Within-capture variation describes samples inside one acquisition. Between-capture repeatability compares independent captures at the same controlled position; they are different evidence.</p></div>}
          </div>
          <div className="boundary">Background subtraction and repeatability are meaningful only when sensor orientation, fixture geometry and environment remain comparable. Position/orientation control is part of the experiment.</div>
        </div>}

        {mode === 'validate' && <div style={{ marginTop: 18 }}>
          <div className="bridge-flow" style={{ justifyContent: 'flex-start' }}><div>measured scan / history</div><b>↔</b><div>model CSV</div><b>→</b><div>aggregate repeats</div><b>→</b><div>residual / fit / integral</div></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1.05fr 1.05fr .8fr .8fr .55fr', gap: 10, alignItems: 'end', marginTop: 14 }}>
            <label>Measured scan CSV<input type="file" accept=".csv,text/csv" onChange={e => void loadMeasuredScan(e.target.files?.[0] ?? null)}/></label>
            <label>Model CSV<input type="file" accept=".csv,text/csv" onChange={e => void loadModel(e.target.files?.[0] ?? null)}/></label>
            <label>Position column<select value={positionColumn} onChange={e => setPositionColumn(e.target.value)}>{modelHeaders.map(h => <option key={h}>{h}</option>)}</select></label>
            <label>Model field column<select value={valueColumn} onChange={e => setValueColumn(e.target.value)}>{modelHeaders.map(h => <option key={h}>{h}</option>)}</select></label>
            <label>Unit<select value={modelUnit} onChange={e => setModelUnit(e.target.value as 'uT'|'mT'|'T')}><option value="uT">µT</option><option value="mT">mT</option><option value="T">T</option></select></label>
          </div>
          <div className="action-row"><label style={{ maxWidth: 220 }}>Measured channel<select value={axis} onChange={e => setAxis(e.target.value as Axis)}><option value="bx">corrected Bx</option><option value="by">corrected By</option><option value="bz">corrected Bz</option><option value="bmag">corrected |B|</option></select></label><span style={{ ...muted, fontSize: 10 }}>{scan.length} captures · {aggregatedScan.length} distinct positions · validation uses the repeat mean at each position</span></div>
          {!validation ? <div className="empty">Need at least two distinct measured positions inside the model position range plus a readable model CSV. You can use the current scan or import an existing Magnet Bench 02 `magnet02_scan.csv`.</div> : <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginTop: 14 }}><Metric label="RMSE" value={`${fmt(validation.rmse)} µT`}/><Metric label="MAE" value={`${fmt(validation.mae)} µT`}/><Metric label="Bias" value={`${fmt(validation.bias)} µT`}/><Metric label="R²" value={fmt(validation.r2,5)}/></div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginTop: 8 }}><Metric label="Max |residual|" value={`${fmt(validation.maxAbsResidual)} µT`}/><Metric label="Affine scale" value={fmt(validation.scale,6)}/><Metric label="Affine offset" value={`${fmt(validation.offset)} µT`}/><Metric label="Field integral Δ" value={`${fmt(validation.measuredIntegral - validation.modelIntegral)} µT·mm`}/></div>
            {hasProfilePlot && <div style={{ marginTop: 16 }}><h3 style={{ fontSize: 13 }}><BarChart3 size={15}/> Measured ↔ model profile</h3><EngineeringPlot series={[{ label: 'measured position mean', points: measuredSeries }, { label: 'model', points: modelSeries, dashed: true, opacity: .68 }]} xLabel="position" xUnit="mm" yLabel={`corrected ${axis === 'bmag' ? '|B|' : axis.toUpperCase()}`} yUnit="µT" height={310} /></div>}
            <div style={{ overflow: 'auto', marginTop: 14 }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}><thead><tr><th>position mm</th><th>measured mean µT</th><th>model µT</th><th>residual µT</th></tr></thead><tbody>{validation.pairs.map(p => <tr key={p.position}><td>{fmt(p.position,2)}</td><td>{fmt(p.measured)}</td><td>{fmt(p.model)}</td><td>{fmt(p.residual)}</td></tr>)}</tbody></table></div>
          </>}
          <div className="boundary">The model is linearly interpolated at distinct measured positions. Repeated captures are preserved and averaged for the profile while their between-capture spread remains visible as separate repeatability evidence. These metrics test agreement for the supplied geometry, coordinate convention, units, baseline and selected channel; they do not prove global model validity.</div>
        </div>}
      </section>
    </div>
  </div>;
}
