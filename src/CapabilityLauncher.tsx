import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, BarChart3, Bot, Boxes, CircuitBoard, Code2, Cpu, Database, FlaskConical,
  Gauge, Grid3X3, HardDrive, LineChart, Magnet, RadioTower, Search, Sigma,
  TerminalSquare, UploadCloud, Waves, Wrench, X,
} from 'lucide-react';
import { CAPABILITIES as SEMANTIC_CAPABILITIES } from './capabilityRegistry';
import { CAPABILITY_SHORTCUTS } from './capabilityShortcuts';
import { getCapabilityTier } from './capabilityTierModel';
import { currentTargetForCapability, type CurrentCapabilityTarget } from './capabilityCurrentRoutes';
import './capability-launcher.css';

export type CapabilityTarget = CurrentCapabilityTarget;

type Capability = {
  target: CapabilityTarget;
  group: 'Build & connect' | 'Measure & experiment' | 'Analyze & decide' | 'System & handoff';
  title: string;
  detail: string;
  keywords: string;
  icon: typeof CircuitBoard;
};

const CAPABILITIES: Capability[] = [
  { target: 'studio:hardware', group: 'Build & connect', title: 'Hardware & Program', detail: 'Select board, run Hardware Doctor, preflight, compile and upload.', keywords: 'board arduino compile upload preflight', icon: Cpu },
  { target: 'studio:circuit', group: 'Build & connect', title: 'Circuit Lab', detail: 'Visual wiring editor and rule checker.', keywords: 'wire wiring circuit resistor led schematic', icon: CircuitBoard },
  { target: 'studio:library', group: 'Build & connect', title: 'Recipe Library', detail: 'Browse firmware recipes, devices, schemas and saved presets.', keywords: 'recipe firmware library preset hardware', icon: Boxes },
  { target: 'studio:developer', group: 'Build & connect', title: 'Developer', detail: 'Arduino-style editor, files, ecosystems, verify/upload and diagnostics.', keywords: 'code ide editor sketch libraries boards diagnostics', icon: Code2 },

  { target: 'studio:data', group: 'Measure & experiment', title: 'Monitor & Data', detail: 'Live serial, snapshots, multichannel plots, evidence recording and replay.', keywords: 'serial monitor live data capture record replay', icon: Waves },
  { target: 'labs:numerical', group: 'Measure & experiment', title: 'Numerical Lab', detail: 'Acquisition, sampling error and MCU numerical reliability.', keywords: 'adc sampling jitter integration derivative float32 float64', icon: Sigma },
  { target: 'labs:numerical-expert', group: 'Measure & experiment', title: 'Numerical Expert Tools', detail: 'Classic numerical analyzers and implementation-level controls.', keywords: 'advanced numerical analyzer implementation expert', icon: BarChart3 },
  { target: 'labs:magnet', group: 'Measure & experiment', title: 'Magnet Lab', detail: 'Vector acquisition, characterization, spatial mapping and model validation.', keywords: 'magnet field magnetic mlx90393 radia residual', icon: Magnet },
  { target: 'labs:magnet-expert', group: 'Measure & experiment', title: 'Magnetic Expert Tools', detail: 'Advanced residual, scan and characterization controls.', keywords: 'advanced magnet residual characterization expert', icon: Gauge },
  { target: 'labs:campaigns', group: 'Measure & experiment', title: 'Campaigns', detail: 'Engineering experiment families and campaign visualizations.', keywords: 'campaign engineering experiment oscillation numerical magnetic', icon: FlaskConical },
  { target: 'labs:campaign-library', group: 'Measure & experiment', title: 'Experiment Code Library', detail: 'Repository-discovered firmware and host analysis tools.', keywords: 'source code firmware scripts verify upload repository', icon: HardDrive },

  { target: 'analysis:evidence', group: 'Analyze & decide', title: 'Evidence', detail: 'Select saved evidence or external tables and inspect provenance.', keywords: 'evidence source provenance session import', icon: Database },
  { target: 'analysis:statistics', group: 'Analyze & decide', title: 'Signal & Statistics', detail: 'Uncertainty, signal health, spectra and change analysis.', keywords: 'statistics fft spectrum uncertainty signal noise', icon: Activity },
  { target: 'analysis:models', group: 'Analyze & decide', title: 'Models', detail: 'Fit models, compare references and inspect residuals.', keywords: 'model fitting regression residual reference compare', icon: LineChart },
  { target: 'analysis:magnet-results', group: 'Analyze & decide', title: 'Magnetic Result Viewer', detail: 'Open Magnet Bench 02/03 summaries, scans and residual files for derived visualization.', keywords: 'magnet result visualization residual scan magnet02 magnet03', icon: Magnet },
  { target: 'analysis:design', group: 'Analyze & decide', title: 'Experiment Design', detail: 'Coverage, replication, information and next-run planning.', keywords: 'experiment design replication plan coverage information', icon: FlaskConical },
  { target: 'analysis:numerical', group: 'Analyze & decide', title: 'Numerical Analysis', detail: 'Error, convergence and precision on selected evidence.', keywords: 'numerical error convergence precision', icon: BarChart3 },

  { target: 'labs:handoff', group: 'System & handoff', title: 'Evidence Handoff', detail: 'Research context, provenance and Engineering Lab bridge package.', keywords: 'handoff export engineering lab research bridge provenance', icon: UploadCloud },
  { target: 'studio:tasks', group: 'System & handoff', title: 'Task Center', detail: 'Running jobs, failures, history, logs and cancellation.', keywords: 'tasks jobs logs background failure cancel', icon: TerminalSquare },
  { target: 'observatory:overview', group: 'System & handoff', title: 'System Observatory', detail: 'Whole-system operational state and evidence readiness.', keywords: 'system observatory runtime status overview', icon: RadioTower },
  { target: 'observatory:hardware', group: 'System & handoff', title: 'Toolchain & Hardware State', detail: 'Board diagnosis, upload gate and Arduino CLI state.', keywords: 'hardware toolchain cli doctor board', icon: Wrench },
  { target: 'observatory:inventory', group: 'System & handoff', title: 'Recipe & Device Inventory', detail: 'Inventory of available recipes and known devices.', keywords: 'inventory devices recipes catalog', icon: Boxes },
  { target: 'observatory:data', group: 'System & handoff', title: 'Latest Data Observation', detail: 'Latest saved evidence, sample rate and parse coverage.', keywords: 'latest data sampling evidence coverage', icon: Database },
  { target: 'observatory:live', group: 'System & handoff', title: 'Live Acquisition State', detail: 'Current live serial activity and observed row counts.', keywords: 'live acquisition serial rows', icon: Activity },
  { target: 'observatory:bridge', group: 'System & handoff', title: 'Engineering Lab Bridge Readiness', detail: 'Check whether handoff artifacts are complete.', keywords: 'bridge readiness engineering lab export', icon: UploadCloud },
  { target: 'observatory:evidence', group: 'System & handoff', title: 'Recent Measurement Evidence', detail: 'Saved session history and evidence metadata.', keywords: 'measurement history sessions evidence recent', icon: Database },
  { target: 'ai', group: 'System & handoff', title: 'OpenPenguin', detail: 'Local AI bridge with current BetterBoard context.', keywords: 'ai local assistant openguin', icon: Bot },
];

const GROUPS: Capability['group'][] = ['Build & connect', 'Measure & experiment', 'Analyze & decide', 'System & handoff'];

const SEMANTIC_ITEMS = [
  ...SEMANTIC_CAPABILITIES.map(item => ({
    id: item.id,
    title: item.label,
    detail: item.description,
    keywords: [item.group, item.owner, ...item.keywords].join(' '),
    target: currentTargetForCapability(item.id),
    tier: getCapabilityTier(item.id),
    kind: 'capability' as const,
  })),
  ...CAPABILITY_SHORTCUTS.map(item => ({
    id: item.id,
    title: item.label,
    detail: item.description,
    keywords: [item.group, item.owner, ...item.keywords].join(' '),
    target: currentTargetForCapability(item.id),
    tier: getCapabilityTier(item.id),
    kind: 'shortcut' as const,
  })),
].filter(item => item.target !== null);

export default function CapabilityLauncher({
  open,
  onClose,
  onNavigate,
}: {
  open: boolean;
  onClose: () => void;
  onNavigate: (target: CapabilityTarget) => void;
}) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return CAPABILITIES;
    return CAPABILITIES.filter(item => [item.title, item.detail, item.group, item.keywords].join(' ').toLowerCase().includes(needle));
  }, [query]);

  const semanticFiltered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const items = needle
      ? SEMANTIC_ITEMS.filter(item => [item.title, item.detail, item.keywords].join(' ').toLowerCase().includes(needle))
      : SEMANTIC_ITEMS;
    return items.slice(0, needle ? 120 : 24);
  }, [query]);

  if (!open) return null;

  return <>
    <button className="capability-backdrop" aria-label="Close All Tools" onClick={onClose}/>
    <aside className="capability-launcher" aria-label="All BetterBoard tools">
      <header className="capability-head">
        <span><Grid3X3 size={18}/><span><b>All Tools</b><small>Every major BetterBoard capability in one index</small></span></span>
        <button className="ghost mini" onClick={onClose}><X size={13}/> Close</button>
      </header>

      <label className="capability-search"><Search size={15}/><input ref={inputRef} value={query} onChange={event => setQuery(event.target.value)} placeholder="Search hardware, sampling, models, tasks, bridge…"/></label>
      <div className="capability-rule">No primary capability should require guessing a workspace or scrolling through an unrelated page.</div>

      <div className="capability-groups">
        {GROUPS.map(group => {
          const items = filtered.filter(item => item.group === group);
          if (!items.length) return null;
          return <section key={group} className="capability-group">
            <div className="capability-group-title">{group}<span>{items.length}</span></div>
            <div className="capability-grid">
              {items.map(item => {
                const Icon = item.icon;
                return <button key={item.target} type="button" className="capability-card" onClick={() => onNavigate(item.target)}>
                  <span className="capability-icon"><Icon size={17}/></span>
                  <span><b>{item.title}</b><small>{item.detail}</small><em>{item.tier} · {item.kind === 'shortcut' ? 'direct shortcut' : 'canonical capability'}</em></span>
                </button>;
              })}
            </div>
          </section>;
        })}
        <section className="capability-group">
          <div className="capability-group-title">Detailed tools<span>{SEMANTIC_ITEMS.length}</span></div>
          <details open={Boolean(query.trim())}>
            <summary className="capability-rule">Search or expand direct sub-tools from the #67 semantic capability index. Every item routes to the current canonical Studio / Labs / Analysis / Observatory owner.</summary>
            <div className="capability-grid">
              {semanticFiltered.map(item => <button key={item.id} type="button" className="capability-card" onClick={() => item.target && onNavigate(item.target)}>
                <span className="capability-icon"><Grid3X3 size={16}/></span>
                <span><b>{item.title}</b><small>{item.detail}</small></span>
              </button>)}
            </div>
          </details>
        </section>
        {!filtered.length && !semanticFiltered.length && <div className="empty compact">No BetterBoard capability matches “{query}”.</div>}
      </div>
    </aside>
  </>;
}
