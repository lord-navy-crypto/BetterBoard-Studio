import { useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ArrowRight, Database, FileCheck2, Magnet, Sigma, UploadCloud, Wrench } from 'lucide-react';
import NumericalBenchSuiteV2 from './NumericalBenchSuiteV2';
import NumericalBenchAdvanced from './NumericalBenchAdvanced';
import MagnetBenchSuiteV2 from './MagnetBenchSuiteV2';
import MagnetBenchAdvanced from './MagnetBenchAdvanced';
import StudioAdvanced from './StudioAdvanced';
import CopyButton from './CopyButton';

type MeasurementSessionSummary = {
  directory: string;
  created_at_utc: string;
  recipe_title: string;
  sample_count: number;
  csv_path: string;
  metadata_path: string;
  physical_lab_csv_path: string;
  physical_lab_bridge_path: string;
};

type Lane = 'numerical' | 'magnet';

export default function EngineeringPreparationStudio() {
  const [lane, setLane] = useState<Lane>('numerical');
  const [sessions, setSessions] = useState<MeasurementSessionSummary[]>([]);
  const [selected, setSelected] = useState<MeasurementSessionSummary | null>(null);
  const [loaded, setLoaded] = useState(false);

  async function loadEvidence() {
    const list = await invoke<MeasurementSessionSummary[]>('measurement_sessions', { limit: 50 });
    setSessions(list);
    setSelected(list[0] ?? null);
    setLoaded(true);
  }

  const exportText = useMemo(() => selected ? [
    'BetterBoard → Engineering Lab handoff',
    `Recipe: ${selected.recipe_title}`,
    `Samples: ${selected.sample_count}`,
    `data.csv: ${selected.csv_path}`,
    `metadata.json: ${selected.metadata_path}`,
    `physical_lab_v1.csv: ${selected.physical_lab_csv_path}`,
    `bridge: ${selected.physical_lab_bridge_path}`,
  ].join('\n') : '', [selected]);

  return <section className="panel" style={{ maxWidth: 1420, margin: '18px auto 52px' }}>
    <div className="panel-title"><Wrench size={18}/> Engineering Preparation</div>
    <p className="muted">Reusable evidence preparation, bridge tooling and expert analyzers live in Studio. Experiments is reserved for model-specific Engineering Lab campaigns.</p>

    <div className="action-row" style={{ marginBottom: 14 }}>
      <button className={lane === 'numerical' ? 'primary' : 'ghost'} onClick={() => setLane('numerical')}><Sigma size={15}/> Numerical preparation</button>
      <button className={lane === 'magnet' ? 'primary' : 'ghost'} onClick={() => setLane('magnet')}><Magnet size={15}/> Magnetic preparation</button>
    </div>

    {lane === 'numerical' && <>
      <div className="boundary compact">Bench 01 / 02 / 03 are preparation stages: acquisition evidence, sampling/discretization evidence and MCU numerical-reliability evidence. They prepare a trustworthy package; they are not themselves the final Engineering Lab experiment.</div>
      <NumericalBenchSuiteV2/>
      <details style={{ marginTop: 14 }}><summary><b>Numerical expert analyzer</b> · classic / exact controls</summary><NumericalBenchAdvanced/></details>
    </>}

    {lane === 'magnet' && <>
      <div className="boundary compact">Magnetic preparation is organized as acquisition → field characterization → residual/model handoff. Keep raw sensor evidence, calibration assumptions and model comparison separate so a clean curve cannot hide a bad measurement.</div>
      <MagnetBenchSuiteV2/>
      <details style={{ marginTop: 14 }}><summary><b>Magnetic expert analyzer</b> · advanced residual / characterization controls</summary><MagnetBenchAdvanced/></details>
    </>}

    <section className="panel engineering-handoff" style={{ marginTop: 18 }}>
      <div className="panel-title"><UploadCloud size={18}/> BetterBoard → Engineering Lab handoff</div>
      <p className="muted">Preparation ends by producing inspectable files. Engineering Lab should independently recompute or validate the result instead of trusting BetterBoard's displayed summary.</p>
      <button className="ghost" onClick={() => void loadEvidence()}><Database size={15}/> Load saved evidence</button>
      {!loaded ? <div className="empty compact">Load evidence to browse recent measurement packages.</div> : !sessions.length ? <div className="empty compact">No saved measurement sessions yet.</div> : <>
        <select value={selected?.directory ?? ''} onChange={e => setSelected(sessions.find(s => s.directory === e.target.value) ?? null)}>
          {sessions.map(s => <option key={s.directory} value={s.directory}>{s.recipe_title} · {s.sample_count} samples · {new Date(s.created_at_utc).toLocaleString()}</option>)}
        </select>
        {selected && <div className="measurement big"><b>{selected.recipe_title}</b><span>data.csv · {selected.csv_path}</span><span>metadata.json · {selected.metadata_path}</span><span>Physical Lab v1 · {selected.physical_lab_csv_path}</span><span>bridge · {selected.physical_lab_bridge_path}</span></div>}
        <div className="action-row"><CopyButton text={exportText} label="Copy handoff"/><CopyButton text={selected?.csv_path || ''} label="Copy data path"/><CopyButton text={selected?.physical_lab_bridge_path || ''} label="Copy bridge path"/></div>
      </>}
      <div className="boundary"><FileCheck2 size={14}/> Handoff success means the evidence package exists and is traceable. It does not prove the physical measurement or computational model is correct.</div>
    </section>

    <details style={{ marginTop: 14 }}>
      <summary><b>Studio compatibility tools</b> · reusable classic workflow</summary>
      <p className="muted"><ArrowRight size={14}/> Legacy proven controls remain available here in Studio rather than being mixed into Experiments.</p>
      <StudioAdvanced/>
    </details>
  </section>;
}
