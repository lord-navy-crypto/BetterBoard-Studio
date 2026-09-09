import { Activity, CheckCircle2, FlaskConical, Magnet, Sigma } from 'lucide-react';
import CopyButton from './CopyButton';

const NUMERIC_FIRMWARE = 'src-tauri/resources/firmware/NumericError_InteractiveStudioV2/NumericError_InteractiveStudioV2.ino';
const NUMERIC_BRIDGE = 'scripts/arduino_numeric_error_bridge_v2.py';
const NUMERIC_COMMANDS = [
  'METHOD RAW',
  'RANGE -80 80',
  'POINTS 161',
  'RUN SWEEP',
  'METHOD REDUCED',
  'RUN SWEEP',
].join('\n');

const CAMPAIGNS = [
  {
    title: 'Numeric Error Depth',
    detail: 'Arduino float32 Taylor evaluation · range reduction · cancellation · false convergence · host reference',
    icon: Sigma,
    status: 'Active research campaign',
  },
  {
    title: 'Oscillation & Numerical Integration',
    detail: 'Measured dynamics · sampling rate · discretization · integration-method validation',
    icon: Activity,
    status: 'Engineering Lab campaign',
  },
  {
    title: 'Magnetic Model Validation',
    detail: 'Measured field evidence · model residual · trajectory / RADIA comparison',
    icon: Magnet,
    status: 'Engineering Lab campaign',
  },
];

export default function ExperimentsHub() {
  return <div className="experiments-hub">
    <section className="experiment-bridge-hero">
      <div>
        <div className="eyebrow">Engineering Lab experiments</div>
        <h1>Experiments contains campaigns, not preparation tools.</h1>
        <p>Reusable capture, evidence preparation, bridge/export and expert analyzers now belong in Studio. This workspace is only for experiments built around a concrete Engineering Lab scientific question.</p>
      </div>
    </section>

    <section className="engineering-model-grid">
      {CAMPAIGNS.map(item => {
        const Icon = item.icon;
        return <article className="panel" key={item.title}>
          <div className="panel-title"><Icon size={18}/>{item.title}</div>
          <p>{item.detail}</p>
          <div className="boundary compact"><CheckCircle2 size={14}/>{item.status}</div>
        </article>;
      })}
    </section>

    <section className="panel" style={{ maxWidth: 1420, margin: '14px auto 50px' }}>
      <div className="panel-title"><Sigma size={18}/> Numeric Error Depth · embedded numerical reliability</div>
      <p className="muted">This is the first experiment promoted into the cleaned Experiments structure. Arduino UNO is the finite-precision system under test; host NumPy float32 supplies canonical dtype-local comparison and mpmath supplies the independent high-precision oracle.</p>

      <div className="engineering-model-grid">
        <article className="panel">
          <div className="panel-title">1 · MCU experiment</div>
          <p>Interactive RAW / REDUCED Taylor evaluation, SINGLE / BOTH / SWEEP / LIVE / PHOTO modes, non-blocking sweep and photogate timestamp evidence.</p>
          <div className="measurement big"><b>Firmware V2</b><span>{NUMERIC_FIRMWARE}</span></div>
          <CopyButton text={NUMERIC_FIRMWARE} label="Copy firmware path"/>
        </article>
        <article className="panel">
          <div className="panel-title">2 · Independent host validation</div>
          <p>Preserves Arduino <code>sinf()</code> only as MCU provenance, recomputes canonical NumPy float32 reference and evaluates errors/reliability against mpmath.</p>
          <div className="measurement big"><b>Bridge V2</b><span>{NUMERIC_BRIDGE}</span></div>
          <CopyButton text={NUMERIC_BRIDGE} label="Copy bridge path"/>
        </article>
        <article className="panel">
          <div className="panel-title"><FlaskConical size={17}/> 3 · First campaign</div>
          <p>Run the same x-domain in RAW and range-reduced modes. Compare error, cancellation, stopping rule, reliability and false convergence without changing the independent oracle.</p>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{NUMERIC_COMMANDS}</pre>
          <CopyButton text={NUMERIC_COMMANDS} label="Copy campaign commands"/>
        </article>
      </div>

      <div className="boundary"><CheckCircle2 size={14}/> Promotion boundary: being visible in Experiments does not make the firmware canonical. UNO compile/upload, serial protocol checks, host semantic parity and burst/drop evidence still gate canonical recipe registration.</div>
    </section>
  </div>;
}
