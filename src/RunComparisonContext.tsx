import { createContext, type PropsWithChildren, useContext, useMemo, useState } from 'react';
import type { EvidenceVisualizationSource } from './EvidenceVisualizationContext';

export type ComparisonRun = EvidenceVisualizationSource | null;

export type RunComparisonContextValue = {
  runA: ComparisonRun;
  runB: ComparisonRun;
  setRunA: (run: ComparisonRun) => void;
  setRunB: (run: ComparisonRun) => void;
  clearComparison: () => void;
};

const RunComparisonContext = createContext<RunComparisonContextValue | null>(null);

export function RunComparisonProvider({ children }: PropsWithChildren) {
  const [runA, setRunA] = useState<ComparisonRun>(null);
  const [runB, setRunB] = useState<ComparisonRun>(null);
  const value = useMemo<RunComparisonContextValue>(() => ({
    runA,
    runB,
    setRunA,
    setRunB,
    clearComparison: () => { setRunA(null); setRunB(null); },
  }), [runA, runB]);
  return <RunComparisonContext.Provider value={value}>{children}</RunComparisonContext.Provider>;
}

export function useRunComparison(): RunComparisonContextValue {
  const value = useContext(RunComparisonContext);
  if (!value) throw new Error('useRunComparison must be used inside RunComparisonProvider');
  return value;
}
