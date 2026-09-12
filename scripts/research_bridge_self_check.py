#!/usr/bin/env python3
from pathlib import Path

root = Path(__file__).resolve().parents[1]
bridge = (root / 'src' / 'ResearchBridge.ts').read_text(encoding='utf-8')
studio = (root / 'src' / 'EngineeringPreparationStudio.tsx').read_text(encoding='utf-8')

bridge_required = [
    "betterboard.research-bridge/1.0",
    "'human' | 'betterboard' | 'engineering-lab' | 'openguin'",
    'research_context',
    'notebook',
    'annotations',
    'lab_journey',
    'engineering_lab',
    "provider: 'OpenPenguin'",
    'must not replace BetterBoard raw measurement evidence',
    'must remain distinguishable from measurements',
    'provenance',
]
for token in bridge_required:
    if token not in bridge:
        raise SystemExit('Research Bridge contract missing: ' + token)

studio_required = [
    'BetterBoard Research Bridge',
    'Copy Research Bridge JSON',
    'OpenPenguin bridge',
    "invoke<OpenPenguinStatus>('openguin_probe')",
    "invoke<string>('openguin_generate'",
    'bridgeForOpenPenguin',
    'Raw measurement remains immutable evidence',
]
for token in studio_required:
    if token not in studio:
        raise SystemExit('Engineering Preparation lost Research Bridge surface: ' + token)

if 'aiAnswer' not in studio or 'OpenPenguin suggestion' not in studio:
    raise SystemExit('OpenPenguin advisory output is no longer visibly separated')

print('Research Bridge self-check: PASS')
print('- BetterBoard / Engineering Lab / OpenPenguin origins remain distinct')
print('- Notebook / Annotation / Lab Journey integration hooks remain present')
print('- raw evidence remains separate from derived analysis and AI suggestions')
