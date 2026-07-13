import { describe, expect, it } from "vitest";
import { computeProgress } from "../../src/domain/progress";

const d = (done: boolean) => ({ done });

describe("computeProgress", () => {
  it("maps status when there are no items", () => {
    expect(computeProgress([], [], "todo").progress).toBe(0);
    expect(computeProgress([], [], "doing").progress).toBe(40);
    expect(computeProgress([], [], "done").progress).toBe(100);
  });

  it("computes rounded ratio across DoD + subtasks (43% milestone)", () => {
    // 4 DoD (2 done) + 3 subtasks (1 done) = 3/7 -> round(42.857) = 43
    const dod = [d(true), d(true), d(false), d(false)];
    const subs = [d(true), d(false), d(false)];
    const r = computeProgress(dod, subs, "doing");
    expect(r.progress).toBe(43);
  });

  it("returns raw counts", () => {
    const r = computeProgress([d(true), d(false)], [d(true)], "doing");
    expect(r).toMatchObject({ dodDone: 1, dodTotal: 2, subDone: 1, subTotal: 1 });
  });

  it("is 100 when all items done regardless of status", () => {
    expect(computeProgress([d(true)], [d(true)], "todo").progress).toBe(100);
  });
});
