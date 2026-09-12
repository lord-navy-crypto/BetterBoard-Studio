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
};

function espFamilyFromFqbn(fqbn: string) {
  const parts = fqbn.split(':');
  const target = (parts[parts.length - 1] ?? '').toLowerCase();
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

export function configurationQuestions(capability: HardwareCapability): ConfigurationQuestion[] {
  if (capability.ecosystem === 'Espressif ESP32') {
    const nativeUsbRelevant = capability.family !== 'Classic ESP32';
    return [
      {
        id: 'fqbn',
        label: 'Arduino target / FQBN',
        why: 'The target selects the architecture, board definition and the configuration menu exposed by the installed ESP32 core.',
        state: capability.identificationConfidence === 'detected' ? 'known-from-target' : 'needs-board-details',
      },
      {
        id: 'flash',
        label: 'Flash size and flash mode',
        why: 'Generic ESP32 profiles can represent boards with different flash hardware; BetterBoard should read the target options instead of assuming a size.',
        state: 'needs-board-details',
      },
      {
        id: 'partition',
        label: 'Partition scheme',
        why: 'Partition layout changes the space reserved for the application and filesystems and is a compile/upload target option rather than a serial-port property.',
        state: 'needs-board-details',
      },
      {
        id: 'psram',
        label: 'PSRAM configuration',
        why: 'Some ESP32 boards include external PSRAM and others do not; a generic family name is not sufficient evidence that PSRAM is present.',
        state: 'board-specific',
      },
      {
        id: 'usb-mode',
        label: 'USB mode / CDC-on-boot',
        why: nativeUsbRelevant
          ? 'Native-USB capable variants can expose different runtime and programming transports depending on the Arduino board options and board wiring.'
          : 'Classic ESP32 normally reaches the MCU through an external USB-to-UART bridge, so native USB options should not be invented for it.',
        state: nativeUsbRelevant ? 'needs-board-details' : 'known-from-target',
      },
      {
        id: 'upload',
        label: 'Upload transport and upload speed',
        why: 'Programming transport is distinct from the runtime Serial Monitor baud rate and should be validated independently.',
        state: 'needs-board-details',
      },
      {
        id: 'pins',
        label: 'Board-specific pin map and electrical limits',
        why: 'The SoC family does not prove which pins are broken out, reserved, connected to flash/PSRAM, or safe on a particular development board.',
        state: 'board-specific',
      },
    ];
  }

  if (capability.ecosystem === 'Arduino AVR') {
    return [
      {
        id: 'fqbn',
        label: 'Arduino target / FQBN',
        why: 'Compatible AVR boards can share USB-serial bridge identities while requiring different upload or processor options.',
        state: capability.identificationConfidence === 'detected' ? 'known-from-target' : 'needs-board-details',
      },
      {
        id: 'processor',
        label: 'Processor / bootloader option',
        why: 'Classic Nano-compatible boards can differ in processor or bootloader upload settings even when the board shape looks similar.',
        state: 'board-specific',
      },
      {
        id: 'pins',
        label: 'Voltage and pin map',
        why: 'Electrical limits must come from the exact board documentation rather than a USB bridge name.',
        state: 'board-specific',
      },
    ];
  }

  return [
    {
      id: 'identity',
      label: 'Exact board identity',
      why: 'BetterBoard has insufficient evidence to make MCU, electrical or upload-option claims.',
      state: 'board-specific',
    },
  ];
}

export function describeHardware(activePort: BoardPort | undefined, fqbn: string, profiles: BoardProfile[]): HardwareCapability {
  const detectedFqbn = activePort?.fqbn ?? '';
  const effectiveFqbn = detectedFqbn || fqbn;
  const selected = profiles.find(profile => profile.fqbn === fqbn);
  const identificationConfidence: HardwareCapability['identificationConfidence'] = detectedFqbn
    ? 'detected'
    : activePort
      ? 'selected-profile'
      : 'unknown';

  if (effectiveFqbn.startsWith('esp32:')) {
    const family = espFamilyFromFqbn(effectiveFqbn);
    return {
      ecosystem: 'Espressif ESP32',
      family,
      logicVoltage: '3.3 V GPIO logic; pin safety and power limits are board-specific.',
      usbCapability: espUsbCapability(family),
      identificationConfidence,
      notes: [
        ...(selected?.notes ?? []),
        detectedFqbn
          ? `Arduino CLI reported ${detectedFqbn}. This identifies the Arduino target candidate, not every physical board revision detail.`
          : 'Arduino CLI did not provide an exact FQBN, so BetterBoard is describing the explicitly selected profile rather than claiming automatic identification.',
        'Flash size, partition scheme, PSRAM, USB mode and upload options can be board-specific and should be read from board details before BetterBoard treats them as known.',
        'Read-only inspection should be the default. Hardware research must not silently erase flash, alter eFuses or write configuration to the target.',
      ],
    };
  }

  if (effectiveFqbn.startsWith('arduino:avr:')) {
    return {
      ecosystem: 'Arduino AVR',
      family: selected?.label ?? activePort?.board_name ?? 'AVR board',
      logicVoltage: 'Voltage depends on the exact board; do not infer electrical limits from the serial-port name.',
      usbCapability: 'Many classic Arduino/compatible boards use a USB-to-serial interface; clones may enumerate under bridge-chip names.',
      identificationConfidence,
      notes: [
        ...(selected?.notes ?? []),
        'USB VID/PID or serial-bridge identity is not sufficient to uniquely identify many compatible AVR boards.',
      ],
    };
  }

  return {
    ecosystem: 'Unknown',
    family: activePort?.board_name || 'Unknown target',
    logicVoltage: 'Unknown — verify the board documentation before wiring GPIO.',
    usbCapability: 'Unknown — inspect the board documentation and the actual USB interface.',
    identificationConfidence,
    notes: ['BetterBoard intentionally avoids guessing electrical or MCU details from a generic serial device name.'],
  };
}
