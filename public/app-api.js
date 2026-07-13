// REST client. Token lives in localStorage (v1, single user). All task-authored
// content is rendered escaped elsewhere, mitigating the XSS->token-theft risk;
// rotate via `wrangler secret put AUTH_TOKEN` and re-enter the token here.
const TOKEN_KEY = "tieu_diem_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}
export function setToken(t) {
  localStorage.setItem(TOKEN_KEY, t);
}
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

let onUnauthorized = () => {};
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

export class ApiError extends Error {
  constructor(status, code, body) {
    super(code);
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

async function req(method, path, body) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 401) {
    onUnauthorized();
    throw new ApiError(401, "UNAUTHORIZED");
  }
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new ApiError(res.status, data?.code || "ERROR", data);
  return data;
}

export const api = {
  listTasks: () => req("GET", "/tasks"),
  getTask: (id) => req("GET", `/tasks/${id}`),
  createTask: (b) => req("POST", "/tasks", b),
  patchTask: (id, b) => req("PATCH", `/tasks/${id}`, b),
  deleteTask: (id) => req("DELETE", `/tasks/${id}`),
  addDod: (id, text) => req("POST", `/tasks/${id}/dod`, { text }),
  toggleDod: (dodId, done) => req("PATCH", `/dod/${dodId}`, { done }),
  deleteDod: (dodId) => req("DELETE", `/dod/${dodId}`),
  addSubtask: (id, title) => req("POST", `/tasks/${id}/subtasks`, { title }),
  toggleSubtask: (sid, done) => req("PATCH", `/subtasks/${sid}`, { done }),
  deleteSubtask: (sid) => req("DELETE", `/subtasks/${sid}`),
  productivity: (days = 7) => req("GET", `/dashboard/productivity?days=${days}`),
  listProjects: () => req("GET", "/projects"),
};
