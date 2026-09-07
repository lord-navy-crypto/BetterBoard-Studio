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
type CaptureResult = { lines: string[]; numeric_rows: number; ignored_rows: number };
type Mode = 'bench01' | 'bench02' | 'bench03';

const MODES: Array<{ id: Mode; title: string; subtitle: string }> = [
  {
    id: 'bench01',
    title: 'Bench 01 — Analog Control & Instrumentation',
    subtitle: 'Physical input → ADC → filtering/PWM → real measurement',
  },
  {
    id: 'bench02',
    title: 'Bench 02 — Sampling & Numerical Error',
    subtitle: 'Measured time series → sampling/discretization/integration error',
  },
  {
    id: 'bench03',
    title: 'Bench 03 — Embedded Numerical Reliability',
    subtitle: 'Taylor recurrence on the MCU → oracle comparison → reliability',
  },
];

const panel: React.CSSProperties = {
  background: 'rgba(20,25,31,.96)',
  border: '1px solid #29313a',
  borderRadius: 16,
  padding: 18,
};

const muted: React.CSSProperties = { color: '#8e99a7', lineHeight: 1.55 };

export default function NumericalBenchSuite() {
  const [mode, setMode] = useState<Mode>('bench01');
  const [ports, setPorts] = useState<BoardPort[]>([]);
  const [profiles, setProfiles] = useState<BoardProfile[]>([]);
  const [selectedPort, setSelectedPort] = useState('');
  const [fqbn, setFqbn] = useState('arduino:avr:uno');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('Ready');
  const [measurement, setMeasurement] = useState<MeasurementResult | null>(null);
  const [preview, setPreview] = useState<string[]>([]);

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
  useEffect(() => { setMeasurement(null); setPreview([]); }, [mode]);

  async function uploadRecipe(recipeId: string) {
    if (!selectedPort) {
      setStatus('Select a serial device first.');
      return;
    }
    setBusy(true);
    try {
      setStatus('Preparing firmware…');
      const sketchDir = await invoke<string>('prepare_recipe', { recipeId });
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

  async function recordRecipe(recipeId: string, durationMs: number) {
    if (!selectedPort) {
      setStatus('Select a serial device first.');
      return;
    }
    setBusy(true);
    try {
      setStatus('Recording BetterBoard measurement package…');
      const result = await invoke<MeasurementResult>('capture_measurement', {
        port: selectedPort,
        durationMs,
        maxLines: 10000,
        boardProfile: fqbn,
        recipeId,
      });
      setMeasurement(result);
      setStatus(`${result.samples} samples saved`);
    } catch (error) {
      setStatus(`Measurement failed: ${error}`);
    } finally {
      setBusy(false);
    }
  }

  async function captureBench03() {
    if (!selectedPort) {
      setStatus('Select a serial device first.');
      return;
    }
    setBusy(true);
    try {
      setStatus('Capturing embedded numerical campaign…');
      const result = await invoke<CaptureResult>('serial_capture', {
        port: selectedPort,
        baud: 115200,
        durationMs: 5200,
        maxLines: 1000,
        numericOnly: true,
      });
      setPreview(result.lines.slice(0, 80));
      setStatus(`${result.numeric_rows} numerical rows captured · ${result.ignored_rows} ignored`);
    } catch (error) {
      setStatus(`Capture failed: ${error}`);
    } finally {
      setBusy(false);
    }
  }

  return <div style={{ minHeight: '100vh', background: 'radial-gradient(circle at 88% 0%,#1d2a36 0%,#0b0f13 38%)', color: '#edf2f7', padding: '28px 34px 60px' }}>
    <div style={{ maxWidth: 1320, margin: '0 auto' }}>
      <header style={{ marginBottom: 20 }}>
        <div>
          <div style={{ textTransform: 'uppercase', fontSize: 10, letterSpacing: '.13em', color: '#7f8d9b' }}>BetterBoard numerical series</div>
          <h1 style={{ marginTop: 7 }}>Numerical Bench Suite</h1>
          <p style={muted}>One workspace, three switchable modes: acquire reality, study sampled data, then study the arithmetic itself on real embedded hardware.</p>
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
            {measurement && <div className="measurement big" style={{ marginTop: 12 }}>
              <b>{measurement.samples} samples</b>
              <span>{measurement.directory}</span>
            </div>}
          </div>
        </div>

        <div>
          {mode === 'bench01' && <section style={panel}>
            <div style={{ textTransform: 'uppercase', fontSize: 10, letterSpacing: '.12em', color: '#7f8d9b' }}>Mode 1 · Physical acquisition</div>
            <h2>Analog Control & Instrumentation</h2>
            <p style={muted}>Use the known-safe potentiometer path to produce a real ADC time series. This is the physical source for Bench 02 and remains a standalone control/instrumentation experiment.</p>
            <div className="bridge-flow" style={{ justifyContent: 'flex-start', marginTop: 18 }}>
              <div>Potentiometer</div><b>→</b><div>A0 / ADC</div><b>→</b><div>filter + PWM</div><b>→</b><div>measurement package</div>
            </div>
            <div className="action-row">
              <button className="primary" disabled={busy || !selectedPort} onClick={() => uploadRecipe('analog_a0')}>Compile & Upload Bench 01</button>
              <button className="ghost" disabled={busy || !selectedPort} onClick={() => recordRecipe('analog_a0', 5000)}>Record 5 s measurement</button>
            </div>
            <div className="boundary" style={{ marginTop: 18 }}>This mode measures a real low-voltage analog record. Nominal voltage conversion is not automatically a traceable voltage calibration.</div>
          </section>}

          {mode === 'bench02' && <section style={panel}>
            <div style={{ textTransform: 'uppercase', fontSize: 10, letterSpacing: '.12em', color: '#7f8d9b' }}>Mode 2 · Measured-data numerics</div>
            <h2>Sampling & Numerical Error</h2>
            <p style={muted}>Reuse the Bench 01 real measurement, then study timing jitter, downsampling, finite-difference sensitivity, trapezoidal integration convergence, ADC quantization structure, and float32-vs-float64 accumulation.</p>
            <div className="bridge-flow" style={{ justifyContent: 'flex-start', marginTop: 18 }}>
              <div>real data.csv</div><b>→</b><div>downsample</div><b>→</b><div>differentiate / integrate</div><b>→</b><div>convergence evidence</div>
            </div>
            <div className="action-row">
              <button className="primary" disabled={busy || !selectedPort} onClick={() => uploadRecipe('analog_a0')}>Prepare Bench 01 acquisition</button>
              <button className="ghost" disabled={busy || !selectedPort} onClick={() => recordRecipe('analog_a0', 7000)}>Record source dataset</button>
            </div>
            <pre className="docs-preview" style={{ marginTop: 18, maxHeight: 170 }}>{measurement
              ? `python3 scripts/bench02_numerical_error.py \\\n  "${measurement.directory}"`
              : 'After recording a dataset, the exact Bench 02 analysis command will appear here.'}</pre>
            <div className="boundary">The finest measured series is an empirical numerical baseline, not exact physical truth.</div>
          </section>}

          {mode === 'bench03' && <section style={panel}>
            <div style={{ textTransform: 'uppercase', fontSize: 10, letterSpacing: '.12em', color: '#7f8d9b' }}>Mode 3 · Embedded numerical reliability</div>
            <h2>Numerical Error Analysis on the real MCU</h2>
            <p style={muted}>The UNO-class MCU executes the Taylor recurrence itself. The campaign mirrors the Engineering Lab Numerical Error Studio with raw versus range-reduced Taylor, an x-parameter scan, fixed-term convergence, cancellation diagnostics, stopping rules, arithmetic-environment reporting, and execution-time evidence.</p>
            <div className="bridge-flow" style={{ justifyContent: 'flex-start', marginTop: 18 }}>
              <div>Numerical problem</div><b>→</b><div>MCU C++ arithmetic</div><b>→</b><div>embedded evidence</div><b>→</b><div>host oracle + reliability</div>
            </div>
            <div className="action-row">
              <button className="primary" disabled={busy || !selectedPort} onClick={() => uploadRecipe('numerical_embedded')}>Compile & Upload Bench 03</button>
              <button className="ghost" disabled={busy || !selectedPort} onClick={captureBench03}>Preview campaign</button>
              <button className="ghost" disabled={busy || !selectedPort} onClick={() => recordRecipe('numerical_embedded', 7000)}>Record evidence package</button>
            </div>

            {preview.length > 0 && <>
              <h3 style={{ fontSize: 13, marginTop: 20 }}>Embedded numeric rows</h3>
              <pre className="terminal" style={{ height: 220 }}>{preview.join('\n')}</pre>
            </>}

            <pre className="docs-preview" style={{ marginTop: 18, maxHeight: 170 }}>{measurement
              ? `python3 scripts/bench03_embedded_numerical.py \\\n  "${measurement.directory}"`
              : 'Record Bench 03 evidence, then the host-oracle analysis command will appear here.'}</pre>
            <div className="boundary">The MCU reports what it can know locally: approximation, term behavior, cancellation, stop state, finite arithmetic, timing, and floating-point environment. Accuracy and false-convergence decisions are made against the independent host reference.</div>
          </section>}
        </div>
      </section>
    </div>
  </div>;
}
