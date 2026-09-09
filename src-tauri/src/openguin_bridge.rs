use serde::Serialize;
use serde_json::Value;
use std::{
    io::{Read, Write},
    net::{Ipv4Addr, SocketAddrV4, TcpStream},
    time::Duration,
};

const HOST: &str = "127.0.0.1";
const PORT: u16 = 11435;

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

fn request(method: &str, path: &str, body: Option<&str>) -> Result<Vec<u8>, String> {
    let addr = SocketAddrV4::new(Ipv4Addr::LOCALHOST, PORT);
    let mut stream = TcpStream::connect_timeout(&addr.into(), Duration::from_millis(700))
        .map_err(|e| format!("OpenPenguin private runtime is not reachable on {HOST}:{PORT}: {e}"))?;
    stream.set_read_timeout(Some(Duration::from_secs(90))).map_err(|e| e.to_string())?;
    stream.set_write_timeout(Some(Duration::from_secs(5))).map_err(|e| e.to_string())?;
    let payload = body.unwrap_or("");
    let headers = format!(
        "{method} {path} HTTP/1.1\r\nHost: {HOST}:{PORT}\r\nConnection: close\r\nContent-Type: application/json\r\nContent-Length: {}\r\n\r\n",
        payload.as_bytes().len()
    );
    stream.write_all(headers.as_bytes()).map_err(|e| e.to_string())?;
    if !payload.is_empty() { stream.write_all(payload.as_bytes()).map_err(|e| e.to_string())?; }
    stream.flush().map_err(|e| e.to_string())?;
    let mut raw = Vec::new();
    stream.read_to_end(&mut raw).map_err(|e| e.to_string())?;
    let split = raw.windows(4).position(|w| w == b"\r\n\r\n").ok_or("Invalid HTTP response from OpenPenguin runtime")?;
    let header = String::from_utf8_lossy(&raw[..split]);
    let status = header.lines().next().unwrap_or_default();
    if !status.contains(" 200 ") { return Err(format!("OpenPenguin runtime returned {status}")); }
    let body = &raw[split + 4..];
    if header.to_ascii_lowercase().contains("transfer-encoding: chunked") { decode_chunked(body) } else { Ok(body.to_vec()) }
}

#[tauri::command]
pub fn openguin_probe() -> OpenPenguinStatus {
    match request("GET", "/api/tags", None)
        .and_then(|bytes| serde_json::from_slice::<Value>(&bytes).map_err(|e| e.to_string())) {
        Ok(value) => {
            let mut models = value.get("models").and_then(Value::as_array).into_iter().flatten()
                .filter_map(|item| item.get("name").and_then(Value::as_str).map(str::to_string)).collect::<Vec<_>>();
            models.sort(); models.dedup();
            OpenPenguinStatus { found: true, endpoint: format!("http://{HOST}:{PORT}"), models, error: None }
        }
        Err(error) => OpenPenguinStatus { found: false, endpoint: format!("http://{HOST}:{PORT}"), models: Vec::new(), error: Some(error) },
    }
}

#[tauri::command]
pub fn openguin_generate(model: String, prompt: String, context: String) -> Result<String, String> {
    if model.trim().is_empty() || model.len() > 200 { return Err("Select a valid local model.".into()); }
    if prompt.trim().is_empty() || prompt.len() > 12_000 { return Err("Prompt must be 1..12000 characters.".into()); }
    if context.len() > 40_000 { return Err("BetterBoard context exceeds the 40000-character local bridge limit.".into()); }
    let combined = format!("You are assisting inside BetterBoard Studio. Keep measurement, numerical and model error distinct.\n\nBETTERBOARD CONTEXT:\n{}\n\nUSER REQUEST:\n{}", context, prompt);
    let body = serde_json::json!({"model": model, "prompt": combined, "stream": false, "options": {"temperature": 0.2}}).to_string();
    let bytes = request("POST", "/api/generate", Some(&body))?;
    let value: Value = serde_json::from_slice(&bytes).map_err(|e| format!("Could not parse local AI response: {e}"))?;
    value.get("response").and_then(Value::as_str).map(str::to_string).ok_or_else(|| "OpenPenguin runtime response did not contain text.".into())
}
