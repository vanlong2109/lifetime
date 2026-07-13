---
phase: 3
title: "Services & D1 Repository"
status: done
priority: P1
dependencies: [2]
---

# Phase 3: Services & D1 Repository

## Overview
Service layer duy nhất (REST + MCP dùng chung) trên D1 qua Drizzle: CRUD, scope `userId`, cascade, gọi domain P2. Tôn trọng **giới hạn thật của D1** (không interactive transaction) và **drag-drop rank an toàn**.

## Requirements
- Functional: đủ thao tác cho ~15 endpoint + MCP tools. Query lọc `userId`. Cascade xoá dod/subtask theo task. Tag dedup bằng **unique index DB**. `progress` gắn khi đọc. Reconcile done-state sau mutation con (H3).
- Non-functional: service nhận `db` + `ctx{userId,timezone,gateEnabled}`; không phụ thuộc Hono/MCP; file < 200 LOC.

## Architecture
- **D1 constraints (C4/FM2)**: KHÔNG dùng `db.transaction()` (throw trên D1). Đa-câu-lệnh all-or-nothing dùng `db.batch([...])` (danh sách cố định). Read-modify-write **đẩy vào 1 câu SQL** hoặc ràng buộc DB:
  - Tag dedup: `INSERT … WHERE NOT EXISTS` / `ON CONFLICT DO NOTHING` trên unique `(userId, lower(name))` — không đọc-rồi-ghi ở app.
  - Cascade delete: dựa FK CASCADE (luôn bật ở D1) bằng 1 `DELETE FROM tasks WHERE id=?`; test assert con biến mất.
- **Drag-drop (H2/FM3, user giữ)**: dùng cột `rank` fractional/lexicographic. `move` = **1-row UPDATE** đặt `rank` giữa 2 lân cận; KHÔNG renumber sibling → không race 2-writer. Unique index bảo vệ thứ tự. **`move` KHÔNG đổi `status`** (tránh bypass gate) — chỉ `rank` (+ `quadrant` nếu kéo giữa góc); đổi `status` chỉ qua `patch` (đi qua gate). (C2/SC2)
- `services/context.ts`, `ownership.ts` (`assertOwned`→404 nếu không thấy, 403 nếu user khác).
- `task-service.ts`: `list`, `get` (kèm dod+subtasks+progress), `create`, `patch` (status qua lifecycle+gate), `move` (rank/quadrant), `remove` (cascade).
- `dod-service.ts`/`subtask-service.ts`: add/toggle/delete → **gọi `reconcileOnChildChange`** (H3).
- `project-service.ts` (giữ tối thiểu), `tag-service.ts` (dedup DB), `dashboard-service.ts`.

## Related Code Files
- Create: `src/services/{context,ownership,task-service,dod-service,subtask-service,project-service,tag-service,dashboard-service}.ts`
- Create: `test/services/*.test.ts` (vitest-pool-workers + D1 thật), `test/helpers/seed.ts`

## Implementation Steps
1. **(RED)** `task-service.test.ts`: create→get progress đúng; patch status→done chặn khi DoD thiếu; **remove cascade: assert dod+subtask biến mất (C3)**; list filter; user khác→403, id lạ→404.
2. Implement `ownership.ts` + `task-service.ts` → GREEN.
3. **(RED→GREEN)** `move`: 2 move chồng nhau → tổng thứ tự hợp lệ, **không rank trùng** (H2/FM3); `move` không đổi status.
4. **(RED→GREEN)** dod/subtask: add/toggle/delete; **toggle DoD off trên task done → task về doing + completedAt null (H3)**; xoá task cascade.
5. **(RED→GREEN)** tag: dedup case-insensitive bằng unique index (2 create song song → 1 tag, không đọc-rồi-ghi — C4); project CRUD tối thiểu.
6. **(RED→GREEN)** dashboard-service: seed đa trạng thái/completedAt → summary + productivity khớp domain.
7. Refactor scope helper. `ck plan check 3`.

## Success Criteria
- [ ] Service test xanh trên D1 thật (không mock).
- [ ] Cascade xoá đúng; không rò tài nguyên (403/404).
- [ ] Tag dedup bằng DB constraint, an toàn 2-writer (C4).
- [ ] `move` an toàn không race, không đổi status (H2).
- [ ] Không tồn tại `done` + DoD chưa đủ sau toggle (H3).
- [ ] Không dùng `db.transaction()`; đa-bảng dùng `batch()`/SQL đơn.

## Risk Assessment
- **D1 no interactive tx** (C4): đọc-rồi-ghi không atomic. Mitigation: đẩy vào 1 SQL / ràng buộc DB; batch cho danh sách cố định.
- **Rank hết chỗ chèn**: fractional string có thể dài dần. Mitigation: rebalance định kỳ (hiếm, 1 user) — ghi chú, không build sớm.
- **Quên reconcile** (H3): Mitigation: test bất biến ở mọi path con.
