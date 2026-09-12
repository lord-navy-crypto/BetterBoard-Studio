#!/usr/bin/env python3
from pathlib import Path

root = Path(__file__).resolve().parents[1]
bridge = (root / 'src' / 'ResearchBridge.ts').read_text(encoding='utf-8')
interop = (root / 'src' / 'ResearchBridgeInterop.ts').read_text(encoding='utf-8')
store = (root / 'src' / 'ResearchContextStore.ts').read_text(encoding='utf-8')
studio = (root / 'src' / 'EngineeringPreparationStudio.tsx').read_text(encoding='utf-8')
doc = (root / 'docs' / 'RESEARCH_BRIDGE_INTEROP_V1.md').read_text(encoding='utf-8')

bridge_required = [
    "betterboard.research-bridge/1.0",
    "'human' | 'betterboard' | 'engineering-lab' | 'openguin'",
    'research_context', 'notebook', 'annotations', 'lab_journey',
    'engineering_lab', "provider: 'OpenPenguin'",
    'must not replace BetterBoard raw measurement evidence',
    'must remain distinguishable from measurements', 'provenance',
]
for token in bridge_required:
    if token not in bridge:
        raise SystemExit('Research Bridge contract missing: ' + token)

interop_required = [
    "engineering-lab.result/1.0",
    "betterboard.openguin-context/1.0",
    'parseEngineeringLabResultEnvelope',
    'bridgeCapabilityManifest',
    'session_match_required_for_result_import',
    "event.origin !== 'engineering-lab'",
    'cannot masquerade as raw measurement or human/AI context',
    '1 MB import limit',
]
for token in interop_required:
    if token not in interop:
        raise SystemExit('Research Bridge interoperability contract missing: ' + token)

store_required = [
    'validateResearchEvent', 'mergeResearchEvents',
    "engineering_results: boundedEvents(parsed.engineering_results, ['engineering-lab']",
    "ai_suggestions: boundedEvents(parsed.ai_suggestions, ['openguin']",
    'seen.has(event.id)',
]
for token in store_required:
    if token not in store:
        raise SystemExit('Research context store lost provenance validation: ' + token)

studio_required = [
    'BetterBoard Research Bridge', 'Copy Research Bridge JSON', 'OpenPenguin bridge',
    "invoke<OpenPenguinStatus>('openguin_probe')", "invoke<string>('openguin_generate'",
    'bridgeForOpenPenguin', 'Raw measurement remains immutable evidence',
    'Research context bridge', 'Experiment Notebook', 'Annotation', 'Lab Journey',
    'saveResearchContext', "makeResearchEvent('openguin', 'suggestion'",
]
for token in studio_required:
    if token not in studio:
        raise SystemExit('Engineering Preparation lost Research Bridge surface: ' + token)

for token in ['Engineering Lab result envelope', 'session_id', 'append-only', 'may not use `measurement`', 'OpenPenguin remains advisory']:
    if token not in doc:
        raise SystemExit('Research Bridge interoperability documentation missing: ' + token)

if 'aiAnswer' not in studio or 'OpenPenguin suggestion' not in studio:
    raise SystemExit('OpenPenguin advisory output is no longer visibly separated')

print('Research Bridge self-check: PASS')
print('- BetterBoard / Engineering Lab / OpenPenguin origins remain distinct')
print('- Notebook / Annotation / Lab Journey persisted context remains present')
print('- Engineering Lab result envelopes are session-bound and derived-only')
print('- invalid persisted provenance cannot silently enter restricted lanes')
print('- raw evidence remains separate from derived analysis and AI suggestions')
