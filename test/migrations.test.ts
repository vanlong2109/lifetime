import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { resetDb } from "./helpers/db-reset";

beforeEach(resetDb);

const DOMAIN_TABLES = [
  "users",
  "projects",
  "tags",
  "tasks",
  "task_tags",
  "dod_criteria",
  "subtasks",
];

async function tableNames(): Promise<string[]> {
  const { results } = await env.DB.prepare(
    `SELECT name FROM sqlite_master
       WHERE type='table'
         AND name NOT LIKE 'sqlite_%'
         AND name NOT LIKE '_cf_%'
         AND name NOT LIKE 'd1_%'`,
  ).all<{ name: string }>();
  return results.map((r) => r.name);
}

async function seedTaskWithChildren(): Promise<void> {
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO users (id, name, created_at) VALUES ('u1', 'U', 1)",
    ),
    env.DB.prepare(
      `INSERT INTO tasks (id, user_id, title, status, rank, created_at, updated_at)
         VALUES ('t1', 'u1', 'Parent', 'todo', 'a0', 1, 1)`,
    ),
    env.DB.prepare(
      `INSERT INTO dod_criteria (id, task_id, text, done, rank, created_at)
         VALUES ('d1', 't1', 'crit', 0, 'a0', 1)`,
    ),
    env.DB.prepare(
      `INSERT INTO subtasks (id, task_id, title, done, rank, created_at)
         VALUES ('s1', 't1', 'sub', 0, 'a0', 1)`,
    ),
  ]);
}

async function childCounts(): Promise<{ dod: number; sub: number }> {
  const dod = await env.DB.prepare(
    "SELECT count(*) AS c FROM dod_criteria WHERE task_id = 't1'",
  ).first<{ c: number }>();
  const sub = await env.DB.prepare(
    "SELECT count(*) AS c FROM subtasks WHERE task_id = 't1'",
  ).first<{ c: number }>();
  return { dod: dod!.c, sub: sub!.c };
}

// SAFE pattern: additive, in-place ALTER. Modern SQLite (D1) supports
// ADD/DROP/RENAME COLUMN without a table rebuild, so cascade children are never
// touched. This is the migration strategy the project commits to (finding C3).
async function addColumnInPlace(): Promise<void> {
  await env.DB.prepare("ALTER TABLE tasks ADD COLUMN note text").run();
}

// FORBIDDEN pattern (kept as an executable warning): a drop+recreate rebuild.
// In D1 the FK is always enforced and `DROP TABLE tasks` fires ON DELETE CASCADE
// on children *even inside a batch with defer_foreign_keys* — defer postpones
// constraint *checking*, not the cascade *action*. Children are lost.
async function rebuildTasksTable(): Promise<void> {
  await env.DB.batch([
    env.DB.prepare("PRAGMA defer_foreign_keys=TRUE"),
    env.DB.prepare(
      `CREATE TABLE tasks_new (
         id text PRIMARY KEY NOT NULL,
         user_id text NOT NULL,
         title text NOT NULL,
         quadrant text,
         status text DEFAULT 'todo' NOT NULL,
         deadline integer,
         time_block text,
         method text,
         project_id text,
         rank text NOT NULL,
         completed_at integer,
         created_at integer NOT NULL,
         updated_at integer NOT NULL,
         FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE cascade,
         FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE set null
       )`,
    ),
    env.DB.prepare(
      `INSERT INTO tasks_new
         SELECT id, user_id, title, quadrant, status, deadline, time_block,
                method, project_id, rank, completed_at, created_at, updated_at
           FROM tasks`,
    ),
    env.DB.prepare("DROP TABLE tasks"),
    env.DB.prepare("ALTER TABLE tasks_new RENAME TO tasks"),
  ]);
}

describe("migration schema", () => {
  it("creates all 7 domain tables", async () => {
    const names = await tableNames();
    for (const t of DOMAIN_TABLES) expect(names).toContain(t);
  });

  it("enforces tag dedup via lower(name) unique index", async () => {
    await env.DB.prepare(
      "INSERT INTO users (id, created_at) VALUES ('u1', 1)",
    ).run();
    await env.DB.prepare(
      "INSERT INTO tags (id, user_id, name, created_at) VALUES ('g1','u1','Work',1)",
    ).run();
    await expect(
      env.DB
        .prepare(
          "INSERT INTO tags (id, user_id, name, created_at) VALUES ('g2','u1','work',1)",
        )
        .run(),
    ).rejects.toThrow();
  });
});

describe("migration data-survival (C3)", () => {
  it("child rows survive an additive in-place ALTER (the committed strategy)", async () => {
    await seedTaskWithChildren();
    expect(await childCounts()).toEqual({ dod: 1, sub: 1 });

    await addColumnInPlace();

    const parent = await env.DB.prepare(
      "SELECT id FROM tasks WHERE id = 't1'",
    ).first<{ id: string }>();
    expect(parent?.id).toBe("t1");
    expect(await childCounts()).toEqual({ dod: 1, sub: 1 });
  });

  it("proves a drop+recreate rebuild cascade-deletes children (forbidden)", async () => {
    await seedTaskWithChildren();
    expect(await childCounts()).toEqual({ dod: 1, sub: 1 });

    // defer_foreign_keys does NOT save the children here.
    await rebuildTasksTable();

    expect(await childCounts()).toEqual({ dod: 0, sub: 0 });
  });
});
