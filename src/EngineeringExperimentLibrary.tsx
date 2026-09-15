import { useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { CheckCircle2, Code2, Cpu, FlaskConical, Play, Search, Upload } from 'lucide-react';
import experimentCatalogJson from '../engineering-lab-experiments/catalog.json';
import CopyButton from './CopyButton';
import { useHardwareSession } from './HardwareSession';

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

type AnalysisAsset = {
  id: string;
  label: string;
  purpose: string;
  path: string;
  url: string;
};

type ActiveAsset = {
  key: string;
  label: string;
  path: string;
  url: string;
  kind: 'firmware' | 'analysis';
  sketchName?: string;
};

const experimentCatalog = experimentCatalogJson as ExperimentSpec[];

const FIRMWARE_URLS: Record<string, string> = {
  EL_Radia_MLX90393_Field: new URL('../engineering-lab-experiments/firmware/EL_Radia_MLX90393_Field/EL_Radia_MLX90393_Field.ino', import.meta.url).href,
  EL_Oscillation_LSM6DSOX_VL53L1X: new URL('../engineering-lab-experiments/firmware/EL_Oscillation_LSM6DSOX_VL53L1X/EL_Oscillation_LSM6DSOX_VL53L1X.ino', import.meta.url).href,
  EL_Honeycomb_Dual_ADXL345: new URL('../engineering-lab-experiments/firmware/EL_Honeycomb_Dual_ADXL345/EL_Honeycomb_Dual_ADXL345.ino', import.meta.url).href,
  EL_Chaos_Encoder_Kinematics: new URL('../engineering-lab-experiments/firmware/EL_Chaos_Encoder_Kinematics/EL_Chaos_Encoder_Kinematics.ino', import.meta.url).href,
  EL_Oscillation_Photogate_Period: new URL('../engineering-lab-experiments/firmware/EL_Oscillation_Photogate_Period/EL_Oscillation_Photogate_Period.ino', import.meta.url).href,
  EL_Numerical_ADC_Reference: new URL('../engineering-lab-experiments/firmware/EL_Numerical_ADC_Reference/EL_Numerical_ADC_Reference.ino', import.meta.url).href,
  EL_ForceDynamics_HX711: new URL('../engineering-lab-experiments/firmware/EL_ForceDynamics_HX711/EL_ForceDynamics_HX711.ino', import.meta.url).href,
  EL_PowerContext_INA219: new URL('../engineering-lab-experiments/firmware/EL_PowerContext_INA219/EL_PowerContext_INA219.ino', import.meta.url).href,
  EL_Numerical_BME280_Context: new URL('../engineering-lab-experiments/firmware/EL_Numerical_BME280_Context/EL_Numerical_BME280_Context.ino', import.meta.url).href,
};

const ANALYSIS_ASSETS: AnalysisAsset[] = [
  {
    id: 'numeric-campaign',
    label: 'Numeric Error campaign analyzer',
    purpose: 'Independent host analysis for the wider numerical-error experiment family.',
    path: 'scripts/numeric_error_campaign_analyzer.py',
    url: new URL('../scripts/numeric_error_campaign_analyzer.py', import.meta.url).href,
  },
  {
    id: 'numeric-bridge',
    label: 'Arduino numerical-error bridge',
    purpose: 'RAW / REDUCED Taylor campaign capture and host-reference bridge.',
    path: 'scripts/arduino_numeric_error_bridge_v2.py',
    url: new URL('../scripts/arduino_numeric_error_bridge_v2.py', import.meta.url).href,
  },
  {
    id: 'bench02',
    label: 'Bench 02 numerical analyzer',
    purpose: 'Timing jitter, downsampling convergence, derivative/integration and accumulation diagnostics.',
    path: 'scripts/bench02_numerical_error.py',
    url: new URL('../scripts/bench02_numerical_error.py', import.meta.url).href,
  },
  {
    id: 'bench03',
    label: 'Bench 03 embedded reliability analyzer',
    purpose: 'Embedded numerical reliability, false convergence and error-source analysis.',
    path: 'scripts/bench03_embedded_numerical.py',
    url: new URL('../scripts/bench03_embedded_numerical.py', import.meta.url).href,
  },
  {
    id: 'magnet02',
    label: 'Magnet characterization analyzer',
    purpose: 'Baseline-corrected profile, repeatability, gradient and field-integral analysis.',
    path: 'scripts/magnet02_characterization.py',
    url: new URL('../scripts/magnet02_characterization.py', import.meta.url).href,
  },
  {
    id: 'magnet03',
    label: 'Magnet model-validation analyzer',
    purpose: 'Measured ↔ model residuals, fit diagnostics and suggested next measurement points.',
    path: 'scripts/magnet03_model_validation.py',
    url: new URL('../scripts/magnet03_model_validation.py', import.meta.url).href,
  },
  {
    id: 'labbridge-live',
    label: 'Engineering Lab live export bridge',
    purpose: 'Exports BetterBoard measurement evidence into the Engineering Lab live-link boundary.',
    path: 'scripts/labbridge_live_export.py',
    url: new URL('../scripts/labbridge_live_export.py', import.meta.url).href,
  },
  {
    id: 'research-bridge',
    label: 'Research bridge exporter',
    purpose: 'Structured research/evidence interchange for downstream scientific tools.',
    path: 'scripts/labbridge_v1_export.py',
    url: new URL('../scripts/labbridge_v1_export.py', import.meta.url).href,
  },
  {
    id: 'esp32-numerics',
    label: 'ESP32 numerical research analyzer',
    purpose: 'Host-side analysis for ESP32 numerical research evidence.',
    path: 'scripts/esp32_numerical_research_analyzer.py',
    url: new URL('../scripts/esp32_numerical_research_analyzer.py', import.meta.url).href,
  },
  {
    id: 'esp32-irregular-dt',
    label: 'ESP32 irregular-dt analyzer',
    purpose: 'Irregular sampling interval and integration/derivative timing analysis.',
    path: 'scripts/esp32_irregular_dt_analyzer.py',
    url: new URL('../scripts/esp32_irregular_dt_analyzer.py', import.meta.url).href,
  },
  {
    id: 'esp32-concurrency',
    label: 'ESP32 concurrency numerics analyzer',
    purpose: 'Concurrency-related numerical timing and reliability diagnostics.',
    path: 'scripts/esp32_concurrency_numerics_analyzer.py',
    url: new URL('../scripts/esp32_concurrency_numerics_analyzer.py', import.meta.url).href,
  },
];

async function loadText(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load source (${response.status})`);
  return response.text();
}

export default function EngineeringExperimentLibrary() {
  const { fqbn, selectedPort, diagnosis } = useHardwareSession();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState<ActiveAsset | null>(null);
  const [source, setSource] = useState('');
  const [status, setStatus] = useState('Select any experiment or analysis tool to inspect its real source code.');
  const [busy, setBusy] = useState(false);

  const experiments = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return experimentCatalog;
    return experimentCatalog.filter(item => [item.title, item.model_target, item.sensor, item.sketch_name, item.primary_observable]
      .some(value => value.toLowerCase().includes(needle)));
  }, [query]);

  async function viewAsset(asset: ActiveAsset) {
    setBusy(true);
    setActive(asset);
    setStatus(`Loading ${asset.path}…`);
    try {
      const text = await loadText(asset.url);
      setSource(text);
      setStatus(`Loaded ${asset.path} · ${text.split(/\r?\n/).length} lines · real repository source`);
    } catch (error) {
      setSource('');
      setStatus(`Source load failed: ${error}`);
    } finally {
      setBusy(false);
    }
  }

  async function ensureActiveFirmwareSource() {
    if (!active || active.kind !== 'firmware' || !active.sketchName) throw new Error('Select a firmware experiment first.');
    const text = source || await loadText(active.url);
    if (!text.trim()) throw new Error('Firmware source is empty.');
    if (!source) setSource(text);
    return { text, sketchName: active.sketchName };
  }

  async function verifyFirmware() {
    if (busy) return;
    setBusy(true);
    try {
      const firmware = await ensureActiveFirmwareSource();
      setStatus(`Saving ${firmware.sketchName} and compiling for ${fqbn}…`);
      const sketchDir = await invoke<string>('developer_sketch_save', { sketchName: firmware.sketchName, source: firmware.text });
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
      const firmware = await ensureActiveFirmwareSource();
      setStatus(`Compile → upload ${firmware.sketchName} to ${selectedPort}…`);
      const sketchDir = await invoke<string>('developer_sketch_save', { sketchName: firmware.sketchName, source: firmware.text });
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
    <div className="panel-title"><FlaskConical size={18}/> Complete Engineering Lab Experiment Library</div>
    <p className="muted">This surface is catalog-driven from <code>engineering-lab-experiments/catalog.json</code>. Every catalog experiment is exposed with its real firmware source, scientific columns/units and the same BetterBoard compile/upload backend used by Developer.</p>

    <div className="boundary"><CheckCircle2 size={14}/> {experimentCatalog.length} / {experimentCatalog.length} dedicated Engineering Lab firmware experiments connected to UI · {ANALYSIS_ASSETS.length} host analysis / bridge source files connected.</div>

    <label style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '12px 0' }}>
      <Search size={16}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search experiment, sensor, model target, observable…" style={{ flex: 1 }}/>
    </label>

    <div className="engineering-model-grid">
      {experiments.map(item => {
        const path = `engineering-lab-experiments/firmware/${item.sketch_name}/${item.sketch_name}.ino`;
        const asset: ActiveAsset = { key: item.id, label: item.title, path, url: FIRMWARE_URLS[item.sketch_name], kind: 'firmware', sketchName: item.sketch_name };
        return <article className="panel" key={item.id}>
          <div className="panel-title"><Cpu size={16}/>{item.title}</div>
          <div className="observatory-facts">
            <span>Sensor</span><b>{item.sensor}</b>
            <span>Model target</span><b>{item.model_target}</b>
            <span>Primary observable</span><b>{item.primary_observable}</b>
            <span>Columns</span><b>{item.columns.length}</b>
          </div>
          <p className="muted"><code>{path}</code></p>
          <div className="action-row">
            <button onClick={() => void viewAsset(asset)} disabled={busy}><Code2 size={15}/> View source</button>
            <CopyButton text={path} label="Copy path"/>
          </div>
        </article>;
      })}
    </div>

    <section className="panel" style={{ marginTop: 14 }}>
      <div className="panel-title"><Code2 size={17}/> Experiment analysis / bridge code</div>
      <p className="muted">These are the real host-side analyzers and bridges used by the experiment families. Select any file to inspect the actual Python source instead of only seeing a path label.</p>
      <div className="engineering-model-grid">
        {ANALYSIS_ASSETS.map(item => <article className="panel" key={item.id}>
          <b>{item.label}</b>
          <p>{item.purpose}</p>
          <p className="muted"><code>{item.path}</code></p>
          <div className="action-row">
            <button onClick={() => void viewAsset({ key: item.id, label: item.label, path: item.path, url: item.url, kind: 'analysis' })} disabled={busy}><Code2 size={15}/> View source</button>
            <CopyButton text={item.path} label="Copy path"/>
          </div>
        </article>)}
      </div>
    </section>

    <section className="panel" style={{ marginTop: 14 }}>
      <div className="panel-title"><Code2 size={17}/> Source viewer</div>
      <div className="boundary compact">{status}</div>
      {active && <div className="observatory-facts" style={{ marginTop: 10 }}>
        <span>Selected</span><b>{active.label}</b>
        <span>Source</span><b>{active.path}</b>
        <span>Type</span><b>{active.kind === 'firmware' ? 'Arduino firmware' : 'Host analysis / bridge'}</b>
        <span>Board target</span><b>{fqbn}</b>
      </div>}
      {active?.kind === 'firmware' && <div className="action-row" style={{ marginTop: 10 }}>
        <button onClick={() => void verifyFirmware()} disabled={busy || !diagnosis.canCompile}><Play size={15}/> Verify</button>
        <button onClick={() => void uploadFirmware()} disabled={busy || !selectedPort || !diagnosis.canUpload}><Upload size={15}/> Upload</button>
        {source && <CopyButton text={source} label="Copy source"/>}
      </div>}
      {active?.kind === 'analysis' && source && <div className="action-row" style={{ marginTop: 10 }}><CopyButton text={source} label="Copy source"/></div>}
      {source ? <pre style={{ marginTop: 12, maxHeight: 620, overflow: 'auto', whiteSpace: 'pre', textAlign: 'left' }}>{source}</pre> : <div className="empty compact" style={{ marginTop: 12 }}>Choose <b>View source</b> on any experiment or analyzer.</div>}
    </section>
  </section>;
}
