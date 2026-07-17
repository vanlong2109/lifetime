import { SELF } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { resetDb } from "../helpers/db-reset";

beforeEach(resetDb);

const MCP_URL = "https://tieu-diem.test/mcp";
const AUTH = { Authorization: "Bearer test-secret-token" };

// Regression: a stateless server never pushes server->client messages, so the
// standalone SSE (GET) opened a text/event-stream body that never emitted and
// never closed. On Workers that trips hang-detection ("code had hung"), which
// made Claude Code reconnect in a tight loop. GET/DELETE must now answer 405
// promptly so clients fall back to POST-only request/response.
describe("MCP /mcp non-POST methods return 405 (no hung SSE)", () => {
  it("GET with accept: text/event-stream returns 405, not a stream", async () => {
    const res = await SELF.fetch(MCP_URL, {
      method: "GET",
      headers: { ...AUTH, accept: "text/event-stream" },
    });
    expect(res.status).toBe(405);
    expect(res.headers.get("Allow")).toBe("POST");
    // Body must be a finite JSON-RPC error, not an open event-stream.
    expect(res.headers.get("content-type")).toContain("application/json");
    const body = (await res.json()) as { error?: { message?: string } };
    expect(body.error?.message).toBe("Method Not Allowed");
  });

  it("DELETE returns 405", async () => {
    const res = await SELF.fetch(MCP_URL, { method: "DELETE", headers: AUTH });
    expect(res.status).toBe(405);
  });

  it("auth still takes precedence over method: GET without a token is 401", async () => {
    const res = await SELF.fetch(MCP_URL, {
      method: "GET",
      headers: { accept: "text/event-stream" },
    });
    expect(res.status).toBe(401);
  });
});
