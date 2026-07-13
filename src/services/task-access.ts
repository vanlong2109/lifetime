import { eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { tasks } from "../db/schema";
import type { TaskStatus } from "../domain/schemas";
import { reconcileOnChildChange } from "../domain/status-lifecycle";
import type { AppContext } from "./context";

// Build the task-status reconcile UPDATE for a PREDICTED post-mutation DoD
// state, or null when nothing changes. Returning a statement (not executing it)
// lets the caller db.batch() it atomically with the child mutation — no
// read-after-write window (findings H3 + M-3). Only DoD gates `done`.
export function reconcileStatement(
  db: Db,
  ctx: AppContext,
  task: { id: string; status: TaskStatus; completedAt: number | null },
  predictedDod: ReadonlyArray<{ done: boolean }>,
) {
  const res = reconcileOnChildChange(task, predictedDod, ctx.gateEnabled);
  if (res.status === task.status && res.completedAt === task.completedAt) {
    return null;
  }
  return db
    .update(tasks)
    .set({
      status: res.status,
      completedAt: res.completedAt,
      updatedAt: ctx.now(),
    })
    .where(eq(tasks.id, task.id));
}
