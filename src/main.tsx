import React, { useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { invoke } from '@tauri-apps/api/core';
import { Bot, ChevronDown, ChevronUp, CircuitBoard, Focus, FlaskConical, Grid3X3, RadioTower, X } from 'lucide-react';
import AdvancedCapabilityLauncher from './AdvancedCapabilityLauncher';
import App from './App';
import AnalysisVisualizationHub from './AnalysisVisualizationHub';
import CapabilityLauncher, { type CapabilityTarget } from './CapabilityLauncher';
import { currentTargetForCapability } from './capabilityCurrentRoutes';
import EngineeringStatusMap, { type EngineeringStatusNode } from './EngineeringStatusMap';
import EngineeringFlowLauncher from './EngineeringFlowLauncher';
import LabsHub from './LabsHub';
import HardwareTopology from './HardwareTopology';
import Observatory from './Observatory';
import ObservatoryMissionControl from './ObservatoryMissionControl';
import ObservatoryVisualSummary from './ObservatoryVisualSummary';
import OpenPenguinBridge from './OpenPenguinBridge';
import { EvidenceVisualizationProvider, useEvidenceVisualization } from './EvidenceVisualizationContext';
import { EngineeringAnnotationsProvider } from './EngineeringAnnotations';
import { HardwareSessionProvider, useHardwareSession } from './HardwareSession';
import { RunComparisonProvider } from './RunComparisonContext';
import type { BackgroundTask } from './TaskCenter';
import './styles.css';
import './visual-system.css';
import './monitor-data.css';
import './monitor-mode.css';
import './workspace-shell.css';
import './developer-task.css';
import './copy-ai.css';
import './workflow-rail.css';
import './phase6.css';
import './capability-launcher.css';
import './home-surface.css';

type Workspace = 'studio' | 'labs' | 'analysis' | 'observatory';
type CliInfo = { found: boolean; path?: string; version?: string; error?: string };
type NavigationRequest = { target: CapabilityTarget; token: number } | null;

const TASK_MEMORY_KEY = 'betterboard.task-center.v1';

const WORKSPACES: Array<{ id: Workspace; label: string; subtitle: string; icon: typeof CircuitBoard }> = [
  { id: 'studio', label: 'Studio', subtitle: 'connect · program · monitor', icon: CircuitBoard },
  { id: 'labs', label: 'Labs', subtitle: 'run · measure · inspect', icon: FlaskConical },
  { id: 'analysis', label: 'Analysis', subtitle: 'evidence · statistics · models', icon: Focus },
  { id: 'observatory', label: 'Observatory', subtitle: 'runtime · provenance · system', icon: RadioTower },
];

function readTaskMemory(): BackgroundTask[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(TASK_MEMORY_KEY) || '[]') as BackgroundTask[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

function Root() {
  const [workspace, setWorkspace] = useState<Workspace>('studio');
  const [cli, setCli] = useState<CliInfo | null>(null);
  const [tasks, setTasks] = useState<BackgroundTask[]>(readTaskMemory);
  const [aiOpen, setAiOpen] = useState(false);
  const [launcherOpen, setLauncherOpen] = useState(false);
  const [navigationRequest, setNavigationRequest] = useState<NavigationRequest>(null);
  const [focusMode, setFocusMode] = useState(false);
  const [engineeringOverviewOpen, setEngineeringOverviewOpen] = useState(false);
  const { source: evidenceSource } = useEvidenceVisualization();
  const { selectedPort, activePort, hardwareStatus, fqbn, profiles, diagnosis } = useHardwareSession();

  useEffect(() => {
    void invoke<CliInfo>('arduino_cli_discovery').then(setCli).catch(() => setCli({ found: false }));

    const onTasksChanged = (event: Event) => {
      const detail = (event as CustomEvent<BackgroundTask[]>).detail;
      setTasks(Array.isArray(detail) ? detail : readTaskMemory());
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === TASK_MEMORY_KEY) setTasks(readTaskMemory());
    };
    const resyncTasks = () => setTasks(readTaskMemory());
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') resyncTasks();
    };

    window.addEventListener('betterboard:tasks-changed', onTasksChanged);
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', resyncTasks);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('betterboard:tasks-changed', onTasksChanged);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', resyncTasks);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (launcherOpen) {
          setLauncherOpen(false);
          return;
        }
        if (aiOpen) {
          setAiOpen(false);
          return;
        }
        if (focusMode) {
          setFocusMode(false);
          return;
        }
      }
      if (isEditableTarget(event.target) || !(event.metaKey || event.ctrlKey)) return;
      const key = event.key.toLowerCase();
      if (key === 'k') {
        event.preventDefault();
        setAiOpen(value => !value);
        return;
      }
      if (key === 'j') {
        event.preventDefault();
        setLauncherOpen(value => !value);
        return;
      }
      const workspaceShortcut: Record<string, Workspace> = { '1': 'studio', '2': 'labs', '3': 'analysis', '4': 'observatory' };
      const nextWorkspace = workspaceShortcut[key];
      if (nextWorkspace) {
        event.preventDefault();
        setWorkspace(nextWorkspace);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [aiOpen, launcherOpen, focusMode]);

  const runningTasks = useMemo(() => tasks.filter(task => task.state === 'running'), [tasks]);
  const latestRunning = runningTasks[0];
  const liveSerial = runningTasks.find(task => task.category === 'Monitor' && /live serial/i.test(task.title));
  const successfulTasks = useMemo(() => tasks.filter(task => task.state === 'done'), [tasks]);
  const programmed = successfulTasks.some(task => task.category === 'Program' && /upload|compile/i.test(task.title));
  const monitored = Boolean(liveSerial) || successfulTasks.some(task => task.category === 'Monitor');
  const evidenceSaved = Boolean(evidenceSource) || successfulTasks.some(task => task.category === 'Evidence');
  const analyzed = successfulTasks.some(task => task.category === 'Analysis');
  const programRunning = runningTasks.some(task => task.category === 'Program');

  const workflowNextAction = useMemo(() => {
    if (!cli?.found) return 'Restore the Arduino toolchain';
    if (!selectedPort) return 'Connect and select hardware';
    if (!programmed) return 'Prepare or upload firmware';
    if (liveSerial) return 'Save the live run as evidence';
    if (!monitored) return 'Start Monitor & Data';
    if (!evidenceSaved) return 'Save the captured measurement';
    if (!analyzed) return 'Analyze or compare the evidence';
    return 'Start the next experiment';
  }, [cli?.found, selectedPort, programmed, liveSerial, monitored, evidenceSaved, analyzed]);

  const statusNodes = useMemo<EngineeringStatusNode[]>(() => {
    const hardwareState: EngineeringStatusNode['status'] = diagnosis.code === 'ready'
      ? 'READY'
      : diagnosis.code === 'scanning' ? 'ACTIVE'
        : diagnosis.code === 'board-unidentified' ? 'WARNING'
          : diagnosis.code === 'no-board' || diagnosis.code === 'system-ports-only' ? 'UNAVAILABLE'
            : 'BLOCKED';
    return [
      { id: 'toolchain', label: 'Toolchain', status: cli === null ? 'ACTIVE' : cli.found ? 'READY' : 'BLOCKED', detail: cli?.found ? (cli.version || 'Arduino CLI available') : cli === null ? 'Detecting Arduino CLI…' : 'Arduino CLI unavailable' },
      { id: 'hardware', label: 'Hardware', status: hardwareState, detail: diagnosis.title },
      { id: 'firmware', label: 'Firmware', status: programRunning ? 'ACTIVE' : programmed ? 'READY' : diagnosis.canCompile ? 'WARNING' : 'BLOCKED', detail: programRunning ? 'Compile/upload running' : programmed ? 'Verified program task completed' : diagnosis.canCompile ? 'Ready to verify firmware' : diagnosis.action },
      { id: 'acquisition', label: 'Acquisition', status: liveSerial ? 'ACTIVE' : monitored ? 'READY' : selectedPort ? 'WARNING' : 'UNAVAILABLE', detail: liveSerial ? 'Live serial acquisition' : monitored ? 'Acquisition observed' : selectedPort ? 'Open Monitor & Data to acquire' : 'No selected board' },
      { id: 'evidence', label: 'Evidence', status: evidenceSaved ? 'READY' : liveSerial ? 'WARNING' : 'UNAVAILABLE', detail: evidenceSource?.label || (evidenceSaved ? 'Saved evidence available' : liveSerial ? 'Live data is not yet saved evidence' : 'No shared evidence selected') },
      { id: 'analysis', label: 'Analysis', status: analyzed ? 'READY' : evidenceSaved ? 'WARNING' : 'UNAVAILABLE', detail: analyzed ? 'Analysis task completed' : evidenceSaved ? 'Evidence ready for analysis' : 'Select or save evidence first' },
    ];
  }, [diagnosis, cli, programRunning, programmed, liveSerial, monitored, selectedPort, evidenceSaved, evidenceSource?.label, analyzed]);

  function navigateCapability(target: CapabilityTarget) {
    setLauncherOpen(false);
    if (target === 'ai') {
      setAiOpen(true);
      return;
    }
    const [scope, item] = target.split(':', 2);
    if (scope === 'studio') setWorkspace('studio');
    else if (scope === 'labs') setWorkspace('labs');
    else if (scope === 'analysis') setWorkspace('analysis');
    else if (scope === 'observatory') setWorkspace('observatory');

    const request = { target, token: Date.now() };
    setNavigationRequest(request);

    if (scope === 'observatory') {
      const anchor: Record<string, string> = {
        overview: 'observatory-overview',
        hardware: 'observatory-hardware',
        inventory: 'observatory-inventory',
        data: 'observatory-data',
        live: 'observatory-live',
        bridge: 'observatory-bridge',
        tasks: 'observatory-tasks',
        evidence: 'observatory-evidence',
      };
      const id = anchor[item];
      if (id) window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
    }
  }

  function navigateSemanticCapability(capabilityId: string) {
    const target = currentTargetForCapability(capabilityId);
    if (target) navigateCapability(target);
  }

  function navigateStatus(node: EngineeringStatusNode) {
    if (node.id === 'acquisition') return navigateCapability('studio:data');
    if (node.id === 'evidence') return navigateCapability('analysis:evidence');
    if (node.id === 'analysis') return navigateCapability('analysis:evidence');
    navigateCapability('studio:hardware');
  }

  const openPenguinContext = useMemo(() => [
    `Workspace: ${workspace}`,
    `Arduino CLI: ${cli?.found ? 'ready' : 'unavailable'}`,
    `Board profile: ${fqbn}`,
    `Hardware: ${selectedPort ? `${activePort?.board_name || 'Board'} · ${selectedPort}` : 'none selected'}`,
    `Acquisition: ${liveSerial ? 'LIVE' : 'idle'}`,
    `Running tasks: ${runningTasks.length}`,
    `Current status: ${latestRunning?.detail || hardwareStatus}`,
    `Recommended next action: ${workflowNextAction}`,
  ].join('\n'), [workspace, cli?.found, fqbn, selectedPort, activePort?.board_name, liveSerial, runningTasks.length, latestRunning?.detail, hardwareStatus, workflowNextAction]);

  const lastProgram = successfulTasks.find(task => task.category === 'Program');

  return <div className={`bb-root ${focusMode ? 'focus-mode' : ''}`}>
    <header className="bb-command-bar rich">
      <div className="bb-command-brand"><span className="bb-command-mark">B</span><span><b>BetterBoard</b><small>physical computing studio</small></span></div>
      <nav className="bb-workspace-tabs" aria-label="BetterBoard workspaces">
        {WORKSPACES.map((item, index) => {
          const Icon = item.icon;
          return <button key={item.id} className={`bb-workspace-tab ${workspace === item.id ? 'active' : ''}`} onClick={() => setWorkspace(item.id)} aria-pressed={workspace === item.id} title={`${item.label} · ⌘/Ctrl+${index + 1}`}>
            <span className="bb-workspace-icon"><Icon size={15}/></span><span><b>{item.label}</b><small>{item.subtitle}</small></span>
          </button>;
        })}
      </nav>
      <button className={`bb-focus-launch bb-all-tools-launch ${launcherOpen ? 'active' : ''}`} onClick={() => setLauncherOpen(value => !value)} aria-pressed={launcherOpen} title="Open the complete BetterBoard capability index · ⌘/Ctrl+J"><Grid3X3 size={15}/><span><b>All Tools</b><small>find anything · ⌘/Ctrl+J</small></span></button>
      <button className={`bb-focus-launch ${focusMode ? 'active' : ''}`} onClick={() => setFocusMode(value => !value)} aria-pressed={focusMode} title="Focus mode keeps critical status visible while hiding secondary navigation"><Focus size={15}/><span><b>{focusMode ? 'Exit focus' : 'Focus mode'}</b><small>{focusMode ? 'Esc to exit' : 'presentation / experiment'}</small></span></button>
      <button className={`bb-ai-launch ${aiOpen ? 'active' : ''}`} onClick={() => setAiOpen(value => !value)} aria-pressed={aiOpen} title="Open OpenPenguin local AI bridge · ⌘/Ctrl+K"><Bot size={16}/><span><b>OpenPenguin</b><small>local AI · ⌘/Ctrl+K</small></span></button>
      <div className={`bb-local-state ${selectedPort ? 'connected' : 'disconnected'}`} title={hardwareStatus}><i/><span><b>{selectedPort ? (activePort?.board_name || 'Board') : 'No board'}</b><small>{selectedPort || 'select hardware in Studio'}</small></span></div>
    </header>

    <div className="bb-context-strip" aria-label="Global BetterBoard runtime context">
      <span><i className={cli?.found ? 'good' : 'warn'}/><b>CLI</b>{cli?.found ? 'Ready' : 'Unavailable'}</span>
      <span><b>Profile</b>{fqbn}</span>
      <span><b>Hardware</b>{selectedPort ? `${activePort?.board_name || 'Board'} · ${selectedPort}` : 'No board selected'}</span>
      <span className={liveSerial ? 'live' : ''}><b>Acquisition</b>{liveSerial ? 'LIVE' : 'Idle'}</span>
      <button className="bb-context-action" onClick={() => navigateCapability('studio:tasks')} title="Open Task Center"><b>Tasks</b>{runningTasks.length ? `${runningTasks.length} running` : 'Background idle'}</button>
      <span className="bb-context-current"><b>Current</b>{latestRunning?.detail || hardwareStatus}</span>
    </div>

    {workspace === 'studio' && <section className="bb-engineering-overview-shell">
      <button type="button" className="bb-overview-toggle" onClick={() => setEngineeringOverviewOpen(value => !value)} aria-expanded={engineeringOverviewOpen}>
        <span><b>Engineering overview</b><small>{workflowNextAction} · {diagnosis.title}</small></span>
        {engineeringOverviewOpen ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
      </button>
      {engineeringOverviewOpen && <div className="bb-engineering-overview">
        <EngineeringStatusMap nodes={statusNodes} onNavigate={navigateStatus}/>
        <HardwareTopology toolchainReady={Boolean(cli?.found)} selectedPort={selectedPort} activePort={activePort} selectedFqbn={fqbn} profiles={profiles} diagnosis={diagnosis} requiredLibraries={null} missingLibraries={null} firmwareLabel={lastProgram?.title ?? null} firmwareReady={Boolean(lastProgram)}/>
        <div className="boundary compact" style={{ maxWidth: 1504, margin: '8px auto 0' }}><b>Next action</b> · {workflowNextAction}</div>
        <EngineeringFlowLauncher onOpenCapability={navigateSemanticCapability}/>
        <AdvancedCapabilityLauncher onOpenCapability={navigateSemanticCapability}/>
      </div>}
    </section>}

    <CapabilityLauncher open={launcherOpen} onClose={() => setLauncherOpen(false)} onNavigate={navigateCapability}/>

    <div className="bb-ai-drawer-backdrop" hidden={!aiOpen} onClick={() => setAiOpen(false)} />
    <aside className="bb-ai-drawer" hidden={!aiOpen} aria-label="OpenPenguin local AI bridge">
      <div className="bb-ai-drawer-head"><span><Bot size={17}/><b>OpenPenguin · Local AI</b></span><button className="ghost mini" onClick={() => setAiOpen(false)}><X size={13}/> Close</button></div>
      <OpenPenguinBridge context={openPenguinContext} />
    </aside>

    <div className="bb-workspace-frame">
      <div className="bb-workspace-pane" hidden={workspace !== 'studio'}><App navigationRequest={navigationRequest} onNavigate={navigateCapability}/></div>
      <div className="bb-workspace-pane" hidden={workspace !== 'labs'}><LabsHub navigationRequest={navigationRequest} onNavigate={navigateCapability}/></div>
      <div className="bb-workspace-pane" hidden={workspace !== 'analysis'}><AnalysisVisualizationHub navigationRequest={navigationRequest}/></div>
      <div className="bb-workspace-pane" hidden={workspace !== 'observatory'}><div id="observatory-overview" className="observatory-anchor"/><ObservatoryMissionControl /><ObservatoryVisualSummary /><Observatory /></div>
    </div>
  </div>;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><HardwareSessionProvider><EvidenceVisualizationProvider><RunComparisonProvider><EngineeringAnnotationsProvider><Root /></EngineeringAnnotationsProvider></RunComparisonProvider></EvidenceVisualizationProvider></HardwareSessionProvider></React.StrictMode>,
);
