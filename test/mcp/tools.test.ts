import { beforeEach, describe, expect, it } from "vitest";
import { resetDb } from "../helpers/db-reset";
import { callTool, connectMcp } from "../helpers/mcp-harness";
import { countRows, seedUser, testContext, testDb } from "../helpers/seed";

beforeEach(async () => {
  await resetDb();
  await seedUser();
});

describe("MCP tool surface", () => {
  it("exposes the full 18-tool surface", async () => {
    const client = await connectMcp(testDb(), testContext());
    const list = await client.listTools();
    expect(list.tools).toHaveLength(18);
  });

  it("create_task writes to D1 through the shared service", async () => {
    const client = await connectMcp(testDb(), testContext());
    const { data } = await callTool(client, "create_task", { title: "X" });
    expect(data.title).toBe("X");
    expect(await countRows("tasks")).toBe(1);
  });

  it("add_dod + toggle_dod change progress", async () => {
    const client = await connectMcp(testDb(), testContext());
    const created = await callTool(client, "create_task", { title: "X" });
    const withDod = await callTool(client, "add_dod", {
      taskId: created.data.id,
      text: "c1",
    });
    expect(withDod.data.progress).toBe(0);
    const toggled = await callTool(client, "toggle_dod", {
      dodId: withDod.data.dod[0].id,
      done: true,
    });
    expect(toggled.data.progress).toBe(100);
  });

  it("move_task never changes status", async () => {
    const client = await connectMcp(testDb(), testContext());
    const a = await callTool(client, "create_task", { title: "A" });
    const b = await callTool(client, "create_task", { title: "B" });
    await callTool(client, "update_task", { id: a.data.id, status: "doing" });
    const moved = await callTool(client, "move_task", {
      id: a.data.id,
      prevId: b.data.id,
      nextId: null,
    });
    expect(moved.data.status).toBe("doing");
  });

  it("DoD-gate returns a tool error, not a crash", async () => {
    const client = await connectMcp(testDb(), testContext());
    const t = await callTool(client, "create_task", { title: "x" });
    await callTool(client, "add_dod", { taskId: t.data.id, text: "c" });
    const res = await callTool(client, "update_task", {
      id: t.data.id,
      status: "done",
    });
    expect(res.isError).toBe(true);
    expect(res.data.code).toBe("DOD_INCOMPLETE");
  });

  it("rejects mass-assignment of computed fields (H6, extra keys ignored)", async () => {
    const client = await connectMcp(testDb(), testContext());
    const t = await callTool(client, "create_task", { title: "x" });
    // `progress` is not in the tool schema -> stripped, never reaches the service.
    const res = await callTool(client, "update_task", {
      id: t.data.id,
      title: "y",
      progress: 99,
    });
    expect(res.isError).toBe(false);
    expect(res.data.title).toBe("y");
    expect(res.data.progress).toBe(0); // still computed, not 99
  });
});
