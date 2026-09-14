export type ParameterEstimate = {
  name: string;
  estimate: number;
  standardError: number;
  ci95Low: number;
  ci95High: number;
};

export type FitDiagnostics = {
  n: number;
  parameterCount: number;
  sse: number;
  rmse: number;
  rSquared: number;
  adjustedRSquared: number;
  aic: number;
  aicc: number;
  bic: number;
};

export type RegressionFit = {
  model: 'linear' | 'quadratic';
  parameters: ParameterEstimate[];
  diagnostics: FitDiagnostics;
  predictions: number[];
  residuals: number[];
  parameterCorrelation?: number | null;
};

function tCritical95(df: number): number {
  if (df <= 1) return 12.706;
  if (df <= 2) return 4.303;
  if (df <= 3) return 3.182;
  if (df <= 4) return 2.776;
  if (df <= 5) return 2.571;
  if (df <= 6) return 2.447;
  if (df <= 8) return 2.306;
  if (df <= 10) return 2.228;
  if (df <= 15) return 2.131;
  if (df <= 20) return 2.086;
  if (df <= 30) return 2.042;
  if (df <= 60) return 2.000;
  return 1.960;
}

function alignedFinite(x: number[], y: number[]) {
  const rows: Array<[number, number]> = [];
  const n = Math.min(x.length, y.length);
  for (let i = 0; i < n; i++) {
    if (Number.isFinite(x[i]) && Number.isFinite(y[i])) rows.push([x[i], y[i]]);
  }
  if (rows.length < 4) throw new Error('At least 4 aligned finite x/y observations are required.');
  return rows;
}

function diagnostics(y: number[], predictions: number[], k: number): FitDiagnostics {
  const n = y.length;
  const mean = y.reduce((sum, value) => sum + value, 0) / n;
  const residuals = y.map((value, i) => value - predictions[i]);
  const sse = residuals.reduce((sum, value) => sum + value * value, 0);
  const sst = y.reduce((sum, value) => sum + (value - mean) ** 2, 0);
  const rSquared = sst > 0 ? 1 - sse / sst : (sse === 0 ? 1 : 0);
  const adjustedRSquared = n > k
    ? 1 - (1 - rSquared) * (n - 1) / Math.max(1, n - k)
    : Number.NaN;
  const variance = Math.max(sse / n, Number.MIN_VALUE);
  const aic = n * Math.log(variance) + 2 * k;
  const aicc = n > k + 1 ? aic + (2 * k * (k + 1)) / (n - k - 1) : Number.POSITIVE_INFINITY;
  const bic = n * Math.log(variance) + k * Math.log(n);
  return {
    n,
    parameterCount: k,
    sse,
    rmse: Math.sqrt(sse / n),
    rSquared,
    adjustedRSquared,
    aic,
    aicc,
    bic,
  };
}

function estimate(name: string, value: number, variance: number, t: number): ParameterEstimate {
  const standardError = Math.sqrt(Math.max(0, variance));
  return {
    name,
    estimate: value,
    standardError,
    ci95Low: value - t * standardError,
    ci95High: value + t * standardError,
  };
}

export function linearRegression(xInput: number[], yInput: number[]): RegressionFit {
  const rows = alignedFinite(xInput, yInput);
  const x = rows.map(row => row[0]);
  const y = rows.map(row => row[1]);
  const n = rows.length;
  const xMean = x.reduce((sum, value) => sum + value, 0) / n;
  const yMean = y.reduce((sum, value) => sum + value, 0) / n;
  const sxx = x.reduce((sum, value) => sum + (value - xMean) ** 2, 0);
  if (!(sxx > 0)) throw new Error('The selected x column has no variation.');
  const sxy = x.reduce((sum, value, i) => sum + (value - xMean) * (y[i] - yMean), 0);
  const slope = sxy / sxx;
  const intercept = yMean - slope * xMean;
  const predictions = x.map(value => intercept + slope * value);
  const residuals = y.map((value, i) => value - predictions[i]);
  const fit = diagnostics(y, predictions, 2);
  const residualVariance = n > 2 ? fit.sse / (n - 2) : 0;
  const slopeVariance = residualVariance / sxx;
  const interceptVariance = residualVariance * (1 / n + xMean * xMean / sxx);
  const covariance = -xMean * residualVariance / sxx;
  const correlationDenom = Math.sqrt(Math.max(0, slopeVariance * interceptVariance));
  const correlation = correlationDenom > 0 ? covariance / correlationDenom : null;
  const t = tCritical95(Math.max(1, n - 2));
  return {
    model: 'linear',
    parameters: [
      estimate('intercept', intercept, interceptVariance, t),
      estimate('slope', slope, slopeVariance, t),
    ],
    diagnostics: fit,
    predictions,
    residuals,
    parameterCorrelation: correlation,
  };
}

function solve3(matrix: number[][], vector: number[]): number[] {
  const a = matrix.map((row, i) => [...row, vector[i]]);
  for (let col = 0; col < 3; col++) {
    let pivot = col;
    for (let row = col + 1; row < 3; row++) if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row;
    if (Math.abs(a[pivot][col]) < 1e-14) throw new Error('Quadratic fit is ill-conditioned for the selected x values.');
    [a[col], a[pivot]] = [a[pivot], a[col]];
    const scale = a[col][col];
    for (let j = col; j < 4; j++) a[col][j] /= scale;
    for (let row = 0; row < 3; row++) {
      if (row === col) continue;
      const factor = a[row][col];
      for (let j = col; j < 4; j++) a[row][j] -= factor * a[col][j];
    }
  }
  return a.map(row => row[3]);
}

function inverse3(matrix: number[][]): number[][] {
  const columns: number[][] = [];
  for (let c = 0; c < 3; c++) {
    const unit = [0, 0, 0];
    unit[c] = 1;
    columns.push(solve3(matrix, unit));
  }
  return Array.from({ length: 3 }, (_, r) => columns.map(column => column[r]));
}

export function quadraticRegression(xInput: number[], yInput: number[]): RegressionFit {
  const rows = alignedFinite(xInput, yInput);
  if (rows.length < 5) throw new Error('At least 5 aligned observations are required for a quadratic fit.');
  const x = rows.map(row => row[0]);
  const y = rows.map(row => row[1]);
  const n = rows.length;
  const sums = (power: number) => x.reduce((sum, value) => sum + value ** power, 0);
  const xtx = [
    [n, sums(1), sums(2)],
    [sums(1), sums(2), sums(3)],
    [sums(2), sums(3), sums(4)],
  ];
  const xty = [
    y.reduce((sum, value) => sum + value, 0),
    y.reduce((sum, value, i) => sum + x[i] * value, 0),
    y.reduce((sum, value, i) => sum + x[i] * x[i] * value, 0),
  ];
  const [a, b, c] = solve3(xtx, xty);
  const predictions = x.map(value => a + b * value + c * value * value);
  const residuals = y.map((value, i) => value - predictions[i]);
  const fit = diagnostics(y, predictions, 3);
  const residualVariance = n > 3 ? fit.sse / (n - 3) : 0;
  const covariance = inverse3(xtx).map(row => row.map(value => value * residualVariance));
  const t = tCritical95(Math.max(1, n - 3));
  return {
    model: 'quadratic',
    parameters: [
      estimate('intercept', a, covariance[0][0], t),
      estimate('linear term', b, covariance[1][1], t),
      estimate('quadratic term', c, covariance[2][2], t),
    ],
    diagnostics: fit,
    predictions,
    residuals,
  };
}

export function deltaAicc(fits: RegressionFit[]): Array<{ model: RegressionFit['model']; delta: number }> {
  const finite = fits.filter(fit => Number.isFinite(fit.diagnostics.aicc));
  if (!finite.length) return fits.map(fit => ({ model: fit.model, delta: Number.POSITIVE_INFINITY }));
  const best = Math.min(...finite.map(fit => fit.diagnostics.aicc));
  return fits.map(fit => ({ model: fit.model, delta: fit.diagnostics.aicc - best }));
}
