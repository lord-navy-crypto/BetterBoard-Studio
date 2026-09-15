import { Activity, Gauge, GitCompareArrows, RadioTower, TrendingUp, Waves } from 'lucide-react';

export type PrimitiveHealthState = 'nominal' | 'inspect' | 'active' | 'consistent' | 'disagreement' | 'parameter-mismatch' | 'host-only' | 'unavailable';

export type PrimitiveHealthSummary = {
  timing: PrimitiveHealthState;
  noise: PrimitiveHealthState;
  trend: PrimitiveHealthState;
  change: PrimitiveHealthState;
  decision: PrimitiveHealthState;
  agreement: PrimitiveHealthState;
};

type Props = {
  summary: PrimitiveHealthSummary;
  onSelect?: (section: 'timing' | 'noise' | 'trend' | 'change' | 'decision' | 'agreement') => void;
};

const ITEMS = [
  { id: 'timing' as const, label: 'Timing', icon: RadioTower },
  { id: 'noise' as const, label: 'Noise / RMS', icon: Waves },
  { id: 'trend' as const, label: 'Trend', icon: TrendingUp },
  { id: 'change' as const, label: 'Change', icon: Activity },
  { id: 'decision' as const, label: 'Decision', icon: Gauge },
  { id: 'agreement' as const, label: 'Host ↔ Device', icon: GitCompareArrows },
];

function detail(state: PrimitiveHealthState) {
  if (state === 'nominal') return 'no strong warning in the current derived view';
  if (state === 'inspect') return 'derived diagnostic deserves inspection';
  if (state === 'active') return 'derived decision state is active';
  if (state === 'consistent') return 'aligned host/device results are consistent';
  if (state === 'disagreement') return 'aligned host/device results disagree';
  if (state === 'parameter-mismatch') return 'producer parameters differ';
  if (state === 'host-only') return 'host-derived result only';
  return 'insufficient derived evidence';
}

export default function SignalHealthRail({ summary, onSelect }: Props) {
  return <section className="signal-health-rail" aria-label="Signal Health">
    {ITEMS.map(item => {
      const Icon = item.icon;
      const state = summary[item.id];
      return <button key={item.id} type="button" className={`signal-health-item ${state}`} onClick={() => onSelect?.(item.id)} disabled={!onSelect}>
        <Icon size={15}/>
        <span><b>{item.label}</b><small>{state}</small></span>
        <em>{detail(state)}</em>
      </button>;
    })}
    <div className="signal-health-boundary">Signal Health summarizes existing HOST-DERIVED / DEVICE-DERIVED diagnostics. “Inspect” is not a hardware-failure claim.</div>
  </section>;
}
