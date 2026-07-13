---
phase: 2
title: "Domain Logic (TDD)"
status: done
priority: P1
dependencies: [1]
---

# Phase 2: Domain Logic (TDD)

## Overview
Zod domain schemas (1 nguồn, dùng chung REST validation + MCP tools) + hàm domain **thuần, không I/O**: progress, status-lifecycle (completedAt + DoD-gate + **done-state reconciliation**), dashboard aggregates với **cửa sổ ngày local đúng**. Test dày nhất plan.

## Requirements
- Functional: đúng business rules §4 spec; xử lý done-state drift (H3); mass-assignment chặn ở schema (H6).
- Non-functional: hàm thuần, tất định (truyền `now`/`timezone` vào tham số). Schema tái dùng được cho cả `@hono/zod-validator` và MCP tool.

## Architecture
- `domain/schemas.ts`: Zod enums (`quadrant`, `status`). **`TaskPatch` = `.strict()` whitelist** chỉ field user sửa (title/quadrant/status/deadline/timeBlock/method/projectId/tags); **reject `progress/completedAt/userId/id/createdAt`** (H6). Export type từ Zod. **Adapter reuse (H4)**: schema viết dạng `z.object()`; export kèm `.shape` để MCP tool (ZodRawShape) dùng lại — có test chứng minh 1 schema chạy được cả 2 nơi. Pin 1 zod major (P1).
- `domain/progress.ts`: `computeProgress(dod, subtasks, status)` → `items>0 ? round(done/total*100) : {todo:0,doing:40,done:100}[status]`; trả kèm `{dodDone,dodTotal,subDone,subTotal}`.
- `domain/status-lifecycle.ts`:
  - `assertDodComplete(dod, gateEnabled)` → `DomainError('DOD_INCOMPLETE',422)`.
  - `applyStatusTransition(prev,next,now)` → set `completedAt` vào `done`, clear khi rời.
  - **`reconcileOnChildChange(task, dod, subtasks)` (H3/FM4)**: nếu task đang `done` mà DoD chưa đủ (toggle off / thêm mới) → **auto-revert `doing` + clear `completedAt`**. Gọi sau mọi mutation dod/subtask.
- `domain/dashboard.ts`: `summarize(tasks)`; **`productivityByDay(tasks, range, timezone)` (M2/FM6)**: cửa sổ tính theo **ngày lịch local** (`localMidnight(today-6) … localMidnight(today)+1d`), KHÔNG dùng `now - N*86400*1000`; bucket theo ngày local.
- `domain/errors.ts`: `DomainError{code,httpStatus}`.

## Related Code Files
- Create: `src/domain/schemas.ts`, `progress.ts`, `status-lifecycle.ts`, `dashboard.ts`, `errors.ts`
- Create: `test/domain/{progress,status-lifecycle,dashboard,schemas,schema-reuse}.test.ts`

## Implementation Steps
1. **(RED)** `schemas.test.ts`: title trim 1–200; enum sai→fail; **`TaskPatch` với `progress`/`completedAt` → bị strip/422 (H6)**.
2. Implement `schemas.ts` (`.strict()` + `.shape` export) → GREEN.
3. **(RED→GREEN)** `schema-reuse.test.ts` (H4): feed 1 schema vào 1 route-validator giả lập + 1 tool-shape → cả 2 chấp nhận. Chốt zod version.
4. **(RED→GREEN)** `progress.test.ts`: rỗng→map status; items→ratio (mốc 43% như spec); raw counts.
5. **(RED→GREEN)** `status-lifecycle.test.ts`: gate bật + DoD thiếu→422; vào done set/rời clear `completedAt`; **reconcile: toggle DoD off sau done → status về doing + completedAt null; add DoD vào done task → doing (H3)**.
6. **(RED→GREEN)** `dashboard.test.ts`: summary counts/tỉ lệ/q1/phân bố/sắp hạn; **productivity: completion lúc 00:30 và 23:30 local ở ngày đầu/cuối cửa sổ, 1 timezone cấu hình, `now` cố định (bỏ tz thứ 2 — M2)**.
7. Refactor. `ck plan check 2`.

## Success Criteria
- [ ] Test domain xanh; hàm thuần tất định.
- [ ] `TaskPatch` chặn field tính-ra (H6).
- [ ] 1 Zod schema dùng được cả REST validator + MCP shape (H4).
- [ ] Không tồn tại trạng thái `done` + DoD chưa đủ sau reconcile (H3).
- [ ] Productivity gom đúng theo cửa sổ ngày local, biên nửa đêm (M2).

## Risk Assessment
- **Done-state drift** (H3): nếu quên gọi reconcile ở service → dữ liệu bẩn. Mitigation: service test P3 assert bất biến.
- **Zod dual-consumer** (H4): shape vs object khác nhau. Mitigation: schema-reuse test là gate trước khi build 18 tool.
- **Range window off-by-one/DST** (M2): Mitigation: tính theo ngày lịch, test biên.
