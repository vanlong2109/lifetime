import { describe, expect, it } from "vitest";
import {
  type DashTask,
  productivityByDay,
  summarize,
} from "../../src/domain/dashboard";

const TZ = "Asia/Bangkok"; // UTC+7, no DST
const task = (t: Partial<DashTask>): DashTask => ({
  status: "todo",
  quadrant: null,
  deadline: null,
  completedAt: null,
  ...t,
});

describe("summarize", () => {
  const NOW = Date.UTC(2026, 6, 13, 5, 0, 0);
  it("counts by status, quadrant, completion rate, overdue and due-soon", () => {
    const tasks: DashTask[] = [
      task({ status: "done", quadrant: "q1" }),
      task({ status: "doing", quadrant: "q1" }),
      task({ status: "todo", quadrant: "q2", deadline: NOW - 1000 }), // overdue
      task({ status: "todo", quadrant: null, deadline: NOW + 1000 }), // due soon
      task({ status: "todo", deadline: NOW + 10 * 24 * 3600 * 1000 }), // far
    ];
    const s = summarize(tasks, NOW);
    expect(s.total).toBe(5);
    expect(s.byStatus).toEqual({ todo: 3, doing: 1, done: 1 });
    expect(s.completionRate).toBe(20);
    expect(s.byQuadrant).toEqual({ q1: 2, q2: 1, q3: 0, q4: 0, none: 2 });
    expect(s.q1Count).toBe(2);
    expect(s.overdue).toBe(1);
    expect(s.dueSoon).toBe(1);
  });

  it("does not count done tasks as overdue", () => {
    const s = summarize(
      [task({ status: "done", deadline: NOW - 99999 })],
      NOW,
    );
    expect(s.overdue).toBe(0);
  });
});

describe("productivityByDay (M2 local-day buckets)", () => {
  // now = 2026-07-13 12:00 local -> window 2026-07-07 .. 2026-07-13
  const NOW = Date.UTC(2026, 6, 13, 5, 0, 0);

  it("buckets completions by LOCAL calendar day, not UTC day", () => {
    const tasks: DashTask[] = [
      // 00:30 local 07-07 (UTC 07-06 17:30) -> 07-07
      task({ status: "done", completedAt: Date.UTC(2026, 6, 6, 17, 30) }),
      // 23:30 local 07-07 (UTC 07-07 16:30) -> 07-07
      task({ status: "done", completedAt: Date.UTC(2026, 6, 7, 16, 30) }),
      // 00:30 local 07-13 (UTC 07-12 17:30) -> 07-13
      task({ status: "done", completedAt: Date.UTC(2026, 6, 12, 17, 30) }),
      // 23:30 local 07-06 (UTC 07-06 16:30) -> before window, excluded
      task({ status: "done", completedAt: Date.UTC(2026, 6, 6, 16, 30) }),
    ];
    const result = productivityByDay(tasks, { now: NOW, days: 7, timeZone: TZ });
    expect(result.map((r) => r.date)).toEqual([
      "2026-07-07",
      "2026-07-08",
      "2026-07-09",
      "2026-07-10",
      "2026-07-11",
      "2026-07-12",
      "2026-07-13",
    ]);
    const byDate = Object.fromEntries(result.map((r) => [r.date, r.count]));
    expect(byDate["2026-07-07"]).toBe(2);
    expect(byDate["2026-07-13"]).toBe(1);
    expect(byDate["2026-07-10"]).toBe(0);
  });

  it("ignores non-done or uncompleted tasks", () => {
    const tasks: DashTask[] = [
      task({ status: "doing", completedAt: null }),
      task({ status: "todo", completedAt: Date.UTC(2026, 6, 10, 5, 0) }),
    ];
    const result = productivityByDay(tasks, { now: NOW, days: 7, timeZone: TZ });
    expect(result.every((r) => r.count === 0)).toBe(true);
  });
});
