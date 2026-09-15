# Phase 5 Design — Visualization Absorption & Unified Analysis UI

Date: 2026-09-15
Status: Approved architecture, implementation not started
Branch: `ui/analysis-visualization-integration-a9`
PR: #66

## 1. Purpose

BetterBoard already contains a substantial amount of scientific analysis, engineering visualization, evidence inspection, and experiment-planning capability. The current limitation is primarily product architecture: many mature analysis surfaces are stacked vertically, some scientific results remain hidden behind advanced/maintenance controls, and several workbenches independently import the same evidence instead of sharing one selected run.

Phase 5 restructures those existing capabilities into a coherent visualization system without silently replacing validated algorithms, altering raw evidence, or collapsing provenance boundaries.

The design principle is:

> Expose existing scientific capability before inventing new scientific capability.

## 2. Goals

Phase 5 will:

1. Organize the existing analysis workbenches into a discoverable Analysis & Visualization navigation layer inside Studio.
2. Introduce a shared selected-evidence context so one measurement session can feed multiple analysis surfaces without repeated imports.
3. Upgrade Monitor & Data with a compact Signal Health overview above detailed plots.
4. Upgrade System Observatory from mostly KPI/fact cards into an operational visualization surface using metrics it already computes.
5. Surface scientific outputs currently buried in numerical and magnetic advanced/maintenance paths inside their normal preparation suites.
6. Turn Experiments into a campaign-level visualization surface rather than a duplicate preparation/runtime control surface.
7. Extend the shared `EngineeringPlot` component only where existing data requires richer interaction or annotation.
8. Preserve raw evidence, provenance, existing scientific meanings, and legacy import paths.

## 3. Non-goals

Phase 5 will not:

- replace validated statistics, regression, DOE, numerical, magnetic, or primitive-observability algorithms;
- change raw measurement CSV contents or evidence package semantics;
- mix derived analysis results into immutable sensor evidence;
- redesign firmware protocols as part of this phase;
- add a new top-level workspace solely for visualization;
- introduce a second plotting library unless the current shared plot cannot represent an existing required result;
- add decorative 3D, animation, or log-scale controls without a concrete scientific use case already present in repository analyzers;
- remove manual CSV/TSV import, which remains necessary for external evidence;
- merge or rename the existing `Studio`, `Observatory`, or `Experiments` top-level workspace boundaries.

## 4. Existing product structure

The application currently has three top-level workspaces:

- Studio
- Observatory
- Experiments

Studio contains its own operational tabs:

- Hardware & Program
- Circuit Lab
- Recipe Library
- Monitor & Data
- Developer

The root Studio pane additionally mounts several large analysis/preparation workbenches in sequence:

- Evidence Inspector
- Applied Statistics & Uncertainty
- Parameter Estimation & Model Comparison
- DOE & Sequential Experiment Planning
- Numerical Error Visual Workbench
- Engineering Preparation

This creates excessive vertical stacking and weak discoverability even though the individual analysis modules are already mature.

## 5. Architectural decision

Use **Visualization Absorption Architecture**.

Do not add a fourth top-level workspace. Instead, keep the current three-workspace model and absorb existing analysis capabilities into the surface where their engineering meaning belongs.

### 5.1 Studio

Studio remains the end-to-end engineering workflow:

`Connect → Program → Monitor → Evidence → Analyze → Prepare/Handoff`

Studio gains an explicit **Analysis & Visualization** navigation layer with the following views:

- Evidence
- Signal & Statistics
- Models
- Experiment Design
- Numerical Reliability
- Engineering Preparation

These views reuse existing components rather than cloning their logic.

### 5.2 Observatory

Observatory remains read-mostly system and evidence observability. It receives operational charts and readiness visualizations derived only from state it already collects or can load from existing measurement/session metadata.

### 5.3 Experiments

Experiments remains campaign-centric. It should visualize campaign structure, mechanism coverage, evidence status, and host-reference relationships, while preparation tools and maintenance controls stay in Studio.

## 6. Shared Evidence Visualization Context

### 6.1 Problem

Applied Statistics, Model Fitting, and Experiment Planning each currently own independent file import state. A user analyzing one saved BetterBoard run must repeatedly select/import the same data.

### 6.2 Decision

Introduce a shared `EvidenceVisualizationContext` in the frontend.

It represents one selected evidence source and exposes normalized metadata to downstream analysis surfaces.

Suggested shape:

```ts
type EvidenceSourceKind = 'measurement-session' | 'external-table';

type EvidenceVisualizationSource = {
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
```

The exact public type may be refined during implementation, but the semantic requirements are fixed:

- source identity must be explicit;
- units and sampling metadata must remain associated with the table when known;
- a saved BetterBoard measurement must retain its evidence/provenance identity;
- an external imported file must be labeled as external, not silently treated as BetterBoard evidence;
- derived results remain downstream and are not written back into the source object.

### 6.3 Data flow

```text
Monitor / Saved Measurement / External CSV
                 ↓
      EvidenceVisualizationContext
                 ↓
      ┌──────────┼───────────┐
      ↓          ↓           ↓
 Statistics   Model Fit      DOE
      ↓          ↓           ↓
 Numerical   Magnet      Preparation
```

### 6.4 Compatibility

Each analysis workbench keeps its manual CSV/TSV import affordance.

When a shared BetterBoard source is selected, the workbench defaults to it. Manual import may replace the current analysis source locally or update the shared external source, depending on the final component API, but the UI must make the active source obvious.

No existing analysis should begin silently on a different dataset than the one named in the source header.

## 7. Studio Analysis & Visualization navigation

### 7.1 Interaction model

Replace the root-level sequence of large analysis panels with a compact navigator plus one active analysis surface at a time.

Recommended navigation:

```text
Analysis & Visualization
[ Evidence ] [ Signal & Statistics ] [ Models ]
[ Experiment Design ] [ Numerical Reliability ] [ Engineering Preparation ]
```

The navigation can be tabs, segmented cards, or another compact persistent control, but it must:

- preserve component state when practical;
- show the active evidence source;
- avoid rendering all heavyweight analysis workbenches simultaneously;
- remain within Studio rather than creating a new top-level workspace.

### 7.2 View mapping

| Navigation view | Existing primary component(s) |
| --- | --- |
| Evidence | `EvidenceInspector` |
| Signal & Statistics | `AppliedStatisticsWorkbench` |
| Models | `ModelFittingWorkbench` |
| Experiment Design | `ExperimentPlanningWorkbench` |
| Numerical Reliability | `NumericalErrorVisualWorkbench` and numerical preparation entry points |
| Engineering Preparation | `EngineeringPreparationStudio` |

No scientific output should be removed merely because navigation changes.

## 8. Monitor & Data — Signal Health overview

Primitive Observatory remains the detailed host/device-derived observability surface.

Phase 5 adds a compact **Signal Health Rail** above detailed primitive/diagnostic sections.

Required health categories:

- Timing
- Noise / RMS
- Trend
- Change
- Decision
- Host ↔ Device agreement, when device-derived primitive results are available

The rail is a summary/navigation layer, not a separate algorithm engine.

### 8.1 Rules

- Derive health indicators from already computed monitor/primitive results.
- Clicking/activating a health item should lead to or emphasize the corresponding detailed visualization.
- Never convert a warning heuristic into a claim of hardware failure.
- When device data is unavailable, host-only observability remains fully functional.
- Preserve explicit `HOST-DERIVED` and `DEVICE-DERIVED` provenance.

## 9. Observatory visualization upgrade

Observatory already derives operational quantities including sample-rate deviation, numeric coverage, primary-channel coverage, evidence replay completeness, bridge readiness, stale snapshot state, background-task failures, session counts, and total samples.

Phase 5 visualizes these existing quantities rather than adding a new backend monitoring system.

### 9.1 System pipeline view

Add a compact readiness pipeline:

```text
Hardware
   ↓
Runtime / Toolchain
   ↓
Acquisition
   ↓
Evidence
   ↓
Analysis / Handoff
```

Each stage receives a state such as:

- nominal
- warning
- blocked / needs attention
- unavailable

The state must be based on existing diagnoses/observations; it must not invent hidden health information.

### 9.2 Sampling Health

Visualize:

- declared sample rate;
- observed sample rate;
- percent deviation;
- availability/insufficient-data state.

A compact comparison bar, gauge-like comparison, or paired value visualization is acceptable. Avoid analog-gauge decoration that reduces quantitative readability.

### 9.3 Evidence Integrity

Visualize, when available:

- numeric-row coverage;
- primary-channel finite-row coverage;
- replay completeness;
- Engineering Lab bridge readiness.

These are evidence completeness diagnostics, not physical calibration metrics.

### 9.4 Session History

Use saved measurement-session metadata to show a compact history of recent runs, including at minimum:

- time/order;
- recipe/session identity;
- sample count.

Optional metadata already present in the session record may be shown, but the chart must not imply continuous time-series continuity between separate sessions.

### 9.5 Task Activity

Visualize recent task state counts/history using existing Task Center memory:

- running;
- done;
- failed;
- cancelled, if present.

This is operational activity, not experiment evidence.

## 10. Numerical result absorption

### 10.1 Problem

The repository contains numerical analysis scripts and advanced tools that produce scientifically useful outputs, while normal preparation surfaces often expose only instructions, paths, terminal previews, or maintenance controls.

### 10.2 Decision

Apply this boundary:

> Hide maintenance complexity, not scientific results.

Normal numerical preparation surfaces should visualize analyzer results that already exist and are stable enough to expose.

Maintenance-only controls remain inside Advanced/implementation details.

### 10.3 Result families eligible for normal visualization

Existing repository analyzers indicate the following families:

- sampling interval / timing jitter;
- downsampling effects;
- finite-difference sensitivity;
- integration convergence;
- ADC/quantization structure;
- float32 vs float64 accumulation;
- Taylor approximation error;
- range-reduction comparison;
- cancellation diagnostics;
- stopping/false-convergence state;
- execution-time evidence;
- event timing/drop behavior;
- irregular-`dt` analysis;
- condition comparison;
- concurrency/numerical behavior where analyzer output exists.

The implementation plan must verify each analyzer's concrete output schema before adding a visual surface. This design does not authorize inventing result fields that the scripts do not emit.

### 10.4 Provenance

Numerical visuals must distinguish at least:

- MCU/embedded observations;
- measured evidence;
- independent host reference/oracle;
- derived comparison/error metrics.

A visually smooth host curve must never be presented as raw device evidence.

## 11. Magnetic result absorption

Magnetic preparation follows the same rule as numerical preparation.

Scientific outputs already generated by magnetic characterization/model-validation workflows should be promoted into normal visualization surfaces, while direct analyzer paths and maintenance controls remain Advanced.

Candidate result classes include only what repository analyzers actually produce, such as:

- field characterization;
- component/magnitude summaries;
- measured-versus-model comparisons;
- residual structure;
- spatial scan characterization;
- validation diagnostics.

The implementation plan must inspect `magnet02_characterization.py` and `magnet03_model_validation.py` before defining exact UI fields.

Calibration assumptions must remain visibly distinct from measured sensor values and model predictions.

## 12. Experiments campaign visualization

Experiments must remain campaign-level, not become another control panel for capture/upload/analyzer execution.

### 12.1 Campaign flow

For relevant campaigns, visualize:

```text
Physical source
      ↓
Embedded mechanism
      ↓
Evidence
      ↓
Independent host reference
      ↓
Reliability / validation decision
```

### 12.2 Numeric Error Depth mechanism matrix

Add a mechanism-coverage view for existing campaign families, for example:

| Mechanism | MCU evidence | Host reference | Visual result |
| --- | --- | --- | --- |
| Sampling | status | status | aliasing / Δt |
| Quantization | status | status | error structure |
| Cancellation | status | status | cancellation diagnostic |
| Integration | status | status | convergence |
| Derivative | status | status | sensitivity |
| Taylor | status | status | approximation error |
| Event timing | status | status | timing / drop |
| Floating accumulation | status | status | accumulation drift |

The final matrix values must come from actual campaign support/evidence, not hard-coded claims of completed physical validation.

### 12.3 No duplicated controls

Firmware paths, analyzer paths, direct commands, and implementation controls may remain available in advanced/maintenance details, but the primary Experiments surface should communicate scientific campaign structure and evidence state.

## 13. `EngineeringPlot` v3

The existing shared `EngineeringPlot` remains the plotting foundation.

Extend it only for use cases required by existing BetterBoard data.

Candidate v3 capabilities:

- compact/sparkline mode;
- persistent selected point/marker;
- optional synchronized cursor contract across related plots;
- standardized uncertainty/confidence band rendering;
- standardized event/alarm markers;
- richer tooltip fields for value, coordinate/time, source, and producer;
- consistent legend semantics for `MEASURED`, `HOST-DERIVED`, `DEVICE-DERIVED`, `MODEL`, and `REFERENCE` when applicable;
- responsive small-multiple composition.

### 13.1 Plot semantic rules

- Labels must identify physical units when known.
- Different producers/sources must not be distinguishable by color alone; use labels, line/marker semantics, or other redundant encoding.
- A reference/model line must not look identical to raw evidence.
- Alarm/event markers must not obscure the underlying signal.
- Compact plots must preserve numeric readability over decoration.

## 14. Data and provenance boundaries

Phase 5 keeps four layers conceptually separate:

1. **Raw evidence** — captured rows, timestamps, immutable measurement files.
2. **Metadata/provenance** — recipe, units, board/session identity, source labels.
3. **Derived analysis** — statistics, models, primitives, numerical/magnetic diagnostics.
4. **Interpretation/decision support** — warnings, recommendations, planning suggestions.

The UI may show these layers together for comparison, but must label them and must not write layers 3 or 4 back into layer 1.

## 15. Error and empty states

Every visualization must support explicit empty/partial states.

Examples:

- no evidence selected;
- insufficient samples;
- missing units;
- unknown sample rate;
- analyzer output unavailable;
- device-derived results unavailable;
- saved replay incomplete;
- external table has no BetterBoard provenance.

The UI should degrade to available evidence rather than hiding the entire workbench when one diagnostic cannot run.

## 16. Performance constraints

- Heavy workbenches should not all render active plots simultaneously when they are not visible.
- Existing plot-point caps/downsampling behavior may remain for display, but analysis semantics must not silently switch from full evidence to display-downsampled data unless that behavior is explicitly intended by the underlying module.
- Shared evidence context should avoid repeatedly reparsing the same saved table for each visible workbench.
- Observatory refresh cadence must not be made materially more expensive merely to animate charts.

## 17. Accessibility and responsive behavior

- Navigation and plot controls must remain keyboard reachable.
- Status must not rely on color alone.
- Small screens may stack cards/plots vertically, but source/provenance labels must stay visible.
- Tables remain available where exact values matter; charts supplement rather than replace exact-value access.

## 18. Testing strategy

Implementation will use TDD/contract checks appropriate to each layer.

### 18.1 Structural/UI contract tests

Protect:

- Analysis & Visualization navigation exists;
- existing workbenches remain reachable;
- only the selected heavyweight analysis surface is active/rendered where intended;
- active evidence source/provenance is visible;
- manual import remains supported.

### 18.2 Shared evidence context tests

Verify:

- saved measurement normalization;
- external table normalization;
- units/sample-rate/provenance preservation;
- source switching;
- no mutation of raw evidence by downstream results.

### 18.3 Observatory tests

Verify known synthetic/session states produce expected:

- pipeline readiness states;
- sample-rate deviation;
- evidence-integrity percentages;
- session-history points;
- task-state summaries.

### 18.4 Plot tests

Protect new `EngineeringPlot` semantics such as:

- producer/source labels;
- event markers;
- uncertainty band geometry;
- compact mode behavior;
- synchronized cursor contract if implemented.

### 18.5 Numerical/magnetic absorption tests

For each promoted analyzer output:

- use a deterministic fixture or existing self-check fixture;
- verify parser/adapter mapping;
- verify provenance labels;
- verify missing/partial analyzer output degrades safely;
- do not duplicate scientific calculations in UI tests.

### 18.6 Regression verification

Before completion:

- TypeScript/Vite build;
- Python contract/self-check suite;
- existing numerical/magnetic self-checks affected by adapters;
- Rust/Tauri check if backend commands change;
- existing firmware compile gates if touched;
- current PR GitHub Actions must be green at the final implementation head.

## 19. Migration sequence

The preferred implementation sequence is:

1. Shared Evidence Visualization Context.
2. Studio Analysis & Visualization navigation and workbench routing.
3. `EngineeringPlot` v3 primitives needed by later surfaces.
4. Monitor Signal Health overview.
5. Observatory visualization upgrade.
6. Numerical analyzer result adapters and normal-surface absorption.
7. Magnetic analyzer result adapters and normal-surface absorption.
8. Experiments campaign visualization.
9. Visual consistency/responsive pass.
10. Full regression verification.

This order minimizes duplicated data plumbing and avoids building new visual surfaces before shared evidence and plot semantics exist.

## 20. Acceptance criteria

Phase 5 is complete when:

- Studio no longer presents all large analysis workbenches as one undifferentiated vertical stack;
- one selected BetterBoard evidence session can flow into multiple analysis views without repeated file selection;
- active dataset/provenance remains visible in analysis surfaces;
- Monitor exposes a compact signal-health overview while preserving detailed primitive observability;
- Observatory visually communicates system pipeline state, sampling health, evidence integrity, session history, and task activity from existing observations;
- useful numerical and magnetic scientific results are visible in normal preparation flows instead of being available only as advanced analyzer paths/terminal output;
- Experiments communicates campaign/evidence structure without duplicating preparation controls;
- shared plots use consistent source/producer semantics;
- raw evidence remains unchanged;
- all touched contracts/builds/self-checks pass.

## 21. Deferred ideas

The following are intentionally deferred unless a concrete existing dataset requires them during implementation:

- log-axis support;
- 3D plots;
- generalized arbitrary dashboard builder;
- persistent custom visualization layouts;
- cross-session statistical comparison framework;
- full plugin architecture for external analyzers;
- device firmware protocol redesign;
- automated claims of calibration or physical correctness.
