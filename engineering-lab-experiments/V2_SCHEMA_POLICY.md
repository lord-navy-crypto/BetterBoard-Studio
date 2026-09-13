# Engineering Lab Stream Schema Policy

1. `time_us` remains the first column for sampled streams unless an event stream has a documented stronger reason.
2. Existing raw measurement columns should remain stable across compatible enhancement releases.
3. New derived observables are appended rather than inserted between established columns where practical.
4. Catalog `columns` and `units` are normative and must match firmware headers exactly.
5. Column names encode physical quantity and, where useful, units; the separate units array remains authoritative.
6. Coordinate-frame-dependent quantities must state their frame in documentation.
7. A quality or validity field, once introduced, must have documented machine-readable semantics.
8. A missing sensor read should not masquerade as zero.

These rules make recorded datasets easier to compare across firmware revisions and safer for downstream Engineering Lab tooling.
