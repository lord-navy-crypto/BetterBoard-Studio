#!/usr/bin/env python3
"""Protect Phase 5 visualization absorption and unified-analysis boundaries."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def require(path: str, *needles: str) -> None:
    text = read(path)
    for needle in needles:
        assert needle in text, f"{path}: missing {needle!r}"


def main() -> int:
    require("src/main.tsx", "EvidenceVisualizationProvider", "AnalysisVisualizationHub")
    require(
        "src/EvidenceVisualizationContext.tsx",
        "measurement-session",
        "external-table",
        "sourceId",
        "provenanceLabel",
    )
    require(
        "src/AnalysisVisualizationHub.tsx",
        "Signal & Statistics",
        "Experiment Design",
        "Engineering Preparation",
        "NumericalResultVisualization",
        "MagnetResultVisualization",
    )
    require(
        "src/NumericalResultVisualization.tsx",
        "betterboard.bench02-numerical-error/0.2",
        "betterboard.bench03-summary/0.2",
        "HOST-DERIVED ANALYZER",
        "MCU EVIDENCE + HOST REFERENCE",
    )
    require(
        "src/MagnetResultVisualization.tsx",
        "betterboard.magnet-bench02/0.1",
        "MEASURED + BASELINE-CORRECTED",
        "MEASUREMENT ↔ MODEL DERIVED COMPARISON",
        "MEASURED ↔ MODEL ↔ RESIDUAL",
    )
    require("src/SignalHealthRail.tsx", "Timing", "Noise / RMS", "Host ↔ Device")
    require(
        "src/ObservatoryVisualSummary.tsx",
        "Sampling Health",
        "Evidence Integrity",
        "Session History",
        "Task Activity",
    )
    require("src/ExperimentsHub.tsx", "CampaignVisualization")
    require(
        "src/EngineeringPlot.tsx",
        "compact?: boolean",
        "selectedPoint?",
        "eventMarkers?",
        "onPointSelect?",
        "verticalMarkers",
        "horizontalMarkers",
        "zeroLine",
    )

    monitor = read("src/MonitorDataStudio.tsx")
    assert "parseNumericRow" in monitor, "Existing raw-evidence parser boundary must remain present"

    primitive = read("src/PrimitiveObservatory.tsx")
    assert "HOST-DERIVED" in primitive, "Host-derived provenance label must remain visible"
    assert "DEVICE-DERIVED" in primitive, "Device-derived provenance label must remain visible"

    hub = read("src/AnalysisVisualizationHub.tsx")
    assert "<NumericalErrorVisualWorkbench /><NumericalResultVisualization />" in hub, "Numerical depth results must be on the normal Numerical Reliability surface"
    assert "<EngineeringPreparationStudio /><MagnetResultVisualization />" in hub, "Magnetic analyzer results must be on the normal preparation surface"

    print("Visualization absorption contract: PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
