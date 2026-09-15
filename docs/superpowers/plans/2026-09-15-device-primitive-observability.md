# Device Primitive Observability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a backward-compatible device-derived primitive result lane so BetterBoard can receive MCU primitive outputs, keep them separate from raw evidence, and compare them against the existing host-derived Primitive Observatory.

**Architecture:** Keep the existing Engineering Lab CSV measurement stream untouched. Add a compact metadata side channel using `#BB_PRIMITIVE,1,...`, parse it into a normalized TypeScript result model, hold device results separately from numeric evidence, and pass only source-matched results into a producer-aware Primitive Observatory. Device/host comparison is diagnostic only and is enabled only when source, primitive semantics, alignment, and relevant parameters are compatible.

**Tech Stack:** Arduino/C++ embedded core, React + TypeScript, Vite, Python contract checks, GitHub Actions, Arduino CLI, Tauri/Rust.

**Spec:** `docs/superpowers/specs/2026-09-15-device-primitive-observability-design.md`

## Global Constraints

- Raw measurement CSV and `EngineeringLabStream` version 2 remain unchanged.
- Device-derived results use the independent prefix `#BB_PRIMITIVE,` and protocol version `1`.
- Version 1 frame shape is exactly `#BB_PRIMITIVE,1,<kind>,<source>,<time_us>,<value>,<state>,<parameter_key>,<parameter_value>`.
- Optional `value` and `state` may be empty, but parameter key/value must be both present or both absent.
- Device results are never inserted into normal numeric evidence rows and never relabel raw data.
- Existing firmware that emits no primitive frames must behave exactly as before.
- Existing `#BB_MATH_CAPS` parsing and semantics remain unchanged.
- Host and device results are peers for consistency diagnostics; neither is automatically authoritative.
- Unsupported protocol versions, malformed frames, unknown kinds, invalid timestamps, invalid numeric/state values, parameter mismatches, and unbound sources must be surfaced as diagnostics rather than fabricated values.
- Direct host/device consistency scoring is disabled when relevant parameters differ or alignment is unsafe.
- Phase 4 comparison scope is statistics, RMS, finite difference, trapezoid integral, EMA, peak hold, threshold, and hysteresis; CUSUM/mean-shift device comparison is deferred.

---

## File Structure

### New files

- `firmware/betterboard-core/src/experiments/PrimitiveResultStream.h` — embedded formatter public API only.
- `firmware/betterboard-core/src/experiments/PrimitiveResultStream.cpp` — fixed protocol-v1 serialization.
- `src/devicePrimitiveResults.ts` — pure parser, diagnostics, normalized device result types, filtering/alignment/comparison helpers.
- `scripts/device_primitive_results_self_check.py` — structural and executable TypeScript protocol/comparison contract check.

### Modified files

- `src/MonitorDataStudio.tsx` — detect device primitive frames independently of `parseNumericRow`, maintain derived stream, source-bind selected results, pass them to Primitive Observatory.
- `src/PrimitiveObservatory.tsx` — render DEVICE-DERIVED provenance and HOST ↔ DEVICE comparison without changing host-analysis computation.
- `scripts/run_contract_self_checks.py` — add the new contract check.
- `.github/workflows/ci.yml` or the repository's active PR workflow — compile a primitive-result firmware verification target if the existing workflow does not already cover a suitable embedded test/example.
- `firmware/betterboard-core/examples/...` or existing numerical test sketch selected during implementation — exercise the formatter against actual primitive classes without inventing a second implementation of the algorithms.

### Responsibility boundaries

- `PrimitiveResultStream` serializes only; it never computes primitives.
- `devicePrimitiveResults.ts` parses and compares only; it does not own React state.
- `MonitorDataStudio.tsx` routes lines and owns current in-memory device-result context; it does not contain protocol parsing formulas.
- `PrimitiveObservatory.tsx` presents provenance/comparison; it continues to call `computeHostPrimitiveObservability()` for host analysis.

---

### Task 1: Protect the Phase 4 Protocol and Evidence Boundary with a Failing Contract

**Files:**
- Create: `scripts/device_primitive_results_self_check.py`
- Modify: `scripts/run_contract_self_checks.py`

**Interfaces:**
- Consumes: existing repository files as text plus the repository TypeScript compiler in `node_modules/.bin/tsc`.
- Produces: CI-visible contract #27 that initially fails because `PrimitiveResultStream` and `devicePrimitiveResults.ts` do not exist.

- [ ] **Step 1: Write the failing self-check**

Create a Python check that asserts all of the following concrete contracts:

```python
required_files = [
    ROOT / "firmware/betterboard-core/src/experiments/PrimitiveResultStream.h",
    ROOT / "firmware/betterboard-core/src/experiments/PrimitiveResultStream.cpp",
    ROOT / "src/devicePrimitiveResults.ts",
]
```

It must also inspect `src/MonitorDataStudio.tsx` and assert that the eventual code contains both `parseDevicePrimitiveResult` and a separate `devicePrimitiveResults`/equivalent derived collection, while retaining `parseNumericRow` for raw numeric rows. It must inspect `src/PrimitiveObservatory.tsx` for `DEVICE-DERIVED`, `HOST ↔ DEVICE`, and a device-results prop. The executable TypeScript portion is added in Task 3 once the parser exists.

- [ ] **Step 2: Register the check**

Append exactly:

```python
"device_primitive_results_self_check.py",
```

to `CHECKS` in `scripts/run_contract_self_checks.py` after `primitive_observability_self_check.py`.

- [ ] **Step 3: Run the suite and verify RED**

Run:

```bash
python3 scripts/run_contract_self_checks.py
```

Expected: checks 1–26 pass; check 27 fails because the new formatter/parser files are missing.

- [ ] **Step 4: Commit the RED contract**

```bash
git add scripts/device_primitive_results_self_check.py scripts/run_contract_self_checks.py
git commit -m "test: protect device primitive result contract"
```

---

### Task 2: Add the Embedded Protocol-v1 Formatter

**Files:**
- Create: `firmware/betterboard-core/src/experiments/PrimitiveResultStream.h`
- Create: `firmware/betterboard-core/src/experiments/PrimitiveResultStream.cpp`
- Modify/Create test sketch under the existing numerical/primitive verification examples after inspecting the current example layout.

**Interfaces:**
- Consumes: Arduino `Print`, caller-computed primitive values/states.
- Produces:

```cpp
class PrimitiveResultStream {
 public:
  explicit PrimitiveResultStream(Print& output);
  void value(const char* kind, const char* source, uint32_t time_us,
             double value, const char* parameter_key = nullptr,
             const char* parameter_value = nullptr, int digits = 6);
  void state(const char* kind, const char* source, uint32_t time_us,
             bool state, const char* parameter_key = nullptr,
             const char* parameter_value = nullptr);
};
```

- [ ] **Step 1: Add a formatter-output test fixture/sketch that describes exact frames**

The verification must require outputs equivalent to:

```text
#BB_PRIMITIVE,1,rms,magnetic_field,250000,0.183420,,,
#BB_PRIMITIVE,1,threshold,magnetic_field,250000,,1,threshold,0.150000
```

and assert/inspect that the frame always contains protocol v1 plus the fixed eight payload fields after the prefix.

- [ ] **Step 2: Verify the formatter test cannot compile yet**

Run the repository's existing Arduino CLI compile command for the chosen sketch using UNO/AVR.

Expected: FAIL because `PrimitiveResultStream.h` does not exist.

- [ ] **Step 3: Implement the minimal header and serializer**

Serialization rules in `PrimitiveResultStream.cpp`:

```cpp
output_.print(F("#BB_PRIMITIVE,1,"));
output_.print(kind);
output_.print(',');
output_.print(source);
output_.print(',');
output_.print(time_us);
```

For `value(...)`, emit numeric value, then an empty state field, then either both parameter fields or two empty fields. For `state(...)`, emit an empty value field, `0`/`1` state, then the same paired parameter fields. End every frame with `println()`.

Do not validate/recompute the algorithm result inside the formatter.

- [ ] **Step 4: Compile the embedded verification target**

Run the exact UNO compile command used by the active CI workflow.

Expected: PASS.

- [ ] **Step 5: Run Python contracts**

```bash
python3 scripts/run_contract_self_checks.py
```

Expected: check 27 now advances past missing formatter and fails on the missing TypeScript parser/UI contract.

- [ ] **Step 6: Commit**

```bash
git add firmware/betterboard-core/src/experiments/PrimitiveResultStream.h firmware/betterboard-core/src/experiments/PrimitiveResultStream.cpp firmware/betterboard-core/examples scripts/device_primitive_results_self_check.py
git commit -m "feat: add device primitive result stream"
```

---

### Task 3: Add the Pure TypeScript Parser and Normalized Result Model

**Files:**
- Create: `src/devicePrimitiveResults.ts`
- Modify: `scripts/device_primitive_results_self_check.py`

**Interfaces:**
- Produces:

```ts
export type DevicePrimitiveKind =
  | 'stats_mean' | 'stats_std' | 'stats_min' | 'stats_max'
  | 'rms' | 'derivative' | 'integral' | 'ema' | 'peak_hold'
  | 'threshold' | 'hysteresis';

export type DevicePrimitiveResult = {
  producer: 'device';
  protocolVersion: number;
  kind: DevicePrimitiveKind;
  source: string;
  timeUs: number;
  value: number | null;
  state: boolean | null;
  parameterKey: string | null;
  parameterValue: string | null;
};

export type DevicePrimitiveDiagnostic = {
  code: 'malformed-frame' | 'unsupported-version' | 'unknown-kind' |
        'invalid-timestamp' | 'invalid-value' | 'invalid-state' |
        'parameter-pair-mismatch';
  line: string;
  message: string;
};

export type DevicePrimitiveParseResult =
  | { result: DevicePrimitiveResult; diagnostic: null }
  | { result: null; diagnostic: DevicePrimitiveDiagnostic }
  | { result: null; diagnostic: null };

export function parseDevicePrimitiveResult(line: string): DevicePrimitiveParseResult;
```

- [ ] **Step 1: Extend the Python self-check to compile and execute the production parser**

Use `node_modules/.bin/tsc` in a temporary directory exactly as `primitive_observability_self_check.py` compiles production TypeScript. Node assertions must cover:

```js
valid('#BB_PRIMITIVE,1,rms,magnetic_field,250000,0.18342,,,')
valid('#BB_PRIMITIVE,1,threshold,magnetic_field,250000,,1,threshold,0.15')
reject('#BB_PRIMITIVE,2,rms,magnetic_field,250000,0.1,,,', 'unsupported-version')
reject('#BB_PRIMITIVE,1,unknown,magnetic_field,250000,0.1,,,', 'unknown-kind')
reject('#BB_PRIMITIVE,1,rms,magnetic_field,-1,0.1,,,', 'invalid-timestamp')
reject('#BB_PRIMITIVE,1,rms,magnetic_field,250000,NaN,,,', 'invalid-value')
reject('#BB_PRIMITIVE,1,threshold,magnetic_field,250000,,2,threshold,0.15', 'invalid-state')
reject('#BB_PRIMITIVE,1,ema,magnetic_field,250000,0.1,,alpha,', 'parameter-pair-mismatch')
```

A normal CSV row such as `250000,0.18342` must return `{result:null, diagnostic:null}` rather than a protocol error.

- [ ] **Step 2: Run the self-check and verify RED**

```bash
python3 scripts/device_primitive_results_self_check.py
```

Expected: FAIL because `src/devicePrimitiveResults.ts` is missing.

- [ ] **Step 3: Implement strict protocol-v1 parsing**

Implementation requirements:

```ts
const PREFIX = '#BB_PRIMITIVE,';
const KNOWN_KINDS = new Set<DevicePrimitiveKind>([
  'stats_mean', 'stats_std', 'stats_min', 'stats_max',
  'rms', 'derivative', 'integral', 'ema', 'peak_hold',
  'threshold', 'hysteresis',
]);
```

After removing the prefix, require exactly 8 comma-separated fields: version, kind, source, timeUs, value, state, parameterKey, parameterValue. Require version exactly `1`; nonempty kind/source; integer nonnegative `timeUs`; finite numeric value if nonempty; state only `0`, `1`, or empty; parameter fields both present or both absent.

- [ ] **Step 4: Run parser contract and TypeScript build**

```bash
python3 scripts/device_primitive_results_self_check.py
npm run build
```

Expected: parser tests PASS; full contract may still fail on Monitor/UI integration tokens.

- [ ] **Step 5: Commit**

```bash
git add src/devicePrimitiveResults.ts scripts/device_primitive_results_self_check.py
git commit -m "feat: parse device primitive results"
```

---

### Task 4: Add Deterministic Host↔Device Comparison Helpers

**Files:**
- Modify: `src/devicePrimitiveResults.ts`
- Modify: `scripts/device_primitive_results_self_check.py`

**Interfaces:**
- Consumes: `DevicePrimitiveResult[]`, selected source, host trace/value/state trace, host relevant parameter.
- Produces:

```ts
export type PrimitiveComparisonStatus =
  | 'MATCHABLE'
  | 'PARAMETER_MISMATCH'
  | 'UNBOUND_SOURCE'
  | 'INSUFFICIENT_ALIGNMENT'
  | 'UNAVAILABLE';

export type NumericPrimitiveComparison = {
  status: PrimitiveComparisonStatus;
  alignedCount: number;
  maxAbsoluteDifference: number | null;
  latestAbsoluteDifference: number | null;
  latestRelativeDifference: number | null;
};

export type StatePrimitiveComparison = {
  status: PrimitiveComparisonStatus;
  alignedCount: number;
  disagreementCount: number;
};
```

- [ ] **Step 1: Add failing executable comparison tests**

Use deterministic aligned data where device timestamps convert from microseconds to elapsed seconds and host samples are already elapsed seconds. Test:

```text
host EMA:   (0,0), (1,1), (3,3.5)
device EMA: 0us=0, 1000000us=1, 3000000us=3.5
```

Expected `MATCHABLE`, alignedCount `3`, maxAbsoluteDifference `0`.

Then perturb last device value to `3.6`; expect latest/max absolute difference `0.1` within floating tolerance.

Test threshold states `[0,0,1]` vs `[0,1,1]`; expect disagreementCount `1`.

Test EMA parameter `alpha=0.2` vs host `0.5`; expect `PARAMETER_MISMATCH` and no direct numerical score.

Test unrelated source name; expect `UNBOUND_SOURCE`.

Test timestamps outside a documented tolerance derived from neighboring host sample spacing; expect `INSUFFICIENT_ALIGNMENT`.

- [ ] **Step 2: Verify RED**

```bash
python3 scripts/device_primitive_results_self_check.py
```

Expected: FAIL because comparison helpers do not exist.

- [ ] **Step 3: Implement source filtering, parameter compatibility, and nearest-time alignment**

Use the first valid device result timestamp for the relevant source/run as device elapsed-time origin. Never equate absolute host and device clocks. Align only to the nearest host point within a tolerance of half the local/median host interval, with a small epsilon floor for exact synthetic tests. Do not silently reuse one host point for multiple device points if a one-to-one monotonic alignment can be maintained.

Relative difference is unavailable when the chosen denominator is effectively zero; return `null` rather than infinity.

- [ ] **Step 4: Run contract + build**

```bash
python3 scripts/device_primitive_results_self_check.py
npm run build
```

Expected: comparison executable tests PASS; integration checks may remain RED.

- [ ] **Step 5: Commit**

```bash
git add src/devicePrimitiveResults.ts scripts/device_primitive_results_self_check.py
git commit -m "feat: compare host and device primitives"
```

---

### Task 5: Route Primitive Frames Through Monitor Without Polluting Raw Evidence

**Files:**
- Modify: `src/MonitorDataStudio.tsx`
- Modify: `scripts/device_primitive_results_self_check.py`

**Interfaces:**
- Consumes: `displayRows`, `parseDevicePrimitiveResult(line)`.
- Produces: source-filtered `DevicePrimitiveResult[]` plus deduplicated/countable diagnostics passed separately to Primitive Observatory.

- [ ] **Step 1: Strengthen structural checks for evidence isolation**

Require `MonitorDataStudio.tsx` to import `parseDevicePrimitiveResult` and derive device results in a dedicated `useMemo` over RX `displayRows`. Require the existing `parseNumericRow` function to remain unchanged in responsibility and ensure the primitive parser call is not nested inside `parseNumericRow`.

The check must also protect that `bufferedEvidenceRows` is still defined through `parseNumericRow(...) !== null`, so `#BB_PRIMITIVE` cannot become recordable numeric evidence.

- [ ] **Step 2: Run contract and verify RED**

```bash
python3 scripts/device_primitive_results_self_check.py
```

Expected: FAIL on missing Monitor integration.

- [ ] **Step 3: Add dedicated parsing state**

Implement a `useMemo` equivalent to:

```ts
const devicePrimitiveContext = useMemo(() => {
  const results: DevicePrimitiveResult[] = [];
  const diagnostics: DevicePrimitiveDiagnostic[] = [];
  for (const row of displayRows) {
    if (row.direction === 'tx') continue;
    const parsed = parseDevicePrimitiveResult(row.line);
    if (parsed.result) results.push(parsed.result);
    else if (parsed.diagnostic) diagnostics.push(parsed.diagnostic);
  }
  return { results, diagnostics };
}, [displayRows]);
```

Derive selected-source results with exact `result.source === selectedColumn`; do not map by column position.

- [ ] **Step 4: Pass device results separately to Primitive Observatory**

Extend the mount with props equivalent to:

```tsx
<PrimitiveObservatory
  samples={channelPoints.map(point => ({ timeS: point.x, value: point.y }))}
  channelLabel={selectedColumn}
  unit={selectedUnit}
  contextLabel={replay ? 'REPLAY' : live ? 'LIVE' : 'BUFFER'}
  deviceResults={devicePrimitiveContext.results}
  deviceDiagnostics={devicePrimitiveContext.diagnostics}
/>
```

Pass the full result list so the observatory can distinguish selected-source data from `UNBOUND_SOURCE` diagnostics.

- [ ] **Step 5: Build and run contracts**

```bash
npm run build
python3 scripts/run_contract_self_checks.py
```

Expected: TypeScript build PASS; new contract progresses to UI-specific failures.

- [ ] **Step 6: Commit**

```bash
git add src/MonitorDataStudio.tsx scripts/device_primitive_results_self_check.py
git commit -m "feat: route device primitive telemetry"
```

---

### Task 6: Make Primitive Observatory Producer-Aware

**Files:**
- Modify: `src/PrimitiveObservatory.tsx`
- Modify: `scripts/device_primitive_results_self_check.py`

**Interfaces:**
- Extends props with:

```ts
deviceResults: DevicePrimitiveResult[];
deviceDiagnostics: DevicePrimitiveDiagnostic[];
```

- Consumes comparison helpers from `devicePrimitiveResults.ts`.
- Produces explicit HOST-DERIVED, DEVICE-DERIVED, and HOST ↔ DEVICE presentation.

- [ ] **Step 1: Add failing UI contract assertions**

Require these exact user-facing provenance tokens:

```text
HOST-DERIVED
DEVICE-DERIVED
HOST ↔ DEVICE
parameter mismatch
unbound source
```

Protect that existing host explanation still says host traces are desktop-computed and do not modify saved raw evidence. Add a token requiring device results to be described as MCU-emitted derived results.

- [ ] **Step 2: Verify RED**

```bash
python3 scripts/device_primitive_results_self_check.py
```

Expected: FAIL on missing producer-aware UI.

- [ ] **Step 3: Add a compact provenance/comparison summary above existing sections**

Keep the existing host sections intact. Add:

- HOST-DERIVED badge always when host samples exist.
- DEVICE-DERIVED badge only when valid device results exist for the selected source.
- HOST ↔ DEVICE status badge/card for each comparable primitive.
- Diagnostic summary for malformed/unsupported/unknown frames without flooding repeated identical messages.

Do not display a DEVICE-DERIVED lane for unrelated-source frames; show `unbound source` only in diagnostics/comparison status.

- [ ] **Step 4: Overlay deterministic device traces only where semantics match**

Add device series to existing plots for RMS, derivative, integral, EMA, peak hold, threshold state, and hysteresis state when valid source-matched device frames exist. Convert `timeUs` to elapsed seconds from the first valid selected-source device result. Keep host/device legends explicit.

For scalar stats, show device values beside host Mean / Sample std / Min / Max only when those result kinds exist.

- [ ] **Step 5: Enforce parameter-aware comparison copy**

For EMA, threshold, and hysteresis, if relevant parameters do not match, show `parameter mismatch` and disable numerical agreement scoring. Never label one producer as correct/incorrect automatically.

- [ ] **Step 6: Build and run all contracts**

```bash
npm run build
python3 scripts/run_contract_self_checks.py
```

Expected: PASS for all Python contracts and TypeScript/Vite build.

- [ ] **Step 7: Commit**

```bash
git add src/PrimitiveObservatory.tsx scripts/device_primitive_results_self_check.py
git commit -m "feat: visualize device primitive consistency"
```

---

### Task 7: Exercise Actual Embedded Primitives Through the Result Stream

**Files:**
- Modify/create the selected firmware verification sketch under `firmware/betterboard-core/examples/...`
- Modify: active CI workflow only if needed to compile that sketch.
- Modify: `scripts/device_primitive_results_self_check.py` if structural protection is needed.

**Interfaces:**
- Consumes: existing C++ primitive implementations for RMS/finite difference/integral/EMA/peak hold/threshold/hysteresis.
- Produces: a compilable UNO example/test path in which algorithm output is passed to `PrimitiveResultStream`, proving the formatter is not a disconnected API.

- [ ] **Step 1: Add deterministic sample sequence wiring**

Use an embedded sequence equivalent to host semantic fixtures, including irregular timing:

```text
(time_s, value): (0,0), (1,2), (3,6)
```

Wire existing primitives to produce derivative `2,2`, trapezoid cumulative integral `0,1,9`, EMA for alpha 0.5 `0,1,3.5`, peak hold `0,2,6`, threshold latch at 3 -> `0,0,1`, and hysteresis low/high 1/4 -> `0,0,1`.

Do not duplicate the formulas in a new firmware helper; call the existing BetterBoard primitive classes.

- [ ] **Step 2: Compile for UNO**

Run the exact active CI Arduino command.

Expected: PASS.

- [ ] **Step 3: Confirm host parser fixtures use the same emitted protocol values**

Run:

```bash
python3 scripts/device_primitive_results_self_check.py
```

Expected: PASS.

- [ ] **Step 4: Add CI compile gate if not already covered**

If the active workflow compiles only `numerical_microbench` and `Numeric Error Depth`, add one explicit compile step for the primitive-result verification sketch. Do not remove existing firmware compile gates.

- [ ] **Step 5: Commit**

```bash
git add firmware/betterboard-core/examples .github/workflows scripts/device_primitive_results_self_check.py
git commit -m "test: verify device primitive telemetry on avr"
```

---

### Task 8: Full Branch-Head Verification and PR Readiness

**Files:**
- No production changes unless verification exposes a concrete defect.

**Interfaces:**
- Consumes: exact branch-head commit after Tasks 1–7.
- Produces: fresh evidence that the PR head is green across frontend, contracts, AVR firmware, and Rust/Tauri checks.

- [ ] **Step 1: Run local/available fast gates before pushing final verification commit**

```bash
npm run build
python3 scripts/run_contract_self_checks.py
```

Expected: PASS.

- [ ] **Step 2: Push/commit any final verification-only corrections using the smallest possible change**

If a failure appears, use systematic debugging: identify root cause, add/adjust the failing test first where appropriate, then make the minimal fix. Do not weaken contracts merely to make CI green.

- [ ] **Step 3: Inspect the exact branch-head GitHub Actions run**

Require success for:

```text
TypeScript/Vite build
Python contract self-check suite
Arduino CLI setup
Arduino AVR core setup
Numerical microbench UNO compile
Numeric Error Depth UNO compile
Device primitive result UNO compile
Tauri Linux dependencies
Rust check
```

- [ ] **Step 4: Verify PR #66 still targets `main` and the checked run SHA equals the current branch head**

Do not claim Phase 4 complete from an older run.

- [ ] **Step 5: Report shipped behavior and any deliberately deferred items**

Report protocol v1, producer provenance, comparison status behavior, raw-evidence isolation, and fresh CI run/commit identifiers. Explicitly keep binary telemetry, persisted control-line replay, and device-side CUSUM/mean-shift comparison deferred.
