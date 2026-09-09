#!/usr/bin/env python3
from pathlib import Path
import json

root = Path(__file__).resolve().parents[1]

# ---------- Studio persistent panes ----------
app_path = root / 'src/App.tsx'
app = app_path.read_text()
app = app.replace("<span>Studio · Alpha 0.3</span>", "<span>Studio · Alpha 0.5</span>")

old = "      {tab === 'hardware' && <>\n"
new = "      <div className=\"studio-persistent-pane\" hidden={tab !== 'hardware'}>\n"
assert old in app
app = app.replace(old, new, 1)
old = "        </section>\n      </>}\n\n      {tab === 'circuit' && <CircuitLab onUseRecipe={(id) => { setRecipeId(id); setTab('hardware'); }} />}\n\n      {tab === 'library' && <section className=\"library-layout\">"
new = "        </section>\n      </div>\n\n      <div className=\"studio-persistent-pane\" hidden={tab !== 'circuit'}><CircuitLab onUseRecipe={(id) => { setRecipeId(id); setTab('hardware'); }} /></div>\n\n      <div className=\"studio-persistent-pane\" hidden={tab !== 'library'}><section className=\"library-layout\">"
assert old in app
app = app.replace(old, new, 1)
old = "        </div>\n      </section>}\n\n      {tab === 'data' && <MonitorDataStudio"
new = "        </div>\n      </section></div>\n\n      <div className=\"studio-persistent-pane\" hidden={tab !== 'data'}><MonitorDataStudio"
assert old in app
app = app.replace(old, new, 1)
old = "        onTaskFinish={finishTask}\n      />}\n\n      {tab === 'developer' && <DeveloperIDE"
new = "        onTaskFinish={finishTask}\n      /></div>\n\n      <div className=\"studio-persistent-pane\" hidden={tab !== 'developer'}><DeveloperIDE"
assert old in app
app = app.replace(old, new, 1)
old = "        onTaskFinish={finishTask}\n      />}\n\n      <TaskCenterPanel"
new = "        onTaskFinish={finishTask}\n      /></div>\n\n      <TaskCenterPanel"
assert old in app
app = app.replace(old, new, 1)
app_path.write_text(app)

# ---------- Monitor plot: engineering axes ----------
monitor_path = root / 'src/MonitorDataStudio.tsx'
monitor = monitor_path.read_text()
old = "import RuntimeLog from './RuntimeLog';\n"
new = old + "import EngineeringPlot from './EngineeringPlot';\n"
assert old in monitor
monitor = monitor.replace(old, new, 1)
old = '''function makePolyline(values: number[]): string {
  if (values.length < 2) return '';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, 1e-12);
  return values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * 100;
      const y = 40 - ((value - min) / span) * 36;
      return `${x},${y}`;
    })
    .join(' ');
}

'''
assert old in monitor
monitor = monitor.replace(old, '', 1)
old = '''  const latestValues = numericRows.at(-1) ?? [];
  const channelValues = useMemo(() => numericRows
    .slice(-MAX_PLOT_POINTS)
    .map(parts => parts[selectedChannel])
    .filter(Number.isFinite), [numericRows, selectedChannel]);
  const polyline = useMemo(() => makePolyline(channelValues), [channelValues]);

  const lastValue = channelValues.at(-1);'''
new = '''  const latestValues = numericRows.at(-1) ?? [];
  const channelPoints = useMemo(() => {
    const result: Array<{ x: number; y: number }> = [];
    let firstTimestamp: number | null = null;
    for (const row of displayRows.slice(-MAX_PLOT_POINTS)) {
      const parts = parseNumericRow(row, activeColumns.length);
      const value = parts?.[selectedChannel];
      if (value === undefined || !Number.isFinite(value)) continue;
      if (firstTimestamp === null) firstTimestamp = row.hostTimestampMs;
      result.push({ x: (row.hostTimestampMs - firstTimestamp) / 1000, y: value });
    }
    return result;
  }, [displayRows, activeColumns.length, selectedChannel]);
  const channelValues = useMemo(() => channelPoints.map(point => point.y), [channelPoints]);

  const lastValue = channelValues.at(-1);'''
assert old in monitor
monitor = monitor.replace(old, new, 1)
old = '<svg className="plot monitor-plot" viewBox="0 0 100 44" preserveAspectRatio="none"><polyline points={polyline} fill="none" vectorEffect="non-scaling-stroke"/></svg>'
new = '<EngineeringPlot series={[{ label: selectedColumn, points: channelPoints }]} xLabel="time" xUnit="s" yLabel={selectedColumn} yUnit={selectedUnit} height={300} />'
assert old in monitor
monitor = monitor.replace(old, new, 1)
monitor_path.write_text(monitor)

# ---------- Magnet plot ----------
magnet_path = root / 'src/MagnetBenchSuiteV2.tsx'
magnet = magnet_path.read_text()
old = "import { useHardwareSession } from './HardwareSession';\n"
new = old + "import EngineeringPlot from './EngineeringPlot';\n"
assert old in magnet
magnet = magnet.replace(old, new, 1)
old = '''function polyline(values: Array<{ x: number; y: number }>, allY: number[]) {
  if (values.length < 2) return '';
  const xs = values.map(v => v.x), minX = Math.min(...xs), maxX = Math.max(...xs), spanX = Math.max(maxX - minX, 1e-9);
  const minY = Math.min(...allY), maxY = Math.max(...allY), spanY = Math.max(maxY - minY, 1e-9);
  return values.map(v => `${((v.x - minX) / spanX) * 100},${42 - ((v.y - minY) / spanY) * 38}`).join(' ');
}
'''
assert old in magnet
magnet = magnet.replace(old, '', 1)
old = "  const allY = [...measuredSeries.map(point => point.y), ...modelSeries.map(point => point.y)];\n"
new = "  const hasProfilePlot = measuredSeries.length > 1 || modelSeries.length > 1;\n"
assert old in magnet
magnet = magnet.replace(old, new, 1)
old = '''{allY.length > 1 && <div style={{ marginTop: 16 }}><h3 style={{ fontSize: 13 }}><BarChart3 size={15}/> Measured ↔ model profile</h3><svg className="plot" viewBox="0 0 100 44" preserveAspectRatio="none"><polyline points={polyline(measuredSeries, allY)} fill="none" vectorEffect="non-scaling-stroke"/><polyline points={polyline(modelSeries, allY)} fill="none" vectorEffect="non-scaling-stroke" style={{ strokeDasharray: '2 1', opacity: .58 }}/></svg><div style={{ display: 'flex', gap: 16, fontSize: 10, color: '#8395aa' }}><span>solid · measured position mean</span><span>dashed · model</span></div></div>}'''
new = '''{hasProfilePlot && <div style={{ marginTop: 16 }}><h3 style={{ fontSize: 13 }}><BarChart3 size={15}/> Measured ↔ model profile</h3><EngineeringPlot series={[{ label: 'measured position mean', points: measuredSeries }, { label: 'model', points: modelSeries, dashed: true, opacity: .68 }]} xLabel="position" xUnit="mm" yLabel={`corrected ${axis === 'bmag' ? '|B|' : axis.toUpperCase()}`} yUnit="µT" height={310} /></div>}'''
assert old in magnet
magnet = magnet.replace(old, new, 1)
magnet_path.write_text(magnet)

# ---------- Experiment domains stay mounted ----------
hub_path = root / 'src/ExperimentsHub.tsx'
hub = hub_path.read_text()
old = "    {domain === 'numerical' && <NumericalBenchSuiteV2 />}\n    {domain === 'magnet' && <MagnetBenchSuiteV2 />}"
new = "    <div className=\"experiment-persistent-pane\" hidden={domain !== 'numerical'}><NumericalBenchSuiteV2 /></div>\n    <div className=\"experiment-persistent-pane\" hidden={domain !== 'magnet'}><MagnetBenchSuiteV2 /></div>"
assert old in hub
hub = hub.replace(old, new, 1)
old = "        {expertDomain === 'studio' && <StudioAdvanced />}\n        {expertDomain === 'numerical' && <NumericalBenchAdvanced />}\n        {expertDomain === 'magnet' && <MagnetBenchAdvanced />}"
new = "        <div hidden={expertDomain !== 'studio'}><StudioAdvanced /></div>\n        <div hidden={expertDomain !== 'numerical'}><NumericalBenchAdvanced /></div>\n        <div hidden={expertDomain !== 'magnet'}><MagnetBenchAdvanced /></div>"
assert old in hub
hub = hub.replace(old, new, 1)
hub_path.write_text(hub)

# ---------- Version ----------
package_path = root / 'package.json'
package = json.loads(package_path.read_text())
package['version'] = '0.2.0-alpha.5'
package_path.write_text(json.dumps(package, indent=2) + '\n')

tauri_path = root / 'src-tauri/tauri.conf.json'
tauri = json.loads(tauri_path.read_text())
tauri['version'] = '0.2.0-alpha.5'
tauri_path.write_text(json.dumps(tauri, indent=2) + '\n')

cargo_path = root / 'src-tauri/Cargo.toml'
cargo_path.write_text(cargo_path.read_text().replace('version = "0.2.0-alpha.4"', 'version = "0.2.0-alpha.5"', 1))
cargo_lock_path = root / 'src-tauri/Cargo.lock'
cargo_lock_path.write_text(cargo_lock_path.read_text().replace('name = "betterboard-studio"\nversion = "0.2.0-alpha.4"', 'name = "betterboard-studio"\nversion = "0.2.0-alpha.5"', 1))
lib_path = root / 'src-tauri/src/lib.rs'
lib_path.write_text(lib_path.read_text().replace('const APP_VERSION: &str = "0.2.0-alpha.4";', 'const APP_VERSION: &str = "0.2.0-alpha.5";', 1))

# ---------- Changelog ----------
changelog_path = root / 'CHANGELOG.md'
changelog = changelog_path.read_text()
section = '''## 0.2.0-alpha.5\n\n- Added a shared **EngineeringPlot** surface with real horizontal/vertical axes, ticks, grid lines, engineering units, and axis titles.\n- Replaced the floating normalized polyline in Monitor & Data with a time-domain plot: `time (s)` versus the selected channel and declared unit.\n- Replaced the Magnet model-validation floating polyline with `position (mm)` versus corrected field `(µT)`, preserving measured/model distinction.\n- Studio stateful pages now remain mounted while hidden, so switching Hardware/Circuit/Library/Monitor/Developer no longer destroys page state; a live Serial Monitor is no longer stopped just because another Studio page is opened.\n- Numerical, Magnet, and expert experiment surfaces likewise remain mounted across domain switching, preserving in-progress parameters, captures, imports, and analysis state.\n- Corrected the Studio sidebar version label to Alpha 0.5.\n\n'''
assert '# Changelog\n\n' in changelog
changelog_path.write_text(changelog.replace('# Changelog\n\n', '# Changelog\n\n' + section, 1))

# ---------- Regression contracts ----------
self_path = root / 'scripts/self_check.py'
s = self_path.read_text()
s = s.replace("OPENGUIN_BRIDGE = ROOT / 'src' / 'OpenPenguinBridge.tsx'\nSMART_EDITOR =", "OPENGUIN_BRIDGE = ROOT / 'src' / 'OpenPenguinBridge.tsx'\nENGINEERING_PLOT = ROOT / 'src' / 'EngineeringPlot.tsx'\nSMART_EDITOR =")
s = s.replace('HARDWARE_SESSION, OBSERVATORY, LEARNING, RECIPE_PARAMETERS, RUNTIME_LOG, OPENGUIN_BRIDGE, SMART_EDITOR,', 'HARDWARE_SESSION, OBSERVATORY, LEARNING, RECIPE_PARAMETERS, RUNTIME_LOG, OPENGUIN_BRIDGE, ENGINEERING_PLOT, SMART_EDITOR,')
needle = "    assert 'Expert workflows' in hub and 'Advanced Tools' not in hub\n"
extra = '''    # Page state and engineering plot contracts.\n    engineering_plot = ENGINEERING_PLOT.read_text()\n    for token in ['xLabel', 'yLabel', 'xTicks', 'yTicks', 'axisTitle', 'engineering-grid-line']:\n        assert token in engineering_plot, token\n    assert \"hidden={tab !== 'data'}\" in app_text\n    assert \"hidden={tab !== 'developer'}\" in app_text\n    assert \"hidden={tab !== 'circuit'}\" in app_text\n    assert \"hidden={domain !== 'numerical'}\" in hub\n    assert \"hidden={domain !== 'magnet'}\" in hub\n    assert 'EngineeringPlot' in monitor_text\n    assert 'xLabel=\"time\"' in monitor_text and 'xUnit=\"s\"' in monitor_text\n    assert 'EngineeringPlot' in magnet_ui\n    assert 'xLabel=\"position\"' in magnet_ui and 'xUnit=\"mm\"' in magnet_ui and 'yUnit=\"µT\"' in magnet_ui\n'''
assert needle in s
s = s.replace(needle, needle + extra, 1)
s = s.replace("assert package['version'] == '0.2.0-alpha.4'", "assert package['version'] == '0.2.0-alpha.5'")
s = s.replace("assert tauri['version'] == '0.2.0-alpha.4'", "assert tauri['version'] == '0.2.0-alpha.5'")
s = s.replace("assert '0.2.0-alpha.4' in (ROOT / 'src-tauri' / 'Cargo.toml').read_text()", "assert '0.2.0-alpha.5' in (ROOT / 'src-tauri' / 'Cargo.toml').read_text()")
s = s.replace('BetterBoard Studio v0.2.0-alpha.4 self-check', 'BetterBoard Studio v0.2.0-alpha.5 self-check')
self_path.write_text(s)

surface_path = root / 'scripts/functionality_surface_check.py'
f = surface_path.read_text()
marker = "    'Smart Arduino Editor': SRC / 'SmartArduinoEditor.tsx',\n"
if marker in f and "'Engineering Plot'" not in f:
    f = f.replace(marker, "    'Engineering Plot': SRC / 'EngineeringPlot.tsx',\n" + marker, 1)
print_marker = "print('BetterBoard functionality surface check: PASS')"
assertions = '''# Persistent-page and plotted-axis contracts.\nengineering_plot = (SRC / 'EngineeringPlot.tsx').read_text()\nmonitor = (SRC / 'MonitorDataStudio.tsx').read_text()\nmagnet = (SRC / 'MagnetBenchSuiteV2.tsx').read_text()\nhub = (SRC / 'ExperimentsHub.tsx').read_text()\napp_surface = (SRC / 'App.tsx').read_text()\nfor token in ['xLabel', 'yLabel', 'xTicks', 'yTicks', 'axisTitle', 'engineering-grid-line']:\n    assert token in engineering_plot, f'Engineering plot lost {token}'\nfor token in [\"hidden={tab !== 'developer'}\", \"hidden={tab !== 'data'}\", \"hidden={tab !== 'circuit'}\"]:\n    assert token in app_surface, f'Studio persistence lost {token}'\nfor token in [\"hidden={domain !== 'numerical'}\", \"hidden={domain !== 'magnet'}\"]:\n    assert token in hub, f'Experiment persistence lost {token}'\nassert 'xLabel=\"time\"' in monitor and 'yLabel={selectedColumn}' in monitor\nassert 'xLabel=\"position\"' in magnet and 'yUnit=\"µT\"' in magnet\n\n'''
assert print_marker in f
f = f.replace(print_marker, assertions + print_marker, 1)
surface_path.write_text(f)

print('alpha.5 persistence + engineering axes refactor applied')
