import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { FileCode2, FolderOpen, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';

type SketchbookEntry = { name: string; directory: string; main_file: string; source: string };
type ProjectFile = { name: string; path: string; source: string };

type Props = {
  onOpenSource: (source: string, name: string, directory: string) => boolean;
  onStatus: (message: string) => void;
  hasUnsavedEdits: boolean;
};

export default function SketchbookExplorer({ onOpenSource, onStatus, hasUnsavedEdits }: Props) {
  const [sketches, setSketches] = useState<SketchbookEntry[]>([]);
  const [selectedDir, setSelectedDir] = useState('');
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [busy, setBusy] = useState(false);

  function mutationAllowed(action: string) {
    if (!hasUnsavedEdits) return true;
    onStatus(`Save or explicitly replace the current Developer draft before ${action}. Sketchbook mutations are blocked while the editor has unsaved edits.`);
    return false;
  }

  async function refresh() {
    setBusy(true);
    try {
      const rows = await invoke<SketchbookEntry[]>('developer_sketchbook_list');
      setSketches(rows);
      onStatus(`Sketchbook · ${rows.length} project(s)`);
      if (selectedDir && !rows.some(row => row.directory === selectedDir)) {
        setSelectedDir(''); setFiles([]);
      }
    } catch (error) { onStatus(`Sketchbook refresh failed: ${error}`); }
    finally { setBusy(false); }
  }

  async function fetchProjectFiles(directory: string) {
    return invoke<ProjectFile[]>('developer_project_files', { directory });
  }

  async function refreshFiles(directory = selectedDir) {
    if (!directory) { setFiles([]); return []; }
    try {
      const projectFiles = await fetchProjectFiles(directory);
      setFiles(projectFiles);
      return projectFiles;
    } catch (error) {
      onStatus(`Project file refresh failed: ${error}`);
      return [];
    }
  }

  async function openProject(entry: SketchbookEntry) {
    if (busy) return;
    setBusy(true);
    try {
      const projectFiles = await fetchProjectFiles(entry.directory);
      const main = projectFiles.find(file => file.path === entry.main_file) || projectFiles.find(file => file.name.endsWith('.ino'));
      const accepted = onOpenSource(main?.source ?? entry.source, main?.name ?? `${entry.name}.ino`, entry.directory);
      if (!accepted) {
        onStatus('Open project cancelled; current Developer edits remain active.');
        return;
      }
      setSelectedDir(entry.directory);
      setFiles(projectFiles);
      onStatus(`Opened project · ${entry.name}`);
    } catch (error) { onStatus(`Open project failed: ${error}`); }
    finally { setBusy(false); }
  }

  async function createProject() {
    if (!mutationAllowed('creating another project')) return;
    const name = window.prompt('New BetterBoard project name (letters, numbers, underscore):', 'BetterBoardSketch');
    if (!name) return;
    setBusy(true);
    try {
      const entry = await invoke<SketchbookEntry>('developer_project_create', { name });
      const rows = await invoke<SketchbookEntry[]>('developer_sketchbook_list');
      setSketches(rows);
      const projectFiles = await fetchProjectFiles(entry.directory);
      const main = projectFiles.find(file => file.path === entry.main_file) || projectFiles.find(file => file.name.endsWith('.ino'));
      if (onOpenSource(main?.source ?? entry.source, main?.name ?? `${entry.name}.ino`, entry.directory)) {
        setSelectedDir(entry.directory); setFiles(projectFiles);
      }
      onStatus(`Created project · ${entry.name}`);
    } catch (error) { onStatus(`Create project failed: ${error}`); }
    finally { setBusy(false); }
  }

  async function renameProject(entry: SketchbookEntry) {
    if (!mutationAllowed('renaming a project')) return;
    const newName = window.prompt('Rename project:', entry.name);
    if (!newName || newName === entry.name) return;
    setBusy(true);
    try {
      const renamed = await invoke<SketchbookEntry>('developer_project_rename', { directory: entry.directory, newName });
      const rows = await invoke<SketchbookEntry[]>('developer_sketchbook_list');
      setSketches(rows);
      const projectFiles = await fetchProjectFiles(renamed.directory);
      const main = projectFiles.find(file => file.path === renamed.main_file) || projectFiles.find(file => file.name.endsWith('.ino'));
      if (onOpenSource(main?.source ?? renamed.source, main?.name ?? `${renamed.name}.ino`, renamed.directory)) {
        setSelectedDir(renamed.directory); setFiles(projectFiles);
      }
      onStatus(`Renamed project · ${entry.name} → ${renamed.name}`);
    } catch (error) {
      await refresh();
      onStatus(`Rename project failed: ${error}. Sketchbook was refreshed to reflect the actual filesystem state.`);
    } finally { setBusy(false); }
  }

  async function createFile() {
    if (!selectedDir || !mutationAllowed('creating another project file')) return;
    const name = window.prompt('New project file (.ino, .cpp, .c, .h, .hpp):', 'module.cpp');
    if (!name) return;
    setBusy(true);
    try {
      const file = await invoke<ProjectFile>('developer_project_file_create', { directory: selectedDir, fileName: name });
      const projectFiles = await fetchProjectFiles(selectedDir);
      setFiles(projectFiles);
      if (onOpenSource(file.source, file.name, selectedDir)) onStatus(`Created project file · ${file.name}`);
    } catch (error) { onStatus(`Create file failed: ${error}`); }
    finally { setBusy(false); }
  }

  async function renameFile(file: ProjectFile) {
    if (!mutationAllowed('renaming a project file')) return;
    const newName = window.prompt('Rename project file:', file.name);
    if (!newName || newName === file.name) return;
    setBusy(true);
    try {
      const renamed = await invoke<ProjectFile>('developer_project_file_rename', { directory: selectedDir, fileName: file.name, newName });
      const projectFiles = await fetchProjectFiles(selectedDir);
      setFiles(projectFiles);
      if (onOpenSource(renamed.source, renamed.name, selectedDir)) onStatus(`Renamed file · ${file.name} → ${renamed.name}`);
    } catch (error) { onStatus(`Rename file failed: ${error}`); }
    finally { setBusy(false); }
  }

  async function deleteFile(file: ProjectFile) {
    if (!mutationAllowed('deleting a project file')) return;
    if (!window.confirm(`Delete ${file.name}? The required main .ino file is protected and cannot be deleted.`)) return;
    setBusy(true);
    try {
      const deleted = await invoke<boolean>('developer_project_file_delete', { directory: selectedDir, fileName: file.name });
      if (!deleted) {
        onStatus(`Delete skipped · ${file.name} no longer exists.`);
        await refreshFiles();
        return;
      }
      const projectFiles = await fetchProjectFiles(selectedDir);
      setFiles(projectFiles);
      const projectName = selectedDir.split(/[\\/]/).filter(Boolean).pop() ?? '';
      const main = projectFiles.find(item => item.name === `${projectName}.ino`) || projectFiles.find(item => item.name.endsWith('.ino'));
      if (main) onOpenSource(main.source, main.name, selectedDir);
      onStatus(`Deleted project file · ${file.name}${main ? ` · editor returned to ${main.name}` : ''}`);
    } catch (error) { onStatus(`Delete file failed: ${error}`); }
    finally { setBusy(false); }
  }

  useEffect(() => { void refresh(); }, []);

  return <section className="sketchbook-explorer">
    <div className="panel-title"><FolderOpen size={17}/> Sketchbook & project files</div>
    <div className="sketchbook-toolbar">
      <button className="ghost" disabled={busy} onClick={() => void refresh()}><RefreshCw size={14}/> Refresh</button>
      <button className="ghost" disabled={busy || hasUnsavedEdits} onClick={() => void createProject()}><Plus size={14}/> New project</button>
      <button className="ghost" disabled={busy || !selectedDir || hasUnsavedEdits} onClick={() => void createFile()}><Plus size={14}/> New file</button>
      <small className="muted">Documents/Arduino + Documents/BetterBoard/sketches{hasUnsavedEdits ? ' · save current edits before rename/create/delete' : ''}</small>
    </div>
    <div className="sketchbook-grid">
      <div className="sketch-list">
        {sketches.map(entry => <div key={entry.directory} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 6 }}>
          <button className={selectedDir === entry.directory ? 'active' : ''} onClick={() => void openProject(entry)}><FolderOpen size={14}/><span><b>{entry.name}</b><small>{entry.directory}</small></span></button>
          <button className="ghost" disabled={busy || hasUnsavedEdits} title="Rename project" onClick={() => void renameProject(entry)}><Pencil size={13}/></button>
        </div>)}
        {!sketches.length && <span className="muted">No sketchbook projects found yet.</span>}
      </div>
      <div className="project-file-list">
        {files.map(file => <div key={file.path} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 6 }}>
          <button onClick={() => { if (onOpenSource(file.source, file.name, selectedDir)) onStatus(`Opened project file · ${file.name}`); }}><FileCode2 size={14}/>{file.name}</button>
          <button className="ghost" disabled={busy || hasUnsavedEdits} title="Rename file" onClick={() => void renameFile(file)}><Pencil size={13}/></button>
          <button className="ghost" disabled={busy || hasUnsavedEdits} title="Delete non-main file" onClick={() => void deleteFile(file)}><Trash2 size={13}/></button>
        </div>)}
        {!files.length && <span className="muted">Open a project to inspect its .ino/.cpp/.h files.</span>}
      </div>
    </div>
  </section>;
}
