import { and, asc, eq, sql } from "drizzle-orm";
import type { Db } from "../db/client";
import { tags, taskTags } from "../db/schema";
import type { AppContext } from "./context";

// Dedup happens in the DB via the unique index on (user_id, lower(name)).
// INSERT ... ON CONFLICT DO NOTHING then SELECT -> no app-level read-then-write
// race (finding C4). The first writer's casing is preserved.
export async function ensureTag(
  db: Db,
  ctx: AppContext,
  name: string,
): Promise<{ id: string; name: string }> {
  await db.run(
    sql`INSERT INTO tags (id, user_id, name, created_at)
        VALUES (${ctx.newId()}, ${ctx.userId}, ${name}, ${ctx.now()})
        ON CONFLICT (user_id, lower(name)) DO NOTHING`,
  );
  const row = await db
    .select({ id: tags.id, name: tags.name })
    .from(tags)
    .where(
      and(eq(tags.userId, ctx.userId), sql`lower(${tags.name}) = lower(${name})`),
    )
    .get();
  if (!row) throw new Error("tag ensure failed");
  return row;
}

export function createTag(db: Db, ctx: AppContext, input: { name: string }) {
  return ensureTag(db, ctx, input.name);
}

export function listTags(db: Db, ctx: AppContext) {
  return db
    .select({ id: tags.id, name: tags.name })
    .from(tags)
    .where(eq(tags.userId, ctx.userId))
    .orderBy(asc(tags.name))
    .all();
}

// Replace a task's tag links with the given names (each deduped via ensureTag).
// The link swap (delete old + insert new) is batched so links are never
// observed missing mid-operation (finding M-3).
export async function syncTaskTags(
  db: Db,
  ctx: AppContext,
  taskId: string,
  names: string[],
): Promise<void> {
  const unique = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  const tagIds: string[] = [];
  for (const n of unique) tagIds.push((await ensureTag(db, ctx, n)).id);
  await db.batch([
    db.delete(taskTags).where(eq(taskTags.taskId, taskId)),
    ...tagIds.map((tagId) =>
      db.insert(taskTags).values({ taskId, tagId }).onConflictDoNothing(),
    ),
  ]);
}
