use serde::Deserialize;
use std::{
    collections::BTreeMap,
    fs,
    path::{Path, PathBuf},
    thread,
    time::{Duration, SystemTime},
};

use crate::labbridge_v1::{write_measurement_asset, OUTPUT_NAME};

#[derive(Debug, Deserialize)]
struct MeasurementMetadata {
    created_at_utc: String,
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
}

fn measurement_root() -> PathBuf {
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

fn modified_at(path: &Path) -> Option<SystemTime> {
    fs::metadata(path).ok()?.modified().ok()
}

fn sidecar_needs_refresh(dir: &Path) -> bool {
    let sidecar = dir.join(OUTPUT_NAME);
    let Some(sidecar_time) = modified_at(&sidecar) else {
        return true;
    };
    [dir.join("data.csv"), dir.join("metadata.json")]
        .iter()
        .filter_map(|path| modified_at(path))
        .any(|source_time| source_time > sidecar_time)
}

fn export_one(dir: &Path) -> Result<Option<PathBuf>, String> {
    let data_path = dir.join("data.csv");
    let metadata_path = dir.join("metadata.json");
    if !data_path.is_file() || !metadata_path.is_file() || !sidecar_needs_refresh(dir) {
        return Ok(None);
    }

    let raw = fs::read_to_string(&metadata_path)
        .map_err(|e| format!("Could not read {}: {e}", metadata_path.display()))?;
    let metadata: MeasurementMetadata = serde_json::from_str(&raw)
        .map_err(|e| format!("Could not parse {}: {e}", metadata_path.display()))?;

    let destination = write_measurement_asset(
        dir,
        env!("CARGO_PKG_VERSION"),
        &metadata.created_at_utc,
        &data_path,
        &metadata_path,
        &metadata.board_profile,
        &metadata.port,
        metadata.baud,
        &metadata.firmware_sha256,
        &metadata.acquisition_mode,
        &metadata.recipe_id,
        &metadata.recipe_title,
        metadata.sample_rate_hz,
        &metadata.recipe_parameters,
        &metadata.columns,
        &metadata.units,
        metadata.primary_column.as_deref(),
        metadata.sample_count,
    )?;
    Ok(Some(destination))
}

pub fn refresh_all_once() -> Result<usize, String> {
    let root = measurement_root();
    if !root.exists() {
        return Ok(0);
    }
    let mut refreshed = 0usize;
    for entry in fs::read_dir(&root)
        .map_err(|e| format!("Could not scan {}: {e}", root.display()))?
        .filter_map(Result::ok)
    {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        match export_one(&path) {
            Ok(Some(_)) => refreshed += 1,
            Ok(None) => {}
            Err(error) => eprintln!("[LabBridge native exporter] {}: {error}", path.display()),
        }
    }
    Ok(refreshed)
}

pub fn spawn_native_exporter() {
    thread::Builder::new()
        .name("betterboard-labbridge-native-export".into())
        .spawn(|| loop {
            if let Err(error) = refresh_all_once() {
                eprintln!("[LabBridge native exporter] {error}");
            }
            thread::sleep(Duration::from_millis(750));
        })
        .expect("failed to start BetterBoard LabBridge native exporter");
}
