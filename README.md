# Lifetime

Ứng dụng quản lý công việc cá nhân (single-user) — **điều khiển được bằng AI agent**.

Chạy trên Cloudflare Workers + D1. Một domain core duy nhất, phơi ra qua hai adapter:
một **REST API** cho giao diện web và một **MCP server** cho AI agent. Cùng một logic
nghiệp vụ, cùng một database → agent và người dùng thấy dữ liệu giống hệt nhau.

## Live

- Ứng dụng: <https://your-domain.example.com>
- Worker (fallback): <https://tieu-diem-backend.your-subdomain.workers.dev>
- `GET /health` công khai (không cần auth); mọi `/api/*` và `/mcp` cần bearer token.

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

## Deploy

Chi tiết + lưu ý an toàn migration xem [`docs/deployment-guide.md`](docs/deployment-guide.md).
Tóm tắt redeploy:

```bash
npm test
wrangler d1 migrations apply tieu-diem-db --remote   # chỉ khi có migration mới
npm run deploy
```

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

Endpoint MCP: `POST /mcp` (Streamable-HTTP). Thêm vào **Claude Code**:

```bash
claude mcp add --transport http lifetime https://your-domain.example.com/mcp \
  --header "Authorization: Bearer <AUTH_TOKEN>"
```

(Thay `<AUTH_TOKEN>` bằng đúng giá trị secret đang set. Đổi secret thì chạy lại lệnh
này với giá trị mới.)

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

Dùng cá nhân.
