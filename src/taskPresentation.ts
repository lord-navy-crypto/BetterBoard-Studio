import type { BackgroundTask } from './TaskCenter';

export type TaskTimelineState = 'done' | 'active' | 'failed' | 'pending' | 'unknown';
export type TaskTimelineStage = { id: string; label: string; state: TaskTimelineState };

export function taskElapsedMs(task: BackgroundTask, nowMs = Date.now()): number {
  const end = task.finishedAt ?? nowMs;
  return Math.max(0, end - task.startedAt);
}

export function formatTaskDuration(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}m ${remainder}s`;
}

function evidence(text: string, pattern: RegExp) {
  return pattern.test(text);
}

export function deriveTaskTimeline(task: BackgroundTask): TaskTimelineStage[] {
  const text = [task.title, task.detail, ...task.logs].join('\n').toLowerCase();
  const definitions = task.category === 'Program'
    ? [
        { id: 'prepare', label: 'Prepare', pattern: /prepar|sketch|preflight/ },
        { id: 'compile', label: 'Compile', pattern: /compil|verify/ },
        { id: 'upload', label: 'Upload', pattern: /upload|flash/ },
      ]
    : task.category === 'Evidence'
      ? [
          { id: 'acquire', label: 'Acquire', pattern: /acquir|capture|sample|monitor/ },
          { id: 'save', label: 'Save', pattern: /save|csv|measurement/ },
          { id: 'register', label: 'Register', pattern: /register|session|metadata/ },
        ]
      : task.category === 'Monitor'
        ? [
            { id: 'open', label: 'Open', pattern: /open|start|serial/ },
            { id: 'acquire', label: 'Acquire', pattern: /live|acquir|read|sample/ },
            { id: 'stop', label: 'Stop', pattern: /stop|close|cancel/ },
          ]
        : [];

  const observed = definitions.filter(stage => evidence(text, stage.pattern));
  if (!observed.length) return [];
  const lastIndex = observed.length - 1;
  return observed.map((stage, index) => {
    let state: TaskTimelineState = 'done';
    if (index === lastIndex && task.state === 'running') state = 'active';
    if (index === lastIndex && task.state === 'failed') state = 'failed';
    if (index === lastIndex && task.state === 'cancelled') state = 'unknown';
    return { id: stage.id, label: stage.label, state };
  });
}
