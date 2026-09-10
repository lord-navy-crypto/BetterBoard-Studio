import { useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Box, Boxes, Download, ExternalLink, RefreshCw, Search, Trash2 } from 'lucide-react';

type JsonValue = unknown;
type Tab = 'boards' | 'libraries' | 'examples';
type JsonRecord = Record<string, unknown>;
type ExampleImportFile = { name: string; source: string; main: boolean };
type PackageRow = { title: string; version: string; target: string; detail: string; examplePath?: string };
type SketchbookEntry = { name: string; directory: string; main_file: string; source: string };

type Props = {
  fqbn: string;
  onStatus: (message: string) => void;
};

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : null;
}

function recordsFrom(value: JsonValue, wrapper: string): JsonRecord[] {
  if (Array.isArray(value)) return value.map(asRecord).filter((row): row is JsonRecord => Boolean(row));
  const root = asRecord(value);
  if (!root) return [];
  const wrapped = root[wrapper];
  if (Array.isArray(wrapped)) return wrapped.map(asRecord).filter((row): row is JsonRecord => Boolean(row));
  return [];
}

function scalar(record: JsonRecord | null, key: string) {
  const value = record?.[key];
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

function latestReleaseVersion(record: JsonRecord) {
  const direct = scalar(record, 'latest') || scalar(record, 'installed') || scalar(record, 'version');
  if (direct) return direct;
  const release = asRecord(record.release);
  if (release) return scalar(release, 'version');
  const releases = asRecord(record.releases);
  if (!releases) return '';
  const versions = Object.keys(releases);
  return versions[versions.length - 1] ?? '';
}

function summarize(record: JsonRecord) {
  return Object.entries(record).slice(0, 5).map(([key, value]) => {
    if (value && typeof value === 'object') return `${key}: ${JSON.stringify(value)}`;
    return `${key}: ${String(value)}`;
  }).join(' · ');
}

function normalizeRows(tab: Tab, raw: JsonValue): PackageRow[] {
  if (tab === 'boards') {
    return recordsFrom(raw, 'platforms').slice(0, 80).map(record => ({
      title: scalar(record, 'name') || scalar(record, 'id') || 'Board platform',
      version: latestReleaseVersion(record),
      target: scalar(record, 'id'),
      detail: summarize(record),
    }));
  }

  if (tab === 'libraries') {
    const root = asRecord(raw);
    const installed = Boolean(root && Array.isArray(root.installed_libraries));
    const records = recordsFrom(raw, installed ? 'installed_libraries' : 'libraries');
    return records.slice(0, 80).map(record => {
      const library = asRecord(record.library);
      const name = scalar(record, 'name') || scalar(library, 'name');
      return {
        title: name || 'Arduino library',
        version: latestReleaseVersion(record) || (library ? latestReleaseVersion(library) : ''),
        target: name,
        detail: summarize(record),
      };
    });
  }

  return recordsFrom(raw, 'examples').slice(0, 80).map(record => {
    const library = asRecord(record.library);
    const path = scalar(record, 'path') || scalar(record, 'sketch_path');
    const name = scalar(record, 'name') || (path ? path.split('/').filter(Boolean).pop() ?? '' : '');
    const libraryName = scalar(library, 'name');
    return {
      title: name || path || 'Library example',
      version: libraryName,
      target: '',
      detail: summarize(record),
      examplePath: path || undefined,
    };
  });
}

function preparedExampleFiles(value: JsonValue): ExampleImportFile[] {
  const root = asRecord(value);
  const example = asRecord(root?.example);
  if (!example || example.betterboard_importable !== true || !Array.isArray(example.betterboard_files)) return [];
  return example.betterboard_files.map(asRecord).filter((row): row is JsonRecord => Boolean(row)).map(row => ({
    name: scalar(row, 'name'),
    source: scalar(row, 'source'),
    main: row.main === true,
  })).filter(file => file.name && file.source.length <= 512_000);
}

function safeProjectName(value: string) {
  let result = value.replace(/[^A-Za-z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '').slice(0, 72);
  if (!result) result = 'ArduinoExample';
  if (/^[0-9]/.test(result)) result = `Example_${result}`;
  return result;
}

function uninstallTarget(value: string) {
  // Arduino CLI install accepts Name@version / packager:arch@version, while
  // lib/core uninstall accept only the unversioned name/packager:arch target.
  return value.trim().replace(/@[^@]+$/, '').trim();
}

export default function ArduinoEcosystemManager({ fqbn, onStatus }: Props) {
  const [tab, setTab] = useState<Tab>('boards');
  const [query, setQuery] = useState('');
  const [target, setTarget] = useState('');
  const [raw, setRaw] = useState<JsonValue>(null);
  const [busy, setBusy] = useState(false);
  const [additionalUrl, setAdditionalUrl] = useState('');
  const [output, setOutput] = useState('Ready. BetterBoard delegates package operations to Arduino CLI.');

  const rows = useMemo(() => normalizeRows(tab, raw), [tab, raw]);

  useEffect(() => {
    if (tab !== 'examples') return;
    setRaw(null);
    setTarget('');
    setOutput(`Board profile is now ${fqbn}. Reload library examples for this board before importing.`);
  }, [fqbn, tab]);

  function switchTab(next: Tab) {
    setTab(next);
    setRaw(null);
    setQuery('');
    setTarget('');
    setOutput(next === 'examples'
      ? 'Enter a library name to list examples for the selected board profile. Examples remain read-only until explicitly imported into BetterBoard Sketchbook.'
      : 'Ready. BetterBoard delegates package operations to Arduino CLI.');
  }

  async function run<T>(label: string, command: string, args: Record<string, unknown> = {}): Promise<T | null> {
    setBusy(true); setOutput(`${label}…`);
    try {
      const result = await invoke<T>(command, args);
      setOutput(typeof result === 'string' ? result : JSON.stringify(result, null, 2));
      onStatus(`${label} complete`);
      return result;
    } catch (error) {
      const detail = String(error);
      setOutput(detail); onStatus(`${label} failed: ${detail}`);
      return null;
    } finally { setBusy(false); }
  }

  async function loadExamples(libraryName: string) {
    const library = libraryName.trim();
    if (!library) {
      setRaw(null); setTarget('');
      setOutput('Enter a library name to list examples.');
      return;
    }
    setRaw(null);
    const result = await run<JsonValue>('List examples', 'arduino_library_examples', { name: library, fqbn, examplePath: null });
    if (result === null) {
      setTarget('');
      return;
    }
    setTarget(library);
    setRaw(result);
  }

  async function refreshInstalled() {
    if (tab === 'examples') {
      await loadExamples(query.trim() || target.trim());
      return;
    }
    const command = tab === 'boards' ? 'arduino_core_list' : 'arduino_library_list';
    const result = await run<JsonValue>('Refresh installed packages', command);
    if (result !== null) setRaw(result);
  }

  async function search() {
    if (!query.trim()) return;
    if (tab === 'examples') {
      await loadExamples(query);
      return;
    }
    setTarget('');
    setRaw(null);
    const command = tab === 'boards' ? 'arduino_core_search' : 'arduino_library_search';
    const result = await run<JsonValue>('Search Arduino index', command, { query: query.trim() });
    if (result !== null) setRaw(result);
  }

  async function importExample(row: PackageRow) {
    if (busy || !target.trim() || !row.examplePath) return;
    setBusy(true);
    setOutput(`Preparing ${row.title} for safe Sketchbook import…`);
    try {
      const prepared = await invoke<JsonValue>('arduino_library_examples', {
        name: target.trim(), fqbn, examplePath: row.examplePath,
      });
      const files = preparedExampleFiles(prepared);
      if (!files.length) throw new Error('Example could not be prepared as a bounded BetterBoard source project.');
      const mainCount = files.filter(file => file.main).length;
      if (mainCount !== 1) throw new Error('Prepared example does not identify exactly one main .ino source.');
      const requestedName = window.prompt('Import this Arduino example into BetterBoard Sketchbook as:', safeProjectName(row.title));
      if (!requestedName) {
        setOutput('Example import cancelled. The installed library example was not modified.');
        return;
      }
      const projectName = safeProjectName(requestedName);
      const entry = await invoke<SketchbookEntry>('developer_project_create', { name: projectName, files });
      const detail = `Imported Arduino example · ${row.title} → ${entry.name}\n${entry.directory}\nSwitch to Developer → Sketchbook to open, edit, Verify or Upload the imported copy.`;
      setOutput(detail);
      onStatus(`Imported example to Sketchbook · ${entry.name}`);
    } catch (error) {
      const detail = `Example import failed: ${error}`;
      setOutput(detail);
      onStatus(detail);
    } finally { setBusy(false); }
  }

  async function install() {
    if (!target.trim()) return;
    const command = tab === 'boards' ? 'arduino_core_install' : 'arduino_library_install';
    const arg = tab === 'boards' ? { core: target.trim() } : { name: target.trim() };
    const result = await run<string>('Install package', command, arg);
    if (result !== null) await refreshInstalled();
  }

  async function uninstall() {
    const normalized = uninstallTarget(target);
    if (!normalized) return;
    const command = tab === 'boards' ? 'arduino_core_uninstall' : 'arduino_library_uninstall';
    const arg = tab === 'boards' ? { core: normalized } : { name: normalized };
    const result = await run<string>(`Uninstall package · ${normalized}`, command, arg);
    if (result !== null) {
      setTarget(normalized);
      await refreshInstalled();
    }
  }

  async function updateIndex() {
    const command = tab === 'boards' ? 'arduino_core_update_index' : 'arduino_library_update_index';
    await run<string>('Update package index', command);
  }

  return <section className="ide-manager">
    <div className="ide-subtabs">
      <button className={tab === 'boards' ? 'active' : ''} onClick={() => switchTab('boards')}><Box size={15}/> Boards</button>
      <button className={tab === 'libraries' ? 'active' : ''} onClick={() => switchTab('libraries')}><Boxes size={15}/> Libraries</button>
      <button className={tab === 'examples' ? 'active' : ''} onClick={() => switchTab('examples')}><ExternalLink size={15}/> Examples</button>
    </div>

    <div className="panel ide-manager-controls">
      <div className="manager-row">
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder={tab === 'boards' ? 'Search board platforms / cores' : tab === 'libraries' ? 'Search Arduino libraries' : 'Library name, e.g. Wire'} />
        <button className="ghost" disabled={busy || !query.trim()} onClick={() => void search()}><Search size={15}/> Search</button>
        <button className="ghost" disabled={busy || (tab === 'examples' && !query.trim() && !target.trim())} onClick={() => void refreshInstalled()}><RefreshCw size={15}/> {tab === 'examples' ? 'List examples' : 'Installed'}</button>
        {tab !== 'examples' && <button className="ghost" disabled={busy} onClick={() => void updateIndex()}><RefreshCw size={15}/> Update index</button>}
      </div>

      {tab !== 'examples' && <div className="manager-row">
        <input value={target} onChange={e => setTarget(e.target.value)} placeholder={tab === 'boards' ? 'Install: arduino:avr or arduino:samd@1.8.14 · Uninstall strips @version' : 'Install: Adafruit MPU6050 or Name@version · Uninstall strips @version'} />
        <button className="primary" disabled={busy || !target.trim()} onClick={() => void install()}><Download size={15}/> Install</button>
        <button className="ghost danger" disabled={busy || !uninstallTarget(target)} onClick={() => void uninstall()}><Trash2 size={15}/> Uninstall</button>
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
        {rows.map((row, index) => tab === 'examples' ? <div key={`${row.title}-${index}`} className="package-card">
          <b>{row.title}</b>
          {row.version && <span>{row.version}</span>}
          <small>{row.detail}</small>
          <button className="ghost" disabled={busy || !row.examplePath || !target.trim()} onClick={() => void importExample(row)}><Download size={14}/> Import to Sketchbook</button>
        </div> : <button key={`${row.title}-${index}`} className="package-card" onClick={() => row.target && setTarget(row.target)}>
          <b>{row.title}</b>
          {row.version && <span>{row.version}</span>}
          <small>{row.detail}</small>
        </button>)}
      </div>
      <div className="panel developer-output-panel">
        <div className="panel-title">Arduino CLI package output</div>
        <pre className="terminal developer-output">{output}</pre>
      </div>
    </div>
  </section>;
}
