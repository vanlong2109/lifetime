import { eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { tasks } from "../db/schema";
import {
  type DashTask,
  productivityByDay,
  summarize,
} from "../domain/dashboard";
import type { AppContext } from "./context";

function loadDashTasks(db: Db, ctx: AppContext): Promise<DashTask[]> {
  return db
    .select({
      status: tasks.status,
      quadrant: tasks.quadrant,
      deadline: tasks.deadline,
      completedAt: tasks.completedAt,
    })
    .from(tasks)
    .where(eq(tasks.userId, ctx.userId))
    .all();
}

export async function getDashboardSummary(db: Db, ctx: AppContext) {
  return summarize(await loadDashTasks(db, ctx), ctx.now());
}

export async function getProductivity(db: Db, ctx: AppContext, days = 7) {
  return productivityByDay(await loadDashTasks(db, ctx), {
    now: ctx.now(),
    days,
    timeZone: ctx.timeZone,
  });
}
