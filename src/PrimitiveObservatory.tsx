import { useMemo, useState } from 'react';
import { Activity, Gauge, RotateCcw } from 'lucide-react';
import EngineeringPlot from './EngineeringPlot';
import {
  computeHostPrimitiveObservability,
  derivePrimitiveDefaults,
  type PrimitiveParameters,
  type PrimitiveSample,
} from './PrimitiveObservability';
import {
  compareNumericPrimitive,
  compareStatePrimitive,
  deviceElapsedPoints,
  type DevicePrimitiveDiagnostic,
  type DevicePrimitiveKind,
  type DevicePrimitiveResult,
  type PrimitiveComparisonStatus,
} from './devicePrimitiveResults';

type Props = {
  samples: PrimitiveSample[];
  channelLabel: string;
  unit: string;
  contextLabel: 'LIVE' | 'BUFFER' | 'REPLAY';
  deviceResults: DevicePrimitiveResult[];
  deviceDiagnostics: DevicePrimitiveDiagnostic[];
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

function latestDeviceValue(results: DevicePrimitiveResult[], kind: DevicePrimitiveKind, source: string) {
  for (let index = results.length - 1; index >= 0; index -= 1) {
    const result = results[index];
    if (result.kind === kind && result.source === source && result.value !== null) return result.value;
  }
  return null;
}

function comparisonText(status: PrimitiveComparisonStatus, alignedCount: number, delta?: number | null) {
  if (status === 'PARAMETER_MISMATCH') return 'parameter mismatch · direct consistency score disabled';
  if (status === 'UNBOUND_SOURCE') return 'unbound source · device source does not match the selected channel';
  if (status === 'INSUFFICIENT_ALIGNMENT') return 'insufficient alignment · traces shown separately';
  if (status === 'UNAVAILABLE') return 'device result unavailable';
  return delta === undefined || delta === null
    ? `agreement check · ${alignedCount} aligned`
    : `agreement check · ${alignedCount} aligned · max |Δ| ${formatValue(delta, 4)}`;
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

export default function PrimitiveObservatory({
  samples,
  channelLabel,
  unit,
  contextLabel,
  deviceResults,
  deviceDiagnostics,
}: Props) {
  const defaults = useMemo(() => derivePrimitiveDefaults(samples), [samples]);
  const [overrides, setOverrides] = useState<ParameterOverrides>({});
  const parameters = useMemo<PrimitiveParameters>(() => ({ ...defaults, ...overrides }), [defaults, overrides]);
  const result = useMemo(() => computeHostPrimitiveObservability(samples, parameters), [samples, parameters]);
  const raw = useMemo(() => plotPoints(samples), [samples]);
  const selectedDeviceResults = useMemo(
    () => deviceResults.filter(deviceResult => deviceResult.source === channelLabel),
    [deviceResults, channelLabel],
  );
  const deviceKinds = useMemo(() => new Set(selectedDeviceResults.map(deviceResult => deviceResult.kind)), [selectedDeviceResults]);

  function setParameter<K extends keyof PrimitiveParameters>(key: K, value: PrimitiveParameters[K]) {
    setOverrides(current => ({ ...current, [key]: value }));
  }

  const derivativeUnit = unit ? `${unit}/s` : 'per s';
  const integralUnit = unit ? `${unit}·s` : 'value·s';
  const threshold = result.effectiveParameters.threshold;
  const low = result.effectiveParameters.hysteresisLow;
  const high = result.effectiveParameters.hysteresisHigh;

  const deviceRms = deviceElapsedPoints(deviceResults, 'rms', channelLabel);
  const deviceDerivative = deviceElapsedPoints(deviceResults, 'derivative', channelLabel);
  const deviceIntegral = deviceElapsedPoints(deviceResults, 'integral', channelLabel);
  const deviceEma = deviceElapsedPoints(deviceResults, 'ema', channelLabel);
  const devicePeak = deviceElapsedPoints(deviceResults, 'peak_hold', channelLabel);
  const deviceThreshold = deviceElapsedPoints(deviceResults, 'threshold', channelLabel, true);
  const deviceHysteresis = deviceElapsedPoints(deviceResults, 'hysteresis', channelLabel, true);

  const rmsComparison = compareNumericPrimitive({ host: result.rmsTrace, deviceResults, kind: 'rms', source: channelLabel });
  const derivativeComparison = compareNumericPrimitive({ host: result.derivativeTrace, deviceResults, kind: 'derivative', source: channelLabel });
  const integralComparison = compareNumericPrimitive({ host: result.integralTrace, deviceResults, kind: 'integral', source: channelLabel });
  const emaComparison = compareNumericPrimitive({
    host: result.emaTrace,
    deviceResults,
    kind: 'ema',
    source: channelLabel,
    expectedParameter: { key: 'alpha', value: result.effectiveParameters.emaAlpha },
  });
  const peakComparison = compareNumericPrimitive({ host: result.peakHoldTrace, deviceResults, kind: 'peak_hold', source: channelLabel });
  const thresholdComparison = compareStatePrimitive({
    host: result.thresholdStateTrace,
    deviceResults,
    kind: 'threshold',
    source: channelLabel,
    expectedParameter: { key: 'threshold', value: threshold },
  });
  const hysteresisComparison = compareStatePrimitive({
    host: result.hysteresisStateTrace,
    deviceResults,
    kind: 'hysteresis',
    source: channelLabel,
    expectedParameter: { key: 'low_high', value: `${formatValue(low, 10)}|${formatValue(high, 10)}` },
  });

  const comparisonRows = [
    { label: 'RMS', kind: 'rms' as const, status: rmsComparison.status, text: comparisonText(rmsComparison.status, rmsComparison.alignedCount, rmsComparison.maxAbsoluteDifference) },
    { label: 'Derivative', kind: 'derivative' as const, status: derivativeComparison.status, text: comparisonText(derivativeComparison.status, derivativeComparison.alignedCount, derivativeComparison.maxAbsoluteDifference) },
    { label: 'Integral', kind: 'integral' as const, status: integralComparison.status, text: comparisonText(integralComparison.status, integralComparison.alignedCount, integralComparison.maxAbsoluteDifference) },
    { label: 'EMA', kind: 'ema' as const, status: emaComparison.status, text: comparisonText(emaComparison.status, emaComparison.alignedCount, emaComparison.maxAbsoluteDifference) },
    { label: 'Peak hold', kind: 'peak_hold' as const, status: peakComparison.status, text: comparisonText(peakComparison.status, peakComparison.alignedCount, peakComparison.maxAbsoluteDifference) },
    { label: 'Threshold', kind: 'threshold' as const, status: thresholdComparison.status, text: thresholdComparison.status === 'MATCHABLE' ? `agreement check · ${thresholdComparison.alignedCount} aligned · ${thresholdComparison.disagreementCount} disagreement(s)` : comparisonText(thresholdComparison.status, thresholdComparison.alignedCount) },
    { label: 'Hysteresis', kind: 'hysteresis' as const, status: hysteresisComparison.status, text: hysteresisComparison.status === 'MATCHABLE' ? `agreement check · ${hysteresisComparison.alignedCount} aligned · ${hysteresisComparison.disagreementCount} disagreement(s)` : comparisonText(hysteresisComparison.status, hysteresisComparison.alignedCount) },
  ].filter(row => deviceKinds.has(row.kind) || row.status === 'UNBOUND_SOURCE');

  const diagnosticCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const diagnostic of deviceDiagnostics) counts.set(diagnostic.code, (counts.get(diagnostic.code) ?? 0) + 1);
    return [...counts.entries()];
  }, [deviceDiagnostics]);

  if (!samples.length) {
    return <div className="panel" style={{ marginTop: 14 }}>
      <div className="panel-title"><Activity size={18}/> Host Primitive Observatory <span className="schema-row"><span>HOST-DERIVED</span>{selectedDeviceResults.length > 0 && <span>DEVICE-DERIVED</span>}</span></div>
      <div className="empty compact">Select a numeric channel with observed samples to derive primitive state on the host.</div>
    </div>;
  }

  return <div className="panel" style={{ marginTop: 14, display: 'grid', gap: 18 }}>
    <div className="panel-title panel-title-with-action">
      <span><Activity size={18}/> Host Primitive Observatory</span>
      <div className="schema-row">
        <span>HOST-DERIVED</span>
        {selectedDeviceResults.length > 0 && <span>DEVICE-DERIVED</span>}
        {selectedDeviceResults.length > 0 && <span>HOST ↔ DEVICE</span>}
        <span>{contextLabel}</span>
        <span>{result.sampleCount} samples</span>
        <span>{result.timeSpanS === null ? 'span —' : `span ${formatValue(result.timeSpanS, 3)} s`}</span>
      </div>
    </div>

    <div className="boundary">
      <Gauge size={14}/>
      <span><b>{channelLabel}{unit ? ` (${unit})` : ''}</b> · Host traces are computed on the desktop from the selected Monitor & Data evidence. They are not MCU-emitted results and do not modify the saved raw evidence. DEVICE-DERIVED traces, when present, are MCU-emitted derived results carried separately from raw measurement evidence.</span>
    </div>

    {selectedDeviceResults.length > 0 && <div style={{ display: 'grid', gap: 8 }}>
      <div className="panel-title" style={{ marginBottom: 0 }}>HOST ↔ DEVICE consistency</div>
      <div className="hint">Comparison is diagnostic only. A difference does not automatically make either producer correct; source binding, parameters and time alignment must be compatible first.</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 8 }}>
        {comparisonRows.map(row => <div className="measurement" key={row.label}><span>{row.label}</span><b>{row.status}</b><small>{row.text}</small></div>)}
      </div>
    </div>}

    {deviceResults.length > 0 && selectedDeviceResults.length === 0 && <div className="boundary"><span><b>unbound source</b> · Device primitive frames are present, but none declare the selected channel name <code>{channelLabel}</code>. They are retained as derived diagnostics and are not silently rebound by column position.</span></div>}
    {diagnosticCounts.length > 0 && <div className="boundary"><span><b>Device primitive diagnostics</b> · {diagnosticCounts.map(([code, count]) => `${code} × ${count}`).join(' · ')}</span></div>}

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
        <Metric label="Device mean" value={formatValue(latestDeviceValue(deviceResults, 'stats_mean', channelLabel))} unit={unit} />
        <Metric label="Sample std" value={formatValue(result.statistics.sampleStandardDeviation)} unit={unit} />
        <Metric label="Device std" value={formatValue(latestDeviceValue(deviceResults, 'stats_std', channelLabel))} unit={unit} />
        <Metric label="Min" value={formatValue(result.statistics.minimum)} unit={unit} />
        <Metric label="Device min" value={formatValue(latestDeviceValue(deviceResults, 'stats_min', channelLabel))} unit={unit} />
        <Metric label="Max" value={formatValue(result.statistics.maximum)} unit={unit} />
        <Metric label="Device max" value={formatValue(latestDeviceValue(deviceResults, 'stats_max', channelLabel))} unit={unit} />
        <Metric label="Peak-to-peak" value={formatValue(result.statistics.peakToPeak)} unit={unit} />
        <Metric label="RMS" value={formatValue(result.rms)} unit={unit} />
      </div>
      <EngineeringPlot
        series={[
          { label: channelLabel, points: raw },
          { label: 'host cumulative RMS', points: plotPoints(result.rmsTrace), dashed: true },
          ...(deviceRms.length ? [{ label: 'device RMS', points: plotPoints(deviceRms) }] : []),
        ]}
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
          <div className="hint">Finite difference uses each observed host-timestamp Δt. Device results use the MCU-declared microsecond timeline.</div>
          {result.derivativeTrace.length
            ? <EngineeringPlot series={[
                { label: 'host derivative', points: plotPoints(result.derivativeTrace) },
                ...(deviceDerivative.length ? [{ label: 'device derivative', points: plotPoints(deviceDerivative), dashed: true }] : []),
              ]} xLabel="time" xUnit="s" yLabel={`d(${channelLabel})/dt`} yUnit={derivativeUnit} height={240} zeroLine />
            : <div className="empty compact">Derivative needs at least two samples with increasing timestamps.</div>}
        </div>
        <div>
          <div className="hint">Cumulative trapezoid integral uses actual observed Δt.</div>
          {result.integralTrace.length > 1
            ? <EngineeringPlot series={[
                { label: 'host integral', points: plotPoints(result.integralTrace) },
                ...(deviceIntegral.length ? [{ label: 'device integral', points: plotPoints(deviceIntegral), dashed: true }] : []),
              ]} xLabel="time" xUnit="s" yLabel={`∫ ${channelLabel} dt`} yUnit={integralUnit} height={240} zeroLine />
            : <div className="empty compact">Integral needs at least two samples with increasing timestamps.</div>}
        </div>
      </div>
    </Section>

    <Section title="Signal conditioning">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 12 }}>
        <EngineeringPlot
          series={[
            { label: 'raw', points: raw },
            { label: `host EMA α=${formatValue(result.effectiveParameters.emaAlpha, 3)}`, points: plotPoints(result.emaTrace), dashed: true },
            ...(deviceEma.length ? [{ label: 'device EMA', points: plotPoints(deviceEma) }] : []),
          ]}
          xLabel="time"
          xUnit="s"
          yLabel={channelLabel}
          yUnit={unit}
          height={240}
        />
        <EngineeringPlot
          series={[
            { label: 'raw', points: raw },
            { label: 'host peak hold', points: plotPoints(result.peakHoldTrace), dashed: true },
            ...(devicePeak.length ? [{ label: 'device peak hold', points: plotPoints(devicePeak) }] : []),
          ]}
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
        <EngineeringPlot series={[
          { label: 'host threshold latch', points: plotPoints(result.thresholdStateTrace) },
          ...(deviceThreshold.length ? [{ label: 'device threshold latch', points: plotPoints(deviceThreshold), dashed: true }] : []),
        ]} xLabel="time" xUnit="s" yLabel="latched" height={210} zeroLine />
        {result.hysteresisReady
          ? <EngineeringPlot series={[
              { label: 'host hysteresis state', points: plotPoints(result.hysteresisStateTrace) },
              ...(deviceHysteresis.length ? [{ label: 'device hysteresis state', points: plotPoints(deviceHysteresis), dashed: true }] : []),
            ]} xLabel="time" xUnit="s" yLabel="state" height={210} zeroLine />
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
