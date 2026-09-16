import { ArrowRight, ChevronDown } from 'lucide-react';
import { CAPABILITIES } from './capabilityRegistry';
import { CAPABILITY_SHORTCUTS } from './capabilityShortcuts';
import { ADVANCED_CAPABILITY_GROUPS } from './homeSurfaceModel';
import './advanced-capabilities.css';

type Props = {
  onOpenCapability: (id: string) => void;
};

const SEMANTIC_ITEMS = new Map([
  ...CAPABILITIES.map(item => [item.id, {
    id: item.id,
    label: item.label,
    description: item.description,
    owner: item.owner,
    kind: 'capability' as const,
  }] as const),
  ...CAPABILITY_SHORTCUTS.map(item => [item.id, {
    id: item.id,
    label: item.label,
    description: item.description,
    owner: item.owner,
    kind: 'shortcut' as const,
  }] as const),
]);

export default function AdvancedCapabilityLauncher({ onOpenCapability }: Props) {
  return <section className="advanced-capability-launcher" data-capability-anchor="advanced-capabilities" aria-label="Advanced BetterBoard capabilities">
    <header className="advanced-capability-head">
      <div>
        <div className="eyebrow">DEEPER TOOLS</div>
        <h2>Advanced capabilities</h2>
      </div>
      <p>Expert surfaces stay discoverable without crowding the primary engineering path. Expand only the domain you need.</p>
    </header>

    <div className="advanced-capability-grid">
      {ADVANCED_CAPABILITY_GROUPS.map((group, index) => <details className="advanced-capability-group" key={group.id} open={index < 2}>
        <summary>
          <span>
            <b>{group.label}</b>
            <small>{group.description}</small>
          </span>
          <ChevronDown size={16}/>
        </summary>
        <div className="advanced-capability-actions">
          {group.capabilities.map(capabilityId => {
            const item = SEMANTIC_ITEMS.get(capabilityId);
            if (!item) return null;
            return <button type="button" key={capabilityId} onClick={() => onOpenCapability(capabilityId)}>
              <span>
                <b>{item.label}</b>
                <small>{item.description}</small>
                <em>{item.kind === 'shortcut' ? 'direct shortcut' : item.owner}</em>
              </span>
              <ArrowRight size={15}/>
            </button>;
          })}
        </div>
      </details>)}
    </div>
  </section>;
}
