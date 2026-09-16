import type { CapabilityGroup } from './capabilityRegistry';

export type CapabilityShortcut = {
  id: string;
  label: string;
  group: CapabilityGroup;
  description: string;
  targetCapabilityId: string;
  anchor: string;
  owner: string;
  keywords: string[];
};

// Direct shortcuts expose meaningful sub-tools that already belong to a canonical capability.
// They never own a second backend or duplicate the canonical execution path.
export const CAPABILITY_SHORTCUTS: CapabilityShortcut[] = [
  {
    id: 'engineering-status-map', label: 'Engineering Status Map', group: 'System',
    description: 'Inspect Toolchain → Hardware → Firmware → Acquisition → Evidence → Analysis readiness and open each owning surface.',
    targetCapabilityId: 'hardware-topology', anchor: 'engineering-status-map', owner: 'EngineeringStatusMap',
    keywords: ['status', 'workflow', 'readiness', 'toolchain', 'hardware', 'firmware', 'evidence'],
  },
  {
    id: 'evidence-source-picker', label: 'Evidence Source Picker', group: 'Analyze',
    description: 'Choose saved BetterBoard evidence, load it for analysis, or assign it independently as Run A or Run B.',
    targetCapabilityId: 'analysis-evidence', anchor: 'evidence-source-picker', owner: 'EvidenceSourcePicker',
    keywords: ['evidence', 'source', 'saved session', 'run a', 'run b', 'refresh'],
  },
  {
    id: 'runtime-log', label: 'Runtime Log', group: 'System',
    description: 'Filter and copy the newest Task Center, Arduino CLI, monitor, and evidence log lines.',
    targetCapabilityId: 'monitor-live', anchor: 'runtime-log', owner: 'RuntimeLog',
    keywords: ['runtime', 'log', 'task', 'arduino cli', 'monitor', 'evidence', 'copy'],
  },
  {
    id: 'recipe-settings', label: 'Recipe Settings', group: 'Build',
    description: 'Tune validated recipe parameters that are injected into firmware at compile time.',
    targetCapabilityId: 'program-firmware', anchor: 'recipe-settings', owner: 'RecipeParameterPanel',
    keywords: ['recipe', 'settings', 'parameters', 'slider', 'macro', 'defaults', 'compile time'],
  },
  {
    id: 'serial-console', label: 'Serial Console', group: 'Measure',
    description: 'Inspect RX/TX serial traffic and copy the active or replayed console data.',
    targetCapabilityId: 'monitor-live', anchor: 'serial-console', owner: 'MonitorDataStudio',
    keywords: ['serial', 'console', 'rx', 'tx', 'terminal', 'copy data'],
  },
  {
    id: 'serial-transmit', label: 'Serial Transmit', group: 'Measure',
    description: 'Send text or commands with selectable line endings while Live Monitor owns the serial port.',
    targetCapabilityId: 'monitor-live', anchor: 'serial-transmit', owner: 'MonitorDataStudio',
    keywords: ['serial', 'send', 'command', 'tx', 'newline', 'crlf'],
  },
  {
    id: 'engineering-export-package', label: 'Engineering Export Package', group: 'Experiment',
    description: 'Inspect data.csv, metadata, Engineering Lab handoff files, and legacy Physical Lab compatibility exports.',
    targetCapabilityId: 'measurement-evidence', anchor: 'engineering-export-package', owner: 'MonitorDataStudio',
    keywords: ['export', 'package', 'data.csv', 'metadata', 'physical lab', 'bridge', 'handoff'],
  },
  {
    id: 'measurement-session-context', label: 'Measurement Session Context', group: 'Measure',
    description: 'Inspect the active acquisition or replay context, board profile, schema, sample rate, and embedded math capabilities.',
    targetCapabilityId: 'monitor-live', anchor: 'measurement-session-context', owner: 'MonitorDataStudio',
    keywords: ['session', 'context', 'schema', 'sample rate', 'board profile', 'math runtime'],
  },
  {
    id: 'observatory-operational-visualization', label: 'Operational Visualization', group: 'System',
    description: 'Inspect sampling health, evidence integrity, saved-session history, and Task Center activity as read-only visual diagnostics.',
    targetCapabilityId: 'observatory-system', anchor: 'observatory-operational-visualization', owner: 'ObservatoryVisualSummary',
    keywords: ['sampling health', 'evidence integrity', 'session history', 'task activity', 'visualization'],
  },
  {
    id: 'developer-boards', label: 'Arduino Boards Manager', group: 'Develop',
    description: 'Search, inspect, install, uninstall, and update Arduino board cores and package indexes.',
    targetCapabilityId: 'developer-ecosystem', anchor: 'developer-boards', owner: 'ArduinoEcosystemManager',
    keywords: ['boards', 'core', 'platform', 'install', 'uninstall', 'package index'],
  },
  {
    id: 'developer-libraries', label: 'Arduino Libraries Manager', group: 'Develop',
    description: 'Search, inspect, install, uninstall, and update Arduino libraries.',
    targetCapabilityId: 'developer-ecosystem', anchor: 'developer-libraries', owner: 'ArduinoEcosystemManager',
    keywords: ['library', 'libraries', 'install', 'uninstall', 'arduino'],
  },
  {
    id: 'developer-examples', label: 'Arduino Examples Browser', group: 'Develop',
    description: 'List installed library examples for the active board profile and import a bounded copy into BetterBoard Sketchbook.',
    targetCapabilityId: 'developer-ecosystem', anchor: 'developer-examples', owner: 'ArduinoEcosystemManager',
    keywords: ['examples', 'library example', 'import', 'sketchbook', 'arduino'],
  },
  {
    id: 'observatory-hardware-toolchain', label: 'Observatory · Hardware & Toolchain', group: 'System',
    description: 'Inspect Hardware Doctor diagnosis, selected port/profile, upload gate, Arduino CLI path/version, and snapshot age.',
    targetCapabilityId: 'observatory-system', anchor: 'observatory-hardware-toolchain', owner: 'Observatory',
    keywords: ['observatory', 'hardware doctor', 'toolchain', 'cli', 'upload gate'],
  },
  {
    id: 'observatory-inventory', label: 'Observatory · Recipe & Device Inventory', group: 'System',
    description: 'Inspect recipe counts, My Library recipes, device definitions, and known/ready device inventory.',
    targetCapabilityId: 'observatory-system', anchor: 'observatory-inventory', owner: 'Observatory',
    keywords: ['observatory', 'recipe', 'device', 'inventory', 'my library'],
  },
  {
    id: 'observatory-latest-data', label: 'Observatory · Latest Data', group: 'Measure',
    description: 'Inspect latest saved evidence, replay completeness, observed sample rate, coverage, extrema, and copy paths/data.',
    targetCapabilityId: 'observatory-system', anchor: 'observatory-latest-data', owner: 'Observatory',
    keywords: ['observatory', 'latest data', 'sample rate', 'coverage', 'copy csv'],
  },
  {
    id: 'observatory-live-acquisition', label: 'Observatory · Live Acquisition', group: 'Measure',
    description: 'Inspect the active Monitor task and observed RX row count without changing the acquisition.',
    targetCapabilityId: 'observatory-system', anchor: 'observatory-live-acquisition', owner: 'Observatory',
    keywords: ['observatory', 'live', 'acquisition', 'rx rows', 'monitor'],
  },
  {
    id: 'observatory-bridge-readiness', label: 'Observatory · Bridge Readiness', group: 'Experiment',
    description: 'Inspect Engineering Lab handoff artifact readiness for the latest evidence package.',
    targetCapabilityId: 'observatory-system', anchor: 'observatory-bridge-readiness', owner: 'Observatory',
    keywords: ['observatory', 'engineering lab', 'bridge', 'handoff', 'physical lab'],
  },
  {
    id: 'observatory-background-operations', label: 'Observatory · Background Operations', group: 'System',
    description: 'Inspect recent Task Center operations and their current states from the whole-system view.',
    targetCapabilityId: 'observatory-system', anchor: 'observatory-background-operations', owner: 'Observatory',
    keywords: ['observatory', 'background', 'tasks', 'operations', 'history'],
  },
  {
    id: 'observatory-recent-evidence', label: 'Observatory · Recent Evidence', group: 'Measure',
    description: 'Inspect recent saved measurement sessions, acquisition modes, profiles, ports, and sample counts.',
    targetCapabilityId: 'observatory-system', anchor: 'observatory-recent-evidence', owner: 'Observatory',
    keywords: ['observatory', 'recent evidence', 'measurement sessions', 'history'],
  },
  {
    id: 'observatory-scientific-boundaries', label: 'Observatory · Scientific Boundaries', group: 'Analyze',
    description: 'Review the explicit boundary between operational readiness, evidence integrity, calibration, numerical error, and model validity.',
    targetCapabilityId: 'observatory-system', anchor: 'observatory-scientific-boundaries', owner: 'Observatory',
    keywords: ['observatory', 'scientific boundaries', 'calibration', 'model validity', 'evidence'],
  },
];

export const CAPABILITY_SHORTCUT_BY_ID = new Map(CAPABILITY_SHORTCUTS.map(shortcut => [shortcut.id, shortcut]));

if (CAPABILITY_SHORTCUT_BY_ID.size !== CAPABILITY_SHORTCUTS.length) {
  throw new Error('Duplicate capability shortcut id in CAPABILITY_SHORTCUTS');
}
