# Desktop Capability Reachability Design

## Purpose

BetterBoard already contains a large amount of real engineering functionality, but not every capability is equally discoverable or reachable from the first desktop UI layer. Some tools are mounted deep in pages, some are hidden behind `<details>`, some are represented by static cards or copy-path controls, and some status elements navigate only to a broad workspace instead of the exact owning tool.

This design establishes a product-wide rule: **every real, user-facing capability must be reachable from visible desktop UI, must route to its owning interaction surface, and must expose a real action or real inspectable result rather than a decorative placeholder.**

The goal is not to flatten the entire product into one giant sidebar. The goal is to make every capability discoverable from the first UI layer through a coherent capability navigator and a shared semantic navigation system.

## Scope

This phase covers desktop reachability and navigation for existing functionality across:

- Studio
  - Hardware & Program
  - Hardware Doctor
  - recipe preflight
  - prepare / compile / upload
  - Circuit Lab and rule diagnostics
  - Recipe Library / My Library
  - Monitor & Data
  - live serial / snapshot / evidence recording / replay
  - Developer IDE
  - Boards / Libraries / Examples / Sketchbook
  - Task Center
- Analysis & Visualization
  - Evidence inspection
  - Run A / Run B comparison
  - User annotations
  - Applied Statistics
  - Model Fitting
  - Experiment Planning
  - Numerical Reliability
  - Engineering Preparation
  - Numerical advanced tools
  - Magnet advanced tools
  - Research Bridge / evidence handoff
- Observatory
  - mission control
  - visual summary
  - whole-system observability
  - Primitive Observatory / host-device primitive diagnostics where mounted by Monitor/Data and observatory flows
- Experiments
  - campaign entry points
  - complete experiment code library
  - firmware Verify / Upload
  - ESP32 capability/research surfaces
  - Numeric Error Depth campaign family
- Global
  - OpenPenguin
  - Focus mode
  - Engineering Status Map
  - Hardware Topology
  - task/log navigation
  - capability search / All Tools

Backend-only helpers, protocol parsers, data stores, pure computation modules, compatibility shims, and internal utility functions are not required to have standalone buttons. They must be reachable through the user-facing capability that owns them.

## Non-Goals

- No duplicate compile/upload backend.
- No second serial stack.
- No second analysis engine.
- No migration of raw evidence schemas.
- No conversion of internal helper modules into meaningless UI buttons.
- No arbitrary docking/window manager.
- No claim that a capability is usable merely because its source file exists.
- No fake actions that only change copy or visual state without executing/entering the owning workflow.

## Core Product Rule

Every registered user-facing capability must satisfy all of the following:

1. **Discoverable** — visible in the desktop `All Tools` / capability navigator, or represented by a visible first-layer action that is also indexed by the navigator.
2. **Addressable** — has a stable semantic destination independent of DOM position.
3. **Reachable** — selecting it changes workspace/tab/view and focuses or reveals the owning surface.
4. **Actionable** — the destination exposes a real interaction, inspectable state, source, plot, workflow, or backend-backed action.
5. **Traceable** — capability metadata names the owning component and route target so CI can detect orphaned features.
6. **Non-duplicative** — navigation reuses canonical product surfaces rather than creating parallel implementations.

## Architecture

### 1. Capability Registry

Create `src/capabilityRegistry.ts` as the canonical list of desktop user-facing capabilities.

It defines:

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

export type Capability = {
  id: string;
  label: string;
  group: 'Build' | 'Measure' | 'Analyze' | 'Compare' | 'Experiment' | 'Diagnose' | 'Develop' | 'System';
  description: string;
  destination: CapabilityDestination;
  owner: string;
  keywords: string[];
};
```

The registry must contain product capabilities, not internal implementation files.

### 2. Semantic Navigation Bus

Create `src/CapabilityNavigationContext.tsx`.

Public API:

```ts
export type CapabilityNavigationRequest = {
  capabilityId: string;
};

export type CapabilityNavigator = {
  openCapability: (capabilityId: string) => void;
  registerStudioTabSetter: (setter: (tab: StudioTabId) => void) => () => void;
  registerAnalysisViewSetter: (setter: (view: AnalysisViewId) => void) => () => void;
};

export function CapabilityNavigationProvider(props: { children: React.ReactNode }): JSX.Element;
export function useCapabilityNavigation(): CapabilityNavigator;
```

`Root` owns workspace state. `App` registers the Studio tab setter. `AnalysisVisualizationHub` registers the analysis view setter. Navigation therefore routes by semantic product state first and uses `anchor` only to focus/reveal the final local section.

No capability navigation may depend solely on an ad-hoc `document.querySelector('.some-class')` from the caller.

### 3. All Tools / Capability Navigator

Create `src/CapabilityNavigator.tsx`.

It is permanently reachable from the top command bar via a visible `All Tools` button. The panel provides:

- search by label, description and keywords;
- group filtering;
- all registered capabilities;
- visible owning workspace;
- one-click `Open` behavior;
- keyboard-friendly buttons;
- no hidden unfinished controls.

This is the universal discovery layer. It does not duplicate the full UI of the target capability.

### 4. Stable Anchors

Owning surfaces receive stable `data-capability-anchor="..."` markers at meaningful interaction containers.

Examples:

- `hardware-session`
- `hardware-doctor`
- `recipe-preflight`
- `program-firmware`
- `task-center`
- `circuit-diagnostics`
- `recipe-library`
- `monitor-live`
- `measurement-evidence`
- `developer-editor`
- `developer-ecosystem`
- `analysis-evidence`
- `analysis-run-compare`
- `analysis-statistics`
- `analysis-models`
- `analysis-experiment-design`
- `analysis-numerical`
- `analysis-preparation`
- `engineering-handoff`
- `experiments-campaigns`
- `experiment-code-library`
- `esp32-capabilities`
- `observatory-mission`
- `observatory-system`

After semantic state is set, navigation schedules a bounded reveal attempt and focuses the target when possible.

### 5. Campaign Cards Become Actions

Experiment campaign cards must not remain static descriptions. Each card gets a concrete action, for example:

- `Open campaign tools`
- `Open code library`
- `Open numerical analysis`
- `Open magnetic preparation`

The exact action routes to an existing canonical surface. It does not create duplicate campaign engines.

### 6. Advanced Tools Become Discoverable

Advanced Numerical, Advanced Magnet, Research Bridge, implementation tool paths, ESP32 tools, and related capability surfaces may remain collapsible locally, but they must also appear in All Tools and semantic navigation must open the correct parent view and reveal the control.

If a `<details>` element contains the destination anchor, navigation must programmatically open the nearest owning `<details>` before focus/reveal.

### 7. Status and Task Deep Links

Engineering Status Map navigation must route by capability IDs rather than broad workspace scrolling.

Task Center gets an optional `Go to` action when the task category has a canonical owning capability:

- Program → `program-firmware`
- Monitor → `monitor-live`
- Evidence → `measurement-evidence`
- Analysis → `analysis-evidence`
- System → `hardware-doctor` or system status depending on task metadata; when not safely inferable, no fabricated deep link is shown.

### 8. Reachability Contract

Create `scripts/desktop_capability_reachability_self_check.py` and register it in `scripts/run_contract_self_checks.py`.

The contract checks at minimum:

- registry file exists;
- every capability ID is unique;
- every capability has owner, description, keywords and destination;
- top command bar mounts `CapabilityNavigator` / `All Tools`;
- `App` registers Studio tab navigation;
- `AnalysisVisualizationHub` registers analysis view navigation;
- status map routes through `openCapability`;
- campaign cards expose real navigation buttons;
- all anchor strings referenced by the registry exist in production TSX;
- forbidden regression: capability routing cannot fall back to only the old broad `navigateStatus` scroll behavior;
- canonical backend actions remain in their existing owning components;
- no duplicate compiler/upload or serial APIs are introduced by this feature.

The test is intentionally structural and conservative. It proves reachability wiring, not physical hardware correctness.

## Initial Capability Inventory

The registry must include at least these capability IDs:

### Build / Diagnose

- `hardware-session`
- `hardware-doctor`
- `recipe-preflight`
- `program-firmware`
- `recipe-library`
- `circuit-lab`
- `circuit-diagnostics`

### Measure

- `monitor-live`
- `monitor-snapshot`
- `measurement-evidence`
- `measurement-replay`
- `primitive-observatory`

### Analyze / Compare

- `analysis-evidence`
- `analysis-run-compare`
- `analysis-annotations`
- `analysis-statistics`
- `analysis-models`
- `analysis-experiment-design`
- `analysis-numerical`
- `analysis-preparation`
- `numerical-advanced`
- `magnet-advanced`
- `engineering-handoff`
- `research-context`

### Develop

- `developer-editor`
- `developer-verify-upload`
- `developer-ecosystem`
- `developer-sketchbook`
- `developer-diagnostics`

### Experiment

- `experiments-campaigns`
- `experiment-code-library`
- `numeric-error-depth`
- `esp32-capabilities`

### System

- `observatory-mission`
- `observatory-system`
- `hardware-topology`
- `task-center`
- `openguin`
- `focus-mode`

The inventory may grow during implementation when a source audit discovers another distinct user-facing capability. Internal helpers are not automatically promoted.

## Interaction Details

### Opening a capability

1. Resolve capability ID from registry.
2. Set top-level workspace.
3. If destination is a Studio tab, set the registered Studio tab.
4. If destination is an analysis view, set Studio workspace and registered analysis view.
5. On the next frame/tick, locate `data-capability-anchor`.
6. Open ancestor `<details>` nodes when needed.
7. Scroll the target into view with reduced-motion awareness.
8. Focus the target or its first interactive descendant when appropriate.

### Missing destination

A missing anchor must not fail silently. In development it should `console.warn` with the capability ID. The reachability self-check prevents known registry anchors from shipping without matching markup.

### Disabled actions

Capabilities may route to surfaces whose actions are disabled because hardware, libraries, evidence or configuration are missing. This still counts as reachable if the UI explains why it is blocked and exposes the existing recovery workflow. Reachability does not mean bypassing Hardware Doctor or safety/preflight gates.

## Visual Design

- Keep existing BetterBoard visual language.
- Add one `All Tools` command-bar control, not dozens of top-level tabs.
- Navigator uses compact groups and search.
- Capability entries show label, short description and workspace/group context.
- Existing sidebars and analysis rails remain canonical local navigation.
- Campaign cards gain clearly visible action rows.
- Deep-linked targets receive a temporary focus/highlight class, subtle and non-animated when `prefers-reduced-motion` is enabled.

## Performance Constraints

- Registry is static data; no polling.
- Navigator search uses local memoized filtering.
- Opening All Tools does not eagerly execute hidden analyzers.
- Do not restore Arduino CLI interval polling.
- Do not add Root-level short periodic timers.
- Existing lazy-loaded experiment source bodies remain lazy.

## Accessibility

- All capability entries are native buttons.
- Search has visible label/placeholder and keyboard focus.
- `Escape` closes All Tools before exiting Focus mode.
- Semantic destination focus is applied after navigation.
- No essential action is hover-only.
- Existing command shortcuts remain intact.

## Testing Strategy

1. RED structural contract for the registry and navigation wiring.
2. TypeScript/Vite build after each UI batch.
3. Existing 30+ contract suite must remain green.
4. New self-check validates registry-to-anchor coverage.
5. Existing CI workflows remain required:
   - BetterBoard CI
   - BetterBoard C++ Core
   - Engineering Lab Experiments
   - Sensor Suite v1 Integrity
6. Final exact-head verification before merge.

## Success Criteria

This phase is complete only when:

- every registered user-facing capability appears in All Tools;
- every capability opens its real owning surface;
- every destination anchor exists;
- status nodes deep-link to real tools;
- experiment campaign cards have real actions;
- advanced tools are discoverable without knowing their source location;
- Task Center can navigate to safely attributable owning workflows;
- blocked tools explain their blocker rather than pretending to run;
- existing core functionality remains intact;
- the reachability contract and all existing CI workflows pass on the exact head.
