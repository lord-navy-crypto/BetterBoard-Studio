# BetterBoard Future Enhancements — DRAFT ONLY

> Status: DRAFT / NOT IMPLEMENTED / NOT CANONICAL
>
> This file is an idea backlog only. None of the items below should be treated as approved implementation work, production requirements, canonical architecture, or a request to modify `main`.
>
> Current branch context: `numeric-error-research-pack`.

## Purpose

Capture possible future directions for BetterBoard without implementing them yet. These ideas may later be reviewed, split, rejected, prototyped, or promoted into real work.

## Draft idea groups

### A. DIY / Experiment Composer

- Fork an existing canonical recipe into a user-editable DIY recipe.
- Pin remapping using board capability constraints instead of hard-coded pins.
- Channel Builder for analog, digital, event, derived, and calculated channels.
- Transform Pipeline: scale, offset, clamp, EMA, moving average, median, difference, integral accumulator, period-to-frequency, quantization, threshold.
- Trigger Builder: periodic, edge, threshold, photogate, button, serial command, single-shot, burst.
- Output Builder: serial CSV, PWM, LED/state outputs, metadata lines.
- Generated firmware preview and export.
- Generated-code diff showing how GUI edits changed firmware.

### B. Project / Experiment Workspace

Possible project container preserving:

- hardware configuration
- circuit graph
- selected/forked recipe
- generated firmware snapshot and hash
- capture profiles
- measurements
- analyses
- visualization configuration
- provenance
- notes / conclusions

Possible experiment timeline:

- circuit validation
- firmware generation
- preflight
- compile
- upload
- capture
- parameter changes
- analysis
- exports

### C. Capture and Live Measurement

- True live streaming rather than fixed-duration capture only.
- Start / pause / resume / stop controls.
- Manual event markers during acquisition.
- Smart start/stop triggers.
- Reusable Capture Profiles.
- Bounded row limits and expected-rate diagnostics.
- Replicate-aware recording.

### D. Data Studio Expansion

- Multi-run comparison and overlays.
- User-selectable X/Y channels.
- Line, scatter, histogram, XY and event-raster views.
- Plot configuration stored with the project.
- Run-to-run statistics and residual views.
- Measurement markers and annotations.
- Schema inspector for malformed rows, missing fields, timestamp order and expected-rate mismatch.

### E. Measurement Quality and Calibration

- Calibration Manager with explicit calibration IDs and coefficients.
- Clear distinction between nominal conversion and calibrated quantity.
- Hardware Health dashboard.
- Analog stability diagnostics: mean, standard deviation, peak-to-peak, stuck-at-zero/full-scale, floating-input suspicion.
- Timing diagnostics: requested period, observed period, jitter, drift, missed deadlines.
- Evidence-quality flags rather than a synthetic global score.

### F. Hardware Knowledge / Device DIY

- Device Wizard for user-defined sensors and modules.
- Unknown Module Inspector with conservative, user-confirmed interface information.
- Pin Test / Connection Test tools.
- Hardware Fixture profiles for reusable physical setups.
- Shared hardware manifest between Circuit Lab and recipe configuration.

### G. Circuit Lab Expansion

- Circuit graph → hardware manifest → recipe pin mapping handoff.
- Reusable circuit templates.
- Better component/device metadata.
- Rule Checker growth without pretending to be SPICE or certification.
- Visual mapping between circuit pins and generated firmware symbols.

### H. Experiment Automation

- Campaigns over recipe parameters, e.g. multiple EMA alpha values.
- Repeated trials / replicates grouped under one experiment.
- State-machine-style experiment sequences.
- Event-triggered measurement plans.
- Automated comparison tables across runs.

### I. Numerical / Algorithm Benchmarking

- Accuracy vs execution-time comparisons.
- Resource use versus numerical quality.
- Fixed-point vs floating-point experiments.
- Algorithm benchmark mode for filters, Taylor, summation, integration and other bounded numerical kernels.
- Better integration with host-side oracle and uncertainty analysis.

### J. Analyzer Architecture

- Analyzer modules declare required channels, units, outputs and reference requirements.
- In-app execution of Bench 02 / Bench 03 / focused Numeric Error analyzers instead of terminal-only commands.
- Analyzer registry rather than hard-coded UI wiring.
- Preserve raw evidence while generating derived summaries.

### K. Serial / Protocol Layer

- Stronger serial-port classification and ranking.
- Explicit monitor/capture/upload ownership to avoid `Resource busy`.
- Schema version metadata emitted by firmware.
- Dynamic schema parsing instead of front-end hard-coding.
- Protocol Inspector for data integrity and timing behavior.

### L. Resource / Build Diagnostics

- Flash and RAM utilization dashboard after compile.
- Warnings for high global-memory usage.
- Compile comparison between DIY variants.
- Firmware resource budget evidence stored with runs.

### M. Extension / Plugin Model

Possible extension package pieces:

- `device.json`
- `recipe.json`
- optional firmware template
- optional analyzer
- optional visualization metadata

Goal: permit new devices and experiments without modifying the BetterBoard core for every addition.

### N. Report / Evidence Export

Possible generated report containing:

- experiment goal
- hardware
- wiring
- firmware and hash
- parameters
- calibration context
- raw data references
- plots
- metrics
- warnings
- provenance
- user conclusions

Potential formats: Markdown, HTML, JSON evidence package.

### O. Future Control / Signal Work

Ideas only, subject to separate review:

- safe low-voltage closed-loop control bench
- step/ramp/pulse/PWM stimulus generation
- response analysis such as rise time, settling time and steady-state error
- signal-chain validation using known generated stimuli

### P. AI Assistance Boundary

Potential AI role:

- turn a user goal into a draft experiment
- recommend compatible known devices and board capabilities
- generate a reviewable recipe draft
- explain wiring assumptions
- explain analysis choices

AI should not silently guess unknown module voltage, bypass hardware confirmation, or convert uncertain evidence into a safety/certification claim.

## Possible future product direction

Conceptual flow only:

```text
Choose hardware
    ↓
Wire visually
    ↓
Choose pins
    ↓
Choose acquisition
    ↓
Choose transforms
    ↓
Choose triggers
    ↓
Choose calculations
    ↓
Choose outputs
    ↓
Choose analyses
    ↓
Generate firmware
    ↓
Upload / Capture
    ↓
Analyze / Compare
    ↓
Export reproducible experiment
```

Existing canonical recipes such as Blink, Bench 01, Bench 03 and Magnet Bench should remain stable templates; future DIY work could fork from them rather than mutating canonical definitions directly.

## Review rule

Nothing in this draft should be implemented automatically. Before implementation, each idea should receive an explicit review covering:

1. scientific value;
2. product value;
3. hardware assumptions;
4. safety boundary;
5. data/evidence semantics;
6. compatibility with existing BetterBoard architecture;
7. migration / canonical-recipe impact;
8. test plan;
9. decision: reject / defer / prototype / implement.
