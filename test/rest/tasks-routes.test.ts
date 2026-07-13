import { beforeEach, describe, expect, it } from "vitest";
import { resetDb } from "../helpers/db-reset";
import { api, apiJson } from "../helpers/rest-client";

interface TaskDetail {
  id: string;
  title: string;
  status: string;
  progress: number;
  dod: unknown[];
}

beforeEach(resetDb);

describe("tasks REST CRUD + shape", () => {
  it("POST creates 201 and GET returns the detail shape", async () => {
    const res = await api("POST", "/api/tasks", { title: "T1" });
    expect(res.status).toBe(201);
    const t = (await res.json()) as TaskDetail;
    expect(t).toMatchObject({ title: "T1", status: "todo", progress: 0 });
    expect(t.dod).toEqual([]);
    const got = await apiJson<TaskDetail>("GET", `/api/tasks/${t.id}`);
    expect(got.id).toBe(t.id);
  });

  it("invalid body -> 422 VALIDATION", async () => {
    const res = await api("POST", "/api/tasks", { title: "" });
    expect(res.status).toBe(422);
    expect(((await res.json()) as { code: string }).code).toBe("VALIDATION");
  });

  it("PATCH with a computed field (progress) -> 422 (H6)", async () => {
    const t = await apiJson<TaskDetail>("POST", "/api/tasks", { title: "x" });
    const res = await api("PATCH", `/api/tasks/${t.id}`, { progress: 50 });
    expect(res.status).toBe(422);
  });

  it("status->done blocked while DoD incomplete -> 422 DOD_INCOMPLETE", async () => {
    const t = await apiJson<TaskDetail>("POST", "/api/tasks", { title: "x" });
    await api("POST", `/api/tasks/${t.id}/dod`, { text: "c" });
    const res = await api("PATCH", `/api/tasks/${t.id}`, { status: "done" });
    expect(res.status).toBe(422);
    expect(((await res.json()) as { code: string }).code).toBe("DOD_INCOMPLETE");
  });

  it("move reorders and list filters by status", async () => {
    const a = await apiJson<TaskDetail>("POST", "/api/tasks", { title: "A" });
    const b = await apiJson<TaskDetail>("POST", "/api/tasks", { title: "B" });
    await api("PATCH", `/api/tasks/${b.id}/move`, { prevId: null, nextId: a.id });
    const list = await apiJson<TaskDetail[]>("GET", "/api/tasks");
    expect(list.map((t) => t.title)).toEqual(["B", "A"]);

    await api("PATCH", `/api/tasks/${a.id}`, { status: "doing" });
    const doing = await apiJson<TaskDetail[]>("GET", "/api/tasks?status=doing");
    expect(doing.map((t) => t.title)).toEqual(["A"]);
  });

  it("404 for an unknown task", async () => {
    expect((await api("GET", "/api/tasks/nope")).status).toBe(404);
  });
});
