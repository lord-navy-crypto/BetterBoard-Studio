# Definition of Done — Engineering Lab Enhancement

An enhancement is done only when the implementation, evidence semantics, and verification agree.

- Firmware compiles on supported boards.
- Catalog and firmware schema match exactly.
- New derived values are documented and reconstructable.
- Existing evidence is preserved unless a breaking change is explicitly justified.
- Failure behavior does not fabricate valid-looking measurements.
- Scientific interpretation remains downstream.
- Required CI workflows are green on one exact, unchanged PR head.
- PR is still open and mergeable immediately before merge.
- Merge uses the repository's intended normal merge path unless explicitly requested otherwise.

Passing compilation alone is necessary, not sufficient.
