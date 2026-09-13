# Engineering Lab v2 Status

**Branch:** `enhance/engineering-lab-experiments-v2`

**Batch 1:** implementation started.

Completed in the first code pass:

- MLX90393/RADIA vector-direction observables;
- encoder revolution and wrapped-phase observables;
- catalog synchronization for those schema additions;
- per-experiment definitions and compatibility notes;
- suite-wide quality, scientific-boundary, review, test, release-gate, and roadmap contracts.

Not yet complete:

- quality flags across all nine experiments;
- actual acquisition timing/skew diagnostics;
- calibration/configuration provenance mechanism;
- run/configuration identity;
- host-side schema/derivation fixtures;
- exact-head CI verification and PR merge.

The branch should remain separate from `main` until implementation and CI gates are satisfied.
