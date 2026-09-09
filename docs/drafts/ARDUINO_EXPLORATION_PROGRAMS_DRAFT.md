# Arduino Exploration Programs — DRAFT ONLY

> Status: DRAFT / NOT IMPLEMENTED / NOT CANONICAL
>
> This file is an idea backlog for future BetterBoard research recipes and Arduino experiments. It is intentionally not production code and should not be registered in the canonical recipe catalog without explicit review, compile/upload validation, and evidence-semantics review.

## Purpose

Explore what an Arduino UNO-class board can itself investigate as a finite-precision computer, timer, sampler, event detector, signal source, and low-voltage experiment controller. The emphasis is not on adding arbitrary demos, but on creating experiments with a clear question, measurable output, and host-side interpretation.

## A. Arduino as a finite-precision computer

### 1. Range Reduction Laboratory

Compare direct trigonometric evaluation with explicitly range-reduced inputs across large angles.

Possible outputs:

- original x
- reduced x
- approximation
- local library comparison
- term count
- cancellation ratio
- execution time

Question: how much numerical reliability is gained by changing the representation of the same mathematical problem?

### 2. Catastrophic Cancellation Library

Candidate expressions:

- `1 - cos(x)` versus `2*sin(x/2)^2`
- `sqrt(x+1)-sqrt(x)` versus rationalized form
- `exp(x)-1` versus a stable small-x recurrence/approximation
- `log(1+x)` versus a small-x series

Question: when do algebraically equivalent forms stop being numerically equivalent?

### 3. Recurrence Stability

Compare mathematically related recurrences with different numerical stability properties.

Possible examples:

- forward versus backward recurrence
- repeated first-order filtering
- iterative square-root/Newton steps

Question: can an apparently harmless iterative rule amplify finite-precision error?

### 4. Summation Order

Compare:

- forward order
- reverse order
- naive accumulation
- Kahan accumulation
- grouped/pairwise approximation where practical

Question: does changing only the addition order change the final MCU result?

### 5. Fixed-Point Design Bench

Compare multiple Q formats, e.g. Q7.8, Q1.14/Q15-like, and float.

Metrics:

- quantization error
- saturation events
- dynamic range
- execution time
- steady-state bias

Question: when is fixed-point a better engineering choice than floating point?

### 6. Overflow and Saturation Laboratory

Compare widened reference arithmetic with:

- unsigned wraparound
- explicit saturation
- bounded/clamped arithmetic

Question: should overflow be treated as modular arithmetic, an error, or a saturation event for a given signal path?

### 7. Accumulated Drift Without Sensors

Integrate a synthetic zero signal with tiny controlled bias/noise.

Pipeline:

`bias/noise → first integration → second integration`

Question: how can tiny systematic errors become large state drift?

### 8. Iterative Solver Convergence

Candidate bounded problems:

- Newton-Raphson square root
- fixed-point root iteration
- simple bisection

Metrics:

- iterations
- residual
- stop rule
- host-reference error
- false convergence

Question: is a satisfied stopping rule equivalent to a correct answer?

### 9. Polynomial Evaluation

Compare direct powers against Horner's method.

Question: how do operation count and numerical error change when the polynomial is represented differently?

### 10. Lookup Table vs Runtime Computation

Compare:

- `sinf()`/calculation
- sparse lookup table
- nearest-neighbor lookup
- linear interpolation

Metrics:

- memory
- execution time
- error

Question: what is the speed-memory-accuracy tradeoff on a small MCU?

## B. Arduino as a time-measurement instrument

### 11. `micros()` Resolution Study

Request repeated intervals and record actual timestamp differences.

Metrics:

- unique interval values
- minimum step
- mean interval
- jitter

Question: what temporal resolution is actually observable on the board?

### 12. Scheduler Jitter Laboratory

Compare loop styles:

- `delay()`
- `millis()` scheduling
- `micros()` scheduling
- accumulated deadline scheduling (`next += period`)

Question: which scheduling method minimizes drift and jitter?

### 13. Timing Drift Study

Run a bounded repeated timer experiment and compare host elapsed time with MCU elapsed time.

Question: how does local MCU clock time diverge from host-observed wall time over a longer run?

### 14. Serial Blocking Effect

Compare loop timing with:

- no serial output
- compact serial output
- verbose serial output

Question: how much can evidence logging perturb the experiment being measured?

### 15. Interrupt Latency / Scheduling Interaction

Use a safe manual/low-frequency digital event source to compare foreground loop timing and interrupt event timestamps.

Question: when an asynchronous event arrives, how much does normal loop work influence when it is processed?

### 16. Timer Wraparound Correctness

Simulate near-wrap `uint32_t` timestamp values rather than waiting for real wraparound.

Compare:

- correct unsigned subtraction
- naive absolute comparisons

Question: why is modular timestamp arithmetic necessary?

## C. Arduino as a sampler

### 17. Sampling Rate Accuracy

Request a nominal sampling rate and report:

- requested interval
- actual timestamps
- observed rate
- jitter percentiles on host

Question: does a nominal 50 Hz acquisition actually behave like 50 Hz?

### 18. Aliasing Laboratory

Use a deterministic synthetic waveform and sample at multiple rates.

Question: how can a correctly sampled set of values imply the wrong underlying frequency?

### 19. Sample-and-Hold Representation

Compare continuously defined synthetic input with sampled values and reconstructed piecewise-constant or linearly interpolated values on the host.

Question: how much information is lost between continuous concept and discrete representation?

### 20. Downsampling Laboratory

Acquire once at the finest practical rate, then derive 2x/4x/8x downsampled series.

Metrics:

- mean shift
- derivative sensitivity
- integral sensitivity
- apparent peak shift

Question: which derived quantities are most sensitive to sampling density?

### 21. Window Length Effects

Compute running mean/std over different window sizes.

Question: how does statistical stability trade against response time?

### 22. Moving Average vs EMA vs Median

Use the same synthetic or real analog source.

Metrics:

- noise reduction
- step lag
- outlier response
- computational cost

Question: which filter is preferable for different noise structures?

## D. Arduino as an ADC / quantization laboratory

### 23. ADC Code Stability

Repeat readings of a fixed or slowly varying known-safe analog input.

Metrics:

- histogram
- mean
- standard deviation
- peak-to-peak
- repeated-code probability

Question: how stable is the raw acquisition path before any algorithm touches it?

### 24. Artificial Bit-Depth Reduction

Requantize 10-bit ADC values into 8/6/4/2-bit representations.

Question: how does decreasing representation precision affect error and visible response?

### 25. Rounding vs Truncation

Compare integer conversion policies when mapping ADC to PWM or scaled values.

Question: does rounding systematically improve representation error relative to truncation?

### 26. Dither / Error-Diffusion Concept

For a slow LED/PWM demonstration, compare ordinary quantization with bounded temporal error accumulation/dithering.

Question: can time-domain variation represent an average value between discrete output levels?

Boundary: LED brightness is not calibrated optical power and human perception is nonlinear.

### 27. ADC Threshold Chatter

Map noisy analog input to a binary state.

Compare:

- single threshold
- hysteresis thresholds
- stable-window decision

Question: why can a tiny input fluctuation produce many logical state transitions?

### 28. Nominal Voltage vs Calibration

Compare raw ADC counts, nominal `5/1023` conversion, and an externally supplied calibration relationship when available.

Question: what is the difference between representation conversion and actual calibration?

## E. Arduino as a digital event instrument

### 29. Switch Bounce Characterization

Record raw edge stream from a push switch.

Metrics:

- edge count
- bounce duration
- accepted transition time under several debounce rules

Question: what is a single "event" when the physical switch produces many electrical transitions?

### 30. Debounce Algorithm Comparison

Candidate rules:

- fixed dead time
- stable-window confirmation
- sampled majority vote

Question: how do latency and false transitions trade against each other?

### 31. Photogate Period Estimation

Compare frequency estimators:

- one-period reciprocal
- average of N periods
- elapsed time over N events

Question: which estimator is less noisy at low event rates?

### 32. Polling vs Interrupt Counting

At benign manually generated/low-frequency events, compare event capture by polling and interrupt handling.

Question: under what conditions can polling miss events?

### 33. Event Coalescing Study

Use a sampling loop that reports event counts since the previous row.

Question: how can multiple physical events become one sampled observation?

### 34. Event Timestamp Alignment

Record switch, PIR, and photogate events on a shared MCU clock.

Question: how should heterogeneous event sources be aligned before comparison?

## F. Arduino as a signal source

### 35. PWM Duty-Cycle Laboratory

Generate multiple PWM duty cycles and record requested command values.

Optional loopback: feed a safely conditioned output into an analog measurement path only where the hardware setup is known and appropriate.

Question: what does an 8-bit actuator command actually represent?

### 36. Step-Response Stimulus

Generate controlled LED/PWM step commands for studying downstream filter/measurement response.

Question: what can a known step input reveal about lag and smoothing?

### 37. Pulse Train Generator

Generate a bounded low-frequency pulse train for validating photogate/event-processing software through a digital loopback or second board later.

Question: can the measurement pipeline recover a known event cadence?

### 38. Synthetic Waveform Source

Generate numeric sine/square/ramp samples over Serial without physical output.

Question: can BetterBoard validate the entire data/analysis path independently of sensor hardware?

## G. Arduino as an analog/digital interaction laboratory

### 39. Potentiometer → PWM Transfer Function

Pipeline:

`ADC → normalization → mapping → PWM`

Compare:

- truncation
- rounding
- nonlinear mapping
- hysteresis/deadband

Question: how does a digital representation chain reshape a human-controlled analog input?

### 40. Potentiometer → Numeric Parameter

Map the potentiometer to:

- x for Taylor evaluation
- filter alpha
- sample period
- threshold

Question: how does physical human input alter a numerical algorithm in real time?

### 41. Switch as Experiment Marker

Use a switch to insert trial markers into the serial evidence stream.

Question: can manual experimental interventions be preserved in the same timestamped record as measurements?

### 42. PIR as Context Channel

Record PIR state alongside another measurement.

Question: how can coarse contextual events be kept separate from the primary quantitative channel?

Boundary: PIR is an event detector, not a precision distance or motion-speed instrument.

## H. Arduino as a small statistics engine

### 43. Welford Variance vs Naive Variance

Compare online Welford mean/variance with sum/sum-of-squares estimation.

Question: which online estimator is numerically more stable?

### 44. Online Histogram

Maintain a bounded histogram of ADC codes or timing intervals.

Question: how much summary evidence can be computed on-device without storing every sample?

### 45. Running Min/Max/Mean/Std

Compare device-side summary with host recomputation from raw rows.

Question: can host-side verification detect implementation mistakes in embedded statistics?

### 46. Percentile Approximation Concept

Explore small-memory approximate quantile methods only as a later research idea.

Question: what statistics can be estimated when the MCU cannot retain the full dataset?

## I. Arduino as a control-system computation platform

### 47. Open-Loop Mapping Bench

Map input setpoint to PWM command and measure command behavior without claiming plant control.

### 48. P/PI/PID Numerical Kernel Bench

First study the controller arithmetic against a synthetic plant or bounded numerical model before attaching any actuator.

Metrics:

- setpoint
- process value
- output
- integral term
- saturation
- computation time

Question: what numerical problems appear in discrete controller arithmetic?

### 49. Integral Windup Demonstration

Use a synthetic bounded plant/model to compare integral accumulation with and without anti-windup.

Question: why can controller state continue growing while the actuator is saturated?

### 50. Derivative Noise Sensitivity

Feed controlled synthetic noise into a numerical controller model.

Question: why is a derivative term sensitive to measurement noise and sampling interval?

## J. Arduino as a data-integrity test platform

### 51. Sequence Number / Missing Row Detection

Emit monotonically increasing sequence IDs.

Host checks:

- missing IDs
- duplicates
- reorder

Question: did the transport preserve every produced measurement row?

### 52. Timestamp Monotonicity

Emit timestamp and sequence together.

Question: can the host distinguish device-time issues from transport delays?

### 53. Checksum / CRC Experiment

Add a simple checksum or CRC to bounded messages.

Question: how can transport corruption be detected instead of silently accepted?

### 54. Binary vs ASCII Transport Benchmark

Future advanced comparison:

- human-readable CSV
- compact binary records

Metrics:

- throughput
- CPU time
- serial bandwidth
- decoding complexity

Question: when does readable evidence become too expensive for the transport link?

## K. Arduino + host paired experiments

### 55. MCU vs NumPy float32 vs float64 vs mpmath

Run the same mathematical kernel on four arithmetic environments.

Question: which discrepancies arise from algorithm choice, and which from arithmetic precision/platform?

### 56. MCU/Host Cross-Validation

Arduino emits raw intermediate states; host recomputes the same recurrence step-by-step.

Question: at which iteration does the MCU path first diverge materially from the host path?

### 57. Execution Time vs Accuracy Surface

Sweep a parameter such as Taylor terms, filter window, or integration resolution.

Host builds a two-axis tradeoff:

`accuracy ↔ execution cost`

Question: where is the useful engineering compromise?

### 58. Resource Budget vs Accuracy

Compare flash/RAM use and result quality across firmware variants.

Question: how much numerical reliability costs memory on the target board?

### 59. Replicate-Aware Embedded Campaigns

Repeat the same experiment multiple times and preserve run IDs.

Question: which variation is deterministic arithmetic and which comes from measurement/timing variability?

## L. Future hardware-enabled ideas after specific modules are validated

### 60. Accelerometer Bias → Velocity Drift → Position Drift

Requires a validated accelerometer path (e.g. MPU6050 or ADXL345) before promotion.

Pipeline:

`acceleration bias → integration → velocity → second integration → position`

Question: why can a tiny sensor bias dominate double integration?

### 61. Static Gravity Magnitude Check

With a validated accelerometer, compare measured rest magnitude against approximately 1 g as a qualitative sensor sanity check.

Boundary: this is not precision accelerometer calibration by itself.

### 62. Rotation / Encoder Quantization

With a validated encoder, compare discrete counts with inferred angle and speed.

Question: how does finite angular resolution propagate into velocity estimates?

### 63. Magnetic Field Sampling

With a validated magnetic sensor, investigate spatial sampling density, background subtraction, repeatability, and gradient estimation.

Boundary: sensor calibration and geometry must remain explicit.

## M. Possible BetterBoard program families

Instead of exposing dozens of isolated sketches, future research recipes could be grouped into reusable families:

### Numerical Kernel Lab

- Taylor / range reduction
- cancellation
- summation
- fixed point
- overflow
- iterative solvers
- polynomial evaluation

### Timing Lab

- scheduler jitter
- `micros()` resolution
- serial perturbation
- event timing
- wraparound

### Sampling Lab

- aliasing
- downsampling
- window length
- filtering

### Quantization Lab

- ADC bit depth
- rounding/truncation
- PWM mapping
- threshold/hysteresis

### Event Lab

- switch bounce
- debounce
- photogate
- polling vs interrupts
- event coalescing

### Embedded Statistics Lab

- Welford variance
- histogram
- online summaries

### Embedded Control Numerics Lab

- P/PI/PID arithmetic
- windup
- derivative noise
- saturation

### Data Integrity Lab

- sequence IDs
- timestamps
- CRC/checksum
- ASCII vs binary transport

## N. Draft priority candidates

If later reviewed for implementation, a sensible first set would be:

1. Welford vs naive variance
2. scheduler jitter / deadline drift
3. polynomial Horner vs direct powers
4. lookup/interpolation vs direct computation
5. sample-rate / aliasing expansion
6. threshold vs hysteresis
7. photogate frequency estimator comparison
8. serial-overhead timing perturbation
9. MCU-host step-by-step recurrence cross-check
10. execution-time vs accuracy campaign

These need little or no new hardware and extend BetterBoard's existing Numerical Bench naturally.

## Review boundary

Before any item becomes a real recipe, review:

- scientific question
- required hardware
- board limitations
- exact output schema
- independent reference strategy
- whether the MCU measurement perturbs the phenomenon
- data-loss/transport semantics
- unit/calibration assumptions
- compile/upload test
- host analyzer test
- canonical vs research status
