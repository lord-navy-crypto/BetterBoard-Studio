import { createContext, type PropsWithChildren, useCallback, useContext, useMemo, useState } from 'react';

export type EngineeringAnnotation = {
  id: string;
  sourceId: string;
  x: number;
  text: string;
  createdAt: number;
  provenance: 'USER ANNOTATION';
};

export type EngineeringAnnotationsContextValue = {
  annotations: EngineeringAnnotation[];
  addAnnotation: (input: { sourceId: string; x: number; text: string }) => EngineeringAnnotation | null;
  removeAnnotation: (id: string) => void;
  annotationsForSource: (sourceId: string) => EngineeringAnnotation[];
};

const EngineeringAnnotationsContext = createContext<EngineeringAnnotationsContextValue | null>(null);

export function EngineeringAnnotationsProvider({ children }: PropsWithChildren) {
  const [annotations, setAnnotations] = useState<EngineeringAnnotation[]>([]);

  const addAnnotation = useCallback((input: { sourceId: string; x: number; text: string }) => {
    const text = input.text.trim();
    if (!input.sourceId || !Number.isFinite(input.x) || !text) return null;
    const annotation: EngineeringAnnotation = {
      id: `annotation:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
      sourceId: input.sourceId,
      x: input.x,
      text,
      createdAt: Date.now(),
      provenance: 'USER ANNOTATION',
    };
    setAnnotations(current => [...current, annotation]);
    return annotation;
  }, []);

  const removeAnnotation = useCallback((id: string) => {
    setAnnotations(current => current.filter(annotation => annotation.id !== id));
  }, []);

  const annotationsForSource = useCallback((sourceId: string) => annotations.filter(annotation => annotation.sourceId === sourceId), [annotations]);

  const value = useMemo<EngineeringAnnotationsContextValue>(() => ({
    annotations,
    addAnnotation,
    removeAnnotation,
    annotationsForSource,
  }), [annotations, addAnnotation, removeAnnotation, annotationsForSource]);

  return <EngineeringAnnotationsContext.Provider value={value}>{children}</EngineeringAnnotationsContext.Provider>;
}

export function useEngineeringAnnotations(): EngineeringAnnotationsContextValue {
  const value = useContext(EngineeringAnnotationsContext);
  if (!value) throw new Error('useEngineeringAnnotations must be used inside EngineeringAnnotationsProvider');
  return value;
}
