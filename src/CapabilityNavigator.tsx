import { useMemo, useState } from 'react';
import { ArrowRight, Search, X } from 'lucide-react';
import { CAPABILITIES, type CapabilityGroup } from './capabilityRegistry';
import { useCapabilityNavigation } from './CapabilityNavigationContext';

const GROUPS: Array<CapabilityGroup | 'All'> = ['All', 'Build', 'Measure', 'Analyze', 'Compare', 'Experiment', 'Diagnose', 'Develop', 'System'];

type Props = {
  onClose: () => void;
};

export default function CapabilityNavigator({ onClose }: Props) {
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<CapabilityGroup | 'All'>('All');
  const { openCapability } = useCapabilityNavigation();

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return CAPABILITIES.filter(capability => {
      if (group !== 'All' && capability.group !== group) return false;
      if (!needle) return true;
      const haystack = [
        capability.label,
        capability.description,
        capability.owner,
        capability.group,
        capability.destination.workspace,
        ...capability.keywords,
      ].join(' ').toLowerCase();
      return haystack.includes(needle);
    });
  }, [group, query]);

  const grouped = useMemo(() => {
    const map = new Map<CapabilityGroup, typeof filtered>();
    for (const capability of filtered) {
      map.set(capability.group, [...(map.get(capability.group) ?? []), capability]);
    }
    return [...map.entries()];
  }, [filtered]);

  function open(id: string) {
    openCapability(id);
    onClose();
  }

  return <section className="capability-navigator" aria-label="All BetterBoard tools">
    <header className="capability-navigator-head">
      <div>
        <b>All Tools</b>
        <small>{CAPABILITIES.length} desktop-reachable engineering capabilities</small>
      </div>
      <button type="button" className="ghost mini" onClick={onClose}><X size={14}/> Close</button>
    </header>

    <label className="capability-search">
      <span>Search tools</span>
      <div><Search size={15}/><input autoFocus value={query} onChange={event => setQuery(event.target.value)} placeholder="hardware, FFT, replay, ESP32, upload…" /></div>
    </label>

    <div className="capability-group-filter" aria-label="Capability groups">
      {GROUPS.map(item => <button type="button" key={item} className={group === item ? 'active' : ''} onClick={() => setGroup(item)} aria-pressed={group === item}>{item}</button>)}
    </div>

    <div className="capability-results" aria-live="polite">
      {!filtered.length && <div className="empty compact">No capability matches this search. Clear the search or choose another group.</div>}
      {grouped.map(([groupName, capabilities]) => <section className="capability-result-group" key={groupName}>
        <div className="eyebrow">{groupName} · {capabilities.length}</div>
        <div className="capability-result-grid">
          {capabilities.map(capability => <button type="button" className="capability-result" key={capability.id} onClick={() => open(capability.id)}>
            <span className="capability-result-copy">
              <b>{capability.label}</b>
              <small>{capability.description}</small>
              <em>{capability.destination.workspace} · {capability.owner}</em>
            </span>
            <ArrowRight size={16}/>
          </button>)}
        </div>
      </section>)}
    </div>
  </section>;
}
