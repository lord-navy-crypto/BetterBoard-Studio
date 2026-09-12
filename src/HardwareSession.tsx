import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { invoke } from '@tauri-apps/api/core';

export type BoardPort = { port: string; protocol: string; board_name?: string; fqbn?: string };
export type BoardProfile = { id: string; label: string; fqbn: string; core: string; default_baud: number; notes: string[] };

type HardwareSessionValue = {
  ports: BoardPort[];
  profiles: BoardProfile[];
  selectedPort: string;
  setSelectedPort: (value: string) => void;
  fqbn: string;
  setFqbn: (value: string) => void;
  activePort?: BoardPort;
  hardwareStatus: string;
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

function noBoardDiagnostic(rawPorts: BoardPort[]) {
  if (!rawPorts.length) {
    return 'No serial devices reported by Arduino CLI · check the USB data cable, connector, hub, and driver · BetterBoard will keep watching for a board';
  }
  const systemOnly = rawPorts.every(port => !isLikelyPhysicalBoardPort(port));
  if (systemOnly) {
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
          const rawPorts = portsResult.value;
          boardPorts = rawPorts.filter(isLikelyPhysicalBoardPort);
          setPorts(boardPorts);
          setSelectedPort(current => {
            if (current && boardPorts.some(port => port.port === current)) return current;
            return boardPorts[0]?.port ?? '';
          });
          status.push(boardPorts.length
            ? `${boardPorts.length} USB serial board(s) detected`
            : noBoardDiagnostic(rawPorts));
        } else {
          // A failed physical scan must revoke a stale non-empty selectedPort;
          // otherwise compile/upload controls could continue targeting old hardware.
          setPorts([]);
          setSelectedPort('');
          status.push(`Hardware scan failed: ${String(portsResult.reason)}`);
        }

        if (profilesResult.status === 'fulfilled') {
          boardProfiles = profilesResult.value;
          setProfiles(boardProfiles);
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
          status.push(`Board profile load failed: ${String(profilesResult.reason)}`);
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

  return <HardwareSessionContext.Provider value={{
    ports, profiles, selectedPort, setSelectedPort, fqbn, setFqbn,
    activePort, hardwareStatus, refreshing, refreshHardware,
  }}>
    {children}
  </HardwareSessionContext.Provider>;
}

export function useHardwareSession() {
  const value = useContext(HardwareSessionContext);
  if (!value) throw new Error('useHardwareSession must be used inside HardwareSessionProvider');
  return value;
}