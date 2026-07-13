import {
  QCOLOR,
  QLABEL,
  QSUB,
  SBG,
  SCOLOR,
  SLABEL,
  barFill,
  checklistLine,
  fmtDeadline,
  h,
} from "./app-format.js";

const INK = "#141413";
const VIEW_META = {
  dashboard: { t: "Tổng quan", s: "Bức tranh công việc của bạn hôm nay" },
  matrix: { t: "Ma trận Eisenhower", s: "Ưu tiên theo mức độ khẩn cấp và quan trọng" },
  board: { t: "Bảng công việc", s: "Theo dõi tiến độ theo trạng thái" },
};
const NAV = [
  ["dashboard", "Tổng quan"],
  ["matrix", "Ma trận Eisenhower"],
  ["board", "Bảng công việc"],
];

function navBtn(view, key, label, actions) {
  const on = view === key;
  const base =
    "display:flex;align-items:center;gap:11px;width:100%;box-sizing:border-box;text-align:left;padding:9px 12px;border-radius:9px;font:500 13.5px 'Poppins',sans-serif;cursor:pointer;transition:background .12s;";
  const style = on
    ? `${base}border:1px solid #e8e6dc;background:#fff;color:#141413;`
    : `${base}border:1px solid transparent;background:transparent;color:#8a887f;`;
  return h("button", { style, "data-hover": "1", onclick: () => actions.setView(key) }, label);
}

function sidebar(state, actions) {
  const projects = (state.projects || []).map((p) =>
    h(
      "div",
      { style: "display:flex;align-items:center;gap:9px;padding:6px 8px;font:400 13px 'Lora',serif;color:#141413;" },
      h("span", { style: `width:7px;height:7px;border-radius:999px;background:${p.color || "#6a9bcc"};` }),
      p.name,
    ),
  );
  return h(
    "aside",
    { style: "width:248px;flex:none;height:100vh;box-sizing:border-box;padding:22px 16px;border-right:1px solid #e8e6dc;background:#f2efe4;display:flex;flex-direction:column;gap:6px;" },
    h(
      "div",
      { style: "display:flex;align-items:center;gap:10px;padding:6px 8px 20px;" },
      h("span", { style: "width:11px;height:11px;border-radius:999px;background:#d97757;flex:none;" }),
      h("span", { style: "font:600 17px 'Poppins',sans-serif;letter-spacing:-0.02em;color:#141413;" }, "tiêu điểm"),
    ),
    h("div", { style: "padding:0 8px 6px;font:500 10.5px 'Poppins',sans-serif;letter-spacing:0.12em;text-transform:uppercase;color:#b0aea5;" }, "Không gian làm việc"),
    h("nav", { style: "display:flex;flex-direction:column;gap:3px;" }, ...NAV.map(([k, l]) => navBtn(state.view, k, l, actions))),
    projects.length
      ? h(
          "div",
          {},
          h("div", { style: "height:1px;background:#e0ddd0;margin:16px 8px;" }),
          h("div", { style: "padding:0 8px 6px;font:500 10.5px 'Poppins',sans-serif;letter-spacing:0.12em;text-transform:uppercase;color:#b0aea5;" }, "Dự án"),
          h("div", { style: "display:flex;flex-direction:column;gap:2px;padding:0 4px;" }, ...projects),
        )
      : null,
  );
}

function header(state, actions) {
  const meta = VIEW_META[state.view];
  const dateStr = new Date().toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return h(
    "header",
    { style: "position:sticky;top:0;z-index:6;display:flex;align-items:flex-end;justify-content:space-between;gap:20px;padding:20px 34px 18px;background:rgba(250,249,245,0.9);backdrop-filter:saturate(140%) blur(8px);border-bottom:1px solid #e8e6dc;" },
    h(
      "div",
      { style: "display:flex;flex-direction:column;gap:4px;" },
      h("span", { style: "font:500 11px 'Poppins',sans-serif;letter-spacing:0.1em;text-transform:uppercase;color:#b0aea5;" }, dateStr),
      h("h1", { style: "margin:0;font:600 23px 'Poppins',sans-serif;letter-spacing:-0.02em;color:#141413;" }, meta.t),
      h("span", { style: "font:400 13px 'Lora',serif;color:#8a887f;" }, meta.s),
    ),
    h(
      "button",
      { style: "display:flex;align-items:center;gap:7px;padding:9px 16px;border:none;border-radius:9px;background:#141413;color:#faf9f5;font:500 13.5px 'Poppins',sans-serif;cursor:pointer;", onclick: actions.newTask },
      h("span", { style: "font-size:16px;line-height:1;" }, "+"),
      " Việc mới",
    ),
  );
}

// Shared task card used by matrix + board columns.
function taskCard(t, actions, opts = {}) {
  const kids = [
    h(
      "div",
      { style: "display:flex;align-items:center;gap:8px;" },
      h("span", { style: `width:8px;height:8px;flex:none;border-radius:999px;background:${SCOLOR[t.status]};` }),
      h("span", { style: `flex:1;font:500 13.5px 'Poppins',sans-serif;color:${opts.muted ? "#8a887f" : "#141413"};${t.status === "done" ? "text-decoration:line-through;" : ""}` }, t.title),
    ),
  ];
  if (!opts.muted)
    kids.push(
      h(
        "div",
        { style: "height:5px;border-radius:999px;background:#eeece2;overflow:hidden;margin-top:9px;" },
        h("div", { style: barFill(t.progress) }),
      ),
    );
  kids.push(
    h(
      "div",
      { style: "display:flex;justify-content:space-between;margin-top:7px;font:400 11px 'JetBrains Mono',monospace;color:#8a887f;" },
      h("span", {}, checklistLine(t)),
      h("span", {}, fmtDeadline(t.deadline).short),
    ),
  );
  return h(
    "div",
    { style: "border:1px solid #eeece2;border-radius:9px;padding:11px 13px;cursor:pointer;background:#fff;", "data-hover": "1", onclick: () => actions.selectTask(t.id) },
    ...kids,
  );
}

function quadPanel(q, tasks, accent, actions, muted) {
  const items = tasks.filter((t) => t.quadrant === q);
  return h(
    "div",
    { style: `background:${muted ? "#faf9f5" : "#fff"};border:1px ${muted ? "dashed #d8d5c8" : "solid #e8e6dc"};border-top:3px solid ${accent};border-radius:0 0 12px 12px;display:flex;flex-direction:column;min-height:280px;` },
    h(
      "div",
      { style: "display:flex;align-items:center;justify-content:space-between;padding:16px 20px 12px;border-bottom:1px solid #f0eee4;" },
      h(
        "div",
        {},
        h("div", { style: `font:600 15px 'Poppins',sans-serif;color:${muted ? "#8a887f" : "#141413"};` }, QLABEL[q]),
        h("div", { style: "font:400 12px 'Lora',serif;color:#8a887f;" }, QSUB[q]),
      ),
      h("span", { style: `font:600 13px 'JetBrains Mono',monospace;color:${accent};background:${accent}1f;padding:3px 9px;border-radius:999px;` }, String(items.length)),
    ),
    h("div", { class: "scrl", style: "flex:1;overflow-y:auto;padding:8px 12px 12px;display:flex;flex-direction:column;gap:8px;" }, ...items.map((t) => taskCard(t, actions, { muted }))),
  );
}

function renderMatrix(state, actions) {
  const active = state.tasks.filter((t) => t.status !== "done");
  return h(
    "div",
    { style: "display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:16px;" },
    quadPanel("q1", active, QCOLOR.q1, actions, false),
    quadPanel("q2", active, QCOLOR.q2, actions, false),
    quadPanel("q3", active, QCOLOR.q3, actions, false),
    quadPanel("q4", active, QCOLOR.q4, actions, true),
  );
}

function boardColumn(key, label, color, bg, border, tasks, actions) {
  const items = tasks.filter((t) => t.status === key);
  const nextLabel = { todo: "Bắt đầu →", doing: "Hoàn thành →" }[key];
  const card = (t) =>
    h(
      "div",
      { style: `background:#fff;border:1px solid ${border};border-radius:11px;padding:14px;cursor:pointer;${key === "done" ? "opacity:0.85;" : ""}`, "data-hover": "1", onclick: () => actions.selectTask(t.id) },
      h(
        "div",
        { style: "display:flex;align-items:center;gap:8px;margin-bottom:9px;" },
        h("span", { style: `display:inline-flex;padding:3px 9px;border-radius:999px;font:500 11px 'Poppins',sans-serif;color:${QCOLOR[t.quadrant] || "#8a887f"};background:${QCOLOR[t.quadrant] || "#8a887f"}1f;` }, QLABEL[t.quadrant] || "—"),
        h("span", { style: "flex:1;" }),
        h("span", { style: "font:400 11px 'JetBrains Mono',monospace;color:#8a887f;" }, fmtDeadline(t.deadline).short),
      ),
      h("div", { style: `font:500 14px 'Poppins',sans-serif;color:${key === "done" ? "#8a887f" : "#141413"};line-height:1.35;margin-bottom:11px;${key === "done" ? "text-decoration:line-through;" : ""}` }, t.title),
      key !== "done"
        ? h("div", { style: "height:6px;border-radius:999px;background:#eeece2;overflow:hidden;" }, h("div", { style: barFill(t.progress) }))
        : null,
      key !== "done"
        ? h(
            "div",
            { style: "display:flex;align-items:center;justify-content:space-between;margin-top:11px;" },
            h("span", { style: "font:400 11.5px 'JetBrains Mono',monospace;color:#8a887f;" }, checklistLine(t)),
            h("button", { style: "border:1px solid #d8d5c8;background:#fff;border-radius:7px;padding:3px 10px;font:500 12px 'Poppins',sans-serif;color:#141413;cursor:pointer;", onclick: (e) => (e.stopPropagation(), actions.advance(t.id, t.status)) }, nextLabel),
          )
        : null,
    );
  return h(
    "div",
    { style: `background:${bg};border:1px solid ${border};border-radius:14px;padding:6px;` },
    h(
      "div",
      { style: "display:flex;align-items:center;gap:9px;padding:13px 14px 11px;" },
      h("span", { style: `width:9px;height:9px;border-radius:999px;background:${color};` }),
      h("span", { style: "font:600 14px 'Poppins',sans-serif;color:#141413;" }, label),
      h("span", { style: `font:500 12px 'JetBrains Mono',monospace;color:${color};` }, String(items.length)),
    ),
    h("div", { style: "display:flex;flex-direction:column;gap:10px;padding:4px;" }, ...items.map(card)),
  );
}

function renderBoard(state, actions) {
  return h(
    "div",
    { style: "display:grid;grid-template-columns:repeat(3,1fr);gap:16px;align-items:start;" },
    boardColumn("todo", "Cần làm", "#b0aea5", "#f6f4ec", "#e8e6dc", state.tasks, actions),
    boardColumn("doing", "Đang làm", "#6a9bcc", "#eef3f8", "#dbe6f0", state.tasks, actions),
    boardColumn("done", "Hoàn thành", "#788c5d", "#eef2ea", "#dde5d3", state.tasks, actions),
  );
}

export { sidebar, header, renderMatrix, renderBoard, INK };
export { renderDashboard } from "./app-dashboard.js";
