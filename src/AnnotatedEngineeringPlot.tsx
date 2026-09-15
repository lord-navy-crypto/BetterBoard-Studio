import { useMemo, useState, type ComponentProps } from 'react';
import EngineeringPlot from './EngineeringPlot';
import { useEngineeringAnnotations } from './EngineeringAnnotations';

type Props = Omit<ComponentProps<typeof EngineeringPlot>, 'selectedX' | 'onSelectedXChange' | 'eventMarkers'> & {
  annotationSourceId: string;
  eventMarkers?: ComponentProps<typeof EngineeringPlot>['eventMarkers'];
};

export default function AnnotatedEngineeringPlot({ annotationSourceId, eventMarkers = [], ...plotProps }: Props) {
  const [selectedX, setSelectedX] = useState<number | null>(null);
  const [text, setText] = useState('');
  const annotationStore = useEngineeringAnnotations();
  const annotations = annotationStore.annotationsForSource(annotationSourceId);
  const markers = useMemo(() => [
    ...eventMarkers,
    ...annotations.map(annotation => ({ x: annotation.x, label: `USER ANNOTATION · ${annotation.text}` })),
  ], [eventMarkers, annotations]);

  function addAnnotation() {
    if (selectedX === null) return;
    const created = annotationStore.addAnnotation({ sourceId: annotationSourceId, x: selectedX, text });
    if (created) setText('');
  }

  return <div style={{ display: 'grid', gap: 8 }}>
    <EngineeringPlot {...plotProps} selectedX={selectedX} onSelectedXChange={setSelectedX} eventMarkers={markers}/>
    <div className="boundary compact" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <b>USER ANNOTATION</b>
      <span>{selectedX === null ? 'Select a point/x on the plot first.' : `x ≈ ${selectedX.toPrecision(6)}`}</span>
      <input value={text} onChange={event => setText(event.target.value)} placeholder="Engineering note…" disabled={selectedX === null} style={{ flex: '1 1 220px' }}/>
      <button className="ghost mini" disabled={selectedX === null || !text.trim()} onClick={addAnnotation}>Add annotation</button>
    </div>
    {annotations.length > 0 && <div className="schema-row">{annotations.map(annotation => <span key={annotation.id}>USER ANNOTATION · {annotation.text} <button className="ghost mini" onClick={() => annotationStore.removeAnnotation(annotation.id)}>×</button></span>)}</div>}
  </div>;
}
