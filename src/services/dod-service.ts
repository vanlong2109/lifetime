import { asc, eq } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import type { Db } from "../db/client";
import { dodCriteria } from "../db/schema";
import { DomainError } from "../domain/errors";
import type { AppContext } from "./context";
import { rankAtEnd } from "./rank";
import { reconcileStatement } from "./task-access";
import { getTaskDetail, loadOwnedTask, type TaskDetail } from "./task-read";

type OwnedTask = Awaited<ReturnType<typeof loadOwnedTask>>;

function loadDod(db: Db, taskId: string) {
  return db
    .select({ id: dodCriteria.id, done: dodCriteria.done, rank: dodCriteria.rank })
    .from(dodCriteria)
    .where(eq(dodCriteria.taskId, taskId))
    .orderBy(asc(dodCriteria.rank))
    .all();
}

async function dodTaskId(db: Db, dodId: string): Promise<string> {
  const row = await db
    .select({ taskId: dodCriteria.taskId })
    .from(dodCriteria)
    .where(eq(dodCriteria.id, dodId))
    .get();
  if (!row) throw new DomainError("NOT_FOUND", 404);
  return row.taskId;
}

// Batch the child mutation with the reconcile update so the task can never be
// observed as done-with-incomplete-DoD between the two writes.
async function commit(
  db: Db,
  ctx: AppContext,
  task: OwnedTask,
  predicted: ReadonlyArray<{ done: boolean }>,
  child: BatchItem<"sqlite">,
): Promise<TaskDetail> {
  const rec = reconcileStatement(db, ctx, task, predicted);
  await db.batch(rec ? [child, rec] : [child]);
  return getTaskDetail(db, ctx, task.id);
}

export async function addDod(
  db: Db,
  ctx: AppContext,
  taskId: string,
  input: { text: string },
): Promise<TaskDetail> {
  const task = await loadOwnedTask(db, ctx, taskId);
  const dod = await loadDod(db, taskId);
  const lastRank = dod.length ? dod[dod.length - 1].rank : null;
  const child = db.insert(dodCriteria).values({
    id: ctx.newId(),
    taskId,
    text: input.text,
    done: false,
    rank: rankAtEnd(lastRank),
    createdAt: ctx.now(),
  });
  const predicted = [...dod.map((d) => ({ done: d.done })), { done: false }];
  return commit(db, ctx, task, predicted, child);
}

export async function toggleDod(
  db: Db,
  ctx: AppContext,
  dodId: string,
  input: { done: boolean },
): Promise<TaskDetail> {
  const taskId = await dodTaskId(db, dodId);
  const task = await loadOwnedTask(db, ctx, taskId);
  const dod = await loadDod(db, taskId);
  const child = db
    .update(dodCriteria)
    .set({ done: input.done })
    .where(eq(dodCriteria.id, dodId));
  const predicted = dod.map((d) => ({
    done: d.id === dodId ? input.done : d.done,
  }));
  return commit(db, ctx, task, predicted, child);
}

export async function deleteDod(
  db: Db,
  ctx: AppContext,
  dodId: string,
): Promise<TaskDetail> {
  const taskId = await dodTaskId(db, dodId);
  const task = await loadOwnedTask(db, ctx, taskId);
  const dod = await loadDod(db, taskId);
  const child = db.delete(dodCriteria).where(eq(dodCriteria.id, dodId));
  const predicted = dod
    .filter((d) => d.id !== dodId)
    .map((d) => ({ done: d.done }));
  return commit(db, ctx, task, predicted, child);
}
