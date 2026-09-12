import { useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  Activity, BookOpen, Bot, Boxes, Braces, Cable, CircleAlert, CircuitBoard, Code2,
  Cpu, Download, Gauge, Magnet, Play, RefreshCw, RotateCw,
  Save, Search, ShieldCheck, TerminalSquare, TimerReset, Upload, Waves, Wrench,
} from 'lucide-react';
import CircuitLab from './CircuitLab';
import DeveloperIDE from './DeveloperIDE';
import MonitorDataStudio from './MonitorDataStudio';
import TaskCenterPanel, { type BackgroundTask, type TaskCategory, type TaskState } from './TaskCenter';
import { useHardwareSession } from './HardwareSession';
import RecipeParameterPanel, { recipeParameterDefaults, type RecipeParameterSpec } from './RecipeParameterPanel';

type CliInfo = { found: boolean; path?: string; version?: string; error?: string };
type RecipeSpec = {
  id: string; title: string; category: string; description: string; sketch_name: string;
  capture_mode: 'none' | 'numeric' | 'text'; baud: number; columns: string[]; units: string[];
  primary_column?: string | null; sample_rate_hz?: number | null; required_libraries: string[];
  hardware: string[]; physical_lab_targets: string[]; notes: string[]; boundary: string;
  parameters?: RecipeParameterSpec[]; user_defined?: boolean; base_recipe_id?: string | null;
  parameter_values?: Record<string, string>;
};
type DeviceSpec = { id: string; name: string; interface: string; quantities: string[]; units: string[]; libraries: string[]; status: string };
type PreflightResult = { cli_ready: boolean; core: string; core_installed: boolean; required_libraries: string[]; missing_libraries: string[]; warnings: string[] };
type MeasurementResult = {
  directory: string; csv_path: string; metadata_path: string; physical_lab_csv_path: string;
  physical_lab_bridge_path: string; samples: number;
};
type BridgeDocs = { hardware_map: string; serial_protocol: string; honeycomb_guide: string };
type Tab = 'hardware' | 'circuit' | 'library' | 'data' | 'developer';

const TASK_MEMORY_KEY = 'betterboard.task-center.v1';

const iconFor = (id: string) => {
  if (id.includes('magnetic')) return Magnet;
  if (id.includes('acceleration')) return Activity;
  if (id.includes('photogate')) return TimerReset;
  if (id.includes('encoder') || id.includes('rpm')) return RotateCw;
  if (id.includes('robot')) return Bot;
  if (id.includes('i2c')) return Search;
  if (id.includes('analog')) return Gauge;
  if (id.includes('synthetic')) return Waves;
  return Play;
};

const libraryGroupFor = (recipe: RecipeSpec) => {
  if (recipe.user_defined) return 'My Library';
  if (recipe.id === 'blink' || recipe.id === 'i2c_scanner' || recipe.category === 'Verify' || recipe.category === 'Diagnose') return 'Verify & Diagnose';
  if (recipe.id.includes('numerical') || recipe.id === 'analog_a0' || recipe.id === 'synthetic') return 'Numerical & Measurement';
  if (recipe.id.includes('magnetic')) return 'Magnetism & Fields';
  if (recipe.id.includes('acceleration') || recipe.id.includes('photogate') || recipe.id.includes('encoder') || recipe.id.includes('rpm')) return 'Motion & Timing';
  if (recipe.id.includes('robot') || recipe.category === 'Control') return 'Control & Robotics';
  return 'Other';
};

function restoreTaskMemory(): BackgroundTask[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(TASK_MEMORY_KEY) || '[]') as BackgroundTask[];
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, 40).map(task => task.state === 'running'
      ? { ...task, state: 'failed', detail: 'Previous app session ended before this task reported completion.', finishedAt: Date.now(), cancellable: false, cancel: undefined }
      : { ...task, cancellable: false, cancel: undefined });
  } catch {
    return [];
  }
}

export default function App() {
  const [tab, setTab] = useState<Tab>('hardware');
  const [cli, setCli] = useState<CliInfo | null>(null);
  const [recipes, setRecipes] = useState<RecipeSpec[]>([]);
  const [devices, setDevices] = useState<DeviceSpec[]>([]);
  const [bridgeDocs, setBridgeDocs] = useState<BridgeDocs | null>(null);
  const [recipeId, setRecipeId] = useState('blink');
  const [sketchDir, setSketchDir] = useState('');
  const [source, setSource] = useState('');
  const [preflight, setPreflight] = useState<PreflightResult | null>(null);
  const [status, setStatus] = useState('Ready');
  const [busy, setBusy] = useState(false);
  const [measurement, setMeasurement] = useState<MeasurementResult | null>(null);
  const [parameterValues, setParameterValues] = useState<Record<string, string>>({});
  const [presetName, setPresetName] = useState('');
  const [tasks, setTasks] = useState<BackgroundTask[]>(restoreTaskMemory);
  const {
    ports, profiles, selectedPort, setSelectedPort, fqbn, setFqbn,
    activePort, hardwareStatus, diagnosis, refreshHardware,
  } = useHardwareSession();

  const recipe = useMemo(() => recipes.find(r => r.id === recipeId), [recipes, recipeId]);
  const groupedRecipes = useMemo(() => {
    const groups = new Map<string, RecipeSpec[]>();
    for (const item of recipes) {
      const group = libraryGroupFor(item);
      groups.set(group, [...(groups.get(group) ?? []), item]);
    }
    return [...groups.entries()];
  }, [recipes]);
  const detectedFqbn = activePort?.fqbn ?? '';
  const profileMismatch = Boolean(detectedFqbn && detectedFqbn !== fqbn);
  const detectedProfileAvailable = Boolean(detectedFqbn && profiles.some(profile => profile.fqbn === detectedFqbn));

  useEffect(() => {
    if (typeof localStorage === 'undefined') return;
    const serializable = tasks.slice(0, 40).map(({ cancel: _cancel, ...task }) => ({ ...task, cancellable: task.state === 'running' ? task.cancellable : false }));
    localStorage.setItem(TASK_MEMORY_KEY, JSON.stringify(serializable));
  }, [tasks]);

  function addTask(category: TaskCategory, title: string, detail = 'Starting…', cancel?: () => Promise<void> | void) {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    const task: BackgroundTask = {
      id, category, title, state: 'running', detail,
      logs: [`${new Date().toLocaleTimeString([], { hour12: false })} · ${detail}`],
      startedAt: Date.now(), cancellable: Boolean(cancel), cancel,
    };
    setTasks(current => [task, ...current].slice(0, 40));
    return id;
  }

  function logTask(id: number, message: string) {
    const line = `${new Date().toLocaleTimeString([], { hour12: false })} · ${message}`;
    setTasks(current => current.map(task => task.id === id ? { ...task, detail: message, logs: [...task.logs, line].slice(-120) } : task));
  }

  function finishTask(id: number, state: Exclude<TaskState, 'running'>, detail: string) {
    const line = `${new Date().toLocaleTimeString([], { hour12: false })} · ${detail}`;
    setTasks(current => current.map(task => task.id === id && task.state === 'running'
      ? { ...task, state, detail, logs: [...task.logs, line].slice(-120), finishedAt: Date.now(), cancellable: false, cancel: undefined }
      : task));
  }

  async function cancelTask(id: number) {
    const task = tasks.find(item => item.id === id);
    if (!task || task.state !== 'running' || !task.cancel) return;
    logTask(id, 'Cancellation requested…');
    try {
      await task.cancel();
      finishTask(id, 'cancelled', 'Cancelled by user');
    } catch (error) {
      logTask(id, `Cancel failed: ${error}`);
      finishTask(id, 'failed', `Cancellation failed: ${error}`);
    }
  }

  function clearFinishedTasks() {
    setTasks(current => current.filter(task => task.state === 'running'));
  }

  async function refresh() {
    setStatus('Refreshing toolchain, recipes, and shared hardware session…');
    const task = addTask('System', 'Refresh BetterBoard state', 'Detecting Arduino CLI, recipes, registries and USB boards…');
    try {
      const [cliInfo, recipeCatalog, deviceCatalog, docs, refreshedHardwareStatus] = await Promise.all([
        invoke<CliInfo>('arduino_cli_discovery'),
        invoke<RecipeSpec[]>('recipe_catalog'),
        invoke<DeviceSpec[]>('device_catalog'),
        invoke<BridgeDocs>('physical_lab_bridge_docs'),
        refreshHardware(),
      ]);
      setCli(cliInfo); setRecipes(recipeCatalog); setDevices(deviceCatalog); setBridgeDocs(docs);
      if (!recipeCatalog.some(r => r.id === recipeId) && recipeCatalog.length) setRecipeId(recipeCatalog[0].id);
      const detail = cliInfo.found ? `Ready · ${recipeCatalog.length} recipes · ${deviceCatalog.length} device profiles` : 'Arduino CLI not found';
      setStatus(detail); logTask(task, refreshedHardwareStatus); finishTask(task, cliInfo.found ? 'done' : 'failed', detail);
    } catch (e) {
      setStatus(String(e)); logTask(task, String(e)); finishTask(task, 'failed', String(e));
    }
  }

  useEffect(() => { void refresh(); }, []);
  useEffect(() => {
    setSketchDir(''); setMeasurement(null); setPreflight(null);
    if (!recipeId) return;
    invoke<string>('recipe_source', { recipeId }).then(setSource).catch(e => setSource(String(e)));
  }, [recipeId]);
  useEffect(() => {
    if (!recipe) return;
    setParameterValues(recipeParameterDefaults(recipe));
    setPresetName(`${recipe.title} preset`);
    setSketchDir('');
  }, [recipe?.id]);

  async function checkPreflight() {
    if (!recipe) return;
    const task = addTask('Program', `Preflight · ${recipe.title}`, `Checking ${fqbn} core and ${recipe.required_libraries.length} required libraries…`);
    setBusy(true);
    try {
      const result = await invoke<PreflightResult>('recipe_preflight', { recipeId: recipe.id, fqbn });
      setPreflight(result);
      const detail = result.missing_libraries.length ? `Missing: ${result.missing_libraries.join(', ')}` : 'Core and required libraries look ready';
      for (const warning of result.warnings) logTask(task, warning);
      setStatus(detail); finishTask(task, result.core_installed && !result.missing_libraries.length ? 'done' : 'failed', detail);
    } catch (e) { setStatus(String(e)); logTask(task, String(e)); finishTask(task, 'failed', String(e)); }
    finally { setBusy(false); }
  }

  async function prepare() {
    if (!recipe) return '';
    const task = addTask('Program', `Prepare · ${recipe.title}`, 'Writing canonical firmware into the BetterBoard temporary sketch workspace…');
    setBusy(true);
    try {
      const path = await invoke<string>('prepare_recipe_with_params', { recipeId: recipe.id, parameterValues });
      setSketchDir(path); setStatus(`Firmware ready: ${path}`); logTask(task, path); finishTask(task, 'done', 'Canonical firmware prepared'); return path;
    } catch (e) { setStatus(String(e)); logTask(task, String(e)); finishTask(task, 'failed', String(e)); return ''; }
    finally { setBusy(false); }
  }

  async function compile() {
    if (!recipe) return;
    if (!diagnosis.canCompile) { setStatus(`Compile blocked by Hardware Doctor: ${diagnosis.title} · ${diagnosis.action}`); return; }
    const path = sketchDir || await prepare(); if (!path) return;
    const task = addTask('Program', `Compile · ${recipe.title}`, `arduino-cli compile --fqbn ${fqbn}`);
    setBusy(true);
    try {
      const out = await invoke<string>('compile_sketch', { sketchDir: path, fqbn });
      const detail = out.split('\n').filter(Boolean).slice(-2).join(' · ') || 'Compile succeeded';
      logTask(task, out.trim() || 'Compile succeeded'); setStatus(detail); finishTask(task, 'done', detail);
    } catch (e) { setStatus(`Compile failed: ${e}`); logTask(task, String(e)); finishTask(task, 'failed', String(e)); }
    finally { setBusy(false); }
  }

  async function upload() {
    if (!recipe) return;
    if (!diagnosis.canUpload) { setStatus(`Upload blocked by Hardware Doctor: ${diagnosis.title} · ${diagnosis.action}`); return; }
    if (!selectedPort) { setStatus('Select a serial port first.'); return; }
    const path = sketchDir || await prepare(); if (!path) return;
    const task = addTask('Program', `Upload · ${recipe.title}`, `Compile → upload to ${selectedPort}`);
    setBusy(true);
    try {
      setStatus('Compiling…'); logTask(task, `Compiling ${path} for ${fqbn}…`);
      const compileOut = await invoke<string>('compile_sketch', { sketchDir: path, fqbn });
      logTask(task, compileOut.trim() || 'Compile succeeded');
      setStatus('Uploading…'); logTask(task, `Uploading to ${selectedPort}…`);
      const out = await invoke<string>('upload_sketch', { sketchDir: path, fqbn, port: selectedPort });
      logTask(task, out.trim() || 'Upload succeeded');
      const detail = out.split('\n').filter(Boolean).slice(-2).join(' · ') || 'Upload succeeded';
      setStatus(detail); finishTask(task, 'done', detail);
    } catch (e) { setStatus(`Upload failed: ${e}`); logTask(task, String(e)); finishTask(task, 'failed', String(e)); }
    finally { setBusy(false); }
  }

  async function saveRecipePreset() {
    if (!recipe) return;
    const title = presetName.trim() || `${recipe.title} preset`;
    const task = addTask('System', `Save preset · ${title}`, 'Saving parameterized recipe into Documents/BetterBoard/library…');
    try {
      const saved = await invoke<RecipeSpec>('user_recipe_save', {
        title, baseRecipeId: recipe.id, source: null, parameterValues,
      });
      const catalog = await invoke<RecipeSpec[]>('recipe_catalog');
      setRecipes(catalog); setRecipeId(saved.id);
      const detail = `Saved to My Library · ${saved.title}`;
      logTask(task, detail); finishTask(task, 'done', detail); setStatus(detail);
    } catch (error) {
      logTask(task, String(error)); finishTask(task, 'failed', `Preset save failed: ${error}`); setStatus(`Preset save failed: ${error}`);
    }
  }

  const nav = [
    ['hardware', Cpu, 'Hardware & Program'], ['circuit', CircuitBoard, 'Circuit Lab'], ['library', Boxes, 'Recipe Library'], ['data', Waves, 'Monitor & Data'],
    ['developer', Code2, 'Developer'],
  ] as const;

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">B</div><div><b>BetterBoard</b><span>Studio · Alpha 0.7</span></div></div>
      {nav.map(([id, Icon, label]) => <button key={id} className={`nav ${tab === id ? 'nav-active' : ''}`} onClick={() => setTab(id)}><Icon size={17}/>{label}</button>)}
      <div className="sidebar-spacer"/>
      <div className="small-card"><span>Core workflow</span><b>Connect → program → monitor → record → analyze</b></div>
      <div className="legal">Independent project<br/>Compatible with Arduino tooling<br/>Not affiliated with Arduino</div>
    </aside>

    <main>
      <header>
        <div><h1>From board setup to live evidence.</h1><p>Program once, monitor continuously, record only when the data is worth keeping.</p></div>
        <button className="ghost" onClick={() => void refresh()}><RefreshCw size={16}/> Refresh</button>
      </header>

      <section className="status-strip">
        <div><span className={`dot ${cli?.found ? 'good' : 'bad'}`}/><b>{cli?.found ? 'Arduino CLI ready' : 'Arduino CLI unavailable'}</b><small>{cli?.version || cli?.error || ''}</small></div>
        <div><TerminalSquare size={16}/><span>{status} · {hardwareStatus}</span></div>
      </section>

      <div className="studio-persistent-pane" hidden={tab !== 'hardware'}>
        <section className="hero-grid">
          <div className="panel">
            <div className="panel-title"><Cable size={18}/> Shared hardware session</div>
            <label>Serial device<select value={selectedPort} onChange={e => setSelectedPort(e.target.value)}>
              {!ports.length && <option value="">No USB serial device</option>}
              {ports.map(p => <option key={p.port} value={p.port}>{p.port} · {p.board_name || 'Unknown board'}</option>)}
            </select></label>
            <label>Board profile<select value={fqbn} onChange={e => setFqbn(e.target.value)}>
              {profiles.map(p => <option key={p.fqbn} value={p.fqbn}>{p.label}</option>)}
            </select></label>
            <div className="hint">This selection is shared across Studio and Experiments. Switching workspaces no longer creates a second board session.</div>
            {activePort && <div className="device-line"><b>{activePort.port}</b><span>{activePort.protocol}{activePort.fqbn ? ` · detected ${activePort.fqbn}` : ''}</span></div>}
            <div className="boundary">{diagnosis.severity === 'success' ? <ShieldCheck size={15}/> : <CircleAlert size={15}/>}<span><b>Hardware Doctor · {diagnosis.title}</b><br/>{diagnosis.detail}<br/><small>{diagnosis.action}</small></span></div>
            {profileMismatch && <div className="boundary"><CircleAlert size={15}/><span>Board profile mismatch · Arduino CLI detected <b>{detectedFqbn}</b> on {activePort?.port}, while BetterBoard is set to <b>{fqbn}</b>. Confirm before compiling or uploading.</span>{detectedProfileAvailable && <button className="ghost" onClick={() => setFqbn(detectedFqbn)}>Use detected profile</button>}</div>}
          </div>
          <div className="panel">
            <div className="panel-title"><ShieldCheck size={18}/> Recipe preflight</div>
            <div className="recipe-head"><b>{recipe?.title || 'Loading recipes…'}</b><span>{recipe?.category}</span></div>
            <p className="muted">{recipe?.description}</p>
            <button className="ghost" disabled={busy || !recipe} onClick={() => void checkPreflight()}><Wrench size={16}/> Check core & libraries</button>
            {preflight && <div className="preflight">
              <div><span>Core</span><b className={preflight.core_installed ? 'ok' : 'warn'}>{preflight.core} · {preflight.core_installed ? 'ready' : 'missing'}</b></div>
              <div><span>Libraries</span><b className={!preflight.missing_libraries.length ? 'ok' : 'warn'}>{preflight.required_libraries.length ? (preflight.missing_libraries.length ? `Missing ${preflight.missing_libraries.join(', ')}` : 'ready') : 'none required'}</b></div>
              {preflight.warnings.map(w => <small key={w}><CircleAlert size={13}/>{w}</small>)}
            </div>}
          </div>
        </section>

        <section className="panel">
          <div className="panel-title"><Play size={18}/> Program</div>
          <div className="selected-recipe-row"><div><span className="eyebrow">Selected recipe</span><h2>{recipe?.title}</h2><p>{recipe?.description}</p></div><button className="ghost" onClick={() => setTab('library')}><BookOpen size={16}/> Browse all</button></div>
          {recipe && <div className="schema-row"><span>{recipe.sketch_name}.ino</span><span>{recipe.baud} baud</span><span>{recipe.capture_mode}</span>{recipe.sample_rate_hz && <span>{recipe.sample_rate_hz} Hz nominal</span>}</div>}
          {recipe && <RecipeParameterPanel recipe={recipe} values={parameterValues} onChange={values => { setParameterValues(values); setSketchDir(''); }} />}
          {recipe && <div className="action-row" style={{ alignItems: 'end' }}><label style={{ flex: '1 1 260px' }}>Preset name<input value={presetName} onChange={event => setPresetName(event.target.value)} /></label><button className="ghost" disabled={busy} onClick={() => void saveRecipePreset()}><Save size={15}/> Save preset to My Library</button></div>}
          <div className="action-row">
            <button className="ghost" disabled={busy || !recipe} onClick={() => void prepare()}><Braces size={16}/> Prepare firmware</button>
            <button className="ghost" disabled={busy || !recipe || !diagnosis.canCompile} onClick={() => void compile()}><Download size={16}/> Compile</button>
            <button className="primary" disabled={busy || !recipe || !diagnosis.canUpload} onClick={() => void upload()}><Upload size={16}/> Compile & Upload</button>
            {recipe?.capture_mode !== 'none' && <button className="primary secondary" disabled={busy || !selectedPort} onClick={() => setTab('data')}><Waves size={16}/> Open Monitor & Data</button>}
          </div>
        </section>
      </div>

      <div className="studio-persistent-pane" hidden={tab !== 'circuit'}><CircuitLab onUseRecipe={(id) => { setRecipeId(id); setTab('hardware'); }} /></div>

      <div className="studio-persistent-pane" hidden={tab !== 'library'}><section className="library-layout">
        <div className="panel">
          <div className="panel-title"><Boxes size={18}/> Experiment & firmware library</div>
          <p className="muted">Recipes are grouped by purpose instead of mixing verification, discipline, and workflow labels in one flat list.</p>
          <div className="recipe-list">{groupedRecipes.map(([group, items]) => <details key={group} className="recipe-group"><summary className="eyebrow" style={{ margin: '12px 0 6px', cursor: 'pointer' }}>{group} · {items.length}</summary>{items.map(item => { const Icon = iconFor(item.id); return <button key={item.id} className={`recipe-row ${item.id === recipeId ? 'selected' : ''}`} onClick={() => setRecipeId(item.id)}><Icon size={18}/><div><b>{item.title}</b><span>{item.user_defined ? 'USER PRESET' : item.category} · {item.sketch_name}</span></div><small>{item.capture_mode}</small></button>; })}</details>)}</div>
        </div>
        <div className="panel inspector">
          {recipe && <>
            <div className="eyebrow">{libraryGroupFor(recipe)}</div><h2>{recipe.title}</h2><p className="muted">{recipe.description}</p>
            <div className="info-section"><b>Hardware</b>{recipe.hardware.map(v => <span key={v}>• {v}</span>)}</div>
            <div className="info-section"><b>Required libraries</b>{recipe.required_libraries.length ? recipe.required_libraries.map(v => <span key={v}>• {v}</span>) : <span>• None</span>}</div>
            <div className="info-section"><b>Data schema</b><span>{recipe.columns.length ? recipe.columns.map((c, i) => `${c} [${recipe.units[i]}]`).join(' · ') : 'No measurement schema'}</span></div>
            <div className="info-section"><b>Physical Lab consumers</b>{recipe.physical_lab_targets.map(v => <span key={v}>• {v}</span>)}</div>
            <RecipeParameterPanel compact recipe={recipe} values={parameterValues} onChange={values => { setParameterValues(values); setSketchDir(''); }} />
            <div className="boundary"><ShieldCheck size={15}/>{recipe.boundary}</div>
            <div className="action-row"><button className="primary" onClick={() => setTab('hardware')}>Use this recipe</button><button className="ghost" onClick={() => setTab('developer')}><Code2 size={15}/> Open in Developer</button></div>
          </>}
        </div>
      </section></div>

      <div className="studio-persistent-pane" hidden={tab !== 'data'}><MonitorDataStudio
        recipe={recipe}
        selectedPort={selectedPort}
        fqbn={fqbn}
        latestMeasurement={measurement}
        bridgeDocs={bridgeDocs}
        onStatus={setStatus}
        onMeasurement={setMeasurement}
        parameterValues={parameterValues}
        tasks={tasks}
        onTaskStart={addTask}
        onTaskLog={logTask}
        onTaskFinish={finishTask}
      /></div>

      <div className="studio-persistent-pane" hidden={tab !== 'developer'}><DeveloperIDE
        recipe={recipe}
        canonicalSource={source}
        cli={cli}
        fqbn={fqbn}
        selectedPort={selectedPort}
        integratedDevices={devices.length}
        recipes={recipes}
        onLibrarySaved={() => { void refresh(); }}
        onStatus={setStatus}
        onTaskStart={addTask}
        onTaskLog={logTask}
        onTaskFinish={finishTask}
      /></div>

      <TaskCenterPanel tasks={tasks} onCancel={cancelTask} onClearFinished={clearFinishedTasks}/>
    </main>
  </div>;
}
