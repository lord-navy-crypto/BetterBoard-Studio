import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { FileCode2, FolderOpen, RefreshCw } from 'lucide-react';

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
    } catch (error) { onStatus(`Sketchbook refresh failed: ${error}`); }
    finally { setBusy(false); }
  }

  async function openProject(entry: SketchbookEntry) {
    setBusy(true); setSelectedDir(entry.directory);
    try {
      const projectFiles = await invoke<ProjectFile[]>('developer_project_files', { directory: entry.directory });
      setFiles(projectFiles);
      const main = projectFiles.find(file => file.path === entry.main_file) || projectFiles.find(file => file.name.endsWith('.ino'));
      onOpenSource(main?.source ?? entry.source, main?.name ?? `${entry.name}.ino`, entry.directory);
      onStatus(`Opened project · ${entry.name}`);
    } catch (error) { onStatus(`Open project failed: ${error}`); }
    finally { setBusy(false); }
  }

  useEffect(() => { void refresh(); }, []);

  return <section className="sketchbook-explorer">
    <div className="panel-title"><FolderOpen size={17}/> Sketchbook & project files</div>
    <div className="sketchbook-toolbar"><button className="ghost" disabled={busy} onClick={() => void refresh()}><RefreshCw size={14}/> Refresh</button><small className="muted">Documents/Arduino + Documents/BetterBoard/sketches</small></div>
    <div className="sketchbook-grid">
      <div className="sketch-list">
        {sketches.map(entry => <button key={entry.directory} className={selectedDir === entry.directory ? 'active' : ''} onClick={() => void openProject(entry)}><FolderOpen size={14}/><span><b>{entry.name}</b><small>{entry.directory}</small></span></button>)}
        {!sketches.length && <span className="muted">No sketchbook projects found yet.</span>}
      </div>
      <div className="project-file-list">
        {files.map(file => <button key={file.path} onClick={() => onOpenSource(file.source, file.name, selectedDir)}><FileCode2 size={14}/>{file.name}</button>)}
        {!files.length && <span className="muted">Open a project to inspect its .ino/.cpp/.h files.</span>}
      </div>
    </div>
  </section>;
}
