import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { invoke } from '@tauri-apps/api/core';

export type BoardPort = { port: string; protocol: string; board_name?: string; fqbn?: string };
export type BoardProfile = { id: string; label: string; fqbn: string; core: string; default_baud: number; notes: string[] };
export type HardwareDiagnosisCode =
  | 'scanning'
  | 'scan-failed'
  | 'no-board'
  | 'system-ports-only'
  | 'profile-catalog-failed'
  | 'board-unidentified'
  | 'profile-mismatch'
  | 'ready';
export type HardwareDiagnosis = {
  code: HardwareDiagnosisCode;
  severity: 'info' | 'warning' | 'error' | 'success';
  title: string;
  detail: string;
  action: string;
  canCompile: boolean;
  canUpload: boolean;
};

type HardwareSessionValue = {
  ports: BoardPort[];
  profiles: BoardProfile[];
  selectedPort: string;
  setSelectedPort: (value: string) => void;
  fqbn: string;
  setFqbn: (value: string) => void;
  activePort?: BoardPort;
  hardwareStatus: string;
  diagnosis: HardwareDiagnosis;
  refreshing: boolean;
  refreshHardware: () => Promise<string>;
};

const HardwareSessionContext = createContext<HardwareSessionValue | null>(null);
const NO_BOARD_RESCAN_MS = 3500;
const CONNECTED_BOARD_RESCAN_MS = 8000;

const SYSTEM_SERIAL_NAMES = [
  'bluetooth-incoming-port',
  'debug-console',
  'wireless',
  'incoming-port',
];

function isLikelyPhysicalBoardPort(port: BoardPort) {
  const path = port.port.toLowerCase();
  const name = (port.board_name ?? '').toLowerCase();
  if (SYSTEM_SERIAL_NAMES.some(token => path.includes(token) || name.includes(token))) return false;
  if (port.fqbn) return true;
  return /usb|wch|slab|serial|modem|acm|ttyusb|cu\./i.test(port.port);
}

function onlySystemPorts(rawPorts: BoardPort[]) {
  return rawPorts.length > 0 && rawPorts.every(port => !isLikelyPhysicalBoardPort(port));
}

function noBoardDiagnostic(rawPorts: BoardPort[]) {
  if (!rawPorts.length) {
    return 'No serial devices reported by Arduino CLI · check the USB data cable, connector, hub, and driver · BetterBoard will keep watching for a board';
  }
  if (onlySystemPorts(rawPorts)) {
    return 'No USB serial board detected · only macOS system ports are visible · check the USB data cable/connector · BetterBoard will reconnect automatically when a board appears';
  }
  return 'No usable USB serial board detected · reconnect with a known data cable · BetterBoard will keep scanning automatically';
}

export function HardwareSessionProvider({ children }: { children: ReactNode }) {
  const [ports, setPorts] = useState<BoardPort[]>([]);
  const [profiles, setProfiles] = useState<BoardProfile[]>([]);
  const [selectedPort, setSelectedPort] = useState('');
  const [fqbn, setFqbn] = useState('arduino:avr:uno');
  const [hardwareStatus, setHardwareStatus] = useState('Detecting hardware…');
  const [refreshing, setRefreshing] = useState(false);
  const [rawPorts, setRawPorts] = useState<BoardPort[]>([]);
  const [scanError, setScanError] = useState('');
  const [profileError, setProfileError] = useState('');
  const refreshInFlight = useRef<Promise<string> | null>(null);

  function refreshHardware(): Promise<string> {
    // Root, Studio, focus recovery, and background hot-plug polling can all ask
    // for a refresh. Coalesce them into one board_list / board_profiles operation.
    if (refreshInFlight.current) return refreshInFlight.current;

    const operation = (async () => {
      setRefreshing(true);
      setHardwareStatus('Detecting USB serial devices and board profiles…');
      try {
        const [portsResult, profilesResult] = await Promise.allSettled([
          invoke<BoardPort[]>('board_list'),
          invoke<BoardProfile[]>('board_profiles'),
        ]);
        const status: string[] = [];
        let boardPorts: BoardPort[] = [];
        let boardProfiles: BoardProfile[] = [];

        if (portsResult.status === 'fulfilled') {
          const discovered = portsResult.value;
          setRawPorts(discovered);
          setScanError('');
          boardPorts = discovered.filter(isLikelyPhysicalBoardPort);
          setPorts(boardPorts);
          setSelectedPort(current => {
            if (current && boardPorts.some(port => port.port === current)) return current;
            return boardPorts[0]?.port ?? '';
          });
          status.push(boardPorts.length
            ? `${boardPorts.length} USB serial board(s) detected`
            : noBoardDiagnostic(discovered));
        } else {
          // A failed physical scan must revoke a stale non-empty selectedPort;
          // otherwise compile/upload controls could continue targeting old hardware.
          setRawPorts([]);
          setPorts([]);
          setSelectedPort('');
          const message = String(portsResult.reason);
          setScanError(message);
          status.push(`Hardware scan failed: ${message}`);
        }

        if (profilesResult.status === 'fulfilled') {
          boardProfiles = profilesResult.value;
          setProfiles(boardProfiles);
          setProfileError('');
          const detectedFqbn = boardPorts.find(port =>
            port.fqbn && boardProfiles.some(profile => profile.fqbn === port.fqbn),
          )?.fqbn;
          const unidentifiedBoard = boardPorts.some(port => !port.fqbn);

          setFqbn(current => {
            if (detectedFqbn) return detectedFqbn;
            return boardProfiles.some(profile => profile.fqbn === current)
              ? current
              : (boardProfiles[0]?.fqbn ?? current);
          });

          if (detectedFqbn) {
            status.push(`profile matched automatically: ${detectedFqbn}`);
          } else if (boardPorts.length && unidentifiedBoard) {
            status.push(`${boardProfiles.length} board profile(s) available · board model was not identified automatically; choose the profile explicitly before compile/upload`);
          } else {
            status.push(`${boardProfiles.length} board profile(s) available`);
          }
        } else {
          setProfiles([]);
          const message = String(profilesResult.reason);
          setProfileError(message);
          status.push(`Board profile load failed: ${message}`);
        }

        const summary = status.join(' · ');
        setHardwareStatus(summary);
        return summary;
      } finally {
        setRefreshing(false);
      }
    })();

    refreshInFlight.current = operation;
    void operation.finally(() => {
      if (refreshInFlight.current === operation) refreshInFlight.current = null;
    });
    return operation;
  }

  // Initial discovery.
  useEffect(() => { void refreshHardware(); }, []);

  // Keep the hardware session live in both directions. Missing boards are polled
  // quickly so cable replacement recovers promptly; connected boards are still
  // checked at a lower cadence so hot-unplug is detected even if the app remains
  // focused the entire time. Coalescing prevents this timer from racing a manual
  // refresh or another lifecycle-triggered scan.
  useEffect(() => {
    const intervalMs = ports.length > 0 ? CONNECTED_BOARD_RESCAN_MS : NO_BOARD_RESCAN_MS;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refreshHardware();
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [ports.length]);

  // A board is often connected while BetterBoard is behind another app. Refresh
  // immediately when the window becomes active again instead of waiting for the
  // next polling interval.
  useEffect(() => {
    const onFocus = () => { void refreshHardware(); };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void refreshHardware();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  const activePort = useMemo(
    () => ports.find(port => port.port === selectedPort),
    [ports, selectedPort],
  );

  // Hardware Doctor is intentionally conservative: compile is permitted for an
  // explicitly selected catalog profile, but upload is blocked in the diagnosis
  // model when the physical target is missing or its detected FQBN disagrees.
  const diagnosis = useMemo<HardwareDiagnosis>(() => {
    if (refreshing && !ports.length) {
      return { code: 'scanning', severity: 'info', title: 'Scanning for hardware', detail: 'BetterBoard is checking Arduino CLI serial discovery and the board profile catalog.', action: 'Keep the board connected while discovery completes.', canCompile: Boolean(fqbn), canUpload: false };
    }
    if (scanError) {
      return { code: 'scan-failed', severity: 'error', title: 'USB scan failed', detail: scanError, action: 'Retry discovery. If the error repeats, check Arduino CLI and OS USB access.', canCompile: Boolean(fqbn), canUpload: false };
    }
    if (!ports.length) {
      if (onlySystemPorts(rawPorts)) {
        return { code: 'system-ports-only', severity: 'warning', title: 'No USB board detected', detail: 'Only operating-system serial ports are visible. This commonly happens with a charge-only/bad cable, loose connector, hub issue, or missing USB-serial driver.', action: 'Use a known data cable, reconnect the board, and let BetterBoard auto-scan.', canCompile: Boolean(fqbn), canUpload: false };
      }
      return { code: 'no-board', severity: 'warning', title: 'Waiting for a board', detail: 'Arduino CLI is not reporting a usable physical USB serial target.', action: 'Connect the board with a known data cable. BetterBoard will detect it automatically.', canCompile: Boolean(fqbn), canUpload: false };
    }
    if (profileError || !profiles.length) {
      return { code: 'profile-catalog-failed', severity: 'error', title: 'Board profiles unavailable', detail: profileError || 'The board profile catalog is empty.', action: 'Refresh BetterBoard before compiling or uploading.', canCompile: false, canUpload: false };
    }
    if (!activePort) {
      return { code: 'no-board', severity: 'warning', title: 'Select a connected board', detail: 'Physical boards are visible, but no active serial target is selected.', action: 'Select one of the detected serial devices.', canCompile: Boolean(fqbn), canUpload: false };
    }
    if (!activePort.fqbn) {
      return { code: 'board-unidentified', severity: 'warning', title: 'Board connected, model unknown', detail: `${activePort.port} is present, but Arduino CLI did not identify an exact FQBN.`, action: 'Choose the board profile explicitly before compiling or uploading.', canCompile: Boolean(fqbn), canUpload: Boolean(fqbn) };
    }
    if (activePort.fqbn !== fqbn) {
      return { code: 'profile-mismatch', severity: 'error', title: 'Detected board and selected profile disagree', detail: `Detected ${activePort.fqbn}, selected ${fqbn}.`, action: 'Use the detected profile or deliberately correct the target before upload.', canCompile: Boolean(fqbn), canUpload: false };
    }
    return { code: 'ready', severity: 'success', title: 'Hardware ready', detail: `${activePort.port} matches ${fqbn}.`, action: 'Ready to preflight, compile, upload, and monitor.', canCompile: true, canUpload: true };
  }, [refreshing, ports.length, rawPorts, scanError, profileError, profiles.length, activePort, fqbn]);

  return <HardwareSessionContext.Provider value={{
    ports, profiles, selectedPort, setSelectedPort, fqbn, setFqbn,
    activePort, hardwareStatus, diagnosis, refreshing, refreshHardware,
  }}>
    {children}
  </HardwareSessionContext.Provider>;
}

export function useHardwareSession() {
  const value = useContext(HardwareSessionContext);
  if (!value) throw new Error('useHardwareSession must be used inside HardwareSessionProvider');
  return value;
}
