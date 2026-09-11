import type { CampaignRecipeId } from './esp32Campaign';

export type CliInfo = {
  found: boolean;
  path?: string | null;
  version?: string | null;
  error?: string | null;
};

export type DeviceInfoMap = Record<string, string>;

export type CampaignProvenance = {
  collectedAtUtc: string;
  recipeId: CampaignRecipeId;
  fqbn: string;
  port: string;
  expectedSchemaPrefix: string;
  observedSchema: string | null;
  schemaMatched: boolean;
  deviceInfo: DeviceInfoMap;
  infoLines: string[];
  schemaLines: string[];
  expectedFirmwareSha256: string | null;
  firmwareHashMeaning: 'host-embedded-source-sha256-not-device-attestation';
  arduinoCli: CliInfo | null;
  arduinoEsp32Version: string | null;
};

const EXPECTED_SCHEMA: Record<CampaignRecipeId, string> = {
  esp32_numerical_suite: 'betterboard-esp32-numerical-research-v',
  esp32_concurrency_numerics: 'betterboard-esp32-concurrency-numerics-v',
  esp32_irregular_dt: 'betterboard-esp32-irregular-dt-v',
};

export function expectedCampaignSchemaPrefix(recipeId: CampaignRecipeId): string {
  return EXPECTED_SCHEMA[recipeId];
}

export function parseInfoLines(lines: string[]): DeviceInfoMap {
  const info: DeviceInfoMap = {};
  let inside = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (line === '#INFO_BEGIN') {
      inside = true;
      continue;
    }
    if (line === '#INFO_END') {
      inside = false;
      continue;
    }
    if (!inside || !line.startsWith('#')) continue;
    const comma = line.indexOf(',');
    if (comma <= 1) continue;
    const key = line.slice(1, comma).trim();
    const value = line.slice(comma + 1).trim();
    if (key && value) info[key] = value;
  }
  return info;
}

export function observedSchema(lines: string[]): string | null {
  const line = lines.find(raw => raw.trim().startsWith('#SCHEMA,'));
  if (!line) return null;
  const value = line.trim().slice('#SCHEMA,'.length).trim();
  return value || null;
}

export function infoEnvelopeComplete(lines: string[]): boolean {
  return lines.some(line => line.trim() === '#INFO_BEGIN') && lines.some(line => line.trim() === '#INFO_END');
}

export async function sha256Text(text: string): Promise<string | null> {
  try {
    if (!globalThis.crypto?.subtle) return null;
    const bytes = new TextEncoder().encode(text);
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  } catch {
    return null;
  }
}

export function inferArduinoEsp32Version(info: DeviceInfoMap): string | null {
  return info.ARDUINO_ESP32_VERSION ?? info.ESP_ARDUINO_VERSION ?? info.CORE_VERSION ?? null;
}

export function provenanceDisplay(info: DeviceInfoMap): Array<{ label: string; value: string }> {
  const candidates: Array<[string, string]> = [
    ['Chip', info.CHIP_MODEL],
    ['Revision', info.CHIP_REVISION],
    ['Cores', info.CHIP_CORES],
    ['CPU', info.CPU_FREQ_MHZ ? `${info.CPU_FREQ_MHZ} MHz` : ''],
    ['PSRAM', info.PSRAM_FOUND != null ? (info.PSRAM_FOUND === '1' ? 'detected' : 'not detected') : (info.PSRAM_BYTES ? `${info.PSRAM_BYTES} bytes` : '')],
    ['Free heap', info.HEAP_FREE_BYTES ?? info.FREE_HEAP_BYTES ?? info.FREE_HEAP],
  ];
  return candidates.filter(([, value]) => Boolean(value)).map(([label, value]) => ({ label, value }));
}
