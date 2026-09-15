import { useMemo, useState } from 'react';
import { BarChart3, Database, Magnet, MapPinned, Scale } from 'lucide-react';
import EngineeringPlot from './EngineeringPlot';

type Magnet02Summary = {
  schema: 'betterboard.magnet-bench02/0.1';
  captures: number;
  distinct_positions: number;
  baseline_source: string | null;
  baseline_vector_uT: { Bx: number; By: number; Bz: number; Bmag_of_mean_vector: number };
  peak_corrected_Bmag_uT: number;
  peak_position_mm: number;
  corrected_Bmag_integral_uT_mm: number;
  repeatability: Array<{ position_mm: number; captures: number; mean_corrected_Bmag_uT: number; between_capture_stdev_uT: number }>;
  boundary: string;
};

type Magnet03Summary = {
  schema?: string;
  mae?: number;
  rmse?: number;
  bias?: number;
  max_abs_residual?: number;
  relative_rmse?: number | null;
  r2?: number | null;
  measured_peak_abs_uT?: number;
  model_peak_abs_uT?: number;
  measured_integral_uT_mm?: number;
  model_integral_uT_mm?: number;
  integral_difference_uT_mm?: number;
  residual_standard_deviation_uT?: number;
  affine_discrepancy_fit?: {
    model: string;
    scale: number;
    offset_uT: number;
    rmse_before_uT: number;
    rmse_after_uT: number;
    r2_after: number | null;
    improvement_fraction: number | null;
  };
  suggested_next_measurement_points?: Array<{ position_mm: number; score: number }>;
  boundary?: string;
};

type ScanPoint = {
  position: number;
  bx: number | null;
  by: number | null;
  bz: number | null;
  bmag: number | null;
  gradient: number | null;
};

type ResidualPoint = { position: number; measured: number; model: number; residual: number; absResidual: number };

type Loaded =
  | { kind: 'magnet02-summary'; name: string; value: Magnet02Summary }
  | { kind: 'magnet03-summary'; name: string; value: Magnet03Summary }
  | { kind: 'magnet02-scan'; name: string; rows: ScanPoint[] }
  | { kind: 'magnet03-residuals'; name: string; rows: ResidualPoint[] };

function fmt(value: unknown, digits = 4) {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number)) return '—';
  const abs = Math.abs(number);
  return abs !== 0 && (abs < 1e-3 || abs >= 1e5) ? number.toExponential(3) : number.toFixed(digits).replace(/\.?0+$/, '');
}

function Metric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return <div className="panel" style={{ padding: 11 }}><span className="eyebrow">{label}</span><b style={{ display: 'block', fontSize: 19, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{value}</b>{detail && <small className="muted">{detail}</small>}</div>;
}

function rowsFromCsv(text: string) {
  const lines = text.split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) throw new Error('CSV needs a header and at least one row.');
  const headers = lines[0].split(',').map(value => value.trim());
  return lines.slice(1).map(line => {
    const values = line.split(',');
    return Object.fromEntries(headers.map((header, index) => [header, (values[index] ?? '').trim()]));
  });
}

function finiteNumber(value: string | undefined) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function parseScan(text: string): ScanPoint[] {
  return rowsFromCsv(text).map(row => ({
    position: Number(row.position_mm),
    bx: finiteNumber(row.corrected_Bx_uT),
    by: finiteNumber(row.corrected_By_uT),
    bz: finiteNumber(row.corrected_Bz_uT),
    bmag: finiteNumber(row.corrected_Bmag_uT),
    gradient: finiteNumber(row.gradient_Bmag_uT_per_mm),
  })).filter(row => Number.isFinite(row.position));
}

function parseResiduals(text: string): ResidualPoint[] {
  return rowsFromCsv(text).map(row => ({
    position: Number(row.position_mm),
    measured: Number(row.measured_uT),
    model: Number(row.model_uT),
    residual: Number(row.residual_uT),
    absResidual: Number(row.abs_residual_uT),
  })).filter(row => [row.position, row.measured, row.model, row.residual, row.absResidual].every(Number.isFinite));
}

export default function MagnetResultVisualization() {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState('');

  async function load(file: File | null) {
    if (!file) return;
    try {
      const text = await file.text();
      const lower = file.name.toLowerCase();
      if (lower.endsWith('.json')) {
        const value = JSON.parse(text) as Magnet02Summary | Magnet03Summary;
        if ((value as Magnet02Summary).schema === 'betterboard.magnet-bench02/0.1') setLoaded({ kind: 'magnet02-summary', name: file.name, value: value as Magnet02Summary });
        else if ('affine_discrepancy_fit' in value || 'rmse' in value || lower.includes('magnet03')) setLoaded({ kind: 'magnet03-summary', name: file.name, value: value as Magnet03Summary });
        else throw new Error('Unsupported magnetic summary JSON.');
      } else if (lower.includes('residual')) {
        const rows = parseResiduals(text);
        if (!rows.length) throw new Error('No Magnet 03 residual rows detected.');
        setLoaded({ kind: 'magnet03-residuals', name: file.name, rows });
      } else {
        const rows = parseScan(text);
        if (!rows.length) throw new Error('No Magnet 02 scan rows detected.');
        setLoaded({ kind: 'magnet02-scan', name: file.name, rows });
      }
      setError('');
    } catch (cause) {
      setLoaded(null);
      setError(String(cause));
    }
  }

  const suggestedMarkers = useMemo(() => loaded?.kind === 'magnet03-summary'
    ? (loaded.value.suggested_next_measurement_points ?? []).slice(0, 8).map(point => ({ x: point.position_mm, label: 'next' }))
    : [], [loaded]);

  return <section className="panel" style={{ marginTop: 14 }}>
    <div className="panel-title"><Magnet size={18}/> Magnetic Analyzer Results</div>
    <p className="muted">Visualize existing Magnet Bench characterization and model-validation outputs while keeping measured field, baseline correction, model prediction and residual evidence distinct.</p>
    <div className="action-row">
      <label className="ghost" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, cursor: 'pointer' }}><Database size={15}/> Open magnetic analyzer result<input type="file" accept=".json,.csv,application/json,text/csv" style={{ display: 'none' }} onChange={event => void load(event.target.files?.[0] ?? null)}/></label>
      <span className="muted">{loaded?.name ?? 'magnet02_summary.json · magnet02_scan.csv · magnet03_summary.json · magnet03_residuals.csv'}</span>
    </div>
    {error && <div className="boundary">{error}</div>}

    {loaded?.kind === 'magnet02-summary' && <>
      <div className="schema-row" style={{ marginTop: 10 }}><span>MEASURED + BASELINE-CORRECTED</span><span>{loaded.value.schema}</span></div>
      <div className="engineering-model-grid" style={{ marginTop: 10 }}>
        <Metric label="Captures" value={String(loaded.value.captures)} detail={`${loaded.value.distinct_positions} positions`}/>
        <Metric label="Peak corrected |B|" value={`${fmt(loaded.value.peak_corrected_Bmag_uT)} µT`} detail={`at ${fmt(loaded.value.peak_position_mm)} mm`}/>
        <Metric label="Field integral" value={`${fmt(loaded.value.corrected_Bmag_integral_uT_mm)} µT·mm`}/>
        <Metric label="Baseline |mean B⃗|" value={`${fmt(loaded.value.baseline_vector_uT.Bmag_of_mean_vector)} µT`} detail={loaded.value.baseline_source ?? 'baseline source not recorded'}/>
      </div>
      {loaded.value.repeatability.length > 0 && <section className="panel" style={{ marginTop: 12 }}>
        <div className="panel-title"><BarChart3 size={16}/> Between-capture repeatability</div>
        <EngineeringPlot compact series={[
          { label: 'mean corrected |B|', points: loaded.value.repeatability.map(row => ({ x: row.position_mm, y: row.mean_corrected_Bmag_uT })) },
          { label: 'between-capture σ', points: loaded.value.repeatability.map(row => ({ x: row.position_mm, y: row.between_capture_stdev_uT })), dashed: true },
        ]} xLabel="position" xUnit="mm" yLabel="field / repeatability" yUnit="µT"/>
      </section>}
      <div className="boundary compact">{loaded.value.boundary}</div>
    </>}

    {loaded?.kind === 'magnet02-scan' && <>
      <div className="schema-row" style={{ marginTop: 10 }}><span>MEASURED FIELD CHARACTERIZATION</span><span>{loaded.rows.length} scan rows</span></div>
      <section className="panel" style={{ marginTop: 12 }}>
        <div className="panel-title"><MapPinned size={16}/> Corrected spatial field profile</div>
        <EngineeringPlot series={[
          { label: 'Bx', points: loaded.rows.filter(row => row.bx !== null).map(row => ({ x: row.position, y: row.bx! })) },
          { label: 'By', points: loaded.rows.filter(row => row.by !== null).map(row => ({ x: row.position, y: row.by! })), dashed: true },
          { label: 'Bz', points: loaded.rows.filter(row => row.bz !== null).map(row => ({ x: row.position, y: row.bz! })) },
          { label: '|B|', points: loaded.rows.filter(row => row.bmag !== null).map(row => ({ x: row.position, y: row.bmag! })), dashed: true },
        ]} xLabel="position" xUnit="mm" yLabel="corrected field" yUnit="µT"/>
      </section>
      {loaded.rows.some(row => row.gradient !== null) && <section className="panel" style={{ marginTop: 12 }}>
        <div className="panel-title"><Scale size={16}/> Spatial gradient</div>
        <EngineeringPlot compact zeroLine series={[{ label: 'd|B|/dx', points: loaded.rows.filter(row => row.gradient !== null).map(row => ({ x: row.position, y: row.gradient! })) }]} xLabel="position" xUnit="mm" yLabel="gradient" yUnit="µT/mm"/>
      </section>}
    </>}

    {loaded?.kind === 'magnet03-summary' && <>
      <div className="schema-row" style={{ marginTop: 10 }}><span>MEASUREMENT ↔ MODEL DERIVED COMPARISON</span><span>Magnet Bench 03</span></div>
      <div className="engineering-model-grid" style={{ marginTop: 10 }}>
        <Metric label="RMSE" value={`${fmt(loaded.value.rmse)} µT`}/>
        <Metric label="MAE" value={`${fmt(loaded.value.mae)} µT`}/>
        <Metric label="Bias" value={`${fmt(loaded.value.bias)} µT`}/>
        <Metric label="R²" value={fmt(loaded.value.r2, 4)}/>
        <Metric label="Integral difference" value={`${fmt(loaded.value.integral_difference_uT_mm)} µT·mm`}/>
        <Metric label="Residual σ" value={`${fmt(loaded.value.residual_standard_deviation_uT)} µT`}/>
        <Metric label="Affine scale" value={fmt(loaded.value.affine_discrepancy_fit?.scale, 6)} detail={`offset ${fmt(loaded.value.affine_discrepancy_fit?.offset_uT)} µT`}/>
        <Metric label="Affine RMSE after" value={`${fmt(loaded.value.affine_discrepancy_fit?.rmse_after_uT)} µT`} detail={`before ${fmt(loaded.value.affine_discrepancy_fit?.rmse_before_uT)} µT`}/>
      </div>
      {(loaded.value.suggested_next_measurement_points?.length ?? 0) > 0 && <section className="panel" style={{ marginTop: 12 }}>
        <div className="panel-title"><MapPinned size={16}/> Suggested next measurement points</div>
        <EngineeringPlot compact series={[{ label: 'residual-driven score', kind: 'stem', points: loaded.value.suggested_next_measurement_points!.map(point => ({ x: point.position_mm, y: point.score })) }]} xLabel="position" xUnit="mm" yLabel="score" eventMarkers={suggestedMarkers}/>
      </section>}
      <div className="boundary compact">{loaded.value.boundary ?? 'Numerical agreement does not prove measurement calibration or model geometry correctness.'}</div>
    </>}

    {loaded?.kind === 'magnet03-residuals' && <>
      <div className="schema-row" style={{ marginTop: 10 }}><span>MEASURED ↔ MODEL ↔ RESIDUAL</span><span>{loaded.rows.length} aligned positions</span></div>
      <section className="panel" style={{ marginTop: 12 }}>
        <div className="panel-title"><BarChart3 size={16}/> Measured ↔ model field profile</div>
        <EngineeringPlot series={[
          { label: 'measured', points: loaded.rows.map(row => ({ x: row.position, y: row.measured })) },
          { label: 'model', points: loaded.rows.map(row => ({ x: row.position, y: row.model })), dashed: true },
        ]} xLabel="position" xUnit="mm" yLabel="field" yUnit="µT"/>
      </section>
      <section className="panel" style={{ marginTop: 12 }}>
        <div className="panel-title"><Scale size={16}/> Residual structure</div>
        <EngineeringPlot zeroLine series={[{ label: 'measured − model', points: loaded.rows.map(row => ({ x: row.position, y: row.residual })) }]} xLabel="position" xUnit="mm" yLabel="residual" yUnit="µT"/>
      </section>
      <div className="boundary compact">Residuals are derived comparisons. They do not replace either the measured field record or the model prediction.</div>
    </>}
  </section>;
}
