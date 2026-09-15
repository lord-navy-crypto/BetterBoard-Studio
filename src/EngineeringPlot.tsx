import { useEffect, useMemo, useState } from 'react';

type Point = { x: number; y: number };
export type EngineeringSeries = {
  label: string;
  points: Point[];
  dashed?: boolean;
  opacity?: number;
  kind?: 'line' | 'scatter' | 'stem';
  markerRadius?: number;
};

export type EngineeringVerticalMarker = {
  x: number;
  label?: string;
  dashed?: boolean;
};

export type EngineeringHorizontalMarker = {
  y: number;
  label?: string;
  dashed?: boolean;
};

export type EngineeringBand = {
  label?: string;
  lower: Point[];
  upper: Point[];
  opacity?: number;
};

export type EngineeringSelectedPoint = Point & { label?: string };
export type EngineeringEventMarker = { x: number; label: string };
export type EngineeringPointSelection = Point & { series: string };

type Props = {
  series: EngineeringSeries[];
  xLabel: string;
  xUnit?: string;
  yLabel: string;
  yUnit?: string;
  height?: number;
  tickCount?: number;
  verticalMarkers?: EngineeringVerticalMarker[];
  horizontalMarkers?: EngineeringHorizontalMarker[];
  horizontalLines?: EngineeringHorizontalMarker[];
  bands?: EngineeringBand[];
  zeroLine?: boolean;
  compact?: boolean;
  selectedPoint?: EngineeringSelectedPoint | null;
  eventMarkers?: EngineeringEventMarker[];
  onPointSelect?: (point: EngineeringPointSelection) => void;
};

const WIDTH = 760;
const HEIGHT = 310;
const MARGIN = { left: 78, right: 24, top: 20, bottom: 58 };
const COMPACT_MARGIN = { left: 58, right: 16, top: 14, bottom: 42 };

function finiteSeries(series: EngineeringSeries[]) {
  return series.map(item => ({ ...item, points: item.points.filter(point => Number.isFinite(point.x) && Number.isFinite(point.y)) })).filter(item => item.points.length > 0);
}

function finiteBands(bands: EngineeringBand[]) {
  return bands.map(band => ({
    ...band,
    lower: band.lower.filter(point => Number.isFinite(point.x) && Number.isFinite(point.y)),
    upper: band.upper.filter(point => Number.isFinite(point.x) && Number.isFinite(point.y)),
  })).filter(band => band.lower.length > 1 && band.upper.length > 1);
}

function paddedRange(min: number, max: number): [number, number] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];
  if (min === max) {
    const pad = Math.max(Math.abs(min) * 0.05, 1);
    return [min - pad, max + pad];
  }
  const pad = (max - min) * 0.045;
  return [min - pad, max + pad];
}

function ticks(min: number, max: number, count: number) {
  const n = Math.max(2, count);
  return Array.from({ length: n }, (_, index) => min + (index / (n - 1)) * (max - min));
}

function formatTick(value: number) {
  const abs = Math.abs(value);
  if ((abs !== 0 && abs < 1e-3) || abs >= 1e5) return value.toExponential(2);
  const decimals = abs < 1 ? 3 : abs < 100 ? 2 : 1;
  return value.toFixed(decimals).replace(/\.0+$|(?<=\.[0-9]*?)0+$/g, '').replace(/\.$/, '');
}

function axisTitle(label: string, unit?: string) {
  return unit ? `${label} (${unit})` : label;
}

function polygonPoints(lower: Point[], upper: Point[], mapX: (x: number) => number, mapY: (y: number) => number) {
  const lowerPoints = lower.map(point => `${mapX(point.x)},${mapY(point.y)}`);
  const upperPoints = [...upper].reverse().map(point => `${mapX(point.x)},${mapY(point.y)}`);
  return [...lowerPoints, ...upperPoints].join(' ');
}

export default function EngineeringPlot({
  series,
  xLabel,
  xUnit,
  yLabel,
  yUnit,
  height = 310,
  tickCount = 5,
  verticalMarkers = [],
  horizontalMarkers = [],
  horizontalLines = [],
  bands = [],
  zeroLine = false,
  compact = false,
  selectedPoint = null,
  eventMarkers = [],
  onPointSelect,
}: Props) {
  const liveSeries = useMemo(() => finiteSeries(series), [series]);
  const liveBands = useMemo(() => finiteBands(bands), [bands]);
  const resolvedHorizontalMarkers = useMemo(() => [...horizontalMarkers, ...horizontalLines], [horizontalMarkers, horizontalLines]);
  const resolvedVerticalMarkers = useMemo<EngineeringVerticalMarker[]>(
    () => [...verticalMarkers, ...eventMarkers.map(marker => ({ ...marker, dashed: true }))],
    [verticalMarkers, eventMarkers],
  );
  const [frozen, setFrozen] = useState(false);
  const [snapshot, setSnapshot] = useState<EngineeringSeries[]>(liveSeries);
  const [hiddenLabels, setHiddenLabels] = useState<string[]>([]);

  useEffect(() => {
    if (!frozen) setSnapshot(liveSeries.map(item => ({ ...item, points: [...item.points] })));
  }, [liveSeries, frozen]);

  useEffect(() => {
    const labels = new Set(liveSeries.map(item => item.label));
    setHiddenLabels(current => current.filter(label => labels.has(label)));
  }, [liveSeries]);

  const available = frozen ? snapshot : liveSeries;
  const prepared = available.filter(item => !hiddenLabels.includes(item.label));
  const dataPoints = [
    ...prepared.flatMap(item => item.points),
    ...liveBands.flatMap(band => [...band.lower, ...band.upper]),
  ];
  const ranges = useMemo(() => {
    const xValues = [
      ...dataPoints.map(point => point.x),
      ...resolvedVerticalMarkers.map(marker => marker.x),
      ...(selectedPoint && Number.isFinite(selectedPoint.x) ? [selectedPoint.x] : []),
    ].filter(Number.isFinite);
    const yValues = [
      ...dataPoints.map(point => point.y),
      ...resolvedHorizontalMarkers.map(marker => marker.y),
      ...(selectedPoint && Number.isFinite(selectedPoint.y) ? [selectedPoint.y] : []),
      ...(zeroLine ? [0] : []),
    ].filter(Number.isFinite);
    if (!xValues.length || !yValues.length) {
      return { x: [0, 1] as [number, number], y: [0, 1] as [number, number] };
    }
    return {
      x: paddedRange(Math.min(...xValues), Math.max(...xValues)),
      y: paddedRange(Math.min(...yValues), Math.max(...yValues)),
    };
  }, [dataPoints, resolvedVerticalMarkers, resolvedHorizontalMarkers, selectedPoint, zeroLine]);

  const margin = compact ? COMPACT_MARGIN : MARGIN;
  const viewHeight = compact ? 210 : HEIGHT;
  const renderedHeight = compact && height === 310 ? 210 : height;
  const plotWidth = WIDTH - margin.left - margin.right;
  const plotHeight = viewHeight - margin.top - margin.bottom;
  const mapX = (x: number) => margin.left + ((x - ranges.x[0]) / Math.max(ranges.x[1] - ranges.x[0], Number.EPSILON)) * plotWidth;
  const mapY = (y: number) => margin.top + plotHeight - ((y - ranges.y[0]) / Math.max(ranges.y[1] - ranges.y[0], Number.EPSILON)) * plotHeight;
  const xTicks = ticks(ranges.x[0], ranges.x[1], compact ? Math.min(4, tickCount) : tickCount);
  const yTicks = ticks(ranges.y[0], ranges.y[1], compact ? Math.min(4, tickCount) : tickCount);

  if (!available.flatMap(item => item.points).length && !liveBands.length) return <div className="empty compact">No finite points available for plotting.</div>;

  function selectablePoint(item: EngineeringSeries, point: Point, index: number, stroke: string) {
    if (!onPointSelect) return null;
    return <circle
      key={`hit-${item.label}-${index}`}
      cx={mapX(point.x)}
      cy={mapY(point.y)}
      r={Math.max(item.markerRadius ?? 3, 7)}
      fill="transparent"
      stroke="transparent"
      style={{ cursor: 'crosshair' }}
      onClick={() => onPointSelect({ ...point, series: item.label })}
      aria-label={`Select ${item.label} x ${formatTick(point.x)} y ${formatTick(point.y)}`}
    ><title>{`${item.label} · ${axisTitle(xLabel, xUnit)} ${formatTick(point.x)} · ${axisTitle(yLabel, yUnit)} ${formatTick(point.y)}`}</title></circle>;
  }

  return <div className={`engineering-plot ${compact ? 'compact' : ''}`} style={{ width: '100%', overflowX: 'auto' }}>
    {!compact && <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', flexWrap: 'wrap', padding: '0 4px 7px' }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {available.map(item => {
          const hidden = hiddenLabels.includes(item.label);
          return <button key={item.label} className={`ghost mini ${hidden ? '' : 'active'}`} aria-pressed={!hidden} onClick={() => setHiddenLabels(current => hidden ? current.filter(label => label !== item.label) : [...current, item.label])}>{hidden ? '○' : '●'} {item.label}</button>;
        })}
      </div>
      <button className={`ghost mini ${frozen ? 'active' : ''}`} onClick={() => {
        if (!frozen) setSnapshot(liveSeries.map(item => ({ ...item, points: [...item.points] })));
        setFrozen(value => !value);
      }}>{frozen ? 'Frozen · resume' : 'Freeze view'}</button>
    </div>}

    {!prepared.length && !liveBands.length ? <div className="empty compact">All series are hidden. Re-enable a series above.</div> : <>
      <svg viewBox={`0 0 ${WIDTH} ${viewHeight}`} role="img" aria-label={`${axisTitle(yLabel, yUnit)} versus ${axisTitle(xLabel, xUnit)}`} style={{ display: 'block', width: '100%', minWidth: compact ? 420 : 540, height: renderedHeight }}>
        <rect x={margin.left} y={margin.top} width={plotWidth} height={plotHeight} fill="rgba(255,255,255,.012)" stroke="rgba(255,255,255,.05)" />
        {xTicks.map((tick, index) => {
          const x = mapX(tick);
          return <g key={`x-${index}`}><line className="engineering-grid-line" x1={x} y1={margin.top} x2={x} y2={margin.top + plotHeight} stroke="rgba(255,255,255,.07)" strokeWidth="1"/><line x1={x} y1={margin.top + plotHeight} x2={x} y2={margin.top + plotHeight + 6} stroke="rgba(210,226,242,.6)" strokeWidth="1"/><text x={x} y={margin.top + plotHeight + 22} textAnchor="middle" fill="#8395aa" fontSize="10">{formatTick(tick)}</text></g>;
        })}
        {yTicks.map((tick, index) => {
          const y = mapY(tick);
          return <g key={`y-${index}`}><line className="engineering-grid-line" x1={margin.left} y1={y} x2={margin.left + plotWidth} y2={y} stroke="rgba(255,255,255,.07)" strokeWidth="1"/><line x1={margin.left - 6} y1={y} x2={margin.left} y2={y} stroke="rgba(210,226,242,.6)" strokeWidth="1"/><text x={margin.left - 10} y={y + 3.5} textAnchor="end" fill="#8395aa" fontSize="10">{formatTick(tick)}</text></g>;
        })}
        {zeroLine && ranges.y[0] <= 0 && ranges.y[1] >= 0 && <line x1={margin.left} x2={margin.left + plotWidth} y1={mapY(0)} y2={mapY(0)} stroke="rgba(255,255,255,.32)" strokeDasharray="4 4"/>}
        {liveBands.map((band, index) => <polygon key={`band-${band.label || index}`} points={polygonPoints(band.lower, band.upper, mapX, mapY)} fill="var(--bb-cyan, #70dcff)" opacity={band.opacity ?? 0.12}/>)}
        {resolvedHorizontalMarkers.filter(marker => Number.isFinite(marker.y)).map((marker, index) => {
          const y = mapY(marker.y);
          return <g key={`h-marker-${index}`}><line x1={margin.left} x2={margin.left + plotWidth} y1={y} y2={y} stroke="var(--bb-amber, #ffc36d)" strokeWidth="1.2" strokeDasharray={marker.dashed === false ? undefined : '6 4'}/>{marker.label && <text x={margin.left + plotWidth - 4} y={y - 5} textAnchor="end" fill="#ffc36d" fontSize="10">{marker.label}</text>}</g>;
        })}
        {resolvedVerticalMarkers.filter(marker => Number.isFinite(marker.x)).map((marker, index) => {
          const x = mapX(marker.x);
          return <g key={`v-marker-${index}`}><line x1={x} x2={x} y1={margin.top} y2={margin.top + plotHeight} stroke="var(--bb-amber, #ffc36d)" strokeWidth="1.2" strokeDasharray={marker.dashed === false ? undefined : '6 4'}/>{marker.label && <text x={Math.min(x + 5, margin.left + plotWidth - 4)} y={margin.top + 13} fill="#ffc36d" fontSize="10">{marker.label}</text>}</g>;
        })}
        <line className="engineering-axis-line" x1={margin.left} y1={margin.top + plotHeight} x2={margin.left + plotWidth} y2={margin.top + plotHeight} stroke="rgba(222,236,250,.82)" strokeWidth="1.3"/>
        <line className="engineering-axis-line" x1={margin.left} y1={margin.top} x2={margin.left} y2={margin.top + plotHeight} stroke="rgba(222,236,250,.82)" strokeWidth="1.3"/>
        {prepared.map((item, index) => {
          const stroke = index === 0 ? 'var(--bb-cyan, #70dcff)' : 'var(--bb-amber, #ffc36d)';
          const kind = item.kind ?? 'line';
          if (kind === 'scatter') return <g key={`${item.label}-${index}`}>{item.points.map((point, pointIndex) => <circle key={pointIndex} cx={mapX(point.x)} cy={mapY(point.y)} r={item.markerRadius ?? 3.2} fill={stroke} opacity={item.opacity ?? 1}/>)}{item.points.map((point, pointIndex) => selectablePoint(item, point, pointIndex, stroke))}</g>;
          if (kind === 'stem') return <g key={`${item.label}-${index}`}>{item.points.map((point, pointIndex) => <g key={pointIndex}><line x1={mapX(point.x)} x2={mapX(point.x)} y1={mapY(Math.max(0, ranges.y[0]))} y2={mapY(point.y)} stroke={stroke} strokeWidth="1.4" opacity={item.opacity ?? 1}/><circle cx={mapX(point.x)} cy={mapY(point.y)} r={item.markerRadius ?? 2.3} fill={stroke} opacity={item.opacity ?? 1}/></g>)}{item.points.map((point, pointIndex) => selectablePoint(item, point, pointIndex, stroke))}</g>;
          return <g key={`${item.label}-${index}`}><polyline points={item.points.map(point => `${mapX(point.x)},${mapY(point.y)}`).join(' ')} fill="none" stroke={stroke} strokeWidth="2" strokeDasharray={item.dashed ? '7 5' : undefined} opacity={item.opacity ?? 1} vectorEffect="non-scaling-stroke"/>{item.points.map((point, pointIndex) => selectablePoint(item, point, pointIndex, stroke))}</g>;
        })}
        {selectedPoint && Number.isFinite(selectedPoint.x) && Number.isFinite(selectedPoint.y) && <g>
          <line x1={mapX(selectedPoint.x)} x2={mapX(selectedPoint.x)} y1={margin.top} y2={margin.top + plotHeight} stroke="rgba(255,255,255,.44)" strokeDasharray="3 3"/>
          <line x1={margin.left} x2={margin.left + plotWidth} y1={mapY(selectedPoint.y)} y2={mapY(selectedPoint.y)} stroke="rgba(255,255,255,.28)" strokeDasharray="3 3"/>
          <circle cx={mapX(selectedPoint.x)} cy={mapY(selectedPoint.y)} r="5" fill="none" stroke="#fff" strokeWidth="2"><title>{selectedPoint.label ?? `x ${formatTick(selectedPoint.x)}, y ${formatTick(selectedPoint.y)}`}</title></circle>
          {selectedPoint.label && <text x={Math.min(mapX(selectedPoint.x) + 7, margin.left + plotWidth - 4)} y={Math.max(mapY(selectedPoint.y) - 8, margin.top + 12)} fill="#edf5ff" fontSize="10">{selectedPoint.label}</text>}
        </g>}
        <text x={margin.left + plotWidth / 2} y={viewHeight - 10} textAnchor="middle" fill="#c7d8e8" fontSize="11" fontWeight="600">{axisTitle(xLabel, xUnit)}</text>
        <text x="17" y={margin.top + plotHeight / 2} textAnchor="middle" transform={`rotate(-90 17 ${margin.top + plotHeight / 2})`} fill="#c7d8e8" fontSize="11" fontWeight="600">{axisTitle(yLabel, yUnit)}</text>
      </svg>
      {!compact && frozen && <div className="hint">View frozen at the current frame. Acquisition and calculations continue in the background.</div>}
    </>}
  </div>;
}
