# Numeric Error Legacy Absorption Ledger

This ledger records how the useful work from `numeric-error-research-pack` was absorbed into the clean `numeric-error-depth-clean` integration branch. The goal is capability absorption, not preservation of every duplicate V1 filename as an active experiment.

## Preferred integrated campaign labs

- `NumericError_SignalChainLabV1` — preferred end-to-end A0 signal-chain experiment. It synchronizes ADC stability, nominal-voltage boundary, 8/6/4-bit re-quantization, EMA lag/residual, PWM command/reconstruction error, sample `dt`, scheduling lateness and 1 s rolling statistics on one clock. The focused ADC/quantization/filter/PWM sketches remain as single-factor controls rather than competing primary experiments.
- `NumericError_EventTimingLabV1` — preferred integrated event/timing experiment. It combines photogate accepted/rejected/drop evidence, switch raw-vs-stable debounce evidence, PIR observed-output transition timing and periodic sampled context. It intentionally does not claim PIR sensor-internal latency without an independent physical trigger reference.

## Active focused Numeric Error Depth firmware

- `NumericError_Aliasing` — corrected Wave 2 sampling/timestamp experiment.
- `NumericError_Cancellation` — corrected finite-x reference semantics.
- `NumericError_DebounceComparison` — absorbs `NumericError_SwitchBounce` capability with per-edge evidence and dropped-edge accounting; retained as the focused switch-only control for Event Timing Lab.
- `NumericError_FixedPointVsFloat` — corrected sign-symmetric Q15 rounding and signed cases.
- `NumericError_OverflowSaturation` — explicit widened reference / wrap / saturation evidence.
- `NumericError_InteractiveStudioV2` — absorbs the legacy Interactive Studio concept with non-blocking sweep and queued photogate triggers.
- `NumericError_ADCStabilityV2` — focused ADC stability control with streaming statistics, nominal-Vref boundary and scheduling lateness.
- `NumericError_FilterLagV2` — focused filter control with explicit scheduler timing and fast/slow EMA residuals.
- `NumericError_QuantizationV2` — focused ADC quantization control using integer rational re-quantization.
- `NumericError_PWMQuantizationV2` — focused PWM quantization control with integer command mapping and reconstruction error.
- `NumericError_DerivativeV2` — absorbs the legacy derivative experiment while separating MCU-local `cosf` provenance from host reference analysis and recording runtime.
- `NumericError_IntegrationV2` — absorbs the legacy integration experiment with runtime evidence and host-side convergence responsibility.
- `NumericError_SummationV3` — absorbs Summation V1/V2 with exact rational increment metadata, naive/Kahan comparison and runtime evidence.
- `NumericError_PIRTimingV2` — focused PIR control; observed digital-output timing only unless an independent physical trigger exists.
- `NumericError_PhotogateTimingV3` — focused photogate control with accepted-event queue, per-event indices, close-edge rejection and explicit queue drops.
- `NumericError_MultiSensorEventLabV3` — sampled-context control preserving photogate multiplicity/rejection between 50 Hz context samples.

## Fusion decisions

### Signal-chain fusion

These four experiments share the same physical A0 measurement path and can be meaningfully compared on one synchronized timeline:

`ADCStabilityV2 + QuantizationV2 + FilterLagV2 + PWMQuantizationV2 → SignalChainLabV1`

The four focused sketches are intentionally retained because they isolate one factor at a time and therefore remain useful controls. `SignalChainLabV1` is the preferred integrated campaign surface.

### Event/timing fusion

These experiments share the question of how asynchronous physical/digital changes become recorded MCU evidence:

`DebounceComparison + PhotogateTimingV3 + PIRTimingV2 + MultiSensorEventLabV3 → EventTimingLabV1`

Again, focused programs remain controls; the integrated lab is the preferred campaign surface.

### Numerical-method family, not monolithic firmware

`Cancellation + FixedPointVsFloat + OverflowSaturation + DerivativeV2 + IntegrationV2 + SummationV3` are grouped as one Numerical Methods family in the Experiments UI but are **not** merged into a giant sketch. Their error mechanisms and independent variables are materially different, so separate controlled firmware produces cleaner scientific evidence.

## Existing main-line numerical programs retained

- `EmbeddedNumericalReliability`
- `NumericalDerivativeSweep`
- `NumericalAccumulation`
- `NumericalCancellation`
- `MPU6050Numerics`

These are not duplicated solely to preserve old research-pack names. Where an older experiment addresses the same question, the clean branch either keeps the stronger main-line implementation or adds a focused Numeric Error Depth variant when the scientific question is materially distinct.

## Host-side analysis absorption

Legacy:
- `numeric_error_research_analyzer.py`
- `numeric_error_research_analyzer_v2.py`
- `numeric_error_research_self_check.py`
- `numeric_error_validation_self_check.py`

Clean replacement:
- `scripts/numeric_error_campaign_analyzer.py`
- `scripts/numeric_error_campaign_self_check.py`
- `scripts/arduino_numeric_error_bridge_v2.py` for Interactive Studio → Numerical Error Studio semantic conversion.

The consolidated analyzer recognizes the active campaign schemas and keeps scientific boundaries explicit. The bridge remains the higher-fidelity path for Taylor reliability rows because it aligns with `numerical-methods` field semantics and uses NumPy float32 plus an independent mpmath oracle.

## Workspace placement

### Experiments
`Numeric Error Depth` owns experiment campaigns and active firmware families. `Signal Chain Lab` and `Event Timing Lab` are the preferred integrated surfaces for overlapping hardware-path experiments.

### Studio → Engineering Preparation
Reusable preparation, capture, analyzer, self-check, bridge/export and handoff tools live here.

## Archived / absorbed, not separately promoted

The following legacy names are intentionally not copied as separate active versions because their useful behavior has been absorbed by stronger descendants:

- `NumericError_SwitchBounce` → `NumericError_DebounceComparison`
- `NumericError_PhotogateTiming` + `NumericError_PhotogateTimingV2` → `NumericError_PhotogateTimingV3`
- `NumericError_MultiSensorEventLab` + `NumericError_MultiSensorEventLabV2` → `NumericError_MultiSensorEventLabV3`
- `NumericError_Summation` + `NumericError_SummationV2` → `NumericError_SummationV3`
- `NumericError_InteractiveStudio` → `NumericError_InteractiveStudioV2`
- legacy research analyzer/self-check scripts → consolidated campaign analyzer/self-check.

The old branch remains untouched as historical provenance.

## Validation boundary

Repository promotion requires frontend/build checks, structural and functionality checks, numerical/analyzer self-checks, UNO compilation for every active and integrated sketch, and Rust/Tauri checks. Hardware-behavior claims still require real UNO upload/capture and real sensor evidence; CI compilation alone does not establish physical timing or calibration accuracy.
