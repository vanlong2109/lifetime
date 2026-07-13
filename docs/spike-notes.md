# Phase 1 Spike Notes & Runbook

Backend for "tiêu điểm" — Cloudflare Workers + D1. Records de-risk spike outcomes,
pinned versions, and the D1 migration-safety runbook.

## Spike 1 — Frontend export (`Tieu diem.dc.html`)

**Decision: DEFERRED (no-go for now).** Source `.dc.html` not present in repo.
Per user scope decision, backend is built + tested first (P1–P5); frontend (P6)
deferred until the file is provided. Backend deploy is decoupled from export
(global acceptance already met independently at P4/P5).

**Fallback acceptance (when P6 runs):** if the `x-dc` runtime cannot be cleanly
extracted, hand-build minimal static markup covering the required screens/states:
dashboard aggregates, Eisenhower matrix (q1–q4), Kanban columns (todo/doing/done),
task drawer (DoD list, subtasks, method, timeBlock, progress). Wire to `/api/*`,
render task-authored text escaped (finding M4).

## Spike 2 — MCP transport testability

**Decision: GO (stateless).** `@cloudflare/vitest-pool-workers` runs tests inside
workerd against real local D1, and `SELF.fetch()` dispatches into the Worker
entrypoint (proven by `test/health.test.ts`). This is the exact mechanism the P5
MCP + serial-parity tests use: drive `/mcp` over HTTP via `SELF.fetch`.

**P5 plan:** stateless Streamable-HTTP, no Durable Object (finding H1). Primary =
in-vitest HTTP against `/mcp`. Fallback if an MCP client-in-vitest proves awkward:
handler-level assertions + a `wrangler dev` smoke, with transport-parity noted as
out of auto-scope.

## Pinned versions (findings M3 / H4)

| Package | Pin | Why |
|---|---|---|
| `zod` | 4.4.3 | single source for REST + MCP; both consumers support v4 |
| `@modelcontextprotocol/sdk` | 1.29.0 | supports zod `^3.25 \|\| ^4.0`; peer `@cfworker/json-schema@4.1.1` |
| `hono` / `@hono/zod-validator` | 4.12.30 / 0.8.0 | validator supports zod v4 |
| `drizzle-orm` / `drizzle-kit` | 0.45.2 / 0.31.10 | D1/SQLite |
| `vitest` | 4.1.10 | required by pool-workers 0.18 |
| `@cloudflare/vitest-pool-workers` | 0.18.4 | vitest-4 API: `cloudflareTest()` plugin (not `defineWorkersConfig`) |
| `wrangler` | 4.110.0 | matches pool's bundled wrangler |
| compatibility_date | 2026-07-08 | matches pool's miniflare; flag `nodejs_compat` |

Note: pool-workers 0.16+ moved to vitest 4 and dropped the `/config` subpath +
`defineWorkersConfig`; config now uses the `cloudflareTest` Vite plugin. Per-test
storage isolation is built in but did NOT roll back D1 writes across tests in this
setup — tests use an explicit `resetDb()` (`test/helpers/db-reset.ts`) in
`beforeEach`.

## D1 migration-safety runbook (finding C3 — CORRECTED)

**Empirical result (`test/migrations.test.ts`):** in D1 the FK constraint is always
enforced and cannot be disabled per-connection. `DROP TABLE tasks` fires
`ON DELETE CASCADE` on children (dod_criteria, subtasks) **even inside a `batch()`
with `PRAGMA defer_foreign_keys=TRUE`** — `defer` postpones constraint *checking*,
not the cascade *action*. Children are lost. The plan's original "defer + guard"
mitigation is INSUFFICIENT for table rebuilds.

**Committed strategy:**
1. Migrations MUST be additive / in-place. Modern SQLite (D1) supports
   `ALTER TABLE ... ADD/DROP/RENAME COLUMN` natively — no rebuild needed for the
   common cases. In-place ALTER never touches cascade children (locked by test).
2. NEVER `DROP` a table that is the target of `ON DELETE CASCADE` FKs while child
   rows exist (locked by an executable "forbidden" test asserting children vanish).
3. If a rebuild is truly unavoidable: snapshot child rows out, rebuild, re-insert —
   during a maintenance window, with a Time-Travel bookmark taken first.

**Before every prod `wrangler d1 migrations apply`:**
- Take a Time-Travel bookmark / export (`wrangler d1 export` or note the timestamp).
- No down-migrations — recovery is forward-fix or Time-Travel restore.
