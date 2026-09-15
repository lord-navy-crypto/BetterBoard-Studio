#!/usr/bin/env python3
"""Protect BetterBoard's device primitive-result protocol and evidence boundary."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def require(path: Path, message: str) -> str:
    if not path.is_file():
        raise AssertionError(message)
    return path.read_text(encoding="utf-8")


def main() -> int:
    formatter_h = ROOT / "firmware/betterboard-core/src/experiments/PrimitiveResultStream.h"
    formatter_cpp = ROOT / "firmware/betterboard-core/src/experiments/PrimitiveResultStream.cpp"
    parser_ts = ROOT / "src/devicePrimitiveResults.ts"

    require(formatter_h, "PrimitiveResultStream header missing")
    require(formatter_cpp, "PrimitiveResultStream implementation missing")
    parser = require(parser_ts, "device primitive result parser missing")

    monitor = require(ROOT / "src/MonitorDataStudio.tsx", "MonitorDataStudio missing")
    observatory = require(ROOT / "src/PrimitiveObservatory.tsx", "PrimitiveObservatory missing")

    assert "#BB_PRIMITIVE," in parser, "device primitive protocol prefix missing"
    assert "parseDevicePrimitiveResult" in parser, "device primitive parser entrypoint missing"
    assert "parseDevicePrimitiveResult" in monitor, "Monitor primitive routing missing"
    assert "parseNumericRow" in monitor, "raw numeric evidence parser missing"
    assert "bufferedEvidenceRows" in monitor and "parseNumericRow" in monitor, "raw evidence boundary missing"
    assert "devicePrimitive" in monitor, "separate device primitive collection missing"
    assert "DEVICE-DERIVED" in observatory, "DEVICE-DERIVED provenance missing"
    assert "HOST ↔ DEVICE" in observatory, "HOST ↔ DEVICE comparison surface missing"
    assert "deviceResults" in observatory, "PrimitiveObservatory device result prop missing"

    print("Device primitive result contract: PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
