import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { BackgroundTask, TaskCategory, TaskState } from './TaskCenter';

export const TASK_MEMORY_KEY = 'betterboard.task-center.v1';

function restoreTaskMemory(): BackgroundTask[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(TASK_MEMORY_KEY) || '[]') as BackgroundTask[];
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, 80).map(task => task.state === 'running'
      ? {
          ...task,
          state: 'failed' as const,
          detail: 'Previous app session ended before this task reported completion.',
          logs: [...(task.logs ?? []), 'App session ended while this task was still marked running.'].slice(-160),
          finishedAt: Date.now(),
          cancellable: false,
          cancel: undefined,
        }
      : { ...task, logs: task.logs ?? [], cancellable: false, cancel: undefined });
  } catch {
    return [];
  }
}

type TaskRuntimeValue = {
  tasks: BackgroundTask[];
  runningTasks: BackgroundTask[];
  addTask: (category: TaskCategory, title: string, detail?: string, cancel?: () => Promise<void> | void) => number;
  logTask: (id: number, message: string) => void;
  finishTask: (id: number, state: Exclude<TaskState, 'running'>, detail: string) => void;
  cancelTask: (id: number) => Promise<void>;
  clearFinishedTasks: () => void;
};

const TaskRuntimeContext = createContext<TaskRuntimeValue | null>(null);

export function TaskRuntimeProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<BackgroundTask[]>(restoreTaskMemory);

  useEffect(() => {
    if (typeof localStorage === 'undefined') return;
    const serializable = tasks.slice(0, 80).map(({ cancel: _cancel, ...task }) => ({
      ...task,
      cancellable: task.state === 'running' ? task.cancellable : false,
    }));
    localStorage.setItem(TASK_MEMORY_KEY, JSON.stringify(serializable));
  }, [tasks]);

  const addTask = useCallback((category: TaskCategory, title: string, detail = 'Starting…', cancel?: () => Promise<void> | void) => {
    const id = Date.now() * 1000 + Math.floor(Math.random() * 1000);
    const now = Date.now();
    const task: BackgroundTask = {
      id,
      category,
      title,
      state: 'running',
      detail,
      logs: [`${new Date(now).toLocaleTimeString([], { hour12: false })} · ${detail}`],
      startedAt: now,
      cancellable: Boolean(cancel),
      cancel,
    };
    setTasks(current => [task, ...current].slice(0, 80));
    return id;
  }, []);

  const logTask = useCallback((id: number, message: string) => {
    const line = `${new Date().toLocaleTimeString([], { hour12: false })} · ${message}`;
    setTasks(current => current.map(task => task.id === id
      ? { ...task, detail: message, logs: [...(task.logs ?? []), line].slice(-160) }
      : task));
  }, []);

  const finishTask = useCallback((id: number, state: Exclude<TaskState, 'running'>, detail: string) => {
    const line = `${new Date().toLocaleTimeString([], { hour12: false })} · ${detail}`;
    setTasks(current => current.map(task => task.id === id && task.state === 'running'
      ? {
          ...task,
          state,
          detail,
          logs: [...(task.logs ?? []), line].slice(-160),
          finishedAt: Date.now(),
          cancellable: false,
          cancel: undefined,
        }
      : task));
  }, []);

  const cancelTask = useCallback(async (id: number) => {
    const task = tasks.find(item => item.id === id);
    if (!task || task.state !== 'running' || !task.cancel) return;
    logTask(id, 'Cancellation requested…');
    try {
      await task.cancel();
      finishTask(id, 'cancelled', 'Cancelled by user');
    } catch (error) {
      logTask(id, `Cancel failed: ${error}`);
      finishTask(id, 'failed', `Cancellation failed: ${error}`);
    }
  }, [tasks, logTask, finishTask]);

  const clearFinishedTasks = useCallback(() => {
    setTasks(current => current.filter(task => task.state === 'running'));
  }, []);

  const runningTasks = useMemo(() => tasks.filter(task => task.state === 'running'), [tasks]);
  const value = useMemo<TaskRuntimeValue>(() => ({
    tasks,
    runningTasks,
    addTask,
    logTask,
    finishTask,
    cancelTask,
    clearFinishedTasks,
  }), [tasks, runningTasks, addTask, logTask, finishTask, cancelTask, clearFinishedTasks]);

  return <TaskRuntimeContext.Provider value={value}>{children}</TaskRuntimeContext.Provider>;
}

export function useTaskRuntime() {
  const value = useContext(TaskRuntimeContext);
  if (!value) throw new Error('useTaskRuntime must be used inside TaskRuntimeProvider');
  return value;
}
