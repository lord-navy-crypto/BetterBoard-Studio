export type PlanningModel = 'linear' | 'quadratic';

export type CandidatePlan = {
  x: number;
  informationLeverage: number;
  informationGain: number;
  coverageDistance: number;
  normalizedCoverage: number;
  replicationCount: number;
  isExtrapolation: boolean;
};

export type DesignSummary = {
  observationCount: number;
  uniqueLevelCount: number;
  replicatedObservationCount: number;
  replicateFraction: number;
  minX: number;
  maxX: number;
  medianGap: number;
  largestGap: number;
  conditionWarning: string | null;
};

function finite(values: number[]): number[] {
  return values.filter(Number.isFinite);
}

function median(values: number[]): number {
  const sorted = finite(values).sort((a, b) => a - b);
  if (!sorted.length) return Number.NaN;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function designVector(x: number, model: PlanningModel): number[] {
  return model === 'quadratic' ? [1, x, x * x] : [1, x];
}

function transposeMultiply(rows: number[][]): number[][] {
  const p = rows[0]?.length ?? 0;
  const out = Array.from({ length: p }, () => Array(p).fill(0) as number[]);
  for (const row of rows) {
    for (let i = 0; i < p; i++) for (let j = 0; j < p; j++) out[i][j] += row[i] * row[j];
  }
  return out;
}

function invert(matrix: number[][]): number[][] {
  const n = matrix.length;
  const a = matrix.map((row, r) => [...row, ...Array.from({ length: n }, (_, c) => r === c ? 1 : 0)]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(a[r][col]) > Math.abs(a[pivot][col])) pivot = r;
    if (Math.abs(a[pivot][col]) < 1e-12) throw new Error('Current design is rank-deficient for the selected planning model. Add more distinct predictor levels.');
    [a[col], a[pivot]] = [a[pivot], a[col]];
    const scale = a[col][col];
    for (let j = 0; j < 2 * n; j++) a[col][j] /= scale;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = a[r][col];
      for (let j = 0; j < 2 * n; j++) a[r][j] -= factor * a[col][j];
    }
  }
  return a.map(row => row.slice(n));
}

function quadraticForm(vector: number[], matrix: number[][]): number {
  let value = 0;
  for (let i = 0; i < vector.length; i++) for (let j = 0; j < vector.length; j++) value += vector[i] * matrix[i][j] * vector[j];
  return value;
}

function levelTolerance(values: number[]): number {
  const clean = finite(values);
  if (clean.length < 2) return 1e-9;
  const span = Math.max(...clean) - Math.min(...clean);
  return Math.max(1e-9, span * 1e-6);
}

function uniqueLevels(values: number[]): number[] {
  const sorted = finite(values).sort((a, b) => a - b);
  const tol = levelTolerance(sorted);
  const levels: number[] = [];
  for (const value of sorted) {
    if (!levels.length || Math.abs(value - levels[levels.length - 1]) > tol) levels.push(value);
  }
  return levels;
}

function countNear(values: number[], target: number): number {
  const tol = levelTolerance(values);
  return finite(values).filter(value => Math.abs(value - target) <= tol).length;
}

export function summarizeDesign(xInput: number[], model: PlanningModel): DesignSummary {
  const x = finite(xInput);
  if (x.length < 2) throw new Error('At least two finite predictor observations are required.');
  const levels = uniqueLevels(x);
  const gaps = levels.slice(1).map((value, i) => value - levels[i]);
  const replicatedObservationCount = x.length - levels.length;
  const parameterCount = model === 'quadratic' ? 3 : 2;
  let conditionWarning: string | null = null;
  if (levels.length < parameterCount) conditionWarning = `${model} planning needs at least ${parameterCount} distinct predictor levels.`;
  else if (model === 'quadratic' && levels.length < 5) conditionWarning = 'Quadratic planning is weakly supported by very few distinct levels; add spread and center support.';
  else if (gaps.length && Math.max(...gaps) > 3 * Math.max(median(gaps), Number.EPSILON)) conditionWarning = 'Predictor coverage is clustered with a large interior gap.';
  return {
    observationCount: x.length,
    uniqueLevelCount: levels.length,
    replicatedObservationCount,
    replicateFraction: replicatedObservationCount / x.length,
    minX: Math.min(...x),
    maxX: Math.max(...x),
    medianGap: gaps.length ? median(gaps) : 0,
    largestGap: gaps.length ? Math.max(...gaps) : 0,
    conditionWarning,
  };
}

export function generateCandidateGrid(minX: number, maxX: number, count = 31): number[] {
  if (!Number.isFinite(minX) || !Number.isFinite(maxX) || !(maxX > minX)) throw new Error('Candidate range must have finite min < max.');
  const n = Math.max(3, Math.min(501, Math.round(count)));
  return Array.from({ length: n }, (_, i) => minX + (maxX - minX) * i / (n - 1));
}

export function planCandidates(xInput: number[], candidatesInput: number[], model: PlanningModel): CandidatePlan[] {
  const x = finite(xInput);
  const candidates = finite(candidatesInput);
  const parameterCount = model === 'quadratic' ? 3 : 2;
  if (x.length < parameterCount) throw new Error(`At least ${parameterCount} finite observations are required for ${model} planning.`);
  const rows = x.map(value => designVector(value, model));
  const information = invert(transposeMultiply(rows));
  const minX = Math.min(...x);
  const maxX = Math.max(...x);
  const span = Math.max(maxX - minX, Number.EPSILON);
  return candidates.map(candidate => {
    const h = designVector(candidate, model);
    const leverage = Math.max(0, quadraticForm(h, information));
    const nearest = Math.min(...x.map(value => Math.abs(candidate - value)));
    return {
      x: candidate,
      informationLeverage: leverage,
      informationGain: Math.log1p(leverage),
      coverageDistance: nearest,
      normalizedCoverage: nearest / span,
      replicationCount: countNear(x, candidate),
      isExtrapolation: candidate < minX || candidate > maxX,
    };
  });
}

export function rankForInformation(plans: CandidatePlan[], allowExtrapolation = false): CandidatePlan[] {
  return plans.filter(plan => allowExtrapolation || !plan.isExtrapolation).sort((a, b) => b.informationGain - a.informationGain);
}

export function rankForCoverage(plans: CandidatePlan[], allowExtrapolation = false): CandidatePlan[] {
  return plans.filter(plan => allowExtrapolation || !plan.isExtrapolation).sort((a, b) => b.normalizedCoverage - a.normalizedCoverage);
}

export function rankForReplication(plans: CandidatePlan[]): CandidatePlan[] {
  return plans.filter(plan => plan.replicationCount > 0).sort((a, b) => a.replicationCount - b.replicationCount || b.informationGain - a.informationGain);
}

export function informationGainPercentProxy(plan: CandidatePlan): number {
  return 100 * (1 - 1 / (1 + plan.informationLeverage));
}
