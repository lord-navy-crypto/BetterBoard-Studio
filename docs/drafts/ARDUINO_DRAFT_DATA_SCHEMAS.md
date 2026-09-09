# Arduino Research Data Schemas — DRAFT ONLY

> Status: DRAFT / PREPARATION ONLY / NOT IMPLEMENTED / NOT CANONICAL

This file sketches possible measurement schemas for future BetterBoard Arduino research experiments. The purpose is to make later firmware/host/UI work compatible before any implementation begins.

## General framing

Control/metadata lines should remain distinguishable from numeric evidence rows. A possible convention is:

```text
#SCHEMA,<schema-id>
#COLUMNS,<comma-separated fields>
#UNITS,<comma-separated units>
#BOUNDARY,<scientific boundary note>
```

Numeric rows should preserve stable field order and an explicit sequence number.

## Common provenance fields

Potential common fields:

`seq,run_id,time_us,source_id`

Optional experiment fields may follow.

## Scheduler jitter

Schema id:
`betterboard.scheduler-jitter.draft-v1`

Fields:
`seq,run_id,time_us,target_period_us,scheduled_deadline_us,actual_interval_us,jitter_us,deadline_error_us,strategy_id,serial_mode_id,missed_deadline`

## Serial overhead

Schema id:
`betterboard.serial-overhead.draft-v1`

Fields:
`seq,run_id,time_us,mode_id,payload_bytes,loop_interval_us,deadline_error_us,missed_deadline`

## Welford vs naive variance

Schema id:
`betterboard.running-statistics.draft-v1`

Fields:
`seq,n,x,naive_mean,naive_variance,welford_mean,welford_variance,naive_us,welford_us`

Host should provide an independent high-precision/statistically exact reference for deterministic synthetic sequences where possible.

## Horner vs direct polynomial

Schema id:
`betterboard.polynomial-evaluation.draft-v1`

Fields:
`seq,x,direct_value,horner_value,direct_us,horner_us,direct_intermediate_max,horner_intermediate_max`

Host enrichment could add reference/error columns.

## Lookup-table study

Schema id:
`betterboard.lookup-vs-direct.draft-v1`

Fields:
`seq,x,direct_value,nearest_value,linear_value,direct_us,nearest_us,linear_us,table_size`

## Threshold / hysteresis

Schema id:
`betterboard.threshold-hysteresis.draft-v1`

Fields:
`seq,time_us,raw_adc,normalized,plain_state,hysteresis_state,plain_transition_count,hysteresis_transition_count`

## Photogate estimator comparison

Schema id:
`betterboard.photogate-estimators.draft-v1`

Fields:
`seq,event_index,event_us,period_us,single_period_hz,n_period_hz,moving_period_hz,rejected_since_last,total_rejected`

## Debounce comparison

Schema id:
`betterboard.debounce-comparison.draft-v1`

Fields:
`seq,time_us,raw_state,fixed_deadtime_state,stable_window_state,majority_state,raw_edge_count,accepted_transition_count`

## MCU-host recurrence divergence

Schema id:
`betterboard.recurrence-trace.draft-v1`

Fields:
`seq,run_id,iteration,x,state_a,state_b,term,total,finite`

Exact state meaning must be declared per algorithm.

## Fixed-point comparison

Schema id:
`betterboard.fixed-point-study.draft-v1`

Fields:
`seq,step,input,float_state,fixed_raw,fixed_state,abs_diff,saturation_count,float_us,fixed_us,q_fraction_bits`

## Timestamp wraparound

Schema id:
`betterboard.timestamp-wrap.draft-v1`

Fields:
`seq,start_u32,end_u32,unsigned_delta,naive_relation_result,expected_delta`

## Draft schema rules

Before implementation, any proposed schema should answer:

- Are field meanings unambiguous?
- Are units explicit?
- Can missing/no-event be distinguished from numeric zero?
- Is sequence loss detectable?
- Is the reference/oracle field separate from MCU-local evidence?
- Can the host enrich the row without rewriting raw evidence?
- Is schema versioning explicit?
