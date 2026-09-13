# Engineering Lab v2 Release Gates

An enhancement PR may merge only when all gates apply to the same exact head SHA.

## Code gates

- Every catalog sketch exists and its declared stream schema matches firmware.
- All supported-board experiment compilations succeed.
- BetterBoard core and repository integrity checks succeed.

## Evidence gates

- Raw evidence is retained for new derivations.
- Derived observables have documented definitions.
- Failure behavior cannot be mistaken for a valid zero-valued measurement.
- Compatibility impact is documented.

## Git gates

- PR head SHA has not moved since workflow verification.
- Engineering Lab Experiments: success.
- BetterBoard C++ Core: success.
- BetterBoard CI: success.
- Sensor Suite v1 Integrity: success.
- PR remains open and mergeable.

Only then use a normal merge commit.
