import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "../db/client";
import { dodCriteria, subtasks, tags, taskTags, tasks } from "../db/schema";
import { type ProgressCounts, progressFromCounts } from "../domain/progress";
import type { Quadrant, TaskStatus } from "../domain/schemas";
import type { AppContext } from "./context";
import { assertOwned } from "./ownership";

type TaskRow = typeof tasks.$inferSelect;

export interface DodView {
  id: string;
  text: string;
  done: boolean;
  rank: string;
}
export interface SubtaskView {
  id: string;
  title: string;
  done: boolean;
  rank: string;
}

export interface TaskListItem extends ProgressCounts {
  id: string;
  title: string;
  quadrant: Quadrant | null;
  status: TaskStatus;
  deadline: number | null;
  timeBlock: string | null;
  method: string | null;
  projectId: string | null;
  rank: string;
  completedAt: number | null;
  createdAt: number;
  updatedAt: number;
  progress: number;
  tags: string[];
}

export interface TaskDetail extends TaskListItem {
  dod: DodView[];
  subtasks: SubtaskView[];
}

export interface TaskFilter {
  status?: TaskStatus;
  quadrant?: Quadrant;
}

function scalarFields(t: TaskRow) {
  return {
    id: t.id,
    title: t.title,
    quadrant: t.quadrant,
    status: t.status,
    deadline: t.deadline,
    timeBlock: t.timeBlock,
    method: t.method,
    projectId: t.projectId,
    rank: t.rank,
    completedAt: t.completedAt,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

async function loadTagNames(
  db: Db,
  ids: string[],
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (ids.length === 0) return map;
  const rows = await db
    .select({ taskId: taskTags.taskId, name: tags.name })
    .from(taskTags)
    .innerJoin(tags, eq(taskTags.tagId, tags.id))
    .where(inArray(taskTags.taskId, ids))
    .all();
  for (const r of rows) {
    const arr = map.get(r.taskId) ?? [];
    arr.push(r.name);
    map.set(r.taskId, arr);
  }
  return map;
}

// Minimal task fetch scoped by ownership (used by child-mutation services).
export async function loadOwnedTask(db: Db, ctx: AppContext, taskId: string) {
  const t = await db
    .select({
      id: tasks.id,
      userId: tasks.userId,
      status: tasks.status,
      completedAt: tasks.completedAt,
    })
    .from(tasks)
    .where(eq(tasks.id, taskId))
    .get();
  assertOwned(t, ctx.userId);
  return t;
}

export async function getTaskDetail(
  db: Db,
  ctx: AppContext,
  id: string,
): Promise<TaskDetail> {
  const t = await db.select().from(tasks).where(eq(tasks.id, id)).get();
  assertOwned(t, ctx.userId);
  const dod = await db
    .select()
    .from(dodCriteria)
    .where(eq(dodCriteria.taskId, id))
    .orderBy(asc(dodCriteria.rank))
    .all();
  const subs = await db
    .select()
    .from(subtasks)
    .where(eq(subtasks.taskId, id))
    .orderBy(asc(subtasks.rank))
    .all();
  const tagNames = await loadTagNames(db, [id]);
  const counts: ProgressCounts = {
    dodTotal: dod.length,
    dodDone: dod.filter((d) => d.done).length,
    subTotal: subs.length,
    subDone: subs.filter((s) => s.done).length,
  };
  return {
    ...scalarFields(t),
    ...counts,
    progress: progressFromCounts(counts, t.status),
    tags: tagNames.get(id) ?? [],
    dod: dod.map((d) => ({ id: d.id, text: d.text, done: d.done, rank: d.rank })),
    subtasks: subs.map((s) => ({
      id: s.id,
      title: s.title,
      done: s.done,
      rank: s.rank,
    })),
  };
}

export async function listTasks(
  db: Db,
  ctx: AppContext,
  filter: TaskFilter = {},
): Promise<TaskListItem[]> {
  const conds = [eq(tasks.userId, ctx.userId)];
  if (filter.status) conds.push(eq(tasks.status, filter.status));
  if (filter.quadrant) conds.push(eq(tasks.quadrant, filter.quadrant));
  const rows = await db
    .select()
    .from(tasks)
    .where(and(...conds))
    .orderBy(asc(tasks.rank))
    .all();
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const dodMap = await countChildren(db, "dod_criteria", ids);
  const subMap = await countChildren(db, "subtasks", ids);
  const tagNames = await loadTagNames(db, ids);
  return rows.map((t) => {
    const counts: ProgressCounts = {
      dodTotal: dodMap.get(t.id)?.total ?? 0,
      dodDone: dodMap.get(t.id)?.done ?? 0,
      subTotal: subMap.get(t.id)?.total ?? 0,
      subDone: subMap.get(t.id)?.done ?? 0,
    };
    return {
      ...scalarFields(t),
      ...counts,
      progress: progressFromCounts(counts, t.status),
      tags: tagNames.get(t.id) ?? [],
    };
  });
}

// Grouped done/total counts for a child table, keyed by task id.
async function countChildren(
  db: Db,
  table: "dod_criteria" | "subtasks",
  ids: string[],
): Promise<Map<string, { total: number; done: number }>> {
  const child = table === "dod_criteria" ? dodCriteria : subtasks;
  const rows = await db
    .select({
      taskId: child.taskId,
      total: sql<number>`count(*)`,
      done: sql<number>`sum(case when ${child.done} then 1 else 0 end)`,
    })
    .from(child)
    .where(inArray(child.taskId, ids))
    .groupBy(child.taskId)
    .all();
  const map = new Map<string, { total: number; done: number }>();
  for (const r of rows) map.set(r.taskId, { total: r.total, done: r.done });
  return map;
}
