import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Database, Sigma } from 'lucide-react';
import { parseNumericTable, type ParsedNumericTable } from './AppliedStatistics';
import { deltaAicc, linearRegression, quadraticRegression, type RegressionFit } from './ModelFittingAnalysis';
import EngineeringPlot from './EngineeringPlot';
import { externalEvidenceSource, useEvidenceVisualization } from './EvidenceVisualizationContext';

function fmt(value: number | null | undefined, digits = 4) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  return (abs !== 0 && (abs < 1e-3 || abs >= 1e5)) ? value.toExponential(3) : value.toFixed(digits);
}

function FitCard({ fit, delta }: { fit: RegressionFit; delta: number }) {
  return <section className="panel">
    <div className="panel-title"><BarChart3 size={16}/>{fit.model === 'linear' ? 'Linear model' : 'Quadratic model'}</div>
    <div className="observatory-facts">
      <span>RMSE</span><b>{fmt(fit.diagnostics.rmse)}</b>
      <span>R²</span><b>{fmt(fit.diagnostics.rSquared, 4)}</b>
      <span>Adjusted R²</span><b>{fmt(fit.diagnostics.adjustedRSquared, 4)}</b>
      <span>AICc</span><b>{fmt(fit.diagnostics.aicc, 2)}</b>
      <span>ΔAICc</span><b>{fmt(delta, 2)}</b>
      <span>BIC</span><b>{fmt(fit.diagnostics.bic, 2)}</b>
    </div>
    <div style={{ overflow: 'auto', marginTop: 10 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
        <thead><tr><th>parameter</th><th>estimate</th><th>SE</th><th>95% CI</th></tr></thead>
        <tbody>{fit.parameters.map(parameter => <tr key={parameter.name}>
          <td>{parameter.name}</td><td>{fmt(parameter.estimate, 6)}</td><td>{fmt(parameter.standardError, 6)}</td><td>{fmt(parameter.ci95Low, 6)} … {fmt(parameter.ci95High, 6)}</td>
        </tr>)}</tbody>
      </table>
    </div>
    {fit.parameterCorrelation !== undefined && <div className="boundary compact">Intercept–slope parameter correlation: <b>{fmt(fit.parameterCorrelation, 3)}</b>. Strong correlation means parameter estimates are coupled even when the overall curve fits well.</div>}
  </section>;
}

export default function ModelFittingWorkbench() {
  const [table, setTable] = useState<ParsedNumericTable | null>(null);
  const [sourceLabel, setSourceLabel] = useState('No table loaded');
  const [xColumn, setXColumn] = useState('');
  const [yColumn, setYColumn] = useState('');
  const [error, setError] = useState('');
  const shared = useEvidenceVisualization();
  const effectiveTable = table ?? shared.source?.table ?? null;
  const effectiveSourceLabel = table ? sourceLabel : shared.source?.label ?? sourceLabel;

  useEffect(() => {
    if (!effectiveTable) return;
    if (!effectiveTable.headers.includes(xColumn)) setXColumn(effectiveTable.headers[0] ?? '');
    if (!effectiveTable.headers.includes(yColumn) || yColumn === (effectiveTable.headers[0] ?? '')) setYColumn(effectiveTable.headers[1] ?? effectiveTable.headers[0] ?? '');
  }, [effectiveTable, xColumn, yColumn]);

  async function importFile(file: File | null) {
    if (!file) return;
    try {
      const parsed = parseNumericTable(await file.text());
      setTable(parsed);
      setXColumn(parsed.headers[0] ?? '');
      setYColumn(parsed.headers[1] ?? parsed.headers[0] ?? '');
      setSourceLabel(file.name);
      shared.setSource(externalEvidenceSource(file.name, parsed));
      setError('');
    } catch (cause) {
      setError(String(cause));
      setTable(null);
    }
  }

  const x = useMemo(() => effectiveTable && xColumn ? effectiveTable.columns[xColumn] ?? [] : [], [effectiveTable, xColumn]);
  const y = useMemo(() => effectiveTable && yColumn ? effectiveTable.columns[yColumn] ?? [] : [], [effectiveTable, yColumn]);
  const aligned = useMemo(() => {
    const rows: Array<{ x: number; y: number }> = [];
    const n = Math.min(x.length, y.length);
    for (let i = 0; i < n; i++) if (Number.isFinite(x[i]) && Number.isFinite(y[i])) rows.push({ x: x[i], y: y[i] });
    return rows;
  }, [x, y]);
  const fits = useMemo(() => {
    if (!effectiveTable || !xColumn || !yColumn || xColumn === yColumn) return [] as RegressionFit[];
    const result: RegressionFit[] = [];
    try { result.push(linearRegression(x, y)); } catch {}
    try { result.push(quadraticRegression(x, y)); } catch {}
    return result;
  }, [effectiveTable, xColumn, yColumn, x, y]);
  const deltas = useMemo(() => deltaAicc(fits), [fits]);
  const best = useMemo(() => fits.length ? fits.reduce((a, b) => a.diagnostics.aicc <= b.diagnostics.aicc ? a : b) : null, [fits]);
  const fitSeries = useMemo(() => fits.map(fit => ({ label: fit.model === 'linear' ? 'linear fit' : 'quadratic fit', points: aligned.map((row, index) => ({ x: row.x, y: fit.predictions[index] })).sort((a, b) => a.x - b.x), dashed: fit.model === 'quadratic' })), [fits, aligned]);

  const interpretation = useMemo(() => {
    if (fits.length < 2 || !best) return [] as string[];
    const linear = fits.find(fit => fit.model === 'linear')!;
    const quadratic = fits.find(fit => fit.model === 'quadratic')!;
    const delta = Math.abs(linear.diagnostics.aicc - quadratic.diagnostics.aicc);
    const notes: string[] = [];
    if (delta < 2) notes.push('Linear and quadratic models have similar AICc support. Prefer the simpler model unless the quadratic term is physically motivated or confirmed by new evidence.');
    else if (best.model === 'quadratic') notes.push(`Quadratic structure has stronger AICc support (ΔAICc ${fmt(delta, 2)}). Treat this as model-selection evidence, not proof that the physical law is quadratic.`);
    else notes.push(`The linear model retains stronger AICc support despite the quadratic model's extra flexibility (ΔAICc ${fmt(delta, 2)}).`);
    const qTerm = quadratic.parameters.find(parameter => parameter.name === 'quadratic term');
    if (qTerm && qTerm.ci95Low <= 0 && qTerm.ci95High >= 0) notes.push('The quadratic coefficient 95% interval crosses zero, so the added curvature parameter is not cleanly separated from zero in this dataset.');
    if (linear.parameterCorrelation !== null && linear.parameterCorrelation !== undefined && Math.abs(linear.parameterCorrelation) > 0.9) notes.push('Linear intercept and slope are strongly correlated. Re-centering x near its mean can make parameter interpretation more stable.');
    return notes;
  }, [fits, best]);

  return <section className="panel" style={{ margin: '18px auto', maxWidth: 1420 }}>
    <div className="panel-title"><Sigma size={18}/> Parameter Estimation & Model Comparison</div>
    <p className="muted">Estimate model parameters with uncertainty, inspect residual fit quality, and compare simple candidate models without equating best fit with physical truth.</p>
    <div className="action-row"><label className="ghost" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, cursor: 'pointer' }}><Database size={15}/> Import CSV / TSV<input type="file" accept=".csv,.tsv,text/csv,text/tab-separated-values" style={{ display: 'none' }} onChange={event => void importFile(event.target.files?.[0] ?? null)}/></label><span className="muted">{effectiveSourceLabel}{!table && shared.source ? ` · ${shared.source.provenanceLabel}` : ''}</span></div>
    {error && <div className="boundary">{error}</div>}

    {effectiveTable && <>
      <div className="engineering-model-grid" style={{ marginTop: 12 }}>
        <label className="panel">x / predictor<select value={xColumn} onChange={event => setXColumn(event.target.value)}>{effectiveTable.headers.map(header => <option key={header} value={header}>{header}</option>)}</select></label>
        <label className="panel">y / observed response<select value={yColumn} onChange={event => setYColumn(event.target.value)}>{effectiveTable.headers.map(header => <option key={header} value={header}>{header}</option>)}</select></label>
      </div>
      {xColumn === yColumn ? <div className="boundary">Choose different x and y columns before fitting.</div> : fits.length ? <>
        <section className="panel" style={{ marginTop: 12 }}><div className="panel-title"><BarChart3 size={17}/> Measured response & candidate fits</div><EngineeringPlot series={[{ label: 'measured', kind: 'scatter', points: aligned }, ...fitSeries]} xLabel={xColumn} yLabel={yColumn} /></section>
        <div className="engineering-model-grid" style={{ marginTop: 12 }}>{fits.map(fit => <FitCard key={fit.model} fit={fit} delta={deltas.find(item => item.model === fit.model)?.delta ?? Number.NaN}/>)}</div>
        <div className="engineering-model-grid" style={{ marginTop: 12 }}>{fits.map(fit => <section className="panel" key={`${fit.model}-residual`}><div className="panel-title"><BarChart3 size={16}/>{fit.model === 'linear' ? 'Linear' : 'Quadratic'} residual structure</div><EngineeringPlot series={[{ label: `${fit.model} residual`, kind: 'scatter', points: aligned.map((row, index) => ({ x: row.x, y: fit.residuals[index] })) }]} xLabel={xColumn} yLabel="residual" zeroLine /></section>)}</div>
        <section className="panel" style={{ marginTop: 12 }}><div className="panel-title"><Sigma size={16}/> Model-selection interpretation</div>{interpretation.map(note => <div key={note} className="boundary compact">{note}</div>)}</section>
      </> : <div className="boundary">The selected columns do not contain enough well-conditioned aligned observations for the candidate models.</div>}
    </>}
    <div className="boundary">AICc/BIC compare candidate models under their statistical assumptions. A lower score does not establish causality, mechanism, calibration quality, or physical truth; validate the chosen model on new evidence.</div>
  </section>;
}
