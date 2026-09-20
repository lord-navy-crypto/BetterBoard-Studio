import { useMemo, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, CircuitBoard, Clipboard, Eraser, Lightbulb,
  MousePointer2, Plus, RotateCcw, Save, ShieldCheck, Trash2, Unplug,
} from 'lucide-react';
import { connectedNet, issueTargets } from './circuitDiagnostics';
import './circuitLab.css';

type Side = 'left' | 'right' | 'top' | 'bottom';
type PinRole = 'power' | 'ground' | 'analog-in' | 'digital-io' | 'pwm-io' | 'signal' | 'passive';
type ComponentKind =
  | 'uno'
  | 'breadboard'
  | 'potentiometer'
  | 'led'
  | 'resistor'
  | 'button'
  | 'bme280'
  | 'adxl345'
  | 'mlx90393'
  | 'ina219'
  | 'hcsr04'
  | 'servo'
  | 'bus'
  | 'junction'
  | 'photoresistor'
  | 'thermistor'
  | 'buzzer'
  | 'dcMotor'
  | 'relayModule'
  | 'nmos'
  | 'diode'
  | 'capacitor';
type Severity = 'error' | 'warning' | 'pass' | 'info';

type PinSpec = { id: string; label: string; role: PinRole; side: Side; offset: number; voltage?: number };
type ComponentSpec = { kind: ComponentKind; title: string; subtitle: string; width: number; height: number; pins: PinSpec[] };
type PlacedComponent = { id: string; kind: ComponentKind; x: number; y: number };
type PinRef = { componentId: string; pinId: string };
type Wire = { id: string; from: PinRef; to: PinRef };
type Issue = { id: string; severity: Severity; title: string; detail: string };
type CircuitDesign = { schema: 'betterboard.circuit-design/0.1'; name: string; components: PlacedComponent[]; wires: Wire[] };
type Props = { onUseRecipe?: (recipeId: string) => void };

const SPECS: Record<ComponentKind, ComponentSpec> = {
  uno: {
    kind: 'uno', title: 'Arduino UNO R3', subtitle: 'ATmega328P · 5 V · 16 MHz', width: 332, height: 224,
    pins: [
      { id: 'ioref', label: 'IOREF', role: 'power', side: 'top', offset: 34, voltage: 5 },
      { id: 'reset', label: 'RESET', role: 'signal', side: 'top', offset: 72 },
      { id: '3v3', label: '3V3', role: 'power', side: 'top', offset: 108, voltage: 3.3 },
      { id: '5v', label: '5V', role: 'power', side: 'top', offset: 140, voltage: 5 },
      { id: 'gnd1', label: 'GND', role: 'ground', side: 'top', offset: 172 },
      { id: 'gnd2', label: 'GND', role: 'ground', side: 'top', offset: 204 },
      { id: 'vin', label: 'VIN', role: 'power', side: 'top', offset: 240 },
      { id: 'a0', label: 'A0', role: 'analog-in', side: 'left', offset: 38 },
      { id: 'a1', label: 'A1', role: 'analog-in', side: 'left', offset: 68 },
      { id: 'a2', label: 'A2', role: 'analog-in', side: 'left', offset: 98 },
      { id: 'a3', label: 'A3', role: 'analog-in', side: 'left', offset: 128 },
      { id: 'a4', label: 'A4/SDA', role: 'analog-in', side: 'left', offset: 158 },
      { id: 'a5', label: 'A5/SCL', role: 'analog-in', side: 'left', offset: 188 },
      { id: 'd0', label: 'D0/RX', role: 'digital-io', side: 'right', offset: 26 },
      { id: 'd1', label: 'D1/TX', role: 'digital-io', side: 'right', offset: 52 },
      { id: 'd2', label: 'D2/INT0', role: 'digital-io', side: 'right', offset: 78 },
      { id: 'd3', label: 'D3~/INT1', role: 'pwm-io', side: 'right', offset: 104 },
      { id: 'd4', label: 'D4', role: 'digital-io', side: 'right', offset: 130 },
      { id: 'd5', label: 'D5~', role: 'pwm-io', side: 'right', offset: 156 },
      { id: 'd6', label: 'D6~', role: 'pwm-io', side: 'right', offset: 182 },
      { id: 'd7', label: 'D7', role: 'digital-io', side: 'right', offset: 208 },
      { id: 'd8', label: 'D8', role: 'digital-io', side: 'bottom', offset: 38 },
      { id: 'd9', label: 'D9~', role: 'pwm-io', side: 'bottom', offset: 76 },
      { id: 'd10', label: 'D10~/SS', role: 'pwm-io', side: 'bottom', offset: 116 },
      { id: 'd11', label: 'D11~/MOSI', role: 'pwm-io', side: 'bottom', offset: 158 },
      { id: 'd12', label: 'D12/MISO', role: 'digital-io', side: 'bottom', offset: 204 },
      { id: 'd13', label: 'D13/SCK', role: 'digital-io', side: 'bottom', offset: 250 },
      { id: 'aref', label: 'AREF', role: 'signal', side: 'bottom', offset: 294 },
    ],
  },
  breadboard: {
    kind: 'breadboard', title: 'Solderless Breadboard', subtitle: 'power rails + terminal strips', width: 360, height: 160,
    pins: [
      { id: 'rail5v', label: '+ rail', role: 'passive', side: 'top', offset: 62 },
      { id: 'railgnd', label: '− rail', role: 'passive', side: 'top', offset: 292 },
      { id: 'rowA', label: 'A–E row', role: 'passive', side: 'left', offset: 58 },
      { id: 'rowF', label: 'F–J row', role: 'passive', side: 'right', offset: 58 },
      { id: 'rowA2', label: 'A–E row 2', role: 'passive', side: 'left', offset: 110 },
      { id: 'rowF2', label: 'F–J row 2', role: 'passive', side: 'right', offset: 110 },
    ],
  },
  potentiometer: {
    kind: 'potentiometer', title: 'Potentiometer', subtitle: '3-pin analog input', width: 178, height: 126,
    pins: [
      { id: 'vcc', label: 'VCC', role: 'power', side: 'left', offset: 36 },
      { id: 'sig', label: 'WIPER', role: 'signal', side: 'right', offset: 63 },
      { id: 'gnd', label: 'GND', role: 'ground', side: 'left', offset: 92 },
    ],
  },
  led: {
    kind: 'led', title: 'LED', subtitle: 'indicator output', width: 150, height: 112,
    pins: [
      { id: 'anode', label: 'A +', role: 'passive', side: 'left', offset: 38 },
      { id: 'cathode', label: 'K −', role: 'passive', side: 'left', offset: 78 },
    ],
  },
  resistor: {
    kind: 'resistor', title: 'Resistor', subtitle: 'series / pull element', width: 154, height: 92,
    pins: [
      { id: 'a', label: '1', role: 'passive', side: 'left', offset: 46 },
      { id: 'b', label: '2', role: 'passive', side: 'right', offset: 46 },
    ],
  },
  button: {
    kind: 'button', title: 'Push Button', subtitle: 'digital contact', width: 154, height: 98,
    pins: [
      { id: 'a', label: 'A', role: 'passive', side: 'left', offset: 49 },
      { id: 'b', label: 'B', role: 'passive', side: 'right', offset: 49 },
    ],
  },
  bme280: {
    kind: 'bme280', title: 'BME280', subtitle: 'temperature · pressure · humidity · I²C', width: 184, height: 112,
    pins: [
      { id: 'vcc', label: 'VIN', role: 'power', side: 'left', offset: 26 },
      { id: 'gnd', label: 'GND', role: 'ground', side: 'left', offset: 82 },
      { id: 'sda', label: 'SDA', role: 'signal', side: 'right', offset: 38 },
      { id: 'scl', label: 'SCL', role: 'signal', side: 'right', offset: 76 },
    ],
  },
  adxl345: {
    kind: 'adxl345', title: 'ADXL345', subtitle: '3-axis accelerometer · I²C/SPI', width: 184, height: 116,
    pins: [
      { id: 'vcc', label: 'VIN', role: 'power', side: 'left', offset: 28 },
      { id: 'gnd', label: 'GND', role: 'ground', side: 'left', offset: 86 },
      { id: 'sda', label: 'SDA', role: 'signal', side: 'right', offset: 34 },
      { id: 'scl', label: 'SCL', role: 'signal', side: 'right', offset: 76 },
    ],
  },
  mlx90393: {
    kind: 'mlx90393', title: 'MLX90393', subtitle: '3-axis magnetometer · I²C', width: 190, height: 118,
    pins: [
      { id: 'vcc', label: 'VIN', role: 'power', side: 'left', offset: 28 },
      { id: 'gnd', label: 'GND', role: 'ground', side: 'left', offset: 88 },
      { id: 'sda', label: 'SDA', role: 'signal', side: 'right', offset: 36 },
      { id: 'scl', label: 'SCL', role: 'signal', side: 'right', offset: 80 },
    ],
  },
  ina219: {
    kind: 'ina219', title: 'INA219', subtitle: 'voltage/current monitor · I²C', width: 190, height: 118,
    pins: [
      { id: 'vcc', label: 'VCC', role: 'power', side: 'left', offset: 28 },
      { id: 'gnd', label: 'GND', role: 'ground', side: 'left', offset: 88 },
      { id: 'sda', label: 'SDA', role: 'signal', side: 'right', offset: 36 },
      { id: 'scl', label: 'SCL', role: 'signal', side: 'right', offset: 80 },
    ],
  },
  hcsr04: {
    kind: 'hcsr04', title: 'HC-SR04', subtitle: 'ultrasonic distance module', width: 202, height: 122,
    pins: [
      { id: 'vcc', label: 'VCC', role: 'power', side: 'left', offset: 28 },
      { id: 'gnd', label: 'GND', role: 'ground', side: 'left', offset: 92 },
      { id: 'trig', label: 'TRIG', role: 'signal', side: 'right', offset: 38 },
      { id: 'echo', label: 'ECHO', role: 'signal', side: 'right', offset: 82 },
    ],
  },
  servo: {
    kind: 'servo', title: 'Hobby Servo', subtitle: 'power + PWM control', width: 188, height: 116,
    pins: [
      { id: 'vcc', label: 'V+', role: 'power', side: 'left', offset: 28 },
      { id: 'gnd', label: 'GND', role: 'ground', side: 'left', offset: 86 },
      { id: 'sig', label: 'SIG', role: 'signal', side: 'right', offset: 58 },
    ],
  },
  bus: {
    kind: 'bus', title: 'Common Bus', subtitle: '6-node shared electrical net', width: 220, height: 92,
    pins: [
      { id: 'p1', label: '1', role: 'passive', side: 'left', offset: 28 },
      { id: 'p2', label: '2', role: 'passive', side: 'left', offset: 64 },
      { id: 'p3', label: '3', role: 'passive', side: 'top', offset: 72 },
      { id: 'p4', label: '4', role: 'passive', side: 'top', offset: 150 },
      { id: 'p5', label: '5', role: 'passive', side: 'right', offset: 28 },
      { id: 'p6', label: '6', role: 'passive', side: 'right', offset: 64 },
    ],
  },
  junction: {
    kind: 'junction', title: 'Junction / Common Node', subtitle: '4-node common point', width: 156, height: 92,
    pins: [
      { id: 'p1', label: '1', role: 'passive', side: 'left', offset: 46 },
      { id: 'p2', label: '2', role: 'passive', side: 'right', offset: 46 },
      { id: 'p3', label: '3', role: 'passive', side: 'top', offset: 78 },
      { id: 'p4', label: '4', role: 'passive', side: 'bottom', offset: 78 },
    ],
  },
  photoresistor: {
    kind: 'photoresistor', title: 'Photoresistor / LDR', subtitle: 'light-dependent resistance', width: 176, height: 94,
    pins: [{ id: 'a', label: '1', role: 'passive', side: 'left', offset: 47 }, { id: 'b', label: '2', role: 'passive', side: 'right', offset: 47 }],
  },
  thermistor: {
    kind: 'thermistor', title: 'Thermistor', subtitle: 'temperature-dependent resistance', width: 176, height: 94,
    pins: [{ id: 'a', label: '1', role: 'passive', side: 'left', offset: 47 }, { id: 'b', label: '2', role: 'passive', side: 'right', offset: 47 }],
  },
  buzzer: {
    kind: 'buzzer', title: 'Piezo Buzzer', subtitle: 'digital/PWM output load', width: 170, height: 100,
    pins: [{ id: 'vcc', label: '+', role: 'power', side: 'left', offset: 30 }, { id: 'gnd', label: '−', role: 'ground', side: 'left', offset: 72 }, { id: 'sig', label: 'SIG', role: 'signal', side: 'right', offset: 50 }],
  },
  dcMotor: {
    kind: 'dcMotor', title: 'DC Motor', subtitle: '2-terminal motor load', width: 176, height: 100,
    pins: [{ id: 'a', label: 'M+', role: 'passive', side: 'left', offset: 34 }, { id: 'b', label: 'M−', role: 'passive', side: 'right', offset: 66 }],
  },
  relayModule: {
    kind: 'relayModule', title: 'Relay Module', subtitle: 'logic-controlled isolated contact', width: 200, height: 122,
    pins: [
      { id: 'vcc', label: 'VCC', role: 'power', side: 'left', offset: 26 },
      { id: 'gnd', label: 'GND', role: 'ground', side: 'left', offset: 92 },
      { id: 'sig', label: 'IN', role: 'signal', side: 'left', offset: 58 },
      { id: 'com', label: 'COM', role: 'passive', side: 'right', offset: 30 },
      { id: 'no', label: 'NO', role: 'passive', side: 'right', offset: 62 },
      { id: 'nc', label: 'NC', role: 'passive', side: 'right', offset: 94 },
    ],
  },
  nmos: {
    kind: 'nmos', title: 'N-MOSFET', subtitle: 'gate · drain · source switch', width: 170, height: 112,
    pins: [
      { id: 'g', label: 'G', role: 'signal', side: 'left', offset: 56 },
      { id: 'd', label: 'D', role: 'passive', side: 'right', offset: 34 },
      { id: 's', label: 'S', role: 'passive', side: 'right', offset: 80 },
    ],
  },
  diode: {
    kind: 'diode', title: 'Diode', subtitle: 'anode / cathode passive device', width: 154, height: 92,
    pins: [{ id: 'a', label: 'A', role: 'passive', side: 'left', offset: 46 }, { id: 'k', label: 'K', role: 'passive', side: 'right', offset: 46 }],
  },
  capacitor: {
    kind: 'capacitor', title: 'Capacitor', subtitle: '2-terminal passive element', width: 154, height: 92,
    pins: [{ id: 'a', label: '1', role: 'passive', side: 'left', offset: 46 }, { id: 'b', label: '2', role: 'passive', side: 'right', offset: 46 }],
  },
};

const COMPONENT_GROUPS: Array<{ label: string; kinds: ComponentKind[] }> = [
  { label: 'Board & layout', kinds: ['uno', 'breadboard', 'bus', 'junction'] },
  { label: 'Inputs & controls', kinds: ['potentiometer', 'button', 'photoresistor', 'thermistor'] },
  { label: 'Sensors & measurement', kinds: ['bme280', 'adxl345', 'mlx90393', 'ina219', 'hcsr04'] },
  { label: 'Outputs & passive', kinds: ['led', 'resistor', 'servo', 'buzzer', 'dcMotor', 'relayModule', 'nmos', 'diode', 'capacitor'] },
];

const blankDesign = (): CircuitDesign => ({
  schema: 'betterboard.circuit-design/0.1',
  name: 'Untitled circuit',
  components: [{ id: 'uno-1', kind: 'uno', x: 330, y: 230 }],
  wires: [],
});

const bench01Design = (): CircuitDesign => ({
  schema: 'betterboard.circuit-design/0.1',
  name: 'Bench 01 — Analog Control & Instrumentation',
  components: [
    { id: 'pot-1', kind: 'potentiometer', x: 48, y: 230 },
    { id: 'uno-1', kind: 'uno', x: 330, y: 195 },
    { id: 'res-1', kind: 'resistor', x: 640, y: 195 },
    { id: 'led-1', kind: 'led', x: 850, y: 185 },
  ],
  wires: [
    { id: 'w1', from: { componentId: 'uno-1', pinId: '5v' }, to: { componentId: 'pot-1', pinId: 'vcc' } },
    { id: 'w2', from: { componentId: 'uno-1', pinId: 'gnd1' }, to: { componentId: 'pot-1', pinId: 'gnd' } },
    { id: 'w3', from: { componentId: 'pot-1', pinId: 'sig' }, to: { componentId: 'uno-1', pinId: 'a0' } },
    { id: 'w4', from: { componentId: 'uno-1', pinId: 'd9' }, to: { componentId: 'res-1', pinId: 'a' } },
    { id: 'w5', from: { componentId: 'res-1', pinId: 'b' }, to: { componentId: 'led-1', pinId: 'anode' } },
    { id: 'w6', from: { componentId: 'led-1', pinId: 'cathode' }, to: { componentId: 'uno-1', pinId: 'gnd1' } },
  ],
});

const i2cSensorTutorial = (): CircuitDesign => ({
  schema: 'betterboard.circuit-design/0.1',
  name: 'Tutorial — UNO R3 + BME280 I²C',
  components: [
    { id: 'uno-1', kind: 'uno', x: 330, y: 215 },
    { id: 'breadboard-1', kind: 'breadboard', x: 60, y: 475 },
    { id: 'bme280-1', kind: 'bme280', x: 760, y: 255 },
  ],
  wires: [
    { id: 'w1', from: { componentId: 'uno-1', pinId: '5v' }, to: { componentId: 'bme280-1', pinId: 'vcc' } },
    { id: 'w2', from: { componentId: 'uno-1', pinId: 'gnd1' }, to: { componentId: 'bme280-1', pinId: 'gnd' } },
    { id: 'w3', from: { componentId: 'uno-1', pinId: 'a4' }, to: { componentId: 'bme280-1', pinId: 'sda' } },
    { id: 'w4', from: { componentId: 'uno-1', pinId: 'a5' }, to: { componentId: 'bme280-1', pinId: 'scl' } },
  ],
});

const analogBreadboardTutorial = (): CircuitDesign => ({
  schema: 'betterboard.circuit-design/0.1',
  name: 'Tutorial — Analog input + breadboard + LED',
  components: [
    { id: 'uno-1', kind: 'uno', x: 360, y: 180 },
    { id: 'breadboard-1', kind: 'breadboard', x: 330, y: 470 },
    { id: 'pot-1', kind: 'potentiometer', x: 55, y: 245 },
    { id: 'res-1', kind: 'resistor', x: 770, y: 190 },
    { id: 'led-1', kind: 'led', x: 970, y: 180 },
  ],
  wires: [
    { id: 'w1', from: { componentId: 'uno-1', pinId: '5v' }, to: { componentId: 'pot-1', pinId: 'vcc' } },
    { id: 'w2', from: { componentId: 'uno-1', pinId: 'gnd1' }, to: { componentId: 'pot-1', pinId: 'gnd' } },
    { id: 'w3', from: { componentId: 'pot-1', pinId: 'sig' }, to: { componentId: 'uno-1', pinId: 'a0' } },
    { id: 'w4', from: { componentId: 'uno-1', pinId: 'd9' }, to: { componentId: 'res-1', pinId: 'a' } },
    { id: 'w5', from: { componentId: 'res-1', pinId: 'b' }, to: { componentId: 'led-1', pinId: 'anode' } },
    { id: 'w6', from: { componentId: 'led-1', pinId: 'cathode' }, to: { componentId: 'uno-1', pinId: 'gnd2' } },
  ],
});

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function parseStoredCircuitDesign(raw: string): CircuitDesign {
  const root = asObject(JSON.parse(raw));
  if (!root || root.schema !== 'betterboard.circuit-design/0.1') throw new Error('unsupported design schema');
  if (typeof root.name !== 'string' || !root.name.trim() || root.name.length > 160) throw new Error('invalid design name');
  if (!Array.isArray(root.components) || !Array.isArray(root.wires)) throw new Error('design components/wires must be arrays');
  if (root.components.length > 1000 || root.wires.length > 5000) throw new Error('saved design is too large to load safely');

  const componentIds = new Set<string>();
  const components = root.components.map((value, index) => {
    const item = asObject(value);
    if (!item || typeof item.id !== 'string' || !item.id || item.id.length > 160) throw new Error(`invalid component id at index ${index}`);
    if (componentIds.has(item.id)) throw new Error(`duplicate component id: ${item.id}`);
    if (typeof item.kind !== 'string' || !Object.prototype.hasOwnProperty.call(SPECS, item.kind)) throw new Error(`unsupported component kind at index ${index}`);
    if (typeof item.x !== 'number' || typeof item.y !== 'number' || !Number.isFinite(item.x) || !Number.isFinite(item.y)) throw new Error(`invalid component coordinates at index ${index}`);
    componentIds.add(item.id);
    return { id: item.id, kind: item.kind as ComponentKind, x: item.x, y: item.y } satisfies PlacedComponent;
  });
  const componentMap = new Map(components.map(component => [component.id, component]));

  function parsePinRef(value: unknown, label: string): PinRef {
    const item = asObject(value);
    if (!item || typeof item.componentId !== 'string' || typeof item.pinId !== 'string') throw new Error(`invalid ${label}`);
    const component = componentMap.get(item.componentId);
    if (!component) throw new Error(`${label} references missing component ${item.componentId}`);
    // Backward compatibility: Circuit Lab v0.1 originally exposed one UNO pin named "gnd".
    // The UNO R3 model now exposes GND1/GND2, so old saved designs migrate to GND1 on load.
    const migratedPinId = component.kind === 'uno' && item.pinId === 'gnd' ? 'gnd1' : item.pinId;
    if (!SPECS[component.kind].pins.some(pin => pin.id === migratedPinId)) throw new Error(`${label} references missing pin ${item.componentId}.${item.pinId}`);
    return { componentId: item.componentId, pinId: migratedPinId };
  }

  const wireIds = new Set<string>();
  const wires = root.wires.map((value, index) => {
    const item = asObject(value);
    if (!item || typeof item.id !== 'string' || !item.id || item.id.length > 160) throw new Error(`invalid wire id at index ${index}`);
    if (wireIds.has(item.id)) throw new Error(`duplicate wire id: ${item.id}`);
    const from = parsePinRef(item.from, `wire ${item.id} source`);
    const to = parsePinRef(item.to, `wire ${item.id} destination`);
    if (samePin(from, to)) throw new Error(`wire ${item.id} connects a pin to itself`);
    wireIds.add(item.id);
    return { id: item.id, from, to } satisfies Wire;
  });

  return { schema: 'betterboard.circuit-design/0.1', name: root.name, components, wires };
}

function makeId(prefix: string) { return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`; }
function samePin(a: PinRef, b: PinRef) { return a.componentId === b.componentId && a.pinId === b.pinId; }
function wireHas(wire: Wire, ref: PinRef) { return samePin(wire.from, ref) || samePin(wire.to, ref); }
function otherEnd(wire: Wire, ref: PinRef): PinRef | null { if (samePin(wire.from, ref)) return wire.to; if (samePin(wire.to, ref)) return wire.from; return null; }

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

function electricalWires(components: PlacedComponent[], wires: Wire[]): Wire[] {
  const expanded = [...wires];
  for (const component of components) {
    const commonPins = component.kind === 'bus'
      ? ['p1', 'p2', 'p3', 'p4', 'p5', 'p6']
      : component.kind === 'junction'
        ? ['p1', 'p2', 'p3', 'p4']
        : [];
    if (commonPins.length < 2) continue;
    const anchor = commonPins[0];
    for (const pinId of commonPins.slice(1)) {
      expanded.push({
        id: `implicit-${component.id}-${anchor}-${pinId}`,
        from: { componentId: component.id, pinId: anchor },
        to: { componentId: component.id, pinId },
      });
    }
  }
  return expanded;
}

function runRuleChecker(components: PlacedComponent[], wires: Wire[]): Issue[] {
  const issues: Issue[] = [];
  const boards = components.filter(component => component.kind === 'uno');
  const connection = (ref: PinRef) => wires.filter(wire => wireHas(wire, ref));
  const peers = (ref: PinRef) => connection(ref).map(wire => otherEnd(wire, ref)).filter(Boolean) as PinRef[];
  const peerPins = (ref: PinRef) => peers(ref).map(peer => findPin(components, peer)).filter(Boolean) as NonNullable<ReturnType<typeof findPin>>[];

  if (!boards.length) issues.push({ id: 'board-missing', severity: 'error', title: 'No controller board', detail: 'Add an Arduino UNO-compatible board before preparing a real build.' });
  else if (boards.length > 1) issues.push({ id: 'board-many', severity: 'warning', title: 'Multiple controller boards', detail: 'The first rule set assumes one UNO-compatible board. Multi-board designs are not validated yet.' });

  for (const wire of wires) {
    const left = findPin(components, wire.from);
    const right = findPin(components, wire.to);
    if (!left || !right) {
      issues.push({ id: `dangling-${wire.id}`, severity: 'error', title: 'Dangling wire reference', detail: `Wire ${wire.id} points to a component or pin that no longer exists.` });
      continue;
    }
    const roles = [left.pin.role, right.pin.role];
    if (roles.includes('power') && roles.includes('ground')) issues.push({ id: `short-${wire.id}`, severity: 'error', title: 'Direct power-to-ground connection', detail: `${refLabel(components, wire.from)} is directly wired to ${refLabel(components, wire.to)}. Remove this wire before building.` });
    if (left.pin.role === 'power' && right.pin.role === 'power' && left.pin.voltage && right.pin.voltage && left.pin.voltage !== right.pin.voltage) issues.push({ id: `rails-${wire.id}`, severity: 'error', title: 'Different power rails tied together', detail: `Do not directly connect ${left.pin.voltage} V and ${right.pin.voltage} V rails.` });
    const powerAndIo = (left.pin.role === 'power' && ['analog-in', 'digital-io', 'pwm-io'].includes(right.pin.role)) || (right.pin.role === 'power' && ['analog-in', 'digital-io', 'pwm-io'].includes(left.pin.role));
    if (powerAndIo) issues.push({ id: `power-io-${wire.id}`, severity: 'error', title: 'Power rail connected directly to an I/O pin', detail: `${refLabel(components, wire.from)} ↔ ${refLabel(components, wire.to)} is not a valid direct signal connection in this rule set.` });
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
    else if (!peerPins(sig).some(peer => peer.pin.role === 'analog-in')) issues.push({ id: `${component.id}-sig-role`, severity: 'error', title: 'Potentiometer signal is not on an analog input', detail: 'Bench 01 expects the wiper/signal line on A0–A2 in this UNO R3 / breadboard teaching library.' });
  }

  for (const component of components.filter(item => item.kind === 'led')) {
    const anode: PinRef = { componentId: component.id, pinId: 'anode' };
    const cathode: PinRef = { componentId: component.id, pinId: 'cathode' };
    if (!connection(anode).length) issues.push({ id: `${component.id}-anode`, severity: 'warning', title: 'LED anode is unconnected', detail: 'Connect the LED through a suitable series resistor to a digital/PWM output.' });
    if (!connection(cathode).length) issues.push({ id: `${component.id}-cathode`, severity: 'warning', title: 'LED cathode is unconnected', detail: 'For the Bench 01 reference layout, connect the cathode to GND.' });
    const directAnodePeers = peerPins(anode);
    if (directAnodePeers.some(peer => ['digital-io', 'pwm-io', 'power'].includes(peer.pin.role))) issues.push({ id: `${component.id}-no-resistor`, severity: 'error', title: 'LED is directly connected without a series resistor', detail: 'Insert a suitable current-limiting resistor between the output/power source and the LED.' });
    if (peerPins(cathode).length && !peerPins(cathode).some(peer => peer.pin.role === 'ground')) issues.push({ id: `${component.id}-cathode-role`, severity: 'warning', title: 'LED cathode is not connected to GND', detail: 'The first Bench 01 rule set expects the LED return to board GND.' });
    const resistorPeers = peers(anode).map(peer => findPin(components, peer)).filter(found => found?.component.kind === 'resistor') as NonNullable<ReturnType<typeof findPin>>[];
    if (resistorPeers.length) {
      const resistor = resistorPeers[0].component;
      const otherPin = resistorPeers[0].pin.id === 'a' ? 'b' : 'a';
      const reachesOutput = peerPins({ componentId: resistor.id, pinId: otherPin }).some(peer => ['digital-io', 'pwm-io'].includes(peer.pin.role));
      if (!reachesOutput) issues.push({ id: `${component.id}-resistor-open`, severity: 'warning', title: 'LED resistor path does not reach an output', detail: 'The resistor is present, but the opposite side is not connected to a digital/PWM output.' });
    }
  }

  for (const component of components.filter(item => item.kind === 'resistor')) {
    const a = connection({ componentId: component.id, pinId: 'a' }).length;
    const b = connection({ componentId: component.id, pinId: 'b' }).length;
    if ((a === 0) !== (b === 0)) issues.push({ id: `${component.id}-open`, severity: 'warning', title: 'Resistor has an open end', detail: 'Both resistor terminals need a connection for a complete series path.' });
  }

  const errors = issues.filter(issue => issue.severity === 'error').length;
  const warnings = issues.filter(issue => issue.severity === 'warning').length;
  if (!errors && !warnings && components.length > 1 && wires.length > 0) issues.unshift({ id: 'ready', severity: 'pass', title: 'Rule set passes', detail: 'No known wiring error was found by the current bounded low-voltage rule set. This is not a simulation or electrical-safety certification.' });
  else if (!issues.length) issues.push({ id: 'start', severity: 'info', title: 'Start wiring the design', detail: 'Add components and connect pins. The Rule Checker updates immediately.' });
  return issues;
}

function defaultDropPosition(index: number) {
  const column = index % 4;
  const row = Math.floor(index / 4);
  return { x: 45 + column * 205, y: 70 + row * 165 };
}

export default function CircuitLab({ onUseRecipe }: Props) {
  const [design, setDesign] = useState<CircuitDesign>(() => blankDesign());
  const [pendingPin, setPendingPin] = useState<PinRef | null>(null);
  const [selectedId, setSelectedId] = useState<string>('uno-1');
  const [selectedPin, setSelectedPin] = useState<PinRef | null>(null);
  const [selectedIssueId, setSelectedIssueId] = useState('');
  const [showOnlyProblems, setShowOnlyProblems] = useState(false);
  const [drag, setDrag] = useState<{ id: string; dx: number; dy: number } | null>(null);
  const [notice, setNotice] = useState('Ready · click any two pins to create a wire.');

  const analysisWires = useMemo(() => electricalWires(design.components, design.wires), [design]);
  const issues = useMemo(() => runRuleChecker(design.components, analysisWires), [design.components, analysisWires]);
  const counts = useMemo(() => ({ error: issues.filter(issue => issue.severity === 'error').length, warning: issues.filter(issue => issue.severity === 'warning').length }), [issues]);
  const selected = design.components.find(component => component.id === selectedId);
  const selectedIssue = issues.find(issue => issue.id === selectedIssueId) ?? null;
  const targets = useMemo(() => selectedIssue ? issueTargets(selectedIssue, design.components, analysisWires) : { componentIds: [], pinKeys: [], wireIds: [] }, [selectedIssue, design.components, analysisWires]);
  const net = useMemo(() => selectedPin ? connectedNet(selectedPin, analysisWires) : { pinKeys: new Set<string>(), wireIds: new Set<string>() }, [selectedPin, analysisWires]);
  const problemTargets = useMemo(() => {
    const componentIds = new Set<string>(); const pinKeys = new Set<string>(); const wireIds = new Set<string>();
    for (const issue of issues.filter(item => item.severity === 'error' || item.severity === 'warning')) {
      const projected = issueTargets(issue, design.components, analysisWires);
      projected.componentIds.forEach(id => componentIds.add(id)); projected.pinKeys.forEach(key => pinKeys.add(key)); projected.wireIds.forEach(id => wireIds.add(id));
    }
    return { componentIds, pinKeys, wireIds };
  }, [issues, design.components, analysisWires]);

  function addComponent(kind: ComponentKind) {
    const position = defaultDropPosition(design.components.length);
    const component: PlacedComponent = { id: makeId(kind), kind, ...position };
    setDesign(current => ({ ...current, components: [...current.components, component] }));
    setSelectedId(component.id); setSelectedIssueId('');
  }

  function removeSelected() {
    if (!selected) return;
    setDesign(current => ({ ...current, components: current.components.filter(component => component.id !== selected.id), wires: current.wires.filter(wire => wire.from.componentId !== selected.id && wire.to.componentId !== selected.id) }));
    setSelectedId(''); setSelectedPin(null); setSelectedIssueId('');
    if (pendingPin?.componentId === selected.id) setPendingPin(null);
  }

  function handlePin(ref: PinRef) {
    setSelectedPin(ref); setSelectedId(ref.componentId); setSelectedIssueId('');
    if (!pendingPin) { setPendingPin(ref); setNotice(`Wire started at ${refLabel(design.components, ref)}. Choose another pin.`); return; }
    if (samePin(pendingPin, ref)) { setPendingPin(null); setNotice('Wire cancelled.'); return; }
    const duplicate = design.wires.some(wire => (samePin(wire.from, pendingPin) && samePin(wire.to, ref)) || (samePin(wire.to, pendingPin) && samePin(wire.from, ref)));
    if (duplicate) { setPendingPin(null); setNotice('That connection already exists.'); return; }
    setDesign(current => ({ ...current, wires: [...current.wires, { id: makeId('wire'), from: pendingPin, to: ref }] }));
    setPendingPin(null); setNotice('Wire added. Rule Checker updated.');
  }

  function removeWire(id: string) { setDesign(current => ({ ...current, wires: current.wires.filter(wire => wire.id !== id) })); setSelectedIssueId(''); }
  function loadBench01() { setDesign(bench01Design()); setSelectedId('uno-1'); setSelectedPin(null); setSelectedIssueId(''); setPendingPin(null); setDrag(null); setNotice('Loaded the Bench 01 reference wiring. This is still design/rule-check mode only.'); }
  function loadI2cTutorial() { setDesign(i2cSensorTutorial()); setSelectedId('uno-1'); setSelectedPin(null); setSelectedIssueId(''); setPendingPin(null); setDrag(null); setNotice('Loaded UNO R3 + BME280 I²C teaching layout. Breadboard nodes can be used as shared wiring junctions; inspect the highlighted net before building.'); }
  function loadAnalogTutorial() { setDesign(analogBreadboardTutorial()); setSelectedId('uno-1'); setSelectedPin(null); setSelectedIssueId(''); setPendingPin(null); setDrag(null); setNotice('Loaded analog input + PWM LED teaching layout with a breadboard placement reference.'); }
  function clearDesign() { setDesign(blankDesign()); setSelectedId('uno-1'); setSelectedPin(null); setSelectedIssueId(''); setPendingPin(null); setDrag(null); setNotice('Started a new design with one UNO-compatible board.'); }

  function saveLocal() {
    try {
      localStorage.setItem('betterboard.circuit-lab.design.v01', JSON.stringify(design));
      setNotice('Saved this circuit design locally on this Mac.');
    } catch (error) {
      setNotice(`Could not save design: ${error}`);
    }
  }

  function loadLocal() {
    try {
      const raw = localStorage.getItem('betterboard.circuit-lab.design.v01');
      if (!raw) return setNotice('No locally saved circuit design was found.');
      const parsed = parseStoredCircuitDesign(raw);
      setDesign(parsed); setSelectedId(parsed.components[0]?.id || ''); setSelectedPin(null); setSelectedIssueId(''); setPendingPin(null); setDrag(null);
      setNotice('Loaded and validated the locally saved circuit design. Legacy UNO GND references are migrated automatically to GND1.');
    } catch (error) {
      setNotice(`Could not load design: ${error}`);
    }
  }

  async function copyJson() {
    try { await navigator.clipboard.writeText(JSON.stringify(design, null, 2)); setNotice('Circuit JSON copied to the clipboard.'); }
    catch (error) { setNotice(`Clipboard copy failed: ${error}`); }
  }

  function startDrag(event: React.PointerEvent<HTMLDivElement>, component: PlacedComponent) {
    if ((event.target as HTMLElement).closest('.circuit-pin')) return;
    const canvas = event.currentTarget.closest('.circuit-canvas') as HTMLElement | null;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect(); setSelectedId(component.id); setSelectedPin(null); setSelectedIssueId('');
    setDrag({ id: component.id, dx: event.clientX - rect.left - component.x, dy: event.clientY - rect.top - component.y });
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (!drag) return;
    const canvas = event.currentTarget.closest('.circuit-canvas') as HTMLElement | null;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    setDesign(current => ({ ...current, components: current.components.map(component => {
      if (component.id !== drag.id) return component;
      const spec = SPECS[component.kind];
      return { ...component, x: Math.max(4, Math.min(Math.max(4, rect.width - spec.width - 4), event.clientX - rect.left - drag.dx)), y: Math.max(4, Math.min(Math.max(4, rect.height - spec.height - 4), event.clientY - rect.top - drag.dy)) };
    }) }));
  }

  function selectIssue(issue: Issue) {
    setSelectedIssueId(issue.id); setSelectedPin(null);
    const projected = issueTargets(issue, design.components, analysisWires);
    if (projected.componentIds[0]) setSelectedId(projected.componentIds[0]);
    setNotice(projected.componentIds.length || projected.pinKeys.length || projected.wireIds.length ? `Focused diagnostic: ${issue.title}` : `${issue.title} has no reliable structured canvas target; showing the checker text only.`);
  }

  const selectedPinFound = selectedPin ? findPin(design.components, selectedPin) : null;
  const selectedPinPeers = selectedPin ? analysisWires.filter(wire => wireHas(wire, selectedPin)).map(wire => otherEnd(wire, selectedPin)).filter(Boolean) as PinRef[] : [];

  return <section className="circuit-lab">
    <div className="circuit-toolbar panel">
      <div className="circuit-title-stack">
        <div className="eyebrow">Circuit Lab</div><h2>UNO R3 Wiring Studio</h2>
        <details className="circuit-help"><summary>About this workspace & limits</summary><p className="muted">Lay out the board, breadboard and common modules, wire real UNO pin names, use common buses/junctions as shared nets, inspect connectivity and run bounded wiring checks. It is not SPICE, MCU emulation, current calculation or damage prediction.</p></details>
      </div>
      <div className="circuit-actions">
        <button className="ghost" onClick={loadBench01}><RotateCcw size={15}/> Bench 01</button>
        <button className="ghost" onClick={loadAnalogTutorial}><Lightbulb size={15}/> Analog tutorial</button>
        <button className="ghost" onClick={loadI2cTutorial}><CircuitBoard size={15}/> I²C sensor tutorial</button>
        <button className="ghost" onClick={saveLocal}><Save size={15}/> Save</button>
        <button className="ghost" onClick={loadLocal}><Clipboard size={15}/> Load</button>
        <button className="ghost" onClick={copyJson}><Clipboard size={15}/> Copy JSON</button>
        <button className="ghost" onClick={clearDesign}><Eraser size={15}/> New</button>
      </div>
    </div>

    <div className="circuit-status-row">
      <div className={`circuit-status ${counts.error ? 'bad' : counts.warning ? 'warn' : 'good'}`}><ShieldCheck size={16}/><b>{counts.error ? `${counts.error} error(s)` : counts.warning ? `${counts.warning} warning(s)` : 'No known rule violation'}</b></div>
      <div className="circuit-status"><MousePointer2 size={15}/><span>{pendingPin ? `Wiring from ${refLabel(design.components, pendingPin)}` : notice}</span></div>
      <label className="circuit-problem-toggle"><input type="checkbox" checked={showOnlyProblems} onChange={event => setShowOnlyProblems(event.target.checked)}/> Show only problems</label>
    </div>

    <div className="circuit-layout">
      <aside className="panel component-palette">
        <div className="panel-title"><Plus size={17}/> Components</div>
        {COMPONENT_GROUPS.map((group, index) => <details key={group.label} className="palette-group" open={index < 2}>
          <summary><b>{group.label}</b><span>{group.kinds.length}</span></summary>
          <div className="palette-group-items">{group.kinds.map(kind => { const spec = SPECS[kind]; return <button key={kind} className="palette-item" onClick={() => addComponent(kind)}><CircuitBoard size={18}/><span><b>{spec.title}</b><small>{spec.subtitle}</small></span><Plus size={14}/></button>; })}</div>
        </details>)}
        <details className="circuit-boundary-details"><summary><ShieldCheck size={14}/> Rule-check boundary</summary><div className="circuit-boundary">UNO R3 pin roles and bounded low-voltage wiring rules are checked. This is not SPICE, MCU emulation, current calculation, or component-damage prediction.</div></details>
      </aside>

      <div className="panel circuit-canvas-panel">
        <div className="canvas-header"><div><b>{design.name}</b><span>{design.components.length} components · {design.wires.length} wires · {analysisWires.length - design.wires.length} implicit common links</span></div><small>Click a pin to trace its whole net. Click a Rule Checker item to focus the structured target.</small></div>
        <div className="circuit-canvas" onPointerMove={moveDrag} onPointerUp={() => setDrag(null)} onPointerCancel={() => setDrag(null)}>
          <svg className="wire-layer" aria-label="Circuit wires">
            {design.wires.map(wire => {
              const fromFound = findPin(design.components, wire.from); const toFound = findPin(design.components, wire.to);
              if (!fromFound || !toFound) return null;
              const a = pinPoint(fromFound.component, fromFound.pin); const b = pinPoint(toFound.component, toFound.pin); const mx = (a.x + b.x) / 2;
              const problem = targets.wireIds.includes(wire.id) || problemTargets.wireIds.has(wire.id);
              const active = net.wireIds.has(wire.id) || targets.wireIds.includes(wire.id);
              const dim = showOnlyProblems && !problem;
              return <path key={wire.id} className={`${active ? 'diagnostic-active' : ''} ${problem ? 'diagnostic-problem' : ''} ${dim ? 'diagnostic-dim' : ''}`} d={`M ${a.x} ${a.y} C ${mx} ${a.y}, ${mx} ${b.y}, ${b.x} ${b.y}`} onClick={() => { setSelectedPin(wire.from); setSelectedIssueId(''); }} />;
            })}
          </svg>
          {design.components.map(component => {
            const spec = SPECS[component.kind];
            const problem = targets.componentIds.includes(component.id) || problemTargets.componentIds.has(component.id);
            const active = selectedId === component.id || targets.componentIds.includes(component.id) || [...net.pinKeys].some(key => key.startsWith(`${component.id}.`));
            const dim = showOnlyProblems && !problem;
            return <div key={component.id} className={`circuit-component ${component.kind} ${active ? 'selected diagnostic-active' : ''} ${problem ? 'diagnostic-problem' : ''} ${dim ? 'diagnostic-dim' : ''}`} style={{ left: component.x, top: component.y, width: spec.width, height: spec.height }} onPointerDown={event => startDrag(event, component)} onPointerMove={moveDrag} onPointerUp={() => setDrag(null)} onClick={() => { setSelectedId(component.id); setSelectedPin(null); setSelectedIssueId(''); }}>
              <div className="component-face">
                {component.kind === 'uno' ? <div className="uno-board-art" aria-hidden="true"><span className="uno-usb">USB-B</span><span className="uno-mcu">ATmega328P</span><span className="uno-jack">DC</span><span className="uno-logo">UNO R3</span></div>
                  : component.kind === 'breadboard' ? <div className="breadboard-art" aria-hidden="true"><span className="rail red"/><span className="rail blue"/><span className="breadboard-gap"/><span className="holes">••••••••••••••••••••</span></div>
                  : <CircuitBoard size={21}/>}
                <b>{spec.title}</b><span>{spec.subtitle}</span>
              </div>
              {spec.pins.map(pin => {
                const ref = { componentId: component.id, pinId: pin.id }; const key = `${component.id}.${pin.id}`;
                const pinActive = net.pinKeys.has(key) || targets.pinKeys.includes(key); const pinProblem = targets.pinKeys.includes(key) || problemTargets.pinKeys.has(key);
                return <button key={pin.id} className={`circuit-pin ${pin.side} ${pendingPin && samePin(pendingPin, ref) ? 'pending' : ''} ${pinActive ? 'diagnostic-active' : ''} ${pinProblem ? 'diagnostic-problem' : ''}`} style={pin.side === 'left' || pin.side === 'right' ? { top: pin.offset } : { left: pin.offset }} title={`${pin.label} · ${pin.role}${pin.voltage ? ` · nominal ${pin.voltage} V` : ''}`} onPointerDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); handlePin(ref); }}><i/><span>{pin.label}</span></button>;
              })}
            </div>;
          })}
        </div>
      </div>

      <aside className="circuit-right">
        <div className="panel rule-panel">
          <div className="panel-title"><ShieldCheck size={17}/> Rule Checker</div>
          <div className="rule-summary"><span className={counts.error ? 'bad' : 'good'}>{counts.error} errors</span><span className={counts.warning ? 'warn' : 'good'}>{counts.warning} warnings</span></div>
          <div className="rule-list">{issues.map(issue => <button key={issue.id} type="button" className={`rule-item ${issue.severity} ${selectedIssueId === issue.id ? 'selected' : ''}`} onClick={() => selectIssue(issue)}>
            {issue.severity === 'error' || issue.severity === 'warning' ? <AlertTriangle size={15}/> : <CheckCircle2 size={15}/>}<div><b>{issue.title}</b><span>{issue.detail}</span></div>
          </button>)}</div>
        </div>

        <div className="panel circuit-inspector">
          <div className="panel-title"><Unplug size={17}/> Inspector</div>
          {selectedPinFound ? <>
            <b>{selectedPinFound.spec.title} · {selectedPinFound.pin.label}</b><span className="muted">pin role · {selectedPinFound.pin.role}</span>
            <div className="facts"><span>Nominal voltage</span><b>{selectedPinFound.pin.voltage === undefined ? 'not specified' : `${selectedPinFound.pin.voltage} V`}</b><span>Connected peers</span><b>{selectedPinPeers.length || 'none'}</b><span>Net edges</span><b>{net.wireIds.size}</b><span>Implicit common links</span><b>{[...net.wireIds].filter(id => id.startsWith('implicit-')).length}</b></div>
            {selectedPinPeers.length > 0 && <div className="info-section">{selectedPinPeers.map(peer => <span key={`${peer.componentId}.${peer.pinId}`}>• {refLabel(design.components, peer)}</span>)}</div>}
          </> : selected ? <><b>{SPECS[selected.kind].title}</b><span className="muted">{selected.id}</span><div className="inspector-pins">{SPECS[selected.kind].pins.map(pin => <button key={pin.id} onClick={() => { setSelectedPin({ componentId: selected.id, pinId: pin.id }); setSelectedIssueId(''); }}>{pin.label}<small>{pin.role}</small></button>)}</div><button className="ghost danger" onClick={removeSelected}><Trash2 size={15}/> Delete component</button></> : <span className="muted">Select a block, pin, wire, or rule finding to inspect it.</span>}
        </div>

        <div className="panel wiring-list">
          <div className="panel-title"><Lightbulb size={17}/> Wiring list</div>
          {!design.wires.length ? <span className="muted">No wires yet.</span> : design.wires.map(wire => <div key={wire.id} className={net.wireIds.has(wire.id) ? 'diagnostic-active' : ''}><button className="wiring-focus" onClick={() => { setSelectedPin(wire.from); setSelectedIssueId(''); }}><span>{refLabel(design.components, wire.from)} <b>→</b> {refLabel(design.components, wire.to)}</span></button><button title="Delete wire" onClick={() => removeWire(wire.id)}><Trash2 size={13}/></button></div>)}
          {design.name.startsWith('Bench 01') && <button className="primary build-button" onClick={() => onUseRecipe?.('analog_a0')}>Use Bench 01 firmware</button>}
        </div>
      </aside>
    </div>
  </section>;
}
