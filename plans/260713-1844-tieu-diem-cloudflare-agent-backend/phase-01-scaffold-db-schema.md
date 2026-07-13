---
phase: 1
title: "Scaffold, De-risk Spikes & DB Schema"
status: done
priority: P1
dependencies: []
---

# Phase 1: Scaffold, De-risk Spikes & DB Schema

## Overview
De-risk 2 ẩn số lớn nhất TRƯỚC (frontend export, MCP-transport testability), rồi dựng khung Cloudflare Workers TS (Hono + Drizzle + D1 + Vitest) với **version pin**, định nghĩa Drizzle schema 7 bảng + migration D1 an toàn. Kết thúc: Worker boot, `/health` xanh, migration giữ nguyên dữ liệu con.

## Requirements
- Functional: 2 spike ra quyết định go/no-go; Worker chạy `wrangler dev`; `GET /health`→200; migration tạo đủ bảng và KHÔNG làm mất dữ liệu con.
- Non-functional: file < 200 LOC, kebab-case; version pin ghi rõ; **không dùng Durable Object**.

## Architecture
- **Pre-flight spikes (làm đầu tiên, time-boxed):**
  1. *Frontend export* — thử tách `Tieu diem.dc.html` (Claude Design `x-dc` runtime) → HTML/asset thuần. Ra go/no-go; nếu no-go, chốt acceptance cho fallback "dựng lại markup tối thiểu" (những màn/state bắt buộc). (H8/AD7/FM8)
  2. *MCP transport testability* — xác nhận test được MCP **stateless Streamable-HTTP** trong `vitest-pool-workers`; nếu không, chốt fallback (handler-level + `wrangler dev` smoke). (H5/AD2)
- `wrangler.jsonc`: binding `DB` (D1) + `ASSETS` (Phase 6). **Không có Durable Object binding.** `compatibility_date` cố định + `nodejs_compat`. (H1)
- **Version pin** trong `package.json`: `wrangler`, `@cloudflare/vitest-pool-workers`, `vitest`, MCP TS SDK, `hono`, `@hono/zod-validator`, `zod` (1 major dùng chung REST+MCP), `drizzle-orm`, `drizzle-kit`. Ghi `compatibility_date` + flags cần. (M3/AD6/H4)
- Drizzle schema (SQLite) 7 bảng: `users, projects, tags, tasks, task_tags, dod_criteria, subtasks`. FK **luôn bật ở D1** (không cần PRAGMA). `dod_criteria`/`subtasks` FK→task; `task_tags` M2M.
- **Unique index**: `tags(userId, lower(name))` (dedup ở DB, không ở app — C4); tasks có cột `rank` (text, fractional) thay cho reindex nguyên (H2/FM3), index `tasks(userId,status)` & `tasks(userId,quadrant)`.

## Related Code Files
- Create: `package.json` (pinned), `tsconfig.json`, `wrangler.jsonc`, `drizzle.config.ts`, `vitest.config.ts`
- Create: `src/index.ts` (Hono `/health`), `src/env.ts` (bindings; no DO)
- Create: `src/db/schema.ts`, `src/db/client.ts`
- Create: `migrations/0000_init.sql`
- Create: `test/migrations.test.ts` (data-survival), `test/health.test.ts` (smoke)
- Create: `docs/spike-notes.md` (kết quả 2 spike)

## Implementation Steps
1. **Spike 1 (frontend export)** + **Spike 2 (MCP transport testability)** → ghi `docs/spike-notes.md`, chốt fallback nếu no-go.
2. Init project + **pin versions**; `wrangler.jsonc` (DB, ASSETS; no DO) + `src/env.ts`.
3. `src/index.ts` Hono `/health`; smoke test boot (không RED-first ceremony — H8/SC7).
4. `src/db/schema.ts` (7 bảng, FK, unique index tag, `rank`, index scope).
5. `drizzle.config.ts` + `drizzle-kit generate` → `migrations/0000_init.sql`.
6. **(RED→GREEN)** `test/migrations.test.ts`: apply → 7 bảng tồn tại; **seed task+dod+subtask, chạy migration, assert dữ liệu con CÒN NGUYÊN** (bắt lỗi CASCADE khi table-rebuild — C3/FM1).
7. Ghi runbook: Time-Travel bookmark/export trước `wrangler d1 migrations apply` prod; không có down-migration → forward-fix. (H7/FM5)
8. `ck plan check 1 --start`/`ck plan check 1`.

## Success Criteria
- [ ] 2 spike có kết quả go/no-go + fallback ghi lại.
- [ ] `wrangler dev` boot; `GET /health`→200; smoke xanh.
- [ ] Migration tạo đủ 7 bảng; **test dữ liệu con sống sót qua migration** xanh.
- [ ] Versions pinned; `wrangler.jsonc` không có DO binding.
- [ ] Không file > 200 LOC.

## Risk Assessment
- **D1 CASCADE data-loss khi table-rebuild migration** (C3): FK+CASCADE luôn bật, không tắt per-connection. Mitigation: test dữ liệu-con-sống-sót; với rebuild dùng `PRAGMA defer_foreign_keys=true` + guard tường minh; Time-Travel trước prod.
- **Version incompat** (M3): "latest" có thể vỡ (vitest-pool-workers pin vitest/wrangler; MCP SDK pin zod). Mitigation: pin + ghi compat_date/flags.
- **Spike no-go**: nếu frontend không tách được, fallback markup đã có acceptance; deploy backend không phụ thuộc (P6).
