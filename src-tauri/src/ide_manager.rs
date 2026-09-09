use serde::Serialize;
use serde_json::{json, Value};
use std::{fs, path::{Path, PathBuf}, process::Command};

fn find_cli() -> Result<PathBuf, String> {
    if let Ok(custom) = std::env::var("ARDUINO_CLI") {
        let path = PathBuf::from(custom);
        if path.is_file() { return Ok(path); }
    }
    for candidate in ["/opt/homebrew/bin/arduino-cli", "/usr/local/bin/arduino-cli", "/usr/bin/arduino-cli"] {
        let path = PathBuf::from(candidate);
        if path.is_file() { return Ok(path); }
    }
    let out = Command::new("/usr/bin/env").args(["sh", "-lc", "command -v arduino-cli"])
        .output().map_err(|e| e.to_string())?;
    if out.status.success() {
        let value = String::from_utf8_lossy(&out.stdout).trim().to_string();
        if !value.is_empty() { return Ok(PathBuf::from(value)); }
    }
    Err("arduino-cli was not found".into())
}

fn run_cli(args: &[String]) -> Result<String, String> {
    let out = Command::new(find_cli()?).args(args).output().map_err(|e| e.to_string())?;
    let stdout = String::from_utf8_lossy(&out.stdout).to_string();
    let stderr = String::from_utf8_lossy(&out.stderr).to_string();
    if out.status.success() { Ok(if stdout.trim().is_empty() { stderr } else { stdout }) }
    else { Err(format!("{}{}", stdout, stderr).trim().to_string()) }
}

fn run_cli_json(base: &[&str]) -> Result<Value, String> {
    let mut json_args = base.iter().map(|v| v.to_string()).collect::<Vec<_>>();
    json_args.push("--json".into());
    let text = run_cli(&json_args).or_else(|_| {
        let mut legacy = base.iter().map(|v| v.to_string()).collect::<Vec<_>>();
        legacy.extend(["--format".into(), "json".into()]);
        run_cli(&legacy)
    })?;
    serde_json::from_str(&text).or_else(|_| Ok(json!({"raw": text})))
}

fn bounded_text(value: &str, label: &str, max: usize) -> Result<String, String> {
    let value = value.trim();
    if value.is_empty() || value.len() > max || value.chars().any(char::is_control) {
        return Err(format!("{label} is invalid"));
    }
    Ok(value.to_string())
}

fn core_spec(value: &str) -> Result<String, String> {
    let value = bounded_text(value, "Core identifier", 160)?;
    if !value.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, ':' | '@' | '.' | '_' | '-')) {
        return Err("Core identifier contains unsupported characters".into());
    }
    Ok(value)
}

#[tauri::command]
pub fn arduino_core_list() -> Result<Value, String> { run_cli_json(&["core", "list", "--all"]) }

#[tauri::command]
pub fn arduino_core_search(query: String) -> Result<Value, String> {
    let query = bounded_text(&query, "Search query", 120)?;
    run_cli_json(&["core", "search", &query])
}

#[tauri::command]
pub fn arduino_core_update_index() -> Result<String, String> {
    run_cli(&["core".into(), "update-index".into()])
}

#[tauri::command]
pub fn arduino_core_install(core: String) -> Result<String, String> {
    run_cli(&["core".into(), "install".into(), core_spec(&core)?])
}

#[tauri::command]
pub fn arduino_core_uninstall(core: String) -> Result<String, String> {
    run_cli(&["core".into(), "uninstall".into(), core_spec(&core)?])
}

#[tauri::command]
pub fn arduino_board_url_add(url: String) -> Result<String, String> {
    let url = bounded_text(&url, "Boards Manager URL", 500)?;
    if !(url.starts_with("https://") || url.starts_with("http://")) {
        return Err("Boards Manager URL must start with http:// or https://".into());
    }
    run_cli(&[
        "config".into(), "add".into(), "board_manager.additional_urls".into(), url,
    ])
}

#[tauri::command]
pub fn arduino_library_list() -> Result<Value, String> { run_cli_json(&["lib", "list", "--all"]) }

#[tauri::command]
pub fn arduino_library_search(query: String) -> Result<Value, String> {
    let query = bounded_text(&query, "Library search", 180)?;
    run_cli_json(&["lib", "search", &query, "--omit-releases-details"])
}

#[tauri::command]
pub fn arduino_library_update_index() -> Result<String, String> {
    run_cli(&["lib".into(), "update-index".into()])
}

#[tauri::command]
pub fn arduino_library_install(name: String) -> Result<String, String> {
    let name = bounded_text(&name, "Library name", 180)?;
    run_cli(&["lib".into(), "install".into(), name])
}

#[tauri::command]
pub fn arduino_library_uninstall(name: String) -> Result<String, String> {
    let name = bounded_text(&name, "Library name", 180)?;
    run_cli(&["lib".into(), "uninstall".into(), name])
}

#[tauri::command]
pub fn arduino_library_examples(name: String, fqbn: String) -> Result<Value, String> {
    let name = bounded_text(&name, "Library name", 180)?;
    let fqbn = bounded_text(&fqbn, "Board profile", 180)?;
    run_cli_json(&["lib", "examples", &name, "--fqbn", &fqbn])
}

#[derive(Debug, Serialize)]
pub struct SketchbookEntry {
    name: String,
    directory: String,
    main_file: String,
    source: String,
}

fn sketch_roots() -> Vec<PathBuf> {
    let home = std::env::var("HOME").map(PathBuf::from).unwrap_or_else(|_| std::env::temp_dir());
    vec![
        home.join("Documents").join("Arduino"),
        home.join("Documents").join("BetterBoard").join("sketches"),
    ]
}

fn safe_sketch_dir(path: &Path) -> bool {
    let Ok(path) = fs::canonicalize(path) else { return false; };
    sketch_roots().into_iter().filter_map(|root| fs::canonicalize(root).ok()).any(|root| path.starts_with(root))
}

#[tauri::command]
pub fn developer_sketchbook_list() -> Result<Vec<SketchbookEntry>, String> {
    let mut result = Vec::new();
    for root in sketch_roots() {
        if fs::create_dir_all(&root).is_err() { continue; }
        let Ok(entries) = fs::read_dir(&root) else { continue; };
        for entry in entries.filter_map(Result::ok) {
            let dir = entry.path();
            if !dir.is_dir() { continue; }
            let folder_name = entry.file_name().to_string_lossy().to_string();
            let preferred = dir.join(format!("{folder_name}.ino"));
            let main = if preferred.is_file() { Some(preferred) } else {
                fs::read_dir(&dir).ok().and_then(|items| items.filter_map(Result::ok)
                    .map(|item| item.path()).find(|path| path.extension().and_then(|v| v.to_str()) == Some("ino")))
            };
            let Some(main) = main else { continue; };
            let source = fs::read_to_string(&main).unwrap_or_default();
            result.push(SketchbookEntry {
                name: folder_name,
                directory: dir.display().to_string(),
                main_file: main.display().to_string(),
                source,
            });
        }
    }
    result.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(result)
}

#[derive(Debug, Serialize)]
pub struct ProjectFile {
    name: String,
    path: String,
    source: String,
}

#[tauri::command]
pub fn developer_project_files(directory: String) -> Result<Vec<ProjectFile>, String> {
    let dir = PathBuf::from(directory);
    if !safe_sketch_dir(&dir) { return Err("Project access is restricted to Arduino or BetterBoard sketchbook roots".into()); }
    let mut files = Vec::new();
    for entry in fs::read_dir(&dir).map_err(|e| e.to_string())?.filter_map(Result::ok) {
        let path = entry.path();
        if !path.is_file() { continue; }
        let ext = path.extension().and_then(|v| v.to_str()).unwrap_or_default();
        if !matches!(ext, "ino" | "h" | "hpp" | "c" | "cpp") { continue; }
        let source = fs::read_to_string(&path).map_err(|e| e.to_string())?;
        if source.len() > 2_000_000 { continue; }
        files.push(ProjectFile {
            name: path.file_name().unwrap_or_default().to_string_lossy().to_string(),
            path: path.display().to_string(),
            source,
        });
    }
    files.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(files)
}

#[tauri::command]
pub fn developer_project_file_save(directory: String, file_name: String, source: String) -> Result<String, String> {
    if source.len() > 2_000_000 { return Err("Project file exceeds the 2 MB editor limit".into()); }
    let dir = PathBuf::from(directory);
    if !safe_sketch_dir(&dir) { return Err("Project access is restricted to Arduino or BetterBoard sketchbook roots".into()); }
    let file_name = bounded_text(&file_name, "File name", 120)?;
    if file_name.contains('/') || file_name.contains('\\') || file_name.contains("..") {
        return Err("File name must not contain path traversal".into());
    }
    let ext = Path::new(&file_name).extension().and_then(|v| v.to_str()).unwrap_or_default();
    if !matches!(ext, "ino" | "h" | "hpp" | "c" | "cpp") {
        return Err("Project files must be .ino, .h, .hpp, .c, or .cpp".into());
    }
    let path = dir.join(file_name);
    fs::write(&path, source).map_err(|e| e.to_string())?;
    Ok(path.display().to_string())
}
