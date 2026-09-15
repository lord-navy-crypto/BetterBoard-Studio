import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, CircleX, Eraser, Search, TerminalSquare } from 'lucide-react';
import CopyButton from './CopyButton';
import { deriveTaskTimeline, formatTaskDuration, taskElapsedMs } from './taskPresentation';

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
};

const CATEGORIES: Array<'All' | TaskCategory> = ['All', 'Program', 'Monitor', 'Evidence', 'Analysis', 'Export', 'System'];

function stateGlyph(state: TaskState) {
  if (state === 'running') return '…';
  if (state === 'done') return '✓';
  if (state === 'cancelled') return '×';
  return '!';
}

export default function TaskCenterPanel({ tasks, onCancel, onClearFinished }: Props) {
  const [open, setOpen] = useState(true);
  const [category, setCategory] = useState<'All' | TaskCategory>('All');
  const [logQuery, setLogQuery] = useState('');
  const running = tasks.filter(task => task.state === 'running').length;
  const failed = tasks.filter(task => task.state === 'failed').length;
  const recent = tasks.filter(task => Date.now() - (task.finishedAt ?? task.startedAt) <= 15 * 60_000).length;
  const latestFailure = tasks.find(task => task.state === 'failed') ?? null;
  const visible = useMemo(() => {
    const categoryTasks = category === 'All' ? tasks : tasks.filter(task => task.category === category);
    const needle = logQuery.trim().toLowerCase();
    if (!needle) return categoryTasks;
    return categoryTasks.filter(task => [task.title, task.detail, ...task.logs].join('\n').toLowerCase().includes(needle));
  }, [tasks, category, logQuery]);

  useEffect(() => {
    const snapshot = tasks.map(({ cancel: _cancel, ...task }) => ({ ...task, cancel: undefined }));
    window.dispatchEvent(new CustomEvent<BackgroundTask[]>('betterboard:tasks-changed', { detail: snapshot }));
  }, [tasks]);

  return <section className="task-center panel">
    <div className="task-center-head">
      <button className="task-center-toggle" onClick={() => setOpen(value => !value)} aria-expanded={open}>
        <TerminalSquare size={17}/>
        <span><b>Task Center</b><small>Running {running} · Failed {failed} · Recent {recent}</small></span>
        {open ? <ChevronDown size={15}/> : <ChevronUp size={15}/>} 
      </button>
      <button className="ghost mini" onClick={onClearFinished} disabled={!tasks.some(task => task.state !== 'running')}><Eraser size={13}/> Clear finished</button>
    </div>

    {open && <>
      <div className="task-summary-grid">
        <div className="measurement"><span>Running</span><b>{running}</b></div>
        <div className="measurement"><span>Failed</span><b>{failed}</b></div>
        <div className="measurement"><span>Recent</span><b>{recent}</b></div>
        <div className="measurement"><span>History</span><b>{tasks.length}</b></div>
      </div>
      {latestFailure && <div className="boundary compact task-latest-failure"><b>Latest failure · {latestFailure.title}</b><span>{latestFailure.detail}</span><CopyButton text={latestFailure.logs.join('\n')} label="Copy logs"/></div>}
      <div className="task-category-tabs">
        {CATEGORIES.map(item => <button key={item} className={category === item ? 'active' : ''} onClick={() => setCategory(item)}>{item}</button>)}
      </div>
      <label className="task-log-search"><Search size={14}/><input value={logQuery} onChange={event => setLogQuery(event.target.value)} placeholder="Search task titles, details, and logs…"/></label>
      {!visible.length ? <div className="task-empty">No matching {category === 'All' ? '' : `${category.toLowerCase()} `}tasks. Preflight, compile, upload, monitor, capture, analysis and export operations are tracked here.</div> : <div className="task-list rich">
        {visible.map(task => {
          const timeline = deriveTaskTimeline(task);
          return <details key={task.id} className={`task-row ${task.state}`} open={task.state === 'running' || task.id === latestFailure?.id}>
            <summary>
              <span className={`task-icon ${task.state}`}>{stateGlyph(task.state)}</span>
              <span className="task-category">{task.category}</span>
              <span className="task-main"><b>{task.title}</b><small>{task.detail}</small></span>
              <span className="task-time">{formatTaskDuration(taskElapsedMs(task))}</span>
              {task.state === 'running' && task.cancellable && <button className="danger-soft mini" onClick={event => { event.preventDefault(); event.stopPropagation(); void onCancel(task.id); }}><CircleX size={13}/> Cancel</button>}
            </summary>
            {timeline.length > 0 && <div className="task-timeline" aria-label={`${task.title} observed stages`}>{timeline.map(stage => <span key={stage.id} className={`task-stage ${stage.state}`}><i/>{stage.label}<small>{stage.state}</small></span>)}</div>}
            <div className="task-log-actions"><span>Started {new Date(task.startedAt).toLocaleTimeString([], { hour12: false })}</span><CopyButton text={task.logs.join('\n')} label="Copy logs"/></div>
            <pre className="task-log">{task.logs.length ? task.logs.join('\n') : 'No detailed log lines yet.'}</pre>
          </details>;
        })}
      </div>}
    </>}
  </section>;
}
