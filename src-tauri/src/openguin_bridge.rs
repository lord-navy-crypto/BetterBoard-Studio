use serde::Serialize;
use serde_json::Value;
use std::{
    io::{Read, Write},
    net::{Ipv4Addr, SocketAddrV4, TcpStream},
    time::Duration,
};

const HOST: &str = "127.0.0.1";
const PRIVATE_PORT: u16 = 11435;
const EXTERNAL_PORT: u16 = 11434;
const MAX_RESPONSE_BYTES: u64 = 8 * 1024 * 1024;

#[derive(Debug, Serialize)]
pub struct OpenPenguinStatus {
    found: bool,
    endpoint: String,
    models: Vec<String>,
    error: Option<String>,
}

fn decode_chunked(mut body: &[u8]) -> Result<Vec<u8>, String> {
    let mut out = Vec::new();
    loop {
        let pos = body.windows(2).position(|w| w == b"\r\n").ok_or("Malformed chunked response")?;
        let size_text = std::str::from_utf8(&body[..pos]).map_err(|e| e.to_string())?;
        let size = usize::from_str_radix(size_text.split(';').next().unwrap_or("0").trim(), 16).map_err(|e| e.to_string())?;
        body = &body[pos + 2..];
        if size == 0 { break; }
        if body.len() < size + 2 { return Err("Truncated chunked response".into()); }
        out.extend_from_slice(&body[..size]);
        body = &body[size + 2..];
    }
    Ok(out)
}

fn request(port: u16, method: &str, path: &str, body: Option<&str>) -> Result<Vec<u8>, String> {
    let addr = SocketAddrV4::new(Ipv4Addr::LOCALHOST, port);
    let mut stream = TcpStream::connect_timeout(&addr.into(), Duration::from_millis(700))
        .map_err(|e| format!("Local AI runtime is not reachable on {HOST}:{port}: {e}"))?;
    stream.set_read_timeout(Some(Duration::from_secs(90))).map_err(|e| e.to_string())?;
    stream.set_write_timeout(Some(Duration::from_secs(5))).map_err(|e| e.to_string())?;
    let payload = body.unwrap_or("");
    let headers = format!(
        "{method} {path} HTTP/1.1\r\nHost: {HOST}:{port}\r\nConnection: close\r\nContent-Type: application/json\r\nContent-Length: {}\r\n\r\n",
        payload.as_bytes().len()
    );
    stream.write_all(headers.as_bytes()).map_err(|e| e.to_string())?;
    if !payload.is_empty() { stream.write_all(payload.as_bytes()).map_err(|e| e.to_string())?; }
    stream.flush().map_err(|e| e.to_string())?;
    let mut raw = Vec::new();
    (&mut stream)
        .take(MAX_RESPONSE_BYTES + 1)
        .read_to_end(&mut raw)
        .map_err(|e| e.to_string())?;
    if raw.len() as u64 > MAX_RESPONSE_BYTES {
        return Err(format!("Local AI runtime response exceeded the {} MiB bridge limit.", MAX_RESPONSE_BYTES / 1024 / 1024));
    }
    let split = raw.windows(4).position(|w| w == b"\r\n\r\n").ok_or("Invalid HTTP response from local AI runtime")?;
    let header = String::from_utf8_lossy(&raw[..split]);
    let status = header.lines().next().unwrap_or_default();
    if !status.contains(" 200 ") { return Err(format!("Local AI runtime on {HOST}:{port} returned {status}")); }
    let body = &raw[split + 4..];
    if header.to_ascii_lowercase().contains("transfer-encoding: chunked") { decode_chunked(body) } else { Ok(body.to_vec()) }
}

fn models_on(port: u16) -> Result<Vec<String>, String> {
    let bytes = request(port, "GET", "/api/tags", None)?;
    let value: Value = serde_json::from_slice(&bytes).map_err(|e| e.to_string())?;
    let mut models = value.get("models").and_then(Value::as_array).into_iter().flatten()
        .filter_map(|item| item.get("name").and_then(Value::as_str).map(str::to_string)).collect::<Vec<_>>();
    models.sort();
    models.dedup();
    Ok(models)
}

fn active_runtime() -> Result<(u16, Vec<String>), String> {
    // OpenPenguin now treats Ollama as optional. BetterBoard therefore does not
    // start a runtime itself: it first uses the private OpenPenguin runtime when
    // the user has explicitly started it, then accepts an already-running
    // external Ollama service selected by the user.
    let mut errors = Vec::new();
    for port in [PRIVATE_PORT, EXTERNAL_PORT] {
        match models_on(port) {
            Ok(models) => return Ok((port, models)),
            Err(error) => errors.push(format!("{HOST}:{port}: {error}")),
        }
    }
    Err(format!(
        "No local AI runtime is active. OpenPenguin/Ollama is optional; start the private runtime or connect an external runtime only when you want local AI. {}",
        errors.join(" | ")
    ))
}

#[tauri::command(async)]
pub fn openguin_probe() -> OpenPenguinStatus {
    match active_runtime() {
        Ok((port, models)) => OpenPenguinStatus {
            found: true,
            endpoint: format!("http://{HOST}:{port}"),
            models,
            error: None,
        },
        Err(error) => OpenPenguinStatus {
            found: false,
            endpoint: "runtime optional / not connected".into(),
            models: Vec::new(),
            error: Some(error),
        },
    }
}

#[tauri::command(async)]
pub fn openguin_generate(model: String, prompt: String, context: String) -> Result<String, String> {
    let model = model.trim();
    if model.is_empty() || model.len() > 200 { return Err("Select a valid local model.".into()); }
    if prompt.trim().is_empty() || prompt.len() > 12_000 { return Err("Prompt must be 1..12000 characters.".into()); }
    if context.len() > 40_000 { return Err("BetterBoard context exceeds the 40000-character local bridge limit.".into()); }
    let (port, models) = active_runtime()?;
    if !models.iter().any(|available| available == model) {
        return Err("The selected local model is no longer available on the active runtime. Reload models and try again.".into());
    }
    let combined = format!("You are assisting inside BetterBoard Studio. Keep measurement, numerical and model error distinct.\n\nBETTERBOARD CONTEXT:\n{}\n\nUSER REQUEST:\n{}", context, prompt);
    let body = serde_json::json!({"model": model, "prompt": combined, "stream": false, "options": {"temperature": 0.2}}).to_string();
    let bytes = request(port, "POST", "/api/generate", Some(&body))?;
    let value: Value = serde_json::from_slice(&bytes).map_err(|e| format!("Could not parse local AI response: {e}"))?;
    value.get("response").and_then(Value::as_str).map(str::to_string).ok_or_else(|| "Local AI runtime response did not contain text.".into())
}
