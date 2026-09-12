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
    return 'No serial devices reported by Arduino CLI · check the USB data cable, connector, hub, and driver, then Refresh';
  }
  const systemOnly = rawPorts.every(port => !isLikelyPhysicalBoardPort(port));
  if (systemOnly) {
    return 'No USB serial board detected · only macOS system ports are visible · check the USB data cable/connector first, then Refresh';
  }
  return 'No usable USB serial board detected · reconnect the board with a known data cable, then Refresh';
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
    // Root and Studio can request a refresh at the same time during startup.
    // Coalesce those requests so board_list / board_profiles are not raced or
    // multiplied by React StrictMode development mounts. Every caller receives
    // the summary produced by this exact refresh operation.
    if (refreshInFlight.current) return refreshInFlight.current;

    const operation = (async () => {
      setRefreshing(true);
      setHardwareStatus('Detecting USB serial devices and board profiles…');
      try {
        // The physical-port scan and static board-profile catalog are independent
        // resources. Settle them independently so one failure never discards a
        // successful result from the other.
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
          // A failed scan must revoke the previous physical-port selection. A
          // stale non-empty selectedPort could otherwise leave Run / Upload armed.
          setPorts([]);
          setSelectedPort('');
          status.push(`Hardware scan failed: ${String(portsResult.reason)}`);
        }

        if (profilesResult.status === 'fulfilled') {
          boardProfiles = profilesResult.value;
          setProfiles(boardProfiles);
          const detectedFqbn = boardPorts.find(port => port.fqbn && boardProfiles.some(profile => profile.fqbn === port.fqbn))?.fqbn;
          setFqbn(current => {
            if (detectedFqbn) return detectedFqbn;
            return boardProfiles.some(profile => profile.fqbn === current)
              ? current
              : (boardProfiles[0]?.fqbn ?? current);
          });
          status.push(detectedFqbn
            ? `profile matched automatically: ${detectedFqbn}`
            : `${boardProfiles.length} board profile(s) available`);
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

  useEffect(() => { void refreshHardware(); }, []);

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
