#!/usr/bin/env python3
from __future__ import annotations
from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parents[1]
LIB = ROOT / 'src-tauri' / 'src' / 'lib.rs'
APP = ROOT / 'src' / 'App.tsx'
MONITOR = ROOT / 'src' / 'MonitorDataStudio.tsx'
CSS = ROOT / 'src' / 'monitor-data.css'
CHECK = ROOT / 'scripts' / 'self_check.py'
PACKAGE = ROOT / 'package.json'
PACKAGE_LOCK = ROOT / 'package-lock.json'
CARGO = ROOT / 'src-tauri' / 'Cargo.toml'
TAURI = ROOT / 'src-tauri' / 'tauri.conf.json'


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one anchor, found {count}')
    return text.replace(old, new, 1)


# ---------------- Rust: history/replay API + register TX ----------------
lib = LIB.read_text()

struct_anchor = '''#[derive(Debug, Serialize)]
struct BridgeDocs {'''
structs = '''#[derive(Debug, Clone, Serialize)]
struct MeasurementSessionSummary {
    directory: String,
    created_at_utc: String,
    recipe_id: String,
    recipe_title: String,
    acquisition_mode: String,
    board_profile: String,
    port: String,
    sample_count: usize,
    csv_path: String,
    metadata_path: String,
    physical_lab_csv_path: String,
    physical_lab_bridge_path: String,
}

#[derive(Debug, Serialize)]
struct MeasurementReplay {
    session: MeasurementSessionSummary,
    columns: Vec<String>,
    units: Vec<String>,
    primary_column: Option<String>,
    sample_rate_hz: Option<f64>,
    rows: Vec<CapturedRow>,
}

#[derive(Debug, Serialize)]
struct BridgeDocs {'''
if 'struct MeasurementSessionSummary' not in lib:
    lib = replace_once(lib, struct_anchor, structs, 'Rust history structs')

history_anchor = '''fn valid_measurement_rows(recipe: &RecipeSpec, rows: Vec<CapturedRow>) -> Vec<CapturedRow> {'''
history_code = r'''fn measurement_summary_from_dir(dir: &Path) -> Result<MeasurementSessionSummary, String> {
    let metadata_path = dir.join("metadata.json");
    let metadata_text = fs::read_to_string(&metadata_path)
        .map_err(|e| format!("Could not read {}: {e}", metadata_path.display()))?;
    let metadata: MeasurementMetadata = serde_json::from_str(&metadata_text)
        .map_err(|e| format!("Invalid measurement metadata in {}: {e}", metadata_path.display()))?;

    Ok(MeasurementSessionSummary {
        directory: dir.display().to_string(),
        created_at_utc: metadata.created_at_utc,
        recipe_id: metadata.recipe_id,
        recipe_title: metadata.recipe_title,
        acquisition_mode: metadata.acquisition_mode,
        board_profile: metadata.board_profile,
        port: metadata.port,
        sample_count: metadata.sample_count,
        csv_path: dir.join("data.csv").display().to_string(),
        metadata_path: metadata_path.display().to_string(),
        physical_lab_csv_path: dir.join("physical_lab_v1.csv").display().to_string(),
        physical_lab_bridge_path: dir.join("physical_lab_bridge.json").display().to_string(),
    })
}

fn validated_measurement_dir(directory: &str) -> Result<PathBuf, String> {
    let base = measurement_base_dir();
    fs::create_dir_all(&base).map_err(|e| e.to_string())?;
    let base = fs::canonicalize(&base).map_err(|e| e.to_string())?;
    let requested = fs::canonicalize(directory)
        .map_err(|e| format!("Measurement session does not exist: {e}"))?;
    if !requested.starts_with(&base) || !requested.is_dir() {
        return Err("Replay is restricted to BetterBoard measurement session directories.".into());
    }
    Ok(requested)
}

#[tauri::command]
fn measurement_sessions(limit: usize) -> Result<Vec<MeasurementSessionSummary>, String> {
    if limit == 0 || limit > 200 {
        return Err("limit must be within 1..200".into());
    }
    let base = measurement_base_dir();
    if !base.exists() {
        return Ok(Vec::new());
    }

    let mut sessions = fs::read_dir(&base)
        .map_err(|e| format!("Could not read measurement history: {e}"))?
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .filter(|path| path.is_dir())
        .filter_map(|path| measurement_summary_from_dir(&path).ok())
        .collect::<Vec<_>>();
    sessions.sort_by(|a, b| b.created_at_utc.cmp(&a.created_at_utc));
    sessions.truncate(limit);
    Ok(sessions)
}

#[tauri::command]
fn measurement_session_load(directory: String) -> Result<MeasurementReplay, String> {
    let dir = validated_measurement_dir(&directory)?;
    let session = measurement_summary_from_dir(&dir)?;
    let metadata_text = fs::read_to_string(dir.join("metadata.json")).map_err(|e| e.to_string())?;
    let metadata: MeasurementMetadata = serde_json::from_str(&metadata_text).map_err(|e| e.to_string())?;

    let timestamp_text = fs::read_to_string(dir.join("physical_lab_v1.csv")).unwrap_or_default();
    let timestamps = timestamp_text
        .lines()
        .skip(1)
        .filter_map(|line| line.split(',').next()?.trim().parse::<i64>().ok())
        .collect::<Vec<_>>();

    let data_text = fs::read_to_string(dir.join("data.csv"))
        .map_err(|e| format!("Could not read replay dataset: {e}"))?;
    let mut lines = data_text.lines();
    let header = lines.next().unwrap_or_default();
    if header.split(',').map(str::trim).collect::<Vec<_>>() != metadata.columns {
        return Err("Replay dataset header does not match its metadata schema.".into());
    }

    let fallback_start = chrono::DateTime::parse_from_rfc3339(&metadata.created_at_utc)
        .map(|value| value.timestamp_millis())
        .unwrap_or(0);
    let mut rows = Vec::new();
    for (index, line) in lines.enumerate() {
        if rows.len() >= 100_000 {
            break;
        }
        let value = line.trim();
        if value.is_empty() {
            continue;
        }
        let numeric = value
            .split(',')
            .all(|part| part.trim().parse::<f64>().is_ok());
        if !numeric || value.split(',').count() != metadata.columns.len() {
            continue;
        }
        rows.push(CapturedRow {
            host_timestamp_ms: timestamps
                .get(index)
                .copied()
                .unwrap_or(fallback_start + index as i64),
            line: value.to_string(),
            numeric: true,
        });
    }

    Ok(MeasurementReplay {
        session,
        columns: metadata.columns,
        units: metadata.units,
        primary_column: metadata.primary_column,
        sample_rate_hz: metadata.sample_rate_hz,
        rows,
    })
}

fn valid_measurement_rows(recipe: &RecipeSpec, rows: Vec<CapturedRow>) -> Vec<CapturedRow> {'''
if 'fn measurement_sessions(' not in lib:
    lib = replace_once(lib, history_anchor, history_code, 'Rust measurement history functions')

handler_old = '''            capture_measurement,
            save_measurement_buffer,
            serial_stream::serial_stream_start,
            serial_stream::serial_stream_stop,'''
handler_new = '''            capture_measurement,
            save_measurement_buffer,
            measurement_sessions,
            measurement_session_load,
            serial_stream::serial_stream_start,
            serial_stream::serial_stream_write,
            serial_stream::serial_stream_stop,'''
lib = replace_once(lib, handler_old, handler_new, 'Rust handler registration')
lib = lib.replace('const APP_VERSION: &str = "0.2.0-alpha.1";', 'const APP_VERSION: &str = "0.2.0-alpha.2";')
LIB.write_text(lib)

# ---------------- Frontend: TX + sessions/replay + Bridge merged into Monitor & Data ----------------
monitor = MONITOR.read_text()

icons_old = '''  Activity, CircleAlert, Database, Eraser, Gauge, Play, Radio, Save, Square,
  TerminalSquare, Waves,'''
icons_new = '''  Activity, CircleAlert, Database, Eraser, Gauge, History, Link2, Play, Radio, RefreshCw,
  Save, Send, Square, TerminalSquare, Waves,'''
monitor = replace_once(monitor, icons_old, icons_new, 'Monitor icon imports')

row_old = '''type MonitorRow = {
  hostTimestampMs: number;
  line: string;
  numeric: boolean;
};'''
row_new = '''type MonitorRow = {
  hostTimestampMs: number;
  line: string;
  numeric: boolean;
  direction?: 'rx' | 'tx';
};

type BridgeDocs = {
  hardware_map: string;
  serial_protocol: string;
  honeycomb_guide: string;
};

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

type MeasurementReplay = {
  session: MeasurementSessionSummary;
  columns: string[];
  units: string[];
  primary_column?: string | null;
  sample_rate_hz?: number | null;
  rows: Array<{ host_timestamp_ms: number; line: string; numeric: boolean }>;
};'''
monitor = replace_once(monitor, row_old, row_new, 'Monitor history types')

props_old = '''  fqbn: string;
  onStatus?: (status: string) => void;
  onMeasurement?: (measurement: MeasurementResult) => void;
};'''
props_new = '''  fqbn: string;
  latestMeasurement?: MeasurementResult | null;
  bridgeDocs?: BridgeDocs | null;
  onStatus?: (status: string) => void;
  onMeasurement?: (measurement: MeasurementResult) => void;
};'''
monitor = replace_once(monitor, props_old, props_new, 'Monitor props')

signature_old = '''export default function MonitorDataStudio({ recipe, selectedPort, fqbn, onStatus, onMeasurement }: Props) {'''
signature_new = '''export default function MonitorDataStudio({ recipe, selectedPort, fqbn, latestMeasurement, bridgeDocs, onStatus, onMeasurement }: Props) {'''
monitor = replace_once(monitor, signature_old, signature_new, 'Monitor component signature')

states_old = '''  const [measurement, setMeasurement] = useState<MeasurementResult | null>(null);
  const [busy, setBusy] = useState(false);
  const channelRef = useRef<Channel<SerialStreamEvent> | null>(null);'''
states_new = '''  const [measurement, setMeasurement] = useState<MeasurementResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [txText, setTxText] = useState('');
  const [lineEnding, setLineEnding] = useState<'none' | 'lf' | 'cr' | 'crlf'>('lf');
  const [sessions, setSessions] = useState<MeasurementSessionSummary[]>([]);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [replay, setReplay] = useState<MeasurementReplay | null>(null);
  const channelRef = useRef<Channel<SerialStreamEvent> | null>(null);'''
monitor = replace_once(monitor, states_old, states_new, 'Monitor states')

cleanup_effect = '''  useEffect(() => {
    return () => {
      void invoke('serial_stream_stop').catch(() => undefined);
    };
  }, []);

  const numericRows = useMemo(() => rows
    .map(row => parseNumericRow(row, recipe?.columns.length ?? 0))
    .filter((value): value is number[] => value !== null), [rows, recipe?.columns.length]);'''
new_effects = '''  useEffect(() => {
    return () => {
      void invoke('serial_stream_stop').catch(() => undefined);
    };
  }, []);

  useEffect(() => { void refreshSessions(); }, []);

  const displayRows = useMemo<MonitorRow[]>(() => replay
    ? replay.rows.map(row => ({ hostTimestampMs: row.host_timestamp_ms, line: row.line, numeric: row.numeric, direction: 'rx' as const }))
    : rows, [replay, rows]);
  const activeColumns = replay?.columns ?? recipe?.columns ?? [];
  const activeUnits = replay?.units ?? recipe?.units ?? [];
  const activePrimary = replay?.primary_column ?? recipe?.primary_column;

  const numericRows = useMemo(() => displayRows
    .map(row => parseNumericRow(row, activeColumns.length))
    .filter((value): value is number[] => value !== null), [displayRows, activeColumns.length]);'''
monitor = replace_once(monitor, cleanup_effect, new_effects, 'Monitor replay data source')

parse_old = '''function parseNumericRow(row: MonitorRow, expectedColumns: number): number[] | null {
  if (!row.numeric) return null;'''
parse_new = '''function parseNumericRow(row: MonitorRow, expectedColumns: number): number[] | null {
  if (row.direction === 'tx' || !row.numeric) return null;'''
monitor = replace_once(monitor, parse_old, parse_new, 'Monitor TX exclusion')

rx_old = '''          hostTimestampMs: message.host_timestamp_ms,
          line: message.line,
          numeric: message.numeric,
        }].slice(-MAX_MONITOR_ROWS));'''
rx_new = '''          hostTimestampMs: message.host_timestamp_ms,
          line: message.line,
          numeric: message.numeric,
          direction: 'rx' as const,
        }].slice(-MAX_MONITOR_ROWS));'''
monitor = replace_once(monitor, rx_old, rx_new, 'Live RX typing')

snapshot_old = '''        hostTimestampMs: now + index,
        line,
        numeric: line.split(',').every(part => Number.isFinite(Number(part.trim()))),
      })));'''
snapshot_new = '''        hostTimestampMs: now + index,
        line,
        numeric: line.split(',').every(part => Number.isFinite(Number(part.trim()))),
        direction: 'rx' as const,
      })));'''
monitor = replace_once(monitor, snapshot_old, snapshot_new, 'Snapshot RX typing')

capture_anchor = '''  async function captureSnapshot() {'''
functions = '''  async function refreshSessions() {
    setHistoryBusy(true);
    try {
      const result = await invoke<MeasurementSessionSummary[]>('measurement_sessions', { limit: 50 });
      setSessions(result);
    } catch (error) {
      report(`Could not load measurement history: ${error}`);
    } finally {
      setHistoryBusy(false);
    }
  }

  async function loadReplay(session: MeasurementSessionSummary) {
    setHistoryBusy(true);
    try {
      const result = await invoke<MeasurementReplay>('measurement_session_load', { directory: session.directory });
      setReplay(result);
      const primaryIndex = result.primary_column ? result.columns.indexOf(result.primary_column) : -1;
      setSelectedChannel(primaryIndex >= 0 ? primaryIndex : Math.max(result.columns.length - 1, 0));
      report(`Replay loaded · ${result.session.recipe_title} · ${result.rows.length} rows`);
    } catch (error) {
      report(`Replay failed: ${error}`);
    } finally {
      setHistoryBusy(false);
    }
  }

  async function sendSerial() {
    if (monitorState !== 'live') {
      report('Start Live Monitor before sending serial data.');
      return;
    }
    if (!txText.length) return;
    const outgoing = txText;
    try {
      const bytes = await invoke<number>('serial_stream_write', { text: outgoing, lineEnding });
      setRows(current => [...current, {
        hostTimestampMs: Date.now(),
        line: outgoing,
        numeric: false,
        direction: 'tx' as const,
      }].slice(-MAX_MONITOR_ROWS));
      setTxText('');
      report(`Sent ${bytes} byte(s) · ${lineEnding.toUpperCase()} ending`);
    } catch (error) {
      report(`Serial send failed: ${error}`);
    }
  }

  async function captureSnapshot() {'''
monitor = replace_once(monitor, capture_anchor, functions, 'Monitor history/TX functions')

record_tail_old = '''      setMeasurement(result);
      onMeasurement?.(result);
      report(`${result.samples} samples saved · ${result.directory}`);'''
record_tail_new = '''      setMeasurement(result);
      setReplay(null);
      onMeasurement?.(result);
      await refreshSessions();
      report(`${result.samples} samples saved · ${result.directory}`);'''
monitor = replace_once(monitor, record_tail_old, record_tail_new, 'Refresh history after record')

selected_old = '''  const selectedColumn = recipe?.columns[selectedChannel] ?? `channel_${selectedChannel + 1}`;
  const selectedUnit = recipe?.units[selectedChannel] ?? '';'''
selected_new = '''  const selectedColumn = activeColumns[selectedChannel] ?? `channel_${selectedChannel + 1}`;
  const selectedUnit = activeUnits[selectedChannel] ?? '';
  const activePackage = replay?.session ?? measurement ?? latestMeasurement ?? null;'''
monitor = replace_once(monitor, selected_old, selected_new, 'Active replay schema/package')

status_old = '''      <TerminalSquare size={14}/><span>{monitorMessage}</span>
      <span className="monitor-count">{rows.length} buffered rows</span>'''
status_new = '''      <TerminalSquare size={14}/><span>{monitorMessage}</span>
      {replay && <button className="replay-pill" onClick={() => setReplay(null)}>REPLAY · {replay.session.recipe_title} · return to live</button>}
      <span className="monitor-count">{replay ? `${displayRows.length} replay rows` : `${rows.length} buffered rows`}</span>'''
monitor = replace_once(monitor, status_old, status_new, 'Replay status')

plot_condition_old = '''        {recipe?.capture_mode === 'text' ? <div className="empty">This recipe is diagnostic text. Use the Serial Monitor panel instead of numeric plotting.</div> : <>'''
plot_condition_new = '''        {!replay && recipe?.capture_mode === 'text' ? <div className="empty">This recipe is diagnostic text. Use the Serial Monitor panel instead of numeric plotting.</div> : <>'''
monitor = replace_once(monitor, plot_condition_old, plot_condition_new, 'Replay numeric plot condition')

channel_old = '''            {(recipe?.columns ?? []).map((column, index) => <button key={column} className={selectedChannel === index ? 'active' : ''} onClick={() => setSelectedChannel(index)}><span>{column}</span><b>{latestValues[index] ?? '—'}</b><small>{recipe?.units[index] ?? ''}</small></button>)}
          </div>
          {!recipe?.columns.length && <div className="empty compact">Numeric CSV is visible, but this recipe does not declare channel names.</div>}'''
channel_new = '''            {activeColumns.map((column, index) => <button key={column} className={selectedChannel === index ? 'active' : ''} onClick={() => setSelectedChannel(index)}><span>{column}</span><b>{latestValues[index] ?? '—'}</b><small>{activeUnits[index] ?? ''}</small></button>)}
          </div>
          {!activeColumns.length && <div className="empty compact">Numeric CSV is visible, but this dataset does not declare channel names.</div>}'''
monitor = replace_once(monitor, channel_old, channel_new, 'Replay channel schema')

console_old = '''        <div className="panel-title"><TerminalSquare size={18}/> Serial monitor</div>
        {!rows.length ? <div className="empty">Start Live Monitor to see the continuous serial stream, or take a one-time snapshot.</div> : <div className="serial-console">{rows.slice(-600).map((row, index) => <div key={`${row.hostTimestampMs}-${index}`}><span>{new Date(row.hostTimestampMs).toLocaleTimeString([], { hour12: false })}</span><code>{row.line}</code></div>)}</div>}'''
console_new = '''        <div className="panel-title"><TerminalSquare size={18}/> Serial monitor</div>
        <div className="monitor-transmit">
          <input value={txText} disabled={monitorState !== 'live'} onChange={event => setTxText(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void sendSerial(); } }} placeholder={monitorState === 'live' ? 'Send text or command to the board…' : 'Start Live Monitor to send'} aria-label="Serial transmit text" />
          <select value={lineEnding} disabled={monitorState !== 'live'} onChange={event => setLineEnding(event.target.value as typeof lineEnding)} aria-label="Serial line ending">
            <option value="none">No line ending</option><option value="lf">Newline (LF)</option><option value="cr">Carriage return (CR)</option><option value="crlf">Both NL & CR</option>
          </select>
          <button className="primary" disabled={monitorState !== 'live' || !txText.length} onClick={() => void sendSerial()}><Send size={14}/> Send</button>
        </div>
        {!displayRows.length ? <div className="empty">Start Live Monitor to see the continuous serial stream, take a snapshot, or replay a saved session.</div> : <div className="serial-console">{displayRows.slice(-600).map((row, index) => <div key={`${row.hostTimestampMs}-${index}`} className={row.direction === 'tx' ? 'tx' : 'rx'}><span>{new Date(row.hostTimestampMs).toLocaleTimeString([], { hour12: false })}</span><code>{row.direction === 'tx' ? 'TX › ' : replay ? 'REPLAY · ' : 'RX · '}{row.line}</code></div>)}</div>}'''
monitor = replace_once(monitor, console_old, console_new, 'Bidirectional/replay console')

context_old = '''          <span>Recipe</span><b>{recipe?.title ?? '—'}</b>
          <span>Port</span><b>{selectedPort || '—'}</b>
          <span>Baud</span><b>{baud}</b>
          <span>Schema</span><b>{recipe?.columns.length ? `${recipe.columns.length} channels` : recipe?.capture_mode ?? '—'}</b>
          <span>Declared rate</span><b>{recipe?.sample_rate_hz ? `${recipe.sample_rate_hz} Hz` : 'event / unspecified'}</b>
          <span>Primary</span><b>{recipe?.primary_column || selectedColumn}</b>'''
context_new = '''          <span>Mode</span><b>{replay ? 'Historical replay' : 'Live / acquisition'}</b>
          <span>Recipe</span><b>{replay?.session.recipe_title ?? recipe?.title ?? '—'}</b>
          <span>Port</span><b>{replay?.session.port ?? selectedPort || '—'}</b>
          <span>Baud</span><b>{replay ? 'recorded session' : baud}</b>
          <span>Schema</span><b>{activeColumns.length ? `${activeColumns.length} channels` : recipe?.capture_mode ?? '—'}</b>
          <span>Declared rate</span><b>{(replay?.sample_rate_hz ?? recipe?.sample_rate_hz) ? `${replay?.sample_rate_hz ?? recipe?.sample_rate_hz} Hz` : 'event / unspecified'}</b>
          <span>Primary</span><b>{activePrimary || selectedColumn}</b>'''
monitor = replace_once(monitor, context_old, context_new, 'Replay session context')

end_anchor = '''    </div>
  </section>;
}'''
history_ui = '''    </div>

    <div className="monitor-history-grid">
      <div className="panel monitor-history-panel">
        <div className="panel-title"><History size={18}/> Measurement sessions <button className="ghost mini" disabled={historyBusy} onClick={() => void refreshSessions()}><RefreshCw size={13}/> Refresh</button></div>
        {!sessions.length ? <div className="empty compact">No saved BetterBoard measurement sessions yet.</div> : <div className="session-list">{sessions.map(session => <div className={`session-row ${replay?.session.directory === session.directory ? 'active' : ''}`} key={session.directory}>
          <div><b>{session.recipe_title}</b><span>{new Date(session.created_at_utc).toLocaleString()} · {session.sample_count} samples · {session.acquisition_mode}</span><small>{session.directory}</small></div>
          <button className="ghost" disabled={historyBusy} onClick={() => void loadReplay(session)}>Replay</button>
        </div>)}</div>}
      </div>

      <div className="panel monitor-export-panel">
        <div className="panel-title"><Link2 size={18}/> Physical Lab export</div>
        <p className="muted">The old standalone Bridge entry is now part of the data workflow: acquire or replay evidence here, then use the full CSV, metadata, compatibility CSV, or bridge manifest.</p>
        {activePackage ? <div className="measurement big"><b>{activePackage.sample_count ?? activePackage.samples} samples</b><span>Full: {activePackage.csv_path}</span><span>Metadata: {activePackage.metadata_path}</span><span>Physical Lab v1: {activePackage.physical_lab_csv_path}</span><span>Bridge: {activePackage.physical_lab_bridge_path}</span></div> : <div className="empty compact">Record or replay a measurement to expose its export package.</div>}
        <div className="boundary"><CircleAlert size={14}/> A serial acquisition is evidence, not automatic proof of calibration, uncertainty, traceability, alignment, or model validity.</div>
        {bridgeDocs?.hardware_map && <details className="bridge-details"><summary>Physical Lab hardware map</summary><pre className="docs-preview">{bridgeDocs.hardware_map}</pre></details>}
      </div>
    </div>
  </section>;
}'''
monitor = replace_once(monitor, end_anchor, history_ui, 'History/export UI')
MONITOR.write_text(monitor)

# ---------------- App: remove standalone Bridge route and pass context into data workspace ----------------
app = APP.read_text()
app = app.replace('  Cpu, Download, FileText, Gauge, Link2, Magnet, Play, RefreshCw, RotateCw,\n', '  Cpu, Download, Gauge, Magnet, Play, RefreshCw, RotateCw,\n')
app = replace_once(app, "type Tab = 'hardware' | 'circuit' | 'library' | 'data' | 'bridge' | 'developer';", "type Tab = 'hardware' | 'circuit' | 'library' | 'data' | 'developer';", 'App tab type')
app = replace_once(app, "    ['hardware', Cpu, 'Hardware & Program'], ['circuit', CircuitBoard, 'Circuit Lab'], ['library', Boxes, 'Recipe Library'], ['data', Waves, 'Monitor & Data'],\n    ['bridge', Link2, 'Physical Lab Bridge'], ['developer', Code2, 'Developer'],", "    ['hardware', Cpu, 'Hardware & Program'], ['circuit', CircuitBoard, 'Circuit Lab'], ['library', Boxes, 'Recipe Library'], ['data', Waves, 'Monitor & Data'],\n    ['developer', Code2, 'Developer'],", 'App navigation')
app = replace_once(app, '''        fqbn={fqbn}
        onStatus={setStatus}
        onMeasurement={setMeasurement}
      />}''', '''        fqbn={fqbn}
        latestMeasurement={measurement}
        bridgeDocs={bridgeDocs}
        onStatus={setStatus}
        onMeasurement={setMeasurement}
      />}''', 'Monitor context props')
bridge_pattern = re.compile(r"\n      \{tab === 'bridge' && <>.*?\n      </>\}\n\n      \{tab === 'developer'", re.S)
app, n = bridge_pattern.subn("\n      {tab === 'developer'", app, count=1)
if n != 1:
    raise SystemExit(f'App Bridge panel removal: expected 1 match, got {n}')
APP.write_text(app)

# ---------------- CSS ----------------
css = CSS.read_text()
if '.monitor-transmit{' not in css:
    css += r'''
.monitor-transmit{display:grid;grid-template-columns:minmax(150px,1fr) 150px auto;gap:7px;margin-bottom:8px}.monitor-transmit input,.monitor-transmit select{min-width:0;padding:8px 9px!important}.serial-console>div.tx{background:rgba(126,140,255,.065)}.serial-console>div.tx span{color:#8f9dff}.serial-console>div.tx code{color:#d8dcff}.serial-console>div.rx code{color:#c8d8e8}.replay-pill{border:1px solid rgba(126,140,255,.32);background:rgba(126,140,255,.08);border-radius:999px;padding:4px 9px;font-size:11px;color:inherit;cursor:pointer}.monitor-history-grid{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,.95fr);gap:12px}.monitor-history-panel .panel-title{display:flex;align-items:center;gap:7px}.monitor-history-panel .panel-title .mini{margin-left:auto;padding:5px 8px}.session-list{display:grid;gap:7px;max-height:360px;overflow:auto}.session-row{display:flex;gap:10px;align-items:center;justify-content:space-between;padding:9px;border:1px solid var(--line);border-radius:10px}.session-row.active{border-color:rgba(126,140,255,.55);background:rgba(126,140,255,.06)}.session-row>div{display:grid;gap:2px;min-width:0}.session-row span,.session-row small{font-size:11px;opacity:.72;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.bridge-details{margin-top:9px}.bridge-details summary{cursor:pointer;font-size:12px;font-weight:650}.monitor-export-panel .measurement span{overflow-wrap:anywhere}
@media(max-width:900px){.monitor-history-grid{grid-template-columns:1fr}}@media(max-width:760px){.monitor-transmit{grid-template-columns:1fr}.monitor-transmit button{width:100%}.session-row{align-items:flex-start;flex-direction:column}.session-row button{width:100%}}
'''
CSS.write_text(css)

# ---------------- Version alpha.2 ----------------
def bump(path: Path):
    text = path.read_text()
    if '0.2.0-alpha.1' in text:
        text = text.replace('0.2.0-alpha.1', '0.2.0-alpha.2')
    path.write_text(text)

for path in [PACKAGE, CARGO, TAURI]:
    bump(path)
if PACKAGE_LOCK.exists():
    bump(PACKAGE_LOCK)

# ---------------- Self-check contracts ----------------
check = CHECK.read_text()
check = replace_once(check, '''    assert 'serial_stream_start' in monitor_text
    assert 'serial_stream_stop' in monitor_text''', '''    assert 'serial_stream_start' in monitor_text
    assert 'serial_stream_write' in monitor_text
    assert 'serial_stream_stop' in monitor_text
    assert 'measurement_sessions' in monitor_text
    assert 'measurement_session_load' in monitor_text
    assert 'No line ending' in monitor_text
    assert "direction === 'tx'" in monitor_text
    assert 'Measurement sessions' in monitor_text
    assert 'Physical Lab export' in monitor_text
    assert 'fn measurement_sessions(' in rust
    assert 'fn measurement_session_load(' in rust
    assert 'serial_stream::serial_stream_write' in rust''', 'Self-check monitor/history assertions')
check = replace_once(check, '''    assert 'Monitor & Data' in app_text
    assert 'Shared hardware session' in app_text''', '''    assert 'Monitor & Data' in app_text
    assert "| 'bridge'" not in app_text
    assert "['bridge'," not in app_text
    assert "{tab === 'bridge'" not in app_text
    assert 'Shared hardware session' in app_text''', 'Self-check Bridge removal')
check = check.replace("assert package['version'] == '0.2.0-alpha.1'", "assert package['version'] == '0.2.0-alpha.2'")
check = check.replace("assert tauri['version'] == '0.2.0-alpha.1'", "assert tauri['version'] == '0.2.0-alpha.2'")
check = check.replace("assert '0.2.0-alpha.1' in (ROOT / 'src-tauri' / 'Cargo.toml').read_text()", "assert '0.2.0-alpha.2' in (ROOT / 'src-tauri' / 'Cargo.toml').read_text()")
check = check.replace("BetterBoard Studio v0.2 self-check: PASS", "BetterBoard Studio v0.2.0-alpha.2 self-check: PASS")
check = check.replace("print('- persistent live Serial Monitor handlers registered')", "print('- persistent bidirectional Serial Monitor handlers registered')\n    print('- historical Measurement Sessions + replay registered')\n    print('- Physical Lab Bridge merged into Monitor & Data')")
CHECK.write_text(check)

print('alpha.2 finalization refactor applied: TX + Bridge merge + history/replay + version bump')
