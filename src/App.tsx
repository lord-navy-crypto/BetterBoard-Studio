import { useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  Activity, BookOpen, Bot, Boxes, Braces, Cable, CircleAlert, CircuitBoard, Code2,
  Cpu, Database, Download, FileText, Gauge, Link2, Magnet, Play, RefreshCw, RotateCw,
  Search, ShieldCheck, TerminalSquare, TimerReset, Upload, Waves, Wrench,
} from 'lucide-react';
import CircuitLab from './CircuitLab';

type CliInfo = { found: boolean; path?: string; version?: string; error?: string };
type BoardPort = { port: string; protocol: string; board_name?: string; fqbn?: string };
type BoardProfile = { id: string; label: string; fqbn: string; core: string; default_baud: number; notes: string[] };
type RecipeSpec = {
  id: string; title: string; category: string; description: string; sketch_name: string;
  capture_mode: 'none' | 'numeric' | 'text'; baud: number; columns: string[]; units: string[];
  primary_column?: string | null; sample_rate_hz?: number | null; required_libraries: string[];
  hardware: string[]; physical_lab_targets: string[]; notes: string[]; boundary: string;
  supported_cores?: string[]; interactive_commands?: string[]; research_stage?: boolean;
};
type DeviceSpec = { id: string; name: string; interface: string; quantities: string[]; units: string[]; libraries: string[]; status: string };
type PreflightResult = { cli_ready: boolean; core: string; core_installed: boolean; compatible: boolean; required_libraries: string[]; missing_libraries: string[]; warnings: string[] };
type CapturedRow = { host_timestamp_ms: number; line: string; numeric: boolean };
type CaptureResult = { lines: string[]; rows: CapturedRow[]; numeric_rows: number; ignored_rows: number };
type MeasurementResult = {
  directory: string; csv_path: string; metadata_path: string; physical_lab_csv_path: string;
  physical_lab_bridge_path: string; samples: number;
};
type BridgeDocs = { hardware_map: string; serial_protocol: string; honeycomb_guide: string };
type Tab = 'hardware' | 'circuit' | 'library' | 'data' | 'bridge' | 'developer';
type Task = { id: number; title: string; state: 'running' | 'done' | 'failed'; detail: string };

const coreFromFqbn = (fqbn: string) => fqbn.split(':').slice(0, 2).join(':');

const iconFor = (id: string) => {
  if (id.includes('esp32')) return Cpu;
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

export default function App() {
  const [tab, setTab] = useState<Tab>('hardware');
  const [cli, setCli] = useState<CliInfo | null>(null);
  const [ports, setPorts] = useState<BoardPort[]>([]);
  const [profiles, setProfiles] = useState<BoardProfile[]>([]);
  const [recipes, setRecipes] = useState<RecipeSpec[]>([]);
  const [devices, setDevices] = useState<DeviceSpec[]>([]);
  const [bridgeDocs, setBridgeDocs] = useState<BridgeDocs | null>(null);
  const [selectedPort, setSelectedPort] = useState('');
  const [fqbn, setFqbn] = useState('arduino:avr:uno');
  const [recipeId, setRecipeId] = useState('blink');
  const [researchCommand, setResearchCommand] = useState('');
  const [sketchDir, setSketchDir] = useState('');
  const [source, setSource] = useState('');
  const [preflight, setPreflight] = useState<PreflightResult | null>(null);
  const [status, setStatus] = useState('Ready');
  const [busy, setBusy] = useState(false);
  const [serial, setSerial] = useState<string[]>([]);
  const [measurement, setMeasurement] = useState<MeasurementResult | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);

  const recipe = useMemo(() => recipes.find(r => r.id === recipeId), [recipes, recipeId]);
  const activePort = useMemo(() => ports.find(p => p.port === selectedPort), [ports, selectedPort]);
  const activeProfile = useMemo(() => profiles.find(p => p.fqbn === fqbn), [profiles, fqbn]);
  const selectedCore = useMemo(() => coreFromFqbn(fqbn), [fqbn]);
  const recipeCompatible = useMemo(() => {
    if (!recipe) return false;
    if (recipe.supported_cores?.length) return recipe.supported_cores.includes(selectedCore);
    return selectedCore !== 'esp32:esp32';
  }, [recipe, selectedCore]);
  const numericSeries = useMemo(
    () => serial.map(line => Number(line.split(',').at(-1))).filter(Number.isFinite),
    [serial],
  );
  const lastParts = useMemo(() => serial.at(-1)?.split(',') ?? [], [serial]);
  const spark = useMemo(() => {
    if (numericSeries.length < 2) return '';
    const values = numericSeries.slice(-120);
    const min = Math.min(...values), max = Math.max(...values), span = Math.max(max - min, 1e-9);
    return values.map((v, i) => `${(i / Math.max(values.length - 1, 1)) * 100},${36 - ((v - min) / span) * 32}`).join(' ');
  }, [numericSeries]);

  function addTask(title: string, detail = 'Starting…') {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    const task: Task = { id, title, state: 'running', detail };
    setTasks(current => [task, ...current].slice(0, 8));
    return id;
  }
  function finishTask(id: number, state: 'done' | 'failed', detail: string) {
    setTasks(current => current.map(task => task.id === id ? { ...task, state, detail } : task));
  }

  async function refresh() {
    setStatus('Detecting toolchain, recipes, and USB boards…');
    try {
      const [cliInfo, boardProfiles, recipeCatalog, deviceCatalog, docs] = await Promise.all([
        invoke<CliInfo>('arduino_cli_discovery'),
        invoke<BoardProfile[]>('board_profiles'),
        invoke<RecipeSpec[]>('recipe_catalog'),
        invoke<DeviceSpec[]>('device_catalog'),
        invoke<BridgeDocs>('physical_lab_bridge_docs'),
      ]);
      setCli(cliInfo); setProfiles(boardProfiles); setRecipes(recipeCatalog); setDevices(deviceCatalog); setBridgeDocs(docs);
      if (!recipeCatalog.some(r => r.id === recipeId) && recipeCatalog.length) setRecipeId(recipeCatalog[0].id);
      try {
        const boardPorts = await invoke<BoardPort[]>('board_list');
        setPorts(boardPorts);
        if ((!selectedPort || !boardPorts.some(p => p.port === selectedPort)) && boardPorts.length) setSelectedPort(boardPorts[0].port);
        setStatus(boardPorts.length ? `Ready · ${boardPorts.length} hardware serial device(s) detected` : 'Toolchain ready · no hardware serial board detected');
      } catch (e) {
        setPorts([]);
        setStatus(cliInfo.found ? `Arduino CLI ready · board scan: ${e}` : 'Arduino CLI not found');
      }
    } catch (e) { setStatus(String(e)); }
  }

  useEffect(() => { refresh(); }, []);
  useEffect(() => {
    setSketchDir(''); setSerial([]); setMeasurement(null); setPreflight(null);
    if (!recipeId) return;
    invoke<string>('recipe_source', { recipeId }).then(setSource).catch(e => setSource(String(e)));
  }, [recipeId]);
  useEffect(() => {
    setResearchCommand(recipe?.interactive_commands?.[0] || '');
  }, [recipeId, recipe?.interactive_commands?.join('|')]);

  async function checkPreflight() {
    if (!recipe) return;
    const task = addTask(`Preflight · ${recipe.title}`);
    setBusy(true);
    try {
      const result = await invoke<PreflightResult>('recipe_preflight', { recipeId: recipe.id, fqbn });
      setPreflight(result);
      const detail = !result.compatible
        ? `Recipe is not compatible with ${result.core}`
        : result.missing_libraries.length
          ? `Missing: ${result.missing_libraries.join(', ')}`
          : result.core_installed ? 'Board core, recipe compatibility, and required libraries look ready' : `Core ${result.core} is missing`;
      setStatus(detail);
      finishTask(task, result.compatible && result.core_installed && !result.missing_libraries.length ? 'done' : 'failed', detail);
    } catch (e) { setStatus(String(e)); finishTask(task, 'failed', String(e)); }
    finally { setBusy(false); }
  }

  async function prepare() {
    if (!recipe) return '';
    const task = addTask(`Prepare · ${recipe.title}`);
    setBusy(true);
    try {
      const path = await invoke<string>('prepare_recipe', { recipeId: recipe.id });
      setSketchDir(path); setStatus(`Firmware ready: ${path}`); finishTask(task, 'done', path); return path;
    } catch (e) { setStatus(String(e)); finishTask(task, 'failed', String(e)); return ''; }
    finally { setBusy(false); }
  }

  async function compile() {
    if (!recipe) return;
    if (!recipeCompatible) { setStatus(`Blocked: ${recipe.title} is not declared compatible with ${selectedCore}.`); return; }
    const path = sketchDir || await prepare(); if (!path) return;
    const task = addTask(`Compile · ${recipe.title}`);
    setBusy(true);
    try {
      const out = await invoke<string>('compile_sketch', { sketchDir: path, fqbn });
      const detail = out.split('\n').filter(Boolean).slice(-2).join(' · ') || 'Compile succeeded';
      setStatus(detail); finishTask(task, 'done', detail);
    } catch (e) { setStatus(`Compile failed: ${e}`); finishTask(task, 'failed', String(e)); }
    finally { setBusy(false); }
  }

  async function upload() {
    if (!recipe) return;
    if (!recipeCompatible) { setStatus(`Blocked: ${recipe.title} is not declared compatible with ${selectedCore}.`); return; }
    if (!selectedPort) { setStatus('Select a serial port first.'); return; }
    const path = sketchDir || await prepare(); if (!path) return;
    const task = addTask(`Upload · ${recipe.title}`);
    setBusy(true);
    try {
      setStatus('Compiling…');
      await invoke<string>('compile_sketch', { sketchDir: path, fqbn });
      setStatus('Uploading…');
      const out = await invoke<string>('upload_sketch', { sketchDir: path, fqbn, port: selectedPort });
      const detail = out.split('\n').filter(Boolean).slice(-2).join(' · ') || 'Upload succeeded';
      setStatus(detail); finishTask(task, 'done', detail);
    } catch (e) { setStatus(`Upload failed: ${e}`); finishTask(task, 'failed', String(e)); }
    finally { setBusy(false); }
  }

  async function capture() {
    if (!recipe || recipe.capture_mode === 'none') return;
    if (!selectedPort) { setStatus('Select a serial port first.'); return; }
    const task = addTask(`Capture · ${recipe.title}`);
    setBusy(true);
    try {
      setStatus(recipe.capture_mode === 'text' ? 'Capturing diagnostic/research output…' : 'Capturing numeric data…');
      const result = await invoke<CaptureResult>('serial_capture', {
        port: selectedPort, baud: recipe.baud, durationMs: recipe.capture_mode === 'text' ? 4500 : 3000,
        maxLines: 5000, numericOnly: recipe.capture_mode === 'numeric',
      });
      setSerial(result.lines);
      const detail = recipe.capture_mode === 'numeric'
        ? `${result.numeric_rows} numeric rows · ${result.ignored_rows} ignored`
        : `${result.lines.length} diagnostic/research lines`;
      setStatus(detail); finishTask(task, 'done', detail); setTab('data');
    } catch (e) { setStatus(`Capture failed: ${e}`); finishTask(task, 'failed', String(e)); }
    finally { setBusy(false); }
  }

  async function runInteractiveCommand() {
    if (!recipe || !researchCommand.trim()) return;
    if (!recipeCompatible) { setStatus(`Blocked: ${recipe.title} is not declared compatible with ${selectedCore}.`); return; }
    if (!selectedPort) { setStatus('Select a serial port first.'); return; }
    const task = addTask(`Research command · ${researchCommand}`);
    setBusy(true);
    try {
      setStatus(`Running ${researchCommand}…`);
      const result = await invoke<CaptureResult>('serial_exchange', {
        port: selectedPort,
        baud: recipe.baud,
        command: researchCommand,
        durationMs: researchCommand.startsWith('IRREG ') ? 20000 : 12000,
        maxLines: 12000,
      });
      setSerial(result.lines);
      const detail = `${result.lines.length} lines captured · ${result.numeric_rows} numeric-only CSV lines`;
      setStatus(detail); finishTask(task, 'done', detail); setTab('data');
    } catch (e) { setStatus(`Research command failed: ${e}`); finishTask(task, 'failed', String(e)); }
    finally { setBusy(false); }
  }

  async function recordMeasurement() {
    if (!recipe || recipe.capture_mode !== 'numeric') return;
    if (!recipeCompatible) { setStatus(`Blocked: ${recipe.title} is not declared compatible with ${selectedCore}.`); return; }
    if (!selectedPort) { setStatus('Select a serial port first.'); return; }
    const task = addTask(`Measurement · ${recipe.title}`);
    setBusy(true);
    try {
      setStatus('Recording full multichannel package + Physical Lab compatibility export…');
      const result = await invoke<MeasurementResult>('capture_measurement', {
        port: selectedPort, durationMs: 5000, maxLines: 5000, boardProfile: fqbn, recipeId: recipe.id,
      });
      setMeasurement(result);
      const detail = `${result.samples} samples saved`;
      setStatus(detail); finishTask(task, 'done', detail); setTab('bridge');
    } catch (e) { setStatus(`Measurement failed: ${e}`); finishTask(task, 'failed', String(e)); }
    finally { setBusy(false); }
  }

  const nav = [
    ['hardware', Cpu, 'Hardware'], ['circuit', CircuitBoard, 'Circuit Lab'], ['library', Boxes, 'Recipe Library'], ['data', Waves, 'Data Studio'],
    ['bridge', Link2, 'Physical Lab Bridge'], ['developer', Code2, 'Developer'],
  ] as const;

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">B</div><div><b>BetterBoard</b><span>Studio · Alpha 0.2</span></div></div>
      {nav.map(([id, Icon, label]) => <button key={id} className={`nav ${tab === id ? 'nav-active' : ''}`} onClick={() => setTab(id)}><Icon size={17}/>{label}</button>)}
      <div className="sidebar-spacer"/>
      <div className="small-card"><span>Core principle</span><b>Goal → hardware → firmware → measurement</b></div>
      <div className="legal">Independent project<br/>Compatible with Arduino tooling<br/>Not affiliated with Arduino</div>
    </aside>

    <main>
      <header>
        <div><h1>Physical computing, without the setup maze.</h1><p>One hardware layer for BetterBoard and Physical Lab.</p></div>
        <button className="ghost" onClick={refresh}><RefreshCw size={16}/> Refresh</button>
      </header>

      <section className="status-strip">
        <div><span className={`dot ${cli?.found ? 'good' : 'bad'}`}/><b>{cli?.found ? 'Arduino CLI ready' : 'Arduino CLI unavailable'}</b><small>{cli?.version || cli?.error || ''}</small></div>
        <div><TerminalSquare size={16}/><span>{status}</span></div>
      </section>

      {tab === 'hardware' && <>
        <section className="hero-grid">
          <div className="panel">
            <div className="panel-title"><Cable size={18}/> Connection</div>
            <label>Serial device<select value={selectedPort} onChange={e => setSelectedPort(e.target.value)}>
              {!ports.length && <option value="">No hardware serial device</option>}
              {ports.map(p => <option key={p.port} value={p.port}>{p.port} · {p.board_name || 'Unknown board'}</option>)}
            </select></label>
            <label>Board profile<select value={fqbn} onChange={e => { setFqbn(e.target.value); setPreflight(null); }}>
              {profiles.map(p => <option key={p.fqbn} value={p.fqbn}>{p.label}</option>)}
            </select></label>
            <div className="hint">System debug/Bluetooth ports are filtered. Unknown USB boards remain selectable, but BetterBoard keeps the board profile explicit instead of guessing the MCU.</div>
            {activePort && <div className="device-line"><b>{activePort.port}</b><span>{activePort.protocol}</span></div>}
            {activeProfile && <div className="info-section"><b>{activeProfile.core}</b>{activeProfile.notes.map(v => <span key={v}>• {v}</span>)}</div>}
          </div>
          <div className="panel">
            <div className="panel-title"><ShieldCheck size={18}/> Recipe preflight</div>
            <div className="recipe-head"><b>{recipe?.title || 'Loading recipes…'}</b><span>{recipe?.category}</span></div>
            <p className="muted">{recipe?.description}</p>
            {!recipeCompatible && recipe && <div className="boundary"><CircleAlert size={15}/>This recipe is not declared compatible with {selectedCore}. Compile/upload is blocked until the board profile or recipe is changed.</div>}
            {recipe?.research_stage && <div className="hint">Research-stage recipe · integrated for controlled testing, but real-board compile/upload/protocol validation is still required.</div>}
            <button className="ghost" disabled={busy || !recipe} onClick={checkPreflight}><Wrench size={16}/> Check core, compatibility & libraries</button>
            {preflight && <div className="preflight">
              <div><span>Compatibility</span><b className={preflight.compatible ? 'ok' : 'warn'}>{preflight.compatible ? 'ready' : 'blocked'}</b></div>
              <div><span>Core</span><b className={preflight.core_installed ? 'ok' : 'warn'}>{preflight.core} · {preflight.core_installed ? 'ready' : 'missing'}</b></div>
              <div><span>Libraries</span><b className={!preflight.missing_libraries.length ? 'ok' : 'warn'}>{preflight.required_libraries.length ? (preflight.missing_libraries.length ? `Missing ${preflight.missing_libraries.join(', ')}` : 'ready') : 'none required'}</b></div>
              {preflight.warnings.map(w => <small key={w}><CircleAlert size={13}/>{w}</small>)}
            </div>}
          </div>
        </section>

        <section className="panel">
          <div className="panel-title"><Play size={18}/> Goal-first workflow</div>
          <div className="selected-recipe-row"><div><span className="eyebrow">Selected recipe</span><h2>{recipe?.title}</h2><p>{recipe?.description}</p></div><button className="ghost" onClick={() => setTab('library')}><BookOpen size={16}/> Browse all</button></div>
          {recipe && <div className="schema-row"><span>{recipe.sketch_name}.ino</span><span>{recipe.baud} baud</span><span>{recipe.capture_mode}</span>{recipe.sample_rate_hz && <span>{recipe.sample_rate_hz} Hz</span>}{recipe.research_stage && <span>research</span>}</div>}
          <div className="action-row">
            <button className="ghost" disabled={busy || !recipe} onClick={prepare}><Braces size={16}/> Prepare firmware</button>
            <button className="ghost" disabled={busy || !recipe || !recipeCompatible} onClick={compile}><Download size={16}/> Compile</button>
            <button className="primary" disabled={busy || !recipe || !selectedPort || !recipeCompatible} onClick={upload}><Upload size={16}/> Compile & Upload</button>
            {recipe?.capture_mode !== 'none' && <button className="primary secondary" disabled={busy || !selectedPort} onClick={capture}><Activity size={16}/> {recipe?.capture_mode === 'text' ? 'Capture startup/output' : 'Capture 3 s'}</button>}
          </div>
          {!!recipe?.interactive_commands?.length && <div className="info-section">
            <b>Interactive ESP32 research command</b>
            <label>Command preset<select value={researchCommand} onChange={e => setResearchCommand(e.target.value)}>
              {recipe.interactive_commands.map(command => <option key={command} value={command}>{command}</option>)}
            </select></label>
            <span>Commands are sent only after you explicitly run them; BetterBoard captures the tagged response into Data Studio.</span>
            <button className="primary secondary" disabled={busy || !selectedPort || !recipeCompatible || !researchCommand} onClick={runInteractiveCommand}><TerminalSquare size={16}/> Run command & capture</button>
          </div>}
        </section>
      </>}

      {tab === 'circuit' && <CircuitLab onUseRecipe={(id) => { setRecipeId(id); setTab('hardware'); }} />}

      {tab === 'library' && <section className="library-layout">
        <div className="panel">
          <div className="panel-title"><Boxes size={18}/> Integrated firmware library</div>
          <div className="recipe-list">{recipes.map(item => { const Icon = iconFor(item.id); return <button key={item.id} className={`recipe-row ${item.id === recipeId ? 'selected' : ''}`} onClick={() => setRecipeId(item.id)}><Icon size={18}/><div><b>{item.title}</b><span>{item.category} · {item.sketch_name}</span></div><small>{item.research_stage ? 'research' : item.capture_mode}</small></button>; })}</div>
        </div>
        <div className="panel inspector">
          {recipe && <>
            <div className="eyebrow">{recipe.category}{recipe.research_stage ? ' · Research stage' : ''}</div><h2>{recipe.title}</h2><p className="muted">{recipe.description}</p>
            <div className="info-section"><b>Hardware</b>{recipe.hardware.map(v => <span key={v}>• {v}</span>)}</div>
            <div className="info-section"><b>Supported board cores</b><span>{recipe.supported_cores?.length ? recipe.supported_cores.join(' · ') : 'Legacy/canonical board assumptions; ESP32 blocked until adapted'}</span></div>
            <div className="info-section"><b>Required libraries</b>{recipe.required_libraries.length ? recipe.required_libraries.map(v => <span key={v}>• {v}</span>) : <span>• None</span>}</div>
            <div className="info-section"><b>Data schema</b><span>{recipe.columns.length ? recipe.columns.map((c, i) => `${c} [${recipe.units[i]}]`).join(' · ') : recipe.interactive_commands?.length ? 'Tagged interactive research output; inspect SCHEMA in Data Studio' : 'No measurement schema'}</span></div>
            {!!recipe.interactive_commands?.length && <div className="info-section"><b>Command presets</b>{recipe.interactive_commands.map(v => <span key={v}>• {v}</span>)}</div>}
            <div className="info-section"><b>Physical Lab consumers</b>{recipe.physical_lab_targets.map(v => <span key={v}>• {v}</span>)}</div>
            <div className="boundary"><ShieldCheck size={15}/>{recipe.boundary}</div>
            <button className="primary" onClick={() => setTab('hardware')}>Use this recipe</button>
          </>}
        </div>
      </section>}

      {tab === 'data' && <section className="data-grid">
        <div className="panel">
          <div className="panel-title"><Activity size={18}/> Capture snapshot</div>
          {!serial.length ? <div className="empty">No capture yet. Upload a measurement/diagnostic recipe and run Capture or an interactive research command.</div> : recipe?.capture_mode === 'text' ? <pre className="terminal">{serial.join('\n')}</pre> : <>
            <div className="metric">{numericSeries.at(-1)?.toFixed(4) ?? '—'} <small>{recipe?.units.at(-1)}</small></div>
            <svg className="plot" viewBox="0 0 100 40" preserveAspectRatio="none"><polyline points={spark} fill="none" vectorEffect="non-scaling-stroke"/></svg>
            <div className="channels">{recipe?.columns.map((column, i) => <div key={column}><span>{column}</span><b>{lastParts[i] ?? '—'}</b><small>{recipe.units[i]}</small></div>)}</div>
          </>}
        </div>
        <div className="panel">
          <div className="panel-title"><Database size={18}/> Measurement package</div>
          <p className="muted">Canonical numeric recipes can record full multichannel CSV + Physical Lab compatibility output. Interactive ESP32 research uses tagged mixed output and remains a research evidence stream until analyzer-driven packaging is integrated.</p>
          <button className="primary" disabled={busy || !selectedPort || recipe?.capture_mode !== 'numeric' || !recipeCompatible} onClick={recordMeasurement}>Record 5 s package</button>
          {measurement && <div className="measurement"><b>{measurement.samples} samples</b><span>{measurement.csv_path}</span><span>{measurement.metadata_path}</span></div>}
        </div>
      </section>}

      {tab === 'bridge' && <>
        <section className="bridge-hero panel">
          <div><div className="eyebrow">Measurement Bridge 0.2</div><h2>BetterBoard measures. Physical Lab interprets.</h2><p>Keep the hardware software general-purpose while exporting evidence that Physical Lab can register, compare with models, and use in Digital Twin workflows.</p></div><Link2 size={38}/>
        </section>
        <section className="bridge-flow">
          <div>Sensor / device</div><b>→</b><div>Arduino / ESP32 board</div><b>→</b><div>BetterBoard</div><b>→</b><div>CSV + metadata</div><b>→</b><div>Physical Lab</div>
        </section>
        <section className="data-grid">
          <div className="panel"><div className="panel-title"><FileText size={18}/> Latest package</div>{measurement ? <div className="measurement big"><b>{measurement.samples} samples</b><span>Full: {measurement.csv_path}</span><span>Metadata: {measurement.metadata_path}</span><span>Physical Lab v1: {measurement.physical_lab_csv_path}</span><span>Bridge: {measurement.physical_lab_bridge_path}</span></div> : <div className="empty">No measurement package in this session yet.</div>}</div>
          <div className="panel"><div className="panel-title"><ShieldCheck size={18}/> Scientific boundary</div><p className="muted">A serial file is evidence of acquisition, not automatic proof of calibration, sensor accuracy, traceability, uncertainty, alignment, or model validity. Research-stage ESP32 output additionally requires its host reference/analyzer before accuracy claims.</p></div>
        </section>
        <section className="panel"><div className="panel-title"><BookOpen size={18}/> Imported Physical Lab hardware map</div><pre className="docs-preview">{bridgeDocs?.hardware_map || 'Loading…'}</pre></section>
      </>}

      {tab === 'developer' && <section className="developer-grid">
        <div className="panel">
          <div className="panel-title"><Code2 size={18}/> Integrated firmware source</div>
          <div className="schema-row"><span>{recipe?.title}</span><span>{recipe?.sketch_name}.ino</span><span>{recipe?.baud} baud</span>{recipe?.research_stage && <span>research stage</span>}</div>
          <pre className="code">{source || 'Select a recipe.'}</pre>
        </div>
        <div className="panel">
          <div className="panel-title"><TerminalSquare size={18}/> Runtime facts</div>
          <div className="facts"><span>Arduino CLI</span><b>{cli?.path || 'not found'}</b><span>Board profile</span><b>{fqbn}</b><span>Board core</span><b>{selectedCore}</b><span>Recipe compatibility</span><b>{recipeCompatible ? 'compatible' : 'blocked'}</b><span>Prepared sketch</span><b>{sketchDir || 'not prepared'}</b><span>Integrated devices</span><b>{devices.length}</b></div>
          <div className="info-section"><b>Recipe notes</b>{recipe?.notes.map(v => <span key={v}>• {v}</span>)}</div>
        </div>
      </section>}

      <section className="task-center panel">
        <div className="panel-title"><TerminalSquare size={17}/> Task Center</div>
        {!tasks.length ? <span className="muted">Compile, upload, preflight, capture, interactive research and export operations will appear here.</span> : <div className="task-list">{tasks.map(task => <div key={task.id}><span className={`task-icon ${task.state}`}>{task.state === 'running' ? '…' : task.state === 'done' ? '✓' : '!'}</span><b>{task.title}</b><small>{task.detail}</small></div>)}</div>}
      </section>
    </main>
  </div>;
}
