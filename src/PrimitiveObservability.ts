export type PrimitiveSample = { timeS: number; value: number };

export type PrimitiveParameters = {
  emaAlpha: number;
  threshold: number;
  hysteresisLow: number;
  hysteresisHigh: number;
  regressionWindow: number;
  cusumReferenceMean?: number;
  cusumSlack?: number;
  cusumThreshold?: number;
  meanShiftWindow: number;
  meanShiftThreshold?: number;
};

export type PrimitiveRegression = {
  sampleCount: number;
  slope: number;
  intercept: number;
  rSquared: number | null;
};

export type HostPrimitiveResult = {
  origin: 'host-derived';
  sampleCount: number;
  timeSpanS: number | null;
  statistics: {
    mean: number | null;
    sampleStandardDeviation: number | null;
    populationStandardDeviation: number | null;
    minimum: number | null;
    maximum: number | null;
    peakToPeak: number | null;
  };
  rms: number | null;
  rmsTrace: PrimitiveSample[];
  derivativeTrace: PrimitiveSample[];
  integralTrace: PrimitiveSample[];
  emaTrace: PrimitiveSample[];
  peakHoldTrace: PrimitiveSample[];
  thresholdStateTrace: PrimitiveSample[];
  thresholdEvents: PrimitiveSample[];
  hysteresisStateTrace: PrimitiveSample[];
  hysteresisEvents: PrimitiveSample[];
  hysteresisReady: boolean;
  hysteresisReason: string | null;
  regression: PrimitiveRegression | null;
  cusumPositiveTrace: PrimitiveSample[];
  cusumNegativeTrace: PrimitiveSample[];
  cusumEvents: PrimitiveSample[];
  meanShiftTrace: PrimitiveSample[];
  meanShiftEvents: PrimitiveSample[];
  effectiveParameters: PrimitiveParameters;
  warnings: string[];
};

function finiteSamples(input: PrimitiveSample[]): PrimitiveSample[] {
  return input.filter(sample => Number.isFinite(sample.timeS) && Number.isFinite(sample.value));
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function validEvenWindow(value: number, fallback = 20): number {
  let window = Number.isFinite(value) ? Math.round(value) : fallback;
  window = Math.max(4, window);
  if (window % 2 !== 0) window += 1;
  return window;
}

function mean(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sampleStandardDeviation(values: number[]): number | null {
  if (values.length < 2) return null;
  const average = mean(values)!;
  const m2 = values.reduce((sum, value) => sum + (value - average) ** 2, 0);
  return Math.sqrt(m2 / (values.length - 1));
}

export function derivePrimitiveDefaults(input: PrimitiveSample[]): PrimitiveParameters {
  const samples = finiteSamples(input);
  const values = samples.map(sample => sample.value);
  const minimum = values.length ? Math.min(...values) : 0;
  const maximum = values.length ? Math.max(...values) : 0;
  const midpoint = (minimum + maximum) / 2;
  const range = maximum - minimum;
  const scale = Math.max(Math.abs(midpoint), Math.abs(minimum), Math.abs(maximum), 1);
  const hysteresisHalfSpan = range > 0 ? range * 0.1 : scale * 0.01;
  const runMean = mean(values) ?? 0;
  const std = sampleStandardDeviation(values) ?? 0;
  const fallbackNoiseScale = Math.max(range * 0.01, scale * 1e-6, Number.EPSILON);
  const noiseScale = std > 0 ? std : fallbackNoiseScale;

  return {
    emaAlpha: 0.2,
    threshold: midpoint,
    hysteresisLow: midpoint - hysteresisHalfSpan,
    hysteresisHigh: midpoint + hysteresisHalfSpan,
    regressionWindow: 32,
    cusumReferenceMean: runMean,
    cusumSlack: 0.5 * noiseScale,
    cusumThreshold: 5 * noiseScale,
    meanShiftWindow: 20,
    meanShiftThreshold: 2 * noiseScale,
  };
}

function computeRegression(samples: PrimitiveSample[], requestedWindow: number): PrimitiveRegression | null {
  const window = Math.max(2, Math.round(Number.isFinite(requestedWindow) ? requestedWindow : 32));
  const subset = samples.slice(-window);
  if (subset.length < 2) return null;

  const meanTime = subset.reduce((sum, sample) => sum + sample.timeS, 0) / subset.length;
  const meanValue = subset.reduce((sum, sample) => sum + sample.value, 0) / subset.length;
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (const sample of subset) {
    const dx = sample.timeS - meanTime;
    const dy = sample.value - meanValue;
    sxx += dx * dx;
    sxy += dx * dy;
    syy += dy * dy;
  }
  if (!(sxx > 0)) return null;
  const slope = sxy / sxx;
  const intercept = meanValue - slope * meanTime;
  const rSquared = syy > 0 ? clamp((sxy * sxy) / (sxx * syy), 0, 1) : null;
  return { sampleCount: subset.length, slope, intercept, rSquared };
}

export function computeHostPrimitiveObservability(
  input: PrimitiveSample[],
  parameters: PrimitiveParameters,
): HostPrimitiveResult {
  const samples = finiteSamples(input);
  const defaults = derivePrimitiveDefaults(samples);
  const effectiveParameters: PrimitiveParameters = {
    emaAlpha: Number.isFinite(parameters.emaAlpha) ? clamp(parameters.emaAlpha, 0, 1) : defaults.emaAlpha,
    threshold: Number.isFinite(parameters.threshold) ? parameters.threshold : defaults.threshold,
    hysteresisLow: Number.isFinite(parameters.hysteresisLow) ? parameters.hysteresisLow : defaults.hysteresisLow,
    hysteresisHigh: Number.isFinite(parameters.hysteresisHigh) ? parameters.hysteresisHigh : defaults.hysteresisHigh,
    regressionWindow: Number.isFinite(parameters.regressionWindow) ? Math.max(2, Math.round(parameters.regressionWindow)) : defaults.regressionWindow,
    cusumReferenceMean: Number.isFinite(parameters.cusumReferenceMean) ? parameters.cusumReferenceMean : defaults.cusumReferenceMean,
    cusumSlack: Number.isFinite(parameters.cusumSlack) ? Math.max(0, parameters.cusumSlack!) : defaults.cusumSlack,
    cusumThreshold: Number.isFinite(parameters.cusumThreshold) ? Math.max(0, parameters.cusumThreshold!) : defaults.cusumThreshold,
    meanShiftWindow: validEvenWindow(parameters.meanShiftWindow, defaults.meanShiftWindow),
    meanShiftThreshold: Number.isFinite(parameters.meanShiftThreshold) ? Math.max(0, parameters.meanShiftThreshold!) : defaults.meanShiftThreshold,
  };

  const warnings: string[] = [];
  const addWarning = (warning: string) => {
    if (!warnings.includes(warning)) warnings.push(warning);
  };
  if (samples.length !== input.length) addWarning('Non-finite samples were omitted from host-derived analysis.');

  let count = 0;
  let onlineMean = 0;
  let m2 = 0;
  let minimum = Number.POSITIVE_INFINITY;
  let maximum = Number.NEGATIVE_INFINITY;
  let sumSquares = 0;
  const rmsTrace: PrimitiveSample[] = [];
  const emaTrace: PrimitiveSample[] = [];
  const peakHoldTrace: PrimitiveSample[] = [];
  const thresholdStateTrace: PrimitiveSample[] = [];
  const thresholdEvents: PrimitiveSample[] = [];
  const hysteresisStateTrace: PrimitiveSample[] = [];
  const hysteresisEvents: PrimitiveSample[] = [];

  let emaValue = 0;
  let peakValue = Number.NEGATIVE_INFINITY;
  let thresholdLatched = false;
  let hysteresisState: boolean = false;
  const hysteresisReady = effectiveParameters.hysteresisLow < effectiveParameters.hysteresisHigh;
  const hysteresisReason = hysteresisReady ? null : 'Hysteresis requires low threshold < high threshold.';
  if (!hysteresisReady) addWarning(hysteresisReason!);

  for (const sample of samples) {
    count += 1;
    const delta = sample.value - onlineMean;
    onlineMean += delta / count;
    const delta2 = sample.value - onlineMean;
    m2 += delta * delta2;
    minimum = Math.min(minimum, sample.value);
    maximum = Math.max(maximum, sample.value);
    sumSquares += sample.value * sample.value;
    rmsTrace.push({ timeS: sample.timeS, value: Math.sqrt(sumSquares / count) });

    emaValue = count === 1
      ? sample.value
      : effectiveParameters.emaAlpha * sample.value + (1 - effectiveParameters.emaAlpha) * emaValue;
    emaTrace.push({ timeS: sample.timeS, value: emaValue });

    peakValue = Math.max(peakValue, sample.value);
    peakHoldTrace.push({ timeS: sample.timeS, value: peakValue });

    const previousThresholdState = thresholdLatched;
    if (!thresholdLatched && sample.value >= effectiveParameters.threshold) thresholdLatched = true;
    thresholdStateTrace.push({ timeS: sample.timeS, value: thresholdLatched ? 1 : 0 });
    if (!previousThresholdState && thresholdLatched) thresholdEvents.push({ timeS: sample.timeS, value: sample.value });

    if (hysteresisReady) {
      const previousHysteresisState: boolean = hysteresisState;
      if (!hysteresisState && sample.value >= effectiveParameters.hysteresisHigh) hysteresisState = true;
      else if (hysteresisState && sample.value <= effectiveParameters.hysteresisLow) hysteresisState = false;
      hysteresisStateTrace.push({ timeS: sample.timeS, value: hysteresisState ? 1 : 0 });
      if (previousHysteresisState !== hysteresisState) hysteresisEvents.push({ timeS: sample.timeS, value: sample.value });
    }
  }

  const derivativeTrace: PrimitiveSample[] = [];
  const integralTrace: PrimitiveSample[] = [];
  let integral = 0;
  if (samples.length) integralTrace.push({ timeS: samples[0].timeS, value: 0 });
  for (let index = 1; index < samples.length; index += 1) {
    const previous = samples[index - 1];
    const current = samples[index];
    const dt = current.timeS - previous.timeS;
    if (!(dt > 0)) {
      addWarning('A non-increasing timestamp transition was omitted from derivative and integration traces.');
      continue;
    }
    derivativeTrace.push({ timeS: current.timeS, value: (current.value - previous.value) / dt });
    integral += 0.5 * (previous.value + current.value) * dt;
    integralTrace.push({ timeS: current.timeS, value: integral });
  }

  const populationVariance = count > 0 ? m2 / count : null;
  const sampleVariance = count > 1 ? m2 / (count - 1) : null;
  const statistics = {
    mean: count > 0 ? onlineMean : null,
    sampleStandardDeviation: sampleVariance === null ? null : Math.sqrt(Math.max(0, sampleVariance)),
    populationStandardDeviation: populationVariance === null ? null : Math.sqrt(Math.max(0, populationVariance)),
    minimum: count > 0 ? minimum : null,
    maximum: count > 0 ? maximum : null,
    peakToPeak: count > 0 ? maximum - minimum : null,
  };

  const regression = computeRegression(samples, effectiveParameters.regressionWindow);

  const cusumPositiveTrace: PrimitiveSample[] = [];
  const cusumNegativeTrace: PrimitiveSample[] = [];
  const cusumEvents: PrimitiveSample[] = [];
  let positive = 0;
  let negative = 0;
  let cusumAlarmed = false;
  const referenceMean = effectiveParameters.cusumReferenceMean ?? 0;
  const slack = effectiveParameters.cusumSlack ?? 0;
  const cusumThreshold = effectiveParameters.cusumThreshold ?? 0;
  for (const sample of samples) {
    positive = Math.max(0, positive + (sample.value - referenceMean) - slack);
    negative = Math.min(0, negative + (sample.value - referenceMean) + slack);
    cusumPositiveTrace.push({ timeS: sample.timeS, value: positive });
    cusumNegativeTrace.push({ timeS: sample.timeS, value: negative });
    const alarm = positive > cusumThreshold || -negative > cusumThreshold;
    if (alarm && !cusumAlarmed) cusumEvents.push({ timeS: sample.timeS, value: sample.value });
    cusumAlarmed = alarm;
  }

  const meanShiftTrace: PrimitiveSample[] = [];
  const meanShiftEvents: PrimitiveSample[] = [];
  const meanShiftWindow = effectiveParameters.meanShiftWindow;
  const halfWindow = meanShiftWindow / 2;
  const meanShiftThreshold = effectiveParameters.meanShiftThreshold ?? 0;
  for (let index = meanShiftWindow - 1; index < samples.length; index += 1) {
    const window = samples.slice(index - meanShiftWindow + 1, index + 1);
    const firstHalf = window.slice(0, halfWindow);
    const secondHalf = window.slice(halfWindow);
    const firstMean = firstHalf.reduce((sum, sample) => sum + sample.value, 0) / halfWindow;
    const secondMean = secondHalf.reduce((sum, sample) => sum + sample.value, 0) / halfWindow;
    const shift = secondMean - firstMean;
    const point = { timeS: samples[index].timeS, value: shift };
    meanShiftTrace.push(point);
    if (Math.abs(shift) > meanShiftThreshold) meanShiftEvents.push(point);
  }

  return {
    origin: 'host-derived',
    sampleCount: count,
    timeSpanS: count > 1 ? samples[count - 1].timeS - samples[0].timeS : null,
    statistics,
    rms: count > 0 ? Math.sqrt(sumSquares / count) : null,
    rmsTrace,
    derivativeTrace,
    integralTrace,
    emaTrace,
    peakHoldTrace,
    thresholdStateTrace,
    thresholdEvents,
    hysteresisStateTrace,
    hysteresisEvents,
    hysteresisReady,
    hysteresisReason,
    regression,
    cusumPositiveTrace,
    cusumNegativeTrace,
    cusumEvents,
    meanShiftTrace,
    meanShiftEvents,
    effectiveParameters,
    warnings,
  };
}
