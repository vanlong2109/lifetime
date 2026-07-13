import type { AppBindings } from "./env";
import { handleMcpRequest } from "./mcp/server";
import { createRestApp } from "./rest/app";

const restApp = createRestApp();

// Single, explicit dispatch order (finding C2): /mcp -> MCP handler,
// /api + /health -> Hono, everything else -> static ASSETS (Phase 6).
// The Worker runs first for /api and /mcp so auth/middleware are never bypassed.
export default {
  async fetch(
    request: Request,
    env: AppBindings,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const { pathname } = new URL(request.url);

    if (pathname === "/mcp" || pathname.startsWith("/mcp/")) {
      return handleMcpRequest(request, env);
    }

    if (pathname === "/health" || pathname.startsWith("/api/")) {
      return restApp.fetch(request, env, ctx);
    }

    if (env.ASSETS) return env.ASSETS.fetch(request);
    return new Response("Not Found", { status: 404 });
  },
};
