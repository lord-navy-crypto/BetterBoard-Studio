#!/usr/bin/env python3
"""Upgrade an existing BetterBoard measurement session to LabBridge v1.

This is deliberately additive: data.csv, metadata.json, physical_lab_v1.csv and
physical_lab_bridge.json remain untouched. The exporter writes only
labbridge_measurement_asset.json beside them.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any, Mapping

SCHEMA = "labbridge.measurement-asset/v1"
OUTPUT_NAME = "labbridge_measurement_asset.json"


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def canonical_sha(value: Mapping[str, Any]) -> str:
    raw = json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True, allow_nan=False).encode("utf-8")
    return sha256_bytes(raw)


def build_packet(measurement_dir: Path) -> dict[str, Any]:
    measurement_dir = measurement_dir.expanduser().resolve()
    data_path = measurement_dir / "data.csv"
    metadata_path = measurement_dir / "metadata.json"
    if not data_path.is_file() or not metadata_path.is_file():
        raise FileNotFoundError("measurement directory must contain data.csv and metadata.json")
    data_bytes = data_path.read_bytes()
    metadata_bytes = metadata_path.read_bytes()
    metadata = json.loads(metadata_bytes.decode("utf-8"))
    if not isinstance(metadata, dict):
        raise ValueError("metadata.json must contain an object")

    columns = list(metadata.get("columns") or [])
    units = list(metadata.get("units") or [])
    if not columns or len(columns) != len(units):
        raise ValueError("metadata columns/units must be non-empty and equal length")
    primary = metadata.get("primary_column")
    channel_rows = []
    for name, unit in zip(columns, units):
        role = "primary-observable" if primary == name else ("coordinate" if str(name).lower() in {"time", "time_s", "time_us", "timestamp"} else "observable")
        channel_rows.append({"name": str(name), "unit": str(unit or ""), "role": role})

    lines = data_bytes.decode("utf-8").splitlines()
    row_count = max(0, len([line for line in lines[1:] if line.strip()]))
    if row_count < 1:
        raise ValueError("data.csv has no measurement rows")

    stable = {
        "schema": SCHEMA,
        "bridge_version": "1.0",
        "packet_type": "measurement_asset",
        "source_app": {
            "name": "BetterBoard",
            "product": "BetterBoard Studio",
            "version": str(metadata.get("producer") or "").replace("BetterBoard Studio ", "") or "unknown",
            "role": "real-world-ingress",
        },
        "created_at_utc": metadata.get("created_at_utc"),
        "dataset": {
            "path": "data.csv",
            "format": "text/csv",
            "sha256": sha256_bytes(data_bytes),
            "rows": row_count,
            "columns": channel_rows,
        },
        "device": {
            "board_profile": str(metadata.get("board_profile") or ""),
            "port": str(metadata.get("port") or ""),
            "baud": int(metadata.get("baud") or 0),
            "firmware_sha256": str(metadata.get("firmware_sha256") or ""),
        },
        "acquisition": {
            "mode": str(metadata.get("acquisition_mode") or ""),
            "recipe_id": str(metadata.get("recipe_id") or ""),
            "recipe_title": str(metadata.get("recipe_title") or ""),
            "sample_rate_hz": metadata.get("sample_rate_hz"),
            "recipe_parameters": dict(metadata.get("recipe_parameters") or {}),
        },
        "primary_observable": primary,
        "provenance": {
            "metadata_path": "metadata.json",
            "metadata_sha256": sha256_bytes(metadata_bytes),
            "firmware_sha256": str(metadata.get("firmware_sha256") or ""),
        },
        "compatibility": {
            "legacy_bridge": "physical_lab_bridge.json",
            "legacy_dataset": "physical_lab_v1.csv",
        },
        "intended_consumer": {
            "name": "Engineering Lab",
            "role": "scientific-computation-and-evidence-core",
        },
        "scientific_boundary": (
            "BetterBoard is the real-world ingress. This packet preserves acquisition identity and data integrity; "
            "sensor calibration, traceability, uncertainty assessment, scientific interpretation and validation remain separate Engineering Lab evidence."
        ),
    }
    digest = canonical_sha(stable)
    return {**stable, "packet_id": f"measurement-{digest[:20]}", "content_sha256": digest}


def write_packet(measurement_dir: Path) -> Path:
    packet = build_packet(measurement_dir)
    destination = measurement_dir.expanduser().resolve() / OUTPUT_NAME
    destination.write_text(json.dumps(packet, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return destination


def main() -> int:
    parser = argparse.ArgumentParser(description="Export a BetterBoard measurement session as LabBridge v1")
    parser.add_argument("measurement_dir", type=Path)
    args = parser.parse_args()
    path = write_packet(args.measurement_dir)
    print(path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
