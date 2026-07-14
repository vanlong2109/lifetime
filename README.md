# Lifetime

Ứng dụng quản lý công việc cá nhân (single-user) — **điều khiển được bằng AI agent**.

Chạy trên Cloudflare Workers + D1. Một domain core duy nhất, phơi ra qua hai adapter:
một **REST API** cho giao diện web và một **MCP server** cho AI agent. Cùng một logic
nghiệp vụ, cùng một database → agent và người dùng thấy dữ liệu giống hệt nhau.

> Đây là **mã nguồn** để bạn **tự deploy một bản của riêng mình** lên Cloudflare Workers
> (chạy trọn trong hạn mức **Free**), rồi điều khiển bằng AI agent qua MCP.
> Bắt đầu ở [Tự host lên Cloudflare Workers](#tự-host-lên-cloudflare-workers).

Sau khi deploy: `GET /health` công khai (không cần auth); mọi `/api/*` và `/mcp` cần bearer token.

## Tính năng

- **Ma trận Eisenhower** (`q1`–`q4`) và **bảng Kanban** (`todo` / `doing` / `done`).
- **Definition of Done (DoD)**: tiêu chí rõ ràng, đo được cho từng việc.
- **Subtask** (các bước). `progress` tự tính từ DoD + subtask đã xong.
- **DoD-gate**: chưa đủ DoD thì không cho chuyển `done` (bật/tắt qua `DOD_GATE_ENABLED`).
- **Dashboard**: tổng quan hôm nay + biểu đồ năng suất theo ngày.
- **18 MCP tool** để agent tạo/sửa/di chuyển/xoá việc và đọc dashboard.

## Kiến trúc

Mô hình **1-core / 2-adapter**:

```
        ┌─────────────┐   REST (Hono)   ┌──────────────┐
        │  Web UI      │ ──────────────▶ │              │
        │ (public/)    │   /api/*        │  Domain core │──▶ D1 (SQLite)
        └─────────────┘                  │  (services)  │   qua Drizzle ORM
        ┌─────────────┐   MCP (JSON-RPC) │              │
        │  AI agent    │ ──────────────▶ │              │
        │ (Claude…)    │   /mcp          └──────────────┘
        └─────────────┘
```

- **Stack:** TypeScript, [Hono](https://hono.dev), [Drizzle ORM](https://orm.drizzle.team),
  [Zod](https://zod.dev), [MCP SDK](https://modelcontextprotocol.io).
- **MCP** dùng Streamable-HTTP **stateless** (không Durable Object) — chạy gọn trong workerd.
- Frontend là ES modules thuần trong `public/`, host bằng Workers Assets
  (`run_worker_first: true` để Worker dispatch `/api` và `/mcp` trước, còn lại trả assets).

## Bắt đầu (dev)

```bash
npm install
npm test            # bộ test vitest chạy trên D1 thật (workers pool)
npm run dev         # wrangler dev, phục vụ cả API + frontend cục bộ
```

## Tự host lên Cloudflare Workers

App là **single-user**: mỗi bản deploy = một người dùng, một `AUTH_TOKEN`, một database D1.
Mỗi người **tự chạy một bản riêng**, chạy trọn trong hạn mức **Cloudflare Free**.

### Chuẩn bị
- **Node ≥ 20** và npm.
- Tài khoản [Cloudflare](https://dash.cloudflare.com) (gói Free là đủ).
- Đăng nhập wrangler: `npx wrangler login` (mở trình duyệt để xác thực).

### Các bước

**1) Clone & cài đặt**
```bash
git clone https://github.com/vanlong2109/lifetime.git
cd lifetime
npm install
```

**2) Tạo D1 database của bạn**
```bash
npx wrangler d1 create lifetime-db
```
Lệnh in ra một khối cấu hình kèm `database_id` — **copy giá trị `database_id`** đó.

**3) Tạo `wrangler.jsonc` từ file mẫu rồi điền giá trị của bạn**
```bash
cp wrangler.jsonc.example wrangler.jsonc
```
Mở `wrangler.jsonc` và sửa:
- `name` → tên worker của bạn, ví dụ `lifetime-<tên-bạn>`.
- `d1_databases[0].database_id` → dán `database_id` tạo ở bước 2 (giữ `database_name` = `lifetime-db` cho khớp).
- *(tuỳ chọn)* custom domain: bỏ comment khối `"routes"` và điền domain **bạn sở hữu**; không thì để nguyên, app chạy ở `https://<name>.<subdomain>.workers.dev` (nhờ `"workers_dev": true`).
- *(tuỳ chọn)* đổi `vars.APP_TIMEZONE` sang múi giờ của bạn.

> `wrangler.jsonc` đã nằm trong `.gitignore` — giá trị riêng của bạn **không bị commit**.

**4) Tạo bảng (migration) rồi deploy**
```bash
npx wrangler d1 migrations apply lifetime-db --remote
npm run deploy
```
Deploy xong, wrangler in ra URL `https://<name>.<subdomain>.workers.dev` — **URL này là của bạn**, ghi lại để dùng ở bước MCP.

**5) Đặt mật khẩu/token truy cập**
```bash
npx wrangler secret put AUTH_TOKEN
```
Nhập một chuỗi mạnh (token ngẫu nhiên **hoặc** mật khẩu cá nhân) — đây là "chìa khoá" chung cho cả web lẫn agent. App **fail-closed**: chưa đặt secret này thì mọi `/api` và `/mcp` đều bị từ chối.

**6) Kiểm tra**
```bash
curl https://<name>.<subdomain>.workers.dev/health     # phải trả {"status":"ok",...}
```
Mở URL đó trên trình duyệt để vào giao diện web (đăng nhập bằng chính `AUTH_TOKEN`).

> **Deploy lại sau khi sửa code:** `npm test` → (nếu có migration mới) `npx wrangler d1 migrations apply lifetime-db --remote` → `npm run deploy`.
> Lưu ý an toàn migration, xoay token, Time-Travel: xem [`docs/deployment-guide.md`](docs/deployment-guide.md).

## Auth

Auth = **bearer token** so khớp hằng-thời-gian với Workers Secret `AUTH_TOKEN`
(fail-closed: chưa set secret thì mọi request bị từ chối). Không có ràng buộc định dạng
nên giá trị có thể là token ngẫu nhiên **hoặc một mật khẩu ghi nhớ cá nhân**.

```bash
wrangler secret put AUTH_TOKEN     # đặt / đổi mật khẩu (nhập ẩn, không lộ ra ngoài)
```

Đổi secret có hiệu lực sau vài giây (edge propagation). Mọi client (web + MCP) phải
gửi cùng giá trị này.

## Dùng với AI agent (MCP)

Sau khi [tự host](#tự-host-lên-cloudflare-workers), nối agent vào MCP server của **bạn**:

- **Endpoint:** `POST https://<name>.<subdomain>.workers.dev/mcp` (Streamable-HTTP, stateless)
- **Header:** `Authorization: Bearer <AUTH_TOKEN>` (đúng token đã `secret put`)

Bên dưới, thay `<MCP_URL>` = URL `/mcp` của bạn, `<AUTH_TOKEN>` = token của bạn.

### Claude Code (CLI)
```bash
claude mcp add --transport http lifetime <MCP_URL> \
  --header "Authorization: Bearer <AUTH_TOKEN>"
```
Kiểm tra: `claude mcp list` → thấy `lifetime` ✓ Connected. Gỡ: `claude mcp remove lifetime`.

### Claude Desktop
Settings → Developer → **Edit Config** (mở `claude_desktop_config.json`). Claude Desktop chỉ nhận MCP dạng lệnh nên bắc cầu qua `mcp-remote`:
```jsonc
{
  "mcpServers": {
    "lifetime": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "<MCP_URL>",
               "--header", "Authorization: Bearer <AUTH_TOKEN>"]
    }
  }
}
```
Lưu file rồi khởi động lại Claude Desktop.

### Cursor
Tạo `.cursor/mcp.json` (theo project) hoặc `~/.cursor/mcp.json` (global) — Cursor hỗ trợ MCP HTTP trực tiếp:
```jsonc
{
  "mcpServers": {
    "lifetime": {
      "url": "<MCP_URL>",
      "headers": { "Authorization": "Bearer <AUTH_TOKEN>" }
    }
  }
}
```

### Client khác
Bất kỳ client hỗ trợ "custom MCP connector" (Claude.ai web, VS Code…): thêm connector kiểu HTTP với URL `<MCP_URL>` và header `Authorization: Bearer <AUTH_TOKEN>`.

Muốn thử endpoint bằng `curl` (handshake `initialize` → `tools/list`): xem mục *Auth / usage* trong [`docs/deployment-guide.md`](docs/deployment-guide.md).

18 tool, gồm:

| Nhóm | Tool |
| --- | --- |
| Task | `list_tasks`, `get_task`, `create_task`, `update_task`, `move_task`, `delete_task` |
| DoD | `add_dod`, `toggle_dod`, `delete_dod` |
| Subtask | `add_subtask`, `toggle_subtask`, `delete_subtask` |
| Dự án & nhãn | `list_projects`, `create_project`, `list_tags`, `create_tag` |
| Thống kê | `get_dashboard_summary`, `get_productivity` |

## Cấu trúc thư mục

```
src/
  domain/      # entity, schema Zod, progress, status-lifecycle (thuần, không I/O)
  services/    # domain core: task/dod/subtask/tag/project/dashboard + rank, ownership
  rest/        # adapter REST (Hono): routes + error mapping
  mcp/         # adapter MCP: server + 18 tool
  auth/        # bearer-token (constant-time compare, fail-closed)
  db/          # Drizzle schema + client
public/        # frontend ES modules (index.html + app-*.js), host qua Workers Assets
migrations/    # D1 SQL migrations (chỉ additive/in-place — xem deployment-guide)
test/          # vitest trên @cloudflare/vitest-pool-workers
docs/          # deployment-guide, spike-notes
```

## Giấy phép

[MIT](LICENSE) — tự do dùng, sửa, fork, tự host; chỉ cần giữ ghi công tác giả. Không bảo hành.
