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
