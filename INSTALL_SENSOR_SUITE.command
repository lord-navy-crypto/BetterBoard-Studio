#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
python3 scripts/sensor_suite_self_check.py
python3 scripts/install_sensor_suite.py
printf '\nSensor Suite v1 installed. Open or refresh BetterBoard and select category: Sensor Suite.\n'
read -r -p "Press Enter to close..." _
