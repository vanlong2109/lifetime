import { SELF } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { resetDb } from "../helpers/db-reset";

beforeEach(resetDb);

const MCP_URL = "https://tieu-diem.test/mcp";
const JSON_HEADERS = {
  "content-type": "application/json",
  accept: "application/json, text/event-stream",
};
const INITIALIZE = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "t", version: "0" },
  },
};

function post(headers: Record<string, string>, body: unknown) {
  return SELF.fetch(MCP_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

describe("MCP /mcp auth gate (C1)", () => {
  it("rejects a request with no token BEFORE processing", async () => {
    expect((await post(JSON_HEADERS, INITIALIZE)).status).toBe(401);
  });

  it("rejects a wrong token", async () => {
    const res = await post(
      { ...JSON_HEADERS, Authorization: "Bearer nope" },
      INITIALIZE,
    );
    expect(res.status).toBe(401);
  });

  it("accepts a valid token and completes the MCP handshake over HTTP", async () => {
    const res = await post(
      { ...JSON_HEADERS, Authorization: "Bearer test-secret-token" },
      INITIALIZE,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      result?: { serverInfo?: { name?: string } };
    };
    expect(body.result?.serverInfo?.name).toBe("tieu-diem");
  });
});
