import { useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Activity, BarChart3, Database, Gauge, Layers3 } from 'lucide-react';
import { useHardwareSession } from './HardwareSession';
import EngineeringPlot from './EngineeringPlot';
import type { BackgroundTask } from './TaskCenter';

type MeasurementSessionSummary = {
  directory: string;
  created_at_utc: string;
  recipe_title: string;
  sample_count: number;
  physical_lab_csv_path?: string;
  physical_lab_bridge_path?: string;
};

type MeasurementReplay = {
  sample_rate_hz?: number | null;
  rows: Array<{ host_timestamp_ms: number; line: string; numeric: boolean }>;
  columns: string[];
  primary_column?: string | null;
};

type StageState = 'nominal' | 'warning' | 'blocked' | 'unavailable';

type ObservatoryVisualData = {
  stages: Array<{ id: string; label: string; state: StageState; detail: string }>;
  sampling: { declaredHz: number | null; observedHz: number | null; deviationPercent: number | null };
  integrity: { numericCoverage: number | null; primaryCoverage: number | null; replayComplete: boolean | null; bridgeReady: boolean | null };
  sessions: Array<{ label: string; createdAt: string; sampleCount: number }>;
  tasks: Array<{ state: string; count: number }>;
};

const TASK_MEMORY_KEY = 'betterboard.task-center.v1';

function readTasks(): BackgroundTask[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(TASK_MEMORY_KEY) || '[]') as BackgroundTask[];
    return Array.isArray(parsed) ? parsed.slice(0, 80) : [];
  } catch {
    return [];
  }
}

function numericStats(replay: MeasurementReplay | null) {
  if (!replay?.rows.length) return null;
  const numeric = replay.rows.filter(row => row.numeric);
  if (!numeric.length) return null;
  const first = numeric[0].host_timestamp_ms;
  const last = numeric[numeric.length - 1].host_timestamp_ms;
  const durationS = Math.max((last - first) / 1000, 0);
  const observedHz = durationS > 0 && numeric.length > 1 ? (numeric.length - 1) / durationS : null;
  const declaredPrimary = replay.primary_column ? replay.columns.indexOf(replay.primary_column) : -1;
  const primaryIndex = declaredPrimary >= 0 ? declaredPrimary : Math.max(0, replay.columns.length - 1);
  const finitePrimary = numeric.filter(row => Number.isFinite(Number(row.line.split(',')[primaryIndex]?.trim()))).length;
  return {
    observedHz,
    numericCoverage: numeric.length / Math.max(replay.rows.length, 1),
    primaryCoverage: finitePrimary / Math.max(numeric.length, 1),
  };
}

function percent(value: number | null) {
  return value === null || !Number.isFinite(value) ? '—' : `${(100 * value).toFixed(1)}%`;
}

export default function ObservatoryVisualSummary() {
  const { selectedPort, diagnosis } = useHardwareSession();
  const [sessions, setSessions] = useState<MeasurementSessionSummary[]>([]);
  const [replay, setReplay] = useState<MeasurementReplay | null>(null);
  const [tasks, setTasks] = useState<BackgroundTask[]>(readTasks);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      try {
        const list = await invoke<MeasurementSessionSummary[]>('measurement_sessions', { limit: 16 });
        if (cancelled) return;
        setSessions(list);
        if (list[0]) {
          const loaded = await invoke<MeasurementReplay>('measurement_session_load', { directory: list[0].directory });
          if (!cancelled) setReplay(loaded);
        } else setReplay(null);
        setLoadError('');
      } catch (error) {
        if (!cancelled) setLoadError(String(error));
      }
      if (!cancelled) setTasks(readTasks());
    }
    void refresh();
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 8000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, []);

  const data = useMemo<ObservatoryVisualData>(() => {
    const stats = numericStats(replay);
    const declaredHz = replay?.sample_rate_hz && replay.sample_rate_hz > 0 ? replay.sample_rate_hz : null;
    const deviationPercent = declaredHz && stats?.observedHz !== null && stats?.observedHz !== undefined
      ? Math.abs(stats.observedHz - declaredHz) / declaredHz * 100
      : null;
    const latest = sessions[0] ?? null;
    const bridgeReady = latest ? Boolean(latest.physical_lab_csv_path && latest.physical_lab_bridge_path) : null;
    const replayComplete = latest && replay ? replay.rows.length === latest.sample_count : null;
    const live = tasks.some(task => task.state === 'running' && task.category === 'Monitor');
    const taskCounts = ['running', 'done', 'failed', 'cancelled'].map(state => ({ state, count: tasks.filter(task => task.state === state).length }));
    const evidenceState: StageState = !latest ? 'unavailable' : replayComplete === false || bridgeReady === false ? 'warning' : 'nominal';
    const acquisitionState: StageState = live ? 'nominal' : selectedPort ? 'warning' : 'unavailable';
    const runtimeState: StageState = loadError ? 'warning' : 'nominal';
    const hardwareState: StageState = diagnosis.severity === 'error' ? 'blocked' : diagnosis.severity === 'warning' ? 'warning' : selectedPort ? 'nominal' : 'unavailable';
    return {
      stages: [
        { id: 'hardware', label: 'Hardware', state: hardwareState, detail: diagnosis.title },
        { id: 'runtime', label: 'Runtime / Toolchain', state: runtimeState, detail: loadError ? 'Runtime observations incomplete' : 'Runtime observations available' },
        { id: 'acquisition', label: 'Acquisition', state: acquisitionState, detail: live ? 'Monitor task active' : selectedPort ? 'Board selected · acquisition idle' : 'No board selected' },
        { id: 'evidence', label: 'Evidence', state: evidenceState, detail: latest ? `${latest.sample_count} saved rows` : 'No saved session' },
        { id: 'analysis', label: 'Analysis / Handoff', state: bridgeReady ? 'nominal' : latest ? 'warning' : 'unavailable', detail: bridgeReady ? 'Engineering Lab bridge present' : 'Bridge not yet available' },
      ],
      sampling: { declaredHz, observedHz: stats?.observedHz ?? null, deviationPercent },
      integrity: { numericCoverage: stats?.numericCoverage ?? null, primaryCoverage: stats?.primaryCoverage ?? null, replayComplete, bridgeReady },
      sessions: sessions.slice(0, 10).map(session => ({ label: session.recipe_title, createdAt: session.created_at_utc, sampleCount: session.sample_count })),
      tasks: taskCounts,
    };
  }, [sessions, replay, tasks, selectedPort, diagnosis, loadError]);

  const sessionPoints = data.sessions.map((session, index) => ({ x: index + 1, y: session.sampleCount }));
  const taskPoints = data.tasks.map((task, index) => ({ x: index + 1, y: task.count }));

  return <section className="panel" style={{ maxWidth: 1420, margin: '14px auto' }}>
    <div className="panel-title"><Layers3 size={18}/> Operational Visualization</div>
    <p className="muted">Read-only views derived from existing hardware diagnosis, saved measurement metadata, replay completeness and Task Center state. These are operational/evidence diagnostics, not calibration claims.</p>

    <div className="observatory-readiness-pipeline">
      {data.stages.map((stage, index) => <div key={stage.id} className={`observatory-stage ${stage.state}`}>
        <small>{index + 1}</small><b>{stage.label}</b><span>{stage.state}</span><em>{stage.detail}</em>
      </div>)}
    </div>

    <div className="engineering-model-grid" style={{ marginTop: 12 }}>
      <section className="panel">
        <div className="panel-title"><Gauge size={16}/> Sampling Health</div>
        <div className="observatory-facts">
          <span>Declared rate</span><b>{data.sampling.declaredHz === null ? '—' : `${data.sampling.declaredHz.toFixed(3)} Hz`}</b>
          <span>Observed rate</span><b>{data.sampling.observedHz === null ? '—' : `${data.sampling.observedHz.toFixed(3)} Hz`}</b>
          <span>Deviation</span><b>{data.sampling.deviationPercent === null ? '—' : `${data.sampling.deviationPercent.toFixed(1)}%`}</b>
        </div>
      </section>

      <section className="panel">
        <div className="panel-title"><Database size={16}/> Evidence Integrity</div>
        <div className="observatory-facts">
          <span>Numeric row coverage</span><b>{percent(data.integrity.numericCoverage)}</b>
          <span>Primary finite coverage</span><b>{percent(data.integrity.primaryCoverage)}</b>
          <span>Replay completeness</span><b>{data.integrity.replayComplete === null ? '—' : data.integrity.replayComplete ? 'complete' : 'incomplete'}</b>
          <span>Bridge readiness</span><b>{data.integrity.bridgeReady === null ? '—' : data.integrity.bridgeReady ? 'ready' : 'incomplete'}</b>
        </div>
      </section>
    </div>

    <div className="engineering-model-grid" style={{ marginTop: 12 }}>
      <section className="panel">
        <div className="panel-title"><BarChart3 size={16}/> Session History</div>
        {sessionPoints.length ? <EngineeringPlot series={[{ label: 'samples / session', kind: 'stem', points: sessionPoints }]} xLabel="recent session index" yLabel="saved samples" zeroLine /> : <div className="empty compact">No saved sessions yet.</div>}
        {data.sessions.slice(0, 4).map((session, index) => <div className="boundary compact" key={`${session.createdAt}-${index}`}><b>#{index + 1} · {session.label}</b> · {session.sampleCount.toLocaleString()} samples · {new Date(session.createdAt).toLocaleString()}</div>)}
      </section>

      <section className="panel">
        <div className="panel-title"><Activity size={16}/> Task Activity</div>
        <EngineeringPlot series={[{ label: 'task count', kind: 'stem', points: taskPoints }]} xLabel="state index" yLabel="tasks" zeroLine />
        <div className="observatory-facts">{data.tasks.flatMap(task => [<span key={`${task.state}-label`}>{task.state}</span>, <b key={`${task.state}-value`}>{task.count}</b>])}</div>
      </section>
    </div>
  </section>;
}
