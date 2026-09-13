import { useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { CircleAlert, Database, FileJson, RefreshCw, ShieldCheck, Waypoints } from 'lucide-react';
import CopyButton from './CopyButton';

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

export default function EvidenceInspector() {
  const [session, setSession] = useState<MeasurementSessionSummary | null>(null);
  const [replay, setReplay] = useState<MeasurementReplay | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function refresh() {
    setBusy(true);
    setError('');
    try {
      const sessions = await invoke<MeasurementSessionSummary[]>('measurement_sessions', { limit: 1 });
      const latest = sessions[0] ?? null;
      setSession(latest);
      if (!latest) {
        setReplay(null);
        return;
      }
      try {
        setReplay(await invoke<MeasurementReplay>('measurement_session_load', { directory: latest.directory }));
      } catch (loadError) {
        setReplay(null);
        setError(`Latest package exists, but replay inspection failed: ${loadError}`);
      }
    } catch (refreshError) {
      setSession(null);
      setReplay(null);
      setError(`Evidence inspection failed: ${refreshError}`);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { void refresh(); }, []);

  const numericRows = useMemo(() => replay?.rows.filter(row => row.numeric).length ?? 0, [replay]);
  const replayComplete = Boolean(session && replay && replay.rows.length === session.sample_count);
  const bridgeReady = Boolean(session?.physical_lab_bridge_path && session?.physical_lab_csv_path);
  const provenanceReady = Boolean(session?.metadata_path && session?.board_profile && session?.port);

  return <section className="panel" style={{ margin: '14px 18px' }} aria-label="Latest evidence inspector">
    <div className="panel-title panel-title-with-action">
      <span><Database size={18}/> Evidence Inspector</span>
      <button className="ghost mini" disabled={busy} onClick={() => void refresh()}><RefreshCw size={13}/> Refresh latest</button>
    </div>
    <p className="muted">A compact view of the latest saved Measurement Evidence package. Raw data, provenance, engineering handoff and AI interpretation remain separate layers.</p>

    {!session ? <div className="empty compact">No saved evidence package yet. Record one in Monitor & Data to populate this inspector.</div> : <>
      <div className="schema-row" style={{ marginBottom: 10 }}>
        <span>{session.recipe_title}</span><span>{session.sample_count.toLocaleString()} saved rows</span><span>{new Date(session.created_at_utc).toLocaleString()}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 10 }}>
        <div className="boundary compact"><Database size={15}/><span><b>Raw evidence</b><br/>{replay ? `${replay.rows.length.toLocaleString()} replay rows · ${numericRows.toLocaleString()} numeric` : 'Package saved; replay unavailable'}<br/><small>{replayComplete ? 'Saved/replay row counts agree' : 'Check replay completeness'}</small></span></div>
        <div className="boundary compact"><FileJson size={15}/><span><b>Provenance</b><br/>{session.board_profile}<br/><small>{session.port} · {provenanceReady ? 'metadata bound' : 'metadata incomplete'}</small></span></div>
        <div className="boundary compact"><Waypoints size={15}/><span><b>Engineering handoff</b><br/>{bridgeReady ? 'Bridge outputs ready' : 'Bridge outputs incomplete'}<br/><small>{replay?.columns.length ?? '—'} channel(s) · primary {replay?.primary_column || 'unspecified'}</small></span></div>
        <div className="boundary compact"><ShieldCheck size={15}/><span><b>Interpretation boundary</b><br/>Derived analysis and AI suggestions remain downstream of this raw package.<br/><small>Evidence is not automatic proof of calibration or model validity.</small></span></div>
      </div>
      <details style={{ marginTop: 10 }}><summary className="eyebrow" style={{ cursor: 'pointer' }}>Inspect package paths</summary>
        <div className="measurement big" style={{ marginTop: 8 }}>
          <span>Data: {session.csv_path} <CopyButton text={session.csv_path} label="Copy" /></span>
          <span>Metadata: {session.metadata_path} <CopyButton text={session.metadata_path} label="Copy" /></span>
          <span>Engineering bridge: {session.physical_lab_bridge_path} <CopyButton text={session.physical_lab_bridge_path} label="Copy" /></span>
        </div>
      </details>
    </>}
    {error && <div className="boundary compact" style={{ marginTop: 10 }}><CircleAlert size={14}/>{error}</div>}
  </section>;
}
