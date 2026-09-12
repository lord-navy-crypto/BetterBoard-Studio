# BetterBoard ↔ Physical Lab Measurement Bridge

> **Compatibility note:** this document describes the legacy `physical_lab_bridge.json` / `physical_lab_v1.csv` path. New integration work uses **LabBridge v1** (`docs/LABBRIDGE_V1.md`), with the corrected roles: **BetterBoard = real-world ingress**, **Engineering Lab = scientific computation/evidence core**, and **OpenPenguin = local AI advisory layer**. The legacy export remains supported so existing measurement sessions do not break.

BetterBoard is the physical-computing front end. The legacy Physical Lab path is retained as a compatibility importer/exporter while Engineering Lab becomes the primary scientific evidence environment.

## Current export

Each numeric recipe can create:

```text
<recipe>-<UTC timestamp>/
├── data.csv
├── metadata.json
├── physical_lab_v1.csv
└── physical_lab_bridge.json
```

### `data.csv`

The complete schema from the firmware recipe. Example MLX90393:

```csv
time_us,Bx_uT,By_uT,Bz_uT,primary_uT
```

### `metadata.json`

Records recipe, board profile, port, baud, columns, source units, sample rate where known, sample count, firmware SHA-256, intended legacy Physical Lab consumers, and the scientific boundary.

### `physical_lab_v1.csv`

Compatibility export for the legacy Physical Lab serial-capture contract:

```csv
timestamp,value
```

BetterBoard uses host timestamps and the final numeric field from each canonical firmware line as `value`. This intentionally matches the existing legacy rule that the last comma-separated numeric field is the primary observable.

### `physical_lab_bridge.json`

Declares the full dataset, compatibility dataset, primary observable, source units, and intended legacy Physical Lab targets.

## Legacy compatibility notes

The legacy canonical serial-capture implementation:

- accepts macOS `/dev/cu.*` and `/dev/tty.*` serial devices;
- clamps capture duration to 1–300 seconds;
- writes `timestamp,value`;
- currently parses the final comma-separated numeric field as the observable;
- registers canonical Measurement Evidence under the `physical-lab-measurement-v1` contract;
- treats calibration status, sensor accuracy, traceability and experimental validation as separate responsibilities.

BetterBoard preserves that contract while retaining all channels. New schema-aware interchange should use `labbridge.measurement-asset/v1` and Engineering Lab.

## Unit boundary

Do not silently force units through a legacy unit allow-list. BetterBoard preserves source units explicitly in metadata and LabBridge packets; Engineering Lab is responsible for any explicit, auditable unit conversion used in scientific analysis.
