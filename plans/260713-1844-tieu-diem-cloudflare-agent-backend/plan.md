---
title: "tieu diem — Cloudflare Workers task backend (REST + MCP)"
description: "Agent-controllable personal task backend on Cloudflare Workers + D1, TDD"
status: done
priority: P2
branch: "master"
tags: [cloudflare, workers, d1, hono, drizzle, mcp, tdd]
blockedBy: []
blocks: []
created: "2026-07-13T11:57:29.612Z"
createdBy: "ck:plan"
source: skill
---

# tieu diem — Cloudflare Workers task backend (REST + MCP)

## Overview

Backend cho app quản lý công việc cá nhân "tiêu điểm" (1 user). Deploy **Cloudflare Workers**. Kiến trúc **1-core / 2-adapter**: một domain service duy nhất phục vụ **REST** (frontend) và **MCP** (AI agent) → agent điều khiển app dễ nhất, không lệch hành vi với UI. v1 chạy end-to-end: backend + wire + host frontend tĩnh trên cùng Worker.

Nguồn: `plans/reports/brainstorm-260713-1844-tieu-diem-cloudflare-agent-backend-report.md`. Spec gốc: Claude Design `Ban giao Backend.dc.html`. Plan đã qua red-team (xem `## Red Team Review`).

## Tech stack (đã chốt)

| Lớp | Chọn |
|---|---|
| Runtime | Cloudflare Workers (TypeScript) |
| Framework | Hono + `@hono/zod-validator` (REST validation) |
| DB | Cloudflare D1 (SQLite) + Drizzle ORM + drizzle-kit migrations |
| Validation/types | Zod — 1 nguồn sự thật, **pin 1 zod major** dùng chung REST + MCP |
| Agent surface | Remote MCP — **stateless Streamable-HTTP** (MCP TypeScript SDK), **không Durable Object** |
| Auth | Bearer token (Workers Secret), fail-closed, `userId` cố định |
| Test | Vitest + `@cloudflare/vitest-pool-workers` (workerd + D1 thật; **pin version tương thích**) |
| Frontend host | Workers Assets (static) |

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Scaffold, De-risk Spikes & DB Schema](./phase-01-scaffold-db-schema.md) | Done |
| 2 | [Domain Logic (TDD)](./phase-02-domain-logic-tdd.md) | Done |
| 3 | [Services & D1 Repository](./phase-03-services-d1-repository.md) | Done |
| 4 | [REST Adapter & Auth](./phase-04-rest-adapter-auth.md) | Done |
| 5 | [MCP Adapter](./phase-05-mcp-adapter.md) | Done |
| 6 | [Frontend Wiring & Host](./phase-06-frontend-wiring-host.md) | Done |

Dependency: P2→P1, P3→P2, P4→P3, **P5→P3** (MCP adapter chỉ cần service layer; parity checkpoint chạy khi cả P4+P5 xong), P6→P4+P5. Phase 1 chứa 2 de-risk spike chạy TRƯỚC (frontend export, MCP-transport testability).

## TDD contract (áp mọi phase)

Mỗi phase: **test đỏ trước** → xanh → refactor. Business rules khóa bằng test ở P2–P3 trước khi có adapter. **Ngoại lệ ceremony**: P1 chỉ cần smoke boot + test bất biến migration (không RED-first cho `/health`); không test lại hành vi framework.

## Global acceptance criteria

- [ ] **Backend** (`/api/*` REST + `/mcp` MCP + D1) `wrangler deploy` chạy end-to-end trên Cloudflare — **độc lập** với kết quả export frontend.
- [ ] Khớp spec: 6 thực thể, enum `quadrant/status`, 4 nhóm business rule (progress/DoD-gate/lifecycle/dashboard), ~15 REST endpoint, dashboard aggregates.
- [ ] **Parity (serial)**: chạy kịch bản qua REST → snapshot S1 → reset D1 → chạy qua MCP → S2; assert S1==S2 (loại id/timestamp autogen). KHÔNG chạy song song.
- [ ] Agent flow qua MCP: tạo task → thêm DoD → toggle → chuyển `done` (chặn `422 DOD_INCOMPLETE` khi DoD chưa đủ) → đọc dashboard — đúng hết.
- [ ] **Auth thật sự áp cho cả `/api` và `/mcp`**: thiếu token → 401; secret chưa set → deny-all (fail-closed); scope `userId`; user khác → 403, không tồn tại → 404.
- [ ] **An toàn migration**: test seed dữ liệu con → chạy migration → dữ liệu con còn nguyên (không CASCADE mất). Có runbook Time-Travel trước khi apply prod.
- [ ] Frontend prototype thao tác đầy đủ trên dữ liệu thật, persist qua reload; task text render escaped (không XSS).
- [ ] `vitest` toàn bộ xanh; không test bị skip/nới lỏng để pass.

## Dependencies (external)

- Tài khoản Cloudflare + `wrangler` login; quyền tạo D1. (Không cần Durable Object.)
- Node ≥ 20, pnpm/npm. **Version pin** cho wrangler/vitest-pool-workers/MCP SDK/zod/drizzle ghi ở P1.
- Skills tham chiếu (API đổi nhanh — dùng docs mới nhất): `cloudflare`, `wrangler`, `workers-best-practices`, `databases`, `mcp-builder`.

## Open questions (đã chốt phần lớn qua red-team)

1. **Frontend export**: de-risk bằng spike đầu P1 (go/no-go + fallback markup có acceptance rõ). Deploy backend không phụ thuộc kết quả này.
2. **Timezone**: hardcode env constant (`Asia/Bangkok`). Test chỉ tz cấu hình + biên nửa đêm (bỏ test tz thứ 2).
3. **DoD-done invariant** (H3): khi sửa DoD/subtask trên task `done` → **auto-revert status về `doing` + clear `completedAt`** (đã chốt hướng này; test ở P2).
4. **MCP auth**: static bearer, fail-closed; thêm ghi chú quy trình rotation (`wrangler secret put`). Per-surface token/rate-limit = hoãn (YAGNI 1 user).
5. **Deferred (spec §08)**: nhắc nhở, recurring, team/workspace, time-blocking cấu trúc, auto-priority.

## Dependencies

Greenfield — không plan nào khác trong scope. Không cross-plan dependency.

---

## Red Team Review

### Session — 2026-07-13
**Reviewers:** 4 (Security Adversary, Failure Mode Analyst, Assumption Destroyer, Scope & Complexity Critic)
**Findings:** 29 raw → 15 deduped (15 accepted, 3 deferred/rejected)
**Severity breakdown:** 4 Critical, 8 High, 3 Medium (accepted)

| # | Finding | Severity | Disposition | Applied To |
|---|---------|----------|-------------|------------|
| C1 | MCP surface not actually authenticated (bypasses REST middleware) | Critical | Accept | P5, P4 |
| C2 | Routing precedence contradiction (Hono vs Assets catch-all) + Assets-serve-first | Critical | Accept | P4, P6 |
| C3 | D1 FK premise inverted → migration CASCADE data-loss | Critical | Accept | P1, P3 |
| C4 | D1 has no interactive transactions; batch()≠read-modify-write | Critical | Accept | P3 |
| H1 | Durable Object over-built → stateless MCP default | High | Accept (user) | P1, P5 |
| H2 | move/position redundant + gate-bypass + reindex race | High | Accept-modified (keep drag-drop, harden) | P1, P3 |
| H3 | DoD-gate only on transition → done-state drift | High | Accept | P2, P3 |
| H4 | "single Zod source" reuse + zod-version conflict unverified | High | Accept | P1, P2, P4, P5 |
| H5 | Parity test underspecified (transport dep, no isolation, must be serial) | High | Accept | P5 |
| H6 | Mass-assignment on TaskPatch/update_task | High | Accept | P2, P4 |
| H7 | No migration rollback/recovery story | High | Accept | P1 |
| H8 | Risky spikes back-loaded; P5 dep should be [3]; export fallback unscoped | High | Accept | P1, P5, P6 |
| M1 | Auth not fail-closed on unset/empty secret | Medium | Accept | P4 |
| M2 | Productivity range window UTC vs local-day; drop 2nd-tz test | Medium | Accept | P2 |
| M3 | No version pinning ("use latest" ≠ spec) | Medium | Accept | P1 |
| M4 | Frontend XSS escaping + sanitized catch-all 500 | Medium | Accept | P4, P6 |
| — | Rate limiting (SA4) | Medium | Defer | edge DDoS baseline; post-v1 |
| — | Per-surface tokens/rotation (SA3) | Medium | Reject-partial | YAGNI 1 user; add rotation note only |
| — | Drop Projects (SC6) | Medium | Reject | frontend nav "Dự án" needs it; keep minimal |

**User scope decisions:** MCP = stateless Streamable-HTTP (drop DO). Drag-drop = KEEP, hardened. Projects = keep minimal.

### Whole-Plan Consistency Sweep
- DO removed from P1 bindings + P5 architecture; `@hono/zod-openapi`/`/openapi.json` replaced by `@hono/zod-validator` in P4 + tech stack; parity reworded serial in P5 + global acceptance; FK/transaction premise corrected in P1+P3; P5 dependency set to [3]; frontend spike moved to P1; deploy acceptance decoupled from export.
- No stale references to Durable Object, OpenAPI endpoint, "PRAGMA foreign_keys=ON mitigation", or "parallel parity" remain. Zero unresolved contradictions.
