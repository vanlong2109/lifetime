import {
  QCOLOR,
  QLABEL,
  SCOLOR,
  SLABEL,
  dateInputValue,
  dateInputToMs,
  h,
} from "./app-format.js";

function segButton(label, on, color, onclick) {
  const style = `flex:1;padding:8px 4px;border-radius:8px;font:500 12.5px 'Poppins',sans-serif;cursor:pointer;border:1px solid ${on ? color : "#e8e6dc"};background:${on ? color : "#fff"};color:${on ? "#fff" : "#8a887f"};`;
  return h("button", { style, onclick }, label);
}

function quadButton(q, on, onclick) {
  const c = QCOLOR[q];
  const style = `padding:9px 6px;border-radius:8px;font:500 12.5px 'Poppins',sans-serif;cursor:pointer;text-align:left;border:1px solid ${on ? c : "#e8e6dc"};background:${on ? `${c}1f` : "#fff"};color:${on ? c : "#8a887f"};`;
  return h("button", { style, onclick }, QLABEL[q]);
}

function labelEl(text) {
  return h("div", { style: "font:500 10.5px 'Poppins',sans-serif;letter-spacing:0.1em;text-transform:uppercase;color:#b0aea5;margin-bottom:6px;" }, text);
}

// A checklist item: toggle box + text + delete. Text is display-only (the API
// has add/toggle/delete but no update-text endpoint — edit = delete + re-add).
function checkItem(item, textField, onToggle, onDelete) {
  const done = item.done;
  const box = done
    ? "width:20px;height:20px;flex:none;border-radius:6px;border:1px solid #141413;background:#141413;color:#fff;display:flex;align-items:center;justify-content:center;font:600 11px 'Poppins',sans-serif;cursor:pointer;"
    : "width:20px;height:20px;flex:none;border-radius:6px;border:1.5px solid #cbc9be;background:#fff;color:transparent;display:flex;align-items:center;justify-content:center;cursor:pointer;";
  const txt = done
    ? "flex:1;font:400 14px 'Lora',serif;color:#b0aea5;text-decoration:line-through;padding:4px 0;"
    : "flex:1;font:400 14px 'Lora',serif;color:#141413;padding:4px 0;";
  return h(
    "div",
    { style: "display:flex;align-items:center;gap:10px;" },
    h("button", { style: box, onclick: () => onToggle(item.id, !done) }, done ? "✓" : ""),
    h("span", { style: txt }, item[textField]),
    h("button", { style: "border:none;background:transparent;color:#cbc9be;cursor:pointer;font-size:15px;padding:2px 4px;", onclick: () => onDelete(item.id) }, "✕"),
  );
}

function addRow(placeholder, onAdd) {
  const input = h("input", {
    placeholder,
    style: "flex:1;border:1px dashed #d8d5c8;background:transparent;border-radius:8px;padding:7px 12px;font:500 12.5px 'Poppins',sans-serif;color:#141413;",
    onkeydown: (e) => {
      if (e.key === "Enter") {
        const v = e.target.value.trim();
        if (v) onAdd(v);
        e.target.value = "";
      }
    },
  });
  return h("div", { style: "display:flex;gap:8px;margin-top:10px;" }, input);
}

export function renderDrawer(sel, actions) {
  const qc = QCOLOR[sel.quadrant] || "#8a887f";
  const dodDone = sel.dod.filter((d) => d.done).length;
  const subDone = sel.subtasks.filter((s) => s.done).length;

  const body = h(
    "div",
    { style: "padding:22px 22px 60px;display:flex;flex-direction:column;gap:22px;" },
    h("input", { type: "text", value: sel.title, style: "border:none;background:transparent;font:600 21px 'Poppins',sans-serif;letter-spacing:-0.02em;color:#141413;line-height:1.3;width:100%;padding:0;", onchange: (e) => actions.editField("title", e.target.value) }),
    h(
      "div",
      { style: "display:flex;flex-direction:column;gap:14px;" },
      h("div", {}, labelEl("Trạng thái"), h("div", { style: "display:flex;gap:8px;" }, ...["todo", "doing", "done"].map((s) => segButton(SLABEL[s], sel.status === s, SCOLOR[s], () => actions.setStatus(s))))),
      h("div", {}, labelEl("Góc phần tư Eisenhower"), h("div", { style: "display:grid;grid-template-columns:1fr 1fr;gap:8px;" }, ...["q1", "q2", "q3", "q4"].map((q) => quadButton(q, sel.quadrant === q, () => actions.setQuadrant(q))))),
    ),
    h(
      "div",
      { style: "display:flex;align-items:center;gap:18px;background:#fff;border:1px solid #e8e6dc;border-radius:12px;padding:16px 18px;" },
      h("div", { style: `position:relative;width:72px;height:72px;flex:none;border-radius:999px;background:conic-gradient(#d97757 0% ${sel.progress}%, #eeece2 ${sel.progress}% 100%);display:flex;align-items:center;justify-content:center;` }, h("div", { style: "width:54px;height:54px;border-radius:999px;background:#fff;display:flex;align-items:center;justify-content:center;font:600 16px 'Poppins',sans-serif;color:#141413;" }, `${sel.progress}%`)),
      h("div", { style: "flex:1;" }, h("div", { style: "font:600 14px 'Poppins',sans-serif;color:#141413;" }, "Tiến độ hoàn thành"), h("div", { style: "font:400 13px 'Lora',serif;color:#8a887f;margin-top:2px;" }, `${dodDone}/${sel.dod.length} tiêu chí · ${subDone}/${sel.subtasks.length} bước`)),
    ),
    h(
      "div",
      { style: "display:grid;grid-template-columns:1fr 1fr;gap:12px;" },
      h("div", {}, labelEl("Hạn chót"), h("input", { type: "date", value: dateInputValue(sel.deadline), style: "width:100%;border:1px solid #e8e6dc;border-radius:8px;padding:9px 11px;font:400 13px 'JetBrains Mono',monospace;color:#141413;background:#fff;", onchange: (e) => actions.editField("deadline", dateInputToMs(e.target.value)) })),
      h("div", {}, labelEl("Time block"), h("input", { value: sel.timeBlock || "", placeholder: "vd: 09:00–11:00", style: "width:100%;border:1px solid #e8e6dc;border-radius:8px;padding:9px 11px;font:400 13px 'JetBrains Mono',monospace;color:#141413;background:#fff;", onchange: (e) => actions.editField("timeBlock", e.target.value || null) })),
      h("div", { style: "grid-column:1 / -1;" }, labelEl("Nhãn (phân tách bằng dấu phẩy)"), h("input", { value: sel.tags.join(", "), style: "width:100%;border:1px solid #e8e6dc;border-radius:8px;padding:9px 11px;font:400 13px 'Poppins',sans-serif;color:#141413;background:#fff;", onchange: (e) => actions.editField("tags", e.target.value.split(",").map((x) => x.trim()).filter(Boolean)) })),
    ),
    // DoD
    h(
      "div",
      { style: "background:#fff;border:1px solid #e8e6dc;border-left:3px solid #d97757;border-radius:0 12px 12px 0;padding:16px 18px;" },
      h("div", { style: "display:flex;align-items:baseline;gap:8px;margin-bottom:4px;" }, h("h4", { style: "margin:0;font:600 14.5px 'Poppins',sans-serif;color:#141413;" }, "Định nghĩa Hoàn thành"), h("span", { style: "font:500 11px 'JetBrains Mono',monospace;color:#d97757;" }, "DoD")),
      h("p", { style: "margin:0 0 12px;font:400 12.5px 'Lora',serif;font-style:italic;color:#8a887f;" }, "Các tiêu chí rõ ràng, đo được — đạt hết thì việc mới coi là xong."),
      h("div", { style: "display:flex;flex-direction:column;gap:7px;" }, ...sel.dod.map((d) => checkItem(d, "text", actions.toggleDod, actions.deleteDod))),
      addRow("+ Thêm tiêu chí (Enter)", actions.addDod),
    ),
    // Subtasks
    h(
      "div",
      { style: "background:#fff;border:1px solid #e8e6dc;border-radius:12px;padding:16px 18px;" },
      h("div", { style: "display:flex;align-items:baseline;justify-content:space-between;margin-bottom:12px;" }, h("h4", { style: "margin:0;font:600 14.5px 'Poppins',sans-serif;color:#141413;" }, "Các bước / Subtask"), h("span", { style: "font:500 12px 'JetBrains Mono',monospace;color:#8a887f;" }, `${subDone}/${sel.subtasks.length} bước`)),
      h("div", { style: "display:flex;flex-direction:column;gap:7px;" }, ...sel.subtasks.map((s) => checkItem(s, "title", actions.toggleSubtask, actions.deleteSubtask))),
      addRow("+ Thêm bước (Enter)", actions.addSubtask),
    ),
    // Method
    h("div", {}, labelEl("Phương pháp · Cách tiếp cận"), h("textarea", { rows: "4", placeholder: "Ghi cách bạn định làm việc này…", style: "width:100%;box-sizing:border-box;border:1px solid #e8e6dc;border-radius:10px;padding:12px 13px;font:400 14px 'Lora',serif;line-height:1.6;color:#141413;background:#fff;resize:vertical;", onchange: (e) => actions.editField("method", e.target.value || null) }, sel.method || "")),
  );

  const panel = h(
    "div",
    { class: "scrl", style: "width:472px;max-width:92vw;height:100vh;overflow-y:auto;background:#faf9f5;border-left:1px solid #e8e6dc;box-shadow:0 12px 40px rgba(20,20,19,0.14);animation:drwr .22s cubic-bezier(0.2,0.7,0.2,1);", onclick: (e) => e.stopPropagation() },
    h(
      "div",
      { style: "position:sticky;top:0;z-index:2;display:flex;align-items:center;justify-content:space-between;padding:16px 22px;background:rgba(250,249,245,0.94);backdrop-filter:blur(6px);border-bottom:1px solid #e8e6dc;" },
      h("span", { style: `display:inline-flex;padding:3px 9px;border-radius:999px;font:500 11px 'Poppins',sans-serif;color:${qc};background:${qc}1f;` }, QLABEL[sel.quadrant] || "—"),
      h("button", { style: "border:1px solid #e8e6dc;background:#fff;width:30px;height:30px;border-radius:8px;cursor:pointer;color:#8a887f;font-size:17px;", onclick: actions.closeDrawer }, "✕"),
    ),
    body,
  );

  return h(
    "div",
    { style: "position:fixed;inset:0;z-index:40;background:rgba(20,20,19,0.28);display:flex;justify-content:flex-end;animation:fade .18s ease;", onclick: actions.closeDrawer },
    panel,
  );
}
