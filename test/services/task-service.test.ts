import { beforeEach, describe, expect, it } from "vitest";
import { addDod } from "../../src/services/dod-service";
import { addSubtask } from "../../src/services/subtask-service";
import { getTaskDetail, listTasks } from "../../src/services/task-read";
import {
  createTask,
  patchTask,
  removeTask,
} from "../../src/services/task-service";
import { resetDb } from "../helpers/db-reset";
import { countRows, seedUser, testContext, testDb } from "../helpers/seed";

beforeEach(async () => {
  await resetDb();
  await seedUser();
});

describe("task-service create/get", () => {
  it("creates then reads back with progress", async () => {
    const db = testDb();
    const ctx = testContext();
    const t = await createTask(db, ctx, { title: "Task A" });
    expect(t.title).toBe("Task A");
    expect(t.status).toBe("todo");
    expect(t.progress).toBe(0);
    const got = await getTaskDetail(db, ctx, t.id);
    expect(got.id).toBe(t.id);
    expect(got.dod).toEqual([]);
  });
});

describe("task-service patch DoD-gate", () => {
  it("blocks done when DoD incomplete (gate on) -> 422", async () => {
    const db = testDb();
    const ctx = testContext();
    const t = await createTask(db, ctx, { title: "x" });
    await addDod(db, ctx, t.id, { text: "criterion" });
    await expect(
      patchTask(db, ctx, t.id, { status: "done" }),
    ).rejects.toMatchObject({ code: "DOD_INCOMPLETE", httpStatus: 422 });
  });

  it("allows done with no DoD and sets completedAt", async () => {
    const db = testDb();
    const ctx = testContext();
    const t = await createTask(db, ctx, { title: "x" });
    const done = await patchTask(db, ctx, t.id, { status: "done" });
    expect(done.status).toBe("done");
    expect(done.completedAt).toBe(1_000_000);
  });

  it("allows done when DoD gate disabled", async () => {
    const db = testDb();
    const ctx = testContext({ gateEnabled: false });
    const t = await createTask(db, ctx, { title: "x" });
    await addDod(db, ctx, t.id, { text: "c" });
    const done = await patchTask(db, ctx, t.id, { status: "done" });
    expect(done.status).toBe("done");
  });
});

describe("task-service remove cascade + list + ownership", () => {
  it("remove cascades DoD + subtasks", async () => {
    const db = testDb();
    const ctx = testContext();
    const t = await createTask(db, ctx, { title: "x" });
    await addDod(db, ctx, t.id, { text: "d" });
    await addSubtask(db, ctx, t.id, { title: "s" });
    expect(await countRows("dod_criteria")).toBe(1);
    expect(await countRows("subtasks")).toBe(1);

    await removeTask(db, ctx, t.id);

    expect(await countRows("tasks")).toBe(0);
    expect(await countRows("dod_criteria")).toBe(0);
    expect(await countRows("subtasks")).toBe(0);
  });

  it("lists owner tasks with status filter", async () => {
    const db = testDb();
    const ctx = testContext();
    await createTask(db, ctx, { title: "a", status: "todo" });
    const b = await createTask(db, ctx, { title: "b" });
    await patchTask(db, ctx, b.id, { status: "doing" });
    expect((await listTasks(db, ctx, { status: "todo" })).map((t) => t.title)).toEqual([
      "a",
    ]);
    expect((await listTasks(db, ctx)).length).toBe(2);
  });

  it("404 for unknown id, 403 for another user's task", async () => {
    const db = testDb();
    const ctx = testContext();
    await expect(getTaskDetail(db, ctx, "missing")).rejects.toMatchObject({
      httpStatus: 404,
    });
    const t = await createTask(db, ctx, { title: "x" });
    await seedUser("user-2");
    const other = testContext({ userId: "user-2" });
    await expect(getTaskDetail(db, other, t.id)).rejects.toMatchObject({
      httpStatus: 403,
    });
  });
});
