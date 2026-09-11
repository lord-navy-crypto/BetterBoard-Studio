import { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, RefreshCw, Send } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import CopyButton from './CopyButton';

type Status = { found: boolean; endpoint: string; models: string[]; error?: string | null };
type Props = { context: string };

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

  async function ask() {
    if (!status?.found || !model || !prompt.trim()) return;
    const requestContext = contextPreview;
    const requestModel = model;
    const requestPrompt = prompt;
    setBusy(true);
    try {
      const next = await invoke<string>('openguin_generate', { model: requestModel, prompt: requestPrompt, context: requestContext });
      if (contextRef.current === requestContext) setAnswer(next);
    } catch (error) {
      if (contextRef.current === requestContext) setAnswer(`OpenPenguin local AI error: ${error}`);
    } finally { setBusy(false); }
  }

  return <div className="panel" style={{ marginTop: 12 }}>
    <div className="panel-title"><Bot size={18}/> OpenPenguin · Local AI</div>
    <p className="muted">Optional loopback-only bridge. BetterBoard never starts Ollama for you and never treats runtime availability as hardware readiness. It uses OpenPenguin's private 127.0.0.1:11435 runtime when active, or an already-running external 127.0.0.1:11434 runtime.</p>
    <div className="facts"><span>Local endpoint</span><b><code>{status?.endpoint || 'runtime optional / not connected'}</code></b><span>Bridge</span><b>{status?.found ? 'Connected' : 'Not connected'}</b></div>
    <div className="action-row"><button className="ghost" disabled={busy} onClick={() => void probe()}><RefreshCw size={14}/> Connect OpenPenguin / reload models</button>{status && <span className={status.found ? 'ok' : 'warn'}>{status.found ? `${status.models.length} local model(s) loaded` : status.error || 'Runtime optional / not connected'}</span>}</div>
    {status?.found && <>
      <label>Local model<select value={model} disabled={busy} onChange={event => { setModel(event.target.value); setAnswer(''); }}>{status.models.map(name => <option key={name}>{name}</option>)}</select></label>
      <label>Ask about this sketch / recipe<textarea style={{ minHeight: 86 }} value={prompt} disabled={busy} onChange={event => { setPrompt(event.target.value); setAnswer(''); }}/></label>
      <button className="primary" disabled={busy || !model || !prompt.trim()} onClick={() => void ask()}><Send size={14}/> Ask local AI</button>
      {answer && <><div className="copy-data-actions" style={{ marginTop: 8 }}><CopyButton text={answer} label="Copy answer" /></div><pre className="terminal" style={{ maxHeight: 260, whiteSpace: 'pre-wrap' }}>{answer}</pre></>}
    </>}
  </div>;
}
