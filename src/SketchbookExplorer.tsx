import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { FileCode2, FolderOpen, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';

type SketchbookEntry = { name: string; directory: string; main_file: string; source: string };
type ProjectFile = { name: string; path: string; source: string };

type Props = {
  onOpenSource: (source: string, name: string, directory: string) => void;
  onStatus: (message: string) => void;
};

export default function SketchbookExplorer({ onOpenSource, onStatus }: Props) {
  const [sketches, setSketches] = useState<SketchbookEntry[]>([]);
  const [selectedDir, setSelectedDir] = useState('');
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [busy, setBusy] = useState(false);

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

  async function refreshFiles(directory = selectedDir) {
    if (!directory) { setFiles([]); return []; }
    const projectFiles = await invoke<ProjectFile[]>('developer_project_files', { directory });
    setFiles(projectFiles);
    return projectFiles;
  }

  async function openProject(entry: SketchbookEntry) {
    setBusy(true); setSelectedDir(entry.directory);
    try {
      const projectFiles = await refreshFiles(entry.directory);
      const main = projectFiles.find(file => file.path === entry.main_file) || projectFiles.find(file => file.name.endsWith('.ino'));
      onOpenSource(main?.source ?? entry.source, main?.name ?? `${entry.name}.ino`, entry.directory);
      onStatus(`Opened project · ${entry.name}`);
    } catch (error) { onStatus(`Open project failed: ${error}`); }
    finally { setBusy(false); }
  }

  async function createProject() {
    const name = window.prompt('New BetterBoard project name (letters, numbers, underscore):', 'BetterBoardSketch');
    if (!name) return;
    setBusy(true);
    try {
      const entry = await invoke<SketchbookEntry>('developer_project_create', { name });
      await refresh();
      await openProject(entry);
      onStatus(`Created project · ${entry.name}`);
    } catch (error) { onStatus(`Create project failed: ${error}`); }
    finally { setBusy(false); }
  }

  async function renameProject(entry: SketchbookEntry) {
    const newName = window.prompt('Rename project:', entry.name);
    if (!newName || newName === entry.name) return;
    setBusy(true);
    try {
      const renamed = await invoke<SketchbookEntry>('developer_project_rename', { directory: entry.directory, newName });
      await refresh();
      await openProject(renamed);
      onStatus(`Renamed project · ${entry.name} → ${renamed.name}`);
    } catch (error) { onStatus(`Rename project failed: ${error}`); }
    finally { setBusy(false); }
  }

  async function createFile() {
    if (!selectedDir) return;
    const name = window.prompt('New project file (.ino, .cpp, .c, .h, .hpp):', 'module.cpp');
    if (!name) return;
    setBusy(true);
    try {
      const file = await invoke<ProjectFile>('developer_project_file_create', { directory: selectedDir, fileName: name });
      await refreshFiles();
      onOpenSource(file.source, file.name, selectedDir);
      onStatus(`Created project file · ${file.name}`);
    } catch (error) { onStatus(`Create file failed: ${error}`); }
    finally { setBusy(false); }
  }

  async function renameFile(file: ProjectFile) {
    const newName = window.prompt('Rename project file:', file.name);
    if (!newName || newName === file.name) return;
    setBusy(true);
    try {
      const renamed = await invoke<ProjectFile>('developer_project_file_rename', { directory: selectedDir, fileName: file.name, newName });
      await refreshFiles();
      onOpenSource(renamed.source, renamed.name, selectedDir);
      onStatus(`Renamed file · ${file.name} → ${renamed.name}`);
    } catch (error) { onStatus(`Rename file failed: ${error}`); }
    finally { setBusy(false); }
  }

  async function deleteFile(file: ProjectFile) {
    if (!window.confirm(`Delete ${file.name}? The required main .ino file is protected and cannot be deleted.`)) return;
    setBusy(true);
    try {
      await invoke<boolean>('developer_project_file_delete', { directory: selectedDir, fileName: file.name });
      await refreshFiles();
      onStatus(`Deleted project file · ${file.name}`);
    } catch (error) { onStatus(`Delete file failed: ${error}`); }
    finally { setBusy(false); }
  }

  useEffect(() => { void refresh(); }, []);

  return <section className="sketchbook-explorer">
    <div className="panel-title"><FolderOpen size={17}/> Sketchbook & project files</div>
    <div className="sketchbook-toolbar">
      <button className="ghost" disabled={busy} onClick={() => void refresh()}><RefreshCw size={14}/> Refresh</button>
      <button className="ghost" disabled={busy} onClick={() => void createProject()}><Plus size={14}/> New project</button>
      <button className="ghost" disabled={busy || !selectedDir} onClick={() => void createFile()}><Plus size={14}/> New file</button>
      <small className="muted">Documents/Arduino + Documents/BetterBoard/sketches</small>
    </div>
    <div className="sketchbook-grid">
      <div className="sketch-list">
        {sketches.map(entry => <div key={entry.directory} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 6 }}>
          <button className={selectedDir === entry.directory ? 'active' : ''} onClick={() => void openProject(entry)}><FolderOpen size={14}/><span><b>{entry.name}</b><small>{entry.directory}</small></span></button>
          <button className="ghost" disabled={busy} title="Rename project" onClick={() => void renameProject(entry)}><Pencil size={13}/></button>
        </div>)}
        {!sketches.length && <span className="muted">No sketchbook projects found yet.</span>}
      </div>
      <div className="project-file-list">
        {files.map(file => <div key={file.path} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 6 }}>
          <button onClick={() => onOpenSource(file.source, file.name, selectedDir)}><FileCode2 size={14}/>{file.name}</button>
          <button className="ghost" disabled={busy} title="Rename file" onClick={() => void renameFile(file)}><Pencil size={13}/></button>
          <button className="ghost" disabled={busy} title="Delete non-main file" onClick={() => void deleteFile(file)}><Trash2 size={13}/></button>
        </div>)}
        {!files.length && <span className="muted">Open a project to inspect its .ino/.cpp/.h files.</span>}
      </div>
    </div>
  </section>;
}
