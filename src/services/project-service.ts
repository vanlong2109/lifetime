import { asc, eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { projects } from "../db/schema";
import type { AppContext } from "./context";
import { assertOwned } from "./ownership";

// Guard a referenced projectId: missing -> 404, other user's -> 403. Keeps the
// task->project reference within the ownership contract (avoids an opaque 500
// from a raw FK violation).
export async function assertProjectOwned(
  db: Db,
  ctx: AppContext,
  projectId: string,
): Promise<void> {
  const p = await db
    .select({ userId: projects.userId })
    .from(projects)
    .where(eq(projects.id, projectId))
    .get();
  assertOwned(p, ctx.userId);
}

export async function createProject(
  db: Db,
  ctx: AppContext,
  input: { name: string; color?: string | null },
): Promise<{ id: string; name: string; color: string | null }> {
  const id = ctx.newId();
  const color = input.color ?? null;
  await db.insert(projects).values({
    id,
    userId: ctx.userId,
    name: input.name,
    color,
    createdAt: ctx.now(),
  });
  return { id, name: input.name, color };
}

export function listProjects(db: Db, ctx: AppContext) {
  return db
    .select({ id: projects.id, name: projects.name, color: projects.color })
    .from(projects)
    .where(eq(projects.userId, ctx.userId))
    .orderBy(asc(projects.name))
    .all();
}
