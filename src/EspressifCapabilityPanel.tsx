import { Cable, Cpu, ShieldCheck, Usb } from 'lucide-react';
import { useHardwareSession } from './HardwareSession';
import { describeHardware } from './HardwareKnowledge';

export default function EspressifCapabilityPanel() {
  const { activePort, fqbn, profiles, diagnosis } = useHardwareSession();
  const capability = describeHardware(activePort, fqbn, profiles);
  const isEspressif = capability.ecosystem === 'Espressif ESP32';

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
        </div>
        <div className="boundary compact"><ShieldCheck size={14}/>{diagnosis.action}</div>
      </article>
    </div>

    <div className="panel" style={{ marginTop: 12 }}>
      <div className="panel-title">Configuration questions BetterBoard should validate</div>
      <ul className="compact-list">
        <li>Exact Arduino target/FQBN and installed core version.</li>
        <li>Flash size, flash mode, partition scheme and PSRAM options when the target exposes them.</li>
        <li>USB mode / CDC-on-boot options on ESP32 variants that support native USB.</li>
        <li>Upload transport and upload speed separately from runtime serial-monitor baud.</li>
        <li>Whether a serial bridge identifies only the USB-UART chip rather than the MCU behind it.</li>
      </ul>
    </div>

    <div className="panel" style={{ marginTop: 12 }}>
      <div className="panel-title">Current knowledge boundary</div>
      {capability.notes.map(note => <div className="boundary compact" key={note}><ShieldCheck size={14}/>{note}</div>)}
    </div>
  </section>;
}
