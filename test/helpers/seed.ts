import { env } from "cloudflare:test";
import { createDb } from "../../src/db/client";
import type { AppContext } from "../../src/services/context";

export const USER_ID = "user-1";
export const FIXED_NOW = 1_000_000;

export function testDb() {
  return createDb(env.DB);
}

// Deterministic context: fixed clock, real unique ids (avoids PK collisions).
export function testContext(overrides: Partial<AppContext> = {}): AppContext {
  return {
    userId: USER_ID,
    timeZone: "Asia/Bangkok",
    gateEnabled: true,
    now: () => FIXED_NOW,
    newId: () => crypto.randomUUID(),
    ...overrides,
  };
}

// Users are the FK parent of tasks/projects/tags.
export async function seedUser(userId = USER_ID): Promise<void> {
  await env.DB.prepare(
    "INSERT INTO users (id, name, created_at) VALUES (?, ?, ?)",
  )
    .bind(userId, "Test", 1)
    .run();
}

export async function countRows(table: string): Promise<number> {
  const r = await env.DB.prepare(`SELECT count(*) AS c FROM ${table}`).first<{
    c: number;
  }>();
  return r?.c ?? 0;
}
