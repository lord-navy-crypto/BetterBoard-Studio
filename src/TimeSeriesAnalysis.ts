import { mean, sampleStd } from './AppliedStatistics';

export type AutocorrelationPoint = { lag: number; correlation: number };
export type DependenceStats = {
  lag1: number;
  effectiveSampleSize: number;
  decorrelationLag: number | null;
  autocorrelation: AutocorrelationPoint[];
};
export type SpectrumPeak = { frequencyHz: number; power: number };
export type SpectrumStats = {
  sampleRateHz: number;
  nyquistHz: number;
  fftSize: number;
  dominantFrequencyHz: number | null;
  dominantPowerFraction: number;
  spectralCentroidHz: number | null;
  highFrequencyPowerFraction: number;
  aliasingRisk: 'low' | 'inspect' | 'high';
  peaks: SpectrumPeak[];
  bins: SpectrumPeak[];
};
export type EwmaPoint = { index: number; value: number; upperLimit: number; lowerLimit: number; alarm: boolean };
export type EwmaStats = {
  lambda: number;
  alarmCount: number;
  firstAlarmIndex: number | null;
  maxStandardizedDeviation: number;
  center: number | null;
  trace: EwmaPoint[];
};
export type CusumPoint = { index: number; positive: number; negative: number; alarm: boolean };
export type CusumStats = {
  referenceSigma: number;
  decisionSigma: number;
  alarmCount: number;
  firstAlarmIndex: number | null;
  alarmIndices: number[];
  decisionThreshold: number | null;
  trace: CusumPoint[];
};
export type ChangePointStats = {
  index: number | null;
  score: number;
  meanBefore: number | null;
  meanAfter: number | null;
};

function finite(values: number[]): number[] {
  return values.filter(Number.isFinite);
}

export function autocorrelation(values: number[], maxLag = 100): AutocorrelationPoint[] {
  const clean = finite(values);
  if (clean.length < 3) return [];
  const m = mean(clean);
  const centered = clean.map(value => value - m);
  const denom = centered.reduce((sum, value) => sum + value * value, 0);
  if (!(denom > 0)) return [{ lag: 0, correlation: 1 }];
  const limit = Math.max(1, Math.min(maxLag, clean.length - 2));
  const points: AutocorrelationPoint[] = [{ lag: 0, correlation: 1 }];
  for (let lag = 1; lag <= limit; lag++) {
    let numerator = 0;
    for (let i = lag; i < centered.length; i++) numerator += centered[i] * centered[i - lag];
    points.push({ lag, correlation: numerator / denom });
  }
  return points;
}

export function dependenceAnalysis(values: number[], maxLag = 100): DependenceStats {
  const clean = finite(values);
  const acf = autocorrelation(clean, maxLag);
  if (!clean.length) return { lag1: Number.NaN, effectiveSampleSize: 0, decorrelationLag: null, autocorrelation: [] };
  let correlationSum = 0;
  let decorrelationLag: number | null = null;
  for (const point of acf.slice(1)) {
    if (decorrelationLag === null && Math.abs(point.correlation) < 1 / Math.E) decorrelationLag = point.lag;
    if (point.correlation <= 0) break;
    correlationSum += point.correlation;
  }
  const effective = clean.length / Math.max(1, 1 + 2 * correlationSum);
  return {
    lag1: acf[1]?.correlation ?? Number.NaN,
    effectiveSampleSize: Math.max(1, Math.min(clean.length, effective)),
    decorrelationLag,
    autocorrelation: acf,
  };
}

function nextPowerOfTwo(value: number): number {
  let n = 1;
  while (n < value) n <<= 1;
  return n;
}

function fftReal(values: number[]): { re: number[]; im: number[] } {
  const n = values.length;
  const re = [...values];
  const im = Array(n).fill(0) as number[];
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let length = 2; length <= n; length <<= 1) {
    const angle = -2 * Math.PI / length;
    const wLenRe = Math.cos(angle);
    const wLenIm = Math.sin(angle);
    for (let start = 0; start < n; start += length) {
      let wRe = 1;
      let wIm = 0;
      for (let offset = 0; offset < length / 2; offset++) {
        const even = start + offset;
        const odd = even + length / 2;
        const oddRe = re[odd] * wRe - im[odd] * wIm;
        const oddIm = re[odd] * wIm + im[odd] * wRe;
        const evenRe = re[even];
        const evenIm = im[even];
        re[even] = evenRe + oddRe;
        im[even] = evenIm + oddIm;
        re[odd] = evenRe - oddRe;
        im[odd] = evenIm - oddIm;
        const nextWRe = wRe * wLenRe - wIm * wLenIm;
        wIm = wRe * wLenIm + wIm * wLenRe;
        wRe = nextWRe;
      }
    }
  }
  return { re, im };
}

export function spectrumAnalysis(values: number[], sampleRateHz: number): SpectrumStats {
  const clean = finite(values);
  if (clean.length < 8) throw new Error('At least 8 finite samples are required for spectrum analysis.');
  if (!(sampleRateHz > 0) || !Number.isFinite(sampleRateHz)) throw new Error('Sample rate must be a positive finite value.');
  const capped = clean.slice(0, 16384);
  const m = mean(capped);
  const nData = capped.length;
  const nFft = nextPowerOfTwo(nData);
  const windowed = Array(nFft).fill(0) as number[];
  for (let i = 0; i < nData; i++) {
    const hann = nData === 1 ? 1 : 0.5 * (1 - Math.cos(2 * Math.PI * i / (nData - 1)));
    windowed[i] = (capped[i] - m) * hann;
  }
  const { re, im } = fftReal(windowed);
  const bins = Math.floor(nFft / 2) + 1;
  const powers: SpectrumPeak[] = [];
  let totalPower = 0;
  for (let k = 1; k < bins; k++) {
    const power = re[k] * re[k] + im[k] * im[k];
    const frequencyHz = k * sampleRateHz / nFft;
    powers.push({ frequencyHz, power });
    totalPower += power;
  }
  const sorted = [...powers].sort((a, b) => b.power - a.power);
  const dominant = sorted[0] ?? null;
  const highCut = sampleRateHz * 0.4;
  const highPower = powers.filter(point => point.frequencyHz >= highCut).reduce((sum, point) => sum + point.power, 0);
  const highFraction = totalPower > 0 ? highPower / totalPower : 0;
  const centroid = totalPower > 0
    ? powers.reduce((sum, point) => sum + point.frequencyHz * point.power, 0) / totalPower
    : null;
  const dominantFraction = dominant && totalPower > 0 ? dominant.power / totalPower : 0;
  const aliasingRisk: SpectrumStats['aliasingRisk'] = highFraction >= 0.25 ? 'high' : highFraction >= 0.10 ? 'inspect' : 'low';
  return {
    sampleRateHz,
    nyquistHz: sampleRateHz / 2,
    fftSize: nFft,
    dominantFrequencyHz: dominant?.frequencyHz ?? null,
    dominantPowerFraction: dominantFraction,
    spectralCentroidHz: centroid,
    highFrequencyPowerFraction: highFraction,
    aliasingRisk,
    peaks: sorted.slice(0, 8),
    bins: powers,
  };
}

export function ewmaAnalysis(values: number[], lambda = 0.2, sigmaLimit = 3): EwmaStats {
  const clean = finite(values);
  if (clean.length < 3) return { lambda, alarmCount: 0, firstAlarmIndex: null, maxStandardizedDeviation: 0, center: null, trace: [] };
  const clampedLambda = Math.min(1, Math.max(0.01, lambda));
  const m = mean(clean);
  const sd = sampleStd(clean);
  if (!(sd > 0)) return { lambda: clampedLambda, alarmCount: 0, firstAlarmIndex: null, maxStandardizedDeviation: 0, center: m, trace: clean.map((value, index) => ({ index, value, upperLimit: m, lowerLimit: m, alarm: false })) };
  let z = m;
  let alarms = 0;
  let first: number | null = null;
  let maxDeviation = 0;
  const trace: EwmaPoint[] = [];
  for (let i = 0; i < clean.length; i++) {
    z = clampedLambda * clean[i] + (1 - clampedLambda) * z;
    const transientFactor = Math.sqrt((clampedLambda / (2 - clampedLambda)) * (1 - (1 - clampedLambda) ** (2 * (i + 1))));
    const sigmaZ = sd * transientFactor;
    const standardized = sigmaZ > 0 ? Math.abs(z - m) / sigmaZ : 0;
    maxDeviation = Math.max(maxDeviation, standardized);
    const alarm = standardized > sigmaLimit;
    if (alarm) {
      alarms++;
      if (first === null) first = i;
    }
    trace.push({ index: i, value: z, upperLimit: m + sigmaLimit * sigmaZ, lowerLimit: m - sigmaLimit * sigmaZ, alarm });
  }
  return { lambda: clampedLambda, alarmCount: alarms, firstAlarmIndex: first, maxStandardizedDeviation: maxDeviation, center: m, trace };
}

export function cusumAnalysis(values: number[], referenceSigma = 0.5, decisionSigma = 5): CusumStats {
  const clean = finite(values);
  const sd = sampleStd(clean);
  if (clean.length < 3 || !(sd > 0)) return { referenceSigma, decisionSigma, alarmCount: 0, firstAlarmIndex: null, alarmIndices: [], decisionThreshold: null, trace: [] };
  const m = mean(clean);
  const k = Math.max(0, referenceSigma) * sd;
  const h = Math.max(0.1, decisionSigma) * sd;
  let positive = 0;
  let negative = 0;
  const alarms: number[] = [];
  const trace: CusumPoint[] = [];
  for (let i = 0; i < clean.length; i++) {
    const deviation = clean[i] - m;
    positive = Math.max(0, positive + deviation - k);
    negative = Math.min(0, negative + deviation + k);
    const alarm = positive > h || negative < -h;
    trace.push({ index: i, positive, negative, alarm });
    if (alarm) {
      alarms.push(i);
      positive = 0;
      negative = 0;
    }
  }
  return {
    referenceSigma,
    decisionSigma,
    alarmCount: alarms.length,
    firstAlarmIndex: alarms[0] ?? null,
    alarmIndices: alarms,
    decisionThreshold: h,
    trace,
  };
}

export function meanShiftChangePoint(values: number[], minSegment = 8): ChangePointStats {
  const clean = finite(values);
  if (clean.length < minSegment * 2) return { index: null, score: 0, meanBefore: null, meanAfter: null };
  const prefix = Array(clean.length + 1).fill(0) as number[];
  for (let i = 0; i < clean.length; i++) prefix[i + 1] = prefix[i] + clean[i];
  const globalSd = sampleStd(clean);
  if (!(globalSd > 0)) return { index: null, score: 0, meanBefore: mean(clean), meanAfter: mean(clean) };
  let bestIndex: number | null = null;
  let bestScore = 0;
  let bestBefore: number | null = null;
  let bestAfter: number | null = null;
  for (let split = minSegment; split <= clean.length - minSegment; split++) {
    const leftMean = prefix[split] / split;
    const rightMean = (prefix[clean.length] - prefix[split]) / (clean.length - split);
    const scale = Math.sqrt((split * (clean.length - split)) / clean.length);
    const score = Math.abs(leftMean - rightMean) * scale / globalSd;
    if (score > bestScore) {
      bestScore = score;
      bestIndex = split;
      bestBefore = leftMean;
      bestAfter = rightMean;
    }
  }
  return { index: bestIndex, score: bestScore, meanBefore: bestBefore, meanAfter: bestAfter };
}
