import { desc, eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { subtasks } from "../db/schema";
import { DomainError } from "../domain/errors";
import type { AppContext } from "./context";
import { rankAtEnd } from "./rank";
import { getTaskDetail, loadOwnedTask, type TaskDetail } from "./task-read";

// Subtasks contribute to progress but do NOT gate `done` (only DoD does), so no
// status reconciliation is needed — each mutation is a single atomic write.

async function subtaskTaskId(db: Db, subtaskId: string): Promise<string> {
  const row = await db
    .select({ taskId: subtasks.taskId })
    .from(subtasks)
    .where(eq(subtasks.id, subtaskId))
    .get();
  if (!row) throw new DomainError("NOT_FOUND", 404);
  return row.taskId;
}

export async function addSubtask(
  db: Db,
  ctx: AppContext,
  taskId: string,
  input: { title: string },
): Promise<TaskDetail> {
  const task = await loadOwnedTask(db, ctx, taskId);
  const last = await db
    .select({ rank: subtasks.rank })
    .from(subtasks)
    .where(eq(subtasks.taskId, taskId))
    .orderBy(desc(subtasks.rank))
    .limit(1)
    .get();
  await db.insert(subtasks).values({
    id: ctx.newId(),
    taskId,
    title: input.title,
    done: false,
    rank: rankAtEnd(last?.rank ?? null),
    createdAt: ctx.now(),
  });
  return getTaskDetail(db, ctx, task.id);
}

export async function toggleSubtask(
  db: Db,
  ctx: AppContext,
  subtaskId: string,
  input: { done: boolean },
): Promise<TaskDetail> {
  const taskId = await subtaskTaskId(db, subtaskId);
  const task = await loadOwnedTask(db, ctx, taskId);
  await db
    .update(subtasks)
    .set({ done: input.done })
    .where(eq(subtasks.id, subtaskId));
  return getTaskDetail(db, ctx, task.id);
}

export async function deleteSubtask(
  db: Db,
  ctx: AppContext,
  subtaskId: string,
): Promise<TaskDetail> {
  const taskId = await subtaskTaskId(db, subtaskId);
  const task = await loadOwnedTask(db, ctx, taskId);
  await db.delete(subtasks).where(eq(subtasks.id, subtaskId));
  return getTaskDetail(db, ctx, task.id);
}
