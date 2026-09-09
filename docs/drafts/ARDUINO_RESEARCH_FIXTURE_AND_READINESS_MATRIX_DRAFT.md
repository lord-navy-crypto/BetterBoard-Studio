# Arduino Research Fixture & Readiness Matrix — DRAFT ONLY

> Status: DRAFT / PREPARATION ONLY / NOT IMPLEMENTED / NOT CANONICAL
>
> Purpose: map candidate experiments to the hardware already available or already discussed, so future implementation can distinguish software-only studies from experiments that require validated sensors.

## Fixture A — Bare UNO Numerical Rig

**Hardware**
- Arduino UNO-compatible board
- USB data cable
- host computer

**Suitable candidate studies**
- Taylor / cancellation
- Horner polynomial evaluation
- lookup table vs direct calculation
- Kahan / summation order
- Welford vs naive variance
- fixed-point vs float
- overflow / saturation
- timestamp wraparound
- scheduler jitter
- serial overhead
- recurrence trace
- execution-time campaigns

**Readiness**
Highest. No external sensor calibration is required.

## Fixture B — Analog Control Rig

**Hardware**
- UNO
- potentiometer on a validated analog input, nominally A0 in current examples
- optional LED/PWM output

**Suitable candidate studies**
- ADC stability
- quantization reduction
- threshold vs hysteresis
- EMA / moving-average / median comparison
- ADC to PWM transfer
- analog noise histograms
- sample-rate / filter tradeoffs

**Boundary**
ADC counts are directly observed. Voltage remains nominal unless independently calibrated.

## Fixture C — Event Timing Rig

**Hardware**
- UNO
- validated photogate / optical event module on an interrupt-capable digital input

**Suitable candidate studies**
- event period / frequency
- latest-period vs multi-cycle estimators
- polling vs interrupt
- event coalescing
- rejected-edge evidence
- timestamp-resolution studies

**Boundary**
Timer resolution, trigger behavior, sensor geometry, and physical source stability are separate effects.

## Fixture D — Switch / Digital Decision Rig

**Hardware**
- UNO
- push button / switch using a known digital wiring configuration

**Suitable candidate studies**
- contact bounce
- debounce algorithms
- event latency
- state-machine sequencing
- manual experiment markers

## Fixture E — Context Sensor Rig

**Hardware**
- UNO
- PIR module with validated digital connection

**Suitable candidate studies**
- rise/fall timing
- high-duration intervals
- event-context tagging
- multi-sensor timestamp alignment

**Boundary**
PIR output is an event/state signal, not a calibrated distance or motion magnitude.

## Fixture F — I2C Motion Rig — HOLD

**Candidate hardware**
- MPU6050 or other positively identified I2C IMU

**Status**
Hold until the module and I2C electrical path are consistently validated.

**Future studies only after validation**
- accelerometer bias
- noise / Allan-style exploratory statistics
- single integration to velocity drift
- double integration to position drift
- sampling-rate dependence
- filter and bias-removal comparisons

## Fixture G — Magnetic Field Rig — CONDITIONAL

**Candidate hardware**
Confirmed magnetic-field sensor such as the already-defined MLX90393 path.

**Future studies**
- background stability
- repeated position measurements
- spatial gradient
- sampling spacing
- field-model residuals

**Boundary**
Requires confirmed sensor identity and calibration/provenance appropriate to the scientific claim.

## Readiness matrix

| Study | Bare UNO | Pot | Photogate | Switch | PIR | I2C IMU | External calibration needed? |
|---|---:|---:|---:|---:|---:|---:|---|
| Scheduler jitter | yes | no | no | no | no | no | no |
| Serial overhead | yes | no | no | no | no | no | no |
| Welford variance | yes | optional | no | no | no | no | no for synthetic input |
| Horner polynomial | yes | no | no | no | no | no | no |
| LUT vs direct | yes | no | no | no | no | no | no |
| Threshold vs hysteresis | yes | yes | no | no | no | no | no for ADC-count comparison |
| Photogate estimators | yes | no | yes | no | no | no | yes for absolute physical-frequency accuracy |
| Debounce | yes | no | no | yes | no | no | no |
| PIR timing | yes | no | no | no | yes | no | no for digital timing only |
| Recurrence divergence | yes | no | no | no | no | no | no |
| IMU drift | yes | no | no | no | no | yes | yes for stronger physical claims |

## Proposed readiness labels

- **Software-ready** — UNO + USB only; can be implemented without waiting for external hardware.
- **Hardware-ready** — required module has already been shown to work consistently in the intended wiring.
- **Hardware-conditional** — module is known but the exact measurement chain still needs validation.
- **Hold** — do not implement hardware-dependent interpretation yet.

## Suggested preparation order

1. Bare UNO numerical/timing studies.
2. Potentiometer/ADC studies.
3. Switch and photogate event studies.
4. Multi-channel combinations.
5. I2C motion work only after the bus is stable.
6. Magnetic model-validation work only with confirmed sensor and explicit calibration/evidence boundaries.

## Non-production rule

This matrix is an implementation-planning aid only. It does not authorize firmware creation, recipe registration, UI wiring, or canonical promotion.
