import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

// Smoke boot: proves the Worker entrypoint dispatches and that SELF.fetch
// (the same mechanism the MCP + parity tests rely on) works in the pool.
describe("health", () => {
  it("GET /health -> 200 { status: ok }", async () => {
    const res = await SELF.fetch("https://tieu-diem.test/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });
});
