# BetterBoard ↔ Physical Lab Measurement Bridge

BetterBoard is the physical-computing front end. Physical Lab is the scientific interpretation/V&V environment.

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

Records recipe, board profile, port, baud, columns, source units, sample rate where known, sample count, firmware SHA-256, intended Physical Lab consumers, and the scientific boundary.

### `physical_lab_v1.csv`

Compatibility export for the current Physical Lab serial-capture contract:

```csv
timestamp,value
```

BetterBoard uses host timestamps and the final numeric field from each canonical firmware line as `value`. This intentionally matches the existing Physical Lab rule that the last comma-separated numeric field is the primary observable.

### `physical_lab_bridge.json`

Declares the full dataset, compatibility dataset, primary observable, source units, and intended Physical Lab targets.

## Current Physical Lab compatibility notes

The current Physical Lab canonical serial-capture implementation:

- accepts macOS `/dev/cu.*` and `/dev/tty.*` serial devices;
- clamps capture duration to 1–300 seconds;
- writes `timestamp,value`;
- currently parses the final comma-separated numeric field as the observable;
- registers canonical Measurement Evidence under the `physical-lab-measurement-v1` contract;
- treats calibration status, sensor accuracy, traceability and experimental validation as separate responsibilities.

BetterBoard v0.2 preserves that contract while retaining all channels for a future schema-aware Physical Lab importer.

## Unit boundary

Do not silently force units through the current Physical Lab unit allow-list. As of this integration:

- the Physical Lab unit layer supports T/mT/G for magnetic field but does not yet expose uT/µT;
- it does not yet expose acceleration (`m/s²`) or angular speed (`rpm`/`rad/s`).

Therefore BetterBoard preserves source units explicitly in metadata rather than pretending every channel has already been canonicalized by Physical Lab.
