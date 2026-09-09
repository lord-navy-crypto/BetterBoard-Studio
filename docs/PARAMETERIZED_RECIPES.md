# Parameterized Recipes and My Library

BetterBoard recipes now have two layers:

1. **Canonical recipes** — versioned, reproducible starting points bundled with the app.
2. **My Library** — user presets or Developer-derived sketches saved under `~/Documents/BetterBoard/library`.

Exposed recipe parameters are not display-only settings. BetterBoard validates them, injects compile-time `BB_*` macros into the firmware source, compiles that rendered source, and records the effective values in Measurement Evidence metadata.

Developer follows the same loop:

`Recipe template → edit .ino → Verify / Run → Save to Library → reuse later`

The optional OpenPenguin bridge is loopback-only and targets the private local runtime at `127.0.0.1:11435`. BetterBoard does not use this bridge to upload experiment data to a remote service.
