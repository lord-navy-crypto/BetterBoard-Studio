#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CATALOG_DIR = ROOT / "sensor-suite"
DEFAULT_LIBRARY = Path.home() / "Documents" / "BetterBoard" / "library"


def catalog_paths() -> list[Path]:
    paths = sorted(CATALOG_DIR.glob("catalog*.json"))
    if not paths:
        raise SystemExit("no sensor-suite/catalog*.json files found")
    return paths


def load_entries() -> list[dict]:
    entries: list[dict] = []
    for path in catalog_paths():
        data = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(data, list):
            raise SystemExit(f"{path.relative_to(ROOT)} must contain a JSON array")
        entries.extend(data)
    return entries


def install(destination: Path, *, dry_run: bool = False) -> list[Path]:
    destination = destination.expanduser().resolve()
    entries = load_entries()
    written: list[Path] = []
    if not dry_run:
        destination.mkdir(parents=True, exist_ok=True)

    for entry in entries:
        recipe_id = str(entry["id"])
        firmware_path = ROOT / str(entry["firmware_path"])
        if not firmware_path.is_file():
            raise SystemExit(f"missing firmware for {recipe_id}: {firmware_path}")
        source = firmware_path.read_text(encoding="utf-8")
        spec = {k: v for k, v in entry.items() if k != "firmware_path"}
        spec["user_defined"] = True
        spec["base_recipe_id"] = None
        spec["parameter_values"] = {}
        wrapper = {"spec": spec, "source": source}
        target = destination / f"sensor-suite-{recipe_id}.json"
        if not dry_run:
            target.write_text(json.dumps(wrapper, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
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
