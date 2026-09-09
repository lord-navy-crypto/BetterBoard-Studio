import { useMemo } from 'react';

type Point = { x: number; y: number };
export type EngineeringSeries = {
  label: string;
  points: Point[];
  dashed?: boolean;
  opacity?: number;
};

type Props = {
  series: EngineeringSeries[];
  xLabel: string;
  xUnit?: string;
  yLabel: string;
  yUnit?: string;
  height?: number;
  tickCount?: number;
};

const WIDTH = 760;
const HEIGHT = 310;
const MARGIN = { left: 78, right: 24, top: 20, bottom: 58 };

function finiteSeries(series: EngineeringSeries[]) {
  return series.map(item => ({
    ...item,
    points: item.points.filter(point => Number.isFinite(point.x) && Number.isFinite(point.y)),
  })).filter(item => item.points.length > 0);
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

export default function EngineeringPlot({ series, xLabel, xUnit, yLabel, yUnit, height = 310, tickCount = 5 }: Props) {
  const prepared = useMemo(() => finiteSeries(series), [series]);
  const points = prepared.flatMap(item => item.points);
  const ranges = useMemo(() => {
    if (!points.length) return { x: [0, 1] as [number, number], y: [0, 1] as [number, number] };
    return {
      x: paddedRange(Math.min(...points.map(point => point.x)), Math.max(...points.map(point => point.x))),
      y: paddedRange(Math.min(...points.map(point => point.y)), Math.max(...points.map(point => point.y))),
    };
  }, [points]);

  const plotWidth = WIDTH - MARGIN.left - MARGIN.right;
  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const mapX = (x: number) => MARGIN.left + ((x - ranges.x[0]) / Math.max(ranges.x[1] - ranges.x[0], Number.EPSILON)) * plotWidth;
  const mapY = (y: number) => MARGIN.top + plotHeight - ((y - ranges.y[0]) / Math.max(ranges.y[1] - ranges.y[0], Number.EPSILON)) * plotHeight;
  const xTicks = ticks(ranges.x[0], ranges.x[1], tickCount);
  const yTicks = ticks(ranges.y[0], ranges.y[1], tickCount);

  if (!points.length) return <div className="empty compact">No finite points available for plotting.</div>;

  return <div className="engineering-plot" style={{ width: '100%', overflowX: 'auto' }}>
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={`${axisTitle(yLabel, yUnit)} versus ${axisTitle(xLabel, xUnit)}`} style={{ display: 'block', width: '100%', minWidth: 540, height }}>
      <rect x={MARGIN.left} y={MARGIN.top} width={plotWidth} height={plotHeight} fill="rgba(255,255,255,.012)" stroke="rgba(255,255,255,.05)" />

      {xTicks.map((tick, index) => {
        const x = mapX(tick);
        return <g key={`x-${index}`}>
          <line x1={x} y1={MARGIN.top} x2={x} y2={MARGIN.top + plotHeight} stroke="rgba(255,255,255,.07)" strokeWidth="1" />
          <line x1={x} y1={MARGIN.top + plotHeight} x2={x} y2={MARGIN.top + plotHeight + 6} stroke="rgba(210,226,242,.6)" strokeWidth="1" />
          <text x={x} y={MARGIN.top + plotHeight + 22} textAnchor="middle" fill="#8395aa" fontSize="10">{formatTick(tick)}</text>
        </g>;
      })}

      {yTicks.map((tick, index) => {
        const y = mapY(tick);
        return <g key={`y-${index}`}>
          <line x1={MARGIN.left} y1={y} x2={MARGIN.left + plotWidth} y2={y} stroke="rgba(255,255,255,.07)" strokeWidth="1" />
          <line x1={MARGIN.left - 6} y1={y} x2={MARGIN.left} y2={y} stroke="rgba(210,226,242,.6)" strokeWidth="1" />
          <text x={MARGIN.left - 10} y={y + 3.5} textAnchor="end" fill="#8395aa" fontSize="10">{formatTick(tick)}</text>
        </g>;
      })}

      <line x1={MARGIN.left} y1={MARGIN.top + plotHeight} x2={MARGIN.left + plotWidth} y2={MARGIN.top + plotHeight} stroke="rgba(222,236,250,.82)" strokeWidth="1.3" />
      <line x1={MARGIN.left} y1={MARGIN.top} x2={MARGIN.left} y2={MARGIN.top + plotHeight} stroke="rgba(222,236,250,.82)" strokeWidth="1.3" />

      {prepared.map((item, index) => <polyline
        key={`${item.label}-${index}`}
        points={item.points.map(point => `${mapX(point.x)},${mapY(point.y)}`).join(' ')}
        fill="none"
        stroke={index === 0 ? 'var(--bb-cyan, #70dcff)' : 'var(--bb-amber, #ffc36d)'}
        strokeWidth="2"
        strokeDasharray={item.dashed ? '7 5' : undefined}
        opacity={item.opacity ?? 1}
        vectorEffect="non-scaling-stroke"
      />)}

      <text x={MARGIN.left + plotWidth / 2} y={HEIGHT - 10} textAnchor="middle" fill="#c7d8e8" fontSize="11" fontWeight="600">{axisTitle(xLabel, xUnit)}</text>
      <text x="17" y={MARGIN.top + plotHeight / 2} textAnchor="middle" transform={`rotate(-90 17 ${MARGIN.top + plotHeight / 2})`} fill="#c7d8e8" fontSize="11" fontWeight="600">{axisTitle(yLabel, yUnit)}</text>
    </svg>
    {prepared.length > 1 && <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', padding: '0 8px 2px', color: '#8395aa', fontSize: 10 }}>
      {prepared.map((item, index) => <span key={`${item.label}-legend-${index}`}><b style={{ color: index === 0 ? 'var(--bb-cyan, #70dcff)' : 'var(--bb-amber, #ffc36d)' }}>{item.dashed ? '– –' : '——'}</b> {item.label}</span>)}
    </div>}
  </div>;
}
