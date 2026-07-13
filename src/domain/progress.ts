import type { TaskStatus } from "./schemas";

export interface ProgressResult {
  progress: number; // 0-100
  dodDone: number;
  dodTotal: number;
  subDone: number;
  subTotal: number;
}

// When a task has no DoD/subtask items, progress is inferred from status.
const NO_ITEM_PROGRESS: Record<TaskStatus, number> = {
  todo: 0,
  doing: 40,
  done: 100,
};

export interface ProgressCounts {
  dodDone: number;
  dodTotal: number;
  subDone: number;
  subTotal: number;
}

// Pure percentage from raw counts (used by list reads that aggregate in SQL).
export function progressFromCounts(
  c: ProgressCounts,
  status: TaskStatus,
): number {
  const total = c.dodTotal + c.subTotal;
  const done = c.dodDone + c.subDone;
  return total > 0 ? Math.round((done / total) * 100) : NO_ITEM_PROGRESS[status];
}

// Pure: progress across DoD + subtasks combined, else the status-inferred value.
export function computeProgress(
  dod: ReadonlyArray<{ done: boolean }>,
  subtasks: ReadonlyArray<{ done: boolean }>,
  status: TaskStatus,
): ProgressResult {
  const counts: ProgressCounts = {
    dodTotal: dod.length,
    subTotal: subtasks.length,
    dodDone: dod.reduce((n, d) => n + (d.done ? 1 : 0), 0),
    subDone: subtasks.reduce((n, s) => n + (s.done ? 1 : 0), 0),
  };
  return { progress: progressFromCounts(counts, status), ...counts };
}
