export type DiagnosticPinRef = { componentId: string; pinId: string };
export type DiagnosticWire = { id: string; from: DiagnosticPinRef; to: DiagnosticPinRef };
export type DiagnosticComponent = { id: string };
export type DiagnosticIssue = { id: string; severity: string; title: string; detail: string };

function pinKey(ref: DiagnosticPinRef) {
  return `${ref.componentId}.${ref.pinId}`;
}

export function connectedNet(start: DiagnosticPinRef, wires: DiagnosticWire[]) {
  const pinKeys = new Set<string>([pinKey(start)]);
  const wireIds = new Set<string>();
  const queue: DiagnosticPinRef[] = [start];
  while (queue.length) {
    const current = queue.shift()!;
    const currentKey = pinKey(current);
    for (const wire of wires) {
      const fromKey = pinKey(wire.from);
      const toKey = pinKey(wire.to);
      if (fromKey !== currentKey && toKey !== currentKey) continue;
      wireIds.add(wire.id);
      const other = fromKey === currentKey ? wire.to : wire.from;
      const otherKey = pinKey(other);
      if (!pinKeys.has(otherKey)) {
        pinKeys.add(otherKey);
        queue.push(other);
      }
    }
  }
  return { pinKeys, wireIds };
}

export function issueTargets(issue: DiagnosticIssue, components: DiagnosticComponent[], wires: DiagnosticWire[]) {
  const componentIds = new Set<string>();
  const pinKeys = new Set<string>();
  const wireIds = new Set<string>();

  const wire = wires.find(item => issue.id === `dangling-${item.id}` || issue.id === `short-${item.id}` || issue.id === `rails-${item.id}` || issue.id === `power-io-${item.id}`);
  if (wire) {
    wireIds.add(wire.id);
    componentIds.add(wire.from.componentId);
    componentIds.add(wire.to.componentId);
    pinKeys.add(pinKey(wire.from));
    pinKeys.add(pinKey(wire.to));
  }

  if (issue.id.startsWith('net-short::') || issue.id.startsWith('net-rail-conflict::')) {
    const parts = issue.id.split('::');
    if (parts.length >= 3) {
      const componentId = parts[1];
      const pinId = parts[2];
      componentIds.add(componentId);
      pinKeys.add(`${componentId}.${pinId}`);
    }
  }

  for (const component of components) {
    if (issue.id === component.id || issue.id.startsWith(`${component.id}-`)) {
      componentIds.add(component.id);
      const suffix = issue.id.slice(component.id.length + 1);
      const pinId = suffix.split('-')[0];
      if (pinId && !['no', 'resistor', 'open'].includes(pinId)) pinKeys.add(`${component.id}.${pinId}`);
    }
  }

  return { componentIds: [...componentIds], pinKeys: [...pinKeys], wireIds: [...wireIds] };
}
