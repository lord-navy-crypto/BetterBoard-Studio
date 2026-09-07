#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
import math
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SPEC = importlib.util.spec_from_file_location("bench03", ROOT / "bench03_embedded_numerical.py")
if SPEC is None or SPEC.loader is None:
    raise SystemExit("Could not load Bench 03 analyzer")
bench03 = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(bench03)


def check(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def main() -> int:
    for value in (-80.0, -3.0, 0.0, math.pi / 2, 10.0, 80.0):
        x = bench03.f32(value)
        reference, _, _ = bench03.reference_value(x, 70)
        check(abs(reference - math.sin(x)) < 1e-14, f"reference mismatch at {x}")
        check(bench03.f32_ulp(reference) > 0.0, "ULP spacing must be positive")

    false_status = bench03.status_for(
        finite=True,
        stop=True,
        accuracy=False,
        cancellation_ok=False,
    )
    check(false_status == "false_convergence", "false convergence classification changed")

    reliable_status = bench03.status_for(
        finite=True,
        stop=True,
        accuracy=True,
        cancellation_ok=True,
    )
    check(reliable_status == "reliable", "reliable classification changed")

    with tempfile.TemporaryDirectory() as tmp:
        check(Path(tmp).exists(), "temporary directory unavailable")

    print("BetterBoard Bench 03 self-check: PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
