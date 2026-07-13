import { describe, expect, it } from "vitest";
import { DomainError } from "../../src/domain/errors";
import {
  applyStatusTransition,
  assertDodComplete,
  reconcileOnChildChange,
} from "../../src/domain/status-lifecycle";

const d = (done: boolean) => ({ done });
const NOW = 1_000_000;

describe("assertDodComplete (DoD-gate)", () => {
  it("throws 422 DOD_INCOMPLETE when gate on and a criterion is unmet", () => {
    try {
      assertDodComplete([d(true), d(false)], true);
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(DomainError);
      expect((e as DomainError).code).toBe("DOD_INCOMPLETE");
      expect((e as DomainError).httpStatus).toBe(422);
    }
  });

  it("passes when gate on and all met, or empty DoD", () => {
    expect(() => assertDodComplete([d(true), d(true)], true)).not.toThrow();
    expect(() => assertDodComplete([], true)).not.toThrow();
  });

  it("passes when gate disabled even if incomplete", () => {
    expect(() => assertDodComplete([d(false)], false)).not.toThrow();
  });
});

describe("applyStatusTransition (completedAt)", () => {
  it("sets completedAt entering done", () => {
    expect(applyStatusTransition("doing", "done", NOW)).toEqual({
      status: "done",
      completedAt: NOW,
    });
  });

  it("clears completedAt leaving done", () => {
    expect(applyStatusTransition("done", "todo", NOW, 500)).toEqual({
      status: "todo",
      completedAt: null,
    });
  });

  it("preserves completedAt on a done->done no-op", () => {
    expect(applyStatusTransition("done", "done", NOW, 500)).toEqual({
      status: "done",
      completedAt: 500,
    });
  });
});

describe("reconcileOnChildChange (H3 done-state drift)", () => {
  it("reverts done->doing when a DoD criterion is toggled off (gate on)", () => {
    const task = { status: "done" as const, completedAt: 500 };
    expect(reconcileOnChildChange(task, [d(true), d(false)], true)).toEqual({
      status: "doing",
      completedAt: null,
    });
  });

  it("reverts done->doing when a new incomplete DoD is added (gate on)", () => {
    const task = { status: "done" as const, completedAt: 500 };
    expect(reconcileOnChildChange(task, [d(false)], true)).toEqual({
      status: "doing",
      completedAt: null,
    });
  });

  it("keeps done when DoD still complete", () => {
    const task = { status: "done" as const, completedAt: 500 };
    expect(reconcileOnChildChange(task, [d(true)], true)).toEqual({
      status: "done",
      completedAt: 500,
    });
  });

  it("keeps done when gate disabled", () => {
    const task = { status: "done" as const, completedAt: 500 };
    expect(reconcileOnChildChange(task, [d(false)], false)).toEqual({
      status: "done",
      completedAt: 500,
    });
  });

  it("leaves non-done tasks unchanged", () => {
    const task = { status: "doing" as const, completedAt: null };
    expect(reconcileOnChildChange(task, [d(false)], true)).toEqual({
      status: "doing",
      completedAt: null,
    });
  });
});
