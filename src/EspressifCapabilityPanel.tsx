import { Cable, CheckCircle2, CircleAlert, Cpu, ShieldCheck, Usb } from 'lucide-react';
import { useHardwareSession } from './HardwareSession';
import { configurationQuestions, describeHardware } from './HardwareKnowledge';

export default function EspressifCapabilityPanel() {
  const { activePort, fqbn, profiles, diagnosis } = useHardwareSession();
  const capability = describeHardware(activePort, fqbn, profiles);
  const questions = configurationQuestions(capability);
  const isEspressif = capability.ecosystem === 'Espressif ESP32';
  const unresolved = questions.filter(item => item.state !== 'known-from-target').length;

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
      <div className="boundary compact"><ShieldCheck size={14}/> Automatic hardware research may inspect target metadata and read-only identity information, but it must not silently erase flash, change eFuses, write firmware, or alter board configuration.</div>
      <div className="boundary compact"><Usb size={14}/> Runtime serial baud and upload transport/speed are separate settings; BetterBoard should not infer one from the other.</div>
    </div>

    <div className="panel" style={{ marginTop: 12 }}>
      <div className="panel-title">Current knowledge boundary</div>
      {capability.notes.map(note => <div className="boundary compact" key={note}><ShieldCheck size={14}/>{note}</div>)}
    </div>
  </section>;
}
