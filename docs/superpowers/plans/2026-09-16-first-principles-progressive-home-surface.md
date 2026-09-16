# BetterBoard First-Principles Progressive Home Surface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the Studio landing surface into a first-principles engineering command surface while continuing the reverse audit that promotes independently valuable buried UI into semantic navigation without duplicating backend execution.

**Architecture:** Keep `RootContent` as the owner of global runtime state, but extract presentation into focused home components that consume normalized view models and only call `openCapability(id)`. Preserve the canonical registry/shortcut/navigation stack as the sole routing layer, add an explicit audited-surface inventory plus contracts, and evolve All Tools only after the home surface is stable.

**Tech Stack:** React + TypeScript + Vite, Tauri, existing BetterBoard CSS system, Python structural contract checks, Arduino CLI compile checks, Rust `cargo check`.

**Spec:** `docs/superpowers/specs/2026-09-16-first-principles-progressive-home-surface-design.md`

## Global Constraints

- Product-facing laboratory identity is **Engineering Lab**; `Physical Lab` may remain only at compatibility/archive boundaries.
- Navigation may reveal/focus/select surfaces but must not automatically compile, upload, delete, install, transmit, mutate external configuration, or duplicate backend side effects.
- `RootContent` remains the owner/consumer of global workspace, hardware session, CLI discovery, task memory, selected evidence, and workflow derivation.
- New home components receive normalized props and do not call Tauri backends directly.
- Home and All Tools launchers navigate only through `openCapability(id)`.
- Semantic navigation owns workspace switching, parent activation, tab/view switching, non-destructive reveal steps, target resolution, scrolling, and focus.
- The home screen must remain progressively disclosed: `State -> Decision -> Workflow -> Current Work -> Advanced Capabilities -> Complete Index`.
- All Tools remains the exhaustive searchable capability inventory.
- Do not create meaningless shortcuts for backend helpers, metrics, or selection-dependent micro-actions.
- Every implementation slice follows RED -> GREEN -> exact-head verification.
- PR #67 stays unmerged until explicitly requested.

---

## File Structure

### New files

- `src/homeSurfaceModel.ts` — pure home-surface types/constants and capability-ID lane definitions; no DOM or backend calls.
- `src/EngineeringCommandSurface.tsx` — first-screen state/decision/stage presentation; semantic navigation only.
- `src/EngineeringFlowLauncher.tsx` — Build/Measure/Analyze/Experiment progressive workflow lanes derived from capability IDs.
- `src/CurrentWorkSummary.tsx` — transient active/recent engineering context with empty-state omission.
- `src/AdvancedCapabilityLauncher.tsx` — compact advanced-domain launch groups backed by capability/shortcut IDs.
- `src/home-surface.css` — responsive hierarchy for the new Studio home surface.
- `scripts/home_surface_contract_self_check.py` — structural contract for command/flow/current-work/advanced surfaces and backend isolation.
- `scripts/audited_surface_inventory_self_check.py` — explicit reverse-audit inventory contract for promoted/owner-internal/backend/dead UI classification.
- `docs/superpowers/audits/2026-09-16-user-facing-surface-inventory.md` — source-outward audited inventory and classifications.

### Existing files modified

- `src/main.tsx` — replace loose Studio overview composition with the extracted home components while keeping global state derivation here.
- `src/capabilityRegistry.ts` — only when an audit candidate qualifies as a new canonical capability; otherwise unchanged.
- `src/capabilityShortcuts.ts` — only when an audit candidate qualifies as a direct shortcut.
- `src/CapabilityNavigationContext.tsx` — only for stable owner-first reveal/fallback support required by newly promoted surfaces.
- `src/CapabilityNavigator.tsx` — later progressive metadata/filtering after home behavior stabilizes.
- `src/workspace-shell.css` — remove/simplify only rules made obsolete by extraction; keep Observatory/Experiments styles intact.
- `src/capability-navigation.css` — only if All Tools progressive metadata requires layout changes.
- `scripts/run_contract_self_checks.py` — register new contracts in sequence.

---

### Task 1: Establish the audited user-facing surface inventory

**Files:**
- Create: `docs/superpowers/audits/2026-09-16-user-facing-surface-inventory.md`
- Create: `scripts/audited_surface_inventory_self_check.py`
- Modify: `scripts/run_contract_self_checks.py`
- Inspect: `src/**/*.tsx`, `src/**/*.ts`

**Interfaces:**
- Consumes: current canonical IDs from `CAPABILITIES`, shortcut IDs from `CAPABILITY_SHORTCUTS`, and known owner components.
- Produces: an explicit inventory row schema `surface id | source owner | evidence | classification | navigation id | rationale`, plus a contract requiring every audited independent surface to have intentional coverage.

- [ ] **Step 1: Write the failing inventory contract**

Create `scripts/audited_surface_inventory_self_check.py` that reads the audit markdown and source registry files, requires all five classifications (`canonical`, `shortcut`, `owner-internal`, `backend-only`, `dead-orphaned`), and requires each `canonical`/`shortcut` row to name an ID that exists in the registry/shortcut source.

```python
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
AUDIT = ROOT / "docs/superpowers/audits/2026-09-16-user-facing-surface-inventory.md"
REGISTRY = (ROOT / "src/capabilityRegistry.ts").read_text()
SHORTCUTS = (ROOT / "src/capabilityShortcuts.ts").read_text()

required_classes = {"canonical", "shortcut", "owner-internal", "backend-only", "dead-orphaned"}
text = AUDIT.read_text() if AUDIT.exists() else ""
for classification in required_classes:
    assert f"`{classification}`" in text, f"missing audit classification: {classification}"

rows = re.findall(r"\|\s*`([^`]+)`\s*\|[^\n]*\|\s*`(canonical|shortcut)`\s*\|\s*`([^`]+)`\s*\|", text)
assert rows, "no promoted audited surfaces found"
for surface_id, classification, nav_id in rows:
    haystack = REGISTRY if classification == "canonical" else SHORTCUTS
    assert f"id: '{nav_id}'" in haystack, f"{surface_id} -> missing {classification} id {nav_id}"
```

- [ ] **Step 2: Register the check and verify RED**

Append `"audited_surface_inventory_self_check.py"` to `CHECKS` in `scripts/run_contract_self_checks.py`.

Run: `python3 scripts/run_contract_self_checks.py`

Expected: existing checks pass, new inventory check fails because the audit markdown does not yet exist.

- [ ] **Step 3: Perform the source-outward audit and create the inventory**

Inspect mounted and nested UI surfaces for independent input/output, persistence, actions, diagnostics, result visualization, and no-context usability. Document every reviewed candidate with exactly one classification. Include at least the already-reviewed families: Program actions, Developer actions, Arduino ecosystem managers, Sketchbook actions, Numerical/Magnet result viewers, ESP32 audits, Observatory panels, Task Center controls, OpenPenguin prompts, HardwareTopology, EngineeringExperimentLibrary actions, Monitor export/docs, Research Context modes.

Use this table shape:

```markdown
| Surface | Owner/source | Evidence | Classification | Navigation ID | Rationale |
| --- | --- | --- | --- | --- | --- |
| `program-compile` | `App.tsx` | independent compile action with Hardware Doctor gate | `shortcut` | `program-compile` | independently discoverable, navigation must not auto-run |
| `task-copy-log` | `TaskCenter.tsx` | depends on selected/current task | `owner-internal` | `-` | no meaningful no-context launch |
```

- [ ] **Step 4: Run the inventory contract GREEN**

Run: `python3 scripts/audited_surface_inventory_self_check.py`

Expected: PASS and a count of audited rows/promoted rows.

- [ ] **Step 5: Commit the audit slice**

Commit message: `test: audit user-facing desktop surfaces`

---

### Task 2: Promote newly confirmed buried independent surfaces

**Files:**
- Modify as needed: `src/capabilityRegistry.ts`
- Modify as needed: `src/capabilityShortcuts.ts`
- Modify as needed: `src/CapabilityNavigationContext.tsx`
- Modify: `docs/superpowers/audits/2026-09-16-user-facing-surface-inventory.md`
- Create or extend: one focused `scripts/*_surface_reachability_self_check.py` contract per promoted family
- Modify: `scripts/run_contract_self_checks.py`

**Interfaces:**
- Consumes: Task 1 audit classifications.
- Produces: stable semantic IDs for every newly promoted independent surface and owner-first navigation fallbacks where anchors are not yet available.

- [ ] **Step 1: Select only audit rows classified as canonical/shortcut but lacking current semantic coverage**

Do not promote `owner-internal`, `backend-only`, or `dead-orphaned` rows merely to increase counts.

- [ ] **Step 2: Write a focused failing reachability contract for the first uncovered family**

Pattern:

```python
required = {
    "new-surface-id": ("Expected Label", "Exact existing surface text"),
}
for shortcut_id, (label, exact_text) in required.items():
    assert f"id: '{shortcut_id}'" in shortcuts, f"missing shortcut: {shortcut_id}"
    assert label in shortcuts
    assert f"'{shortcut_id}':" in navigation
    assert f"selectorExactText: '{exact_text}'" in navigation
```

Run only that contract first. Expected: FAIL on the first missing semantic ID.

- [ ] **Step 3: Add minimal registry/shortcut metadata and navigation fallback**

Use stable `data-capability-anchor` when touching the owner is appropriate; otherwise use exact-text fallback with canonical-parent activation. No navigation file may contain the owner backend command token for the action it reveals.

- [ ] **Step 4: Run focused GREEN, then full Python contracts**

Run:

```bash
python3 scripts/<new_contract>.py
python3 scripts/run_contract_self_checks.py
```

Expected: both PASS.

- [ ] **Step 5: Repeat RED/GREEN family-by-family until Task 1 has no uncovered promoted row**

Each family gets its own small commit, e.g. `feat: expose <family> desktop surfaces`.

---

### Task 3: Introduce pure home-surface model and Engineering Command Surface

**Files:**
- Create: `src/homeSurfaceModel.ts`
- Create: `src/EngineeringCommandSurface.tsx`
- Create: `src/home-surface.css`
- Create: `scripts/home_surface_contract_self_check.py`
- Modify: `scripts/run_contract_self_checks.py`
- Modify: `src/main.tsx`

**Interfaces:**
- Consumes: `EngineeringStatusNode[]`, selected board/profile/port labels, recommended action `{ label: string; capabilityId: string }`, optional recovery action, optional active-task summary, `openCapability(id)` callback.
- Produces: `EngineeringCommandSurface` with no Tauri import and no backend command tokens.

Define in `homeSurfaceModel.ts`:

```ts
export type HomeAction = {
  label: string;
  capabilityId: string;
  detail?: string;
};

export type CurrentTaskSummary = {
  title: string;
  detail: string;
  state: 'running' | 'done' | 'failed' | 'cancelled';
} | null;
```

- [ ] **Step 1: Write `home_surface_contract_self_check.py` RED**

Require:

```python
assert "EngineeringCommandSurface" in main
assert "src/EngineeringCommandSurface.tsx"  # represented as file existence check
assert "openCapability" in command_surface
for token in ("invoke(", "compile_sketch", "upload_sketch", "recipe_preflight", "arduino_board_url_add"):
    assert token not in command_surface
assert "Toolchain" in command_surface
assert "Hardware" in command_surface
assert "Firmware" in command_surface
assert "Acquisition" in command_surface
assert "Evidence" in command_surface
assert "Analysis" in command_surface
```

Register the contract. Run full contracts. Expected: FAIL because the component does not exist.

- [ ] **Step 2: Add pure workflow recommendation IDs in `main.tsx`**

Replace the current string-only `workflowNextAction` with `HomeAction` objects while preserving the same runtime decision order:

```ts
if (!cli?.found) return { label: 'Restore the Arduino toolchain', capabilityId: 'hardware-doctor' };
if (!selectedPort) return { label: 'Connect and select hardware', capabilityId: 'hardware-session' };
if (!programmed) return { label: 'Prepare or upload firmware', capabilityId: 'program-firmware' };
if (liveSerial) return { label: 'Save the live run as evidence', capabilityId: 'measurement-evidence' };
if (!monitored) return { label: 'Start Monitor & Data', capabilityId: 'monitor-live' };
if (!evidenceSaved) return { label: 'Save the captured measurement', capabilityId: 'measurement-evidence' };
if (!analyzed) return { label: 'Analyze or compare the evidence', capabilityId: 'analysis-evidence' };
return { label: 'Start the next experiment', capabilityId: 'experiments-campaigns' };
```

- [ ] **Step 3: Implement `EngineeringCommandSurface` minimally**

Render readiness summary, board/profile context, six-stage chain as buttons, primary next-action button, optional recovery action, and optional active task. Every click calls `onOpenCapability(id)`.

- [ ] **Step 4: Replace the loose Studio overview composition in `main.tsx`**

Remove the standalone `boundary compact` next-action line. Keep `HardwareTopology` available but visually subordinate inside the command surface or immediately adjacent in a secondary-details region; do not duplicate topology logic.

- [ ] **Step 5: Add responsive CSS**

Use `.engineering-command-surface`, `.engineering-stage-chain`, `.engineering-next-action`, `.engineering-command-details`; reflow the stage chain below 900px and stack action/details below 680px. No page-level horizontal overflow.

- [ ] **Step 6: Run GREEN checks**

Run:

```bash
python3 scripts/home_surface_contract_self_check.py
python3 scripts/run_contract_self_checks.py
npm run build
```

Expected: PASS.

- [ ] **Step 7: Commit**

Commit message: `feat: add engineering command surface`

---

### Task 4: Add progressive Engineering Flow lanes

**Files:**
- Modify: `src/homeSurfaceModel.ts`
- Create: `src/EngineeringFlowLauncher.tsx`
- Modify: `src/home-surface.css`
- Modify: `src/main.tsx`
- Modify: `scripts/home_surface_contract_self_check.py`

**Interfaces:**
- Consumes: capability IDs only plus `onOpenCapability(id)`.
- Produces: four lanes `Build`, `Measure`, `Analyze`, `Experiment` with validated IDs.

Define constants in `homeSurfaceModel.ts`:

```ts
export const ENGINEERING_FLOW = [
  { id: 'build', label: 'Build', capabilities: ['hardware-session', 'program-firmware', 'recipe-library', 'circuit-lab'] },
  { id: 'measure', label: 'Measure', capabilities: ['monitor-live', 'monitor-snapshot', 'measurement-evidence', 'measurement-replay'] },
  { id: 'analyze', label: 'Analyze', capabilities: ['analysis-evidence', 'analysis-statistics', 'analysis-models', 'analysis-numerical', 'analysis-preparation'] },
  { id: 'experiment', label: 'Experiment', capabilities: ['analysis-experiment-design', 'experiments-campaigns', 'engineering-handoff', 'research-context'] },
] as const;
```

- [ ] **Step 1: Extend contract RED**

Require `EngineeringFlowLauncher` mounted in Studio and each capability ID above to exist in `capabilityRegistry.ts`. Expected: FAIL before implementation.

- [ ] **Step 2: Implement launcher using registry lookups**

Do not duplicate labels/descriptions in the launcher. Resolve each ID from `CAPABILITIES` and render compact cards/buttons.

- [ ] **Step 3: Mount below Engineering Command Surface**

Keep it above the full `App` workbench so the home surface answers “where do I go?” before dense workbench content.

- [ ] **Step 4: Add responsive 4 -> 2 -> 1 lane CSS**

- [ ] **Step 5: Run contract + build GREEN and commit**

Commit message: `feat: add progressive engineering flow`

---

### Task 5: Add Current Work summary without empty-card noise

**Files:**
- Create: `src/CurrentWorkSummary.tsx`
- Modify: `src/homeSurfaceModel.ts`
- Modify: `src/main.tsx`
- Modify: `src/home-surface.css`
- Modify: `scripts/home_surface_contract_self_check.py`

**Interfaces:**
- Consumes normalized optional items only: active task, latest program, evidence source, latest unresolved warning/failure, current campaign label if available.
- Produces `null` when all items are absent; otherwise compact continuation rows with semantic capability IDs.

- [ ] **Step 1: Extend contract RED**

Require `CurrentWorkSummary`, require no `invoke(` token in its source, and require an explicit all-empty early return such as `if (!items.length) return null;`.

- [ ] **Step 2: Normalize current-work items in `main.tsx`**

Build an array from already-owned runtime state; do not create a second persistence layer.

- [ ] **Step 3: Implement continuation rows**

Each row contains label/detail/status and optional `capabilityId`; clicking a row navigates only.

- [ ] **Step 4: Mount after Engineering Flow and add compact CSS**

- [ ] **Step 5: Run GREEN checks and commit**

Commit message: `feat: surface current engineering work`

---

### Task 6: Add Advanced Capability groups

**Files:**
- Modify: `src/homeSurfaceModel.ts`
- Create: `src/AdvancedCapabilityLauncher.tsx`
- Modify: `src/main.tsx`
- Modify: `src/home-surface.css`
- Modify: `scripts/home_surface_contract_self_check.py`

**Interfaces:**
- Consumes: registry/shortcut IDs and `openCapability`.
- Produces compact groups for Diagnostics, Numerical, Magnetism, ESP32, Developer, Research Handoff, System/Runtime.

- [ ] **Step 1: Extend contract RED with required group IDs**

The contract must verify every configured ID exists in either `CAPABILITIES` or `CAPABILITY_SHORTCUTS`.

- [ ] **Step 2: Define advanced groups in `homeSurfaceModel.ts`**

Use semantic IDs, not DOM selectors. Example:

```ts
export const ADVANCED_GROUPS = [
  { label: 'Diagnostics', ids: ['hardware-doctor', 'circuit-diagnostics', 'developer-diagnostics'] },
  { label: 'Numerical', ids: ['numerical-advanced', 'numerical-result-viewer', 'numeric-error-depth'] },
  { label: 'Magnetism', ids: ['magnet-advanced', 'magnet-result-viewer'] },
  { label: 'ESP32', ids: ['esp32-capabilities', 'esp32-core-audit', 'esp32-board-details', 'esp32-configuration-risk'] },
  { label: 'Developer', ids: ['developer-editor', 'developer-ecosystem', 'developer-sketchbook'] },
  { label: 'Research handoff', ids: ['engineering-handoff', 'research-context', 'research-ai-review'] },
  { label: 'System / runtime', ids: ['observatory-system', 'hardware-topology', 'task-center', 'openguin'] },
] as const;
```

- [ ] **Step 3: Implement launcher by resolving IDs against registry + shortcuts**

- [ ] **Step 4: Mount after Current Work and style as visually secondary compact groups**

- [ ] **Step 5: Run GREEN checks and commit**

Commit message: `feat: expose advanced capability groups`

---

### Task 7: Evolve All Tools with progressive metadata without losing exhaustive search

**Files:**
- Modify: `src/capabilityRegistry.ts`
- Modify: `src/capabilityShortcuts.ts`
- Modify: `src/CapabilityNavigator.tsx`
- Modify: `src/capability-navigation.css`
- Create: `scripts/capability_tier_self_check.py`
- Modify: `scripts/run_contract_self_checks.py`

**Interfaces:**
- Consumes existing capability/shortcut metadata.
- Produces optional `tier: 'primary' | 'advanced' | 'expert'` metadata with default behavior preserving all existing items and search fields.

- [ ] **Step 1: Write tier contract RED**

Require type definitions to accept a tier, require every item to resolve to one of the three tiers through explicit value or default helper, and require All Tools to preserve label/description/owner/group/workspace/keywords search fields.

- [ ] **Step 2: Add tier metadata minimally**

Prefer a helper default (`canonical -> primary/advanced by group`, `shortcut -> advanced` unless explicitly expert) rather than manually annotating all 86+ entries. Explicitly mark expert-only surfaces only when the audit supports it.

- [ ] **Step 3: Add All Tools filter chips `All`, `Common`, `Advanced`, `Expert` without removing existing group filters**

Search remains primary and all items remain reachable under `All`.

- [ ] **Step 4: Visually distinguish canonical workbenches from direct shortcuts**

Use small metadata copy/badges; do not create a second destination system.

- [ ] **Step 5: Run tier contract, full contracts, and build GREEN; commit**

Commit message: `feat: add progressive All Tools tiers`

---

### Task 8: Exact-head verification and desktop handoff

**Files:**
- No production changes unless verification finds a real defect.
- Update tests only if a contract expectation is proven incorrect by source behavior; do not weaken contracts to hide failures.

**Interfaces:**
- Consumes: completed Tasks 1-7.
- Produces: one exact verified branch head ready for the user's macOS runtime test.

- [ ] **Step 1: Run full local/static suite**

```bash
python3 scripts/run_contract_self_checks.py
npm run build
```

Expected: all contracts PASS and Vite build PASS.

- [ ] **Step 2: Push/confirm exact branch head and inspect CI run for that SHA**

Verify the workflow's exact commit equals `ui/desktop-capability-reachability` head.

- [ ] **Step 3: Require every CI step GREEN**

Minimum required:

- TypeScript/Vite build
- all Python contracts
- Numerical microbench UNO compile
- Numeric Error Depth UNO compile
- device primitive result UNO compile
- Tauri Linux dependencies
- Rust check

- [ ] **Step 4: Re-check PR scope and status**

PR #67 must remain open/draft/unmerged unless the user explicitly changes that instruction.

- [ ] **Step 5: Produce manual macOS verification matrix**

Verify with the user on the built desktop app:

```text
cold launch / no board
recognized board
missing toolchain
profile mismatch
program -> measure -> evidence -> analyze progression
Current Work population and empty-state collapse
Advanced group deep links
All Tools obscure search
Developer/Numerical/Magnet/ESP32 deep link from unrelated workspace
narrow window reflow
repeated workspace switching
```

- [ ] **Step 6: Final commit only if verification repairs were required**

Any repair must repeat focused RED/GREEN and the exact-head full CI before being called complete.
