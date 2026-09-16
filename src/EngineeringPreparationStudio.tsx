import { useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Bot, CircleAlert, Database, FileCheck2, Magnet, Plus, RefreshCw, Sigma, UploadCloud, Wrench } from 'lucide-react';
import NumericalBenchSuiteV2 from './NumericalBenchSuiteV2';
import NumericalBenchAdvanced from './NumericalBenchAdvanced';
import MagnetBenchSuiteV2 from './MagnetBenchSuiteV2';
import MagnetBenchAdvanced from './MagnetBenchAdvanced';
import CopyButton from './CopyButton';
import { useCapabilityNavigation } from './CapabilityNavigationContext';
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
  const { registerCapabilityActivator } = useCapabilityNavigation();

  useEffect(() => {
    const unregisterNumerical = registerCapabilityActivator('numerical-advanced', () => setLane('numerical'));
    const unregisterMagnet = registerCapabilityActivator('magnet-advanced', () => setLane('magnet'));
    return () => {
      unregisterNumerical();
      unregisterMagnet();
    };
  }, [registerCapabilityActivator]);

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
    <p className="muted">Turn saved measurements into analysis-ready evidence. Choose a preparation lane, inspect the evidence, add research context, then hand the package to Engineering Lab or local AI.</p>

    <div className="engineering-model-grid" style={{ marginBottom: 14 }}>
      <button className={`panel ${lane === 'numerical' ? 'selected' : ''}`} onClick={() => setLane('numerical')} style={{ textAlign: 'left', cursor: 'pointer' }}>
        <div className="panel-title"><Sigma size={17}/> Numerical evidence</div>
        <p className="muted">Check sampling, discretization and embedded numerical reliability before interpreting a model comparison.</p>
        <b>Prepare numerical evidence →</b>
      </button>
      <button className={`panel ${lane === 'magnet' ? 'selected' : ''}`} onClick={() => setLane('magnet')} style={{ textAlign: 'left', cursor: 'pointer' }}>
        <div className="panel-title"><Magnet size={17}/> Magnetic evidence</div>
        <p className="muted">Characterize field measurements and residuals while keeping calibration assumptions separate from the raw sensor record.</p>
        <b>Prepare magnetic evidence →</b>
      </button>
    </div>

    <div className="observatory-facts" style={{ marginBottom: 14 }}>
      <span>1 · Inspect</span><b>Measurement evidence</b>
      <span>2 · Prepare</span><b>{lane === 'numerical' ? 'Numerical reliability' : 'Field characterization'}</b>
      <span>3 · Context</span><b>Question · notes · annotations</b>
      <span>4 · Handoff</span><b>Research Bridge</b>
    </div>

    {lane === 'numerical' && <>
      <div className="boundary compact"><FileCheck2 size={14}/> Numerical preparation asks whether the captured data and computation are trustworthy enough to support the next scientific claim. Bench 01 / 02 / 03 remain separate evidence stages.</div>
      <NumericalBenchSuiteV2/>

      <details style={{ marginTop: 14 }} data-capability-anchor="numerical-advanced">
        <summary><b>Advanced implementation tools</b> · analyzer paths, validation and exact controls</summary>
        <section className="panel" style={{ marginTop: 10 }}>
          <div className="panel-title"><Sigma size={17}/> Numeric Error implementation tools</div>
          <p className="muted">Use these direct paths when maintaining or validating the numerical analysis pipeline. They are implementation details, not required for the normal evidence-preparation workflow.</p>
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
          <details style={{ marginTop: 12 }}><summary><b>Numerical expert analyzer</b> · classic / exact controls</summary><NumericalBenchAdvanced/></details>
        </section>
      </details>
    </>}

    {lane === 'magnet' && <>
      <div className="boundary compact"><FileCheck2 size={14}/> Magnetic preparation follows acquisition → field characterization → residual/model handoff. A clean curve never substitutes for calibration and provenance.</div>
      <MagnetBenchSuiteV2/>
      <details style={{ marginTop: 14 }} data-capability-anchor="magnet-advanced"><summary><b>Advanced magnetic tools</b> · residual / characterization controls</summary><MagnetBenchAdvanced/></details>
    </>}

    <section className="panel engineering-handoff" style={{ marginTop: 18 }} data-capability-anchor="engineering-handoff">
      <div className="panel-title"><UploadCloud size={18}/> Evidence handoff</div>
      <p className="muted">Select a saved run and package its immutable measurement evidence with human research context. Engineering results and AI suggestions remain downstream layers rather than being mixed into the raw data.</p>
      <button className="primary" disabled={loadingEvidence} onClick={() => void loadEvidence()}><Database size={15}/> {loadingEvidence ? 'Loading evidence…' : loaded ? 'Refresh saved evidence' : 'Choose saved evidence'}</button>
      {loadError && <div className="boundary" style={{ marginTop: 10 }}><CircleAlert size={14}/>{loadError}</div>}
      {!loaded ? <div className="empty compact">Choose saved evidence when you are ready to build a research handoff.</div> : !loadError && !sessions.length ? <div className="empty compact">No saved measurement sessions yet. Record evidence in Monitor & Data first.</div> : !loadError && <>
        <select value={selected?.directory ?? ''} onChange={e => setSelected(sessions.find(s => s.directory === e.target.value) ?? null)}>
          {sessions.map(s => <option key={s.directory} value={s.directory}>{s.recipe_title} · {s.sample_count} samples · {new Date(s.created_at_utc).toLocaleString()}</option>)}
        </select>
        {selected && <>
          <div className="measurement big">
            <b>{selected.recipe_title}</b>
            <span>{selected.sample_count} samples · {new Date(selected.created_at_utc).toLocaleString()}</span>
            <span>Research session · {currentSessionId}</span>
            <span>Unified bridge · betterboard.research-bridge/1.0</span>
          </div>
          <div className="action-row">
            <CopyButton text={exportText} label="Copy handoff summary"/>
            <CopyButton text={researchBridgeJson} label="Copy Research Bridge JSON"/>
          </div>
          <details style={{ marginTop: 10 }}>
            <summary><b>Evidence files & compatibility exports</b></summary>
            <div className="measurement big" style={{ marginTop: 8 }}>
              <b>Raw data</b><span>{selected.csv_path}</span>
              <b>Metadata</b><span>{selected.metadata_path}</span>
              <b>Engineering Lab compatibility</b><span>{selected.physical_lab_csv_path}</span>
              <b>Legacy bridge</b><span>{selected.physical_lab_bridge_path}</span>
            </div>
            <div className="action-row">
              <CopyButton text={selected.csv_path || ''} label="Copy data path"/>
              <CopyButton text={selected.physical_lab_bridge_path || ''} label="Copy legacy bridge path"/>
            </div>
          </details>
        </>}
      </>}
      <div className="boundary"><FileCheck2 size={14}/> A successful handoff means evidence and provenance are traceable. It does not prove calibration, physical correctness, model validity, or an AI conclusion.</div>
    </section>

    <section className="panel" style={{ marginTop: 18 }} data-capability-anchor="research-context">
      <div className="panel-title"><Database size={18}/> Research context</div>
      <p className="muted">Add the question, hypothesis, observations and decisions that explain why this run matters. These notes travel with the handoff but remain distinct from sensor evidence.</p>
      {!selected ? <div className="empty compact">Research context is ready, but it needs a saved measurement session. Use Evidence handoff above to choose saved evidence first.</div> : <>
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
      </>}
    </section>

    <section className="panel" style={{ marginTop: 18 }}>
      <div className="panel-title"><Bot size={18}/> Ask OpenPenguin about this evidence</div>
      <p className="muted">OpenPenguin receives the structured Research Bridge context. Its output is advisory, is stored as an AI suggestion, and is never promoted to measurement or Engineering Lab result automatically.</p>
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
  </section>;
}