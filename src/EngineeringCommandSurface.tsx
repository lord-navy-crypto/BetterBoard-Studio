import { ArrowRight, CircleAlert, Cpu, Radio, Wrench } from 'lucide-react';
import EngineeringStatusMap, { type EngineeringStatusNode } from './EngineeringStatusMap';
import { ENGINEERING_STAGE_CAPABILITY, type CurrentTaskSummary, type HomeAction } from './homeSurfaceModel';

type Props = {
  nodes: EngineeringStatusNode[];
  nextAction: HomeAction;
  recoveryAction?: HomeAction | null;
  boardLabel: string;
  portLabel: string;
  profileLabel: string;
  activeTask: CurrentTaskSummary;
  onOpenCapability: (capabilityId: string) => void;
};

export default function EngineeringCommandSurface({
  nodes,
  nextAction,
  recoveryAction,
  boardLabel,
  portLabel,
  profileLabel,
  activeTask,
  onOpenCapability,
}: Props) {
  const readyCount = nodes.filter(node => node.status === 'READY').length;
  const activeCount = nodes.filter(node => node.status === 'ACTIVE').length;
  const blocked = nodes.find(node => node.status === 'BLOCKED');
  const headline = blocked
    ? `${blocked.label} needs attention`
    : activeCount
      ? 'Engineering workflow active'
      : readyCount === nodes.length
        ? 'System ready for the next experiment'
        : 'Continue the engineering workflow';

  return <section className="engineering-command-surface" data-capability-anchor="engineering-command-surface" aria-label="Engineering command surface">
    <div className="engineering-command-head">
      <div className="engineering-command-title">
        <span className="eyebrow">Engineering command</span>
        <h2>{headline}</h2>
        <p>Read the current state first, then continue with the single next action that follows from runtime evidence.</p>
      </div>
      <div className="engineering-readiness" aria-label={`${readyCount} of ${nodes.length} stages ready`}>
        <b>{readyCount}/{nodes.length}</b>
        <span>stages ready</span>
      </div>
    </div>

    <div className="engineering-command-context" aria-label="Current hardware context">
      <span><Cpu size={14}/><b>{boardLabel}</b><small>{profileLabel}</small></span>
      <span><Radio size={14}/><b>{portLabel}</b><small>active hardware path</small></span>
      {activeTask && <span className={`task-${activeTask.state}`}><CircleAlert size={14}/><b>{activeTask.title}</b><small>{activeTask.detail}</small></span>}
    </div>

    <div className="engineering-decision-row">
      <div className="engineering-decision-copy">
        <span className="eyebrow">Recommended next action</span>
        <b>{nextAction.label}</b>
        <small>{nextAction.detail || 'Open the owning BetterBoard workbench and continue explicitly.'}</small>
      </div>
      <div className="engineering-decision-actions">
        <button type="button" className="primary engineering-primary-action" onClick={() => onOpenCapability(nextAction.capabilityId)}>
          {nextAction.label}<ArrowRight size={15}/>
        </button>
        {recoveryAction && recoveryAction.capabilityId !== nextAction.capabilityId && <button type="button" className="ghost" onClick={() => onOpenCapability(recoveryAction.capabilityId)}>
          <Wrench size={14}/>{recoveryAction.label}
        </button>}
      </div>
    </div>

    <div className="engineering-stage-region">
      <div className="engineering-stage-label"><span className="eyebrow">State progression</span><small>Toolchain → Hardware → Firmware → Acquisition → Evidence → Analysis</small></div>
      <EngineeringStatusMap nodes={nodes} onNavigate={node => onOpenCapability(ENGINEERING_STAGE_CAPABILITY[node.id])}/>
    </div>
  </section>;
}
