import { Hono } from "hono";
import { beforeEach, describe, expect, it } from "vitest";
import { errorHandler } from "../../src/rest/errors";
import { resetDb } from "../helpers/db-reset";
import { api, apiJson } from "../helpers/rest-client";

interface TaskDetail {
  id: string;
  progress: number;
  dod: Array<{ id: string }>;
  subtasks: Array<{ id: string }>;
}

beforeEach(resetDb);

describe("dod / subtask routes", () => {
  it("add + toggle DoD updates progress via REST", async () => {
    const t = await apiJson<TaskDetail>("POST", "/api/tasks", { title: "x" });
    const withDod = await apiJson<TaskDetail>("POST", `/api/tasks/${t.id}/dod`, {
      text: "c1",
    });
    expect(withDod.progress).toBe(0);
    const toggled = await apiJson<TaskDetail>(
      "PATCH",
      `/api/dod/${withDod.dod[0].id}`,
      { done: true },
    );
    expect(toggled.progress).toBe(100);
  });

  it("add + delete subtask", async () => {
    const t = await apiJson<TaskDetail>("POST", "/api/tasks", { title: "x" });
    const withSub = await apiJson<TaskDetail>(
      "POST",
      `/api/tasks/${t.id}/subtasks`,
      { title: "s1" },
    );
    const res = await api("DELETE", `/api/subtasks/${withSub.subtasks[0].id}`);
    expect(res.status).toBe(200);
  });
});

describe("dashboard + meta routes", () => {
  it("dashboard summary + productivity", async () => {
    await api("POST", "/api/tasks", { title: "a", quadrant: "q1" });
    const summary = await apiJson<{ total: number; q1Count: number }>(
      "GET",
      "/api/dashboard/summary",
    );
    expect(summary.total).toBe(1);
    expect(summary.q1Count).toBe(1);
    const prod = await apiJson<unknown[]>(
      "GET",
      "/api/dashboard/productivity?days=7",
    );
    expect(prod).toHaveLength(7);
  });

  it("projects + tags create/list", async () => {
    await api("POST", "/api/projects", { name: "P1" });
    const projects = await apiJson<Array<{ name: string }>>("GET", "/api/projects");
    expect(projects.map((p) => p.name)).toEqual(["P1"]);

    await api("POST", "/api/tags", { name: "Work" });
    await api("POST", "/api/tags", { name: "work" }); // dedup
    const tags = await apiJson<unknown[]>("GET", "/api/tags");
    expect(tags).toHaveLength(1);
  });
});

describe("projectId validation (bad reference -> 4xx)", () => {
  it("returns 404 for a task referencing a nonexistent project", async () => {
    const res = await api("POST", "/api/tasks", {
      title: "x",
      projectId: "ghost-project",
    });
    expect(res.status).toBe(404);
  });

  it("accepts a valid owned project reference", async () => {
    const p = await apiJson<{ id: string }>("POST", "/api/projects", {
      name: "P",
    });
    const res = await api("POST", "/api/tasks", { title: "x", projectId: p.id });
    expect(res.status).toBe(201);
  });
});

describe("error safety (M4)", () => {
  it("the error handler returns a clean 500 without leaking internals", async () => {
    const app = new Hono();
    app.get("/boom", () => {
      throw new Error("SELECT secret FROM users; internal detail");
    });
    app.onError(errorHandler);

    const res = await app.request("/boom");
    expect(res.status).toBe(500);
    const body = await res.text();
    expect(JSON.parse(body)).toEqual({ code: "INTERNAL" });
    expect(body.toLowerCase()).not.toContain("select");
    expect(body.toLowerCase()).not.toContain("secret");
  });
});
