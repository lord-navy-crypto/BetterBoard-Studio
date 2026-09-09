import { useMemo, useState } from 'react';
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

  async function probe() {
    setBusy(true);
    try {
      const next = await invoke<Status>('openguin_probe');
      setStatus(next);
      if (!model && next.models.length) setModel(next.models[0]);
    } catch (error) { setStatus({ found: false, endpoint: '127.0.0.1:11435', models: [], error: String(error) }); }
    finally { setBusy(false); }
  }
  async function ask() {
    if (!model || !prompt.trim()) return;
    setBusy(true);
    try { setAnswer(await invoke<string>('openguin_generate', { model, prompt, context: contextPreview })); }
    catch (error) { setAnswer(`OpenPenguin local AI error: ${error}`); }
    finally { setBusy(false); }
  }

  return <div className="panel" style={{ marginTop: 12 }}>
    <div className="panel-title"><Bot size={18}/> OpenPenguin · Local AI</div>
    <p className="muted">Optional loopback-only bridge to OpenPenguin's private local runtime. BetterBoard never sends this context to a cloud service.</p>
    <div className="facts"><span>Local endpoint</span><b><code>{status?.endpoint || 'http://127.0.0.1:11435'}</code></b><span>Bridge</span><b>{status?.found ? 'Connected' : 'Not connected'}</b></div>
    <div className="action-row"><button className="ghost" disabled={busy} onClick={() => void probe()}><RefreshCw size={14}/> Connect OpenPenguin / reload models</button>{status && <span className={status.found ? 'ok' : 'warn'}>{status.found ? `${status.models.length} local model(s) loaded` : status.error || 'not detected'}</span>}</div>
    {status?.found && <>
      <label>Local model<select value={model} onChange={event => setModel(event.target.value)}>{status.models.map(name => <option key={name}>{name}</option>)}</select></label>
      <label>Ask about this sketch / recipe<textarea style={{ minHeight: 86 }} value={prompt} onChange={event => setPrompt(event.target.value)}/></label>
      <button className="primary" disabled={busy || !model || !prompt.trim()} onClick={() => void ask()}><Send size={14}/> Ask local AI</button>
      {answer && <><div className="copy-data-actions" style={{ marginTop: 8 }}><CopyButton text={answer} label="Copy answer" /></div><pre className="terminal" style={{ maxHeight: 260, whiteSpace: 'pre-wrap' }}>{answer}</pre></>}
    </>}
  </div>;
}
