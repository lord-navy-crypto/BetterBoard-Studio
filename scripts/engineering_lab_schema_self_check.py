#!/usr/bin/env python3
"""Fail closed when Engineering Lab catalog and firmware stream schemas diverge."""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "engineering-lab-experiments" / "catalog.json"
FIRMWARE = ROOT / "engineering-lab-experiments" / "firmware"

BEGIN_RE = re.compile(
    r'stream\.begin\(\s*"(?P<id>[^"]+)"\s*,\s*'
    r'[^,]+,\s*"(?P<columns>[^"]+)"\s*,\s*'
    r'"(?P<units>[^"]+)"\s*,',
    re.DOTALL,
)


def fail(message: str) -> None:
    raise SystemExit(f"Engineering Lab schema check failed: {message}")


def main() -> None:
    catalog = json.loads(CATALOG.read_text())
    if len(catalog) != 9:
        fail(f"expected 9 catalog entries, found {len(catalog)}")

    seen_ids: set[str] = set()
    seen_sketches: set[str] = set()

    for entry in catalog:
        experiment_id = entry["id"]
        sketch_name = entry["sketch_name"]
        columns = entry["columns"]
        units = entry["units"]

        if experiment_id in seen_ids:
            fail(f"duplicate experiment id {experiment_id}")
        if sketch_name in seen_sketches:
            fail(f"duplicate sketch {sketch_name}")
        seen_ids.add(experiment_id)
        seen_sketches.add(sketch_name)

        if not columns or columns[0] != "time_us":
            fail(f"{experiment_id}: first column must be time_us")
        if len(columns) != len(units):
            fail(f"{experiment_id}: columns/units length mismatch")
        if entry["primary_observable"] not in columns:
            fail(f"{experiment_id}: primary observable missing from columns")
        if "quality_flags" not in columns:
            fail(f"{experiment_id}: v2 stream must expose quality_flags")
        if units[columns.index("quality_flags")] != "bitmask":
            fail(f"{experiment_id}: quality_flags unit must be bitmask")

        sketch = FIRMWARE / sketch_name / f"{sketch_name}.ino"
        if not sketch.is_file():
            fail(f"missing sketch {sketch.relative_to(ROOT)}")

        source = sketch.read_text()
        match = BEGIN_RE.search(source)
        if not match:
            fail(f"{sketch_name}: could not parse stream.begin schema")
        if match.group("id") != experiment_id:
            fail(
                f"{sketch_name}: firmware id {match.group('id')} != catalog id {experiment_id}"
            )

        firmware_columns = match.group("columns").split(",")
        firmware_units = match.group("units").split(",")
        if firmware_columns != columns:
            fail(
                f"{experiment_id}: firmware columns differ from catalog\n"
                f"  firmware={firmware_columns}\n  catalog={columns}"
            )
        if firmware_units != units:
            fail(
                f"{experiment_id}: firmware units differ from catalog\n"
                f"  firmware={firmware_units}\n  catalog={units}"
            )

    print(f"validated {len(catalog)} Engineering Lab v2 stream schemas")


if __name__ == "__main__":
    main()
