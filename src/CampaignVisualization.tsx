import { ArrowRight, CheckCircle2, CircleDot, FlaskConical } from 'lucide-react';

export type CampaignStage = {
  id: string;
  label: string;
  state: 'available' | 'evidence-present' | 'reference-present' | 'not-observed';
  detail: string;
};

export type MechanismCoverageRow = {
  mechanism: string;
  mcuEvidence: string;
  hostReference: string;
  visualResult: string;
};

const STAGES: CampaignStage[] = [
  { id: 'source', label: 'Physical source', state: 'available', detail: 'Measured or controlled input starts the campaign.' },
  { id: 'embedded', label: 'Embedded mechanism', state: 'available', detail: 'UNO / MCU arithmetic, sampling or event path under test.' },
  { id: 'evidence', label: 'Evidence', state: 'not-observed', detail: 'Status becomes run-specific only after measurement evidence exists.' },
  { id: 'reference', label: 'Independent host reference', state: 'reference-present', detail: 'Repository analyzers provide independent comparison paths.' },
  { id: 'decision', label: 'Reliability / validation decision', state: 'not-observed', detail: 'A conclusion requires actual evidence, not capability presence alone.' },
];

const NUMERIC_ERROR_COVERAGE: MechanismCoverageRow[] = [
  { mechanism: 'Sampling', mcuEvidence: 'scheduler / measured timing available', hostReference: 'Bench 02 timing analysis', visualResult: 'Δt / jitter / downsampling' },
  { mechanism: 'Quantization', mcuEvidence: 'ADC / PWM / finite representation paths', hostReference: 'campaign + Bench 02 analysis', visualResult: 'step / error structure' },
  { mechanism: 'Cancellation', mcuEvidence: 'numerical campaign support', hostReference: 'microbench / campaign analyzer', visualResult: 'cancellation diagnostic' },
  { mechanism: 'Integration', mcuEvidence: 'embedded / measured numerical path', hostReference: 'float64 + float32/Kahan comparison', visualResult: 'convergence / accumulation delta' },
  { mechanism: 'Derivative', mcuEvidence: 'sampled evidence path', hostReference: 'non-uniform three-point derivative', visualResult: 'sensitivity / RMSE vs finest' },
  { mechanism: 'Taylor', mcuEvidence: 'RAW / REDUCED recurrence', hostReference: 'independent high-precision sin oracle', visualResult: 'error / reliability / term limit' },
  { mechanism: 'Event timing', mcuEvidence: 'photogate / switch / PIR timing', hostReference: 'event timing analyzer path', visualResult: 'timing / queue / drop evidence' },
  { mechanism: 'Floating accumulation', mcuEvidence: 'finite arithmetic environment', hostReference: 'float64 vs float32/Kahan', visualResult: 'accumulation drift' },
];

export default function CampaignVisualization() {
  return <section className="panel" style={{ maxWidth: 1420, margin: '14px auto' }} data-capability-anchor="campaign-visualization">
    <div className="panel-title"><FlaskConical size={18}/> Campaign Visualization</div>
    <p className="muted">Capability map for the active Engineering Lab campaign family. “Available” means the repository contains the measurement or analysis path; it does not mean a physical run has passed validation.</p>

    <div className="campaign-flow" aria-label="Campaign evidence flow">
      {STAGES.map((stage, index) => <div key={stage.id} className="campaign-flow-unit">
        <article className={`panel campaign-stage ${stage.state}`}>
          <span className="eyebrow">{stage.state}</span>
          <b>{stage.label}</b>
          <small className="muted">{stage.detail}</small>
        </article>
        {index < STAGES.length - 1 && <ArrowRight className="campaign-arrow" size={16}/>} 
      </div>)}
    </div>

    <section className="panel" style={{ marginTop: 12 }}>
      <div className="panel-title"><CircleDot size={16}/> Numeric Error Depth · mechanism coverage</div>
      <div className="campaign-matrix-wrap">
        <table className="campaign-matrix">
          <thead><tr><th>Mechanism</th><th>MCU / measured evidence path</th><th>Host reference</th><th>Visual result</th></tr></thead>
          <tbody>{NUMERIC_ERROR_COVERAGE.map(row => <tr key={row.mechanism}>
            <td><b>{row.mechanism}</b></td>
            <td>{row.mcuEvidence}</td>
            <td>{row.hostReference}</td>
            <td>{row.visualResult}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <div className="boundary compact"><CheckCircle2 size={14}/> This matrix describes implemented campaign coverage. Actual evidence status remains run-specific and must come from saved measurement / analyzer results.</div>
    </section>
  </section>;
}
