import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

// Wrap a D1 binding into a Drizzle client with the full schema attached.
export function createDb(d1: D1Database) {
  return drizzle(d1, { schema });
}

export type Db = ReturnType<typeof createDb>;
