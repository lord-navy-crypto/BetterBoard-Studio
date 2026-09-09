# Numeric Error Depth — Clean Migration Review

This branch was created from current `main` (`d5611e65c5161dd60b3f87144a566b8e56b5202a`) instead of merging the legacy `numeric-error-research-pack`, which had diverged substantially from `main`.

The legacy research branch remains untouched as historical evidence.

## Ported and corrected experiments

### NumericError_Aliasing V2

- keeps the 17 Hz controlled synthetic source
- samples it on the real MCU `micros()` schedule
- records ideal timestamp, actual timestamp, and lateness
- explicitly labels itself as a sampling/timestamp experiment, not an analog front-end test

### NumericError_FixedPointVsFloat V2

- replaces biased negative Q15 rounding with sign-symmetric round-to-nearest
- avoids depending on implementation-specific negative right shifts
- adds both positive and negative input cases
- records explicit saturation state

### NumericError_Cancellation V2

- removes the incorrect assumption that `0.5` is the exact reference for every finite `x`
- uses the stable series for `(1-cos(x))/x^2` as an independent reference
- reports direct-form error, reformulated-form error, and disagreement between forms

### NumericError_OverflowSaturation V2

- preserves widened mathematical reference arithmetic
- preserves explicit unsigned wraparound
- preserves explicit saturation
- avoids invoking signed overflow directly
- reports wrap and saturation error separately

### NumericError_DebounceComparison V2

- replaces the single `rawChanged` boolean evidence path with a bounded ISR ring buffer
- preserves individual raw-edge timestamps and raw states
- reports dropped-edge count explicitly if the buffer overflows
- keeps accepted stable transitions separate from raw physical evidence

## Validation state

These files have passed code-level review in this branch, but they are **not yet canonical recipes** and must not be described as real-hardware validated until the following gates are completed:

1. Arduino UNO compile for every sketch.
2. Upload to UNO.
3. Serial capture with the intended hardware path.
4. Host-side parsing and numerical consistency checks.
5. For timing experiments, inspect timestamp resolution, lateness, dropped evidence, and rollover-safe behavior.
6. Promote only experiments whose captured evidence matches the documented claim.

## Merge policy

Do not merge the legacy `numeric-error-research-pack` wholesale.

Use this clean branch as the integration surface for Numeric Error Depth work based on current `main`. Keep the pull request draft until compile/upload/capture evidence is attached or otherwise recorded.
