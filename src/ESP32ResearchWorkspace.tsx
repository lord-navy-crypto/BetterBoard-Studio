import { useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Activity, Braces, Cable, Cpu, Database, Play, RefreshCw, TerminalSquare, Upload, Wrench } from 'lucide-react';

type BoardPort = { port: string; protocol: string; board_name?: string; fqbn?: string };
type BoardProfile = { id: string; label: string; fqbn: string; core: string; default_baud: number; notes: string[] };
type RecipeSpec = {
  id: string;
  title: string;
  category: string;
  description: string;
  sketch_name: string;
  capture_mode: 'none' | 'numeric' | 'text';
  baud: number;
  notes: string[];
  boundary: string;
  supported_cores?: string[];
  interactive_commands?: string[];
  research_stage?: boolean;
};
type PreflightResult = {
  cli_ready: boolean;
  core: string;
  core_installed: boolean;
  compatible: boolean;
  required_libraries: string[];
  missing_libraries: string[];
  warnings: string[];
};
type CaptureResult = { lines: string[]; numeric_rows: number; ignored_rows: number };
type ParsedRow = { kind: string; fields: string[]; raw: string };
type SummaryMetric = { label: string; value: string; detail: string };
type RunRecord = {
  id: number;
  recipeId: string;
  recipeTitle: string;
  command: string;
  fqbn: string;
  port: string;
  capturedAt: string;
  lines: string[];
  rows: ParsedRow[];
  metrics: SummaryMetric[];
};

const TAGS = new Set(['SUM', 'SERIES', 'TAYLOR', 'JITTER', 'TIMER', 'DUALCORE', 'PSRAM', 'WIFIJITTER', 'REDUCE', 'AFFINITY', 'IRREG']);

function coreFromFqbn(fqbn: string) {
  const p = fqbn.split(':');
  return p.length >= 2 ? `${p[0]}:${p[1]}` : fqbn;
}

function parseTagged(lines: string[]): ParsedRow[] {
  const rows: ParsedRow[] = [];
  for (const raw of lines) {
    if (!raw || raw.startsWith('#')) continue;
    const fields = raw.split(',').map(v => v.trim());
    if (!fields.length) continue;
    const first = fields[0].toUpperCase();
    if (TAGS.has(first)) rows.push({ kind: first, fields: fields.slice(1), raw });
  }
  return rows;
}

function num(value: string | undefined): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function metricSummary(rows: ParsedRow[]): SummaryMetric[] {
  const last = rows.at(-1);
  if (!last) return [];
  const f = last.fields;
  switch (last.kind) {
    case 'JITTER': {
      const suite = f.length >= 10;
      const period = num(f[suite ? 2 : 1]);
      const rms = num(f[7]);
      const misses = num(f[8]);
      const samples = num(f[suite ? 3 : 2]);
      return [
        { label: 'RMS lateness', value: rms == null ? '—' : `${rms.toFixed(3)} µs`, detail: period ? `${((rms ?? 0) / period * 100).toFixed(3)}% of period` : 'timing run' },
        { label: 'Deadline misses', value: misses == null ? '—' : String(misses), detail: samples ? `${((misses ?? 0) / samples * 100).toFixed(3)}% of samples` : 'run total' },
      ];
    }
    case 'WIFIJITTER': {
      const period = num(f[1]);
      const samples = num(f[2]);
      const rms = num(f[6]);
      const misses = num(f[7]);
      const networks = num(f[8]);
      return [
        { label: 'Wi-Fi jitter RMS', value: rms == null ? '—' : `${rms.toFixed(3)} µs`, detail: period ? `${((rms ?? 0) / period * 100).toFixed(3)}% of period` : 'radio interference run' },
        { label: 'Deadline misses', value: misses == null ? '—' : String(misses), detail: samples ? `${((misses ?? 0) / samples * 100).toFixed(3)}% of samples` : 'run total' },
        { label: 'Networks seen', value: networks == null ? '—' : String(networks), detail: 'environment-specific' },
      ];
    }
    case 'REDUCE': {
      const sf = num(f[2]);
      const gf = num(f[3]);
      const sd = num(f[4]);
      const gd = num(f[5]);
      return [
        { label: 'float32 grouping Δ', value: sf == null || gf == null ? '—' : (gf - sf).toExponential(4), detail: 'grouped − sequential' },
        { label: 'float64 grouping Δ', value: sd == null || gd == null ? '—' : (gd - sd).toExponential(4), detail: 'grouped − sequential' },
      ];
    }
    case 'AFFINITY':
      return [
        { label: 'Reported cores', value: f[2] ?? '—', detail: `task cores ${f[3] ?? '—'} / ${f[4] ?? '—'}` },
        { label: 'Elapsed', value: f[8] ? `${f[8]} µs` : '—', detail: 'this run only' },
      ];
    case 'IRREG': {
      const dt = num(f[6]);
      const period = num(f[3]);
      const dConst = num(f[8]);
      const dMeasured = num(f[9]);
      const iConst = num(f[10]);
      const iMeasured = num(f[11]);
      return [
        { label: 'Latest Δt', value: dt == null ? '—' : `${dt} µs`, detail: period ? `nominal ${period} µs` : 'measured spacing' },
        { label: 'Derivative gap', value: dConst == null || dMeasured == null ? '—' : Math.abs(dMeasured - dConst).toExponential(4), detail: '|measured-dt − constant-dt|' },
        { label: 'Integral gap', value: iConst == null || iMeasured == null ? '—' : Math.abs(iMeasured - iConst).toExponential(4), detail: '|measured-dt − constant-dt|' },
      ];
    }
    case 'TAYLOR': {
      const raw32 = num(f[3]);
      const reduced32 = num(f[4]);
      const local = num(f[7]);
      return [
        { label: 'Raw vs reduced f32', value: raw32 == null || reduced32 == null ? '—' : Math.abs(raw32 - reduced32).toExponential(4), detail: 'algorithm-path disagreement' },
        { label: 'Reduced vs local sinf', value: reduced32 == null || local == null ? '—' : Math.abs(reduced32 - local).toExponential(4), detail: 'local comparison, not truth' },
      ];
    }
    case 'PSRAM':
      return [{ label: 'PSRAM detected', value: f[2] === '1' ? 'yes' : 'no', detail: f[1] ? `n=${f[1]}` : 'runtime evidence' }];
    default:
      return [{ label: 'Latest row', value: last.kind, detail: `${last.fields.length} fields` }];
  }
}

function comparableValue(run: RunRecord): { label: string; value: number; unit: string } | null {
  const last = run.rows.at(-1);
  if (!last) return null;
  const f = last.fields;
  if (last.kind === 'JITTER') {
    const v = num(f[7]);
    return v == null ? null : { label: 'RMS lateness', value: v, unit: 'µs' };
  }
  if (last.kind === 'WIFIJITTER') {
    const v = num(f[6]);
    return v == null ? null : { label: 'Wi-Fi RMS lateness', value: v, unit: 'µs' };
  }
  if (last.kind === 'REDUCE') {
    const sf = num(f[2]);
    const gf = num(f[3]);
    return sf == null || gf == null ? null : { label: '|float32 grouping Δ|', value: Math.abs(gf - sf), unit: '' };
  }
  if (last.kind === 'IRREG') {
    const dConst = num(f[8]);
    const dMeasured = num(f[9]);
    return dConst == null || dMeasured == null ? null : { label: 'Derivative path gap', value: Math.abs(dMeasured - dConst), unit: '1/s' };
  }
  if (last.kind === 'TAYLOR') {
    const a = num(f[3]);
    const b = num(f[4]);
    return a == null || b == null ? null : { label: 'Raw/reduced f32 gap', value: Math.abs(a - b), unit: '' };
  }
  return null;
}

export default function ESP32ResearchWorkspace() {
  const [ports, setPorts] = useState<BoardPort[]>([]);
  const [profiles, setProfiles] = useState<BoardProfile[]>([]);
  const [recipes, setRecipes] = useState<RecipeSpec[]>([]);
  const [selectedPort, setSelectedPort] = useState('');
  const [fqbn, setFqbn] = useState('esp32:esp32:esp32');
  const [recipeId, setRecipeId] = useState('esp32_readiness');
  const [command, setCommand] = useState('INFO');
  const [preflight, setPreflight] = useState<PreflightResult | null>(null);
  const [sketchDir, setSketchDir] = useState('');
  const [lines, setLines] = useState<string[]>([]);
  const [history, setHistory] = useState<RunRecord[]>([]);
  const [status, setStatus] = useState('Ready');
  const [busy, setBusy] = useState(false);

  const recipe = useMemo(() => recipes.find(r => r.id === recipeId), [recipes, recipeId]);
  const espProfiles = useMemo(() => profiles.filter(p => p.core === 'esp32:esp32'), [profiles]);
  const parsed = useMemo(() => parseTagged(lines), [lines]);
  const metrics = useMemo(() => metricSummary(parsed), [parsed]);
  const comments = useMemo(() => lines.filter(line => line.startsWith('#')), [lines]);
  const selectedCore = coreFromFqbn(fqbn);
  const compatible = recipe ? (recipe.supported_cores?.length ? recipe.supported_cores.includes(selectedCore) : selectedCore !== 'esp32:esp32') : false;
  const comparableRuns = useMemo(() => history.map(run => ({ run, metric: comparableValue(run) })).filter(item => item.metric != null).slice(0, 8), [history]);
  const comparisonMax = useMemo(() => Math.max(0, ...comparableRuns.map(item => item.metric?.value ?? 0)), [comparableRuns]);

  async function refresh() {
    setStatus('Refreshing ESP32 research environment…');
    try {
      const [boardProfiles, recipeCatalog, boardPorts] = await Promise.all([
        invoke<BoardProfile[]>('board_profiles'),
        invoke<RecipeSpec[]>('recipe_catalog'),
        invoke<BoardPort[]>('board_list').catch(() => []),
      ]);
      const espRecipes = recipeCatalog.filter(r => r.supported_cores?.includes('esp32:esp32'));
      setProfiles(boardProfiles);
      setRecipes(espRecipes);
      setPorts(boardPorts);
      if (!espRecipes.some(r => r.id === recipeId) && espRecipes.length) setRecipeId(espRecipes[0].id);
      if ((!selectedPort || !boardPorts.some(p => p.port === selectedPort)) && boardPorts.length) setSelectedPort(boardPorts[0].port);
      setStatus(`Ready · ${espRecipes.length} ESP32 research recipes · ${boardPorts.length} serial devices`);
    } catch (e) {
      setStatus(String(e));
    }
  }

  useEffect(() => { refresh(); }, []);
  useEffect(() => {
    setPreflight(null);
    setSketchDir('');
    setLines([]);
    const next = recipe?.interactive_commands?.[0];
    if (next) setCommand(next);
  }, [recipeId, recipe?.interactive_commands]);

  async function runPreflight() {
    if (!recipe) return;
    setBusy(true);
    try {
      const result = await invoke<PreflightResult>('recipe_preflight', { recipeId: recipe.id, fqbn });
      setPreflight(result);
      setStatus(result.compatible && result.core_installed && !result.missing_libraries.length ? 'Preflight ready' : 'Preflight needs attention');
    } catch (e) { setStatus(String(e)); }
    finally { setBusy(false); }
  }

  async function prepareAndCompile(upload = false) {
    if (!recipe || !compatible) return;
    if (upload && !selectedPort) { setStatus('Select a serial device before upload.'); return; }
    setBusy(true);
    try {
      let path = sketchDir;
      if (!path) {
        path = await invoke<string>('prepare_recipe', { recipeId: recipe.id });
        setSketchDir(path);
      }
      setStatus('Compiling…');
      await invoke<string>('compile_sketch', { sketchDir: path, fqbn });
      if (upload) {
        setStatus('Uploading…');
        await invoke<string>('upload_sketch', { sketchDir: path, fqbn, port: selectedPort });
        setStatus('Upload completed · run INFO or another research command');
      } else {
        setStatus('Compile completed');
      }
    } catch (e) { setStatus(String(e)); }
    finally { setBusy(false); }
  }

  async function runCommand() {
    if (!recipe || !selectedPort || !command.trim()) return;
    setBusy(true);
    try {
      setStatus(`Running ${command}…`);
      const result = await invoke<CaptureResult>('serial_exchange', {
        port: selectedPort,
        baud: recipe.baud,
        command,
        durationMs: command.startsWith('IRREG') ? 12000 : 8000,
        maxLines: 10000,
      });
      const tagged = parseTagged(result.lines);
      const summary = metricSummary(tagged);
      setLines(result.lines);
      setHistory(previous => [{
        id: Date.now(),
        recipeId: recipe.id,
        recipeTitle: recipe.title,
        command: command.trim(),
        fqbn,
        port: selectedPort,
        capturedAt: new Date().toLocaleTimeString(),
        lines: result.lines,
        rows: tagged,
        metrics: summary,
      }, ...previous].slice(0, 30));
      setStatus(`${result.lines.length} lines captured · ${tagged.length} tagged data rows · run added to history`);
    } catch (e) { setStatus(String(e)); }
    finally { setBusy(false); }
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">E</div><div><b>ESP32 Research</b><span>Numerical evidence workspace</span></div></div>
      <div className="small-card"><span>Research boundary</span><b>MCU output is evidence, not ground truth.</b></div>
      <div className="small-card"><span>Session history</span><b>{history.length} captured runs</b></div>
      <div className="sidebar-spacer"/>
      <div className="legal">Research-stage recipes<br/>Exact board profile required<br/>No GPIO assumed by these benches</div>
    </aside>

    <main>
      <header>
        <div><h1>ESP32 numerical research, inside BetterBoard.</h1><p>Compile, upload, run tagged experiments, and compare timing/numerical evidence without leaving Studio.</p></div>
        <button className="ghost" onClick={refresh} disabled={busy}><RefreshCw size={16}/> Refresh</button>
      </header>

      <section className="status-strip">
        <div><Cpu size={16}/><b>{selectedCore}</b><small>{fqbn}</small></div>
        <div><TerminalSquare size={16}/><span>{status}</span></div>
      </section>

      <section className="hero-grid">
        <div className="panel">
          <div className="panel-title"><Cable size={18}/> Target</div>
          <label>Serial device<select value={selectedPort} onChange={e => setSelectedPort(e.target.value)}>
            {!ports.length && <option value="">No serial device detected</option>}
            {ports.map(p => <option key={p.port} value={p.port}>{p.port} · {p.board_name || 'Unknown board'}</option>)}
          </select></label>
          <label>ESP32 board profile<select value={fqbn} onChange={e => setFqbn(e.target.value)}>
            {espProfiles.map(p => <option key={p.fqbn} value={p.fqbn}>{p.label}</option>)}
          </select></label>
          <div className="hint">Profile selection is explicit. USB identity alone does not establish the exact ESP32 variant.</div>
        </div>

        <div className="panel">
          <div className="panel-title"><Database size={18}/> Research recipe</div>
          <label>Experiment<select value={recipeId} onChange={e => setRecipeId(e.target.value)}>
            {recipes.map(r => <option key={r.id} value={r.id}>{r.title}</option>)}
          </select></label>
          <p className="muted">{recipe?.description}</p>
          <div className="schema-row"><span>{recipe?.sketch_name}.ino</span><span>{recipe?.baud} baud</span><span>{recipe?.research_stage ? 'research-stage' : 'canonical'}</span></div>
          <div className="boundary">{compatible ? 'Compatible with selected ESP32 core.' : 'Blocked: selected recipe/core are not declared compatible.'}</div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-title"><Wrench size={18}/> Build & upload gate</div>
        <div className="action-row">
          <button className="ghost" disabled={busy || !recipe} onClick={runPreflight}><Wrench size={16}/> Preflight</button>
          <button className="ghost" disabled={busy || !recipe || !compatible} onClick={() => prepareAndCompile(false)}><Braces size={16}/> Prepare & compile</button>
          <button className="primary" disabled={busy || !recipe || !compatible || !selectedPort} onClick={() => prepareAndCompile(true)}><Upload size={16}/> Compile & upload</button>
        </div>
        {preflight && <div className="preflight">
          <div><span>Compatibility</span><b className={preflight.compatible ? 'ok' : 'warn'}>{preflight.compatible ? 'ready' : 'blocked'}</b></div>
          <div><span>Core</span><b className={preflight.core_installed ? 'ok' : 'warn'}>{preflight.core} · {preflight.core_installed ? 'installed' : 'missing'}</b></div>
          {preflight.warnings.map(w => <small key={w}>• {w}</small>)}
        </div>}
      </section>

      <section className="data-grid">
        <div className="panel">
          <div className="panel-title"><Play size={18}/> Interactive research command</div>
          <label>Preset<select value={command} onChange={e => setCommand(e.target.value)}>
            {(recipe?.interactive_commands || []).map(c => <option key={c} value={c}>{c}</option>)}
          </select></label>
          <label>Command<input value={command} onChange={e => setCommand(e.target.value)} placeholder="INFO" /></label>
          <button className="primary" disabled={busy || !selectedPort || !command.trim()} onClick={runCommand}><Play size={16}/> Run & capture</button>
          <div className="hint">Commands are one-line, recipe-defined experiments. BetterBoard captures the tagged response through its own serial path.</div>
        </div>

        <div className="panel">
          <div className="panel-title"><Activity size={18}/> Latest evidence</div>
          {!metrics.length ? <div className="empty">No tagged research rows yet. Upload a research recipe, then run a preset.</div> : <div className="channels">
            {metrics.map(m => <div key={m.label}><span>{m.label}</span><b>{m.value}</b><small>{m.detail}</small></div>)}
          </div>}
          {!!parsed.length && <div className="schema-row"><span>{parsed.length} tagged rows</span><span>latest: {parsed.at(-1)?.kind}</span><span>{comments.length} metadata/control lines</span></div>}
        </div>
      </section>

      <section className="panel">
        <div className="panel-title"><Activity size={18}/> Session comparison</div>
        {!history.length ? <div className="empty">Run history is empty. Each successful command capture will be preserved for this BetterBoard session.</div> : <>
          <div className="action-row"><button className="ghost" onClick={() => setHistory([])}>Clear session history</button><span className="muted">Keeps up to 30 runs in memory; no claim of calibrated truth.</span></div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th align="left">Time</th><th align="left">Command</th><th align="left">Recipe</th><th align="left">Tagged rows</th><th align="left">Primary live metric</th></tr></thead>
              <tbody>{history.slice(0, 12).map(run => <tr key={run.id}>
                <td>{run.capturedAt}</td><td><code>{run.command}</code></td><td>{run.recipeTitle}</td><td>{run.rows.length}</td><td>{run.metrics[0] ? `${run.metrics[0].label}: ${run.metrics[0].value}` : 'metadata/control only'}</td>
              </tr>)}</tbody>
            </table>
          </div>
        </>}
      </section>

      <section className="panel">
        <div className="panel-title"><Database size={18}/> Comparable run magnitude</div>
        {!comparableRuns.length ? <div className="empty">Run JITTER, WIFIJITTER, REDUCE, IRREG, or TAYLOR to build an in-session comparison.</div> : <div className="channels">
          {comparableRuns.map(({ run, metric }) => metric && <div key={run.id}>
            <span>{run.command}</span>
            <b>{metric.value.toExponential(4)} {metric.unit}</b>
            <small>{metric.label} · relative bar {comparisonMax > 0 ? `${(metric.value / comparisonMax * 100).toFixed(1)}%` : '0%'}</small>
            <progress value={comparisonMax > 0 ? metric.value / comparisonMax : 0} max={1} style={{ width: '100%' }}/>
          </div>)}
        </div>}
        <div className="hint">Bars compare only the selected MCU-reported magnitude within this session. Different metric families are not scientifically interchangeable; host analyzers remain required for reference-based accuracy comparisons.</div>
      </section>

      <section className="panel">
        <div className="panel-title"><TerminalSquare size={18}/> Research stream</div>
        {!lines.length ? <div className="empty">No serial response captured in this workspace yet.</div> : <pre className="terminal">{lines.join('\n')}</pre>}
      </section>

      <section className="panel">
        <div className="panel-title"><Database size={18}/> Interpretation boundary</div>
        <p className="muted">{recipe?.boundary || 'Select a research recipe.'}</p>
        <div className="hint">The live cards summarize MCU-reported rows only. High-precision host analyzers remain the reference layer for accuracy, ULP, analytic derivative/integral, or truth claims.</div>
      </section>
    </main>
  </div>;
}
