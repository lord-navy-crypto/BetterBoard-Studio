import { ArrowRight, CircleAlert, CircleCheckBig, LoaderCircle } from 'lucide-react';
import type { CurrentWorkItem } from './homeSurfaceModel';

type Props = {
  items: CurrentWorkItem[];
  onOpenCapability: (capabilityId: string) => void;
};

function StatusIcon({ status }: { status: CurrentWorkItem['status'] }) {
  if (status === 'active') return <LoaderCircle size={15}/>;
  if (status === 'failed' || status === 'warning') return <CircleAlert size={15}/>;
  return <CircleCheckBig size={15}/>;
}

export default function CurrentWorkSummary({ items, onOpenCapability }: Props) {
  if (!items.length) return null;

  return <section className="current-work-summary" data-capability-anchor="current-work" aria-label="Current engineering work">
    <header className="current-work-head">
      <div><span className="eyebrow">Current work</span><h2>Continue from real runtime context</h2></div>
      <p>Only active, recent, or unresolved engineering context appears here.</p>
    </header>
    <div className="current-work-grid">
      {items.map(item => {
        const content = <>
          <span className={`current-work-state ${item.status}`}><StatusIcon status={item.status}/></span>
          <span className="current-work-copy"><b>{item.label}</b><small>{item.detail}</small></span>
          {item.capabilityId && <ArrowRight size={14}/>} 
        </>;
        return item.capabilityId
          ? <button type="button" className="current-work-item" key={item.id} onClick={() => onOpenCapability(item.capabilityId!)}>{content}</button>
          : <div className="current-work-item static" key={item.id}>{content}</div>;
      })}
    </div>
  </section>;
}
