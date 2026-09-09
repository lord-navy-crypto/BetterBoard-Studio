#!/usr/bin/env python3
from __future__ import annotations
import argparse,csv,json,math,statistics
from pathlib import Path

def mean(xs):
    xs=list(xs); return statistics.fmean(xs) if xs else math.nan

def rms(xs):
    xs=[float(x) for x in xs if math.isfinite(float(x))]; return math.sqrt(mean(x*x for x in xs)) if xs else math.nan

def load(p):
    with p.open(newline='') as f:
        r=csv.DictReader(f); fields=r.fieldnames or []; rows=list(r)
    if not fields: raise ValueError('CSV has no header')
    return fields,rows

def nums(rows,key):
    out=[]
    for row in rows:
        try: v=float(row[key])
        except (KeyError,TypeError,ValueError): continue
        if math.isfinite(v): out.append(v)
    return out

def classify(fields):
    s=set(fields)
    checks=[
      ('adc_stability',{'mean_adc','peak_to_peak_adc','stddev_adc'}),
      ('quantization',{'raw10','q8','error8_counts','q6','error6_counts','q4','error4_counts'}),
      ('filter_lag',{'voltage_v','ema_fast_v','ema_slow_v','fast_error_v','slow_error_v'}),
      ('derivative',{'h','forward','central','abs_error_forward','abs_error_central'}),
      ('integration',{'n','left','trapezoid','simpson','error_left','error_trapezoid','error_simpson'}),
      ('summation',{'n','increment','naive','kahan','abs_error_naive','abs_error_kahan'}),
      ('photogate',{'event_us','period_us','frequency_hz'}),
      ('switch_bounce',{'bounce_duration_us','edge_count','final_state'}),
      ('pwm_quantization',{'raw10','pwm8','reconstructed10','error_counts'}),
      ('pir_timing',{'event_index','event_type','high_duration_us','state'}),
      ('multi_sensor',{'raw_adc','filtered_v','photo_period_us','photo_frequency_hz','pir_state','switch_state'}),
    ]
    for name,need in checks:
        if need<=s: return name
    raise ValueError(f'Unrecognized Numeric Error CSV schema: {fields}')

def orders(err):
    out=[]
    for a,b in zip(err,err[1:]): out.append(math.log(a/b,2.0) if a>0 and b>0 else None)
    return out

def analyze(kind,rows):
    out={'schema':'betterboard.numeric-error-research/0.1','experiment':kind,'rows':len(rows)}
    if kind=='adc_stability':
        p2p=nums(rows,'peak_to_peak_adc'); std=nums(rows,'stddev_adc'); means=nums(rows,'mean_adc')
        out['metrics']={'mean_adc_mean':mean(means),'peak_to_peak_mean':mean(p2p),'peak_to_peak_max':max(p2p) if p2p else None,'stddev_adc_mean':mean(std),'stddev_adc_max':max(std) if std else None}
    elif kind=='quantization':
        m={}
        for bits in (8,6,4):
            e=nums(rows,f'error{bits}_counts'); step=1023.0/((1<<bits)-1)
            m[str(bits)]={'theoretical_step_counts':step,'theoretical_half_step_bound_counts':step/2,'mean_error_counts':mean(e),'rms_error_counts':rms(e),'max_abs_error_counts':max((abs(x) for x in e),default=None)}
        out['metrics']=m
    elif kind=='filter_lag':
        raw=nums(rows,'voltage_v'); fast=nums(rows,'ema_fast_v'); slow=nums(rows,'ema_slow_v')
        out['metrics']={'raw_std_v':statistics.pstdev(raw) if len(raw)>1 else 0.0,'fast_std_v':statistics.pstdev(fast) if len(fast)>1 else 0.0,'slow_std_v':statistics.pstdev(slow) if len(slow)>1 else 0.0,'fast_tracking_rmse_v':rms(nums(rows,'fast_error_v')),'slow_tracking_rmse_v':rms(nums(rows,'slow_error_v'))}
    elif kind=='derivative':
        hs=nums(rows,'h'); f=nums(rows,'forward'); c=nums(rows,'central'); ref=math.cos(1.0); fe=[abs(x-ref) for x in f]; ce=[abs(x-ref) for x in c]; fi=min(range(len(fe)),key=fe.__getitem__) if fe else None; ci=min(range(len(ce)),key=ce.__getitem__) if ce else None
        out['reference']={'type':'host_libm_cos_1','value':ref}; out['metrics']={'best_forward_h':hs[fi] if fi is not None and fi<len(hs) else None,'best_forward_abs_error':fe[fi] if fi is not None else None,'best_central_h':hs[ci] if ci is not None and ci<len(hs) else None,'best_central_abs_error':ce[ci] if ci is not None else None,'forward_abs_errors_host':fe,'central_abs_errors_host':ce}
    elif kind=='integration':
        ref=2.0; m={}
        for name in ('left','trapezoid','simpson'):
            e=[abs(x-ref) for x in nums(rows,name)]; m[name]={'errors_host':e,'observed_order_doubling':orders(e),'best_abs_error':min(e) if e else None}
        out['reference']={'type':'analytic','expression':'integral_0_pi sin(x) dx','value':ref}; out['metrics']=m
    elif kind=='summation':
        n=[int(x) for x in nums(rows,'n')]; inc=nums(rows,'increment'); naive=nums(rows,'naive'); kahan=nums(rows,'kahan'); ref=[a*b for a,b in zip(n,inc)]; en=[abs(v-r) for v,r in zip(naive,ref)]; ek=[abs(v-r) for v,r in zip(kahan,ref)]
        out['reference']={'type':'host_float_expression','note':'Future schema should encode increment exactly for a stronger oracle.'}; out['metrics']={'naive_error_host':en,'kahan_error_host':ek,'naive_max_abs_error':max(en) if en else None,'kahan_max_abs_error':max(ek) if ek else None}
    elif kind=='photogate':
        p=nums(rows,'period_us'); f=nums(rows,'frequency_hz'); pm=mean(p)
        out['metrics']={'period_mean_us':pm,'period_std_us':statistics.pstdev(p) if len(p)>1 else 0.0,'period_cv':statistics.pstdev(p)/pm if len(p)>1 and pm else None,'frequency_mean_hz':mean(f),'frequency_std_hz':statistics.pstdev(f) if len(f)>1 else 0.0}
    elif kind=='switch_bounce':
        d=nums(rows,'bounce_duration_us'); c=nums(rows,'edge_count'); out['metrics']={'bounce_duration_mean_us':mean(d),'bounce_duration_max_us':max(d) if d else None,'edge_count_mean':mean(c),'edge_count_max':max(c) if c else None}
    elif kind=='pwm_quantization':
        e=nums(rows,'error_counts'); step=1023.0/255.0; out['metrics']={'theoretical_step_counts':step,'theoretical_half_step_bound_counts':step/2,'mean_error_counts':mean(e),'rms_error_counts':rms(e),'max_abs_error_counts':max((abs(x) for x in e),default=None)}
    elif kind=='pir_timing':
        d=[x for x in nums(rows,'high_duration_us') if x>0]; out['metrics']={'completed_high_intervals':len(d),'high_duration_mean_us':mean(d),'high_duration_min_us':min(d) if d else None,'high_duration_max_us':max(d) if d else None}
    elif kind=='multi_sensor':
        p=[x for x in nums(rows,'photo_period_us') if x>0]; out['metrics']={'filter_tracking_rmse_v':rms(nums(rows,'filter_error_v')),'photogate_period_samples':len(p),'photogate_period_mean_us':mean(p),'note':'Current firmware reports the latest period before each 50 Hz sample; add event counters/overrun evidence before canonical promotion.'}
    return out

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('input',type=Path); ap.add_argument('--output',type=Path); a=ap.parse_args(); src=a.input.expanduser().resolve(); fields,rows=load(src); kind=classify(fields); result=analyze(kind,rows); result['source']=str(src); result['columns']=fields; out=(a.output or src.parent/'numeric-error-research-analysis').expanduser().resolve(); out.mkdir(parents=True,exist_ok=True); (out/'summary.json').write_text(json.dumps(result,indent=2,sort_keys=True)+'\n'); (out/'report.md').write_text('# BetterBoard Numeric Error Research Report\n\n```json\n'+json.dumps(result,indent=2,sort_keys=True)+'\n```\n\nMeasured/embedded evidence is not silently promoted to calibrated physical truth or an independent numerical oracle.\n'); print(out); return 0
if __name__=='__main__': raise SystemExit(main())
