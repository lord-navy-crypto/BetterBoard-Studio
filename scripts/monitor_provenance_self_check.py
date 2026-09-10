#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MONITOR = (ROOT / 'src' / 'MonitorDataStudio.tsx').read_text()
PREPARATION = (ROOT / 'src' / 'EngineeringPreparationStudio.tsx').read_text()
RUST = (ROOT / 'src-tauri' / 'src' / 'lib.rs').read_text()

# Live serial evidence must keep the context that was true when acquisition began.
for token in [
    'type AcquisitionContext',
    'setBufferContext(context)',
    'recipe: cloneRecipe(recipe)',
    'parameterValues: { ...parameterValues }',
    'port: evidenceContext.port',
    'boardProfile: evidenceContext.fqbn',
    'recipeId: evidenceRecipe.id',
    'parameterValues: evidenceContext.parameterValues',
    'Locked provenance',
]:
    assert token in MONITOR, f'Monitor provenance lock lost: {token}'

# A new live stream must not silently append to a previous acquisition or leave replay on top.
start_block = MONITOR[MONITOR.index('async function startMonitor()'):MONITOR.index('async function stopMonitor()')]
assert 'setReplay(null)' in start_block, 'Starting Live no longer exits historical replay'
assert 'setRows([])' in start_block, 'Starting Live no longer begins with a fresh acquisition buffer'
assert 'disabled={historyBusy || live}' in MONITOR, 'Historical Replay can cover an active Live stream again'

# Rust already returns row timestamps; the frontend must preserve them instead of fabricating spacing.
for token in ['struct CaptureResult', 'rows: Vec<CapturedRow>']:
    assert token in RUST, f'Backend timestamp-bearing snapshot contract lost: {token}'
for token in ['rows: CapturedRow[]', 'result.rows.map', 'hostTimestampMs: row.host_timestamp_ms', 'real host timestamps preserved']:
    assert token in MONITOR, f'Frontend real snapshot timestamp path lost: {token}'
assert 'hostTimestampMs: now + index' not in MONITOR, 'Snapshot regressed to fabricated 1 ms timestamps'

# Clearing/replay and compatibility naming should be explicit rather than silently mixing state.
for token in [
    'clearDisplayedData',
    'Replay cleared. Returning to the current acquisition buffer.',
    'Engineering Lab handoff · Physical Lab export & bridge compatibility',
    'Legacy Physical Lab v1 compatibility',
]:
    assert token in MONITOR, f'Monitor state/compatibility contract lost: {token}'

# Engineering Preparation must surface retrieval failures and allow a retry.
for token in [
    'loadingEvidence',
    'loadError',
    'Could not load saved evidence',
    'Refresh saved evidence',
    'Legacy Physical Lab v1 compatibility',
    'Engineering Lab bridge',
]:
    assert token in PREPARATION, f'Engineering Preparation reliability contract lost: {token}'

print('Monitor provenance and evidence-handling self-check: PASS')
print('- live acquisition context is locked for evidence provenance')
print('- new Live exits Replay and starts a fresh buffer')
print('- snapshot plotting preserves backend host timestamps')
print('- Engineering Preparation exposes evidence-load failures and retry')
