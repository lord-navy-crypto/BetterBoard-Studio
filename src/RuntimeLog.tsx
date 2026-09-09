import { useMemo, useState } from 'react';
import { Eraser, TerminalSquare } from 'lucide-react';
import type { BackgroundTask } from './TaskCenter';

type Props = { tasks: BackgroundTask[] };

export default function RuntimeLog({ tasks }: Props) {
  const [filter, setFilter] = useState('');
  const lines = useMemo(() => tasks.flatMap(task => task.logs.map(line => ({
    line, category: task.category, title: task.title, state: task.state,
  }))).filter(item => !filter || `${item.category} ${item.title} ${item.line}`.toLowerCase().includes(filter.toLowerCase())).slice(-300).reverse(), [tasks, filter]);

  return <div className="panel" style={{ marginTop: 14 }}>
    <div className="panel-title" style={{ justifyContent: 'space-between' }}><span style={{ display: 'flex', alignItems: 'center', gap: 7 }}><TerminalSquare size={17}/> Runtime log</span><small className="muted">Task Center / Arduino CLI / monitor / evidence operations</small></div>
    <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}><input value={filter} onChange={event => setFilter(event.target.value)} placeholder="Filter runtime log…"/><button className="ghost mini" onClick={() => setFilter('')}><Eraser size={12}/> Clear filter</button></div>
    {!lines.length ? <div className="empty compact">No matching background log lines yet.</div> : <div className="serial-console" style={{ maxHeight: 280 }}>{lines.map((item, index) => <div key={`${item.line}-${index}`}><span>{item.category}</span><code>{item.title} · {item.line}</code></div>)}</div>}
  </div>;
}
