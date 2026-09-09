import { useMemo, useState } from 'react';
import { ArrowRight, Database, FileCheck2, FlaskConical, Magnet, Sigma, UploadCloud } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import NumericalBenchSuiteV2 from './NumericalBenchSuiteV2';
import MagnetBenchSuiteV2 from './MagnetBenchSuiteV2';
import NumericalBenchAdvanced from './NumericalBenchAdvanced';
import MagnetBenchAdvanced from './MagnetBenchAdvanced';
import StudioAdvanced from './StudioAdvanced';
import CopyButton from './CopyButton';

type MeasurementSessionSummary = { directory:string; created_at_utc:string; recipe_title:string; sample_count:number; csv_path:string; metadata_path:string; physical_lab_csv_path:string; physical_lab_bridge_path:string };
const ENGINEERING_MODELS = [
  { title:'Numerical Error Analysis', detail:'Taylor evaluation · cancellation · floating-point reliability · convergence', icon:Sigma, bridge:'Use BetterBoard numerical firmware/measurement evidence as real-MCU evidence beside Engineering Lab reference and convergence campaigns.' },
  { title:'Oscillation & Numerical Integration', detail:'Euler · symplectic · RK methods · energy/work checks', icon:FlaskConical, bridge:'Arduino timing/sensor evidence can enter Engineering Lab as measured dynamics and integration-validation evidence.' },
  { title:'RADIA Magnet Studio', detail:'3-D magnetic field · measured/model residual · trajectory', icon:Magnet, bridge:'BetterBoard Magnet acquisition/characterization/model residuals already have an independent Engineering Lab validation bridge.' },
];

export default function ExperimentsHub() {
  const [sessions, setSessions] = useState<MeasurementSessionSummary[]>([]);
  const [selected, setSelected] = useState<MeasurementSessionSummary | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [tool, setTool] = useState<'none'|'numerical'|'magnet'>('none');
  const [expert, setExpert] = useState<'studio'|'numerical'|'magnet'>('numerical');
  async function loadEvidence() {
    const list = await invoke<MeasurementSessionSummary[]>('measurement_sessions',{limit:50}); setSessions(list); setSelected(list[0] ?? null); setLoaded(true);
  }
  const exportText = useMemo(() => selected ? [
    'BetterBoard → Engineering Lab handoff', `Recipe: ${selected.recipe_title}`, `Samples: ${selected.sample_count}`,
    `data.csv: ${selected.csv_path}`, `metadata.json: ${selected.metadata_path}`, `physical_lab_v1.csv: ${selected.physical_lab_csv_path}`, `bridge: ${selected.physical_lab_bridge_path}`,
  ].join('\n') : '', [selected]);

  return <div className="experiments-hub">
    <section className="experiment-bridge-hero"><div><div className="eyebrow">Connect with Engineering Lab</div><h1>Turn Arduino measurements into Engineering Lab evidence.</h1><p>General Arduino learning, hardware recipes and reusable firmware belong in Studio → Recipe Library. Experiments is reserved for workflows that connect real BetterBoard acquisition to Engineering Lab computational models, validation and evidence.</p></div><button className="primary" onClick={() => void loadEvidence()}><Database size={15}/> Load BetterBoard evidence</button></section>

    <section className="engineering-model-grid">{ENGINEERING_MODELS.map(item => { const Icon=item.icon; return <article className="panel" key={item.title}><div className="panel-title"><Icon size={18}/>{item.title}</div><p>{item.detail}</p><div className="boundary compact">{item.bridge}</div></article>; })}</section>

    <section className="panel engineering-handoff">
      <div className="panel-title"><UploadCloud size={18}/> BetterBoard → Engineering Lab handoff</div>
      <p className="muted">Choose a saved Measurement Evidence package. BetterBoard preserves raw data, metadata and bridge files; Engineering Lab should independently recompute or validate rather than trusting BetterBoard's displayed summary.</p>
      {!loaded ? <div className="empty compact">Load evidence to browse recent BetterBoard sessions.</div> : !sessions.length ? <div className="empty compact">No saved measurement sessions yet.</div> : <>
        <select value={selected?.directory ?? ''} onChange={e => setSelected(sessions.find(s=>s.directory===e.target.value) ?? null)}>{sessions.map(s => <option key={s.directory} value={s.directory}>{s.recipe_title} · {s.sample_count} samples · {new Date(s.created_at_utc).toLocaleString()}</option>)}</select>
        {selected && <div className="measurement big"><b>{selected.recipe_title}</b><span>data.csv · {selected.csv_path}</span><span>metadata.json · {selected.metadata_path}</span><span>Physical Lab v1 · {selected.physical_lab_csv_path}</span><span>bridge · {selected.physical_lab_bridge_path}</span></div>}
        <div className="action-row"><CopyButton text={exportText} label="Copy handoff"/><CopyButton text={selected?.csv_path || ''} label="Copy data path"/><CopyButton text={selected?.physical_lab_bridge_path || ''} label="Copy bridge path"/></div>
      </>}
      <div className="boundary"><FileCheck2 size={14}/> A successful handoff means the files are available for Engineering Lab analysis. It does not mean the physical measurement or model has been validated.</div>
    </section>

    <section className="panel" style={{maxWidth:1420,margin:'14px auto 50px'}}><div className="panel-title"><ArrowRight size={18}/> Bridge tools</div><p className="muted">These are BetterBoard-side preparation tools for Engineering Lab workflows, not a second Recipe Library.</p><div className="action-row"><button className={tool==='numerical'?'primary':'ghost'} onClick={()=>setTool(tool==='numerical'?'none':'numerical')}><Sigma size={15}/> Numerical evidence preparation</button><button className={tool==='magnet'?'primary':'ghost'} onClick={()=>setTool(tool==='magnet'?'none':'magnet')}><Magnet size={15}/> Magnet evidence preparation</button></div><div hidden={tool!=='numerical'}><NumericalBenchSuiteV2/></div><div hidden={tool!=='magnet'}><MagnetBenchSuiteV2/></div></section>
    <section className="panel" style={{maxWidth:1420,margin:'14px auto 50px'}}><details><summary><b>Expert workflows</b> · exact analyzers / classic controls</summary><p className="muted">Compatibility controls remain reachable so the Engineering Lab refocus does not delete proven analysis paths. They are not primary Experiment navigation.</p><div className="action-row"><button className={expert==='studio'?'primary':'ghost'} onClick={()=>setExpert('studio')}>Studio expert</button><button className={expert==='numerical'?'primary':'ghost'} onClick={()=>setExpert('numerical')}>Numerical expert</button><button className={expert==='magnet'?'primary':'ghost'} onClick={()=>setExpert('magnet')}>Magnet expert</button></div><div hidden={expert!=='studio'}><StudioAdvanced/></div><div hidden={expert!=='numerical'}><NumericalBenchAdvanced/></div><div hidden={expert!=='magnet'}><MagnetBenchAdvanced/></div></details></section>
  </div>;
}
