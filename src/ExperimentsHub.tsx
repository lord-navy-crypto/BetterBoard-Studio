import { useEffect, useState } from 'react';
import { CircuitBoard, Magnet, Settings2, Sigma } from 'lucide-react';
import NumericalBenchSuiteV2 from './NumericalBenchSuiteV2';
import MagnetBenchSuiteV2 from './MagnetBenchSuiteV2';
import NumericalBenchAdvanced from './NumericalBenchAdvanced';
import MagnetBenchAdvanced from './MagnetBenchAdvanced';
import StudioAdvanced from './StudioAdvanced';

type Domain = 'numerical' | 'magnet';
type ExpertDomain = 'studio' | 'numerical' | 'magnet';
type Props = { initialDomain?: Domain };

const DOMAINS = [
  { id: 'numerical' as const, title: 'Numerical Analysis', subtitle: 'sampling · discretization · floating point · embedded reliability', icon: Sigma },
  { id: 'magnet' as const, title: 'Magnetism & Fields', subtitle: 'vector acquisition · characterization · model validation', icon: Magnet },
];

export default function ExperimentsHub({ initialDomain = 'numerical' }: Props) {
  const [domain, setDomain] = useState<Domain>(initialDomain);
  const [expertDomain, setExpertDomain] = useState<ExpertDomain>('numerical');
  useEffect(() => setDomain(initialDomain), [initialDomain]);

  return <div className="experiments-hub">
    <section style={{ maxWidth: 1420, margin: '0 auto', padding: '22px 34px 0' }}>
      <div className="panel" style={{ padding: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 14, alignItems: 'center' }}>
          <div><div className="eyebrow">Experiment Library</div><b style={{ display: 'block', marginTop: 4 }}>Choose a domain</b><small className="muted">Essential expert controls now live in the default labs. Legacy full-control surfaces remain folded below as a compatibility escape hatch.</small></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8 }}>
            {DOMAINS.map(item => { const Icon = item.icon; const active = item.id === domain; return <button key={item.id} onClick={() => setDomain(item.id)} style={{ minHeight: 68, padding: '10px 12px', borderRadius: 12, border: active ? '1px solid rgba(112,220,255,.42)' : '1px solid rgba(255,255,255,.08)', background: active ? 'linear-gradient(135deg,rgba(59,123,255,.18),rgba(126,140,255,.11))' : 'rgba(255,255,255,.025)', color: '#edf5ff', display: 'flex', gap: 10, alignItems: 'center', textAlign: 'left' }}><span style={{ width: 34, height: 34, display: 'grid', placeItems: 'center', borderRadius: 10, background: active ? 'rgba(112,220,255,.16)' : 'rgba(255,255,255,.04)' }}><Icon size={17}/></span><span><b style={{ display: 'block', fontSize: 12 }}>{item.title}</b><small style={{ display: 'block', color: '#8395aa', marginTop: 3 }}>{item.subtitle}</small></span></button>; })}
          </div>
        </div>
      </div>
    </section>

    <div className="experiment-persistent-pane" hidden={domain !== 'numerical'}><NumericalBenchSuiteV2 /></div>
    <div className="experiment-persistent-pane" hidden={domain !== 'magnet'}><MagnetBenchSuiteV2 /></div>

    <section style={{ maxWidth: 1420, margin: '14px auto 50px', padding: '0 34px' }}>
      <details className="panel">
        <summary style={{ cursor: 'pointer', display: 'flex', gap: 8, alignItems: 'center' }}><Settings2 size={16}/><b>Expert workflows</b><small className="muted">manual analyzers · exact package paths · classic direct controls</small></summary>
        <p className="muted">This is no longer a third experiment domain. It remains available while useful controls are absorbed into Numerical and Magnet V2.</p>
        <div className="action-row"><button className={expertDomain === 'studio' ? 'primary' : 'ghost'} onClick={() => setExpertDomain('studio')}><CircuitBoard size={15}/> Studio expert</button><button className={expertDomain === 'numerical' ? 'primary' : 'ghost'} onClick={() => setExpertDomain('numerical')}><Sigma size={15}/> Numerical expert</button><button className={expertDomain === 'magnet' ? 'primary' : 'ghost'} onClick={() => setExpertDomain('magnet')}><Magnet size={15}/> Magnet expert</button></div>
        <div hidden={expertDomain !== 'studio'}><StudioAdvanced /></div>
        <div hidden={expertDomain !== 'numerical'}><NumericalBenchAdvanced /></div>
        <div hidden={expertDomain !== 'magnet'}><MagnetBenchAdvanced /></div>
      </details>
    </section>
  </div>;
}
