export type CampaignRecipeId =
  | 'esp32_numerical_suite'
  | 'esp32_concurrency_numerics'
  | 'esp32_irregular_dt';

export type CampaignCondition = 'IDLE' | 'LOAD' | 'WIFI';

export type CampaignCommand = {
  sequence: number;
  repeat: number;
  condition: CampaignCondition;
  command: string;
};

export type CampaignPlan = {
  recipeId: CampaignRecipeId;
  repeats: number;
  periodUs: number;
  samples: number;
  freqHz?: number;
  commands: CampaignCommand[];
  boundary: string[];
};

export type CampaignObservation = {
  condition: CampaignCondition;
  repeat: number;
  value: number;
};

export type CampaignAggregate = {
  condition: CampaignCondition;
  n: number;
  mean: number;
  stddev: number;
  min: number;
  max: number;
};

const CONDITIONS: CampaignCondition[] = ['IDLE', 'LOAD', 'WIFI'];

function clampInteger(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.trunc(value)));
}

function assertFinitePositive(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be finite and > 0`);
  }
  return value;
}

function rotatedConditions(repeatIndex: number, allowWifi: boolean): CampaignCondition[] {
  const active = allowWifi ? CONDITIONS : CONDITIONS.slice(0, 2);
  const shift = repeatIndex % active.length;
  return [...active.slice(shift), ...active.slice(0, shift)];
}

function commandFor(
  recipeId: CampaignRecipeId,
  condition: CampaignCondition,
  periodUs: number,
  samples: number,
  freqHz?: number,
): string | null {
  if (recipeId === 'esp32_numerical_suite') {
    if (condition === 'IDLE') return `JITTER ${periodUs} ${samples}`;
    if (condition === 'LOAD') return `LOADJITTER ${periodUs} ${samples}`;
    return `WIFIJITTER ${periodUs} ${samples}`;
  }

  if (recipeId === 'esp32_concurrency_numerics') {
    if (condition === 'IDLE') return `JITTER ${periodUs} ${samples}`;
    if (condition === 'LOAD') return `LOADJITTER ${periodUs} ${samples}`;
    return null;
  }

  if (freqHz == null) throw new Error('freqHz is required for irregular-dt campaigns');
  return `IRREG ${periodUs} ${samples} ${freqHz} ${condition}`;
}

export function buildEsp32CampaignPlan(args: {
  recipeId: CampaignRecipeId;
  repeats?: number;
  periodUs?: number;
  samples?: number;
  freqHz?: number;
}): CampaignPlan {
  const repeats = clampInteger(args.repeats ?? 3, 1, 10);
  const periodUs = clampInteger(args.periodUs ?? 1000, 100, 1_000_000);
  const samples = clampInteger(args.samples ?? 1000, 20, 20_000);
  const freqHz = args.recipeId === 'esp32_irregular_dt'
    ? assertFinitePositive(args.freqHz ?? 17, 'freqHz')
    : undefined;

  const allowWifi = args.recipeId !== 'esp32_concurrency_numerics';
  const commands: CampaignCommand[] = [];
  let sequence = 0;

  for (let repeat = 0; repeat < repeats; repeat += 1) {
    // Rotate condition order between repeats instead of always running IDLE first.
    // This reduces simple first-to-last environmental drift bias while remaining deterministic.
    for (const condition of rotatedConditions(repeat, allowWifi)) {
      const command = commandFor(args.recipeId, condition, periodUs, samples, freqHz);
      if (!command) continue;
      commands.push({
        sequence: sequence++,
        repeat: repeat + 1,
        condition,
        command,
      });
    }
  }

  return {
    recipeId: args.recipeId,
    repeats,
    periodUs,
    samples,
    freqHz,
    commands,
    boundary: [
      'Campaign order is deterministic and condition-rotated; it is not randomized/blinded experimental design.',
      'IDLE is a runtime baseline, not an externally calibrated reference.',
      'LOAD and WIFI effects are specific to the tested board, firmware build, and environment.',
      'Comparisons are meaningful only when period/sample/frequency parameters match.',
    ],
  };
}

export function aggregateCampaignObservations(observations: CampaignObservation[]): CampaignAggregate[] {
  const groups = new Map<CampaignCondition, number[]>();
  for (const observation of observations) {
    if (!Number.isFinite(observation.value)) continue;
    const values = groups.get(observation.condition) ?? [];
    values.push(observation.value);
    groups.set(observation.condition, values);
  }

  return CONDITIONS.flatMap(condition => {
    const values = groups.get(condition) ?? [];
    if (!values.length) return [];
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const variance = values.length > 1
      ? values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1)
      : 0;
    return [{
      condition,
      n: values.length,
      mean,
      stddev: Math.sqrt(variance),
      min: Math.min(...values),
      max: Math.max(...values),
    }];
  });
}

export function ratioVsIdle(aggregates: CampaignAggregate[], condition: Exclude<CampaignCondition, 'IDLE'>): number | null {
  const idle = aggregates.find(item => item.condition === 'IDLE');
  const target = aggregates.find(item => item.condition === condition);
  if (!idle || !target || idle.mean === 0 || !Number.isFinite(idle.mean) || !Number.isFinite(target.mean)) return null;
  return target.mean / idle.mean;
}
