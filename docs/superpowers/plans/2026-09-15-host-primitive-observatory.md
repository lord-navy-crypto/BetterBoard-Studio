# Host Primitive Observatory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a host-side primitive observability pipeline to Monitor & Data for the selected numeric channel, with explicit HOST-DERIVED provenance and semantics mirroring BetterBoard's embedded primitives.

**Architecture:** A pure TypeScript engine computes immutable primitive results from chronological `{timeS, value}` samples. A dedicated React component owns parameter inputs and visualization, while `MonitorDataStudio` only passes the already-established selected-channel trace and context. Structural Python self-checks protect the numerical contract and UI integration; existing full CI remains the completion gate.

**Tech Stack:** TypeScript, React, existing `EngineeringPlot`, Python contract self-checks, GitHub Actions, existing BetterBoard C++ primitive semantics as the reference.

**Spec:** `docs/superpowers/specs/2026-09-15-host-primitive-observatory-design.md`

## Global Constraints

- Host-side only; do not change firmware or serial protocol.
- Every derived result must be visibly identified as `HOST-DERIVED`.
- Use the selected Monitor & Data channel and its existing elapsed host timestamps; do not mutate raw evidence.
- Derivative and integration must use actual irregular `dt` and reject non-increasing timestamp transitions.
- Unavailable results use `null`, empty traces, or explicit readiness reasons rather than fake zero values.
- Preserve Live, Snapshot, and Replay behavior.
- Existing TypeScript/Vite, Python contract suite, Arduino UNO compilation, and Rust checks must remain green.

---

### Task 1: Protect the Phase 3 contract first

**Files:**
- Create: `scripts/primitive_observability_self_check.py`
- Modify: `scripts/run_contract_self_checks.py`

**Interfaces:**
- Consumes: repository source files as text.
- Produces: a CI contract requiring the pure engine, observable primitive semantics, UI labels, and Monitor integration.

- [ ] **Step 1: Write the failing self-check**

Create `scripts/primitive_observability_self_check.py` that asserts:

```python
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
engine_path = ROOT / "src" / "PrimitiveObservability.ts"
ui_path = ROOT / "src" / "PrimitiveObservatory.tsx"
monitor = (ROOT / "src" / "MonitorDataStudio.tsx").read_text()

assert engine_path.is_file(), "PrimitiveObservability engine missing"
assert ui_path.is_file(), "PrimitiveObservatory UI missing"
engine = engine_path.read_text()
ui = ui_path.read_text()

for token in (
    "computeHostPrimitiveObservability",
    "host-derived",
    "sampleStandardDeviation",
    "rmsTrace",
    "derivativeTrace",
    "integralTrace",
    "emaTrace",
    "peakHoldTrace",
    "thresholdStateTrace",
    "hysteresisStateTrace",
    "regression",
    "cusumPositiveTrace",
    "cusumNegativeTrace",
    "meanShiftTrace",
    "non-increasing timestamp",
):
    assert token in engine, f"Primitive engine lost {token}"

for token in (
    "Host Primitive Observatory",
    "HOST-DERIVED",
    "Online state",
    "Dynamics",
    "Signal conditioning",
    "Decision state",
    "Trend & change",
):
    assert token in ui, f"Primitive UI lost {token}"

assert "<PrimitiveObservatory" in monitor, "Monitor & Data no longer mounts PrimitiveObservatory"
print("Primitive observability contract: PASS")
```

Append `"primitive_observability_self_check.py",` to `CHECKS` in `scripts/run_contract_self_checks.py`.

- [ ] **Step 2: Verify RED**

Run in CI or locally:

```bash
python3 scripts/primitive_observability_self_check.py
```

Expected: FAIL because `src/PrimitiveObservability.ts` and `src/PrimitiveObservatory.tsx` do not exist.

- [ ] **Step 3: Commit the RED contract**

```bash
git add scripts/primitive_observability_self_check.py scripts/run_contract_self_checks.py
git commit -m "test: protect primitive observability contract"
```

---

### Task 2: Implement the pure host primitive engine

**Files:**
- Create: `src/PrimitiveObservability.ts`

**Interfaces:**
- Consumes:

```ts
export type PrimitiveSample = { timeS: number; value: number };
export type PrimitiveParameters = {
  emaAlpha: number;
  threshold: number;
  hysteresisLow: number;
  hysteresisHigh: number;
  regressionWindow: number;
  cusumReferenceMean?: number;
  cusumSlack?: number;
  cusumThreshold?: number;
  meanShiftWindow: number;
  meanShiftThreshold?: number;
};
```

- Produces:

```ts
export function computeHostPrimitiveObservability(
  input: PrimitiveSample[],
  parameters: PrimitiveParameters,
): HostPrimitiveResult;
```

- [ ] **Step 1: Implement input normalization and online summaries**

Filter non-finite samples while preserving chronological order. Compute Welford-style count/mean/M2, population/sample variance and standard deviation, min, max, peak-to-peak, cumulative mean-square, and `rmsTrace`.

Required result fields:

```ts
origin: 'host-derived';
sampleCount: number;
timeSpanS: number | null;
statistics: {
  mean: number | null;
  sampleStandardDeviation: number | null;
  populationStandardDeviation: number | null;
  minimum: number | null;
  maximum: number | null;
  peakToPeak: number | null;
};
rms: number | null;
rmsTrace: PrimitiveSample[];
warnings: string[];
```

- [ ] **Step 2: Implement actual-time derivative and trapezoid integration**

For each consecutive valid pair compute `dt = current.timeS - previous.timeS`. If `dt <= 0`, skip derivative/integration for that transition and add one deduplicated warning containing `non-increasing timestamp`.

Use:

```ts
derivative = (current.value - previous.value) / dt;
integral += 0.5 * (previous.value + current.value) * dt;
```

The first valid integral point is `{timeS: first.timeS, value: 0}`. With fewer than two valid samples, derivative is empty and integration only contains the initialized first point if one sample exists.

- [ ] **Step 3: Implement EMA, peak hold, threshold latch, and hysteresis**

EMA initializes to the first sample and then uses `alpha*x + (1-alpha)*previous`.

Peak hold is the maximum seen since reset.

Threshold trigger mirrors a one-way latch for the run: once `value >= threshold`, state remains `1`. Also return trigger-event points for the first transition.

Hysteresis starts false; `value >= high` sets true, `value <= low` sets false, and dead-band values preserve prior state. If `low >= high`, return an invalid readiness reason and no hysteresis trace.

- [ ] **Step 4: Implement rolling regression and change detection**

For the latest `regressionWindow` samples, compute least-squares slope/intercept/R² against actual `timeS`; return `null` until at least two distinct time values exist.

CUSUM mirrors BetterBoard's `ChangeDetection.h`:

```ts
positive = Math.max(0, positive + (x - referenceMean) - slack);
negative = Math.min(0, negative + (x - referenceMean) + slack);
alarm = positive > threshold || -negative > threshold;
```

Mean shift uses an even window `N >= 4`: mean(second half) - mean(first half). Return a trace only after a complete window exists and event points where `abs(shift) > meanShiftThreshold`.

- [ ] **Step 5: Use deterministic defaults safely**

Export a helper:

```ts
export function derivePrimitiveDefaults(samples: PrimitiveSample[]): PrimitiveParameters;
```

Defaults: EMA `0.2`; threshold midpoint `(min+max)/2`; hysteresis around that midpoint using 10% of range, with deterministic small span fallback for constant signals; regression window `32`; CUSUM mean = run mean, slack `0.5*sampleStd`, threshold `5*sampleStd`; mean-shift window `20` rounded to a valid even value and threshold `2*sampleStd`. Never divide by zero.

- [ ] **Step 6: Verify the Task 1 contract advances**

Run:

```bash
python3 scripts/primitive_observability_self_check.py
```

Expected: still FAIL only because the UI file/integration does not yet exist; engine-token assertions pass.

- [ ] **Step 7: Commit**

```bash
git add src/PrimitiveObservability.ts
git commit -m "feat: add host primitive observability engine"
```

---

### Task 3: Build the Primitive Observatory UI and integrate Monitor & Data

**Files:**
- Create: `src/PrimitiveObservatory.tsx`
- Modify: `src/MonitorDataStudio.tsx`
- Modify: the existing app stylesheet that owns Monitor/Data panel styles; add only selectors prefixed `primitive-observatory-` or similarly scoped names.

**Interfaces:**
- Consumes:

```ts
type PrimitiveObservatoryProps = {
  samples: PrimitiveSample[];
  channelLabel: string;
  unit: string;
  contextLabel: 'LIVE' | 'BUFFER' | 'REPLAY';
};
```

- Produces: visible host-derived observability UI; no mutations or saved derived evidence.

- [ ] **Step 1: Add the presentation/configuration component**

Use React state for editable parameter text, but keep effective numerical values valid. Re-derive automatic defaults when channel/data identity changes, not on every typed keystroke.

Header must include `Host Primitive Observatory`, `HOST-DERIVED`, selected channel/unit, sample count, span, and warnings.

- [ ] **Step 2: Add Online state and Dynamics sections**

Online cards: N, mean, sample std, min, max, peak-to-peak, RMS.

Dynamics plots:

```tsx
<EngineeringPlot series={[{ label: 'derivative', points: result.derivativeTrace }]} xLabel="time" xUnit="s" yLabel={`d(${channelLabel})/dt`} ... />
<EngineeringPlot series={[{ label: 'integral', points: result.integralTrace }]} xLabel="time" xUnit="s" yLabel={`∫ ${channelLabel} dt`} ... />
```

Display an explicit unavailable message when a trace cannot be computed.

- [ ] **Step 3: Add Signal conditioning and Decision state sections**

Signal conditioning overlays raw+EMA and raw+peak hold using `EngineeringPlot`.

Decision state shows raw signal with horizontal markers for threshold and hysteresis low/high; show threshold/hysteresis state traces as 0/1 plots and event counts. Label all automatic parameter defaults as analysis defaults, not calibrated values.

- [ ] **Step 4: Add Trend & change section**

Show regression slope/intercept/R² metrics; CUSUM positive/negative plot; mean-shift plot and flagged event count. Keep outputs unavailable rather than zero when insufficient samples exist.

- [ ] **Step 5: Mount under the existing numeric plot in MonitorDataStudio**

Import:

```ts
import PrimitiveObservatory from './PrimitiveObservatory';
```

Pass exactly the existing `channelPoints`, converted only by type if needed:

```tsx
<PrimitiveObservatory
  samples={channelPoints.map(point => ({ timeS: point.x, value: point.y }))}
  channelLabel={selectedColumn}
  unit={selectedUnit}
  contextLabel={replay ? 'REPLAY' : live ? 'LIVE' : 'BUFFER'}
/>
```

Do not create a second parser or timestamp path.

- [ ] **Step 6: Verify GREEN for the Phase 3 contract**

Run:

```bash
python3 scripts/primitive_observability_self_check.py
```

Expected: `Primitive observability contract: PASS`.

- [ ] **Step 7: Commit**

```bash
git add src/PrimitiveObservatory.tsx src/MonitorDataStudio.tsx src/*.css
git commit -m "feat: surface host primitive observability in Monitor"
```

---

### Task 4: Strengthen numerical regression coverage and run full verification

**Files:**
- Modify: `scripts/primitive_observability_self_check.py`
- Modify only if required by discovered build/test failures: Phase 3 files from Tasks 2–3.

**Interfaces:**
- Consumes: the final engine/UI implementation.
- Produces: fresh evidence that the Phase 3 contract and all existing BetterBoard checks pass.

- [ ] **Step 1: Add source-level numerical invariants to the self-check**

Protect actual-time semantics by requiring engine source expressions/tokens for `dt`, trapezoid averaging, EMA recurrence, CUSUM positive/negative accumulation, hysteresis dead-band memory, and explicit invalid-time warning. Also require that `MonitorDataStudio` passes `channelPoints` into `PrimitiveObservatory` and does not construct an independent data source.

- [ ] **Step 2: Run the Python contract suite**

```bash
python3 scripts/run_contract_self_checks.py
```

Expected: all checks PASS, including `primitive_observability_self_check.py`.

- [ ] **Step 3: Run frontend build**

```bash
npm run build
```

Expected: TypeScript and Vite build PASS with no type errors.

- [ ] **Step 4: Push/observe full GitHub Actions verification**

Require fresh green status for:

- TypeScript/Vite build;
- complete Python contract suite;
- Arduino AVR core setup and both UNO numerical firmware compilations;
- Tauri Linux dependency setup and Rust check.

If any step fails, inspect its exact logs before changing code; do not weaken existing contracts to force green.

- [ ] **Step 5: Final commit for test hardening, if changed**

```bash
git add scripts/primitive_observability_self_check.py src/PrimitiveObservability.ts src/PrimitiveObservatory.tsx src/MonitorDataStudio.tsx
git commit -m "test: harden primitive observability verification"
```

- [ ] **Step 6: Completion gate**

Only declare Phase 3 complete after the latest branch-head workflow run is fully green. Report the final commit SHA and any intentionally deferred device-derived work.
