# Focused Numeric Error analyzer usage

Run:

```bash
python3 scripts/numeric_error_research_analyzer_v2.py <captured.csv>
```

The analyzer auto-detects supported focused Numeric Error schemas and writes:

```text
numeric-error-research-analysis/
├── summary.json
└── report.md
```

Supported experiment families include ADC stability, requantization, filter lag, finite difference, integration, summation, photogate timing, switch bounce, PWM quantization, PIR timing and the mixed MultiSensor lab.

The analyzer intentionally distinguishes embedded/measured evidence from independent-reference claims. It should eventually be invoked from the BetterBoard Numerical Bench UI instead of requiring terminal use.
