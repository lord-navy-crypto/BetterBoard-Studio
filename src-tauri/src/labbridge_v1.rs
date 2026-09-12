use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{
    collections::BTreeMap,
    fs,
    io::Write,
    path::{Path, PathBuf},
};

pub const OUTPUT_NAME: &str = "labbridge_measurement_asset.json";
pub const SCHEMA: &str = "labbridge.measurement-asset/v1";

fn sha256_bytes(data: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(data);
    format!("{:x}", hasher.finalize())
}

fn canonical_json_sha(value: &Value) -> Result<String, String> {
    let raw = serde_json::to_vec(value).map_err(|e| e.to_string())?;
    Ok(sha256_bytes(&raw))
}

fn channel_rows(columns: &[String], units: &[String], primary: Option<&str>) -> Vec<Value> {
    columns
        .iter()
        .zip(units.iter())
        .map(|(name, unit)| {
            let lower = name.to_ascii_lowercase();
            let role = if primary == Some(name.as_str()) {
                "primary-observable"
            } else if matches!(
                lower.as_str(),
                "time" | "time_s" | "time_us" | "timestamp"
            ) {
                "coordinate"
            } else {
                "observable"
            };
            json!({"name": name, "unit": unit, "role": role})
        })
        .collect()
}

fn atomic_write(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let file_name = path
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| format!("Invalid LabBridge output path: {}", path.display()))?;
    let tmp = path.with_file_name(format!(".{file_name}.{}.tmp", std::process::id()));
    let result = (|| -> Result<(), String> {
        let mut file = fs::File::create(&tmp)
            .map_err(|e| format!("Could not create {}: {e}", tmp.display()))?;
        file.write_all(bytes)
            .map_err(|e| format!("Could not write {}: {e}", tmp.display()))?;
        file.sync_all()
            .map_err(|e| format!("Could not sync {}: {e}", tmp.display()))?;
        fs::rename(&tmp, path).map_err(|e| {
            format!(
                "Could not atomically replace {} with {}: {e}",
                path.display(),
                tmp.display()
            )
        })?;
        Ok(())
    })();
    if result.is_err() {
        let _ = fs::remove_file(&tmp);
    }
    result
}

#[allow(clippy::too_many_arguments)]
pub fn write_measurement_asset(
    measurement_dir: &Path,
    app_version: &str,
    created_at_utc: &str,
    data_path: &Path,
    metadata_path: &Path,
    board_profile: &str,
    port: &str,
    baud: u32,
    firmware_sha256: &str,
    acquisition_mode: &str,
    recipe_id: &str,
    recipe_title: &str,
    sample_rate_hz: Option<f64>,
    recipe_parameters: &BTreeMap<String, String>,
    columns: &[String],
    units: &[String],
    primary_observable: Option<&str>,
    sample_count: usize,
) -> Result<PathBuf, String> {
    if columns.is_empty() || columns.len() != units.len() {
        return Err("LabBridge columns/units must be non-empty and equal length".into());
    }
    if sample_count == 0 {
        return Err("LabBridge MeasurementAsset requires at least one sample".into());
    }

    let data_bytes = fs::read(data_path)
        .map_err(|e| format!("Could not read {}: {e}", data_path.display()))?;
    let metadata_bytes = fs::read(metadata_path)
        .map_err(|e| format!("Could not read {}: {e}", metadata_path.display()))?;

    let stable = json!({
        "schema": SCHEMA,
        "bridge_version": "1.0",
        "packet_type": "measurement_asset",
        "source_app": {
            "name": "BetterBoard",
            "product": "BetterBoard Studio",
            "version": app_version,
            "role": "real-world-ingress"
        },
        "created_at_utc": created_at_utc,
        "dataset": {
            "path": "data.csv",
            "format": "text/csv",
            "sha256": sha256_bytes(&data_bytes),
            "rows": sample_count,
            "columns": channel_rows(columns, units, primary_observable)
        },
        "device": {
            "board_profile": board_profile,
            "port": port,
            "baud": baud,
            "firmware_sha256": firmware_sha256
        },
        "acquisition": {
            "mode": acquisition_mode,
            "recipe_id": recipe_id,
            "recipe_title": recipe_title,
            "sample_rate_hz": sample_rate_hz,
            "recipe_parameters": recipe_parameters
        },
        "primary_observable": primary_observable,
        "provenance": {
            "metadata_path": "metadata.json",
            "metadata_sha256": sha256_bytes(&metadata_bytes),
            "firmware_sha256": firmware_sha256
        },
        "compatibility": {
            "legacy_bridge": "physical_lab_bridge.json",
            "legacy_dataset": "physical_lab_v1.csv"
        },
        "intended_consumer": {
            "name": "Engineering Lab",
            "role": "scientific-computation-and-evidence-core"
        },
        "scientific_boundary": "BetterBoard is the real-world ingress. This packet preserves acquisition identity and data integrity; sensor calibration, traceability, uncertainty assessment, scientific interpretation and validation remain separate Engineering Lab evidence."
    });

    let digest = canonical_json_sha(&stable)?;
    let mut packet = stable
        .as_object()
        .cloned()
        .ok_or("LabBridge packet is not an object")?;
    packet.insert(
        "packet_id".into(),
        Value::String(format!("measurement-{}", &digest[..20])),
    );
    packet.insert("content_sha256".into(), Value::String(digest));
    let destination = measurement_dir.join(OUTPUT_NAME);
    let bytes = serde_json::to_vec_pretty(&Value::Object(packet)).map_err(|e| e.to_string())?;
    atomic_write(&destination, &bytes)?;
    Ok(destination)
}
