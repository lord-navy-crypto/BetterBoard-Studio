#!/usr/bin/env python3
"""Host-side analysis for BetterBoard Hardware Numeric Error Depth 2."""
from __future__ import annotations

import argparse
import csv
import json
import math
import statistics
import struct
from decimal import Decimal, getcontext
from pathlib import Path

getcontext().prec = 50


def f32(value: float) -> float:
    return struct.unpack('<f', struct.pack('<f', float(value)))[0]


def mean(values):
    values = list(values)
    return statistics.fmean(values) if values else math.nan


def rms(values):
    values = [float(v) for v in values if math.isfinite(float(v))]
    return math.sqrt(mean(v * v for v in values)) if values else math.nan


def p95(values):
    values = sorted(float(v) for v in values)
    if not values:
        return math.nan
    return values[min(len(values) - 1, math.ceil(0.95 * len(values)) - 1)]


def load_csv(path: Path):
    with path.open(newline='') as handle:
        reader = csv.DictReader(handle)
        fields = reader.fieldnames or []
        rows = list(reader)
    if not fields:
        raise ValueError('CSV has no header')
    return fields, rows


def classify(fields):
    s = set(fields)
    if {'raw10', 'q8', 'q6', 'q4', 'oversample_mean_counts'} <= s:
        return 'potentiometer_adc'
    if {'period_us', 'frequency_hz', 'rpm', 'timer_quantum_us'} <= s:
        return 'photogate_timing'
    if {'poll_time_us', 'isr_edge_count', 'poll_detection_delay_us', 'matched_latest_edge'} <= s:
        return 'pir_polling'
    if {'raw10', 'photo_period_us', 'photo_events_since_sample', 'pir_edges_since_sample'} <= s:
        return 'multi_sensor'
    raise ValueError(f'Unrecognized hardware numeric-error schema: {fields}')


def q10(raw: int, bits: int) -> int:
    levels = (1 << bits) - 1
    return (raw * levels + 511) // 1023


def exact_reconstruction(q: int, bits: int) -> Decimal:
    levels = (1 << bits) - 1
    return Decimal(q) * Decimal(1023) / Decimal(levels)


def timing_stats(times_us):
    if len(times_us) < 2:
        return {'samples': len(times_us)}
    dt = [b - a for a, b in zip(times_us, times_us[1:])]
    target = statistics.median(dt)
    jitter = [x - target for x in dt]
    return {
        'samples': len(times_us),
        'median_interval_us': target,
        'interval_std_us': statistics.pstdev(dt) if len(dt) > 1 else 0.0,
        'jitter_rms_us': rms(jitter),
        'jitter_p95_abs_us': p95(abs(x) for x in jitter),
        'jitter_max_abs_us': max((abs(x) for x in jitter), default=0.0),
    }


def analyze_pot(rows):
    times, late, p2p = [], [], []
    mismatches = {8: 0, 6: 0, 4: 0}
    errors = {8: [], 6: [], 4: []}
    fast_delta, slow_delta = [], []
    for row in rows:
        raw = int(row['raw10'])
        times.append(float(row['time_us']))
        late.append(float(row['schedule_lateness_us']))
        p2p.append(float(row['oversample_p2p_counts']))
        for bits in (8, 6, 4):
            observed_q = int(row[f'q{bits}'])
            expected_q = q10(raw, bits)
            mismatches[bits] += int(observed_q != expected_q)
            errors[bits].append(float(exact_reconstruction(observed_q, bits) - Decimal(raw)))
        mean_counts = float(row['oversample_mean_counts'])
        fast_delta.append(float(row['ema_fast_counts']) - mean_counts)
        slow_delta.append(float(row['ema_slow_counts']) - mean_counts)
    return {
        'timing': timing_stats(times),
        'schedule_lateness_us': {'mean': mean(late), 'p95': p95(late), 'max': max(late, default=None)},
        'oversample_p2p_counts': {'mean': mean(p2p), 'max': max(p2p, default=None)},
        'requantization': {
            str(bits): {
                'firmware_integer_mapping_mismatches': mismatches[bits],
                'exact_reconstruction_rms_error_counts': rms(errors[bits]),
                'exact_reconstruction_max_abs_error_counts': max((abs(v) for v in errors[bits]), default=None),
                'exact_step_counts': float(Decimal(1023) / Decimal((1 << bits) - 1)),
            }
            for bits in (8, 6, 4)
        },
        'filter_tracking_delta_counts': {
            'fast_rms': rms(fast_delta),
            'slow_rms': rms(slow_delta),
            'note': 'EMA delta is tracking behavior relative to sampled ADC evidence, not calibrated physical error.',
        },
    }


def photogate_reference(period_us: int, ppr: Decimal):
    period = Decimal(period_us)
    freq = Decimal(1_000_000) / period
    rpm = Decimal(60_000_000) / (period * ppr)
    return freq, rpm


def analyze_photogate(rows):
    periods, freq_err, rpm_err, timer_half_width = [], [], [], []
    total_rejected = 0
    for row in rows:
        period = int(row['period_us'])
        if period <= 0:
            continue
        ppr = Decimal(row['pulses_per_revolution'])
        freq_ref, rpm_ref = photogate_reference(period, ppr)
        freq_err.append(abs(float(row['frequency_hz']) - float(freq_ref)))
        rpm_err.append(abs(float(row['rpm']) - float(rpm_ref)))
        quantum = Decimal(row['timer_quantum_us'])
        half = quantum / Decimal(2)
        if Decimal(period) > half:
            low = Decimal(1_000_000) / (Decimal(period) + half)
            high = Decimal(1_000_000) / (Decimal(period) - half)
            timer_half_width.append(float((high - low) / Decimal(2)))
        periods.append(period)
        total_rejected = max(total_rejected, int(row['total_rejected']))
    return {
        'period_us': {
            'count': len(periods),
            'mean': mean(periods),
            'std': statistics.pstdev(periods) if len(periods) > 1 else 0.0,
            'cv': (statistics.pstdev(periods) / mean(periods)) if len(periods) > 1 and mean(periods) else None,
        },
        'reciprocal_transform': {
            'frequency_abs_error_host_mean_hz': mean(freq_err),
            'frequency_abs_error_host_max_hz': max(freq_err, default=None),
            'rpm_abs_error_host_mean': mean(rpm_err),
            'rpm_abs_error_host_max': max(rpm_err, default=None),
        },
        'timer_quantization': {
            'mean_frequency_half_width_hz': mean(timer_half_width),
            'max_frequency_half_width_hz': max(timer_half_width, default=None),
            'note': 'Bound propagates the declared micros() timer quantum only; sensor geometry/edge definition remain measurement effects.',
        },
        'rejected_edges_total': total_rejected,
    }


def analyze_pir(rows):
    delays, edges_since = [], []
    matched = 0
    coalesced = 0
    for row in rows:
        e = int(row['edges_since_last_report'])
        edges_since.append(e)
        coalesced += int(row['coalesced_edge_risk']) != 0
        if int(row['matched_latest_edge']) != 0:
            matched += 1
            delays.append(float(row['poll_detection_delay_us']))
    poll_interval = float(rows[0]['poll_interval_us']) if rows else math.nan
    return {
        'reports': len(rows),
        'matched_transitions': matched,
        'coalesced_edge_risk_reports': coalesced,
        'max_edges_between_reports': max(edges_since, default=0),
        'poll_interval_us': poll_interval,
        'poll_detection_delay_us': {
            'mean': mean(delays),
            'p95': p95(delays),
            'max': max(delays, default=None),
            'fraction_over_nominal_poll_interval': (sum(d > poll_interval for d in delays) / len(delays)) if delays else None,
        },
        'scientific_boundary': 'This measures firmware polling delay relative to the digital PIR edge interrupt, not human-motion-to-sensor latency.',
    }


def analyze_multi(rows):
    late, q_mismatch, photo_coalesced, pir_coalesced = [], 0, 0, 0
    photo_freq_err = []
    for row in rows:
        late.append(float(row['schedule_lateness_us']))
        raw = int(row['raw10'])
        q = int(row['q8'])
        q_mismatch += int(q != q10(raw, 8))
        photo_coalesced += int(row['photo_coalesced']) != 0
        pir_coalesced += int(row['pir_coalesced']) != 0
        period = int(row['photo_period_us'])
        if period > 0:
            ref = float(Decimal(1_000_000) / Decimal(period))
            photo_freq_err.append(abs(float(row['photo_frequency_hz']) - ref))
    return {
        'samples': len(rows),
        'schedule_lateness_us': {'mean': mean(late), 'p95': p95(late), 'max': max(late, default=None)},
        'q8_mapping_mismatches': q_mismatch,
        'photo_coalesced_sample_fraction': photo_coalesced / len(rows) if rows else None,
        'pir_coalesced_sample_fraction': pir_coalesced / len(rows) if rows else None,
        'photo_frequency_abs_error_host_mean_hz': mean(photo_freq_err),
        'photo_frequency_abs_error_host_max_hz': max(photo_freq_err, default=None),
        'note': 'Event counters preserve multiplicity that a fixed-rate sampled state alone could hide.',
    }


def analyze(fields, rows):
    kind = classify(fields)
    if kind == 'potentiometer_adc': metrics = analyze_pot(rows)
    elif kind == 'photogate_timing': metrics = analyze_photogate(rows)
    elif kind == 'pir_polling': metrics = analyze_pir(rows)
    else: metrics = analyze_multi(rows)
    return {
        'schema': 'betterboard.hardware-numeric-error/0.2',
        'experiment': kind,
        'rows': len(rows),
        'columns': fields,
        'metrics': metrics,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('input', type=Path)
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    source = args.input.expanduser().resolve()
    fields, rows = load_csv(source)
    result = analyze(fields, rows)
    result['source'] = str(source)
    output = (args.output or source.parent / 'hardware-numeric-error-analysis').expanduser().resolve()
    output.mkdir(parents=True, exist_ok=True)
    (output / 'summary.json').write_text(json.dumps(result, indent=2, sort_keys=True) + '\n')
    (output / 'report.md').write_text(
        '# BetterBoard Hardware Numeric Error Depth 2\n\n```json\n' +
        json.dumps(result, indent=2, sort_keys=True) +
        '\n```\n\nNumerical transformation error, sampling/timing error, and physical sensor error are not interchangeable.\n'
    )
    print(output)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
