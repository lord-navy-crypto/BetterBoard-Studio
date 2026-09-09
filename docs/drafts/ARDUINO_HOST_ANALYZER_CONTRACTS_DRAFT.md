# Arduino Host Analyzer Contracts — DRAFT ONLY

> Status: DRAFT / PREPARATION ONLY / NOT IMPLEMENTED / NOT CANONICAL
>
> Goal: define what a future BetterBoard analyzer must consume and emit before any production integration is attempted.

## Common analyzer contract

Each future analyzer should declare:

- analyzer id and version;
- accepted schema id(s);
- required columns;
- optional columns;
- expected units;
- whether an independent reference is required;
- deterministic outputs;
- warnings / scientific boundaries;
- summary metrics;
- row-level derived columns where appropriate.

Recommended output bundle:

```text
analysis/<analyzer-id>/
├── summary.json
├── derived.csv        # optional
├── report.md
└── provenance.json
```

Raw capture must never be overwritten.

## 1. scheduler_jitter_v1

**Consumes**
`seq,run_id,method_id,target_period_us,deadline_us,actual_us,interval_us,jitter_us,cumulative_phase_error_us`

**Produces**
- observed mean period
- frequency estimate
- interval standard deviation
- p50/p95/p99 absolute jitter
- maximum positive/negative jitter
- cumulative phase error
- missed deadline count
- longest missed-deadline run

**Warnings**
- host serial timing is not MCU timestamp timing;
- serial output can perturb loop timing;
- oscillator calibration is not established automatically.

## 2. serial_overhead_v1

**Consumes**
`seq,run_id,mode_id,payload_bytes,loop_elapsed_us,compute_elapsed_us,serial_elapsed_us`

**Produces**
- per-mode mean/p95 loop time
- serial fraction of loop time
- payload-size vs serial-time fit for descriptive use
- deadline impact if target period is supplied

## 3. running_variance_v1

**Consumes**
`seq,run_id,dataset_id,n,value,naive_mean,naive_variance,welford_mean,welford_variance`

**Reference**
Replay the exact emitted `value` sequence using host float64 plus optional arbitrary precision.

**Produces**
- mean error per method
- variance error per method
- first n where one method exceeds a declared tolerance
- maximum discrepancy
- negative-variance or non-finite flags if observed

## 4. polynomial_evaluation_v1

**Consumes**
`seq,run_id,poly_id,method_id,x,result,elapsed_us,finite`

**Reference**
High-precision polynomial evaluation from exactly declared coefficients.

**Produces**
- absolute / relative / normalized error
- worst x
- error distribution by method
- timing distribution by method
- accuracy-time Pareto table

## 5. lookup_vs_direct_v1

**Consumes**
A declared function id, method id, x, result, elapsed time, and table configuration metadata.

**Produces**
- max/RMS error
- timing summary
- table size
- interpolation method comparison
- accuracy-time-memory tradeoff table

## 6. threshold_hysteresis_v1

**Consumes**
`seq,run_id,time_us,adc_raw,normalized,single_state,hysteresis_state,single_transition_count,hysteresis_transition_count`

**Produces**
- transition count per method
- chatter events inside a declared threshold neighborhood
- dwell-time summaries
- switching points observed in each direction

**Boundary**
This is a decision-rule comparison, not calibration of the analog source.

## 7. photogate_estimators_v1

**Consumes**
`event_index,event_us,period_us,f_latest_hz,f_mean_period_hz,f_multicycle_hz,rejected_edges`

**Produces**
- mean/std/CV for each estimator
- estimator disagreement
- rejected-edge statistics
- stability versus averaging window

**Reference**
No exact physical frequency is assumed unless an independently characterized source is provided. Without one, the analysis is repeatability/consistency only.

## 8. timestamp_wrap_v1

**Consumes**
`seq,before_us,after_us,unsigned_delta_us,naive_signed_delta_us,expected_delta_us`

**Produces**
- pass/fail per arithmetic strategy against injected expected delta
- wrap boundary cases
- failure count

## 9. recurrence_trace_v1

**Consumes**
`run_id,step_index,x,state_a,state_b,term,partial_result`

**Reference**
Replay same recurrence with:
- explicit float32 emulation where practical;
- float64;
- arbitrary precision.

**Produces**
- first divergence above tolerance
- maximum state discrepancy
- final-result discrepancy
- stepwise error curve

## 10. embedded_tradeoff_v1

**Consumes**
Joined evidence from numerical analyzer + compile resource metrics.

**Produces**
- error
- execution time
- flash bytes
- RAM bytes
- non-dominated method set

It must not collapse these dimensions into one unexplained score.

## Analyzer registry draft

A possible future registry entry:

```json
{
  "id": "scheduler_jitter_v1",
  "schema": ["betterboard.scheduler-jitter/1"],
  "requires": ["target_period_us", "actual_us", "interval_us"],
  "units": {"target_period_us": "us", "actual_us": "us", "interval_us": "us"},
  "reference": "none",
  "outputs": ["summary.json", "report.md"]
}
```

This is illustrative only; no registry format is approved yet.

## Preparation rule

Analyzer design should come before UI integration. A future UI should call a stable analyzer contract, not embed scientific calculations directly into React components.
