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

// This server is stateless: no session, and the transport is discarded after
// each request, so it never pushes server->client messages. A GET (standalone
// SSE) or DELETE would make the SDK hold open a text/event-stream body that
// never emits and never closes; on Workers an idle, never-closing response is
// detected as a hung request and killed, after which SSE clients reconnect in a
// tight loop. Answer non-POST with 405 so clients fall back to plain
// request/response over POST (MCP allows a server to decline the SSE stream).
function methodNotAllowed(): Response {
  return Response.json(
    {
      jsonrpc: "2.0",
      id: null,
      error: { code: -32000, message: "Method Not Allowed" },
    },
    { status: 405, headers: { Allow: "POST" } },
  );
}

function internalError(): Response {
  return Response.json(
    {
      jsonrpc: "2.0",
      id: null,
      error: { code: -32603, message: "Internal error" },
    },
    { status: 500 },
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

  // Only POST carries JSON-RPC here; GET/DELETE would open a stream that hangs.
  if (request.method !== "POST") {
    return methodNotAllowed();
  }

  try {
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
    return await transport.handleRequest(request);
  } catch {
    // Never let a throw reach the runtime as an unhandled/"hung" failure.
    return internalError();
  }
}
