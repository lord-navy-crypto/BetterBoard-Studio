import { CAPABILITY_BY_ID } from './capabilityRegistry';
import { CAPABILITY_SHORTCUT_BY_ID } from './capabilityShortcuts';

export type BetterBoardRoute =
  | 'studio:hardware'
  | 'studio:circuit'
  | 'studio:library'
  | 'studio:data'
  | 'studio:developer'
  | 'studio:tasks'
  | 'labs:numerical'
  | 'labs:numerical-expert'
  | 'labs:magnet'
  | 'labs:magnet-expert'
  | 'labs:campaigns'
  | 'labs:campaign-library'
  | 'labs:handoff'
  | 'analysis:evidence'
  | 'analysis:statistics'
  | 'analysis:models'
  | 'analysis:magnet-results'
  | 'analysis:design'
  | 'analysis:numerical'
  | 'observatory:overview'
  | 'observatory:hardware'
  | 'observatory:inventory'
  | 'observatory:data'
  | 'observatory:live'
  | 'observatory:bridge'
  | 'observatory:tasks'
  | 'observatory:evidence'
  | 'ai';

const CANONICAL_ROUTES: Record<string, BetterBoardRoute> = {
  'hardware-session': 'studio:hardware',
  'hardware-doctor': 'studio:hardware',
  'recipe-preflight': 'studio:hardware',
  'program-firmware': 'studio:hardware',
  'recipe-library': 'studio:library',
  'circuit-lab': 'studio:circuit',
  'circuit-diagnostics': 'studio:circuit',
  'monitor-live': 'studio:data',
  'monitor-snapshot': 'studio:data',
  'measurement-evidence': 'studio:data',
  'measurement-replay': 'studio:data',
  'primitive-observatory': 'studio:data',

  'analysis-evidence': 'analysis:evidence',
  'analysis-run-compare': 'analysis:evidence',
  'analysis-annotations': 'analysis:evidence',
  'analysis-statistics': 'analysis:statistics',
  'analysis-models': 'analysis:models',
  'analysis-experiment-design': 'analysis:design',
  'analysis-numerical': 'analysis:numerical',

  'analysis-preparation': 'labs:handoff',
  'numerical-advanced': 'labs:numerical-expert',
  'magnet-advanced': 'labs:magnet-expert',
  'engineering-handoff': 'labs:handoff',
  'research-context': 'labs:handoff',

  'developer-editor': 'studio:developer',
  'developer-verify-upload': 'studio:developer',
  'developer-ecosystem': 'studio:developer',
  'developer-sketchbook': 'studio:developer',
  'developer-diagnostics': 'studio:developer',

  'experiments-campaigns': 'labs:campaigns',
  'experiment-code-library': 'labs:campaign-library',
  'numeric-error-depth': 'labs:campaigns',
  'esp32-capabilities': 'labs:campaigns',

  'observatory-mission': 'observatory:overview',
  'observatory-system': 'observatory:overview',
  'hardware-topology': 'studio:hardware',
  'task-center': 'studio:tasks',
  'openguin': 'ai',
  'focus-mode': 'studio:hardware',
};

const SHORTCUT_ROUTE_OVERRIDES: Record<string, BetterBoardRoute> = {
  'numerical-bench-acquisition': 'labs:numerical',
  'numerical-bench-sampling-error': 'labs:numerical',
  'numerical-bench-mcu-reliability': 'labs:numerical',
  'magnet-bench-vector-acquisition': 'labs:magnet',
  'magnet-bench-characterization': 'labs:magnet',
  'magnet-bench-model-validation': 'labs:magnet',
  'magnet-result-viewer': 'analysis:magnet-results',

  'observatory-hardware-toolchain': 'observatory:hardware',
  'observatory-inventory': 'observatory:inventory',
  'observatory-latest-data': 'observatory:data',
  'observatory-live-acquisition': 'observatory:live',
  'observatory-bridge-readiness': 'observatory:bridge',
  'observatory-background-operations': 'observatory:tasks',
  'observatory-recent-evidence': 'observatory:evidence',
  'observatory-scientific-boundaries': 'observatory:overview',
};

export function routeForCapabilityId(requestedId: string): BetterBoardRoute | null {
  const override = SHORTCUT_ROUTE_OVERRIDES[requestedId];
  if (override) return override;

  const shortcut = CAPABILITY_SHORTCUT_BY_ID.get(requestedId);
  const canonicalId = shortcut?.targetCapabilityId ?? requestedId;
  return CANONICAL_ROUTES[canonicalId] ?? null;
}

export function semanticWorkspaceForCapability(id: string): 'Studio' | 'Labs' | 'Analysis' | 'Observatory' | 'AI' | 'Unknown' {
  const route = routeForCapabilityId(id);
  if (!route) return 'Unknown';
  if (route === 'ai') return 'AI';
  const [scope] = route.split(':', 1);
  if (scope === 'studio') return 'Studio';
  if (scope === 'labs') return 'Labs';
  if (scope === 'analysis') return 'Analysis';
  if (scope === 'observatory') return 'Observatory';
  return 'Unknown';
}

export function assertCapabilityRoutesComplete() {
  const missing = [...CAPABILITY_BY_ID.keys()].filter(id => !CANONICAL_ROUTES[id]);
  if (missing.length) throw new Error(`Missing current-workspace route for capability: ${missing.join(', ')}`);
}
