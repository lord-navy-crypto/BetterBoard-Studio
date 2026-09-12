# LabBridge v1 · BetterBoard → Engineering Lab → OpenPenguin

LabBridge v1 replaces the old product-role naming without breaking the existing BetterBoard measurement export.

## System roles

- **BetterBoard** is the **real-world ingress**. It owns board/port identity, firmware identity, serial acquisition, raw measurement channels, source units and acquisition metadata.
- **Engineering Lab** is the **scientific computation and evidence core**. It validates/ingests measurement assets, manages canonical datasets, models, simulations, V&V/UQ, provenance, comparisons, workflows and the Lab Journey.
- **OpenPenguin** is the **local AI advisory layer**. It may explain evidence and propose experiments/actions, but it is not an authoritative measurement source, solver, validation system, or automatic actuator.

The authority direction is intentionally asymmetric:

```text
REAL WORLD
   ↓
BetterBoard measurement evidence
   ↓
Engineering Lab scientific record
   ↓
OpenPenguin interpretation / proposals
```

AI output must never silently overwrite BetterBoard measurements or Engineering Lab solver/evidence state.

## MeasurementAsset v1

An existing BetterBoard measurement directory can be upgraded additively:

```text
<measurement>/
├── data.csv
├── metadata.json
├── physical_lab_v1.csv                 # legacy compatibility
├── physical_lab_bridge.json            # legacy compatibility
└── labbridge_measurement_asset.json    # LabBridge v1
```

Generate the v1 packet with:

```bash
python3 scripts/labbridge_v1_export.py /path/to/measurement-directory
```

The packet uses schema:

```text
labbridge.measurement-asset/v1
```

and contains:

- content-addressed `packet_id` and `content_sha256`;
- SHA-256 of `data.csv` and `metadata.json`;
- BetterBoard product/version and role `real-world-ingress`;
- board profile, serial port, baud rate and firmware SHA-256;
- recipe/acquisition mode/sample rate/recipe parameters;
- channel names, source units and explicit primary observable;
- intended consumer `Engineering Lab` with role `scientific-computation-and-evidence-core`;
- a scientific boundary stating that integrity is not calibration/traceability/validation.

The JSON Schema is stored at:

```text
docs/labbridge/measurement_asset.schema.json
```

## Engineering Lab ingest

Engineering Lab validates the packet fingerprint and, when the referenced `data.csv` bytes are supplied, recomputes the dataset SHA-256 before ingestion. Numeric declared channels are promoted into a canonical project dataset while source units and BetterBoard provenance are retained.

An ingest also appends a `measurement_import` event to the Lab Journey. The Journey is a local append-only SHA-256 hash chain across BetterBoard imports, Engineering Lab work, human annotations/observations/hypotheses/decisions, and OpenPenguin advisories.

## OpenPenguin boundary

Engineering Lab exports a bounded `labbridge.ai-context/v1` packet containing project/dataset/Journey evidence and authority metadata. OpenPenguin may return:

```text
labbridge.ai-suggestion/v1
labbridge.action-proposal/v1
```

An `ActionProposal` must include a target, rationale, expected effect and falsification observable. It is always advisory at this bridge layer. Recording it in the Lab Journey does **not** execute it.

A future approval layer may explicitly transform a human-approved proposal into a new Engineering Lab experiment manifest; that transformation must remain a separate provenance event.

## Legacy bridge

`physical_lab_bridge.json` and `physical_lab_v1.csv` remain supported for compatibility. New integration work should use LabBridge v1 and the corrected product roles above.
