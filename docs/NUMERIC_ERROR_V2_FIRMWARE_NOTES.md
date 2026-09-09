# Numeric Error V2 firmware notes

The following V2 research sketches are intentionally not yet canonical recipes. They exist to fix evidence-semantics issues identified during review.

## NumericError_PhotogateTimingV2

- Uses `lastAcceptedEdgeUs`, not the most recent raw edge, as the timing baseline.
- Close rejected edges no longer shift the accepted period baseline.
- Reports rejected-edge evidence explicitly.

Schema:

`accepted_event_index,event_us,period_us,frequency_hz,rejected_since_last,total_rejected`

## NumericError_MultiSensorEventLabV2

- Preserves total accepted photogate event count.
- Reports accepted events since the previous 50 Hz sample.
- Reports whether multiple accepted events were coalesced into one sampled row.
- Reports rejected-edge counts.

This prevents `0` or one latest period from being mistaken for complete event history.

## NumericError_SummationV2

- Encodes the repeated increment as exact integer numerator/denominator metadata.
- Host software can therefore construct an independent high-precision reference.
- Adds naive and Kahan execution-time evidence.
- Reports MCU float/double sizes and `FLT_EPSILON`.

These V2 sketches should be compiled and exercised on the real UNO before replacing the first research versions or entering the canonical recipe catalog.
