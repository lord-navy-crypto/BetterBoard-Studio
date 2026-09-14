import { useMemo, useState } from 'react';
import { Activity, BarChart3, Database, RadioTower, Sigma, Waves } from 'lucide-react';
import {
  linearTrend,
  parseNumericTable,
  residualAnalysis,
  summarize,
  uncertaintyBudget,
  type ParsedNumericTable,
} from './AppliedStatistics';
import {
  cusumAnalysis,
  dependenceAnalysis,
  ewmaAnalysis,
  meanShiftChangePoint,
  spectrumAnalysis,
} from './TimeSeriesAnalysis';

function fmt(value: number | null | undefined, digits = 4) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
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
  const [sampleRateHz, setSampleRateHz] = useState('50');
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

  const dependence = useMemo(() => observedValues.some(Number.isFinite) ? dependenceAnalysis(observedValues, 80) : null, [observedValues]);
  const spectrum = useMemo(() => {
    const rate = Number(sampleRateHz);
    if (!observedValues.some(Number.isFinite) || !(rate > 0)) return null;
    try { return spectrumAnalysis(observedValues, rate); } catch { return null; }
  }, [observedValues, sampleRateHz]);
  const ewma = useMemo(() => observedValues.some(Number.isFinite) ? ewmaAnalysis(observedValues, 0.2, 3) : null, [observedValues]);
  const cusum = useMemo(() => observedValues.some(Number.isFinite) ? cusumAnalysis(observedValues, 0.5, 5) : null, [observedValues]);
  const changePoint = useMemo(() => observedValues.some(Number.isFinite) ? meanShiftChangePoint(observedValues, 8) : null, [observedValues]);

  const interpretation = useMemo(() => {
    if (!stats || !trend || !budget) return [];
    const notes: string[] = [];
    const robustGap = Math.abs(stats.mean - stats.trimmedMean10);
    if (stats.robustSigma > 0 && robustGap > stats.robustSigma * 0.25) notes.push('Mean and trimmed mean differ enough to inspect outliers or skew before using the ordinary mean as the headline estimate.');
    if (stats.outlierCount > 0) notes.push(`${stats.outlierCount} robust outlier${stats.outlierCount === 1 ? '' : 's'} detected by a MAD-based rule; they are flagged, not automatically deleted.`);
    if (trend.rSquared >= 0.35 && Math.abs(trend.slopePerSample) > 0) notes.push('A systematic linear trend is visible. Treat repeated samples as potentially drifting rather than independent stationary draws.');
    if (dependence && dependence.effectiveSampleSize < stats.count * 0.5) notes.push(`Serial dependence materially reduces information content: ${stats.count} observations behave like roughly ${Math.round(dependence.effectiveSampleSize)} independent samples for mean-estimation purposes.`);
    if (spectrum?.aliasingRisk === 'high') notes.push('Substantial spectral power lies close to Nyquist. Inspect the acquisition rate and analog/digital anti-alias filtering before interpreting high-frequency structure.');
    else if (spectrum?.aliasingRisk === 'inspect') notes.push('Some power lies close to Nyquist; inspect sampling adequacy if high-frequency content matters to the claim.');
    if (ewma && ewma.alarmCount > 0) notes.push(`EWMA detects ${ewma.alarmCount} sustained-deviation alarm${ewma.alarmCount === 1 ? '' : 's'} relative to the run-wide baseline.`);
    if (cusum && cusum.alarmCount > 0) notes.push(`CUSUM detects ${cusum.alarmCount} cumulative-shift alarm${cusum.alarmCount === 1 ? '' : 's'}; inspect whether these correspond to a physical event, settling, or instrumentation change.`);
    if (changePoint && changePoint.index !== null && changePoint.score >= 3) notes.push(`A candidate mean-shift boundary appears near sample ${changePoint.index}. This is a diagnostic candidate, not proof of a causal change point.`);
    if (budget.sensorStandard > budget.typeAStandard) notes.push('Specified sensor uncertainty dominates Type A uncertainty from repeatability. More repeats alone may not materially reduce the total uncertainty.');
    if (!notes.length) notes.push('No strong robust-outlier, drift, dependence, spectrum-edge, or process-shift warning is visible from these summary checks. This is not proof of calibration, stationarity, or model validity.');
    return notes;
  }, [stats, trend, budget, dependence, spectrum, ewma, cusum, changePoint]);

  const effectiveSe = stats && dependence && dependence.effectiveSampleSize > 0
    ? stats.sampleStd / Math.sqrt(dependence.effectiveSampleSize)
    : null;

  return <section className="panel" style={{ margin: '18px auto', maxWidth: 1420 }}>
    <div className="panel-title"><Sigma size={18}/> Applied Statistics & Uncertainty · Signal Diagnostics</div>
    <p className="muted">Quantify repeatability, robust center/spread, uncertainty, serial dependence, frequency structure, process drift, and model residuals from the same evidence. Statistics never overwrite the raw measurement record.</p>

    <div className="action-row">
      <label className="ghost" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, cursor: 'pointer' }}><Database size={15}/> Import CSV / TSV<input type="file" accept=".csv,.tsv,text/csv,text/tab-separated-values" style={{ display: 'none' }} onChange={event => void importFile(event.target.files?.[0] ?? null)}/></label>
      <span className="muted">{source}</span>
    </div>
    {error && <div className="boundary">{error}</div>}

    {table && <>
      <div className="engineering-model-grid" style={{ marginTop: 12 }}>
        <label className="panel">Observed column<select value={observed} onChange={event => setObserved(event.target.value)}>{table.headers.map(header => <option key={header} value={header}>{header}</option>)}</select></label>
        <label className="panel">Reference / model column<select value={reference} onChange={event => setReference(event.target.value)}><option value="">None</option>{table.headers.filter(header => header !== observed).map(header => <option key={header} value={header}>{header}</option>)}</select></label>
        <label className="panel">Sample rate (Hz)<input inputMode="decimal" value={sampleRateHz} onChange={event => setSampleRateHz(event.target.value)}/><small className="muted">Used only for frequency-axis interpretation</small></label>
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
          <Metric label="Standard error" value={fmt(stats.standardError)} detail="naive independent-sample Type A"/>
          <Metric label="95% mean interval" value={`${fmt(stats.ci95Low)} … ${fmt(stats.ci95High)}`} detail="t-based, independence assumed"/>
          <Metric label="Robust outliers" value={`${stats.outlierCount}`} detail={`${(100 * stats.outlierFraction).toFixed(1)}% · MAD rule`}/>
          <Metric label="Linear drift" value={fmt(trend.slopePerSample, 6)} detail={`per sample · R² ${fmt(trend.rSquared, 3)}`}/>
        </div>

        {dependence && <section className="panel" style={{ marginTop: 12 }}>
          <div className="panel-title"><Activity size={17}/> Serial dependence & effective information</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 8 }}>
            <Metric label="Lag-1 correlation" value={fmt(dependence.lag1, 3)} detail="adjacent-sample dependence"/>
            <Metric label="Effective sample size" value={fmt(dependence.effectiveSampleSize, 1)} detail={`of ${stats.count} observations`}/>
            <Metric label="Dependence-adjusted SE" value={fmt(effectiveSe)} detail="sample std / √n_eff"/>
            <Metric label="Decorrelation lag" value={dependence.decorrelationLag === null ? '—' : String(dependence.decorrelationLag)} detail="first |ACF| < 1/e"/>
          </div>
          <details style={{ marginTop: 10 }}><summary>Autocorrelation diagnostic · first {dependence.autocorrelation.length - 1} lags</summary><div style={{ maxHeight: 220, overflow: 'auto', marginTop: 8 }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}><thead><tr><th>lag</th><th>correlation</th></tr></thead><tbody>{dependence.autocorrelation.slice(1).map(point => <tr key={point.lag}><td>{point.lag}</td><td>{fmt(point.correlation, 4)}</td></tr>)}</tbody></table></div></details>
          <div className="boundary compact">Effective sample size is an autocorrelation-based approximation. Strong nonstationarity, long-memory behavior, periodicity, or irregular sampling can invalidate this simple correction.</div>
        </section>}

        {spectrum && <section className="panel" style={{ marginTop: 12 }}>
          <div className="panel-title"><Waves size={17}/> Frequency-domain diagnostic</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 8 }}>
            <Metric label="Dominant frequency" value={`${fmt(spectrum.dominantFrequencyHz, 3)} Hz`} detail={`${(100 * spectrum.dominantPowerFraction).toFixed(1)}% of non-DC power`}/>
            <Metric label="Spectral centroid" value={`${fmt(spectrum.spectralCentroidHz, 3)} Hz`} detail="power-weighted frequency"/>
            <Metric label="Nyquist" value={`${fmt(spectrum.nyquistHz, 2)} Hz`} detail={`FFT ${spectrum.fftSize}`}/>
            <Metric label="Near-Nyquist power" value={`${(100 * spectrum.highFrequencyPowerFraction).toFixed(1)}%`} detail={`risk: ${spectrum.aliasingRisk}`}/>
          </div>
          <div style={{ overflow: 'auto', marginTop: 10 }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}><thead><tr><th>peak</th><th>frequency Hz</th><th>relative power</th></tr></thead><tbody>{spectrum.peaks.map((peak, index) => <tr key={`${peak.frequencyHz}-${index}`}><td>{index + 1}</td><td>{fmt(peak.frequencyHz, 4)}</td><td>{fmt(peak.power, 4)}</td></tr>)}</tbody></table></div>
          <div className="boundary compact">A spectrum computed after sampling cannot prove whether aliasing already occurred. Power close to Nyquist is only a sampling-risk indicator. Verify acquisition rate and anti-alias filtering against the physical signal bandwidth.</div>
        </section>}

        {ewma && cusum && changePoint && <section className="panel" style={{ marginTop: 12 }}>
          <div className="panel-title"><RadioTower size={17}/> Process shift & stability diagnostics</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 8 }}>
            <Metric label="EWMA alarms" value={String(ewma.alarmCount)} detail={ewma.firstAlarmIndex === null ? 'none' : `first near sample ${ewma.firstAlarmIndex}`}/>
            <Metric label="EWMA max deviation" value={`${fmt(ewma.maxStandardizedDeviation, 2)} σ`} detail={`λ = ${ewma.lambda}`}/>
            <Metric label="CUSUM alarms" value={String(cusum.alarmCount)} detail={cusum.firstAlarmIndex === null ? 'none' : `first near sample ${cusum.firstAlarmIndex}`}/>
            <Metric label="Mean-shift candidate" value={changePoint.index === null ? '—' : String(changePoint.index)} detail={`score ${fmt(changePoint.score, 2)}`}/>
          </div>
          {changePoint.index !== null && <div className="observatory-facts" style={{ marginTop: 8 }}><span>Mean before</span><b>{fmt(changePoint.meanBefore)}</b><span>Mean after</span><b>{fmt(changePoint.meanAfter)}</b><span>CUSUM reference</span><b>{cusum.referenceSigma}σ</b><span>CUSUM decision</span><b>{cusum.decisionSigma}σ</b></div>}
          <div className="boundary compact">EWMA, CUSUM, and the mean-shift scan are diagnostics against a run-wide baseline. An alarm is not automatically a fault: settling, commanded changes, real physical events, or regime changes can all trigger them.</div>
        </section>}

        <section className="panel" style={{ marginTop: 12 }}>
          <div className="panel-title"><BarChart3 size={17}/> Uncertainty budget</div>
          <div className="observatory-facts">
            <span>Type A / repeatability</span><b>{fmt(budget.typeAStandard)}</b>
            <span>Sensor contribution</span><b>{fmt(budget.sensorStandard)}</b>
            <span>Scale contribution</span><b>{fmt(budget.scaleStandard)}</b>
            <span>Combined standard u</span><b>{fmt(budget.combinedStandard)}</b>
            <span>Expanded 95% ≈ 1.96u</span><b>± {fmt(budget.expanded95)}</b>
          </div>
          <div className="boundary compact">Assumes the Type A, sensor, and scale terms are independent standard uncertainties. Correlated calibration terms require a covariance-aware model rather than root-sum-of-squares. The displayed Type A term is still the ordinary independent-sample estimate; compare it with the dependence-adjusted SE above when serial correlation is material.</div>
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

    <div className="boundary">These summaries estimate statistical and signal behavior of the imported evidence. They do not establish traceable calibration, causal independence, stationarity, physical ground truth, model correctness, or pre-sampling bandwidth.</div>
  </section>;
}
