import { useMemo, useState } from 'react';
import { BarChart3, Database, FlaskConical, LineChart, Sigma, Wrench } from 'lucide-react';
import AppliedStatisticsWorkbench from './AppliedStatisticsWorkbench';
import EngineeringPreparationStudio from './EngineeringPreparationStudio';
import EvidenceInspector from './EvidenceInspector';
import ExperimentPlanningWorkbench from './ExperimentPlanningWorkbench';
import ModelFittingWorkbench from './ModelFittingWorkbench';
import NumericalErrorVisualWorkbench from './NumericalErrorVisualWorkbench';
import { useEvidenceVisualization } from './EvidenceVisualizationContext';
import './analysis-visualization.css';

type AnalysisView = 'evidence' | 'statistics' | 'models' | 'design' | 'numerical' | 'preparation';

const VIEWS = [
  { id: 'evidence' as const, label: 'Evidence', icon: Database, detail: 'inspect source & provenance' },
  { id: 'statistics' as const, label: 'Signal & Statistics', icon: Sigma, detail: 'uncertainty · spectrum · change' },
  { id: 'models' as const, label: 'Models', icon: LineChart, detail: 'fit · residuals · comparison' },
  { id: 'design' as const, label: 'Experiment Design', icon: FlaskConical, detail: 'coverage · information · replication' },
  { id: 'numerical' as const, label: 'Numerical Reliability', icon: BarChart3, detail: 'error · convergence · precision' },
  { id: 'preparation' as const, label: 'Engineering Preparation', icon: Wrench, detail: 'prepare · contextualize · handoff' },
];

export default function AnalysisVisualizationHub() {
  const [active, setActive] = useState<AnalysisView>('evidence');
  const { source } = useEvidenceVisualization();
  const activeView = useMemo(() => VIEWS.find(view => view.id === active)!, [active]);

  return <section className="analysis-visualization-hub" style={{ maxWidth: 1460, margin: '20px auto 60px' }}>
    <div className="panel" style={{ marginBottom: 12 }}>
      <div className="panel-title"><BarChart3 size={18}/> Analysis & Visualization</div>
      <p className="muted">One evidence source, multiple analysis lenses. Raw evidence stays immutable; statistics, models, numerical diagnostics and planning remain downstream derived views.</p>

      <div className="analysis-source-banner">
        <span><b>{source?.label ?? 'No shared evidence selected'}</b><small>{source?.provenanceLabel ?? 'Select saved evidence or import an external table in an analysis view'}</small></span>
        {source && <span className="schema-row"><span>{source.columns.length} numeric channel(s)</span>{source.sampleRateHz ? <span>{source.sampleRateHz} Hz declared</span> : null}{source.recipeTitle ? <span>{source.recipeTitle}</span> : null}</span>}
      </div>

      <div className="analysis-view-rail" role="tablist" aria-label="Analysis and visualization views">
        {VIEWS.map(view => {
          const Icon = view.icon;
          return <button key={view.id} type="button" role="tab" aria-selected={active === view.id} className={`analysis-view-tab ${active === view.id ? 'active' : ''}`} onClick={() => setActive(view.id)}>
            <Icon size={16}/><span><b>{view.label}</b><small>{view.detail}</small></span>
          </button>;
        })}
      </div>
      <div className="boundary compact"><b>Active view · {activeView.label}</b> · derived analysis never overwrites source evidence.</div>
    </div>

    <div className="analysis-view-pane" hidden={active !== 'evidence'}><EvidenceInspector /></div>
    <div className="analysis-view-pane" hidden={active !== 'statistics'}><AppliedStatisticsWorkbench /></div>
    <div className="analysis-view-pane" hidden={active !== 'models'}><ModelFittingWorkbench /></div>
    <div className="analysis-view-pane" hidden={active !== 'design'}><ExperimentPlanningWorkbench /></div>
    <div className="analysis-view-pane" hidden={active !== 'numerical'}><NumericalErrorVisualWorkbench /></div>
    <div className="analysis-view-pane" hidden={active !== 'preparation'}><EngineeringPreparationStudio /></div>
  </section>;
}
