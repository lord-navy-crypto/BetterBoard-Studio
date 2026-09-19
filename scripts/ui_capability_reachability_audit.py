#!/usr/bin/env python3
"""Repository-wide React reachability audit for BetterBoard.

Build an import graph rooted at src/main.tsx. Any .tsx page/workbench/component
that is not reachable from the application entrypoint is reported. This catches
capabilities whose source file survives a refactor but is no longer mounted
anywhere in the actual product.
"""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"

source_files = sorted([
    p for p in SRC.iterdir()
    if p.is_file() and p.suffix in {".ts", ".tsx"} and not p.name.endswith(".d.ts")
])
by_name = {p.stem: p for p in source_files}

IMPORT_RE = re.compile(
    r"""(?:import\s+(?:[^'"]+?\s+from\s+)?|import\s*\()\s*['"]\./([^'"]+)['"]"""
)

def deps(path: Path) -> set[Path]:
    text = path.read_text(encoding="utf-8")
    out: set[Path] = set()
    for raw in IMPORT_RE.findall(text):
        clean = raw.split("?", 1)[0]
        stem = Path(clean).name
        target = by_name.get(stem)
        if target is not None:
            out.add(target)
    return out

graph = {p: deps(p) for p in source_files}
root = SRC / "main.tsx"
assert root in graph, "src/main.tsx missing from source graph"

reachable: set[Path] = set()
stack = [root]
while stack:
    path = stack.pop()
    if path in reachable:
        continue
    reachable.add(path)
    stack.extend(graph.get(path, ()))

orphans = [p for p in source_files if p not in reachable]

print(f"BetterBoard TS/TSX inventory: {len(source_files)}")
print(f"Reachable from main.tsx: {len(reachable)}")
for path in source_files:
    status = "reachable" if path in reachable else "UNREACHABLE"
    parents = sorted(p.name for p, ds in graph.items() if path in ds)
    print(f"- {path.name}: {status}; imported by {', '.join(parents) if parents else 'nobody'}")

if orphans:
    print("\nUNREACHABLE REACT SURFACES:")
    for path in orphans:
        print(f"- {path.name}")
    raise SystemExit(
        "BetterBoard capability reachability audit FAILED: "
        f"{len(orphans)} TS/TSX module(s) are not reachable from src/main.tsx."
    )

print("BetterBoard capability reachability audit: PASS")
print("- every TS/TSX source module is reachable from the running application entrypoint")
print("- source-present but UI-orphaned capabilities are CI-detectable")
