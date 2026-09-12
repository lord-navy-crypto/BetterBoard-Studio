import type { BoardPort, BoardProfile } from './HardwareSession';

export type HardwareCapability = {
  ecosystem: 'Arduino AVR' | 'Espressif ESP32' | 'Unknown';
  family: string;
  logicVoltage: string;
  usbCapability: string;
  identificationConfidence: 'detected' | 'selected-profile' | 'unknown';
  notes: string[];
};

export type ConfigurationQuestion = {
  id: string;
  label: string;
  why: string;
  state: 'known-from-target' | 'needs-board-details' | 'board-specific';
  impact: 'identity' | 'build' | 'upload' | 'runtime' | 'electrical';
  severity: 'low' | 'medium' | 'high';
};

export const HARDWARE_RESEARCH_SOURCES = [
  {
    authority: 'Arduino',
    title: 'Arduino CLI board details',
    scope: 'FQBN, board options, full board details and build properties are authoritative CLI metadata for an installed board platform.',
  },
  {
    authority: 'Arduino',
    title: 'Arduino CLI FAQ · FQBN and USB-serial identification',
    scope: 'FQBN may encode board-menu options; common USB-to-serial bridges do not uniquely identify the board behind them.',
  },
  {
    authority: 'Espressif',
    title: 'Arduino ESP32 Tools Menu',
    scope: 'Upload speed, CPU/flash frequency, flash mode/size, partition scheme, PSRAM and USB settings can materially affect ESP32 builds and flashing.',
  },
  {
    authority: 'Espressif',
    title: 'USB CDC and DFU Flashing',
    scope: 'Native USB-capable ESP32 variants can use different USB programming and runtime transports depending on board support and selected options.',
  },
] as const;

function espFamilyFromFqbn(fqbn: string) {
  const target = (fqbn.split(':')[2] ?? '').toLowerCase();
  if (target.includes('esp32s3')) return 'ESP32-S3';
  if (target.includes('esp32s2')) return 'ESP32-S2';
  if (target.includes('esp32c6')) return 'ESP32-C6';
  if (target.includes('esp32c3')) return 'ESP32-C3';
  if (target.includes('esp32h2')) return 'ESP32-H2';
  if (target === 'esp32' || target.includes('esp32dev')) return 'Classic ESP32';
  return 'ESP32 family';
}

function espUsbCapability(family: string) {
  if (family === 'Classic ESP32') {
    return 'Typically external USB-to-UART on development boards; USB identity may describe the bridge rather than the MCU.';
  }
  if (family === 'ESP32-S2' || family === 'ESP32-S3') {
    return 'The SoC supports native USB; a particular board may instead expose an external USB-to-UART bridge, so board routing still matters.';
  }
  if (['ESP32-C3', 'ESP32-C6', 'ESP32-H2'].includes(family)) {
    return 'USB Serial/JTAG capability exists on this SoC family; board routing and selected Arduino USB options still determine the active transport.';
  }
  return 'USB transport is board-specific; do not infer the MCU solely from a serial-port name.';
}

export function parseFqbnOptions(fqbn: string) {
  const optionText = fqbn.split(':').slice(3).join(':');
  if (!optionText) return [];
  return optionText.split(',').map(item => item.trim()).filter(Boolean).map(item => {
    const separator = item.indexOf('=');
    return separator > 0
      ? { id: item.slice(0, separator), value: item.slice(separator + 1), raw: item }
      : { id: item, value: '', raw: item };
  });
}

export function configurationQuestions(capability: HardwareCapability): ConfigurationQuestion[] {
  if (capability.ecosystem === 'Espressif ESP32') {
    const nativeUsbRelevant = capability.family !== 'Classic ESP32';
    return [
      {
        id: 'fqbn', label: 'Arduino target / FQBN',
        why: 'The target selects architecture, board definition and board-menu configuration exposed by the installed ESP32 core.',
        state: capability.identificationConfidence === 'detected' ? 'known-from-target' : 'needs-board-details',
        impact: 'identity', severity: 'high',
      },
      {
        id: 'flash-size', label: 'Flash size',
        why: 'Espressif documents that flash size must match the physical flash; a wrong value can invalidate partition choices.',
        state: 'needs-board-details', impact: 'build', severity: 'high',
      },
      {
        id: 'flash-mode', label: 'Flash mode / flash frequency',
        why: 'Flash bus mode and frequency depend on the memory device and board design; they are not serial-port properties.',
        state: 'needs-board-details', impact: 'runtime', severity: 'medium',
      },
      {
        id: 'partition', label: 'Partition scheme',
        why: 'Espressif warns that the partition layout must be compatible with flash size; an invalid selection can prevent normal runtime.',
        state: 'needs-board-details', impact: 'build', severity: 'high',
      },
      {
        id: 'psram', label: 'PSRAM configuration',
        why: 'Some modules include PSRAM and others do not; family identity alone does not prove presence, size or QSPI/OPI mode.',
        state: 'board-specific', impact: 'runtime', severity: 'high',
      },
      {
        id: 'usb-mode', label: 'USB mode / CDC / DFU on boot',
        why: nativeUsbRelevant
          ? 'Native-USB capable variants may expose CDC, DFU or USB Serial/JTAG paths depending on target options and board routing.'
          : 'Classic ESP32 normally reaches the MCU through an external USB-to-UART bridge; native-USB options should not be invented for it.',
        state: nativeUsbRelevant ? 'needs-board-details' : 'known-from-target', impact: 'upload', severity: nativeUsbRelevant ? 'high' : 'low',
      },
      {
        id: 'upload-speed', label: 'Upload transport and upload speed',
        why: 'Espressif treats upload speed as a flashing setting distinct from runtime serial baud; unstable bridges may require a lower flashing speed.',
        state: 'needs-board-details', impact: 'upload', severity: 'medium',
      },
      {
        id: 'cpu-frequency', label: 'CPU frequency',
        why: 'Espressif documents CPU frequency as a board/project option with clock and radio implications; BetterBoard should surface the selected value rather than invent one.',
        state: 'needs-board-details', impact: 'runtime', severity: 'medium',
      },
      {
        id: 'pins', label: 'Board-specific pin map and electrical limits',
        why: 'The SoC family does not prove which pins are broken out, reserved, connected to flash/PSRAM, or safe on a particular development board.',
        state: 'board-specific', impact: 'electrical', severity: 'high',
      },
    ];
  }

  if (capability.ecosystem === 'Arduino AVR') {
    return [
      {
        id: 'fqbn', label: 'Arduino target / FQBN',
        why: 'Compatible AVR boards can share USB-serial bridge identities while requiring different upload or processor options.',
        state: capability.identificationConfidence === 'detected' ? 'known-from-target' : 'needs-board-details', impact: 'identity', severity: 'high',
      },
      {
        id: 'processor', label: 'Processor / bootloader option',
        why: 'Classic Nano-compatible boards can differ in processor or bootloader upload settings even when the board shape looks similar.',
        state: 'board-specific', impact: 'upload', severity: 'high',
      },
      {
        id: 'pins', label: 'Voltage and pin map',
        why: 'Electrical limits must come from the exact board documentation rather than a USB bridge name.',
        state: 'board-specific', impact: 'electrical', severity: 'high',
      },
    ];
  }

  return [{
    id: 'identity', label: 'Exact board identity',
    why: 'BetterBoard has insufficient evidence to make MCU, electrical or upload-option claims.',
    state: 'board-specific', impact: 'identity', severity: 'high',
  }];
}

export function describeHardware(activePort: BoardPort | undefined, fqbn: string, profiles: BoardProfile[]): HardwareCapability {
  const detectedFqbn = activePort?.fqbn ?? '';
  const effectiveFqbn = detectedFqbn || fqbn;
  const selected = profiles.find(profile => profile.fqbn === fqbn);
  const identificationConfidence: HardwareCapability['identificationConfidence'] = detectedFqbn ? 'detected' : activePort ? 'selected-profile' : 'unknown';

  if (effectiveFqbn.startsWith('esp32:')) {
    const family = espFamilyFromFqbn(effectiveFqbn);
    return {
      ecosystem: 'Espressif ESP32', family,
      logicVoltage: '3.3 V GPIO logic; pin safety and power limits are board-specific.',
      usbCapability: espUsbCapability(family), identificationConfidence,
      notes: [
        ...(selected?.notes ?? []),
        detectedFqbn
          ? `Arduino CLI reported ${detectedFqbn}. This identifies an Arduino target candidate, not every physical board revision detail.`
          : 'Arduino CLI did not provide an exact FQBN, so BetterBoard is describing the explicitly selected profile rather than claiming automatic identification.',
        'Flash size, partition scheme, PSRAM, USB mode and upload options can be board-specific and should be read from board details before BetterBoard treats them as known.',
        'Read-only inspection should be the default. Hardware research must not silently erase flash, alter eFuses or write configuration to the target.',
      ],
    };
  }

  if (effectiveFqbn.startsWith('arduino:avr:')) {
    return {
      ecosystem: 'Arduino AVR', family: selected?.label ?? activePort?.board_name ?? 'AVR board',
      logicVoltage: 'Voltage depends on the exact board; do not infer electrical limits from the serial-port name.',
      usbCapability: 'Many classic Arduino/compatible boards use a USB-to-serial interface; clones may enumerate under bridge-chip names.',
      identificationConfidence,
      notes: [...(selected?.notes ?? []), 'USB VID/PID or serial-bridge identity is not sufficient to uniquely identify many compatible AVR boards.'],
    };
  }

  return {
    ecosystem: 'Unknown', family: activePort?.board_name || 'Unknown target',
    logicVoltage: 'Unknown — verify the board documentation before wiring GPIO.',
    usbCapability: 'Unknown — inspect the board documentation and the actual USB interface.',
    identificationConfidence,
    notes: ['BetterBoard intentionally avoids guessing electrical or MCU details from a generic serial device name.'],
  };
}
