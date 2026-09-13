# Engineering Lab Experiments v2 Acceptance Gates

Before v2 enhancements merge:

1. Catalog column and unit arrays must exactly match every firmware stream header.
2. Every experiment must compile on each board promised by the Engineering Lab CI matrix.
3. Existing raw observables must not be removed when adding derived observables without an explicit compatibility decision.
4. Derived quantities must have documented equations or definitions.
5. Sensor failures must never be emitted as apparently valid measurements.
6. Timing and sensor-read behavior must remain non-blocking enough to preserve the experiment's intended cadence.
7. BetterBoard C++ Core, BetterBoard CI, Engineering Lab Experiments, and Sensor Suite v1 Integrity must all pass on the exact PR head SHA.
8. Merge only from a still-open, mergeable PR whose head SHA has not changed since the checks were verified.
