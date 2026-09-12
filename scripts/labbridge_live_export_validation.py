#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import tempfile
from pathlib import Path

from labbridge_live_export import scan_once


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> int:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp) / "measurements"
        session = root / "synthetic-20260912T000000Z-000"
        session.mkdir(parents=True)
        data = session / "data.csv"
        metadata = session / "metadata.json"
        data.write_text("time_s,value\n0.0,1.0\n0.1,1.5\n", encoding="utf-8")
        metadata.write_text(json.dumps({
            "schema": "betterboard.measurement/0.2",
            "created_at_utc": "2026-09-12T00:00:00+00:00",
            "producer": "BetterBoard Studio 0.2.0-alpha.8",
            "acquisition_mode": "serial-capture",
            "recipe_id": "synthetic",
            "recipe_title": "Synthetic Signal",
            "board_profile": "esp32:esp32:esp32",
            "port": "/dev/cu.test",
            "baud": 115200,
            "columns": ["time_s", "value"],
            "units": ["s", "V"],
            "primary_column": "value",
            "sample_rate_hz": 10.0,
            "sample_count": 2,
            "firmware_sha256": "0" * 64,
            "recipe_parameters": {},
        }, sort_keys=True), encoding="utf-8")
        before = (sha(data), sha(metadata))
        first = scan_once(root)
        packet = session / "labbridge_measurement_asset.json"
        assert packet.is_file(), "LabBridge packet was not created"
        value = json.loads(packet.read_text(encoding="utf-8"))
        assert value["schema"] == "labbridge.measurement-asset/v1"
        assert value["source_app"]["role"] == "real-world-ingress"
        assert value["intended_consumer"]["name"] == "Engineering Lab"
        assert before == (sha(data), sha(metadata)), "source evidence was modified"
        assert any(row["status"] == "exported" for row in first)
        second = scan_once(root)
        assert any(row["status"] == "current" for row in second), "idempotent rescan failed"
    print("PASS: live LabBridge exporter is additive, idempotent and preserves source evidence")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
