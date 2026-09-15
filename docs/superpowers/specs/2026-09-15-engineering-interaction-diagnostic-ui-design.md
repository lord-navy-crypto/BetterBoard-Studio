# Phase 6 — Engineering Interaction & Diagnostic UI

## Status

Approved design direction for the existing BetterBoard Studio feature branch `ui/analysis-visualization-integration-a9` / PR #66.

This phase is an interaction and diagnostic-visualization pass over existing engineering capabilities. It must not introduce new scientific algorithms, silently change evidence semantics, or replace established hardware / analysis engines.

## Problem

Phase 5 made BetterBoard's existing scientific analysis and analyzer output visible. The next usability bottleneck is different: the application already knows a large amount about hardware readiness, compile/upload state, circuit-rule failures, background tasks, primitive analysis, and developer diagnostics, but much of that knowledge is still presented as isolated text, lists, or independent plots.

The goal of Phase 6 is to make the application behave like one engineering workstation: users should be able to see where a workflow is blocked, inspect one event across multiple plots, trace a circuit problem back to a net or pin, and follow an operation from preparation through evidence without creating a second set of backend logic.

## Design principle

> Reuse existing structured state and make relationships visible. Do not duplicate diagnosis engines to make a nicer UI.

The canonical source of truth remains where it already lives:

- Hardware readiness: `HardwareSession`, Hardware Doctor diagnosis, selected/detected FQBN, preflight.
- Circuit correctness: existing `CircuitLab` rule checker.
- Background work: existing `BackgroundTask` / Task Center state.
- Developer diagnostics: existing compile-output parser and Monaco diagnostics.
- Signal analysis: canonical `PrimitiveObservatory` / `computeHostPrimitiveObservability` results and device-result comparison.
- Evidence: existing immutable measurement/replay records and Phase 5 shared evidence context.

## Scope

Phase 6 consists of six product slices:

1. Linked plot inspection and range selection.
2. Engineering status map and hardware topology.
3. Task Center 2.0.
4. Circuit diagnostic overlay and net tracing.
5. Developer engineering split view.
6. Responsive / focus-mode polish.

The slices share interaction semantics but remain independently testable.

## 1. Linked Plot Inspection

### Purpose

Turn Primitive Observatory and other related time-series views from a collection of independent charts into one inspection surface.

### Shared inspection model

Introduce a small shared inspection context for related engineering plots. It stores only UI inspection state:

- selected x/time coordinate,
- optional selected interval `[x0, x1]`,
- source/evidence identity,
- reset action.

It must not store or mutate source data.

### EngineeringPlot behavior

`EngineeringPlot` gains optional support for:

- externally controlled selected x coordinate,
- callback when the user clicks/selects a point,
- optional interval brush / selected range,
- synchronized vertical cursor,
- selected-point tooltip payload,
- reset-to-full-range.

All additions remain optional so existing Phase 5 charts continue to work unchanged.

### Primitive Observatory

All time-aligned primitive plots share the same inspection context:

- raw signal,
- RMS,
- derivative,
- integral,
- EMA,
- peak hold,
- threshold state,
- hysteresis state,
- regression / change-event traces when applicable.

Selecting `t = x` in one plot shows the same cursor in the others.

When both host and device values exist, the inspection readout must preserve producer identity. Example semantic labels:

- `MEASURED`
- `HOST-DERIVED`
- `DEVICE-DERIVED`
- `REFERENCE` / `MODEL` when a chart uses those producers.

Do not silently interpolate a device value and present it as exact if the alignment helper only supports nearest/aligned samples. The tooltip must reflect the alignment semantics already used by the comparison engine.

### Range brushing

A selected interval changes viewport only. It must never crop or rewrite raw evidence.

Resetting the range restores the complete visible source.

## 2. Engineering Status Map & Hardware Topology

### Engineering status map

Add a compact top-level engineering workflow rail representing:

`Toolchain → Hardware → Firmware → Acquisition → Evidence → Analysis`

Allowed semantic states:

- `READY`
- `ACTIVE`
- `WARNING`
- `BLOCKED`
- `UNAVAILABLE`

The rail is a visualization of existing state, not a new scoring engine.

Each node can navigate to the corresponding existing Studio surface.

### State derivation

Examples:

- Toolchain: Arduino CLI discovery / ecosystem availability.
- Hardware: Hardware Doctor diagnosis, port selection, target compatibility.
- Firmware: recipe/preflight/compile or active developer target state.
- Acquisition: live monitor / snapshot / capture readiness.
- Evidence: measurement or replay availability / completeness.
- Analysis: shared evidence selected and analysis surface available.

A warning does not imply scientific invalidity. A blocked hardware state does not imply that saved evidence is invalid.

### Hardware topology

Add a topology view to Hardware & Program:

`USB device → detected board → selected FQBN → Arduino core → required libraries → firmware`

Edges and nodes visualize the existing diagnosis/preflight state.

Examples:

- detected/selected FQBN mismatch: break/highlight that edge,
- missing core: block the core node,
- missing library: mark the library node and prevent the visual chain from claiming readiness,
- no port: hardware node unavailable,
- compatible selected target: normal path.

The topology must not infer an exact physical board model when current Hardware Doctor evidence does not establish one.

## 3. Task Center 2.0

### Existing model remains canonical

Retain `BackgroundTask` and current Task Center persistence/cancellation semantics.

Do not create a second operation database.

### Overview

Task Center gets a compact summary:

- running count,
- failed count,
- recent count,
- latest failure when present.

### Operation timeline

A task may expose a derived sequence of stages appropriate to its category. Example for upload:

`Prepare → Compile → Upload`

Example for evidence:

`Acquire → Save → Register`

Example for replay:

`Locate → Load → Parse`

Stages are derived from known task/log events; they must not pretend that a step occurred when the task model does not provide evidence for it.

### Task interactions

Add where supported:

- elapsed duration,
- retry affordance only when a safe existing retry action exists,
- navigate/open-related-tool action,
- copy logs,
- search/filter logs,
- running/failed/recent filters,
- pinned latest failure.

Do not invent replayable commands from arbitrary historical log text.

## 4. Circuit Diagnostic Overlay & Net Tracing

### Rule engine remains canonical

The existing `runRuleChecker` output is the only source of circuit-rule issues in this phase.

Do not create a separate visual-only electrical rule engine.

### Net graph

Derive connected electrical nets from the existing component/pin/wire graph for visualization only.

Selecting a wire or pin highlights the entire connected net.

### Visual semantics

Use consistent semantic roles for:

- power,
- ground,
- analog signal,
- digital/PWM signal,
- passive connection,
- problem location.

These are presentation semantics based on existing pin roles; they do not constitute electrical simulation.

### Issue projection

When an issue can be mapped to a component, pin, or wire involved in the existing checker finding, the corresponding canvas element is highlighted.

Issue-list interaction:

- clicking an issue focuses/highlights the affected component/net,
- `Show only problems` dims unrelated parts,
- hover/click on a pin shows pin role, nominal voltage if known, and connected peers,
- direct short / rail mismatch / invalid power-to-I/O paths should visibly identify the involved connection.

If an issue only has descriptive text and no reliable structured location, keep it in the issue panel rather than guessing a canvas target.

## 5. Developer Engineering Split View

### Preserve editor architecture

Retain the existing Developer IDE, Monaco integration, draft preservation, filesystem guards, ecosystem manager, and compile diagnostic parser.

### Split layout

Default editor surface becomes a responsive split:

- left: source editor / project context,
- right: target + run state / diagnostics / build output.

Right-side sections can include:

- selected FQBN,
- selected port,
- compile/upload state,
- parsed diagnostics,
- run output,
- quick route to Monitor & Data.

### Diagnostic navigation

Existing line/column diagnostics become clickable navigation into the active editor file.

Diagnostics for sibling files continue to remain in run output unless/open until the project-file UI can safely switch files.

### Upload behavior

Successful upload may change the runtime panel to `DEVICE READY` / upload-complete state.

It must not automatically open the serial port or start the Monitor, because that can contend for the same serial device and would change current acquisition semantics.

A clear action may route the user to Monitor & Data instead.

## 6. Responsive / Focus Polish

### Focus mode

Provide an optional focus mode for presentation and experiment use.

Focus mode hides secondary navigation and low-priority controls while preserving:

- current engineering/analysis content,
- critical status,
- exit control.

It is a UI mode only; it must not pause background tasks or alter acquisition.

### Responsive rules

The new topology, task timelines, split view, and synchronized charts must degrade cleanly on narrower screens:

- topology becomes vertical,
- split Developer layout stacks,
- Task Center timeline becomes vertical/compact,
- plot inspection readout wraps rather than overflows,
- focus mode remains reversible.

## Cross-cutting interaction semantics

### Producer/provenance identity

The UI must continue to distinguish:

- raw/measured evidence,
- host-derived analysis,
- device-derived results,
- model/reference values,
- user annotations.

### User annotations

If annotation support is included in the first implementation, annotations are session-local UI state and explicitly labeled `USER ANNOTATION`.

They are not written into the Measurement Package schema in Phase 6.

If persistent annotations are desired later, that requires a separate evidence-schema design.

### Navigation

Diagnostic surfaces may navigate users to existing tabs/workspaces, but they must not trigger destructive or hardware-changing actions merely because a status node is clicked.

## Non-goals

Phase 6 explicitly does not include:

- new scientific algorithms,
- new statistical / signal processing engines,
- 3D circuit rendering,
- SPICE/electrical simulation,
- AI auto-repair of circuits,
- AI auto-editing of source code,
- automatic serial-port acquisition after upload,
- Measurement Package schema migration,
- arbitrary dockable-window framework,
- full Developer IDE rewrite,
- flashy animation as a correctness substitute.

## Implementation sequence

Recommended order:

1. Shared plot inspection context and `EngineeringPlot` linked-cursor/range support.
2. Primitive Observatory synchronized inspection integration.
3. Engineering Status Map.
4. Hardware topology.
5. Task Center 2.0.
6. Circuit net tracing and issue overlay.
7. Developer split view and diagnostic navigation.
8. Focus/responsive polish.
9. Phase 6 regression contracts and exact-head CI verification.

This order deliberately starts with shared interaction primitives, then integrates individual workspaces.

## Test strategy

### Contract/self-check coverage

Add a Phase 6 contract that protects at least:

- shared plot inspection context exists and does not contain measurement mutation APIs,
- `EngineeringPlot` still preserves all Phase 5 features while accepting synchronized inspection props,
- Primitive Observatory consumes the shared inspection model,
- engineering status nodes use only allowed semantic states,
- hardware topology consumes existing diagnosis/preflight state,
- Task Center retains cancellation/history behavior,
- Circuit diagnostic overlay consumes existing `runRuleChecker` findings,
- Developer diagnostics remain line/column aware and upload does not automatically start serial acquisition.

### Existing regressions

All existing frontend build, 29+ contract suite, firmware compile gates, C++ Core, Engineering Lab Experiments, Sensor Suite, and Rust/Tauri checks must remain green.

## Success criteria

Phase 6 is successful when a user can:

- inspect one signal event consistently across related plots,
- see where the engineering workflow is blocked without reading several status boxes,
- understand a hardware target mismatch from the topology,
- follow a long-running or failed operation through Task Center,
- click a circuit issue and see the affected net/pin/component,
- click a compiler diagnostic and reach the affected source location,
- use these interactions without changing the underlying scientific evidence or duplicating backend diagnosis engines.
