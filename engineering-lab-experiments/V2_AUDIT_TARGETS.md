# Engineering Lab v2 Audit Targets

Future enhancement reviews should explicitly audit these failure modes:

- timestamp taken substantially before/after the physical acquisition without disclosure;
- multi-sensor rows presented as simultaneous when acquisition is sequential;
- stale sensor value reused without a validity indicator;
- saturation or out-of-range behavior emitted as ordinary data;
- calibration constants changed without capture provenance;
- filtering parameters hidden from downstream reconstruction;
- numerical derivatives computed across irregular intervals without preserving timing;
- integrated quantities accumulated using assumed rather than actual elapsed time;
- coordinate transforms applied without a documented frame convention;
- schema changes that silently reorder established fields.

These are priority enhancement targets because they directly affect whether Engineering Lab can trust and reproduce a measurement-to-model comparison.
