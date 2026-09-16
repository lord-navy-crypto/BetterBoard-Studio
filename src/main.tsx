import React, { useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { invoke } from '@tauri-apps/api/core';
import { Bot, CircuitBoard, Focus, FlaskConical, LayoutGrid, RadioTower, X } from 'lucide-react';
import AdvancedCapabilityLauncher from './AdvancedCapabilityLauncher';
import App from './App';
import AnalysisVisualizationHub from './AnalysisVisualizationHub';
import CapabilityNavigator from './CapabilityNavigator';
import { CapabilityNavigationProvider, useCapabilityNavigation } from './CapabilityNavigationContext';
import CurrentWorkSummary from './CurrentWorkSummary';
import EngineeringCommandSurface from './EngineeringCommandSurface';
import EngineeringFlowLauncher from './EngineeringFlowLauncher';
import type { EngineeringStatusNode } from './EngineeringStatusMap';
import ExperimentsHub from './ExperimentsHub';
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
import type { CurrentTaskSummary, CurrentWorkItem, HomeAction } from './homeSurfaceModel';
import './styles.css';
import './visual-system.css';
import './monitor-data.css';
import './monitor-mode.css';
import './workspace-shell.css';
import './developer-task.css';
import './copy-ai.css';
import './workflow-rail.css';
import './phase6.css';
import './capability-navigation.css';
import './home-surface.css';

type Workspace = 'studio' | 'observatory' | 'experiments';
type CliInfo = { found: boolean; path?: string; version?: string; error?: string };

const TASK_MEMORY_KEY = 'betterboard.task-center.v1';

const WORKSPACES: Array<{ id: Workspace; label: string; subtitle: string; icon: typeof CircuitBoard }> = [
  { id: 'studio', label: 'Studio', subtitle: 'build · monitor · prepare · handoff', icon: CircuitBoard },
  { id: 'observatory', label: 'Observatory', subtitle: 'runtime · evidence · system state', icon: RadioTower },
  { id: 'experiments', label: 'Experiments', subtitle: 'Engineering Lab campaigns', icon: FlaskConical },
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

function capabilityForTask(task: BackgroundTask) {
  if (task.category === 'Program') return 'program-firmware';
  if (task.category === 'Monitor') return 'monitor-live';
  if (task.category === 'Evidence') return 'measurement-evidence';
  if (task.category === 'Analysis') return 'analysis-evidence';
  return 'task-center';
}

function Root() {
  const [workspace, setWorkspace] = useState<Workspace>('studio');
  return <CapabilityNavigationProvider workspace={workspace} setWorkspace={setWorkspace}>
    <RootContent workspace={workspace} setWorkspace={setWorkspace} />
  </CapabilityNavigationProvider>;
}

function RootContent({ workspace, setWorkspace }: { workspace: Workspace; setWorkspace: React.Dispatch<React.SetStateAction<Workspace>> }) {
  const [cli, setCli] = useState<CliInfo | null>(null);
  const [tasks, setTasks] = useState<BackgroundTask[]>(readTaskMemory);
  const [aiOpen, setAiOpen] = useState(false);
  const [allToolsOpen, setAllToolsOpen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const { openCapability } = useCapabilityNavigation();
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
        if (allToolsOpen) {
          setAllToolsOpen(false);
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
      const workspaceShortcut: Record<string, Workspace> = { '1': 'studio', '2': 'observatory', '3': 'experiments' };
      const nextWorkspace = workspaceShortcut[key];
      if (nextWorkspace) {
        event.preventDefault();
        setWorkspace(nextWorkspace);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [aiOpen, allToolsOpen, focusMode, setWorkspace]);

  const runningTasks = useMemo(() => tasks.filter(task => task.state === 'running'), [tasks]);
  const latestRunning = runningTasks[0];
  const liveSerial = runningTasks.find(task => task.category === 'Monitor' && /live serial/i.test(task.title));
  const successfulTasks = useMemo(() => tasks.filter(task => task.state === 'done'), [tasks]);
  const latestFailed = useMemo(() => tasks.find(task => task.state === 'failed'), [tasks]);
  const lastProgram = successfulTasks.find(task => task.category === 'Program');
  const programmed = successfulTasks.some(task => task.category === 'Program' && /upload|compile/i.test(task.title));
  const monitored = Boolean(liveSerial) || successfulTasks.some(task => task.category === 'Monitor');
  const evidenceSaved = Boolean(evidenceSource) || successfulTasks.some(task => task.category === 'Evidence');
  const analyzed = successfulTasks.some(task => task.category === 'Analysis');
  const programRunning = runningTasks.some(task => task.category === 'Program');

  const workflowNextAction = useMemo<HomeAction>(() => {
    if (!cli?.found) return { label: 'Restore the Arduino toolchain', capabilityId: 'hardware-doctor', detail: 'Arduino CLI is unavailable, so programming cannot proceed.' };
    if (!selectedPort) return { label: 'Connect and select hardware', capabilityId: 'hardware-session', detail: 'Choose the physical board and profile that the rest of the workflow will share.' };
    if (!programmed) return { label: 'Prepare or upload firmware', capabilityId: 'program-firmware', detail: 'Hardware is selected; establish the firmware state before acquisition.' };
    if (liveSerial) return { label: 'Save the live run as evidence', capabilityId: 'measurement-evidence', detail: 'Live data is flowing but is not yet durable evidence.' };
    if (!monitored) return { label: 'Start Monitor & Data', capabilityId: 'monitor-live', detail: 'Firmware is established; begin acquisition from the selected board.' };
    if (!evidenceSaved) return { label: 'Save the captured measurement', capabilityId: 'measurement-evidence', detail: 'Convert captured data into traceable evidence with provenance.' };
    if (!analyzed) return { label: 'Analyze or compare the evidence', capabilityId: 'analysis-evidence', detail: 'Evidence exists and is ready for statistical, model, or comparison work.' };
    return { label: 'Start the next experiment', capabilityId: 'experiments-campaigns', detail: 'The current chain has evidence and analysis; continue into an Engineering Lab campaign.' };
  }, [cli?.found, selectedPort, programmed, liveSerial, monitored, evidenceSaved, analyzed]);

  const workflowRecoveryAction = useMemo<HomeAction | null>(() => {
    if (!cli?.found || diagnosis.code === 'ready') return null;
    return {
      label: 'Open Hardware Doctor',
      capabilityId: 'hardware-doctor',
      detail: diagnosis.action,
    };
  }, [cli?.found, diagnosis.code, diagnosis.action]);

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

  const activeTaskSummary: CurrentTaskSummary = latestRunning ? {
    title: latestRunning.title,
    detail: latestRunning.detail,
    state: 'running',
  } : null;

  const currentWorkItems = useMemo<CurrentWorkItem[]>(() => {
    const items: CurrentWorkItem[] = [];
    if (latestRunning) items.push({
      id: `running-${latestRunning.id}`,
      label: latestRunning.title,
      detail: latestRunning.detail,
      status: 'active',
      capabilityId: capabilityForTask(latestRunning),
    });
    if (lastProgram && lastProgram.id !== latestRunning?.id) items.push({
      id: `program-${lastProgram.id}`,
      label: 'Latest program result',
      detail: `${lastProgram.title} · ${lastProgram.detail}`,
      status: 'ready',
      capabilityId: 'program-firmware',
    });
    if (evidenceSource) items.push({
      id: 'current-evidence',
      label: 'Current evidence',
      detail: evidenceSource.label,
      status: 'ready',
      capabilityId: 'analysis-evidence',
    });
    if (latestFailed && latestFailed.id !== latestRunning?.id) items.push({
      id: `failure-${latestFailed.id}`,
      label: 'Latest unresolved failure',
      detail: `${latestFailed.title} · ${latestFailed.detail}`,
      status: 'failed',
      capabilityId: 'task-center',
    });
    return items.slice(0, 4);
  }, [latestRunning, lastProgram, evidenceSource, latestFailed]);

  const openPenguinContext = useMemo(() => [
    `Workspace: ${workspace}`,
    `Arduino CLI: ${cli?.found ? 'ready' : 'unavailable'}`,
    `Board profile: ${fqbn}`,
    `Hardware: ${selectedPort ? `${activePort?.board_name || 'Board'} · ${selectedPort}` : 'none selected'}`,
    `Acquisition: ${liveSerial ? 'LIVE' : 'idle'}`,
    `Running tasks: ${runningTasks.length}`,
    `Current status: ${latestRunning?.detail || hardwareStatus}`,
    `Recommended next action: ${workflowNextAction.label}`,
  ].join('\n'), [workspace, cli?.found, fqbn, selectedPort, activePort?.board_name, liveSerial, runningTasks.length, latestRunning?.detail, hardwareStatus, workflowNextAction.label]);

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
      <button className={`bb-tools-launch ${allToolsOpen ? 'active' : ''}`} onClick={() => setAllToolsOpen(value => !value)} aria-pressed={allToolsOpen} title="Browse every desktop-reachable BetterBoard capability"><LayoutGrid size={15}/><span><b>All Tools</b><small>search every capability</small></span></button>
      <button data-capability-anchor="focus-mode" className={`bb-focus-launch ${focusMode ? 'active' : ''}`} onClick={() => setFocusMode(value => !value)} aria-pressed={focusMode} title="Focus mode keeps critical status visible while hiding secondary navigation"><Focus size={15}/><span><b>{focusMode ? 'Exit focus' : 'Focus mode'}</b><small>{focusMode ? 'Esc to exit' : 'presentation / experiment'}</small></span></button>
      <button data-capability-anchor="openguin" className={`bb-ai-launch ${aiOpen ? 'active' : ''}`} onClick={() => setAiOpen(value => !value)} aria-pressed={aiOpen} title="Open OpenPenguin local AI bridge · ⌘/Ctrl+K"><Bot size={16}/><span><b>OpenPenguin</b><small>local AI · ⌘/Ctrl+K</small></span></button>
      <div className={`bb-local-state ${selectedPort ? 'connected' : 'disconnected'}`} title={hardwareStatus}><i/><span><b>{selectedPort ? (activePort?.board_name || 'Board') : 'No board'}</b><small>{selectedPort || 'select hardware in Studio'}</small></span></div>
    </header>

    <div className="bb-context-strip" aria-label="Global BetterBoard runtime context">
      <span><i className={cli?.found ? 'good' : 'warn'}/><b>CLI</b>{cli?.found ? 'Ready' : 'Unavailable'}</span>
      <span><b>Profile</b>{fqbn}</span>
      <span><b>Hardware</b>{selectedPort ? `${activePort?.board_name || 'Board'} · ${selectedPort}` : 'No board selected'}</span>
      <span className={liveSerial ? 'live' : ''}><b>Acquisition</b>{liveSerial ? 'LIVE' : 'Idle'}</span>
      <span><b>Tasks</b>{runningTasks.length ? `${runningTasks.length} running` : 'Background idle'}</span>
      <span className="bb-context-current"><b>Current</b>{latestRunning?.detail || hardwareStatus}</span>
    </div>

    {workspace === 'studio' && <div className="bb-engineering-overview">
      <EngineeringCommandSurface
        nodes={statusNodes}
        nextAction={workflowNextAction}
        recoveryAction={workflowRecoveryAction}
        boardLabel={selectedPort ? (activePort?.board_name || 'Connected board') : 'No board selected'}
        portLabel={selectedPort || 'No serial port'}
        profileLabel={fqbn}
        activeTask={activeTaskSummary}
        onOpenCapability={openCapability}
      />
      <div data-capability-anchor="hardware-topology"><HardwareTopology toolchainReady={Boolean(cli?.found)} selectedPort={selectedPort} activePort={activePort} selectedFqbn={fqbn} profiles={profiles} diagnosis={diagnosis} requiredLibraries={null} missingLibraries={null} firmwareLabel={lastProgram?.title ?? null} firmwareReady={Boolean(lastProgram)}/></div>
    </div>}

    {workspace === 'studio' && <EngineeringFlowLauncher onOpenCapability={openCapability} />}
    {workspace === 'studio' && <CurrentWorkSummary items={currentWorkItems} onOpenCapability={openCapability} />}
    {workspace === 'studio' && <AdvancedCapabilityLauncher onOpenCapability={openCapability} />}

    <button type="button" aria-label="Close All Tools" className="bb-tools-backdrop" hidden={!allToolsOpen} onClick={() => setAllToolsOpen(false)} />
    <aside className="bb-tools-drawer" hidden={!allToolsOpen} aria-label="All Tools capability navigator">
      <CapabilityNavigator onClose={() => setAllToolsOpen(false)} />
    </aside>

    <div className="bb-ai-drawer-backdrop" hidden={!aiOpen} onClick={() => setAiOpen(false)} />
    <aside className="bb-ai-drawer" hidden={!aiOpen} aria-label="OpenPenguin local AI bridge">
      <div className="bb-ai-drawer-head"><span><Bot size={17}/><b>OpenPenguin · Local AI</b></span><button className="ghost mini" onClick={() => setAiOpen(false)}><X size={13}/> Close</button></div>
      <OpenPenguinBridge context={openPenguinContext} />
    </aside>

    <div className="bb-workspace-frame">
      <div className="bb-workspace-pane" hidden={workspace !== 'studio'}><App /><AnalysisVisualizationHub /></div>
      <div className="bb-workspace-pane" hidden={workspace !== 'observatory'}><ObservatoryMissionControl /><ObservatoryVisualSummary /><Observatory /></div>
      <div className="bb-workspace-pane" hidden={workspace !== 'experiments'}><ExperimentsHub /></div>
    </div>
  </div>;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><HardwareSessionProvider><EvidenceVisualizationProvider><RunComparisonProvider><EngineeringAnnotationsProvider><Root /></EngineeringAnnotationsProvider></RunComparisonProvider></EvidenceVisualizationProvider></HardwareSessionProvider></React.StrictMode>,
);
