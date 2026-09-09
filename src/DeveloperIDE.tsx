import { useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Braces, Boxes, Code2, Download, FilePlus2, FolderOpen, Play, RotateCcw, Save, TerminalSquare, Upload } from 'lucide-react';
import type { TaskCategory, TaskState } from './TaskCenter';
import OpenPenguinBridge from './OpenPenguinBridge';
import SmartArduinoEditor from './SmartArduinoEditor';
import ArduinoEcosystemManager from './ArduinoEcosystemManager';
import SketchbookExplorer from './SketchbookExplorer';
import CopyButton from './CopyButton';
import { clearDeveloperDraft, loadDeveloperDraft, saveDeveloperDraft, type DeveloperDraft } from './DeveloperDraftStore';

type CliInfo = { found: boolean; path?: string; version?: string; error?: string };
type RecipeSpec = {
  id: string;
  title: string;
  sketch_name: string;
  baud: number;
  notes: string[];
  user_defined?: boolean;
  parameter_values?: Record<string, string>;
};

type Props = {
  recipe?: RecipeSpec;
  canonicalSource: string;
  cli: CliInfo | null;
  fqbn: string;
  selectedPort: string;
  integratedDevices: number;
  recipes: RecipeSpec[];
  onLibrarySaved?: (recipe: RecipeSpec) => void;
  onStatus: (message: string) => void;
  onTaskStart: (category: TaskCategory, title: string, detail?: string) => number;
  onTaskLog: (id: number, message: string) => void;
  onTaskFinish: (id: number, state: Exclude<TaskState, 'running'>, detail: string) => void;
};

type DeveloperView = 'editor' | 'ecosystem' | 'sketchbook';
type Diagnostic = { line: number; column?: number; message: string; severity?: 'error' | 'warning' };

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

function compileDiagnostics(text: string): Diagnostic[] {
  const rows: Diagnostic[] = [];
  const regex = /:(\d+):(\d+):\s+(error|warning):\s+(.+)/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text))) {
    rows.push({ line: Number(match[1]), column: Number(match[2]), severity: match[3].toLowerCase() === 'warning' ? 'warning' : 'error', message: match[4].trim() });
  }
  return rows.slice(0, 200);
}

export default function DeveloperIDE({
  recipe, canonicalSource, cli, fqbn, selectedPort, integratedDevices, recipes, onLibrarySaved,
  onStatus, onTaskStart, onTaskLog, onTaskFinish,
}: Props) {
  const initialDraftRef = useRef<DeveloperDraft | null | undefined>(undefined);
  if (initialDraftRef.current === undefined) initialDraftRef.current = loadDeveloperDraft();
  const initialDraft = initialDraftRef.current;
  const recoveredDraftRef = useRef(Boolean(initialDraft));

  const [view, setView] = useState<DeveloperView>('editor');
  const [source, setSource] = useState(initialDraft?.source ?? canonicalSource ?? BLANK_SKETCH);
  const [sketchName, setSketchName] = useState(initialDraft?.sketchName ?? safeDefaultName(recipe?.sketch_name));
  const [savedDir, setSavedDir] = useState(initialDraft?.savedDir ?? '');
  const [projectDir, setProjectDir] = useState(initialDraft?.projectDir ?? '');
  const [projectFileName, setProjectFileName] = useState(initialDraft?.projectFileName ?? '');
  const [output, setOutput] = useState(initialDraft ? `Recovered unsaved Developer draft from ${new Date(initialDraft.updatedAt).toLocaleString()}.` : 'Ready. Edit the sketch, then Verify or Run / Upload.');
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(Boolean(initialDraft));
  const [templateId, setTemplateId] = useState(initialDraft?.templateId ?? recipe?.id ?? '');
  const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([]);
  const [recoveredAt, setRecoveredAt] = useState(initialDraft?.updatedAt ?? 0);

  useEffect(() => {
    if (recoveredDraftRef.current) {
      const draftRecipe = initialDraftRef.current?.recipeId ?? '';
      if (!recipe?.id || !draftRecipe || draftRecipe === recipe.id) return;
      recoveredDraftRef.current = false;
      clearDeveloperDraft();
      setRecoveredAt(0);
    }
    setSource(canonicalSource || BLANK_SKETCH);
    setSketchName(safeDefaultName(recipe?.sketch_name));
    setSavedDir(''); setProjectDir(''); setProjectFileName('');
    setOutput(`Loaded ${recipe?.title || 'blank sketch'} as the editing starting point.`);
    setDirty(false); setDiagnostics([]); setTemplateId(recipe?.id ?? '');
  }, [recipe?.id, canonicalSource]);

  useEffect(() => {
    if (!dirty) return;
    const timer = window.setTimeout(() => {
      saveDeveloperDraft({
        source,
        sketchName,
        projectDir,
        projectFileName,
        savedDir,
        templateId,
        recipeId: recipe?.id ?? '',
      });
    }, 500);
    return () => window.clearTimeout(timer);
  }, [dirty, source, sketchName, projectDir, projectFileName, savedDir, templateId, recipe?.id]);

  const sourceFacts = useMemo(() => ({ lines: source.split(/\r?\n/).length, chars: source.length }), [source]);

  function markAuthoritativeSave() {
    recoveredDraftRef.current = false;
    clearDeveloperDraft();
    setRecoveredAt(0);
    setDirty(false);
  }

  async function saveCurrent(track = true) {
    const task = track ? onTaskStart('Program', `Save · ${projectFileName || sketchName}`, projectDir ? 'Writing project file…' : 'Writing editable .ino to BetterBoard sketches…') : 0;
    try {
      let compileDir = projectDir;
      let savedPath = '';
      if (projectDir && projectFileName) {
        savedPath = await invoke<string>('developer_project_file_save', { directory: projectDir, fileName: projectFileName, source });
      } else {
        compileDir = await invoke<string>('developer_sketch_save', { sketchName, source });
        savedPath = compileDir;
      }
      setSavedDir(compileDir); markAuthoritativeSave();
      const detail = `Saved · ${savedPath}`;
      if (track) { onTaskLog(task, detail); onTaskFinish(task, 'done', detail); }
      onStatus(detail);
      return compileDir;
    } catch (error) {
      const detail = `Save failed: ${error}`;
      if (track) { onTaskLog(task, detail); onTaskFinish(task, 'failed', detail); }
      setOutput(detail); onStatus(detail); return '';
    }
  }

  async function verify() {
    if (busy) return;
    setBusy(true); setDiagnostics([]);
    const task = onTaskStart('Program', `Verify · ${projectFileName || sketchName}`, `Saving and compiling for ${fqbn}…`);
    try {
      const dir = await saveCurrent(false); if (!dir) throw new Error('Save failed before compile');
      onTaskLog(task, `Compile target: ${fqbn}`);
      const result = await invoke<string>('compile_sketch', { sketchDir: dir, fqbn });
      const text = result.trim() || 'Compile succeeded.';
      setOutput(text); setDiagnostics(compileDiagnostics(text)); onTaskLog(task, text);
      onTaskFinish(task, 'done', 'Verify succeeded'); onStatus('Developer verify succeeded.');
    } catch (error) {
      const text = String(error); setOutput(text); setDiagnostics(compileDiagnostics(text)); onTaskLog(task, text);
      onTaskFinish(task, 'failed', 'Verify failed'); onStatus(`Developer verify failed: ${text}`);
    } finally { setBusy(false); }
  }

  async function runUpload() {
    if (busy) return;
    if (!selectedPort) { onStatus('Select a serial device before Run / Upload.'); return; }
    setBusy(true); setDiagnostics([]);
    const task = onTaskStart('Program', `Run / Upload · ${projectFileName || sketchName}`, `Compile → upload to ${selectedPort}`);
    try {
      const dir = await saveCurrent(false); if (!dir) throw new Error('Save failed before upload');
      onTaskLog(task, `Compile target: ${fqbn}`);
      const compileResult = await invoke<string>('compile_sketch', { sketchDir: dir, fqbn });
      setDiagnostics(compileDiagnostics(compileResult)); onTaskLog(task, compileResult.trim() || 'Compile succeeded.');
      onTaskLog(task, `Uploading to ${selectedPort}…`);
      const uploadResult = await invoke<string>('upload_sketch', { sketchDir: dir, fqbn, port: selectedPort });
      const combined = [compileResult.trim(), uploadResult.trim()].filter(Boolean).join('\n\n');
      setOutput(combined || 'Compile & upload succeeded.'); onTaskLog(task, uploadResult.trim() || 'Upload succeeded.');
      onTaskFinish(task, 'done', `Uploaded to ${selectedPort}`); onStatus(`Developer sketch uploaded to ${selectedPort}.`);
    } catch (error) {
      const text = String(error); setOutput(text); setDiagnostics(compileDiagnostics(text)); onTaskLog(task, text);
      onTaskFinish(task, 'failed', 'Run / Upload failed'); onStatus(`Developer run failed: ${text}`);
    } finally { setBusy(false); }
  }

  async function formatSource() {
    if (busy || !source.trim()) return;
    setBusy(true);
    const task = onTaskStart('Program', `Format · ${projectFileName || sketchName}`, 'Formatting Arduino/C++ source with clang-format…');
    try {
      const formatted = await invoke<string>('developer_format_source', { source });
      setSource(formatted); setDirty(true); setDiagnostics([]);
      const detail = 'Formatted source with clang-format. Review changes, then Save or Verify.';
      setOutput(detail); onTaskLog(task, detail); onTaskFinish(task, 'done', detail); onStatus(detail);
    } catch (error) {
      const detail = `Formatter unavailable or failed: ${error}`;
      setOutput(detail); onTaskLog(task, detail); onTaskFinish(task, 'failed', detail); onStatus(detail);
    } finally { setBusy(false); }
  }

  function resetToRecipe() {
    recoveredDraftRef.current = false; clearDeveloperDraft(); setRecoveredAt(0);
    setSource(canonicalSource || BLANK_SKETCH); setSketchName(safeDefaultName(recipe?.sketch_name));
    setSavedDir(''); setProjectDir(''); setProjectFileName(''); setDirty(false); setDiagnostics([]);
    setOutput(`Reset editor to canonical ${recipe?.sketch_name || 'blank'} source.`);
  }

  async function loadTemplate() {
    const template = recipes.find(item => item.id === templateId);
    if (!template) { resetToRecipe(); return; }
    try {
      const text = await invoke<string>('recipe_source', { recipeId: template.id });
      recoveredDraftRef.current = false; clearDeveloperDraft(); setRecoveredAt(0);
      setSource(text); setSketchName(safeDefaultName(template.sketch_name)); setSavedDir(''); setProjectDir(''); setProjectFileName(''); setDirty(false); setDiagnostics([]);
      setOutput(`Loaded recipe template: ${template.title}`); setView('editor');
    } catch (error) { setOutput(`Template load failed: ${error}`); }
  }

  async function saveToLibrary() {
    const task = onTaskStart('System', `Save to Library · ${sketchName}`, 'Saving editable sketch as a BetterBoard user recipe…');
    try {
      const template = recipes.find(item => item.id === templateId);
      const saved = await invoke<RecipeSpec>('user_recipe_save', { title: sketchName, baseRecipeId: template?.id ?? recipe?.id ?? '', source, parameterValues: template?.parameter_values ?? {} });
      onLibrarySaved?.(saved); const detail = `Saved user recipe · ${saved.title}`;
      onTaskLog(task, detail); onTaskFinish(task, 'done', detail); onStatus(detail); setOutput(detail);
    } catch (error) {
      const detail = `Save to Library failed: ${error}`; onTaskLog(task, detail); onTaskFinish(task, 'failed', detail); onStatus(detail); setOutput(detail);
    }
  }

  function newSketch() {
    recoveredDraftRef.current = false; clearDeveloperDraft(); setRecoveredAt(0);
    setSource(BLANK_SKETCH); setSketchName('BetterBoardSketch'); setSavedDir(''); setProjectDir(''); setProjectFileName(''); setDirty(true); setDiagnostics([]);
    setOutput('New blank Arduino sketch. Draft autosave is active until the first explicit Save.'); setView('editor');
  }

  function openProjectSource(nextSource: string, fileName: string, directory: string) {
    if (dirty && !window.confirm('The current unsaved edits are protected by Draft Recovery. Open another project file now?')) return;
    recoveredDraftRef.current = false; clearDeveloperDraft(); setRecoveredAt(0);
    setSource(nextSource); setProjectFileName(fileName); setProjectDir(directory); setSavedDir(directory);
    setSketchName(safeDefaultName(fileName.replace(/\.[^.]+$/, ''))); setDirty(false); setDiagnostics([]); setView('editor');
    setOutput(`Opened project file: ${fileName}\n${directory}`);
  }

  return <section className="developer-ide">
    <div className="developer-toolbar panel">
      <div>
        <div className="panel-title"><Code2 size={18}/> Developer · Arduino-style free edit · IDE-class workspace</div>
        <small className="muted">Smart C++ editing, durable draft recovery, Arduino CLI package management, sketchbook projects, Verify and Upload — without leaving BetterBoard.</small>
      </div>
      <div className="ide-subtabs developer-view-tabs">
        <button className={view === 'editor' ? 'active' : ''} onClick={() => setView('editor')}><Code2 size={15}/> Editor</button>
        <button className={view === 'ecosystem' ? 'active' : ''} onClick={() => setView('ecosystem')}><Boxes size={15}/> Boards & Libraries</button>
        <button className={view === 'sketchbook' ? 'active' : ''} onClick={() => setView('sketchbook')}><FolderOpen size={15}/> Sketchbook</button>
      </div>
      {view === 'editor' && <div className="developer-actions">
        <button className="ghost" disabled={busy} onClick={newSketch}><FilePlus2 size={15}/> New</button>
        <button className="ghost" disabled={busy} onClick={() => void loadTemplate()}><RotateCcw size={15}/> Load recipe template</button>
        <button className="ghost" disabled={busy || !source.trim()} onClick={() => void formatSource()}><Braces size={15}/> Format</button>
        <button className="ghost" disabled={busy || !source.trim()} onClick={() => void saveCurrent()}><Save size={15}/> Save</button>
        <button className="ghost" disabled={busy || !source.trim()} onClick={() => void saveToLibrary()}><Braces size={15}/> Save to Library</button>
        <button className="ghost" disabled={busy || !source.trim()} onClick={() => void verify()}><Download size={15}/> Verify</button>
        <button className="primary" disabled={busy || !source.trim() || !selectedPort} onClick={() => void runUpload()}><Upload size={15}/> Run / Upload</button>
      </div>}
    </div>

    {view === 'editor' && <div className="developer-ide-grid">
      <div className="panel developer-editor-panel">
        <div className="developer-filebar">
          <label>Template<select value={templateId} onChange={event => setTemplateId(event.target.value)}><option value="">Blank / current</option>{recipes.map(item => <option key={item.id} value={item.id}>{item.user_defined ? 'My Library · ' : ''}{item.title}</option>)}</select></label>
          {!projectDir && <label>Sketch name<input value={sketchName} disabled={busy} onChange={event => { setSketchName(event.target.value.replace(/[^A-Za-z0-9_]/g, '_')); setDirty(true); }} /></label>}
          {projectDir && <span className="project-chip">Project · {projectFileName}</span>}
          <span className={dirty ? 'dirty' : ''}>{dirty ? '● unsaved · autosaved draft' : 'saved / recipe state'}</span>
          {recoveredAt > 0 && <span className="project-chip">Recovered · {new Date(recoveredAt).toLocaleString()}</span>}
          <span>{sourceFacts.lines} lines · {sourceFacts.chars} chars</span>
          {diagnostics.length > 0 && <span className="diagnostic-count">{diagnostics.length} diagnostic(s)</span>}
        </div>
        <div className="smart-editor-host"><SmartArduinoEditor value={source} readOnly={busy} diagnostics={diagnostics} onChange={value => { setSource(value); setDirty(true); }} /></div>
      </div>

      <div className="developer-side">
        <div className="panel developer-output-panel"><div className="panel-title panel-title-with-action"><span><Play size={18}/> Run output</span><CopyButton text={output} label="Copy output" /></div><pre className="terminal developer-output">{output}</pre></div>
        <div className="panel">
          <div className="panel-title"><TerminalSquare size={18}/> Runtime facts</div>
          <div className="facts">
            <span>Arduino CLI</span><b>{cli?.path || 'not found'}</b><span>CLI version</span><b>{cli?.version || '—'}</b>
            <span>Board profile</span><b>{fqbn}</b><span>Serial port</span><b>{selectedPort || 'not selected'}</b>
            <span>Project / sketch</span><b>{projectDir || savedDir || 'not saved yet'}</b><span>Integrated devices</span><b>{integratedDevices}</b>
          </div>
          <div className="info-section"><b>Starting recipe notes</b>{recipe?.notes?.length ? recipe.notes.map(note => <span key={note}>• {note}</span>) : <span>• Free sketch mode is not constrained to a recipe.</span>}</div>
        </div>
        <OpenPenguinBridge context={`Recipe: ${recipe?.title || 'free sketch'}\nBoard: ${fqbn}\nPort: ${selectedPort || 'none'}\nProject: ${projectDir || 'BetterBoard sketch'}\nFile: ${projectFileName || `${sketchName}.ino`}\n\nSketch:\n${source}`} />
      </div>
    </div>}

    {view === 'ecosystem' && <ArduinoEcosystemManager fqbn={fqbn} onStatus={onStatus} />}
    {view === 'sketchbook' && <div className="panel"><SketchbookExplorer onOpenSource={openProjectSource} onStatus={onStatus} /></div>}
  </section>;
}
