# Engineering Lab Evidence Quality Contract

Engineering Lab firmware is an evidence producer. A useful experiment stream must make it possible for downstream analysis to distinguish what the sensor observed from what software inferred.

## Required properties

- Preserve the raw or closest practical sensor observable when a derived quantity is emitted.
- Emit explicit units and stable column names.
- Preserve acquisition time for every row.
- Keep coordinate conventions and calibration assumptions documented.
- Do not silently convert missing or failed reads into plausible numeric measurements.
- Keep firmware-side derivations deterministic and auditable from emitted or documented inputs.
- Keep model fitting, uncertainty interpretation, residual acceptance, and scientific conclusions downstream.

## v2 direction

The next enhancements should add machine-readable quality state, configuration/calibration provenance, timing diagnostics, and run identity while maintaining compatibility with constrained targets such as Arduino UNO.
