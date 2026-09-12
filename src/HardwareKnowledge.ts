import type { BoardPort, BoardProfile } from './HardwareSession';

export type HardwareCapability = {
  ecosystem: 'Arduino AVR' | 'Espressif ESP32' | 'Unknown';
  family: string;
  logicVoltage: string;
  usbCapability: string;
  identificationConfidence: 'detected' | 'selected-profile' | 'unknown';
  notes: string[];
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
    return 'Native USB is supported by the SoC; a particular board may instead expose an external USB-to-UART bridge.';
  }
  if (['ESP32-C3', 'ESP32-C6', 'ESP32-H2'].includes(family)) {
    return 'USB Serial/JTAG capability exists on this SoC family; board routing and selected Arduino USB options still determine the active transport.';
  }
  return 'USB transport is board-specific; do not infer the MCU solely from a serial-port name.';
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
          ? `Arduino CLI reported ${detectedFqbn}. This identifies the selected Arduino target, not every physical board revision detail.`
          : 'Arduino CLI did not provide an exact FQBN, so BetterBoard is describing the explicitly selected profile rather than claiming automatic identification.',
        'Flash size, partition scheme, PSRAM, USB mode and upload options can be board-specific and should be validated before programming.',
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
