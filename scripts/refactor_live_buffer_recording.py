#!/usr/bin/env python3
from __future__ import annotations
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LIB = ROOT / 'src-tauri' / 'src' / 'lib.rs'
MONITOR = ROOT / 'src' / 'MonitorDataStudio.tsx'

lib = LIB.read_text()
original_lib = lib

old_derive = '#[derive(Debug, Clone, Serialize)]\nstruct CapturedRow {'
new_derive = '#[derive(Debug, Clone, Serialize, Deserialize)]\nstruct CapturedRow {'
if lib.count(old_derive) != 1:
    raise SystemExit('CapturedRow derive anchor mismatch')
lib = lib.replace(old_derive, new_derive, 1)

old_metadata = '    producer: String,\n    recipe_id: String,'
new_metadata = '    producer: String,\n    acquisition_mode: String,\n    recipe_id: String,'
if lib.count(old_metadata) != 1:
    raise SystemExit('MeasurementMetadata anchor mismatch')
lib = lib.replace(old_metadata, new_metadata, 1)

pattern = re.compile(
    r'#\[tauri::command\]\nfn capture_measurement\(.*?\n\}\n\n(?=#\[cfg_attr\(mobile, tauri::mobile_entry_point\)\])',
    re.S,
)
new_measurement = r'''fn valid_measurement_rows(recipe: &RecipeSpec, rows: Vec<CapturedRow>) -> Vec<CapturedRow> {
    rows.into_iter()
        .filter(|row| {
            row.numeric
                && row.line.split(',').count() == recipe.columns.len()
                && row
                    .line
                    .split(',')
                    .all(|part| part.trim().parse::<f64>().is_ok())
        })
        .collect::<Vec<_>>()
}

fn write_measurement_package(
    recipe: &RecipeSpec,
    port: &str,
    board_profile: &str,
    acquisition_mode: &str,
    valid_rows: &[CapturedRow],
) -> Result<MeasurementResult, String> {
    if valid_rows.is_empty() {
        return Err("No rows matched the recipe schema; check firmware, baud rate, and selected recipe.".into());
    }

    let now = Utc::now();
    let stamp = format!(
        "{}-{:03}",
        now.format("%Y%m%dT%H%M%SZ"),
        now.timestamp_subsec_millis()
    );
    let dir = measurement_base_dir().join(format!("{}-{stamp}", recipe.id));
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;

    let csv_path = dir.join("data.csv");
    let metadata_path = dir.join("metadata.json");
    let physical_lab_csv_path = dir.join("physical_lab_v1.csv");
    let physical_lab_bridge_path = dir.join("physical_lab_bridge.json");

    let mut csv = fs::File::create(&csv_path).map_err(|e| e.to_string())?;
    writeln!(csv, "{}", recipe.columns.join(",")).map_err(|e| e.to_string())?;
    for row in valid_rows {
        writeln!(csv, "{}", row.line).map_err(|e| e.to_string())?;
    }

    let mut bridge_csv = fs::File::create(&physical_lab_csv_path).map_err(|e| e.to_string())?;
    writeln!(bridge_csv, "timestamp,value").map_err(|e| e.to_string())?;
    for row in valid_rows {
        let value = row.line.split(',').last().unwrap_or_default().trim();
        writeln!(bridge_csv, "{},{}", row.host_timestamp_ms, value).map_err(|e| e.to_string())?;
    }

    let source = embedded_recipe_source(&recipe.id)?;
    let metadata = MeasurementMetadata {
        schema: "betterboard.measurement/0.2".into(),
        created_at_utc: now.to_rfc3339(),
        producer: format!("BetterBoard Studio {APP_VERSION}"),
        acquisition_mode: acquisition_mode.to_string(),
        recipe_id: recipe.id.clone(),
        recipe_title: recipe.title.clone(),
        board_profile: board_profile.to_string(),
        port: port.to_string(),
        baud: recipe.baud,
        columns: recipe.columns.clone(),
        units: recipe.units.clone(),
        primary_column: recipe.primary_column.clone(),
        sample_rate_hz: recipe.sample_rate_hz,
        sample_count: valid_rows.len(),
        firmware_sha256: sha256_text(source),
        physical_lab_targets: recipe.physical_lab_targets.clone(),
        scientific_boundary: recipe.boundary.clone(),
    };
    fs::write(
        &metadata_path,
        serde_json::to_string_pretty(&metadata).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;

    let bridge = serde_json::json!({
        "schema": "betterboard.physical-lab-bridge/0.2",
        "source_type": "desktop-data-bridge",
        "acquisition_mode": acquisition_mode,
        "full_dataset": "data.csv",
        "physical_lab_v1_dataset": "physical_lab_v1.csv",
        "current_physical_lab_v1_contract": "timestamp,value; primary observable is the final numeric firmware field",
        "recipe_id": recipe.id,
        "primary_column": recipe.primary_column,
        "source_units": recipe.units,
        "physical_lab_targets": recipe.physical_lab_targets,
        "scientific_boundary": "Calibration status, sensor accuracy, traceability and experimental validation must be established separately."
    });
    fs::write(
        &physical_lab_bridge_path,
        serde_json::to_string_pretty(&bridge).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;

    Ok(MeasurementResult {
        directory: dir.display().to_string(),
        csv_path: csv_path.display().to_string(),
        metadata_path: metadata_path.display().to_string(),
        physical_lab_csv_path: physical_lab_csv_path.display().to_string(),
        physical_lab_bridge_path: physical_lab_bridge_path.display().to_string(),
        samples: valid_rows.len(),
    })
}

#[tauri::command]
fn capture_measurement(
    port: String,
    duration_ms: u64,
    max_lines: usize,
    board_profile: String,
    recipe_id: String,
) -> Result<MeasurementResult, String> {
    let recipe = recipe_by_id(&recipe_id)?;
    if recipe.capture_mode != "numeric" {
        return Err("This recipe does not produce numeric Measurement Evidence.".into());
    }
    if recipe.columns.is_empty() || recipe.columns.len() != recipe.units.len() {
        return Err("Recipe column/unit schema is invalid.".into());
    }

    let capture = capture_lines(&port, recipe.baud, duration_ms, max_lines, true)?;
    let valid_rows = valid_measurement_rows(&recipe, capture.rows);
    write_measurement_package(
        &recipe,
        &port,
        &board_profile,
        "serial-capture",
        &valid_rows,
    )
}

#[tauri::command]
fn save_measurement_buffer(
    port: String,
    board_profile: String,
    recipe_id: String,
    rows: Vec<CapturedRow>,
) -> Result<MeasurementResult, String> {
    if rows.len() > 100_000 {
        return Err("Live buffer exceeds the 100000-row evidence limit.".into());
    }
    let recipe = recipe_by_id(&recipe_id)?;
    if recipe.capture_mode != "numeric" {
        return Err("This recipe does not define numeric Measurement Evidence.".into());
    }
    if recipe.columns.is_empty() || recipe.columns.len() != recipe.units.len() {
        return Err("Recipe column/unit schema is invalid.".into());
    }

    let valid_rows = valid_measurement_rows(&recipe, rows);
    write_measurement_package(
        &recipe,
        &port,
        &board_profile,
        "live-monitor-buffer",
        &valid_rows,
    )
}

'''
lib, count = pattern.subn(new_measurement, lib, count=1)
if count != 1:
    raise SystemExit(f'capture_measurement block replacement count={count}')

handler_anchor = '            capture_measurement,\n            serial_stream::serial_stream_start,'
handler_replacement = '            capture_measurement,\n            save_measurement_buffer,\n            serial_stream::serial_stream_start,'
if lib.count(handler_anchor) != 1:
    raise SystemExit('handler anchor mismatch')
lib = lib.replace(handler_anchor, handler_replacement, 1)

if lib == original_lib:
    raise SystemExit('Rust refactor made no changes')
LIB.write_text(lib)

monitor = MONITOR.read_text()
original_monitor = monitor

stats_anchor = '''  const maxValue = channelValues.length ? Math.max(...channelValues) : undefined;\n\n  function report(message: string) {'''
stats_replacement = '''  const maxValue = channelValues.length ? Math.max(...channelValues) : undefined;\n  const bufferedEvidenceRows = useMemo(() => rows.filter(row => parseNumericRow(row, recipe?.columns.length ?? 0) !== null), [rows, recipe?.columns.length]);\n\n  function report(message: string) {'''
if monitor.count(stats_anchor) != 1:
    raise SystemExit('monitor stats anchor mismatch')
monitor = monitor.replace(stats_anchor, stats_replacement, 1)

record_pattern = re.compile(
    r'  async function recordMeasurement\(\) \{.*?\n  \}\n\n  const stateLabel',
    re.S,
)
record_replacement = '''  async function recordMeasurement() {
    if (!recipe || recipe.capture_mode !== 'numeric') {
      report('The selected recipe does not define numeric Measurement Evidence.');
      return;
    }
    if (!selectedPort) {
      report('Select a serial device first.');
      return;
    }
    setBusy(true);
    try {
      let result: MeasurementResult;
      if (monitorState === 'live' || monitorState === 'starting') {
        if (!bufferedEvidenceRows.length) {
          report('Live Monitor has no complete recipe-shaped numeric rows to save yet.');
          return;
        }
        report(`Saving ${bufferedEvidenceRows.length} buffered live rows without closing the serial port…`);
        result = await invoke<MeasurementResult>('save_measurement_buffer', {
          port: selectedPort,
          boardProfile: fqbn,
          recipeId: recipe.id,
          rows: bufferedEvidenceRows.map(row => ({
            host_timestamp_ms: row.hostTimestampMs,
            line: row.line,
            numeric: row.numeric,
          })),
        });
      } else {
        report('Recording a new 5 s full multichannel Measurement Package…');
        result = await invoke<MeasurementResult>('capture_measurement', {
          port: selectedPort,
          durationMs: 5000,
          maxLines: 10000,
          boardProfile: fqbn,
          recipeId: recipe.id,
        });
      }
      setMeasurement(result);
      onMeasurement?.(result);
      report(`${result.samples} samples saved · ${result.directory}`);
    } catch (error) {
      report(`Measurement failed: ${error}`);
    } finally {
      setBusy(false);
    }
  }

  const stateLabel'''
monitor, count = record_pattern.subn(record_replacement, monitor, count=1)
if count != 1:
    raise SystemExit(f'recordMeasurement replacement count={count}')

old_desc = 'Live monitoring is for inspection. Measurement recording is the evidence path: full recipe-defined CSV, metadata, and Physical Lab compatibility export.'
new_desc = 'Monitoring and recording now share one evidence path. While Live is running, BetterBoard can save the current structured buffer without closing/reopening the serial port; while stopped, it can acquire a fresh 5 s package.'
if monitor.count(old_desc) != 1:
    raise SystemExit('record description anchor mismatch')
monitor = monitor.replace(old_desc, new_desc, 1)

old_button = '''          <button className="primary" disabled={busy || !selectedPort || recipe?.capture_mode !== 'numeric' || monitorState === 'live' || monitorState === 'starting'} onClick={recordMeasurement}><Save size={15}/> Record 5 s package</button>\n          {monitorState === 'live' && <span className="record-note"><CircleAlert size={14}/> Stop Live Monitor before recording.</span>}'''
new_button = '''          <button className="primary" disabled={busy || !selectedPort || recipe?.capture_mode !== 'numeric' || ((monitorState === 'live' || monitorState === 'starting') && !bufferedEvidenceRows.length)} onClick={recordMeasurement}><Save size={15}/> {monitorState === 'live' || monitorState === 'starting' ? `Save live buffer (${bufferedEvidenceRows.length})` : 'Record new 5 s package'}</button>\n          {(monitorState === 'live' || monitorState === 'starting') && <span className="record-note"><CircleAlert size={14}/> Saving the buffer keeps Live Monitor open and does not reset the board.</span>}'''
if monitor.count(old_button) != 1:
    raise SystemExit('record button anchor mismatch')
monitor = monitor.replace(old_button, new_button, 1)

if monitor == original_monitor:
    raise SystemExit('Monitor refactor made no changes')
if "Stop Live Monitor before recording a Measurement Package" in monitor:
    raise SystemExit('stale stop-before-recording behavior remains')
if "save_measurement_buffer" not in monitor:
    raise SystemExit('live buffer save invoke missing')
MONITOR.write_text(monitor)

print('refactored Rust measurement writer + live monitor buffer saving')
