use serde::Serialize;
use serde_json::Value;
use std::{fs, path::{Path, PathBuf}, process::Command};

const BENCH02_SCRIPT: &str = include_str!("../../scripts/bench02_numerical_error.py");
const BENCH03_SCRIPT: &str = include_str!("../../scripts/bench03_embedded_numerical.py");

#[derive(Debug, Serialize)]
pub struct AnalysisResult {
    pub analyzer: String,
    pub output_directory: String,
    pub summary_path: String,
    pub report_path: String,
    pub summary: Value,
    pub report: String,
    pub stdout: String,
}

fn analyzer_root() -> Result<PathBuf, String> {
    let root = std::env::temp_dir()
        .join("betterboard-studio")
        .join("analyzers");
    fs::create_dir_all(&root).map_err(|error| error.to_string())?;
    Ok(root)
}

fn write_analyzer(name: &str, source: &str) -> Result<PathBuf, String> {
    let path = analyzer_root()?.join(name);
    fs::write(&path, source).map_err(|error| format!("Could not prepare analyzer {name}: {error}"))?;
    Ok(path)
}

fn run_python(script: &Path, measurement_dir: &str) -> Result<String, String> {
    let measurement = PathBuf::from(measurement_dir).expand_tilde();
    if !measurement.exists() {
        return Err(format!("Measurement path does not exist: {}", measurement.display()));
    }

    let output = Command::new("/usr/bin/env")
        .arg("python3")
        .arg(script)
        .arg(&measurement)
        .output()
        .map_err(|error| format!("Could not launch python3: {error}"))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    if !output.status.success() {
        return Err(format!("{}{}", stdout, stderr).trim().to_string());
    }
    Ok(stdout)
}

trait ExpandTilde {
    fn expand_tilde(self) -> PathBuf;
}

impl ExpandTilde for PathBuf {
    fn expand_tilde(self) -> PathBuf {
        let text = self.to_string_lossy();
        if text == "~" || text.starts_with("~/") {
            if let Ok(home) = std::env::var("HOME") {
                return if text == "~" {
                    PathBuf::from(home)
                } else {
                    PathBuf::from(home).join(&text[2..])
                };
            }
        }
        self
    }
}

fn load_result(
    analyzer: &str,
    output_directory: PathBuf,
    summary_name: &str,
    report_name: &str,
    stdout: String,
) -> Result<AnalysisResult, String> {
    let summary_path = output_directory.join(summary_name);
    let report_path = output_directory.join(report_name);

    let summary_text = fs::read_to_string(&summary_path)
        .map_err(|error| format!("Analyzer completed but summary is unavailable at {}: {error}", summary_path.display()))?;
    let summary = serde_json::from_str::<Value>(&summary_text)
        .map_err(|error| format!("Analyzer summary is invalid JSON: {error}"))?;
    let report = fs::read_to_string(&report_path)
        .map_err(|error| format!("Analyzer completed but report is unavailable at {}: {error}", report_path.display()))?;

    Ok(AnalysisResult {
        analyzer: analyzer.to_string(),
        output_directory: output_directory.display().to_string(),
        summary_path: summary_path.display().to_string(),
        report_path: report_path.display().to_string(),
        summary,
        report,
        stdout,
    })
}

#[tauri::command]
pub fn run_bench02_analysis(measurement_dir: String) -> Result<AnalysisResult, String> {
    let measurement = PathBuf::from(&measurement_dir).expand_tilde();
    let data_path = if measurement.is_dir() {
        measurement.join("data.csv")
    } else {
        measurement.clone()
    };
    if !data_path.is_file() {
        return Err(format!("Bench 02 needs a BetterBoard data.csv; not found at {}", data_path.display()));
    }

    let script = write_analyzer("bench02_numerical_error.py", BENCH02_SCRIPT)?;
    let stdout = run_python(&script, &measurement_dir)?;
    let output_directory = data_path.parent().unwrap_or(Path::new(".")).join("bench02-numerical-error");
    load_result(
        "bench02",
        output_directory,
        "bench02_summary.json",
        "bench02_report.md",
        stdout,
    )
}

#[tauri::command]
pub fn run_bench03_analysis(measurement_dir: String) -> Result<AnalysisResult, String> {
    let measurement = PathBuf::from(&measurement_dir).expand_tilde();
    let data_path = if measurement.is_dir() {
        measurement.join("data.csv")
    } else {
        measurement.clone()
    };
    if !data_path.is_file() {
        return Err(format!("Bench 03 needs a BetterBoard data.csv; not found at {}", data_path.display()));
    }

    let script = write_analyzer("bench03_embedded_numerical.py", BENCH03_SCRIPT)?;
    let stdout = run_python(&script, &measurement_dir)?;
    let output_directory = data_path.parent().unwrap_or(Path::new(".")).join("bench03-embedded-numerical");
    load_result(
        "bench03",
        output_directory,
        "bench03_summary.json",
        "bench03_report.md",
        stdout,
    )
}
