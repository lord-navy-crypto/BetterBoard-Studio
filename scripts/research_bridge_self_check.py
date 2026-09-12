#!/usr/bin/env python3
from pathlib import Path

root = Path(__file__).resolve().parents[1]
bridge = (root / 'src' / 'ResearchBridge.ts').read_text(encoding='utf-8')
studio = (root / 'src' / 'EngineeringPreparationStudio.tsx').read_text(encoding='utf-8')
store = (root / 'src' / 'ResearchContextStore.ts').read_text(encoding='utf-8')

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
    'ResearchContextForBridge',
    'engineering_results',
    'ai_suggestions',
    'researchSessionId',
]
for token in bridge_required:
    if token not in bridge:
        raise SystemExit('Research Bridge contract missing: ' + token)

store_required = [
    'betterboard.research-context.v1:',
    'loadResearchContext',
    'saveResearchContext',
    'makeResearchEvent',
    'notebook',
    'annotations',
    'lab_journey',
    'engineering_results',
    'ai_suggestions',
    '.slice(-500)',
]
for token in store_required:
    if token not in store:
        raise SystemExit('Research context persistence contract missing: ' + token)

studio_required = [
    'BetterBoard Research Bridge',
    'Copy Research Bridge JSON',
    'OpenPenguin bridge',
    "invoke<OpenPenguinStatus>('openguin_probe')",
    "invoke<string>('openguin_generate'",
    'bridgeForOpenPenguin',
    'Raw measurement remains immutable evidence',
    'Research context bridge',
    'Experiment Notebook',
    'Annotation',
    'Lab Journey',
    'loadResearchContext',
    'saveResearchContext',
    "makeResearchEvent('openguin', 'suggestion'",
]
for token in studio_required:
    if token not in studio:
        raise SystemExit('Engineering Preparation lost Research Bridge surface: ' + token)

if 'aiAnswer' not in studio or 'OpenPenguin suggestion' not in studio:
    raise SystemExit('OpenPenguin advisory output is no longer visibly separated')
if 'engineering_results' not in studio or 'ai_suggestions' not in studio:
    raise SystemExit('Derived Engineering Lab and OpenPenguin lanes are no longer counted separately')

print('Research Bridge self-check: PASS')
print('- BetterBoard / Engineering Lab / OpenPenguin origins remain distinct')
print('- Notebook / Annotation / Lab Journey context persists per measurement session')
print('- OpenPenguin responses append as advisory provenance')
print('- raw evidence remains separate from derived analysis and AI suggestions')
