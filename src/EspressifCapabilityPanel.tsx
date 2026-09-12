import { useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Cable, CheckCircle2, CircleAlert, Cpu, RefreshCw, ShieldCheck, Usb } from 'lucide-react';
import { useHardwareSession } from './HardwareSession';
import { configurationQuestions, describeHardware, HARDWARE_RESEARCH_SOURCES, parseFqbnOptions } from './HardwareKnowledge';

type CoreAudit = { core: string; installed: boolean; version?: string; evidence?: string };
type BoardDetailOption = {
  id: string;
  label: string;
  selectedValue?: string;
  selectedLabel?: string;
  valueCount: number;
};
type BoardDetailsAudit = {
  fqbn?: string;
  name?: string;
  version?: string;
  official?: boolean;
  options: BoardDetailOption[];
  buildPropertyCount: number;
  identificationSetCount: number;
};

function coreFromFqbn(fqbn: string) {
  const [vendor = '', arch = ''] = fqbn.split(':');
  return vendor && arch ? `${vendor}:${arch}` : fqbn;
}

function recordOf(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function stringField(record: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return undefined;
}

function findCoreRecord(value: unknown, core: string): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    for (const item of value) { const found = findCoreRecord(item, core); if (found) return found; }
    return null;
  }
  const record = recordOf(value);
  if (!record) return null;
  const identifiers = [record.id, record.ID, record.platform, record.core, record.package, record.name]
    .filter((item): item is string => typeof item === 'string');
  if (identifiers.some(item => item === core || item.includes(core))) return record;
  for (const child of Object.values(record)) { const found = findCoreRecord(child, core); if (found) return found; }
  return null;
}

function coreAuditFromCli(raw: unknown, core: string): CoreAudit {
  const record = findCoreRecord(raw, core);
  if (!record) return { core, installed: false, evidence: 'Not present in Arduino CLI installed-core inventory.' };
  const version = [record.installed, record.installed_version, record.version, record.Version]
    .find((value): value is string => typeof value === 'string' && value.trim().length > 0);
  return { core, installed: true, version, evidence: version ? `Arduino CLI reports installed version ${version}.` : 'Arduino CLI reports this core as installed.' };
}

function parseBoardDetails(raw: unknown): BoardDetailsAudit {
  const record = recordOf(raw) ?? {};
  const configOptions = Array.isArray(record.config_options) ? record.config_options : [];
  const options = configOptions.flatMap(item => {
    const option = recordOf(item);
    if (!option) return [];
    const id = stringField(option, 'option', 'id') || 'unknown-option';
    const label = stringField(option, 'option_label', 'label', 'name') || id;
    const values = Array.isArray(option.values) ? option.values : [];
    let selectedValue: string | undefined;
    let selectedLabel: string | undefined;
    for (const itemValue of values) {
      const valueRecord = recordOf(itemValue);
      if (!valueRecord || valueRecord.selected !== true) continue;
      selectedValue = stringField(valueRecord, 'value', 'id');
      selectedLabel = stringField(valueRecord, 'value_label', 'label', 'name') || selectedValue;
      break;
    }
    return [{ id, label, selectedValue, selectedLabel, valueCount: values.length }];
  });
  return {
    fqbn: stringField(record, 'fqbn'),
    name: stringField(record, 'name'),
    version: stringField(record, 'version'),
    official: typeof record.official === 'boolean' ? record.official : undefined,
    options,
    buildPropertyCount: Array.isArray(record.build_properties) ? record.build_properties.length : 0,
    identificationSetCount: Array.isArray(record.identification_properties) ? record.identification_properties.length : 0,
  };
}

function evidenceForQuestion(id: string, options: BoardDetailOption[]) {
  const patterns: Record<string, RegExp> = {
    flash: /flash.*(size|memory)/i,
    'flash-mode': /flash.*(mode|freq|frequency)/i,
    partition: /partition/i,
    psram: /psram|external.*ram/i,
    'usb-mode': /usb|cdc|dfu/i,
    upload: /upload.*(speed|mode|transport)|programmer/i,
    cpu: /cpu.*(freq|frequency)/i,
  };
  const pattern = patterns[id];
  if (!pattern) return undefined;
  const match = options.find(option => pattern.test(`${option.id} ${option.label}`));
  if (!match) return undefined;
  const selected = match.selectedLabel || match.selectedValue;
  return selected ? `${match.label}: ${selected}` : `${match.label}: ${match.valueCount} option(s) exposed`;
}

export default function EspressifCapabilityPanel() {
  const { activePort, fqbn, profiles, diagnosis } = useHardwareSession();
  const capability = describeHardware(activePort, fqbn, profiles);
  const questions = configurationQuestions(capability);
  const isEspressif = capability.ecosystem === 'Espressif ESP32';
  const selectedOptions = useMemo(() => parseFqbnOptions(fqbn), [fqbn]);
  const expectedCore = useMemo(() => coreFromFqbn(fqbn), [fqbn]);
  const [coreAudit, setCoreAudit] = useState<CoreAudit>({ core: expectedCore, installed: false, evidence: 'Core inventory has not been inspected yet.' });
  const [coreAuditBusy, setCoreAuditBusy] = useState(false);
  const [coreAuditError, setCoreAuditError] = useState('');
  const [boardDetails, setBoardDetails] = useState<BoardDetailsAudit | null>(null);
  const [boardDetailsBusy, setBoardDetailsBusy] = useState(false);
  const [boardDetailsError, setBoardDetailsError] = useState('');

  const enrichedQuestions = useMemo(() => questions.map(item => {
    const evidence = boardDetails ? evidenceForQuestion(item.id, boardDetails.options) : undefined;
    const targetResolved = item.state === 'known-from-target' || (item.state === 'needs-board-details' && Boolean(evidence));
    return { ...item, evidence, targetResolved };
  }), [questions, boardDetails]);
  const unresolved = enrichedQuestions.filter(item => !item.targetResolved).length;
  const highImpactUnresolved = enrichedQuestions.filter(item => !item.targetResolved && item.severity === 'high').length;

  async function refreshCoreAudit() {
    setCoreAuditBusy(true); setCoreAuditError('');
    try { setCoreAudit(coreAuditFromCli(await invoke<unknown>('arduino_core_list'), expectedCore)); }
    catch (error) {
      setCoreAudit({ core: expectedCore, installed: false, evidence: 'Arduino CLI core inventory could not be read.' });
      setCoreAuditError(String(error));
    } finally { setCoreAuditBusy(false); }
  }

  async function refreshBoardDetails() {
    setBoardDetailsBusy(true); setBoardDetailsError('');
    try { setBoardDetails(parseBoardDetails(await invoke<unknown>('arduino_board_details', { fqbn }))); }
    catch (error) {
      setBoardDetails(null);
      setBoardDetailsError(String(error));
    } finally { setBoardDetailsBusy(false); }
  }

  useEffect(() => { void refreshCoreAudit(); void refreshBoardDetails(); }, [expectedCore, fqbn]);

  return <section className="panel" style={{ maxWidth: 1420, margin: '14px auto 50px' }}>
    <div className="panel-title"><Cpu size={18}/> Hardware capability research</div>
    <p className="muted">This view separates detected evidence, Arduino target metadata, and board-specific unknowns. USB bridge identity alone is never treated as proof of an exact MCU or board revision.</p>

    <div className="engineering-model-grid">
      <article className="panel"><div className="panel-title"><Cpu size={17}/> Target identity</div><div className="observatory-facts">
        <span>Ecosystem</span><b>{capability.ecosystem}</b><span>Family</span><b>{capability.family}</b><span>Confidence</span><b>{capability.identificationConfidence}</b>
        <span>Selected FQBN</span><b>{fqbn}</b><span>Detected FQBN</span><b>{activePort?.fqbn || 'not reported by Arduino CLI'}</b>
      </div></article>

      <article className="panel"><div className="panel-title"><Usb size={17}/> USB transport</div><p>{capability.usbCapability}</p><div className="boundary compact"><Cable size={14}/>{activePort?.port || 'No active physical serial port selected.'}</div></article>

      <article className="panel"><div className="panel-title"><ShieldCheck size={17}/> Electrical boundary</div><p>{capability.logicVoltage}</p>{isEspressif && <div className="boundary compact"><ShieldCheck size={14}/> BetterBoard will not infer safe GPIO pins, 5 V tolerance, flash wiring, PSRAM wiring or power limits from a generic ESP32 profile.</div>}</article>

      <article className="panel"><div className="panel-title"><ShieldCheck size={17}/> Programming gate</div><div className="observatory-facts">
        <span>Hardware Doctor</span><b>{diagnosis.title}</b><span>Compile</span><b>{diagnosis.canCompile ? 'allowed' : 'blocked'}</b><span>Upload</span><b>{diagnosis.canUpload ? 'allowed' : 'blocked'}</b>
        <span>Unresolved configuration</span><b>{unresolved}</b><span>High-impact unresolved</span><b>{highImpactUnresolved}</b>
      </div><div className="boundary compact"><ShieldCheck size={14}/>{diagnosis.action}</div></article>
    </div>

    <div className="panel" style={{ marginTop: 12 }}>
      <div className="panel-title"><Cpu size={17}/> Installed Arduino core audit <button className="ghost" disabled={coreAuditBusy} onClick={() => void refreshCoreAudit()}><RefreshCw size={14}/> Refresh</button></div>
      <div className="observatory-facts"><span>Required core</span><b>{expectedCore}</b><span>Installed</span><b>{coreAudit.installed ? 'yes' : 'not confirmed'}</b><span>Installed version</span><b>{coreAudit.version || '—'}</b><span>Evidence</span><b>{coreAudit.evidence || '—'}</b></div>
      {coreAuditError && <div className="boundary compact"><CircleAlert size={14}/> Core inventory inspection failed: {coreAuditError}</div>}
      {!coreAudit.installed && !coreAuditError && <div className="boundary compact"><CircleAlert size={14}/> The selected target can still describe hardware capabilities, but compile/upload readiness requires the matching Arduino core to be installed.</div>}
    </div>

    <div className="panel" style={{ marginTop: 12 }}>
      <div className="panel-title"><Cpu size={17}/> Arduino CLI board details <button className="ghost" disabled={boardDetailsBusy} onClick={() => void refreshBoardDetails()}><RefreshCw size={14}/> Inspect</button></div>
      {boardDetails ? <>
        <div className="observatory-facts">
          <span>Target name</span><b>{boardDetails.name || '—'}</b><span>Reported FQBN</span><b>{boardDetails.fqbn || '—'}</b>
          <span>Platform version</span><b>{boardDetails.version || '—'}</b><span>Official flag</span><b>{boardDetails.official === undefined ? '—' : boardDetails.official ? 'yes' : 'no / third-party'}</b>
          <span>Configuration menus</span><b>{boardDetails.options.length}</b><span>Build properties</span><b>{boardDetails.buildPropertyCount}</b><span>Identification sets</span><b>{boardDetails.identificationSetCount}</b>
        </div>
        {boardDetails.options.length ? <div className="observatory-mini-list">{boardDetails.options.map(option => <span key={option.id}><b>{option.label}</b><small>{option.selectedLabel || option.selectedValue || 'No selected/default value reported'} · {option.valueCount} choice(s)</small></span>)}</div> : <div className="boundary compact"><CircleAlert size={14}/> Arduino CLI reported no custom configuration menus for this target.</div>}
        <div className="boundary compact"><ShieldCheck size={14}/> Selected/default values here are Arduino target metadata from the installed platform. They are not proof that a physically connected third-party board actually has the corresponding flash, PSRAM, USB routing, or electrical characteristics.</div>
      </> : <div className="boundary compact"><CircleAlert size={14}/>{boardDetailsBusy ? 'Reading board details from Arduino CLI…' : 'No board-details snapshot is available yet.'}</div>}
      {boardDetailsError && <div className="boundary compact"><CircleAlert size={14}/> Board-details inspection failed: {boardDetailsError}</div>}
    </div>

    <div className="panel" style={{ marginTop: 12 }}>
      <div className="panel-title">Selected FQBN options</div>
      {selectedOptions.length
        ? <div className="observatory-mini-list">{selectedOptions.map(option => <span key={option.raw}><b>{option.id}{option.value ? ` = ${option.value}` : ''}</b><small>Explicitly encoded in the selected FQBN</small></span>)}</div>
        : <div className="boundary compact"><CircleAlert size={14}/> No explicit board-menu options are encoded in this FQBN. Arduino CLI defines FQBN options separately, so flash, partition, PSRAM and native-USB choices may still be defaults rather than known physical facts.</div>}
    </div>

    <div className="panel" style={{ marginTop: 12 }}>
      <div className="panel-title">Board configuration risk audit</div>
      <p className="muted">High severity means a wrong assumption can materially change identity, build layout, upload transport, runtime behavior or electrical safety. Board-details evidence can resolve target configuration questions, but it does not turn target metadata into a physical-board guarantee.</p>
      <div className="observatory-task-list">{enrichedQuestions.map(item => <div className={`observatory-task ${item.targetResolved ? 'done' : 'running'}`} key={item.id}>
        <span>{item.state === 'board-specific' ? 'BOARD-SPECIFIC' : item.targetResolved ? 'CLI DETAILS' : 'BOARD DETAILS'}</span>
        <b>{item.label}</b><small>{item.why}</small><small>Impact: {item.impact} · severity: {item.severity}</small>
        {item.evidence && <small>Arduino CLI evidence: {item.evidence}</small>}
        {item.targetResolved ? <CheckCircle2 size={14}/> : <CircleAlert size={14}/>} 
      </div>)}</div>
    </div>

    <div className="panel" style={{ marginTop: 12 }}>
      <div className="panel-title">Research basis</div>
      <p className="muted">The audit model follows first-party Arduino CLI and Espressif Arduino-ESP32 documentation rather than board-photo guesses or community defaults.</p>
      <div className="observatory-mini-list">{HARDWARE_RESEARCH_SOURCES.map(source => <span key={source.title}><b>{source.authority} · {source.title}</b><small>{source.scope}</small></span>)}</div>
    </div>

    <div className="panel" style={{ marginTop: 12 }}>
      <div className="panel-title">Read-only inspection policy</div>
      <div className="boundary compact"><ShieldCheck size={14}/> Automatic hardware research may inspect Arduino core inventory, board details, target metadata and read-only identity information, but it must not silently erase flash, change eFuses, write firmware, or alter board configuration.</div>
      <div className="boundary compact"><Usb size={14}/> Runtime serial baud and upload transport/speed are separate settings; BetterBoard should not infer one from the other.</div>
    </div>

    <div className="panel" style={{ marginTop: 12 }}><div className="panel-title">Current knowledge boundary</div>{capability.notes.map(note => <div className="boundary compact" key={note}><ShieldCheck size={14}/>{note}</div>)}</div>
  </section>;
}
