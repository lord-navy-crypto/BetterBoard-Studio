import { useEffect, useState } from 'react';
import { Activity, FlaskConical, Magnet, Sigma, UploadCloud } from 'lucide-react';
import NumericalBenchSuiteV2 from './NumericalBenchSuiteV2';
import NumericalBenchAdvanced from './NumericalBenchAdvanced';
import MagnetBenchSuiteV2 from './MagnetBenchSuiteV2';
import MagnetBenchAdvanced from './MagnetBenchAdvanced';
import ExperimentsHub from './ExperimentsHub';
import EngineeringPreparationStudio from './EngineeringPreparationStudio';
import type { CapabilityTarget } from './CapabilityLauncher';
import './lab-hub.css';

type LabView = 'numerical' | 'magnet' | 'campaigns' | 'handoff';

const LABS = [
  {
    id: 'numerical' as const,
    title: 'Numerical Lab',
    subtitle: 'ADC sampling · timing · numerical reliability',
    detail: 'Run the potentiometer/ADC experiment, study sampling error, or inspect embedded numerical reliability.',
    icon: Sigma,
    badge: 'Recommended demo',
  },
  {
    id: 'magnet' as const,
    title: 'Magnet Lab',
    subtitle: 'field acquisition · spatial profile · model residual',
    detail: 'Acquire magnetic-field evidence and prepare direct comparison with field models.',
    icon: Magnet,
    badge: 'Measurement lab',
  },
  {
    id: 'campaigns' as const,
    title: 'Experiment Library',
    subtitle: 'campaigns · shared Library',
    detail: 'Browse experiment campaigns, then use the same Library surface shared with Studio and Developer.',
    icon: FlaskConical,
    badge: 'Experiment library',
  },
  {
    id: 'handoff' as const,
    title: 'Evidence Handoff',
    subtitle: 'context · provenance · Engineering Lab bridge',
    detail: 'Package a saved run with research context, provenance and downstream handoff metadata.',
    icon: UploadCloud,
    badge: 'After measurement',
  },
];

export default function LabsHub({ navigationRequest = null, onNavigate }: { navigationRequest?: { target: string; token: number } | null; onNavigate?: (target: CapabilityTarget) => void }) {
  const [active, setActive] = useState<LabView>('numerical');
  const [numericalExpertOpen, setNumericalExpertOpen] = useState(false);
  const [magneticExpertOpen, setMagneticExpertOpen] = useState(false);
  const selected = LABS.find(item => item.id === active)!;

  useEffect(() => {
    if (!navigationRequest?.target.startsWith('labs:')) return;
    const target = navigationRequest.target.slice('labs:'.length);
    if (target === 'numerical' || target === 'numerical-expert') {
      setActive('numerical');
      if (target === 'numerical-expert') setNumericalExpertOpen(true);
    } else if (target === 'magnet' || target === 'magnet-expert') {
      setActive('magnet');
      if (target === 'magnet-expert') setMagneticExpertOpen(true);
    } else if (target === 'campaigns' || target === 'campaign-library') {
      setActive('campaigns');
      if (target === 'campaign-library') {
        window.setTimeout(() => document.getElementById('campaign-code-library')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
      }
    } else if (target === 'handoff') {
      setActive('handoff');
    }
  }, [navigationRequest?.token]);

  return <section className="labs-workspace">
    <header className="labs-hero">
      <div>
        <div className="eyebrow">BetterBoard Labs</div>
        <h1>Choose the experiment first.</h1>
        <p>Hardware-facing experiments now live in one direct workspace. Numerical and magnetic labs are first-class tools; campaign browsing and Engineering Lab handoff are separate downstream tasks.</p>
      </div>
      <div className="labs-hero-flow" aria-label="Lab workflow">
        <span>Choose lab</span><b>→</b><span>Run / capture</span><b>→</b><span>Inspect results</span><b>→</b><span>Handoff</span>
      </div>
    </header>

    <nav className="lab-launch-grid" aria-label="Lab workspaces">
      {LABS.map(item => {
        const Icon = item.icon;
        return <button
          key={item.id}
          type="button"
          className={`lab-launch-card ${active === item.id ? 'active' : ''}`}
          aria-pressed={active === item.id}
          onClick={() => setActive(item.id)}
        >
          <span className="lab-launch-icon"><Icon size={20}/></span>
          <span className="lab-launch-copy">
            <small>{item.badge}</small>
            <b>{item.title}</b>
            <em>{item.subtitle}</em>
            <p>{item.detail}</p>
          </span>
        </button>;
      })}
    </nav>

    <div className="lab-active-strip">
      <Activity size={15}/>
      <span><b>Active lab · {selected.title}</b><small>{selected.subtitle}</small></span>
    </div>

    {active === 'numerical' && <div className="lab-view">
      <NumericalBenchSuiteV2 initialMode="bench02"/>
      <details className="lab-expert-tools" open={numericalExpertOpen} onToggle={event => setNumericalExpertOpen(event.currentTarget.open)}>
        <summary>Numerical expert tools</summary>
        <p>Classic analyzers and implementation-level controls are available here without crowding the normal experiment workflow.</p>
        <NumericalBenchAdvanced/>
      </details>
    </div>}

    {active === 'magnet' && <div className="lab-view">
      <MagnetBenchSuiteV2/>
      <details className="lab-expert-tools" open={magneticExpertOpen} onToggle={event => setMagneticExpertOpen(event.currentTarget.open)}>
        <summary>Magnetic expert tools</summary>
        <p>Open deeper residual and characterization controls only when the normal Magnet Lab surface is not enough.</p>
        <MagnetBenchAdvanced/>
      </details>
    </div>}

    {active === 'campaigns' && <div className="lab-view"><ExperimentsHub onNavigate={onNavigate}/></div>}
    {active === 'handoff' && <div className="lab-view"><EngineeringPreparationStudio/></div>}
  </section>;
}
