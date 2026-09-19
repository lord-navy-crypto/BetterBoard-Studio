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
        "BETTERBOARD MEASUREMENT EVIDENCE",
    )
    require(
        "src/EvidenceSourcePicker.tsx",
        "measurement_sessions",
        "measurement_session_load",
        "measurementEvidenceSource",
    )
    require(
        "src/AnalysisVisualizationHub.tsx",
        "Signal & Statistics",
        "Experiment Design",
        "Numerical Analysis",
        "NumericalResultVisualization",
        "EvidenceSourcePicker",
    )
    for workbench in (
        "src/AppliedStatisticsWorkbench.tsx",
        "src/ModelFittingWorkbench.tsx",
        "src/ExperimentPlanningWorkbench.tsx",
    ):
        require(workbench, "useEvidenceVisualization", "externalEvidenceSource", "shared.setSource", "effectiveTable")
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
    require("src/LabsHub.tsx", "Numerical Lab", "Magnet Lab", "Campaigns", "Evidence Handoff", 'initialMode="bench02"')
    require("src/ExperimentsHub.tsx", "CampaignVisualization", "EngineeringExperimentLibrary")
    require(
        "src/EngineeringExperimentLibrary.tsx",
        "engineering-lab-experiments/catalog.json",
        "import.meta.glob",
        "../engineering-lab-experiments/firmware/**/*.ino",
        "../src-tauri/resources/firmware/**/*.ino",
        "../sensor-suite/firmware/**/*.ino",
        "../scripts/*.py",
        "Dedicated Engineering Lab",
        "Numerical Reliability",
        "ESP32 Research",
        "Sensor Suite",
        "BetterBoard Firmware",
        "Host Analysis & Bridges",
        "loadSource",
        "developer_sketch_save",
        "compile_sketch",
        "upload_sketch",
        "View source",
        "Verify",
        "Upload",
    )
    experiment_library = read("src/EngineeringExperimentLibrary.tsx")
    assert "eager: true" not in experiment_library, "Experiment source files must be lazy-loaded instead of inflating the startup bundle"
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

    hardware = read("src/HardwareSession.tsx")
    assert "NO_BOARD_RESCAN_MS" not in hardware, "HardwareSession must not reintroduce frequent global Arduino CLI polling"
    assert "CONNECTED_BOARD_RESCAN_MS" not in hardware, "HardwareSession must not reintroduce periodic global Arduino CLI polling"
    assert "window.setInterval" not in hardware, "HardwareSession discovery should be lifecycle/manual driven, not periodic global polling"

    monitor = read("src/MonitorDataStudio.tsx")
    assert "parseNumericRow" in monitor, "Existing raw-evidence parser boundary must remain present"

    primitive = read("src/PrimitiveObservatory.tsx")
    assert "HOST-DERIVED" in primitive, "Host-derived provenance label must remain visible"
    assert "DEVICE-DERIVED" in primitive, "Device-derived provenance label must remain visible"
    assert "SignalHealthRail" in primitive and "healthSummary" in primitive, "Signal Health must consume live primitive observatory results"
    assert "computeHostPrimitiveObservability" in primitive, "Signal Health must stay attached to the canonical host primitive engine"

    hub = read("src/AnalysisVisualizationHub.tsx")
    assert "<NumericalErrorVisualWorkbench /><NumericalResultVisualization />" in hub, "Numerical evidence analysis must remain on the normal Analysis surface"
    assert "EngineeringPreparationStudio" not in hub, "Hardware/handoff workflow must not be nested back into Analysis"
    labs = read("src/LabsHub.tsx")
    assert "<NumericalBenchSuiteV2 initialMode=\"bench02\"/>" in labs, "Sampling Error lab must be directly reachable from Labs"
    assert "<MagnetBenchSuiteV2/>" in labs, "Magnet Lab must be directly reachable from Labs"

    print("Visualization absorption contract: PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
