export type MathRuntimeCapabilities = {
  protocolVersion: number;
  profile: string;
  recommendedFftPoints: number;
  recommendedWindowPoints: number;
  recommendedPlannerObservations: number;
  robustStatistics: boolean;
  uncertaintyBudget: boolean;
  autocorrelation: boolean;
  smallFft: boolean;
  quadraticRegression: boolean;
  modelDiagnostics: boolean;
  changeDetection: boolean;
  sequentialPlanning: boolean;
};

const PREFIX = '#BB_MATH_CAPS,';

function flag(value: string): boolean | null {
  if (value === '1') return true;
  if (value === '0') return false;
  return null;
}

export function parseMathRuntimeCapabilities(line: string): MathRuntimeCapabilities | null {
  if (!line.startsWith(PREFIX)) return null;
  const parts = line.slice(PREFIX.length).split(',').map(part => part.trim());
  if (parts.length !== 13) return null;

  const protocolVersion = Number(parts[0]);
  const recommendedFftPoints = Number(parts[2]);
  const recommendedWindowPoints = Number(parts[3]);
  const recommendedPlannerObservations = Number(parts[4]);
  const flags = parts.slice(5).map(flag);

  if (!Number.isInteger(protocolVersion) || protocolVersion < 1) return null;
  if (!parts[1]) return null;
  if (![recommendedFftPoints, recommendedWindowPoints, recommendedPlannerObservations].every(value => Number.isInteger(value) && value > 0)) return null;
  if (flags.some(value => value === null)) return null;

  return {
    protocolVersion,
    profile: parts[1],
    recommendedFftPoints,
    recommendedWindowPoints,
    recommendedPlannerObservations,
    robustStatistics: flags[0]!,
    uncertaintyBudget: flags[1]!,
    autocorrelation: flags[2]!,
    smallFft: flags[3]!,
    quadraticRegression: flags[4]!,
    modelDiagnostics: flags[5]!,
    changeDetection: flags[6]!,
    sequentialPlanning: flags[7]!,
  };
}

export function enabledMathRuntimeCapabilities(caps: MathRuntimeCapabilities): string[] {
  const entries: Array<[string, boolean]> = [
    ['Robust statistics', caps.robustStatistics],
    ['Uncertainty budget', caps.uncertaintyBudget],
    ['Autocorrelation', caps.autocorrelation],
    ['FFT', caps.smallFft],
    ['Quadratic fit', caps.quadraticRegression],
    ['Model diagnostics', caps.modelDiagnostics],
    ['Change detection', caps.changeDetection],
    ['Sequential planning', caps.sequentialPlanning],
  ];
  return entries.filter(([, enabled]) => enabled).map(([label]) => label);
}
