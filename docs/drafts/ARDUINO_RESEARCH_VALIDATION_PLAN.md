# Arduino Research Validation Plan — DRAFT ONLY

> Status: DRAFT / PREPARATION ONLY / NOT IMPLEMENTED / NOT CANONICAL

This document prepares a common validation gate for future Arduino research experiments in BetterBoard.

## Stage 0 — scientific definition

Before code exists, define:

- research question
- quantity under test
- independent reference if any
- known limitations
- hardware assumptions
- exact evidence claims that are allowed
- claims that are explicitly not allowed

## Stage 1 — static firmware review

Check:

- bounded loops
- explicit pin configuration
- safe low-voltage assumptions only
- no hidden calibration claims
- no signed-overflow dependence where C/C++ semantics are undefined
- wrap-safe unsigned timing arithmetic
- ISR shared state marked `volatile`
- atomic copying of multi-byte ISR state where required
- no expensive/blocking serial operations inside ISR
- explicit schema/version metadata

## Stage 2 — UNO compile

Target initially:
`arduino:avr:uno`

Record:

- compiler result
- flash usage
- global RAM usage
- warnings
- required libraries

A compile pass does not imply scientific validity.

## Stage 3 — upload / protocol smoke test

Verify:

- correct USB serial port
- firmware starts predictably
- schema metadata appears once or as documented
- command parser responds if interactive
- no malformed numeric row under ordinary use
- start/stop semantics are explicit

## Stage 4 — deterministic software reference

Where possible, generate known deterministic inputs and compare MCU output with host calculations.

Examples:

- analytic integral reference
- exact rational summation reference
- host high-precision polynomial result
- simulated timestamp wraparound
- synthetic sine with known frequency

## Stage 5 — real hardware capture

Only for experiments needing hardware.

Review:

- stable electrical connection
- realistic event rate
- enough rows for the intended metric
- missing-row evidence
- timestamp monotonicity
- repeated captures

## Stage 6 — evidence package

Preserve:

- raw serial capture
- parsed CSV
- board profile
- firmware hash
- recipe/configuration
- host analyzer version
- analysis outputs
- warnings/boundaries

## Stage 7 — replicate check

For stochastic or measurement experiments, use repeated trials and report run-to-run variation rather than one favorable capture.

## Stage 8 — promotion decision

Possible outcomes:

- Reject
- Defer
- Keep Research-only
- Promote to Canonical

Canonical promotion should require both product usefulness and scientific clarity, not merely successful compilation.

## Suggested acceptance questions

For every candidate experiment:

1. Does it demonstrate a distinct phenomenon already missing from BetterBoard?
2. Does it need new hardware, and is that hardware already validated?
3. Is the MCU the instrument, the object under test, or both?
4. Is there an independent host reference?
5. Can raw evidence be preserved unchanged?
6. Can zero / missing / rejected / coalesced events be distinguished?
7. Can the result be reproduced from saved configuration?
8. Is the interpretation narrower than the evidence actually supports?
