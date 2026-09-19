import type { CapabilityTarget } from './CapabilityLauncher';
import { CAPABILITY_BY_ID } from './capabilityRegistry';
import { CAPABILITY_SHORTCUT_BY_ID } from './capabilityShortcuts';

/**
 * Bridge the richer #67 semantic capability index onto the current
 * Studio / Labs / Analysis / Observatory navigation model.
 *
 * This file deliberately maps to existing canonical surfaces. It does not
 * introduce a second execution path or resurrect the retired three-workspace UI.
 */
export function currentTargetForCapability(requestedId: string): CapabilityTarget | null {
  const shortcut = CAPABILITY_SHORTCUT_BY_ID.get(requestedId);
  const id = shortcut?.targetCapabilityId ?? requestedId;

  if (['hardware-session','hardware-doctor','recipe-preflight','program-firmware','hardware-topology'].includes(id)) return 'studio:hardware';
  if (['recipe-library'].includes(id)) return 'studio:library';
  if (['circuit-lab','circuit-diagnostics'].includes(id)) return 'studio:circuit';
  if (['monitor-live','monitor-snapshot','measurement-evidence','measurement-replay','primitive-observatory'].includes(id)) return 'studio:data';
  if (id.startsWith('developer-')) return 'studio:developer';
  if (id === 'task-center') return 'studio:tasks';
  if (id === 'openguin') return 'ai';

  if (id === 'analysis-evidence' || id === 'analysis-run-compare' || id === 'analysis-annotations') return 'analysis:evidence';
  if (id === 'analysis-statistics') return 'analysis:statistics';
  if (id === 'analysis-models') return 'analysis:models';
  if (id === 'analysis-experiment-design') return 'analysis:design';
  if (id === 'analysis-numerical') return 'analysis:numerical';

  if (id === 'analysis-preparation' || id === 'engineering-handoff' || id === 'research-context') return 'labs:handoff';
  if (id === 'numerical-advanced') return 'labs:numerical-expert';
  if (id === 'magnet-advanced') return 'labs:magnet-expert';
  if (id === 'experiments-campaigns' || id === 'numeric-error-depth' || id === 'esp32-capabilities') return 'labs:campaigns';
  if (id === 'experiment-code-library') return 'labs:campaign-library';

  if (id === 'observatory-mission' || id === 'observatory-system') return 'observatory:overview';

  // Semantic shortcuts are intentionally routed to the same current owner
  // surface as their canonical target. Current navigation then reveals the
  // appropriate sub-workbench without duplicating backend logic.
  if (shortcut) return currentTargetForCapability(shortcut.targetCapabilityId);

  // Every registry entry should resolve above. Returning null keeps historical
  // metadata visible without inventing a false route for retired-only concepts.
  return CAPABILITY_BY_ID.has(id) ? null : null;
}
