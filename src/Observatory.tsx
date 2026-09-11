import { useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  Activity, Bot, CircleAlert, Clock3, Cpu, Database, Gauge, HardDrive,
  Layers3, RadioTower, RefreshCw, ShieldCheck, TerminalSquare, Waves,
} from 'lucide-react';
import { useHardwareSession } from './HardwareSession';
import type { BackgroundTask } from './TaskCenter';
import CopyButton from './CopyButton';

type CliInfo = { found: boolean; path?: string; version?: string; error?: string };
type RecipeSpec = { id: string; title: string; category: string; user_defined?: boolean; hardware: string[]; parameters?: unknown[] };
type DeviceSpec = { id: string; name: string; interface: string; status: string; quantities: string[] };
type OpenPenguinStatus = { found: boolean; endpoint: string; models: string[]; error?: string | null };
type MeasurementSessionSummary = {
  directory: string; created_at_utc: string; recipe_id: string; recipe_title: string;
  acquisition_mode: string; board_profile: string; port: string; sample_count: number;
  csv_path: string; metadata_path: string; physical_lab_csv_path: string; physical_lab_bridge_path: string;
};
type MeasurementReplay = {
  session: MeasurementSessionSummary; columns: string[]; units: string[]; primary_column?: string | null;
  sample_rate_hz?: number | null; rows: Array<{ host_timestamp_ms: number; line: string; numeric: boolean }>;
};

const TASK_MEMORY_KEY = 'betterboard.task-center.v1';
function readTaskMemory(): BackgroundTask[] {
  if (typeof localStorage === 'undefined') return [];
  try { const parsed = JSON.parse(localStorage.getItem(TASK_MEMORY_KEY) || '[]') as BackgroundTask[]; return Array.isArray(parsed) ? parsed.slice(0, 80) : []; }
  catch { return []; }
}
function inferredRxRows(tasks: BackgroundTask[]) {
  for (const task of tasks) for (const line of [task.detail, ...(task.logs ?? [])].reverse()) {
    const match = line.match(/([0-9,]+) RX rows observed/i); if (match) return Number(match[1].replace(/,/g, ''));
  }
  return null;
}
function latestNumericStats(replay: MeasurementReplay | null) {
  if (!replay?.rows?.length) return null;
  const numeric = replay.rows.filter(row => row.numeric);
  if (!numeric.length) return null;
  const firstT = numeric[0].host_timestamp_ms, lastT = numeric[numeric.length - 1].host_timestamp_ms;
  const durationS = Math.max((lastT - firstT) / 1000, 0);
  const observedHz = durationS > 0 && numeric.length > 1 ? (numeric.length - 1) / durationS : null;
  const declaredPrimary = replay.primary_column ? replay.columns.indexOf(replay.primary_column) : -1;
  const primary = declaredPrimary >= 0 ? declaredPrimary : Math.max(replay.columns.length - 1, 0);
  let min: number | null = null;
  let max: number | null = null;
  let last: number | null = null;
  for (const row of numeric) {
    const value = Number(row.line.split(',')[primary]?.trim());
    if (!Number.isFinite(value)) continue;
    min = min === null ? value : Math.min(min, value);
    max = max === null ? value : Math.max(max, value);
    last = value;
  }
  return { durationS, observedHz, min, max, last, numericRows: numeric.length, primary: replay.columns[primary] || `channel_${primary+1}`, unit: replay.units[primary] || '' };
}

export default function Observatory() {
  const { selectedPort, activePort, fqbn, hardwareStatus, refreshing, refreshHardware } = useHardwareSession();
  const [cli, setCli] = useState<CliInfo | null>(null);
  const [sessions, setSessions] = useState<MeasurementSessionSummary[]>([]);
  const [recipes, setRecipes] = useState<RecipeSpec[]>([]);
  const [devices, setDevices] = useState<DeviceSpec[]>([]);
  const [ai, setAi] = useState<OpenPenguinStatus | null>(null);
  const [latestReplay, setLatestReplay] = useState<MeasurementReplay | null>(null);
  const [tasks, setTasks] = useState<BackgroundTask[]>(readTaskMemory);
  const [lastRefresh, setLastRefresh] = useState(Date.now());
  const [refreshingRuntime, setRefreshingRuntime] = useState(false);
  const [runtimeErrors, setRuntimeErrors] = useState<string[]>([]);

  async function refreshRuntime() {
    setRefreshingRuntime(true);
    const errors: string[] = [];
    try {
      const [cliResult, sessionsResult, recipesResult, devicesResult, aiResult] = await Promise.allSettled([
        invoke<CliInfo>('arduino_cli_discovery'),
        invoke<MeasurementSessionSummary[]>('measurement_sessions', { limit: 24 }),
        invoke<RecipeSpec[]>('recipe_catalog'),
        invoke<DeviceSpec[]>('device_catalog'),
        invoke<OpenPenguinStatus>('openguin_probe'),
      ]);

      if (cliResult.status === 'fulfilled') setCli(cliResult.value);
      else {
        setCli({ found: false, error: String(cliResult.reason) });
        errors.push('Arduino CLI discovery');
      }

      if (recipesResult.status === 'fulfilled') setRecipes(recipesResult.value);
      else {
        setRecipes([]);
        errors.push('recipe catalog');
      }

      if (devicesResult.status === 'fulfilled') setDevices(devicesResult.value);
      else {
        setDevices([]);
        errors.push('device catalog');
      }

      if (aiResult.status === 'fulfilled') setAi(aiResult.value);
      else {
        setAi({ found: false, endpoint: 'runtime optional / not connected', models: [], error: String(aiResult.reason) });
        errors.push('OpenPenguin probe');
      }

      if (sessionsResult.status === 'fulfilled') {
        const measurementSessions = sessionsResult.value;
        setSessions(measurementSessions);
        if (measurementSessions[0]) {
          try {
            setLatestReplay(await invoke<MeasurementReplay>('measurement_session_load', { directory: measurementSessions[0].directory }));
          } catch {
            setLatestReplay(null);
            errors.push('latest measurement replay');
          }
        } else setLatestReplay(null);
      } else {
        setSessions([]);
        setLatestReplay(null);
        errors.push('measurement history');
      }

      setRuntimeErrors(errors);
    } finally {
      setTasks(readTaskMemory());
      setLastRefresh(Date.now());
      setRefreshingRuntime(false);
    }
  }

  useEffect(() => {
    void refreshRuntime();
    const fast = window.setInterval(() => { setTasks(readTaskMemory()); }, 1500);
    const slow = window.setInterval(() => void refreshRuntime(), 7000);
    return () => { window.clearInterval(fast); window.clearInterval(slow); };
  }, []);

  const runningTasks = useMemo(() => tasks.filter(task => task.state === 'running'), [tasks]);
  const failedTasks = useMemo(() => tasks.filter(task => task.state === 'failed'), [tasks]);
  const liveTask = useMemo(() => runningTasks.find(task => task.category === 'Monitor' && /live serial/i.test(task.title)), [runningTasks]);
  const rxRows = inferredRxRows(tasks);
  const latestSession = sessions[0];
  const stats = latestNumericStats(latestReplay);
  const totalSamples = sessions.reduce((sum, s) => sum + s.sample_count, 0);
  const userRecipes = recipes.filter(r => r.user_defined).length;
  const warnings = [
    runtimeErrors.length ? `Observatory could not refresh: ${runtimeErrors.join(', ')}.` : null,
    !selectedPort ? 'No hardware board is selected.' : null,
    !cli?.found ? 'Arduino CLI is unavailable.' : null,
    failedTasks.length ? `${failedTasks.length} failed background task(s) are retained in Task Center history.` : null,
    !latestSession ? 'No Measurement Evidence package has been saved yet.' : null,
    ai && !ai.found ? 'OpenPenguin local runtime is not currently reachable.' : null,
  ].filter(Boolean) as string[];

  return <div className="observatory-workspace">
    <section className="observatory-hero">
      <div><div className="eyebrow">System Observatory</div><h1>Observe the whole BetterBoard system.</h1><p>Read-mostly operational observability across hardware, firmware/toolchain, live acquisition, data quality, evidence, tasks, recipe/device inventory, Engineering Lab bridge readiness and local AI.</p></div>
      <button className="ghost" disabled={refreshingRuntime || refreshing} onClick={() => { void refreshHardware(); void refreshRuntime(); }}><RefreshCw size={15}/> Refresh all observations</button>
    </section>

    <section className="observatory-kpis">
      <div className="runtime-kpi"><Cpu size={17}/><span>Board</span><b>{activePort?.board_name || (selectedPort ? 'Connected board' : 'No board')}</b><small>{selectedPort || hardwareStatus}</small></div>
      <div className="runtime-kpi"><RadioTower size={17}/><span>Acquisition</span><b>{liveTask ? 'LIVE' : 'Idle'}</b><small>{rxRows === null ? liveTask?.detail || 'No live serial task' : `${rxRows.toLocaleString()} RX rows observed`}</small></div>
      <div className="runtime-kpi"><Database size={17}/><span>Evidence</span><b>{sessions.length} session(s)</b><small>{totalSamples.toLocaleString()} saved samples</small></div>
      <div className="runtime-kpi"><Bot size={17}/><span>OpenPenguin</span><b>{ai?.found ? 'Local AI ready' : 'Not connected'}</b><small>{ai?.found ? `${ai.models.length} model(s)` : ai?.endpoint || '127.0.0.1:11435'}</small></div>
    </section>

    {warnings.length > 0 && <section className="panel observatory-alerts"><div className="panel-title"><CircleAlert size={18}/> Attention</div>{warnings.map(item => <div key={item} className="boundary compact"><CircleAlert size={14}/>{item}</div>)}</section>}

    <section className="observatory-grid">
      <div className="panel observatory-panel"><div className="panel-title"><Gauge size={18}/> Hardware & toolchain</div><div className="observatory-facts">
        <span>Hardware state</span><b>{hardwareStatus}</b><span>Serial port</span><b>{selectedPort || '—'}</b><span>Board profile</span><b>{fqbn}</b>
        <span>Arduino CLI</span><b>{cli?.found ? cli.version || 'ready' : cli?.error || 'unavailable'}</b><span>CLI path</span><b>{cli?.path || '—'}</b>
        <span>Runtime snapshot</span><b>{new Date(lastRefresh).toLocaleTimeString([], { hour12: false })}</b>
      </div></div>

      <div className="panel observatory-panel"><div className="panel-title"><Layers3 size={18}/> Recipe & device inventory</div><div className="observatory-facts">
        <span>Recipes available</span><b>{recipes.length}</b><span>My Library recipes</span><b>{userRecipes}</b><span>Device definitions</span><b>{devices.length}</b>
        <span>Ready/known devices</span><b>{devices.filter(d => /ready|supported|known/i.test(d.status)).length}</b>
      </div><div className="observatory-mini-list">{devices.slice(0,6).map(d => <span key={d.id}><b>{d.name}</b><small>{d.interface} · {d.status}</small></span>)}</div></div>

      <div className="panel observatory-panel wide"><div className="panel-title"><Waves size={18}/> Latest data observation</div>
        {!latestSession ? <div className="empty compact">No saved measurement session yet.</div> : <>
          <div className="observatory-facts four"><span>Recipe</span><b>{latestSession.recipe_title}</b><span>Rows</span><b>{latestSession.sample_count.toLocaleString()}</b><span>Channels</span><b>{latestReplay?.columns.length ?? '—'}</b><span>Declared rate</span><b>{latestReplay?.sample_rate_hz ? `${latestReplay.sample_rate_hz} Hz` : '—'}</b>
          {stats && <><span>Observed rate</span><b>{stats.observedHz ? `${stats.observedHz.toFixed(3)} Hz` : '—'}</b><span>Duration</span><b>{stats.durationS.toFixed(3)} s</b><span>Primary</span><b>{stats.primary}</b><span>Latest</span><b>{stats.last === null ? '—' : `${stats.last.toFixed(5)} ${stats.unit}`}</b><span>Min / max</span><b>{stats.min === null ? '—' : `${stats.min.toFixed(5)} / ${stats.max?.toFixed(5)} ${stats.unit}`}</b><span>Numeric rows</span><b>{stats.numericRows}</b></>}
          </div>
          <div className="action-row"><CopyButton text={latestReplay?.rows.map(row => row.line).join('\n') || ''} label="Copy latest data"/><CopyButton text={latestSession.csv_path} label="Copy CSV path"/><CopyButton text={latestSession.physical_lab_bridge_path} label="Copy bridge path"/></div>
        </>}
      </div>

      <div className="panel observatory-panel"><div className="panel-title"><Activity size={18}/> Live acquisition</div>
        {liveTask ? <div className="runtime-live-card"><div className="live-badge live"><span/><b>LIVE</b></div><b>{liveTask.title}</b><p>{liveTask.detail}</p><small>{rxRows === null ? 'Waiting for the next row-count report.' : `${rxRows.toLocaleString()} RX rows observed by Task Center`}</small></div> : <div className="empty">No live serial acquisition is running.</div>}
        <div className="boundary compact"><Activity size={14}/> Live counts show runtime activity, not calibration or physical truth.</div>
      </div>

      <div className="panel observatory-panel"><div className="panel-title"><ShieldCheck size={18}/> Engineering Lab bridge readiness</div>
        {latestSession ? <div className="observatory-facts"><span>Physical Lab CSV</span><b>{latestSession.physical_lab_csv_path ? 'ready' : 'missing'}</b><span>Bridge manifest</span><b>{latestSession.physical_lab_bridge_path ? 'ready' : 'missing'}</b><span>Workflow</span><b>BetterBoard measurement → Engineering Lab independent validation</b></div> : <div className="empty compact">Record Measurement Evidence first; Experiments can then hand the package into Engineering Lab workflows.</div>}
      </div>

      <div className="panel observatory-panel wide"><div className="panel-title"><TerminalSquare size={18}/> Background operations</div>
        {!tasks.length ? <div className="empty compact">No Task Center history yet.</div> : <div className="observatory-task-list">{tasks.slice(0,12).map(task => <div className={`observatory-task ${task.state}`} key={task.id}><span>{task.category}</span><b>{task.title}</b><small>{task.detail}</small><time>{new Date(task.startedAt).toLocaleTimeString([], { hour12: false })}</time></div>)}</div>}
      </div>

      <div className="panel observatory-panel wide"><div className="panel-title"><Clock3 size={18}/> Recent measurement evidence</div>
        {!sessions.length ? <div className="empty compact">No saved Measurement Sessions yet.</div> : <div className="observatory-session-list">{sessions.slice(0,10).map(session => <div key={session.directory}><span>{session.recipe_title}</span><b>{session.sample_count.toLocaleString()} samples</b><small>{new Date(session.created_at_utc).toLocaleString()} · {session.acquisition_mode}</small></div>)}</div>}
      </div>

      <div className="panel observatory-panel wide"><div className="panel-title"><HardDrive size={18}/> Scientific boundaries</div><div className="boundary"><CircleAlert size={14}/> Measurement error, numerical error and model error remain separate questions. Observatory reports evidence and operational state; it does not turn a connected sensor, a clean graph, or a matching model into a calibration/validation claim.</div></div>
    </section>
  </div>;
}
