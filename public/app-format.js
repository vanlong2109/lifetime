// XSS-safe hyperscript: text children go through createTextNode (auto-escaped),
// so task-authored content is never injected as HTML (finding M4).
export function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null) continue;
    if (k === "style") el.setAttribute("style", v);
    else if (k === "class") el.className = v;
    else if (k === "dataset") Object.assign(el.dataset, v);
    else if (k === "value") el.value = v;
    else if (k.startsWith("on") && typeof v === "function")
      el.addEventListener(k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, v);
  }
  for (const c of kids.flat()) {
    if (c == null || c === false) continue;
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return el;
}

export const QCOLOR = { q1: "#c07a6e", q2: "#788c5d", q3: "#d4a84b", q4: "#b0aea5" };
export const QLABEL = { q1: "Làm ngay", q2: "Lên lịch", q3: "Uỷ thác", q4: "Loại bỏ" };
export const QSUB = {
  q1: "Khẩn cấp & Quan trọng",
  q2: "Quan trọng · Không khẩn",
  q3: "Khẩn cấp · Ít quan trọng",
  q4: "Không khẩn · Không quan trọng",
};
export const SCOLOR = { todo: "#b0aea5", doing: "#6a9bcc", done: "#788c5d" };
export const SLABEL = { todo: "Cần làm", doing: "Đang làm", done: "Hoàn thành" };
export const SBG = { todo: "#f0eee4", doing: "#e9f0f7", done: "#eaf0e5" };

const DAY = 86400000;

// epoch-ms deadline -> display + relative label (client-computed; API stores ms).
export function fmtDeadline(ms) {
  if (ms == null) return { short: "—", label: "Không hạn", tone: "#788c5d", days: null };
  const d = new Date(ms);
  const short = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(ms);
  target.setHours(0, 0, 0, 0);
  const days = Math.round((target - today) / DAY);
  let label;
  let tone;
  if (days < 0) {
    label = days === -1 ? "Hôm qua" : "Quá hạn";
    tone = "#c07a6e";
  } else if (days === 0) {
    label = "Hôm nay";
    tone = "#d97757";
  } else if (days === 1) {
    label = "Ngày mai";
    tone = "#788c5d";
  } else {
    label = `${days} ngày`;
    tone = "#788c5d";
  }
  return { short, label, tone, days };
}

export function dateInputValue(ms) {
  if (ms == null) return "";
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function dateInputToMs(v) {
  if (!v) return null;
  const [y, m, d] = v.split("-").map(Number);
  return new Date(y, m - 1, d).getTime();
}

export function checklistLine(t) {
  const items = t.dodTotal + t.subTotal;
  return items > 0 ? `${t.dodDone + t.subDone}/${items} mục` : "Chưa có mục";
}
export const barFill = (p) =>
  `height:100%;border-radius:999px;background:${p === 100 ? "#788c5d" : "#141413"};width:${p}%;transition:width .3s ease;`;
