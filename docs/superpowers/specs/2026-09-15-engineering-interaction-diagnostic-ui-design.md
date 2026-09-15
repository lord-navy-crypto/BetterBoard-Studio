# Phase 6 — Engineering Interaction & Diagnostic UI

## Status

Approved design direction for the existing BetterBoard Studio feature branch `ui/analysis-visualization-integration-a9` / PR #66.

This phase is an interaction and diagnostic-visualization pass over existing engineering capabilities. It must not introduce new scientific algorithms, silently change evidence semantics, or replace established hardware / analysis engines.

## Goal

Turn BetterBoard from a collection of capable engineering surfaces into a coherent engineering workstation where users can understand where they are, what is happening, why something failed, what evidence they are looking at, and what to inspect next.

This phase closes the remaining UI/visualization gaps rather than adding more hidden backend capability.

## Core design principle

> Reuse existing structured state and make relationships visible. Do not duplicate diagnosis engines or scientific logic to make a nicer UI.

The canonical source of truth remains where it already lives:

- Hardware readiness: `HardwareSession`, Hardware Doctor diagnosis, selected/detected FQBN, preflight.
- Circuit correctness: existing `CircuitLab` `runRuleChecker()` output.
- Background work: existing `BackgroundTask` / Task Center state.
- Developer diagnostics: existing compile-output parser and Monaco diagnostics.
- Signal analysis: canonical `PrimitiveObservatory` / `computeHostPrimitiveObservability` results and device-result comparison.
- Evidence: existing immutable measurement/replay records and shared evidence context.
- Experiment firmware/tools: repository-driven Complete Experiment Code Library and existing compile/upload backend.

## Success criteria

A successful implementation must make all of the following true:

1. A user can tell the current engineering state at a glance: toolchain, hardware, firmware/runtime, acquisition, evidence, and analysis.
2. The old five-stage status display is no longer decorative-looking; every stage is clearly labeled as live status and acts as navigation into the owning surface.
3. Hardware state is shown as an explicit topology/chain rather than scattered text.
4. Task Center shows actionable operation progress, elapsed time, failure location, logs, retry/navigation actions, and recent history.
5. Circuit Lab diagnostics visually identify the affected wire/net/pin/component using existing rule-check results.
6. Developer can be used as an engineering split view: source on one side, target/runtime/build/diagnostics on the other, with diagnostic-to-line navigation.
7. Engineering plots share selected time/x positions and selected intervals, so related plots inspect the same evidence point/range.
8. Range brushing changes viewport/inspection only; it never mutates raw evidence.
9. Run A ↔ Run B comparison is available for compatible evidence sessions without merging or rewriting their evidence.
10. User annotations/bookmarks are visibly distinct from measured, host-derived, device-derived, and model/reference data.
11. Analysis & Visualization has a strong source → lens → inspection → active-content hierarchy, reducing confusion between Evidence, Signal & Statistics, Models, Experiment Design, Numerical Reliability, and Engineering Preparation.
12. Experiments clearly separates campaign/run surfaces from the Complete Experiment Code Library while keeping all real firmware/analyzer code visible and actionable.
13. Focus/Presentation mode reduces interface noise without hiding provenance, errors, axes, units, or target state.
14. Existing Experiment, Evidence, Statistics, Models, DOE, Numerical Reliability, Engineering Preparation, Primitive Observatory, firmware verify/upload, acquisition, and replay functionality remain intact.
15. The periodic Arduino CLI polling that caused app-wide stalls must not return.

## Non-goals

This phase does not add:

- new scientific/statistical algorithms;
- automatic AI circuit repair;
- automatic code editing;
- a new evidence package schema;
- a second compiler/upload implementation;
- arbitrary dockable desktop windows;
- 3D circuit visualization;
- SPICE/electrical simulation;
- a full IDE rewrite;
- automatic serial-port acquisition after upload;
- decorative animation that consumes engineering attention;
- automatic mutation of raw evidence.

## Architectural approach

### Selected approach: Shared Interaction Layer

Three approaches were considered:

1. **Polish-only** — improve spacing, typography, cards, and colors. Lowest risk, but it does not solve navigation, diagnostic tracing, cross-plot inspection, passive status widgets, or run comparison.
2. **Shared interaction layer** — preserve existing scientific engines and backend commands while adding small shared contexts for navigation, plot inspection, comparison, annotations, and operation status. This is selected because it fixes product coherence without rewriting scientific logic.
3. **Full workstation rewrite** — replace the top-level application shell and most feature surfaces. This has unacceptable regression risk given the number of already validated capabilities.

Implementation must therefore prefer adapters and shared contexts over replacement engines.

## Product information architecture

BetterBoard should present one visible engineering chain:

`Toolchain → Hardware → Firmware / Runtime → Acquisition → Evidence → Analysis`

Each stage owns a status and a navigation destination.

Allowed stage states are exactly:

- `READY`
- `ACTIVE`
- `WARNING`
- `BLOCKED`
- `UNAVAILABLE`

There is no synthetic numeric health score.

### Stage ownership

- **Toolchain**: Arduino CLI, selected FQBN/profile, core/library readiness, preflight state.
- **Hardware**: detected physical board/port and Hardware Doctor diagnosis.
- **Firmware / Runtime**: prepared sketch/runtime and compile/upload state.
- **Acquisition**: Monitor/live/replay/capture state.
- **Evidence**: selected/current Measurement Session or external table, provenance completeness.
- **Analysis**: selected analysis lens and derived-output readiness.

Clicking a stage navigates to the owning BetterBoard surface. It never automatically advances a process or performs a destructive action.

The old five-step display must therefore be relabeled as a live status/navigation chain rather than a wizard.

## Shared semantic navigation

Introduce `EngineeringNavigationContext` instead of passing arbitrary tab setters through the component tree.

```ts
export type EngineeringDestination =
  | 'hardware'
  | 'circuit'
  | 'library'
  | 'monitor'
  | 'developer'
  | 'experiments'
  | 'evidence'
  | 'statistics'
  | 'models'
  | 'experiment-design'
  | 'numerical'
  | 'preparation';

export type EngineeringNavigationContextValue = {
  destination: EngineeringDestination | null;
  navigate: (destination: EngineeringDestination) => void;
};
```

`App.tsx`, `AnalysisVisualizationHub.tsx`, and `ExperimentsHub.tsx` consume semantic navigation requests and activate their existing local tab/view state.

This context does not own scientific state.

## 1. Engineering Status Map

Create `EngineeringStatusMap.tsx` as the canonical top-level status/navigation surface.

It consumes existing states only:

- HardwareSession / Hardware Doctor;
- preflight and target state from App;
- active Task Center tasks;
- Monitor/acquisition state;
- EvidenceVisualizationContext;
- analysis view state.

It must not compute scientific validity.

Each stage shows:

- allowed state enum;
- short primary reason;
- optional secondary detail;
- navigation action.

Examples:

- `Hardware · WARNING · USB device detected, board model unidentified`
- `Evidence · READY · Session 2026-09-15 / 4 channels`
- `Analysis · ACTIVE · Numerical Reliability`

## 2. Hardware Topology

Create `HardwareTopology.tsx` using existing HardwareSession and preflight data.

Primary chain:

`USB device → detected board → selected FQBN → Arduino core → required libraries → selected firmware`

Rules:

- detected-vs-selected mismatch is rendered as a broken edge;
- unknown hardware is shown as unknown, never guessed;
- missing core/library is a blocked topology node;
- Hardware Doctor remains the authority for compile/upload gating;
- topology is diagnostic visualization only and never silently changes FQBN, installs packages, or uploads firmware;
- existing explicit repair actions may be linked from the relevant node.

## 3. Shared Plot Inspection

Create `PlotInspectionContext.tsx`.

```ts
export type InspectionSelection = {
  sourceId: string | null;
  x: number | null;
  interval: { start: number; end: number } | null;
};

export type PlotAnnotation = {
  id: string;
  sourceId: string;
  x: number;
  label: string;
  createdAt: number;
};
```

The context owns only interaction state:

- selected x/time;
- selected interval;
- source identity;
- reset action;
- session-local annotations.

It does not own evidence rows or derived calculations.

### EngineeringPlot v4

Extend the existing EngineeringPlot rather than replacing it.

New optional props:

```ts
inspectionSourceId?: string;
sharedCursorX?: number | null;
selectedInterval?: { start: number; end: number } | null;
onCursorChange?: (x: number | null) => void;
onIntervalChange?: (interval: { start: number; end: number } | null) => void;
annotations?: EngineeringPlotAnnotation[];
```

Required behavior:

- click/tap selects the nearest valid x location;
- cursor selection persists until changed/reset;
- plots bound to the same sourceId show the same vertical cursor;
- optional tooltip/readout shows values from each visible series at or nearest selected x;
- pointer drag can select an x interval;
- a non-drag accessible alternative allows setting/clearing interval bounds;
- interval selection changes viewport/inspection only and never changes raw source rows;
- Reset inspection clears cursor and interval;
- existing point selection, markers, bands, freeze, hidden series, scatter, stem, and line behavior remain compatible.

### Primitive Observatory integration

All time-aligned primitive plots share the same inspection context:

- raw signal;
- RMS;
- derivative;
- integral;
- EMA;
- peak hold;
- threshold state;
- hysteresis state;
- regression/change-event traces where applicable.

When both host and device values exist, producer identity remains explicit. Alignment semantics must match the canonical host↔device comparison helper; the UI must not invent exact interpolation.

## 4. Cross-Plot Diagnostic Readout

Create `InspectionReadout.tsx` for the selected x/time.

It consumes already-computed series/results and may display:

```text
t = 2.431 s
Raw          0.183 T
Host EMA     0.176 T
Device EMA   0.175 T
|Δ|          0.001 T
Threshold    OFF / OFF
```

Producer labels remain explicit:

- `MEASURED`
- `HOST-DERIVED`
- `DEVICE-DERIVED`
- `MODEL / REFERENCE`
- `USER ANNOTATION`

It must not recompute scientific algorithms independently.

## 5. Run A ↔ Run B Comparison

Create `EvidenceComparisonContext.tsx` and `RunComparisonPanel.tsx`.

The comparison surface selects two existing evidence sources by source/session identity.

### Compatibility

Comparison is allowed only when both sources provide a meaningful shared x/time basis and at least one compatible numeric channel.

The UI surfaces incompatibility rather than silently coercing data.

### First-version outputs

- provenance side-by-side;
- shared channel list;
- selected channel overlay;
- selected point/interval comparison through PlotInspectionContext;
- basic deltas computed from already available numeric rows;
- row/sample count and declared sample-rate comparison.

This feature is diagnostic and does not create a new merged evidence session.

## 6. User Annotations / Bookmarks

Annotations are session-local in Phase 6.

The user can attach a short label to the current selected x/time, for example:

- `Motor starts`
- `Magnet moved`
- `Unexpected spike`

Every annotation renders with provenance label `USER ANNOTATION`.

Annotations are never serialized into raw evidence CSV or presented as measured/device-derived data.

Persistent annotation/evidence-schema migration is deferred to a separate design.

## 7. Task Center 2.0

Enhance the existing `BackgroundTask` model without replacing it.

Add optional fields:

```ts
export type TaskStage = {
  id: string;
  label: string;
  state: 'pending' | 'running' | 'done' | 'failed' | 'skipped';
};

export type BackgroundTask = {
  // existing fields remain
  stages?: TaskStage[];
  destination?: EngineeringDestination;
  retry?: () => Promise<void> | void;
};
```

### UI requirements

Top summary:

`Running N | Failed N | Recent N`

Each task shows:

- category;
- title/detail;
- start time;
- live elapsed time while running;
- final duration when complete;
- optional category-aware stage timeline;
- logs;
- Copy logs;
- log search/filter;
- Cancel when supported;
- Retry when a safe retry callback exists;
- Go to related tool when a destination exists.

The latest failure may be pinned/highlighted.

Task timelines must be operation-specific and must not pretend every task has the same stages.

Task elapsed-time ticking must remain local to Task Center and must not update the entire App/provider tree once per second.

## 8. Circuit Diagnostic Overlay & Net Tracing

Reuse existing `CircuitLab.tsx` canonical design state and `runRuleChecker()` results.

Do not build another electrical-rule engine.

Add visual lookup/index helpers mapping existing checker findings to:

- component IDs;
- wire IDs;
- pin references;
- connected electrical nets.

Interaction:

- click a wire → highlight its entire connected net;
- hover/focus a pin → role, voltage context, connected peers;
- click an issue → focus/emphasize affected elements;
- `Show only problems` reduces unrelated visual noise;
- issue severity controls emphasis but does not replace text diagnostics;
- power, ground, signal, analog, digital, PWM roles keep consistent visual semantics.

Keyboard/focus operation must offer the same issue navigation as pointer interaction.

If an issue has no reliable structured visual target, keep it textual rather than guessing.

## 9. Developer Engineering Split View

Preserve Monaco/editor/sketchbook behavior, draft recovery, filesystem guards, ecosystem manager, and unsaved-edit protections.

Add an optional responsive split layout:

```text
┌────────────────────┬──────────────────┐
│ CODE               │ RUN / DEVICE     │
│ Monaco editor      │ Target board     │
│                    │ Serial status    │
│                    │ Build output     │
│                    │ Diagnostics      │
└────────────────────┴──────────────────┘
```

The right panel uses existing state/operations:

- HardwareSession selected target;
- compile diagnostics parsed by existing `compileDiagnostics()`;
- existing verify/compile/upload tasks;
- selected port/runtime status.

Clicking a compiler diagnostic navigates Monaco to the source line/column and focuses the editor.

Diagnostics for sibling files remain in output unless the existing project-file UI can safely switch files.

Upload success may show `DEVICE READY`.

The UI must not automatically open serial after upload because that can steal the Monitor port.

## 10. Analysis & Visualization Hierarchy Cleanup

Keep the six existing lenses:

- Evidence
- Signal & Statistics
- Models
- Experiment Design
- Numerical Reliability
- Engineering Preparation

Reorganize the surface into a strong four-level hierarchy:

1. **Source / provenance banner**
2. **Analysis lens navigation**
3. **Shared inspection controls** — cursor, range, Run A/B, annotations
4. **Active analysis content**

The active lens treatment must be visually stronger than inactive choices.

Each active view starts with a concise purpose line and only controls relevant to that lens.

Do not duplicate EvidenceSourcePicker inside child workbenches when shared source is already active. Manual external import remains available where scientifically useful.

Expensive hidden-pane computation must not run continuously if the component can be safely unmounted; where state preservation is required, expensive calculations must be memoized and keyed to source/parameters.

## 11. Experiments Navigation Coherence

The Complete Experiment Code Library remains part of Experiments and keeps repository-driven discovery plus lazy source loading.

Phase 6 adds navigation coherence only:

- campaign/run surfaces and source-code library are clearly separated;
- no experiment firmware/analyzer is removed or hidden;
- Verify/Upload continues using existing backend commands;
- selecting an experiment can navigate to Developer/Monitor without duplicating those tools;
- campaign visualization may use shared inspection when evidence sources match.

## 12. Focus / Presentation Mode

Add a simple runtime-session UI preference.

Focus mode may hide/collapse:

- secondary explanatory paragraphs;
- inactive side panels;
- expanded logs;
- nonessential helper cards.

It must never hide:

- provenance labels;
- current hardware/target state;
- active errors/warnings;
- selected evidence identity;
- plot axes/units required for interpretation;
- a clearly reachable exit control.

Focus mode must not pause background tasks or alter acquisition.

## Performance requirements

1. Do not reintroduce `window.setInterval` hardware discovery in HardwareSession.
2. Shared contexts update only when their own interaction state changes.
3. Large source files remain lazy-loaded in Experiments.
4. Plot nearest-point lookup is memoized/prepared per series rather than rescanning every series on unrelated renders.
5. Task elapsed-time updates are local to Task Center.
6. Run comparison loads only the two selected evidence sources.
7. Hidden analysis panes do not continuously perform expensive work where avoidable.
8. No global provider should be updated merely to animate UI chrome.

## Error handling

- Navigation to an unavailable destination shows the unavailable reason rather than silently doing nothing.
- Run comparison reports incompatible channels/time bases explicitly.
- Source loading failures keep the prior valid source intact when possible and show retry.
- Plot inspection ignores non-finite points and never emits NaN/Infinity to UI.
- Circuit issue focus degrades to textual issue when referenced visual element no longer exists.
- Compiler diagnostic navigation falls back to diagnostics list if file/line cannot be resolved.
- Task retry is offered only where an explicit safe retry callback exists.

## Accessibility

- All status nodes and analysis tabs are keyboard reachable.
- Plot cursor/range selection has keyboard-accessible alternatives.
- Circuit issue navigation does not depend only on color or hover.
- Task state does not depend only on glyph/color.
- Focus mode preserves error/provenance text.

## Testing strategy

### Phase 6 structural/contract check

Protect at least:

- `EngineeringNavigationContext` exists and owns semantic destinations only;
- `EngineeringStatusMap` consumes canonical state and has no numeric health score;
- `HardwareTopology` uses HardwareSession/Hardware Doctor/preflight state;
- `PlotInspectionContext` exists and has no evidence mutation API;
- `EngineeringPlot` exposes shared cursor/range hooks while retaining Phase 5 features;
- raw evidence mutation is absent;
- `InspectionReadout` consumes existing computed values;
- Run A/B comparison never creates/overwrites measurement evidence;
- annotations are explicitly `USER ANNOTATION` and session-local;
- Task Center keeps existing cancellation/history behavior and adds duration/stages/actions;
- Circuit overlay consumes existing `runRuleChecker()` rather than a duplicate rule engine;
- Developer split view keeps `compileDiagnostics()` and unsaved-edit protections;
- upload does not automatically start serial acquisition;
- Experiments Complete Experiment Code Library remains mounted and lazy-loaded;
- HardwareSession still contains no periodic polling.

### TypeScript / Vite

`npm run build` must pass.

### Existing contracts

`scripts/run_contract_self_checks.py` must remain fully green.

### Embedded / Rust workflows

No Phase 6 UI change may break:

- BetterBoard CI firmware compiles;
- Engineering Lab Experiments workflow;
- Sensor Suite v1 Integrity workflow;
- BetterBoard C++ Core workflow;
- Tauri/Rust check.

### Product smoke checks

At minimum verify:

- status-stage navigation;
- hardware topology mismatch and unavailable states;
- Analysis lens navigation;
- shared plot cursor across at least two plots;
- range selection/reset;
- annotation add/remove;
- Run A/B compatible and incompatible cases;
- Task Center elapsed time/log search/copy/go-to/retry states;
- Circuit issue-to-element focus;
- Developer diagnostic-to-line focus;
- Focus mode;
- Experiments full code library and lazy source opening.

## Implementation order

Proceed in dependency order:

1. Phase 6 contract + shared semantic navigation.
2. PlotInspectionContext + EngineeringPlot v4 + inspection readout/range brushing.
3. EngineeringStatusMap + HardwareTopology.
4. Task Center 2.0.
5. Circuit diagnostic overlay.
6. Developer split view.
7. Run A ↔ Run B comparison.
8. User annotations/bookmarks.
9. Analysis hierarchy cleanup + Experiments navigation coherence.
10. Focus/Presentation mode + responsive/performance cleanup.
11. Full contract/build/firmware/Rust/product verification.

## Compatibility boundary

Existing scientific computation and evidence provenance remain the source of truth.

This phase may reorganize where capability appears and how users navigate/interact with it, but it may not silently delete, reinterpret, relabel, or duplicate existing capability.

The guiding rule is:

> BetterBoard should make engineering state traceable from physical source to decision, without inventing data or forcing the user to hunt through unrelated panels.
