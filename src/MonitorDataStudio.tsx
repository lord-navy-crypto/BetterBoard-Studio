import { useEffect, useMemo, useRef, useState } from 'react';
import { Channel, invoke } from '@tauri-apps/api/core';
import {
  Activity, CircleAlert, Database, Eraser, Gauge, History, Link2, Radio, RefreshCw,
  Save, Send, Square, TerminalSquare, Waves,
} from 'lucide-react';
import type { TaskCategory, TaskState } from './TaskCenter';

type RecipeSpec = {
  id: string;
  title: string;
  category: string;
  capture_mode: 'none' | 'numeric' | 'text';
  baud: number;
  columns: string[];
  units: string[];
  primary_column?: string | null;
  sample_rate_hz?: number | null;
};

type MeasurementResult = {
  directory: string;
  csv_path: string;
  metadata_path: string;
  physical_lab_csv_path: string;
  physical_lab_bridge_path: string;
  samples: number;
};

type CaptureResult = {
  lines: string[];
  numeric_rows: number;
  ignored_rows: number;
};

type SerialStreamEvent = {
  event: 'started' | 'line' | 'stopped' | 'error';
  host_timestamp_ms: number;
  line: string;
  numeric: boolean;
};

type MonitorRow = {
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
};

type Props = {
  recipe?: RecipeSpec;
  selectedPort: string;
  fqbn: string;
  latestMeasurement?: MeasurementResult | null;
  bridgeDocs?: BridgeDocs | null;
  onStatus?: (status: string) => void;
  onMeasurement?: (measurement: MeasurementResult) => void;
  onTaskStart?: (category: TaskCategory, title: string, detail?: string, cancel?: () => Promise<void> | void) => number;
  onTaskLog?: (id: number, message: string) => void;
  onTaskFinish?: (id: number, state: Exclude<TaskState, 'running'>, detail: string) => void;
};

const BAUD_OPTIONS = [9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600];
const MAX_MONITOR_ROWS = 2500;
const MAX_PLOT_POINTS = 240;

function parseNumericRow(row: MonitorRow, expectedColumns: number): number[] | null {
  if (row.direction === 'tx' || !row.numeric) return null;
  const parts = row.line.split(',').map(value => Number(value.trim()));
  if (!parts.length || parts.some(value => !Number.isFinite(value))) return null;
  if (expectedColumns > 0 && parts.length !== expectedColumns) return null;
  return parts;
}

function makePolyline(values: number[]): string {
  if (values.length < 2) return '';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, 1e-12);
  return values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * 100;
      const y = 40 - ((value - min) / span) * 36;
      return `${x},${y}`;
    })
    .join(' ');
}

export default function MonitorDataStudio({
  recipe, selectedPort, fqbn, latestMeasurement, bridgeDocs, onStatus, onMeasurement,
  onTaskStart, onTaskLog, onTaskFinish,
}: Props) {
  const [rows, setRows] = useState<MonitorRow[]>([]);
  const [monitorState, setMonitorState] = useState<'idle' | 'starting' | 'live' | 'error'>('idle');
  const [monitorMessage, setMonitorMessage] = useState('Serial monitor is stopped.');
  const [baud, setBaud] = useState(recipe?.baud ?? 115200);
  const [numericOnly, setNumericOnly] = useState(recipe?.capture_mode === 'numeric');
  const [selectedChannel, setSelectedChannel] = useState(0);
  const [measurement, setMeasurement] = useState<MeasurementResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [txText, setTxText] = useState('');
  const [lineEnding, setLineEnding] = useState<'none' | 'lf' | 'cr' | 'crlf'>('lf');
  const [sessions, setSessions] = useState<MeasurementSessionSummary[]>([]);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [replay, setReplay] = useState<MeasurementReplay | null>(null);
  const channelRef = useRef<Channel<SerialStreamEvent> | null>(null);
  const liveTaskRef = useRef<number | null>(null);
  const liveCountRef = useRef(0);

  function beginTask(category: TaskCategory, title: string, detail: string, cancel?: () => Promise<void> | void) {
    return onTaskStart?.(category, title, detail, cancel) ?? null;
  }
  function taskLog(id: number | null, message: string) { if (id !== null) onTaskLog?.(id, message); }
  function taskFinish(id: number | null, state: Exclude<TaskState, 'running'>, detail: string) { if (id !== null) onTaskFinish?.(id, state, detail); }

  useEffect(() => {
    setBaud(recipe?.baud ?? 115200);
    setNumericOnly(recipe?.capture_mode === 'numeric');
    const primaryIndex = recipe?.primary_column ? recipe.columns.indexOf(recipe.primary_column) : -1;
    setSelectedChannel(primaryIndex >= 0 ? primaryIndex : Math.max((recipe?.columns.length ?? 1) - 1, 0));
  }, [recipe?.id]);

  useEffect(() => {
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
    .filter((value): value is number[] => value !== null), [displayRows, activeColumns.length]);

  const latestValues = numericRows.at(-1) ?? [];
  const channelValues = useMemo(() => numericRows
    .slice(-MAX_PLOT_POINTS)
    .map(parts => parts[selectedChannel])
    .filter(Number.isFinite), [numericRows, selectedChannel]);
  const polyline = useMemo(() => makePolyline(channelValues), [channelValues]);

  const lastValue = channelValues.at(-1);
  const minValue = channelValues.length ? Math.min(...channelValues) : undefined;
  const maxValue = channelValues.length ? Math.max(...channelValues) : undefined;
  const bufferedEvidenceRows = useMemo(() => rows.filter(row => parseNumericRow(row, recipe?.columns.length ?? 0) !== null), [rows, recipe?.columns.length]);

  function report(message: string) {
    setMonitorMessage(message);
    onStatus?.(message);
  }

  async function startMonitor() {
    if (!selectedPort) {
      report('Select a serial device first.');
      return;
    }
    if (monitorState === 'live' || monitorState === 'starting') return;

    setMonitorState('starting');
    report(`Opening ${selectedPort} @ ${baud} baud…`);
    liveCountRef.current = 0;
    liveTaskRef.current = beginTask('Monitor', `Live serial · ${selectedPort}`, `Opening ${selectedPort} @ ${baud} baud…`, async () => {
      await invoke<boolean>('serial_stream_stop');
    });

    const channel = new Channel<SerialStreamEvent>();
    channel.onmessage = message => {
      if (message.event === 'started') {
        setMonitorState('live');
        report(`Live · ${message.line}`);
        taskLog(liveTaskRef.current, `Serial stream opened · ${message.line}`);
        return;
      }
      if (message.event === 'line') {
        liveCountRef.current += 1;
        setRows(current => [...current, {
          hostTimestampMs: message.host_timestamp_ms,
          line: message.line,
          numeric: message.numeric,
          direction: 'rx' as const,
        }].slice(-MAX_MONITOR_ROWS));
        if (liveCountRef.current % 250 === 0) taskLog(liveTaskRef.current, `${liveCountRef.current} RX rows observed`);
        return;
      }
      if (message.event === 'error') {
        setMonitorState('error');
        report(`Serial monitor error: ${message.line}`);
        taskLog(liveTaskRef.current, message.line);
        taskFinish(liveTaskRef.current, 'failed', `Serial monitor error · ${message.line}`);
        liveTaskRef.current = null;
        return;
      }
      setMonitorState('idle');
      report('Serial monitor stopped.');
      taskFinish(liveTaskRef.current, 'done', `Serial monitor stopped · ${liveCountRef.current} RX rows`);
      liveTaskRef.current = null;
    };
    channelRef.current = channel;

    try {
      await invoke('serial_stream_start', {
        port: selectedPort,
        baud,
        numericOnly,
        onEvent: channel,
      });
    } catch (error) {
      setMonitorState('error');
      report(`Could not start serial monitor: ${error}`);
      taskLog(liveTaskRef.current, String(error));
      taskFinish(liveTaskRef.current, 'failed', `Could not start serial monitor: ${error}`);
      liveTaskRef.current = null;
    }
  }

  async function stopMonitor() {
    try {
      taskLog(liveTaskRef.current, 'Stop requested from Monitor & Data.');
      await invoke<boolean>('serial_stream_stop');
      report('Stopping serial monitor…');
    } catch (error) {
      report(`Could not stop serial monitor: ${error}`);
      taskLog(liveTaskRef.current, String(error));
    }
  }

  async function refreshSessions() {
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
    const task = beginTask('Evidence', `Replay · ${session.recipe_title}`, `Loading ${session.directory}`);
    try {
      const result = await invoke<MeasurementReplay>('measurement_session_load', { directory: session.directory });
      setReplay(result);
      const primaryIndex = result.primary_column ? result.columns.indexOf(result.primary_column) : -1;
      setSelectedChannel(primaryIndex >= 0 ? primaryIndex : Math.max(result.columns.length - 1, 0));
      const detail = `Replay loaded · ${result.rows.length} rows · ${result.columns.length} channels`;
      taskLog(task, detail); taskFinish(task, 'done', detail); report(detail);
    } catch (error) {
      taskLog(task, String(error)); taskFinish(task, 'failed', `Replay failed: ${error}`); report(`Replay failed: ${error}`);
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
      taskLog(liveTaskRef.current, `TX ${bytes} byte(s) · ${lineEnding.toUpperCase()} ending`);
      report(`Sent ${bytes} byte(s) · ${lineEnding.toUpperCase()} ending`);
    } catch (error) {
      report(`Serial send failed: ${error}`);
      taskLog(liveTaskRef.current, `TX failed: ${error}`);
    }
  }

  async function captureSnapshot() {
    if (!selectedPort) {
      report('Select a serial device first.');
      return;
    }
    if (monitorState === 'live' || monitorState === 'starting') {
      report('Stop Live Monitor before taking a separate snapshot; both operations need the same serial port.');
      return;
    }
    setBusy(true);
    const task = beginTask('Monitor', `Snapshot · ${recipe?.title || selectedPort}`, `Capturing 3 s @ ${baud} baud…`);
    try {
      report('Capturing a 3 s diagnostic snapshot…');
      const result = await invoke<CaptureResult>('serial_capture', {
        port: selectedPort,
        baud,
        durationMs: 3000,
        maxLines: 2000,
        numericOnly,
      });
      const now = Date.now();
      setRows(result.lines.map((line, index) => ({
        hostTimestampMs: now + index,
        line,
        numeric: line.split(',').every(part => Number.isFinite(Number(part.trim()))),
        direction: 'rx' as const,
      })));
      const detail = `${result.lines.length} snapshot rows · ${result.numeric_rows} numeric · ${result.ignored_rows} ignored`;
      taskLog(task, detail); taskFinish(task, 'done', detail); report(detail);
    } catch (error) {
      taskLog(task, String(error)); taskFinish(task, 'failed', `Snapshot failed: ${error}`); report(`Snapshot failed: ${error}`);
    } finally {
      setBusy(false);
    }
  }

  async function recordMeasurement() {
    if (!recipe || recipe.capture_mode !== 'numeric') {
      report('The selected recipe does not define numeric Measurement Evidence.');
      return;
    }
    if (!selectedPort) {
      report('Select a serial device first.');
      return;
    }
    if ((monitorState === 'live' || monitorState === 'starting') && !bufferedEvidenceRows.length) {
      report('Live Monitor has no complete recipe-shaped numeric rows to save yet.');
      return;
    }
    setBusy(true);
    const task = beginTask('Evidence', `Record evidence · ${recipe.title}`, monitorState === 'live' || monitorState === 'starting'
      ? `Saving ${bufferedEvidenceRows.length} structured live rows without closing serial…`
      : 'Acquiring a fresh 5 s multichannel Measurement Package…');
    try {
      let result: MeasurementResult;
      if (monitorState === 'live' || monitorState === 'starting') {
        report(`Saving ${bufferedEvidenceRows.length} buffered live rows without closing the serial port…`);
        result = await invoke<MeasurementResult>('save_measurement_buffer', {
          port: selectedPort,
          boardProfile: fqbn,
          recipeId: recipe.id,
          rows: bufferedEvidenceRows.map(row => ({
            host_timestamp_ms: row.hostTimestampMs,
            line: row.line,
            numeric: row.numeric,
          })),
        });
      } else {
        report('Recording a new 5 s full multichannel Measurement Package…');
        result = await invoke<MeasurementResult>('capture_measurement', {
          port: selectedPort,
          durationMs: 5000,
          maxLines: 10000,
          boardProfile: fqbn,
          recipeId: recipe.id,
        });
      }
      setMeasurement(result);
      setReplay(null);
      onMeasurement?.(result);
      taskLog(task, `data.csv · ${result.csv_path}`);
      taskLog(task, `metadata.json · ${result.metadata_path}`);
      taskLog(task, `Physical Lab v1 · ${result.physical_lab_csv_path}`);
      taskLog(task, `bridge · ${result.physical_lab_bridge_path}`);
      await refreshSessions();
      const detail = `${result.samples} samples saved · ${result.directory}`;
      taskFinish(task, 'done', detail); report(detail);
    } catch (error) {
      taskLog(task, String(error)); taskFinish(task, 'failed', `Measurement failed: ${error}`); report(`Measurement failed: ${error}`);
    } finally {
      setBusy(false);
    }
  }

  const stateLabel = monitorState === 'live' ? 'LIVE' : monitorState === 'starting' ? 'OPENING' : monitorState === 'error' ? 'ERROR' : 'STOPPED';
  const selectedColumn = activeColumns[selectedChannel] ?? `channel_${selectedChannel + 1}`;
  const selectedUnit = activeUnits[selectedChannel] ?? '';
  const activePackage = replay?.session ?? measurement ?? latestMeasurement ?? null;
  const activePackageSamples = replay?.session.sample_count ?? measurement?.samples ?? latestMeasurement?.samples ?? null;

  return <section className="monitor-workspace">
    <div className="monitor-toolbar panel">
      <div className="monitor-toolbar-title">
        <div className={`live-badge ${monitorState}`}><span/><b>{stateLabel}</b></div>
        <div><b>Monitor & Data</b><small>{recipe?.title || 'Select a recipe'} · {selectedPort || 'no serial device'}</small></div>
      </div>

      <div className="monitor-controls">
        <label>Baud
          <select value={baud} disabled={monitorState === 'live' || monitorState === 'starting'} onChange={event => setBaud(Number(event.target.value))}>
            {BAUD_OPTIONS.map(value => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <label className="monitor-check"><input type="checkbox" checked={numericOnly} disabled={monitorState === 'live' || monitorState === 'starting'} onChange={event => setNumericOnly(event.target.checked)}/> Numeric only</label>
        {monitorState === 'live' || monitorState === 'starting'
          ? <button className="danger-soft" onClick={() => void stopMonitor()}><Square size={15}/> Stop</button>
          : <button className="primary" disabled={!selectedPort} onClick={() => void startMonitor()}><Radio size={15}/> Start Live</button>}
        <button className="ghost" disabled={busy || monitorState === 'live' || monitorState === 'starting'} onClick={() => void captureSnapshot()}><Activity size={15}/> Snapshot 3 s</button>
        <button className="ghost" onClick={() => setRows([])}><Eraser size={15}/> Clear</button>
      </div>
    </div>

    <div className="monitor-statusline">
      <TerminalSquare size={14}/><span>{monitorMessage}</span>
      {replay && <button className="replay-pill" onClick={() => setReplay(null)}>REPLAY · {replay.session.recipe_title} · return to live</button>}
      <span className="monitor-count">{replay ? `${displayRows.length} replay rows` : `${rows.length} buffered rows`}</span>
    </div>

    <div className="monitor-main-grid">
      <div className="panel monitor-plot-panel">
        <div className="panel-title"><Waves size={18}/> Live plot</div>
        {!replay && recipe?.capture_mode === 'text' ? <div className="empty">This recipe is diagnostic text. Use the Serial Monitor panel instead of numeric plotting.</div> : <>
          <div className="plot-head">
            <div className="metric">{lastValue === undefined ? '—' : lastValue.toFixed(5)} <small>{selectedUnit}</small></div>
            <div className="plot-range"><span>min <b>{minValue === undefined ? '—' : minValue.toFixed(4)}</b></span><span>max <b>{maxValue === undefined ? '—' : maxValue.toFixed(4)}</b></span><span>points <b>{channelValues.length}</b></span></div>
          </div>
          <svg className="plot monitor-plot" viewBox="0 0 100 44" preserveAspectRatio="none"><polyline points={polyline} fill="none" vectorEffect="non-scaling-stroke"/></svg>
          <div className="channel-tabs">
            {activeColumns.map((column, index) => <button key={column} className={selectedChannel === index ? 'active' : ''} onClick={() => setSelectedChannel(index)}><span>{column}</span><b>{latestValues[index] ?? '—'}</b><small>{activeUnits[index] ?? ''}</small></button>)}
          </div>
          {!activeColumns.length && <div className="empty compact">Numeric CSV is visible, but this dataset does not declare channel names.</div>}
        </>}
      </div>

      <div className="panel monitor-console-panel">
        <div className="panel-title"><TerminalSquare size={18}/> Serial monitor</div>
        <div className="monitor-transmit">
          <input value={txText} disabled={monitorState !== 'live'} onChange={event => setTxText(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void sendSerial(); } }} placeholder={monitorState === 'live' ? 'Send text or command to the board…' : 'Start Live Monitor to send'} aria-label="Serial transmit text" />
          <select value={lineEnding} disabled={monitorState !== 'live'} onChange={event => setLineEnding(event.target.value as typeof lineEnding)} aria-label="Serial line ending">
            <option value="none">No line ending</option><option value="lf">Newline (LF)</option><option value="cr">Carriage return (CR)</option><option value="crlf">Both NL & CR</option>
          </select>
          <button className="primary" disabled={monitorState !== 'live' || !txText.length} onClick={() => void sendSerial()}><Send size={14}/> Send</button>
        </div>
        {!displayRows.length ? <div className="empty">Start Live Monitor to see the continuous serial stream, take a snapshot, or replay a saved session.</div> : <div className="serial-console">{displayRows.slice(-600).map((row, index) => <div key={`${row.hostTimestampMs}-${index}`} className={row.direction === 'tx' ? 'tx' : 'rx'}><span>{new Date(row.hostTimestampMs).toLocaleTimeString([], { hour12: false })}</span><code>{row.direction === 'tx' ? 'TX › ' : replay ? 'REPLAY · ' : 'RX · '}{row.line}</code></div>)}</div>}
      </div>
    </div>

    <div className="monitor-bottom-grid">
      <div className="panel monitor-record-panel">
        <div className="panel-title"><Database size={18}/> Record & evidence</div>
        <p className="muted">Monitoring and recording share one evidence path. While Live is running, BetterBoard can save the current structured buffer without closing/reopening the serial port; while stopped, it can acquire a fresh 5 s package.</p>
        <div className="record-actions">
          <button className="primary" disabled={busy || !selectedPort || recipe?.capture_mode !== 'numeric' || ((monitorState === 'live' || monitorState === 'starting') && !bufferedEvidenceRows.length)} onClick={() => void recordMeasurement()}><Save size={15}/> {monitorState === 'live' || monitorState === 'starting' ? `Save live buffer (${bufferedEvidenceRows.length})` : 'Record new 5 s package'}</button>
          {(monitorState === 'live' || monitorState === 'starting') && <span className="record-note"><CircleAlert size={14}/> Saving the buffer keeps Live Monitor open and does not reset the board.</span>}
        </div>
        {measurement && <div className="measurement big"><b>{measurement.samples} samples</b><span>{measurement.directory}</span><span>{measurement.csv_path}</span><span>{measurement.metadata_path}</span></div>}
      </div>

      <div className="panel monitor-context-panel">
        <div className="panel-title"><Gauge size={18}/> Session context</div>
        <div className="monitor-facts">
          <span>Mode</span><b>{replay ? 'Historical replay' : 'Live / acquisition'}</b>
          <span>Recipe</span><b>{replay?.session.recipe_title ?? recipe?.title ?? '—'}</b>
          <span>Port</span><b>{(replay?.session.port ?? selectedPort) || '—'}</b>
          <span>Baud</span><b>{replay ? 'recorded session' : baud}</b>
          <span>Schema</span><b>{activeColumns.length ? `${activeColumns.length} channels` : recipe?.capture_mode ?? '—'}</b>
          <span>Declared rate</span><b>{(replay?.sample_rate_hz ?? recipe?.sample_rate_hz) ? `${replay?.sample_rate_hz ?? recipe?.sample_rate_hz} Hz` : 'event / unspecified'}</b>
          <span>Primary</span><b>{activePrimary || selectedColumn}</b>
        </div>
      </div>
    </div>

    <div className="monitor-history-grid">
      <div className="panel monitor-history-panel">
        <div className="panel-title"><History size={18}/> Measurement sessions <button className="ghost mini" disabled={historyBusy} onClick={() => void refreshSessions()}><RefreshCw size={13}/> Refresh</button></div>
        {!sessions.length ? <div className="empty compact">No saved BetterBoard measurement sessions yet.</div> : <div className="session-list">{sessions.map(session => <div className={`session-row ${replay?.session.directory === session.directory ? 'active' : ''}`} key={session.directory}>
          <div><b>{session.recipe_title}</b><span>{new Date(session.created_at_utc).toLocaleString()} · {session.sample_count} samples · {session.acquisition_mode}</span><small>{session.directory}</small></div>
          <button className="ghost" disabled={historyBusy} onClick={() => void loadReplay(session)}>Replay</button>
        </div>)}</div>}
      </div>

      <div className="panel monitor-export-panel">
        <div className="panel-title"><Link2 size={18}/> Physical Lab export & bridge</div>
        <p className="muted">The original standalone Bridge surface is preserved here inside the evidence workflow: package files plus the embedded hardware, serial-protocol and integration documentation remain directly inspectable.</p>
        {activePackage ? <div className="measurement big"><b>{activePackageSamples ?? '—'} samples</b><span>Full: {activePackage.csv_path}</span><span>Metadata: {activePackage.metadata_path}</span><span>Physical Lab v1: {activePackage.physical_lab_csv_path}</span><span>Bridge: {activePackage.physical_lab_bridge_path}</span></div> : <div className="empty compact">Record or replay a measurement to expose its export package.</div>}
        <div className="boundary"><CircleAlert size={14}/> A serial acquisition is evidence, not automatic proof of calibration, uncertainty, traceability, alignment, or model validity.</div>
        {bridgeDocs?.hardware_map && <details className="bridge-details"><summary>Physical Lab hardware map</summary><pre className="docs-preview">{bridgeDocs.hardware_map}</pre></details>}
        {bridgeDocs?.serial_protocol && <details className="bridge-details"><summary>Physical Lab serial protocol</summary><pre className="docs-preview">{bridgeDocs.serial_protocol}</pre></details>}
        {bridgeDocs?.honeycomb_guide && <details className="bridge-details"><summary>Honeycomb / integration guide</summary><pre className="docs-preview">{bridgeDocs.honeycomb_guide}</pre></details>}
      </div>
    </div>
  </section>;
}
