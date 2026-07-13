import {
  ApiError,
  api,
  getToken,
  setToken,
  setUnauthorizedHandler,
} from "./app-api.js";
import { h } from "./app-format.js";
import {
  header,
  renderBoard,
  renderDashboard,
  renderMatrix,
  sidebar,
} from "./app-render.js";
import { renderDrawer } from "./app-drawer.js";

const state = {
  view: "dashboard",
  tasks: [],
  productivity: [],
  projects: [],
  selected: null,
  toast: null,
};

const root = document.getElementById("root");

function showToast(msg) {
  state.toast = msg;
  render();
  setTimeout(() => {
    if (state.toast === msg) {
      state.toast = null;
      render();
    }
  }, 3200);
}

// Reload list-level data (cards + charts). The drawer's `selected` is refreshed
// from mutation responses directly.
async function reloadLists() {
  const [tasks, productivity, projects] = await Promise.all([
    api.listTasks(),
    api.productivity(7),
    api.listProjects(),
  ]);
  state.tasks = tasks;
  state.productivity = productivity;
  state.projects = projects || [];
}

async function guard(fn) {
  try {
    await fn();
  } catch (e) {
    if (e instanceof ApiError) {
      if (e.code === "DOD_INCOMPLETE")
        showToast("Chưa thể hoàn thành — Định nghĩa Hoàn thành (DoD) chưa đủ.");
      else if (e.status !== 401) showToast(`Có lỗi (${e.code}). Thử lại.`);
    } else {
      showToast("Có lỗi mạng. Thử lại.");
    }
  }
}

const actions = {
  setView: (v) => {
    state.view = v;
    render();
  },
  selectTask: (id) =>
    guard(async () => {
      state.selected = await api.getTask(id);
      render();
    }),
  closeDrawer: () => {
    state.selected = null;
    render();
  },
  newTask: () =>
    guard(async () => {
      state.selected = await api.createTask({ title: "Việc mới", quadrant: "q2" });
      await reloadLists();
      render();
    }),
  advance: (id, status) =>
    guard(async () => {
      const next = status === "todo" ? "doing" : "done";
      await api.patchTask(id, { status: next });
      await reloadLists();
      render();
    }),
  setStatus: (s) => mutateSelected(() => api.patchTask(state.selected.id, { status: s })),
  setQuadrant: (q) => mutateSelected(() => api.patchTask(state.selected.id, { quadrant: q })),
  editField: (field, value) =>
    mutateSelected(() => api.patchTask(state.selected.id, { [field]: value })),
  toggleDod: (dodId, done) => mutateSelected(() => api.toggleDod(dodId, done)),
  deleteDod: (dodId) => mutateSelected(() => api.deleteDod(dodId)),
  addDod: (text) => mutateSelected(() => api.addDod(state.selected.id, text)),
  toggleSubtask: (sid, done) => mutateSelected(() => api.toggleSubtask(sid, done)),
  deleteSubtask: (sid) => mutateSelected(() => api.deleteSubtask(sid)),
  addSubtask: (title) => mutateSelected(() => api.addSubtask(state.selected.id, title)),
  // Delete cascades to the task's DoD + subtasks, so confirm first.
  deleteTask: (id) =>
    guard(async () => {
      if (!window.confirm("Xoá việc này? Mọi tiêu chí DoD và subtask kèm theo cũng bị xoá.")) return;
      await api.deleteTask(id);
      state.selected = null;
      await reloadLists();
      showToast("Đã xoá việc.");
    }),
};

// Run a mutation that returns the updated TaskDetail, refresh the drawer + lists.
function mutateSelected(call) {
  return guard(async () => {
    const detail = await call();
    if (detail && detail.id) state.selected = detail;
    await reloadLists();
    render();
  });
}

function authGate() {
  const input = h("input", {
    type: "password",
    placeholder: "Dán AUTH_TOKEN…",
    style: "border:1px solid #e8e6dc;border-radius:9px;padding:11px 13px;font:400 13px 'JetBrains Mono',monospace;color:#141413;background:#fff;",
    onkeydown: (e) => {
      if (e.key === "Enter") submit();
    },
  });
  const submit = () => {
    const v = input.value.trim();
    if (v) {
      setToken(v);
      boot();
    }
  };
  return h(
    "div",
    { style: "position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#faf9f5;z-index:100;" },
    h(
      "div",
      { style: "background:#fff;border:1px solid #e8e6dc;border-radius:14px;padding:30px;width:360px;max-width:90vw;display:flex;flex-direction:column;gap:14px;" },
      h(
        "div",
        { style: "display:flex;align-items:center;gap:10px;" },
        h("span", { style: "width:11px;height:11px;border-radius:999px;background:#d97757;" }),
        h("span", { style: "font:600 17px 'Poppins',sans-serif;color:#141413;" }, "tiêu điểm"),
      ),
      h("div", { style: "font:400 13px 'Lora',serif;color:#8a887f;" }, "Nhập token truy cập để mở không gian làm việc."),
      input,
      h("button", { style: "border:none;border-radius:9px;padding:11px;background:#141413;color:#faf9f5;font:500 14px 'Poppins',sans-serif;cursor:pointer;", onclick: submit }, "Mở không gian"),
    ),
  );
}

function toastEl(msg) {
  return h(
    "div",
    { style: "position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:120;background:#141413;color:#faf9f5;padding:12px 20px;border-radius:10px;font:500 13px 'Poppins',sans-serif;box-shadow:0 8px 24px rgba(20,20,19,0.2);" },
    msg,
  );
}

function render() {
  root.replaceChildren();
  if (!getToken()) {
    root.append(authGate());
    return;
  }
  const content =
    state.view === "dashboard"
      ? renderDashboard(state, actions)
      : state.view === "matrix"
        ? renderMatrix(state, actions)
        : renderBoard(state, actions);
  root.append(
    h(
      "div",
      { style: "display:flex;height:100vh;width:100%;overflow:hidden;background:#faf9f5;" },
      sidebar(state, actions),
      h(
        "main",
        { class: "scrl", style: "flex:1;height:100vh;overflow-y:auto;background:#faf9f5;" },
        header(state, actions),
        h("div", { style: "padding:26px 34px 72px;max-width:1180px;margin:0 auto;" }, content),
      ),
    ),
  );
  if (state.selected) root.append(renderDrawer(state.selected, actions));
  if (state.toast) root.append(toastEl(state.toast));
}

setUnauthorizedHandler(() => {
  setToken("");
  showToast("Token không hợp lệ. Nhập lại.");
});

async function boot() {
  if (!getToken()) {
    render();
    return;
  }
  await guard(async () => {
    await reloadLists();
    render();
  });
}

boot();
