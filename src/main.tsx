import React, { useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { invoke } from '@tauri-apps/api/core';
import { BookOpen, Bot, CircuitBoard, FlaskConical, RadioTower, X } from 'lucide-react';
import App from './App';
import ExperimentsHub from './ExperimentsHub';
import Observatory from './Observatory';
import LearningHub from './LearningHub';
import OpenPenguinBridge from './OpenPenguinBridge';
import { HardwareSessionProvider, useHardwareSession } from './HardwareSession';
import type { BackgroundTask } from './TaskCenter';
import './styles.css';
import './visual-system.css';
import './monitor-data.css';
import './workspace-shell.css';
import './developer-task.css';
import './copy-ai.css';

type Workspace = 'studio' | 'observatory' | 'experiments' | 'learning';
type ExperimentDomain = 'numerical' | 'magnet';
type CliInfo = { found: boolean; path?: string; version?: string; error?: string };

const TASK_MEMORY_KEY = 'betterboard.task-center.v1';

const WORKSPACES: Array<{
  id: Workspace;
  label: string;
  subtitle: string;
  icon: typeof CircuitBoard;
}> = [
  { id: 'studio', label: 'Studio', subtitle: 'build · upload · monitor · record', icon: CircuitBoard },
  { id: 'observatory', label: 'Observatory', subtitle: 'runtime · evidence · system state', icon: RadioTower },
  { id: 'experiments', label: 'Experiments', subtitle: 'acquire · analyze · compare', icon: FlaskConical },
  { id: 'learning', label: 'Learning', subtitle: 'concepts · guided labs · equations', icon: BookOpen },
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

function Root() {
  const [workspace, setWorkspace] = useState<Workspace>('studio');
  const [experimentDomain, setExperimentDomain] = useState<ExperimentDomain>('numerical');
  const [cli, setCli] = useState<CliInfo | null>(null);
  const [tasks, setTasks] = useState<BackgroundTask[]>(readTaskMemory);
  const [aiOpen, setAiOpen] = useState(false);
  const { selectedPort, activePort, hardwareStatus, fqbn } = useHardwareSession();

  useEffect(() => {
    void invoke<CliInfo>('arduino_cli_discovery').then(setCli).catch(() => setCli({ found: false }));
    const timer = window.setInterval(() => setTasks(readTaskMemory()), 1200);
    return () => window.clearInterval(timer);
  }, []);

  const runningTasks = useMemo(() => tasks.filter(task => task.state === 'running'), [tasks]);
  const latestRunning = runningTasks[0];
  const liveSerial = runningTasks.find(task => task.category === 'Monitor' && /live serial/i.test(task.title));
  const openPenguinContext = useMemo(() => [
    `Workspace: ${workspace}`,
    `Arduino CLI: ${cli?.found ? 'ready' : 'unavailable'}`,
    `Board profile: ${fqbn}`,
    `Hardware: ${selectedPort ? `${activePort?.board_name || 'Board'} · ${selectedPort}` : 'none selected'}`,
    `Acquisition: ${liveSerial ? 'LIVE' : 'idle'}`,
    `Running tasks: ${runningTasks.length}`,
    `Current status: ${latestRunning?.detail || hardwareStatus}`,
  ].join('\n'), [workspace, cli?.found, fqbn, selectedPort, activePort?.board_name, liveSerial, runningTasks.length, latestRunning?.detail, hardwareStatus]);

  function openExperiment(domain: ExperimentDomain) {
    setExperimentDomain(domain);
    setWorkspace('experiments');
  }

  return <div className="bb-root">
    <header className="bb-command-bar rich">
      <div className="bb-command-brand">
        <span className="bb-command-mark">B</span>
        <span><b>BetterBoard</b><small>physical computing studio</small></span>
      </div>

      <nav className="bb-workspace-tabs" aria-label="BetterBoard workspaces">
        {WORKSPACES.map(item => {
          const Icon = item.icon;
          return <button
            key={item.id}
            className={`bb-workspace-tab ${workspace === item.id ? 'active' : ''}`}
            onClick={() => setWorkspace(item.id)}
            aria-pressed={workspace === item.id}
          >
            <span className="bb-workspace-icon"><Icon size={15}/></span>
            <span><b>{item.label}</b><small>{item.subtitle}</small></span>
          </button>;
        })}
      </nav>

      <button className={`bb-ai-launch ${aiOpen ? 'active' : ''}`} onClick={() => setAiOpen(value => !value)} aria-pressed={aiOpen} title="Open OpenPenguin local AI bridge"><Bot size={16}/><span><b>OpenPenguin</b><small>local AI bridge</small></span></button>

      <div className={`bb-local-state ${selectedPort ? 'connected' : 'disconnected'}`} title={hardwareStatus}>
        <i/>
        <span><b>{selectedPort ? (activePort?.board_name || 'Board') : 'No board'}</b><small>{selectedPort || 'select hardware in Studio'}</small></span>
      </div>
    </header>

    <div className="bb-context-strip" aria-label="Global BetterBoard runtime context">
      <span><i className={cli?.found ? 'good' : 'warn'}/><b>CLI</b>{cli?.found ? 'Ready' : 'Unavailable'}</span>
      <span><b>Profile</b>{fqbn}</span>
      <span><b>Hardware</b>{selectedPort ? `${activePort?.board_name || 'Board'} · ${selectedPort}` : 'No board selected'}</span>
      <span className={liveSerial ? 'live' : ''}><b>Acquisition</b>{liveSerial ? 'LIVE' : 'Idle'}</span>
      <span><b>Tasks</b>{runningTasks.length ? `${runningTasks.length} running` : 'Background idle'}</span>
      <span className="bb-context-current"><b>Current</b>{latestRunning?.detail || hardwareStatus}</span>
    </div>

    <div className="bb-ai-drawer-backdrop" hidden={!aiOpen} onClick={() => setAiOpen(false)} />
    <aside className="bb-ai-drawer" hidden={!aiOpen} aria-label="OpenPenguin local AI bridge">
      <div className="bb-ai-drawer-head"><span><Bot size={17}/><b>OpenPenguin · Local AI</b></span><button className="ghost mini" onClick={() => setAiOpen(false)}><X size={13}/> Close</button></div>
      <OpenPenguinBridge context={openPenguinContext} />
    </aside>

    <div className="bb-workspace-frame">
      <div className="bb-workspace-pane" hidden={workspace !== 'studio'}><App /></div>
      <div className="bb-workspace-pane" hidden={workspace !== 'observatory'}><Observatory /></div>
      <div className="bb-workspace-pane" hidden={workspace !== 'experiments'}><ExperimentsHub initialDomain={experimentDomain} /></div>
      <div className="bb-workspace-pane" hidden={workspace !== 'learning'}><LearningHub onOpenExperiment={openExperiment} /></div>
    </div>
  </div>;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HardwareSessionProvider>
      <Root />
    </HardwareSessionProvider>
  </React.StrictMode>,
);
