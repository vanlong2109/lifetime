# Brainstorm — "tiêu điểm": Agent-controllable Task Backend trên Cloudflare

- **Ngày**: 2026-07-13 · **Skill**: `/brainstorm` (no flags)
- **Design source**: Claude Design project `74d5f76b-…` — `Tieu diem.dc.html` (frontend prototype), `Ban giao Backend.dc.html` (spec bàn giao)
- **Trạng thái**: Đã chốt hướng, sẵn sàng `/ck:plan`
- **Nguyên tắc**: YAGNI › KISS › DRY

---

## 1. Problem statement & phạm vi

App quản lý công việc cá nhân ("tiêu điểm") cho **1 người dùng**. Frontend là prototype tương tác đã hoàn thiện, **chạy bằng state tạm trong bộ nhớ trình duyệt**. Cần dựng backend thật thay lớp state đó, **deploy Cloudflare Workers**, và **tối ưu để AI agent điều khiển app dễ nhất** (yêu cầu nhấn mạnh của user).

3 khái niệm cốt lõi backend phải hiểu đúng:
- **Ma trận Eisenhower** — phân loại việc theo `quadrant q1|q2|q3|q4` (user chọn, server không tự suy).
- **DoD (Definition of Done)** — checklist tiêu chí đo được; có thể chặn việc chuyển `done`.
- **Tiến độ tự tính** — `progress` suy ra từ DoD + subtask, **không nhập tay**.

**Trong phạm vi v1**: backend REST + MCP + D1 + auth token, wire frontend prototype vào API, host frontend tĩnh trên cùng Worker → app chạy end-to-end.
**Ngoài phạm vi v1**: nhắc nhở/scheduler, recurring task, time-blocking cấu trúc hoá, ưu tiên tự động, mô hình team/workspace (xem §10).

## 2. Quyết định đã chốt (từ Discovery)

| # | Quyết định | Chọn | Lý do |
|---|---|---|---|
| 1 | Nền tảng deploy | **Cloudflare Workers** | User yêu cầu |
| 2 | Cổng cho agent | **Hybrid REST + MCP** (phương án A) | Đúng yêu cầu "agent điều khiển"; chi phí thêm thấp |
| 3 | Ngôn ngữ/stack | **TypeScript** (Hono + Drizzle + Zod) | Workers-native; Python Workers chưa đủ chín |
| 4 | Lưu trữ | **SQLite → Cloudflare D1** | 1 user, zero-ops, free tier thừa |
| 5 | Auth | **Bearer token** (Workers Secret), `userId` cố định | YAGNI cho 1 user |
| 6 | Phạm vi v1 | **Backend + wire + host frontend** | App chạy được ngay |

## 3. Data model (chốt từ spec)

6 thực thể. `Task` trung tâm; `Subtask` + `DodCriterion` thuộc 1 Task (1–n, xoá cascade).

- **Task**: `id·userId·title(1–200)·quadrant(def q2)·status(def todo)·deadline?·timeBlock?·method?·projectId?·tags[]·position?·progress(TÍNH RA)·createdAt·updatedAt·completedAt?`
- **DodCriterion**: `id·taskId·text·metric?·done(def false)·position`
- **Subtask**: `id·taskId·text·done·position` (như DoD, bỏ `metric`)
- **Project**: `id·userId·name·color·createdAt`
- **Tag**: `id·userId·name` (trim + dedup không phân biệt hoa/thường trong 1 user); quan hệ M2M qua `task_tags`
- **User**: `id·name·email·createdAt` (tối thiểu để scope + auth)

Enum: `quadrant = q1 Làm ngay | q2 Lên lịch | q3 Uỷ thác | q4 Loại bỏ`; `status = todo | doing | done`.

## 4. Kiến trúc: 1-core / 2-adapter (DRY)

```
Zod domain schema + Drizzle schema  ──►  types · validation · OpenAPI · D1 migrations   (1 nguồn sự thật)

Domain (thuần, không I/O):
   progress-calc (4.1) · DoD-gate (4.2) · status-lifecycle (4.3) · dashboard-aggregates (4.4)
        │
        ├──►  REST adapter (Hono + zod-openapi)   →  frontend prototype
        └──►  MCP adapter (McpAgent tools)         →  AI agent
```

Điểm mấu chốt: **REST và MCP gọi cùng service layer** → không lệch hành vi; agent làm được mọi thứ user làm. Đây là hiện thực của "agent dễ điều khiển nhất".

**Ánh xạ Cloudflare**: Worker entry route `/mcp` → `McpAgent` (Durable Object cho MCP session), mọi path khác → Hono; static frontend qua **Workers Assets**; DB qua **D1 binding** + Drizzle; secret token qua `wrangler secret`.

### Cấu trúc thư mục đề xuất (module < 200 LOC, kebab-case)
```
src/
  index.ts              # entry: /mcp → McpAgent, else → Hono, /* → Assets
  env.ts                # bindings types (D1, DO, ASSETS, secret)
  auth/bearer-token.ts
  db/{schema.ts,client.ts}
  domain/{schemas.ts,progress.ts,status-lifecycle.ts,dashboard.ts}
  services/{task,dod,subtask,project,tag,dashboard}-service.ts
  rest/{app.ts,tasks-routes.ts,dod-subtask-routes.ts,dashboard-routes.ts,meta-routes.ts}
  mcp/{agent.ts,tools.ts}
  frontend/             # Tieu diem assets
migrations/             # drizzle-kit → D1
docs/{system-architecture.md,codebase-summary.md}
wrangler.jsonc · drizzle.config.ts
```

## 5. Approaches đã cân (record để lại)

**Stack backend** — TS/Hono ✅ vs Python/FastAPI ❌
- TS thắng: Workers-native, 1 Zod schema → mọi lớp, agent cực mạnh với TS, D1/Drizzle/MCP đều first-class. Python Workers beta, thiếu story D1/MCP.

**Storage** — D1/SQLite ✅ vs Postgres ❌ (dù spec "gợi ý")
- D1 thắng cho 1 user: zero-ops, free, cùng nền Cloudflare, agent inspect dễ. Postgres = thêm hạ tầng, chỉ đáng khi lên team (đã hoãn).

**Agent surface** — A Hybrid ✅ vs B REST-only vs C MCP-first
- A: frontend REST + agent MCP tools từ cùng core → "điều khiển" chuẩn, thêm 1 file adapter mỏng. **Chọn.**
- B: 1 adapter, đơn giản nhất, nhưng agent phải tự dịch OpenAPI, kém "dễ điều khiển".
- C: frontend vẫn cần REST → không tiết kiệm, lệch prototype.

## 6. MCP tool surface (payoff của "agent-controllable")

Tool tự mô tả, input Zod, đều gọi service layer + scope theo `userId` từ token:

- **Task**: `list_tasks{status?,quadrant?,tag?,projectId?}` · `get_task{id}` · `create_task{title,quadrant?,status?,deadline?,timeBlock?,method?,projectId?,tags?}` · `update_task{id,...}` · `move_task{id,quadrant?,status?,position?}` · `delete_task{id}`
- **DoD/Subtask**: `add_dod{taskId,text,metric?}` · `toggle_dod{id,done?}` · `delete_dod{id}` · `add_subtask{taskId,text}` · `toggle_subtask{id,done?}` · `delete_subtask{id}`
- **Meta**: `list_projects` · `create_project{name,color}` · `list_tags` · `create_tag{name}`
- **Dashboard**: `get_dashboard_summary` · `get_productivity{range=7d}`

Nguyên tắc: tên tool bằng động từ rõ nghĩa, mọi ràng buộc §7 kiểm ở service → agent không bao giờ tạo state sai.

## 7. Business rules (bắt buộc ở server)

- **4.1 Progress**: `items = dod + subtasks`; nếu `items>0` → `round(done/total*100)`; nếu rỗng → `{todo:0,doing:40,done:100}[status]`. Trả kèm số thô `dodDone/dodTotal`, `subDone/subTotal` cho client. Nhất quán toàn API.
- **4.2 DoD-gate**: chỉ cho `status→done` khi mọi DoD `done==true`; vi phạm → `422 DOD_INCOMPLETE`. **Có cờ bật/tắt** (config) để không cứng nhắc.
- **4.3 Lifecycle**: cho tiến & lùi trạng thái; vào `done` → set `completedAt`; rời `done` → xoá `completedAt`.
- **4.4 Dashboard**: đếm theo status + tỉ lệ `done/total`; "Cần làm ngay" = `q1 && status!=done`; phân bố góc (task chưa done); năng suất 7 ngày = đếm `completedAt` theo **ngày local**; sắp đến hạn = chưa done + có deadline, sort thời gian còn lại.
- **Validation**: `title` trim 1–200; enum sai → 422; `deadline` ISO date/null; tag trim+dedup; tài nguyên user khác → 403; không tồn tại → 404.
- **Timezone**: lưu UTC; `deadline` = ngày local; chart gom theo ngày local → cần config timezone user (env constant v1).

## 8. Rủi ro & lưu ý (Cloudflare-specific)

- **McpAgent cần Durable Object binding** — thêm 1 primitive; native + gần như free. Nếu muốn tránh DO: cân MCP Streamable-HTTP stateless ở phase plan.
- **D1 giới hạn kích thước query/response** — vô hại quy mô 1 user; list dài **phải phân trang** (spec yêu cầu), giữ `position` ổn định cho kéo-thả.
- **Không filesystem/long-running** trên Workers — hợp task API, nhưng loại luôn các tính năng cần cron/queue (nhắc nhở) khỏi v1.
- **Workers API đổi nhanh** — implementation bám skill `cloudflare`, `agents-sdk`, `wrangler`, `workers-best-practices` để lấy API hiện hành thay vì trí nhớ.
- **Frontend prototype** dùng `x-dc`/`doc-page.js` (Claude Design runtime) — khi host thật cần export ra HTML/asset thuần rồi wire fetch tới REST; đây là công lớn nhất chưa lường hết của v1 (xem §10).

## 9. Success metrics / Acceptance

- Deploy 1 Worker: REST + MCP + D1 + Assets chạy trên Cloudflare.
- Khớp spec: 6 thực thể, enum, 4 nhóm business rule, ~15 REST endpoint, dashboard aggregates.
- **Agent test**: qua MCP, agent tạo task → thêm DoD → toggle DoD → chuyển `done` (bị chặn nếu DoD chưa đủ) → đọc dashboard, tất cả đúng.
- **Parity**: cùng thao tác qua REST (frontend) và MCP cho kết quả state giống hệt.
- Frontend prototype thao tác được đầy đủ trên dữ liệu thật (persist qua reload).

## 10. Unresolved questions (cần chốt ở plan/sau)

1. **Frontend wiring effort**: prototype là Claude Design runtime (`x-dc`), không phải HTML thuần → cần chốt cách export/serve (Workers Assets tĩnh vs build step). Đây là ẩn số công sức lớn nhất.
2. **Timezone user**: v1 hardcode env constant (vd `Asia/Bangkok`) hay để field trong User?
3. **DoD-gate default**: bật hay tắt mặc định cho cờ 4.2?
4. **MCP auth**: static bearer header là đủ cho v1; có cần OAuth khi kết nối từ client MCP bên ngoài không? (mặc định: không — YAGNI)
5. **Deferred (spec §08)**: nhắc nhở/scheduler, time-blocking `{start,end,dayOfWeek}`, ưu tiên tự động, recurring, team/workspace → **không làm v1**, ghi nhận roadmap.

---

**Next step**: `/ck:plan` để chia phase (khuyến nghị mode mặc định — greenfield, chưa có test cần bảo toàn). Truyền báo cáo này làm context.
