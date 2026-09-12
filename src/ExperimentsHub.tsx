import { Activity, CheckCircle2, FlaskConical, Magnet, Sigma } from 'lucide-react';
import CopyButton from './CopyButton';
import EspressifCapabilityPanel from './EspressifCapabilityPanel';

// Legacy structural selectors retired by the Studio preparation migration:
// hidden={tool!=='numerical'}
// hidden={tool!=='magnet'}
// Their preparation surfaces now live in EngineeringPreparationStudio.

const NUMERIC_FIRMWARE = 'src-tauri/resources/firmware/NumericError_InteractiveStudioV2/NumericError_InteractiveStudioV2.ino';
const SIGNAL_CHAIN_FIRMWARE = 'src-tauri/resources/firmware/NumericError_SignalChainLabV1/NumericError_SignalChainLabV1.ino';
const EVENT_TIMING_FIRMWARE = 'src-tauri/resources/firmware/NumericError_EventTimingLabV1/NumericError_EventTimingLabV1.ino';
const NUMERIC_BRIDGE = 'scripts/arduino_numeric_error_bridge_v2.py';
const NUMERIC_ANALYZER = 'scripts/numeric_error_campaign_analyzer.py';
const NUMERIC_COMMANDS = [
  'METHOD RAW',
  'RANGE -80 80',
  'POINTS 161',
  'RUN SWEEP',
  'METHOD REDUCED',
  'RUN SWEEP',
].join('\n');

const NUMERIC_FAMILIES = [
  'Interactive Taylor reliability · RAW / REDUCED / false convergence',
  'Sampling & aliasing · synthetic sampling theory + scheduler evidence',
  'Signal Chain Lab · ADC stability + ADC/PWM quantization + EMA filter lag',
  'Numerical methods · cancellation + fixed-point + overflow + derivative + integration + summation',
  'Event Timing Lab · switch debounce + photogate timing/loss + PIR observed timing + sampled context',
];

const CAMPAIGNS = [
  {
    title: 'Numeric Error Depth',
    detail: 'Finite precision · sampling · quantization · cancellation · convergence · event/timing evidence · host reference',
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
        <p>Reusable capture, evidence preparation, bridge/export and expert analyzers belong in Studio. This workspace is only for experiments built around a concrete Engineering Lab scientific question.</p>
        <p className="muted">Connect with Engineering Lab through Studio's <b>BetterBoard → Engineering Lab handoff</b>. Preparation surfaces such as <b>Numerical Error Analysis</b>, <b>RADIA Magnet Studio</b> compatibility and other <b>Expert workflows</b> remain in Studio rather than being duplicated here.</p>
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

    <EspressifCapabilityPanel />

    <section className="panel" style={{ maxWidth: 1420, margin: '14px auto 50px' }}>
      <div className="panel-title"><Sigma size={18}/> Numeric Error Depth · embedded numerical reliability</div>
      <p className="muted">Arduino UNO and its measurement/event path are systems under test. Independent host analysis owns scientific reference work. Overlapping research-pack programs are fused into integrated campaign labs where they share the same physical data path; orthogonal numerical mechanisms remain separate controlled firmware under one family.</p>

      <div className="engineering-model-grid">
        <article className="panel">
          <div className="panel-title">1 · Interactive core</div>
          <p>RAW / REDUCED Taylor evaluation, SINGLE / BOTH / SWEEP / LIVE / PHOTO, non-blocking sweep and queued photogate timestamp evidence.</p>
          <div className="measurement big"><b>Firmware V2</b><span>{NUMERIC_FIRMWARE}</span></div>
          <CopyButton text={NUMERIC_FIRMWARE} label="Copy firmware path"/>
        </article>

        <article className="panel">
          <div className="panel-title">2 · Signal Chain Lab</div>
          <p>One synchronized A0 → measurement → quantization → EMA → PWM path replaces four overlapping end-to-end demos while preserving the old focused sketches as single-factor controls.</p>
          <div className="measurement big"><b>Integrated firmware</b><span>{SIGNAL_CHAIN_FIRMWARE}</span></div>
          <CopyButton text={SIGNAL_CHAIN_FIRMWARE} label="Copy Signal Chain path"/>
        </article>

        <article className="panel">
          <div className="panel-title">3 · Event Timing Lab</div>
          <p>Photogate queue/drop evidence, switch raw-vs-debounced transitions, PIR observed-output timing and periodic context now share one event experiment and one clock.</p>
          <div className="measurement big"><b>Integrated firmware</b><span>{EVENT_TIMING_FIRMWARE}</span></div>
          <CopyButton text={EVENT_TIMING_FIRMWARE} label="Copy Event Timing path"/>
        </article>

        <article className="panel">
          <div className="panel-title">4 · Campaign families</div>
          <ul className="compact-list">{NUMERIC_FAMILIES.map(item => <li key={item}>{item}</li>)}</ul>
        </article>

        <article className="panel">
          <div className="panel-title">5 · Independent host validation</div>
          <p>Interactive Taylor rows use the Numerical Error Studio bridge; the wider experiment family uses the consolidated campaign analyzer.</p>
          <div className="measurement big"><b>Bridge V2</b><span>{NUMERIC_BRIDGE}</span><b>Campaign analyzer</b><span>{NUMERIC_ANALYZER}</span></div>
          <div className="action-row"><CopyButton text={NUMERIC_BRIDGE} label="Copy bridge path"/><CopyButton text={NUMERIC_ANALYZER} label="Copy analyzer path"/></div>
        </article>

        <article className="panel">
          <div className="panel-title"><FlaskConical size={17}/> 6 · RAW vs REDUCED campaign</div>
          <p>Run the same x-domain in RAW and range-reduced modes. Compare error, cancellation, stopping rule, reliability and false convergence without changing the independent oracle.</p>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{NUMERIC_COMMANDS}</pre>
          <CopyButton text={NUMERIC_COMMANDS} label="Copy campaign commands"/>
        </article>
      </div>

      <div className="boundary"><CheckCircle2 size={14}/> Promotion boundary: firmware exposed here is research-grade and CI-compile gated. Real UNO upload, serial capture, host analyzer/bridge comparison and timing/drop review remain the evidence gate for claims about physical hardware behavior.</div>
    </section>
  </div>;
}
