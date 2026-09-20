import { useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { CheckCircle2, Code2, Cpu, FlaskConical, Play, Search, Upload } from 'lucide-react';
import experimentCatalogJson from '../engineering-lab-experiments/catalog.json';
import CopyButton from './CopyButton';
import { useHardwareSession } from './HardwareSession';
import { ALL_PROGRAM_ASSETS, PROGRAM_FAMILY_ORDER, loadProgramAsset, type ProgramAsset, type ProgramFamily } from './ProgramLibraryCatalog';

type ExperimentSpec = {
  id: string;
  title: string;
  model_target: string;
  sensor: string;
  sketch_name: string;
  primary_observable: string;
  columns: string[];
  units: string[];
};

type CodeAsset = ProgramAsset & { catalog?: ExperimentSpec };

const experimentCatalog = experimentCatalogJson as ExperimentSpec[];
const catalogBySketch = new Map(experimentCatalog.map(item => [item.sketch_name, item]));
const FAMILY_ORDER = PROGRAM_FAMILY_ORDER;
const ALL_ASSETS: CodeAsset[] = ALL_PROGRAM_ASSETS.map(asset => ({
  ...asset,
  catalog: asset.sketchName ? catalogBySketch.get(asset.sketchName) : undefined,
}));

function assetSearchText(asset: CodeAsset) {
  const catalog = asset.catalog;
  return [
    asset.label,
    asset.path,
    asset.family,
    asset.sketchName ?? '',
    catalog?.model_target ?? '',
    catalog?.sensor ?? '',
    catalog?.primary_observable ?? '',
    ...(catalog?.columns ?? []),
  ].join(' ').toLowerCase();
}

export default function EngineeringExperimentLibrary() {
  const { fqbn, selectedPort, diagnosis } = useHardwareSession();
  const [query, setQuery] = useState('');
  const [family, setFamily] = useState<'All' | ProgramFamily>('All');
  const [active, setActive] = useState<CodeAsset | null>(null);
  const [activeSource, setActiveSource] = useState('');
  const [status, setStatus] = useState('Select any experiment or analysis tool to inspect its real repository source code.');
  const [busy, setBusy] = useState(false);

  const counts = useMemo(() => Object.fromEntries(FAMILY_ORDER.map(name => [name, ALL_ASSETS.filter(asset => asset.family === name).length])) as Record<ProgramFamily, number>, []);

  const visibleAssets = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return ALL_ASSETS.filter(asset => (family === 'All' || asset.family === family) && (!needle || assetSearchText(asset).includes(needle)));
  }, [query, family]);


  async function viewAsset(asset: CodeAsset) {
    if (busy) return;
    setBusy(true);
    setActive(asset);
    setActiveSource('');
    setStatus(`Loading ${asset.path}…`);
    try {
      const source = await loadProgramAsset(asset);
      setActiveSource(source);
      setStatus(`Loaded ${asset.path} · ${source.split(/\r?\n/).length} lines · real repository source`);
    } catch (error) {
      setStatus(`Source load failed: ${error}`);
    } finally {
      setBusy(false);
    }
  }

  async function activeFirmware() {
    if (!active || active.kind !== 'firmware' || !active.sketchName) throw new Error('Select a firmware experiment first.');
    const source = activeSource || await loadProgramAsset(active);
    if (!activeSource) setActiveSource(source);
    return { source, sketchName: active.sketchName };
  }

  async function verifyFirmware() {
    if (busy) return;
    setBusy(true);
    try {
      const firmware = await activeFirmware();
      setStatus(`Saving ${firmware.sketchName} and compiling for ${fqbn}…`);
      const sketchDir = await invoke<string>('developer_sketch_save', { sketchName: firmware.sketchName, source: firmware.source });
      const result = await invoke<string>('compile_sketch', { sketchDir, fqbn });
      setStatus(result.trim() || `Verify succeeded for ${firmware.sketchName}.`);
    } catch (error) {
      setStatus(`Verify failed: ${error}`);
    } finally {
      setBusy(false);
    }
  }

  async function uploadFirmware() {
    if (busy) return;
    if (!selectedPort) {
      setStatus('Upload blocked: select a connected board first.');
      return;
    }
    setBusy(true);
    try {
      const firmware = await activeFirmware();
      setStatus(`Compile → upload ${firmware.sketchName} to ${selectedPort}…`);
      const sketchDir = await invoke<string>('developer_sketch_save', { sketchName: firmware.sketchName, source: firmware.source });
      await invoke<string>('compile_sketch', { sketchDir, fqbn });
      const result = await invoke<string>('upload_sketch', { sketchDir, fqbn, port: selectedPort });
      setStatus(result.trim() || `Upload succeeded to ${selectedPort}.`);
    } catch (error) {
      setStatus(`Upload failed: ${error}`);
    } finally {
      setBusy(false);
    }
  }

  return <section className="panel" style={{ maxWidth: 1420, margin: '14px auto' }}>
    <div className="panel-title"><FlaskConical size={18}/> Experiment Library · unified program inventory</div>
    <p className="muted">Shared repository-driven source browser. This is the same program inventory used by Studio → Recipe Library and Developer → Load Template, with Engineering Lab scientific metadata layered on top.</p>

    <div className="boundary"><CheckCircle2 size={14}/> {ALL_ASSETS.length} source files connected to UI · {experimentCatalog.length}/{experimentCatalog.length} dedicated Engineering Lab catalog experiments enriched with scientific metadata · no hand-maintained per-file visibility list.</div>

    <div className="engineering-model-grid" style={{ marginTop: 12 }}>
      {FAMILY_ORDER.map(name => <button key={name} className={family === name ? 'active' : ''} onClick={() => setFamily(name)}>
        <b>{name}</b><span style={{ marginLeft: 8 }}>{counts[name]}</span>
      </button>)}
      <button className={family === 'All' ? 'active' : ''} onClick={() => setFamily('All')}><b>All code</b><span style={{ marginLeft: 8 }}>{ALL_ASSETS.length}</span></button>
    </div>

    <label style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '12px 0' }}>
      <Search size={16}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search file, sensor, model target, observable, family…" style={{ flex: 1 }}/>
    </label>

    <div className="boundary compact">Showing {visibleAssets.length} / {ALL_ASSETS.length} source files · filter: {family}</div>

    <div className="engineering-model-grid" style={{ marginTop: 12 }}>
      {visibleAssets.map(asset => <article className="panel" key={asset.key}>
        <div className="panel-title"><Cpu size={16}/>{asset.label}</div>
        <div className="observatory-facts">
          <span>Family</span><b>{asset.family}</b>
          <span>Type</span><b>{asset.kind === 'firmware' ? 'Arduino firmware' : 'Python host tool'}</b>
          {asset.catalog && <><span>Sensor</span><b>{asset.catalog.sensor}</b><span>Model target</span><b>{asset.catalog.model_target}</b><span>Primary observable</span><b>{asset.catalog.primary_observable}</b></>}
        </div>
        <p className="muted"><code>{asset.path}</code></p>
        <div className="action-row">
          <button onClick={() => void viewAsset(asset)} disabled={busy}><Code2 size={15}/> View source</button>
          <CopyButton text={asset.path} label="Copy path"/>
        </div>
      </article>)}
    </div>

    {!visibleAssets.length && <div className="empty compact">No code files match this filter.</div>}

    <section className="panel" style={{ marginTop: 14 }}>
      <div className="panel-title"><Code2 size={17}/> Source viewer & firmware actions</div>
      <div className="boundary compact">{status}</div>
      {active && <div className="observatory-facts" style={{ marginTop: 10 }}>
        <span>Selected</span><b>{active.label}</b>
        <span>Source</span><b>{active.path}</b>
        <span>Family</span><b>{active.family}</b>
        <span>Type</span><b>{active.kind === 'firmware' ? 'Arduino firmware' : 'Host analysis / bridge'}</b>
        <span>Board target</span><b>{active.kind === 'firmware' ? fqbn : 'host'}</b>
      </div>}
      {active?.kind === 'firmware' && <div className="action-row" style={{ marginTop: 10 }}>
        <button onClick={() => void verifyFirmware()} disabled={busy || !diagnosis.canCompile}><Play size={15}/> Verify</button>
        <button onClick={() => void uploadFirmware()} disabled={busy || !selectedPort || !diagnosis.canUpload}><Upload size={15}/> Upload</button>
        {activeSource && <CopyButton text={activeSource} label="Copy source"/>}
      </div>}
      {active?.kind === 'analysis' && activeSource && <div className="action-row" style={{ marginTop: 10 }}><CopyButton text={activeSource} label="Copy source"/></div>}
      {activeSource ? <pre style={{ marginTop: 12, maxHeight: 620, overflow: 'auto', whiteSpace: 'pre', textAlign: 'left' }}>{activeSource}</pre> : <div className="empty compact" style={{ marginTop: 12 }}>{busy ? 'Loading source…' : 'Choose View source on any firmware or host tool.'}</div>}
    </section>
  </section>;
}
