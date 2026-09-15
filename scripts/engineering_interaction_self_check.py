#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def require(path: str, *tokens: str) -> None:
    target = ROOT / path
    assert target.is_file(), f"missing required file: {path}"
    text = target.read_text(encoding="utf-8")
    for token in tokens:
        assert token in text, f"{path}: missing {token!r}"


def main() -> int:
    require("src/PlotInspectionContext.tsx", "selectedX", "selectedRange", "sourceId", "resetInspection")
    require("src/RunComparisonContext.tsx", "runA", "runB", "setRunA", "setRunB")
    require("src/EngineeringAnnotations.tsx", "USER ANNOTATION", "addAnnotation", "removeAnnotation")
    require("src/EngineeringPlot.tsx", "selectedX?", "selectedRange?", "onRangeSelect?", "onPointSelect?")
    require("src/PrimitiveObservatory.tsx", "PlotInspectionProvider", "selectedX", "selectedRange")
    require("src/EngineeringStatusMap.tsx", "Toolchain", "Hardware", "Firmware", "Acquisition", "Evidence", "Analysis")
    require("src/HardwareTopology.tsx", "detected board", "selected FQBN", "required libraries")
    require("src/taskPresentation.ts", "deriveTaskTimeline", "taskElapsedMs")
    require("src/TaskCenter.tsx", "Running", "Failed", "Recent", "Copy logs")
    require("src/circuitDiagnostics.ts", "connectedNet", "issueTargets")
    require("src/DeveloperIDE.tsx", "developer-engineering-split", "Diagnostics", "Run output")
    require("src/AnalysisWorkflowGuide.tsx", "Evidence", "Analyze", "Compare", "Decide")
    require("src/ExperimentsHub.tsx", "Complete Experiment Code Library")

    hardware = read("src/HardwareSession.tsx")
    assert "window.setInterval" not in hardware, "HardwareSession must stay lifecycle/manual driven"
    assert "NO_BOARD_RESCAN_MS" not in hardware, "frequent hardware polling must not return"
    assert "CONNECTED_BOARD_RESCAN_MS" not in hardware, "connected-board polling must not return"

    library = read("src/EngineeringExperimentLibrary.tsx")
    assert "import.meta.glob" in library, "experiment assets must remain repository-discovered"
    assert "eager: true" not in library, "experiment source bodies must remain lazy-loaded"

    circuit = read("src/CircuitLab.tsx")
    assert "runRuleChecker" in circuit, "existing circuit rule checker must remain canonical"

    print("Engineering interaction contract: PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
