import { useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Activity, Cable, Cpu, Download, FlaskConical, Play, RefreshCw, ShieldCheck, Square, TerminalSquare } from 'lucide-react';
import {
  aggregateCampaignObservations,
  buildEsp32CampaignPlan,
  ratioVsIdle,
  type CampaignCondition,
  type CampaignObservation,
  type CampaignRecipeId,
} from './esp32Campaign';
import {
  campaignArchiveJson,
  campaignBaseName,
  campaignComparatorCapture,
  campaignSummaryCsv,
  downloadTextFile,
  type CampaignArchiveInput,
  type CampaignCapturedRow,
} from './esp32CampaignExport';
import {
  expectedCampaignSchemaPrefix,
  inferArduinoEsp32Version,
  infoEnvelopeComplete,
  observedSchema,
  parseInfoLines,
  provenanceDisplay,
  sha256Text,
  type CampaignProvenance,
  type CliInfo,
} from './esp32Provenance';

type BoardPort = { port: string; protocol: string; board_name?: string; fqbn?: string };
type BoardProfile = { id: string; label: string; fqbn: string; core: string; default_baud: number; notes: string[] };
type RecipeSpec = {
  id: string;
  title: string;
  baud: number;
  supported_cores?: string[];
  research_stage?: boolean;
};
type CaptureResult = {
  lines: string[];
  rows?: CampaignCapturedRow[];
  numeric_rows: number;
  ignored_rows: number;
};
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
  startedAtUtc?: string;
  completedAtUtc?: string;
  captureLines: string[];
  capturedRows?: CampaignCapturedRow[];
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
  const [provenance, setProvenance] = useState<CampaignProvenance | null>(null);
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
  const provenanceItems = useMemo(() => provenance ? provenanceDisplay(provenance.deviceInfo) : [], [provenance]);
  const archiveInput = useMemo<CampaignArchiveInput | null>(() => {
    if (!recipe || !runs.length) return null;
    return {
      recipeId,
      recipeTitle: recipe.title,
      fqbn,
      port: selectedPort,
      baud: recipe.baud,
      plan,
      runs,
      aggregates,
      loadRatio,
      wifiRatio,
      provenance,
    };
  }, [recipe, runs, recipeId, fqbn, selectedPort, plan, aggregates, loadRatio, wifiRatio, provenance]);

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
  useEffect(() => {
    setProvenance(null);
    setRuns([]);
  }, [recipeId, fqbn, selectedPort]);

  function cancelCampaign() {
    cancelRef.current = true;
    setStatus('Cancel requested · current serial exchange will finish before stopping');
  }

  function exportArchiveJson() {
    if (!archiveInput) return;
    const base = campaignBaseName(archiveInput);
    downloadTextFile(`${base}.json`, campaignArchiveJson(archiveInput), 'application/json;charset=utf-8');
    setStatus('Campaign archive JSON prepared for download');
  }

  function exportSummaryCsv() {
    if (!archiveInput) return;
    const base = campaignBaseName(archiveInput);
    downloadTextFile(`${base}-summary.csv`, campaignSummaryCsv(archiveInput), 'text/csv;charset=utf-8');
    setStatus('Campaign summary CSV prepared for download');
  }

  function exportComparatorCapture() {
    if (!archiveInput) return;
    const base = campaignBaseName(archiveInput);
    downloadTextFile(`${base}-condition-compare.txt`, campaignComparatorCapture(archiveInput));
    setStatus('Condition-comparator capture prepared for download');
  }

  async function collectProvenance(activeRecipe: RecipeSpec): Promise<CampaignProvenance> {
    setStatus('Campaign preflight · collecting device INFO');
    const infoCapture = await invoke<CaptureResult>('serial_exchange', {
      port: selectedPort,
      baud: activeRecipe.baud,
      command: 'INFO',
      durationMs: 3500,
      maxLines: 150,
    });
    if (!infoEnvelopeComplete(infoCapture.lines)) {
      throw new Error('INFO provenance envelope was incomplete. Confirm that the selected campaign firmware is actually flashed and using the expected baud rate.');
    }
    const deviceInfo = parseInfoLines(infoCapture.lines);
    if (!deviceInfo.CHIP_MODEL) {
      throw new Error('INFO did not report CHIP_MODEL; BetterBoard will not start a campaign without basic runtime identity evidence.');
    }

    setStatus('Campaign preflight · verifying firmware schema');
    const schemaCapture = await invoke<CaptureResult>('serial_exchange', {
      port: selectedPort,
      baud: activeRecipe.baud,
      command: 'SCHEMA',
      durationMs: 3000,
      maxLines: 150,
    });
    const expectedSchemaPrefix = expectedCampaignSchemaPrefix(recipeId);
    const schema = observedSchema(schemaCapture.lines);
    const schemaMatched = Boolean(schema?.startsWith(expectedSchemaPrefix));
    if (!schemaMatched) {
      throw new Error(`Firmware schema mismatch. Expected ${expectedSchemaPrefix}…, observed ${schema ?? 'no #SCHEMA line'}. Upload the selected BetterBoard recipe before running this campaign.`);
    }

    setStatus('Campaign preflight · hashing BetterBoard embedded firmware source');
    const [source, cli] = await Promise.all([
      invoke<string>('recipe_source', { recipeId }),
      invoke<CliInfo>('arduino_cli_discovery').catch(() => null),
    ]);
    const expectedFirmwareSha256 = await sha256Text(source);

    return {
      collectedAtUtc: new Date().toISOString(),
      recipeId,
      fqbn,
      port: selectedPort,
      expectedSchemaPrefix,
      observedSchema: schema,
      schemaMatched,
      deviceInfo,
      infoLines: infoCapture.lines,
      schemaLines: schemaCapture.lines,
      expectedFirmwareSha256,
      firmwareHashMeaning: 'host-embedded-source-sha256-not-device-attestation',
      arduinoCli: cli,
      arduinoEsp32Version: inferArduinoEsp32Version(deviceInfo),
    };
  }

  async function runCampaign() {
    if (!recipe || !selectedPort || busy) return;
    cancelRef.current = false;
    setBusy(true);
    setRuns([]);
    setProvenance(null);
    try {
      const collected = await collectProvenance(recipe);
      setProvenance(collected);

      for (const item of plan.commands) {
        if (cancelRef.current) {
          const now = new Date().toISOString();
          setRuns(previous => [...previous, {
            sequence: item.sequence,
            repeat: item.repeat,
            condition: item.condition,
            command: item.command,
            status: 'cancelled',
            primaryMetric: null,
            primaryLabel: recipeId === 'esp32_irregular_dt' ? 'Δt RMSE (µs)' : 'RMS lateness (µs)',
            rows: 0,
            startedAtUtc: now,
            completedAtUtc: now,
            captureLines: [],
          }]);
          break;
        }

        setStatus(`Campaign ${item.sequence + 1}/${plan.commands.length} · repeat ${item.repeat}/${plan.repeats} · ${item.condition}`);
        const startedAtUtc = new Date().toISOString();
        try {
          const result = await invoke<CaptureResult>('serial_exchange', {
            port: selectedPort,
            baud: recipe.baud,
            command: item.command,
            durationMs: durationFor(item.command, plan.periodUs, plan.samples),
            maxLines: recipeId === 'esp32_irregular_dt' ? Math.min(25_000, plan.samples + 250) : 500,
          });
          const completedAtUtc = new Date().toISOString();
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
            startedAtUtc,
            completedAtUtc,
            captureLines: result.lines,
            capturedRows: result.rows ?? [],
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
            startedAtUtc,
            completedAtUtc: new Date().toISOString(),
            captureLines: [],
          }]);
          setStatus(`Campaign stopped on serial error: ${String(error)}`);
          break;
        }
      }
      if (!cancelRef.current) setStatus('Campaign sequence finished · review statistics or export the provenance-bearing research package');
    } catch (error) {
      setStatus(`Campaign preflight blocked: ${String(error)}`);
    } finally {
      setBusy(false);
    }
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">C</div><div><b>ESP32 Campaign</b><span>Repeated condition studies</span></div></div>
      <div className="small-card"><span>Plan</span><b>{plan.commands.length} commands · {plan.repeats} repeats</b></div>
      <div className="small-card"><span>Completed</span><b>{runs.filter(run => run.status === 'ok').length} successful runs</b></div>
      <div className="small-card"><span>Provenance</span><b>{provenance?.schemaMatched ? 'runtime schema verified' : 'not collected'}</b></div>
      <div className="small-card"><span>Raw evidence</span><b>{runs.reduce((sum, run) => sum + run.captureLines.length, 0)} serial lines</b></div>
      <div className="sidebar-spacer"/>
      <div className="legal">IDLE is a runtime baseline<br/>Condition order rotates by repeat<br/>Source hash is not device attestation<br/>No hardware-validation claim without real board evidence</div>
    </aside>

    <main>
      <header>
        <div><h1>ESP32 condition campaign.</h1><p>Run repeated matched-parameter studies with automatic device identity, schema verification, raw evidence preservation, and reproducible exports.</p></div>
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
          <div className="hint">Campaign execution now performs INFO + SCHEMA preflight before any condition run. A mismatched firmware schema blocks the campaign.</div>
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
        <div className="panel-title"><ShieldCheck size={18}/> Runtime provenance gate</div>
        {!provenance ? <div className="empty">Provenance is collected automatically when the campaign starts: INFO identity → SCHEMA match → embedded-source SHA-256 → Arduino CLI identity.</div> : <>
          <div className="channels">
            {provenanceItems.map(item => <div key={item.label}><span>{item.label}</span><b>{item.value}</b><small>reported by device INFO</small></div>)}
            <div><span>Firmware schema</span><b>{provenance.observedSchema ?? '—'}</b><small>{provenance.schemaMatched ? 'matches selected BetterBoard recipe' : 'mismatch'}</small></div>
            <div><span>Embedded source SHA-256</span><b>{provenance.expectedFirmwareSha256 ? `${provenance.expectedFirmwareSha256.slice(0, 16)}…` : 'unavailable'}</b><small>host BetterBoard source identity; not MCU attestation</small></div>
            <div><span>Arduino CLI</span><b>{provenance.arduinoCli?.version || (provenance.arduinoCli?.found ? 'detected' : 'unavailable')}</b><small>{provenance.arduinoEsp32Version ? `Arduino-ESP32 ${provenance.arduinoEsp32Version}` : 'Arduino-ESP32 version not reported by current firmware'}</small></div>
          </div>
        </>}
        <div className="hint">Changing the recipe, FQBN, or serial device clears provenance and prior runs so evidence from different targets is not silently mixed.</div>
      </section>

      <section className="panel">
        <div className="panel-title"><Activity size={18}/> Planned sequence</div>
        <div className="schema-row"><span>{plan.commands.length} total commands</span><span>{plan.periodUs} µs period</span><span>{plan.samples} samples</span>{plan.freqHz != null && <span>{plan.freqHz} Hz</span>}</div>
        <pre className="terminal">{plan.commands.map(item => `${String(item.sequence + 1).padStart(2, '0')}  r${item.repeat}  ${item.condition.padEnd(4)}  ${item.command}`).join('\n')}</pre>
        <div className="action-row">
          <button className="primary" disabled={busy || !selectedPort || !recipe} onClick={runCampaign}><Play size={16}/> Preflight & run campaign</button>
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
        <div className="panel-title"><Download size={18}/> Research package export</div>
        <div className="action-row">
          <button className="ghost" disabled={!archiveInput || busy} onClick={exportArchiveJson}><Download size={15}/> Archive JSON</button>
          <button className="ghost" disabled={!archiveInput || busy} onClick={exportSummaryCsv}><Download size={15}/> Summary CSV</button>
          <button className="ghost" disabled={!archiveInput || busy} onClick={exportComparatorCapture}><Download size={15}/> Comparator capture</button>
        </div>
        <div className="schema-row"><span>manifest + provenance + raw captures</span><span>run summary CSV</span><span>input for esp32_condition_compare.py</span></div>
        <div className="hint">The JSON archive now preserves runtime INFO/SCHEMA evidence, expected embedded-source SHA-256, Arduino CLI identity, selected target, plan, statistics, every raw serial line, and BetterBoard host timestamps. The source hash identifies what this BetterBoard build expects; it does not prove which bytes are flashed on the device.</div>
      </section>

      <section className="panel">
        <div className="panel-title"><TerminalSquare size={18}/> Campaign run log</div>
        {!runs.length ? <div className="empty">No campaign has run in this session.</div> : <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th align="left">#</th><th align="left">Repeat</th><th align="left">Condition</th><th align="left">Command</th><th align="left">Status</th><th align="left">Metric</th><th align="left">Raw lines</th></tr></thead>
            <tbody>{runs.map(run => <tr key={`${run.sequence}-${run.repeat}-${run.condition}`}>
              <td>{run.sequence + 1}</td><td>{run.repeat}</td><td>{run.condition}</td><td><code>{run.command}</code></td><td>{run.status}</td><td>{run.primaryMetric == null ? (run.message || '—') : `${run.primaryMetric.toFixed(4)} · ${run.primaryLabel}`}</td><td>{run.captureLines.length}</td>
            </tr>)}</tbody>
          </table>
        </div>}
      </section>

      <section className="panel">
        <div className="panel-title"><FlaskConical size={18}/> Scientific boundary</div>
        {plan.boundary.map(item => <p className="muted" key={item}>• {item}</p>)}
        <div className="hint">This workspace automates provenance collection, repeated acquisition, raw serial preservation, and first-pass statistics. Exported files remain research evidence; the stronger Python condition comparator is the archival/reproducible analysis layer.</div>
      </section>
    </main>
  </div>;
}
