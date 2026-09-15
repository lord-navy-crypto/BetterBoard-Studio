import { createContext, useContext, useMemo, useState, type PropsWithChildren } from 'react';
import type { ParsedNumericTable } from './AppliedStatistics';

export type EvidenceSourceKind = 'measurement-session' | 'external-table';

export type EvidenceVisualizationSource = {
  kind: EvidenceSourceKind;
  sourceId: string;
  label: string;
  table: ParsedNumericTable;
  columns: string[];
  units?: string[];
  primaryColumn?: string | null;
  sampleRateHz?: number | null;
  timestamps?: number[];
  recipeId?: string | null;
  recipeTitle?: string | null;
  evidenceDirectory?: string | null;
  csvPath?: string | null;
  metadataPath?: string | null;
  provenanceLabel: string;
};

export type EvidenceVisualizationContextValue = {
  source: EvidenceVisualizationSource | null;
  setSource: (source: EvidenceVisualizationSource | null) => void;
};

const EvidenceVisualizationContext = createContext<EvidenceVisualizationContextValue | null>(null);

export function EvidenceVisualizationProvider({ children }: PropsWithChildren) {
  const [source, setSource] = useState<EvidenceVisualizationSource | null>(null);
  const value = useMemo(() => ({ source, setSource }), [source]);
  return <EvidenceVisualizationContext.Provider value={value}>{children}</EvidenceVisualizationContext.Provider>;
}

export function useEvidenceVisualization(): EvidenceVisualizationContextValue {
  const value = useContext(EvidenceVisualizationContext);
  if (!value) throw new Error('useEvidenceVisualization must be used inside EvidenceVisualizationProvider.');
  return value;
}

export function externalEvidenceSource(fileName: string, table: ParsedNumericTable): EvidenceVisualizationSource {
  return {
    kind: 'external-table',
    sourceId: `external:${fileName}`,
    label: fileName,
    table,
    columns: table.headers,
    provenanceLabel: 'EXTERNAL TABLE',
  };
}

export function measurementEvidenceSource(input: {
  sourceId: string;
  label: string;
  table: ParsedNumericTable;
  units?: string[];
  primaryColumn?: string | null;
  sampleRateHz?: number | null;
  timestamps?: number[];
  recipeId?: string | null;
  recipeTitle?: string | null;
  evidenceDirectory?: string | null;
  csvPath?: string | null;
  metadataPath?: string | null;
}): EvidenceVisualizationSource {
  return {
    kind: 'measurement-session',
    sourceId: input.sourceId,
    label: input.label,
    table: input.table,
    columns: input.table.headers,
    units: input.units,
    primaryColumn: input.primaryColumn,
    sampleRateHz: input.sampleRateHz,
    timestamps: input.timestamps,
    recipeId: input.recipeId,
    recipeTitle: input.recipeTitle,
    evidenceDirectory: input.evidenceDirectory,
    csvPath: input.csvPath,
    metadataPath: input.metadataPath,
    provenanceLabel: 'BETTERBOARD MEASUREMENT EVIDENCE',
  };
}

// Derived results remain downstream: this context stores source evidence identity and normalized table data only.
