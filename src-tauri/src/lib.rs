mod openguin_bridge;
mod serial_stream;
mod ide_manager;

use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::{
    collections::BTreeMap,
    fs,
    io::{BufRead, BufReader, Write},
    path::{Path, PathBuf},
    process::Command,
    time::{Duration, Instant},
};

const APP_VERSION: &str = "0.2.0-alpha.4";
const RECIPE_CATALOG_JSON: &str = include_str!("../resources/recipes/catalog.json");
const BOARD_CATALOG_JSON: &str = include_str!("../resources/boards/boards.json");
const DEVICE_CATALOG_JSON: &str = include_str!("../resources/devices/devices.json");
const PHYSICAL_LAB_MAP: &str =
    include_str!("../resources/physical-lab/PHYSICAL_LAB_HARDWARE_MAP.md");
const PHYSERIAL_V02: &str = include_str!("../resources/physical-lab/PHYSERIAL_V0_2.md");
const HONEYCOMB_GUIDE: &str =
    include_str!("../resources/physical-lab/HONEYCOMB_MECHANICAL_ANALOGUE.md");

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
struct RecipeParameterSpec {
    key: String,
    label: String,
    kind: String,
    default_value: String,
    #[serde(default)] min: Option<f64>,
    #[serde(default)] max: Option<f64>,
    #[serde(default)] step: Option<f64>,
    #[serde(default)] unit: Option<String>,
    macro_name: String,
    #[serde(default)] choices: Vec<String>,
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
    #[serde(default)] parameters: Vec<RecipeParameterSpec>,
    #[serde(default)] user_defined: bool,
    #[serde(default)] base_recipe_id: Option<String>,
    #[serde(default)] parameter_values: BTreeMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct UserRecipeFile {
    spec: RecipeSpec,
    source: String,
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

#[derive(Debug, Clone, Serialize, Deserialize)]
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
    acquisition_mode: String,
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
    #[serde(default)]
    recipe_parameters: BTreeMap<String, String>,
    physical_lab_targets: Vec<String>,
    scientific_boundary: String,
}

#[derive(Debug, Clone, Serialize)]
struct MeasurementSessionSummary {
    directory: String,
    created_at_utc: String,
    recipe_id: String,
    recipe_title: String,
    acquisition_mode: String,
    board_profile: String,
    port: String,
    sample_count: usize,
    csv_path: String,
    metadata_path: String,
    physical_lab_csv_path: String,
    physical_lab_bridge_path: String,
}

#[derive(Debug, Serialize)]
struct MeasurementReplay {
    session: MeasurementSessionSummary,
    columns: Vec<String>,
    units: Vec<String>,
    primary_column: Option<String>,
    sample_rate_hz: Option<f64>,
    rows: Vec<CapturedRow>,
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

fn user_recipe_base_dir() -> PathBuf {
    if let Ok(home) = std::env::var("HOME") {
        return PathBuf::from(home).join("Documents").join("BetterBoard").join("library");
    }
    std::env::temp_dir().join("BetterBoard").join("library")
}

fn load_user_recipe_files() -> Vec<UserRecipeFile> {
    let base = user_recipe_base_dir();
    if fs::create_dir_all(&base).is_err() { return Vec::new(); }
    let mut result = fs::read_dir(base).ok().into_iter().flatten().filter_map(Result::ok)
        .map(|entry| entry.path()).filter(|path| path.extension().and_then(|value| value.to_str()) == Some("json"))
        .filter_map(|path| fs::read_to_string(path).ok())
        .filter_map(|text| serde_json::from_str::<UserRecipeFile>(&text).ok()).collect::<Vec<_>>();
    result.sort_by(|a, b| a.spec.title.cmp(&b.spec.title));
    result
}

fn recipe_catalog_all() -> Result<Vec<RecipeSpec>, String> {
    let mut catalog = recipe_catalog_value()?;
    catalog.extend(load_user_recipe_files().into_iter().map(|entry| entry.spec));
    Ok(catalog)
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
    recipe_catalog_all()?.into_iter().find(|recipe| recipe.id == id)
        .ok_or_else(|| format!("Unknown recipe: {id}"))
}

fn user_recipe_by_id(id: &str) -> Option<UserRecipeFile> {
    load_user_recipe_files().into_iter().find(|entry| entry.spec.id == id)
}

fn embedded_recipe_source(id: &str) -> Result<&'static str, String> {
    match id {
        "blink" => Ok(include_str!("../resources/firmware/Blink_LED/Blink_LED.ino")),
        "synthetic" => Ok(include_str!("../resources/firmware/SyntheticSignal/SyntheticSignal.ino")),
        "analog_a0" => Ok(include_str!("../resources/firmware/AnalogDAQ/AnalogDAQ.ino")),
        "numerical_embedded" => Ok(include_str!("../resources/firmware/EmbeddedNumericalReliability/EmbeddedNumericalReliability.ino")),
        "numerical_derivative" => Ok(include_str!("../resources/firmware/NumericalDerivativeSweep/NumericalDerivativeSweep.ino")),
        "numerical_cancellation" => Ok(include_str!("../resources/firmware/NumericalCancellation/NumericalCancellation.ino")),
        "numerical_accumulation" => Ok(include_str!("../resources/firmware/NumericalAccumulation/NumericalAccumulation.ino")),
        "mpu6050_numerics" => Ok(include_str!("../resources/firmware/MPU6050Numerics/MPU6050Numerics.ino")),
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

fn recipe_source_text(id: &str) -> Result<String, String> {
    if let Some(user) = user_recipe_by_id(id) { return Ok(user.source); }
    Ok(embedded_recipe_source(id)?.to_string())
}

fn normalize_parameter_value(spec: &RecipeParameterSpec, raw: &str) -> Result<String, String> {
    match spec.kind.as_str() {
        "integer" => {
            let value = raw.trim().parse::<i64>().map_err(|_| format!("{} must be an integer", spec.label))?;
            let number = value as f64;
            if spec.min.is_some_and(|min| number < min) || spec.max.is_some_and(|max| number > max) {
                return Err(format!("{} is outside its allowed range", spec.label));
            }
            Ok(value.to_string())
        }
        "number" => {
            let value = raw.trim().parse::<f64>().map_err(|_| format!("{} must be numeric", spec.label))?;
            if !value.is_finite() { return Err(format!("{} must be finite", spec.label)); }
            if spec.min.is_some_and(|min| value < min) || spec.max.is_some_and(|max| value > max) {
                return Err(format!("{} is outside its allowed range", spec.label));
            }
            let mut text = format!("{value:.12}");
            while text.contains('.') && text.ends_with('0') { text.pop(); }
            if text.ends_with('.') { text.push('0'); }
            Ok(text)
        }
        "select" => {
            if !spec.choices.iter().any(|choice| choice == raw) { return Err(format!("{} has an unsupported choice", spec.label)); }
            Ok(raw.to_string())
        }
        other => Err(format!("Unsupported parameter kind: {other}")),
    }
}

fn normalized_parameter_values(recipe: &RecipeSpec, provided: &BTreeMap<String, String>) -> Result<BTreeMap<String, String>, String> {
    for key in provided.keys() {
        if !recipe.parameters.iter().any(|spec| &spec.key == key) { return Err(format!("Unknown parameter for {}: {key}", recipe.title)); }
    }
    let mut result = BTreeMap::new();
    for spec in &recipe.parameters {
        let raw = provided.get(&spec.key).or_else(|| recipe.parameter_values.get(&spec.key)).map(String::as_str).unwrap_or(&spec.default_value);
        result.insert(spec.key.clone(), normalize_parameter_value(spec, raw)?);
    }
    Ok(result)
}

fn render_recipe_source(recipe: &RecipeSpec, provided: &BTreeMap<String, String>) -> Result<String, String> {
    let source = recipe_source_text(&recipe.id)?;
    let values = normalized_parameter_values(recipe, provided)?;
    if values.is_empty() { return Ok(source); }
    let mut prefix = String::from("// BetterBoard compile-time recipe overrides\n");
    for spec in &recipe.parameters {
        let value = values.get(&spec.key).ok_or_else(|| format!("Missing normalized parameter {}", spec.key))?;
        prefix.push_str(&format!("#define {} {}\n", spec.macro_name, value));
    }
    prefix.push('\n');
    prefix.push_str(&source);
    Ok(prefix)
}

fn effective_sample_rate(recipe: &RecipeSpec, values: &BTreeMap<String, String>) -> Option<f64> {
    if let Some(raw) = values.get("sample_interval_us") {
        if let Ok(us) = raw.parse::<f64>() { if us > 0.0 { return Some(1_000_000.0 / us); } }
    }
    recipe.sample_rate_hz
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
        Ok(if stdout.trim().is_empty() {
            stderr
        } else {
            stdout
        })
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
    recipe_catalog_all()
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
    recipe_source_text(&recipe_id)
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

fn write_prepared_recipe(recipe: &RecipeSpec, parameter_values: &BTreeMap<String, String>) -> Result<String, String> {
    let source = render_recipe_source(recipe, parameter_values)?;
    let root = sketch_root(recipe)?;
    let file = root.join(format!("{}.ino", recipe.sketch_name));
    fs::write(&file, source).map_err(|e| e.to_string())?;
    Ok(root.display().to_string())
}

#[tauri::command]
fn prepare_recipe(recipe_id: String) -> Result<String, String> {
    let recipe = recipe_by_id(&recipe_id)?;
    write_prepared_recipe(&recipe, &BTreeMap::new())
}

#[tauri::command]
fn prepare_recipe_with_params(recipe_id: String, parameter_values: BTreeMap<String, String>) -> Result<String, String> {
    let recipe = recipe_by_id(&recipe_id)?;
    write_prepared_recipe(&recipe, &parameter_values)
}

#[tauri::command]
fn user_recipe_save(title: String, base_recipe_id: String, source: Option<String>, parameter_values: BTreeMap<String, String>) -> Result<RecipeSpec, String> {
    let title = title.trim();
    if title.is_empty() || title.len() > 120 { return Err("User recipe title must be 1..120 characters.".into()); }
    let base_id = base_recipe_id.trim();
    let (mut spec, inherited_source) = if base_id.is_empty() {
        (RecipeSpec {
            id: String::new(), title: title.to_string(), category: "My Library".into(),
            description: "User-authored Arduino sketch saved from BetterBoard Developer.".into(),
            sketch_name: sanitize_developer_sketch_name(title), capture_mode: "none".into(), baud: 115200,
            columns: Vec::new(), units: Vec::new(), primary_column: None, sample_rate_hz: None,
            required_libraries: Vec::new(), hardware: vec!["User-defined hardware".into()],
            physical_lab_targets: Vec::new(), notes: vec!["User-authored recipe; verify its hardware assumptions before use.".into()],
            boundary: "User-authored firmware has no automatic measurement/calibration claim.".into(), parameters: Vec::new(),
            user_defined: true, base_recipe_id: None, parameter_values: BTreeMap::new(),
        }, source.clone().unwrap_or_default())
    } else {
        let base = recipe_by_id(base_id)?;
        let inherited = recipe_source_text(base_id)?;
        let mut derived = base.clone();
        derived.base_recipe_id = Some(base.id.clone());
        derived.description = format!("User recipe derived from {}.", base.title);
        (derived, inherited)
    };
    let source_text = source.unwrap_or(inherited_source);
    if source_text.trim().is_empty() { return Err("User recipe source is empty.".into()); }
    if source_text.len() > 2_000_000 { return Err("User recipe source exceeds the 2 MB limit.".into()); }
    let normalized = normalized_parameter_values(&spec, &parameter_values)?;
    let slug = sanitize_developer_sketch_name(title);
    let id = format!("user_{}_{}", slug.to_lowercase(), Utc::now().timestamp_millis());
    spec.id = id.clone();
    spec.title = title.to_string();
    spec.category = "My Library".into();
    spec.sketch_name = slug;
    spec.user_defined = true;
    spec.parameter_values = normalized;
    let file = UserRecipeFile { spec: spec.clone(), source: source_text };
    let base = user_recipe_base_dir();
    fs::create_dir_all(&base).map_err(|e| e.to_string())?;
    let path = base.join(format!("{id}.json"));
    fs::write(&path, serde_json::to_string_pretty(&file).map_err(|e| e.to_string())?)
        .map_err(|e| format!("Could not save user recipe {}: {e}", path.display()))?;
    Ok(spec)
}

fn developer_sketch_base_dir() -> PathBuf {
    if let Ok(home) = std::env::var("HOME") {
        return PathBuf::from(home)
            .join("Documents")
            .join("BetterBoard")
            .join("sketches");
    }
    std::env::temp_dir().join("BetterBoard").join("sketches")
}

fn sanitize_developer_sketch_name(raw: &str) -> String {
    let mut name = raw
        .trim()
        .chars()
        .map(|ch| if ch.is_ascii_alphanumeric() || ch == '_' { ch } else { '_' })
        .take(64)
        .collect::<String>();
    if name.is_empty() {
        name = "BetterBoardSketch".into();
    }
    if !name.chars().next().is_some_and(|ch| ch.is_ascii_alphabetic() || ch == '_') {
        name = format!("Sketch_{name}");
    }
    name
}

#[tauri::command]
fn developer_sketch_save(sketch_name: String, source: String) -> Result<String, String> {
    if source.len() > 2_000_000 {
        return Err("Developer sketch source exceeds the 2 MB editor limit.".into());
    }
    if source.trim().is_empty() {
        return Err("Developer sketch source is empty.".into());
    }
    let name = sanitize_developer_sketch_name(&sketch_name);
    let base = developer_sketch_base_dir();
    fs::create_dir_all(&base).map_err(|e| e.to_string())?;
    let root = base.join(&name);
    fs::create_dir_all(&root).map_err(|e| e.to_string())?;
    let file = root.join(format!("{name}.ino"));
    fs::write(&file, source).map_err(|e| format!("Could not save {}: {e}", file.display()))?;
    Ok(root.display().to_string())
}

#[tauri::command]
fn compile_sketch(sketch_dir: String, fqbn: String) -> Result<String, String> {
    if !Path::new(&sketch_dir).exists() {
        return Err("Sketch directory does not exist".into());
    }
    run_cli(&["compile".into(), "--fqbn".into(), fqbn, sketch_dir])
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
            warnings: vec![
                "Arduino CLI is unavailable; BetterBoard will not attempt an automatic reinstall."
                    .into(),
            ],
        });
    }

    let core_text = run_cli_static(&["core", "list", "--format", "json"])
        .or_else(|_| run_cli_static(&["core", "list"]))
        .unwrap_or_default()
        .to_lowercase();
    let core_installed = core_text.contains(&core.to_lowercase());
    if !core_installed {
        warnings.push(format!(
            "Board core {core} was not found in arduino-cli core list."
        ));
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
        warnings.push(
            "Motor driver pins are placeholders until the exact driver is identified.".into(),
        );
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
    if !(port.starts_with("/dev/cu.")
        || port.starts_with("/dev/tty.")
        || cfg!(not(target_os = "macos")))
    {
        return Err(
            "On macOS BetterBoard accepts serial devices under /dev/cu.* or /dev/tty.*.".into(),
        );
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
    std::env::temp_dir()
        .join("BetterBoard")
        .join("measurements")
}

fn measurement_summary_from_dir(dir: &Path) -> Result<MeasurementSessionSummary, String> {
    let metadata_path = dir.join("metadata.json");
    let metadata_text = fs::read_to_string(&metadata_path)
        .map_err(|e| format!("Could not read {}: {e}", metadata_path.display()))?;
    let metadata: MeasurementMetadata = serde_json::from_str(&metadata_text).map_err(|e| {
        format!(
            "Invalid measurement metadata in {}: {e}",
            metadata_path.display()
        )
    })?;

    Ok(MeasurementSessionSummary {
        directory: dir.display().to_string(),
        created_at_utc: metadata.created_at_utc,
        recipe_id: metadata.recipe_id,
        recipe_title: metadata.recipe_title,
        acquisition_mode: metadata.acquisition_mode,
        board_profile: metadata.board_profile,
        port: metadata.port,
        sample_count: metadata.sample_count,
        csv_path: dir.join("data.csv").display().to_string(),
        metadata_path: metadata_path.display().to_string(),
        physical_lab_csv_path: dir.join("physical_lab_v1.csv").display().to_string(),
        physical_lab_bridge_path: dir.join("physical_lab_bridge.json").display().to_string(),
    })
}

fn validated_measurement_dir(directory: &str) -> Result<PathBuf, String> {
    let base = measurement_base_dir();
    fs::create_dir_all(&base).map_err(|e| e.to_string())?;
    let base = fs::canonicalize(&base).map_err(|e| e.to_string())?;
    let requested = fs::canonicalize(directory)
        .map_err(|e| format!("Measurement session does not exist: {e}"))?;
    if !requested.starts_with(&base) || !requested.is_dir() {
        return Err("Replay is restricted to BetterBoard measurement session directories.".into());
    }
    Ok(requested)
}

#[tauri::command]
fn measurement_sessions(limit: usize) -> Result<Vec<MeasurementSessionSummary>, String> {
    if limit == 0 || limit > 200 {
        return Err("limit must be within 1..200".into());
    }
    let base = measurement_base_dir();
    if !base.exists() {
        return Ok(Vec::new());
    }

    let mut sessions = fs::read_dir(&base)
        .map_err(|e| format!("Could not read measurement history: {e}"))?
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .filter(|path| path.is_dir())
        .filter_map(|path| measurement_summary_from_dir(&path).ok())
        .collect::<Vec<_>>();
    sessions.sort_by(|a, b| b.created_at_utc.cmp(&a.created_at_utc));
    sessions.truncate(limit);
    Ok(sessions)
}

#[tauri::command]
fn measurement_session_load(directory: String) -> Result<MeasurementReplay, String> {
    let dir = validated_measurement_dir(&directory)?;
    let session = measurement_summary_from_dir(&dir)?;
    let metadata_text = fs::read_to_string(dir.join("metadata.json")).map_err(|e| e.to_string())?;
    let metadata: MeasurementMetadata =
        serde_json::from_str(&metadata_text).map_err(|e| e.to_string())?;

    let timestamp_text = fs::read_to_string(dir.join("physical_lab_v1.csv")).unwrap_or_default();
    let timestamps = timestamp_text
        .lines()
        .skip(1)
        .filter_map(|line| line.split(',').next()?.trim().parse::<i64>().ok())
        .collect::<Vec<_>>();

    let data_text = fs::read_to_string(dir.join("data.csv"))
        .map_err(|e| format!("Could not read replay dataset: {e}"))?;
    let mut lines = data_text.lines();
    let header = lines.next().unwrap_or_default();
    if header.split(',').map(str::trim).collect::<Vec<_>>() != metadata.columns {
        return Err("Replay dataset header does not match its metadata schema.".into());
    }

    let fallback_start = chrono::DateTime::parse_from_rfc3339(&metadata.created_at_utc)
        .map(|value| value.timestamp_millis())
        .unwrap_or(0);
    let mut rows = Vec::new();
    for (index, line) in lines.enumerate() {
        if rows.len() >= 100_000 {
            break;
        }
        let value = line.trim();
        if value.is_empty() {
            continue;
        }
        let numeric = value
            .split(',')
            .all(|part| part.trim().parse::<f64>().is_ok());
        if !numeric || value.split(',').count() != metadata.columns.len() {
            continue;
        }
        rows.push(CapturedRow {
            host_timestamp_ms: timestamps
                .get(index)
                .copied()
                .unwrap_or(fallback_start + index as i64),
            line: value.to_string(),
            numeric: true,
        });
    }

    Ok(MeasurementReplay {
        session,
        columns: metadata.columns,
        units: metadata.units,
        primary_column: metadata.primary_column,
        sample_rate_hz: metadata.sample_rate_hz,
        rows,
    })
}

fn valid_measurement_rows(recipe: &RecipeSpec, rows: Vec<CapturedRow>) -> Vec<CapturedRow> {
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
    parameter_values: &BTreeMap<String, String>,
    valid_rows: &[CapturedRow],
) -> Result<MeasurementResult, String> {
    if valid_rows.is_empty() {
        return Err(
            "No rows matched the recipe schema; check firmware, baud rate, and selected recipe."
                .into(),
        );
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

    let normalized_parameters = normalized_parameter_values(recipe, parameter_values)?;
    let source = render_recipe_source(recipe, &normalized_parameters)?;
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
        sample_rate_hz: effective_sample_rate(recipe, &normalized_parameters),
        sample_count: valid_rows.len(),
        firmware_sha256: sha256_text(&source),
        recipe_parameters: normalized_parameters.clone(),
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
        "recipe_parameters": normalized_parameters,
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
    parameter_values: Option<BTreeMap<String, String>>,
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
        &parameter_values.unwrap_or_default(),
        &valid_rows,
    )
}

#[tauri::command]
fn save_measurement_buffer(
    port: String,
    board_profile: String,
    recipe_id: String,
    rows: Vec<CapturedRow>,
    parameter_values: Option<BTreeMap<String, String>>,
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
        &parameter_values.unwrap_or_default(),
        &valid_rows,
    )
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(serial_stream::SerialStreamState::default())
        .invoke_handler(tauri::generate_handler![
            arduino_cli_discovery,
            board_list,
            recipe_catalog,
            board_profiles,
            device_catalog,
            recipe_source,
            physical_lab_bridge_docs,
            prepare_recipe,
            prepare_recipe_with_params,
            user_recipe_save,
            developer_sketch_save,
            compile_sketch,
            upload_sketch,
            recipe_preflight,
            serial_capture,
            capture_measurement,
            save_measurement_buffer,
            measurement_sessions,
            measurement_session_load,
            ide_manager::arduino_core_list,
            ide_manager::arduino_core_search,
            ide_manager::arduino_core_update_index,
            ide_manager::arduino_core_install,
            ide_manager::arduino_core_uninstall,
            ide_manager::arduino_board_url_add,
            ide_manager::arduino_library_list,
            ide_manager::arduino_library_search,
            ide_manager::arduino_library_update_index,
            ide_manager::arduino_library_install,
            ide_manager::arduino_library_uninstall,
            ide_manager::arduino_library_examples,
            ide_manager::developer_sketchbook_list,
            ide_manager::developer_project_files,
            ide_manager::developer_project_file_save,
            openguin_bridge::openguin_probe,
            openguin_bridge::openguin_generate,
            serial_stream::serial_stream_start,
            serial_stream::serial_stream_write,
            serial_stream::serial_stream_stop,
        ])
        .run(tauri::generate_context!())
        .expect("error while running BetterBoard Studio");
}