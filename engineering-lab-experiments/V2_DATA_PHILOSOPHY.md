# Engineering Lab v2 Data Philosophy

A measurement system becomes more useful when it preserves why a number should or should not be trusted.

For that reason, v2 treats timestamp, validity, sensor state, configuration, coordinate frame, and calibration provenance as part of experimental evidence rather than incidental implementation details. A perfectly formatted number with hidden timing or calibration assumptions is weaker evidence than a noisier number whose origin can be audited.

This does not mean moving all analysis onto the microcontroller. The firmware should emit enough information for Engineering Lab to reproduce important transformations and make informed choices about filtering, uncertainty, alignment, fitting, and model comparison.
