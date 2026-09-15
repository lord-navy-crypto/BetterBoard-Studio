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
        "Engineering Preparation",
        "NumericalResultVisualization",
        "MagnetResultVisualization",
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
    require("src/ExperimentsHub.tsx", "CampaignVisualization", "EngineeringExperimentLibrary")
    require(
        "src/EngineeringExperimentLibrary.tsx",
        "engineering-lab-experiments/catalog.json",
        "EL_Radia_MLX90393_Field",
        "EL_Oscillation_LSM6DSOX_VL53L1X",
        "EL_Honeycomb_Dual_ADXL345",
        "EL_Chaos_Encoder_Kinematics",
        "EL_Oscillation_Photogate_Period",
        "EL_Numerical_ADC_Reference",
        "EL_ForceDynamics_HX711",
        "EL_PowerContext_INA219",
        "EL_Numerical_BME280_Context",
        "developer_sketch_save",
        "compile_sketch",
        "upload_sketch",
        "View source",
        "Verify",
        "Upload",
    )
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
    assert "<NumericalErrorVisualWorkbench /><NumericalResultVisualization />" in hub, "Numerical depth results must be on the normal Numerical Reliability surface"
    assert "<EngineeringPreparationStudio /><MagnetResultVisualization />" in hub, "Magnetic analyzer results must be on the normal preparation surface"

    print("Visualization absorption contract: PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
