# Deployment Guide — tiêu điểm backend

Cloudflare Workers + D1. Backend is `/api/*` (REST) + `/mcp` (MCP) on one Worker.

## Deployment reference

- Worker URL: `https://<your-worker>.<subdomain>.workers.dev` (hoặc custom domain của bạn)
- D1 database: tạo bằng `wrangler d1 create <your-db>`, dán `database_id` vào `wrangler.jsonc`
- Migrations: `0000_init`, `0001_add_child_indexes`
- Config: `wrangler.jsonc` (binding `DB`; vars `APP_USER_ID`, `APP_TIMEZONE`, `DOD_GATE_ENABLED`)
- Secret: `AUTH_TOKEN` (Workers Secret; NOT in the repo). Fail-closed — chưa set thì mọi `/api` và `/mcp` bị từ chối.

## First-time deploy (from scratch)

```bash
npm install
wrangler d1 create <your-db>           # copy database_id into wrangler.jsonc
wrangler d1 migrations apply <your-db> --remote
wrangler deploy
wrangler secret put AUTH_TOKEN            # paste a strong random token
```

## Redeploy after code changes

```bash
npm run test                              # 87 tests must pass
npm run db:generate                       # only if src/db/schema.ts changed
wrangler d1 migrations apply <your-db> --remote   # only if a new migration exists
wrangler deploy
```

## Migration safety (finding C3)

Migrations MUST be additive / in-place (`ALTER TABLE ADD/DROP/RENAME COLUMN`,
`CREATE INDEX`). NEVER drop+recreate a table that has `ON DELETE CASCADE`
children while data exists — in D1 the cascade fires on `DROP TABLE` even with
`PRAGMA defer_foreign_keys` (proven in `test/migrations.test.ts`), deleting the
children. Before any prod migration on a non-empty DB, take a Time-Travel
bookmark (`wrangler d1 time-travel info <your-db>`); there are no
down-migrations — recover by forward-fix or Time-Travel restore.

## Secret rotation

```bash
wrangler secret put AUTH_TOKEN            # set a new value
# then update the client(s) to send the new bearer token
```

Rotation takes effect within seconds (edge propagation). Note: immediately after
`secret put`, allow a few seconds before smoke-testing — propagation is not
instant across all edge locations.

## Auth / usage

Every `/api/*` and `/mcp` request needs `Authorization: Bearer <AUTH_TOKEN>`.

```bash
# REST
curl -H "Authorization: Bearer $TOKEN" https://<worker>/api/tasks

# MCP (Streamable-HTTP, stateless): initialize handshake, then tools/list, tools/call
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "content-type: application/json" \
  -H "accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"c","version":"0"}}}' \
  https://<worker>/mcp
```

`/health` is public (no auth). Public smoke: `curl https://<worker>/health`.
