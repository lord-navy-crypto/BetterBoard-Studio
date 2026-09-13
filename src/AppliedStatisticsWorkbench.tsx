import { useMemo, useState } from 'react';
import { BarChart3, Database, Sigma } from 'lucide-react';
import {
  linearTrend,
  parseNumericTable,
  residualAnalysis,
  summarize,
  uncertaintyBudget,
  type ParsedNumericTable,
} from './AppliedStatistics';

function fmt(value: number, digits = 4) {
  if (!Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  return (abs !== 0 && (abs < 1e-3 || abs >= 1e5)) ? value.toExponential(3) : value.toFixed(digits);
}

function Metric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return <div className="panel" style={{ padding: 12 }}>
    <span className="eyebrow">{label}</span>
    <b style={{ display: 'block', fontSize: 20, marginTop: 5, fontVariantNumeric: 'tabular-nums' }}>{value}</b>
    {detail && <small className="muted">{detail}</small>}
  </div>;
}

export default function AppliedStatisticsWorkbench() {
  const [table, setTable] = useState<ParsedNumericTable | null>(null);
  const [source, setSource] = useState('No table loaded');
  const [observed, setObserved] = useState('');
  const [reference, setReference] = useState('');
  const [sensorStandard, setSensorStandard] = useState('0');
  const [scalePercent, setScalePercent] = useState('0');
  const [error, setError] = useState('');

  async function importFile(file: File | null) {
    if (!file) return;
    try {
      const parsed = parseNumericTable(await file.text());
      setTable(parsed);
      setObserved(parsed.headers[0] ?? '');
      setReference('');
      setSource(file.name);
      setError('');
    } catch (cause) {
      setError(String(cause));
      setTable(null);
    }
  }

  const observedValues = useMemo(() => table && observed ? table.columns[observed] ?? [] : [], [table, observed]);
  const stats = useMemo(() => observedValues.some(Number.isFinite) ? summarize(observedValues) : null, [observedValues]);
  const trend = useMemo(() => observedValues.some(Number.isFinite) ? linearTrend(observedValues) : null, [observedValues]);
  const budget = useMemo(() => stats ? uncertaintyBudget(observedValues, Number(sensorStandard) || 0, Number(scalePercent) || 0) : null, [stats, observedValues, sensorStandard, scalePercent]);
  const residuals = useMemo(() => {
    if (!table || !reference || reference === observed) return null;
    try { return residualAnalysis(observedValues, table.columns[reference] ?? []); }
    catch { return null; }
  }, [table, observed, reference, observedValues]);

  const interpretation = useMemo(() => {
    if (!stats || !trend || !budget) return [];
    const notes: string[] = [];
    const robustGap = Math.abs(stats.mean - stats.trimmedMean10);
    if (stats.robustSigma > 0 && robustGap > stats.robustSigma * 0.25) notes.push('Mean and trimmed mean differ enough to inspect outliers or skew before using the ordinary mean as the headline estimate.');
    if (stats.outlierCount > 0) notes.push(`${stats.outlierCount} robust outlier${stats.outlierCount === 1 ? '' : 's'} detected by a MAD-based rule; they are flagged, not automatically deleted.`);
    if (trend.rSquared >= 0.35 && Math.abs(trend.slopePerSample) > 0) notes.push('A systematic linear trend is visible. Treat repeated samples as potentially drifting rather than independent stationary draws.');
    if (budget.sensorStandard > budget.typeAStandard) notes.push('Specified sensor uncertainty dominates Type A uncertainty from repeatability. More repeats alone may not materially reduce the total uncertainty.');
    if (!notes.length) notes.push('No strong robust-outlier or linear-drift warning is visible from these summary checks. This is not proof of calibration or model validity.');
    return notes;
  }, [stats, trend, budget]);

  return <section className="panel" style={{ margin: '18px auto', maxWidth: 1420 }}>
    <div className="panel-title"><Sigma size={18}/> Applied Statistics & Uncertainty</div>
    <p className="muted">Quantify repeatability, robust center/spread, uncertainty of the mean, drift, and model residuals from the same evidence. Statistics never overwrite the raw measurement record.</p>

    <div className="action-row">
      <label className="ghost" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, cursor: 'pointer' }}><Database size={15}/> Import CSV / TSV<input type="file" accept=".csv,.tsv,text/csv,text/tab-separated-values" style={{ display: 'none' }} onChange={event => void importFile(event.target.files?.[0] ?? null)}/></label>
      <span className="muted">{source}</span>
    </div>
    {error && <div className="boundary">{error}</div>}

    {table && <>
      <div className="engineering-model-grid" style={{ marginTop: 12 }}>
        <label className="panel">Observed column<select value={observed} onChange={event => setObserved(event.target.value)}>{table.headers.map(header => <option key={header} value={header}>{header}</option>)}</select></label>
        <label className="panel">Reference / model column<select value={reference} onChange={event => setReference(event.target.value)}><option value="">None</option>{table.headers.filter(header => header !== observed).map(header => <option key={header} value={header}>{header}</option>)}</select></label>
        <label className="panel">Sensor standard uncertainty<input inputMode="decimal" value={sensorStandard} onChange={event => setSensorStandard(event.target.value)}/><small className="muted">Absolute 1σ, same unit as observed column</small></label>
        <label className="panel">Scale uncertainty<input inputMode="decimal" value={scalePercent} onChange={event => setScalePercent(event.target.value)}/><small className="muted">Relative 1σ, percent of measured mean</small></label>
      </div>

      {stats && trend && budget && <>
        <div className="observatory-facts" style={{ marginTop: 12 }}>
          <span>Accepted table rows</span><b>{table.acceptedRows}</b>
          <span>Rejected rows</span><b>{table.rejectedRows}</b>
          <span>Numeric columns</span><b>{table.headers.length}</b>
          <span>Delimiter</span><b>{table.delimiter === '\t' ? 'TAB' : table.delimiter}</b>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 8, marginTop: 12 }}>
          <Metric label="Mean" value={fmt(stats.mean)} detail={`n = ${stats.count}`}/>
          <Metric label="Median" value={fmt(stats.median)} detail={`MAD ${fmt(stats.mad)}`}/>
          <Metric label="10% trimmed mean" value={fmt(stats.trimmedMean10)} detail="robust center check"/>
          <Metric label="Sample std" value={fmt(stats.sampleStd)} detail={`robust σ ≈ ${fmt(stats.robustSigma)}`}/>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 8, marginTop: 8 }}>
          <Metric label="Standard error" value={fmt(stats.standardError)} detail="Type A uncertainty of mean"/>
          <Metric label="95% mean interval" value={`${fmt(stats.ci95Low)} … ${fmt(stats.ci95High)}`} detail="t-based approximation"/>
          <Metric label="Robust outliers" value={`${stats.outlierCount}`} detail={`${(100 * stats.outlierFraction).toFixed(1)}% · MAD rule`}/>
          <Metric label="Linear drift" value={fmt(trend.slopePerSample, 6)} detail={`per sample · R² ${fmt(trend.rSquared, 3)}`}/>
        </div>

        <section className="panel" style={{ marginTop: 12 }}>
          <div className="panel-title"><BarChart3 size={17}/> Uncertainty budget</div>
          <div className="observatory-facts">
            <span>Type A / repeatability</span><b>{fmt(budget.typeAStandard)}</b>
            <span>Sensor contribution</span><b>{fmt(budget.sensorStandard)}</b>
            <span>Scale contribution</span><b>{fmt(budget.scaleStandard)}</b>
            <span>Combined standard u</span><b>{fmt(budget.combinedStandard)}</b>
            <span>Expanded 95% ≈ 1.96u</span><b>± {fmt(budget.expanded95)}</b>
          </div>
          <div className="boundary compact">Assumes the Type A, sensor, and scale terms are independent standard uncertainties. Correlated calibration terms require a covariance-aware model rather than root-sum-of-squares.</div>
        </section>

        {residuals && <section className="panel" style={{ marginTop: 12 }}>
          <div className="panel-title"><BarChart3 size={17}/> Residual analysis · observed − reference</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 8 }}>
            <Metric label="Bias" value={fmt(residuals.bias)} detail="mean residual"/>
            <Metric label="MAE" value={fmt(residuals.mae)} />
            <Metric label="RMSE" value={fmt(residuals.rmse)} />
            <Metric label="Residual std" value={fmt(residuals.residualStd)} detail={`median ${fmt(residuals.medianResidual)}`}/>
          </div>
        </section>}

        <section className="panel" style={{ marginTop: 12 }}>
          <div className="panel-title"><Sigma size={17}/> Engineering interpretation</div>
          {interpretation.map(note => <div key={note} className="boundary compact">{note}</div>)}
        </section>
      </>}
    </>}

    <div className="boundary">These summaries estimate statistical behavior of the imported evidence. They do not establish traceable calibration, causal independence, physical ground truth, or model correctness.</div>
  </section>;
}
