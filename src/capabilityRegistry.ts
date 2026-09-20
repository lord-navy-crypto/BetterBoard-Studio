export type WorkspaceId = 'studio' | 'observatory' | 'experiments';
export type StudioTabId = 'hardware' | 'circuit' | 'library' | 'data' | 'developer';
export type AnalysisViewId = 'evidence' | 'statistics' | 'models' | 'design' | 'numerical' | 'preparation';

export type CapabilityGroup = 'Build' | 'Measure' | 'Analyze' | 'Compare' | 'Experiment' | 'Diagnose' | 'Develop' | 'System';

export type CapabilityDestination =
  | { workspace: WorkspaceId; kind: 'workspace'; anchor?: string }
  | { workspace: 'studio'; kind: 'studio-tab'; tab: StudioTabId; anchor?: string }
  | { workspace: 'studio'; kind: 'analysis-view'; view: AnalysisViewId; anchor?: string }
  | { workspace: 'observatory'; kind: 'observatory-section'; anchor: string }
  | { workspace: 'experiments'; kind: 'experiments-section'; anchor: string };

export type Capability = {
  id: string;
  label: string;
  group: CapabilityGroup;
  description: string;
  destination: CapabilityDestination;
  owner: string;
  keywords: string[];
};

export const CAPABILITIES: Capability[] = [
  {
    id: 'hardware-session', label: 'Hardware Session', group: 'Build',
    description: 'Select the serial device and board profile shared across BetterBoard.',
    destination: { workspace: 'studio', kind: 'studio-tab', tab: 'hardware', anchor: 'hardware-session' },
    owner: 'App', keywords: ['board', 'port', 'usb', 'fqbn', 'profile'],
  },
  {
    id: 'hardware-doctor', label: 'Hardware Doctor', group: 'Diagnose',
    description: 'Inspect board detection, profile mismatch, readiness, and recovery actions.',
    destination: { workspace: 'studio', kind: 'studio-tab', tab: 'hardware', anchor: 'hardware-doctor' },
    owner: 'App', keywords: ['diagnosis', 'repair', 'board', 'profile', 'scan'],
  },
  {
    id: 'recipe-preflight', label: 'Recipe Preflight', group: 'Diagnose',
    description: 'Check Arduino core and required libraries before programming.',
    destination: { workspace: 'studio', kind: 'studio-tab', tab: 'hardware', anchor: 'recipe-preflight' },
    owner: 'App', keywords: ['core', 'library', 'dependencies', 'preflight'],
  },
  {
    id: 'program-firmware', label: 'Program Firmware', group: 'Build',
    description: 'Prepare, compile, and upload the selected canonical firmware.',
    destination: { workspace: 'studio', kind: 'studio-tab', tab: 'hardware', anchor: 'program-firmware' },
    owner: 'App', keywords: ['prepare', 'compile', 'upload', 'firmware', 'arduino'],
  },
  {
    id: 'recipe-library', label: 'Recipe Library', group: 'Build',
    description: 'Browse canonical recipes and saved parameterized presets.',
    destination: { workspace: 'studio', kind: 'studio-tab', tab: 'library', anchor: 'recipe-library' },
    owner: 'App', keywords: ['recipe', 'preset', 'library', 'firmware', 'my library'],
  },
  {
    id: 'circuit-lab', label: 'Circuit Lab', group: 'Build',
    description: 'Build and inspect the persisted visual wiring design.',
    destination: { workspace: 'studio', kind: 'studio-tab', tab: 'circuit', anchor: 'circuit-lab' },
    owner: 'CircuitLab', keywords: ['circuit', 'wire', 'component', 'pin', 'design'],
  },
  {
    id: 'circuit-diagnostics', label: 'Circuit Diagnostics', group: 'Diagnose',
    description: 'Run the canonical rule checker and project issues onto nets, pins, wires, and components.',
    destination: { workspace: 'studio', kind: 'studio-tab', tab: 'circuit', anchor: 'circuit-diagnostics' },
    owner: 'CircuitLab', keywords: ['rule checker', 'diagnostic', 'net', 'problem', 'wire'],
  },
  {
    id: 'monitor-live', label: 'Live Serial Monitor', group: 'Measure',
    description: 'Start and inspect live serial acquisition from the selected board.',
    destination: { workspace: 'studio', kind: 'studio-tab', tab: 'data', anchor: 'monitor-live' },
    owner: 'MonitorDataStudio', keywords: ['serial', 'live', 'acquisition', 'monitor', 'stream'],
  },
  {
    id: 'monitor-snapshot', label: 'Snapshot Capture', group: 'Measure',
    description: 'Capture a bounded measurement snapshot without changing the canonical serial stack.',
    destination: { workspace: 'studio', kind: 'studio-tab', tab: 'data', anchor: 'monitor-snapshot' },
    owner: 'MonitorDataStudio', keywords: ['snapshot', 'capture', 'measurement', '3 s'],
  },
  {
    id: 'measurement-evidence', label: 'Record Evidence', group: 'Measure',
    description: 'Save traceable measurement evidence and provenance from captured data.',
    destination: { workspace: 'studio', kind: 'studio-tab', tab: 'data', anchor: 'measurement-evidence' },
    owner: 'MonitorDataStudio', keywords: ['record', 'evidence', 'save', 'provenance', 'csv'],
  },
  {
    id: 'measurement-replay', label: 'Measurement Replay', group: 'Measure',
    description: 'Load and inspect historical BetterBoard measurement sessions.',
    destination: { workspace: 'studio', kind: 'studio-tab', tab: 'data', anchor: 'measurement-replay' },
    owner: 'MonitorDataStudio', keywords: ['replay', 'history', 'session', 'measurement'],
  },
  {
    id: 'primitive-observatory', label: 'Primitive Observatory', group: 'Analyze',
    description: 'Inspect host-derived and device-derived primitive diagnostics without rewriting evidence.',
    destination: { workspace: 'studio', kind: 'studio-tab', tab: 'data', anchor: 'primitive-observatory' },
    owner: 'PrimitiveObservatory', keywords: ['primitive', 'host derived', 'device derived', 'rms', 'ema', 'threshold'],
  },
  {
    id: 'analysis-evidence', label: 'Evidence Inspector', group: 'Analyze',
    description: 'Inspect the selected analysis source, provenance, schema, and channels.',
    destination: { workspace: 'studio', kind: 'analysis-view', view: 'evidence', anchor: 'analysis-evidence' },
    owner: 'EvidenceInspector', keywords: ['evidence', 'source', 'schema', 'provenance'],
  },
  {
    id: 'analysis-run-compare', label: 'Run A ↔ Run B', group: 'Compare',
    description: 'Compare two saved evidence runs without merging or rewriting either run.',
    destination: { workspace: 'studio', kind: 'analysis-view', view: 'evidence', anchor: 'analysis-run-compare' },
    owner: 'AnalysisVisualizationHub', keywords: ['run a', 'run b', 'compare', 'overlay'],
  },
  {
    id: 'analysis-annotations', label: 'User Annotations', group: 'Analyze',
    description: 'Add session-local USER ANNOTATION markers to inspectable engineering plots.',
    destination: { workspace: 'studio', kind: 'analysis-view', view: 'evidence', anchor: 'analysis-annotations' },
    owner: 'AnnotatedEngineeringPlot', keywords: ['annotation', 'note', 'marker', 'user annotation'],
  },
  {
    id: 'analysis-statistics', label: 'Signal & Statistics', group: 'Analyze',
    description: 'Inspect statistics, autocorrelation, spectrum, EWMA, CUSUM, change points, and residuals.',
    destination: { workspace: 'studio', kind: 'analysis-view', view: 'statistics', anchor: 'analysis-statistics' },
    owner: 'AppliedStatisticsWorkbench', keywords: ['statistics', 'fft', 'spectrum', 'ewma', 'cusum', 'change point'],
  },
  {
    id: 'analysis-models', label: 'Model Fitting', group: 'Compare',
    description: 'Fit and compare measured evidence against supported models and residual structure.',
    destination: { workspace: 'studio', kind: 'analysis-view', view: 'models', anchor: 'analysis-models' },
    owner: 'ModelFittingWorkbench', keywords: ['model', 'fit', 'residual', 'linear', 'quadratic'],
  },
  {
    id: 'analysis-experiment-design', label: 'Experiment Planning', group: 'Experiment',
    description: 'Inspect coverage, information, replication, and sequential experiment recommendations.',
    destination: { workspace: 'studio', kind: 'analysis-view', view: 'design', anchor: 'analysis-experiment-design' },
    owner: 'ExperimentPlanningWorkbench', keywords: ['doe', 'experiment design', 'coverage', 'replication', 'planning'],
  },
  {
    id: 'analysis-numerical', label: 'Numerical Reliability', group: 'Analyze',
    description: 'Inspect error, convergence, precision, timing, cancellation, and numerical reliability.',
    destination: { workspace: 'studio', kind: 'analysis-view', view: 'numerical', anchor: 'analysis-numerical' },
    owner: 'NumericalErrorVisualWorkbench', keywords: ['numerical', 'error', 'precision', 'convergence', 'cancellation'],
  },
  {
    id: 'analysis-preparation', label: 'Engineering Preparation', group: 'Analyze',
    description: 'Prepare saved evidence for numerical or magnetic engineering workflows and handoff.',
    destination: { workspace: 'studio', kind: 'analysis-view', view: 'preparation', anchor: 'analysis-preparation' },
    owner: 'EngineeringPreparationStudio', keywords: ['preparation', 'handoff', 'numerical evidence', 'magnetic evidence'],
  },
  {
    id: 'numerical-advanced', label: 'Advanced Numerical Tools', group: 'Analyze',
    description: 'Open exact numerical analyzers, campaign validation paths, and expert controls.',
    destination: { workspace: 'studio', kind: 'analysis-view', view: 'preparation', anchor: 'numerical-advanced' },
    owner: 'EngineeringPreparationStudio', keywords: ['advanced numerical', 'analyzer', 'campaign', 'exact controls'],
  },
  {
    id: 'magnet-advanced', label: 'Advanced Magnetic Tools', group: 'Analyze',
    description: 'Open advanced field characterization, residual, and model-validation controls.',
    destination: { workspace: 'studio', kind: 'analysis-view', view: 'preparation', anchor: 'magnet-advanced' },
    owner: 'EngineeringPreparationStudio', keywords: ['magnet', 'field', 'residual', 'radia', 'characterization'],
  },
  {
    id: 'engineering-handoff', label: 'Engineering Lab Handoff', group: 'Experiment',
    description: 'Package immutable evidence with traceable research context for Engineering Lab workflows.',
    destination: { workspace: 'studio', kind: 'analysis-view', view: 'preparation', anchor: 'engineering-handoff' },
    owner: 'EngineeringPreparationStudio', keywords: ['handoff', 'research bridge', 'evidence', 'engineering lab'],
  },
  {
    id: 'research-context', label: 'Research Context', group: 'Experiment',
    description: 'Record research questions, hypotheses, notebook entries, annotations, and lab journey context.',
    destination: { workspace: 'studio', kind: 'analysis-view', view: 'preparation', anchor: 'research-context' },
    owner: 'EngineeringPreparationStudio', keywords: ['notebook', 'hypothesis', 'research question', 'lab journey'],
  },
  {
    id: 'developer-editor', label: 'Developer Editor', group: 'Develop',
    description: 'Edit Arduino source in the integrated Monaco-based developer workspace.',
    destination: { workspace: 'studio', kind: 'studio-tab', tab: 'developer', anchor: 'developer-editor' },
    owner: 'DeveloperIDE', keywords: ['editor', 'code', 'monaco', 'arduino', 'source'],
  },
  {
    id: 'developer-verify-upload', label: 'Developer Verify & Upload', group: 'Develop',
    description: 'Verify and upload the active developer sketch through canonical BetterBoard backends.',
    destination: { workspace: 'studio', kind: 'studio-tab', tab: 'developer', anchor: 'developer-verify-upload' },
    owner: 'DeveloperIDE', keywords: ['verify', 'upload', 'compile', 'developer'],
  },
  {
    id: 'developer-ecosystem', label: 'Boards & Libraries', group: 'Develop',
    description: 'Inspect and manage Arduino board cores, libraries, URLs, and examples.',
    destination: { workspace: 'studio', kind: 'studio-tab', tab: 'developer', anchor: 'developer-ecosystem' },
    owner: 'ArduinoEcosystemManager', keywords: ['boards', 'libraries', 'core', 'examples', 'arduino cli'],
  },
  {
    id: 'developer-sketchbook', label: 'Sketchbook & Projects', group: 'Develop',
    description: 'Browse and maintain BetterBoard developer projects and Arduino sketchbook files.',
    destination: { workspace: 'studio', kind: 'studio-tab', tab: 'developer', anchor: 'developer-sketchbook' },
    owner: 'SketchbookExplorer', keywords: ['sketchbook', 'project', 'file', 'developer'],
  },
  {
    id: 'developer-diagnostics', label: 'Developer Diagnostics', group: 'Diagnose',
    description: 'Inspect attributed compile diagnostics and jump to source locations.',
    destination: { workspace: 'studio', kind: 'studio-tab', tab: 'developer', anchor: 'developer-diagnostics' },
    owner: 'DeveloperIDE', keywords: ['diagnostic', 'error', 'warning', 'compile', 'line'],
  },
  {
    id: 'experiments-campaigns', label: 'Experiment Library', group: 'Experiment',
    description: 'Browse Engineering Lab research campaigns and their scientific purposes.',
    destination: { workspace: 'experiments', kind: 'experiments-section', anchor: 'experiments-campaigns' },
    owner: 'ExperimentsHub', keywords: ['campaign', 'engineering lab', 'experiment'],
  },
  {
    id: 'experiment-code-library', label: 'Experiment Library · Programs', group: 'Experiment',
    description: 'Browse real repository-discovered firmware and host tools, then verify or upload supported firmware.',
    destination: { workspace: 'experiments', kind: 'experiments-section', anchor: 'experiment-code-library' },
    owner: 'EngineeringExperimentLibrary', keywords: ['firmware', 'source', 'python', 'verify', 'upload', 'code library'],
  },
  {
    id: 'numeric-error-depth', label: 'Numeric Error Depth', group: 'Experiment',
    description: 'Open the embedded numerical reliability campaign family and its real implementation assets.',
    destination: { workspace: 'experiments', kind: 'experiments-section', anchor: 'numeric-error-depth' },
    owner: 'ExperimentsHub', keywords: ['numeric error', 'precision', 'sampling', 'quantization', 'campaign'],
  },
  {
    id: 'esp32-capabilities', label: 'ESP32 Research Capabilities', group: 'Experiment',
    description: 'Inspect ESP32 target/readiness/security/research capability surfaces.',
    destination: { workspace: 'experiments', kind: 'experiments-section', anchor: 'esp32-capabilities' },
    owner: 'EspressifCapabilityPanel', keywords: ['esp32', 's3', 'espressif', 'security', 'target'],
  },
  {
    id: 'observatory-mission', label: 'Observatory Mission Control', group: 'System',
    description: 'Inspect current operational mission state and engineering workflow context.',
    destination: { workspace: 'observatory', kind: 'observatory-section', anchor: 'observatory-mission' },
    owner: 'ObservatoryMissionControl', keywords: ['mission', 'observatory', 'runtime', 'state'],
  },
  {
    id: 'observatory-system', label: 'System Observatory', group: 'System',
    description: 'Inspect whole-system runtime, evidence, inventories, background work, and scientific boundaries.',
    destination: { workspace: 'observatory', kind: 'observatory-section', anchor: 'observatory-system' },
    owner: 'Observatory', keywords: ['system', 'observatory', 'runtime', 'inventory', 'evidence'],
  },
  {
    id: 'hardware-topology', label: 'Hardware Topology', group: 'System',
    description: 'Inspect toolchain-to-board-to-firmware topology and current readiness facts.',
    destination: { workspace: 'studio', kind: 'workspace', anchor: 'hardware-topology' },
    owner: 'HardwareTopology', keywords: ['topology', 'hardware', 'toolchain', 'firmware'],
  },
  {
    id: 'task-center', label: 'Task Center', group: 'System',
    description: 'Inspect running, failed, recent, and historical tasks with logs and cancellation.',
    destination: { workspace: 'studio', kind: 'workspace', anchor: 'task-center' },
    owner: 'TaskCenter', keywords: ['tasks', 'logs', 'background', 'cancel', 'history'],
  },
  {
    id: 'openguin', label: 'OpenPenguin Local AI', group: 'System',
    description: 'Open the local OpenPenguin bridge with current BetterBoard engineering context.',
    destination: { workspace: 'studio', kind: 'workspace', anchor: 'openguin' },
    owner: 'Root', keywords: ['ai', 'local', 'openguin', 'model'],
  },
  {
    id: 'focus-mode', label: 'Focus Mode', group: 'System',
    description: 'Enter or exit the reduced-distraction experiment/presentation workspace mode.',
    destination: { workspace: 'studio', kind: 'workspace', anchor: 'focus-mode' },
    owner: 'Root', keywords: ['focus', 'presentation', 'experiment', 'distraction'],
  },
];

export const CAPABILITY_BY_ID = new Map(CAPABILITIES.map(capability => [capability.id, capability]));

if (CAPABILITY_BY_ID.size !== CAPABILITIES.length) {
  throw new Error('Duplicate capability id in CAPABILITIES');
}
