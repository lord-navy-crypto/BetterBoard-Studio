#!/usr/bin/env python3
"""Analyze BetterBoard Numeric Error Depth campaign CSVs.

This consolidates the useful schema-recognition/summary behavior from the legacy
numeric_error_research_analyzer v1/v2 without treating MCU-local library values
or nominal electrical conversions as independent truth.
"""
from __future__ import annotations
import argparse, csv, json, math, statistics
from pathlib import Path


def mean(xs):
    vals = [float(x) for x in xs if math.isfinite(float(x))]
    return statistics.fmean(vals) if vals else math.nan


def rms(xs):
    vals = [float(x) for x in xs if math.isfinite(float(x))]
    return math.sqrt(statistics.fmean(v * v for v in vals)) if vals else math.nan


def nums(rows, key):
    out = []
    for row in rows:
        try:
            v = float(row[key])
        except (KeyError, TypeError, ValueError):
            continue
        if math.isfinite(v): out.append(v)
    return out


def load(path: Path):
    with path.open(newline='') as f:
        reader = csv.DictReader(line for line in f if line.strip() and not line.lstrip().startswith('#'))
        fields = reader.fieldnames or []
        rows = list(reader)
    if not fields: raise ValueError('CSV has no header')
    return fields, rows


def classify(fields):
    s = set(fields)
    rules = [
        ('adc_stability_v2', {'mean_adc','stddev_adc','max_sample_lateness_us'}),
        ('quantization_v2', {'raw10','q8','error8_counts','q6','error6_counts','q4','error4_counts'}),
        ('pwm_quantization_v2', {'raw10','pwm8','duty_fraction','error_counts'}),
        ('filter_lag_v2', {'ema_fast_v','ema_slow_v','fast_residual_v','slow_residual_v'}),
        ('derivative_v2', {'h','forward','central','mcu_cos_reference','forward_us','central_us'}),
        ('integration_v2', {'n','left','trapezoid','simpson','left_us','trapezoid_us','simpson_us'}),
        ('summation_v3', {'increment_num','increment_den','naive','kahan','naive_us','kahan_us'}),
        ('photogate_v3', {'accepted_event_index','event_us','period_us','dropped_accepted_events','emit_lag_us'}),
        ('pir_timing_v2', {'event_index','event_type','high_duration_us','polls_since_previous_event'}),
        ('multi_sensor_v3', {'raw_adc','filtered_v','photo_events_since_sample','photo_rejected_total'}),
        ('aliasing_v2', {'sample_rate_hz','sample_index','ideal_time_us','actual_time_us','lateness_us','value'}),
        ('fixed_point_v2', {'case_id','step','float_y','q15_raw','q15_y','abs_diff','saturated'}),
        ('cancellation_v2', {'x','direct','reformulated','stable_reference','direct_abs_error','reformulated_abs_error'}),
        ('overflow_v2', {'case_id','kind_id','wide_reference','wrapped','saturated','wrap_error','saturation_error'}),
        ('debounce_v2', {'event_id','event_type','time_us','raw_state','raw_edge_count','dropped_edges'}),
    ]
    for name, need in rules:
        if need <= s: return name
    raise ValueError(f'Unrecognized Numeric Error schema: {fields}')


def observed_orders(errors):
    out=[]
    for a,b in zip(errors,errors[1:]):
        out.append(math.log(a/b,2.0) if a>0 and b>0 else None)
    return out


def analyze(kind, rows):
    result={'schema':'betterboard.numeric-error-campaign/1','experiment':kind,'rows':len(rows)}
    m={}
    if kind=='adc_stability_v2':
        m={'mean_adc':mean(nums(rows,'mean_adc')),'mean_window_stddev_adc':mean(nums(rows,'stddev_adc')),
           'max_peak_to_peak_adc':max(nums(rows,'peak_to_peak_adc'),default=None),
           'max_sample_lateness_us':max(nums(rows,'max_sample_lateness_us'),default=None),
           'boundary':'nominal_mean_voltage_v uses nominal Vref; it is not calibrated voltage truth'}
    elif kind=='quantization_v2':
        for bits in (8,6,4):
            e=nums(rows,f'error{bits}_counts'); step=1023.0/((1<<bits)-1)
            m[str(bits)]={'step_counts':step,'half_step_bound_counts':step/2,'rms_error_counts':rms(e),
                          'max_abs_error_counts':max((abs(x) for x in e),default=None)}
    elif kind=='pwm_quantization_v2':
        e=nums(rows,'error_counts'); step=1023.0/255.0
        m={'step_counts':step,'half_step_bound_counts':step/2,'rms_error_counts':rms(e),
           'max_abs_error_counts':max((abs(x) for x in e),default=None)}
    elif kind=='filter_lag_v2':
        m={'fast_tracking_rmse_v':rms(nums(rows,'fast_residual_v')),'slow_tracking_rmse_v':rms(nums(rows,'slow_residual_v')),
           'mean_lateness_us':mean(nums(rows,'lateness_us')),'max_lateness_us':max(nums(rows,'lateness_us'),default=None)}
    elif kind=='derivative_v2':
        hs=nums(rows,'h'); f=nums(rows,'forward'); c=nums(rows,'central'); ref=math.cos(1.0)
        fe=[abs(v-ref) for v in f]; ce=[abs(v-ref) for v in c]
        fi=min(range(len(fe)),key=fe.__getitem__) if fe else None; ci=min(range(len(ce)),key=ce.__getitem__) if ce else None
        result['reference']={'type':'host_libm','expression':'cos(1.0)','value':ref}
        fu=nums(rows,'forward_us'); cu=nums(rows,'central_us')
        m={'best_forward_h':hs[fi] if fi is not None and fi<len(hs) else None,'best_forward_abs_error':fe[fi] if fi is not None else None,
           'best_central_h':hs[ci] if ci is not None and ci<len(hs) else None,'best_central_abs_error':ce[ci] if ci is not None else None,
           'forward_runtime_median_us':statistics.median(fu) if fu else None,
           'central_runtime_median_us':statistics.median(cu) if cu else None}
    elif kind=='integration_v2':
        result['reference']={'type':'analytic','expression':'integral_0_pi sin(x) dx','value':2.0}
        for name in ('left','trapezoid','simpson'):
            e=[abs(v-2.0) for v in nums(rows,name)]
            m[name]={'errors_host':e,'observed_order_doubling':observed_orders(e),'best_abs_error':min(e) if e else None}
    elif kind=='summation_v3':
        naive=[]; kahan=[]
        for row in rows:
            try:
                n=int(float(row['n'])); num=int(float(row['increment_num'])); den=int(float(row['increment_den']))
                ref=n*num/den; naive.append(abs(float(row['naive'])-ref)); kahan.append(abs(float(row['kahan'])-ref))
            except (KeyError,ValueError,ZeroDivisionError): pass
        result['reference']={'type':'exact_rational_input_host_evaluation'}
        m={'naive_max_abs_error':max(naive,default=None),'kahan_max_abs_error':max(kahan,default=None),
           'naive_rms_error':rms(naive),'kahan_rms_error':rms(kahan)}
    elif kind=='photogate_v3':
        p=[x for x in nums(rows,'period_us') if x>0]
        m={'period_mean_us':mean(p),'period_std_us':statistics.pstdev(p) if len(p)>1 else 0.0,
           'max_emit_lag_us':max(nums(rows,'emit_lag_us'),default=None),'max_dropped_accepted_events':max(nums(rows,'dropped_accepted_events'),default=0),
           'max_total_rejected':max(nums(rows,'total_rejected'),default=0)}
    elif kind=='pir_timing_v2':
        d=[x for x in nums(rows,'high_duration_us') if x>0]
        m={'completed_high_intervals':len(d),'high_duration_mean_us':mean(d),'high_duration_min_us':min(d,default=None),'high_duration_max_us':max(d,default=None),
           'boundary':'observed digital-output timing only; no independent physical trigger means no sensor-internal latency claim'}
    elif kind=='multi_sensor_v3':
        m={'filter_tracking_rmse_v':rms(nums(rows,'filter_residual_v')),
           'max_photo_events_per_sample':max(nums(rows,'photo_events_since_sample'),default=0),
           'samples_with_multiple_photo_events':sum(float(r.get('photo_multiple_events',0))!=0 for r in rows),
           'max_photo_rejected_total':max(nums(rows,'photo_rejected_total'),default=0)}
    elif kind=='aliasing_v2':
        m={'mean_lateness_us':mean(nums(rows,'lateness_us')),'max_lateness_us':max(nums(rows,'lateness_us'),default=None),
           'boundary':'controlled synthetic source plus real MCU scheduling; not analog-front-end characterization'}
    elif kind=='fixed_point_v2':
        e=nums(rows,'abs_diff'); m={'max_abs_state_difference':max(e,default=None),'rms_state_difference':rms(e),
                                    'saturation_rows':sum(float(r.get('saturated',0))!=0 for r in rows)}
    elif kind=='cancellation_v2':
        m={'direct_max_abs_error':max(nums(rows,'direct_abs_error'),default=None),
           'reformulated_max_abs_error':max(nums(rows,'reformulated_abs_error'),default=None),
           'max_form_disagreement':max(nums(rows,'form_disagreement'),default=None)}
    elif kind=='overflow_v2':
        m={'max_wrap_error':max((abs(x) for x in nums(rows,'wrap_error')),default=None),
           'max_saturation_error':max((abs(x) for x in nums(rows,'saturation_error')),default=None)}
    elif kind=='debounce_v2':
        m={'raw_rows':sum(float(r.get('event_type',0))==0 for r in rows),'accepted_rows':sum(float(r.get('event_type',0))==1 for r in rows),
           'max_dropped_edges':max(nums(rows,'dropped_edges'),default=0)}
    result['metrics']=m
    return result


def json_safe(value):
    if isinstance(value, dict): return {k: json_safe(v) for k,v in value.items()}
    if isinstance(value, list): return [json_safe(v) for v in value]
    if isinstance(value, float) and not math.isfinite(value): return None
    return value


def main():
    ap=argparse.ArgumentParser(); ap.add_argument('input',type=Path); ap.add_argument('--output',type=Path)
    args=ap.parse_args(); src=args.input.expanduser().resolve(); fields,rows=load(src); kind=classify(fields)
    result=analyze(kind,rows); result['source']=str(src); result['columns']=fields; safe=json_safe(result)
    out=(args.output or src.parent/'numeric-error-campaign-analysis').expanduser().resolve(); out.mkdir(parents=True,exist_ok=True)
    payload=json.dumps(safe,indent=2,sort_keys=True,allow_nan=False)
    (out/'summary.json').write_text(payload+'\n')
    (out/'report.md').write_text('# BetterBoard Numeric Error Campaign Report\n\n```json\n'+payload+'\n```\n')
    print(out); return 0

if __name__=='__main__': raise SystemExit(main())
