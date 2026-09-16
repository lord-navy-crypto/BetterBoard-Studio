export type CapabilityTier = 'common' | 'advanced' | 'expert';

export const COMMON_CAPABILITY_IDS = new Set<string>([
  'hardware-session',
  'hardware-doctor',
  'recipe-preflight',
  'program-firmware',
  'recipe-library',
  'circuit-lab',
  'monitor-live',
  'monitor-snapshot',
  'measurement-evidence',
  'measurement-replay',
  'analysis-evidence',
  'analysis-statistics',
  'analysis-models',
  'analysis-experiment-design',
  'analysis-numerical',
  'analysis-preparation',
  'experiments-campaigns',
  'developer-editor',
  'task-center',
  'openguin',
  'focus-mode',
  'recipe-preflight-check',
  'program-prepare-firmware',
  'program-compile',
  'recipe-preset-builder',
  'my-recipe-library',
]);

export const ADVANCED_CAPABILITY_IDS = new Set<string>([
  'circuit-diagnostics',
  'primitive-observatory',
  'analysis-run-compare',
  'analysis-annotations',
  'numerical-advanced',
  'magnet-advanced',
  'engineering-handoff',
  'research-context',
  'developer-verify-upload',
  'developer-ecosystem',
  'developer-sketchbook',
  'developer-diagnostics',
  'experiment-code-library',
  'numeric-error-depth',
  'esp32-capabilities',
  'observatory-mission',
  'observatory-system',
  'hardware-topology',
  'campaign-visualization',
  'numerical-result-viewer',
  'magnet-result-viewer',
  'esp32-core-audit',
  'esp32-board-details',
  'esp32-configuration-risk',
  'research-ai-review',
  'engineering-status-map',
  'measurement-session-context',
  'observatory-operational-visualization',
]);

export function getCapabilityTier(id: string): CapabilityTier {
  if (COMMON_CAPABILITY_IDS.has(id)) return 'common';
  if (ADVANCED_CAPABILITY_IDS.has(id)) return 'advanced';
  return 'expert';
}
