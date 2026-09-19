import { createContext, useCallback, useContext, useMemo, useRef, type ReactNode } from 'react';
import { CAPABILITY_BY_ID, type AnalysisViewId, type StudioTabId, type WorkspaceId } from './capabilityRegistry';
import { CAPABILITY_SHORTCUT_BY_ID } from './capabilityShortcuts';

type LocalSetter<T> = (value: T) => void;
type CapabilityActivator = () => void;
type DomActivationStep = { buttonText: string; within?: string };
type DomTarget = {
  selector: string;
  selectorText?: string;
  selectorExactText?: string;
  emptyFallbackSelector?: string;
  activateButtonText?: string;
  activateWithin?: string;
  activationSteps?: DomActivationStep[];
};

// Explicit fallbacks point at existing canonical UI surfaces without duplicating their backend logic.
// They are used only where the owning component is intentionally large/stable and a data anchor would
// otherwise require invasive edits to mature acquisition, circuit, developer, or observatory code.
const CAPABILITY_ANCHOR_FALLBACKS: Record<string, DomTarget> = {
  'circuit-lab': { selector: '.circuit-lab' },
  'circuit-diagnostics': { selector: '.rule-panel' },
  'monitor-live': { selector: '.monitor-toolbar' },
  'monitor-snapshot': { selector: '.monitor-controls' },
  'measurement-evidence': { selector: '.monitor-record-panel' },
  'measurement-replay': { selector: '.monitor-history-panel' },
  'primitive-observatory': { selector: '.monitor-plot-panel' },
  'developer-editor': { selector: '.developer-editor-panel', activateButtonText: 'Editor', activateWithin: '.developer-view-tabs' },
  'developer-verify-upload': { selector: '.developer-actions', activateButtonText: 'Editor', activateWithin: '.developer-view-tabs' },
  'developer-ecosystem': { selector: '.developer-ide', activateButtonText: 'Boards & Libraries', activateWithin: '.developer-view-tabs' },
  'developer-sketchbook': { selector: '.developer-ide', activateButtonText: 'Sketchbook', activateWithin: '.developer-view-tabs' },
  'developer-diagnostics': { selector: '.developer-diagnostics-panel', activateButtonText: 'Editor', activateWithin: '.developer-view-tabs' },
  'developer-boards': { selector: '.ide-manager', activateButtonText: 'Boards', activateWithin: '.ide-manager .ide-subtabs' },
  'developer-libraries': { selector: '.ide-manager', activateButtonText: 'Libraries', activateWithin: '.ide-manager .ide-subtabs' },
  'developer-examples': { selector: '.ide-manager', activateButtonText: 'Examples', activateWithin: '.ide-manager .ide-subtabs' },
  'observatory-system': { selector: '.observatory-workspace' },
  'observatory-hardware-toolchain': { selector: '.observatory-grid > .observatory-panel:nth-child(1)' },
  'observatory-inventory': { selector: '.observatory-grid > .observatory-panel:nth-child(2)' },
  'observatory-latest-data': { selector: '.observatory-grid > .observatory-panel:nth-child(3)' },
  'observatory-live-acquisition': { selector: '.observatory-grid > .observatory-panel:nth-child(4)' },
  'observatory-bridge-readiness': { selector: '.observatory-grid > .observatory-panel:nth-child(5)' },
  'observatory-background-operations': { selector: '.observatory-grid > .observatory-panel:nth-child(6)' },
  'observatory-recent-evidence': { selector: '.observatory-grid > .observatory-panel:nth-child(7)' },
  'observatory-scientific-boundaries': { selector: '.observatory-grid > .observatory-panel:nth-child(8)' },
  'recipe-settings': { selector: '.recipe-parameter-panel, [data-capability-anchor="program-firmware"]' },
  'serial-console': { selector: '.monitor-console-panel' },
  'serial-transmit': { selector: '.monitor-transmit' },
  'engineering-export-package': { selector: '.monitor-export-panel' },
  'measurement-session-context': { selector: '.monitor-context-panel' },
  'numerical-bench-acquisition': {
    selector: 'button', selectorText: 'Bench 01 — Acquisition',
    activationSteps: [
      { buttonText: 'Numerical evidence', within: '.engineering-model-grid' },
      { buttonText: 'Bench 01 — Acquisition' },
    ],
  },
  'numerical-bench-sampling-error': {
    selector: 'button', selectorText: 'Bench 02 — Sampling Error',
    activationSteps: [
      { buttonText: 'Numerical evidence', within: '.engineering-model-grid' },
      { buttonText: 'Bench 02 — Sampling Error' },
    ],
  },
  'numerical-bench-mcu-reliability': {
    selector: 'button', selectorText: 'Bench 03 — MCU Reliability',
    activationSteps: [
      { buttonText: 'Numerical evidence', within: '.engineering-model-grid' },
      { buttonText: 'Bench 03 — MCU Reliability' },
    ],
  },
  'magnet-bench-vector-acquisition': {
    selector: 'button', selectorText: 'Bench 01 — Vector Acquisition',
    activationSteps: [
      { buttonText: 'Magnetic evidence', within: '.engineering-model-grid' },
      { buttonText: 'Bench 01 — Vector Acquisition' },
    ],
  },
  'magnet-bench-characterization': {
    selector: 'button', selectorText: 'Bench 02 — Characterization',
    activationSteps: [
      { buttonText: 'Magnetic evidence', within: '.engineering-model-grid' },
      { buttonText: 'Bench 02 — Characterization' },
    ],
  },
  'magnet-bench-model-validation': {
    selector: 'button', selectorText: 'Bench 03 — Model Validation',
    activationSteps: [
      { buttonText: 'Magnetic evidence', within: '.engineering-model-grid' },
      { buttonText: 'Bench 03 — Model Validation' },
    ],
  },
  'research-ai-review': { selector: 'section.panel', selectorText: 'Ask OpenPenguin about this evidence' },
  'numerical-result-viewer': { selector: 'section.panel', selectorText: 'Depth Analyzer Results' },
  'magnet-result-viewer': { selector: 'section.panel', selectorText: 'Magnetic Analyzer Results' },
  'esp32-core-audit': { selector: 'div.panel', selectorText: 'Installed Arduino core audit' },
  'esp32-board-details': { selector: 'div.panel', selectorText: 'Arduino CLI board details' },
  'esp32-configuration-risk': { selector: 'div.panel', selectorText: 'Board configuration risk audit' },
  'recipe-preset-builder': { selector: 'section.panel', selectorText: 'Save preset to My Library' },
  'my-recipe-library': {
    selector: 'details.recipe-group', selectorText: 'My Library',
    emptyFallbackSelector: '[data-capability-anchor="recipe-library"]',
  },
  'developer-new-sketch': { selector: '.developer-actions button', selectorExactText: 'New' },
  'developer-load-template': { selector: '.developer-actions button', selectorExactText: 'Load recipe template' },
  'developer-format-source': { selector: '.developer-actions button', selectorExactText: 'Format' },
  'developer-save-sketch': { selector: '.developer-actions button', selectorExactText: 'Save' },
  'developer-save-library': { selector: '.developer-actions button', selectorExactText: 'Save to Library' },
  'developer-verify': { selector: '.developer-actions button', selectorExactText: 'Verify' },
  'developer-run-upload': { selector: '.developer-actions button', selectorExactText: 'Run / Upload' },
  'sketchbook-new-project': { selector: '.sketchbook-toolbar button', selectorExactText: 'New project' },
  'arduino-board-index-url': {
    selector: '.ide-manager-controls .manager-row', selectorText: 'Additional Boards Manager package index URL',
    activationSteps: [{ buttonText: 'Boards', within: '.ide-manager .ide-subtabs' }],
  },
  'recipe-preflight-check': { selector: '[data-capability-anchor="recipe-preflight"] button', selectorExactText: 'Check core & libraries' },
  'program-prepare-firmware': { selector: '[data-capability-anchor="program-firmware"] .action-row button', selectorExactText: 'Prepare firmware' },
  'program-compile': { selector: '[data-capability-anchor="program-firmware"] .action-row button', selectorExactText: 'Compile' },
  'program-compile-upload': { selector: '[data-capability-anchor="program-firmware"] .action-row button', selectorExactText: 'Compile & Upload' },
};

export type CapabilityNavigator = {
  openCapability: (capabilityId: string) => void;
  registerStudioTabSetter: (setter: LocalSetter<StudioTabId>) => () => void;
  registerAnalysisViewSetter: (setter: LocalSetter<AnalysisViewId>) => () => void;
  registerCapabilityActivator: (capabilityId: string, activator: CapabilityActivator) => () => void;
};

type ProviderProps = {
  workspace: WorkspaceId;
  setWorkspace: LocalSetter<WorkspaceId>;
  children: ReactNode;
};

const CapabilityNavigationContext = createContext<CapabilityNavigator | null>(null);

function nextRenderFrame() {
  return new Promise<void>(resolve => window.requestAnimationFrame(() => window.setTimeout(resolve, 0)));
}

function findButton(buttonText: string, within?: string) {
  const root = within ? document.querySelector<HTMLElement>(within) : document.body;
  return [...(root?.querySelectorAll<HTMLButtonElement>('button') ?? [])]
    .find(candidate => candidate.textContent?.trim().includes(buttonText));
}

async function activateDomTarget(target?: DomTarget) {
  if (!target) return;
  const activationSteps = target.activationSteps
    ?? (target.activateButtonText ? [{ buttonText: target.activateButtonText, within: target.activateWithin }] : []);

  for (const step of activationSteps) {
    findButton(step.buttonText, step.within)?.click();
    await nextRenderFrame();
  }
}

function resolveDomTarget(anchor: string, fallback?: DomTarget) {
  const anchored = document.querySelector<HTMLElement>(`[data-capability-anchor="${anchor}"]`);
  if (anchored) return anchored;
  if (!fallback) return null;
  const candidates = [...document.querySelectorAll<HTMLElement>(fallback.selector)];
  const exactSurface = fallback.selectorExactText
    ? candidates.find(candidate => candidate.textContent?.trim() === fallback.selectorExactText) ?? null
    : fallback.selectorText
      ? candidates.find(candidate => candidate.textContent?.includes(fallback.selectorText ?? '')) ?? null
      : candidates[0] ?? null;
  if (exactSurface) return exactSurface;
  return fallback.emptyFallbackSelector
    ? document.querySelector<HTMLElement>(fallback.emptyFallbackSelector)
    : null;
}

function revealCapabilityTarget(capabilityId: string, anchor?: string, parentAnchor?: string) {
  if (!anchor) return;
  const fallback = CAPABILITY_ANCHOR_FALLBACKS[anchor];
  const parentFallback = parentAnchor && parentAnchor !== anchor
    ? CAPABILITY_ANCHOR_FALLBACKS[parentAnchor]
    : undefined;

  window.requestAnimationFrame(() => {
    window.setTimeout(() => {
      // A shortcut first activates its canonical owner surface, then its nested target. This
      // makes child tools reachable from any previous local subview without duplicating backend logic.
      void (async () => {
        await activateDomTarget(parentFallback);
        await activateDomTarget(fallback);
        window.requestAnimationFrame(() => {
          const target = resolveDomTarget(anchor, fallback);
          if (!target) {
            console.warn(`[BetterBoard] Capability ${capabilityId} could not resolve anchor ${anchor}.`);
            return;
          }

          let current: HTMLElement | null = target;
          while (current) {
            if (current instanceof HTMLDetailsElement) current.open = true;
            current = current.parentElement;
          }

          const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
          target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' });
          target.classList.add('capability-target-flash');

          const focusTarget = target.matches('button, a, input, select, textarea, [tabindex]')
            ? target
            : target.querySelector<HTMLElement>('button, a, input, select, textarea, [tabindex]');
          focusTarget?.focus({ preventScroll: true });
          window.setTimeout(() => target.classList.remove('capability-target-flash'), 1400);
        });
      })();
    }, 0);
  });
}

export function CapabilityNavigationProvider({ workspace, setWorkspace, children }: ProviderProps) {
  const studioTabSetterRef = useRef<LocalSetter<StudioTabId> | null>(null);
  const analysisViewSetterRef = useRef<LocalSetter<AnalysisViewId> | null>(null);
  const capabilityActivatorsRef = useRef(new Map<string, CapabilityActivator>());

  const registerStudioTabSetter = useCallback((setter: LocalSetter<StudioTabId>) => {
    studioTabSetterRef.current = setter;
    return () => {
      if (studioTabSetterRef.current === setter) studioTabSetterRef.current = null;
    };
  }, []);

  const registerAnalysisViewSetter = useCallback((setter: LocalSetter<AnalysisViewId>) => {
    analysisViewSetterRef.current = setter;
    return () => {
      if (analysisViewSetterRef.current === setter) analysisViewSetterRef.current = null;
    };
  }, []);

  const registerCapabilityActivator = useCallback((capabilityId: string, activator: CapabilityActivator) => {
    capabilityActivatorsRef.current.set(capabilityId, activator);
    return () => {
      if (capabilityActivatorsRef.current.get(capabilityId) === activator) capabilityActivatorsRef.current.delete(capabilityId);
    };
  }, []);

  const openCapability = useCallback((requestedId: string) => {
    const shortcut = CAPABILITY_SHORTCUT_BY_ID.get(requestedId);
    const capabilityId = shortcut?.targetCapabilityId ?? requestedId;
    const capability = CAPABILITY_BY_ID.get(capabilityId);
    if (!capability) {
      console.warn(`[BetterBoard] Unknown capability id: ${requestedId}`);
      return;
    }

    const destination = capability.destination;
    if (workspace !== destination.workspace) setWorkspace(destination.workspace);

    if (destination.kind === 'studio-tab') {
      const setter = studioTabSetterRef.current;
      if (!setter) console.warn(`[BetterBoard] Studio navigation is not registered for ${requestedId}.`);
      else setter(destination.tab);
    } else if (destination.kind === 'analysis-view') {
      const setter = analysisViewSetterRef.current;
      if (!setter) console.warn(`[BetterBoard] Analysis navigation is not registered for ${requestedId}.`);
      else setter(destination.view);
    }

    capabilityActivatorsRef.current.get(capabilityId)?.();
    capabilityActivatorsRef.current.get(requestedId)?.();
    revealCapabilityTarget(
      requestedId,
      shortcut?.anchor ?? destination.anchor,
      shortcut ? destination.anchor : undefined,
    );
  }, [setWorkspace, workspace]);

  const value = useMemo<CapabilityNavigator>(() => ({
    openCapability,
    registerStudioTabSetter,
    registerAnalysisViewSetter,
    registerCapabilityActivator,
  }), [openCapability, registerStudioTabSetter, registerAnalysisViewSetter, registerCapabilityActivator]);

  return <CapabilityNavigationContext.Provider value={value}>{children}</CapabilityNavigationContext.Provider>;
}

export function useCapabilityNavigation() {
  const value = useContext(CapabilityNavigationContext);
  if (!value) throw new Error('useCapabilityNavigation must be used inside CapabilityNavigationProvider');
  return value;
}