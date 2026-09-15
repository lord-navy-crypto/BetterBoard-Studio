import { useMemo, useState } from 'react';
import { Activity, Gauge, RotateCcw } from 'lucide-react';
import EngineeringPlot from './EngineeringPlot';
import {
  computeHostPrimitiveObservability,
  derivePrimitiveDefaults,
  type PrimitiveParameters,
  type PrimitiveSample,
} from './PrimitiveObservability';

type Props = {
  samples: PrimitiveSample[];
  channelLabel: string;
  unit: string;
  contextLabel: 'LIVE' | 'BUFFER' | 'REPLAY';
};

type ParameterOverrides = Partial<PrimitiveParameters>;

function plotPoints(points: PrimitiveSample[]) {
  return points.map(point => ({ x: point.timeS, y: point.value }));
}

function formatValue(value: number | null | undefined, digits = 5) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const absolute = Math.abs(value);
  if ((absolute > 0 && absolute < 1e-4) || absolute >= 1e5) return value.toExponential(3);
  return value.toFixed(digits).replace(/\.?0+$/, '');
}

function NumericParameter({
  label,
  value,
  onChange,
  step = 'any',
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: string | number;
  min?: number;
  max?: number;
}) {
  return <label style={{ display: 'grid', gap: 4, minWidth: 116 }}>
    <small className="muted">{label}</small>
    <input
      type="number"
      value={Number.isFinite(value) ? value : ''}
      step={step}
      min={min}
      max={max}
      onChange={event => {
        const parsed = Number(event.target.value);
        if (Number.isFinite(parsed)) onChange(parsed);
      }}
      style={{ width: '100%' }}
    />
  </label>;
}

function Metric({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return <div className="measurement" style={{ minWidth: 110 }}>
    <span>{label}</span>
    <b>{value}{unit ? ` ${unit}` : ''}</b>
  </div>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div style={{ display: 'grid', gap: 10 }}>
    <div className="panel-title" style={{ marginBottom: 0 }}>{title}</div>
    {children}
  </div>;
}

export default function PrimitiveObservatory({ samples, channelLabel, unit, contextLabel }: Props) {
  const defaults = useMemo(() => derivePrimitiveDefaults(samples), [samples]);
  const [overrides, setOverrides] = useState<ParameterOverrides>({});
  const parameters = useMemo<PrimitiveParameters>(() => ({ ...defaults, ...overrides }), [defaults, overrides]);
  const result = useMemo(() => computeHostPrimitiveObservability(samples, parameters), [samples, parameters]);
  const raw = useMemo(() => plotPoints(samples), [samples]);

  function setParameter<K extends keyof PrimitiveParameters>(key: K, value: PrimitiveParameters[K]) {
    setOverrides(current => ({ ...current, [key]: value }));
  }

  const derivativeUnit = unit ? `${unit}/s` : 'per s';
  const integralUnit = unit ? `${unit}·s` : 'value·s';
  const threshold = result.effectiveParameters.threshold;
  const low = result.effectiveParameters.hysteresisLow;
  const high = result.effectiveParameters.hysteresisHigh;

  if (!samples.length) {
    return <div className="panel" style={{ marginTop: 14 }}>
      <div className="panel-title"><Activity size={18}/> Host Primitive Observatory <span className="schema-row"><span>HOST-DERIVED</span></span></div>
      <div className="empty compact">Select a numeric channel with observed samples to derive primitive state on the host.</div>
    </div>;
  }

  return <div className="panel" style={{ marginTop: 14, display: 'grid', gap: 18 }}>
    <div className="panel-title panel-title-with-action">
      <span><Activity size={18}/> Host Primitive Observatory</span>
      <div className="schema-row">
        <span>HOST-DERIVED</span>
        <span>{contextLabel}</span>
        <span>{result.sampleCount} samples</span>
        <span>{result.timeSpanS === null ? 'span —' : `span ${formatValue(result.timeSpanS, 3)} s`}</span>
      </div>
    </div>

    <div className="boundary">
      <Gauge size={14}/>
      <span><b>{channelLabel}{unit ? ` (${unit})` : ''}</b> · These traces are computed on the desktop from the selected Monitor & Data evidence. They are not MCU-emitted results and do not modify the saved raw evidence.</span>
    </div>

    <div style={{ display: 'flex', gap: 10, alignItems: 'end', flexWrap: 'wrap' }}>
      <NumericParameter label="EMA α" value={parameters.emaAlpha} min={0} max={1} step={0.05} onChange={value => setParameter('emaAlpha', value)} />
      <NumericParameter label="Threshold" value={parameters.threshold} onChange={value => setParameter('threshold', value)} />
      <NumericParameter label="Hysteresis low" value={parameters.hysteresisLow} onChange={value => setParameter('hysteresisLow', value)} />
      <NumericParameter label="Hysteresis high" value={parameters.hysteresisHigh} onChange={value => setParameter('hysteresisHigh', value)} />
      <NumericParameter label="Trend window" value={parameters.regressionWindow} min={2} step={1} onChange={value => setParameter('regressionWindow', Math.max(2, Math.round(value)))} />
      <NumericParameter label="Mean-shift window" value={parameters.meanShiftWindow} min={4} step={2} onChange={value => setParameter('meanShiftWindow', Math.max(4, Math.round(value)))} />
      <button className="ghost" onClick={() => setOverrides({})}><RotateCcw size={14}/> Analysis defaults</button>
    </div>
    <div className="hint">Parameter values are host-analysis defaults or user adjustments, not calibration constants. Reset returns to data-derived defaults.</div>

    {result.warnings.length > 0 && <div className="boundary"><span>{result.warnings.join(' ')}</span></div>}

    <Section title="Online state">
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Metric label="N" value={String(result.sampleCount)} />
        <Metric label="Mean" value={formatValue(result.statistics.mean)} unit={unit} />
        <Metric label="Sample std" value={formatValue(result.statistics.sampleStandardDeviation)} unit={unit} />
        <Metric label="Min" value={formatValue(result.statistics.minimum)} unit={unit} />
        <Metric label="Max" value={formatValue(result.statistics.maximum)} unit={unit} />
        <Metric label="Peak-to-peak" value={formatValue(result.statistics.peakToPeak)} unit={unit} />
        <Metric label="RMS" value={formatValue(result.rms)} unit={unit} />
      </div>
      <EngineeringPlot
        series={[{ label: channelLabel, points: raw }, { label: 'cumulative RMS', points: plotPoints(result.rmsTrace), dashed: true }]}
        xLabel="time"
        xUnit="s"
        yLabel="signal / RMS"
        yUnit={unit}
        height={240}
      />
    </Section>

    <Section title="Dynamics">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 12 }}>
        <div>
          <div className="hint">Finite difference uses each observed host-timestamp Δt.</div>
          {result.derivativeTrace.length
            ? <EngineeringPlot series={[{ label: 'derivative', points: plotPoints(result.derivativeTrace) }]} xLabel="time" xUnit="s" yLabel={`d(${channelLabel})/dt`} yUnit={derivativeUnit} height={240} zeroLine />
            : <div className="empty compact">Derivative needs at least two samples with increasing timestamps.</div>}
        </div>
        <div>
          <div className="hint">Cumulative trapezoid integral uses actual observed Δt.</div>
          {result.integralTrace.length > 1
            ? <EngineeringPlot series={[{ label: 'integral', points: plotPoints(result.integralTrace) }]} xLabel="time" xUnit="s" yLabel={`∫ ${channelLabel} dt`} yUnit={integralUnit} height={240} zeroLine />
            : <div className="empty compact">Integral needs at least two samples with increasing timestamps.</div>}
        </div>
      </div>
    </Section>

    <Section title="Signal conditioning">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 12 }}>
        <EngineeringPlot
          series={[{ label: 'raw', points: raw }, { label: `EMA α=${formatValue(result.effectiveParameters.emaAlpha, 3)}`, points: plotPoints(result.emaTrace), dashed: true }]}
          xLabel="time"
          xUnit="s"
          yLabel={channelLabel}
          yUnit={unit}
          height={240}
        />
        <EngineeringPlot
          series={[{ label: 'raw', points: raw }, { label: 'peak hold', points: plotPoints(result.peakHoldTrace), dashed: true }]}
          xLabel="time"
          xUnit="s"
          yLabel={channelLabel}
          yUnit={unit}
          height={240}
        />
      </div>
    </Section>

    <Section title="Decision state">
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Metric label="Threshold events" value={String(result.thresholdEvents.length)} />
        <Metric label="Hysteresis transitions" value={String(result.hysteresisEvents.length)} />
      </div>
      <EngineeringPlot
        series={[{ label: 'raw', points: raw }]}
        xLabel="time"
        xUnit="s"
        yLabel={channelLabel}
        yUnit={unit}
        height={250}
        horizontalMarkers={[
          { y: threshold, label: `threshold ${formatValue(threshold, 4)}` },
          ...(result.hysteresisReady ? [
            { y: low, label: `hysteresis low ${formatValue(low, 4)}` },
            { y: high, label: `hysteresis high ${formatValue(high, 4)}` },
          ] : []),
        ]}
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 12 }}>
        <EngineeringPlot series={[{ label: 'threshold latch', points: plotPoints(result.thresholdStateTrace) }]} xLabel="time" xUnit="s" yLabel="latched" height={210} zeroLine />
        {result.hysteresisReady
          ? <EngineeringPlot series={[{ label: 'hysteresis state', points: plotPoints(result.hysteresisStateTrace) }]} xLabel="time" xUnit="s" yLabel="state" height={210} zeroLine />
          : <div className="empty compact">{result.hysteresisReason}</div>}
      </div>
    </Section>

    <Section title="Trend & change">
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Metric label="Trend slope" value={formatValue(result.regression?.slope)} unit={derivativeUnit} />
        <Metric label="Trend intercept" value={formatValue(result.regression?.intercept)} unit={unit} />
        <Metric label="Trend R²" value={formatValue(result.regression?.rSquared, 4)} />
        <Metric label="CUSUM alarms" value={String(result.cusumEvents.length)} />
        <Metric label="Mean-shift flags" value={String(result.meanShiftEvents.length)} />
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'end', flexWrap: 'wrap' }}>
        <NumericParameter label="CUSUM mean" value={parameters.cusumReferenceMean ?? defaults.cusumReferenceMean ?? 0} onChange={value => setParameter('cusumReferenceMean', value)} />
        <NumericParameter label="CUSUM slack" value={parameters.cusumSlack ?? defaults.cusumSlack ?? 0} min={0} onChange={value => setParameter('cusumSlack', Math.max(0, value))} />
        <NumericParameter label="CUSUM threshold" value={parameters.cusumThreshold ?? defaults.cusumThreshold ?? 0} min={0} onChange={value => setParameter('cusumThreshold', Math.max(0, value))} />
        <NumericParameter label="Mean-shift threshold" value={parameters.meanShiftThreshold ?? defaults.meanShiftThreshold ?? 0} min={0} onChange={value => setParameter('meanShiftThreshold', Math.max(0, value))} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 12 }}>
        {result.cusumPositiveTrace.length
          ? <EngineeringPlot
              series={[
                { label: 'CUSUM +', points: plotPoints(result.cusumPositiveTrace) },
                { label: 'CUSUM −', points: plotPoints(result.cusumNegativeTrace), dashed: true },
              ]}
              xLabel="time"
              xUnit="s"
              yLabel="CUSUM score"
              yUnit={unit}
              height={240}
              zeroLine
              horizontalMarkers={[
                { y: result.effectiveParameters.cusumThreshold ?? 0, label: 'positive alarm' },
                { y: -(result.effectiveParameters.cusumThreshold ?? 0), label: 'negative alarm' },
              ]}
            />
          : <div className="empty compact">CUSUM is unavailable without finite samples.</div>}
        {result.meanShiftTrace.length
          ? <EngineeringPlot
              series={[{ label: 'mean shift', points: plotPoints(result.meanShiftTrace) }]}
              xLabel="time"
              xUnit="s"
              yLabel="window mean shift"
              yUnit={unit}
              height={240}
              zeroLine
              horizontalMarkers={[
                { y: result.effectiveParameters.meanShiftThreshold ?? 0, label: '+ shift limit' },
                { y: -(result.effectiveParameters.meanShiftThreshold ?? 0), label: '− shift limit' },
              ]}
            />
          : <div className="empty compact">Mean-shift detection needs a complete {result.effectiveParameters.meanShiftWindow}-sample window.</div>}
      </div>
    </Section>
  </div>;
}
