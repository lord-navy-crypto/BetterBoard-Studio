import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type PlotInspectionRange = [number, number] | null;

export type PlotInspectionContextValue = {
  sourceId: string;
  selectedX: number | null;
  selectedRange: PlotInspectionRange;
  setSelectedX: (value: number | null) => void;
  setSelectedRange: (value: PlotInspectionRange) => void;
  resetInspection: () => void;
};

const PlotInspectionContext = createContext<PlotInspectionContextValue | null>(null);

export function PlotInspectionProvider({ sourceId, children }: PropsWithChildren<{ sourceId: string }>) {
  const [selectedX, setSelectedX] = useState<number | null>(null);
  const [selectedRange, setSelectedRange] = useState<PlotInspectionRange>(null);

  useEffect(() => {
    setSelectedX(null);
    setSelectedRange(null);
  }, [sourceId]);

  const resetInspection = useCallback(() => {
    setSelectedX(null);
    setSelectedRange(null);
  }, []);

  const value = useMemo<PlotInspectionContextValue>(() => ({
    sourceId,
    selectedX,
    selectedRange,
    setSelectedX,
    setSelectedRange,
    resetInspection,
  }), [sourceId, selectedX, selectedRange, resetInspection]);

  return <PlotInspectionContext.Provider value={value}>{children}</PlotInspectionContext.Provider>;
}

export function usePlotInspection(): PlotInspectionContextValue {
  const value = useContext(PlotInspectionContext);
  if (!value) throw new Error('usePlotInspection must be used inside PlotInspectionProvider');
  return value;
}
