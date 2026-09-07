# BetterBoard Visual Native 1.0

BetterBoard now uses a shared desktop visual system derived from the strongest presentation patterns already proven in the sibling projects Openguin, Sentinel, and Engineering Lab.

## Design direction

The redesign is intentionally not a decorative reskin. The UI hierarchy follows the engineering workflow:

`workspace → mission → hardware state → action → measurement → evidence → task feedback`

The visual system therefore emphasizes:

- a persistent workspace command bar instead of three unrelated top-level pages;
- a restrained dark navy surface hierarchy with one cyan/blue/purple accent family;
- high-signal status cards for CLI, USB/serial state, task state, and scientific boundaries;
- trend-first data presentation using the existing lightweight SVG sparkline rather than adding a chart dependency;
- a persistent floating Task Center inspired by Sentinel so compile/upload/capture work never disappears below the fold;
- a more instrument-like Circuit Lab canvas with clearer selection, wiring, rule, and pin states;
- consistent cards, forms, tags, evidence panels, code panes, and bridge-flow diagrams across Studio pages;
- reduced-motion support and restrained transitions.

## Performance policy

Visual Native 1.0 adds no runtime package dependency. It reuses React, Lucide, CSS, and the existing SVG telemetry plot.

The high-frequency data path remains bounded: the Studio sparkline still renders only the latest 120 numeric points. Expensive blur is limited mainly to persistent chrome (workspace bar, sidebar, Task Center), while ordinary cards use opaque/translucent fills without repeated filter effects.

`contain: paint` is applied to repeated cards and task rows to reduce unnecessary repaint spill. Animation is disabled automatically when the operating system requests reduced motion.

## Scientific boundary

This redesign changes presentation only. It does not change board selection, firmware, capture semantics, measurement schemas, Physical Lab bridge semantics, numerical-analysis definitions, magnetic-field definitions, calibration claims, or model-validation claims.

## Visual sources inside this organization

- **Openguin**: compact sidebar + header hierarchy, KPI/readout surfaces, runtime observatory, trend presentation.
- **Sentinel**: visual-native mission hierarchy, restrained evidence cards, persistent Task Center, operational state visibility.
- **Engineering Lab / Physical Lab**: measurement-first visualization, explicit scientific boundaries, lightweight plots, model/measurement separation.

BetterBoard keeps its own identity: the product remains goal-first physical computing rather than an AI runtime monitor, system monitor, or simulation workbench.
