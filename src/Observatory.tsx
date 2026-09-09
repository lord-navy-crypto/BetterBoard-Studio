import { useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  Activity, Clock3, Cpu, Database, Gauge, RadioTower, RefreshCw,
  TerminalSquare, Waves,
} from 'lucide-react';
import { useHardwareSession } from './HardwareSession';
import type { BackgroundTask } from './TaskCenter';

type CliInfo = { found: boolean; path?: string; version?: string; error?: string };
type MeasurementSessionSummary = {
  directory: string;
  created_at_utc: string;
  recipe_id: string;
  recipe_title: string;
  acquisition_mode: string;
  board_profile: string;
  port: string;
  sample_count: number;
  csv_path: string;
  metadata_path: string;
  physical_lab_csv_path: string;
  physical_lab_bridge_path: string;
};

const TASK_MEMORY_KEY = 'betterboard.task-center.v1';

function readTaskMemory(): BackgroundTask[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(TASK_MEMORY_KEY) || '[]') as BackgroundTask[];
    return Array.isArray(parsed) ? parsed.slice(0, 40) : [];
  } catch {
    return [];
  }
}

function inferredRxRows(tasks: BackgroundTask[]) {
  for (const task of tasks) {
    const lines = [task.detail, ...(task.logs ?? [])].reverse();
    for (const line of lines) {
      const match = line.match(/([0-9,]+) RX rows observed/i);
      if (match) return Number(match[1].replace(/,/g, ''));
    }
  }
  return null;
}

export default function Observatory() {
  const { selectedPort, activePort, fqbn, hardwareStatus, refreshing, refreshHardware } = useHardwareSession();
  const [cli, setCli] = useState<CliInfo | null>(null);
  const [sessions, setSessions] = useState<MeasurementSessionSummary[]>([]);
  const [tasks, setTasks] = useState<BackgroundTask[]>(readTaskMemory);
  const [lastRefresh, setLastRefresh] = useState(Date.now());
  const [refreshingRuntime, setRefreshingRuntime] = useState(false);

  async function refreshRuntime() {
    setRefreshingRuntime(true);
    try {
      const [cliInfo, measurementSessions] = await Promise.all([
        invoke<CliInfo>('arduino_cli_discovery'),
        invoke<MeasurementSessionSummary[]>('measurement_sessions', { limit: 12 }),
      ]);
      setCli(cliInfo);
      setSessions(measurementSessions);
      setTasks(readTaskMemory());
      setLastRefresh(Date.now());
    } catch {
      setTasks(readTaskMemory());
      setLastRefresh(Date.now());
    } finally {
      setRefreshingRuntime(false);
    }
  }

  useEffect(() => {
    void refreshRuntime();
    const timer = window.setInterval(() => {
      setTasks(readTaskMemory());
      setLastRefresh(Date.now());
    }, 1500);
    const slowerTimer = window.setInterval(() => void refreshRuntime(), 7000);
    return () => {
      window.clearInterval(timer);
      window.clearInterval(slowerTimer);
    };
  }, []);

  const runningTasks = useMemo(() => tasks.filter(task => task.state === 'running'), [tasks]);
  const failedTasks = useMemo(() => tasks.filter(task => task.state === 'failed'), [tasks]);
  const liveTask = useMemo(() => runningTasks.find(task => task.category === 'Monitor' && /live serial/i.test(task.title)), [runningTasks]);
  const latestSession = sessions[0];
  const rxRows = inferredRxRows(tasks);

  return <div className="observatory-workspace">
    <section className="observatory-hero">
      <div>
        <div className="eyebrow">Live runtime observatory</div>
        <h1>See the whole system without changing it.</h1>
        <p>Observatory is read-mostly: hardware, toolchain, acquisition, evidence and background work in one operational view.</p>
      </div>
      <button className="ghost" disabled={refreshingRuntime || refreshing} onClick={() => { void refreshHardware(); void refreshRuntime(); }}><RefreshCw size={15}/> Refresh runtime</button>
    </section>

    <section className="observatory-kpis">
      <div className="runtime-kpi"><Cpu size={17}/><span>Board</span><b>{activePort?.board_name || (selectedPort ? 'Connected board' : 'No board')}</b><small>{selectedPort || hardwareStatus}</small></div>
      <div className="runtime-kpi"><TerminalSquare size={17}/><span>Toolchain</span><b>{cli?.found ? 'Arduino CLI ready' : 'CLI unavailable'}</b><small>{cli?.version || cli?.error || 'checking…'}</small></div>
      <div className="runtime-kpi"><RadioTower size={17}/><span>Acquisition</span><b>{liveTask ? 'LIVE' : 'Idle'}</b><small>{liveTask?.detail || 'No live serial task'}</small></div>
      <div className="runtime-kpi"><Database size={17}/><span>Evidence</span><b>{latestSession ? `${latestSession.sample_count} samples` : 'No package'}</b><small>{latestSession?.recipe_title || 'No saved measurement yet'}</small></div>
    </section>

    <section className="observatory-grid">
      <div className="panel observatory-panel">
        <div className="panel-title"><Gauge size={18}/> Hardware & runtime</div>
        <div className="observatory-facts">
          <span>Hardware state</span><b>{hardwareStatus}</b>
          <span>Serial port</span><b>{selectedPort || '—'}</b>
          <span>Board profile</span><b>{fqbn}</b>
          <span>Arduino CLI</span><b>{cli?.path || (cli?.found ? 'available' : '—')}</b>
          <span>Running tasks</span><b>{runningTasks.length}</b>
          <span>Failed tasks in memory</span><b>{failedTasks.length}</b>
          <span>Observed RX rows</span><b>{rxRows ?? '—'}</b>
          <span>Runtime snapshot</span><b>{new Date(lastRefresh).toLocaleTimeString([], { hour12: false })}</b>
        </div>
      </div>

      <div className="panel observatory-panel">
        <div className="panel-title"><Waves size={18}/> Acquisition state</div>
        {liveTask ? <div className="runtime-live-card">
          <div className="live-badge live"><span/><b>LIVE</b></div>
          <b>{liveTask.title}</b>
          <p>{liveTask.detail}</p>
          <small>{rxRows === null ? 'RX count updates when the monitor reports a batch.' : `${rxRows.toLocaleString()} RX rows observed by Task Center`}</small>
        </div> : <div className="empty">No live serial acquisition is running. Start Live from Studio → Monitor & Data and Observatory will reflect the persisted runtime task state.</div>}
        <div className="boundary compact"><Activity size={14}/> Observatory reads runtime evidence. It does not imply calibration, accuracy or model validity.</div>
      </div>

      <div className="panel observatory-panel wide">
        <div className="panel-title"><TerminalSquare size={18}/> Background operations</div>
        {!tasks.length ? <div className="empty compact">No Task Center history yet.</div> : <div className="observatory-task-list">
          {tasks.slice(0, 8).map(task => <div className={`observatory-task ${task.state}`} key={task.id}>
            <span>{task.category}</span>
            <b>{task.title}</b>
            <small>{task.detail}</small>
            <time>{new Date(task.startedAt).toLocaleTimeString([], { hour12: false })}</time>
          </div>)}
        </div>}
      </div>

      <div className="panel observatory-panel wide">
        <div className="panel-title"><Clock3 size={18}/> Recent measurement evidence</div>
        {!sessions.length ? <div className="empty compact">No saved Measurement Sessions yet.</div> : <div className="observatory-session-list">
          {sessions.slice(0, 6).map(session => <div key={session.directory}>
            <span>{session.recipe_title}</span>
            <b>{session.sample_count.toLocaleString()} samples</b>
            <small>{new Date(session.created_at_utc).toLocaleString()} · {session.acquisition_mode}</small>
          </div>)}
        </div>}
      </div>
    </section>
  </div>;
}
