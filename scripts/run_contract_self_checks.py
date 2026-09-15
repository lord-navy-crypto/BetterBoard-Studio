#!/usr/bin/env python3
"""Run BetterBoard's lightweight Python contract checks from one stable CI entrypoint."""

from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]

CHECKS = (
    "self_check.py",
    "functionality_surface_check.py",
    "monitor_provenance_self_check.py",
    "circuit_local_design_self_check.py",
    "openguin_bridge_self_check.py",
    "research_bridge_self_check.py",
    "observatory_stats_self_check.py",
    "hardware_knowledge_self_check.py",
    "developer_workspace_self_check.py",
    "arduino_cli_schema_self_check.py",
    "developer_diagnostic_self_check.py",
    "developer_filesystem_self_check.py",
    "developer_rename_transaction_self_check.py",
    "developer_example_import_self_check.py",
    "developer_ecosystem_state_self_check.py",
    "developer_uninstall_spec_self_check.py",
    "developer_example_open_self_check.py",
    "numerical_depth_self_check.py",
    "numeric_error_campaign_self_check.py",
    "version_consistency_self_check.py",
    "applied_statistics_self_check.py",
    "time_series_signal_self_check.py",
    "model_fitting_self_check.py",
    "experiment_planning_self_check.py",
    "math_runtime_capabilities_self_check.py",
    "primitive_observability_self_check.py",
    "device_primitive_results_self_check.py",
    "device_primitive_time_origin_self_check.py",
)


def main() -> int:
    scripts = ROOT / "scripts"
    for index, filename in enumerate(CHECKS, start=1):
        path = scripts / filename
        if not path.is_file():
            print(f"[{index}/{len(CHECKS)}] MISSING {filename}", file=sys.stderr)
            return 2
        print(f"[{index}/{len(CHECKS)}] {filename}", flush=True)
        result = subprocess.run([sys.executable, str(path)], cwd=ROOT)
        if result.returncode:
            print(f"FAILED: {filename} (exit {result.returncode})", file=sys.stderr)
            return result.returncode
    print(f"BetterBoard Python contract suite: PASS ({len(CHECKS)} checks)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
