# Engineering Lab v2 Batch Sequence

The enhancement sequence is intentionally ordered so later scientific features are built on trustworthy acquisition evidence.

1. **Observables** — enrich what is measured without hiding raw data. Started in Batch 1.
2. **Quality** — validity, timing diagnostics, calibration/configuration provenance.
3. **Synchronization** — quantify timing relationships between sensors.
4. **Reproducibility** — run identity, schema/version identity, configuration fingerprints, deterministic fixtures.
5. **Experiment depth** — experiment-specific diagnostics such as photogate jitter, ADC quantization context, HX711 settling evidence, INA219 integration timing, and environmental baselines.
6. **Model bridge** — improve Engineering Lab ingestion/comparison interfaces only after the acquisition contract is stable.

Skipping directly to sophisticated model inference would make the system look more advanced while leaving its evidence chain weaker. v2 takes the opposite approach.
