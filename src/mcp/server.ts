import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { isAuthorized } from "../auth/bearer-token";
import { createDb, type Db } from "../db/client";
import type { AppBindings } from "../env";
import { type AppContext, createContext } from "../services/context";
import { ensureUser } from "../services/user-service";
import { registerTools } from "./tools";

// Fresh, stateless server per request (no Durable Object, no session — H1/H5).
export function buildMcpServer(db: Db, ctx: AppContext): McpServer {
  const server = new McpServer({ name: "tieu-diem", version: "1.0.0" });
  registerTools(server, db, ctx);
  return server;
}

function unauthorized(): Response {
  return Response.json(
    { jsonrpc: "2.0", id: null, error: { code: -32001, message: "Unauthorized" } },
    { status: 401 },
  );
}

// HTTP entrypoint for /mcp. Auth is verified BEFORE any context/server is built
// (finding C1). Uses the Web-standard Streamable-HTTP transport in stateless
// JSON mode — each request is self-contained, no cached state (H5).
export async function handleMcpRequest(
  request: Request,
  env: AppBindings,
): Promise<Response> {
  if (!isAuthorized(request.headers.get("Authorization"), env.AUTH_TOKEN)) {
    return unauthorized();
  }

  const db = createDb(env.DB);
  await ensureUser(db, env.APP_USER_ID, Date.now());
  const ctx = createContext({
    userId: env.APP_USER_ID,
    timeZone: env.APP_TIMEZONE,
    gateEnabled: env.DOD_GATE_ENABLED !== "false",
  });

  const server = buildMcpServer(db, ctx);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless
    enableJsonResponse: true,
  });
  await server.connect(transport);
  return transport.handleRequest(request);
}
