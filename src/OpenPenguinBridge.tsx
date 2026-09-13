import { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, RefreshCw, Send, Sparkles } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import CopyButton from './CopyButton';

type Status = { found: boolean; endpoint: string; models: string[]; error?: string | null };
type Props = { context: string };

const QUICK_PROMPTS = [
  ['Diagnose signal', 'Inspect this BetterBoard context for signal-quality, acquisition, schema, or hardware-readiness problems. Prioritize concrete checks before proposing changes.'],
  ['Next experiment', 'Suggest the single most informative next experiment or measurement. Explain what uncertainty it reduces and what result would change the next decision.'],
  ['Evidence quality', 'Audit the current evidence quality and provenance. Distinguish raw evidence, metadata, derived analysis, and assumptions that are not yet verified.'],
  ['Model vs measurement', 'Explain how I should compare the current measurement against a model or prediction, including likely mismatch causes and what to test next.'],
  ['Explain state', 'Explain the current BetterBoard state in concise engineering terms: what is ready, what is blocked, and the safest next action.'],
] as const;

export default function OpenPenguinBridge({ context }: Props) {
  const [status, setStatus] = useState<Status | null>(null);
  const [model, setModel] = useState('');
  const [prompt, setPrompt] = useState('Explain the numerical or embedded-system issue in this BetterBoard context and suggest a safe next debugging or experiment step.');
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const contextPreview = useMemo(() => context.slice(0, 12000), [context]);
  const contextRef = useRef(contextPreview);

  useEffect(() => {
    contextRef.current = contextPreview;
    setAnswer('');
  }, [contextPreview]);

  async function probe() {
    setBusy(true);
    try {
      const next = await invoke<Status>('openguin_probe');
      setStatus(next);
      if (next.found && next.models.length) {
        setModel(current => next.models.includes(current) ? current : next.models[0]);
      } else {
        setModel('');
      }
    } catch (error) {
      setStatus({ found: false, endpoint: 'runtime optional / not connected', models: [], error: String(error) });
      setModel('');
    } finally { setBusy(false); }
  }

  useEffect(() => { void probe(); }, []);

  async function ask(nextPrompt = prompt) {
    const normalized = nextPrompt.trim();
    if (!status?.found || !model || !normalized) return;
    const requestContext = contextPreview;
    const requestModel = model;
    setPrompt(normalized);
    setAnswer('');
    setBusy(true);
    try {
      const next = await invoke<string>('openguin_generate', { model: requestModel, prompt: normalized, context: requestContext });
      if (contextRef.current === requestContext) setAnswer(next);
    } catch (error) {
      if (contextRef.current === requestContext) setAnswer(`OpenPenguin local AI error: ${error}`);
    } finally { setBusy(false); }
  }

  return <div className="panel" style={{ marginTop: 12 }}>
    <div className="panel-title"><Bot size={18}/> OpenPenguin · Local AI</div>
    <p className="muted">Optional loopback-only bridge. BetterBoard sends structured local context, keeps evidence separate from suggestions, and never treats AI availability as hardware readiness.</p>
    <div className="facts"><span>Local endpoint</span><b><code>{status?.endpoint || 'probing local runtime…'}</code></b><span>Bridge</span><b>{status?.found ? 'Connected' : 'Not connected'}</b></div>
    <div className="action-row"><button className="ghost" disabled={busy} onClick={() => void probe()}><RefreshCw size={14}/> Reload local models</button>{status && <span className={status.found ? 'ok' : 'warn'}>{status.found ? `${status.models.length} local model(s) loaded` : status.error || 'Runtime optional / not connected'}</span>}</div>
    {status?.found && <>
      <label>Local model<select value={model} disabled={busy} onChange={event => { setModel(event.target.value); setAnswer(''); }}>{status.models.map(name => <option key={name}>{name}</option>)}</select></label>
      <div style={{ marginTop: 10 }}>
        <div className="eyebrow" style={{ marginBottom: 7 }}><Sparkles size={12}/> Quick engineering tasks</div>
        <div className="action-row">{QUICK_PROMPTS.map(([label, text]) => <button key={label} className="ghost mini" disabled={busy} onClick={() => void ask(text)}>{label}</button>)}</div>
      </div>
      <label>Custom question<textarea style={{ minHeight: 86 }} value={prompt} disabled={busy} onChange={event => { setPrompt(event.target.value); setAnswer(''); }}/></label>
      <button className="primary" disabled={busy || !model || !prompt.trim()} onClick={() => void ask()}><Send size={14}/> Ask local AI</button>
      {answer && <><div className="copy-data-actions" style={{ marginTop: 8 }}><CopyButton text={answer} label="Copy answer" /></div><pre className="terminal" style={{ maxHeight: 300, whiteSpace: 'pre-wrap' }}>{answer}</pre></>}
    </>}
  </div>;
}
