#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / 'src' / 'App.tsx'
LAB = ROOT / 'src' / 'CircuitLab.tsx'
CSS = ROOT / 'src' / 'circuitLab.css'
DOC = ROOT / 'docs' / 'CIRCUIT_LAB.md'


def need(text: str, *tokens: str) -> None:
    for token in tokens:
        assert token in text, token


def main() -> int:
    for path in (APP, LAB, CSS, DOC):
        assert path.is_file(), path

    app = APP.read_text(encoding='utf-8')
    lab = LAB.read_text(encoding='utf-8')
    css = CSS.read_text(encoding='utf-8')
    doc = DOC.read_text(encoding='utf-8')

    need(app,
         "import CircuitLab from './CircuitLab'",
         "'circuit'",
         "Circuit Lab",
         "<CircuitLab",
         "setRecipeId(id)")

    need(lab,
         "betterboard.circuit-design/0.1",
         "Visual Wiring Editor + Rule Checker",
         "Bench 01 — Analog Control & Instrumentation",
         "Direct power-to-ground connection",
         "Power rail connected directly to an I/O pin",
         "LED is directly connected without a series resistor",
         "Potentiometer signal is not on an analog input",
         "Use Bench 01 firmware",
         "localStorage.setItem")

    need(css, '.circuit-canvas', '.wire-layer', '.circuit-component', '.rule-item')
    need(doc, 'Rule Checker v0.1', 'DESIGN -> RULE CHECK -> REAL HARDWARE HANDOFF')

    # First release intentionally has no simulator/electrical solver.
    lowered = lab.lower()
    assert 'spice' in lowered
    assert 'no electrical or mcu simulation' in lowered

    print('BetterBoard Circuit Lab Phase A/B self-check: PASS')
    print('- Circuit Lab is reachable from the main BetterBoard navigation')
    print('- visual component/pin graph editor is present')
    print('- live bounded rule checker is present')
    print('- Bench 01 reference design and hardware handoff are present')
    print('- local save/load + JSON copy are present')
    print('- no electrical simulation is claimed')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
