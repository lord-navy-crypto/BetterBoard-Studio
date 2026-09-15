import type { BoardPort, BoardProfile, HardwareDiagnosis } from './HardwareSession';

export type HardwareTopologyProps = {
  toolchainReady: boolean;
  selectedPort: string;
  activePort?: BoardPort;
  selectedFqbn: string;
  profiles: BoardProfile[];
  diagnosis: HardwareDiagnosis;
  requiredLibraries?: string[] | null;
  missingLibraries?: string[] | null;
  firmwareLabel?: string | null;
  firmwareReady?: boolean;
};

type TopologyState = 'ready' | 'warning' | 'blocked' | 'unavailable';

type TopologyNode = { label: string; value: string; state: TopologyState; detail: string };

export default function HardwareTopology(props: HardwareTopologyProps) {
  const profile = props.profiles.find(item => item.fqbn === props.selectedFqbn);
  const detectedBoard = props.activePort?.board_name || (props.activePort?.fqbn ? 'Arduino CLI identified board' : 'unknown board');
  const detectedMatches = !props.activePort?.fqbn || props.activePort.fqbn === props.selectedFqbn;
  const librariesKnown = Array.isArray(props.requiredLibraries);
  const missingLibraries = props.missingLibraries ?? [];

  const nodes: TopologyNode[] = [
    {
      label: 'USB device',
      value: props.selectedPort || 'none',
      state: props.selectedPort ? 'ready' : 'unavailable',
      detail: props.selectedPort ? 'Physical serial transport selected.' : 'No usable board port selected.',
    },
    {
      label: 'detected board',
      value: detectedBoard,
      state: !props.selectedPort ? 'unavailable' : props.activePort?.fqbn ? 'ready' : 'warning',
      detail: props.activePort?.fqbn ? props.activePort.fqbn : 'Exact physical board identity is not established; BetterBoard will not infer it.',
    },
    {
      label: 'selected FQBN',
      value: props.selectedFqbn,
      state: !props.toolchainReady ? 'blocked' : detectedMatches ? 'ready' : 'blocked',
      detail: detectedMatches ? 'Selected Arduino target is compatible with available hardware evidence.' : `Detected ${props.activePort?.fqbn}; selected ${props.selectedFqbn}.`,
    },
    {
      label: 'Arduino core',
      value: profile?.core ?? 'unknown core',
      state: !props.toolchainReady ? 'blocked' : profile ? 'ready' : 'warning',
      detail: profile ? `Target profile declares core ${profile.core}.` : 'The selected FQBN is not represented in the loaded board profile catalog.',
    },
    {
      label: 'required libraries',
      value: librariesKnown ? (props.requiredLibraries?.length ? props.requiredLibraries.join(', ') : 'none') : 'run recipe preflight',
      state: !librariesKnown ? 'unavailable' : missingLibraries.length ? 'blocked' : 'ready',
      detail: !librariesKnown ? 'Library requirements are recipe-specific and become authoritative after Studio preflight.' : missingLibraries.length ? `Missing: ${missingLibraries.join(', ')}` : 'All declared recipe libraries are available.',
    },
    {
      label: 'firmware',
      value: props.firmwareLabel || 'no verified firmware state',
      state: props.firmwareReady ? 'ready' : props.diagnosis.canCompile ? 'warning' : 'blocked',
      detail: props.firmwareReady ? 'A compile/upload task completed successfully.' : props.diagnosis.canCompile ? 'Hardware is compile-capable; verify or upload firmware in Studio.' : props.diagnosis.action,
    },
  ];

  return <section className="hardware-topology panel" aria-label="Hardware topology">
    <div className="panel-title">Hardware topology</div>
    <div className="hint">USB device → detected board → selected FQBN → Arduino core → required libraries → firmware. Unknown physical identity remains unknown.</div>
    <div className="hardware-topology-flow">
      {nodes.map((node, index) => <div className="hardware-topology-node-wrap" key={node.label}>
        <div className={`hardware-topology-node topology-${node.state}`} title={node.detail}>
          <small>{node.label}</small><b>{node.value}</b><span>{node.state.toUpperCase()}</span>
        </div>
        {index < nodes.length - 1 && <div className={`hardware-topology-edge topology-${nodes[index + 1].state}`} aria-hidden="true">→</div>}
      </div>)}
    </div>
  </section>;
}
