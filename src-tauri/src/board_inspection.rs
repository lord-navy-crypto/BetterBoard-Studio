use serde_json::Value;
use std::{path::PathBuf, process::Command};

fn find_cli() -> Result<PathBuf, String> {
    if let Ok(custom) = std::env::var("ARDUINO_CLI") {
        let path = PathBuf::from(custom);
        if path.is_file() { return Ok(path); }
    }
    for candidate in [
        "/opt/homebrew/bin/arduino-cli",
        "/usr/local/bin/arduino-cli",
        "/usr/bin/arduino-cli",
    ] {
        let path = PathBuf::from(candidate);
        if path.is_file() { return Ok(path); }
    }
    let output = Command::new("/usr/bin/env")
        .args(["sh", "-lc", "command -v arduino-cli"])
        .output()
        .map_err(|e| e.to_string())?;
    if output.status.success() {
        let value = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if !value.is_empty() { return Ok(PathBuf::from(value)); }
    }
    Err("arduino-cli was not found".into())
}

fn validated_fqbn(raw: &str) -> Result<String, String> {
    let fqbn = raw.trim();
    if fqbn.is_empty() || fqbn.len() > 240 || fqbn.chars().any(char::is_control) {
        return Err("Board FQBN is invalid".into());
    }
    if !fqbn.chars().all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, ':' | ',' | '=' | '_' | '-' | '.')) {
        return Err("Board FQBN contains unsupported characters".into());
    }
    if fqbn.split(':').take(3).count() < 3 {
        return Err("Board FQBN must include vendor, architecture, and board ID".into());
    }
    Ok(fqbn.to_string())
}

fn run_board_details(fqbn: &str, legacy_format: bool) -> Result<String, String> {
    let cli = find_cli()?;
    let mut command = Command::new(cli);
    command.args(["board", "details", "-b", fqbn, "--show-properties=expanded"]);
    if legacy_format {
        command.args(["--format", "json"]);
    } else {
        command.arg("--json");
    }
    let output = command.output().map_err(|e| e.to_string())?;
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    if output.status.success() {
        Ok(if stdout.trim().is_empty() { stderr } else { stdout })
    } else {
        Err(format!("{}{}", stdout, stderr).trim().to_string())
    }
}

#[tauri::command]
pub fn arduino_board_details(fqbn: String) -> Result<Value, String> {
    let fqbn = validated_fqbn(&fqbn)?;
    let text = run_board_details(&fqbn, false)
        .or_else(|_| run_board_details(&fqbn, true))?;
    serde_json::from_str(&text)
        .map_err(|e| format!("Arduino CLI board details returned invalid JSON: {e}"))
}
