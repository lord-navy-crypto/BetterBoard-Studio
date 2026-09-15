# Phase 5 Visualization Absorption & Unified Analysis UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize BetterBoard's existing analysis and visualization capabilities into a unified evidence-driven UI, surface scientifically useful results currently hidden behind advanced tools, and add operational visualizations without changing validated scientific algorithms or raw evidence semantics.

**Architecture:** Keep the three top-level workspaces (`Studio`, `Observatory`, `Experiments`) and introduce a shared frontend evidence context plus compact analysis navigation inside Studio. Reuse existing workbenches and analyzers, extend `EngineeringPlot` only for existing visualization needs, and preserve strict provenance between raw evidence, host-derived results, device-derived results, models, and references.

**Tech Stack:** React + TypeScript + Tauri invoke APIs + existing `EngineeringPlot` + Python contract self-checks + GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-15-visualization-absorption-unified-analysis-ui-design.md`

## Global Constraints

- Do not replace validated statistics, regression, DOE, numerical, magnetic, or primitive-observability algorithms.
- Do not change raw measurement CSV contents or evidence package semantics.
- Do not write derived results back into immutable evidence.
- Do not add a fourth top-level workspace.
- Keep manual CSV/TSV import available for external evidence.
- Keep `HOST-DERIVED`, `DEVICE-DERIVED`, measured evidence, model, and host-reference/oracle provenance visually distinct.
- Do not expose analyzer fields that are not actually produced by repository analyzers.
- Do not add a second plotting library unless the existing shared plot cannot represent an already-existing result.
- Prefer overview → detail navigation over rendering every heavyweight workbench simultaneously.

---

## File Structure

### New files

- `src/EvidenceVisualizationContext.tsx` — shared selected-evidence provider and normalization helpers.
- `src/AnalysisVisualizationHub.tsx` — Studio-level analysis navigation and active-source banner.
- `src/SignalHealthRail.tsx` — compact Monitor signal-health summary driven only by existing primitive results.
- `src/ObservatoryVisualSummary.tsx` — readiness pipeline, sampling health, evidence integrity, session/task mini-visuals.
- `src/NumericalResultVisualization.tsx` — visualization adapter for already-produced numerical analyzer outputs.
- `src/MagnetResultVisualization.tsx` — visualization adapter for already-produced magnetic analyzer outputs.
- `src/CampaignVisualization.tsx` — campaign flow and mechanism coverage visuals for Experiments.
- `scripts/visualization_absorption_self_check.py` — structural/provenance contract for the Phase 5 UI.

### Existing files to modify

- `src/main.tsx` — mount `EvidenceVisualizationProvider`; replace vertically stacked analysis workbenches with `AnalysisVisualizationHub`.
- `src/AppliedStatisticsWorkbench.tsx` — consume shared evidence as the default source while keeping local import.
- `src/ModelFittingWorkbench.tsx` — consume shared evidence as the default source while keeping local import.
- `src/ExperimentPlanningWorkbench.tsx` — consume shared evidence as the default source while keeping local import.
- `src/MonitorDataStudio.tsx` — provide active measurement/replay evidence to shared context and mount `SignalHealthRail`.
- `src/PrimitiveObservatory.tsx` — expose a compact immutable summary object for signal-health rendering; keep detailed calculations here.
- `src/EngineeringPlot.tsx` — add only required compact/selection/event-marker capabilities.
- `src/Observatory.tsx` — mount operational visualization summary using quantities already computed there.
- `src/EngineeringPreparationStudio.tsx` — surface numerical/magnetic scientific visualization adapters while keeping implementation controls advanced.
- `src/ExperimentsHub.tsx` — add campaign-level visualization and remove no existing expert paths.
- `scripts/run_contract_self_checks.py` — register Phase 5 contract check.

---

### Task 1: Add the Phase 5 contract gate

**Files:**
- Create: `scripts/visualization_absorption_self_check.py`
- Modify: `scripts/run_contract_self_checks.py`

**Interfaces:**
- Consumes: repository source files as text.
- Produces: a single executable contract that protects Phase 5 architecture and provenance boundaries.

- [ ] **Step 1: Write the failing contract check**

Create `scripts/visualization_absorption_self_check.py` with explicit assertions for files and required structural tokens:

```python
#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def require(path: str, *needles: str) -> None:
    text = read(path)
    for needle in needles:
        assert needle in text, f"{path}: missing {needle!r}"


def main() -> int:
    require("src/main.tsx", "EvidenceVisualizationProvider", "AnalysisVisualizationHub")
    require("src/EvidenceVisualizationContext.tsx", "measurement-session", "external-table", "provenanceLabel")
    require("src/AnalysisVisualizationHub.tsx", "Signal & Statistics", "Experiment Design", "Engineering Preparation")
    require("src/SignalHealthRail.tsx", "Timing", "Noise / RMS", "Host ↔ Device")
    require("src/ObservatoryVisualSummary.tsx", "Sampling Health", "Evidence Integrity", "Session History", "Task Activity")
    require("src/EngineeringPreparationStudio.tsx", "NumericalResultVisualization", "MagnetResultVisualization")
    require("src/ExperimentsHub.tsx", "CampaignVisualization")

    context = read("src/EvidenceVisualizationContext.tsx")
    assert "derived" not in context.lower() or "derived results remain downstream" in context.lower(), "Shared evidence source must not become a derived-result store"

    monitor = read("src/MonitorDataStudio.tsx")
    assert "parseNumericRow" in monitor, "Existing raw-evidence parser boundary must remain present"

    print("Visualization absorption contract: PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
```

Add `"visualization_absorption_self_check.py"` to the end of `CHECKS` in `scripts/run_contract_self_checks.py`.

- [ ] **Step 2: Run the contract suite and verify RED**

Run:

```bash
python3 scripts/run_contract_self_checks.py
```

Expected: existing checks pass, then the new check fails because `EvidenceVisualizationContext.tsx` or another new Phase 5 file does not exist.

- [ ] **Step 3: Commit the RED gate**

```bash
git add scripts/visualization_absorption_self_check.py scripts/run_contract_self_checks.py
git commit -m "test: protect visualization absorption architecture"
```

---

### Task 2: Build shared Evidence Visualization Context

**Files:**
- Create: `src/EvidenceVisualizationContext.tsx`
- Modify: `src/main.tsx`
- Modify: `src/AppliedStatisticsWorkbench.tsx`
- Modify: `src/ModelFittingWorkbench.tsx`
- Modify: `src/ExperimentPlanningWorkbench.tsx`

**Interfaces:**
- Produces:

```ts
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
  setSource(source: EvidenceVisualizationSource | null): void;
};
```

and hooks:

```ts
export function useEvidenceVisualization(): EvidenceVisualizationContextValue;
export function externalEvidenceSource(fileName: string, table: ParsedNumericTable): EvidenceVisualizationSource;
```

- [ ] **Step 1: Extend the contract with source-identity requirements**

Add assertions that the context defines `sourceId`, `provenanceLabel`, and both source kinds; add assertions that each of the three workbenches imports `useEvidenceVisualization`.

- [ ] **Step 2: Run the Phase 5 check and verify RED**

```bash
python3 scripts/visualization_absorption_self_check.py
```

Expected: fail on missing context file and/or workbench integration.

- [ ] **Step 3: Implement the provider**

Use a small React context with no analysis calculations:

```tsx
const EvidenceVisualizationContext = createContext<EvidenceVisualizationContextValue | null>(null);

export function EvidenceVisualizationProvider({ children }: PropsWithChildren) {
  const [source, setSource] = useState<EvidenceVisualizationSource | null>(null);
  return <EvidenceVisualizationContext.Provider value={{ source, setSource }}>{children}</EvidenceVisualizationContext.Provider>;
}
```

`externalEvidenceSource()` must set:

```ts
{
  kind: 'external-table',
  sourceId: `external:${fileName}`,
  label: fileName,
  table,
  columns: table.headers,
  provenanceLabel: 'EXTERNAL TABLE',
}
```

Do not add any derived-statistics fields to this type.

- [ ] **Step 4: Mount provider in `main.tsx`**

Wrap the existing `Root` under `HardwareSessionProvider`:

```tsx
<HardwareSessionProvider>
  <EvidenceVisualizationProvider>
    <Root />
  </EvidenceVisualizationProvider>
</HardwareSessionProvider>
```

- [ ] **Step 5: Make analysis workbenches default to the shared source**

For each workbench, read `shared.source` and use it when local imported `table` is null. Preserve manual import. When importing a local file, convert it using `externalEvidenceSource()` and update the shared source so the active-source banner remains truthful.

The effective table pattern should be explicit:

```ts
const effectiveTable = localTable ?? shared.source?.table ?? null;
const effectiveSourceLabel = localTable ? localSource : shared.source?.label ?? 'No table loaded';
```

Do not silently use shared data while displaying a different source label.

- [ ] **Step 6: Run TypeScript build and contract**

```bash
npm run build
python3 scripts/visualization_absorption_self_check.py
```

Expected: both pass or the Phase 5 check advances to the next missing component.

- [ ] **Step 7: Commit**

```bash
git add src/EvidenceVisualizationContext.tsx src/main.tsx src/AppliedStatisticsWorkbench.tsx src/ModelFittingWorkbench.tsx src/ExperimentPlanningWorkbench.tsx scripts/visualization_absorption_self_check.py
git commit -m "feat: add shared evidence visualization context"
```

---

### Task 3: Replace stacked analysis workbenches with Analysis & Visualization navigation

**Files:**
- Create: `src/AnalysisVisualizationHub.tsx`
- Modify: `src/main.tsx`
- Modify: `src/styles.css` or `src/visual-system.css`

**Interfaces:**
- Consumes: `useEvidenceVisualization()`.
- Produces: one active analysis view at a time with preserved component state where practical.

- [ ] **Step 1: Add failing structural assertions**

Require that `main.tsx` mounts `<AnalysisVisualizationHub />` and no longer directly emits the six large workbenches in sequence.

- [ ] **Step 2: Verify RED**

```bash
python3 scripts/visualization_absorption_self_check.py
```

- [ ] **Step 3: Implement `AnalysisVisualizationHub`**

Use this fixed view id set:

```ts
type AnalysisView = 'evidence' | 'statistics' | 'models' | 'design' | 'numerical' | 'preparation';
```

Map views to existing components:

```tsx
const views = [
  ['evidence', 'Evidence', EvidenceInspector],
  ['statistics', 'Signal & Statistics', AppliedStatisticsWorkbench],
  ['models', 'Models', ModelFittingWorkbench],
  ['design', 'Experiment Design', ExperimentPlanningWorkbench],
  ['numerical', 'Numerical Reliability', NumericalErrorVisualWorkbench],
  ['preparation', 'Engineering Preparation', EngineeringPreparationStudio],
] as const;
```

Render an active-source banner containing at minimum:

```tsx
<b>{source?.label ?? 'No shared evidence selected'}</b>
<small>{source?.provenanceLabel ?? 'Select evidence or import an external table'}</small>
```

Render only one heavyweight surface visibly at a time. Using persistent hidden panes is acceptable when preserving state is necessary.

- [ ] **Step 4: Replace direct root-level mounts in `main.tsx`**

The Studio pane becomes conceptually:

```tsx
<div className="bb-workspace-pane" hidden={workspace !== 'studio'}>
  <App />
  <AnalysisVisualizationHub />
</div>
```

- [ ] **Step 5: Add responsive navigation styling**

Add classes for a compact wrapping tab/card rail and active source banner. Do not create a new visual system or duplicate existing panel tokens.

- [ ] **Step 6: Verify build + contracts**

```bash
npm run build
python3 scripts/run_contract_self_checks.py
```

- [ ] **Step 7: Commit**

```bash
git add src/AnalysisVisualizationHub.tsx src/main.tsx src/styles.css src/visual-system.css scripts/visualization_absorption_self_check.py
git commit -m "feat: unify Studio analysis navigation"
```

---

### Task 4: Extend EngineeringPlot only for existing visualization needs

**Files:**
- Modify: `src/EngineeringPlot.tsx`
- Modify: whichever shared plot stylesheet currently owns plot classes.
- Modify: `scripts/visualization_absorption_self_check.py`

**Interfaces:**
- Add optional props only:

```ts
compact?: boolean;
selectedPoint?: { x: number; y: number; label?: string } | null;
eventMarkers?: Array<{ x: number; label: string }>;
onPointSelect?: (point: { x: number; y: number; series: string }) => void;
```

Existing callers must continue compiling unchanged.

- [ ] **Step 1: Protect backward compatibility in the contract**

Assert that existing props such as `series`, `verticalMarkers`, `horizontalMarkers`, and `zeroLine` remain present while new optional props appear.

- [ ] **Step 2: Verify RED**

```bash
python3 scripts/visualization_absorption_self_check.py
```

- [ ] **Step 3: Implement compact mode**

Compact mode should reduce plot chrome and height but keep numeric axes readable. It must not change data values or automatic domain calculations.

- [ ] **Step 4: Implement selected point and event markers**

Use the same coordinate transform already used for series points. Selected points and event markers must remain overlays; they must not mutate series arrays.

- [ ] **Step 5: Implement point selection without breaking non-interactive callers**

Only attach pointer handlers when `onPointSelect` exists. Pass the source series label in the callback.

- [ ] **Step 6: Run build and existing analysis self-checks**

```bash
npm run build
python3 scripts/applied_statistics_self_check.py
python3 scripts/time_series_signal_self_check.py
python3 scripts/model_fitting_self_check.py
python3 scripts/experiment_planning_self_check.py
```

- [ ] **Step 7: Commit**

```bash
git add src/EngineeringPlot.tsx src/styles.css src/visual-system.css scripts/visualization_absorption_self_check.py
git commit -m "feat: extend shared engineering plot interactions"
```

---

### Task 5: Add Monitor Signal Health Rail without duplicating primitive algorithms

**Files:**
- Create: `src/SignalHealthRail.tsx`
- Modify: `src/PrimitiveObservatory.tsx`
- Modify: `src/MonitorDataStudio.tsx`
- Modify: `scripts/primitive_observability_self_check.py`
- Modify: `scripts/visualization_absorption_self_check.py`

**Interfaces:**
- `PrimitiveObservatory.tsx` produces a summary type derived from calculations it already owns:

```ts
export type PrimitiveHealthSummary = {
  timing: 'nominal' | 'inspect' | 'unavailable';
  noise: 'nominal' | 'inspect' | 'unavailable';
  trend: 'nominal' | 'inspect' | 'unavailable';
  change: 'nominal' | 'inspect' | 'unavailable';
  decision: 'nominal' | 'active' | 'unavailable';
  agreement: 'consistent' | 'disagreement' | 'parameter-mismatch' | 'host-only' | 'unavailable';
};
```

The summary must be computed from existing primitive results and comparison diagnostics only.

- [ ] **Step 1: Add RED contract assertions**

Require `SignalHealthRail`, all six labels, and preservation of `HOST-DERIVED` / `DEVICE-DERIVED` labels in `PrimitiveObservatory.tsx`.

- [ ] **Step 2: Verify RED**

```bash
python3 scripts/primitive_observability_self_check.py
python3 scripts/visualization_absorption_self_check.py
```

- [ ] **Step 3: Implement summary derivation in the observatory layer**

Do not re-run RMS, regression, change detection, threshold, or host↔device comparison in `SignalHealthRail`. Derive states from the already-computed result objects.

- [ ] **Step 4: Implement `SignalHealthRail`**

Render six compact status cells:

```text
Timing | Noise / RMS | Trend | Change | Decision | Host ↔ Device
```

Use neutral wording such as `nominal`, `inspect`, `active`, `host-only`, and `unavailable`; never label a heuristic warning as hardware failure.

- [ ] **Step 5: Mount in Monitor**

Place the rail above the detailed primitive observatory/detail area. Device data absence must leave the first five host-derived categories usable.

- [ ] **Step 6: Verify build + primitive contracts**

```bash
npm run build
python3 scripts/primitive_observability_self_check.py
python3 scripts/device_primitive_results_self_check.py
python3 scripts/device_primitive_time_origin_self_check.py
python3 scripts/visualization_absorption_self_check.py
```

- [ ] **Step 7: Commit**

```bash
git add src/SignalHealthRail.tsx src/PrimitiveObservatory.tsx src/MonitorDataStudio.tsx scripts/primitive_observability_self_check.py scripts/visualization_absorption_self_check.py
git commit -m "feat: add monitor signal health overview"
```

---

### Task 6: Convert Observatory facts into operational visual summaries

**Files:**
- Create: `src/ObservatoryVisualSummary.tsx`
- Modify: `src/Observatory.tsx`
- Modify: `scripts/observatory_stats_self_check.py`
- Modify: `scripts/visualization_absorption_self_check.py`

**Interfaces:**

```ts
export type ObservatoryVisualData = {
  stages: Array<{ id: string; label: string; state: 'nominal' | 'warning' | 'blocked' | 'unavailable'; detail: string }>;
  sampling: { declaredHz: number | null; observedHz: number | null; deviationPercent: number | null };
  integrity: { numericCoverage: number | null; primaryCoverage: number | null; replayComplete: boolean | null; bridgeReady: boolean | null };
  sessions: Array<{ label: string; createdAt: string; sampleCount: number }>;
  tasks: Array<{ state: string; count: number }>;
};
```

- [ ] **Step 1: Add RED assertions for the four required visualization groups**

Require `Sampling Health`, `Evidence Integrity`, `Session History`, and `Task Activity`, plus all five readiness pipeline labels.

- [ ] **Step 2: Verify RED**

```bash
python3 scripts/observatory_stats_self_check.py
python3 scripts/visualization_absorption_self_check.py
```

- [ ] **Step 3: Build `ObservatoryVisualData` from values already computed in `Observatory.tsx`**

Do not add a new backend endpoint. Map existing `diagnosis`, CLI state, live task state, replay/session state, warnings, rate deviation, coverage, and task history into the visual DTO.

- [ ] **Step 4: Render readiness pipeline**

Render:

```text
Hardware → Runtime / Toolchain → Acquisition → Evidence → Analysis / Handoff
```

with text state plus accessible styling. `blocked` means an existing observation genuinely blocks the stage; do not infer hidden failures.

- [ ] **Step 5: Render Sampling Health and Evidence Integrity**

Use paired values / bars / compact progress indicators. Label coverage as completeness, not calibration quality.

- [ ] **Step 6: Render Session History and Task Activity**

Use compact plots or bars based on existing session metadata and task counts. Separate sessions visually; do not connect them as if they were one continuous physical time series.

- [ ] **Step 7: Verify build + Observatory contracts**

```bash
npm run build
python3 scripts/observatory_stats_self_check.py
python3 scripts/visualization_absorption_self_check.py
```

- [ ] **Step 8: Commit**

```bash
git add src/ObservatoryVisualSummary.tsx src/Observatory.tsx scripts/observatory_stats_self_check.py scripts/visualization_absorption_self_check.py
git commit -m "feat: visualize Observatory operational state"
```

---

### Task 7: Absorb existing numerical analyzer results into normal preparation UI

**Files:**
- Create: `src/NumericalResultVisualization.tsx`
- Modify: `src/EngineeringPreparationStudio.tsx`
- Modify: only the smallest Tauri/backend adapter file needed if existing analyzer output is not yet callable from the UI.
- Inspect before coding: `scripts/bench02_numerical_error.py`, `scripts/bench03_embedded_numerical.py`, `scripts/numeric_error_campaign_analyzer.py`, `scripts/numerical_microbench_analyzer.py`, `scripts/esp32_irregular_dt_analyzer.py`, `scripts/esp32_condition_compare.py`, `scripts/esp32_concurrency_numerics_analyzer.py`, `scripts/esp32_numerical_research_analyzer.py`.
- Modify: `scripts/numerical_depth_self_check.py` and/or `scripts/numeric_error_campaign_self_check.py` only where needed to protect exposed result schema.

**Interfaces:**
- The adapter must model only fields verified in analyzer output. A representative frontend shape is allowed only after inspection, for example:

```ts
type NumericalVisualResult = {
  sourceLabel: string;
  producer: 'MCU' | 'MEASURED' | 'HOST-REFERENCE' | 'DERIVED-COMPARISON';
  series: Array<{ label: string; points: Array<{ x: number; y: number }> }>;
  metrics: Array<{ label: string; value: number | string; unit?: string }>;
  events?: Array<{ x: number; label: string }>;
  notes?: string[];
};
```

Do not implement this exact shape until analyzer inspection confirms how to populate it.

- [ ] **Step 1: Inspect every analyzer's actual output schema**

Record concrete JSON/CSV/stdout fields in the implementation notes in the commit message or code comments where adapters parse them. If an analyzer produces only files and no stable machine-readable summary, expose only what can be parsed deterministically from those files.

- [ ] **Step 2: Add a failing contract for the first promoted result family**

Start with one complete family, preferably Bench 02 sampling/numerical error, and assert that normal preparation mounts `NumericalResultVisualization` outside the Advanced details block.

- [ ] **Step 3: Verify RED**

```bash
python3 scripts/numerical_depth_self_check.py
python3 scripts/numeric_error_campaign_self_check.py
python3 scripts/visualization_absorption_self_check.py
```

- [ ] **Step 4: Implement the smallest analyzer-to-UI adapter**

Reuse existing analyzer computations. If execution must be invoked from Tauri, add one narrow command that runs the existing script and returns its stable output; do not port the scientific algorithm into TypeScript.

- [ ] **Step 5: Visualize verified result families**

Prioritize existing outputs for timing/downsampling, derivative/integration sensitivity, quantization, Taylor error/range reduction/cancellation, false convergence, execution time, and irregular-`dt` only when their schemas are verified.

Every chart/metric must label producer provenance.

- [ ] **Step 6: Keep maintenance controls Advanced**

Analyzer paths, raw commands, direct maintenance controls, and implementation ledgers remain under existing Advanced/implementation details.

- [ ] **Step 7: Verify build + numerical checks**

```bash
npm run build
python3 scripts/bench02_self_check.py
python3 scripts/bench03_self_check.py
python3 scripts/numerical_depth_self_check.py
python3 scripts/numeric_error_campaign_self_check.py
python3 scripts/visualization_absorption_self_check.py
```

- [ ] **Step 8: Commit**

```bash
git add src/NumericalResultVisualization.tsx src/EngineeringPreparationStudio.tsx src-tauri/src scripts/numerical_depth_self_check.py scripts/numeric_error_campaign_self_check.py scripts/visualization_absorption_self_check.py
git commit -m "feat: surface numerical analysis results in preparation UI"
```

---

### Task 8: Absorb existing magnetic analyzer results into normal preparation UI

**Files:**
- Create: `src/MagnetResultVisualization.tsx`
- Modify: `src/EngineeringPreparationStudio.tsx`
- Inspect before coding: `scripts/magnet02_characterization.py`, `scripts/magnet03_model_validation.py`.
- Modify: the smallest existing magnetic self-check protecting the UI/schema boundary.

**Interfaces:**
- Consume only analyzer outputs verified in the two magnetic scripts.
- Preserve separate labels for measured sensor values, calibration assumptions, model predictions, and residuals.

- [ ] **Step 1: Inspect magnetic analyzer outputs**

Identify exact fields/files for field characterization, magnitude/components, model comparison, residuals, and any spatial scan outputs.

- [ ] **Step 2: Add RED assertions**

Require `MagnetResultVisualization` to appear in the normal magnetic preparation lane, outside Advanced maintenance controls.

- [ ] **Step 3: Verify RED**

```bash
python3 scripts/magnet_bench_self_check.py
python3 scripts/visualization_absorption_self_check.py
```

- [ ] **Step 4: Implement the adapter and visuals**

Use `EngineeringPlot` for measured-vs-model and residual/spatial series when appropriate. Do not manufacture calibrated units if the analyzer/source metadata does not establish calibration.

- [ ] **Step 5: Verify build + magnetic checks**

```bash
npm run build
python3 scripts/magnet_bench_self_check.py
python3 scripts/visualization_absorption_self_check.py
```

- [ ] **Step 6: Commit**

```bash
git add src/MagnetResultVisualization.tsx src/EngineeringPreparationStudio.tsx scripts/magnet_bench_self_check.py scripts/visualization_absorption_self_check.py
git commit -m "feat: surface magnetic validation results in preparation UI"
```

---

### Task 9: Add Experiments campaign visualization without duplicating controls

**Files:**
- Create: `src/CampaignVisualization.tsx`
- Modify: `src/ExperimentsHub.tsx`
- Modify: `scripts/visualization_absorption_self_check.py`

**Interfaces:**

```ts
export type CampaignStage = {
  id: string;
  label: string;
  state: 'available' | 'evidence-present' | 'reference-present' | 'not-observed';
  detail: string;
};

export type MechanismCoverageRow = {
  mechanism: string;
  mcuEvidence: string;
  hostReference: string;
  visualResult: string;
};
```

Values must be based on actual campaign support/evidence state; strings must not claim completed physical validation merely because code exists.

- [ ] **Step 1: Add failing campaign-visual assertions**

Require `CampaignVisualization`, the five-stage flow labels, and mechanism names already present in the campaign family.

- [ ] **Step 2: Verify RED**

```bash
python3 scripts/visualization_absorption_self_check.py
```

- [ ] **Step 3: Implement campaign flow**

Render:

```text
Physical source → Embedded mechanism → Evidence → Independent host reference → Reliability / validation decision
```

Use availability/evidence language, not pass/fail truth claims.

- [ ] **Step 4: Implement Numeric Error Depth coverage matrix**

Rows may include Sampling, Quantization, Cancellation, Integration, Derivative, Taylor, Event timing, and Floating accumulation only where current campaign definitions/analyzers support them.

- [ ] **Step 5: Keep expert paths available but secondary**

Do not delete firmware/analyzer paths or campaign commands already present in `ExperimentsHub`; place the new scientific overview before those implementation details.

- [ ] **Step 6: Verify build + contracts**

```bash
npm run build
python3 scripts/numeric_error_campaign_self_check.py
python3 scripts/visualization_absorption_self_check.py
```

- [ ] **Step 7: Commit**

```bash
git add src/CampaignVisualization.tsx src/ExperimentsHub.tsx scripts/visualization_absorption_self_check.py
git commit -m "feat: add campaign-level experiment visualization"
```

---

### Task 10: Responsive visual consistency and exact-head verification

**Files:**
- Modify: existing shared CSS files only where required by the new Phase 5 components.
- Modify: `scripts/visualization_absorption_self_check.py` if final structural names changed during implementation.

**Interfaces:**
- No new scientific interfaces.
- Final deliverable is the complete Phase 5 UI passing all existing gates.

- [ ] **Step 1: Check responsive behavior structurally**

Ensure new rails/grids use wrapping or responsive grid patterns and do not force fixed desktop-only widths. Keep labels visible at narrow widths rather than hiding provenance.

- [ ] **Step 2: Run TypeScript/Vite build**

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 3: Run the complete Python contract suite**

```bash
python3 scripts/run_contract_self_checks.py
```

Expected: PASS with the Phase 5 check included after the prior 28 checks.

- [ ] **Step 4: Run targeted scientific checks again**

```bash
python3 scripts/applied_statistics_self_check.py
python3 scripts/time_series_signal_self_check.py
python3 scripts/model_fitting_self_check.py
python3 scripts/experiment_planning_self_check.py
python3 scripts/observatory_stats_self_check.py
python3 scripts/primitive_observability_self_check.py
python3 scripts/device_primitive_results_self_check.py
python3 scripts/device_primitive_time_origin_self_check.py
python3 scripts/numerical_depth_self_check.py
python3 scripts/numeric_error_campaign_self_check.py
python3 scripts/magnet_bench_self_check.py
```

Expected: all PASS.

- [ ] **Step 5: Run Tauri/Rust validation**

Use the repository's existing CI-equivalent Rust check command. Do not omit this step if Task 7 or 8 adds/changes a Tauri invoke adapter.

- [ ] **Step 6: Push/commit final consistency cleanup**

```bash
git add src scripts src-tauri docs
git commit -m "polish: unify BetterBoard visualization surfaces"
```

If there is no cleanup diff, do not create an empty commit.

- [ ] **Step 7: Verify exact branch head in GitHub Actions**

Confirm the current PR head SHA and inspect all workflows triggered for that exact SHA. At minimum require:

- BetterBoard main CI green;
- BetterBoard C++ Core green when triggered;
- Engineering Lab Experiments green when triggered;
- Sensor Suite integrity green when triggered.

Do not claim completion from an older green run.

---

## Self-Review

### Spec coverage

- Shared Evidence Visualization Context → Task 2.
- Studio Analysis & Visualization navigation → Task 3.
- EngineeringPlot v3 → Task 4.
- Monitor Signal Health → Task 5.
- Observatory visual upgrade → Task 6.
- Numerical hidden-result absorption → Task 7.
- Magnetic hidden-result absorption → Task 8.
- Experiments campaign visualization → Task 9.
- Responsive/visual consistency and complete regression → Task 10.
- Raw evidence/provenance boundaries → Global Constraints + Tasks 1, 2, 5, 7, 8, 9.
- Manual external CSV/TSV compatibility → Task 2.

### Placeholder scan

The plan intentionally requires analyzer inspection before defining adapter fields because the design explicitly forbids inventing analyzer outputs. That is not an implementation placeholder: Task 7 and Task 8 specify the exact files to inspect, the invariant frontend provenance shape, the required test gate, and the rule for exposing only deterministically verified fields.

### Type consistency

- `EvidenceVisualizationSource` and `EvidenceVisualizationContextValue` are defined once in Task 2 and consumed by Tasks 3 and downstream workbenches.
- `PrimitiveHealthSummary` is defined in Task 5 and consumed only by `SignalHealthRail`.
- `ObservatoryVisualData` is defined in Task 6 and consumed only by `ObservatoryVisualSummary`.
- Numerical/magnetic adapters intentionally defer exact analyzer-field names until repository inspection because those names must match real analyzer output rather than a speculative design.
