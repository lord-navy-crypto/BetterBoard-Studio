# Arduino Research Preparation Backlog — DRAFT ONLY

> Status: DRAFT / PREPARATION ONLY / NOT IMPLEMENTED / NOT CANONICAL
>
> Purpose: prepare a structured backlog for future BetterBoard Arduino research experiments without changing production code, canonical recipes, UI, or `main`.

## Preparation principle

Future Arduino work should be organized by scientific mechanism, not by accumulating unrelated `.ino` sketches. Each candidate experiment should declare:

- research question
- minimum hardware
- optional hardware
- MCU role
- host/oracle role
- proposed input schema
- proposed output schema
- controllable parameters
- evidence boundary
- expected failure modes
- validation gate

## Priority group A — Arduino-only / no external sensor required

### A1. Scheduler Jitter & Drift

Research questions:
- How close is a requested periodic loop to its actual period?
- How does timing drift accumulate under different scheduling strategies?
- How much timing disturbance comes from serial printing?

Candidate strategies:
- `delay()` scheduling
- `millis()` deadline scheduling
- `micros()` deadline scheduling
- deadline-compensated `next_deadline += period`

Candidate outputs:
`seq,target_period_us,scheduled_us,actual_us,interval_us,jitter_us,deadline_error_us,serial_mode`

### A2. Serial Overhead Perturbation

Compare the same loop with:
- no serial output
- one integer per cycle
- full CSV row
- buffered/batched output

Measure loop timing and missed-deadline evidence.

### A3. Horner vs Direct Polynomial Evaluation

Evaluate a polynomial in float32 using:
- direct powers
- Horner form

Compare host high-precision reference, execution time, intermediate magnitude, and accumulated error.

### A4. Lookup Table vs Direct Computation

Candidate functions:
- sine over a bounded interval
- simple calibration curve

Compare:
- direct `sinf`
- lookup nearest
- lookup linear interpolation

Metrics:
- max error
- RMS error
- execution time
- memory cost

### A5. Running Statistics Stability

Compare online variance estimators:
- naive `sum` + `sum_sq`
- Welford

Use synthetic controlled sequences including large offset + small variation to expose cancellation.

### A6. Running Integration Drift

Integrate synthetic signals:
- exact zero
- constant tiny bias
- zero plus deterministic pseudo-noise

Observe accumulated drift over sample count and timestep choice.

### A7. Timestamp Wraparound Semantics

Use simulated `uint32_t` timestamp values near wrap boundaries to compare:
- correct unsigned subtraction
- naïve relational timing logic

No need to wait for a real `micros()` rollover.

### A8. Fixed-Point Scaling Study

Compare Q-format choices for a bounded recurrence:
- Q7.8
- Q3.12
- Q1.14 / Q15-style

Metrics:
- saturation count
- quantization error
- final bias
- execution time
- representable range

## Priority group B — potentiometer / analog input

### B1. ADC Stability Map

Use multiple held knob positions and summarize:
- mean
- standard deviation
- p2p
- code histogram
- repeated-code fraction

Do not interpret counts as calibrated voltage without calibration evidence.

### B2. Threshold Chatter vs Hysteresis

Potentiometer near a threshold:
- raw threshold
- threshold with hysteresis
- stable-window decision

Outputs include transition count and time in each state.

### B3. Filter Comparison

Compare:
- EMA
- moving average
- median-of-3 / median-of-5

Metrics:
- noise reduction
- step-response lag
- outlier rejection
- memory cost

### B4. ADC → PWM Transfer Study

Map 10-bit ADC to 8-bit PWM using:
- truncation
- rounding
- optional error-diffusion/dither concept

Measure representation error in count space only; do not claim calibrated optical brightness.

## Priority group C — photogate / optical event input

### C1. Frequency Estimator Comparison

Compare:
- single-period estimator `1/T`
- N-period estimator `(N-1)/(t_N-t_1)`
- moving average of periods

Metrics:
- variance
- response speed
- sensitivity to one anomalous edge

### C2. Polling vs Interrupt

At benign manual/low-rate events, compare:
- loop polling
- external interrupt timestamping

Measure missed-event evidence and timestamp variation. Do not encourage high-speed machinery.

### C3. Event Coalescing Detection

Explicitly test when several accepted edges occur between sampled UI rows.

Preserve:
- total event count
- events since sample
- coalesced flag

## Priority group D — switch / digital event input

### D1. Debounce Algorithm Comparison

Compare:
- fixed dead-time
- stable-window debounce
- majority vote across samples

Preserve raw edge evidence separately from accepted state changes.

### D2. Human Trigger Timing

Compare manual switch trigger timestamps with photogate trigger timestamps for repeated low-speed trials.

Interpret as input-path timing differences, not human reaction-time research unless experimental design explicitly supports that claim.

## Priority group E — PIR context input

### E1. PIR State Timing

Measure:
- rising timestamp
- falling timestamp
- high duration
- repeated activation spacing

Treat PIR as coarse event/context detection, not precision distance or velocity sensing.

### E2. Event-Gated Capture

Use PIR only to gate when a different channel is recorded, e.g. begin a bounded A0 capture after motion is detected.

## Priority group F — LED/PWM output

### F1. PWM Step Response in the Digital Chain

Measure command generation timing and quantization only.

### F2. State Indicator Integrity

Use LED state as a visible mirror of a digital internal state and compare command timestamps with serial evidence.

Do not claim optical calibration without a light sensor and calibration.

## Priority group G — MCU ↔ Host paired numerical experiments

### G1. Recurrence Step Divergence

Arduino emits each recurrence term/state; host recomputes with float32, float64 and high precision.

Goal: identify the iteration where paths begin to diverge materially.

### G2. MCU Library vs High-Precision Oracle

Functions candidates:
- `sinf`
- `cosf`
- `expf`
- `logf`
- `sqrtf`

Host computes high-precision reference across a safe bounded domain.

### G3. Accuracy × Time × Memory Campaign

Each numerical kernel reports:
- result
- elapsed time
- configuration

Host combines with compile-time flash/RAM evidence where available.

## Later hardware-dependent ideas

Only after hardware identification and validation:

- MPU6050 bias → velocity drift → position drift
- encoder angular quantization
- magnetic-field spatial sampling
- multi-sensor timestamp alignment

## Candidate first implementation wave after review

If future review approves implementation, the strongest low-dependency first wave is:

1. Scheduler Jitter & Drift
2. Running Statistics: Welford vs naive
3. Horner vs direct polynomial
4. Threshold vs hysteresis
5. Photogate frequency estimators
6. Serial overhead perturbation
7. Timestamp wraparound semantics
8. MCU ↔ host recurrence divergence

These require little or no additional hardware and extend BetterBoard's existing numerical/timing evidence model cleanly.

## Promotion gate

No candidate above should become canonical until it passes:

- code review
- UNO compile
- upload test
- serial schema validation
- deterministic host check where applicable
- real capture review
- evidence-boundary review
- decision to reject / defer / prototype / canonicalize
