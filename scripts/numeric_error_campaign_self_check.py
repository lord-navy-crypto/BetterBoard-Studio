#!/usr/bin/env python3
from __future__ import annotations

from numeric_error_campaign_analyzer import analyze, classify, json_safe


def check_classification():
    cases = {
        'adc_stability_v2': ['mean_adc','stddev_adc','max_sample_lateness_us','peak_to_peak_adc'],
        'quantization_v2': ['raw10','q8','error8_counts','q6','error6_counts','q4','error4_counts'],
        'pwm_quantization_v2': ['raw10','pwm8','duty_fraction','error_counts'],
        'filter_lag_v2': ['ema_fast_v','ema_slow_v','fast_residual_v','slow_residual_v'],
        'derivative_v2': ['h','forward','central','mcu_cos_reference','forward_us','central_us'],
        'integration_v2': ['n','left','trapezoid','simpson','left_us','trapezoid_us','simpson_us'],
        'summation_v3': ['increment_num','increment_den','naive','kahan','naive_us','kahan_us'],
        'photogate_v3': ['accepted_event_index','event_us','period_us','dropped_accepted_events','emit_lag_us'],
        'pir_timing_v2': ['event_index','event_type','high_duration_us','polls_since_previous_event'],
        'multi_sensor_v3': ['raw_adc','filtered_v','photo_events_since_sample','photo_rejected_total'],
    }
    for expected, fields in cases.items():
        actual = classify(fields)
        assert actual == expected, (expected, actual)


def check_semantics():
    q = analyze('quantization_v2', [{
        'error8_counts':'1.0','error6_counts':'2.0','error4_counts':'3.0'
    }])
    assert q['metrics']['8']['max_abs_error_counts'] == 1.0

    s = analyze('summation_v3', [{
        'n':'10000','increment_num':'1','increment_den':'10000',
        'naive':'0.9999','kahan':'1.0','naive_us':'1','kahan_us':'2'
    }])
    assert s['metrics']['kahan_max_abs_error'] == 0.0
    assert s['metrics']['naive_max_abs_error'] > 0.0

    p = analyze('photogate_v3', [{
        'period_us':'10000','emit_lag_us':'50','dropped_accepted_events':'0','total_rejected':'2'
    }])
    assert p['metrics']['period_mean_us'] == 10000.0
    assert p['metrics']['max_total_rejected'] == 2.0

    safe = json_safe({'x': float('nan'), 'y': [float('inf'), 1.0]})
    assert safe == {'x': None, 'y': [None, 1.0]}


if __name__ == '__main__':
    check_classification()
    check_semantics()
    print('numeric_error_campaign_self_check: PASS')
