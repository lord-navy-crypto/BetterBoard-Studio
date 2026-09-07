import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import NumericalBenchSuite from './NumericalBenchSuite';
import MagnetBenchSuite from './MagnetBenchSuite';
import './styles.css';

function Root() {
  const [workspace, setWorkspace] = useState<'studio' | 'numerical' | 'magnet'>('studio');

  return <div style={{ minHeight: '100vh', background: '#0b0f13' }}>
    <div style={{
      minHeight: 44,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      flexWrap: 'wrap',
      padding: '6px 10px',
      background: '#0d1217',
      borderBottom: '1px solid #242a31',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      <button
        className={workspace === 'studio' ? 'primary' : 'ghost'}
        style={{ padding: '7px 12px' }}
        onClick={() => setWorkspace('studio')}
      >
        BetterBoard Studio
      </button>
      <button
        className={workspace === 'numerical' ? 'primary' : 'ghost'}
        style={{ padding: '7px 12px' }}
        onClick={() => setWorkspace('numerical')}
      >
        Numerical Bench 01–03
      </button>
      <button
        className={workspace === 'magnet' ? 'primary' : 'ghost'}
        style={{ padding: '7px 12px' }}
        onClick={() => setWorkspace('magnet')}
      >
        Magnet Bench 01–03
      </button>
    </div>
    {workspace === 'studio' && <App />}
    {workspace === 'numerical' && <NumericalBenchSuite />}
    {workspace === 'magnet' && <MagnetBenchSuite />}
  </div>;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
