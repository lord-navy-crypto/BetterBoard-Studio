#!/usr/bin/env python3
"""Deterministic self-checks for Hardware Numeric Error Depth 2."""
from __future__ import annotations

import importlib.util
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ANALYZER = ROOT / 'scripts' / 'hardware_numeric_error_analyzer.py'


def load_analyzer():
    spec = importlib.util.spec_from_file_location('hardware_numeric_error_analyzer', ANALYZER)
    if spec is None or spec.loader is None:
        raise AssertionError('Could not load analyzer')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def check_quantization(mod):
    assert mod.q10(0, 8) == 0
    assert mod.q10(1023, 8) == 255
    assert mod.q10(512, 8) == 128
    err = float(mod.exact_reconstruction(mod.q10(512, 4), 4) - 512)
    assert abs(err) <= float(mod.Decimal(1023) / mod.Decimal(15) / 2) + 1e-9


def check_photogate(mod):
    freq, rpm = mod.photogate_reference(10_000, mod.Decimal('1'))
    assert float(freq) == 100.0
    assert float(rpm) == 6000.0
    rows = [{
        'period_us': '10000', 'frequency_hz': '100.000000000', 'rpm': '6000.000000000',
        'pulses_per_revolution': '1', 'timer_quantum_us': '4', 'total_rejected': '2'
    }]
    result = mod.analyze_photogate(rows)
    assert result['rejected_edges_total'] == 2
    assert 0.0 < result['timer_quantization']['mean_frequency_half_width_hz'] < 0.1


def check_pir(mod):
    rows = [
        {'edges_since_last_report':'1','coalesced_edge_risk':'0','matched_latest_edge':'1','poll_detection_delay_us':'800','poll_interval_us':'2000'},
        {'edges_since_last_report':'2','coalesced_edge_risk':'1','matched_latest_edge':'0','poll_detection_delay_us':'0','poll_interval_us':'2000'},
    ]
    result = mod.analyze_pir(rows)
    assert result['matched_transitions'] == 1
    assert result['coalesced_edge_risk_reports'] == 1
    assert result['poll_detection_delay_us']['mean'] == 800.0


def check_multi(mod):
    rows = [{
        'schedule_lateness_us':'20','raw10':'512','q8':'128','photo_coalesced':'1','pir_coalesced':'0',
        'photo_period_us':'10000','photo_frequency_hz':'100.000000000'
    }]
    result = mod.analyze_multi(rows)
    assert result['q8_mapping_mismatches'] == 0
    assert result['photo_coalesced_sample_fraction'] == 1.0
    assert math.isclose(result['photo_frequency_abs_error_host_mean_hz'], 0.0, abs_tol=1e-12)


def check_firmware_markers():
    base = ROOT / 'src-tauri' / 'resources' / 'firmware'
    pot = (base / 'HardwareNumericError_Potentiometer' / 'HardwareNumericError_Potentiometer.ino').read_text()
    photo = (base / 'HardwareNumericError_Photogate' / 'HardwareNumericError_Photogate.ino').read_text()
    pir = (base / 'HardwareNumericError_PIR' / 'HardwareNumericError_PIR.ino').read_text()
    multi = (base / 'HardwareNumericError_MultiSensor' / 'HardwareNumericError_MultiSensor.ino').read_text()
    assert 'BB_OVERSAMPLE_COUNT' in pot and 'q4' in pot
    assert 'Rejected close edges never move the accepted baseline' in photo
    assert 'polling latency' in pir and 'attachInterrupt' in pir
    assert 'photo_events_since_sample' in multi and 'pir_edges_since_sample' in multi


def main() -> int:
    mod = load_analyzer()
    check_quantization(mod)
    check_photogate(mod)
    check_pir(mod)
    check_multi(mod)
    check_firmware_markers()
    print('BetterBoard hardware numeric-error self-check: PASS')
    print('- exact 10-bit requantization contract verified')
    print('- photogate reciprocal + timer-quantum propagation verified')
    print('- PIR interrupt-vs-polling latency semantics verified')
    print('- multi-sensor event coalescing evidence verified')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
