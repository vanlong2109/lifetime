---
phase: 6
title: "Frontend Wiring & Host"
status: done
priority: P2
dependencies: [4, 5]
---

# Phase 6: Frontend Wiring & Host

## Overview
Đưa frontend prototype "Tiêu điểm" thành app tĩnh chạy dữ liệu thật: dùng **kết quả spike export ở P1**, thay state in-memory bằng gọi REST, host qua Workers Assets. **Deploy backend KHÔNG phụ thuộc phase này** (đã tách acceptance — H8).

## Requirements
- Functional: mọi màn hình (dashboard, ma trận, cột todo/doing/done, drawer DoD/subtask/method/timeBlock/progress) đọc/ghi qua REST; persist qua reload; **render task text escaped (M4)**.
- Non-functional: asset tĩnh phục vụ bởi Worker theo dispatch order P4; token client không nằm trong bundle công khai.

## Architecture
- **Export theo spike P1**: nếu go → tách `Tieu diem.dc.html` (`x-dc`) thành `public/` HTML/JS/CSS thuần; nếu no-go → dựng markup tối thiểu theo **acceptance đã chốt ở spike** (những màn/state bắt buộc). Không để "rebuild toàn bộ" thành ẩn số cuối. (H8/AD7/FM8)
- `public/app-api.js`: gói fetch (list/create/patch/move, dod/subtask toggle, dashboard) thay state mảng in-memory.
- **XSS (M4/SA6)**: render mọi field task-authored (title/DoD/subtask/method/project) qua `textContent`/escaping — KHÔNG `innerHTML` (agent cũng ghi nội dung → không tin tuyệt đối).
- **Auth client**: 1 user nhập token 1 lần → localStorage; gắn `Authorization` mọi request. Ghi chú giới hạn v1 + quy trình rotation (`wrangler secret put` + nhập lại). (SA3 partial)
- **Host**: `wrangler.jsonc` `assets`→`public/`; `src/index.ts` fallback non-`/api`/non-`/mcp` → Assets (khớp dispatch order P4 — C2).

## Related Code Files
- Create: `public/index.html`, `public/app-api.js`, `public/*.css/js`
- Modify: `wrangler.jsonc` (assets), `src/index.ts` (Assets fallback — nhất quán P4)
- Create: `test/e2e/smoke.test.ts`

## Implementation Steps
1. Lấy quyết định export từ `docs/spike-notes.md` (P1); nếu no-go, theo acceptance fallback đã chốt.
2. Cấu hình Assets + `src/index.ts` fallback → mở được trang (dispatch order khớp P4).
3. **(RED)** `smoke.test.ts`: `/`→200 HTML; `/api/tasks` (token)→200 JSON.
4. `app-api.js`; thay từng màn từ mock→API thật: dashboard → list/CRUD → drawer dod/subtask+progress. Render escaped (M4).
5. Kiểm tay: tạo/sửa/move/toggle DoD → reload còn nguyên.
6. `wrangler deploy` staging; smoke trên URL thật. `ck plan check 6`.

## Success Criteria
- [ ] Trang phục vụ từ Worker Assets; `/`,`/api/*`,`/mcp` cùng 1 Worker, dispatch đúng (C2).
- [ ] Mọi màn chạy dữ liệu thật; không state in-memory; persist qua reload.
- [ ] Task text render escaped — task title chứa markup không thực thi (M4).
- [ ] Token không hard-code trong bundle; có ghi chú rotation.
- [ ] `wrangler deploy` thành công; smoke e2e xanh. (Backend acceptance đã đạt độc lập ở P4/P5.)

## Risk Assessment
- **Export `x-dc`** (H8): đã spike sớm ở P1 + acceptance fallback rõ → không còn ẩn số cuối; backend ship độc lập.
- **XSS→token theft** (M4/SA6): Mitigation: escaping + token rotation note; cân nhắc chuyển token khỏi localStorage nếu về sau thêm surface.
- **Dispatch lệch P4** (C2): Mitigation: 1 nguồn dispatch trong `index.ts`, test routing ở P4.
