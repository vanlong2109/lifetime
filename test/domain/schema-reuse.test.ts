import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { describe, expect, it } from "vitest";
import { TaskCreate, taskCreateShape } from "../../src/domain/schemas";

// H4 gate: one zod definition must drive BOTH the REST validator (z.object) and
// an MCP tool (ZodRawShape). Also confirms Spike 2 — an MCP client/server round
// trip works inside the vitest-pool-workers (workerd) runtime.
describe("schema reuse: one zod shape for REST + MCP (H4)", () => {
  it("REST validator path parses/normalizes via z.object", () => {
    expect(TaskCreate.parse({ title: "  hi  " }).title).toBe("hi");
    expect(TaskCreate.safeParse({ title: "x", bogus: 1 }).success).toBe(false);
  });

  it("MCP tool path registers + validates using the same shape", async () => {
    const server = new McpServer({ name: "test", version: "0.0.0" });
    let received: { title?: string } | null = null;
    server.registerTool(
      "create_task",
      { description: "Create a task", inputSchema: taskCreateShape },
      async (args) => {
        received = args;
        return { content: [{ type: "text", text: `ok:${args.title}` }] };
      },
    );

    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "c", version: "0.0.0" });
    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);

    // The shape is exposed as a JSON schema to agents.
    const list = await client.listTools();
    const tool = list.tools.find((t) => t.name === "create_task");
    expect(tool?.inputSchema?.properties).toHaveProperty("title");

    // Valid call flows through to the handler with parsed args.
    const res = await client.callTool({
      name: "create_task",
      arguments: { title: "from agent" },
    });
    expect((res.content as Array<{ text: string }>)[0].text).toBe(
      "ok:from agent",
    );
    expect(received!.title).toBe("from agent");

    // Missing required field is rejected by the same shape.
    let errored = false;
    try {
      const bad = await client.callTool({
        name: "create_task",
        arguments: {},
      });
      errored = bad.isError === true;
    } catch {
      errored = true;
    }
    expect(errored).toBe(true);
  });
});
