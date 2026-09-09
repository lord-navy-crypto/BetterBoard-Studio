import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, CircleX, Eraser, TerminalSquare } from 'lucide-react';

export type TaskCategory = 'Program' | 'Monitor' | 'Evidence' | 'Analysis' | 'Export' | 'System';
export type TaskState = 'running' | 'done' | 'failed' | 'cancelled';

export type BackgroundTask = {
  id: number;
  category: TaskCategory;
  title: string;
  state: TaskState;
  detail: string;
  logs: string[];
  startedAt: number;
  finishedAt?: number;
  cancellable?: boolean;
  cancel?: () => Promise<void> | void;
};

type Props = {
  tasks: BackgroundTask[];
  onCancel: (id: number) => void | Promise<void>;
  onClearFinished: () => void;
  defaultOpen?: boolean;
};

const CATEGORIES: Array<'All' | TaskCategory> = ['All', 'Program', 'Monitor', 'Evidence', 'Analysis', 'Export', 'System'];

function stateGlyph(state: TaskState) {
  if (state === 'running') return '…';
  if (state === 'done') return '✓';
  if (state === 'cancelled') return '×';
  return '!';
}

export default function TaskCenterPanel({ tasks, onCancel, onClearFinished, defaultOpen = true }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const [category, setCategory] = useState<'All' | TaskCategory>('All');
  const visible = useMemo(() => category === 'All' ? tasks : tasks.filter(task => task.category === category), [tasks, category]);
  const running = tasks.filter(task => task.state === 'running').length;
  const failed = tasks.filter(task => task.state === 'failed').length;

  return <section className="task-center panel">
    <div className="task-center-head">
      <button className="task-center-toggle" onClick={() => setOpen(value => !value)} aria-expanded={open}>
        <TerminalSquare size={17}/>
        <span><b>Task Center</b><small>{running ? `${running} running` : 'background history'}{failed ? ` · ${failed} failed` : ''}</small></span>
        {open ? <ChevronDown size={15}/> : <ChevronUp size={15}/>}
      </button>
      <button className="ghost mini" onClick={onClearFinished} disabled={!tasks.some(task => task.state !== 'running')}><Eraser size={13}/> Clear finished</button>
    </div>

    {open && <>
      <div className="task-category-tabs">
        {CATEGORIES.map(item => <button key={item} className={category === item ? 'active' : ''} onClick={() => setCategory(item)}>{item}</button>)}
      </div>
      {!visible.length ? <div className="task-empty">No {category === 'All' ? '' : `${category.toLowerCase()} `}tasks yet. Preflight, compile, upload, monitor, capture, analysis and export operations are tracked here.</div> : <div className="task-list rich">
        {visible.map(task => <details key={task.id} className={`task-row ${task.state}`} open={task.state === 'running'}>
          <summary>
            <span className={`task-icon ${task.state}`}>{stateGlyph(task.state)}</span>
            <span className="task-category">{task.category}</span>
            <span className="task-main"><b>{task.title}</b><small>{task.detail}</small></span>
            <span className="task-time">{new Date(task.startedAt).toLocaleTimeString([], { hour12: false })}</span>
            {task.state === 'running' && task.cancellable && <button className="danger-soft mini" onClick={event => { event.preventDefault(); event.stopPropagation(); void onCancel(task.id); }}><CircleX size={13}/> Cancel</button>}
          </summary>
          <pre className="task-log">{task.logs.length ? task.logs.join('\n') : 'No detailed log lines yet.'}</pre>
        </details>)}
      </div>}
    </>}
  </section>;
}
