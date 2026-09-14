export type SummaryStats = {
  count: number;
  mean: number;
  median: number;
  sampleStd: number;
  standardError: number;
  trimmedMean10: number;
  mad: number;
  robustSigma: number;
  ci95Low: number;
  ci95High: number;
  outlierCount: number;
  outlierFraction: number;
};

export type TrendStats = {
  slopePerSample: number;
  intercept: number;
  rSquared: number;
};

export type ResidualStats = {
  count: number;
  bias: number;
  mae: number;
  rmse: number;
  residualStd: number;
  medianResidual: number;
  residualMad: number;
  residuals: number[];
};

export type UncertaintyBudget = {
  typeAStandard: number;
  sensorStandard: number;
  scaleStandard: number;
  combinedStandard: number;
  expanded95: number;
};

export type ParsedNumericTable = {
  headers: string[];
  columns: Record<string, number[]>;
  acceptedRows: number;
  rejectedRows: number;
  delimiter: ',' | '\t' | ';';
};

const finite = (values: number[]) => values.filter(Number.isFinite);

export function mean(values: number[]): number {
  const clean = finite(values);
  return clean.length ? clean.reduce((sum, value) => sum + value, 0) / clean.length : Number.NaN;
}

export function median(values: number[]): number {
  const clean = finite(values).sort((a, b) => a - b);
  if (!clean.length) return Number.NaN;
  const mid = Math.floor(clean.length / 2);
  return clean.length % 2 ? clean[mid] : (clean[mid - 1] + clean[mid]) / 2;
}

export function sampleStd(values: number[]): number {
  const clean = finite(values);
  if (clean.length < 2) return 0;
  const m = mean(clean);
  const ss = clean.reduce((sum, value) => sum + (value - m) ** 2, 0);
  return Math.sqrt(ss / (clean.length - 1));
}

export function mad(values: number[]): number {
  const clean = finite(values);
  const med = median(clean);
  return median(clean.map(value => Math.abs(value - med)));
}

function tCritical95(df: number): number {
  if (df <= 1) return 12.706;
  if (df <= 2) return 4.303;
  if (df <= 3) return 3.182;
  if (df <= 4) return 2.776;
  if (df <= 5) return 2.571;
  if (df <= 6) return 2.447;
  if (df <= 8) return 2.306;
  if (df <= 10) return 2.228;
  if (df <= 12) return 2.179;
  if (df <= 15) return 2.131;
  if (df <= 20) return 2.086;
  if (df <= 30) return 2.042;
  if (df <= 60) return 2.000;
  return 1.960;
}

export function summarize(values: number[]): SummaryStats {
  const clean = finite(values);
  if (!clean.length) throw new Error('No finite observations are available for statistical analysis.');
  const m = mean(clean);
  const med = median(clean);
  const sd = sampleStd(clean);
  const se = sd / Math.sqrt(clean.length);
  const rawMad = mad(clean);
  const robustSigma = 1.4826 * rawMad;
  const sorted = [...clean].sort((a, b) => a - b);
  const trim = Math.floor(sorted.length * 0.10);
  const trimmed = sorted.slice(trim, Math.max(trim + 1, sorted.length - trim));
  const thresholdMad = rawMad > 0 ? rawMad : Number.NaN;
  const outlierCount = Number.isFinite(thresholdMad)
    ? clean.filter(value => Math.abs(0.6745 * (value - med) / thresholdMad) > 3.5).length
    : 0;
  const t = tCritical95(Math.max(1, clean.length - 1));
  return {
    count: clean.length,
    mean: m,
    median: med,
    sampleStd: sd,
    standardError: se,
    trimmedMean10: mean(trimmed),
    mad: rawMad,
    robustSigma,
    ci95Low: m - t * se,
    ci95High: m + t * se,
    outlierCount,
    outlierFraction: outlierCount / clean.length,
  };
}

export function linearTrend(values: number[]): TrendStats {
  const clean = finite(values);
  if (clean.length < 2) return { slopePerSample: 0, intercept: clean[0] ?? Number.NaN, rSquared: 0 };
  const xMean = (clean.length - 1) / 2;
  const yMean = mean(clean);
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (let i = 0; i < clean.length; i++) {
    const dx = i - xMean;
    const dy = clean[i] - yMean;
    sxx += dx * dx;
    sxy += dx * dy;
    syy += dy * dy;
  }
  const slope = sxx > 0 ? sxy / sxx : 0;
  const intercept = yMean - slope * xMean;
  const rSquared = sxx > 0 && syy > 0 ? Math.max(0, Math.min(1, (sxy * sxy) / (sxx * syy))) : 0;
  return { slopePerSample: slope, intercept, rSquared };
}

export function residualAnalysis(observed: number[], reference: number[]): ResidualStats {
  const n = Math.min(observed.length, reference.length);
  const residuals: number[] = [];
  for (let i = 0; i < n; i++) {
    if (Number.isFinite(observed[i]) && Number.isFinite(reference[i])) residuals.push(observed[i] - reference[i]);
  }
  if (!residuals.length) throw new Error('Observed and reference columns do not contain aligned finite pairs.');
  return {
    count: residuals.length,
    bias: mean(residuals),
    mae: mean(residuals.map(Math.abs)),
    rmse: Math.sqrt(mean(residuals.map(value => value * value))),
    residualStd: sampleStd(residuals),
    medianResidual: median(residuals),
    residualMad: mad(residuals),
    residuals,
  };
}

export function uncertaintyBudget(values: number[], sensorStandard = 0, scaleRelativePercent = 0): UncertaintyBudget {
  const stats = summarize(values);
  const sensor = Math.max(0, sensorStandard);
  const scale = Math.abs(stats.mean) * Math.max(0, scaleRelativePercent) / 100;
  const combined = Math.sqrt(stats.standardError ** 2 + sensor ** 2 + scale ** 2);
  return {
    typeAStandard: stats.standardError,
    sensorStandard: sensor,
    scaleStandard: scale,
    combinedStandard: combined,
    expanded95: 1.96 * combined,
  };
}

function chooseDelimiter(line: string): ',' | '\t' | ';' {
  const options: Array<',' | '\t' | ';'> = [',', '\t', ';'];
  return options.reduce((best, candidate) => line.split(candidate).length > line.split(best).length ? candidate : best, ',');
}

export function parseNumericTable(text: string): ParsedNumericTable {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (!lines.length) throw new Error('The imported table is empty.');
  const delimiter = chooseDelimiter(lines[0]);
  const first = lines[0].split(delimiter).map(value => value.trim());
  const firstNumeric = first.every(value => value !== '' && Number.isFinite(Number(value)));
  const headers = firstNumeric ? first.map((_, index) => `column_${index + 1}`) : first.map((value, index) => value || `column_${index + 1}`);
  const columns: Record<string, number[]> = Object.fromEntries(headers.map(header => [header, []]));
  let acceptedRows = 0;
  let rejectedRows = 0;
  const start = firstNumeric ? 0 : 1;
  for (let row = start; row < lines.length; row++) {
    const cells = lines[row].split(delimiter).map(value => value.trim());
    if (cells.length < headers.length) { rejectedRows++; continue; }
    let numericInRow = 0;
    for (let column = 0; column < headers.length; column++) {
      const value = Number(cells[column]);
      if (Number.isFinite(value)) {
        columns[headers[column]].push(value);
        numericInRow++;
      } else {
        columns[headers[column]].push(Number.NaN);
      }
    }
    if (numericInRow) acceptedRows++; else rejectedRows++;
  }
  const numericHeaders = headers.filter(header => columns[header].some(Number.isFinite));
  if (!numericHeaders.length) throw new Error('No numeric columns were detected.');
  return {
    headers: numericHeaders,
    columns: Object.fromEntries(numericHeaders.map(header => [header, columns[header]])),
    acceptedRows,
    rejectedRows,
    delimiter,
  };
}
