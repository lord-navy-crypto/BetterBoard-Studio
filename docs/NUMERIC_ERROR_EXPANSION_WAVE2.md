# BetterBoard Numeric Error Expansion — Wave 2

Wave 2 extends the research branch beyond basic ADC/filter/integration experiments into numerical representations and sampling pathologies.

## New research sketches

### NumericError_Aliasing

Controlled 17 Hz synthetic sine sampled at 200, 80, 40, 34, 30 and 20 Hz. Intended host analysis:

- compare sample rate with Nyquist threshold
- estimate apparent frequency
- classify well-sampled / near-Nyquist / aliased regimes
- distinguish a correct sample value from an incorrect inferred signal

### NumericError_FixedPointVsFloat

Runs the same first-order recurrence with float and Q15 fixed point. Intended analysis:

- state difference versus iteration
- steady-state bias
- quantization step
- saturation events
- execution cost in a later V2

### NumericError_Cancellation

Compares `(1-cos(x))/x^2` against the equivalent `2*sin(x/2)^2/x^2` as x approaches zero. This isolates catastrophic cancellation and shows that algebraic equivalence does not imply numerical equivalence.

### NumericError_OverflowSaturation

Separates:

- widened reference arithmetic
- unsigned wraparound
- explicit saturation

Signed overflow is not invoked directly; signed cases use widened arithmetic and saturation so the experiment does not rely on undefined behavior.

### NumericError_DebounceComparison

Compares raw interrupt edges from a switch with a stable-time debounce rule. It reports both raw edge evidence and accepted stable transitions so filtering cannot hide what happened physically.

## Why these belong in BetterBoard

Together with Wave 1, the platform can now investigate six distinct error mechanisms:

1. measurement noise / instability
2. quantization / representation
3. sampling / aliasing
4. discretization / approximation
5. floating-point cancellation / accumulation
6. event interpretation / debounce / timing

This is a more coherent research direction than simply adding more sensor demos.

## Suggested next expansions

Do not immediately add all of these. Highest-value future work is:

- timestamp resolution and clock-drift characterization using repeated photogate events
- ADC reference characterization/calibration metadata without claiming traceable calibration
- fixed-point V2 with cycle/time cost and explicit saturation counters
- aliasing host analyzer with apparent-frequency estimation
- an uncertainty-budget layer that records source, representation, transformation and propagated uncertainty separately
- MPU6050 drift/integration experiment only after the I2C hardware path is stable

## Promotion rule

All Wave 2 sketches remain research-stage. Compile, upload, capture and analyze on real UNO hardware before canonical recipe registration.
