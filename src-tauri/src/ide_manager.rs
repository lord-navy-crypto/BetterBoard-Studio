use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    fs,
    io::Write,
    path::{Path, PathBuf},
    process::{Command, Stdio},
    time::{SystemTime, UNIX_EPOCH},
};

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

fn example_record_by_path(raw: &Value, requested_path: &str) -> Option<Value> {
    let records = if let Some(array) = raw.as_array() {
        Some(array)
    } else {
        raw.get("examples").and_then(Value::as_array)
    }?;
    records.iter().find_map(|record| {
        let path = record.get("path").or_else(|| record.get("sketch_path")).and_then(Value::as_str)?;
        (path == requested_path).then(|| record.clone())
    })
}

fn verified_library_example_dir(path: &str, requested_library: &str) -> Result<PathBuf, String> {
    let canonical = fs::canonicalize(path).map_err(|e| format!("Example path is unavailable: {e}"))?;
    if !canonical.is_dir() { return Err("Arduino CLI example path is not a directory".into()); }
    let examples_root = canonical.ancestors()
        .find(|ancestor| ancestor.file_name().and_then(|v| v.to_str()) == Some("examples"))
        .ok_or_else(|| "Arduino CLI example is not inside a library examples directory".to_string())?;
    let library_root = examples_root.parent().ok_or_else(|| "Library example has no library root".to_string())?;
    let properties = fs::read_to_string(library_root.join("library.properties"))
        .map_err(|e| format!("Could not verify library.properties for this example: {e}"))?;
    let declared_name = properties.lines().find_map(|line| line.strip_prefix("name=")).map(str::trim)
        .ok_or_else(|| "library.properties does not declare a library name".to_string())?;
    let requested_name = requested_library.split('@').next().unwrap_or(requested_library).trim();
    if declared_name != requested_name {
        return Err(format!("Example belongs to library '{declared_name}', not requested library '{requested_name}'"));
    }
    Ok(canonical)
}

fn prepare_example_record(mut record: Value, library_name: &str) -> Result<Value, String> {
    let path = record.get("path").or_else(|| record.get("sketch_path")).and_then(Value::as_str)
        .ok_or_else(|| "Arduino CLI example did not provide a sketch path".to_string())?.to_string();
    let dir = verified_library_example_dir(&path, library_name)?;
    let example_name = dir.file_name().and_then(|v| v.to_str()).unwrap_or_default().to_string();
    let mut files = Vec::new();
    let mut total_bytes = 0usize;
    for entry in fs::read_dir(&dir).map_err(|e| e.to_string())?.filter_map(Result::ok) {
        let file_type = entry.file_type().map_err(|e| e.to_string())?;
        if !file_type.is_file() { continue; }
        let path = entry.path();
        let ext = path.extension().and_then(|v| v.to_str()).unwrap_or_default();
        if !matches!(ext, "ino" | "h" | "hpp" | "c" | "cpp") { continue; }
        if files.len() >= 32 { return Err("Example has more than 32 top-level source files; import is intentionally bounded".into()); }
        let metadata = fs::metadata(&path).map_err(|e| e.to_string())?;
        if metadata.len() > 512_000 { return Err("Example contains a source file larger than the 512 KB import limit".into()); }
        total_bytes = total_bytes.saturating_add(metadata.len() as usize);
        if total_bytes > 2_000_000 { return Err("Example source exceeds the 2 MB import limit".into()); }
        let source = fs::read_to_string(&path).map_err(|e| format!("Example source is not UTF-8 text: {e}"))?;
        let file_name = path.file_name().and_then(|v| v.to_str()).unwrap_or_default().to_string();
        files.push(json!({
            "name": file_name,
            "source": source,
            "main": path.file_name().and_then(|v| v.to_str()) == Some(&format!("{example_name}.ino")),
        }));
    }
    if !files.iter().any(|file| file.get("name").and_then(Value::as_str).is_some_and(|name| name.ends_with(".ino"))) {
        return Err("Example has no top-level .ino file that BetterBoard can import".into());
    }
    if !files.iter().any(|file| file.get("main").and_then(Value::as_bool) == Some(true)) {
        if let Some(file) = files.iter_mut().find(|file| file.get("name").and_then(Value::as_str).is_some_and(|name| name.ends_with(".ino"))) {
            if let Some(object) = file.as_object_mut() { object.insert("main".into(), Value::Bool(true)); }
        }
    }
    let object = record.as_object_mut().ok_or_else(|| "Arduino CLI example record is invalid".to_string())?;
    object.insert("betterboard_files".into(), Value::Array(files));
    object.insert("betterboard_importable".into(), Value::Bool(true));
    Ok(record)
}

#[tauri::command]
pub fn arduino_library_examples(name: String, fqbn: String, example_path: Option<String>) -> Result<Value, String> {
    let name = bounded_text(&name, "Library name", 180)?;
    let fqbn = bounded_text(&fqbn, "Board profile", 180)?;
    let raw = run_cli_json(&["lib", "examples", &name, "--fqbn", &fqbn])?;
    let Some(example_path) = example_path else { return Ok(raw); };
    let example_path = bounded_text(&example_path, "Example path", 1200)?;
    let record = example_record_by_path(&raw, &example_path)
        .ok_or_else(|| "Requested example is not present in the current Arduino CLI example list".to_string())?;
    Ok(json!({ "example": prepare_example_record(record, &name)? }))
}

#[derive(Debug, Serialize)]
pub struct SketchbookEntry {
    name: String,
    directory: String,
    main_file: String,
    source: String,
}

#[derive(Debug, Deserialize)]
pub struct ImportedProjectFile {
    name: String,
    source: String,
    #[serde(default)]
    main: bool,
}

fn sketch_roots() -> Vec<PathBuf> {
    let home = std::env::var("HOME").map(PathBuf::from).unwrap_or_else(|_| std::env::temp_dir());
    vec![
        home.join("Documents").join("Arduino"),
        home.join("Documents").join("BetterBoard").join("sketches"),
    ]
}

fn betterboard_sketch_root() -> PathBuf {
    sketch_roots().into_iter().nth(1).unwrap_or_else(|| std::env::temp_dir().join("BetterBoard").join("sketches"))
}

fn safe_sketch_dir(path: &Path) -> bool {
    let Ok(path) = fs::canonicalize(path) else { return false; };
    sketch_roots().into_iter().filter_map(|root| fs::canonicalize(root).ok()).any(|root| path.starts_with(root))
}

fn safe_project_name(value: &str) -> Result<String, String> {
    let value = bounded_text(value, "Project name", 80)?;
    if !value.chars().all(|c| c.is_ascii_alphanumeric() || c == '_') {
        return Err("Project names may contain only letters, numbers, and underscores".into());
    }
    Ok(value)
}

fn safe_project_file_name(value: &str) -> Result<String, String> {
    let file_name = bounded_text(value, "File name", 120)?;
    if file_name.contains('/') || file_name.contains('\\') || file_name.contains("..") {
        return Err("File name must not contain path traversal".into());
    }
    let ext = Path::new(&file_name).extension().and_then(|v| v.to_str()).unwrap_or_default();
    if !matches!(ext, "ino" | "h" | "hpp" | "c" | "cpp") {
        return Err("Project files must be .ino, .h, .hpp, .c, or .cpp".into());
    }
    Ok(file_name)
}

fn project_file(directory: &str, file_name: &str) -> Result<(PathBuf, PathBuf, String), String> {
    let dir = PathBuf::from(directory);
    if !safe_sketch_dir(&dir) { return Err("Project access is restricted to Arduino or BetterBoard sketchbook roots".into()); }
    let file_name = safe_project_file_name(file_name)?;
    let path = dir.join(&file_name);
    Ok((dir, path, file_name))
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
    let (_, path, _) = project_file(&directory, &file_name)?;
    fs::write(&path, source).map_err(|e| e.to_string())?;
    Ok(path.display().to_string())
}

#[tauri::command]
pub fn developer_project_create(name: String, files: Option<Vec<ImportedProjectFile>>) -> Result<SketchbookEntry, String> {
    let name = safe_project_name(&name)?;
    let root = betterboard_sketch_root();
    fs::create_dir_all(&root).map_err(|e| e.to_string())?;
    let dir = root.join(&name);
    if dir.exists() { return Err(format!("Project already exists: {name}")); }

    let canonical_main_name = format!("{name}.ino");
    let source_files = files.unwrap_or_default();
    if source_files.is_empty() {
        fs::create_dir(&dir).map_err(|e| e.to_string())?;
        let main = dir.join(&canonical_main_name);
        let source = "void setup() {\n  // runs once\n}\n\nvoid loop() {\n  // runs repeatedly\n}\n".to_string();
        if let Err(error) = fs::write(&main, &source) {
            let _ = fs::remove_dir_all(&dir);
            return Err(error.to_string());
        }
        return Ok(SketchbookEntry {
            name,
            directory: dir.display().to_string(),
            main_file: main.display().to_string(),
            source,
        });
    }

    if source_files.len() > 32 { return Err("Imported project exceeds the 32-file limit".into()); }
    let mut total_bytes = 0usize;
    let mut validated = Vec::new();
    let mut main_index = None;
    for (index, file) in source_files.into_iter().enumerate() {
        let file_name = safe_project_file_name(&file.name)?;
        if file.source.len() > 512_000 { return Err(format!("Imported file {file_name} exceeds the 512 KB limit")); }
        total_bytes = total_bytes.saturating_add(file.source.len());
        if total_bytes > 2_000_000 { return Err("Imported project exceeds the 2 MB source limit".into()); }
        if file.main {
            if main_index.is_some() { return Err("Imported example identifies more than one main .ino file".into()); }
            main_index = Some(index);
        }
        validated.push((file_name, file.source));
    }
    let main_index = main_index.or_else(|| validated.iter().position(|(file_name, _)| file_name.ends_with(".ino")))
        .ok_or_else(|| "Imported project has no .ino file".to_string())?;

    for (index, (file_name, _)) in validated.iter().enumerate() {
        if index != main_index && file_name == &canonical_main_name {
            return Err(format!("Imported file name collides with required main sketch: {canonical_main_name}"));
        }
    }

    let nonce = SystemTime::now().duration_since(UNIX_EPOCH).map(|value| value.as_nanos()).unwrap_or_default();
    let staging = root.join(format!(".{name}.importing-{}-{nonce}", std::process::id()));
    fs::create_dir(&staging).map_err(|e| e.to_string())?;
    for (index, (file_name, source)) in validated.iter().enumerate() {
        let output_name = if index == main_index { &canonical_main_name } else { file_name };
        if let Err(error) = fs::write(staging.join(output_name), source) {
            let _ = fs::remove_dir_all(&staging);
            return Err(format!("Could not stage imported file {output_name}: {error}"));
        }
    }
    if let Err(error) = fs::rename(&staging, &dir) {
        let _ = fs::remove_dir_all(&staging);
        return Err(format!("Could not commit imported project: {error}"));
    }
    let main = dir.join(&canonical_main_name);
    let source = fs::read_to_string(&main).map_err(|e| e.to_string())?;
    Ok(SketchbookEntry {
        name,
        directory: dir.display().to_string(),
        main_file: main.display().to_string(),
        source,
    })
}

#[tauri::command]
pub fn developer_project_rename(directory: String, new_name: String) -> Result<SketchbookEntry, String> {
    let new_name = safe_project_name(&new_name)?;
    let dir = fs::canonicalize(&directory).map_err(|e| e.to_string())?;
    if !safe_sketch_dir(&dir) { return Err("Project access is restricted to Arduino or BetterBoard sketchbook roots".into()); }
    let parent = dir.parent().ok_or_else(|| "Project has no parent directory".to_string())?;
    let allowed_parent = sketch_roots().into_iter().filter_map(|root| fs::canonicalize(root).ok()).any(|root| root == parent);
    if !allowed_parent { return Err("Only top-level sketchbook projects can be renamed".into()); }
    let old_name = dir.file_name().and_then(|v| v.to_str()).ok_or_else(|| "Project name is invalid".to_string())?.to_string();
    let target = parent.join(&new_name);
    if target.exists() { return Err(format!("Project already exists: {new_name}")); }

    fs::rename(&dir, &target).map_err(|e| e.to_string())?;
    let old_main = target.join(format!("{old_name}.ino"));
    let new_main = target.join(format!("{new_name}.ino"));
    let mut main_renamed = false;

    if old_main.is_file() {
        if let Err(error) = fs::rename(&old_main, &new_main) {
            let rollback = fs::rename(&target, &dir);
            return Err(match rollback {
                Ok(()) => format!("Project rename rolled back because the main .ino rename failed: {error}"),
                Err(rollback_error) => format!("Project rename failed while renaming the main .ino ({error}); rollback also failed ({rollback_error}). Disk state requires manual inspection."),
            });
        }
        main_renamed = true;
    }

    let main_result = if new_main.is_file() {
        Ok(new_main.clone())
    } else {
        fs::read_dir(&target).map_err(|e| e.to_string()).and_then(|items| {
            items.filter_map(Result::ok)
                .map(|entry| entry.path())
                .find(|path| path.extension().and_then(|v| v.to_str()) == Some("ino"))
                .ok_or_else(|| "Renamed project has no .ino file".to_string())
        })
    };

    let main = match main_result {
        Ok(main) => main,
        Err(error) => {
            if main_renamed && new_main.is_file() {
                let _ = fs::rename(&new_main, &old_main);
            }
            let rollback = fs::rename(&target, &dir);
            return Err(match rollback {
                Ok(()) => format!("Project rename rolled back: {error}"),
                Err(rollback_error) => format!("Project rename failed ({error}); rollback also failed ({rollback_error}). Disk state requires manual inspection."),
            });
        }
    };

    let source = match fs::read_to_string(&main) {
        Ok(source) => source,
        Err(error) => {
            if main_renamed && new_main.is_file() {
                let _ = fs::rename(&new_main, &old_main);
            }
            let rollback = fs::rename(&target, &dir);
            return Err(match rollback {
                Ok(()) => format!("Project rename rolled back because the main source could not be read: {error}"),
                Err(rollback_error) => format!("Project rename could not read the main source ({error}); rollback also failed ({rollback_error}). Disk state requires manual inspection."),
            });
        }
    };

    Ok(SketchbookEntry {
        name: new_name,
        directory: target.display().to_string(),
        main_file: main.display().to_string(),
        source,
    })
}

#[tauri::command]
pub fn developer_project_file_create(directory: String, file_name: String) -> Result<ProjectFile, String> {
    let (_, path, file_name) = project_file(&directory, &file_name)?;
    if path.exists() { return Err(format!("Project file already exists: {file_name}")); }
    fs::write(&path, "").map_err(|e| e.to_string())?;
    Ok(ProjectFile { name: file_name, path: path.display().to_string(), source: String::new() })
}

#[tauri::command]
pub fn developer_project_file_rename(directory: String, file_name: String, new_name: String) -> Result<ProjectFile, String> {
    let (dir, path, file_name) = project_file(&directory, &file_name)?;
    if !path.is_file() { return Err(format!("Project file not found: {file_name}")); }
    let folder_name = dir.file_name().and_then(|v| v.to_str()).unwrap_or_default();
    if file_name == format!("{folder_name}.ino") { return Err("Rename the project to rename its required main .ino file".into()); }
    let new_name = safe_project_file_name(&new_name)?;
    let target = dir.join(&new_name);
    if target.exists() { return Err(format!("Project file already exists: {new_name}")); }
    fs::rename(&path, &target).map_err(|e| e.to_string())?;
    let source = fs::read_to_string(&target).map_err(|e| e.to_string())?;
    Ok(ProjectFile { name: new_name, path: target.display().to_string(), source })
}

#[tauri::command]
pub fn developer_project_file_delete(directory: String, file_name: String) -> Result<bool, String> {
    let (dir, path, file_name) = project_file(&directory, &file_name)?;
    if !path.is_file() { return Ok(false); }
    let folder_name = dir.file_name().and_then(|v| v.to_str()).unwrap_or_default();
    if file_name == format!("{folder_name}.ino") { return Err("The required main .ino file cannot be deleted".into()); }
    fs::remove_file(path).map_err(|e| e.to_string())?;
    Ok(true)
}

fn find_clang_format() -> Result<PathBuf, String> {
    if let Ok(custom) = std::env::var("BETTERBOARD_CLANG_FORMAT") {
        let path = PathBuf::from(custom);
        if path.is_file() { return Ok(path); }
    }
    for candidate in ["/opt/homebrew/bin/clang-format", "/usr/local/bin/clang-format", "/usr/bin/clang-format"] {
        let path = PathBuf::from(candidate);
        if path.is_file() { return Ok(path); }
    }
    let out = Command::new("/usr/bin/env").args(["sh", "-lc", "command -v clang-format"])
        .output().map_err(|e| e.to_string())?;
    if out.status.success() {
        let value = String::from_utf8_lossy(&out.stdout).trim().to_string();
        if !value.is_empty() { return Ok(PathBuf::from(value)); }
    }
    Err("clang-format was not found. Install clang-format or set BETTERBOARD_CLANG_FORMAT to its executable path.".into())
}

#[tauri::command]
pub fn developer_format_source(source: String) -> Result<String, String> {
    if source.len() > 2_000_000 { return Err("Source exceeds the 2 MB editor limit".into()); }
    let mut child = Command::new(find_clang_format()?)
        .args(["--assume-filename=sketch.ino", "--style={BasedOnStyle: LLVM, IndentWidth: 2, ColumnLimit: 100}"])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn().map_err(|e| e.to_string())?;
    child.stdin.as_mut().ok_or_else(|| "Could not open clang-format stdin".to_string())?
        .write_all(source.as_bytes()).map_err(|e| e.to_string())?;
    let output = child.wait_with_output().map_err(|e| e.to_string())?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }
    String::from_utf8(output.stdout).map_err(|e| e.to_string())
}