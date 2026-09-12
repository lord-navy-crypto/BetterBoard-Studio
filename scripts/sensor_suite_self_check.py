#!/usr/bin/env python3
from __future__ import annotations

import json
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CATALOG_DIR = ROOT / "sensor-suite"

REQUIRED_KEYS = {
    "id", "title", "category", "description", "sketch_name", "firmware_path",
    "capture_mode", "baud", "columns", "units", "primary_column",
    "sample_rate_hz", "required_libraries", "hardware", "physical_lab_targets",
    "notes", "boundary"
}


def fail(message: str) -> None:
    raise SystemExit(f"Sensor Suite self-check FAILED: {message}")


def load_all_entries() -> tuple[list[dict], list[Path]]:
    paths = sorted(CATALOG_DIR.glob("catalog*.json"))
    if not paths:
        fail("no catalog*.json files found")
    entries: list[dict] = []
    for path in paths:
        data = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(data, list):
            fail(f"{path.name} must be a JSON array")
        entries.extend(data)
    return entries, paths


def main() -> int:
    entries, catalogs = load_all_entries()
    if not entries:
        fail("catalogs contain no recipes")

    ids: set[str] = set()
    sketch_names: set[str] = set()
    for entry in entries:
        missing = REQUIRED_KEYS - set(entry)
        if missing:
            fail(f"{entry.get('id', '<unknown>')} missing keys: {sorted(missing)}")
        rid = str(entry["id"])
        if rid in ids:
            fail(f"duplicate recipe id {rid}")
        ids.add(rid)

        sketch = str(entry["sketch_name"])
        if sketch in sketch_names:
            fail(f"duplicate sketch_name {sketch}")
        sketch_names.add(sketch)

        columns = entry["columns"]
        units = entry["units"]
        if len(columns) != len(units):
            fail(f"{rid}: columns/units length mismatch")
        primary = entry.get("primary_column")
        if primary is not None and primary not in columns:
            fail(f"{rid}: primary column is not present in columns")
        if entry.get("capture_mode") == "numeric" and not columns:
            fail(f"{rid}: numeric recipe has no columns")

        firmware = ROOT / str(entry["firmware_path"])
        if not firmware.is_file():
            fail(f"{rid}: missing firmware {firmware}")
        source = firmware.read_text(encoding="utf-8")
        if "void setup()" not in source or "void loop()" not in source:
            fail(f"{rid}: firmware is missing setup()/loop()")
        if "Serial.begin(115200)" not in source:
            fail(f"{rid}: firmware does not use the catalog baud rate")
        if not str(entry.get("boundary", "")).strip():
            fail(f"{rid}: scientific boundary is empty")

    import install_sensor_suite
    with tempfile.TemporaryDirectory() as tmp:
        written = install_sensor_suite.install(Path(tmp))
        if len(written) != len(entries):
            fail("installer wrote the wrong number of recipes")
        for path in written:
            wrapper = json.loads(path.read_text(encoding="utf-8"))
            if set(wrapper) != {"spec", "source"}:
                fail(f"{path.name}: invalid user recipe wrapper")
            if not wrapper["spec"].get("user_defined"):
                fail(f"{path.name}: user_defined flag was not set")
            if not wrapper["source"].strip():
                fail(f"{path.name}: source is empty")

    print(f"Sensor Suite self-check PASS: {len(entries)} recipes across {len(catalogs)} catalogs")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
