import type { Quadrant, TaskStatus } from "./schemas";

export interface DashTask {
  status: TaskStatus;
  quadrant: Quadrant | null;
  deadline: number | null;
  completedAt: number | null;
}

export interface DashboardSummary {
  total: number;
  byStatus: Record<TaskStatus, number>;
  completionRate: number; // done/total %
  byQuadrant: Record<Quadrant | "none", number>;
  q1Count: number;
  overdue: number;
  dueSoon: number;
}

const DUE_SOON_MS = 3 * 24 * 60 * 60 * 1000;

export function summarize(
  tasks: ReadonlyArray<DashTask>,
  now: number,
): DashboardSummary {
  const byStatus: Record<TaskStatus, number> = { todo: 0, doing: 0, done: 0 };
  const byQuadrant: Record<Quadrant | "none", number> = {
    q1: 0,
    q2: 0,
    q3: 0,
    q4: 0,
    none: 0,
  };
  let overdue = 0;
  let dueSoon = 0;
  for (const t of tasks) {
    byStatus[t.status]++;
    byQuadrant[t.quadrant ?? "none"]++;
    if (t.status !== "done" && t.deadline != null) {
      if (t.deadline < now) overdue++;
      else if (t.deadline <= now + DUE_SOON_MS) dueSoon++;
    }
  }
  const total = tasks.length;
  const completionRate =
    total > 0 ? Math.round((byStatus.done / total) * 100) : 0;
  return {
    total,
    byStatus,
    completionRate,
    byQuadrant,
    q1Count: byQuadrant.q1,
    overdue,
    dueSoon,
  };
}

// Local calendar day key "YYYY-MM-DD" for a timestamp in the given IANA zone.
function localDateKey(ms: number, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ms));
}

export interface ProductivityDay {
  date: string;
  count: number;
}

// M2/FM6: completions bucketed by LOCAL calendar day over a window ending today.
// Window days are stepped as calendar dates (DST-safe), never `now - N*86400e3`.
export function productivityByDay(
  tasks: ReadonlyArray<DashTask>,
  opts: { now: number; days?: number; timeZone: string },
): ProductivityDay[] {
  const days = opts.days ?? 7;
  const [ty, tm, td] = localDateKey(opts.now, opts.timeZone)
    .split("-")
    .map(Number);
  const windowKeys: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(ty, tm - 1, td));
    d.setUTCDate(d.getUTCDate() - i);
    windowKeys.push(d.toISOString().slice(0, 10));
  }
  const counts = new Map<string, number>(windowKeys.map((k) => [k, 0]));
  for (const t of tasks) {
    if (t.status !== "done" || t.completedAt == null) continue;
    const key = localDateKey(t.completedAt, opts.timeZone);
    const cur = counts.get(key);
    if (cur !== undefined) counts.set(key, cur + 1);
  }
  return windowKeys.map((date) => ({ date, count: counts.get(date) ?? 0 }));
}
