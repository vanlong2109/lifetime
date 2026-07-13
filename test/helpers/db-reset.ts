import { env } from "cloudflare:test";

// Deterministic clean slate between tests. Deletes child-before-parent and wraps
// in a single batch with defer_foreign_keys as a safety net. Also used by the
// P5 parity test which must reset D1 between the REST and MCP runs.
export async function resetDb(): Promise<void> {
  await env.DB.batch([
    env.DB.prepare("PRAGMA defer_foreign_keys=TRUE"),
    env.DB.prepare("DELETE FROM task_tags"),
    env.DB.prepare("DELETE FROM subtasks"),
    env.DB.prepare("DELETE FROM dod_criteria"),
    env.DB.prepare("DELETE FROM tasks"),
    env.DB.prepare("DELETE FROM tags"),
    env.DB.prepare("DELETE FROM projects"),
    env.DB.prepare("DELETE FROM users"),
  ]);
}
