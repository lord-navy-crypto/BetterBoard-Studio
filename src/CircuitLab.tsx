import { useMemo, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, CircuitBoard, Clipboard, Eraser, Lightbulb,
  MousePointer2, Plus, RotateCcw, Save, ShieldCheck, Trash2, Unplug,
} from 'lucide-react';
import './circuitLab.css';

type Side = 'left' | 'right' | 'top' | 'bottom';
type PinRole = 'power' | 'ground' | 'analog-in' | 'digital-io' | 'pwm-io' | 'signal' | 'passive';
type ComponentKind = 'uno' | 'potentiometer' | 'led' | 'resistor' | 'button';
type Severity = 'error' | 'warning' | 'pass' | 'info';

type PinSpec = {
  id: string;
  label: string;
  role: PinRole;
  side: Side;
  offset: number;
  voltage?: number;
};

type ComponentSpec = {
  kind: ComponentKind;
  title: string;
  subtitle: string;
  width: number;
  height: number;
  pins: PinSpec[];
};

type PlacedComponent = {
  id: string;
  kind: ComponentKind;
  x: number;
  y: number;
};

type PinRef = { componentId: string; pinId: string };
type Wire = { id: string; from: PinRef; to: PinRef };
type Issue = { id: string; severity: Severity; title: string; detail: string };

type CircuitDesign = {
  schema: 'betterboard.circuit-design/0.1';
  name: string;
  components: PlacedComponent[];
  wires: Wire[];
};

type Props = {
  onUseRecipe?: (recipeId: string) => void;
};

const SPECS: Record<ComponentKind, ComponentSpec> = {
  uno: {
    kind: 'uno', title: 'Arduino UNO', subtitle: 'UNO-compatible board', width: 238, height: 174,
    pins: [
      { id: '5v', label: '5V', role: 'power', side: 'top', offset: 54, voltage: 5 },
      { id: '3v3', label: '3V3', role: 'power', side: 'top', offset: 112, voltage: 3.3 },
      { id: 'gnd', label: 'GND', role: 'ground', side: 'bottom', offset: 80 },
      { id: 'a0', label: 'A0', role: 'analog-in', side: 'left', offset: 54 },
      { id: 'a1', label: 'A1', role: 'analog-in', side: 'left', offset: 88 },
      { id: 'a2', label: 'A2', role: 'analog-in', side: 'left', offset: 122 },
      { id: 'd2', label: 'D2', role: 'digital-io', side: 'right', offset: 48 },
      { id: 'd3', label: 'D3~', role: 'pwm-io', side: 'right', offset: 82 },
      { id: 'd9', label: 'D9~', role: 'pwm-io', side: 'right', offset: 116 },
    ],
  },
  potentiometer: {
    kind: 'potentiometer', title: 'Potentiometer', subtitle: '3-pin analog input', width: 178, height: 126,
    pins: [
      { id: 'vcc', label: 'VCC', role: 'power', side: 'left', offset: 36 },
      { id: 'sig', label: 'SIG', role: 'signal', side: 'right', offset: 63 },
      { id: 'gnd', label: 'GND', role: 'ground', side: 'left', offset: 92 },
    ],
  },
  led: {
    kind: 'led', title: 'LED', subtitle: 'Indicator output', width: 150, height: 112,
    pins: [
      { id: 'anode', label: 'A +', role: 'passive', side: 'left', offset: 38 },
      { id: 'cathode', label: 'K −', role: 'passive', side: 'left', offset: 78 },
    ],
  },
  resistor: {
    kind: 'resistor', title: 'Resistor', subtitle: 'Series / pull element', width: 154, height: 92,
    pins: [
      { id: 'a', label: '1', role: 'passive', side: 'left', offset: 46 },
      { id: 'b', label: '2', role: 'passive', side: 'right', offset: 46 },
    ],
  },
  button: {
    kind: 'button', title: 'Push Button', subtitle: 'Digital contact', width: 154, height: 98,
    pins: [
      { id: 'a', label: 'A', role: 'passive', side: 'left', offset: 49 },
      { id: 'b', label: 'B', role: 'passive', side: 'right', offset: 49 },
    ],
  },
};

const blankDesign = (): CircuitDesign => ({
  schema: 'betterboard.circuit-design/0.1',
  name: 'Untitled circuit',
  components: [{ id: 'uno-1', kind: 'uno', x: 380, y: 230 }],
  wires: [],
});

const bench01Design = (): CircuitDesign => ({
  schema: 'betterboard.circuit-design/0.1',
  name: 'Bench 01 — Analog Control & Instrumentation',
  components: [
    { id: 'pot-1', kind: 'potentiometer', x: 80, y: 220 },
    { id: 'uno-1', kind: 'uno', x: 390, y: 190 },
    { id: 'res-1', kind: 'resistor', x: 720, y: 188 },
    { id: 'led-1', kind: 'led', x: 930, y: 178 },
  ],
  wires: [
    { id: 'w1', from: { componentId: 'uno-1', pinId: '5v' }, to: { componentId: 'pot-1', pinId: 'vcc' } },
    { id: 'w2', from: { componentId: 'uno-1', pinId: 'gnd' }, to: { componentId: 'pot-1', pinId: 'gnd' } },
    { id: 'w3', from: { componentId: 'pot-1', pinId: 'sig' }, to: { componentId: 'uno-1', pinId: 'a0' } },
    { id: 'w4', from: { componentId: 'uno-1', pinId: 'd9' }, to: { componentId: 'res-1', pinId: 'a' } },
    { id: 'w5', from: { componentId: 'res-1', pinId: 'b' }, to: { componentId: 'led-1', pinId: 'anode' } },
    { id: 'w6', from: { componentId: 'led-1', pinId: 'cathode' }, to: { componentId: 'uno-1', pinId: 'gnd' } },
  ],
});

function makeId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function samePin(a: PinRef, b: PinRef) {
  return a.componentId === b.componentId && a.pinId === b.pinId;
}

function wireHas(wire: Wire, ref: PinRef) {
  return samePin(wire.from, ref) || samePin(wire.to, ref);
}

function otherEnd(wire: Wire, ref: PinRef): PinRef | null {
  if (samePin(wire.from, ref)) return wire.to;
  if (samePin(wire.to, ref)) return wire.from;
  return null;
}

function findPin(components: PlacedComponent[], ref: PinRef) {
  const component = components.find(item => item.id === ref.componentId);
  if (!component) return null;
  const spec = SPECS[component.kind];
  const pin = spec.pins.find(item => item.id === ref.pinId);
  return pin ? { component, spec, pin } : null;
}

function refLabel(components: PlacedComponent[], ref: PinRef) {
  const found = findPin(components, ref);
  if (!found) return `${ref.componentId}.${ref.pinId}`;
  return `${found.spec.title} · ${found.pin.label}`;
}

function pinPoint(component: PlacedComponent, pin: PinSpec) {
  const spec = SPECS[component.kind];
  if (pin.side === 'left') return { x: component.x, y: component.y + pin.offset };
  if (pin.side === 'right') return { x: component.x + spec.width, y: component.y + pin.offset };
  if (pin.side === 'top') return { x: component.x + pin.offset, y: component.y };
  return { x: component.x + pin.offset, y: component.y + spec.height };
}

function runRuleChecker(components: PlacedComponent[], wires: Wire[]): Issue[] {
  const issues: Issue[] = [];
  const boards = components.filter(component => component.kind === 'uno');
  const connection = (ref: PinRef) => wires.filter(wire => wireHas(wire, ref));
  const peers = (ref: PinRef) => connection(ref).map(wire => otherEnd(wire, ref)).filter(Boolean) as PinRef[];
  const peerPins = (ref: PinRef) => peers(ref).map(peer => findPin(components, peer)).filter(Boolean) as NonNullable<ReturnType<typeof findPin>>[];

  if (!boards.length) {
    issues.push({ id: 'board-missing', severity: 'error', title: 'No controller board', detail: 'Add an Arduino UNO-compatible board before preparing a real build.' });
  } else if (boards.length > 1) {
    issues.push({ id: 'board-many', severity: 'warning', title: 'Multiple controller boards', detail: 'The first rule set assumes one UNO-compatible board. Multi-board designs are not validated yet.' });
  }

  for (const wire of wires) {
    const left = findPin(components, wire.from);
    const right = findPin(components, wire.to);
    if (!left || !right) {
      issues.push({ id: `dangling-${wire.id}`, severity: 'error', title: 'Dangling wire reference', detail: `Wire ${wire.id} points to a component or pin that no longer exists.` });
      continue;
    }
    const roles = [left.pin.role, right.pin.role];
    if (roles.includes('power') && roles.includes('ground')) {
      issues.push({ id: `short-${wire.id}`, severity: 'error', title: 'Direct power-to-ground connection', detail: `${refLabel(components, wire.from)} is directly wired to ${refLabel(components, wire.to)}. Remove this wire before building.` });
    }
    if (left.pin.role === 'power' && right.pin.role === 'power' && left.pin.voltage && right.pin.voltage && left.pin.voltage !== right.pin.voltage) {
      issues.push({ id: `rails-${wire.id}`, severity: 'error', title: 'Different power rails tied together', detail: `Do not directly connect ${left.pin.voltage} V and ${right.pin.voltage} V rails.` });
    }
    const powerAndIo = (left.pin.role === 'power' && ['analog-in', 'digital-io', 'pwm-io'].includes(right.pin.role)) ||
      (right.pin.role === 'power' && ['analog-in', 'digital-io', 'pwm-io'].includes(left.pin.role));
    if (powerAndIo) {
      issues.push({ id: `power-io-${wire.id}`, severity: 'error', title: 'Power rail connected directly to an I/O pin', detail: `${refLabel(components, wire.from)} ↔ ${refLabel(components, wire.to)} is not a valid direct signal connection in this rule set.` });
    }
  }

  for (const component of components.filter(item => item.kind === 'potentiometer')) {
    const vcc: PinRef = { componentId: component.id, pinId: 'vcc' };
    const sig: PinRef = { componentId: component.id, pinId: 'sig' };
    const gnd: PinRef = { componentId: component.id, pinId: 'gnd' };
    if (!connection(vcc).length) issues.push({ id: `${component.id}-vcc`, severity: 'warning', title: 'Potentiometer VCC is not connected', detail: 'For Bench 01, connect VCC to the board power rail only after confirming the module voltage requirement.' });
    else if (!peerPins(vcc).some(peer => peer.pin.role === 'power')) issues.push({ id: `${component.id}-vcc-role`, severity: 'error', title: 'Potentiometer VCC has the wrong destination', detail: 'VCC should connect to a compatible board power pin.' });
    if (!connection(gnd).length) issues.push({ id: `${component.id}-gnd`, severity: 'warning', title: 'Potentiometer ground is not connected', detail: 'Connect the module ground to board GND.' });
    else if (!peerPins(gnd).some(peer => peer.pin.role === 'ground')) issues.push({ id: `${component.id}-gnd-role`, severity: 'error', title: 'Potentiometer ground has the wrong destination', detail: 'The GND pin should connect to board GND.' });
    if (!connection(sig).length) issues.push({ id: `${component.id}-sig`, severity: 'warning', title: 'Potentiometer signal is not connected', detail: 'Connect SIG to an analog input such as A0.' });
    else if (!peerPins(sig).some(peer => peer.pin.role === 'analog-in')) issues.push({ id: `${component.id}-sig-role`, severity: 'error', title: 'Potentiometer signal is not on an analog input', detail: 'Bench 01 expects the wiper/signal line on A0–A2 in this first component library.' });
  }

  for (const component of components.filter(item => item.kind === 'led')) {
    const anode: PinRef = { componentId: component.id, pinId: 'anode' };
    const cathode: PinRef = { componentId: component.id, pinId: 'cathode' };
    if (!connection(anode).length) issues.push({ id: `${component.id}-anode`, severity: 'warning', title: 'LED anode is unconnected', detail: 'Connect the LED through a suitable series resistor to a digital/PWM output.' });
    if (!connection(cathode).length) issues.push({ id: `${component.id}-cathode`, severity: 'warning', title: 'LED cathode is unconnected', detail: 'For the Bench 01 reference layout, connect the cathode to GND.' });

    const directAnodePeers = peerPins(anode);
    if (directAnodePeers.some(peer => ['digital-io', 'pwm-io', 'power'].includes(peer.pin.role))) {
      issues.push({ id: `${component.id}-no-resistor`, severity: 'error', title: 'LED is directly connected without a series resistor', detail: 'Insert a suitable current-limiting resistor between the output/power source and the LED.' });
    }
    if (peerPins(cathode).length && !peerPins(cathode).some(peer => peer.pin.role === 'ground')) {
      issues.push({ id: `${component.id}-cathode-role`, severity: 'warning', title: 'LED cathode is not connected to GND', detail: 'The first Bench 01 rule set expects the LED return to board GND.' });
    }

    const resistorPeers = peers(anode).map(peer => findPin(components, peer)).filter(found => found?.component.kind === 'resistor') as NonNullable<ReturnType<typeof findPin>>[];
    if (resistorPeers.length) {
      const resistor = resistorPeers[0].component;
      const enteringPin = resistorPeers[0].pin.id;
      const otherPin = enteringPin === 'a' ? 'b' : 'a';
      const otherRef: PinRef = { componentId: resistor.id, pinId: otherPin };
      const reachesOutput = peerPins(otherRef).some(peer => ['digital-io', 'pwm-io'].includes(peer.pin.role));
      if (!reachesOutput) {
        issues.push({ id: `${component.id}-resistor-open`, severity: 'warning', title: 'LED resistor path does not reach an output', detail: 'The resistor is present, but the opposite side is not connected to a digital/PWM output.' });
      }
    }
  }

  for (const component of components.filter(item => item.kind === 'resistor')) {
    const a = connection({ componentId: component.id, pinId: 'a' }).length;
    const b = connection({ componentId: component.id, pinId: 'b' }).length;
    if ((a === 0) !== (b === 0)) {
      issues.push({ id: `${component.id}-open`, severity: 'warning', title: 'Resistor has an open end', detail: 'Both resistor terminals need a connection for a complete series path.' });
    }
  }

  const errors = issues.filter(issue => issue.severity === 'error').length;
  const warnings = issues.filter(issue => issue.severity === 'warning').length;
  if (!errors && !warnings && components.length > 1 && wires.length > 0) {
    issues.unshift({ id: 'ready', severity: 'pass', title: 'Rule set passes', detail: 'No known wiring error was found by the current bounded low-voltage rule set. This is not a simulation or electrical-safety certification.' });
  } else if (!issues.length) {
    issues.push({ id: 'start', severity: 'info', title: 'Start wiring the design', detail: 'Add components and connect pins. The Rule Checker updates immediately.' });
  }
  return issues;
}

function defaultDropPosition(index: number) {
  const column = index % 4;
  const row = Math.floor(index / 4);
  return { x: 60 + column * 230, y: 80 + row * 180 };
}

export default function CircuitLab({ onUseRecipe }: Props) {
  const [design, setDesign] = useState<CircuitDesign>(() => blankDesign());
  const [pendingPin, setPendingPin] = useState<PinRef | null>(null);
  const [selectedId, setSelectedId] = useState<string>('uno-1');
  const [drag, setDrag] = useState<{ id: string; dx: number; dy: number } | null>(null);
  const [notice, setNotice] = useState('Design only · no electrical or MCU simulation is running.');

  const issues = useMemo(() => runRuleChecker(design.components, design.wires), [design]);
  const counts = useMemo(() => ({
    error: issues.filter(issue => issue.severity === 'error').length,
    warning: issues.filter(issue => issue.severity === 'warning').length,
  }), [issues]);
  const selected = design.components.find(component => component.id === selectedId);

  function addComponent(kind: ComponentKind) {
    const position = defaultDropPosition(design.components.length);
    const component: PlacedComponent = { id: makeId(kind), kind, ...position };
    setDesign(current => ({ ...current, components: [...current.components, component] }));
    setSelectedId(component.id);
  }

  function removeSelected() {
    if (!selected) return;
    setDesign(current => ({
      ...current,
      components: current.components.filter(component => component.id !== selected.id),
      wires: current.wires.filter(wire => wire.from.componentId !== selected.id && wire.to.componentId !== selected.id),
    }));
    setSelectedId('');
    if (pendingPin?.componentId === selected.id) setPendingPin(null);
  }

  function handlePin(ref: PinRef) {
    if (!pendingPin) {
      setPendingPin(ref);
      setNotice(`Wire started at ${refLabel(design.components, ref)}. Choose another pin.`);
      return;
    }
    if (samePin(pendingPin, ref)) {
      setPendingPin(null);
      setNotice('Wire cancelled.');
      return;
    }
    const duplicate = design.wires.some(wire =>
      (samePin(wire.from, pendingPin) && samePin(wire.to, ref)) ||
      (samePin(wire.to, pendingPin) && samePin(wire.from, ref))
    );
    if (duplicate) {
      setPendingPin(null);
      setNotice('That connection already exists.');
      return;
    }
    const wire: Wire = { id: makeId('wire'), from: pendingPin, to: ref };
    setDesign(current => ({ ...current, wires: [...current.wires, wire] }));
    setPendingPin(null);
    setNotice('Wire added. Rule Checker updated.');
  }

  function removeWire(id: string) {
    setDesign(current => ({ ...current, wires: current.wires.filter(wire => wire.id !== id) }));
  }

  function loadBench01() {
    setDesign(bench01Design());
    setSelectedId('uno-1');
    setPendingPin(null);
    setNotice('Loaded the Bench 01 reference wiring. This is still design/rule-check mode only.');
  }

  function clearDesign() {
    setDesign(blankDesign());
    setSelectedId('uno-1');
    setPendingPin(null);
    setNotice('Started a new design with one UNO-compatible board.');
  }

  function saveLocal() {
    localStorage.setItem('betterboard.circuit-lab.design.v01', JSON.stringify(design));
    setNotice('Saved this circuit design locally on this Mac.');
  }

  function loadLocal() {
    try {
      const raw = localStorage.getItem('betterboard.circuit-lab.design.v01');
      if (!raw) return setNotice('No locally saved circuit design was found.');
      const parsed = JSON.parse(raw) as CircuitDesign;
      if (parsed.schema !== 'betterboard.circuit-design/0.1' || !Array.isArray(parsed.components) || !Array.isArray(parsed.wires)) throw new Error('unsupported design schema');
      setDesign(parsed); setSelectedId(parsed.components[0]?.id || ''); setPendingPin(null);
      setNotice('Loaded the locally saved circuit design.');
    } catch (error) { setNotice(`Could not load design: ${error}`); }
  }

  async function copyJson() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(design, null, 2));
      setNotice('Circuit JSON copied to the clipboard.');
    } catch (error) { setNotice(`Clipboard copy failed: ${error}`); }
  }

  function startDrag(event: React.PointerEvent<HTMLDivElement>, component: PlacedComponent) {
    if ((event.target as HTMLElement).closest('.circuit-pin')) return;
    const canvas = event.currentTarget.closest('.circuit-canvas') as HTMLElement | null;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    setSelectedId(component.id);
    setDrag({ id: component.id, dx: event.clientX - rect.left - component.x, dy: event.clientY - rect.top - component.y });
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (!drag) return;
    const canvas = event.currentTarget.closest('.circuit-canvas') as HTMLElement | null;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    setDesign(current => ({
      ...current,
      components: current.components.map(component => component.id === drag.id ? {
        ...component,
        x: Math.max(4, Math.min(1100, event.clientX - rect.left - drag.dx)),
        y: Math.max(4, Math.min(650, event.clientY - rect.top - drag.dy)),
      } : component),
    }));
  }

  return <section className="circuit-lab">
    <div className="circuit-toolbar panel">
      <div>
        <div className="eyebrow">Circuit Lab · Phase A/B</div>
        <h2>Visual Wiring Editor + Rule Checker</h2>
        <p className="muted">Lay out a low-voltage Arduino design, connect pins, and catch a bounded set of common wiring mistakes before touching the real hardware.</p>
      </div>
      <div className="circuit-actions">
        <button className="ghost" onClick={loadBench01}><RotateCcw size={15}/> Bench 01 template</button>
        <button className="ghost" onClick={saveLocal}><Save size={15}/> Save</button>
        <button className="ghost" onClick={loadLocal}><Clipboard size={15}/> Load</button>
        <button className="ghost" onClick={copyJson}><Clipboard size={15}/> Copy JSON</button>
        <button className="ghost" onClick={clearDesign}><Eraser size={15}/> New</button>
      </div>
    </div>

    <div className="circuit-status-row">
      <div className={`circuit-status ${counts.error ? 'bad' : counts.warning ? 'warn' : 'good'}`}>
        <ShieldCheck size={16}/><b>{counts.error ? `${counts.error} error(s)` : counts.warning ? `${counts.warning} warning(s)` : 'No known rule violation'}</b>
      </div>
      <div className="circuit-status"><MousePointer2 size={15}/><span>{pendingPin ? `Wiring from ${refLabel(design.components, pendingPin)}` : notice}</span></div>
    </div>

    <div className="circuit-layout">
      <aside className="panel component-palette">
        <div className="panel-title"><Plus size={17}/> Components</div>
        {(Object.keys(SPECS) as ComponentKind[]).map(kind => {
          const spec = SPECS[kind];
          return <button key={kind} className="palette-item" onClick={() => addComponent(kind)}>
            <CircuitBoard size={18}/><span><b>{spec.title}</b><small>{spec.subtitle}</small></span><Plus size={14}/>
          </button>;
        })}
        <div className="circuit-boundary"><ShieldCheck size={14}/>First release: UNO-class low-voltage design rules only. No SPICE, MCU emulation, current calculation, or component-damage prediction.</div>
      </aside>

      <div className="panel circuit-canvas-panel">
        <div className="canvas-header"><div><b>{design.name}</b><span>{design.components.length} components · {design.wires.length} wires</span></div><small>Click one pin, then another. Drag blocks to move them.</small></div>
        <div className="circuit-canvas" onPointerMove={moveDrag} onPointerUp={() => setDrag(null)} onPointerCancel={() => setDrag(null)}>
          <svg className="wire-layer" viewBox="0 0 1200 720" preserveAspectRatio="none">
            {design.wires.map(wire => {
              const fromFound = findPin(design.components, wire.from);
              const toFound = findPin(design.components, wire.to);
              if (!fromFound || !toFound) return null;
              const a = pinPoint(fromFound.component, fromFound.pin);
              const b = pinPoint(toFound.component, toFound.pin);
              const mx = (a.x + b.x) / 2;
              return <path key={wire.id} d={`M ${a.x} ${a.y} C ${mx} ${a.y}, ${mx} ${b.y}, ${b.x} ${b.y}`} />;
            })}
          </svg>
          {design.components.map(component => {
            const spec = SPECS[component.kind];
            return <div
              key={component.id}
              className={`circuit-component ${component.kind} ${selectedId === component.id ? 'selected' : ''}`}
              style={{ left: component.x, top: component.y, width: spec.width, height: spec.height }}
              onPointerDown={event => startDrag(event, component)}
              onPointerMove={moveDrag}
              onPointerUp={() => setDrag(null)}
              onClick={() => setSelectedId(component.id)}
            >
              <div className="component-face"><CircuitBoard size={21}/><b>{spec.title}</b><span>{spec.subtitle}</span></div>
              {spec.pins.map(pin => <button
                key={pin.id}
                className={`circuit-pin ${pin.side} ${pendingPin && samePin(pendingPin, { componentId: component.id, pinId: pin.id }) ? 'pending' : ''}`}
                style={pin.side === 'left' || pin.side === 'right' ? { top: pin.offset } : { left: pin.offset }}
                title={`${pin.label} · ${pin.role}`}
                onPointerDown={event => event.stopPropagation()}
                onClick={event => { event.stopPropagation(); handlePin({ componentId: component.id, pinId: pin.id }); }}
              ><i/><span>{pin.label}</span></button>)}
            </div>;
          })}
        </div>
      </div>

      <aside className="circuit-right">
        <div className="panel rule-panel">
          <div className="panel-title"><ShieldCheck size={17}/> Rule Checker</div>
          <div className="rule-summary"><span className={counts.error ? 'bad' : 'good'}>{counts.error} errors</span><span className={counts.warning ? 'warn' : 'good'}>{counts.warning} warnings</span></div>
          <div className="rule-list">{issues.map(issue => <div key={issue.id} className={`rule-item ${issue.severity}`}>
            {issue.severity === 'error' || issue.severity === 'warning' ? <AlertTriangle size={15}/> : <CheckCircle2 size={15}/>}
            <div><b>{issue.title}</b><span>{issue.detail}</span></div>
          </div>)}</div>
        </div>

        <div className="panel circuit-inspector">
          <div className="panel-title"><Unplug size={17}/> Inspector</div>
          {selected ? <>
            <b>{SPECS[selected.kind].title}</b><span className="muted">{selected.id}</span>
            <div className="inspector-pins">{SPECS[selected.kind].pins.map(pin => <span key={pin.id}>{pin.label}<small>{pin.role}</small></span>)}</div>
            <button className="ghost danger" onClick={removeSelected}><Trash2 size={15}/> Delete component</button>
          </> : <span className="muted">Select a block to inspect it.</span>}
        </div>

        <div className="panel wiring-list">
          <div className="panel-title"><Lightbulb size={17}/> Wiring list</div>
          {!design.wires.length ? <span className="muted">No wires yet.</span> : design.wires.map(wire => <div key={wire.id}>
            <span>{refLabel(design.components, wire.from)} <b>→</b> {refLabel(design.components, wire.to)}</span>
            <button title="Delete wire" onClick={() => removeWire(wire.id)}><Trash2 size={13}/></button>
          </div>)}
          {design.name.startsWith('Bench 01') && <button className="primary build-button" onClick={() => onUseRecipe?.('analog_a0')}>Use Bench 01 firmware</button>}
        </div>
      </aside>
    </div>
  </section>;
}
