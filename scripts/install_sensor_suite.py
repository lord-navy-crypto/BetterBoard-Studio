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
MANAGED_GLOB = "sensor-suite-*.json"


def catalog_paths() -> list[Path]:
    paths = sorted(CATALOG_DIR.glob("catalog*.json"))
    if not paths:
        raise SystemExit("no sensor-suite/catalog*.json files found")
    return paths


def _load_json(path: Path):
    def reject_constant(value: str):
        raise ValueError(f"non-finite JSON number {value}")

    try:
        return json.loads(path.read_text(encoding="utf-8"), parse_constant=reject_constant)
    except (json.JSONDecodeError, ValueError) as exc:
        raise SystemExit(f"invalid JSON in {path.relative_to(ROOT)}: {exc}") from exc


def load_entries() -> list[dict]:
    entries: list[dict] = []
    seen_ids: set[str] = set()
    for path in catalog_paths():
        data = _load_json(path)
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
    return sorted(entries, key=lambda entry: str(entry["id"]))


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


def _render_wrapper(entry: dict) -> str:
    firmware_path = _firmware_path(entry)
    source = firmware_path.read_text(encoding="utf-8")
    spec = {k: v for k, v in entry.items() if k != "firmware_path"}
    spec["user_defined"] = True
    spec["base_recipe_id"] = None
    spec["parameter_values"] = {}
    wrapper = {"spec": spec, "source": source}
    return json.dumps(wrapper, indent=2, ensure_ascii=False, sort_keys=False, allow_nan=False) + "\n"


def _fsync_directory(directory: Path) -> None:
    flags = getattr(os, "O_DIRECTORY", 0) | os.O_RDONLY
    try:
        fd = os.open(directory, flags)
    except OSError:
        return
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


def _atomic_write_text(target: Path, text: str) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.is_file():
        try:
            if target.read_text(encoding="utf-8") == text:
                return
        except UnicodeDecodeError:
            pass

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
        _fsync_directory(target.parent)
    finally:
        if temp_name:
            Path(temp_name).unlink(missing_ok=True)


def expected_payloads(destination: Path) -> dict[Path, str]:
    destination = destination.expanduser().resolve()
    return {
        destination / f"sensor-suite-{entry['id']}.json": _render_wrapper(entry)
        for entry in load_entries()
    }


def install(destination: Path, *, dry_run: bool = False) -> list[Path]:
    destination = destination.expanduser().resolve()
    payloads = expected_payloads(destination)
    if not dry_run:
        destination.mkdir(parents=True, exist_ok=True)
        for target, text in payloads.items():
            _atomic_write_text(target, text)
    return list(payloads)


def verify_installation(destination: Path) -> list[str]:
    destination = destination.expanduser().resolve()
    problems: list[str] = []
    payloads = expected_payloads(destination)
    expected_paths = set(payloads)

    if destination.exists():
        for candidate in sorted(destination.glob(MANAGED_GLOB)):
            resolved = candidate.resolve()
            if resolved not in expected_paths:
                problems.append(f"unexpected managed recipe: {candidate}")

    for target, expected in payloads.items():
        if not target.is_file():
            problems.append(f"missing: {target}")
            continue
        try:
            actual = target.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            problems.append(f"not UTF-8: {target}")
            continue
        if actual != expected:
            problems.append(f"content mismatch: {target}")
    return problems


def main() -> int:
    parser = argparse.ArgumentParser(description="Install or verify the BetterBoard Sensor Suite user recipe library.")
    parser.add_argument("--destination", type=Path, default=DEFAULT_LIBRARY)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--dry-run", action="store_true", help="show the exact managed targets without writing them")
    mode.add_argument("--verify", action="store_true", help="verify the exact managed recipe set and contents match this checkout")
    args = parser.parse_args()

    if args.verify:
        problems = verify_installation(args.destination)
        if problems:
            print(f"Sensor Suite verification FAILED with {len(problems)} problem(s):")
            for problem in problems:
                print(f"  {problem}")
            return 1
        print(f"Sensor Suite verification PASS: {len(load_entries())} managed recipes exactly match this checkout.")
        return 0

    paths = install(args.destination, dry_run=args.dry_run)
    action = "Would install" if args.dry_run else "Installed/verified"
    print(f"{action} {len(paths)} Sensor Suite recipes:")
    for path in paths:
        print(f"  {path}")
    if not args.dry_run:
        print("Refresh BetterBoard Recipe Library; the recipes appear under Sensor Suite categories.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
