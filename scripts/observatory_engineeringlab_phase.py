#!/usr/bin/env python3
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]

def read(path): return (ROOT/path).read_text()
def write(path, text): (ROOT/path).write_text(text)

# main.tsx: remove Learning workspace and imports, simplify type and panes.
p = Path('src/main.tsx'); s = read(p)
s = s.replace("import { BookOpen, CircuitBoard, FlaskConical, RadioTower } from 'lucide-react';", "import { CircuitBoard, FlaskConical, RadioTower } from 'lucide-react';")
s = s.replace("import LearningHub from './LearningHub';\n", "")
s = s.replace("type Workspace = 'studio' | 'observatory' | 'experiments' | 'learning';", "type Workspace = 'studio' | 'observatory' | 'experiments';")
s = s.replace("type ExperimentDomain = 'numerical' | 'magnet';\n", "")
s = s.replace("  { id: 'learning', label: 'Learning', subtitle: 'concepts · guided labs · equations', icon: BookOpen },\n", "")
s = s.replace("  const [experimentDomain, setExperimentDomain] = useState<ExperimentDomain>('numerical');\n", "")
s = s.replace("\n  function openExperiment(domain: ExperimentDomain) {\n    setExperimentDomain(domain);\n    setWorkspace('experiments');\n  }\n", "\n")
s = s.replace("      <div className=\"bb-workspace-pane\" hidden={workspace !== 'experiments'}><ExperimentsHub initialDomain={experimentDomain} /></div>\n      <div className=\"bb-workspace-pane\" hidden={workspace !== 'learning'}><LearningHub onOpenExperiment={openExperiment} /></div>", "      <div className=\"bb-workspace-pane\" hidden={workspace !== 'experiments'}><ExperimentsHub /></div>")
write(p,s)

# Observatory becomes broader operational observability.
obs = r'''import { useEffect, useMemo, useState } from 'react';
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
  const primary = replay.primary_column ? replay.columns.indexOf(replay.primary_column) : Math.max(replay.columns.length - 1, 0);
  const values = numeric.map(row => Number(row.line.split(',')[primary]?.trim())).filter(Number.isFinite);
  const min = values.length ? Math.min(...values) : null, max = values.length ? Math.max(...values) : null;
  const last = values.length ? values[values.length - 1] : null;
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

  async function refreshRuntime() {
    setRefreshingRuntime(true);
    try {
      const [cliInfo, measurementSessions, recipeList, deviceList, aiStatus] = await Promise.all([
        invoke<CliInfo>('arduino_cli_discovery'), invoke<MeasurementSessionSummary[]>('measurement_sessions', { limit: 24 }),
        invoke<RecipeSpec[]>('recipe_catalog'), invoke<DeviceSpec[]>('device_catalog'), invoke<OpenPenguinStatus>('openguin_probe'),
      ]);
      setCli(cliInfo); setSessions(measurementSessions); setRecipes(recipeList); setDevices(deviceList); setAi(aiStatus);
      if (measurementSessions[0]) {
        try { setLatestReplay(await invoke<MeasurementReplay>('measurement_session_load', { directory: measurementSessions[0].directory })); }
        catch { setLatestReplay(null); }
      } else setLatestReplay(null);
    } catch { /* keep last known values */ }
    setTasks(readTaskMemory()); setLastRefresh(Date.now()); setRefreshingRuntime(false);
  }

  useEffect(() => {
    void refreshRuntime();
    const fast = window.setInterval(() => { setTasks(readTaskMemory()); setLastRefresh(Date.now()); }, 1500);
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
'''
write(Path('src/Observatory.tsx'), obs)

# Experiments now dedicated to Engineering Lab bridge, retaining old labs only as folded bridge tools.
exp = r'''import { useMemo, useState } from 'react';
import { ArrowRight, Database, FileCheck2, FlaskConical, Magnet, Sigma, UploadCloud } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import NumericalBenchSuiteV2 from './NumericalBenchSuiteV2';
import MagnetBenchSuiteV2 from './MagnetBenchSuiteV2';
import CopyButton from './CopyButton';

type MeasurementSessionSummary = { directory:string; created_at_utc:string; recipe_title:string; sample_count:number; csv_path:string; metadata_path:string; physical_lab_csv_path:string; physical_lab_bridge_path:string };
const ENGINEERING_MODELS = [
  { title:'Numerical Error Analysis', detail:'Taylor evaluation · cancellation · floating-point reliability · convergence', icon:Sigma, bridge:'Use BetterBoard numerical firmware/measurement evidence as real-MCU evidence beside Engineering Lab reference and convergence campaigns.' },
  { title:'Oscillation & Numerical Integration', detail:'Euler · symplectic · RK methods · energy/work checks', icon:FlaskConical, bridge:'Arduino timing/sensor evidence can enter Engineering Lab as measured dynamics and integration-validation evidence.' },
  { title:'RADIA Magnet Studio', detail:'3-D magnetic field · measured/model residual · trajectory', icon:Magnet, bridge:'BetterBoard Magnet acquisition/characterization/model residuals already have an independent Engineering Lab validation bridge.' },
];

export default function ExperimentsHub() {
  const [sessions, setSessions] = useState<MeasurementSessionSummary[]>([]);
  const [selected, setSelected] = useState<MeasurementSessionSummary | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [tool, setTool] = useState<'none'|'numerical'|'magnet'>('none');
  async function loadEvidence() {
    const list = await invoke<MeasurementSessionSummary[]>('measurement_sessions',{limit:50}); setSessions(list); setSelected(list[0] ?? null); setLoaded(true);
  }
  const exportText = useMemo(() => selected ? [
    'BetterBoard → Engineering Lab handoff', `Recipe: ${selected.recipe_title}`, `Samples: ${selected.sample_count}`,
    `data.csv: ${selected.csv_path}`, `metadata.json: ${selected.metadata_path}`, `physical_lab_v1.csv: ${selected.physical_lab_csv_path}`, `bridge: ${selected.physical_lab_bridge_path}`,
  ].join('\n') : '', [selected]);

  return <div className="experiments-hub">
    <section className="experiment-bridge-hero"><div><div className="eyebrow">Connect with Engineering Lab</div><h1>Turn Arduino measurements into Engineering Lab evidence.</h1><p>General Arduino learning, hardware recipes and reusable firmware belong in Studio → Recipe Library. Experiments is reserved for workflows that connect real BetterBoard acquisition to Engineering Lab computational models, validation and evidence.</p></div><button className="primary" onClick={() => void loadEvidence()}><Database size={15}/> Load BetterBoard evidence</button></section>

    <section className="engineering-model-grid">{ENGINEERING_MODELS.map(item => { const Icon=item.icon; return <article className="panel" key={item.title}><div className="panel-title"><Icon size={18}/>{item.title}</div><p>{item.detail}</p><div className="boundary compact">{item.bridge}</div></article>; })}</section>

    <section className="panel engineering-handoff">
      <div className="panel-title"><UploadCloud size={18}/> BetterBoard → Engineering Lab handoff</div>
      <p className="muted">Choose a saved Measurement Evidence package. BetterBoard preserves raw data, metadata and bridge files; Engineering Lab should independently recompute or validate rather than trusting BetterBoard's displayed summary.</p>
      {!loaded ? <div className="empty compact">Load evidence to browse recent BetterBoard sessions.</div> : !sessions.length ? <div className="empty compact">No saved measurement sessions yet.</div> : <>
        <select value={selected?.directory ?? ''} onChange={e => setSelected(sessions.find(s=>s.directory===e.target.value) ?? null)}>{sessions.map(s => <option key={s.directory} value={s.directory}>{s.recipe_title} · {s.sample_count} samples · {new Date(s.created_at_utc).toLocaleString()}</option>)}</select>
        {selected && <div className="measurement big"><b>{selected.recipe_title}</b><span>data.csv · {selected.csv_path}</span><span>metadata.json · {selected.metadata_path}</span><span>Physical Lab v1 · {selected.physical_lab_csv_path}</span><span>bridge · {selected.physical_lab_bridge_path}</span></div>}
        <div className="action-row"><CopyButton text={exportText} label="Copy handoff"/><CopyButton text={selected?.csv_path || ''} label="Copy data path"/><CopyButton text={selected?.physical_lab_bridge_path || ''} label="Copy bridge path"/></div>
      </>}
      <div className="boundary"><FileCheck2 size={14}/> A successful handoff means the files are available for Engineering Lab analysis. It does not mean the physical measurement or model has been validated.</div>
    </section>

    <section className="panel" style={{maxWidth:1420,margin:'14px auto 50px'}}><div className="panel-title"><ArrowRight size={18}/> Bridge tools</div><p className="muted">These are BetterBoard-side preparation tools for Engineering Lab workflows, not a second Recipe Library.</p><div className="action-row"><button className={tool==='numerical'?'primary':'ghost'} onClick={()=>setTool(tool==='numerical'?'none':'numerical')}><Sigma size={15}/> Numerical evidence preparation</button><button className={tool==='magnet'?'primary':'ghost'} onClick={()=>setTool(tool==='magnet'?'none':'magnet')}><Magnet size={15}/> Magnet evidence preparation</button></div><div hidden={tool!=='numerical'}><NumericalBenchSuiteV2/></div><div hidden={tool!=='magnet'}><MagnetBenchSuiteV2/></div></section>
  </div>;
}
'''
write(Path('src/ExperimentsHub.tsx'), exp)

# Remove LearningHub source from imports/contracts; keep file deletion for git rm in workflow.
# Add CSS for denser observatory/experiment bridge.
css = read(Path('src/workspace-shell.css'))
css += r'''
.observatory-alerts{max-width:1420px;margin:12px auto;padding:14px 34px}.observatory-mini-list{display:grid;gap:6px;margin-top:10px}.observatory-mini-list>span{display:flex;justify-content:space-between;gap:12px;padding:7px 8px;border-radius:8px;background:rgba(255,255,255,.025)}.observatory-mini-list small{color:#7f91a6}.observatory-facts.four{grid-template-columns:auto 1fr auto 1fr}.experiment-bridge-hero{max-width:1420px;margin:0 auto;padding:28px 34px 10px;display:flex;align-items:end;justify-content:space-between;gap:24px}.experiment-bridge-hero h1{margin:5px 0 8px}.engineering-model-grid{max-width:1420px;margin:0 auto;padding:10px 34px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.engineering-handoff{max-width:1420px;margin:12px auto;padding:18px 20px}.engineering-handoff select{width:100%;margin:8px 0 12px}@media(max-width:900px){.engineering-model-grid{grid-template-columns:1fr}.experiment-bridge-hero{align-items:stretch;flex-direction:column}.observatory-facts.four{grid-template-columns:auto 1fr}}
'''
write(Path('src/workspace-shell.css'), css)

# Update version to alpha.8 and changelog.
for path in ['package.json','src-tauri/tauri.conf.json']:
    p=Path(path); txt=read(p).replace('0.2.0-alpha.7','0.2.0-alpha.8'); write(p,txt)
p=Path('src-tauri/Cargo.toml'); write(p,read(p).replace('version = "0.2.0-alpha.7"','version = "0.2.0-alpha.8"'))
p=Path('src-tauri/Cargo.lock'); write(p,read(p).replace('version = "0.2.0-alpha.7"','version = "0.2.0-alpha.8"',1))
p=Path('src-tauri/src/lib.rs'); write(p,read(p).replace('const APP_VERSION: &str = "0.2.0-alpha.7";','const APP_VERSION: &str = "0.2.0-alpha.8";'))
p=Path('CHANGELOG.md'); write(p, '## 0.2.0-alpha.8\n- Deepen Observatory into whole-system operational/data/evidence observability.\n- Remove low-value Learning workspace from top-level IA.\n- Refocus Experiments on BetterBoard ↔ Engineering Lab evidence handoff and model-connected bridge tools.\n- Add copy controls for latest observed data and Engineering Lab handoff paths.\n\n'+read(p))

# Adapt self-check workspace contract from four to three and add new contracts.
p=Path('scripts/self_check.py'); sc=read(p)
sc=sc.replace("'studio', 'observatory', 'experiments', 'learning'", "'studio', 'observatory', 'experiments'")
sc=sc.replace('persistent Studio / Observatory / Experiments / Learning architecture registered','persistent Studio / Observatory / Experiments architecture registered')
sc += "\n# Alpha 0.8 observatory/Engineering Lab contracts\nmain=(ROOT/'src/main.tsx').read_text(); obs=(ROOT/'src/Observatory.tsx').read_text(); exp=(ROOT/'src/ExperimentsHub.tsx').read_text()\nassert \"id: 'learning'\" not in main\nfor token in ['System Observatory','Latest data observation','Engineering Lab bridge readiness','OpenPenguin','Recipe & device inventory']:\n    assert token in obs, f'Observatory lost {token}'\nfor token in ['Connect with Engineering Lab','BetterBoard → Engineering Lab handoff','Numerical evidence preparation','Magnet evidence preparation']:\n    assert token in exp, f'Engineering Lab Experiments lost {token}'\n"
write(p,sc)

print('Alpha 0.8 Observatory/Engineering Lab refocus applied')
