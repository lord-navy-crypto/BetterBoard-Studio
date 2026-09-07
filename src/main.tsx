import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { CircuitBoard, Magnet, Sigma } from 'lucide-react';
import App from './App';
import NumericalBenchSuite from './NumericalBenchSuite';
import MagnetBenchSuite from './MagnetBenchSuite';
import './styles.css';
import './visual-system.css';

type Workspace = 'studio' | 'numerical' | 'magnet';

const WORKSPACES: Array<{
  id: Workspace;
  label: string;
  subtitle: string;
  icon: typeof CircuitBoard;
}> = [
  { id: 'studio', label: 'Studio', subtitle: 'hardware + data', icon: CircuitBoard },
  { id: 'numerical', label: 'Numerical', subtitle: 'bench 01–03', icon: Sigma },
  { id: 'magnet', label: 'Magnet', subtitle: 'bench 01–03', icon: Magnet },
];

function Root() {
  const [workspace, setWorkspace] = useState<Workspace>('studio');

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

      <div className="bb-local-state"><i/><span>Local hardware</span></div>
    </header>

    <div className="bb-workspace-frame">
      {workspace === 'studio' && <App />}
      {workspace === 'numerical' && <NumericalBenchSuite />}
      {workspace === 'magnet' && <MagnetBenchSuite />}
    </div>
  </div>;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
