import './phase6-interaction.css';

export type EngineeringStatus = 'READY' | 'ACTIVE' | 'WARNING' | 'BLOCKED' | 'UNAVAILABLE';

export type EngineeringStatusNode = {
  id: 'toolchain' | 'hardware' | 'firmware' | 'acquisition' | 'evidence' | 'analysis';
  label: 'Toolchain' | 'Hardware' | 'Firmware' | 'Acquisition' | 'Evidence' | 'Analysis';
  status: EngineeringStatus;
  detail: string;
};

export default function EngineeringStatusMap({ nodes, onNavigate }: { nodes: EngineeringStatusNode[]; onNavigate: (node: EngineeringStatusNode) => void }) {
  return <section className="engineering-status-map" aria-label="Engineering workflow status" data-capability-anchor="engineering-status-map">
    <div className="engineering-status-title"><b>Engineering status</b><small>Click a stage to open its working surface. Status describes workflow readiness, not scientific validity.</small></div>
    <div className="engineering-status-flow">
      {nodes.map((node, index) => <div className="engineering-status-stage-wrap" key={node.id}>
        <button type="button" className={`engineering-status-stage status-${node.status.toLowerCase()}`} onClick={() => onNavigate(node)} title={node.detail}>
          <span className="engineering-status-index">{index + 1}</span>
          <span><b>{node.label}</b><small>{node.status}</small><em>{node.detail}</em></span>
        </button>
        {index < nodes.length - 1 && <span className="engineering-status-arrow" aria-hidden="true">→</span>}
      </div>)}
    </div>
  </section>;
}
