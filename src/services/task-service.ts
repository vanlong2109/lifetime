import { desc, eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { dodCriteria, tasks } from "../db/schema";
import { DomainError } from "../domain/errors";
import type {
  TaskCreateInput,
  TaskMoveInput,
  TaskPatchInput,
} from "../domain/schemas";
import {
  applyStatusTransition,
  assertDodComplete,
} from "../domain/status-lifecycle";
import type { AppContext } from "./context";
import { assertOwned } from "./ownership";
import { assertProjectOwned } from "./project-service";
import { rankAtEnd, rankBetween } from "./rank";
import { getTaskDetail, type TaskDetail } from "./task-read";
import { syncTaskTags } from "./tag-service";

type TaskInsert = typeof tasks.$inferInsert;

export async function createTask(
  db: Db,
  ctx: AppContext,
  input: TaskCreateInput,
): Promise<TaskDetail> {
  if (input.projectId) await assertProjectOwned(db, ctx, input.projectId);
  const id = ctx.newId();
  const now = ctx.now();
  const last = await db
    .select({ rank: tasks.rank })
    .from(tasks)
    .where(eq(tasks.userId, ctx.userId))
    .orderBy(desc(tasks.rank))
    .limit(1)
    .get();
  const status = input.status ?? "todo";
  await db.insert(tasks).values({
    id,
    userId: ctx.userId,
    title: input.title,
    quadrant: input.quadrant ?? null,
    status,
    deadline: input.deadline ?? null,
    timeBlock: input.timeBlock ?? null,
    method: input.method ?? null,
    projectId: input.projectId ?? null,
    rank: rankAtEnd(last?.rank ?? null),
    completedAt: status === "done" ? now : null,
    createdAt: now,
    updatedAt: now,
  });
  if (input.tags?.length) await syncTaskTags(db, ctx, id, input.tags);
  return getTaskDetail(db, ctx, id);
}

export async function patchTask(
  db: Db,
  ctx: AppContext,
  id: string,
  input: TaskPatchInput,
): Promise<TaskDetail> {
  const t = await db.select().from(tasks).where(eq(tasks.id, id)).get();
  assertOwned(t, ctx.userId);
  if (input.projectId) await assertProjectOwned(db, ctx, input.projectId);
  const now = ctx.now();
  const set: Partial<TaskInsert> = { updatedAt: now };
  if (input.title !== undefined) set.title = input.title;
  if (input.quadrant !== undefined) set.quadrant = input.quadrant;
  if (input.deadline !== undefined) set.deadline = input.deadline;
  if (input.timeBlock !== undefined) set.timeBlock = input.timeBlock;
  if (input.method !== undefined) set.method = input.method;
  if (input.projectId !== undefined) set.projectId = input.projectId;

  if (input.status !== undefined && input.status !== t.status) {
    if (input.status === "done") {
      const dod = await db
        .select({ done: dodCriteria.done })
        .from(dodCriteria)
        .where(eq(dodCriteria.taskId, id))
        .all();
      assertDodComplete(dod, ctx.gateEnabled);
    }
    const res = applyStatusTransition(t.status, input.status, now, t.completedAt);
    set.status = res.status;
    set.completedAt = res.completedAt;
  }

  await db.update(tasks).set(set).where(eq(tasks.id, id));
  if (input.tags !== undefined) await syncTaskTags(db, ctx, id, input.tags);
  return getTaskDetail(db, ctx, id);
}

// move only changes rank (+ optional quadrant). Never status — status changes
// must go through patch so the DoD-gate is never bypassed (findings C2/H2).
export async function moveTask(
  db: Db,
  ctx: AppContext,
  id: string,
  input: TaskMoveInput,
): Promise<TaskDetail> {
  const t = await db
    .select({ userId: tasks.userId })
    .from(tasks)
    .where(eq(tasks.id, id))
    .get();
  assertOwned(t, ctx.userId);
  const prev = input.prevId ? await ownedRank(db, ctx, input.prevId) : null;
  const next = input.nextId ? await ownedRank(db, ctx, input.nextId) : null;
  const set: Partial<TaskInsert> = { updatedAt: ctx.now() };
  // Only recompute rank when a real reposition is requested. A move with no
  // neighbors (e.g. quadrant-only recategorization) must NOT overwrite rank —
  // generateKeyBetween(null, null) is the constant "a0" and would collide with
  // the first task, corrupting order (finding H2, no unique index backstops it).
  if (prev !== null || next !== null) {
    try {
      set.rank = rankBetween(prev, next);
    } catch {
      // Neighbors out of order / equal -> actionable 4xx, not an opaque 500.
      throw new DomainError("VALIDATION", 422, "invalid move position");
    }
  }
  if (input.quadrant !== undefined) set.quadrant = input.quadrant;
  await db.update(tasks).set(set).where(eq(tasks.id, id));
  return getTaskDetail(db, ctx, id);
}

export async function removeTask(
  db: Db,
  ctx: AppContext,
  id: string,
): Promise<{ id: string }> {
  const t = await db
    .select({ userId: tasks.userId })
    .from(tasks)
    .where(eq(tasks.id, id))
    .get();
  assertOwned(t, ctx.userId);
  await db.delete(tasks).where(eq(tasks.id, id)); // FK cascade removes children
  return { id };
}

async function ownedRank(
  db: Db,
  ctx: AppContext,
  id: string,
): Promise<string> {
  const n = await db
    .select({ userId: tasks.userId, rank: tasks.rank })
    .from(tasks)
    .where(eq(tasks.id, id))
    .get();
  assertOwned(n, ctx.userId);
  return n.rank;
}
