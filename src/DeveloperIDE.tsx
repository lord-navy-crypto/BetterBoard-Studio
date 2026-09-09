import { useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Braces, Code2, Download, FilePlus2, Play, RotateCcw, Save, TerminalSquare, Upload } from 'lucide-react';
import type { TaskCategory, TaskState } from './TaskCenter';

type CliInfo = { found: boolean; path?: string; version?: string; error?: string };
type RecipeSpec = {
  id: string;
  title: string;
  sketch_name: string;
  baud: number;
  notes: string[];
};

type Props = {
  recipe?: RecipeSpec;
  canonicalSource: string;
  cli: CliInfo | null;
  fqbn: string;
  selectedPort: string;
  integratedDevices: number;
  onStatus: (message: string) => void;
  onTaskStart: (category: TaskCategory, title: string, detail?: string) => number;
  onTaskLog: (id: number, message: string) => void;
  onTaskFinish: (id: number, state: Exclude<TaskState, 'running'>, detail: string) => void;
};

const BLANK_SKETCH = `void setup() {
  // runs once
}

void loop() {
  // runs repeatedly
}
`;

function safeDefaultName(name?: string) {
  const candidate = (name || 'BetterBoardSketch').replace(/[^A-Za-z0-9_]/g, '_').replace(/^_+/, '');
  return candidate || 'BetterBoardSketch';
}

export default function DeveloperIDE({
  recipe, canonicalSource, cli, fqbn, selectedPort, integratedDevices,
  onStatus, onTaskStart, onTaskLog, onTaskFinish,
}: Props) {
  const [source, setSource] = useState(canonicalSource || BLANK_SKETCH);
  const [sketchName, setSketchName] = useState(safeDefaultName(recipe?.sketch_name));
  const [savedDir, setSavedDir] = useState('');
  const [output, setOutput] = useState('Ready. Edit the sketch, then Verify or Run / Upload.');
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setSource(canonicalSource || BLANK_SKETCH);
    setSketchName(safeDefaultName(recipe?.sketch_name));
    setSavedDir('');
    setOutput(`Loaded ${recipe?.title || 'blank sketch'} as the editing starting point.`);
    setDirty(false);
  }, [recipe?.id, canonicalSource]);

  const sourceFacts = useMemo(() => ({
    lines: source.split(/\r?\n/).length,
    chars: source.length,
  }), [source]);

  async function saveDraft(track = true) {
    const task = track ? onTaskStart('Program', `Save sketch · ${sketchName}`, 'Writing editable .ino to BetterBoard sketches…') : 0;
    try {
      const dir = await invoke<string>('developer_sketch_save', { sketchName, source });
      setSavedDir(dir);
      setDirty(false);
      const detail = `Saved · ${dir}`;
      if (track) { onTaskLog(task, detail); onTaskFinish(task, 'done', detail); }
      onStatus(detail);
      return dir;
    } catch (error) {
      const detail = `Save failed: ${error}`;
      if (track) { onTaskLog(task, detail); onTaskFinish(task, 'failed', detail); }
      setOutput(detail);
      onStatus(detail);
      return '';
    }
  }

  async function verify() {
    if (busy) return;
    setBusy(true);
    const task = onTaskStart('Program', `Verify · ${sketchName}`, `Saving and compiling for ${fqbn}…`);
    try {
      const dir = await invoke<string>('developer_sketch_save', { sketchName, source });
      setSavedDir(dir); setDirty(false);
      onTaskLog(task, `Saved sketch: ${dir}`);
      onTaskLog(task, `arduino-cli compile --fqbn ${fqbn}`);
      const result = await invoke<string>('compile_sketch', { sketchDir: dir, fqbn });
      const text = result.trim() || 'Compile succeeded.';
      setOutput(text);
      onTaskLog(task, text);
      onTaskFinish(task, 'done', 'Verify succeeded');
      onStatus('Developer verify succeeded.');
    } catch (error) {
      const text = String(error);
      setOutput(text);
      onTaskLog(task, text);
      onTaskFinish(task, 'failed', 'Verify failed');
      onStatus(`Developer verify failed: ${text}`);
    } finally {
      setBusy(false);
    }
  }

  async function runUpload() {
    if (busy) return;
    if (!selectedPort) {
      onStatus('Select a serial device before Run / Upload.');
      return;
    }
    setBusy(true);
    const task = onTaskStart('Program', `Run / Upload · ${sketchName}`, `Compile → upload to ${selectedPort}`);
    try {
      const dir = await invoke<string>('developer_sketch_save', { sketchName, source });
      setSavedDir(dir); setDirty(false);
      onTaskLog(task, `Saved sketch: ${dir}`);
      onTaskLog(task, `Compile target: ${fqbn}`);
      const compileResult = await invoke<string>('compile_sketch', { sketchDir: dir, fqbn });
      onTaskLog(task, compileResult.trim() || 'Compile succeeded.');
      onTaskLog(task, `Uploading to ${selectedPort}…`);
      const uploadResult = await invoke<string>('upload_sketch', { sketchDir: dir, fqbn, port: selectedPort });
      const combined = [compileResult.trim(), uploadResult.trim()].filter(Boolean).join('\n\n');
      setOutput(combined || 'Compile & upload succeeded.');
      onTaskLog(task, uploadResult.trim() || 'Upload succeeded.');
      onTaskFinish(task, 'done', `Uploaded to ${selectedPort}`);
      onStatus(`Developer sketch uploaded to ${selectedPort}.`);
    } catch (error) {
      const text = String(error);
      setOutput(text);
      onTaskLog(task, text);
      onTaskFinish(task, 'failed', 'Run / Upload failed');
      onStatus(`Developer run failed: ${text}`);
    } finally {
      setBusy(false);
    }
  }

  function resetToRecipe() {
    setSource(canonicalSource || BLANK_SKETCH);
    setSketchName(safeDefaultName(recipe?.sketch_name));
    setSavedDir('');
    setDirty(false);
    setOutput(`Reset editor to canonical ${recipe?.sketch_name || 'blank'} source.`);
  }

  function newSketch() {
    setSource(BLANK_SKETCH);
    setSketchName('BetterBoardSketch');
    setSavedDir('');
    setDirty(true);
    setOutput('New blank Arduino sketch.');
  }

  return <section className="developer-ide">
    <div className="developer-toolbar panel">
      <div>
        <div className="panel-title"><Code2 size={18}/> Developer · Arduino-style free edit</div>
        <small className="muted">Edit a real `.ino`, save it under Documents/BetterBoard/sketches, Verify with Arduino CLI, or compile and upload it to the selected board.</small>
      </div>
      <div className="developer-actions">
        <button className="ghost" disabled={busy} onClick={newSketch}><FilePlus2 size={15}/> New</button>
        <button className="ghost" disabled={busy} onClick={resetToRecipe}><RotateCcw size={15}/> Load recipe</button>
        <button className="ghost" disabled={busy || !source.trim()} onClick={() => void saveDraft()}><Save size={15}/> Save</button>
        <button className="ghost" disabled={busy || !source.trim()} onClick={() => void verify()}><Download size={15}/> Verify</button>
        <button className="primary" disabled={busy || !source.trim() || !selectedPort} onClick={() => void runUpload()}><Upload size={15}/> Run / Upload</button>
      </div>
    </div>

    <div className="developer-ide-grid">
      <div className="panel developer-editor-panel">
        <div className="developer-filebar">
          <label>Sketch name<input value={sketchName} disabled={busy} onChange={event => { setSketchName(event.target.value.replace(/[^A-Za-z0-9_]/g, '_')); setDirty(true); }} /></label>
          <span className={dirty ? 'dirty' : ''}>{dirty ? '● unsaved' : 'saved / recipe state'}</span>
          <span>{sourceFacts.lines} lines · {sourceFacts.chars} chars</span>
        </div>
        <textarea
          className="code developer-editor"
          value={source}
          disabled={busy}
          spellCheck={false}
          aria-label="Arduino sketch editor"
          onChange={event => { setSource(event.target.value); setDirty(true); }}
        />
      </div>

      <div className="developer-side">
        <div className="panel developer-output-panel">
          <div className="panel-title"><Play size={18}/> Run output</div>
          <pre className="terminal developer-output">{output}</pre>
        </div>
        <div className="panel">
          <div className="panel-title"><TerminalSquare size={18}/> Runtime facts</div>
          <div className="facts">
            <span>Arduino CLI</span><b>{cli?.path || 'not found'}</b>
            <span>CLI version</span><b>{cli?.version || '—'}</b>
            <span>Board profile</span><b>{fqbn}</b>
            <span>Serial port</span><b>{selectedPort || 'not selected'}</b>
            <span>Sketch folder</span><b>{savedDir || 'not saved yet'}</b>
            <span>Integrated devices</span><b>{integratedDevices}</b>
          </div>
          <div className="info-section"><b>Starting recipe notes</b>{recipe?.notes?.length ? recipe.notes.map(note => <span key={note}>• {note}</span>) : <span>• Free sketch mode is not constrained to a recipe.</span>}</div>
        </div>
      </div>
    </div>
  </section>;
}
