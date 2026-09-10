import { useEffect, useMemo, useRef, useState } from 'react';
import { Channel, invoke } from '@tauri-apps/api/core';
import {
  Activity, CircleAlert, Database, Eraser, Gauge, History, Link2, Radio, RefreshCw,
  Save, Send, Square, TerminalSquare, Waves,
} from 'lucide-react';
import type { BackgroundTask, TaskCategory, TaskState } from './TaskCenter';
import RuntimeLog from './RuntimeLog';
import EngineeringPlot from './EngineeringPlot';
import CopyButton from './CopyButton';

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

type CapturedRow = { host_timestamp_ms: number; line: string; numeric: boolean };
type CaptureResult = {
  lines: string[];
  rows: CapturedRow[];
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

type AcquisitionContext = {
  port: string;
  fqbn: string;
  baud: number;
  numericOnly: boolean;
  recipe?: RecipeSpec;
  parameterValues: Record<string, string>;
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
  rows: CapturedRow[];
};

type Props = {
  recipe?: RecipeSpec;
  selectedPort: string;
  fqbn: string;
  latestMeasurement?: MeasurementResult | null;
  bridgeDocs?: BridgeDocs | null;
  onStatus?: (status: string) => void;
  onMeasurement?: (measurement: MeasurementResult) => void;
  parameterValues?: Record<string, string>;
  tasks?: BackgroundTask[];
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

function cloneRecipe(recipe?: RecipeSpec): RecipeSpec | undefined {
  return recipe ? { ...recipe, columns: [...recipe.columns], units: [...recipe.units] } : undefined;
}

export default function MonitorDataStudio({
  recipe, selectedPort, fqbn, latestMeasurement, bridgeDocs, onStatus, onMeasurement, parameterValues = {}, tasks = [],
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
  const [bufferContext, setBufferContext] = useState<AcquisitionContext | null>(null);
  const channelRef = useRef<Channel<SerialStreamEvent> | null>(null);
  const liveTaskRef = useRef<number | null>(null);
  const liveCountRef = useRef(0);

  function beginTask(category: TaskCategory, title: string, detail: string, cancel?: () => Promise<void> | void) {
    return onTaskStart?.(category, title, detail, cancel) ?? null;
  }
  function taskLog(id: number | null, message: string) { if (id !== null) onTaskLog?.(id, message); }
  function taskFinish(id: number | null, state: Exclude<TaskState, 'running'>, detail: string) { if (id !== null) onTaskFinish?.(id, state, detail); }

  useEffect(() => {
    if (bufferContext || replay) return;
    setBaud(recipe?.baud ?? 115200);
    setNumericOnly(recipe?.capture_mode === 'numeric');
    const primaryIndex = recipe?.primary_column ? recipe.columns.indexOf(recipe.primary_column) : -1;
    setSelectedChannel(primaryIndex >= 0 ? primaryIndex : Math.max((recipe?.columns.length ?? 1) - 1, 0));
  }, [recipe?.id, bufferContext, replay]);

  useEffect(() => {
    return () => {
      void invoke('serial_stream_stop').catch(() => undefined);
    };
  }, []);

  useEffect(() => { void refreshSessions(); }, []);

  const visibleRecipe = bufferContext?.recipe ?? recipe;
  const displayRows = useMemo<MonitorRow[]>(() => replay
    ? replay.rows.map(row => ({ hostTimestampMs: row.host_timestamp_ms, line: row.line, numeric: row.numeric, direction: 'rx' as const }))
    : rows, [replay, rows]);
  const activeColumns = replay?.columns ?? visibleRecipe?.columns ?? [];
  const activeUnits = replay?.units ?? visibleRecipe?.units ?? [];
  const activePrimary = replay?.primary_column ?? visibleRecipe?.primary_column;
  const serialCopyText = useMemo(() => displayRows.map(row => row.line).join('\n'), [displayRows]);

  const numericRows = useMemo(() => displayRows
    .map(row => parseNumericRow(row, activeColumns.length))
    .filter((value): value is number[] => value !== null), [displayRows, activeColumns.length]);

  const latestValues = numericRows.at(-1) ?? [];
  const channelPoints = useMemo(() => {
    const result: Array<{ x: number; y: number }> = [];
    let firstTimestamp: number | null = null;
    for (const row of displayRows.slice(-MAX_PLOT_POINTS)) {
      const parts = parseNumericRow(row, activeColumns.length);
      const value = parts?.[selectedChannel];
      if (value === undefined || !Number.isFinite(value)) continue;
      if (firstTimestamp === null) firstTimestamp = row.hostTimestampMs;
      result.push({ x: (row.hostTimestampMs - firstTimestamp) / 1000, y: value });
    }
    return result;
  }, [displayRows, activeColumns.length, selectedChannel]);
  const channelValues = useMemo(() => channelPoints.map(point => point.y), [channelPoints]);

  const lastValue = channelValues.at(-1);
  const minValue = channelValues.length ? Math.min(...channelValues) : undefined;
  const maxValue = channelValues.length ? Math.max(...channelValues) : undefined;
  const bufferedEvidenceRows = useMemo(() => rows.filter(row => parseNumericRow(row, visibleRecipe?.columns.length ?? 0) !== null), [rows, visibleRecipe?.columns.length]);

  function report(message: string) {
    setMonitorMessage(message);
    onStatus?.(message);
  }

  function clearDisplayedData() {
    if (replay) {
      setReplay(null);
      report('Replay cleared. Returning to the current acquisition buffer.');
      return;
    }
    setRows([]);
    if (monitorState !== 'live' && monitorState !== 'starting') setBufferContext(null);
    report(monitorState === 'live' || monitorState === 'starting' ? 'Live buffer cleared; acquisition continues with its locked context.' : 'Monitor buffer cleared.');
  }

  async function startMonitor() {
    if (!selectedPort) {
      report('Select a serial device first.');
      return;
    }
    if (monitorState === 'live' || monitorState === 'starting') return;

    const context: AcquisitionContext = {
      port: selectedPort,
      fqbn,
      baud,
      numericOnly,
      recipe: cloneRecipe(recipe),
      parameterValues: { ...parameterValues },
    };
    setReplay(null);
    setRows([]);
    setBufferContext(context);
    const primaryIndex = context.recipe?.primary_column ? context.recipe.columns.indexOf(context.recipe.primary_column) : -1;
    setSelectedChannel(primaryIndex >= 0 ? primaryIndex : Math.max((context.recipe?.columns.length ?? 1) - 1, 0));
    setMonitorState('starting');
    report(`Opening ${context.port} @ ${context.baud} baud… acquisition context locked.`);
    liveCountRef.current = 0;
    liveTaskRef.current = beginTask('Monitor', `Live serial · ${context.port}`, `Opening ${context.port} @ ${context.baud} baud…`, async () => {
      await invoke<boolean>('serial_stream_stop');
    });

    const channel = new Channel<SerialStreamEvent>();
    channel.onmessage = message => {
      if (message.event === 'started') {
        setMonitorState('live');
        report(`Live · ${message.line}`);
        taskLog(liveTaskRef.current, `Serial stream opened · ${message.line}`);
        taskLog(liveTaskRef.current, `Locked provenance · ${context.recipe?.title || 'no recipe'} · ${context.fqbn} · ${context.port}`);
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
      report('Serial monitor stopped. Buffered rows keep the acquisition context they were captured with.');
      taskFinish(liveTaskRef.current, 'done', `Serial monitor stopped · ${liveCountRef.current} RX rows`);
      liveTaskRef.current = null;
    };
    channelRef.current = channel;

    try {
      await invoke('serial_stream_start', {
        port: context.port,
        baud: context.baud,
        numericOnly: context.numericOnly,
        onEvent: channel,
      });
    } catch (error) {
      setMonitorState('error');
      setBufferContext(null);
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
    if (monitorState === 'live' || monitorState === 'starting') {
      report('Stop Live Monitor before opening historical replay. The active stream remains bound to its acquisition context.');
      return;
    }
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
    const context: AcquisitionContext = {
      port: selectedPort,
      fqbn,
      baud,
      numericOnly,
      recipe: cloneRecipe(recipe),
      parameterValues: { ...parameterValues },
    };
    setBusy(true);
    const task = beginTask('Monitor', `Snapshot · ${context.recipe?.title || context.port}`, `Capturing 3 s @ ${context.baud} baud…`);
    try {
      report('Capturing a 3 s diagnostic snapshot with backend timestamps…');
      const result = await invoke<CaptureResult>('serial_capture', {
        port: context.port,
        baud: context.baud,
        durationMs: 3000,
        maxLines: 2000,
        numericOnly: context.numericOnly,
      });
      setReplay(null);
      setBufferContext(context);
      setRows(result.rows.map(row => ({
        hostTimestampMs: row.host_timestamp_ms,
        line: row.line,
        numeric: row.numeric,
        direction: 'rx' as const,
      })));
      const detail = `${result.rows.length} snapshot rows · ${result.numeric_rows} numeric · ${result.ignored_rows} ignored · real host timestamps preserved`;
      taskLog(task, detail); taskFinish(task, 'done', detail); report(detail);
    } catch (error) {
      taskLog(task, String(error)); taskFinish(task, 'failed', `Snapshot failed: ${error}`); report(`Snapshot failed: ${error}`);
    } finally {
      setBusy(false);
    }
  }

  async function recordMeasurement() {
    const live = monitorState === 'live' || monitorState === 'starting';
    const evidenceContext = live ? bufferContext : {
      port: selectedPort,
      fqbn,
      baud,
      numericOnly,
      recipe: cloneRecipe(recipe),
      parameterValues: { ...parameterValues },
    } satisfies AcquisitionContext;
    const evidenceRecipe = evidenceContext?.recipe;
    if (!evidenceRecipe || evidenceRecipe.capture_mode !== 'numeric') {
      report(live ? 'The active Live acquisition was not started with a numeric Measurement Evidence recipe.' : 'The selected recipe does not define numeric Measurement Evidence.');
      return;
    }
    if (!evidenceContext?.port) {
      report('Select a serial device first.');
      return;
    }
    if (live && !bufferedEvidenceRows.length) {
      report('Live Monitor has no complete recipe-shaped numeric rows to save yet.');
      return;
    }
    setBusy(true);
    const task = beginTask('Evidence', `Record evidence · ${evidenceRecipe.title}`, live
      ? `Saving ${bufferedEvidenceRows.length} structured live rows with locked provenance…`
      : 'Acquiring a fresh 5 s multichannel Measurement Package…');
    try {
      let result: MeasurementResult;
      if (live) {
        report(`Saving ${bufferedEvidenceRows.length} buffered live rows with the acquisition-start context; the serial port stays open…`);
        result = await invoke<MeasurementResult>('save_measurement_buffer', {
          port: evidenceContext.port,
          boardProfile: evidenceContext.fqbn,
          recipeId: evidenceRecipe.id,
          rows: bufferedEvidenceRows.map(row => ({
            host_timestamp_ms: row.hostTimestampMs,
            line: row.line,
            numeric: row.numeric,
          })),
          parameterValues: evidenceContext.parameterValues,
        });
      } else {
        report('Recording a new 5 s full multichannel Measurement Package…');
        result = await invoke<MeasurementResult>('capture_measurement', {
          port: evidenceContext.port,
          durationMs: 5000,
          maxLines: 10000,
          boardProfile: evidenceContext.fqbn,
          recipeId: evidenceRecipe.id,
          parameterValues: evidenceContext.parameterValues,
        });
      }
      setMeasurement(result);
      setReplay(null);
      onMeasurement?.(result);
      taskLog(task, `data.csv · ${result.csv_path}`);
      taskLog(task, `metadata.json · ${result.metadata_path}`);
      taskLog(task, `Legacy Physical Lab v1 compatibility export · ${result.physical_lab_csv_path}`);
      taskLog(task, `Engineering Lab bridge · ${result.physical_lab_bridge_path}`);
      await refreshSessions();
      const detail = `${result.samples} samples saved · ${result.directory}`;
      taskFinish(task, 'done', detail); report(detail);
    } catch (error) {
      taskLog(task, String(error)); taskFinish(task, 'failed', `Measurement failed: ${error}`); report(`Measurement failed: ${error}`);
    } finally {
      setBusy(false);
    }
  }

  const live = monitorState === 'live' || monitorState === 'starting';
  const evidenceRecipe = live ? bufferContext?.recipe : recipe;
  const stateLabel = monitorState === 'live' ? 'LIVE' : monitorState === 'starting' ? 'OPENING' : monitorState === 'error' ? 'ERROR' : 'STOPPED';
  const selectedColumn = activeColumns[selectedChannel] ?? `channel_${selectedChannel + 1}`;
  const selectedUnit = activeUnits[selectedChannel] ?? '';
  const activePackage = replay?.session ?? measurement ?? latestMeasurement ?? null;
  const activePackageSamples = replay?.session.sample_count ?? measurement?.samples ?? latestMeasurement?.samples ?? null;
  const contextRecipeTitle = replay?.session.recipe_title ?? bufferContext?.recipe?.title ?? recipe?.title ?? '—';
  const contextPort = replay?.session.port ?? bufferContext?.port ?? selectedPort;
  const contextBaud = replay ? 'recorded session' : (bufferContext?.baud ?? baud);
  const contextRate = replay?.sample_rate_hz ?? visibleRecipe?.sample_rate_hz;

  return <section className="monitor-workspace">
    <div className="monitor-toolbar panel">
      <div className="monitor-toolbar-title">
        <div className={`live-badge ${monitorState}`}><span/><b>{stateLabel}</b></div>
        <div><b>Monitor & Data</b><small>{contextRecipeTitle} · {contextPort || 'no serial device'}</small></div>
      </div>

      <div className="monitor-controls">
        <label>Baud
          <select value={baud} disabled={live} onChange={event => setBaud(Number(event.target.value))}>
            {BAUD_OPTIONS.map(value => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <label className="monitor-check"><input type="checkbox" checked={numericOnly} disabled={live} onChange={event => setNumericOnly(event.target.checked)}/> Numeric only</label>
        {live
          ? <button className="danger-soft" onClick={() => void stopMonitor()}><Square size={15}/> Stop</button>
          : <button className="primary" disabled={!selectedPort} onClick={() => void startMonitor()}><Radio size={15}/> Start Live</button>}
        <button className="ghost" disabled={busy || live} onClick={() => void captureSnapshot()}><Activity size={15}/> Snapshot 3 s</button>
        <button className="ghost" onClick={clearDisplayedData}><Eraser size={15}/> Clear</button>
      </div>
    </div>

    <div className="monitor-statusline">
      <TerminalSquare size={14}/><span>{monitorMessage}</span>
      {replay && <button className="replay-pill" onClick={() => setReplay(null)}>REPLAY · {replay.session.recipe_title} · return to buffer</button>}
      <span className="monitor-count">{replay ? `${displayRows.length} replay rows` : `${rows.length} buffered rows`}</span>
    </div>

    <div className="monitor-main-grid">
      <div className="panel monitor-plot-panel">
        <div className="panel-title"><Waves size={18}/> Live plot</div>
        {!replay && visibleRecipe?.capture_mode === 'text' ? <div className="empty">This recipe is diagnostic text. Use the Serial Monitor panel instead of numeric plotting.</div> : <>
          <div className="plot-head">
            <div className="metric">{lastValue === undefined ? '—' : lastValue.toFixed(5)} <small>{selectedUnit}</small></div>
            <div className="plot-range"><span>min <b>{minValue === undefined ? '—' : minValue.toFixed(4)}</b></span><span>max <b>{maxValue === undefined ? '—' : maxValue.toFixed(4)}</b></span><span>points <b>{channelValues.length}</b></span></div>
          </div>
          <EngineeringPlot series={[{ label: selectedColumn, points: channelPoints }]} xLabel="time" xUnit="s" yLabel={selectedColumn} yUnit={selectedUnit} height={300} />
          <div className="channel-tabs">
            {activeColumns.map((column, index) => <button key={column} className={selectedChannel === index ? 'active' : ''} onClick={() => setSelectedChannel(index)}><span>{column}</span><b>{latestValues[index] ?? '—'}</b><small>{activeUnits[index] ?? ''}</small></button>)}
          </div>
          {!activeColumns.length && <div className="empty compact">Numeric CSV is visible, but this dataset does not declare channel names.</div>}
        </>}
      </div>

      <div className="panel monitor-console-panel">
        <div className="panel-title panel-title-with-action"><span><TerminalSquare size={18}/> Serial monitor</span><CopyButton text={serialCopyText} label="Copy data" /></div>
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
        <p className="muted">Monitoring and recording share one evidence path. Live acquisition locks port, board profile, recipe, schema and parameters at stream start so later navigation cannot relabel buffered evidence.</p>
        <div className="record-actions">
          <button className="primary" disabled={busy || !(live ? bufferContext?.port : selectedPort) || evidenceRecipe?.capture_mode !== 'numeric' || (live && !bufferedEvidenceRows.length)} onClick={() => void recordMeasurement()}><Save size={15}/> {live ? `Save live buffer (${bufferedEvidenceRows.length})` : 'Record new 5 s package'}</button>
          {live && <span className="record-note"><CircleAlert size={14}/> Saving keeps Live open and uses the context locked when this stream started.</span>}
        </div>
        {measurement && <div className="measurement big"><b>{measurement.samples} samples</b><span>{measurement.directory}</span><span>{measurement.csv_path}</span><span>{measurement.metadata_path}</span></div>}
      </div>

      <div className="panel monitor-context-panel">
        <div className="panel-title"><Gauge size={18}/> Session context</div>
        <div className="monitor-facts">
          <span>Mode</span><b>{replay ? 'Historical replay' : live ? 'Live · context locked' : bufferContext ? 'Captured buffer · context locked' : 'Ready for acquisition'}</b>
          <span>Recipe</span><b>{contextRecipeTitle}</b>
          <span>Port</span><b>{contextPort || '—'}</b>
          <span>Board profile</span><b>{replay?.session.board_profile ?? bufferContext?.fqbn ?? fqbn}</b>
          <span>Baud</span><b>{contextBaud}</b>
          <span>Schema</span><b>{activeColumns.length ? `${activeColumns.length} channels` : visibleRecipe?.capture_mode ?? '—'}</b>
          <span>Declared rate</span><b>{contextRate ? `${contextRate} Hz` : 'event / unspecified'}</b>
          <span>Primary</span><b>{activePrimary || selectedColumn}</b>
        </div>
      </div>
    </div>

    <div className="monitor-history-grid">
      <div className="panel monitor-history-panel">
        <div className="panel-title"><History size={18}/> Measurement sessions <button className="ghost mini" disabled={historyBusy} onClick={() => void refreshSessions()}><RefreshCw size={13}/> Refresh</button></div>
        {!sessions.length ? <div className="empty compact">No saved BetterBoard measurement sessions yet.</div> : <div className="session-list">{sessions.map(session => <div className={`session-row ${replay?.session.directory === session.directory ? 'active' : ''}`} key={session.directory}>
          <div><b>{session.recipe_title}</b><span>{new Date(session.created_at_utc).toLocaleString()} · {session.sample_count} samples · {session.acquisition_mode}</span><small>{session.directory}</small></div>
          <button className="ghost" disabled={historyBusy || live} onClick={() => void loadReplay(session)}>Replay</button>
        </div>)}</div>}
      </div>

      <div className="panel monitor-export-panel">
        <div className="panel-title"><Link2 size={18}/> Engineering Lab handoff · Physical Lab export & bridge compatibility</div>
        <p className="muted">Current BetterBoard evidence is handed to Engineering Lab through inspectable package files. Legacy Physical Lab compatibility files and embedded protocol documentation remain available so older workflows do not break.</p>
        {activePackage ? <div className="measurement big"><b>{activePackageSamples ?? '—'} samples</b><span>Full: {activePackage.csv_path}</span><span>Metadata: {activePackage.metadata_path}</span><span>Legacy Physical Lab v1 compatibility: {activePackage.physical_lab_csv_path}</span><span>Engineering Lab bridge: {activePackage.physical_lab_bridge_path}</span></div> : <div className="empty compact">Record or replay a measurement to expose its export package.</div>}
        <div className="boundary"><CircleAlert size={14}/> A serial acquisition is evidence, not automatic proof of calibration, uncertainty, traceability, alignment, or model validity.</div>
        {bridgeDocs?.hardware_map && <details className="bridge-details"><summary>Legacy Physical Lab hardware map (compatibility)</summary><pre className="docs-preview">{bridgeDocs.hardware_map}</pre></details>}
        {bridgeDocs?.serial_protocol && <details className="bridge-details"><summary>Legacy Physical Lab serial protocol (compatibility)</summary><pre className="docs-preview">{bridgeDocs.serial_protocol}</pre></details>}
        {bridgeDocs?.honeycomb_guide && <details className="bridge-details"><summary>Honeycomb / integration guide</summary><pre className="docs-preview">{bridgeDocs.honeycomb_guide}</pre></details>}
      </div>
    </div>
    <RuntimeLog tasks={tasks} />
  </section>;
}
