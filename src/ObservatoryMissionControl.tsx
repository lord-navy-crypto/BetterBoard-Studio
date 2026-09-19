import { useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Activity, Bot, CircleAlert, Database, RefreshCw, ShieldCheck } from 'lucide-react';
import { useHardwareSession } from './HardwareSession';
import type { BackgroundTask } from './TaskCenter';

type CliInfo = { found: boolean; version?: string; error?: string };
type OpenPenguinStatus = { found: boolean; endpoint: string; models: string[]; error?: string | null };
type MeasurementSessionSummary = { directory: string; created_at_utc: string; recipe_title: string; sample_count: number; metadata_path: string; physical_lab_bridge_path: string };

const TASK_MEMORY_KEY = 'betterboard.task-center.v1';
function readTasks(): BackgroundTask[] {
  if (typeof localStorage === 'undefined') return [];
  try { const parsed = JSON.parse(localStorage.getItem(TASK_MEMORY_KEY) || '[]') as BackgroundTask[]; return Array.isArray(parsed) ? parsed : []; }
  catch { return []; }
}

export default function ObservatoryMissionControl() {
  const { diagnosis, selectedPort } = useHardwareSession();
  const [cli, setCli] = useState<CliInfo | null>(null);
  const [ai, setAi] = useState<OpenPenguinStatus | null>(null);
  const [latest, setLatest] = useState<MeasurementSessionSummary | null>(null);
  const [tasks, setTasks] = useState<BackgroundTask[]>(readTasks);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    setBusy(true);
    const [cliResult, aiResult, sessionsResult] = await Promise.allSettled([
      invoke<CliInfo>('arduino_cli_discovery'),
      invoke<OpenPenguinStatus>('openguin_probe'),
      invoke<MeasurementSessionSummary[]>('measurement_sessions', { limit: 1 }),
    ]);
    setCli(cliResult.status === 'fulfilled' ? cliResult.value : { found: false, error: String(cliResult.reason) });
    setAi(aiResult.status === 'fulfilled' ? aiResult.value : { found: false, endpoint: 'local runtime', models: [], error: String(aiResult.reason) });
    setLatest(sessionsResult.status === 'fulfilled' ? sessionsResult.value[0] ?? null : null);
    setTasks(readTasks());
    setBusy(false);
  }

  useEffect(() => { void refresh(); }, []);

  const running = useMemo(() => tasks.filter(task => task.state === 'running'), [tasks]);
  const failed = useMemo(() => tasks.filter(task => task.state === 'failed'), [tasks]);
  const live = running.find(task => task.category === 'Monitor' && /live serial/i.test(task.title));
  const evidenceReady = Boolean(latest?.metadata_path && latest?.physical_lab_bridge_path);
  const blockers = [diagnosis.severity === 'error', !cli?.found, failed.length > 0].filter(Boolean).length;
  const warnings = [diagnosis.severity === 'warning', !latest, ai && !ai.found].filter(Boolean).length;
  const state = blockers ? 'Needs attention' : warnings ? 'Ready with warnings' : 'Nominal';

  return <section className="panel" style={{ margin: '14px 18px 0' }} aria-label="Observatory mission control">
    <div className="panel-title panel-title-with-action"><span><ShieldCheck size={18}/> Mission control</span><button className="ghost mini" disabled={busy} onClick={() => void refresh()}><RefreshCw size={13}/> Refresh</button></div>
    <p className="muted">Fast operational summary before the detailed Observatory panels below.</p>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10 }}>
      <div className="runtime-kpi"><ShieldCheck size={16}/><span>System</span><b>{state}</b><small>{blockers} blocker(s) · {warnings} warning(s)</small></div>
      <div className="runtime-kpi"><Activity size={16}/><span>Acquisition</span><b>{live ? 'LIVE' : 'Idle'}</b><small>{selectedPort || 'No board selected'}</small></div>
      <div className="runtime-kpi"><Database size={16}/><span>Latest evidence</span><b>{latest ? `${latest.sample_count.toLocaleString()} rows` : 'None saved'}</b><small>{latest ? `${latest.recipe_title} · ${evidenceReady ? 'handoff ready' : 'check package'}` : 'Record in Monitor & Data'}</small></div>
      <div className="runtime-kpi"><Bot size={16}/><span>OpenPenguin</span><b>{ai?.found ? 'Ready' : 'Offline'}</b><small>{ai?.found ? `${ai.models.length} local model(s)` : 'Optional local runtime'}</small></div>
    </div>
    {(blockers > 0 || warnings > 0) && <div className="boundary compact" style={{ marginTop: 10 }}><CircleAlert size={14}/><span><b>Highest-priority next check:</b> {!cli?.found ? 'restore Arduino CLI/toolchain' : diagnosis.code !== 'ready' ? `${diagnosis.title} — ${diagnosis.action}` : failed.length ? 'inspect failed Task Center jobs' : !latest ? 'save a Measurement Evidence package' : ai && !ai.found ? 'OpenPenguin is optional; core workflow can continue' : 'review current evidence'}</span></div>}
  </section>;
}
