import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { CircuitBoard, FlaskConical } from 'lucide-react';
import App from './App';
import ExperimentsHub from './ExperimentsHub';
import { HardwareSessionProvider, useHardwareSession } from './HardwareSession';
import './styles.css';
import './visual-system.css';
import './monitor-data.css';
import './workspace-shell.css';

type Workspace = 'studio' | 'experiments';

const WORKSPACES: Array<{
  id: Workspace;
  label: string;
  subtitle: string;
  icon: typeof CircuitBoard;
}> = [
  { id: 'studio', label: 'Studio', subtitle: 'build · upload · monitor · record', icon: CircuitBoard },
  { id: 'experiments', label: 'Experiments', subtitle: 'numerical · magnetism · analysis', icon: FlaskConical },
];

function Root() {
  const [workspace, setWorkspace] = useState<Workspace>('studio');
  const { selectedPort, activePort, hardwareStatus } = useHardwareSession();

  return <div className="bb-root">
    <header className="bb-command-bar">
      <div className="bb-command-brand">
        <span className="bb-command-mark">B</span>
        <span><b>BetterBoard</b><small>physical computing studio</small></span>
      </div>

      <nav className="bb-workspace-tabs" aria-label="BetterBoard workspaces">
        {WORKSPACES.map(item => {
          const Icon = item.icon;
          return <button
            key={item.id}
            className={`bb-workspace-tab ${workspace === item.id ? 'active' : ''}`}
            onClick={() => setWorkspace(item.id)}
            aria-pressed={workspace === item.id}
          >
            <span className="bb-workspace-icon"><Icon size={15}/></span>
            <span><b>{item.label}</b><small>{item.subtitle}</small></span>
          </button>;
        })}
      </nav>

      <div className={`bb-local-state ${selectedPort ? 'connected' : 'disconnected'}`} title={hardwareStatus}>
        <i/>
        <span>{selectedPort ? `${activePort?.board_name || 'Board'} · ${selectedPort}` : 'No board selected'}</span>
      </div>
    </header>

    <div className="bb-workspace-frame">
      {workspace === 'studio' ? <App /> : <ExperimentsHub />}
    </div>
  </div>;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HardwareSessionProvider>
      <Root />
    </HardwareSessionProvider>
  </React.StrictMode>,
);