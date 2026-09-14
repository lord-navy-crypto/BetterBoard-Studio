#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
header = (ROOT / 'firmware/betterboard-core/src/math/MathRuntimeCapabilities.h').read_text()
example = (ROOT / 'firmware/betterboard-core/examples/MathRuntimeFusion/MathRuntimeFusion.ino').read_text()
parser = (ROOT / 'src/mathRuntimeCapabilities.ts').read_text()
umbrella = (ROOT / 'firmware/betterboard-core/src/BetterBoard.h').read_text()

required_header = [
    'struct MathRuntimeCapabilities',
    'currentMathRuntimeCapabilities',
    'ARDUINO_ARCH_AVR',
    'avr-lite',
    'esp32-extended',
    'recommended_fft_points',
    'recommended_window_points',
    'recommended_planner_observations',
    'sequential_planning',
]
for token in required_header:
    assert token in header, f'missing C++ capability contract token: {token}'

assert 'math/MathRuntimeCapabilities.h' in umbrella
assert '#BB_MATH_CAPS,' in example
assert 'printCapabilities' in example
assert 'recommended_fft_points' in example
assert 'recommended_window_points' in example
assert 'recommended_planner_observations' in example

required_parser = [
    "const PREFIX = '#BB_MATH_CAPS,'",
    'parts.length !== 13',
    'parseMathRuntimeCapabilities',
    'recommendedFftPoints',
    'recommendedWindowPoints',
    'recommendedPlannerObservations',
    'enabledMathRuntimeCapabilities',
    'Sequential planning',
]
for token in required_parser:
    assert token in parser, f'missing desktop capability parser token: {token}'

# Resource profiles are recommendations, not claims that larger templates cannot compile.
assert '8U, 16U, 16U' in header, 'AVR lite recommendation changed without contract update'
assert '64U, 128U, 128U' in header, 'ESP32 extended recommendation changed without contract update'

print('math runtime capability contract: PASS')
