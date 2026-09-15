# Phase 6 — Engineering Interaction & Diagnostic UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn BetterBoard's existing hardware, plot, task, circuit, and developer state into a unified engineering interaction layer that helps users inspect one event across plots and trace workflow failures to the correct subsystem without duplicating scientific or diagnostic engines.

**Architecture:** Phase 6 adds small UI-facing coordination components around existing sources of truth: a plot inspection context for linked cursors/ranges, a workflow status derivation layer around HardwareSession/preflight/task/evidence state, visual projections of existing Task Center and CircuitLab data, and a split presentation of existing DeveloperIDE state. No new scientific analysis engine, electrical simulator, evidence schema, or hardware inference engine is introduced.

**Tech Stack:** React + TypeScript, existing BetterBoard CSS, existing `EngineeringPlot`, Tauri invoke boundary, existing Python contract self-check suite, existing Arduino/Rust CI gates.

**Spec:** `docs/superpowers/specs/2026-09-15-engineering-interaction-diagnostic-ui-design.md`

## Global Constraints

- Preserve existing sources of truth: `HardwareSession`, Hardware Doctor, preflight, `BackgroundTask`, `CircuitLab` rule checker, Developer compile diagnostics, `PrimitiveObservatory`, Phase 5 evidence context.
- Do not change raw Measurement Package / replay schema or write derived UI state back into evidence.
- Do not add new scientific algorithms, SPICE/electrical simulation, automatic AI repair, arbitrary dockable-window infrastructure, or serial-port auto-opening.
- Status semantics are limited to `READY | ACTIVE | WARNING | BLOCKED | UNAVAILABLE` and must not imply scientific validity.
- Plot selection and range brushing are viewport/inspection state only.
- Circuit issue overlays may only project locations supported by existing structured component/pin/wire relationships; never guess a location from descriptive text.
- Task timeline stages may only be derived from known task category/state/log evidence; never invent completed steps from arbitrary history text.
- Existing editor draft preservation, filesystem guards, firmware/evidence provenance, HOST/DEVICE producer labels, and Phase 5 analysis semantics must remain intact.
- All production changes must land on `ui/analysis-visualization-integration-a9`; do not merge `main`.

---

## File Structure

### New focused files

- `src/PlotInspectionContext.tsx` — shared selected x/range/source identity and reset semantics for time-aligned plots.
- `src/EngineeringStatusMap.tsx` — top-level workflow-state rail plus navigation callbacks; presentation only.
- `src/HardwareTopology.tsx` — hardware/preflight topology visualization using already-derived state.
- `src/taskPresentation.ts` — pure helpers that derive task summary/timeline presentation from `BackgroundTask` evidence.
- `src/circuitDiagnostics.ts` — pure connected-net and structured issue-target helpers; no rule checking.
- `scripts/engineering_interaction_self_check.py` — Phase 6 structural/semantic regression contract.

### Existing files to modify

- `src/EngineeringPlot.tsx` — controlled selected cursor/range/brush callbacks and synchronized tooltip semantics.
- `src/PrimitiveObservatory.tsx` — host linked inspection context and shared cursor/readout across aligned primitive plots.
- `src/App.tsx` — derive/render Engineering Status Map, render HardwareTopology, expose navigation callback to related Studio tab.
- `src/styles.css` — Engineering Status Map and HardwareTopology layout/state styling.
- `src/TaskCenter.tsx` — summary, filters, timeline, elapsed duration, copy/search logs.
- `src/developer-task.css` — Task Center 2.0 and Developer split-view styling.
- `src/CircuitLab.tsx` — selected net/issue state and overlay projection; retain canonical `runRuleChecker`.
- `src/circuitLab.css` — net/problem/focus semantic styling.
- `src/DeveloperIDE.tsx` — responsive editor/right-side engineering split using existing target/output/diagnostic state.
- `src/SmartArduinoEditor.tsx` — optional externally requested reveal position for diagnostic navigation, only if needed.
- `src/main.tsx` — top-level focus-mode state/toggle.
- `src/workspace-shell.css` — focus-mode and responsive workspace behavior.
- `src/analysis-visualization.css` — focus-mode compatibility for Analysis Hub only if needed by Task 8.
- `scripts/run_contract_self_checks.py` — register the new Phase 6 contract.

---

### Task 1: Add Phase 6 RED contract

**Files:**
- Create: `scripts/engineering_interaction_self_check.py`
- Modify: `scripts/run_contract_self_checks.py`

**Interfaces:**
- Consumes: existing repository source files only.
- Produces: one deterministic structural/semantic contract named `engineering_interaction_self_check.py`.

- [ ] **Step 1: Write the failing contract**

Create assertions that require the planned integration points but preserve the current engines:

```python
#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def require(path: str, *tokens: str) -> None:
    text = read(path)
    for token in tokens:
        assert token in text, f"{path}: missing {token!r}"


def main() -> int:
    require("src/PlotInspectionContext.tsx", "selectedX", "selectedRange", "sourceId", "resetInspection")
    require("src/EngineeringPlot.tsx", "selectedX?", "selectedRange?", "onRangeSelect?", "onPointSelect?")
    require("src/PrimitiveObservatory.tsx", "PlotInspectionProvider", "selectedX", "selectedRange")
    require("src/EngineeringStatusMap.tsx", "Toolchain", "Hardware", "Firmware", "Acquisition", "Evidence", "Analysis")
    require("src/HardwareTopology.tsx", "detected board", "selected FQBN", "required libraries")
    require("src/taskPresentation.ts", "deriveTaskTimeline", "taskElapsedMs")
    require("src/TaskCenter.tsx", "Running", "Failed", "Recent", "Copy logs")
    require("src/circuitDiagnostics.ts", "connectedNet", "issueTargets")
    circuit = read("src/CircuitLab.tsx")
    assert "runRuleChecker" in circuit, "existing circuit rule checker must remain canonical"
    require("src/DeveloperIDE.tsx", "developer-engineering-split", "Diagnostics", "Run output")
    print("Engineering interaction contract: PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
```

Register it after the existing visualization contract in `run_contract_self_checks.py`.

- [ ] **Step 2: Run the contract suite and verify RED**

Run: `python3 scripts/run_contract_self_checks.py`

Expected: all existing checks pass; the new Phase 6 check fails first on missing `src/PlotInspectionContext.tsx`.

- [ ] **Step 3: Commit RED only**

```bash
git add scripts/engineering_interaction_self_check.py scripts/run_contract_self_checks.py
git commit -m "test: define engineering interaction UI contract"
```

---

### Task 2: Linked plot inspection context and controlled EngineeringPlot

**Files:**
- Create: `src/PlotInspectionContext.tsx`
- Modify: `src/EngineeringPlot.tsx`
- Test: `scripts/engineering_interaction_self_check.py`

**Interfaces:**
- Produces:
  - `type PlotInspectionRange = [number, number] | null`
  - `type PlotInspectionContextValue = { sourceId: string; selectedX: number | null; selectedRange: PlotInspectionRange; setSelectedX: (value: number | null) => void; setSelectedRange: (value: PlotInspectionRange) => void; resetInspection: () => void }`
  - `PlotInspectionProvider({ sourceId, children })`
  - `usePlotInspection(): PlotInspectionContextValue`
- `EngineeringPlot` new optional props:
  - `selectedX?: number | null`
  - `selectedRange?: [number, number] | null`
  - `onSelectedXChange?: (x: number | null) => void`
  - `onRangeSelect?: (range: [number, number] | null) => void`
  - existing `onPointSelect` remains supported and must compose with selected-x behavior.

- [ ] **Step 1: Add pure context types and provider**

Implement a focused React context with no data payloads and no persistence:

```tsx
export type PlotInspectionRange = [number, number] | null;

export type PlotInspectionContextValue = {
  sourceId: string;
  selectedX: number | null;
  selectedRange: PlotInspectionRange;
  setSelectedX: (value: number | null) => void;
  setSelectedRange: (value: PlotInspectionRange) => void;
  resetInspection: () => void;
};

export function PlotInspectionProvider({ sourceId, children }: PropsWithChildren<{ sourceId: string }>) {
  const [selectedX, setSelectedX] = useState<number | null>(null);
  const [selectedRange, setSelectedRange] = useState<PlotInspectionRange>(null);

  useEffect(() => {
    setSelectedX(null);
    setSelectedRange(null);
  }, [sourceId]);

  const resetInspection = useCallback(() => {
    setSelectedX(null);
    setSelectedRange(null);
  }, []);

  const value = useMemo<PlotInspectionContextValue>(() => ({
    sourceId,
    selectedX,
    selectedRange,
    setSelectedX,
    setSelectedRange,
    resetInspection,
  }), [sourceId, selectedX, selectedRange, resetInspection]);

  return <PlotInspectionContext.Provider value={value}>{children}</PlotInspectionContext.Provider>;
}
```

The provider must clear inspection state whenever `sourceId` changes so a cursor from one run cannot silently appear on another.

- [ ] **Step 2: Extend EngineeringPlot with controlled x/range semantics**

Implement the smallest changes necessary:

- Range calculation uses `selectedRange` when present, otherwise existing automatic ranges.
- Click on the SVG converts client x into data x and calls `onSelectedXChange`.
- Existing point selection still calls `onPointSelect` with the nearest visible point when applicable.
- Draw an externally controlled vertical cursor when `selectedX` is finite and inside the current x range.
- Implement pointer-down / pointer-up brush selection only when `onRangeSelect` is supplied; normalize the interval in ascending order and ignore drags under 6 CSS pixels.
- Add a compact `Reset range` affordance when a selected range is active.
- Do not mutate input series or crop arrays.

- [ ] **Step 3: Verify backwards compatibility**

Run: `npm run build`

Expected: PASS without modifying existing callers.

Run: `python3 scripts/run_contract_self_checks.py`

Expected: Phase 6 contract advances past plot-context assertions and fails on the next unimplemented slice.

- [ ] **Step 4: Commit**

```bash
git add src/PlotInspectionContext.tsx src/EngineeringPlot.tsx
git commit -m "feat: add linked engineering plot inspection"
```

---

### Task 3: Link Primitive Observatory plots and producer-aware readout

**Files:**
- Modify: `src/PrimitiveObservatory.tsx`
- Reuse: `src/PlotInspectionContext.tsx`, `src/EngineeringPlot.tsx`

**Interfaces:**
- Consumes `PlotInspectionProvider`, `usePlotInspection`, and controlled `EngineeringPlot` props from Task 2.
- Produces one shared inspection surface per selected primitive source/channel.

- [ ] **Step 1: Wrap primitive plot area in a source-scoped provider**

Use a source id that changes with evidence context and channel:

```tsx
const inspectionSourceId = `${contextLabel}:${channelLabel}`;
return <PlotInspectionProvider sourceId={inspectionSourceId}>
  <PrimitiveObservatoryBody {...props} />
</PlotInspectionProvider>;
```

Extract `PrimitiveObservatoryBody` only as the smallest component boundary needed to consume the context inside the provider. Keep computational calls (`computeHostPrimitiveObservability`, comparison helpers) in the same module and do not alter their algorithms.

- [ ] **Step 2: Feed selected x/range to all time-aligned EngineeringPlot calls**

For raw/RMS/derivative/integral/EMA/peak/threshold/hysteresis plots:

```tsx
<EngineeringPlot
  {...existingProps}
  selectedX={selectedX}
  selectedRange={selectedRange}
  onSelectedXChange={setSelectedX}
  onRangeSelect={setSelectedRange}
/>
```

Do not attach shared time inspection to plots whose x axis is not the same elapsed-time basis.

- [ ] **Step 3: Add one producer-aware inspection readout**

At `selectedX`, derive display-only nearest/aligned values from the already-produced host/device traces. Label every value explicitly as `MEASURED`, `HOST-DERIVED`, or `DEVICE-DERIVED`. The readout must say `nearest/aligned sample` when exact timestamp equality is not guaranteed.

Do not create a new device interpolation algorithm.

- [ ] **Step 4: Verify**

Run: `npm run build`

Run: `python3 scripts/run_contract_self_checks.py`

Expected: both PASS through the linked-plot requirements.

- [ ] **Step 5: Commit**

```bash
git add src/PrimitiveObservatory.tsx
git commit -m "feat: synchronize primitive plot inspection"
```

---

### Task 4: Engineering Status Map and Hardware Topology

**Files:**
- Create: `src/EngineeringStatusMap.tsx`
- Create: `src/HardwareTopology.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- `EngineeringStatus = 'READY' | 'ACTIVE' | 'WARNING' | 'BLOCKED' | 'UNAVAILABLE'`
- `EngineeringStatusNode = { id: string; label: string; status: EngineeringStatus; detail: string; targetTab?: 'hardware' | 'library' | 'data' | 'developer' }`
- `EngineeringStatusMap({ nodes, onNavigate }: { nodes: EngineeringStatusNode[]; onNavigate: (tab: NonNullable<EngineeringStatusNode['targetTab']>) => void })`
- `HardwareTopology({ portLabel, detectedBoardLabel, detectedFqbn, selectedFqbn, coreInstalled, requiredLibraries, missingLibraries, recipeTitle })`

- [ ] **Step 1: Implement presentational status map**

Create a component that renders exactly six workflow nodes in order:

`Toolchain → Hardware → Firmware → Acquisition → Evidence → Analysis`

It accepts already-derived nodes and never computes hardware/science truth itself.

- [ ] **Step 2: Derive nodes inside App from existing state only**

Examples:

- Toolchain: `cli === null` → ACTIVE during refresh; `cli.found` → READY; otherwise BLOCKED.
- Hardware: no selected port → UNAVAILABLE; Hardware Doctor compile/upload blocking diagnosis → BLOCKED; non-blocking diagnosis warning → WARNING; otherwise READY.
- Firmware: busy compile/upload → ACTIVE; preflight missing core/library → BLOCKED; selected recipe with valid preflight → READY; no recipe/preflight → UNAVAILABLE or WARNING without claiming compiled state.
- Acquisition: derive only from existing Monitor/task state; do not invent LIVE state from port presence.
- Evidence: latest measurement/replay/evidence presence only.
- Analysis: shared analysis capability/readiness only; never scientific-validity scoring.

Each navigable node calls `setTab(targetTab)`.

- [ ] **Step 3: Implement HardwareTopology using existing Hardware Doctor/preflight values**

Render:

`USB port → detected board → selected FQBN → core → libraries → firmware`

A detected-vs-selected mismatch must visually break/highlight only that edge. Missing core blocks the core node. Missing libraries render a count/list on the library node. Unknown exact physical board remains labeled unknown rather than inferred.

- [ ] **Step 4: Mount topology in Hardware & Program and status map near Studio controls**

Keep existing Hardware Doctor/preflight controls; the new visualizations summarize/navigate rather than replace the canonical controls.

- [ ] **Step 5: Verify and commit**

Run: `npm run build`

Run: `python3 scripts/run_contract_self_checks.py`

```bash
git add src/EngineeringStatusMap.tsx src/HardwareTopology.tsx src/App.tsx src/styles.css
git commit -m "feat: visualize engineering workflow readiness"
```

---

### Task 5: Task Center 2.0 with evidence-based timelines

**Files:**
- Create: `src/taskPresentation.ts`
- Modify: `src/TaskCenter.tsx`
- Modify: `src/developer-task.css`

**Interfaces:**
- `taskElapsedMs(task: BackgroundTask, nowMs?: number): number`
- `deriveTaskTimeline(task: BackgroundTask): Array<{ id: string; label: string; state: 'done' | 'active' | 'failed' | 'pending' | 'unknown' }>`
- No mutation of `BackgroundTask` storage schema.

- [ ] **Step 1: Implement pure elapsed-time helper**

```ts
export function taskElapsedMs(task: BackgroundTask, nowMs = Date.now()) {
  return Math.max(0, (task.finishedAt ?? nowMs) - task.startedAt);
}
```

Add `formatDuration(ms: number): string` in `taskPresentation.ts` using seconds under one minute and `m:ss` at/above one minute.

- [ ] **Step 2: Implement conservative timeline derivation**

Use category/title/log evidence with explicit known phrases emitted by BetterBoard (`Preparing`, `Compiling`, `Uploading`, `Recording`, `Replay loaded`). For a stage with no supporting evidence return `unknown` or `pending`; never infer success merely because a later generic log exists.

At minimum support:

- Program upload: Prepare → Compile → Upload.
- Evidence capture/save: Acquire → Save → Register when log evidence exists.
- Replay: Locate → Load → Parse where corresponding evidence exists.
- Other tasks: return an empty stage list and show the ordinary state row.

- [ ] **Step 3: Upgrade Task Center presentation**

Add:

- summary chips: Running / Failed / Recent,
- latest failed task callout,
- filters: Running / Failed / Recent / All plus the existing category filter,
- elapsed duration,
- timeline when `deriveTaskTimeline` returns supported stages,
- per-task `Copy logs` using `navigator.clipboard.writeText(task.logs.join('\n'))`,
- local search input filtering displayed log lines without mutating saved logs.

Retry is omitted unless a safe callback is explicitly supplied by the parent in a later approved change; do not reconstruct commands from log text.

- [ ] **Step 4: Keep persistence/cancellation semantics unchanged**

Verify no changes to `BackgroundTask` serialization or cancel callback behavior in `App.tsx` are required.

- [ ] **Step 5: Verify and commit**

Run: `npm run build`

Run: `python3 scripts/run_contract_self_checks.py`

```bash
git add src/taskPresentation.ts src/TaskCenter.tsx src/developer-task.css
git commit -m "feat: upgrade task center diagnostics"
```

---

### Task 6: Circuit net tracing and diagnostic overlay

**Files:**
- Create: `src/circuitDiagnostics.ts`
- Modify: `src/CircuitLab.tsx`
- Modify: `src/circuitLab.css`

**Interfaces:**
- Export or move only the minimal structural types needed by `circuitDiagnostics.ts`; do not change `betterboard.circuit-design/0.1` persisted fields.
- `connectedNet(start: PinRef, wires: Wire[]): { pinKeys: Set<string>; wireIds: Set<string> }`
- `issueTargets(issue: Issue, components: PlacedComponent[], wires: Wire[]): { componentIds: string[]; pinKeys: string[]; wireIds: string[] }`

- [ ] **Step 1: Implement connected-net traversal**

Build an undirected graph from wire endpoints. Encode pin keys as `${componentId}:${pinId}`. BFS from the selected pin returns all reachable pins and every traversed wire ID. This is connectivity visualization only; it must not assign voltages, current, resistance, or simulated signal state.

- [ ] **Step 2: Implement conservative issue-target extraction**

Prefer structured issue ids already emitted by the canonical checker:

- `short-<wireId>` / `rails-<wireId>` / `power-io-<wireId>` → exact wire and its endpoint pins/components.
- component-prefixed issue ids such as `<componentId>-vcc` / `<componentId>-sig` → exact component and pin only when that suffix maps to an existing pin.
- otherwise return empty targets; do not parse free-form prose to guess a location.

- [ ] **Step 3: Add CircuitLab UI state**

Add:

```ts
const [selectedPin, setSelectedPin] = useState<PinRef | null>(null);
const [selectedWireId, setSelectedWireId] = useState<string | null>(null);
const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
const [showOnlyProblems, setShowOnlyProblems] = useState(false);
```

Derive selected net with `connectedNet` and selected issue overlay with `issueTargets`.

- [ ] **Step 4: Project state into the existing canvas**

- selected net wires/pins receive `net-active`,
- issue-target wires/pins/components receive `problem-active`,
- unrelated items are dimmed under `Show only problems`,
- pin hover/click panel shows pin role, known nominal voltage, and connected peers,
- clicking an issue highlights/focuses the target; if no structured target exists, retain only the issue-card selection.

Retain `runRuleChecker` untouched as the source of issue truth.

- [ ] **Step 5: Verify persisted design compatibility**

Run: `python3 scripts/run_contract_self_checks.py`

Expected: existing circuit persisted-design contract and new Phase 6 contract pass.

Run: `npm run build`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/circuitDiagnostics.ts src/CircuitLab.tsx src/circuitLab.css
git commit -m "feat: add circuit diagnostic net overlays"
```

---

### Task 7: Developer engineering split view

**Files:**
- Modify: `src/DeveloperIDE.tsx`
- Modify: `src/SmartArduinoEditor.tsx` only if diagnostic navigation needs a typed reveal prop
- Modify: `src/developer-task.css`

**Interfaces:**
- Consumes existing `diagnostics`, `output`, `fqbn`, `selectedPort`, `busy`, Monaco editor callbacks, and existing compile/upload actions.
- Optional editor addition: `revealPosition?: { line: number; column?: number } | null`.
- Produces presentation only; no backend changes.

- [ ] **Step 1: Introduce responsive split container**

Wrap the existing editor surface in:

```tsx
<div className="developer-engineering-split">
  <section className="developer-code-pane">{/* existing editor and file controls */}</section>
  <aside className="developer-runtime-pane">{/* target, diagnostics and output */}</aside>
</div>
```

Do not move ecosystem/sketchbook modes into the split; apply it to the editor view only.

- [ ] **Step 2: Build right-side engineering panel from existing state**

Render sections:

- Target: selected FQBN + selected port.
- Diagnostics: existing parsed diagnostics with line/column/severity.
- Run output: existing `output` text plus the existing `CopyButton` component.
- Operation state: `busy ? 'ACTIVE' : diagnostics.some(d => d.severity === 'error') ? 'BLOCKED' : 'READY'`, labeled as operation/UI state rather than hardware truth.

Do not automatically open Monitor or a serial port after upload.

- [ ] **Step 3: Make diagnostic rows navigate the editor**

First inspect `SmartArduinoEditor` for an existing navigation interface. If none exists, add exactly this optional prop:

```ts
revealPosition?: { line: number; column?: number } | null;
```

Inside the Monaco mount/update path, when the prop changes to a non-null value, call `editor.revealLineInCenter(line)` and `editor.setPosition({ lineNumber: line, column: Math.max(1, column ?? 1) })`, then `editor.focus()`.

Selecting a diagnostic updates `revealPosition`; it never modifies source text.

- [ ] **Step 4: Verify all dirty-state and filesystem guards remain unchanged**

Run: `python3 scripts/run_contract_self_checks.py`

Expected: all existing developer draft/filesystem/rename/example/ecosystem checks and Phase 6 contract pass.

Run: `npm run build`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/DeveloperIDE.tsx src/SmartArduinoEditor.tsx src/developer-task.css
git commit -m "feat: add developer engineering split view"
```

If `SmartArduinoEditor.tsx` did not require modification, omit it from `git add` rather than making a no-op edit.

---

### Task 8: Focus mode and responsive consistency pass

**Files:**
- Modify: `src/main.tsx`
- Modify: `src/workspace-shell.css`
- Modify: `src/analysis-visualization.css` only if Analysis Hub needs a focus-mode hook
- Modify: `src/developer-task.css` only if the Developer/Task layouts need a focus breakpoint adjustment

**Interfaces:**
- `focusMode: boolean` top-level UI state only; no persistence in Phase 6.

- [ ] **Step 1: Add one top-level Focus Mode toggle**

Add `const [focusMode, setFocusMode] = useState(false)` in the existing workspace shell owner. Apply a root class such as `workspace-focus-mode` and expose one explicit toggle near the workspace navigation.

Focus mode hides/collapses secondary navigation, completed Task Center history, and nonessential control chrome while preserving the active workspace and its primary experiment/analysis content.

It must never hide active warnings, failed tasks, or blockers required to understand why an operation is unavailable.

- [ ] **Step 2: Add responsive breakpoints for Phase 6 surfaces**

At narrow widths:

- Engineering Status Map becomes horizontally scrollable or stacked without dropping node labels.
- Hardware topology scrolls/wraps without overlapping edges.
- Task summary remains readable.
- Developer split stacks vertically.
- Circuit canvas remains scrollable rather than scaling text to unreadable size.

Implement these rules in the exact CSS owners listed above rather than creating a new global stylesheet.

- [ ] **Step 3: Run build and contract suite**

Run: `npm run build`

Run: `python3 scripts/run_contract_self_checks.py`

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/main.tsx src/workspace-shell.css src/analysis-visualization.css src/developer-task.css
git commit -m "feat: polish engineering focus and responsive UI"
```

Only include CSS files actually changed.

---

### Task 9: Exact-head regression and PR verification

**Files:**
- No production changes unless a failing regression identifies a root cause.

**Interfaces:**
- Consumes all Phase 6 tasks and existing CI workflows.
- Produces verification evidence only.

- [ ] **Step 1: Run local/static gates available in the branch environment**

Required commands in CI or an equivalent checkout:

```bash
npm run build
python3 scripts/run_contract_self_checks.py
```

Expected: TypeScript/Vite PASS and all Python contracts PASS, including `engineering_interaction_self_check.py`.

- [ ] **Step 2: Verify existing hardware/backend gates remain green**

On the exact head SHA, require the same existing PR workflows used in Phase 5:

- BetterBoard CI, including UNO numerical microbench compile, Numeric Error Depth compile, device primitive result compile, Rust/Tauri check.
- BetterBoard C++ Core.
- Engineering Lab Experiments.
- Sensor Suite v1 Integrity.

Do not call Phase 6 complete while any exact-head required workflow is failed or still in progress.

- [ ] **Step 3: Inspect failures systematically**

For any failure:

1. fetch the failed job steps/logs,
2. identify the exact failing gate,
3. distinguish stale structural contracts from real product regressions,
4. add or adjust the smallest failing regression case,
5. implement one root-cause fix,
6. rerun exact-head verification.

- [ ] **Step 4: Final review against spec**

Confirm:

- linked cursor/range is inspection-only,
- no source data is cropped/mutated,
- producer identity remains explicit,
- workflow status never claims scientific validity,
- HardwareTopology does not infer unknown physical board identity,
- Task Center does not invent timeline stages,
- Circuit overlay keeps `runRuleChecker` canonical,
- Developer split preserves dirty-state/filesystem protections,
- no evidence schema/backend scientific algorithm was introduced.

- [ ] **Step 5: Do not merge**

Leave PR #66 open on `ui/analysis-visualization-integration-a9` unless the user explicitly requests merge/integration.
