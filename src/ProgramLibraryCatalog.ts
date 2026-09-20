export type ProgramAssetKind = 'firmware' | 'analysis';

export type ProgramFamily =
  | 'Dedicated Engineering Lab'
  | 'Numerical Reliability'
  | 'ESP32 Research'
  | 'Sensor Suite'
  | 'BetterBoard Firmware'
  | 'Host Analysis & Bridges';

export type ProgramAsset = {
  key: string;
  label: string;
  path: string;
  loadSource: () => Promise<string>;
  kind: ProgramAssetKind;
  family: ProgramFamily;
  sketchName?: string;
};

const firmwareModules = import.meta.glob(
  [
    '../engineering-lab-experiments/firmware/**/*.ino',
    '../src-tauri/resources/firmware/**/*.ino',
    '../sensor-suite/firmware/**/*.ino',
    '../firmware/betterboard-core/examples/**/*.ino',
  ],
  { query: '?raw', import: 'default' },
) as Record<string, () => Promise<string>>;

const pythonModules = import.meta.glob(
  '../scripts/*.py',
  { query: '?raw', import: 'default' },
) as Record<string, () => Promise<string>>;

export const PROGRAM_FAMILY_ORDER: ProgramFamily[] = [
  'Dedicated Engineering Lab',
  'Numerical Reliability',
  'ESP32 Research',
  'Sensor Suite',
  'BetterBoard Firmware',
  'Host Analysis & Bridges',
];

function repositoryPath(modulePath: string) {
  return modulePath.replace(/^\.\.\//, '');
}

function filenameWithoutExtension(path: string) {
  const name = path.split('/').pop() ?? path;
  return name.replace(/\.[^.]+$/, '');
}

export function humanizeProgramName(value: string) {
  return value
    .replace(/^EL_/, '')
    .replace(/_/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
}

function firmwareFamily(path: string): ProgramFamily {
  if (path.includes('engineering-lab-experiments/firmware/')) return 'Dedicated Engineering Lab';
  if (path.includes('sensor-suite/firmware/')) return 'Sensor Suite';
  if (/\/ESP32[^/]*\//.test(path)) return 'ESP32 Research';
  if (/\/(NumericError_|Numerical|EmbeddedNumerical|MPU6050Numerics)/.test(path)) return 'Numerical Reliability';
  return 'BetterBoard Firmware';
}

function makeFirmwareAssets(): ProgramAsset[] {
  return Object.entries(firmwareModules).map(([modulePath, loadSource]) => {
    const path = repositoryPath(modulePath);
    const sketchName = filenameWithoutExtension(path);
    return {
      key: `asset:${path}`,
      label: humanizeProgramName(sketchName),
      path,
      loadSource,
      kind: 'firmware' as const,
      family: firmwareFamily(path),
      sketchName,
    };
  });
}

function makePythonAssets(): ProgramAsset[] {
  return Object.entries(pythonModules).map(([modulePath, loadSource]) => {
    const path = repositoryPath(modulePath);
    return {
      key: `asset:${path}`,
      label: humanizeProgramName(filenameWithoutExtension(path)),
      path,
      loadSource,
      kind: 'analysis' as const,
      family: 'Host Analysis & Bridges' as const,
    };
  });
}

export const ALL_PROGRAM_ASSETS: ProgramAsset[] = [...makeFirmwareAssets(), ...makePythonAssets()]
  .sort((a, b) => {
    const familyDelta = PROGRAM_FAMILY_ORDER.indexOf(a.family) - PROGRAM_FAMILY_ORDER.indexOf(b.family);
    return familyDelta || a.label.localeCompare(b.label);
  });

export async function loadProgramAsset(asset: ProgramAsset) {
  const source = await asset.loadSource();
  if (!source.trim()) throw new Error(`Source is empty: ${asset.path}`);
  return source;
}
