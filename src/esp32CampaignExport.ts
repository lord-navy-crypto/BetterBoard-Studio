import type { CampaignAggregate, CampaignPlan, CampaignRecipeId, CampaignCondition } from './esp32Campaign';
import type { CampaignProvenance } from './esp32Provenance';

export type CampaignCapturedRow = {
  host_timestamp_ms: number;
  line: string;
  numeric: boolean;
};

export type CampaignArchiveRun = {
  sequence: number;
  repeat: number;
  condition: CampaignCondition;
  command: string;
  status: 'ok' | 'error' | 'cancelled';
  primaryMetric: number | null;
  primaryLabel: string;
  rows: number;
  message?: string;
  startedAtUtc?: string;
  completedAtUtc?: string;
  captureLines: string[];
  capturedRows?: CampaignCapturedRow[];
};

export type CampaignArchiveInput = {
  recipeId: CampaignRecipeId;
  recipeTitle: string;
  fqbn: string;
  port: string;
  baud: number;
  plan: CampaignPlan;
  runs: CampaignArchiveRun[];
  aggregates: CampaignAggregate[];
  loadRatio: number | null;
  wifiRatio: number | null;
  provenance: CampaignProvenance | null;
};

function csvCell(value: unknown): string {
  const text = value == null ? '' : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function campaignSummaryCsv(input: CampaignArchiveInput): string {
  const header = [
    'sequence', 'repeat', 'condition', 'command', 'status', 'primary_metric', 'primary_label',
    'tagged_rows', 'started_at_utc', 'completed_at_utc', 'message', 'capture_line_count',
  ];
  const rows = input.runs.map(run => [
    run.sequence + 1,
    run.repeat,
    run.condition,
    run.command,
    run.status,
    run.primaryMetric,
    run.primaryLabel,
    run.rows,
    run.startedAtUtc ?? '',
    run.completedAtUtc ?? '',
    run.message ?? '',
    run.captureLines.length,
  ]);
  return [header, ...rows].map(row => row.map(csvCell).join(',')).join('\n') + '\n';
}

export function campaignComparatorCapture(input: CampaignArchiveInput): string {
  const blocks: string[] = [];
  blocks.push('#BETTERBOARD_CAMPAIGN_CAPTURE,v1');
  blocks.push(`#RECIPE,${input.recipeId}`);
  blocks.push(`#FQBN,${input.fqbn}`);
  blocks.push(`#PORT,${input.port}`);
  blocks.push(`#PERIOD_US,${input.plan.periodUs}`);
  blocks.push(`#SAMPLES,${input.plan.samples}`);
  if (input.plan.freqHz != null) blocks.push(`#FREQ_HZ,${input.plan.freqHz}`);
  if (input.provenance) {
    blocks.push(`#PROVENANCE_COLLECTED_AT_UTC,${input.provenance.collectedAtUtc}`);
    blocks.push(`#EXPECTED_SCHEMA_PREFIX,${input.provenance.expectedSchemaPrefix}`);
    if (input.provenance.observedSchema) blocks.push(`#OBSERVED_SCHEMA,${input.provenance.observedSchema}`);
    if (input.provenance.expectedFirmwareSha256) blocks.push(`#EXPECTED_FIRMWARE_SOURCE_SHA256,${input.provenance.expectedFirmwareSha256}`);
    for (const [key, value] of Object.entries(input.provenance.deviceInfo)) {
      blocks.push(`#DEVICE_${key},${value}`);
    }
  }

  for (const run of input.runs) {
    if (run.status !== 'ok') continue;
    blocks.push(`#BB_RUN_BEGIN,${run.sequence + 1},${run.repeat},${run.condition},${run.command}`);
    blocks.push(...run.captureLines);
    blocks.push(`#BB_RUN_END,${run.sequence + 1}`);
  }
  return blocks.join('\n') + '\n';
}

export function campaignArchiveJson(input: CampaignArchiveInput): string {
  const document = {
    schema: 'betterboard.esp32-campaign/1',
    exported_at_utc: new Date().toISOString(),
    producer: 'BetterBoard Studio 0.2.0-alpha.1',
    target: {
      fqbn: input.fqbn,
      port: input.port,
      baud: input.baud,
    },
    recipe: {
      id: input.recipeId,
      title: input.recipeTitle,
    },
    provenance: input.provenance,
    plan: input.plan,
    summary: {
      aggregates: input.aggregates,
      load_to_idle_ratio: input.loadRatio,
      wifi_to_idle_ratio: input.wifiRatio,
    },
    runs: input.runs.map(run => ({
      ...run,
      capturedRows: run.capturedRows ?? [],
    })),
    archival_files: {
      summary_csv: 'campaign_summary.csv',
      comparator_capture: 'condition_compare_capture.txt',
    },
    scientific_boundary: [
      'This archive records BetterBoard research-stage evidence; it is not a calibration certificate.',
      'IDLE is a runtime baseline, not an externally calibrated reference.',
      'LOAD/WIFI ratios are meaningful only for matched campaign parameters on the tested board/build/environment.',
      'Raw serial rows are preserved so stronger host analyzers can be rerun independently.',
      'The firmware SHA-256 in provenance identifies the source embedded in this BetterBoard build; it is not cryptographic attestation of the bytes currently flashed on the MCU.',
      'Observed INFO/SCHEMA output is runtime evidence from the connected device and is archived separately from host-side source identity.',
    ],
  };
  return JSON.stringify(document, null, 2) + '\n';
}

export function campaignBaseName(input: CampaignArchiveInput): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `betterboard-${input.recipeId}-${stamp}`;
}

export function downloadTextFile(filename: string, text: string, mime = 'text/plain;charset=utf-8'): void {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
