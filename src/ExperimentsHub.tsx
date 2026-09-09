import { useState } from 'react';
import { Magnet, Sigma } from 'lucide-react';
import NumericalBenchSuiteV2 from './NumericalBenchSuiteV2';
import MagnetBenchSuiteV2 from './MagnetBenchSuiteV2';

type Domain = 'numerical' | 'magnet';

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
];

export default function ExperimentsHub() {
  const [domain, setDomain] = useState<Domain>('numerical');

  return <div className="experiments-hub">
    <section style={{ maxWidth: 1420, margin: '0 auto', padding: '22px 34px 0' }}>
      <div className="panel" style={{ padding: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 14, alignItems: 'center' }}>
          <div>
            <div className="eyebrow">Experiment Library</div>
            <b style={{ display: 'block', marginTop: 4 }}>Choose a domain</b>
            <small className="muted">One experiment area; domain-specific benches live inside it instead of becoming separate mini IDEs.</small>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8 }}>
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

    {domain === 'numerical' ? <NumericalBenchSuiteV2 /> : <MagnetBenchSuiteV2 />}
  </div>;
}