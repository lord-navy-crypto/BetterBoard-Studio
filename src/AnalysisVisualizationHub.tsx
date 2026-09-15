import { useMemo, useState } from 'react';
import { BarChart3, Database, FlaskConical, LineChart, Sigma, Wrench } from 'lucide-react';
import AppliedStatisticsWorkbench from './AppliedStatisticsWorkbench';
import EngineeringPreparationStudio from './EngineeringPreparationStudio';
import EvidenceInspector from './EvidenceInspector';
import EvidenceSourcePicker from './EvidenceSourcePicker';
import ExperimentPlanningWorkbench from './ExperimentPlanningWorkbench';
import MagnetResultVisualization from './MagnetResultVisualization';
import ModelFittingWorkbench from './ModelFittingWorkbench';
import NumericalErrorVisualWorkbench from './NumericalErrorVisualWorkbench';
import NumericalResultVisualization from './NumericalResultVisualization';
import EngineeringPlot from './EngineeringPlot';
import { useEvidenceVisualization } from './EvidenceVisualizationContext';
import { useRunComparison } from './RunComparisonContext';
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
  const shared = useEvidenceVisualization();
  const { source } = shared;
  const comparison = useRunComparison();
  const activeView = useMemo(() => VIEWS.find(view => view.id === active)!, [active]);

  const commonComparisonColumn = useMemo(() => {
    if (!comparison.runA || !comparison.runB) return null;
    const preferred = comparison.runA.primaryColumn;
    if (preferred && comparison.runB.table.headers.includes(preferred)) return preferred;
    return comparison.runA.table.headers.find(header => comparison.runB?.table.headers.includes(header)) ?? null;
  }, [comparison.runA, comparison.runB]);

  const comparisonSeries = useMemo(() => {
    if (!comparison.runA || !comparison.runB || !commonComparisonColumn) return [];
    const aValues = comparison.runA.table.columns[commonComparisonColumn] ?? [];
    const bValues = comparison.runB.table.columns[commonComparisonColumn] ?? [];
    return [
      { label: `Run A · ${comparison.runA.label}`, points: aValues.map((y, x) => ({ x, y })).filter(point => Number.isFinite(point.y)) },
      { label: `Run B · ${comparison.runB.label}`, points: bValues.map((y, x) => ({ x, y })).filter(point => Number.isFinite(point.y)), dashed: true },
    ];
  }, [comparison.runA, comparison.runB, commonComparisonColumn]);

  return <section className="analysis-visualization-hub" style={{ maxWidth: 1460, margin: '20px auto 60px' }}>
    <div className="panel" style={{ marginBottom: 12 }}>
      <div className="panel-title"><BarChart3 size={18}/> Analysis & Visualization</div>
      <p className="muted">One evidence source, multiple analysis lenses. Raw evidence stays immutable; statistics, models, numerical diagnostics and planning remain downstream derived views.</p>

      <div className="analysis-source-banner">
        <span><b>{source?.label ?? 'No shared evidence selected'}</b><small>{source?.provenanceLabel ?? 'Select saved evidence or import an external table in an analysis view'}</small></span>
        {source && <span className="schema-row"><span>{source.columns.length} numeric channel(s)</span>{source.sampleRateHz ? <span>{source.sampleRateHz} Hz declared</span> : null}{source.recipeTitle ? <span>{source.recipeTitle}</span> : null}</span>}
      </div>

      <EvidenceSourcePicker />

      {(comparison.runA || comparison.runB) && <div className="panel" style={{ marginTop: 10 }}>
        <div className="panel-title">Run A ↔ Run B comparison</div>
        <div className="analysis-source-banner">
          <span><b>Run A</b><small>{comparison.runA?.label ?? 'not selected'}</small></span>
          <span><b>Run B</b><small>{comparison.runB?.label ?? 'not selected'}</small></span>
        </div>
        <div className="action-row">
          <button className="ghost" disabled={!comparison.runA} onClick={() => comparison.runA && shared.setSource(comparison.runA)}>Analyze Run A</button>
          <button className="ghost" disabled={!comparison.runB} onClick={() => comparison.runB && shared.setSource(comparison.runB)}>Analyze Run B</button>
          <button className="ghost" onClick={comparison.clearComparison}>Clear comparison</button>
        </div>
        {comparison.runA && comparison.runB && commonComparisonColumn && comparisonSeries.length > 0
          ? <><div className="hint">Raw overlay of common channel <b>{commonComparisonColumn}</b> by sample index. This visual does not claim automatic clock/time alignment between runs.</div><EngineeringPlot series={comparisonSeries} xLabel="sample index" yLabel={commonComparisonColumn} height={230}/></>
          : comparison.runA && comparison.runB
            ? <div className="empty compact">The selected runs do not expose a common numeric column for a safe raw overlay. Keep them separate and analyze each run explicitly.</div>
            : <div className="empty compact">Select both Run A and Run B from Saved BetterBoard evidence.</div>}
      </div>}

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
    <div className="analysis-view-pane" hidden={active !== 'numerical'}><NumericalErrorVisualWorkbench /><NumericalResultVisualization /></div>
    <div className="analysis-view-pane" hidden={active !== 'preparation'}><EngineeringPreparationStudio /><MagnetResultVisualization /></div>
  </section>;
}
