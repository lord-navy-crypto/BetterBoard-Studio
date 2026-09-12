#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import math
import re
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CATALOG_DIR = ROOT / "sensor-suite"
FIRMWARE_ROOT = CATALOG_DIR / "firmware"
EXPECTED_RECIPE_COUNT = 56
SAFE_ID = re.compile(r"^[a-z0-9][a-z0-9_-]*$")
SAFE_SKETCH = re.compile(r"^[A-Za-z0-9_][A-Za-z0-9_-]*$")
SAFE_MACRO = re.compile(r"^[A-Z][A-Z0-9_]*$")
SAFE_COLUMN = re.compile(r"^[a-z][a-z0-9_]*$")

REQUIRED_KEYS = {
    "id", "title", "category", "description", "sketch_name", "firmware_path",
    "capture_mode", "baud", "columns", "units", "primary_column",
    "sample_rate_hz", "required_libraries", "hardware", "physical_lab_targets",
    "notes", "boundary"
}
ALLOWED_KEYS = REQUIRED_KEYS | {"parameters"}


def fail(message: str) -> None:
    raise SystemExit(f"Sensor Suite self-check FAILED: {message}")


def _reject_constant(value: str):
    fail(f"catalog contains non-finite JSON number {value}")


def load_all_entries() -> tuple[list[dict], list[Path]]:
    paths = sorted(CATALOG_DIR.glob("catalog*.json"))
    if not paths:
        fail("no catalog*.json files found")
    entries: list[dict] = []
    for path in paths:
        try:
            data = json.loads(path.read_text(encoding="utf-8"), parse_constant=_reject_constant)
        except json.JSONDecodeError as exc:
            fail(f"{path.name} invalid JSON at line {exc.lineno}: {exc.msg}")
        if not isinstance(data, list):
            fail(f"{path.name} must be a JSON array")
        if not data:
            fail(f"{path.name} is empty")
        if not all(isinstance(item, dict) for item in data):
            fail(f"{path.name} contains a non-object recipe")
        entries.extend(data)
    return entries, paths


def _require_nonempty_text(entry: dict, key: str, rid: str) -> str:
    value = entry.get(key)
    if not isinstance(value, str) or not value.strip():
        fail(f"{rid}: {key} must be non-empty text")
    if "\x00" in value:
        fail(f"{rid}: {key} contains a NUL character")
    return value.strip()


def _require_string_list(entry: dict, key: str, rid: str, *, allow_empty: bool = True) -> list[str]:
    value = entry.get(key)
    if not isinstance(value, list) or any(not isinstance(item, str) or not item.strip() for item in value):
        fail(f"{rid}: {key} must be a list of non-empty strings")
    normalized = [item.strip() for item in value]
    if not allow_empty and not normalized:
        fail(f"{rid}: {key} must not be empty")
    if len(normalized) != len(set(normalized)):
        fail(f"{rid}: {key} contains duplicates")
    if any("\x00" in item for item in normalized):
        fail(f"{rid}: {key} contains a NUL character")
    return normalized


def _finite_number(value, *, rid: str, label: str) -> float:
    if not isinstance(value, (int, float)) or isinstance(value, bool):
        fail(f"{rid}: {label} must be numeric")
    numeric = float(value)
    if not math.isfinite(numeric):
        fail(f"{rid}: {label} must be finite")
    return numeric


def _validate_parameters(entry: dict, rid: str, source: str) -> None:
    parameters = entry.get("parameters", [])
    if not isinstance(parameters, list):
        fail(f"{rid}: parameters must be a list")
    keys: set[str] = set()
    macros: set[str] = set()
    for index, parameter in enumerate(parameters):
        if not isinstance(parameter, dict):
            fail(f"{rid}: parameter #{index + 1} is not an object")
        for required in ("key", "label", "kind", "default_value", "macro_name"):
            if required not in parameter:
                fail(f"{rid}: parameter #{index + 1} missing {required}")

        key = str(parameter["key"]).strip()
        label = str(parameter["label"]).strip()
        kind = str(parameter["kind"]).strip()
        macro = str(parameter["macro_name"]).strip()
        if not key or key in keys:
            fail(f"{rid}: duplicate/empty parameter key {key!r}")
        if not label:
            fail(f"{rid}: parameter {key} has an empty label")
        if kind not in {"integer", "number"}:
            fail(f"{rid}: parameter {key} has unsupported kind {kind!r}")
        if not SAFE_MACRO.fullmatch(macro) or macro in macros:
            fail(f"{rid}: invalid/duplicate parameter macro {macro!r}")
        keys.add(key)
        macros.add(macro)

        if not re.search(rf"\b{re.escape(macro)}\b", source):
            fail(f"{rid}: parameter macro {macro} is not referenced by firmware")

        try:
            default_numeric = float(parameter["default_value"])
        except (TypeError, ValueError):
            fail(f"{rid}: numeric parameter {key} has non-numeric default")
        if not math.isfinite(default_numeric):
            fail(f"{rid}: parameter {key} default must be finite")
        if kind == "integer" and not default_numeric.is_integer():
            fail(f"{rid}: integer parameter {key} has a non-integer default")

        minimum = parameter.get("min")
        maximum = parameter.get("max")
        step = parameter.get("step")
        if minimum is not None:
            minimum = _finite_number(minimum, rid=rid, label=f"parameter {key} min")
        if maximum is not None:
            maximum = _finite_number(maximum, rid=rid, label=f"parameter {key} max")
        if minimum is not None and maximum is not None and minimum > maximum:
            fail(f"{rid}: parameter {key} has min > max")
        if minimum is not None and default_numeric < minimum:
            fail(f"{rid}: parameter {key} default is below min")
        if maximum is not None and default_numeric > maximum:
            fail(f"{rid}: parameter {key} default is above max")
        if step is not None:
            step_numeric = _finite_number(step, rid=rid, label=f"parameter {key} step")
            if step_numeric <= 0:
                fail(f"{rid}: parameter {key} step must be positive")


def main() -> int:
    entries, catalogs = load_all_entries()
    if len(entries) != EXPECTED_RECIPE_COUNT:
        fail(f"program-library freeze violated: expected {EXPECTED_RECIPE_COUNT} recipes, found {len(entries)}")

    ids: set[str] = set()
    sketch_names: set[str] = set()
    expected_targets: set[str] = set()

    for entry in entries:
        missing = REQUIRED_KEYS - set(entry)
        if missing:
            fail(f"{entry.get('id', '<unknown>')} missing keys: {sorted(missing)}")
        unknown = set(entry) - ALLOWED_KEYS
        if unknown:
            fail(f"{entry.get('id', '<unknown>')} has unknown keys: {sorted(unknown)}")

        rid = _require_nonempty_text(entry, "id", "<unknown>")
        if not SAFE_ID.fullmatch(rid):
            fail(f"unsafe recipe id {rid!r}")
        if rid in ids:
            fail(f"duplicate recipe id {rid}")
        ids.add(rid)

        title = _require_nonempty_text(entry, "title", rid)
        category = _require_nonempty_text(entry, "category", rid)
        _require_nonempty_text(entry, "description", rid)
        _require_nonempty_text(entry, "boundary", rid)
        if not title.startswith("Sensor Suite"):
            fail(f"{rid}: title must remain under the Sensor Suite namespace")
        if not category.startswith("Sensor Suite"):
            fail(f"{rid}: category must remain under the Sensor Suite namespace")

        sketch = _require_nonempty_text(entry, "sketch_name", rid)
        if not SAFE_SKETCH.fullmatch(sketch):
            fail(f"{rid}: unsafe sketch_name {sketch!r}")
        if sketch in sketch_names:
            fail(f"duplicate sketch_name {sketch}")
        sketch_names.add(sketch)

        if entry.get("capture_mode") != "numeric":
            fail(f"{rid}: Sensor Suite recipes currently require numeric capture_mode")
        baud = entry.get("baud")
        if not isinstance(baud, int) or isinstance(baud, bool) or baud <= 0:
            fail(f"{rid}: baud must be a positive integer")
        sample_rate = entry.get("sample_rate_hz")
        if sample_rate is not None:
            sample_rate = _finite_number(sample_rate, rid=rid, label="sample_rate_hz")
            if sample_rate <= 0:
                fail(f"{rid}: sample_rate_hz must be null or positive")

        columns = _require_string_list(entry, "columns", rid, allow_empty=False)
        if any(not SAFE_COLUMN.fullmatch(column) for column in columns):
            fail(f"{rid}: columns must use lower_snake_case identifiers")
        units = entry.get("units")
        if not isinstance(units, list) or any(not isinstance(unit, str) for unit in units):
            fail(f"{rid}: units must be a list of strings")
        if len(columns) != len(units):
            fail(f"{rid}: columns/units length mismatch")
        primary = entry.get("primary_column")
        if primary is not None and primary not in columns:
            fail(f"{rid}: primary column is not present in columns")

        _require_string_list(entry, "required_libraries", rid)
        _require_string_list(entry, "hardware", rid, allow_empty=False)
        _require_string_list(entry, "physical_lab_targets", rid, allow_empty=False)
        _require_string_list(entry, "notes", rid, allow_empty=False)

        firmware_rel = Path(str(entry["firmware_path"]))
        firmware = (ROOT / firmware_rel).resolve()
        try:
            firmware.relative_to(FIRMWARE_ROOT.resolve())
        except ValueError:
            fail(f"{rid}: firmware path escapes sensor-suite/firmware")
        expected_rel = Path("sensor-suite") / "firmware" / sketch / f"{sketch}.ino"
        if firmware_rel != expected_rel:
            fail(f"{rid}: firmware path must match sketch_name ({expected_rel})")
        if not firmware.is_file():
            fail(f"{rid}: missing firmware {firmware}")

        source = firmware.read_text(encoding="utf-8")
        if len(re.findall(r"\bvoid\s+setup\s*\(\s*\)", source)) != 1:
            fail(f"{rid}: firmware must contain exactly one setup() definition")
        if len(re.findall(r"\bvoid\s+loop\s*\(\s*\)", source)) != 1:
            fail(f"{rid}: firmware must contain exactly one loop() definition")
        serial_bauds = {int(value) for value in re.findall(r"Serial\.begin\s*\(\s*(\d+)\s*\)", source)}
        if serial_bauds != {baud}:
            fail(f"{rid}: firmware Serial.begin values {sorted(serial_bauds)} do not exactly match catalog baud {baud}")
        _validate_parameters(entry, rid, source)
        expected_targets.add(f"sensor-suite-{rid}.json")

    import install_sensor_suite
    with tempfile.TemporaryDirectory() as tmp:
        destination = Path(tmp)
        first = install_sensor_suite.install(destination)
        if len(first) != EXPECTED_RECIPE_COUNT:
            fail("installer wrote the wrong number of recipes")
        if {path.name for path in first} != expected_targets:
            fail("installer output filenames do not exactly match catalog recipe ids")

        first_hashes: dict[str, str] = {}
        for path in first:
            wrapper = json.loads(path.read_text(encoding="utf-8"), parse_constant=_reject_constant)
            if set(wrapper) != {"spec", "source"}:
                fail(f"{path.name}: invalid user recipe wrapper")
            if not wrapper["spec"].get("user_defined"):
                fail(f"{path.name}: user_defined flag was not set")
            if wrapper["spec"].get("base_recipe_id") is not None:
                fail(f"{path.name}: base_recipe_id must be null for standalone Sensor Suite recipes")
            if wrapper["spec"].get("parameter_values") != {}:
                fail(f"{path.name}: parameter_values must start empty")
            if not wrapper["source"].strip():
                fail(f"{path.name}: source is empty")
            first_hashes[path.name] = hashlib.sha256(path.read_bytes()).hexdigest()

        problems = install_sensor_suite.verify_installation(destination)
        if problems:
            fail(f"fresh installation did not verify: {problems[0]}")

        second = install_sensor_suite.install(destination)
        second_hashes = {path.name: hashlib.sha256(path.read_bytes()).hexdigest() for path in second}
        if first_hashes != second_hashes:
            fail("installer is not deterministic/idempotent on repeated installation")
        if install_sensor_suite.verify_installation(destination):
            fail("repeated installation does not verify exactly")
        if list(destination.glob("*.tmp")) or list(destination.glob(".*.tmp")):
            fail("installer left temporary files behind")

        victim = first[0]
        victim.write_text(victim.read_text(encoding="utf-8") + "corruption\n", encoding="utf-8")
        if not install_sensor_suite.verify_installation(destination):
            fail("installer verification failed to detect a modified managed recipe")

    print(f"Sensor Suite self-check PASS: {len(entries)} frozen recipes across {len(catalogs)} catalogs")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
