#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "engineering-lab-experiments" / "catalog.json"
FIRMWARE = ROOT / "engineering-lab-experiments" / "firmware"

EVIDENCE_REQUIRED_TOKENS = (
    "betterboard::experiments::makeEvidenceRecord",
)
ACQUISITION_PATH_TOKENS = (
    "betterboard::measurement::AcquisitionResult",
    "betterboard::hal::ClockedSensorAdapter",
    "betterboard::hal::ISensorAdapter",
)
PERIODIC_REQUIRED_TOKENS = (
    "betterboard::core::SampleClock",
)
EVENT_DRIVEN_SKETCHES = {
    "EL_Oscillation_Photogate_Period",
}
FORBIDDEN_LEGACY_TOKENS = (
    "previous_sample_us",
)


def fail(message: str) -> None:
    raise SystemExit(f"Engineering Lab v3 contract audit failed: {message}")


def main() -> None:
    entries = json.loads(CATALOG.read_text())
    if len(entries) != 9:
        fail(f"expected exactly 9 catalog entries, found {len(entries)}")

    seen: set[str] = set()
    for entry in entries:
        sketch = entry["sketch_name"]
        if sketch in seen:
            fail(f"duplicate sketch_name: {sketch}")
        seen.add(sketch)

        path = FIRMWARE / sketch / f"{sketch}.ino"
        if not path.is_file():
            fail(f"missing sketch: {path.relative_to(ROOT)}")
        text = path.read_text()

        for token in EVIDENCE_REQUIRED_TOKENS:
            if token not in text:
                fail(f"{sketch} does not use required v3 evidence token: {token}")

        if not any(token in text for token in ACQUISITION_PATH_TOKENS):
            fail(
                f"{sketch} does not use a recognized v3 acquisition path: "
                "AcquisitionResult or HAL SensorAdapter"
            )

        if sketch not in EVENT_DRIVEN_SKETCHES:
            for token in PERIODIC_REQUIRED_TOKENS:
                if token not in text:
                    fail(f"{sketch} does not use required periodic timing token: {token}")

        for token in FORBIDDEN_LEGACY_TOKENS:
            if token in text:
                fail(f"{sketch} still contains legacy timing state: {token}")

        if "record.quality_flags" not in text:
            fail(f"{sketch} does not emit quality flags from EvidenceRecord")
        if "record.timestamp_us" not in text:
            fail(f"{sketch} does not timestamp rows from EvidenceRecord")

    if not EVENT_DRIVEN_SKETCHES.issubset(seen):
        fail("event-driven sketch allowlist contains an unknown sketch")

    print(
        f"Engineering Lab v3 contract audit passed for {len(entries)} sketches "
        f"({len(EVENT_DRIVEN_SKETCHES)} event-driven, "
        f"{len(entries) - len(EVENT_DRIVEN_SKETCHES)} periodic)"
    )


if __name__ == "__main__":
    main()
