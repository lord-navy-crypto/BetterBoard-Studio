import { useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ArrowRight, Bot, CircleAlert, Database, FileCheck2, Magnet, Plus, RefreshCw, Sigma, UploadCloud, Wrench } from 'lucide-react';
import NumericalBenchSuiteV2 from './NumericalBenchSuiteV2';
import NumericalBenchAdvanced from './NumericalBenchAdvanced';
import MagnetBenchSuiteV2 from './MagnetBenchSuiteV2';
import MagnetBenchAdvanced from './MagnetBenchAdvanced';
import StudioAdvanced from './StudioAdvanced';
import CopyButton from './CopyButton';
import { bridgeForOpenPenguin, buildResearchBridge, researchSessionId } from './ResearchBridge';
import { emptyResearchContext, loadResearchContext, makeResearchEvent, saveResearchContext, type ResearchContextState } from './ResearchContextStore';

type MeasurementSessionSummary = {
  directory: string;
  created_at_utc: string;
  recipe_id?: string;
  recipe_title: string;
  acquisition_mode?: string;
  board_profile?: string;
  port?: string;
  sample_count: number;
  csv_path: string;
  metadata_path: string;
  physical_lab_csv_path: string;
  physical_lab_bridge_path: string;
};

type OpenPenguinStatus = {
  found: boolean;
  endpoint: string;
  models: string[];
  error?: string | null;
};

type Lane = 'numerical' | 'magnet';
type ContextLane = 'notebook' | 'annotation' | 'journey';

const CAMPAIGN_ANALYZER = 'scripts/numeric_error_campaign_analyzer.py';
const CAMPAIGN_SELF_CHECK = 'scripts/numeric_error_campaign_self_check.py';
const INTERACTIVE_BRIDGE = 'scripts/arduino_numeric_error_bridge_v2.py';
const ABSORPTION_LEDGER = 'docs/NUMERIC_ERROR_ABSORPTION_LEDGER.md';

export default function EngineeringPreparationStudio() {
  const [lane, setLane] = useState<Lane>('numerical');
  const [sessions, setSessions] = useState<MeasurementSessionSummary[]>([]);
  const [selected, setSelected] = useState<MeasurementSessionSummary | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadingEvidence, setLoadingEvidence] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [researchContext, setResearchContext] = useState<ResearchContextState>(emptyResearchContext());
  const [contextLane, setContextLane] = useState<ContextLane>('notebook');
  const [contextDraft, setContextDraft] = useState('');
  const [aiStatus, setAiStatus] = useState<OpenPenguinStatus | null>(null);
  const [aiModel, setAiModel] = useState('');
  const [aiPrompt, setAiPrompt] = useState('Review this experiment handoff. Identify evidence-quality concerns, useful Engineering Lab analyses, and one next experiment. Keep measurement facts separate from suggestions.');
  const [aiAnswer, setAiAnswer] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState('');

  async function loadEvidence() {
    if (loadingEvidence) return;
    setLoadingEvidence(true);
    setLoadError('');
    try {
      const list = await invoke<MeasurementSessionSummary[]>('measurement_sessions', { limit: 50 });
      setSessions(list);
      setSelected(current => current && list.some(item => item.directory === current.directory)
        ? current
        : (list[0] ?? null));
      setLoaded(true);
    } catch (error) {
      setLoadError(`Could not load saved evidence: ${error}`);
      setLoaded(true);
    } finally {
      setLoadingEvidence(false);
    }
  }

  const currentSessionId = useMemo(() => selected ? researchSessionId(selected) : '', [selected]);

  useEffect(() => {
    setResearchContext(currentSessionId ? loadResearchContext(currentSessionId) : emptyResearchContext());
    setAiAnswer('');
  }, [currentSessionId]);

  function persistContext(next: ResearchContextState) {
    setResearchContext(next);
    if (currentSessionId) saveResearchContext(currentSessionId, next);
  }

  function patchContext(patch: Partial<ResearchContextState>) {
    persistContext({ ...researchContext, ...patch });
  }

  function addContextEntry() {
    const text = contextDraft.trim();
    if (!text || !selected) return;
    if (contextLane === 'notebook') {
      patchContext({ notebook: [...researchContext.notebook, makeResearchEvent('human', 'observation', text, [selected.metadata_path])] });
    } else if (contextLane === 'annotation') {
      patchContext({ annotations: [...researchContext.annotations, makeResearchEvent('human', 'annotation', text, [selected.csv_path])] });
    } else {
      patchContext({ lab_journey: [...researchContext.lab_journey, makeResearchEvent('human', 'decision', text, [selected.metadata_path])] });
    }
    setContextDraft('');
  }

  async function refreshOpenPenguin() {
    setAiError('');
    try {
      const status = await invoke<OpenPenguinStatus>('openguin_probe');
      setAiStatus(status);
      if (status.models.length && !status.models.includes(aiModel)) setAiModel(status.models[0]);
    } catch (error) {
      setAiStatus(null);
      setAiError(`Could not inspect OpenPenguin: ${error}`);
    }
  }

  const researchBridge = useMemo(() => selected ? buildResearchBridge(selected, researchContext) : null, [selected, researchContext]);
  const researchBridgeJson = useMemo(() => researchBridge ? JSON.stringify(researchBridge, null, 2) : '', [researchBridge]);
  const openPenguinContext = useMemo(() => researchBridge ? bridgeForOpenPenguin(researchBridge) : '', [researchBridge]);

  async function askOpenPenguin() {
    if (!researchBridge || !aiModel || !aiPrompt.trim()) return;
    setAiBusy(true);
    setAiError('');
    setAiAnswer('');
    try {
      const answer = await invoke<string>('openguin_generate', {
        model: aiModel,
        prompt: aiPrompt,
        context: openPenguinContext,
      });
      setAiAnswer(answer);
      const suggestion = makeResearchEvent('openguin', 'suggestion', answer, [researchBridge.session_id]);
      persistContext({ ...researchContext, ai_suggestions: [...researchContext.ai_suggestions, suggestion] });
    } catch (error) {
      setAiError(`OpenPenguin bridge failed: ${error}`);
    } finally {
      setAiBusy(false);
    }
  }

  const exportText = useMemo(() => selected ? [
    'BetterBoard → Engineering Lab handoff',
    `Recipe: ${selected.recipe_title}`,
    `Samples: ${selected.sample_count}`,
    `data.csv: ${selected.csv_path}`,
    `metadata.json: ${selected.metadata_path}`,
    `legacy physical_lab_v1.csv compatibility: ${selected.physical_lab_csv_path}`,
    `Engineering Lab bridge: ${selected.physical_lab_bridge_path}`,
    researchBridge ? `Research Bridge schema: ${researchBridge.schema}` : '',
    researchBridge ? `Research session: ${researchBridge.session_id}` : '',
  ].filter(Boolean).join('\n') : '', [selected, researchBridge]);

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

      <section className="panel" style={{ marginTop: 14 }}>
        <div className="panel-title"><Sigma size={17}/> Numeric Error campaign preparation tools</div>
        <p className="muted">The old research analyzer V1/V2 and validation scripts are consolidated here. Use the campaign analyzer for the wider Numeric Error experiment family and the dedicated bridge for Interactive Studio Taylor rows.</p>
        <div className="measurement big">
          <b>Campaign analyzer</b><span>{CAMPAIGN_ANALYZER}</span>
          <b>Campaign self-check</b><span>{CAMPAIGN_SELF_CHECK}</span>
          <b>Interactive Studio bridge</b><span>{INTERACTIVE_BRIDGE}</span>
          <b>Absorption ledger</b><span>{ABSORPTION_LEDGER}</span>
        </div>
        <div className="action-row">
          <CopyButton text={CAMPAIGN_ANALYZER} label="Copy analyzer path"/>
          <CopyButton text={CAMPAIGN_SELF_CHECK} label="Copy self-check path"/>
          <CopyButton text={INTERACTIVE_BRIDGE} label="Copy bridge path"/>
          <CopyButton text={ABSORPTION_LEDGER} label="Copy ledger path"/>
        </div>
      </section>

      <details style={{ marginTop: 14 }}><summary><b>Numerical expert analyzer</b> · classic / exact controls</summary><NumericalBenchAdvanced/></details>
    </>}

    {lane === 'magnet' && <>
      <div className="boundary compact">Magnetic preparation is organized as acquisition → field characterization → residual/model handoff. Keep raw sensor evidence, calibration assumptions and model comparison separate so a clean curve cannot hide a bad measurement.</div>
      <MagnetBenchSuiteV2/>
      <details style={{ marginTop: 14 }}><summary><b>Magnetic expert analyzer</b> · advanced residual / characterization controls</summary><MagnetBenchAdvanced/></details>
    </>}

    <section className="panel engineering-handoff" style={{ marginTop: 18 }}>
      <div className="panel-title"><UploadCloud size={18}/> BetterBoard Research Bridge</div>
      <p className="muted">One provenance-aware contract connects BetterBoard evidence, Notebook / Annotation / Lab Journey context, Engineering Lab derived analysis, and OpenPenguin advisory reasoning. Raw measurement remains immutable evidence; downstream analysis and AI suggestions remain separate layers.</p>
      <button className="ghost" disabled={loadingEvidence} onClick={() => void loadEvidence()}><Database size={15}/> {loadingEvidence ? 'Loading evidence…' : loaded ? 'Refresh saved evidence' : 'Load saved evidence'}</button>
      {loadError && <div className="boundary" style={{ marginTop: 10 }}><CircleAlert size={14}/>{loadError}</div>}
      {!loaded ? <div className="empty compact">Load evidence to create a Research Bridge package.</div> : !loadError && !sessions.length ? <div className="empty compact">No saved measurement sessions yet.</div> : !loadError && <>
        <select value={selected?.directory ?? ''} onChange={e => setSelected(sessions.find(s => s.directory === e.target.value) ?? null)}>
          {sessions.map(s => <option key={s.directory} value={s.directory}>{s.recipe_title} · {s.sample_count} samples · {new Date(s.created_at_utc).toLocaleString()}</option>)}
        </select>
        {selected && <div className="measurement big">
          <b>{selected.recipe_title}</b>
          <span>Research session · {currentSessionId}</span>
          <span>data.csv · {selected.csv_path}</span>
          <span>metadata.json · {selected.metadata_path}</span>
          <span>Engineering Lab compatibility · {selected.physical_lab_csv_path}</span>
          <span>Legacy bridge · {selected.physical_lab_bridge_path}</span>
          <span>Unified bridge · betterboard.research-bridge/1.0</span>
        </div>}
        <div className="action-row">
          <CopyButton text={exportText} label="Copy handoff"/>
          <CopyButton text={researchBridgeJson} label="Copy Research Bridge JSON"/>
          <CopyButton text={selected?.csv_path || ''} label="Copy data path"/>
          <CopyButton text={selected?.physical_lab_bridge_path || ''} label="Copy legacy bridge path"/>
        </div>
      </>}
      <div className="boundary"><FileCheck2 size={14}/> Handoff success means evidence and provenance are traceable. It does not prove calibration, physical correctness, model validity, or an AI conclusion.</div>
    </section>

    {selected && <section className="panel" style={{ marginTop: 18 }}>
      <div className="panel-title"><Database size={18}/> Research context bridge</div>
      <p className="muted">Notebook, annotations and Lab Journey entries are persisted per measurement session and are embedded into every Research Bridge export. They remain human context, never raw sensor evidence.</p>
      <div className="engineering-model-grid">
        <label className="panel">Research question<textarea rows={3} value={researchContext.question} onChange={e => patchContext({ question: e.target.value })} placeholder="What are you trying to determine?" /></label>
        <label className="panel">Hypothesis<textarea rows={3} value={researchContext.hypothesis} onChange={e => patchContext({ hypothesis: e.target.value })} placeholder="What result do you expect, and why?" /></label>
      </div>
      <div className="action-row">
        <select value={contextLane} onChange={e => setContextLane(e.target.value as ContextLane)}><option value="notebook">Experiment Notebook</option><option value="annotation">Annotation</option><option value="journey">Lab Journey</option></select>
        <input value={contextDraft} onChange={e => setContextDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addContextEntry(); }} placeholder="Add a traceable research entry" />
        <button className="primary" disabled={!contextDraft.trim()} onClick={addContextEntry}><Plus size={15}/> Add entry</button>
      </div>
      <div className="observatory-facts">
        <span>Notebook entries</span><b>{researchContext.notebook.length}</b>
        <span>Annotations</span><b>{researchContext.annotations.length}</b>
        <span>Journey events</span><b>{researchContext.lab_journey.length}</b>
        <span>Engineering results</span><b>{researchContext.engineering_results.length}</b>
        <span>OpenPenguin suggestions</span><b>{researchContext.ai_suggestions.length}</b>
      </div>
      {[...researchContext.notebook, ...researchContext.annotations, ...researchContext.lab_journey].slice(-8).reverse().map(event => <div className="boundary compact" key={event.id}><b>{event.origin} · {event.kind}</b> · {event.text}</div>)}
    </section>}

    <section className="panel" style={{ marginTop: 18 }}>
      <div className="panel-title"><Bot size={18}/> OpenPenguin bridge</div>
      <p className="muted">OpenPenguin receives the structured Research Bridge context, not an undifferentiated dump. Its output is advisory, is persisted as an AI suggestion, and is never promoted to measurement or Engineering Lab result automatically.</p>
      <div className="action-row">
        <button className="ghost" onClick={() => void refreshOpenPenguin()}><RefreshCw size={15}/> Inspect local AI</button>
        {aiStatus?.found && <select value={aiModel} onChange={e => setAiModel(e.target.value)}>{aiStatus.models.map(model => <option key={model} value={model}>{model}</option>)}</select>}
      </div>
      {aiStatus && <div className="boundary compact"><Bot size={14}/>{aiStatus.found ? `OpenPenguin ready · ${aiStatus.endpoint} · ${aiStatus.models.length} model(s)` : aiStatus.error || 'OpenPenguin is not connected.'}</div>}
      <textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} rows={4} placeholder="Ask OpenPenguin about this experiment handoff" />
      <div className="action-row"><button className="primary" disabled={!researchBridge || !aiModel || aiBusy} onClick={() => void askOpenPenguin()}><Bot size={15}/>{aiBusy ? 'Reasoning…' : 'Ask OpenPenguin about this handoff'}</button><CopyButton text={openPenguinContext} label="Copy AI context"/></div>
      {aiError && <div className="boundary"><CircleAlert size={14}/>{aiError}</div>}
      {aiAnswer && <div className="measurement big"><b>OpenPenguin suggestion · stored in bridge provenance</b><span style={{ whiteSpace: 'pre-wrap' }}>{aiAnswer}</span></div>}
    </section>

    <details style={{ marginTop: 14 }}>
      <summary><b>Studio compatibility tools</b> · reusable classic workflow</summary>
      <p className="muted"><ArrowRight size={14}/> Legacy proven controls remain available here in Studio rather than being mixed into Experiments.</p>
      <StudioAdvanced/>
    </details>
  </section>;
}
