import {
  QCOLOR,
  QLABEL,
  SBG,
  SCOLOR,
  SLABEL,
  barFill,
  fmtDeadline,
  h,
} from "./app-format.js";

const WEEKDAY = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

function statCard(label, value, sub, color) {
  return h(
    "div",
    { style: "background:#fff;border:1px solid #e8e6dc;border-radius:12px;padding:17px 20px;" },
    h("div", { style: "font:500 11px 'Poppins',sans-serif;letter-spacing:0.08em;text-transform:uppercase;color:#b0aea5;" }, label),
    h("div", { style: `font:600 30px 'Poppins',sans-serif;color:${color};margin-top:6px;letter-spacing:-0.02em;` }, String(value)),
    h("div", { style: "font:400 12px 'Lora',serif;color:#8a887f;" }, sub),
  );
}

function card(title, sub, ...body) {
  return h(
    "div",
    { style: "background:#fff;border:1px solid #e8e6dc;border-radius:14px;padding:22px 24px;" },
    h(
      "div",
      { style: "display:flex;align-items:baseline;justify-content:space-between;margin-bottom:14px;" },
      h("h3", { style: "margin:0;font:600 16px 'Poppins',sans-serif;color:#141413;" }, title),
      sub ? h("span", { style: "font:400 12px 'Lora',serif;color:#8a887f;" }, sub) : null,
    ),
    ...body,
  );
}

export function renderDashboard(state, actions) {
  const t = state.tasks;
  const total = t.length;
  const done = t.filter((x) => x.status === "done").length;
  const doing = t.filter((x) => x.status === "doing").length;
  const todo = t.filter((x) => x.status === "todo").length;
  const urgent = t.filter((x) => x.quadrant === "q1" && x.status !== "done").length;
  const rate = total ? Math.round((done / total) * 100) : 0;
  const focus = t.filter((x) => x.quadrant === "q1" && x.status !== "done");
  const upcoming = t
    .filter((x) => x.status !== "done" && x.deadline != null)
    .sort((a, b) => a.deadline - b.deadline)
    .slice(0, 5);

  const wk = state.productivity || [];
  const wmax = Math.max(1, ...wk.map((d) => d.count));

  const focusRow = (x) =>
    h(
      "div",
      { style: "display:flex;align-items:center;gap:14px;padding:12px 6px;border-bottom:1px solid #f0eee4;cursor:pointer;", "data-hover": "1", onclick: () => actions.selectTask(x.id) },
      h("span", { style: `width:9px;height:9px;flex:none;border-radius:999px;background:${QCOLOR[x.quadrant]};` }),
      h(
        "div",
        { style: "flex:1;min-width:0;" },
        h("div", { style: "font:500 14px 'Poppins',sans-serif;color:#141413;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" }, x.title),
        h("div", { style: "font:400 12px 'Lora',serif;color:#8a887f;margin-top:1px;" }, `${x.tags[0] ? `${x.tags[0]} · ` : ""}Hạn ${fmtDeadline(x.deadline).short}`),
      ),
      h("div", { style: "width:88px;flex:none;" }, h("div", { style: "height:6px;border-radius:999px;background:#eeece2;overflow:hidden;" }, h("div", { style: barFill(x.progress) }))),
      h("span", { style: `font:600 12px 'JetBrains Mono',monospace;color:${x.progress === 100 ? "#788c5d" : "#8a887f"};width:38px;text-align:right;flex:none;` }, `${x.progress}%`),
    );

  const rateCard = h(
    "div",
    { style: "background:#141413;border-radius:14px;padding:22px 24px;color:#faf9f5;display:flex;flex-direction:column;align-items:center;" },
    h("div", { style: "align-self:flex-start;font:600 16px 'Poppins',sans-serif;margin-bottom:16px;" }, "Tỉ lệ hoàn thành"),
    h(
      "div",
      { style: `position:relative;width:150px;height:150px;border-radius:999px;background:conic-gradient(#788c5d 0% ${rate}%, #2b2b28 ${rate}% 100%);display:flex;align-items:center;justify-content:center;` },
      h(
        "div",
        { style: "width:112px;height:112px;border-radius:999px;background:#141413;display:flex;flex-direction:column;align-items:center;justify-content:center;" },
        h("span", { style: "font:600 34px 'Poppins',sans-serif;letter-spacing:-0.02em;" }, `${rate}%`),
        h("span", { style: "font:400 11px 'Poppins',sans-serif;color:#b0aea5;" }, "đã xong"),
      ),
    ),
    h(
      "div",
      { style: "display:flex;gap:20px;margin-top:20px;" },
      ...[["Xong", done, "#788c5d"], ["Đang làm", doing, "#6a9bcc"], ["Cần làm", todo, "#b0aea5"]].map(([l, v, c]) =>
        h("div", { style: "text-align:center;" }, h("div", { style: `font:600 18px 'Poppins',sans-serif;color:${c};` }, String(v)), h("div", { style: "font:400 11px 'Poppins',sans-serif;color:#b0aea5;" }, l)),
      ),
    ),
  );

  const weeklyChart = card(
    "Năng suất 7 ngày",
    "Số công việc hoàn thành mỗi ngày",
    h(
      "div",
      { style: "display:flex;align-items:flex-end;gap:12px;height:132px;margin-top:6px;" },
      ...wk.map((d, i) =>
        h(
          "div",
          { style: "flex:1;display:flex;flex-direction:column;align-items:center;gap:8px;height:100%;justify-content:flex-end;" },
          h("span", { style: "font:500 11px 'Poppins',sans-serif;color:#8a887f;" }, String(d.count)),
          h("div", { style: `width:100%;border-radius:6px 6px 0 0;height:${Math.round((d.count / wmax) * 100)}%;background:${i === wk.length - 1 ? "#d97757" : "#141413"};min-height:2px;` }),
          h("span", { style: "font:400 11px 'Poppins',sans-serif;color:#b0aea5;" }, WEEKDAY[new Date(`${d.date}T00:00`).getDay()]),
        ),
      ),
    ),
  );

  const quads = ["q1", "q2", "q3", "q4"].map((q) => ({ q, count: t.filter((x) => x.quadrant === q && x.status !== "done").length }));
  const qmax = Math.max(1, ...quads.map((d) => d.count));
  const quadCard = card(
    "Phân bố theo ma trận",
    "Việc chưa xong theo góc phần tư",
    h(
      "div",
      { style: "display:flex;flex-direction:column;gap:14px;margin-top:6px;" },
      ...quads.map((d) =>
        h(
          "div",
          { style: "display:flex;align-items:center;gap:12px;" },
          h("div", { style: "width:130px;flex:none;display:flex;align-items:center;gap:8px;" }, h("span", { style: `width:9px;height:9px;border-radius:999px;flex:none;background:${QCOLOR[d.q]};` }), h("span", { style: "font:500 12.5px 'Poppins',sans-serif;color:#141413;" }, QLABEL[d.q])),
          h("div", { style: "flex:1;height:10px;border-radius:999px;background:#f0eee4;overflow:hidden;" }, h("div", { style: `height:100%;border-radius:999px;background:${QCOLOR[d.q]};width:${Math.round((d.count / qmax) * 100)}%;` })),
          h("span", { style: "width:24px;text-align:right;font:600 13px 'Poppins',sans-serif;color:#141413;" }, String(d.count)),
        ),
      ),
    ),
  );

  const upcomingCard = card(
    "Sắp đến hạn",
    "Theo thời gian còn lại",
    h(
      "div",
      { style: "display:flex;flex-direction:column;" },
      ...(upcoming.length
        ? upcoming.map((x) => {
            const dl = fmtDeadline(x.deadline);
            return h(
              "div",
              { style: "display:flex;align-items:center;gap:14px;padding:11px 4px;border-bottom:1px solid #f0eee4;cursor:pointer;", "data-hover": "1", onclick: () => actions.selectTask(x.id) },
              h("span", { style: `font:500 11px 'Poppins',sans-serif;color:#fff;background:${dl.tone};padding:3px 9px;border-radius:6px;min-width:56px;text-align:center;flex:none;` }, dl.label),
              h("span", { style: `width:9px;height:9px;flex:none;border-radius:999px;background:${QCOLOR[x.quadrant]};` }),
              h("span", { style: "flex:1;font:500 14px 'Poppins',sans-serif;color:#141413;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" }, x.title),
              h("span", { style: `font:500 11px 'Poppins',sans-serif;color:${SCOLOR[x.status]};background:${SBG[x.status]};padding:3px 10px;border-radius:999px;` }, SLABEL[x.status]),
            );
          })
        : [h("div", { style: "padding:16px 4px;font:400 13px 'Lora',serif;color:#b0aea5;font-style:italic;" }, "Không có việc nào sắp đến hạn.")]),
    ),
  );

  const focusCard = card(
    "Tiêu điểm hôm nay",
    "Việc khẩn cấp & quan trọng chưa xong",
    h(
      "div",
      { style: "display:flex;flex-direction:column;gap:2px;" },
      ...(focus.length ? focus.map(focusRow) : [h("div", { style: "padding:22px 6px;font:400 14px 'Lora',serif;color:#b0aea5;font-style:italic;" }, "Không còn việc khẩn cấp nào — tập trung vào việc quan trọng đã lên lịch.")]),
    ),
  );

  return h(
    "div",
    { style: "display:flex;flex-direction:column;gap:20px;" },
    h(
      "div",
      { style: "display:grid;grid-template-columns:repeat(4,1fr);gap:16px;" },
      statCard("Tổng công việc", total, "đang theo dõi", "#141413"),
      statCard("Đang làm", doing, "việc trong tiến trình", "#6a9bcc"),
      statCard("Cần làm ngay", urgent, "ở góc phần tư 1", "#c07a6e"),
      statCard("Hoàn thành", done, "tổng số việc đã xong", "#788c5d"),
    ),
    h("div", { style: "display:grid;grid-template-columns:1.5fr 1fr;gap:18px;align-items:start;" }, focusCard, rateCard),
    h("div", { style: "display:grid;grid-template-columns:1fr 1fr;gap:18px;align-items:start;" }, weeklyChart, quadCard),
    upcomingCard,
  );
}
