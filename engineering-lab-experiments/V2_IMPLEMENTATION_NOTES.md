# Engineering Lab v2 Implementation Notes

Batch 1 uses additive columns for enhanced streams so established raw evidence remains at the beginning of each row. This is deliberate: downstream consumers can see exactly what changed, and compatibility impact is reviewable.

The next common mechanism should avoid duplicating large strings or complex state on constrained targets. Quality flags and metadata should use compact representations with documented semantics. Timing diagnostics should prefer integer microsecond quantities where possible. Configuration fingerprints should be deterministic and generated from the settings that materially affect interpretation.

Where a sensor library cannot expose a desired hardware status portably, v2 should document that limitation instead of inventing confidence that the hardware did not provide.
