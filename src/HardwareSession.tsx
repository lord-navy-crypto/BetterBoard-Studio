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
  refreshHardware: () => Promise<void>;
};

const HardwareSessionContext = createContext<HardwareSessionValue | null>(null);

export function HardwareSessionProvider({ children }: { children: ReactNode }) {
  const [ports, setPorts] = useState<BoardPort[]>([]);
  const [profiles, setProfiles] = useState<BoardProfile[]>([]);
  const [selectedPort, setSelectedPort] = useState('');
  const [fqbn, setFqbn] = useState('arduino:avr:uno');
  const [hardwareStatus, setHardwareStatus] = useState('Detecting hardware…');
  const [refreshing, setRefreshing] = useState(false);
  const refreshInFlight = useRef<Promise<void> | null>(null);

  function refreshHardware(): Promise<void> {
    // Root and Studio can request a refresh at the same time during startup.
    // Coalesce those requests so board_list / board_profiles are not raced or
    // multiplied by React StrictMode development mounts.
    if (refreshInFlight.current) return refreshInFlight.current;

    const operation = (async () => {
      setRefreshing(true);
      setHardwareStatus('Detecting USB serial devices and board profiles…');
      try {
        const [boardPorts, boardProfiles] = await Promise.all([
          invoke<BoardPort[]>('board_list'),
          invoke<BoardProfile[]>('board_profiles'),
        ]);
        setPorts(boardPorts);
        setProfiles(boardProfiles);
        setSelectedPort(current => {
          if (current && boardPorts.some(port => port.port === current)) return current;
          return boardPorts[0]?.port ?? '';
        });
        setFqbn(current => boardProfiles.some(profile => profile.fqbn === current)
          ? current
          : (boardProfiles[0]?.fqbn ?? current));
        setHardwareStatus(boardPorts.length
          ? `${boardPorts.length} serial device(s) detected`
          : 'No USB serial board detected');
      } catch (error) {
        setPorts([]);
        setHardwareStatus(`Hardware scan failed: ${error}`);
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
