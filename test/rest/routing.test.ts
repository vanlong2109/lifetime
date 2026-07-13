import { SELF } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { resetDb } from "../helpers/db-reset";
import { api } from "../helpers/rest-client";

beforeEach(resetDb);

describe("dispatch order (C2)", () => {
  it("/api/* reaches the Hono app (auth runs, not an asset 404)", async () => {
    // No token -> 401 proves the request hit Hono auth, not the ASSETS fallback.
    expect((await api("GET", "/api/tasks", undefined, null)).status).toBe(401);
  });

  it("/health is public and served by Hono", async () => {
    const res = await SELF.fetch("https://tieu-diem.test/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });

  it("/mcp is routed to the MCP handler (auth gate), not Hono's 404", async () => {
    // No token -> the MCP handler's auth gate returns 401 (not an asset 404).
    const res = await SELF.fetch("https://tieu-diem.test/mcp", { method: "POST" });
    expect(res.status).not.toBe(404);
    expect(res.status).toBe(401);
  });

  it("unknown path falls through to ASSETS (404 with none bound)", async () => {
    const res = await SELF.fetch("https://tieu-diem.test/anything");
    expect(res.status).toBe(404);
  });
});
