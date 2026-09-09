import { useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Box, Boxes, Download, ExternalLink, RefreshCw, Search, Trash2 } from 'lucide-react';

type JsonValue = unknown;
type Tab = 'boards' | 'libraries' | 'examples';

type Props = {
  fqbn: string;
  onStatus: (message: string) => void;
};

function flattenRecords(value: JsonValue): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.flatMap(flattenRecords);
  if (!value || typeof value !== 'object') return [];
  const record = value as Record<string, unknown>;
  const arrays = Object.values(record).filter(Array.isArray) as unknown[][];
  if (arrays.length) return arrays.flatMap(flattenRecords);
  return [record];
}

function field(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' || typeof value === 'number') return String(value);
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const nested = value as Record<string, unknown>;
      for (const inner of ['name', 'id', 'version']) {
        if (typeof nested[inner] === 'string') return String(nested[inner]);
      }
    }
  }
  return '';
}

export default function ArduinoEcosystemManager({ fqbn, onStatus }: Props) {
  const [tab, setTab] = useState<Tab>('boards');
  const [query, setQuery] = useState('');
  const [target, setTarget] = useState('');
  const [raw, setRaw] = useState<JsonValue>(null);
  const [busy, setBusy] = useState(false);
  const [additionalUrl, setAdditionalUrl] = useState('');
  const [output, setOutput] = useState('Ready. BetterBoard delegates package operations to Arduino CLI.');

  const rows = useMemo(() => flattenRecords(raw).slice(0, 80), [raw]);

  async function run<T>(label: string, command: string, args: Record<string, unknown> = {}) {
    setBusy(true); setOutput(`${label}…`);
    try {
      const result = await invoke<T>(command, args);
      setOutput(typeof result === 'string' ? result : JSON.stringify(result, null, 2));
      onStatus(`${label} complete`);
      return result;
    } catch (error) {
      setOutput(String(error)); onStatus(`${label} failed: ${error}`);
      throw error;
    } finally { setBusy(false); }
  }

  async function refreshInstalled() {
    const command = tab === 'boards' ? 'arduino_core_list' : tab === 'libraries' ? 'arduino_library_list' : 'arduino_library_examples';
    if (tab === 'examples') {
      if (!target.trim()) { setOutput('Enter a library name to list examples.'); return; }
      const result = await run<JsonValue>('List examples', command, { name: target.trim(), fqbn });
      setRaw(result); return;
    }
    const result = await run<JsonValue>('Refresh installed packages', command);
    setRaw(result);
  }

  async function search() {
    if (!query.trim()) return;
    const command = tab === 'boards' ? 'arduino_core_search' : 'arduino_library_search';
    if (tab === 'examples') { setTarget(query.trim()); await refreshInstalled(); return; }
    const result = await run<JsonValue>('Search Arduino index', command, { query: query.trim() });
    setRaw(result);
  }

  async function install() {
    if (!target.trim()) return;
    const command = tab === 'boards' ? 'arduino_core_install' : 'arduino_library_install';
    const arg = tab === 'boards' ? { core: target.trim() } : { name: target.trim() };
    await run<string>('Install package', command, arg);
    await refreshInstalled();
  }

  async function uninstall() {
    if (!target.trim()) return;
    const command = tab === 'boards' ? 'arduino_core_uninstall' : 'arduino_library_uninstall';
    const arg = tab === 'boards' ? { core: target.trim() } : { name: target.trim() };
    await run<string>('Uninstall package', command, arg);
    await refreshInstalled();
  }

  async function updateIndex() {
    const command = tab === 'boards' ? 'arduino_core_update_index' : 'arduino_library_update_index';
    await run<string>('Update package index', command);
  }

  return <section className="ide-manager">
    <div className="ide-subtabs">
      <button className={tab === 'boards' ? 'active' : ''} onClick={() => { setTab('boards'); setRaw(null); }}><Box size={15}/> Boards</button>
      <button className={tab === 'libraries' ? 'active' : ''} onClick={() => { setTab('libraries'); setRaw(null); }}><Boxes size={15}/> Libraries</button>
      <button className={tab === 'examples' ? 'active' : ''} onClick={() => { setTab('examples'); setRaw(null); }}><ExternalLink size={15}/> Examples</button>
    </div>

    <div className="panel ide-manager-controls">
      <div className="manager-row">
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder={tab === 'boards' ? 'Search board platforms / cores' : tab === 'libraries' ? 'Search Arduino libraries' : 'Library name, e.g. Wire'} />
        <button className="ghost" disabled={busy || !query.trim()} onClick={() => void search()}><Search size={15}/> Search</button>
        <button className="ghost" disabled={busy} onClick={() => void refreshInstalled()}><RefreshCw size={15}/> {tab === 'examples' ? 'List examples' : 'Installed'}</button>
        {tab !== 'examples' && <button className="ghost" disabled={busy} onClick={() => void updateIndex()}><RefreshCw size={15}/> Update index</button>}
      </div>

      {tab !== 'examples' && <div className="manager-row">
        <input value={target} onChange={e => setTarget(e.target.value)} placeholder={tab === 'boards' ? 'Exact core: arduino:avr or arduino:samd@1.8.14' : 'Exact library: Adafruit MPU6050 or Name@version'} />
        <button className="primary" disabled={busy || !target.trim()} onClick={() => void install()}><Download size={15}/> Install</button>
        <button className="ghost danger" disabled={busy || !target.trim()} onClick={() => void uninstall()}><Trash2 size={15}/> Uninstall</button>
      </div>}

      {tab === 'boards' && <div className="manager-row">
        <input value={additionalUrl} onChange={e => setAdditionalUrl(e.target.value)} placeholder="Additional Boards Manager package index URL" />
        <button className="ghost" disabled={busy || !additionalUrl.trim()} onClick={() => void run<string>('Add Boards Manager URL', 'arduino_board_url_add', { url: additionalUrl.trim() })}>Add URL</button>
      </div>}
    </div>

    <div className="ide-manager-grid">
      <div className="panel package-results">
        <div className="panel-title">{tab === 'boards' ? 'Board platforms' : tab === 'libraries' ? 'Libraries' : 'Library examples'}</div>
        {!rows.length && <p className="muted">Search or refresh to load Arduino CLI results.</p>}
        {rows.map((record, index) => {
          const title = field(record, ['name', 'id', 'platform', 'library', 'path']) || `Result ${index + 1}`;
          const version = field(record, ['installed', 'version', 'latest', 'release']);
          const id = field(record, ['id', 'name', 'path']);
          return <button key={`${title}-${index}`} className="package-card" onClick={() => id && setTarget(id)}>
            <b>{title}</b>
            {version && <span>{version}</span>}
            <small>{Object.entries(record).slice(0, 5).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`).join(' · ')}</small>
          </button>;
        })}
      </div>
      <div className="panel developer-output-panel">
        <div className="panel-title">Arduino CLI package output</div>
        <pre className="terminal developer-output">{output}</pre>
      </div>
    </div>
  </section>;
}
