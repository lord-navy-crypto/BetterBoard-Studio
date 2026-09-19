# Desktop Capability Reachability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every real BetterBoard user-facing capability discoverable from the first desktop UI layer and semantically navigable to its canonical interactive surface.

**Architecture:** Add a static capability registry plus a shared semantic navigation provider. Root owns workspace navigation, App registers Studio tab routing, AnalysisVisualizationHub registers analysis view routing, and all deep links resolve through capability IDs before revealing stable capability anchors. A top-level All Tools navigator provides universal discovery without duplicating canonical tools.

**Tech Stack:** React + TypeScript, Tauri frontend, lucide-react, existing BetterBoard CSS, Python structural contract checks, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-16-desktop-capability-reachability-design.md`

## Global Constraints

- Every registered user-facing capability must have a visible desktop discovery path and a real canonical destination.
- Internal helpers, pure computations, protocol parsers, stores and compatibility shims do not receive standalone buttons unless they already represent a user-facing tool.
- No duplicate compile/upload backend.
- No second serial stack.
- No second analysis engine.
- No raw evidence schema migration.
- Semantic navigation sets product state first and uses DOM anchors only for the final local reveal/focus.
- Do not restore Arduino CLI polling or add Root-level short periodic timers.
- Existing experiment source lazy loading remains lazy.
- Existing Hardware Doctor and preflight gates remain authoritative.
- Final merge requires all existing workflows plus the new reachability contract to pass on the exact head.

---

## File Structure

### New files

- `src/capabilityRegistry.ts` — canonical user-facing capability inventory and destination types.
- `src/CapabilityNavigationContext.tsx` — semantic routing provider and registered local navigation setters.
- `src/CapabilityNavigator.tsx` — top-level All Tools search/group navigator.
- `src/capability-navigation.css` — navigator and deep-link focus styling.
- `scripts/desktop_capability_reachability_self_check.py` — registry/wiring/anchor structural contract.

### Modified files

- `src/main.tsx` — provider, All Tools command-bar control, exact status-map routing, global destinations.
- `src/App.tsx` — register Studio tab setter; stable anchors; task navigation callback.
- `src/AnalysisVisualizationHub.tsx` — register analysis view setter; stable analysis anchors.
- `src/EngineeringPreparationStudio.tsx` — advanced/handoff/context anchors and navigable collapsibles.
- `src/ExperimentsHub.tsx` — campaign actions and experiment anchors.
- `src/EngineeringExperimentLibrary.tsx` — stable code-library anchor if needed at owning root.
- `src/TaskCenter.tsx` — optional safe `Go to` action.
- `src/EngineeringStatusMap.tsx` — retain generic callback but feed semantic capability targets.
- `src/Observatory.tsx`, `src/ObservatoryMissionControl.tsx`, `src/ObservatoryVisualSummary.tsx` — stable observatory anchors.
- `src/MonitorDataStudio.tsx` — live/snapshot/evidence/replay/primitive anchors.
- `src/DeveloperIDE.tsx` — editor/diagnostics/ecosystem/sketchbook anchors.
- `src/CircuitLab.tsx` — circuit and diagnostic anchors.
- `scripts/run_contract_self_checks.py` — register new check.

---

### Task 1: Protect Reachability with a Failing Contract

**Files:**
- Create: `scripts/desktop_capability_reachability_self_check.py`
- Modify: `scripts/run_contract_self_checks.py`

**Interfaces:**
- Consumes: production TS/TSX source as text.
- Produces: CI contract that initially fails until registry/navigation/anchors exist.

- [ ] **Step 1: Write the RED self-check**

The script must require these files:

```python
required = [
    SRC / 'capabilityRegistry.ts',
    SRC / 'CapabilityNavigationContext.tsx',
    SRC / 'CapabilityNavigator.tsx',
]
for path in required:
    assert path.is_file(), f'missing desktop reachability file: {path.name}'
```

It must later assert these production tokens:

```python
registry = (SRC / 'capabilityRegistry.ts').read_text()
main = (SRC / 'main.tsx').read_text()
app = (SRC / 'App.tsx').read_text()
analysis = (SRC / 'AnalysisVisualizationHub.tsx').read_text()
experiments = (SRC / 'ExperimentsHub.tsx').read_text()

for token in ['hardware-session', 'monitor-live', 'analysis-statistics', 'experiment-code-library', 'task-center']:
    assert token in registry, token
assert 'CapabilityNavigationProvider' in main
assert 'CapabilityNavigator' in main and 'All Tools' in main
assert 'registerStudioTabSetter' in app
assert 'registerAnalysisViewSetter' in analysis
assert 'openCapability' in main
assert 'Open campaign tools' in experiments or 'Open code library' in experiments
```

Also parse quoted `anchor:` values from `capabilityRegistry.ts` and assert each occurs in production TSX as `data-capability-anchor="<anchor>"` or `data-capability-anchor={'<anchor>'}`.

- [ ] **Step 2: Register the check as contract 31**

Append:

```python
"desktop_capability_reachability_self_check.py",
```

to `CHECKS` in `scripts/run_contract_self_checks.py` after `engineering_interaction_self_check.py`.

- [ ] **Step 3: Run/observe RED in CI or local executable environment**

Run:

```bash
python3 scripts/desktop_capability_reachability_self_check.py
```

Expected: FAIL because the three new source files do not exist.

- [ ] **Step 4: Commit the RED contract**

```bash
git add scripts/desktop_capability_reachability_self_check.py scripts/run_contract_self_checks.py
git commit -m "test: protect desktop capability reachability"
```

---

### Task 2: Add the Canonical Capability Registry

**Files:**
- Create: `src/capabilityRegistry.ts`
- Test: `scripts/desktop_capability_reachability_self_check.py`

**Interfaces:**
- Produces `WorkspaceId`, `StudioTabId`, `AnalysisViewId`, `CapabilityDestination`, `Capability`, `CAPABILITIES`, `CAPABILITY_BY_ID`.

- [ ] **Step 1: Define exact destination types**

```ts
export type WorkspaceId = 'studio' | 'observatory' | 'experiments';
export type StudioTabId = 'hardware' | 'circuit' | 'library' | 'data' | 'developer';
export type AnalysisViewId = 'evidence' | 'statistics' | 'models' | 'design' | 'numerical' | 'preparation';

export type CapabilityDestination =
  | { workspace: WorkspaceId; kind: 'workspace'; anchor?: string }
  | { workspace: 'studio'; kind: 'studio-tab'; tab: StudioTabId; anchor?: string }
  | { workspace: 'studio'; kind: 'analysis-view'; view: AnalysisViewId; anchor?: string }
  | { workspace: 'observatory'; kind: 'observatory-section'; anchor: string }
  | { workspace: 'experiments'; kind: 'experiments-section'; anchor: string };
```

- [ ] **Step 2: Populate the initial full inventory**

Include every capability ID named in the spec. Each entry must have `id`, `label`, `group`, `description`, `destination`, `owner`, and non-empty `keywords`.

Representative entries:

```ts
{
  id: 'hardware-doctor',
  label: 'Hardware Doctor',
  group: 'Diagnose',
  description: 'Inspect board detection, profile mismatch, and recovery actions.',
  destination: { workspace: 'studio', kind: 'studio-tab', tab: 'hardware', anchor: 'hardware-doctor' },
  owner: 'App',
  keywords: ['board', 'usb', 'diagnosis', 'profile', 'repair'],
},
{
  id: 'analysis-statistics',
  label: 'Signal & Statistics',
  group: 'Analyze',
  description: 'Inspect statistics, spectrum, EWMA, CUSUM, change points and residuals.',
  destination: { workspace: 'studio', kind: 'analysis-view', view: 'statistics', anchor: 'analysis-statistics' },
  owner: 'AppliedStatisticsWorkbench',
  keywords: ['fft', 'spectrum', 'ewma', 'cusum', 'statistics'],
},
```

- [ ] **Step 3: Add runtime uniqueness guard**

```ts
export const CAPABILITY_BY_ID = new Map(CAPABILITIES.map(capability => [capability.id, capability]));
if (CAPABILITY_BY_ID.size !== CAPABILITIES.length) {
  throw new Error('Duplicate capability id in CAPABILITIES');
}
```

- [ ] **Step 4: Extend the Python contract to validate required IDs and metadata tokens**

Require all spec inventory IDs as literal tokens and require `owner:`, `keywords:`, `destination:`.

- [ ] **Step 5: Commit**

```bash
git add src/capabilityRegistry.ts scripts/desktop_capability_reachability_self_check.py
git commit -m "feat: register desktop capabilities"
```

---

### Task 3: Add Semantic Navigation Provider

**Files:**
- Create: `src/CapabilityNavigationContext.tsx`
- Modify: `src/main.tsx`
- Test: `scripts/desktop_capability_reachability_self_check.py`

**Interfaces:**
- Consumes `CAPABILITY_BY_ID`.
- Produces `CapabilityNavigationProvider`, `useCapabilityNavigation`, setter registration methods, `openCapability`.

- [ ] **Step 1: Implement provider state bridges**

Provider accepts workspace control from Root:

```ts
type Props = {
  workspace: WorkspaceId;
  setWorkspace: (workspace: WorkspaceId) => void;
  children: React.ReactNode;
};
```

Store Studio and analysis setters in refs. Registration returns cleanup functions that only clear the same setter instance.

- [ ] **Step 2: Implement exact navigation sequencing**

`openCapability(id)`:

1. look up registry entry;
2. `setWorkspace(destination.workspace)`;
3. invoke registered Studio/analysis setter when required;
4. `requestAnimationFrame` then `setTimeout(..., 0)` to reveal anchor;
5. open every ancestor `<details>`;
6. call `scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' })`;
7. add `.capability-target-flash`, focus target or first interactive descendant, remove class after 1400 ms;
8. warn when ID/anchor cannot be resolved.

- [ ] **Step 3: Refactor Root into provider boundary**

Keep `workspace` in `Root` and render a nested `RootContent` under:

```tsx
<CapabilityNavigationProvider workspace={workspace} setWorkspace={setWorkspace}>
  <RootContent ... />
</CapabilityNavigationProvider>
```

Do not create a second workspace state.

- [ ] **Step 4: Replace old broad status navigation mapping**

Map status nodes to capability IDs:

```ts
const STATUS_CAPABILITY: Record<EngineeringStatusNode['id'], string> = {
  toolchain: 'hardware-doctor',
  hardware: 'hardware-session',
  firmware: 'program-firmware',
  acquisition: 'monitor-live',
  evidence: 'measurement-evidence',
  analysis: 'analysis-evidence',
};
```

`navigateStatus(node)` calls `openCapability(STATUS_CAPABILITY[node.id])`.

- [ ] **Step 5: Commit**

```bash
git add src/CapabilityNavigationContext.tsx src/main.tsx scripts/desktop_capability_reachability_self_check.py
git commit -m "feat: add semantic capability navigation"
```

---

### Task 4: Add All Tools Navigator to the First Desktop Layer

**Files:**
- Create: `src/CapabilityNavigator.tsx`
- Create: `src/capability-navigation.css`
- Modify: `src/main.tsx`

**Interfaces:**
- Consumes `CAPABILITIES`, `useCapabilityNavigation()`.
- Produces visible command-bar `All Tools` button and searchable navigator panel.

- [ ] **Step 1: Build local searchable navigator**

State:

```ts
const [query, setQuery] = useState('');
const [group, setGroup] = useState<Capability['group'] | 'All'>('All');
```

Filter across `label`, `description`, `owner`, and `keywords` using lowercase includes. Group results by capability group.

- [ ] **Step 2: Implement entry actions**

Each result is a native button with label, description, group/workspace metadata. Click calls `openCapability(id)` then parent `onClose()`.

- [ ] **Step 3: Mount from command bar**

Add `allToolsOpen` state in Root content and visible button copy exactly `All Tools`. Escape priority becomes:

1. close All Tools;
2. close OpenPenguin;
3. exit Focus mode.

- [ ] **Step 4: Add responsive styling**

Use existing visual variables/classes where possible. No fixed viewport-height shell. Panel must remain usable at narrow widths and use ordinary document flow or bounded local overflow only when needed.

- [ ] **Step 5: Commit**

```bash
git add src/CapabilityNavigator.tsx src/capability-navigation.css src/main.tsx
git commit -m "feat: add all tools capability navigator"
```

---

### Task 5: Wire Studio Tabs and Canonical Anchors

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/CircuitLab.tsx`
- Modify: `src/MonitorDataStudio.tsx`
- Modify: `src/DeveloperIDE.tsx`

**Interfaces:**
- Consumes `registerStudioTabSetter` from navigation context.
- Produces all Studio destination anchors.

- [ ] **Step 1: Register App tab setter**

```ts
const { registerStudioTabSetter } = useCapabilityNavigation();
useEffect(() => registerStudioTabSetter(setTab), [registerStudioTabSetter]);
```

Export/import `StudioTabId` so `Tab` does not duplicate the type.

- [ ] **Step 2: Add hardware/library/task anchors**

Add stable attributes to the owning interactive containers:

```tsx
data-capability-anchor="hardware-session"
data-capability-anchor="hardware-doctor"
data-capability-anchor="recipe-preflight"
data-capability-anchor="program-firmware"
data-capability-anchor="recipe-library"
data-capability-anchor="task-center"
```

- [ ] **Step 3: Add Circuit anchors**

At CircuitLab root and rule-checker/diagnostic panel:

```tsx
data-capability-anchor="circuit-lab"
data-capability-anchor="circuit-diagnostics"
```

- [ ] **Step 4: Add Monitor/Data anchors**

Use exact owning regions for:

```text
monitor-live
monitor-snapshot
measurement-evidence
measurement-replay
primitive-observatory
```

Do not move backend logic.

- [ ] **Step 5: Add Developer anchors**

Use exact owning regions for:

```text
developer-editor
developer-verify-upload
developer-ecosystem
developer-sketchbook
developer-diagnostics
```

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/CircuitLab.tsx src/MonitorDataStudio.tsx src/DeveloperIDE.tsx
git commit -m "feat: expose studio capability anchors"
```

---

### Task 6: Wire Analysis Views, Advanced Tools and Handoff

**Files:**
- Modify: `src/AnalysisVisualizationHub.tsx`
- Modify: `src/EngineeringPreparationStudio.tsx`
- Modify: `src/AnnotatedEngineeringPlot.tsx` if annotation anchor belongs there.

**Interfaces:**
- Consumes `registerAnalysisViewSetter`.
- Produces semantic analysis view navigation and analysis/preparation anchors.

- [ ] **Step 1: Register analysis view setter**

```ts
const { registerAnalysisViewSetter } = useCapabilityNavigation();
useEffect(() => registerAnalysisViewSetter(setActive), [registerAnalysisViewSetter]);
```

Use exported `AnalysisViewId` for state type.

- [ ] **Step 2: Anchor each analysis view**

Add:

```text
analysis-evidence
analysis-run-compare
analysis-annotations
analysis-statistics
analysis-models
analysis-experiment-design
analysis-numerical
analysis-preparation
```

- [ ] **Step 3: Anchor preparation internals**

Add:

```text
numerical-advanced
magnet-advanced
engineering-handoff
research-context
```

Place advanced anchors inside their owning `<details>` so provider detail-opening behavior is exercised.

- [ ] **Step 4: Commit**

```bash
git add src/AnalysisVisualizationHub.tsx src/EngineeringPreparationStudio.tsx src/AnnotatedEngineeringPlot.tsx
git commit -m "feat: expose analysis and handoff capabilities"
```

---

### Task 7: Turn Experiment Cards into Real Entry Points

**Files:**
- Modify: `src/ExperimentsHub.tsx`
- Modify: `src/EngineeringExperimentLibrary.tsx` if owning root lacks anchor.
- Modify: `src/EspressifCapabilityPanel.tsx` if owning root lacks anchor.

**Interfaces:**
- Consumes `openCapability`.
- Produces actions for campaign and experiment discovery.

- [ ] **Step 1: Add experiment anchors**

```text
experiments-campaigns
experiment-code-library
numeric-error-depth
esp32-capabilities
```

- [ ] **Step 2: Add action metadata to campaign definitions**

Extend each campaign with a target capability:

```ts
{ title: 'Numeric Error Depth', ..., target: 'numeric-error-depth' }
{ title: 'Oscillation & Numerical Integration', ..., target: 'analysis-numerical' }
{ title: 'Magnetic Model Validation', ..., target: 'analysis-preparation' }
```

- [ ] **Step 3: Render real buttons**

Each card renders:

```tsx
<button type="button" className="primary" onClick={() => openCapability(item.target)}>
  Open campaign tools
</button>
```

The code-library section gets an `Open code library` affordance where useful, but must not duplicate source loading.

- [ ] **Step 4: Commit**

```bash
git add src/ExperimentsHub.tsx src/EngineeringExperimentLibrary.tsx src/EspressifCapabilityPanel.tsx
git commit -m "feat: make experiment campaigns actionable"
```

---

### Task 8: Add Observatory and Global Anchors

**Files:**
- Modify: `src/main.tsx`
- Modify: `src/ObservatoryMissionControl.tsx`
- Modify: `src/Observatory.tsx`
- Modify: `src/HardwareTopology.tsx` if anchor is best owned there.

**Interfaces:**
- Produces anchors for `observatory-mission`, `observatory-system`, `hardware-topology`, `openguin`, `focus-mode`.

- [ ] **Step 1: Anchor global command controls**

Place `data-capability-anchor="focus-mode"` on Focus mode control and `data-capability-anchor="openguin"` on OpenPenguin launcher/drawer owning container.

- [ ] **Step 2: Anchor topology and observatory surfaces**

Use exact owning containers for mission/system/topology.

- [ ] **Step 3: Confirm navigation to workspace-only capabilities still reveals a real surface**

`observatory-mission` and `observatory-system` must switch to Observatory before reveal; `hardware-topology` stays in Studio.

- [ ] **Step 4: Commit**

```bash
git add src/main.tsx src/ObservatoryMissionControl.tsx src/Observatory.tsx src/HardwareTopology.tsx
git commit -m "feat: expose observatory and global capabilities"
```

---

### Task 9: Add Safe Task Center Deep Links

**Files:**
- Modify: `src/TaskCenter.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- `TaskCenterPanel` gains optional `onOpenCapability?: (capabilityId: string) => void`.

- [ ] **Step 1: Define conservative category mapping**

```ts
const TASK_CAPABILITY: Partial<Record<TaskCategory, string>> = {
  Program: 'program-firmware',
  Monitor: 'monitor-live',
  Evidence: 'measurement-evidence',
  Analysis: 'analysis-evidence',
};
```

Do not infer System task destination when title/detail is ambiguous.

- [ ] **Step 2: Render `Go to` only when safe**

For mapped categories and defined callback, render a native button beside task actions.

- [ ] **Step 3: Pass navigation callback from App**

Use `openCapability` from context and pass directly into `TaskCenterPanel`.

- [ ] **Step 4: Commit**

```bash
git add src/TaskCenter.tsx src/App.tsx
git commit -m "feat: deep link task center workflows"
```

---

### Task 10: Harden the Reachability Contract Against Orphans

**Files:**
- Modify: `scripts/desktop_capability_reachability_self_check.py`

**Interfaces:**
- Produces final structural proof that registry destinations exist and major entry points use semantic navigation.

- [ ] **Step 1: Parse capability IDs and anchors conservatively**

Use regex over source literals:

```python
ids = re.findall(r"id:\s*'([^']+)'", registry)
assert len(ids) == len(set(ids)), 'duplicate capability ids'
anchors = re.findall(r"anchor:\s*'([^']+)'", registry)
```

Aggregate production TSX text from all `src/*.tsx` and require each anchor token.

- [ ] **Step 2: Protect first-layer discovery**

Require `All Tools`, `CapabilityNavigator`, `CAPABILITIES` and `openCapability` in appropriate files.

- [ ] **Step 3: Protect semantic routing**

Require `registerStudioTabSetter`, `registerAnalysisViewSetter`, status capability mapping and campaign `openCapability` calls.

- [ ] **Step 4: Protect canonical backends**

Assert existing owning components still contain:

```text
compile_sketch
upload_sketch
serial_stream_start
measurement_sessions
runRuleChecker
```

and assert the new navigator/context files do **not** contain those backend invocation names. This prevents accidental duplicate execution engines.

- [ ] **Step 5: Run full Python suite**

```bash
python3 scripts/run_contract_self_checks.py
```

Expected: PASS all checks.

- [ ] **Step 6: Commit**

```bash
git add scripts/desktop_capability_reachability_self_check.py
git commit -m "test: verify complete desktop capability reachability"
```

---

### Task 11: Build and Interaction Regression Verification

**Files:**
- Modify only if verification exposes defects.

- [ ] **Step 1: Run production build**

```bash
npm install
npm run build
```

Expected: TypeScript and Vite build PASS.

- [ ] **Step 2: Run full contract suite**

```bash
python3 scripts/run_contract_self_checks.py
```

Expected: PASS.

- [ ] **Step 3: Verify no forbidden polling regression**

Confirm `src/HardwareSession.tsx` still has no short `setInterval` board polling and Root has no new periodic task sync.

- [ ] **Step 4: Verify capability inventory against source audit**

Review `src/` user-facing components and ensure any distinct executable/inspectable product surface omitted from `CAPABILITIES` is either added or explicitly classified internal in the spec notes.

- [ ] **Step 5: Commit verification-only fixes if needed**

```bash
git add <only files required by verification>
git commit -m "fix: close capability reachability gaps"
```

---

### Task 12: PR and Exact-Head CI Verification

**Files:**
- No production changes unless CI exposes a real defect.

- [ ] **Step 1: Open PR from `ui/desktop-capability-reachability` to `main`**

Title:

```text
Expose all BetterBoard capabilities through desktop navigation
```

- [ ] **Step 2: Verify exact head SHA**

Record branch head before interpreting workflow results.

- [ ] **Step 3: Require all workflows green on that exact head**

Required:

```text
BetterBoard CI
BetterBoard C++ Core
Engineering Lab Experiments
Sensor Suite v1 Integrity
```

- [ ] **Step 4: If a workflow fails, diagnose the exact failed step/log before changing code**

Do not rerun blindly when a deterministic contract/build failure is present.

- [ ] **Step 5: Merge only after exact-head all-green and explicit user direction to merge**

Do not merge automatically as part of implementation.

---

## Self-Review

- Spec coverage: capability registry, universal discovery, semantic navigation, stable anchors, campaign actions, advanced-tool discovery, status/task deep links, CI reachability contract, accessibility and performance constraints are each assigned to explicit tasks.
- Placeholder scan: no TBD/TODO/"similar to" implementation placeholders remain.
- Type consistency: `WorkspaceId`, `StudioTabId`, and `AnalysisViewId` are defined once in `capabilityRegistry.ts` and consumed by navigation/App/Analysis.
- Boundary consistency: Capability Navigator and navigation context route only; canonical backend invocation stays in existing owning components.
