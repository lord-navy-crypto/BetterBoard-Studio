import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Database, RefreshCw } from 'lucide-react';
import { measurementEvidenceSource, useEvidenceVisualization } from './EvidenceVisualizationContext';
import type { ParsedNumericTable } from './AppliedStatistics';

type CapturedRow = { host_timestamp_ms: number; line: string; numeric: boolean };

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

function replayTable(replay: MeasurementReplay): { table: ParsedNumericTable; timestamps: number[] } {
  const columns = Object.fromEntries(replay.columns.map(column => [column, [] as number[]]));
  const timestamps: number[] = [];
  let acceptedRows = 0;
  let rejectedRows = 0;

  for (const row of replay.rows) {
    if (!row.numeric) {
      rejectedRows += 1;
      continue;
    }
    const values = row.line.split(',').map(value => Number(value.trim()));
    if (values.length !== replay.columns.length || values.some(value => !Number.isFinite(value))) {
      rejectedRows += 1;
      continue;
    }
    replay.columns.forEach((column, index) => columns[column].push(values[index]));
    timestamps.push(row.host_timestamp_ms);
    acceptedRows += 1;
  }

  return {
    table: {
      headers: [...replay.columns],
      columns,
      acceptedRows,
      rejectedRows,
      delimiter: ',',
    },
    timestamps,
  };
}

export default function SharedEvidenceSessionPicker() {
  const [sessions, setSessions] = useState<MeasurementSessionSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const shared = useEvidenceVisualization();

  async function refresh() {
    setBusy(true);
    try {
      const result = await invoke<MeasurementSessionSummary[]>('measurement_sessions', { limit: 30 });
      setSessions(result);
      setError('');
    } catch (cause) {
      setError(`Could not load saved measurement sessions: ${cause}`);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { void refresh(); }, []);

  async function selectSession(session: MeasurementSessionSummary) {
    setBusy(true);
    try {
      const replay = await invoke<MeasurementReplay>('measurement_session_load', { directory: session.directory });
      const { table, timestamps } = replayTable(replay);
      if (!table.acceptedRows) throw new Error('The selected measurement contains no complete numeric rows.');
      shared.setSource(measurementEvidenceSource({
        sourceId: replay.session.directory,
        label: replay.session.recipe_title || replay.session.directory,
        table,
        units: replay.units,
        primaryColumn: replay.primary_column,
        sampleRateHz: replay.sample_rate_hz,
        timestamps,
        recipeId: replay.session.recipe_id,
        recipeTitle: replay.session.recipe_title,
        evidenceDirectory: replay.session.directory,
        csvPath: replay.session.csv_path,
        metadataPath: replay.session.metadata_path,
      }));
      setError('');
    } catch (cause) {
      setError(`Could not use saved measurement for analysis: ${cause}`);
    } finally {
      setBusy(false);
    }
  }

  return <div className="shared-evidence-picker">
    <div className="shared-evidence-picker-head">
      <span><Database size={15}/><b>Saved Measurement Evidence</b><small>Choose one saved BetterBoard run once; Statistics, Models and DOE reuse the same source.</small></span>
      <button className="ghost mini" type="button" disabled={busy} onClick={() => void refresh()}><RefreshCw size={13}/>{busy ? 'Loading…' : 'Refresh'}</button>
    </div>
    {error && <div className="boundary compact">{error}</div>}
    <div className="shared-evidence-session-list">
      {sessions.slice(0, 8).map(session => {
        const selected = shared.source?.kind === 'measurement-session' && shared.source.sourceId === session.directory;
        return <button key={session.directory} type="button" className={`shared-evidence-session ${selected ? 'active' : ''}`} disabled={busy} onClick={() => void selectSession(session)}>
          <span><b>{session.recipe_title || session.recipe_id || 'Measurement'}</b><small>{session.created_at_utc || session.directory}</small></span>
          <span><b>{session.sample_count}</b><small>samples</small></span>
        </button>;
      })}
      {!sessions.length && !busy && <div className="empty compact">No saved BetterBoard measurement sessions were found.</div>}
    </div>
  </div>;
}
