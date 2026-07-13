---
phase: 5
title: "MCP Adapter"
status: done
priority: P1
dependencies: [3]
---

# Phase 5: MCP Adapter

## Overview
Remote MCP server **stateless Streamable-HTTP** (MCP TypeScript SDK, **không Durable Object**) trên cùng Worker, phơi service layer thành tool tự mô tả cho AI agent. Payoff cốt lõi: agent điều khiển app qua cùng service với REST. Có **auth gate riêng** + **parity test serial**.

> Dep = [3]: MCP adapter chỉ cần service layer. Parity checkpoint chạy khi cả P4 + P5 xong (P6 blockedBy cả hai).

## Requirements
- Functional: ~18 tool (bảng dưới), input Zod (dùng `.shape` từ P2 — H4), **auth bearer verify trước handler (C1)**, scope `userId`, lỗi domain rõ ràng (không crash).
- Non-functional: `mcp/tools.ts` chỉ map tool→service; không lặp business logic; **không giữ state cache** (đọc/ghi D1 mỗi lần — H5/FM7).

## Architecture
- **Transport (H1, user chốt)**: stateless Streamable-HTTP qua MCP TS SDK — mỗi request tự chứa, không session DO, không migration DO. (Nếu spike P1 báo cần state → mới cân, mặc định KHÔNG.)
- **Auth (C1)**: `src/index.ts` (hoặc handler `/mcp`) **verify bearer TRƯỚC khi dispatch**; thiếu/sai token → từ chối, không tạo `AppContext`. Test cả *missing* token.
- `mcp/tools.ts`: tool = { name, description rõ nghĩa (agent-friendly), zodShape (từ P2 `.shape`), handler→service }. Tái dùng Zod (H4).
- `mcp/server.ts`: khởi tạo MCP server stateless, đăng ký tools, dựng `AppContext` như REST sau verify.
- `src/index.ts`: route `/mcp` → server (theo dispatch order P4).

## Tool surface
- Task: `list_tasks`, `get_task`, `create_task`, `update_task`, `move_task` (rank/quadrant, KHÔNG status), `delete_task`
- DoD/Subtask: `add_dod`, `toggle_dod`, `delete_dod`, `add_subtask`, `toggle_subtask`, `delete_subtask`
- Meta: `list_projects`, `create_project`, `list_tags`, `create_tag`
- Dashboard: `get_dashboard_summary`, `get_productivity`

## Related Code Files
- Create: `src/mcp/server.ts`, `src/mcp/tools.ts`
- Modify: `src/index.ts` (route `/mcp` + auth gate)
- Create: `test/mcp/tools.test.ts`, `test/mcp/auth.test.ts`, `test/mcp/parity.test.ts`, `test/mcp/no-cached-state.test.ts`

## Implementation Steps
1. **(RED)** `auth.test.ts` (C1): gọi `/mcp` **không token → từ chối**; sai token → từ chối; đúng → qua.
2. Implement `mcp/server.ts` (stateless) + `mcp/tools.ts`; route `/mcp` + auth gate → GREEN. (Theo spike P1: test qua MCP client trong vitest, hoặc handler-level + `wrangler dev` smoke.)
3. **(RED→GREEN)** `tools.test.ts`: `create_task`→D1 có task; `add_dod`+`toggle_dod`→progress đổi; `move_task` không đổi status; DoD-gate trả lỗi tool `DOD_INCOMPLETE` (không crash).
4. **(RED→GREEN)** `no-cached-state.test.ts` (H5/FM7): 2 lệnh liên tiếp phản ánh D1 mới nhất; tool không cache task list.
5. **(RED→GREEN)** `parity.test.ts` (H5/AD3/FM7) — **SERIAL**: chạy kịch bản qua REST → snapshot S1 → **reset D1** → chạy qua MCP → S2; assert S1==S2 (loại id/timestamp autogen; định nghĩa rõ bảng/cột so sánh). KHÔNG song song.
6. Refactor mô tả tool. `ck plan check 5`.

## Success Criteria
- [ ] ~18 tool hoạt động; input validate bằng Zod `.shape` (H4).
- [ ] **Auth gate: `/mcp` không token → từ chối** (C1), test-verified.
- [ ] Tool không giữ state cache; đọc D1 mỗi lần (H5).
- [ ] **Parity serial xanh**: REST và MCP cho cùng state (H5).
- [ ] Lỗi domain trả dạng lỗi tool rõ ràng; `mcp/tools.ts` không có business logic.

## Risk Assessment
- **MCP transport testability** (H5/AD2): đã spike ở P1. Nếu client-in-vitest khó → handler-level + `wrangler dev` smoke; ghi rõ transport-parity ngoài phạm vi auto nếu buộc.
- **MCP SDK ↔ zod version** (H4): pin ở P1; `.shape` reuse có test P2.
- **Parity flaky nếu chạy song song** (H5): đã đổi sang serial + reset D1.
