# Phase 6 — Engineering Interaction & Diagnostic UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn BetterBoard Studio into one coherent engineering workstation: every existing experiment, evidence source, diagnostic, plot, task, circuit issue, and developer error must be visible, traceable, and navigable without duplicating scientific or hardware engines.

**Architecture:** Add one shared UI interaction layer around existing canonical state. Plot inspection, run comparison, annotations, workflow status, hardware topology, task timelines, circuit net projection, Developer diagnostics, Analysis hierarchy, and Experiments navigation are presentation/coordination layers only. Raw evidence, Hardware Doctor, preflight, `runRuleChecker`, compile diagnostics, Primitive Observatory algorithms, Measurement Package semantics, and firmware backends remain canonical.

**Tech Stack:** React + TypeScript, Vite, existing BetterBoard CSS, `EngineeringPlot`, Monaco, Tauri invoke boundary, Python structural/executable self-checks, Arduino CLI CI, Rust/Tauri CI.

**Spec:** `docs/superpowers/specs/2026-09-15-engineering-interaction-diagnostic-ui-design.md`

## Global Constraints

- All changes land on `ui/analysis-visualization-integration-a9`; do not merge `main`.
- Preserve canonical sources of truth: `HardwareSession`, Hardware Doctor, preflight, `BackgroundTask`, `runRuleChecker`, compile diagnostics, `PrimitiveObservatory`, Evidence Visualization context, Measurement Sessions, and existing Developer backend commands.
- Do not add a second scientific algorithm, electrical simulator, hardware inference engine, compile/upload pipeline, evidence store, or task database.
- Do not mutate raw evidence or Measurement Package schemas.
- Producer identity remains explicit: `MEASURED`, `HOST-DERIVED`, `DEVICE-DERIVED`, `MODEL/REFERENCE`, `USER ANNOTATION`.
- Engineering status vocabulary is exactly `READY | ACTIVE | WARNING | BLOCKED | UNAVAILABLE`; it must not imply scientific validity.
- No periodic global Arduino CLI polling. Hardware discovery remains startup/manual/focus/visibility driven and coalesced.
- Large experiment/analyzer source bodies remain lazy-loaded; directory discovery may be eager, source content may not be.
- UI actions that look executable must call real canonical actions; no decorative fake buttons.
- All existing frontend, contract, Arduino, Engineering Lab, Sensor Suite, C++ Core, and Rust/Tauri gates must remain green.

---

## File Structure

### New focused files

- `src/PlotInspectionContext.tsx` — selected x/range/source identity plus reset.
- `src/RunComparisonContext.tsx` — Run A / Run B evidence selection and comparison UI state only.
- `src/EngineeringAnnotations.tsx` — session-local `USER ANNOTATION` state and editor UI.
- `src/EngineeringStatusMap.tsx` — six-stage workflow rail and navigation.
- `src/HardwareTopology.tsx` — USB → board → FQBN → core → libraries → firmware projection.
- `src/taskPresentation.ts` — pure Task Center summary/timeline helpers.
- `src/circuitDiagnostics.ts` — connected-net and structured issue-target projection.
- `src/AnalysisWorkflowGuide.tsx` — plain-language hierarchy/navigation for Evidence → Analyze → Compare → Decide.
- `scripts/engineering_interaction_self_check.py` — Phase 6 regression contract.

### Existing files to modify

- `src/EngineeringPlot.tsx`
- `src/PrimitiveObservatory.tsx`
- `src/AnalysisVisualizationHub.tsx`
- `src/EvidenceSourcePicker.tsx`
- `src/ExperimentsHub.tsx`
- `src/EngineeringExperimentLibrary.tsx`
- `src/App.tsx`
- `src/TaskCenter.tsx`
- `src/CircuitLab.tsx`
- `src/DeveloperIDE.tsx`
- `src/SmartArduinoEditor.tsx` only if reveal navigation needs it
- `src/main.tsx`
- `src/styles.css`
- `src/analysis-visualization.css`
- `src/developer-task.css`
- `src/circuitLab.css`
- `src/workspace-shell.css`
- `scripts/run_contract_self_checks.py`

---

### Task 1: Add the complete Phase 6 RED contract

**Files:**
- Create: `scripts/engineering_interaction_self_check.py`
- Modify: `scripts/run_contract_self_checks.py`

**Interfaces:**
- Consumes repository source as text.
- Produces one deterministic contract that initially fails on the first missing Phase 6 component.

- [ ] **Step 1: Write the failing contract**

Require all major boundaries:

```python
require("src/PlotInspectionContext.tsx", "selectedX", "selectedRange", "sourceId", "resetInspection")
require("src/RunComparisonContext.tsx", "runA", "runB", "setRunA", "setRunB")
require("src/EngineeringAnnotations.tsx", "USER ANNOTATION", "addAnnotation", "removeAnnotation")
require("src/EngineeringPlot.tsx", "selectedX?", "selectedRange?", "onRangeSelect?", "onPointSelect?")
require("src/PrimitiveObservatory.tsx", "PlotInspectionProvider", "selectedX", "selectedRange")
require("src/EngineeringStatusMap.tsx", "Toolchain", "Hardware", "Firmware", "Acquisition", "Evidence", "Analysis")
require("src/HardwareTopology.tsx", "detected board", "selected FQBN", "required libraries")
require("src/taskPresentation.ts", "deriveTaskTimeline", "taskElapsedMs")
require("src/TaskCenter.tsx", "Running", "Failed", "Recent", "Copy logs")
require("src/circuitDiagnostics.ts", "connectedNet", "issueTargets")
require("src/DeveloperIDE.tsx", "developer-engineering-split", "Diagnostics", "Run output")
require("src/AnalysisWorkflowGuide.tsx", "Evidence", "Analyze", "Compare", "Decide")
require("src/ExperimentsHub.tsx", "Complete Experiment Code Library")
```

Also assert:

```python
hardware = read("src/HardwareSession.tsx")
assert "window.setInterval" not in hardware
library = read("src/EngineeringExperimentLibrary.tsx")
assert "eager: true" not in library
assert "import.meta.glob" in library
circuit = read("src/CircuitLab.tsx")
assert "runRuleChecker" in circuit
```

- [ ] **Step 2: Register the contract**

Append `engineering_interaction_self_check.py` to `CHECKS` in `scripts/run_contract_self_checks.py`.

- [ ] **Step 3: Run RED**

Run: `python3 scripts/run_contract_self_checks.py`

Expected: existing checks pass; Phase 6 fails first on missing `src/PlotInspectionContext.tsx`.

- [ ] **Step 4: Commit RED only**

```bash
git add scripts/engineering_interaction_self_check.py scripts/run_contract_self_checks.py
git commit -m "test: define complete engineering interaction contract"
```

---

### Task 2: Shared linked-plot inspection

**Files:**
- Create: `src/PlotInspectionContext.tsx`
- Modify: `src/EngineeringPlot.tsx`

**Interfaces:**

```ts
export type PlotInspectionRange = [number, number] | null;
export type PlotInspectionContextValue = {
  sourceId: string;
  selectedX: number | null;
  selectedRange: PlotInspectionRange;
  setSelectedX(value: number | null): void;
  setSelectedRange(value: PlotInspectionRange): void;
  resetInspection(): void;
};
```

`EngineeringPlot` adds optional `selectedX`, `selectedRange`, `onSelectedXChange`, `onRangeSelect` and preserves existing props.

- [ ] **Step 1: Implement source-scoped provider** — state resets whenever `sourceId` changes; no evidence payload is stored.
- [ ] **Step 2: Add controlled vertical cursor** — clicking the plot converts client x to data x and calls `onSelectedXChange`.
- [ ] **Step 3: Add range brushing** — pointer drag over 6 CSS px emits normalized `[x0,x1]`; it changes viewport only.
- [ ] **Step 4: Keep point selection compatible** — existing `onPointSelect` still reports actual series point data.
- [ ] **Step 5: Verify** — `npm run build` and contract suite.
- [ ] **Step 6: Commit**

```bash
git add src/PlotInspectionContext.tsx src/EngineeringPlot.tsx
git commit -m "feat: add linked engineering plot inspection"
```

---

### Task 3: Primitive Observatory synchronized inspection

**Files:**
- Modify: `src/PrimitiveObservatory.tsx`

**Interfaces:** Consumes Task 2 context and existing host/device primitive outputs.

- [ ] **Step 1:** Wrap time-aligned plots in `PlotInspectionProvider` using evidence/channel identity.
- [ ] **Step 2:** Feed shared cursor/range to raw, RMS, derivative, integral, EMA, peak-hold, threshold, and hysteresis time plots only.
- [ ] **Step 3:** Add one readout at selected time with explicit `MEASURED`, `HOST-DERIVED`, `DEVICE-DERIVED` labels.
- [ ] **Step 4:** If exact equality is unavailable, label values `nearest/aligned sample`; do not invent interpolation.
- [ ] **Step 5:** Verify build/contracts and commit.

```bash
git add src/PrimitiveObservatory.tsx
git commit -m "feat: synchronize primitive plot inspection"
```

---

### Task 4: Run A ↔ Run B comparison

**Files:**
- Create: `src/RunComparisonContext.tsx`
- Modify: `src/AnalysisVisualizationHub.tsx`
- Modify: `src/EvidenceSourcePicker.tsx`
- Modify: `src/analysis-visualization.css`

**Interfaces:**

```ts
export type ComparisonRun = { sourceId: string; label: string } | null;
export type RunComparisonContextValue = {
  runA: ComparisonRun;
  runB: ComparisonRun;
  setRunA(run: ComparisonRun): void;
  setRunB(run: ComparisonRun): void;
  clearComparison(): void;
};
```

- [ ] **Step 1:** Add comparison UI-state provider only; evidence remains in existing Evidence Visualization context/session loaders.
- [ ] **Step 2:** Extend source picker with explicit `Set as Run A` / `Set as Run B` actions for loaded saved sessions.
- [ ] **Step 3:** Add comparison banner showing A/B labels and clear action.
- [ ] **Step 4:** In Analysis Hub, comparison mode overlays A/B only where both views can use the same existing table semantics; unsupported panes clearly say comparison is unavailable rather than fabricating a result.
- [ ] **Step 5:** Preserve provenance labels for each run; never merge raw rows.
- [ ] **Step 6:** Verify build/contracts and commit.

```bash
git add src/RunComparisonContext.tsx src/AnalysisVisualizationHub.tsx src/EvidenceSourcePicker.tsx src/analysis-visualization.css
git commit -m "feat: add evidence run comparison workflow"
```

---

### Task 5: USER ANNOTATION layer

**Files:**
- Create: `src/EngineeringAnnotations.tsx`
- Modify: `src/AnalysisVisualizationHub.tsx`
- Modify: `src/EngineeringPlot.tsx`

**Interfaces:**

```ts
export type EngineeringAnnotation = {
  id: string;
  sourceId: string;
  x: number;
  text: string;
  createdAt: number;
  provenance: 'USER ANNOTATION';
};
```

- [ ] **Step 1:** Add session-local provider with `addAnnotation`, `removeAnnotation`, `annotationsForSource`.
- [ ] **Step 2:** Add annotation creation only when a plot point/x is selected; require non-empty text.
- [ ] **Step 3:** Render annotation markers via existing `eventMarkers`/selected-x presentation path, labeled `USER ANNOTATION`.
- [ ] **Step 4:** Do not persist into measurement packages or raw CSV.
- [ ] **Step 5:** Verify and commit.

```bash
git add src/EngineeringAnnotations.tsx src/AnalysisVisualizationHub.tsx src/EngineeringPlot.tsx
git commit -m "feat: add user engineering annotations"
```

---

### Task 6: Engineering Status Map and Hardware Topology

**Files:**
- Create: `src/EngineeringStatusMap.tsx`
- Create: `src/HardwareTopology.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`

**Interfaces:**

```ts
export type EngineeringStatus = 'READY' | 'ACTIVE' | 'WARNING' | 'BLOCKED' | 'UNAVAILABLE';
```

- [ ] **Step 1:** Render exactly `Toolchain → Hardware → Firmware → Acquisition → Evidence → Analysis`.
- [ ] **Step 2:** Derive node state only from existing CLI/Hardware Doctor/preflight/task/evidence state in `App.tsx`.
- [ ] **Step 3:** Make nodes navigable to existing surfaces; clicking status never performs destructive/hardware-changing actions.
- [ ] **Step 4:** Render topology `USB → detected board → selected FQBN → core → libraries → firmware`.
- [ ] **Step 5:** Mismatch/missing core/missing library break the appropriate edge/node; unknown board remains unknown.
- [ ] **Step 6:** Verify/commit.

```bash
git add src/EngineeringStatusMap.tsx src/HardwareTopology.tsx src/App.tsx src/styles.css
git commit -m "feat: visualize engineering workflow readiness"
```

---

### Task 7: Task Center 2.0

**Files:**
- Create: `src/taskPresentation.ts`
- Modify: `src/TaskCenter.tsx`
- Modify: `src/developer-task.css`

**Interfaces:**

```ts
export function taskElapsedMs(task: BackgroundTask, nowMs?: number): number;
export function deriveTaskTimeline(task: BackgroundTask): Array<{
  id: string;
  label: string;
  state: 'done' | 'active' | 'failed' | 'pending' | 'unknown';
}>;
```

- [ ] **Step 1:** Add elapsed/format helpers.
- [ ] **Step 2:** Conservatively derive known Program/Evidence/Replay stages from real task/log evidence only.
- [ ] **Step 3:** Add Running/Failed/Recent summary and pinned latest failure.
- [ ] **Step 4:** Add elapsed duration, supported timeline, local log search, and `Copy logs`.
- [ ] **Step 5:** Keep cancellation/history schema unchanged; do not reconstruct retries from arbitrary logs.
- [ ] **Step 6:** Verify/commit.

```bash
git add src/taskPresentation.ts src/TaskCenter.tsx src/developer-task.css
git commit -m "feat: upgrade task center diagnostics"
```

---

### Task 8: Circuit diagnostic overlay and net tracing

**Files:**
- Create: `src/circuitDiagnostics.ts`
- Modify: `src/CircuitLab.tsx`
- Modify: `src/circuitLab.css`

**Interfaces:**

```ts
connectedNet(start: PinRef, wires: Wire[]): { pinKeys: Set<string>; wireIds: Set<string> };
issueTargets(issue: Issue, components: PlacedComponent[], wires: Wire[]): {
  componentIds: string[]; pinKeys: string[]; wireIds: string[];
};
```

- [ ] **Step 1:** Build undirected net traversal from wire endpoints only.
- [ ] **Step 2:** Map structured checker issue ids conservatively; never parse free prose into guessed locations.
- [ ] **Step 3:** Add selected pin/wire/issue and `Show only problems` UI state.
- [ ] **Step 4:** Highlight whole net, exact problem targets, and dim unrelated elements when requested.
- [ ] **Step 5:** Pin details show role/known nominal voltage/connected peers from existing metadata only.
- [ ] **Step 6:** Keep `runRuleChecker()` canonical, verify persisted-design contract, commit.

```bash
git add src/circuitDiagnostics.ts src/CircuitLab.tsx src/circuitLab.css
git commit -m "feat: add circuit diagnostic net overlays"
```

---

### Task 9: Developer Engineering Split View

**Files:**
- Modify: `src/DeveloperIDE.tsx`
- Modify: `src/SmartArduinoEditor.tsx` only if needed
- Modify: `src/developer-task.css`

**Interfaces:** Optional editor prop:

```ts
revealPosition?: { line: number; column?: number } | null;
```

- [ ] **Step 1:** Editor mode becomes responsive `developer-engineering-split`: source left, target/diagnostics/output right.
- [ ] **Step 2:** Right pane uses existing FQBN, port, diagnostics, busy state, and output.
- [ ] **Step 3:** Diagnostic click reveals line/column in Monaco; source text is never modified.
- [ ] **Step 4:** Successful upload may show `DEVICE READY` but must not auto-open Monitor/serial.
- [ ] **Step 5:** Preserve dirty-state, draft recovery, sketchbook mutation guards, and ecosystem behavior.
- [ ] **Step 6:** Verify/commit.

```bash
git add src/DeveloperIDE.tsx src/SmartArduinoEditor.tsx src/developer-task.css
git commit -m "feat: add developer engineering split view"
```

---

### Task 10: Analysis hierarchy and Experiments navigation coherence

**Files:**
- Create: `src/AnalysisWorkflowGuide.tsx`
- Modify: `src/AnalysisVisualizationHub.tsx`
- Modify: `src/ExperimentsHub.tsx`
- Modify: `src/EngineeringExperimentLibrary.tsx`
- Modify: `src/analysis-visualization.css`

**Interfaces:** Presentation only; no analysis backend changes.

- [ ] **Step 1:** Add plain workflow guide `Evidence → Analyze → Compare → Decide` above Analysis tabs, with one-sentence purpose for each stage.
- [ ] **Step 2:** Re-label/group existing six panes under that hierarchy without deleting panes or changing underlying computations.
- [ ] **Step 3:** Experiments gets explicit sections: `Campaigns`, `Complete Experiment Code Library`, `Run/Program handoff`.
- [ ] **Step 4:** Every experiment code asset shows real actions only: View source; firmware Verify/Upload when Hardware Doctor allows; host scripts remain source/tool entries unless a safe canonical runner already exists.
- [ ] **Step 5:** Keep repository-wide automatic discovery and lazy source loading; no hand-maintained per-file list.
- [ ] **Step 6:** Add concise empty/error states so users know what to select next instead of seeing unexplained blank panels.
- [ ] **Step 7:** Verify/commit.

```bash
git add src/AnalysisWorkflowGuide.tsx src/AnalysisVisualizationHub.tsx src/ExperimentsHub.tsx src/EngineeringExperimentLibrary.tsx src/analysis-visualization.css
git commit -m "feat: unify analysis and experiment navigation"
```

---

### Task 11: Focus mode, responsive layout, and performance guardrails

**Files:**
- Modify: `src/main.tsx`
- Modify: `src/workspace-shell.css`
- Modify: `src/analysis-visualization.css`
- Modify: `src/developer-task.css`
- Modify: `scripts/engineering_interaction_self_check.py`

**Interfaces:** `focusMode: boolean` UI state only.

- [ ] **Step 1:** Add reversible top-level Focus Mode; preserve blockers/warnings and active work.
- [ ] **Step 2:** Narrow layouts: status/topology stack or local-scroll; Developer split stacks; Task timeline becomes vertical; plot readouts wrap; Circuit canvas locally scrolls.
- [ ] **Step 3:** Add contract assertions prohibiting `window.setInterval` in HardwareSession and `eager: true` in experiment source discovery.
- [ ] **Step 4:** Check that no new global timer continuously invokes Tauri hardware/session commands from Phase 6 components.
- [ ] **Step 5:** Run `npm run build`; confirm no source-body eager bundling regression.
- [ ] **Step 6:** Verify/commit.

```bash
git add src/main.tsx src/workspace-shell.css src/analysis-visualization.css src/developer-task.css scripts/engineering_interaction_self_check.py
git commit -m "feat: finish responsive engineering workspace"
```

---

### Task 12: Full exact-head regression verification

**Files:** No production changes unless a verified failure identifies a root cause.

- [ ] **Step 1:** Run `npm run build` and `python3 scripts/run_contract_self_checks.py` on exact head.
- [ ] **Step 2:** Require BetterBoard CI success including TypeScript/Vite, contracts, UNO numerical firmware, device primitive firmware, and Rust check.
- [ ] **Step 3:** Require Engineering Lab Experiments success for its declared targets.
- [ ] **Step 4:** Require Sensor Suite v1 Integrity success.
- [ ] **Step 5:** Require BetterBoard C++ Core success.
- [ ] **Step 6:** For failures, fetch exact job logs, identify root cause, add/adjust the smallest regression case, apply one minimal fix, and rerun.
- [ ] **Step 7:** Final spec audit: linked inspection is non-mutating; A/B keeps runs separate; annotations remain `USER ANNOTATION`; status does not imply scientific validity; topology does not infer unknown boards; tasks do not invent stages; Circuit keeps `runRuleChecker`; Developer preserves dirty-state protections; Experiments remains real-code/lazy-loaded; no periodic Arduino CLI polling.
- [ ] **Step 8:** Leave PR #66 open and do not merge `main` unless the user explicitly requests it.
