use chrono::Utc;
use serde::Serialize;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{fs, path::{Path, PathBuf}};

#[derive(Debug, Serialize)]
pub struct ResearchBridgeResult {
    path: String,
    session_id: String,
    schema: String,
}

fn measurement_root() -> PathBuf {
    if let Ok(home) = std::env::var("HOME") {
        return PathBuf::from(home).join("Documents").join("BetterBoard").join("measurements");
    }
    std::env::temp_dir().join("BetterBoard").join("measurements")
}

fn validated_session_dir(directory: &str) -> Result<PathBuf, String> {
    let root = measurement_root();
    fs::create_dir_all(&root).map_err(|e| e.to_string())?;
    let root = fs::canonicalize(&root).map_err(|e| e.to_string())?;
    let session = fs::canonicalize(directory).map_err(|e| format!("Measurement session does not exist: {e}"))?;
    if !session.is_dir() || !session.starts_with(&root) {
        return Err("Research bridge creation is restricted to BetterBoard measurement sessions.".into());
    }
    Ok(session)
}

fn sha256_file(path: &Path) -> Result<String, String> {
    let bytes = fs::read(path).map_err(|e| format!("Could not read {}: {e}", path.display()))?;
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    Ok(format!("{:x}", hasher.finalize()))
}

fn file_record(dir: &Path, name: &str, role: &str) -> Value {
    let path = dir.join(name);
    if !path.is_file() {
        return json!({"role": role, "name": name, "present": false});
    }
    json!({
        "role": role,
        "name": name,
        "present": true,
        "sha256": sha256_file(&path).ok(),
        "bytes": fs::metadata(&path).ok().map(|m| m.len()),
    })
}

fn build_bridge(directory: &str) -> Result<(PathBuf, Value), String> {
    let dir = validated_session_dir(directory)?;
    let metadata_path = dir.join("metadata.json");
    let metadata_text = fs::read_to_string(&metadata_path)
        .map_err(|e| format!("Could not read measurement metadata: {e}"))?;
    let metadata: Value = serde_json::from_str(&metadata_text)
        .map_err(|e| format!("Measurement metadata is invalid JSON: {e}"))?;
    let session_id = dir.file_name().and_then(|v| v.to_str()).unwrap_or("measurement-session").to_string();
    let created_at = Utc::now().to_rfc3339();

    let bridge = json!({
        "schema": "betterboard.research-bridge/1.0",
        "session_id": session_id,
        "created_at_utc": created_at,
        "producer": "BetterBoard Studio",
        "experiment": {
            "title": metadata.get("recipe_title").cloned().unwrap_or(Value::Null),
            "recipe_id": metadata.get("recipe_id").cloned().unwrap_or(Value::Null),
            "question": Value::Null,
            "hypothesis": Value::Null
        },
        "hardware": {
            "board_profile": metadata.get("board_profile").cloned().unwrap_or(Value::Null),
            "port": metadata.get("port").cloned().unwrap_or(Value::Null),
            "baud": metadata.get("baud").cloned().unwrap_or(Value::Null),
            "identity_boundary": "Board profile and serial transport are provenance, not proof of exact physical board revision or electrical limits."
        },
        "firmware": {
            "sha256": metadata.get("firmware_sha256").cloned().unwrap_or(Value::Null),
            "recipe_parameters": metadata.get("recipe_parameters").cloned().unwrap_or(json!({}))
        },
        "evidence": {
            "sample_count": metadata.get("sample_count").cloned().unwrap_or(Value::Null),
            "columns": metadata.get("columns").cloned().unwrap_or(json!([])),
            "units": metadata.get("units").cloned().unwrap_or(json!([])),
            "primary_column": metadata.get("primary_column").cloned().unwrap_or(Value::Null),
            "sample_rate_hz": metadata.get("sample_rate_hz").cloned().unwrap_or(Value::Null),
            "files": [
                file_record(&dir, "data.csv", "raw-measurement"),
                file_record(&dir, "metadata.json", "measurement-metadata"),
                file_record(&dir, "physical_lab_v1.csv", "engineering-lab-compatibility"),
                file_record(&dir, "physical_lab_bridge.json", "legacy-engineering-lab-bridge")
            ]
        },
        "research_context": {
            "notebook": [],
            "annotations": [],
            "lab_journey": []
        },
        "engineering_lab": {
            "imports": [],
            "results": [],
            "policy": "Derived analysis must remain separate from raw BetterBoard measurement evidence."
        },
        "ai": {
            "provider": "OpenPenguin",
            "suggestions": [],
            "policy": "AI output is advisory context and must not be represented as measurement, calibration, or validated engineering result."
        },
        "provenance": [{
            "origin": "betterboard",
            "kind": "measurement-package",
            "created_at_utc": created_at,
            "source": "metadata.json",
            "immutable_raw_evidence": true
        }],
        "scientific_boundary": metadata.get("scientific_boundary").cloned().unwrap_or(Value::Null)
    });
    Ok((dir, bridge))
}

#[tauri::command]
pub fn research_bridge_create(directory: String) -> Result<ResearchBridgeResult, String> {
    let (dir, bridge) = build_bridge(&directory)?;
    let path = dir.join("betterboard_bridge.json");
    fs::write(&path, serde_json::to_string_pretty(&bridge).map_err(|e| e.to_string())?)
        .map_err(|e| format!("Could not write research bridge: {e}"))?;
    Ok(ResearchBridgeResult {
        path: path.display().to_string(),
        session_id: bridge.get("session_id").and_then(Value::as_str).unwrap_or_default().to_string(),
        schema: "betterboard.research-bridge/1.0".into(),
    })
}

#[tauri::command]
pub fn research_bridge_context(directory: String) -> Result<String, String> {
    let (_, bridge) = build_bridge(&directory)?;
    let compact = json!({
        "schema": bridge.get("schema"),
        "session_id": bridge.get("session_id"),
        "experiment": bridge.get("experiment"),
        "hardware": bridge.get("hardware"),
        "firmware": bridge.get("firmware"),
        "evidence": bridge.get("evidence"),
        "research_context": bridge.get("research_context"),
        "engineering_lab": bridge.get("engineering_lab"),
        "scientific_boundary": bridge.get("scientific_boundary")
    });
    serde_json::to_string_pretty(&compact).map_err(|e| e.to_string())
}
