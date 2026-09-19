import type { EngineeringStatusNode } from './EngineeringStatusMap';

export type HomeAction = {
  label: string;
  capabilityId: string;
  detail?: string;
};

export type CurrentTaskSummary = {
  title: string;
  detail: string;
  state: 'running' | 'done' | 'failed' | 'cancelled';
} | null;

export type CurrentWorkItem = {
  id: string;
  label: string;
  detail: string;
  status: 'active' | 'ready' | 'warning' | 'failed';
  capabilityId?: string;
};

export type AdvancedCapabilityGroup = {
  id: string;
  label: string;
  description: string;
  capabilities: readonly string[];
};

export const ENGINEERING_STAGE_CAPABILITY: Record<EngineeringStatusNode['id'], string> = {
  toolchain: 'hardware-doctor',
  hardware: 'hardware-session',
  firmware: 'program-firmware',
  acquisition: 'monitor-live',
  evidence: 'measurement-evidence',
  analysis: 'analysis-evidence',
};

export const ENGINEERING_STAGE_ORDER = [
  'Toolchain',
  'Hardware',
  'Firmware',
  'Acquisition',
  'Evidence',
  'Analysis',
] as const;

export const ENGINEERING_FLOW = [
  {
    id: 'build',
    label: 'Build',
    description: 'Establish hardware, firmware, recipes, and the physical circuit.',
    capabilities: ['hardware-session', 'program-firmware', 'recipe-library', 'circuit-lab'],
  },
  {
    id: 'measure',
    label: 'Measure',
    description: 'Acquire live or bounded measurements and preserve traceable evidence.',
    capabilities: ['monitor-live', 'monitor-snapshot', 'measurement-evidence', 'measurement-replay'],
  },
  {
    id: 'analyze',
    label: 'Analyze',
    description: 'Inspect evidence, statistics, models, numerical reliability, and preparation.',
    capabilities: ['analysis-evidence', 'analysis-statistics', 'analysis-models', 'analysis-numerical', 'analysis-preparation'],
  },
  {
    id: 'experiment',
    label: 'Experiment',
    description: 'Plan the next study, run Engineering Lab campaigns, and preserve research context.',
    capabilities: ['analysis-experiment-design', 'experiments-campaigns', 'engineering-handoff', 'research-context'],
  },
] as const;

export const ADVANCED_CAPABILITY_GROUPS: readonly AdvancedCapabilityGroup[] = [
  {
    id: 'diagnostics',
    label: 'Diagnostics',
    description: 'Investigate hardware and circuit problems without bypassing canonical repair workflows.',
    capabilities: ['hardware-doctor', 'circuit-diagnostics'],
  },
  {
    id: 'numerical',
    label: 'Numerical',
    description: 'Open numerical reliability campaigns, expert analyzers, and result viewers.',
    capabilities: ['numerical-advanced', 'numeric-error-depth', 'numerical-result-viewer'],
  },
  {
    id: 'magnetism',
    label: 'Magnetism',
    description: 'Inspect field characterization, model validation, and magnetic result surfaces.',
    capabilities: ['magnet-advanced', 'magnet-result-viewer'],
  },
  {
    id: 'esp32',
    label: 'ESP32',
    description: 'Inspect ESP32 research capabilities, installed core evidence, board details, and configuration risk.',
    capabilities: ['esp32-capabilities', 'esp32-core-audit', 'esp32-board-details', 'esp32-configuration-risk'],
  },
  {
    id: 'developer',
    label: 'Developer',
    description: 'Reach the integrated editor, attributed diagnostics, and Arduino ecosystem management.',
    capabilities: ['developer-editor', 'developer-diagnostics', 'developer-ecosystem'],
  },
  {
    id: 'research',
    label: 'Research',
    description: 'Move immutable evidence into research context, handoff, and local-AI review workflows.',
    capabilities: ['engineering-handoff', 'research-context', 'research-ai-review'],
  },
  {
    id: 'system',
    label: 'System',
    description: 'Inspect whole-system state, hardware topology, and background task history.',
    capabilities: ['observatory-system', 'hardware-topology', 'task-center'],
  },
] as const;
