import { useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Cable, CheckCircle2, CircleAlert, Cpu, RefreshCw, ShieldCheck, Usb } from 'lucide-react';
import { useHardwareSession } from './HardwareSession';
import { configurationQuestions, describeHardware } from './HardwareKnowledge';

type CoreAudit = {
  core: string;
  installed: boolean;
  version?: string;
  evidence?: string;
};

function coreFromFqbn(fqbn: string) {
  const [vendor = '', arch = ''] = fqbn.split(':');
  return vendor && arch ? `${vendor}:${arch}` : fqbn;
}

function findCoreRecord(value: unknown, core: string): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findCoreRecord(item, core);
      if (found) return found;
    }
    return null;
  }
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const identifiers = [record.id, record.ID, record.platform, record.core, record.package, record.name]
    .filter((item): item is string => typeof item === 'string');
  if (identifiers.some(item => item === core || item.includes(core))) return record;
  for (const child of Object.values(record)) {
    const found = findCoreRecord(child, core);
    if (found) return found;
  }
  return null;
}

function coreAuditFromCli(raw: unknown, core: string): CoreAudit {
  const record = findCoreRecord(raw, core);
  if (!record) return { core, installed: false, evidence: 'Not present in Arduino CLI installed-core inventory.' };
  const version = [record.installed, record.installed_version, record.version, record.Version]
    .find((value): value is string => typeof value === 'string' && value.trim().length > 0);
  return {
    core,
    installed: true,
    version,
    evidence: version ? `Arduino CLI reports installed version ${version}.` : 'Arduino CLI reports this core as installed.',
  };
}

function selectedFqbnOptions(fqbn: string) {
  const [, , , optionText] = fqbn.split(':');
  if (!optionText) return [];
  return optionText.split(',').map(item => item.trim()).filter(Boolean);
}

export default function EspressifCapabilityPanel() {
  const { activePort, fqbn, profiles, diagnosis } = useHardwareSession();
  const capability = describeHardware(activePort, fqbn, profiles);
  const questions = configurationQuestions(capability);
  const isEspressif = capability.ecosystem === 'Espressif ESP32';
  const unresolved = questions.filter(item => item.state !== 'known-from-target').length;
  const selectedOptions = useMemo(() => selectedFqbnOptions(fqbn), [fqbn]);
  const expectedCore = useMemo(() => coreFromFqbn(fqbn), [fqbn]);
  const [coreAudit, setCoreAudit] = useState<CoreAudit>({ core: expectedCore, installed: false, evidence: 'Core inventory has not been inspected yet.' });
  const [coreAuditBusy, setCoreAuditBusy] = useState(false);
  const [coreAuditError, setCoreAuditError] = useState('');

  async function refreshCoreAudit() {
    setCoreAuditBusy(true);
    setCoreAuditError('');
    try {
      const raw = await invoke<unknown>('arduino_core_list');
      setCoreAudit(coreAuditFromCli(raw, expectedCore));
    } catch (error) {
      setCoreAudit({ core: expectedCore, installed: false, evidence: 'Arduino CLI core inventory could not be read.' });
      setCoreAuditError(String(error));
    } finally {
      setCoreAuditBusy(false);
    }
  }

  useEffect(() => { void refreshCoreAudit(); }, [expectedCore]);

  return <section className="panel" style={{ maxWidth: 1420, margin: '14px auto 50px' }}>
    <div className="panel-title"><Cpu size={18}/> Hardware capability research</div>
    <p className="muted">This view separates what BetterBoard actually knows from what is only implied by the selected Arduino target. USB bridge identity alone is not treated as proof of an exact MCU or board revision.</p>

    <div className="engineering-model-grid">
      <article className="panel">
        <div className="panel-title"><Cpu size={17}/> Target identity</div>
        <div className="observatory-facts">
          <span>Ecosystem</span><b>{capability.ecosystem}</b>
          <span>Family</span><b>{capability.family}</b>
          <span>Confidence</span><b>{capability.identificationConfidence}</b>
          <span>Selected FQBN</span><b>{fqbn}</b>
          <span>Detected FQBN</span><b>{activePort?.fqbn || 'not reported by Arduino CLI'}</b>
        </div>
      </article>

      <article className="panel">
        <div className="panel-title"><Usb size={17}/> USB transport</div>
        <p>{capability.usbCapability}</p>
        <div className="boundary compact"><Cable size={14}/>{activePort?.port || 'No active physical serial port selected.'}</div>
      </article>

      <article className="panel">
        <div className="panel-title"><ShieldCheck size={17}/> Electrical boundary</div>
        <p>{capability.logicVoltage}</p>
        {isEspressif && <div className="boundary compact"><ShieldCheck size={14}/> BetterBoard will not infer safe GPIO pins, 5 V tolerance, flash wiring, PSRAM wiring or power limits from a generic ESP32 profile.</div>}
      </article>

      <article className="panel">
        <div className="panel-title"><ShieldCheck size={17}/> Programming gate</div>
        <div className="observatory-facts">
          <span>Hardware Doctor</span><b>{diagnosis.title}</b>
          <span>Compile</span><b>{diagnosis.canCompile ? 'allowed' : 'blocked'}</b>
          <span>Upload</span><b>{diagnosis.canUpload ? 'allowed' : 'blocked'}</b>
          <span>Unresolved configuration</span><b>{unresolved}</b>
        </div>
        <div className="boundary compact"><ShieldCheck size={14}/>{diagnosis.action}</div>
      </article>
    </div>

    <div className="panel" style={{ marginTop: 12 }}>
      <div className="panel-title"><Cpu size={17}/> Installed Arduino core audit <button className="ghost" disabled={coreAuditBusy} onClick={() => void refreshCoreAudit()}><RefreshCw size={14}/> Refresh</button></div>
      <div className="observatory-facts">
        <span>Required core</span><b>{expectedCore}</b>
        <span>Installed</span><b>{coreAudit.installed ? 'yes' : 'not confirmed'}</b>
        <span>Installed version</span><b>{coreAudit.version || '—'}</b>
        <span>Evidence</span><b>{coreAudit.evidence || '—'}</b>
      </div>
      {coreAuditError && <div className="boundary compact"><CircleAlert size={14}/> Core inventory inspection failed: {coreAuditError}</div>}
      {!coreAudit.installed && !coreAuditError && <div className="boundary compact"><CircleAlert size={14}/> The selected target can still describe hardware capabilities, but compile/upload readiness requires the matching Arduino core to be installed.</div>}
    </div>

    <div className="panel" style={{ marginTop: 12 }}>
      <div className="panel-title">Selected FQBN options</div>
      {selectedOptions.length
        ? <div className="observatory-mini-list">{selectedOptions.map(option => <span key={option}><b>{option}</b><small>Explicitly encoded in the selected FQBN</small></span>)}</div>
        : <div className="boundary compact"><CircleAlert size={14}/> No explicit board-menu options are encoded in this FQBN. Flash, partition, PSRAM and native-USB settings may therefore still depend on board defaults or future board-details inspection.</div>}
    </div>

    <div className="panel" style={{ marginTop: 12 }}>
      <div className="panel-title">Board configuration audit</div>
      <p className="muted">These are the target questions BetterBoard should resolve through Arduino board details and explicit board documentation before treating a generic target as fully characterized.</p>
      <div className="observatory-task-list">
        {questions.map(item => <div className={`observatory-task ${item.state === 'known-from-target' ? 'done' : 'running'}`} key={item.id}>
          <span>{item.state === 'known-from-target' ? 'KNOWN' : item.state === 'needs-board-details' ? 'BOARD DETAILS' : 'BOARD-SPECIFIC'}</span>
          <b>{item.label}</b>
          <small>{item.why}</small>
          {item.state === 'known-from-target' ? <CheckCircle2 size={14}/> : <CircleAlert size={14}/>} 
        </div>)}
      </div>
    </div>

    <div className="panel" style={{ marginTop: 12 }}>
      <div className="panel-title">Read-only inspection policy</div>
      <div className="boundary compact"><ShieldCheck size={14}/> Automatic hardware research may inspect Arduino core inventory, target metadata and read-only identity information, but it must not silently erase flash, change eFuses, write firmware, or alter board configuration.</div>
      <div className="boundary compact"><Usb size={14}/> Runtime serial baud and upload transport/speed are separate settings; BetterBoard should not infer one from the other.</div>
    </div>

    <div className="panel" style={{ marginTop: 12 }}>
      <div className="panel-title">Current knowledge boundary</div>
      {capability.notes.map(note => <div className="boundary compact" key={note}><ShieldCheck size={14}/>{note}</div>)}
    </div>
  </section>;
}
