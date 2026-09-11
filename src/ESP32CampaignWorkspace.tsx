import { useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Activity, Cable, Cpu, FlaskConical, Play, RefreshCw, Square, TerminalSquare } from 'lucide-react';
import {
  aggregateCampaignObservations,
  buildEsp32CampaignPlan,
  ratioVsIdle,
  type CampaignCondition,
  type CampaignObservation,
  type CampaignRecipeId,
} from './esp32Campaign';

type BoardPort = { port: string; protocol: string; board_name?: string; fqbn?: string };
type BoardProfile = { id: string; label: string; fqbn: string; core: string; default_baud: number; notes: string[] };
type RecipeSpec = {
  id: string;
  title: string;
  baud: number;
  supported_cores?: string[];
  research_stage?: boolean;
};
type CaptureResult = { lines: string[]; numeric_rows: number; ignored_rows: number };
type CampaignRun = {
  sequence: number;
  repeat: number;
  condition: CampaignCondition;
  command: string;
  status: 'ok' | 'error' | 'cancelled';
  primaryMetric: number | null;
  primaryLabel: string;
  rows: number;
  message?: string;
};

const SUPPORTED: CampaignRecipeId[] = [
  'esp32_numerical_suite',
  'esp32_concurrency_numerics',
  'esp32_irregular_dt',
];

function rmse(values: number[]): number | null {
  if (!values.length) return null;
  return Math.sqrt(values.reduce((sum, value) => sum + value * value, 0) / values.length);
}

function parsePrimaryMetric(recipeId: CampaignRecipeId, lines: string[]): { value: number | null; label: string; rows: number } {
  const data = lines
    .filter(line => line && !line.startsWith('#'))
    .map(line => line.split(',').map(part => part.trim()));

  if (recipeId === 'esp32_irregular_dt') {
    const irreg = data.filter(parts => parts[0]?.toUpperCase() === 'IRREG' && parts.length === 13);
    if (irreg.length < 2) return { value: null, label: 'Δt RMSE', rows: irreg.length };
    const errors: number[] = [];
    for (const parts of irreg) {
      const index = Number(parts[2]);
      const period = Number(parts[4]);
      const dt = Number(parts[7]);
      if (index > 0 && Number.isFinite(period) && Number.isFinite(dt)) errors.push(dt - period);
    }
    return { value: rmse(errors), label: 'Δt RMSE (µs)', rows: irreg.length };
  }

  const jitter = [...data].reverse().find(parts => parts[0]?.toUpperCase() === 'JITTER');
  if (jitter && jitter.length >= 10) {
    const rms = Number(jitter[8]);
    return { value: Number.isFinite(rms) ? rms : null, label: 'RMS lateness (µs)', rows: 1 };
  }
  const wifi = [...data].reverse().find(parts => parts[0]?.toUpperCase() === 'WIFIJITTER');
  if (wifi && wifi.length >= 10) {
    const rms = Number(wifi[7]);
    return { value: Number.isFinite(rms) ? rms : null, label: 'RMS lateness (µs)', rows: 1 };
  }
  return { value: null, label: 'RMS lateness (µs)', rows: data.length };
}

function durationFor(command: string, periodUs: number, samples: number): number {
  const acquisitionMs = Math.ceil((periodUs * samples) / 1000);
  if (command.startsWith('IRREG')) {
    // IRREG emits one CSV row per sample at 115200 baud, so serial drain often costs
    // more wall time than acquisition. Keep a bounded margin without pretending this
    // is a precise runtime estimate.
    return Math.min(300_000, Math.max(8_000, acquisitionMs + Math.ceil(samples * 8.5) + 3_000));
  }
  return Math.min(300_000, Math.max(3_500, acquisitionMs + 2_500));
}

export default function ESP32CampaignWorkspace() {
  const [ports, setPorts] = useState<BoardPort[]>([]);
  const [profiles, setProfiles] = useState<BoardProfile[]>([]);
  const [recipes, setRecipes] = useState<RecipeSpec[]>([]);
  const [selectedPort, setSelectedPort] = useState('');
  const [fqbn, setFqbn] = useState('esp32:esp32:esp32');
  const [recipeId, setRecipeId] = useState<CampaignRecipeId>('esp32_numerical_suite');
  const [repeats, setRepeats] = useState(3);
  const [periodUs, setPeriodUs] = useState(1000);
  const [samples, setSamples] = useState(500);
  const [freqHz, setFreqHz] = useState(17);
  const [runs, setRuns] = useState<CampaignRun[]>([]);
  const [status, setStatus] = useState('Ready');
  const [busy, setBusy] = useState(false);
  const cancelRef = useRef(false);

  const recipe = useMemo(() => recipes.find(item => item.id === recipeId), [recipes, recipeId]);
  const espProfiles = useMemo(() => profiles.filter(profile => profile.core === 'esp32:esp32'), [profiles]);
  const plan = useMemo(() => buildEsp32CampaignPlan({ recipeId, repeats, periodUs, samples, freqHz }), [recipeId, repeats, periodUs, samples, freqHz]);
  const observations = useMemo<CampaignObservation[]>(() => runs
    .filter(run => run.status === 'ok' && run.primaryMetric != null)
    .map(run => ({ condition: run.condition, repeat: run.repeat, value: run.primaryMetric as number })), [runs]);
  const aggregates = useMemo(() => aggregateCampaignObservations(observations), [observations]);
  const loadRatio = useMemo(() => ratioVsIdle(aggregates, 'LOAD'), [aggregates]);
  const wifiRatio = useMemo(() => ratioVsIdle(aggregates, 'WIFI'), [aggregates]);

  async function refresh() {
    setStatus('Refreshing campaign environment…');
    try {
      const [boardProfiles, recipeCatalog, boardPorts] = await Promise.all([
        invoke<BoardProfile[]>('board_profiles'),
        invoke<RecipeSpec[]>('recipe_catalog'),
        invoke<BoardPort[]>('board_list').catch(() => []),
      ]);
      setProfiles(boardProfiles);
      setRecipes(recipeCatalog.filter(item => SUPPORTED.includes(item.id as CampaignRecipeId)));
      setPorts(boardPorts);
      if ((!selectedPort || !boardPorts.some(port => port.port === selectedPort)) && boardPorts.length) {
        setSelectedPort(boardPorts[0].port);
      }
      setStatus(`Ready · ${boardPorts.length} serial devices · ${SUPPORTED.length} campaign-capable recipes`);
    } catch (error) {
      setStatus(String(error));
    }
  }

  useEffect(() => { refresh(); }, []);

  function cancelCampaign() {
    cancelRef.current = true;
    setStatus('Cancel requested · current serial exchange will finish before stopping');
  }

  async function runCampaign() {
    if (!recipe || !selectedPort || busy) return;
    cancelRef.current = false;
    setBusy(true);
    setRuns([]);
    try {
      for (const item of plan.commands) {
        if (cancelRef.current) {
          setRuns(previous => [...previous, {
            sequence: item.sequence,
            repeat: item.repeat,
            condition: item.condition,
            command: item.command,
            status: 'cancelled',
            primaryMetric: null,
            primaryLabel: recipeId === 'esp32_irregular_dt' ? 'Δt RMSE (µs)' : 'RMS lateness (µs)',
            rows: 0,
          }]);
          break;
        }

        setStatus(`Campaign ${item.sequence + 1}/${plan.commands.length} · repeat ${item.repeat}/${plan.repeats} · ${item.condition}`);
        try {
          const result = await invoke<CaptureResult>('serial_exchange', {
            port: selectedPort,
            baud: recipe.baud,
            command: item.command,
            durationMs: durationFor(item.command, plan.periodUs, plan.samples),
            maxLines: recipeId === 'esp32_irregular_dt' ? Math.min(25_000, plan.samples + 250) : 500,
          });
          const metric = parsePrimaryMetric(recipeId, result.lines);
          const errorLine = result.lines.find(line => line.startsWith('#ERROR'));
          const record: CampaignRun = {
            sequence: item.sequence,
            repeat: item.repeat,
            condition: item.condition,
            command: item.command,
            status: errorLine ? 'error' : 'ok',
            primaryMetric: errorLine ? null : metric.value,
            primaryLabel: metric.label,
            rows: metric.rows,
            message: errorLine,
          };
          setRuns(previous => [...previous, record]);
          if (errorLine) {
            setStatus(`Campaign stopped: ${errorLine}`);
            break;
          }
        } catch (error) {
          setRuns(previous => [...previous, {
            sequence: item.sequence,
            repeat: item.repeat,
            condition: item.condition,
            command: item.command,
            status: 'error',
            primaryMetric: null,
            primaryLabel: recipeId === 'esp32_irregular_dt' ? 'Δt RMSE (µs)' : 'RMS lateness (µs)',
            rows: 0,
            message: String(error),
          }]);
          setStatus(`Campaign stopped on serial error: ${String(error)}`);
          break;
        }
      }
      if (!cancelRef.current) setStatus('Campaign sequence finished · review matched-condition statistics below');
    } finally {
      setBusy(false);
    }
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">C</div><div><b>ESP32 Campaign</b><span>Repeated condition studies</span></div></div>
      <div className="small-card"><span>Plan</span><b>{plan.commands.length} commands · {plan.repeats} repeats</b></div>
      <div className="small-card"><span>Completed</span><b>{runs.filter(run => run.status === 'ok').length} successful runs</b></div>
      <div className="sidebar-spacer"/>
      <div className="legal">IDLE is a runtime baseline<br/>Condition order rotates by repeat<br/>No hardware-validation claim without real board evidence</div>
    </aside>

    <main>
      <header>
        <div><h1>ESP32 condition campaign.</h1><p>Run repeated matched-parameter IDLE / LOAD / WIFI studies and aggregate mean, spread, and ratios inside BetterBoard.</p></div>
        <button className="ghost" onClick={refresh} disabled={busy}><RefreshCw size={16}/> Refresh</button>
      </header>

      <section className="status-strip">
        <div><Cpu size={16}/><b>{recipe?.title || recipeId}</b><small>{fqbn}</small></div>
        <div><TerminalSquare size={16}/><span>{status}</span></div>
      </section>

      <section className="hero-grid">
        <div className="panel">
          <div className="panel-title"><Cable size={18}/> Hardware target</div>
          <label>Serial device<select value={selectedPort} onChange={event => setSelectedPort(event.target.value)}>
            {!ports.length && <option value="">No serial device detected</option>}
            {ports.map(port => <option key={port.port} value={port.port}>{port.port} · {port.board_name || 'Unknown board'}</option>)}
          </select></label>
          <label>ESP32 profile<select value={fqbn} onChange={event => setFqbn(event.target.value)}>
            {espProfiles.map(profile => <option key={profile.fqbn} value={profile.fqbn}>{profile.label}</option>)}
          </select></label>
          <div className="hint">Campaign execution assumes the matching research firmware is already compiled and uploaded for this exact target.</div>
        </div>

        <div className="panel">
          <div className="panel-title"><FlaskConical size={18}/> Campaign design</div>
          <label>Recipe<select value={recipeId} onChange={event => setRecipeId(event.target.value as CampaignRecipeId)}>
            {recipes.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
          </select></label>
          <label>Repeats<input type="number" min={1} max={10} value={repeats} onChange={event => setRepeats(Number(event.target.value))}/></label>
          <label>Period (µs)<input type="number" min={100} max={1000000} value={periodUs} onChange={event => setPeriodUs(Number(event.target.value))}/></label>
          <label>Samples / run<input type="number" min={20} max={20000} value={samples} onChange={event => setSamples(Number(event.target.value))}/></label>
          {recipeId === 'esp32_irregular_dt' && <label>Signal frequency (Hz)<input type="number" min={0.001} step="0.1" value={freqHz} onChange={event => setFreqHz(Number(event.target.value))}/></label>}
        </div>
      </section>

      <section className="panel">
        <div className="panel-title"><Activity size={18}/> Planned sequence</div>
        <div className="schema-row"><span>{plan.commands.length} total commands</span><span>{plan.periodUs} µs period</span><span>{plan.samples} samples</span>{plan.freqHz != null && <span>{plan.freqHz} Hz</span>}</div>
        <pre className="terminal">{plan.commands.map(item => `${String(item.sequence + 1).padStart(2, '0')}  r${item.repeat}  ${item.condition.padEnd(4)}  ${item.command}`).join('\n')}</pre>
        <div className="action-row">
          <button className="primary" disabled={busy || !selectedPort || !recipe} onClick={runCampaign}><Play size={16}/> Run campaign</button>
          <button className="ghost" disabled={!busy} onClick={cancelCampaign}><Square size={14}/> Cancel after current run</button>
        </div>
        <div className="hint">Condition order rotates between repeats to reduce simple first-to-last drift bias. This is deterministic rotation, not randomized or blinded experimental design.</div>
      </section>

      <section className="data-grid">
        <div className="panel">
          <div className="panel-title"><Activity size={18}/> Condition aggregates</div>
          {!aggregates.length ? <div className="empty">No completed campaign observations yet.</div> : <div className="channels">
            {aggregates.map(item => <div key={item.condition}>
              <span>{item.condition} · n={item.n}</span>
              <b>{item.mean.toFixed(4)}</b>
              <small>SD {item.stddev.toFixed(4)} · min {item.min.toFixed(4)} · max {item.max.toFixed(4)}</small>
            </div>)}
          </div>}
        </div>
        <div className="panel">
          <div className="panel-title"><Cpu size={18}/> Ratios vs IDLE</div>
          <div className="channels">
            <div><span>LOAD / IDLE</span><b>{loadRatio == null ? '—' : `${loadRatio.toFixed(3)}×`}</b><small>matched campaign metric</small></div>
            {recipeId !== 'esp32_concurrency_numerics' && <div><span>WIFI / IDLE</span><b>{wifiRatio == null ? '—' : `${wifiRatio.toFixed(3)}×`}</b><small>matched campaign metric</small></div>}
          </div>
          <div className="hint">For JITTER recipes the metric is RMS lateness. For IRREG the current campaign metric is Δt RMSE. These ratios are not interchangeable across metric families.</div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-title"><TerminalSquare size={18}/> Campaign run log</div>
        {!runs.length ? <div className="empty">No campaign has run in this session.</div> : <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th align="left">#</th><th align="left">Repeat</th><th align="left">Condition</th><th align="left">Command</th><th align="left">Status</th><th align="left">Metric</th></tr></thead>
            <tbody>{runs.map(run => <tr key={`${run.sequence}-${run.repeat}-${run.condition}`}>
              <td>{run.sequence + 1}</td><td>{run.repeat}</td><td>{run.condition}</td><td><code>{run.command}</code></td><td>{run.status}</td><td>{run.primaryMetric == null ? (run.message || '—') : `${run.primaryMetric.toFixed(4)} · ${run.primaryLabel}`}</td>
            </tr>)}</tbody>
          </table>
        </div>}
      </section>

      <section className="panel">
        <div className="panel-title"><FlaskConical size={18}/> Scientific boundary</div>
        {plan.boundary.map(item => <p className="muted" key={item}>• {item}</p>)}
        <div className="hint">This workspace automates repeated acquisition and first-pass statistics. The stronger Python condition comparator remains the archival/reproducible analysis layer.</div>
      </section>
    </main>
  </div>;
}
