#!/usr/bin/env python3
from __future__ import annotations
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LIB = ROOT / 'src-tauri' / 'src' / 'lib.rs'
MONITOR = ROOT / 'src' / 'MonitorDataStudio.tsx'
CSS = ROOT / 'src' / 'monitor-data.css'
CHECK = ROOT / 'scripts' / 'self_check.py'

lib = LIB.read_text()
anchor = '''            serial_stream::serial_stream_start,\n            serial_stream::serial_stream_stop,'''
replacement = '''            serial_stream::serial_stream_start,\n            serial_stream::serial_stream_write,\n            serial_stream::serial_stream_stop,'''
if lib.count(anchor) != 1:
    raise SystemExit('lib.rs serial handler anchor mismatch')
lib = lib.replace(anchor, replacement, 1)
LIB.write_text(lib)

monitor = MONITOR.read_text()

old_icons = '''  Activity, CircleAlert, Database, Eraser, Gauge, Play, Radio, Save, Square,\n  TerminalSquare, Waves,'''
new_icons = '''  Activity, CircleAlert, Database, Eraser, Gauge, Play, Radio, Save, Send, Square,\n  TerminalSquare, Waves,'''
if monitor.count(old_icons) != 1:
    raise SystemExit('Monitor icon import anchor mismatch')
monitor = monitor.replace(old_icons, new_icons, 1)

old_row = '''type MonitorRow = {\n  hostTimestampMs: number;\n  line: string;\n  numeric: boolean;\n};'''
new_row = '''type MonitorRow = {\n  hostTimestampMs: number;\n  line: string;\n  numeric: boolean;\n  direction?: 'rx' | 'tx';\n};'''
if monitor.count(old_row) != 1:
    raise SystemExit('MonitorRow anchor mismatch')
monitor = monitor.replace(old_row, new_row, 1)

old_parse = '''function parseNumericRow(row: MonitorRow, expectedColumns: number): number[] | null {\n  if (!row.numeric) return null;'''
new_parse = '''function parseNumericRow(row: MonitorRow, expectedColumns: number): number[] | null {\n  if (row.direction === 'tx' || !row.numeric) return null;'''
if monitor.count(old_parse) != 1:
    raise SystemExit('parseNumericRow anchor mismatch')
monitor = monitor.replace(old_parse, new_parse, 1)

old_states = '''  const [measurement, setMeasurement] = useState<MeasurementResult | null>(null);\n  const [busy, setBusy] = useState(false);\n  const channelRef = useRef<Channel<SerialStreamEvent> | null>(null);'''
new_states = '''  const [measurement, setMeasurement] = useState<MeasurementResult | null>(null);\n  const [busy, setBusy] = useState(false);\n  const [txText, setTxText] = useState('');\n  const [lineEnding, setLineEnding] = useState<'none' | 'lf' | 'cr' | 'crlf'>('lf');\n  const channelRef = useRef<Channel<SerialStreamEvent> | null>(null);'''
if monitor.count(old_states) != 1:
    raise SystemExit('monitor state anchor mismatch')
monitor = monitor.replace(old_states, new_states, 1)

old_rx = '''          hostTimestampMs: message.host_timestamp_ms,\n          line: message.line,\n          numeric: message.numeric,\n        }].slice(-MAX_MONITOR_ROWS));'''
new_rx = '''          hostTimestampMs: message.host_timestamp_ms,\n          line: message.line,\n          numeric: message.numeric,\n          direction: 'rx',\n        }].slice(-MAX_MONITOR_ROWS));'''
if monitor.count(old_rx) != 1:
    raise SystemExit('live RX row anchor mismatch')
monitor = monitor.replace(old_rx, new_rx, 1)

old_snapshot = '''        hostTimestampMs: now + index,\n        line,\n        numeric: line.split(',').every(part => Number.isFinite(Number(part.trim()))),\n      })));'''
new_snapshot = '''        hostTimestampMs: now + index,\n        line,\n        numeric: line.split(',').every(part => Number.isFinite(Number(part.trim()))),\n        direction: 'rx',\n      })));'''
if monitor.count(old_snapshot) != 1:
    raise SystemExit('snapshot row anchor mismatch')
monitor = monitor.replace(old_snapshot, new_snapshot, 1)

send_anchor = '''  async function captureSnapshot() {'''
send_fn = '''  async function sendSerial() {\n    if (monitorState !== 'live') {\n      report('Start Live Monitor before sending serial data.');\n      return;\n    }\n    if (!txText.length) return;\n    const outgoing = txText;\n    try {\n      const bytes = await invoke<number>('serial_stream_write', {\n        text: outgoing,\n        lineEnding,\n      });\n      setRows(current => [...current, {\n        hostTimestampMs: Date.now(),\n        line: outgoing,\n        numeric: false,\n        direction: 'tx',\n      }].slice(-MAX_MONITOR_ROWS));\n      setTxText('');\n      report(`Sent ${bytes} byte(s) · ${lineEnding.toUpperCase()} ending`);\n    } catch (error) {\n      report(`Serial send failed: ${error}`);\n    }\n  }\n\n  async function captureSnapshot() {'''
if monitor.count(send_anchor) != 1:
    raise SystemExit('send function insertion anchor mismatch')
monitor = monitor.replace(send_anchor, send_fn, 1)

old_console = '''        {!rows.length ? <div className="empty">Start Live Monitor to see the continuous serial stream, or take a one-time snapshot.</div> : <div className="serial-console">{rows.slice(-600).map((row, index) => <div key={`${row.hostTimestampMs}-${index}`}><span>{new Date(row.hostTimestampMs).toLocaleTimeString([], { hour12: false })}</span><code>{row.line}</code></div>)}</div>}'''
new_console = '''        <div className="monitor-transmit">\n          <input\n            value={txText}\n            disabled={monitorState !== 'live'}\n            onChange={event => setTxText(event.target.value)}\n            onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void sendSerial(); } }}\n            placeholder={monitorState === 'live' ? 'Send text or command to the board…' : 'Start Live Monitor to send'}\n            aria-label="Serial transmit text"\n          />\n          <select value={lineEnding} disabled={monitorState !== 'live'} onChange={event => setLineEnding(event.target.value as typeof lineEnding)} aria-label="Serial line ending">\n            <option value="none">No line ending</option>\n            <option value="lf">Newline (LF)</option>\n            <option value="cr">Carriage return (CR)</option>\n            <option value="crlf">Both NL & CR</option>\n          </select>\n          <button className="primary" disabled={monitorState !== 'live' || !txText.length} onClick={() => void sendSerial()}><Send size={14}/> Send</button>\n        </div>\n        {!rows.length ? <div className="empty">Start Live Monitor to see the continuous serial stream, or take a one-time snapshot.</div> : <div className="serial-console">{rows.slice(-600).map((row, index) => <div key={`${row.hostTimestampMs}-${index}`} className={row.direction === 'tx' ? 'tx' : 'rx'}><span>{new Date(row.hostTimestampMs).toLocaleTimeString([], { hour12: false })}</span><code>{row.direction === 'tx' ? 'TX › ' : 'RX · '}{row.line}</code></div>)}</div>}'''
if monitor.count(old_console) != 1:
    raise SystemExit('serial console JSX anchor mismatch')
monitor = monitor.replace(old_console, new_console, 1)

if "serial_stream_write" not in monitor or "No line ending" not in monitor or "direction === 'tx'" not in monitor:
    raise SystemExit('serial TX UI contract missing after refactor')
MONITOR.write_text(monitor)

css = CSS.read_text()
addition = '''\n.monitor-transmit{display:grid;grid-template-columns:minmax(150px,1fr) 150px auto;gap:7px;margin-bottom:8px}.monitor-transmit input,.monitor-transmit select{min-width:0;padding:8px 9px!important}.serial-console>div.tx{background:rgba(126,140,255,.065)}.serial-console>div.tx span{color:#8f9dff}.serial-console>div.tx code{color:#d8dcff}.serial-console>div.rx code{color:#c8d8e8}\n@media(max-width:760px){.monitor-transmit{grid-template-columns:1fr}.monitor-transmit button{width:100%}}\n'''
if '.monitor-transmit{' not in css:
    css += addition
CSS.write_text(css)

check = CHECK.read_text()
old_assert = '''    assert 'serial_stream_start' in monitor_text\n    assert 'serial_stream_stop' in monitor_text'''
new_assert = '''    assert 'serial_stream_start' in monitor_text\n    assert 'serial_stream_write' in monitor_text\n    assert 'serial_stream_stop' in monitor_text\n    assert 'save_measurement_buffer' in monitor_text\n    assert 'No line ending' in monitor_text\n    assert "direction === 'tx'" in monitor_text\n    assert 'live-monitor-buffer' in rust'''
if check.count(old_assert) != 1:
    raise SystemExit('self_check serial assertions anchor mismatch')
check = check.replace(old_assert, new_assert, 1)
CHECK.write_text(check)

print('registered bidirectional serial TX UI + handler + contract checks')
