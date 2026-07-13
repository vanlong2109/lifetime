import { beforeEach, describe, expect, it } from "vitest";
import {
  getDashboardSummary,
  getProductivity,
} from "../../src/services/dashboard-service";
import { createTask, patchTask } from "../../src/services/task-service";
import { resetDb } from "../helpers/db-reset";
import { seedUser, testContext, testDb } from "../helpers/seed";

// now = 2026-07-13 12:00 local (Asia/Bangkok)
const NOW = Date.UTC(2026, 6, 13, 5, 0, 0);

beforeEach(async () => {
  await resetDb();
  await seedUser();
});

describe("dashboard-service", () => {
  it("summarizes seeded tasks", async () => {
    const db = testDb();
    const ctx = testContext({ now: () => NOW });
    const a = await createTask(db, ctx, { title: "a", quadrant: "q1" });
    await patchTask(db, ctx, a.id, { status: "done" });
    await createTask(db, ctx, { title: "b", quadrant: "q1" });
    await createTask(db, ctx, { title: "c" });

    const s = await getDashboardSummary(db, ctx);
    expect(s.total).toBe(3);
    expect(s.byStatus.done).toBe(1);
    expect(s.byQuadrant.q1).toBe(2);
    expect(s.completionRate).toBe(33);
  });

  it("buckets completions into the local-day productivity window", async () => {
    const db = testDb();
    const ctx = testContext({ now: () => NOW });
    const a = await createTask(db, ctx, { title: "a" });
    await patchTask(db, ctx, a.id, { status: "done" }); // completedAt = NOW -> 07-13

    const prod = await getProductivity(db, ctx, 7);
    expect(prod).toHaveLength(7);
    expect(prod[prod.length - 1]).toEqual({ date: "2026-07-13", count: 1 });
    expect(prod.slice(0, -1).every((p) => p.count === 0)).toBe(true);
  });
});
