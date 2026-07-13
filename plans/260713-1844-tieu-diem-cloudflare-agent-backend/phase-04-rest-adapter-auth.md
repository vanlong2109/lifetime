---
phase: 4
title: "REST Adapter & Auth"
status: done
priority: P1
dependencies: [3]
---

# Phase 4: REST Adapter & Auth

## Overview
Lớp REST mỏng (Hono + `@hono/zod-validator`) phơi service layer thành ~15 endpoint khớp spec §05, có **bearer auth fail-closed** (scope `userId`), validation Zod→422, và **error handler an toàn** (không rò nội bộ). Định nghĩa **thứ tự dispatch dứt khoát** trong `index.ts`.

## Requirements
- Functional: đủ endpoint spec §05; auth bắt buộc; lỗi chuẩn (401/403/404/422 + catch-all 500 sạch).
- Non-functional: route file < 200 LOC; validation dùng lại Zod schema P2 (không `@hono/zod-openapi`).

## Architecture
- **Routing precedence (C2/AD1)** — `src/index.ts` dispatch DỨT KHOÁT theo thứ tự: `/mcp` (+`/sse` nếu có) → MCP handler (P5); `/api/*` → Hono app; còn lại → `env.ASSETS.fetch()` (P6). Quyết định `run_worker_first` tường minh để Worker chạy trước cho `/api` & `/mcp`. Không còn "Hono owns mọi path". Không có `/openapi.json`.
- `auth/bearer-token.ts` (M1/SA2): đọc `Authorization: Bearer <token>`, so với Workers Secret. **Fail-closed**: secret undefined/empty → deny-all 401; bearer rỗng/whitespace → 401. (Tùy chọn: constant-time compare `crypto.subtle.timingSafeEqual`.) Set `ctx.userId` (hằng) + timezone/gate từ env **chỉ sau khi verify**. Áp cho `/api`; `/mcp` verify riêng ở P5 (C1).
- `rest/app.ts`: Hono + middleware + mount route + **error handler**: map `DomainError.code/httpStatus`; **catch-all → 500 `{code:"INTERNAL"}` (log server-side, không trả SQL/schema/stack)** (M4/SA7).
- `rest/tasks-routes.ts`: `GET/POST /api/tasks`, `GET/PATCH/DELETE /api/tasks/{id}`, `PATCH /api/tasks/{id}/move`. **PATCH dùng `TaskPatch.strict()`** (H6) → status qua gate; move chỉ rank/quadrant.
- `rest/dod-subtask-routes.ts`, `rest/dashboard-routes.ts`, `rest/meta-routes.ts` (projects/tags).

## Related Code Files
- Create: `src/auth/bearer-token.ts`, `src/rest/{app,tasks-routes,dod-subtask-routes,dashboard-routes,meta-routes,errors}.ts`
- Modify: `src/index.ts` (dispatch order)
- Create: `test/rest/*.test.ts`, `test/rest/auth.test.ts`, `test/rest/routing.test.ts`

## Implementation Steps
1. **(RED)** `auth.test.ts`: thiếu token→401; **secret unset→deny-all (M1)**; bearer rỗng→401; đúng token→qua.
2. Implement `bearer-token.ts` + `rest/app.ts` + error handler → GREEN.
3. **(RED→GREEN)** `routing.test.ts` (C2): `/api/x`→Hono; `/`→Assets fallback; `/mcp`→không lọt vào Hono 404.
4. **(RED→GREEN)** `tasks-routes.test.ts`: CRUD + move + filter; body sai→422; **patch với `progress`/`completedAt`→bị chặn (H6)**; status→done chặn→422 `DOD_INCOMPLETE`; `GET /api/tasks/{id}` khớp shape spec.
5. **(RED→GREEN)** dod/subtask, dashboard (§4.4), meta routes.
6. **(RED→GREEN)** error leak: input gây lỗi DB → trả 500 sạch, không lộ SQL (M4).
7. `ck plan check 4`.

## Success Criteria
- [ ] ~15 endpoint khớp path/shape spec §05.
- [ ] Auth fail-closed: thiếu/secret-unset/bearer-rỗng → 401; scope `userId`.
- [ ] Routing dispatch dứt khoát (`/api`/`/mcp`/Assets) test-verified (C2).
- [ ] Validation→422; `TaskPatch` chặn field tính-ra (H6); DoD-gate→422.
- [ ] Lỗi bất ngờ→500 sạch, không rò nội bộ (M4).

## Risk Assessment
- **Assets serve-first che Worker** (C2): asset path bỏ qua middleware. Mitigation: dispatch order + `run_worker_first` cho `/api`,`/mcp`; test routing.
- **Shape lệch prototype**: Mitigation: pin response schema theo ví dụ spec, snapshot test.
