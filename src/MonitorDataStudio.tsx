import { useEffect, useMemo, useRef, useState } from 'react';
import { Channel, invoke } from '@tauri-apps/api/core';
import {
  Activity, CircleAlert, Database, Eraser, Gauge, Play, Radio, Save, Square,
  TerminalSquare, Waves,
} from 'lucide-react';

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
};

type Props = {
  recipe?: RecipeSpec;
  selectedPort: string;
  fqbn: string;
  onStatus?: (status: string) => void;
  onMeasurement?: (measurement: MeasurementResult) => void;
};

const BAUD_OPTIONS = [9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600];
const MAX_MONITOR_ROWS = 2500;
const MAX_PLOT_POINTS = 240;

function parseNumericRow(row: MonitorRow, expectedColumns: number): number[] | null {
  if (!row.numeric) return null;
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

export default function MonitorDataStudio({ recipe, selectedPort, fqbn, onStatus, onMeasurement }: Props) {
  const [rows, setRows] = useState<MonitorRow[]>([]);
  const [monitorState, setMonitorState] = useState<'idle' | 'starting' | 'live' | 'error'>('idle');
  const [monitorMessage, setMonitorMessage] = useState('Serial monitor is stopped.');
  const [baud, setBaud] = useState(recipe?.baud ?? 115200);
  const [numericOnly, setNumericOnly] = useState(recipe?.capture_mode === 'numeric');
  const [selectedChannel, setSelectedChannel] = useState(0);
  const [measurement, setMeasurement] = useState<MeasurementResult | null>(null);
  const [busy, setBusy] = useState(false);
  const channelRef = useRef<Channel<SerialStreamEvent> | null>(null);

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

  const numericRows = useMemo(() => rows
    .map(row => parseNumericRow(row, recipe?.columns.length ?? 0))
    .filter((value): value is number[] => value !== null), [rows, recipe?.columns.length]);

  const latestValues = numericRows.at(-1) ?? [];
  const channelValues = useMemo(() => numericRows
    .slice(-MAX_PLOT_POINTS)
    .map(parts => parts[selectedChannel])
    .filter(Number.isFinite), [numericRows, selectedChannel]);
  const polyline = useMemo(() => makePolyline(channelValues), [channelValues]);

  const lastValue = channelValues.at(-1);
  const minValue = channelValues.length ? Math.min(...channelValues) : undefined;
  const maxValue = channelValues.length ? Math.max(...channelValues) : undefined;

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

    const channel = new Channel<SerialStreamEvent>();
    channel.onmessage = message => {
      if (message.event === 'started') {
        setMonitorState('live');
        report(`Live · ${message.line}`);
        return;
      }
      if (message.event === 'line') {
        setRows(current => [...current, {
          hostTimestampMs: message.host_timestamp_ms,
          line: message.line,
          numeric: message.numeric,
        }].slice(-MAX_MONITOR_ROWS));
        return;
      }
      if (message.event === 'error') {
        setMonitorState('error');
        report(`Serial monitor error: ${message.line}`);
        return;
      }
      setMonitorState('idle');
      report('Serial monitor stopped.');
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
    }
  }

  async function stopMonitor() {
    try {
      await invoke<boolean>('serial_stream_stop');
      report('Stopping serial monitor…');
    } catch (error) {
      report(`Could not stop serial monitor: ${error}`);
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
      })));
      report(`${result.lines.length} snapshot rows · ${result.numeric_rows} numeric · ${result.ignored_rows} ignored`);
    } catch (error) {
      report(`Snapshot failed: ${error}`);
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
    if (monitorState === 'live' || monitorState === 'starting') {
      report('Stop Live Monitor before recording a Measurement Package; recording owns the serial port during capture.');
      return;
    }
    setBusy(true);
    try {
      report('Recording full multichannel Measurement Package…');
      const result = await invoke<MeasurementResult>('capture_measurement', {
        port: selectedPort,
        durationMs: 5000,
        maxLines: 10000,
        boardProfile: fqbn,
        recipeId: recipe.id,
      });
      setMeasurement(result);
      onMeasurement?.(result);
      report(`${result.samples} samples saved · ${result.directory}`);
    } catch (error) {
      report(`Measurement failed: ${error}`);
    } finally {
      setBusy(false);
    }
  }

  const stateLabel = monitorState === 'live' ? 'LIVE' : monitorState === 'starting' ? 'OPENING' : monitorState === 'error' ? 'ERROR' : 'STOPPED';
  const selectedColumn = recipe?.columns[selectedChannel] ?? `channel_${selectedChannel + 1}`;
  const selectedUnit = recipe?.units[selectedChannel] ?? '';

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
          ? <button className="danger-soft" onClick={stopMonitor}><Square size={15}/> Stop</button>
          : <button className="primary" disabled={!selectedPort} onClick={startMonitor}><Radio size={15}/> Start Live</button>}
        <button className="ghost" disabled={busy || monitorState === 'live' || monitorState === 'starting'} onClick={captureSnapshot}><Activity size={15}/> Snapshot 3 s</button>
        <button className="ghost" onClick={() => setRows([])}><Eraser size={15}/> Clear</button>
      </div>
    </div>

    <div className="monitor-statusline">
      <TerminalSquare size={14}/><span>{monitorMessage}</span>
      <span className="monitor-count">{rows.length} buffered rows</span>
    </div>

    <div className="monitor-main-grid">
      <div className="panel monitor-plot-panel">
        <div className="panel-title"><Waves size={18}/> Live plot</div>
        {recipe?.capture_mode === 'text' ? <div className="empty">This recipe is diagnostic text. Use the Serial Monitor panel instead of numeric plotting.</div> : <>
          <div className="plot-head">
            <div className="metric">{lastValue === undefined ? '—' : lastValue.toFixed(5)} <small>{selectedUnit}</small></div>
            <div className="plot-range"><span>min <b>{minValue === undefined ? '—' : minValue.toFixed(4)}</b></span><span>max <b>{maxValue === undefined ? '—' : maxValue.toFixed(4)}</b></span><span>points <b>{channelValues.length}</b></span></div>
          </div>
          <svg className="plot monitor-plot" viewBox="0 0 100 44" preserveAspectRatio="none"><polyline points={polyline} fill="none" vectorEffect="non-scaling-stroke"/></svg>
          <div className="channel-tabs">
            {(recipe?.columns ?? []).map((column, index) => <button key={column} className={selectedChannel === index ? 'active' : ''} onClick={() => setSelectedChannel(index)}><span>{column}</span><b>{latestValues[index] ?? '—'}</b><small>{recipe?.units[index] ?? ''}</small></button>)}
          </div>
          {!recipe?.columns.length && <div className="empty compact">Numeric CSV is visible, but this recipe does not declare channel names.</div>}
        </>}
      </div>

      <div className="panel monitor-console-panel">
        <div className="panel-title"><TerminalSquare size={18}/> Serial monitor</div>
        {!rows.length ? <div className="empty">Start Live Monitor to see the continuous serial stream, or take a one-time snapshot.</div> : <div className="serial-console">{rows.slice(-600).map((row, index) => <div key={`${row.hostTimestampMs}-${index}`}><span>{new Date(row.hostTimestampMs).toLocaleTimeString([], { hour12: false })}</span><code>{row.line}</code></div>)}</div>}
      </div>
    </div>

    <div className="monitor-bottom-grid">
      <div className="panel monitor-record-panel">
        <div className="panel-title"><Database size={18}/> Record & evidence</div>
        <p className="muted">Live monitoring is for inspection. Measurement recording is the evidence path: full recipe-defined CSV, metadata, and Physical Lab compatibility export.</p>
        <div className="record-actions">
          <button className="primary" disabled={busy || !selectedPort || recipe?.capture_mode !== 'numeric' || monitorState === 'live' || monitorState === 'starting'} onClick={recordMeasurement}><Save size={15}/> Record 5 s package</button>
          {monitorState === 'live' && <span className="record-note"><CircleAlert size={14}/> Stop Live Monitor before recording.</span>}
        </div>
        {measurement && <div className="measurement big"><b>{measurement.samples} samples</b><span>{measurement.directory}</span><span>{measurement.csv_path}</span><span>{measurement.metadata_path}</span></div>}
      </div>

      <div className="panel monitor-context-panel">
        <div className="panel-title"><Gauge size={18}/> Session context</div>
        <div className="monitor-facts">
          <span>Recipe</span><b>{recipe?.title ?? '—'}</b>
          <span>Port</span><b>{selectedPort || '—'}</b>
          <span>Baud</span><b>{baud}</b>
          <span>Schema</span><b>{recipe?.columns.length ? `${recipe.columns.length} channels` : recipe?.capture_mode ?? '—'}</b>
          <span>Declared rate</span><b>{recipe?.sample_rate_hz ? `${recipe.sample_rate_hz} Hz` : 'event / unspecified'}</b>
          <span>Primary</span><b>{recipe?.primary_column || selectedColumn}</b>
        </div>
      </div>
    </div>
  </section>;
}
