import { beforeEach, describe, expect, it } from "vitest";
import { resetDb } from "../helpers/db-reset";
import { callTool, connectMcp } from "../helpers/mcp-harness";
import { seedUser, testContext, testDb } from "../helpers/seed";

beforeEach(async () => {
  await resetDb();
  await seedUser();
});

describe("MCP has no cached state (H5)", () => {
  it("reads the latest D1 state, including writes from a separate server", async () => {
    const db = testDb();
    const ctx = testContext();
    const client = await connectMcp(db, ctx);

    await callTool(client, "create_task", { title: "A" });
    expect((await callTool(client, "list_tasks", {})).data.length).toBe(1);

    // A second, independent stateless server writes B.
    const client2 = await connectMcp(db, ctx);
    await callTool(client2, "create_task", { title: "B" });

    // The first client still reflects the newest state -> no in-memory cache.
    expect((await callTool(client, "list_tasks", {})).data.length).toBe(2);
  });
});
