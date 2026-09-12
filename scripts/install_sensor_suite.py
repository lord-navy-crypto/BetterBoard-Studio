#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import re
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CATALOG_DIR = ROOT / "sensor-suite"
FIRMWARE_ROOT = CATALOG_DIR / "firmware"
DEFAULT_LIBRARY = Path.home() / "Documents" / "BetterBoard" / "library"
SAFE_ID = re.compile(r"^[a-z0-9][a-z0-9_-]*$")


def catalog_paths() -> list[Path]:
    paths = sorted(CATALOG_DIR.glob("catalog*.json"))
    if not paths:
        raise SystemExit("no sensor-suite/catalog*.json files found")
    return paths


def load_entries() -> list[dict]:
    entries: list[dict] = []
    seen_ids: set[str] = set()
    for path in catalog_paths():
        data = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(data, list):
            raise SystemExit(f"{path.relative_to(ROOT)} must contain a JSON array")
        for entry in data:
            if not isinstance(entry, dict):
                raise SystemExit(f"{path.relative_to(ROOT)} contains a non-object recipe")
            recipe_id = str(entry.get("id", ""))
            if not SAFE_ID.fullmatch(recipe_id):
                raise SystemExit(f"unsafe or invalid recipe id: {recipe_id!r}")
            if recipe_id in seen_ids:
                raise SystemExit(f"duplicate recipe id: {recipe_id}")
            seen_ids.add(recipe_id)
            entries.append(entry)
    return entries


def _firmware_path(entry: dict) -> Path:
    recipe_id = str(entry["id"])
    raw = ROOT / str(entry["firmware_path"])
    resolved = raw.resolve()
    try:
        resolved.relative_to(FIRMWARE_ROOT.resolve())
    except ValueError as exc:
        raise SystemExit(f"firmware path escapes sensor-suite/firmware for {recipe_id}: {raw}") from exc
    if not resolved.is_file():
        raise SystemExit(f"missing firmware for {recipe_id}: {resolved}")
    return resolved


def _atomic_write_json(target: Path, payload: dict) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(payload, indent=2, ensure_ascii=False, sort_keys=False) + "\n"
    temp_name: str | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            dir=target.parent,
            prefix=f".{target.name}.",
            suffix=".tmp",
            delete=False,
        ) as handle:
            temp_name = handle.name
            handle.write(text)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temp_name, target)
    finally:
        if temp_name:
            Path(temp_name).unlink(missing_ok=True)


def install(destination: Path, *, dry_run: bool = False) -> list[Path]:
    destination = destination.expanduser().resolve()
    entries = load_entries()
    written: list[Path] = []
    if not dry_run:
        destination.mkdir(parents=True, exist_ok=True)

    for entry in entries:
        recipe_id = str(entry["id"])
        firmware_path = _firmware_path(entry)
        source = firmware_path.read_text(encoding="utf-8")
        spec = {k: v for k, v in entry.items() if k != "firmware_path"}
        spec["user_defined"] = True
        spec["base_recipe_id"] = None
        spec["parameter_values"] = {}
        wrapper = {"spec": spec, "source": source}
        target = destination / f"sensor-suite-{recipe_id}.json"
        if not dry_run:
            _atomic_write_json(target, wrapper)
        written.append(target)
    return written


def main() -> int:
    parser = argparse.ArgumentParser(description="Install BetterBoard Sensor Suite program library into the BetterBoard user recipe library.")
    parser.add_argument("--destination", type=Path, default=DEFAULT_LIBRARY)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    paths = install(args.destination, dry_run=args.dry_run)
    action = "Would install" if args.dry_run else "Installed"
    print(f"{action} {len(paths)} Sensor Suite recipes:")
    for path in paths:
        print(f"  {path}")
    if not args.dry_run:
        print("Refresh BetterBoard Recipe Library; the recipes appear under Sensor Suite categories.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
