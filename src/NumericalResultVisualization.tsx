import { useMemo, useState } from 'react';
import { BarChart3, Database, Gauge, Sigma, TimerReset } from 'lucide-react';
import EngineeringPlot from './EngineeringPlot';

type Bench02Summary = {
  schema: 'betterboard.bench02-numerical-error/0.2';
  sample_count: number;
  duration_s: number;
  rejected_rows?: number;
  timing: {
    target_rate_hz: number | null;
    median_dt_s: number;
    dt_std_s: number;
    jitter_rms_s: number;
    jitter_p95_abs_s: number;
    jitter_max_abs_s: number;
    observed_rate_hz: number | null;
    dt_coefficient_of_variation: number | null;
  };
  derivative: { method: string; legacy_span_vs_nonuniform_rmse: number; interpretation?: string };
  floating_point_accumulation: {
    trapezoid_float64: number;
    trapezoid_float32_naive: number;
    trapezoid_float32_kahan: number;
    naive_absolute_difference_vs_float64: number;
    kahan_absolute_difference_vs_float64: number;
    naive_relative_difference_vs_float64: number | null;
    kahan_relative_difference_vs_float64: number | null;
  };
  downsample_convergence: Array<{
    factor: number;
    samples: number;
    effective_rate_hz: number | null;
    trapezoid_integral: number;
    integral_delta_vs_fine: number;
    relative_integral_delta_vs_fine: number | null;
    derivative_rmse_vs_fine: number | null;
  }>;
  reference_boundary?: string;
};

type MethodSummary = {
  points: number;
  maximum_absolute_error?: number | string;
  median_absolute_error?: number | string;
  maximum_argument_reduction_output_error?: number | string;
  maximum_taylor_recurrence_error?: number | string;
  worst_x?: number;
  accuracy_pass_rate?: number;
  reliability_rate?: number;
  false_convergence_count?: number;
  median_runtime_us?: number;
  dominant_error_sources?: Record<string, number>;
};

type ConvergenceSummary = {
  points: number;
  first_reliable_term_limit?: number | null;
  best_term_limit?: number | null;
  best_normalized_error?: number | string | null;
  false_convergence_count?: number;
};

type Bench03Summary = {
  schema: 'betterboard.bench03-summary/0.2';
  rows: number;
  parameter_scan_rows: number;
  convergence_rows: number;
  accuracy_rule: string;
  raw_parameter_scan: MethodSummary;
  range_reduced_parameter_scan: MethodSummary;
  raw_convergence: ConvergenceSummary;
  range_reduced_convergence: ConvergenceSummary;
  observed_float_bytes: number[];
  observed_double_bytes: number[];
  observed_float_epsilon: number[];
  reference_backends: string[];
};

type Bench03AnalysisPoint = {
  studyCode: number;
  methodCode: number;
  x: number;
  termLimit: number;
  absoluteError: number;
  normalizedError: number | null;
  elapsedUs: number;
  falseConvergence: boolean;
  reliable: boolean;
};

type Loaded =
  | { kind: 'bench02'; name: string; summary: Bench02Summary }
  | { kind: 'bench03-summary'; name: string; summary: Bench03Summary }
  | { kind: 'bench03-analysis'; name: string; rows: Bench03AnalysisPoint[] };

function fmt(value: unknown, digits = 4) {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number)) return '—';
  const abs = Math.abs(number);
  return abs !== 0 && (abs < 1e-3 || abs >= 1e5) ? number.toExponential(3) : number.toFixed(digits).replace(/\.?0+$/, '');
}

function probability(value: number | undefined) {
  return value === undefined || !Number.isFinite(value) ? '—' : `${(100 * value).toFixed(1)}%`;
}

function Metric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return <div className="panel" style={{ padding: 11 }}><span className="eyebrow">{label}</span><b style={{ display: 'block', fontSize: 19, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{value}</b>{detail && <small className="muted">{detail}</small>}</div>;
}

function csvRows(text: string) {
  const lines = text.split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) throw new Error('CSV needs a header and at least one data row.');
  const headers = lines[0].split(',').map(value => value.trim());
  return lines.slice(1).map(line => {
    const cells = line.split(',');
    return Object.fromEntries(headers.map((header, index) => [header, (cells[index] ?? '').trim()]));
  });
}

function parseBool(value: string | undefined) {
  return value === 'True' || value === 'true' || value === '1';
}

function parseBench03Csv(text: string): Bench03AnalysisPoint[] {
  return csvRows(text).map(row => ({
    studyCode: Number(row.study_code),
    methodCode: Number(row.method_code),
    x: Number(row.exact_binary32_x ?? row.x),
    termLimit: Number(row.term_limit),
    absoluteError: Number(row.absolute_error),
    normalizedError: Number.isFinite(Number(row.normalized_error)) ? Number(row.normalized_error) : null,
    elapsedUs: Number(row.elapsed_us),
    falseConvergence: parseBool(row.false_convergence),
    reliable: parseBool(row.numerically_reliable),
  })).filter(row => Number.isFinite(row.studyCode) && Number.isFinite(row.methodCode) && Number.isFinite(row.absoluteError));
}

export default function NumericalResultVisualization() {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState('');

  async function load(file: File | null) {
    if (!file) return;
    try {
      const text = await file.text();
      if (file.name.toLowerCase().endsWith('.json')) {
        const value = JSON.parse(text) as Bench02Summary | Bench03Summary;
        if (value.schema === 'betterboard.bench02-numerical-error/0.2') setLoaded({ kind: 'bench02', name: file.name, summary: value });
        else if (value.schema === 'betterboard.bench03-summary/0.2') setLoaded({ kind: 'bench03-summary', name: file.name, summary: value });
        else throw new Error(`Unsupported numerical summary schema: ${String((value as { schema?: unknown }).schema ?? 'missing')}`);
      } else {
        const rows = parseBench03Csv(text);
        if (!rows.length) throw new Error('No Bench 03 analyzer rows detected.');
        setLoaded({ kind: 'bench03-analysis', name: file.name, rows });
      }
      setError('');
    } catch (cause) {
      setLoaded(null);
      setError(String(cause));
    }
  }

  const bench03Scan = useMemo(() => loaded?.kind === 'bench03-analysis' ? loaded.rows.filter(row => row.studyCode === 1) : [], [loaded]);
  const bench03Convergence = useMemo(() => loaded?.kind === 'bench03-analysis' ? loaded.rows.filter(row => row.studyCode === 2) : [], [loaded]);

  return <section className="panel" style={{ marginTop: 14 }}>
    <div className="panel-title"><Sigma size={18}/> Depth Analyzer Results</div>
    <p className="muted">Visualize machine-readable outputs already produced by BetterBoard's independent numerical analyzers. This view does not recompute the analyzer or promote host-reference results into raw MCU evidence.</p>
    <div className="action-row">
      <label className="ghost" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, cursor: 'pointer' }}><Database size={15}/> Open analyzer result<input type="file" accept=".json,.csv,application/json,text/csv" style={{ display: 'none' }} onChange={event => void load(event.target.files?.[0] ?? null)}/></label>
      <span className="muted">{loaded?.name ?? 'bench02_summary.json · bench03_summary.json · bench03_analysis.csv'}</span>
    </div>
    {error && <div className="boundary">{error}</div>}

    {loaded?.kind === 'bench02' && <>
      <div className="schema-row" style={{ marginTop: 10 }}><span>HOST-DERIVED ANALYZER</span><span>{loaded.summary.schema}</span></div>
      <div className="engineering-model-grid" style={{ marginTop: 10 }}>
        <Metric label="Observed rate" value={`${fmt(loaded.summary.timing.observed_rate_hz, 3)} Hz`} detail={`target ${fmt(loaded.summary.timing.target_rate_hz, 3)} Hz`}/>
        <Metric label="RMS jitter" value={`${fmt(loaded.summary.timing.jitter_rms_s * 1000, 4)} ms`} detail={`p95 ${fmt(loaded.summary.timing.jitter_p95_abs_s * 1000, 4)} ms`}/>
        <Metric label="Max |jitter|" value={`${fmt(loaded.summary.timing.jitter_max_abs_s * 1000, 4)} ms`} detail={`CV ${fmt(loaded.summary.timing.dt_coefficient_of_variation, 5)}`}/>
        <Metric label="Derivative formula gap" value={fmt(loaded.summary.derivative.legacy_span_vs_nonuniform_rmse, 6)} detail="legacy span vs non-uniform 3-point"/>
        <Metric label="Float32 naive Δ" value={fmt(loaded.summary.floating_point_accumulation.naive_absolute_difference_vs_float64, 7)} detail="vs float64 trapezoid"/>
        <Metric label="Float32 Kahan Δ" value={fmt(loaded.summary.floating_point_accumulation.kahan_absolute_difference_vs_float64, 7)} detail="vs float64 trapezoid"/>
      </div>
      <div className="engineering-model-grid" style={{ marginTop: 12 }}>
        <section className="panel">
          <div className="panel-title"><BarChart3 size={16}/> Downsampling · derivative sensitivity</div>
          <EngineeringPlot compact series={[{ label: 'derivative RMSE vs finest', points: loaded.summary.downsample_convergence.filter(row => row.derivative_rmse_vs_fine !== null).map(row => ({ x: row.factor, y: row.derivative_rmse_vs_fine! })) }]} xLabel="downsample factor" yLabel="derivative RMSE" />
        </section>
        <section className="panel">
          <div className="panel-title"><Gauge size={16}/> Downsampling · integration sensitivity</div>
          <EngineeringPlot compact zeroLine series={[{ label: 'integral Δ vs finest', points: loaded.summary.downsample_convergence.map(row => ({ x: row.factor, y: row.integral_delta_vs_fine })) }]} xLabel="downsample factor" yLabel="integral Δ" />
        </section>
      </div>
      <div className="boundary compact">{loaded.summary.reference_boundary ?? 'The finest measured series is an empirical numerical baseline, not physical ground truth.'}</div>
    </>}

    {loaded?.kind === 'bench03-summary' && <>
      <div className="schema-row" style={{ marginTop: 10 }}><span>MCU EVIDENCE + HOST REFERENCE</span><span>{loaded.summary.schema}</span></div>
      <div className="engineering-model-grid" style={{ marginTop: 10 }}>
        <Metric label="Raw reliability" value={probability(loaded.summary.raw_parameter_scan.reliability_rate)} detail={`${loaded.summary.raw_parameter_scan.false_convergence_count ?? 0} false convergence`}/>
        <Metric label="Reduced reliability" value={probability(loaded.summary.range_reduced_parameter_scan.reliability_rate)} detail={`${loaded.summary.range_reduced_parameter_scan.false_convergence_count ?? 0} false convergence`}/>
        <Metric label="Raw max |error|" value={fmt(loaded.summary.raw_parameter_scan.maximum_absolute_error, 7)} detail={`worst x ${fmt(loaded.summary.raw_parameter_scan.worst_x, 4)}`}/>
        <Metric label="Reduced max |error|" value={fmt(loaded.summary.range_reduced_parameter_scan.maximum_absolute_error, 7)} detail={`worst x ${fmt(loaded.summary.range_reduced_parameter_scan.worst_x, 4)}`}/>
        <Metric label="Raw first reliable term" value={fmt(loaded.summary.raw_convergence.first_reliable_term_limit, 0)}/>
        <Metric label="Reduced first reliable term" value={fmt(loaded.summary.range_reduced_convergence.first_reliable_term_limit, 0)}/>
        <Metric label="Raw median runtime" value={`${fmt(loaded.summary.raw_parameter_scan.median_runtime_us, 2)} µs`}/>
        <Metric label="Reduced median runtime" value={`${fmt(loaded.summary.range_reduced_parameter_scan.median_runtime_us, 2)} µs`}/>
      </div>
      <section className="panel" style={{ marginTop: 12 }}>
        <div className="panel-title"><BarChart3 size={16}/> RAW ↔ REDUCED reliability comparison</div>
        <EngineeringPlot compact series={[
          { label: 'reliability', kind: 'stem', points: [{ x: 0, y: loaded.summary.raw_parameter_scan.reliability_rate ?? 0 }, { x: 1, y: loaded.summary.range_reduced_parameter_scan.reliability_rate ?? 0 }] },
          { label: 'accuracy pass', kind: 'scatter', points: [{ x: 0, y: loaded.summary.raw_parameter_scan.accuracy_pass_rate ?? 0 }, { x: 1, y: loaded.summary.range_reduced_parameter_scan.accuracy_pass_rate ?? 0 }] },
        ]} xLabel="method index (0 raw · 1 reduced)" yLabel="fraction" />
      </section>
      <div className="boundary compact"><TimerReset size={14}/>{loaded.summary.accuracy_rule} · reference backend: {loaded.summary.reference_backends.join(', ') || '—'}</div>
    </>}

    {loaded?.kind === 'bench03-analysis' && <>
      <div className="schema-row" style={{ marginTop: 10 }}><span>ROW-LEVEL MCU ↔ HOST COMPARISON</span><span>{loaded.rows.length} rows</span></div>
      {bench03Scan.length > 0 && <section className="panel" style={{ marginTop: 12 }}>
        <div className="panel-title"><BarChart3 size={16}/> Parameter scan · absolute error</div>
        <EngineeringPlot series={[
          { label: 'RAW absolute error', points: bench03Scan.filter(row => row.methodCode === 0).map(row => ({ x: row.x, y: row.absoluteError })) },
          { label: 'REDUCED absolute error', points: bench03Scan.filter(row => row.methodCode === 1).map(row => ({ x: row.x, y: row.absoluteError })), dashed: true },
        ]} xLabel="exact binary32 x" yLabel="absolute error" eventMarkers={bench03Scan.filter(row => row.falseConvergence).slice(0, 16).map(row => ({ x: row.x, label: 'false convergence' }))}/>
      </section>}
      {bench03Convergence.length > 0 && <section className="panel" style={{ marginTop: 12 }}>
        <div className="panel-title"><Gauge size={16}/> Fixed-term convergence</div>
        <EngineeringPlot series={[
          { label: 'RAW normalized error', points: bench03Convergence.filter(row => row.methodCode === 0 && row.normalizedError !== null).map(row => ({ x: row.termLimit, y: row.normalizedError! })) },
          { label: 'REDUCED normalized error', points: bench03Convergence.filter(row => row.methodCode === 1 && row.normalizedError !== null).map(row => ({ x: row.termLimit, y: row.normalizedError! })), dashed: true },
        ]} xLabel="term limit" yLabel="normalized error"/>
      </section>}
      <div className="boundary compact">Rows combine real MCU arithmetic evidence with independent host-reference comparison. False-convergence markers are numerical diagnostics, not sensor or hardware calibration failures.</div>
    </>}
  </section>;
}
