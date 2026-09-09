import { useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

type BoardPort = { port: string; protocol: string; board_name?: string; fqbn?: string };
type BoardProfile = { id: string; label: string; fqbn: string; core: string; default_baud: number; notes: string[] };
type MeasurementResult = {
  directory: string;
  csv_path: string;
  metadata_path: string;
  physical_lab_csv_path: string;
  physical_lab_bridge_path: string;
  samples: number;
};
type Mode = 'magnet01' | 'magnet02' | 'magnet03';

const MODES: Array<{ id: Mode; title: string; subtitle: string }> = [
  {
    id: 'magnet01',
    title: 'Magnet Bench 01 — Vector Field Acquisition',
    subtitle: 'MLX90393 → Bx / By / Bz / |B| → reproducible measurement package',
  },
  {
    id: 'magnet02',
    title: 'Magnet Bench 02 — Characterization & Mapping',
    subtitle: 'Baseline + fixed-position captures → repeatability / gradient / field profile',
  },
  {
    id: 'magnet03',
    title: 'Magnet Bench 03 — RADIA Model Validation',
    subtitle: 'Measured field profile ↔ model → residuals / fit / next measurement points',
  },
];

const panel: React.CSSProperties = {
  background: 'rgba(20,25,31,.96)',
  border: '1px solid #29313a',
  borderRadius: 16,
  padding: 18,
};
const muted: React.CSSProperties = { color: '#8e99a7', lineHeight: 1.55 };

export default function MagnetBenchSuite() {
  const [mode, setMode] = useState<Mode>('magnet01');
  const [ports, setPorts] = useState<BoardPort[]>([]);
  const [profiles, setProfiles] = useState<BoardProfile[]>([]);
  const [selectedPort, setSelectedPort] = useState('');
  const [fqbn, setFqbn] = useState('arduino:avr:uno');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('Ready');
  const [latestMeasurement, setLatestMeasurement] = useState<MeasurementResult | null>(null);
  const [baselineMeasurement, setBaselineMeasurement] = useState<MeasurementResult | null>(null);
  const [magnetMeasurement, setMagnetMeasurement] = useState<MeasurementResult | null>(null);
  const [scanCsvPath, setScanCsvPath] = useState('');
  const [modelCsvPath, setModelCsvPath] = useState('');
  const [measuredColumn, setMeasuredColumn] = useState('corrected_Bz_uT');
  const [modelColumn, setModelColumn] = useState('model_uT');
  const [modelUnit, setModelUnit] = useState<'uT' | 'mT' | 'T'>('uT');

  const activeMode = useMemo(() => MODES.find(item => item.id === mode)!, [mode]);

  async function refresh() {
    setStatus('Detecting boards…');
    try {
      const [boardPorts, boardProfiles] = await Promise.all([
        invoke<BoardPort[]>('board_list'),
        invoke<BoardProfile[]>('board_profiles'),
      ]);
      setPorts(boardPorts);
      setProfiles(boardProfiles);
      if (boardPorts.length && !boardPorts.some(p => p.port === selectedPort)) {
        setSelectedPort(boardPorts[0].port);
      }
      setStatus(boardPorts.length ? `${boardPorts.length} serial device(s) detected` : 'No USB serial board detected');
    } catch (error) {
      setStatus(String(error));
    }
  }

  useEffect(() => { refresh(); }, []);

  async function uploadMagnetFirmware() {
    if (!selectedPort) {
      setStatus('Select a serial device first.');
      return;
    }
    setBusy(true);
    try {
      setStatus('Preparing Magnet Bench 01 firmware…');
      const sketchDir = await invoke<string>('prepare_recipe', { recipeId: 'magnetic_mlx90393' });
      setStatus('Compiling…');
      await invoke<string>('compile_sketch', { sketchDir, fqbn });
      setStatus('Uploading…');
      const result = await invoke<string>('upload_sketch', { sketchDir, fqbn, port: selectedPort });
      setStatus(result.split('\n').filter(Boolean).slice(-2).join(' · ') || 'Upload succeeded');
    } catch (error) {
      setStatus(`Upload failed: ${error}`);
    } finally {
      setBusy(false);
    }
  }

  async function recordMagnetic(tag: 'latest' | 'baseline' | 'magnet', durationMs = 5000) {
    if (!selectedPort) {
      setStatus('Select a serial device first.');
      return;
    }
    setBusy(true);
    try {
      setStatus('Recording 3-axis magnetic-field measurement package…');
      const result = await invoke<MeasurementResult>('capture_measurement', {
        port: selectedPort,
        durationMs,
        maxLines: 5000,
        boardProfile: fqbn,
        recipeId: 'magnetic_mlx90393',
      });
      setLatestMeasurement(result);
      if (tag === 'baseline') setBaselineMeasurement(result);
      if (tag === 'magnet') setMagnetMeasurement(result);
      setStatus(`${result.samples} magnetic samples saved`);
    } catch (error) {
      setStatus(`Measurement failed: ${error}`);
    } finally {
      setBusy(false);
    }
  }

  const bench02SingleCommand = magnetMeasurement
    ? `python3 scripts/magnet02_characterization.py \\\n  "${magnetMeasurement.directory}"${baselineMeasurement ? ` \\\n  --baseline "${baselineMeasurement.directory}"` : ''}`
    : 'Record a magnet capture first; optionally record an ambient baseline.';

  const bench03Command = scanCsvPath && modelCsvPath
    ? `python3 scripts/magnet03_model_validation.py \\\n  "${scanCsvPath}" \\\n  "${modelCsvPath}" \\\n  --measured-column ${measuredColumn} \\\n  --model-column ${modelColumn} \\\n  --model-unit ${modelUnit}`
    : 'Enter the Magnet Bench 02 scan CSV and RADIA/model CSV paths to generate the exact validation command.';

  return <div style={{ minHeight: '100vh', background: 'radial-gradient(circle at 88% 0%,#1d2a36 0%,#0b0f13 38%)', color: '#edf2f7', padding: '28px 34px 60px' }}>
    <div style={{ maxWidth: 1320, margin: '0 auto' }}>
      <header style={{ marginBottom: 20 }}>
        <div>
          <div style={{ textTransform: 'uppercase', fontSize: 10, letterSpacing: '.13em', color: '#7f8d9b' }}>BetterBoard magnetic-field series</div>
          <h1 style={{ marginTop: 7 }}>Magnet Bench Suite</h1>
          <p style={muted}>One sensor path, three levels: acquire the vector field, characterize the magnet under controlled geometry, then compare measured field profiles with RADIA/model predictions.</p>
        </div>
        <button className="ghost" onClick={refresh}>Refresh hardware</button>
      </header>

      <section style={{ ...panel, marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          {MODES.map(item => <button
            key={item.id}
            onClick={() => setMode(item.id)}
            style={{
              textAlign: 'left', justifyContent: 'flex-start', alignItems: 'flex-start', flexDirection: 'column',
              background: mode === item.id ? '#f2f4f7' : '#11161c',
              color: mode === item.id ? '#111418' : '#dce4ec',
              border: `1px solid ${mode === item.id ? '#f2f4f7' : '#2a333c'}`,
              minHeight: 88,
            }}
          >
            <b>{item.title}</b>
            <span style={{ fontSize: 11, opacity: .72, lineHeight: 1.4 }}>{item.subtitle}</span>
          </button>)}
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 16 }}>
        <div>
          <div style={{ ...panel, marginBottom: 16 }}>
            <b>Hardware connection</b>
            <label>Serial device
              <select value={selectedPort} onChange={event => setSelectedPort(event.target.value)}>
                {!ports.length && <option value="">No USB serial device</option>}
                {ports.map(port => <option key={port.port} value={port.port}>{port.port} · {port.board_name || 'Unknown board'}</option>)}
              </select>
            </label>
            <label>Board profile
              <select value={fqbn} onChange={event => setFqbn(event.target.value)}>
                {profiles.map(profile => <option key={profile.fqbn} value={profile.fqbn}>{profile.label}</option>)}
              </select>
            </label>
            <div style={{ ...muted, fontSize: 11, marginTop: 12 }}>{status}</div>
          </div>

          <div style={panel}>
            <div style={{ fontSize: 11, color: '#7f8d9b' }}>CURRENT MODE</div>
            <h2 style={{ fontSize: 18 }}>{activeMode.title}</h2>
            <p style={{ ...muted, fontSize: 12 }}>{activeMode.subtitle}</p>
            {latestMeasurement && <div className="measurement big" style={{ marginTop: 12 }}>
              <b>{latestMeasurement.samples} samples</b>
              <span>{latestMeasurement.directory}</span>
            </div>}
          </div>
        </div>

        <div>
          {mode === 'magnet01' && <section style={panel}>
            <div style={{ textTransform: 'uppercase', fontSize: 10, letterSpacing: '.12em', color: '#7f8d9b' }}>Level 1 · Instrumentation</div>
            <h2>Vector Field Acquisition</h2>
            <p style={muted}>Acquire the complete lab-frame field vector instead of reducing the magnet to one number. The canonical stream preserves Bx, By, Bz, vector magnitude |B|, and the selected primary axis at 20 Hz.</p>
            <div className="bridge-flow" style={{ justifyContent: 'flex-start', marginTop: 18 }}>
              <div>magnet + fixture</div><b>→</b><div>MLX90393</div><b>→</b><div>Bx / By / Bz / |B|</div><b>→</b><div>measurement package</div>
            </div>
            <div className="action-row">
              <button className="primary" disabled={busy || !selectedPort} onClick={uploadMagnetFirmware}>Compile & Upload Magnet Bench 01</button>
              <button className="ghost" disabled={busy || !selectedPort} onClick={() => recordMagnetic('latest', 5000)}>Record 5 s field</button>
            </div>
            <div className="boundary" style={{ marginTop: 18 }}>This measures magnetic field at the sensor location and orientation. It does not by itself define an intrinsic magnet strength or prove calibration/model validity.</div>
          </section>}

          {mode === 'magnet02' && <section style={panel}>
            <div style={{ textTransform: 'uppercase', fontSize: 10, letterSpacing: '.12em', color: '#7f8d9b' }}>Level 2 · Experimental characterization</div>
            <h2>Background, Repeatability & Spatial Mapping</h2>
            <p style={muted}>Keep sensor orientation and scan geometry fixed. Record an ambient/background capture, then fixed-position magnet captures. The analyzer subtracts the baseline vector explicitly and can combine repeated positions into a field profile.</p>
            <div className="bridge-flow" style={{ justifyContent: 'flex-start', marginTop: 18 }}>
              <div>ambient baseline</div><b>+</b><div>fixed-position captures</div><b>→</b><div>background-corrected B</div><b>→</b><div>profile / gradient / repeatability</div>
            </div>
            <div className="action-row">
              <button className="ghost" disabled={busy || !selectedPort} onClick={() => recordMagnetic('baseline', 5000)}>Record ambient baseline</button>
              <button className="primary" disabled={busy || !selectedPort} onClick={() => recordMagnetic('magnet', 5000)}>Record magnet capture</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 16 }}>
              <div className="measurement big"><b>Baseline</b><span>{baselineMeasurement?.directory || 'not recorded in this session'}</span></div>
              <div className="measurement big"><b>Magnet capture</b><span>{magnetMeasurement?.directory || 'not recorded in this session'}</span></div>
            </div>
            <pre className="docs-preview" style={{ marginTop: 18, maxHeight: 180 }}>{bench02SingleCommand}</pre>
            <p style={{ ...muted, fontSize: 11, marginTop: 12 }}>For a real B(z) scan, record one package at each known position and run the same analyzer with repeated <code>--point POSITION_MM MEASUREMENT</code> arguments. Repeating a position provides between-capture repeatability evidence.</p>
            <div className="boundary">Background subtraction is only valid when the baseline is acquired under the same sensor orientation and comparable environment. Position and orientation control matter as much as the sensor value.</div>
          </section>}

          {mode === 'magnet03' && <section style={panel}>
            <div style={{ textTransform: 'uppercase', fontSize: 10, letterSpacing: '.12em', color: '#7f8d9b' }}>Level 3 · Model ↔ measurement validation</div>
            <h2>RADIA Field Validation</h2>
            <p style={muted}>Compare a Magnet Bench 02 spatial field profile with a RADIA or other forward-model series. The analysis mirrors Engineering Lab's digital-twin metrics: residuals, MAE/RMSE/bias, R², field integrals, affine discrepancy fit, and residual-guided suggestions for where to measure next.</p>
            <div className="bridge-flow" style={{ justifyContent: 'flex-start', marginTop: 18 }}>
              <div>measured B(z)</div><b>↔</b><div>RADIA/model B(z)</div><b>→</b><div>residual + fit</div><b>→</b><div>next measurement points</div>
            </div>

            <label>Magnet Bench 02 scan CSV
              <input value={scanCsvPath} onChange={event => setScanCsvPath(event.target.value)} placeholder="/path/to/magnet02_scan.csv" style={{ width: '100%', marginTop: 6, color: '#f5f7fa', background: '#0f1318', border: '1px solid #323a44', borderRadius: 9, padding: '10px 11px' }}/>
            </label>
            <label>RADIA/model CSV
              <input value={modelCsvPath} onChange={event => setModelCsvPath(event.target.value)} placeholder="/path/to/model_field.csv" style={{ width: '100%', marginTop: 6, color: '#f5f7fa', background: '#0f1318', border: '1px solid #323a44', borderRadius: 9, padding: '10px 11px' }}/>
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <label>Measured column
                <select value={measuredColumn} onChange={event => setMeasuredColumn(event.target.value)}>
                  <option value="corrected_Bx_uT">corrected_Bx_uT</option>
                  <option value="corrected_By_uT">corrected_By_uT</option>
                  <option value="corrected_Bz_uT">corrected_Bz_uT</option>
                  <option value="corrected_Bmag_uT">corrected_Bmag_uT</option>
                </select>
              </label>
              <label>Model column
                <input value={modelColumn} onChange={event => setModelColumn(event.target.value)} style={{ width: '100%', marginTop: 6, color: '#f5f7fa', background: '#0f1318', border: '1px solid #323a44', borderRadius: 9, padding: '10px 11px' }}/>
              </label>
              <label>Model unit
                <select value={modelUnit} onChange={event => setModelUnit(event.target.value as 'uT' | 'mT' | 'T')}>
                  <option value="uT">uT</option>
                  <option value="mT">mT</option>
                  <option value="T">T</option>
                </select>
              </label>
            </div>
            <pre className="docs-preview" style={{ marginTop: 18, maxHeight: 210 }}>{bench03Command}</pre>
            <div className="boundary">A small residual is evidence of agreement for the tested geometry; it is not proof that the sensor calibration, position registration, material model, or magnet geometry is correct. Keep those evidence layers separate.</div>
          </section>}
        </div>
      </section>
    </div>
  </div>;
}
