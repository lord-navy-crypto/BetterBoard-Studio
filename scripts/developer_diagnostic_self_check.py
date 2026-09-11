from pathlib import Path

src = Path('src/DeveloperIDE.tsx').read_text()

required = {
    'compiler diagnostic captures source path': "const sourcePath = match[1].trim().replace(/\\\\/g, '/')",
    'compiler diagnostic filters active file': 'if (active && sourceFile !== active) continue;',
    'verify passes active diagnostic file': 'compileDiagnostics(text, diagnosticFileName)',
    'upload passes active diagnostic file': 'compileDiagnostics(compileResult, diagnosticFileName)',
    'standalone diagnostic filename is canonical': '`${safeDefaultName(sketchName)}.ino`',
    'frontend sketch naming matches backend prefix rule': "candidate = `Sketch_${candidate}`",
    'save canonicalizes standalone sketch name': 'const canonicalSketchName = safeDefaultName(sketchName);',
    'save reflects canonical name in editor': 'setSketchName(canonicalSketchName);',
    'diagnostic count is current-file scoped': 'current-file diagnostic(s)',
    'compiler diagnostic column is optional': r"(?::(\d+))?",
    'missing compiler column maps to line-only marker': "column: match[3] ? Number(match[3]) : undefined",
    'severity index follows optional column capture': "severity: match[4].toLowerCase()",
    'message index follows optional column capture': "message: match[5].trim()",
}

missing = [label for label, token in required.items() if token not in src]
if missing:
    raise SystemExit('Developer diagnostic attribution contract failed: ' + ', '.join(missing))

old_regex = "const regex = /:(\\d+):(\\d+):\\s+(error|warning):\\s+(.+)/gi;"
if old_regex in src:
    raise SystemExit('Developer diagnostic attribution contract failed: filename-blind diagnostic parser remains')

if "const regex = /^(.+?):(\\d+):(\\d+):\\s+(error|warning):\\s+(.+)$/gim;" in src:
    raise SystemExit('Developer diagnostic attribution contract failed: parser still requires a column')

print('Developer diagnostic attribution contract OK')
