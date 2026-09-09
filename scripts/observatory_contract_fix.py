#!/usr/bin/env python3
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]

def rw(path):
    p=ROOT/path
    return p,p.read_text()

# Self-check: Learning was deliberately removed from product IA.
p,s=rw(Path('scripts/self_check.py'))
s=s.replace("LEARNING = ROOT / 'src' / 'LearningHub.tsx'\n","")
s=s.replace('HARDWARE_SESSION, OBSERVATORY, LEARNING, RECIPE_PARAMETERS','HARDWARE_SESSION, OBSERVATORY, RECIPE_PARAMETERS')
s=s.replace('EXPERIMENTS_HUB, HARDWARE_SESSION, OBSERVATORY, LEARNING, RECIPE_PARAMETERS','EXPERIMENTS_HUB, HARDWARE_SESSION, OBSERVATORY, RECIPE_PARAMETERS')
p.write_text(s)

# Keep exact-control compatibility tools reachable, but subordinate to Engineering Lab bridge purpose.
p,s=rw(Path('src/ExperimentsHub.tsx'))
s=s.replace("import MagnetBenchSuiteV2 from './MagnetBenchSuiteV2';\nimport CopyButton", "import MagnetBenchSuiteV2 from './MagnetBenchSuiteV2';\nimport NumericalBenchAdvanced from './NumericalBenchAdvanced';\nimport MagnetBenchAdvanced from './MagnetBenchAdvanced';\nimport StudioAdvanced from './StudioAdvanced';\nimport CopyButton")
s=s.replace("  const [tool, setTool] = useState<'none'|'numerical'|'magnet'>('none');", "  const [tool, setTool] = useState<'none'|'numerical'|'magnet'>('none');\n  const [expert, setExpert] = useState<'studio'|'numerical'|'magnet'>('numerical');")
needle="    <section className=\"panel\" style={{maxWidth:1420,margin:'14px auto 50px'}}><div className=\"panel-title\"><ArrowRight size={18}/> Bridge tools</div><p className=\"muted\">These are BetterBoard-side preparation tools for Engineering Lab workflows, not a second Recipe Library.</p><div className=\"action-row\"><button className={tool==='numerical'?'primary':'ghost'} onClick={()=>setTool(tool==='numerical'?'none':'numerical')}><Sigma size={15}/> Numerical evidence preparation</button><button className={tool==='magnet'?'primary':'ghost'} onClick={()=>setTool(tool==='magnet'?'none':'magnet')}><Magnet size={15}/> Magnet evidence preparation</button></div><div hidden={tool!=='numerical'}><NumericalBenchSuiteV2/></div><div hidden={tool!=='magnet'}><MagnetBenchSuiteV2/></div></section>"
replacement=needle+"\n    <section className=\"panel\" style={{maxWidth:1420,margin:'14px auto 50px'}}><details><summary><b>Expert workflows</b> · exact analyzers / classic controls</summary><p className=\"muted\">Compatibility controls remain reachable so the Engineering Lab refocus does not delete proven analysis paths. They are not primary Experiment navigation.</p><div className=\"action-row\"><button className={expert==='studio'?'primary':'ghost'} onClick={()=>setExpert('studio')}>Studio expert</button><button className={expert==='numerical'?'primary':'ghost'} onClick={()=>setExpert('numerical')}>Numerical expert</button><button className={expert==='magnet'?'primary':'ghost'} onClick={()=>setExpert('magnet')}>Magnet expert</button></div><div hidden={expert!=='studio'}><StudioAdvanced/></div><div hidden={expert!=='numerical'}><NumericalBenchAdvanced/></div><div hidden={expert!=='magnet'}><MagnetBenchAdvanced/></div></details></section>"
if needle not in s: raise SystemExit('Experiments bridge tools anchor missing')
s=s.replace(needle,replacement)
p.write_text(s)

# Rewrite functionality surface contract for intentional IA change while keeping old capability protections.
p,s=rw(Path('scripts/functionality_surface_check.py'))
s=s.replace("    'Learning': SRC / 'LearningHub.tsx',\n","")
s=s.replace("learning = (SRC / 'LearningHub.tsx').read_text()\n","")
s=s.replace("    \"'studio' | 'observatory' | 'experiments' | 'learning'\",", "    \"'studio' | 'observatory' | 'experiments'\",")
s=s.replace("    'concepts · guided labs · equations',\n","")
start=s.index("# Observatory must be a real runtime surface backed by existing system/evidence/task sources.")
end=s.index("# Streamlined defaults must remain.")
new="""# Observatory is now the whole-system read-mostly observability surface.\nfor token in [\n    'System Observatory', 'arduino_cli_discovery', 'measurement_sessions', 'measurement_session_load',\n    'recipe_catalog', 'device_catalog', 'openguin_probe', 'Latest data observation',\n    'Engineering Lab bridge readiness', 'Background operations', 'Recent measurement evidence',\n    'Recipe & device inventory', 'Copy latest data', 'Scientific boundaries',\n]:\n    assert token in observatory, f'Observatory lost {token}'\n\n# Learning was intentionally removed; general learning/Arduino guidance belongs in Recipe Library/Studio.\nassert not (SRC / 'LearningHub.tsx').exists(), 'Learning workspace should stay removed after IA refocus'\nassert \"id: 'learning'\" not in main, 'Learning regressed into top-level navigation'\n\n# Experiments is dedicated to Engineering Lab connection, not a duplicate Recipe Library.\nfor token in [\n    'Connect with Engineering Lab', 'BetterBoard → Engineering Lab handoff', 'Numerical Error Analysis',\n    'Oscillation & Numerical Integration', 'RADIA Magnet Studio', 'Load BetterBoard evidence',\n    'Copy handoff', 'Numerical evidence preparation', 'Magnet evidence preparation',\n]:\n    assert token in hub, f'Engineering Lab Experiments lost {token}'\n\n"""
s=s[:start]+new+s[end:]
s=s.replace("for token in ['NumericalBenchSuiteV2', 'MagnetBenchSuiteV2', 'Expert workflows']:", "for token in ['NumericalBenchSuiteV2', 'MagnetBenchSuiteV2', 'Expert workflows']:")
# Replace outdated experiment-domain persistence requirement with bridge-tool persistence/compatibility.
s=s.replace("for token in [\"hidden={domain !== 'numerical'}\", \"hidden={domain !== 'magnet'}\"]:\n    assert token in hub, f'Experiment persistence lost {token}'\n", "for token in [\"hidden={tool!=='numerical'}\", \"hidden={tool!=='magnet'}\", 'StudioAdvanced', 'NumericalBenchAdvanced', 'MagnetBenchAdvanced']:\n    assert token in hub, f'Engineering Lab bridge/compatibility surface lost {token}'\n")
s=s.replace("print('- four-layer global workspace / mission / hardware status hierarchy protected')", "print('- three-workspace global hierarchy protected: Studio / Observatory / Experiments')")
s=s.replace("print('- Observatory is backed by real hardware, CLI, task and measurement-session sources')", "print('- Observatory covers hardware, toolchain, acquisition, data, evidence, inventory, AI and Engineering Lab readiness')")
s=s.replace("print('- Learning keeps concept → experiment links for numerical and validation work')", "print('- Learning top-level workspace intentionally removed; guidance remains in Studio/Recipe context')")
p.write_text(s)
print('Observatory/Engineering Lab contract update applied')
