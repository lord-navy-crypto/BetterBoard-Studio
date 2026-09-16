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
