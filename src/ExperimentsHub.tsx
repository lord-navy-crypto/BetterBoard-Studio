import { useEffect, useState } from 'react';
import { CircuitBoard, Magnet, Settings2, Sigma } from 'lucide-react';
import NumericalBenchSuiteV2 from './NumericalBenchSuiteV2';
import MagnetBenchSuiteV2 from './MagnetBenchSuiteV2';
import NumericalBenchAdvanced from './NumericalBenchAdvanced';
import MagnetBenchAdvanced from './MagnetBenchAdvanced';
import StudioAdvanced from './StudioAdvanced';

type Domain = 'numerical' | 'magnet' | 'advanced';
type AdvancedDomain = 'studio' | 'numerical' | 'magnet';

type Props = {
  initialDomain?: 'numerical' | 'magnet';
};

const DOMAINS = [
  {
    id: 'numerical' as const,
    title: 'Numerical Analysis',
    subtitle: 'sampling · discretization · floating point · embedded reliability',
    icon: Sigma,
  },
  {
    id: 'magnet' as const,
    title: 'Magnetism & Fields',
    subtitle: 'vector acquisition · characterization · model validation',
    icon: Magnet,
  },
  {
    id: 'advanced' as const,
    title: 'Advanced Tools',
    subtitle: 'classic full-control benches · manual analyzers · package workflows',
    icon: Settings2,
  },
];

export default function ExperimentsHub({ initialDomain = 'numerical' }: Props) {
  const [domain, setDomain] = useState<Domain>(initialDomain);
  const [advancedDomain, setAdvancedDomain] = useState<AdvancedDomain>('studio');

  useEffect(() => setDomain(initialDomain), [initialDomain]);

  return <div className="experiments-hub">
    <section style={{ maxWidth: 1420, margin: '0 auto', padding: '22px 34px 0' }}>
      <div className="panel" style={{ padding: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 14, alignItems: 'center' }}>
          <div>
            <div className="eyebrow">Experiment Library</div>
            <b style={{ display: 'block', marginTop: 4 }}>Choose a domain</b>
            <small className="muted">The default labs stay streamlined. Nothing is removed: manual and legacy full-control workflows live under Advanced Tools.</small>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 8 }}>
            {DOMAINS.map(item => {
              const Icon = item.icon;
              const active = item.id === domain;
              return <button
                key={item.id}
                onClick={() => setDomain(item.id)}
                style={{
                  minHeight: 68,
                  padding: '10px 12px',
                  borderRadius: 12,
                  border: active ? '1px solid rgba(112,220,255,.42)' : '1px solid rgba(255,255,255,.08)',
                  background: active ? 'linear-gradient(135deg,rgba(59,123,255,.18),rgba(126,140,255,.11))' : 'rgba(255,255,255,.025)',
                  color: '#edf5ff',
                  display: 'flex',
                  gap: 10,
                  alignItems: 'center',
                  textAlign: 'left',
                }}
              >
                <span style={{ width: 34, height: 34, display: 'grid', placeItems: 'center', borderRadius: 10, background: active ? 'rgba(112,220,255,.16)' : 'rgba(255,255,255,.04)' }}><Icon size={17}/></span>
                <span><b style={{ display: 'block', fontSize: 12 }}>{item.title}</b><small style={{ display: 'block', color: '#8395aa', marginTop: 3 }}>{item.subtitle}</small></span>
              </button>;
            })}
          </div>
        </div>
      </div>
    </section>

    {domain === 'numerical' && <NumericalBenchSuiteV2 />}
    {domain === 'magnet' && <MagnetBenchSuiteV2 />}
    {domain === 'advanced' && <>
      <section style={{ maxWidth: 1420, margin: '14px auto 0', padding: '0 34px' }}>
        <div className="panel" style={{ padding: 14 }}>
          <div className="eyebrow">Full-control compatibility layer</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', marginTop: 6 }}>
            <div>
              <b>Advanced workspaces</b>
              <small className="muted" style={{ display: 'block', marginTop: 3 }}>These preserve the original direct capture controls, standalone Physical Lab Bridge, manual analyzer commands, explicit package paths, repeated-capture workflows, and legacy model-validation inputs.</small>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <button className={advancedDomain === 'studio' ? 'primary' : 'ghost'} onClick={() => setAdvancedDomain('studio')}><CircuitBoard size={15}/> Studio Advanced</button>
              <button className={advancedDomain === 'numerical' ? 'primary' : 'ghost'} onClick={() => setAdvancedDomain('numerical')}><Sigma size={15}/> Numerical Advanced</button>
              <button className={advancedDomain === 'magnet' ? 'primary' : 'ghost'} onClick={() => setAdvancedDomain('magnet')}><Magnet size={15}/> Magnet Advanced</button>
            </div>
          </div>
        </div>
      </section>
      {advancedDomain === 'studio' && <StudioAdvanced />}
      {advancedDomain === 'numerical' && <NumericalBenchAdvanced />}
      {advancedDomain === 'magnet' && <MagnetBenchAdvanced />}
    </>}
  </div>;
}
