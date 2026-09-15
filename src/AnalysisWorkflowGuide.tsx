const STEPS = [
  { id: 'evidence', label: 'Evidence', detail: 'Choose and inspect immutable measured/replayed evidence plus provenance.' },
  { id: 'analyze', label: 'Analyze', detail: 'Use statistics, signals, models and numerical reliability as derived lenses.' },
  { id: 'compare', label: 'Compare', detail: 'Compare runs or measured ↔ model results without merging their source rows.' },
  { id: 'decide', label: 'Decide', detail: 'Use experiment design and engineering preparation to choose the next action.' },
] as const;

export default function AnalysisWorkflowGuide() {
  return <div className="analysis-workflow-guide" aria-label="Analysis workflow">
    {STEPS.map((step, index) => <div className="analysis-workflow-step" key={step.id}>
      <span>{index + 1}</span><div><b>{step.label}</b><small>{step.detail}</small></div>
      {index < STEPS.length - 1 && <i aria-hidden="true">→</i>}
    </div>)}
  </div>;
}
