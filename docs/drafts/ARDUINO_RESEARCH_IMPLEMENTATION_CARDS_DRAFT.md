# Arduino Research Implementation Cards — DRAFT ONLY

> Status: DRAFT / PREPARATION ONLY / NOT IMPLEMENTED / NOT CANONICAL
>
> This document converts selected Arduino research ideas into reviewable implementation cards. It is not an authorization to modify production code, register recipes, or merge into `main`.

## Card 1 — Scheduler Jitter & Drift

**Question**
How closely does an Arduino UNO follow a requested periodic schedule over short and long runs?

**Minimum hardware**
Arduino UNO + USB only.

**Candidate methods**
- `delay()` loop
- `millis()` deadline scheduling
- `micros()` deadline scheduling
- optional timer-interrupt implementation later

**Draft outputs**
`seq,run_id,method_id,target_period_us,deadline_us,actual_us,interval_us,jitter_us,cumulative_phase_error_us`

**Host analysis**
- mean interval
- interval standard deviation
- p50/p95/p99 absolute jitter
- maximum lateness
- accumulated phase drift
- missed-deadline count

**Scientific boundary**
USB/serial logging can perturb the schedule. Logging overhead must be measured separately rather than silently treated as MCU clock error.

---

## Card 2 — Serial Overhead Perturbation

**Question**
How much does printing diagnostic data alter loop timing?

**Minimum hardware**
Arduino UNO + USB only.

**Conditions**
- no serial output
- compact numeric CSV
- verbose text
- different baud rates where appropriate

**Draft outputs**
`seq,run_id,mode_id,payload_bytes,loop_elapsed_us,compute_elapsed_us,serial_elapsed_us`

**Host analysis**
Compare timing distributions and deadline miss rates across output modes.

---

## Card 3 — Welford vs Naive Running Variance

**Question**
How do two online variance algorithms differ in finite-precision arithmetic?

**Minimum hardware**
Arduino UNO + USB only; synthetic data first.

**Methods**
- naive `sum` / `sum_of_squares`
- Welford online variance

**Datasets**
- low-offset sequence
- large-offset, small-variation sequence
- deterministic pseudo-random sequence

**Draft outputs**
`seq,run_id,dataset_id,n,value,naive_mean,naive_variance,welford_mean,welford_variance`

**Host oracle**
High-precision or float64 replay of the exact emitted input sequence.

---

## Card 4 — Horner vs Direct Polynomial Evaluation

**Question**
How do algebraically equivalent polynomial evaluation strategies differ in accuracy and execution cost?

**Minimum hardware**
Arduino UNO + USB only.

**Methods**
- direct powers
- Horner form

**Candidate polynomials**
Use bounded, documented coefficient sets chosen to expose cancellation and scaling without overflow.

**Draft outputs**
`seq,run_id,poly_id,method_id,x,result,elapsed_us,finite`

**Host analysis**
- absolute / relative error versus high-precision reference
- execution-time distribution
- worst-case x

---

## Card 5 — Lookup Table vs Runtime Computation

**Question**
What accuracy/speed/memory tradeoff appears when a function is approximated by a lookup table?

**Minimum hardware**
Arduino UNO + USB only.

**Candidate function**
`sin(x)` over a bounded interval.

**Methods**
- `sinf`
- Taylor / range-reduced Taylor
- LUT nearest-neighbor
- LUT linear interpolation

**Metrics**
accuracy, elapsed time, table size, flash/RAM cost.

---

## Card 6 — Threshold vs Hysteresis

**Question**
How does a single threshold compare with hysteresis when an analog input sits near the switching boundary?

**Minimum hardware**
UNO + potentiometer on A0.

**Methods**
- single threshold
- two-threshold hysteresis

**Draft outputs**
`seq,run_id,time_us,adc_raw,normalized,single_state,hysteresis_state,single_transition_count,hysteresis_transition_count`

**Host analysis**
Count chatter transitions and compare state stability around the boundary.

---

## Card 7 — Photogate Frequency Estimator Comparison

**Question**
How stable are different frequency estimators on the same event stream?

**Minimum hardware**
UNO + validated photogate on interrupt-capable input.

**Candidate estimators**
- reciprocal of latest period
- reciprocal of moving-average period
- multi-cycle estimator `(N-1)/(t_N-t_1)`

**Draft outputs**
`event_index,event_us,period_us,f_latest_hz,f_mean_period_hz,f_multicycle_hz,rejected_edges`

**Scientific boundary**
Estimator precision is not the same as physical timing accuracy; sensor geometry, trigger threshold, and clock behavior remain separate uncertainty sources.

---

## Card 8 — Timestamp Wraparound

**Question**
Does timing code remain correct when a 32-bit microsecond timestamp wraps?

**Minimum hardware**
UNO + USB only.

**Preparation strategy**
Prefer a deterministic synthetic wraparound test using injected unsigned timestamp values instead of waiting for real wall-clock wrap.

**Draft outputs**
`seq,before_us,after_us,unsigned_delta_us,naive_signed_delta_us,expected_delta_us`

---

## Card 9 — MCU ↔ Host Recurrence Divergence Trace

**Question**
At which recurrence step do AVR float32 and a higher-precision host reference begin to diverge materially?

**Minimum hardware**
UNO + USB only.

**Candidate kernels**
- Taylor recurrence
- iterative root finder
- recursive filter

**Draft outputs**
`run_id,step_index,x,state_a,state_b,term,partial_result`

**Host analysis**
Replay exactly the same recurrence with float32, float64, and high precision; identify first threshold-crossing divergence.

---

## Card 10 — Accuracy × Time × Memory Campaign

**Question**
Can BetterBoard compare several implementations on three explicit axes rather than only final error?

**Candidate dimensions**
- error versus independent reference
- execution time
- flash / RAM cost from compile output

**Potential result**
A non-dominated tradeoff table rather than a single synthetic score.

## Promotion gate

No card above should become a canonical recipe until it has:

1. reviewed scientific question;
2. stable schema;
3. successful UNO compile;
4. successful upload;
5. captured real output;
6. deterministic host analyzer or explicit reference path;
7. replicate evidence where meaningful;
8. clear limitations and uncertainty boundary;
9. explicit promotion decision.
