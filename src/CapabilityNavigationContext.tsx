import { createContext, useCallback, useContext, useMemo, useRef, type ReactNode } from 'react';
import { CAPABILITY_BY_ID, type AnalysisViewId, type StudioTabId, type WorkspaceId } from './capabilityRegistry';

type LocalSetter<T> = (value: T) => void;
type CapabilityActivator = () => void;

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

function revealCapabilityAnchor(capabilityId: string, anchor?: string) {
  if (!anchor) return;
  const target = document.querySelector<HTMLElement>(`[data-capability-anchor="${anchor}"]`);
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

    const anchor = destination.anchor;
    window.requestAnimationFrame(() => {
      window.setTimeout(() => revealCapabilityAnchor(capabilityId, anchor), 0);
    });
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
