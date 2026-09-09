# Numeric Error next review checklist

Use this checklist when deciding what to promote from research firmware into canonical BetterBoard recipes.

1. Compile each focused sketch for `arduino:avr:uno` without installing new dependencies.
2. Upload each hardware sketch to the real UNO and verify serial schema integrity.
3. Record at least one evidence package per hardware sketch.
4. Run `scripts/numeric_error_research_analyzer_v2.py` against representative captures.
5. Run `scripts/numeric_error_validation_self_check.py`.
6. Prefer V2 photogate, MultiSensor, and Summation semantics over the first research versions.
7. Do not add a recipe to `catalog.json` until hardware validation passes.
8. Before UI expansion, fix port ranking/filtering and serial ownership so upload/capture cannot fight for the same port.
9. Bench 03 must show one-shot completion explicitly rather than appearing stalled.
10. Bench 02 / focused host analysis should become in-app actions rather than terminal commands.
