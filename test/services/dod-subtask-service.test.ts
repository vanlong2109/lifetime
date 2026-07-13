import { beforeEach, describe, expect, it } from "vitest";
import { addDod, deleteDod, toggleDod } from "../../src/services/dod-service";
import { addSubtask, toggleSubtask } from "../../src/services/subtask-service";
import { getTaskDetail } from "../../src/services/task-read";
import { createTask, patchTask } from "../../src/services/task-service";
import { resetDb } from "../helpers/db-reset";
import { seedUser, testContext, testDb } from "../helpers/seed";

beforeEach(async () => {
  await resetDb();
  await seedUser();
});

describe("progress from DoD + subtasks", () => {
  it("reflects combined completion", async () => {
    const db = testDb();
    const ctx = testContext();
    const t = await createTask(db, ctx, { title: "x" });
    const withD1 = await addDod(db, ctx, t.id, { text: "d1" });
    await addDod(db, ctx, t.id, { text: "d2" });
    await addSubtask(db, ctx, t.id, { title: "s1" });
    expect((await getTaskDetail(db, ctx, t.id)).progress).toBe(0);

    await toggleDod(db, ctx, withD1.dod[0].id, { done: true }); // 1/3
    expect((await getTaskDetail(db, ctx, t.id)).progress).toBe(33);
  });

  it("subtask toggle updates progress", async () => {
    const db = testDb();
    const ctx = testContext();
    const t = await createTask(db, ctx, { title: "x" });
    const withS = await addSubtask(db, ctx, t.id, { title: "s1" });
    await toggleSubtask(db, ctx, withS.subtasks[0].id, { done: true });
    expect((await getTaskDetail(db, ctx, t.id)).progress).toBe(100);
  });
});

describe("H3 done-state reconciliation", () => {
  it("toggling a DoD off on a done task reverts to doing + clears completedAt", async () => {
    const db = testDb();
    const ctx = testContext();
    const t = await createTask(db, ctx, { title: "x" });
    const withD = await addDod(db, ctx, t.id, { text: "d1" });
    const dodId = withD.dod[0].id;
    await toggleDod(db, ctx, dodId, { done: true });
    const done = await patchTask(db, ctx, t.id, { status: "done" });
    expect(done.status).toBe("done");
    expect(done.completedAt).toBe(1_000_000);

    const reverted = await toggleDod(db, ctx, dodId, { done: false });
    expect(reverted.status).toBe("doing");
    expect(reverted.completedAt).toBeNull();
  });

  it("adding a new incomplete DoD to a done task reverts to doing", async () => {
    const db = testDb();
    const ctx = testContext();
    const t = await createTask(db, ctx, { title: "x" });
    const done = await patchTask(db, ctx, t.id, { status: "done" });
    expect(done.status).toBe("done");
    const after = await addDod(db, ctx, t.id, { text: "new" });
    expect(after.status).toBe("doing");
    expect(after.completedAt).toBeNull();
  });

  it("deleting the last incomplete DoD lets the task stay/become complete", async () => {
    const db = testDb();
    const ctx = testContext();
    const t = await createTask(db, ctx, { title: "x" });
    const withD = await addDod(db, ctx, t.id, { text: "d1" });
    // gate blocks done while incomplete; deleting the criterion clears the gate
    const afterDelete = await deleteDod(db, ctx, withD.dod[0].id);
    const done = await patchTask(db, ctx, t.id, { status: "done" });
    expect(afterDelete.dodTotal).toBe(0);
    expect(done.status).toBe("done");
  });
});
