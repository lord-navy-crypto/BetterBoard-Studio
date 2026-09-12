#!/usr/bin/env python3
"""Keep BetterBoard measurement sessions upgraded to LabBridge v1.

This sidecar is intentionally narrow and additive. It watches the local BetterBoard
measurement store and creates/refreshes only ``labbridge_measurement_asset.json``.
It never changes data.csv, metadata.json, firmware, board state, or legacy bridge
artifacts.

The native Rust writer remains the preferred final production path. This sidecar
provides a working local bridge while that final save-path hook is being merged.
"""
from __future__ import annotations

import argparse
import json
import os
import time
from pathlib import Path
from typing import Any

from labbridge_v1_export import OUTPUT_NAME, build_packet

DEFAULT_ROOT = Path.home() / "Documents" / "BetterBoard" / "measurements"
MAX_SESSIONS = 500


def measurement_root(raw: str | None = None) -> Path:
    override = (raw or os.environ.get("BETTERBOARD_MEASUREMENT_DIR", "")).strip()
    return Path(override).expanduser().resolve() if override else DEFAULT_ROOT.resolve()


def _load_packet(path: Path) -> dict[str, Any] | None:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None
    return value if isinstance(value, dict) else None


def export_session(session_dir: Path) -> dict[str, Any]:
    session = session_dir.expanduser().resolve()
    data_path = session / "data.csv"
    metadata_path = session / "metadata.json"
    if not data_path.is_file() or not metadata_path.is_file():
        return {"session": str(session), "status": "skipped", "reason": "missing data.csv or metadata.json"}

    packet = build_packet(session)
    destination = session / OUTPUT_NAME
    existing = _load_packet(destination) if destination.is_file() else None
    if existing and existing.get("content_sha256") == packet.get("content_sha256"):
        return {
            "session": str(session),
            "status": "current",
            "packet_id": packet.get("packet_id"),
            "content_sha256": packet.get("content_sha256"),
        }

    temporary = destination.with_suffix(destination.suffix + ".tmp")
    temporary.write_text(json.dumps(packet, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    temporary.replace(destination)
    return {
        "session": str(session),
        "status": "exported",
        "packet_path": str(destination),
        "packet_id": packet.get("packet_id"),
        "content_sha256": packet.get("content_sha256"),
    }


def scan_once(root: Path, *, limit: int = MAX_SESSIONS) -> list[dict[str, Any]]:
    root = root.expanduser().resolve()
    if not root.is_dir():
        return []
    sessions = [path for path in root.iterdir() if path.is_dir()]
    sessions.sort(key=lambda path: path.stat().st_mtime if path.exists() else 0.0, reverse=True)
    output: list[dict[str, Any]] = []
    for session in sessions[: max(1, min(int(limit), MAX_SESSIONS))]:
        try:
            output.append(export_session(session))
        except Exception as exc:
            output.append({"session": str(session), "status": "error", "reason": str(exc)})
    return output


def main() -> int:
    parser = argparse.ArgumentParser(description="Keep BetterBoard measurement sessions exported as LabBridge v1")
    parser.add_argument("--root", default="", help="Override BetterBoard measurement root")
    parser.add_argument("--watch", action="store_true", help="Continue scanning locally until interrupted")
    parser.add_argument("--interval", type=float, default=2.0, help="Watch interval in seconds (minimum 0.5)")
    parser.add_argument("--limit", type=int, default=MAX_SESSIONS)
    parser.add_argument("--json", action="store_true", help="Print scan results as JSON")
    args = parser.parse_args()

    root = measurement_root(args.root)
    interval = max(0.5, float(args.interval))
    while True:
        results = scan_once(root, limit=args.limit)
        changed = [row for row in results if row.get("status") in {"exported", "error"}]
        if args.json:
            print(json.dumps({"root": str(root), "results": changed}, indent=2, sort_keys=True))
        else:
            for row in changed:
                print(f"{row.get('status')}: {row.get('session')} {row.get('packet_id') or row.get('reason') or ''}".rstrip())
        if not args.watch:
            return 0 if not any(row.get("status") == "error" for row in results) else 1
        time.sleep(interval)


if __name__ == "__main__":
    raise SystemExit(main())
