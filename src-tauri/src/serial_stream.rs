use chrono::Utc;
use serde::Serialize;
use std::{
    io::{BufRead, BufReader},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
    time::Duration,
};
use tauri::{ipc::Channel, State};

#[derive(Clone, Serialize)]
pub struct SerialStreamEvent {
    pub event: String,
    pub host_timestamp_ms: i64,
    pub line: String,
    pub numeric: bool,
}

pub struct SerialStreamState {
    stop: Arc<AtomicBool>,
    running: Arc<AtomicBool>,
}

impl Default for SerialStreamState {
    fn default() -> Self {
        Self {
            stop: Arc::new(AtomicBool::new(false)),
            running: Arc::new(AtomicBool::new(false)),
        }
    }
}

fn emit(
    channel: &Channel<SerialStreamEvent>,
    event: &str,
    line: impl Into<String>,
    numeric: bool,
) -> bool {
    channel
        .send(SerialStreamEvent {
            event: event.to_string(),
            host_timestamp_ms: Utc::now().timestamp_millis(),
            line: line.into(),
            numeric,
        })
        .is_ok()
}

#[tauri::command]
pub fn serial_stream_start(
    state: State<'_, SerialStreamState>,
    port: String,
    baud: u32,
    numeric_only: bool,
    on_event: Channel<SerialStreamEvent>,
) -> Result<(), String> {
    if baud == 0 || baud > 4_000_000 {
        return Err("baud must be within 1..4000000".into());
    }
    if !(port.starts_with("/dev/cu.")
        || port.starts_with("/dev/tty.")
        || cfg!(not(target_os = "macos")))
    {
        return Err("On macOS BetterBoard accepts serial devices under /dev/cu.* or /dev/tty.*.".into());
    }
    if state.running.swap(true, Ordering::SeqCst) {
        return Err("A BetterBoard live serial session is already running.".into());
    }

    state.stop.store(false, Ordering::SeqCst);
    let stop = Arc::clone(&state.stop);
    let running = Arc::clone(&state.running);

    std::thread::spawn(move || {
        let result = (|| -> Result<(), String> {
            let serial = serialport::new(&port, baud)
                .timeout(Duration::from_millis(120))
                .open()
                .map_err(|e| format!("Could not open serial port {port}: {e}"))?;

            // Many AVR USB-serial boards reset when a port is opened. Open once,
            // wait once, then keep the same session alive until the user stops it.
            std::thread::sleep(Duration::from_millis(1600));
            if !emit(&on_event, "started", format!("{port} @ {baud} baud"), false) {
                return Ok(());
            }

            let mut reader = BufReader::new(serial);
            while !stop.load(Ordering::SeqCst) {
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
                            continue;
                        }
                        if !emit(&on_event, "line", value.to_string(), numeric) {
                            break;
                        }
                    }
                    Err(error) if error.kind() == std::io::ErrorKind::TimedOut => continue,
                    Err(error) => return Err(error.to_string()),
                }
            }
            Ok(())
        })();

        match result {
            Ok(()) => {
                let _ = emit(&on_event, "stopped", "Serial monitor stopped", false);
            }
            Err(error) => {
                let _ = emit(&on_event, "error", error, false);
            }
        }
        running.store(false, Ordering::SeqCst);
        stop.store(false, Ordering::SeqCst);
    });

    Ok(())
}

#[tauri::command]
pub fn serial_stream_stop(state: State<'_, SerialStreamState>) -> bool {
    let was_running = state.running.load(Ordering::SeqCst);
    state.stop.store(true, Ordering::SeqCst);
    was_running
}
