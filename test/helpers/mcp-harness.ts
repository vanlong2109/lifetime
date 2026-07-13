import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { Db } from "../../src/db/client";
import { buildMcpServer } from "../../src/mcp/server";
import type { AppContext } from "../../src/services/context";

// Connect a real MCP client to a fresh stateless server over an in-memory
// transport (proven to run in workerd). Exercises the real MCP protocol
// (initialize + tools/call) against real D1 through the shared services.
export async function connectMcp(db: Db, ctx: AppContext): Promise<Client> {
  const server = buildMcpServer(db, ctx);
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test", version: "0.0.0" });
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);
  return client;
}

// biome-ignore lint/suspicious/noExplicitAny: test helper returns parsed tool JSON
export async function callTool<T = any>(
  client: Client,
  name: string,
  args: Record<string, unknown> = {},
): Promise<{ data: T; isError: boolean }> {
  const res = await client.callTool({ name, arguments: args });
  const text = (res.content as Array<{ text: string }>)[0].text;
  return { data: JSON.parse(text) as T, isError: res.isError === true };
}
