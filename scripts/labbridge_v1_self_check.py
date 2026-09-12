#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import importlib.util
import json
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXPORTER = ROOT / "scripts" / "labbridge_v1_export.py"
SCHEMA = ROOT / "docs" / "labbridge" / "measurement_asset.schema.json"


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def load_exporter():
    spec = importlib.util.spec_from_file_location("labbridge_v1_export", EXPORTER)
    if spec is None or spec.loader is None:
        raise RuntimeError("could not load LabBridge exporter")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def main() -> int:
    exporter = load_exporter()
    schema = json.loads(SCHEMA.read_text())
    require(schema.get("$schema") == "https://json-schema.org/draft/2020-12/schema", "schema draft mismatch")
    require(schema["properties"]["schema"]["const"] == "labbridge.measurement-asset/v1", "packet schema constant mismatch")

    with tempfile.TemporaryDirectory() as tmp:
        d = Path(tmp)
        data = b"time_s,value_v\n0.0,1.0\n0.1,1.1\n"
        (d / "data.csv").write_bytes(data)
        metadata = {
            "schema": "betterboard.measurement/0.2",
            "created_at_utc": "2026-09-12T00:00:00+00:00",
            "producer": "BetterBoard Studio 0.2.0-test",
            "acquisition_mode": "serial-capture",
            "recipe_id": "synthetic",
            "recipe_title": "Synthetic Signal",
            "board_profile": "arduino:avr:uno",
            "port": "/dev/cu.test",
            "baud": 115200,
            "columns": ["time_s", "value_v"],
            "units": ["s", "V"],
            "primary_column": "value_v",
            "sample_rate_hz": 10.0,
            "sample_count": 2,
            "firmware_sha256": "f" * 64,
            "recipe_parameters": {},
            "physical_lab_targets": [],
            "scientific_boundary": "test",
        }
        (d / "metadata.json").write_text(json.dumps(metadata, sort_keys=True))
        packet1 = exporter.build_packet(d)
        packet2 = exporter.build_packet(d)
        require(packet1 == packet2, "same measurement state did not produce deterministic LabBridge packet")
        require(packet1["source_app"]["name"] == "BetterBoard", "producer identity mismatch")
        require(packet1["source_app"]["role"] == "real-world-ingress", "BetterBoard role mismatch")
        require(packet1["intended_consumer"]["name"] == "Engineering Lab", "consumer identity mismatch")
        require(packet1["intended_consumer"]["role"] == "scientific-computation-and-evidence-core", "Engineering Lab role mismatch")
        require(packet1["dataset"]["sha256"] == hashlib.sha256(data).hexdigest(), "data SHA mismatch")
        stable = {k: v for k, v in packet1.items() if k not in {"packet_id", "content_sha256"}}
        digest = exporter.canonical_sha(stable)
        require(packet1["content_sha256"] == digest, "packet content fingerprint mismatch")
        require(packet1["packet_id"] == f"measurement-{digest[:20]}", "packet ID mismatch")
        require(packet1["dataset"]["columns"][0]["role"] == "coordinate", "time coordinate role missing")
        require(packet1["dataset"]["columns"][1]["role"] == "primary-observable", "primary observable role missing")
        path = exporter.write_packet(d)
        require(path.name == "labbridge_measurement_asset.json" and path.exists(), "packet file not written")

    print("PASS: BetterBoard LabBridge v1 exporter and role contract")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
