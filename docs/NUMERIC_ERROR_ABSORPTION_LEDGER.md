# Numeric Error Legacy Absorption Ledger

This ledger records how the useful work from `numeric-error-research-pack` was absorbed into the clean `numeric-error-depth-clean` integration branch. The goal is capability absorption, not preservation of every duplicate V1 filename as an active experiment.

## Active Numeric Error Depth firmware

- `NumericError_Aliasing` — corrected Wave 2 sampling/timestamp experiment.
- `NumericError_Cancellation` — corrected finite-x reference semantics.
- `NumericError_DebounceComparison` — absorbs `NumericError_SwitchBounce` capability with per-edge evidence and dropped-edge accounting.
- `NumericError_FixedPointVsFloat` — corrected sign-symmetric Q15 rounding and signed cases.
- `NumericError_OverflowSaturation` — explicit widened reference / wrap / saturation evidence.
- `NumericError_InteractiveStudioV2` — absorbs the legacy Interactive Studio concept with non-blocking sweep and queued photogate triggers.
- `NumericError_ADCStabilityV2` — absorbs ADC Stability with streaming statistics, nominal-Vref boundary and scheduling lateness.
- `NumericError_FilterLagV2` — absorbs Filter Lag with explicit scheduler timing and fast/slow EMA residuals.
- `NumericError_QuantizationV2` — absorbs Quantization with integer rational re-quantization to isolate quantization from float mapping.
- `NumericError_PWMQuantizationV2` — absorbs PWM Quantization with integer command mapping and reconstruction error.
- `NumericError_DerivativeV2` — absorbs the legacy derivative experiment while separating MCU-local `cosf` provenance from host reference analysis and recording runtime.
- `NumericError_IntegrationV2` — absorbs the legacy integration experiment with runtime evidence and host-side convergence responsibility.
- `NumericError_SummationV3` — absorbs Summation V1/V2 with exact rational increment metadata, naive/Kahan comparison and runtime evidence.
- `NumericError_PIRTimingV2` — absorbs PIR Latency while correcting the scientific claim: observed digital-output timing only unless an independent physical trigger exists.
- `NumericError_PhotogateTimingV3` — absorbs PhotogateTiming V1/V2 with accepted-event queue, per-event indices, close-edge rejection and explicit queue drops.
- `NumericError_MultiSensorEventLabV3` — absorbs MultiSensorEventLab V1/V2 as a sampled-context experiment with event multiplicity/rejection evidence. Event-by-event photogate work remains the responsibility of InteractiveStudioV2.

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
`Numeric Error Depth` owns experiment campaigns and active firmware families.

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

Absorbed does not mean hardware-validated. Before canonical recipe registration, run frontend/build checks, compile every active sketch for the intended board, upload to real hardware where applicable, capture real serial evidence, run the host analyzers/bridge, inspect timing/drop counters, and compare Numerical Error Studio semantics where relevant.
