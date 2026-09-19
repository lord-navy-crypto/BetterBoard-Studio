# BetterBoard First-Principles Progressive Home Surface Design

Date: 2026-09-16
Branch: `ui/desktop-capability-reachability`
Status: design proposal approved in chat, pending written-spec review

## 1. Problem

BetterBoard now exposes a large desktop capability surface through a canonical capability registry, semantic navigation, direct shortcuts, and All Tools. The remaining problem is not raw reachability. It is comprehension.

The current desktop shell presents a command bar, runtime context, engineering status map, hardware topology, a next-action line, workspace panes, All Tools, and OpenPenguin. These elements are individually useful, but the home surface still behaves like several powerful components placed next to one another rather than one coherent engineering decision surface.

At the same time, the repository still needs systematic reverse auditing so that user-facing code with independent value is not left orphaned, deeply buried, or reachable only by knowing a parent component's internal layout.

This design addresses both concerns:

1. reorganize the home surface from first principles;
2. preserve progressive disclosure so the home screen does not become a button wall;
3. continue reverse source auditing so meaningful hidden capabilities become discoverable;
4. preserve one canonical backend owner for every real action.

## 2. First-principles product model

A user opening BetterBoard should be able to answer four questions immediately:

1. **What state is the system in?**
2. **What should I do next?**
3. **Where do I go to accomplish the current engineering task?**
4. **How do I access deeper or uncommon capabilities without losing them?**

The home surface therefore must optimize for engineering decisions, not for component inventory.

The governing hierarchy is:

`State -> Decision -> Workflow -> Current Work -> Advanced Capabilities -> Complete Index`

All Tools remains the complete capability index. The home surface is not required to display every destination simultaneously.

## 3. Core design principles

### 3.1 One truth, many entry points

Navigation may expose many entry points, but backend actions remain single-owner. Navigation must never duplicate compile, upload, serial, evidence, AI, persistence, or analysis backends.

### 3.2 Progressive disclosure

Important state and next actions are visible first. Common workflows come next. Advanced or specialized surfaces come later. The complete index remains searchable in All Tools.

### 3.3 Independent value earns discoverability

A source surface earns a direct discoverable destination when it has one or more of the following:

- independent user input and independent output;
- independent persistent state;
- an independent execution action;
- an independent diagnostic or audit result;
- an independent visualization/result viewer;
- a workflow that can be meaningfully started without hidden prerequisite selection.

A source surface should not be promoted when it is only:

- a metric inside an owning workbench;
- a backend helper;
- a sub-control that requires a currently selected object;
- a duplicated presentation of another canonical capability;
- a no-context action that would open into an unusable empty state.

### 3.4 Navigation must reveal, not execute destructive work

All Tools and home shortcuts may navigate, reveal, focus, expand, or select a surface. They must not automatically compile, upload, delete, install, transmit, mutate external configuration, or perform other consequential actions merely because the destination was opened.

### 3.5 Product terminology

The product-facing laboratory identity is **Engineering Lab**. Historical `Physical Lab` wording may remain only at compatibility/archive boundaries where changing it would alter an existing data or bridge contract.

## 4. Home information architecture

The Studio home surface becomes a progressive engineering command surface with six layers.

### Layer 1: Global command bar

Keep the existing workspace command bar, but make its roles clearer:

- Studio
- Observatory
- Experiments
- All Tools
- OpenPenguin
- Focus
- current hardware connection state

This remains global and compact. It is navigation, not the main content area.

### Layer 2: Engineering Command Surface

Replace the current loose combination of `EngineeringStatusMap + HardwareTopology + Next action` with one coordinated first-screen surface.

The command surface contains:

- system readiness summary;
- current board/profile/port;
- the six-stage engineering state chain;
- one primary recommended next action;
- one contextual recovery/secondary action when blocked;
- active task state when relevant.

The six-stage chain is:

`Toolchain -> Hardware -> Firmware -> Acquisition -> Evidence -> Analysis`

Each stage remains semantically navigable to its canonical capability.

The recommended next action is derived from actual runtime state, not hard-coded screen ordering.

Example states:

- Arduino CLI missing -> `Restore toolchain`
- no selected board -> `Connect and select hardware`
- hardware ready, no program result -> `Verify or program firmware`
- live acquisition -> `Save live run as evidence`
- captured data but no evidence -> `Record evidence`
- saved evidence but no analysis -> `Analyze or compare evidence`
- completed analysis -> `Start next experiment`

### Layer 3: Engineering Flow

Expose four task-oriented lanes rather than implementation-oriented components:

#### Build
Primary destinations:

- Hardware Session
- Program Firmware
- Recipe Library
- Circuit Lab

#### Measure
Primary destinations:

- Live Serial Monitor
- Snapshot Capture
- Record Evidence
- Measurement Replay

#### Analyze
Primary destinations:

- Evidence Inspector
- Signal & Statistics
- Model Fitting
- Numerical Reliability
- Engineering Preparation

#### Experiment
Primary destinations:

- Experiment Planning
- Experiment Campaigns
- Engineering Lab Handoff
- Research Context

Each lane shows a compact state or recent context when available. It must not replicate the full All Tools list.

### Layer 4: Current Work

Show only runtime context that helps the user continue work:

- active background task;
- last successful program action;
- current/recent evidence source;
- current experiment/campaign when available;
- latest warning/failure that still needs attention.

This layer should disappear or collapse when no useful state exists.

### Layer 5: Advanced Capability Groups

Expose compact entry groups for specialized workflows:

- Diagnostics
- Numerical
- Magnetism
- ESP32 / embedded research
- Developer
- Research handoff
- System / runtime

These groups are launch surfaces into canonical capabilities and direct shortcuts, not duplicates of the All Tools catalog.

### Layer 6: Complete capability index

All Tools remains the exhaustive searchable inventory.

All Tools should evolve from a flat grouped list into a more informative progressive navigator while retaining search:

- search remains primary;
- capability groups remain filterable;
- distinguish canonical workbenches from direct sub-tool shortcuts;
- allow compact metadata such as workspace and owner;
- support optional high-level filters such as `Common`, `Advanced`, and `Developer/System` if they can be derived without hard-coding duplicate inventories;
- show the total canonical/direct counts for audit visibility.

The home surface must never replace All Tools as the completeness mechanism.

## 5. Hidden-capability reverse audit

The repository will be audited from source outward, not only from existing registry entries inward.

### 5.1 Audit classes

Inspect these source categories:

- React components with user input/output;
- components containing Tauri `invoke` calls;
- persistent local or file-backed state;
- result viewers and visualization surfaces;
- diagnostic/audit panels;
- experiment and research panels;
- developer/editor ecosystem surfaces;
- monitor/evidence/serial sub-workflows;
- source components mounted nowhere or only conditionally mounted;
- meaningful nested `<details>` / tab / mode surfaces that cannot currently be reached semantically.

### 5.2 Classification outcome

Every candidate must be classified as exactly one of:

1. **Canonical capability** — independently meaningful workbench or workflow.
2. **Direct shortcut** — meaningful nested sub-tool owned by an existing canonical capability.
3. **Owner-internal** — context-dependent control/metric that should remain inside its workbench.
4. **Backend-only** — no user-facing entry.
5. **Dead/orphaned UI** — source exists but is not mounted/reachable; either reconnect intentionally or document/remove in a later cleanup phase.

### 5.3 Orphan detection contract

Add CI/static checks that can detect user-facing source surfaces known to require registry coverage. The contract should not attempt to infer every React component automatically. Instead it should maintain explicit audited inventories by subsystem and fail when an audited independent surface loses its canonical/shortcut reachability.

The audit should remain strict enough to catch regressions without rewarding meaningless shortcut inflation.

## 6. Component architecture

### 6.1 New home-level components

Prefer extracting the home shell from `main.tsx` into focused components rather than further expanding `RootContent`.

Proposed components:

- `EngineeringCommandSurface`
  - consumes status nodes, hardware context, workflow recommendation, and active task summary;
  - owns no hardware/backend side effects;
  - emits semantic navigation requests only.

- `EngineeringFlowLauncher`
  - renders Build / Measure / Analyze / Experiment lanes;
  - items are derived from capability IDs, not duplicated destination objects.

- `CurrentWorkSummary`
  - renders transient task/evidence/program/experiment context;
  - does not own persistence.

- `AdvancedCapabilityLauncher`
  - compact domain-level deep links into specialized tools;
  - backed by capability/shortcut IDs.

The existing `CapabilityNavigator`, `EngineeringStatusMap`, `HardwareTopology`, and navigation provider remain reusable pieces. `EngineeringStatusMap` and `HardwareTopology` may be visually recomposed or partially embedded, but their status logic should not be duplicated.

### 6.2 Data ownership

`RootContent` continues to own or consume global runtime state that already exists there:

- workspace;
- hardware session state;
- Arduino CLI discovery;
- task memory;
- selected evidence source;
- derived workflow state.

New home components receive normalized view models/props. They do not call Tauri backends directly.

### 6.3 Navigation ownership

All launch surfaces call `openCapability(id)`.

The semantic navigation layer remains responsible for:

1. switching workspace;
2. activating canonical parent destination;
3. switching tab/view/mode;
4. performing required non-destructive reveal steps;
5. resolving stable anchor or text-aware fallback;
6. scrolling/focusing/flashing the target.

No home component may know DOM selectors for deep destinations.

## 7. Visual hierarchy

### 7.1 First screen priority

The first visible Studio screen should emphasize, in order:

1. current system state;
2. next action;
3. engineering stage progression;
4. common workflow entry lanes.

Hardware topology details and secondary diagnostics should not visually compete with the primary action unless a hardware fault makes them relevant.

### 7.2 Progressive density

The surface should become denser as the user moves downward:

- command surface: low density, high priority;
- engineering flow: moderate density;
- current work: contextual density;
- advanced groups: compact high density;
- All Tools: exhaustive density.

### 7.3 Visual semantics

Status color should carry operational meaning only: ready, active, warning, blocked/unavailable. Decorative color should not compete with status semantics.

Primary next action should be visually stronger than alternate actions. Advanced surfaces should be clearly available without looking equally urgent.

### 7.4 Responsive behavior

At narrower widths:

- command surface stacks without losing the recommended action;
- stage chain may wrap into a two-row or compact timeline;
- workflow lanes reflow from four columns to two or one;
- current work and advanced groups stack;
- no horizontal page-level overflow.

## 8. All Tools evolution

All Tools is already the completeness layer. The redesign should improve comprehension without breaking exact searchability.

Required behavior:

- all canonical capabilities and direct shortcuts remain searchable;
- current group filters remain supported;
- direct shortcuts remain visibly distinguished from canonical workbenches;
- search covers label, description, owner, group, workspace, and keywords;
- opening an item closes the drawer and performs semantic navigation;
- no All Tools action automatically triggers compile/upload/config mutation.

Potential improvement after the home refactor stabilizes:

- derive a `tier` or `visibility` metadata field (`primary`, `advanced`, `expert`) from registry/shortcut metadata;
- use this metadata both for home launchers and All Tools filtering;
- avoid maintaining a separate hard-coded home inventory where possible.

## 9. Failure and edge behavior

### Missing target

If semantic navigation cannot resolve the exact target after parent activation, it should still leave the user in the correct canonical owner surface and surface a non-fatal development diagnostic rather than silently doing nothing.

### Empty contextual state

Current Work must omit absent sections instead of showing empty cards.

### Missing hardware/toolchain

The command surface should convert missing prerequisites into a clear recovery next action and preserve direct navigation to Hardware Doctor / toolchain diagnostics.

### Busy operations

Home navigation must never bypass existing `busy`, `canCompile`, `canUpload`, or Hardware Doctor gates.

### Orphaned source feature

If audit finds an independent user-facing surface with no owner/mount/navigation path, implementation must choose deliberately between reconnecting it or classifying it as dead UI. It must not remain accidentally unreachable.

## 10. Testing strategy

### 10.1 Structural contracts

Extend the existing Python reachability suite with contracts for:

- home command surface is mounted in Studio;
- engineering flow launchers reference valid canonical/shortcut IDs;
- no duplicate backend calls in home/navigation components;
- all promoted hidden surfaces exist in the audited inventory;
- each audited promoted surface has registry/shortcut coverage;
- owner-first semantic navigation remains enforced for direct shortcuts.

### 10.2 Frontend build

Run TypeScript + Vite production build on each GREEN head.

### 10.3 Existing hardware compile gates

Retain the current UNO firmware compile checks. The home redesign must not weaken firmware validation.

### 10.4 Rust check

Retain Tauri/Rust check. The phase should be UI/navigation-heavy but the exact candidate head still must pass backend compilation.

### 10.5 Manual desktop scenarios

Verify at minimum:

- cold launch with no board;
- launch with recognized board;
- toolchain unavailable;
- hardware/profile mismatch;
- program complete, acquisition not started;
- live acquisition active;
- evidence captured but not analyzed;
- analyzed evidence ready for experiment;
- open deep Developer/Experiment/Numerical/Magnet shortcuts from an unrelated workspace;
- use All Tools search for obscure capabilities;
- repeated workspace switching and deep-link opening;
- narrow-window responsive behavior.

## 11. Implementation sequencing

The implementation should occur in bounded TDD slices even though the overall redesign is architectural.

Recommended order:

1. Add audited hidden-surface inventory contract without production changes (RED where appropriate).
2. Promote newly confirmed independent hidden surfaces through registry/shortcut/navigation.
3. Add `EngineeringCommandSurface` shell and contract.
4. Move existing status/next-action/topology presentation into the new command hierarchy without changing backend state derivation.
5. Add `EngineeringFlowLauncher` using existing capability IDs.
6. Add `CurrentWorkSummary` from existing task/evidence/program state.
7. Add `AdvancedCapabilityLauncher` using registry/shortcut IDs.
8. Refine All Tools progressive metadata/filtering only after home behavior is stable.
9. Run exact-head full CI and manual desktop verification.

Each slice should preserve a runnable candidate head and should not merge PR #67 until explicitly requested.

## 12. Non-goals

This phase does not:

- rewrite Arduino CLI execution;
- rewrite serial acquisition;
- rewrite evidence persistence;
- rewrite numerical/magnetic analysis engines;
- redesign experiment science logic;
- merge the feature PR automatically;
- expose backend helpers as fake tools;
- auto-execute consequential actions from navigation;
- remove advanced features merely to simplify the home screen.

## 13. Success criteria

The phase is successful when:

1. a first-time user can identify system state and the recommended next action without opening a secondary panel;
2. the four main engineering workflows are visible without searching;
3. advanced and expert capabilities remain discoverable without overwhelming the first screen;
4. all audited independent user-facing code has an intentional discoverability classification;
5. All Tools remains the complete searchable inventory;
6. semantic navigation from arbitrary workspace state reaches the intended target reliably;
7. no duplicated backend execution path is introduced;
8. exact-head frontend build, reachability contracts, firmware compile checks, and Rust check all pass.
