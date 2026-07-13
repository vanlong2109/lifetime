import { describe, expect, it } from "vitest";
import { TaskCreate, TaskPatch, quadrant } from "../../src/domain/schemas";

describe("TaskCreate / title", () => {
  it("trims title and enforces 1..200 length", () => {
    expect(TaskCreate.parse({ title: "  hello  " }).title).toBe("hello");
    expect(TaskCreate.safeParse({ title: "" }).success).toBe(false);
    expect(TaskCreate.safeParse({ title: "   " }).success).toBe(false);
    expect(TaskCreate.safeParse({ title: "x".repeat(201) }).success).toBe(false);
  });

  it("rejects invalid quadrant enum", () => {
    expect(quadrant.safeParse("q5").success).toBe(false);
    expect(TaskCreate.safeParse({ title: "x", quadrant: "q9" }).success).toBe(
      false,
    );
  });
});

describe("TaskPatch mass-assignment guard (H6)", () => {
  it("accepts whitelisted user-editable fields", () => {
    const r = TaskPatch.safeParse({ title: "new", status: "doing" });
    expect(r.success).toBe(true);
  });

  it("rejects computed/server-owned fields", () => {
    expect(TaskPatch.safeParse({ progress: 50 }).success).toBe(false);
    expect(TaskPatch.safeParse({ completedAt: 123 }).success).toBe(false);
    expect(TaskPatch.safeParse({ id: "x" }).success).toBe(false);
    expect(TaskPatch.safeParse({ userId: "x" }).success).toBe(false);
    expect(TaskPatch.safeParse({ createdAt: 1 }).success).toBe(false);
  });
});
