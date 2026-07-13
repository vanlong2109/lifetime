import { sql } from "drizzle-orm";
import type { Db } from "../db/client";

// Self-bootstrap the single fixed user row (FK parent of tasks/projects/tags).
// Idempotent; runs once per authenticated request.
export async function ensureUser(
  db: Db,
  userId: string,
  now: number,
): Promise<void> {
  await db.run(
    sql`INSERT INTO users (id, created_at) VALUES (${userId}, ${now})
        ON CONFLICT (id) DO NOTHING`,
  );
}
