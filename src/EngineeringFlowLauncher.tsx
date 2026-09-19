import { ArrowRight } from 'lucide-react';
import { CAPABILITIES } from './capabilityRegistry';
import { ENGINEERING_FLOW } from './homeSurfaceModel';

type Props = {
  onOpenCapability: (capabilityId: string) => void;
};

const CAPABILITY_BY_ID = new Map(CAPABILITIES.map(capability => [capability.id, capability]));

export default function EngineeringFlowLauncher({ onOpenCapability }: Props) {
  return <section className="engineering-flow-launcher" data-capability-anchor="engineering-flow" aria-label="Engineering workflow launcher">
    <header className="engineering-flow-head">
      <div>
        <span className="eyebrow">Engineering flow</span>
        <h2>Build → Measure → Analyze → Experiment</h2>
      </div>
      <p>Start from the task you are trying to complete. Each entry opens the existing canonical BetterBoard workbench rather than creating a second execution path.</p>
    </header>

    <div className="engineering-flow-grid">
      {ENGINEERING_FLOW.map((lane, index) => <section className="engineering-flow-lane" key={lane.id}>
        <div className="engineering-flow-lane-head">
          <span className="engineering-flow-step">{String(index + 1).padStart(2, '0')}</span>
          <div><b>{lane.label}</b><small>{lane.description}</small></div>
        </div>
        <div className="engineering-flow-actions">
          {lane.capabilities.map(capabilityId => {
            const capability = CAPABILITY_BY_ID.get(capabilityId);
            if (!capability) return null;
            return <button type="button" key={capability.id} onClick={() => onOpenCapability(capability.id)}>
              <span><b>{capability.label}</b><small>{capability.description}</small></span>
              <ArrowRight size={14}/>
            </button>;
          })}
        </div>
      </section>)}
    </div>
  </section>;
}
