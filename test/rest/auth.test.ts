import { beforeEach, describe, expect, it } from "vitest";
import { extractBearer, isAuthorized } from "../../src/auth/bearer-token";
import { resetDb } from "../helpers/db-reset";
import { api } from "../helpers/rest-client";

beforeEach(resetDb);

describe("bearer auth (unit, fail-closed)", () => {
  it("denies when the secret is unset or empty (M1)", () => {
    expect(isAuthorized("Bearer x", undefined)).toBe(false);
    expect(isAuthorized("Bearer x", "")).toBe(false);
    expect(isAuthorized("Bearer x", "   ")).toBe(false);
  });

  it("denies a missing or blank bearer", () => {
    expect(isAuthorized(null, "secret")).toBe(false);
    expect(isAuthorized("Bearer    ", "secret")).toBe(false);
    expect(isAuthorized("Basic abc", "secret")).toBe(false);
  });

  it("accepts the exact token (scheme case-insensitive)", () => {
    expect(isAuthorized("Bearer secret", "secret")).toBe(true);
    expect(isAuthorized("bearer secret", "secret")).toBe(true);
    expect(isAuthorized("Bearer secretx", "secret")).toBe(false);
  });

  it("extractBearer parses the token", () => {
    expect(extractBearer("Bearer abc")).toBe("abc");
    expect(extractBearer(null)).toBeNull();
  });
});

describe("auth enforced on /api (integration)", () => {
  it("401 without a token", async () => {
    expect((await api("GET", "/api/tasks", undefined, null)).status).toBe(401);
  });

  it("401 with a wrong token", async () => {
    expect((await api("GET", "/api/tasks", undefined, "nope")).status).toBe(401);
  });

  it("200 with the correct token", async () => {
    const res = await api("GET", "/api/tasks");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });
});
