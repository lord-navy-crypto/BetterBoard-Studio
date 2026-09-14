import { useMemo, useState } from 'react';
import { Compass, Database, FlaskConical, Repeat2, ScanSearch } from 'lucide-react';
import { parseNumericTable, type ParsedNumericTable } from './AppliedStatistics';
import { linearRegression, quadraticRegression } from './ModelFittingAnalysis';
import {
  generateCandidateGrid,
  informationGainPercentProxy,
  planCandidates,
  rankForCoverage,
  rankForInformation,
  rankForReplication,
  summarizeDesign,
  type PlanningModel,
} from './ExperimentPlanning';
import EngineeringPlot from './EngineeringPlot';

function fmt(value: number | null | undefined, digits = 4) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  return abs !== 0 && (abs < 1e-3 || abs >= 1e5) ? value.toExponential(3) : value.toFixed(digits);
}

function Metric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return <div className="panel" style={{ padding: 12 }}>
    <span className="eyebrow">{label}</span>
    <b style={{ display: 'block', fontSize: 20, marginTop: 5, fontVariantNumeric: 'tabular-nums' }}>{value}</b>
    {detail && <small className="muted">{detail}</small>}
  </div>;
}

export default function ExperimentPlanningWorkbench() {
  const [table, setTable] = useState<ParsedNumericTable | null>(null);
  const [source, setSource] = useState('No table loaded');
  const [predictor, setPredictor] = useState('');
  const [response, setResponse] = useState('');
  const [model, setModel] = useState<PlanningModel>('linear');
  const [candidateCount, setCandidateCount] = useState('31');
  const [allowExtrapolation, setAllowExtrapolation] = useState(false);
  const [error, setError] = useState('');

  async function importFile(file: File | null) {
    if (!file) return;
    try {
      const parsed = parseNumericTable(await file.text());
      setTable(parsed);
      setPredictor(parsed.headers[0] ?? '');
      setResponse(parsed.headers[1] ?? parsed.headers[0] ?? '');
      setSource(file.name);
      setError('');
    } catch (cause) {
      setTable(null);
      setError(String(cause));
    }
  }

  const x = useMemo(() => table && predictor ? table.columns[predictor] ?? [] : [], [table, predictor]);
  const y = useMemo(() => table && response ? table.columns[response] ?? [] : [], [table, response]);
  const finiteX = useMemo(() => x.filter(Number.isFinite), [x]);

  const analysis = useMemo(() => {
    if (!table || !x.some(Number.isFinite) || predictor === response) return null;
    try {
      const design = summarizeDesign(x, model);
      const extension = allowExtrapolation ? Math.max((design.maxX - design.minX) * 0.10, Number.EPSILON) : 0;
      const candidates = generateCandidateGrid(design.minX - extension, design.maxX + extension, Number(candidateCount) || 31);
      const plans = planCandidates(x, candidates, model);
      const information = rankForInformation(plans, allowExtrapolation);
      const coverage = rankForCoverage(plans, allowExtrapolation);
      const replication = rankForReplication(plans);
      const fit = response && y.some(Number.isFinite)
        ? (model === 'quadratic' ? quadraticRegression(x, y) : linearRegression(x, y))
        : null;
      return { design, plans, information, coverage, replication, fit };
    } catch (cause) {
      return { error: String(cause) } as const;
    }
  }, [table, x, y, predictor, response, model, candidateCount, allowExtrapolation]);

  const result = analysis && !('error' in analysis) ? analysis : null;
  const analysisError = analysis && 'error' in analysis ? analysis.error : '';
  const infoPick = result?.information[0];
  const coveragePick = result?.coverage[0];
  const replicatePick = result?.replication[0];

  const recommendation = useMemo(() => {
    if (!result || !infoPick || !coveragePick) return [];
    const notes: string[] = [];
    const fitNoise = result.fit?.diagnostics.rmse ?? null;
    if (result.design.conditionWarning) notes.push(result.design.conditionWarning);
    if (result.design.replicateFraction === 0) notes.push('No replicated predictor levels are present, so pure repeatability noise cannot be cleanly separated from lack-of-fit using this design alone. Add at least one deliberate replicate when repeatability matters.');
    if (infoPick.x === coveragePick.x) notes.push(`x = ${fmt(infoPick.x)} is the strongest current dual-purpose candidate: it both increases parameter information and fills a coverage gap.`);
    else notes.push(`For parameter learning, prioritize x = ${fmt(infoPick.x)}; for space-filling coverage, prioritize x = ${fmt(coveragePick.x)}. These are different experimental objectives, so BetterBoard keeps them separate.`);
    if (replicatePick) notes.push(`For a deliberate replicate, x = ${fmt(replicatePick.x)} is an existing level with only ${replicatePick.replicationCount} recorded observation${replicatePick.replicationCount === 1 ? '' : 's'} in the tolerance-based grouping.`);
    if (fitNoise !== null && fitNoise > 0) notes.push(`Current ${model} fit RMSE is ${fmt(fitNoise)}. Replication can help estimate repeatability, but it does not by itself fix model bias or poor predictor coverage.`);
    if (infoPick.isExtrapolation) notes.push('The top information candidate is outside the observed predictor range. Extrapolation is enabled, so treat this as a higher-risk design choice and verify hardware/physics limits before running it.');
    return notes;
  }, [result, infoPick, coveragePick, replicatePick, model]);

  return <section className="panel" style={{ margin: '18px auto', maxWidth: 1420 }}>
    <div className="panel-title"><Compass size={18}/> DOE & Sequential Experiment Planning</div>
    <p className="muted">Choose the next measurement by experimental objective: parameter information, predictor-space coverage, or deliberate replication. Recommendations are decision support conditioned on the candidate set, selected model, and noise assumptions.</p>

    <div className="action-row">
      <label className="ghost" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, cursor: 'pointer' }}><Database size={15}/> Import CSV / TSV<input type="file" accept=".csv,.tsv,text/csv,text/tab-separated-values" style={{ display: 'none' }} onChange={event => void importFile(event.target.files?.[0] ?? null)}/></label>
      <span className="muted">{source}</span>
    </div>
    {error && <div className="boundary">{error}</div>}

    {table && <>
      <div className="engineering-model-grid" style={{ marginTop: 12 }}>
        <label className="panel">Predictor / controlled variable<select value={predictor} onChange={event => setPredictor(event.target.value)}>{table.headers.map(header => <option key={header} value={header}>{header}</option>)}</select></label>
        <label className="panel">Response column<select value={response} onChange={event => setResponse(event.target.value)}>{table.headers.map(header => <option key={header} value={header}>{header}</option>)}</select></label>
        <label className="panel">Planning model<select value={model} onChange={event => setModel(event.target.value as PlanningModel)}><option value="linear">Linear · [1, x]</option><option value="quadratic">Quadratic · [1, x, x²]</option></select></label>
        <label className="panel">Candidate levels<input inputMode="numeric" value={candidateCount} onChange={event => setCandidateCount(event.target.value)}/><small className="muted">Grid used for ranking, clamped to 3–501</small></label>
        <label className="panel" style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" checked={allowExtrapolation} onChange={event => setAllowExtrapolation(event.target.checked)}/> Allow 10% extrapolation outside observed range</label>
      </div>

      {analysisError && <div className="boundary">{analysisError}</div>}

      {result && <>
        <section className="panel" style={{ marginTop: 12 }}>
          <div className="panel-title"><FlaskConical size={17}/> Current design</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 8 }}>
            <Metric label="Observations" value={String(result.design.observationCount)} detail={`${result.design.uniqueLevelCount} distinct x levels`}/>
            <Metric label="Replicated observations" value={String(result.design.replicatedObservationCount)} detail={`${(100 * result.design.replicateFraction).toFixed(1)}% beyond unique levels`}/>
            <Metric label="Median level gap" value={fmt(result.design.medianGap)} detail={`range ${fmt(result.design.minX)} … ${fmt(result.design.maxX)}`}/>
            <Metric label="Largest level gap" value={fmt(result.design.largestGap)} detail="coverage diagnostic"/>
          </div>
          {result.design.conditionWarning && <div className="boundary compact">{result.design.conditionWarning}</div>}
        </section>

        <section className="panel" style={{ marginTop: 12 }}>
          <div className="panel-title"><ScanSearch size={17}/> Candidate landscape</div>
          <EngineeringPlot
            series={[
              { label: 'information gain', points: result.plans.map(plan => ({ x: plan.x, y: plan.informationGain })) },
              { label: 'coverage score', points: result.plans.map(plan => ({ x: plan.x, y: plan.normalizedCoverage })), dashed: true },
              { label: 'observed x', kind: 'scatter', markerRadius: 3.5, points: finiteX.map(value => ({ x: value, y: 0 })) },
            ]}
            xLabel={predictor}
            yLabel="relative planning score"
            zeroLine
            verticalMarkers={[
              ...(infoPick ? [{ x: infoPick.x, label: 'information' }] : []),
              ...(coveragePick ? [{ x: coveragePick.x, label: 'coverage' }] : []),
              ...(replicatePick ? [{ x: replicatePick.x, label: 'replicate' }] : []),
            ]}
          />
          <div className="boundary compact">Information gain and coverage are different objectives and are intentionally drawn together only for comparison. Their vertical scales are not interchangeable physical quantities.</div>
        </section>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 10, marginTop: 12 }}>
          <section className="panel">
            <div className="panel-title"><ScanSearch size={16}/> Parameter information</div>
            <Metric label="Next x" value={fmt(infoPick?.x)} detail={infoPick?.isExtrapolation ? 'EXTRAPOLATION' : 'within observed range'}/>
            <div className="observatory-facts" style={{ marginTop: 8 }}><span>Leverage hᵀ(XᵀX)⁻¹h</span><b>{fmt(infoPick?.informationLeverage, 5)}</b><span>log(1 + leverage)</span><b>{fmt(infoPick?.informationGain, 5)}</b><span>Uncertainty-reduction proxy</span><b>{infoPick ? `${informationGainPercentProxy(infoPick).toFixed(1)}%` : '—'}</b></div>
            <small className="muted">For a homoscedastic linear-in-parameters model, this ranks candidate points by incremental design information. The percentage is a relative covariance-reduction proxy, not a guaranteed experimental outcome.</small>
          </section>

          <section className="panel">
            <div className="panel-title"><Compass size={16}/> Coverage</div>
            <Metric label="Next x" value={fmt(coveragePick?.x)} detail="farthest from current observations"/>
            <div className="observatory-facts" style={{ marginTop: 8 }}><span>Nearest observed distance</span><b>{fmt(coveragePick?.coverageDistance)}</b><span>Normalized gap</span><b>{fmt(coveragePick?.normalizedCoverage, 4)}</b><span>Already replicated</span><b>{coveragePick?.replicationCount ?? '—'}</b></div>
            <small className="muted">Coverage ranking is model-light: it fills predictor-space gaps but does not know where the underlying physics is most nonlinear or important.</small>
          </section>

          <section className="panel">
            <div className="panel-title"><Repeat2 size={16}/> Replication</div>
            <Metric label="Existing x to repeat" value={fmt(replicatePick?.x)} detail={replicatePick ? `${replicatePick.replicationCount} current observation${replicatePick.replicationCount === 1 ? '' : 's'}` : 'no existing level candidate'}/>
            <div className="observatory-facts" style={{ marginTop: 8 }}><span>Current replicate fraction</span><b>{(100 * result.design.replicateFraction).toFixed(1)}%</b><span>Fit RMSE</span><b>{fmt(result.fit?.diagnostics.rmse)}</b><span>Purpose</span><b>repeatability</b></div>
            <small className="muted">Replication estimates run-to-run or point-to-point repeatability. It should not be used as a substitute for exploring unsampled regions.</small>
          </section>
        </div>

        <section className="panel" style={{ marginTop: 12 }}>
          <div className="panel-title"><Compass size={17}/> Planning interpretation</div>
          {recommendation.map(note => <div key={note} className="boundary compact">{note}</div>)}
        </section>

        <details style={{ marginTop: 12 }}><summary>Top ranked candidate points</summary>
          <div style={{ overflow: 'auto', marginTop: 8 }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}><thead><tr><th>rank</th><th>information x</th><th>info gain</th><th>coverage x</th><th>coverage gap</th></tr></thead><tbody>{Array.from({ length: Math.min(8, result.information.length, result.coverage.length) }, (_, index) => <tr key={index}><td>{index + 1}</td><td>{fmt(result.information[index]?.x)}</td><td>{fmt(result.information[index]?.informationGain, 5)}</td><td>{fmt(result.coverage[index]?.x)}</td><td>{fmt(result.coverage[index]?.normalizedCoverage, 5)}</td></tr>)}</tbody></table></div>
        </details>
      </>}
    </>}

    <div className="boundary">Sequential-planning recommendations do not prove that a point is physically optimal. Fisher/leverage reasoning assumes the selected linear-in-parameters model and approximately comparable independent noise. Hardware limits, safety constraints, hysteresis, drift, cost, and domain knowledge must remain part of the experiment decision.</div>
  </section>;
}
