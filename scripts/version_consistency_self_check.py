#!/usr/bin/env python3
"""Verify BetterBoard release/version identifiers stay synchronized."""

from __future__ import annotations

import json
import re
import tomllib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main() -> int:
    package = json.loads((ROOT / "package.json").read_text())
    tauri = json.loads((ROOT / "src-tauri" / "tauri.conf.json").read_text())
    cargo = tomllib.loads((ROOT / "src-tauri" / "Cargo.toml").read_text())
    rust = (ROOT / "src-tauri" / "src" / "lib.rs").read_text()
    app = (ROOT / "src" / "App.tsx").read_text()

    package_version = package["version"]
    tauri_version = tauri["version"]
    cargo_version = cargo["package"]["version"]

    rust_match = re.search(r'const APP_VERSION: &str = "([^"]+)";', rust)
    assert rust_match, "APP_VERSION constant is missing from src-tauri/src/lib.rs"
    rust_version = rust_match.group(1)

    versions = {
        "package.json": package_version,
        "src-tauri/tauri.conf.json": tauri_version,
        "src-tauri/Cargo.toml": cargo_version,
        "src-tauri/src/lib.rs APP_VERSION": rust_version,
    }
    assert len(set(versions.values())) == 1, f"version drift detected: {versions}"

    expected_label = f"Studio · {package_version}"
    assert expected_label in app, f"frontend version label must be {expected_label!r}"
    assert "Studio · Alpha 0.7" not in app, "stale handwritten Alpha 0.7 label returned"

    print(f"BetterBoard version consistency: PASS ({package_version})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
