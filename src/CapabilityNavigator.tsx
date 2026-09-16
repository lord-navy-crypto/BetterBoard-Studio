import { useMemo, useState } from 'react';
import { ArrowRight, Search, X } from 'lucide-react';
import { CAPABILITIES, type CapabilityGroup } from './capabilityRegistry';
import { CAPABILITY_SHORTCUTS } from './capabilityShortcuts';
import { useCapabilityNavigation } from './CapabilityNavigationContext';

const GROUPS: Array<CapabilityGroup | 'All'> = ['All', 'Build', 'Measure', 'Analyze', 'Compare', 'Experiment', 'Diagnose', 'Develop', 'System'];

type NavigatorItem = {
  id: string;
  label: string;
  group: CapabilityGroup;
  description: string;
  owner: string;
  workspace: string;
  keywords: string[];
  kind: 'capability' | 'shortcut';
};

const NAVIGATOR_ITEMS: NavigatorItem[] = [
  ...CAPABILITIES.map(capability => ({
    id: capability.id,
    label: capability.label,
    group: capability.group,
    description: capability.description,
    owner: capability.owner,
    workspace: capability.destination.workspace,
    keywords: capability.keywords,
    kind: 'capability' as const,
  })),
  ...CAPABILITY_SHORTCUTS.map(shortcut => ({
    id: shortcut.id,
    label: shortcut.label,
    group: shortcut.group,
    description: shortcut.description,
    owner: shortcut.owner,
    workspace: CAPABILITIES.find(capability => capability.id === shortcut.targetCapabilityId)?.destination.workspace ?? 'studio',
    keywords: shortcut.keywords,
    kind: 'shortcut' as const,
  })),
];

type Props = {
  onClose: () => void;
};

export default function CapabilityNavigator({ onClose }: Props) {
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<CapabilityGroup | 'All'>('All');
  const { openCapability } = useCapabilityNavigation();

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return NAVIGATOR_ITEMS.filter(item => {
      if (group !== 'All' && item.group !== group) return false;
      if (!needle) return true;
      const haystack = [
        item.label,
        item.description,
        item.owner,
        item.group,
        item.workspace,
        ...item.keywords,
      ].join(' ').toLowerCase();
      return haystack.includes(needle);
    });
  }, [group, query]);

  const grouped = useMemo(() => {
    const map = new Map<CapabilityGroup, typeof filtered>();
    for (const item of filtered) {
      map.set(item.group, [...(map.get(item.group) ?? []), item]);
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
        <small>{CAPABILITIES.length} canonical capabilities · {CAPABILITY_SHORTCUTS.length} direct sub-tool shortcuts</small>
      </div>
      <button type="button" className="ghost mini" onClick={onClose}><X size={14}/> Close</button>
    </header>

    <label className="capability-search">
      <span>Search tools</span>
      <div><Search size={15}/><input autoFocus value={query} onChange={event => setQuery(event.target.value)} placeholder="hardware, FFT, runtime log, serial TX, ESP32, upload…" /></div>
    </label>

    <div className="capability-group-filter" aria-label="Capability groups">
      {GROUPS.map(item => <button type="button" key={item} className={group === item ? 'active' : ''} onClick={() => setGroup(item)} aria-pressed={group === item}>{item}</button>)}
    </div>

    <div className="capability-results" aria-live="polite">
      {!filtered.length && <div className="empty compact">No capability matches this search. Clear the search or choose another group.</div>}
      {grouped.map(([groupName, items]) => <section className="capability-result-group" key={groupName}>
        <div className="eyebrow">{groupName} · {items.length}</div>
        <div className="capability-result-grid">
          {items.map(item => <button type="button" className="capability-result" key={item.id} onClick={() => open(item.id)}>
            <span className="capability-result-copy">
              <b>{item.label}</b>
              <small>{item.description}</small>
              <em>{item.workspace} · {item.owner}{item.kind === 'shortcut' ? ' · direct shortcut' : ''}</em>
            </span>
            <ArrowRight size={16}/>
          </button>)}
        </div>
      </section>)}
    </div>
  </section>;
}
