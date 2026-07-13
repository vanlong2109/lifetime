import { beforeEach, describe, expect, it } from "vitest";
import { listTasks } from "../../src/services/task-read";
import {
  createTask,
  moveTask,
  patchTask,
} from "../../src/services/task-service";
import { resetDb } from "../helpers/db-reset";
import { seedUser, testContext, testDb } from "../helpers/seed";

beforeEach(async () => {
  await resetDb();
  await seedUser();
});

async function order(db: ReturnType<typeof testDb>, ctx: ReturnType<typeof testContext>) {
  return (await listTasks(db, ctx)).map((t) => t.title);
}

describe("task-service move (H2 fractional rank)", () => {
  it("two overlapping moves keep a valid, collision-free total order", async () => {
    const db = testDb();
    const ctx = testContext();
    const a = await createTask(db, ctx, { title: "A" });
    const b = await createTask(db, ctx, { title: "B" });
    const c = await createTask(db, ctx, { title: "C" });
    expect(await order(db, ctx)).toEqual(["A", "B", "C"]);

    // Move C between A and B -> A, C, B
    await moveTask(db, ctx, c.id, { prevId: a.id, nextId: b.id });
    expect(await order(db, ctx)).toEqual(["A", "C", "B"]);

    // Move B between A and C -> A, B, C
    await moveTask(db, ctx, b.id, { prevId: a.id, nextId: c.id });
    expect(await order(db, ctx)).toEqual(["A", "B", "C"]);

    const ranks = (await listTasks(db, ctx)).map((t) => t.rank);
    expect(new Set(ranks).size).toBe(ranks.length); // no duplicate ranks
  });

  it("move never changes status (gate cannot be bypassed)", async () => {
    const db = testDb();
    const ctx = testContext();
    const a = await createTask(db, ctx, { title: "A" });
    const b = await createTask(db, ctx, { title: "B" });
    await patchTask(db, ctx, a.id, { status: "doing" });

    const moved = await moveTask(db, ctx, a.id, {
      prevId: b.id,
      nextId: null,
      quadrant: "q1",
    });
    expect(moved.status).toBe("doing"); // unchanged
    expect(moved.quadrant).toBe("q1"); // quadrant may change
  });

  it("quadrant-only move keeps rank (no 'a0' collision) — H2", async () => {
    const db = testDb();
    const ctx = testContext();
    const a = await createTask(db, ctx, { title: "A" });
    const b = await createTask(db, ctx, { title: "B" });
    const aRankBefore = (await listTasks(db, ctx)).find((t) => t.id === a.id)!
      .rank;

    // No prev/next -> pure recategorization; rank must not change.
    const moved = await moveTask(db, ctx, a.id, { quadrant: "q2" });
    expect(moved.quadrant).toBe("q2");
    expect(moved.rank).toBe(aRankBefore);

    const list = await listTasks(db, ctx);
    const ranks = list.map((t) => t.rank);
    expect(new Set(ranks).size).toBe(ranks.length); // still collision-free
    expect(list.map((t) => t.title)).toEqual(["A", "B"]); // order preserved
  });

  it("rejects out-of-order neighbors with a clean 422, not a 500", async () => {
    const db = testDb();
    const ctx = testContext();
    const a = await createTask(db, ctx, { title: "A" });
    const b = await createTask(db, ctx, { title: "B" });
    const c = await createTask(db, ctx, { title: "C" }); // order A,B,C
    // prev=C sits AFTER next=B -> impossible position.
    await expect(
      moveTask(db, ctx, a.id, { prevId: c.id, nextId: b.id }),
    ).rejects.toMatchObject({ httpStatus: 422 });
  });

  it("rejects moving relative to another user's task (403)", async () => {
    const db = testDb();
    const ctx = testContext();
    const mine = await createTask(db, ctx, { title: "mine" });
    await seedUser("user-2");
    const other = testContext({ userId: "user-2" });
    const theirs = await createTask(db, other, { title: "theirs" });
    await expect(
      moveTask(db, ctx, mine.id, { prevId: theirs.id, nextId: null }),
    ).rejects.toMatchObject({ httpStatus: 403 });
  });
});
