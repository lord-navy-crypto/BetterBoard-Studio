#!/usr/bin/env python3
from __future__ import annotations
import csv,json,subprocess,sys,tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
ANALYZER=ROOT/'scripts'/'numeric_error_research_analyzer_v2.py'
def run_case(name,header,rows,expected):
    with tempfile.TemporaryDirectory(prefix=f'betterboard-{name}-') as tmp:
        p=Path(tmp)/'data.csv'
        with p.open('w',newline='') as f:
            w=csv.writer(f); w.writerow(header); w.writerows(rows)
        proc=subprocess.run([sys.executable,str(ANALYZER),str(p)],text=True,capture_output=True)
        if proc.returncode: print(proc.stdout); print(proc.stderr,file=sys.stderr); raise SystemExit(proc.returncode)
        summary=json.loads((Path(tmp)/'numeric-error-research-analysis'/'summary.json').read_text())
        assert summary['experiment']==expected
        assert summary['rows']==len(rows)
        return summary
def main():
    q=run_case('quantization',['time_us','raw10','q8','recon8','error8_counts','q6','recon6','error6_counts','q4','recon4','error4_counts'],[[0,512,128,513.5,1.5,32,519.6,7.6,8,545.6,33.6],[50000,256,64,256.75,0.75,16,259.8,3.8,4,272.8,16.8]],'quantization')
    assert q['metrics']['4']['theoretical_step_counts']>q['metrics']['8']['theoretical_step_counts']
    d=run_case('derivative',['h','forward','central','reference','abs_error_forward','abs_error_central'],[[1.0,0.0678264,0.4546487,0.5403023,0.47,0.08],[0.1,0.49736,0.539402,0.5403023,0.043,0.0009],[0.01,0.536086,0.540293,0.5403023,0.0042,0.00001]],'derivative')
    assert d['reference']['type']=='host_libm_cos_1'
    i=run_case('integration',['n','left','trapezoid','simpson','reference','error_left','error_trapezoid','error_simpson'],[[4,1.8961,1.8961,2.00456,2,0.1039,0.1039,0.00456],[8,1.9742,1.9742,2.00027,2,0.0258,0.0258,0.00027],[16,1.99357,1.99357,2.0000166,2,0.00643,0.00643,0.0000166]],'integration')
    assert i['reference']['type']=='analytic'
    a=run_case('adc',['time_us','mean_adc','min_adc','max_adc','peak_to_peak_adc','stddev_adc','nominal_mean_voltage_v'],[[1000000,512.1,510,514,4,1.1,2.502],[2000000,512.0,509,515,6,1.4,2.502]],'adc_stability')
    assert a['metrics']['peak_to_peak_max']==6
    print('BetterBoard Numeric Error validation self-check: PASS')
    print('- quantization theory checks exercised')
    print('- derivative host-reference checks exercised')
    print('- analytic integration reference exercised')
    print('- ADC stability aggregation exercised')
    return 0
if __name__=='__main__': raise SystemExit(main())
