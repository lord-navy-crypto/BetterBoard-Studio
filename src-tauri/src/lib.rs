use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::{
    fs,
    io::{BufRead, BufReader, Write},
    path::{Path, PathBuf},
    process::Command,
    time::{Duration, Instant},
};

const APP_VERSION: &str = "0.2.0-alpha.1";
const RECIPE_CATALOG_JSON: &str = include_str!("../resources/recipes/catalog.json");
const BOARD_CATALOG_JSON: &str = include_str!("../resources/boards/boards.json");
const DEVICE_CATALOG_JSON: &str = include_str!("../resources/devices/devices.json");
const PHYSICAL_LAB_MAP: &str = include_str!("../resources/physical-lab/PHYSICAL_LAB_HARDWARE_MAP.md");
const PHYSERIAL_V02: &str = include_str!("../resources/physical-lab/PHYSERIAL_V0_2.md");
const HONEYCOMB_GUIDE: &str = include_str!("../resources/physical-lab/HONEYCOMB_MECHANICAL_ANALOGUE.md");

#[derive(Debug, Serialize)]
struct CliInfo {
    found: bool,
    path: Option<String>,
    version: Option<String>,
    error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
struct BoardPort {
    port: String,
    protocol: String,
    board_name: Option<String>,
    fqbn: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct BoardProfile {
    id: String,
    label: String,
    fqbn: String,
    core: String,
    default_baud: u32,
    notes: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct RecipeSpec {
    id: String,
    title: String,
    category: String,
    description: String,
    sketch_name: String,
    capture_mode: String,
    baud: u32,
    columns: Vec<String>,
    units: Vec<String>,
    primary_column: Option<String>,
    sample_rate_hz: Option<f64>,
    required_libraries: Vec<String>,
    hardware: Vec<String>,
    physical_lab_targets: Vec<String>,
    notes: Vec<String>,
    boundary: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct DeviceSpec {
    id: String,
    name: String,
    interface: String,
    quantities: Vec<String>,
    units: Vec<String>,
    libraries: Vec<String>,
    status: String,
}

#[derive(Debug, Serialize)]
struct PreflightResult {
    cli_ready: bool,
    core: String,
    core_installed: bool,
    required_libraries: Vec<String>,
    missing_libraries: Vec<String>,
    warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
struct CapturedRow {
    host_timestamp_ms: i64,
    line: String,
    numeric: bool,
}

#[derive(Debug, Serialize)]
struct CaptureResult {
    lines: Vec<String>,
    rows: Vec<CapturedRow>,
    numeric_rows: usize,
    ignored_rows: usize,
}

#[derive(Debug, Serialize)]
struct MeasurementResult {
    directory: String,
    csv_path: String,
    metadata_path: String,
    physical_lab_csv_path: String,
    physical_lab_bridge_path: String,
    samples: usize,
}

#[derive(Debug, Serialize, Deserialize)]
struct MeasurementMetadata {
    schema: String,
    created_at_utc: String,
    producer: String,
    recipe_id: String,
    recipe_title: String,
    board_profile: String,
    port: String,
    baud: u32,
    columns: Vec<String>,
    units: Vec<String>,
    primary_column: Option<String>,
    sample_rate_hz: Option<f64>,
    sample_count: usize,
    firmware_sha256: String,
    physical_lab_targets: Vec<String>,
    scientific_boundary: String,
}

#[derive(Debug, Serialize)]
struct BridgeDocs {
    hardware_map: String,
    serial_protocol: String,
    honeycomb_guide: String,
}

fn recipe_catalog_value() -> Result<Vec<RecipeSpec>, String> {
    serde_json::from_str(RECIPE_CATALOG_JSON)
        .map_err(|e| format!("Invalid embedded recipe catalog: {e}"))
}

fn board_catalog_value() -> Result<Vec<BoardProfile>, String> {
    serde_json::from_str(BOARD_CATALOG_JSON)
        .map_err(|e| format!("Invalid embedded board catalog: {e}"))
}

fn device_catalog_value() -> Result<Vec<DeviceSpec>, String> {
    serde_json::from_str(DEVICE_CATALOG_JSON)
        .map_err(|e| format!("Invalid embedded device catalog: {e}"))
}

fn recipe_by_id(id: &str) -> Result<RecipeSpec, String> {
    recipe_catalog_value()?
        .into_iter()
        .find(|recipe| recipe.id == id)
        .ok_or_else(|| format!("Unknown recipe: {id}"))
}

fn embedded_recipe_source(id: &str) -> Result<&'static str, String> {
    match id {
        "blink" => Ok(include_str!("../resources/firmware/Blink_LED/Blink_LED.ino")),
        "synthetic" => Ok(include_str!("../resources/firmware/SyntheticSignal/SyntheticSignal.ino")),
        "analog_a0" => Ok(include_str!("../resources/firmware/AnalogDAQ/AnalogDAQ.ino")),
        "magnetic_mlx90393" => Ok(include_str!("../resources/firmware/MagneticField_MLX90393/MagneticField_MLX90393.ino")),
        "acceleration_adxl345" => Ok(include_str!("../resources/firmware/Accelerometer_ADXL345/Accelerometer_ADXL345.ino")),
        "photogate" => Ok(include_str!("../resources/firmware/PhotogateTimer/PhotogateTimer.ino")),
        "quadrature_encoder" => Ok(include_str!("../resources/firmware/QuadratureEncoder/QuadratureEncoder.ino")),
        "pulse_rpm" => Ok(include_str!("../resources/firmware/PulseRPM/PulseRPM.ino")),
        "random_walk_robot" => Ok(include_str!("../resources/firmware/RandomWalkRobot/RandomWalkRobot.ino")),
        "i2c_scanner" => Ok(include_str!("../resources/firmware/I2CScanner/I2CScanner.ino")),
        _ => Err(format!("No embedded firmware source for recipe: {id}")),
    }
}

fn sha256_text(text: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(text.as_bytes());
    format!("{:x}", hasher.finalize())
}

fn find_cli() -> Result<PathBuf, String> {
    if let Ok(custom) = std::env::var("ARDUINO_CLI") {
        let path = PathBuf::from(custom);
        if path.is_file() {
            return Ok(path);
        }
    }
    for candidate in [
        "/opt/homebrew/bin/arduino-cli",
        "/usr/local/bin/arduino-cli",
        "/usr/bin/arduino-cli",
    ] {
        let path = PathBuf::from(candidate);
        if path.is_file() {
            return Ok(path);
        }
    }
    let out = Command::new("/usr/bin/env")
        .args(["sh", "-lc", "command -v arduino-cli"])
        .output()
        .map_err(|e| e.to_string())?;
    if out.status.success() {
        let value = String::from_utf8_lossy(&out.stdout).trim().to_string();
        if !value.is_empty() {
            return Ok(PathBuf::from(value));
        }
    }
    Err("arduino-cli was not found. BetterBoard does not reinstall it automatically; set ARDUINO_CLI or install it separately.".into())
}

fn run_cli(args: &[String]) -> Result<String, String> {
    let cli = find_cli()?;
    let out = Command::new(cli)
        .args(args)
        .output()
        .map_err(|e| e.to_string())?;
    let stdout = String::from_utf8_lossy(&out.stdout).to_string();
    let stderr = String::from_utf8_lossy(&out.stderr).to_string();
    if out.status.success() {
        Ok(if stdout.trim().is_empty() { stderr } else { stdout })
    } else {
        Err(format!("{}{}", stdout, stderr).trim().to_string())
    }
}

fn run_cli_static(args: &[&str]) -> Result<String, String> {
    run_cli(&args.iter().map(|v| (*v).to_string()).collect::<Vec<_>>())
}

#[tauri::command]
fn arduino_cli_discovery() -> CliInfo {
    match find_cli() {
        Ok(path) => {
            let version = Command::new(&path)
                .arg("version")
                .output()
                .ok()
                .map(|output| String::from_utf8_lossy(&output.stdout).trim().to_string())
                .filter(|value| !value.is_empty());
            CliInfo {
                found: true,
                path: Some(path.display().to_string()),
                version,
                error: None,
            }
        }
        Err(error) => CliInfo {
            found: false,
            path: None,
            version: None,
            error: Some(error),
        },
    }
}

#[tauri::command]
fn board_list() -> Result<Vec<BoardPort>, String> {
    let raw = run_cli_static(&["board", "list", "--format", "json"])?;
    let value: Value = serde_json::from_str(&raw)
        .map_err(|e| format!("Could not parse arduino-cli board JSON: {e}"))?;
    let entries: Vec<&Value> = if let Some(items) = value.as_array() {
        items.iter().collect()
    } else if let Some(items) = value.get("detected_ports").and_then(Value::as_array) {
        items.iter().collect()
    } else {
        Vec::new()
    };

    let mut result = Vec::new();
    for entry in entries {
        let port_obj = entry.get("port").unwrap_or(entry);
        let port = port_obj
            .get("address")
            .or_else(|| port_obj.get("label"))
            .or_else(|| entry.get("address"))
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string();
        if port.is_empty() {
            continue;
        }
        let protocol = port_obj
            .get("protocol")
            .or_else(|| entry.get("protocol"))
            .and_then(Value::as_str)
            .unwrap_or("serial")
            .to_string();
        let boards = entry.get("matching_boards").and_then(Value::as_array);
        let board_name = boards
            .and_then(|items| items.first())
            .and_then(|item| item.get("name"))
            .and_then(Value::as_str)
            .map(str::to_string);
        let fqbn = boards
            .and_then(|items| items.first())
            .and_then(|item| item.get("fqbn"))
            .and_then(Value::as_str)
            .map(str::to_string);
        result.push(BoardPort {
            port,
            protocol,
            board_name,
            fqbn,
        });
    }
    Ok(result)
}

#[tauri::command]
fn recipe_catalog() -> Result<Vec<RecipeSpec>, String> {
    recipe_catalog_value()
}

#[tauri::command]
fn board_profiles() -> Result<Vec<BoardProfile>, String> {
    board_catalog_value()
}

#[tauri::command]
fn device_catalog() -> Result<Vec<DeviceSpec>, String> {
    device_catalog_value()
}

#[tauri::command]
fn recipe_source(recipe_id: String) -> Result<String, String> {
    Ok(embedded_recipe_source(&recipe_id)?.to_string())
}

#[tauri::command]
fn physical_lab_bridge_docs() -> BridgeDocs {
    BridgeDocs {
        hardware_map: PHYSICAL_LAB_MAP.to_string(),
        serial_protocol: PHYSERIAL_V02.to_string(),
        honeycomb_guide: HONEYCOMB_GUIDE.to_string(),
    }
}

fn sketch_root(recipe: &RecipeSpec) -> Result<PathBuf, String> {
    let base = std::env::temp_dir()
        .join("betterboard-studio")
        .join("v0.2")
        .join(&recipe.sketch_name);
    fs::create_dir_all(&base).map_err(|e| e.to_string())?;
    Ok(base)
}

#[tauri::command]
fn prepare_recipe(recipe_id: String) -> Result<String, String> {
    let recipe = recipe_by_id(&recipe_id)?;
    let source = embedded_recipe_source(&recipe_id)?;
    let root = sketch_root(&recipe)?;
    let file = root.join(format!("{}.ino", recipe.sketch_name));
    fs::write(&file, source).map_err(|e| e.to_string())?;
    Ok(root.display().to_string())
}

#[tauri::command]
fn compile_sketch(sketch_dir: String, fqbn: String) -> Result<String, String> {
    if !Path::new(&sketch_dir).exists() {
        return Err("Sketch directory does not exist".into());
    }
    run_cli(&[
        "compile".into(),
        "--fqbn".into(),
        fqbn,
        sketch_dir,
    ])
}

#[tauri::command]
fn upload_sketch(sketch_dir: String, fqbn: String, port: String) -> Result<String, String> {
    if !Path::new(&sketch_dir).exists() {
        return Err("Sketch directory does not exist".into());
    }
    run_cli(&[
        "upload".into(),
        "-p".into(),
        port,
        "--fqbn".into(),
        fqbn,
        sketch_dir,
    ])
}

fn core_from_fqbn(fqbn: &str) -> String {
    let mut parts = fqbn.split(':');
    match (parts.next(), parts.next()) {
        (Some(vendor), Some(arch)) => format!("{vendor}:{arch}"),
        _ => fqbn.to_string(),
    }
}

#[tauri::command]
fn recipe_preflight(recipe_id: String, fqbn: String) -> Result<PreflightResult, String> {
    let recipe = recipe_by_id(&recipe_id)?;
    let cli_ready = find_cli().is_ok();
    let core = core_from_fqbn(&fqbn);
    let mut warnings = Vec::new();
    if !cli_ready {
        return Ok(PreflightResult {
            cli_ready,
            core,
            core_installed: false,
            required_libraries: recipe.required_libraries.clone(),
            missing_libraries: recipe.required_libraries,
            warnings: vec!["Arduino CLI is unavailable; BetterBoard will not attempt an automatic reinstall.".into()],
        });
    }

    let core_text = run_cli_static(&["core", "list", "--format", "json"])
        .or_else(|_| run_cli_static(&["core", "list"]))
        .unwrap_or_default()
        .to_lowercase();
    let core_installed = core_text.contains(&core.to_lowercase());
    if !core_installed {
        warnings.push(format!("Board core {core} was not found in arduino-cli core list."));
    }

    let library_text = run_cli_static(&["lib", "list", "--format", "json"])
        .or_else(|_| run_cli_static(&["lib", "list"]))
        .unwrap_or_default()
        .to_lowercase();
    let missing_libraries = recipe
        .required_libraries
        .iter()
        .filter(|name| !library_text.contains(&name.to_lowercase()))
        .cloned()
        .collect::<Vec<_>>();
    if !missing_libraries.is_empty() {
        warnings.push("One or more recipe libraries are missing. BetterBoard reports them but does not reinstall existing packages automatically.".into());
    }
    if recipe.id == "random_walk_robot" {
        warnings.push("Motor driver pins are placeholders until the exact driver is identified.".into());
    }
    if recipe.id == "acceleration_adxl345" {
        warnings.push("Do not assume the photographed XYZ module is ADXL345 until its exact marking/pinout is confirmed.".into());
    }

    Ok(PreflightResult {
        cli_ready,
        core,
        core_installed,
        required_libraries: recipe.required_libraries,
        missing_libraries,
        warnings,
    })
}

fn capture_lines(
    port: &str,
    baud: u32,
    duration_ms: u64,
    max_lines: usize,
    numeric_only: bool,
) -> Result<CaptureResult, String> {
    if duration_ms == 0 || duration_ms > 300_000 {
        return Err("duration_ms must be 1..300000".into());
    }
    if max_lines == 0 || max_lines > 100_000 {
        return Err("max_lines must be 1..100000".into());
    }
    if !(port.starts_with("/dev/cu.") || port.starts_with("/dev/tty.") || cfg!(not(target_os = "macos"))) {
        return Err("On macOS BetterBoard accepts serial devices under /dev/cu.* or /dev/tty.*.".into());
    }

    let serial = serialport::new(port, baud)
        .timeout(Duration::from_millis(120))
        .open()
        .map_err(|e| format!("Could not open serial port {port}: {e}"))?;

    // Many AVR USB-serial boards reset when the port opens.
    std::thread::sleep(Duration::from_millis(1600));
    let mut reader = BufReader::new(serial);
    let started = Instant::now();
    let mut rows = Vec::new();
    let mut ignored = 0usize;

    while started.elapsed() < Duration::from_millis(duration_ms) && rows.len() < max_lines {
        let mut line = String::new();
        match reader.read_line(&mut line) {
            Ok(0) => continue,
            Ok(_) => {
                let value = line.trim();
                if value.is_empty() {
                    continue;
                }
                let numeric = value
                    .split(',')
                    .all(|part| part.trim().parse::<f64>().is_ok());
                if numeric_only && !numeric {
                    ignored += 1;
                    continue;
                }
                rows.push(CapturedRow {
                    host_timestamp_ms: Utc::now().timestamp_millis(),
                    line: value.to_string(),
                    numeric,
                });
            }
            Err(e) if e.kind() == std::io::ErrorKind::TimedOut => continue,
            Err(e) => return Err(e.to_string()),
        }
    }

    let numeric_rows = rows.iter().filter(|row| row.numeric).count();
    let lines = rows.iter().map(|row| row.line.clone()).collect::<Vec<_>>();
    Ok(CaptureResult {
        lines,
        rows,
        numeric_rows,
        ignored_rows: ignored,
    })
}

#[tauri::command]
fn serial_capture(
    port: String,
    baud: u32,
    duration_ms: u64,
    max_lines: usize,
    numeric_only: bool,
) -> Result<CaptureResult, String> {
    capture_lines(&port, baud, duration_ms, max_lines, numeric_only)
}

fn measurement_base_dir() -> PathBuf {
    if let Ok(home) = std::env::var("HOME") {
        return PathBuf::from(home)
            .join("Documents")
            .join("BetterBoard")
            .join("measurements");
    }
    std::env::temp_dir().join("BetterBoard").join("measurements")
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
    let valid_rows = capture
        .rows
        .iter()
        .filter(|row| row.numeric && row.line.split(',').count() == recipe.columns.len())
        .collect::<Vec<_>>();
    if valid_rows.is_empty() {
        return Err("No rows matched the recipe schema; check firmware, baud rate, and selected recipe.".into());
    }

    let stamp = Utc::now().format("%Y%m%dT%H%M%SZ").to_string();
    let dir = measurement_base_dir().join(format!("{}-{stamp}", recipe.id));
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;

    let csv_path = dir.join("data.csv");
    let metadata_path = dir.join("metadata.json");
    let physical_lab_csv_path = dir.join("physical_lab_v1.csv");
    let physical_lab_bridge_path = dir.join("physical_lab_bridge.json");

    let mut csv = fs::File::create(&csv_path).map_err(|e| e.to_string())?;
    writeln!(csv, "{}", recipe.columns.join(",")).map_err(|e| e.to_string())?;
    for row in &valid_rows {
        writeln!(csv, "{}", row.line).map_err(|e| e.to_string())?;
    }

    // Physical Lab's current serial-capture contract consumes the last CSV field as the
    // primary observable and stores timestamp,value. Preserve that compatibility export
    // while the full BetterBoard CSV keeps every channel.
    let mut bridge_csv = fs::File::create(&physical_lab_csv_path).map_err(|e| e.to_string())?;
    writeln!(bridge_csv, "timestamp,value").map_err(|e| e.to_string())?;
    for row in &valid_rows {
        let value = row.line.split(',').last().unwrap_or_default().trim();
        writeln!(bridge_csv, "{},{}", row.host_timestamp_ms, value).map_err(|e| e.to_string())?;
    }

    let source = embedded_recipe_source(&recipe.id)?;
    let metadata = MeasurementMetadata {
        schema: "betterboard.measurement/0.2".into(),
        created_at_utc: Utc::now().to_rfc3339(),
        producer: format!("BetterBoard Studio {APP_VERSION}"),
        recipe_id: recipe.id.clone(),
        recipe_title: recipe.title.clone(),
        board_profile,
        port: port.clone(),
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            arduino_cli_discovery,
            board_list,
            recipe_catalog,
            board_profiles,
            device_catalog,
            recipe_source,
            physical_lab_bridge_docs,
            prepare_recipe,
            compile_sketch,
            upload_sketch,
            recipe_preflight,
            serial_capture,
            capture_measurement,
        ])
        .run(tauri::generate_context!())
        .expect("error while running BetterBoard Studio");
}
