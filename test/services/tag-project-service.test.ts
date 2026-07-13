import { beforeEach, describe, expect, it } from "vitest";
import {
  createProject,
  listProjects,
} from "../../src/services/project-service";
import { createTag, listTags } from "../../src/services/tag-service";
import { createTask } from "../../src/services/task-service";
import { resetDb } from "../helpers/db-reset";
import { countRows, seedUser, testContext, testDb } from "../helpers/seed";

beforeEach(async () => {
  await resetDb();
  await seedUser();
});

describe("tag dedup (C4 DB unique index)", () => {
  it("dedups case-insensitively; first casing wins", async () => {
    const db = testDb();
    const ctx = testContext();
    const a = await createTag(db, ctx, { name: "Work" });
    const b = await createTag(db, ctx, { name: "work" });
    expect(b.id).toBe(a.id);
    expect(await countRows("tags")).toBe(1);
    const list = await listTags(db, ctx);
    expect(list[0].name).toBe("Work");
  });

  it("attaches deduped tags to a task", async () => {
    const db = testDb();
    const ctx = testContext();
    const t = await createTask(db, ctx, { title: "x", tags: ["a", "A", "b"] });
    expect(new Set(t.tags)).toEqual(new Set(["a", "b"]));
    expect(await countRows("tags")).toBe(2);
  });
});

describe("project-service (minimal)", () => {
  it("creates and lists projects scoped to the user", async () => {
    const db = testDb();
    const ctx = testContext();
    await createProject(db, ctx, { name: "Proj1", color: "#f00" });
    await seedUser("user-2");
    await createProject(db, testContext({ userId: "user-2" }), { name: "Other" });
    const mine = await listProjects(db, ctx);
    expect(mine.map((p) => p.name)).toEqual(["Proj1"]);
  });
});
