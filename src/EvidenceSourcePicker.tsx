import { useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Database, RefreshCw } from 'lucide-react';
import type { ParsedNumericTable } from './AppliedStatistics';
import { measurementEvidenceSource, useEvidenceVisualization, type EvidenceVisualizationSource } from './EvidenceVisualizationContext';
import { useRunComparison } from './RunComparisonContext';

type MeasurementSessionSummary = {
  directory: string;
  created_at_utc: string;
  recipe_id?: string;
  recipe_title: string;
  sample_count: number;
  csv_path: string;
  metadata_path: string;
};

type MeasurementReplay = {
  session: MeasurementSessionSummary;
  columns: string[];
  units: string[];
  primary_column?: string | null;
  sample_rate_hz?: number | null;
  rows: Array<{ host_timestamp_ms: number; line: string; numeric: boolean }>;
};

function tableFromReplay(replay: MeasurementReplay): ParsedNumericTable {
  const allHeaders = replay.columns.length ? replay.columns : ['value'];
  const columns: Record<string, number[]> = Object.fromEntries(allHeaders.map(header => [header, []]));
  let acceptedRows = 0;
  let rejectedRows = 0;
  for (const row of replay.rows) {
    if (!row.numeric) { rejectedRows += 1; continue; }
    const cells = row.line.split(',').map(value => value.trim());
    let finiteCount = 0;
    for (let index = 0; index < allHeaders.length; index += 1) {
      const value = Number(cells[index]);
      if (Number.isFinite(value)) { columns[allHeaders[index]].push(value); finiteCount += 1; }
      else columns[allHeaders[index]].push(Number.NaN);
    }
    if (finiteCount) acceptedRows += 1;
    else rejectedRows += 1;
  }
  const headers = allHeaders.filter(header => columns[header].some(Number.isFinite));
  if (!headers.length) throw new Error('Saved session has no numeric analysis columns.');
  return { headers, columns: Object.fromEntries(headers.map(header => [header, columns[header]])), acceptedRows, rejectedRows, delimiter: ',' };
}

export default function EvidenceSourcePicker() {
  const shared = useEvidenceVisualization();
  const comparison = useRunComparison();
  const [sessions, setSessions] = useState<MeasurementSessionSummary[]>([]);
  const [selectedDirectory, setSelectedDirectory] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function refresh() {
    setBusy(true);
    try {
      const list = await invoke<MeasurementSessionSummary[]>('measurement_sessions', { limit: 50 });
      setSessions(list);
      setSelectedDirectory(current => current && list.some(item => item.directory === current) ? current : (list[0]?.directory ?? ''));
      setError('');
    } catch (cause) {
      setError(String(cause));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { void refresh(); }, []);

  const selected = useMemo(() => sessions.find(session => session.directory === selectedDirectory) ?? null, [sessions, selectedDirectory]);

  async function loadSelectedSource(): Promise<EvidenceVisualizationSource | null> {
    if (!selected) return null;
    const replay = await invoke<MeasurementReplay>('measurement_session_load', { directory: selected.directory });
    const table = tableFromReplay(replay);
    const numericRows = replay.rows.filter(row => row.numeric);
    const origin = numericRows[0]?.host_timestamp_ms ?? 0;
    return measurementEvidenceSource({
      sourceId: selected.directory,
      label: `${selected.recipe_title} · ${new Date(selected.created_at_utc).toLocaleString()}`,
      table,
      units: replay.units,
      primaryColumn: replay.primary_column ?? null,
      sampleRateHz: replay.sample_rate_hz ?? null,
      timestamps: numericRows.map(row => (row.host_timestamp_ms - origin) / 1000),
      recipeId: selected.recipe_id ?? null,
      recipeTitle: selected.recipe_title,
      evidenceDirectory: selected.directory,
      csvPath: selected.csv_path,
      metadataPath: selected.metadata_path,
    });
  }

  async function withSelected(action: (source: EvidenceVisualizationSource) => void) {
    if (!selected || busy) return;
    setBusy(true);
    try {
      const source = await loadSelectedSource();
      if (source) action(source);
      setError('');
    } catch (cause) {
      setError(String(cause));
    } finally {
      setBusy(false);
    }
  }

  return <div className="analysis-evidence-picker" data-capability-anchor="evidence-source-picker">
    <div className="panel-title" style={{ marginBottom: 0 }}><Database size={15}/> Saved BetterBoard evidence</div>
    <div className="action-row" style={{ margin: 0 }}>
      <select value={selectedDirectory} disabled={busy || !sessions.length} onChange={event => setSelectedDirectory(event.target.value)}>
        {!sessions.length && <option value="">No saved measurement sessions</option>}
        {sessions.map(session => <option key={session.directory} value={session.directory}>{session.recipe_title} · {session.sample_count} samples · {new Date(session.created_at_utc).toLocaleString()}</option>)}
      </select>
      <button className="primary" disabled={busy || !selected} onClick={() => void withSelected(source => shared.setSource(source))}>Use as analysis evidence</button>
      <button className="ghost" disabled={busy || !selected} onClick={() => void withSelected(comparison.setRunA)}>Set as Run A</button>
      <button className="ghost" disabled={busy || !selected} onClick={() => void withSelected(comparison.setRunB)}>Set as Run B</button>
      <button className="ghost" disabled={busy} onClick={() => void refresh()}><RefreshCw size={13}/> Refresh</button>
    </div>
    {error && <div className="boundary compact">{error}</div>}
    <small className="muted">Selecting a session shares its numeric table and metadata with Statistics, Models and Experiment Design. Run A / Run B stay separate comparison inputs; derived results are never written back into either saved package.</small>
  </div>;
}