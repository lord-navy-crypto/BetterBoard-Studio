export type DevicePrimitiveKind =
  | 'stats_mean'
  | 'stats_std'
  | 'stats_min'
  | 'stats_max'
  | 'rms'
  | 'derivative'
  | 'integral'
  | 'ema'
  | 'peak_hold'
  | 'threshold'
  | 'hysteresis';

export type DevicePrimitiveResult = {
  producer: 'device';
  protocolVersion: number;
  kind: DevicePrimitiveKind;
  source: string;
  timeUs: number;
  value: number | null;
  state: boolean | null;
  parameterKey: string | null;
  parameterValue: string | null;
};

export type DevicePrimitiveDiagnosticCode =
  | 'malformed-frame'
  | 'unsupported-version'
  | 'unknown-kind'
  | 'invalid-timestamp'
  | 'invalid-value'
  | 'invalid-state'
  | 'parameter-pair-mismatch';

export type DevicePrimitiveDiagnostic = {
  code: DevicePrimitiveDiagnosticCode;
  line: string;
  message: string;
};

export type DevicePrimitiveParseResult =
  | { result: DevicePrimitiveResult; diagnostic: null }
  | { result: null; diagnostic: DevicePrimitiveDiagnostic }
  | { result: null; diagnostic: null };

export type PrimitiveComparisonStatus =
  | 'MATCHABLE'
  | 'PARAMETER_MISMATCH'
  | 'UNBOUND_SOURCE'
  | 'INSUFFICIENT_ALIGNMENT'
  | 'UNAVAILABLE';

export type NumericPrimitiveComparison = {
  status: PrimitiveComparisonStatus;
  alignedCount: number;
  maxAbsoluteDifference: number | null;
  latestAbsoluteDifference: number | null;
  latestRelativeDifference: number | null;
};

export type StatePrimitiveComparison = {
  status: PrimitiveComparisonStatus;
  alignedCount: number;
  disagreementCount: number;
};

export type HostPrimitivePoint = { timeS: number; value: number };

const PREFIX = '#BB_PRIMITIVE,';
const KNOWN_KINDS = new Set<DevicePrimitiveKind>([
  'stats_mean', 'stats_std', 'stats_min', 'stats_max',
  'rms', 'derivative', 'integral', 'ema', 'peak_hold',
  'threshold', 'hysteresis',
]);

function diagnostic(code: DevicePrimitiveDiagnosticCode, line: string, message: string): DevicePrimitiveParseResult {
  return { result: null, diagnostic: { code, line, message } };
}

export function parseDevicePrimitiveResult(line: string): DevicePrimitiveParseResult {
  if (!line.startsWith(PREFIX)) return { result: null, diagnostic: null };

  const parts = line.slice(PREFIX.length).split(',').map(part => part.trim());
  if (parts.length !== 8) return diagnostic('malformed-frame', line, `expected 8 protocol fields, received ${parts.length}`);

  const [versionText, kindText, source, timeText, valueText, stateText, parameterKey, parameterValue] = parts;
  const protocolVersion = Number(versionText);
  if (!Number.isInteger(protocolVersion) || protocolVersion < 1) return diagnostic('malformed-frame', line, 'protocol version must be a positive integer');
  if (protocolVersion !== 1) return diagnostic('unsupported-version', line, `unsupported primitive-result protocol v${versionText}`);
  if (!kindText || !source) return diagnostic('malformed-frame', line, 'primitive kind and source are required');
  if (!KNOWN_KINDS.has(kindText as DevicePrimitiveKind)) return diagnostic('unknown-kind', line, `unknown primitive kind ${kindText}`);

  const timeUs = Number(timeText);
  if (!Number.isInteger(timeUs) || timeUs < 0) return diagnostic('invalid-timestamp', line, 'time_us must be a non-negative integer');

  let value: number | null = null;
  if (valueText !== '') {
    value = Number(valueText);
    if (!Number.isFinite(value)) return diagnostic('invalid-value', line, 'value must be finite when present');
  }

  let state: boolean | null = null;
  if (stateText !== '') {
    if (stateText !== '0' && stateText !== '1') return diagnostic('invalid-state', line, 'state must be 0, 1, or empty');
    state = stateText === '1';
  }

  const hasParameterKey = parameterKey !== '';
  const hasParameterValue = parameterValue !== '';
  if (hasParameterKey !== hasParameterValue) {
    return diagnostic('parameter-pair-mismatch', line, 'parameter key and value must be supplied together');
  }

  return {
    result: {
      producer: 'device',
      protocolVersion,
      kind: kindText as DevicePrimitiveKind,
      source,
      timeUs,
      value,
      state,
      parameterKey: hasParameterKey ? parameterKey : null,
      parameterValue: hasParameterValue ? parameterValue : null,
    },
    diagnostic: null,
  };
}

export function deviceResultsForSource(results: DevicePrimitiveResult[], source: string): DevicePrimitiveResult[] {
  return results.filter(result => result.source === source);
}

export function deviceElapsedPoints(
  results: DevicePrimitiveResult[],
  kind: DevicePrimitiveKind,
  source: string,
  useState = false,
): HostPrimitivePoint[] {
  const sourceResults = results.filter(result => result.source === source);
  if (!sourceResults.length) return [];
  const originUs = sourceResults[0].timeUs;
  const selected = sourceResults.filter(result => result.kind === kind);
  if (!selected.length) return [];
  return selected.flatMap(result => {
    const raw = useState ? (result.state === null ? null : result.state ? 1 : 0) : result.value;
    return raw === null || !Number.isFinite(raw)
      ? []
      : [{ timeS: (result.timeUs - originUs) / 1_000_000, value: raw }];
  });
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function alignmentTolerance(host: HostPrimitivePoint[]): number {
  const deltas: number[] = [];
  for (let index = 1; index < host.length; index += 1) {
    const dt = host[index].timeS - host[index - 1].timeS;
    if (Number.isFinite(dt) && dt > 0) deltas.push(dt);
  }
  const typical = median(deltas);
  return typical === null ? 1e-9 : Math.max(typical * 0.5, 1e-9);
}

function parameterMatches(
  results: DevicePrimitiveResult[],
  expectedParameter?: { key: string; value: number | string } | null,
): boolean {
  if (!expectedParameter) return true;
  const parameterized = results.filter(result => result.parameterKey !== null || result.parameterValue !== null);
  if (!parameterized.length) return false;
  return parameterized.every(result => {
    if (result.parameterKey !== expectedParameter.key || result.parameterValue === null) return false;
    const expectedNumeric = typeof expectedParameter.value === 'number' ? expectedParameter.value : Number.NaN;
    const actualNumeric = Number(result.parameterValue);
    if (Number.isFinite(expectedNumeric) && Number.isFinite(actualNumeric)) {
      return Math.abs(actualNumeric - expectedNumeric) <= Math.max(1e-12, Math.abs(expectedNumeric) * 1e-9);
    }
    return result.parameterValue === String(expectedParameter.value);
  });
}

function sourceStatus(results: DevicePrimitiveResult[], kind: DevicePrimitiveKind, source: string): PrimitiveComparisonStatus | null {
  const kindResults = results.filter(result => result.kind === kind);
  if (!kindResults.length) return 'UNAVAILABLE';
  if (!kindResults.some(result => result.source === source)) return 'UNBOUND_SOURCE';
  return null;
}

function alignPoints(host: HostPrimitivePoint[], device: HostPrimitivePoint[]): Array<[HostPrimitivePoint, HostPrimitivePoint]> {
  if (!host.length || !device.length) return [];
  const tolerance = alignmentTolerance(host);
  const aligned: Array<[HostPrimitivePoint, HostPrimitivePoint]> = [];
  let hostStart = 0;
  for (const devicePoint of device) {
    let bestIndex = -1;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let index = hostStart; index < host.length; index += 1) {
      const distance = Math.abs(host[index].timeS - devicePoint.timeS);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
      if (host[index].timeS > devicePoint.timeS && distance > bestDistance) break;
    }
    if (bestIndex >= 0 && bestDistance <= tolerance) {
      aligned.push([host[bestIndex], devicePoint]);
      hostStart = bestIndex + 1;
    }
  }
  return aligned;
}

export function compareNumericPrimitive(args: {
  host: HostPrimitivePoint[];
  deviceResults: DevicePrimitiveResult[];
  kind: DevicePrimitiveKind;
  source: string;
  expectedParameter?: { key: string; value: number | string } | null;
}): NumericPrimitiveComparison {
  const sourceProblem = sourceStatus(args.deviceResults, args.kind, args.source);
  if (sourceProblem) return { status: sourceProblem, alignedCount: 0, maxAbsoluteDifference: null, latestAbsoluteDifference: null, latestRelativeDifference: null };

  const selected = args.deviceResults.filter(result => result.kind === args.kind && result.source === args.source);
  if (!parameterMatches(selected, args.expectedParameter)) {
    return { status: 'PARAMETER_MISMATCH', alignedCount: 0, maxAbsoluteDifference: null, latestAbsoluteDifference: null, latestRelativeDifference: null };
  }

  const device = deviceElapsedPoints(args.deviceResults, args.kind, args.source, false);
  const aligned = alignPoints(args.host, device);
  if (!aligned.length) return { status: 'INSUFFICIENT_ALIGNMENT', alignedCount: 0, maxAbsoluteDifference: null, latestAbsoluteDifference: null, latestRelativeDifference: null };

  const differences = aligned.map(([host, observed]) => Math.abs(host.value - observed.value));
  const latest = aligned.at(-1)!;
  const latestAbsoluteDifference = differences.at(-1)!;
  const denominator = Math.abs(latest[0].value);
  return {
    status: 'MATCHABLE',
    alignedCount: aligned.length,
    maxAbsoluteDifference: Math.max(...differences),
    latestAbsoluteDifference,
    latestRelativeDifference: denominator > 1e-12 ? latestAbsoluteDifference / denominator : null,
  };
}

export function compareStatePrimitive(args: {
  host: HostPrimitivePoint[];
  deviceResults: DevicePrimitiveResult[];
  kind: 'threshold' | 'hysteresis';
  source: string;
  expectedParameter?: { key: string; value: number | string } | null;
}): StatePrimitiveComparison {
  const sourceProblem = sourceStatus(args.deviceResults, args.kind, args.source);
  if (sourceProblem) return { status: sourceProblem, alignedCount: 0, disagreementCount: 0 };

  const selected = args.deviceResults.filter(result => result.kind === args.kind && result.source === args.source);
  if (!parameterMatches(selected, args.expectedParameter)) return { status: 'PARAMETER_MISMATCH', alignedCount: 0, disagreementCount: 0 };

  const device = deviceElapsedPoints(args.deviceResults, args.kind, args.source, true);
  const aligned = alignPoints(args.host, device);
  if (!aligned.length) return { status: 'INSUFFICIENT_ALIGNMENT', alignedCount: 0, disagreementCount: 0 };

  return {
    status: 'MATCHABLE',
    alignedCount: aligned.length,
    disagreementCount: aligned.filter(([host, observed]) => (host.value >= 0.5) !== (observed.value >= 0.5)).length,
  };
}
