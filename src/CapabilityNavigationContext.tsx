import { createContext, useCallback, useContext, useMemo, useRef, type ReactNode } from 'react';
import { CAPABILITY_BY_ID, type AnalysisViewId, type StudioTabId, type WorkspaceId } from './capabilityRegistry';

type LocalSetter<T> = (value: T) => void;
type CapabilityActivator = () => void;
type DomTarget = { selector: string; activateButtonText?: string; activateWithin?: string };

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
  'observatory-system': { selector: '.observatory-workspace' },
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

function activateDomTarget(target?: DomTarget) {
  if (!target?.activateButtonText) return;
  const root = target.activateWithin ? document.querySelector<HTMLElement>(target.activateWithin) : document.body;
  const button = [...(root?.querySelectorAll<HTMLButtonElement>('button') ?? [])]
    .find(candidate => candidate.textContent?.trim().includes(target.activateButtonText ?? ''));
  button?.click();
}

function revealCapabilityTarget(capabilityId: string, anchor?: string) {
  if (!anchor) return;
  const fallback = CAPABILITY_ANCHOR_FALLBACKS[anchor];
  activateDomTarget(fallback);

  window.requestAnimationFrame(() => {
    window.setTimeout(() => {
      const target = document.querySelector<HTMLElement>(`[data-capability-anchor="${anchor}"]`)
        ?? (fallback ? document.querySelector<HTMLElement>(fallback.selector) : null);
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

  const openCapability = useCallback((capabilityId: string) => {
    const capability = CAPABILITY_BY_ID.get(capabilityId);
    if (!capability) {
      console.warn(`[BetterBoard] Unknown capability id: ${capabilityId}`);
      return;
    }

    const destination = capability.destination;
    if (workspace !== destination.workspace) setWorkspace(destination.workspace);

    if (destination.kind === 'studio-tab') {
      const setter = studioTabSetterRef.current;
      if (!setter) console.warn(`[BetterBoard] Studio navigation is not registered for ${capabilityId}.`);
      else setter(destination.tab);
    } else if (destination.kind === 'analysis-view') {
      const setter = analysisViewSetterRef.current;
      if (!setter) console.warn(`[BetterBoard] Analysis navigation is not registered for ${capabilityId}.`);
      else setter(destination.view);
    }

    capabilityActivatorsRef.current.get(capabilityId)?.();
    revealCapabilityTarget(capabilityId, destination.anchor);
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
