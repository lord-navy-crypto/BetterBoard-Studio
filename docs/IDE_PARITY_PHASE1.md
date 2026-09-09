# IDE Parity Phase 1

BetterBoard treats Arduino IDE 2 capabilities as a baseline, not a differentiator.

## Implemented in alpha.4

- Monaco-based C++/Arduino editor
- Arduino starter autocomplete and compile-diagnostic markers
- Board Manager via Arduino CLI
- Library Manager via Arduino CLI
- Library examples via Arduino CLI
- Arduino + BetterBoard sketchbook discovery
- bounded multi-file project editing and whole-project Verify/Upload

## Architecture

BetterBoard does not duplicate the Arduino package ecosystem. Board and library operations delegate to the locally installed `arduino-cli`, while BetterBoard adds orchestration, tasks, recipes, measurement evidence, experiments, Observatory, Learning, and local AI.

## Remaining parity work

- richer language-server completion / go-to-definition
- configurable formatter
- ZIP library picker UX
- board-specific menu options / programmers
- full debugger UI and `arduino-cli debug` integration
- deeper Serial Plotter controls
- create/rename/delete project files in the project tree
