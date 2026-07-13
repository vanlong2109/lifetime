import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Db } from "../db/client";
import { DomainError } from "../domain/errors";
import {
  projectCreateShape,
  quadrant,
  status,
  tagCreateShape,
  taskCreateShape,
  taskMoveShape,
  taskPatchShape,
} from "../domain/schemas";
import type { AppContext } from "../services/context";
import {
  getDashboardSummary,
  getProductivity,
} from "../services/dashboard-service";
import { addDod, deleteDod, toggleDod } from "../services/dod-service";
import { createProject, listProjects } from "../services/project-service";
import {
  addSubtask,
  deleteSubtask,
  toggleSubtask,
} from "../services/subtask-service";
import { getTaskDetail, listTasks } from "../services/task-read";
import {
  createTask,
  moveTask,
  patchTask,
  removeTask,
} from "../services/task-service";
import { createTag, listTags } from "../services/tag-service";

type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

const ok = (data: unknown): ToolResult => ({
  content: [{ type: "text", text: JSON.stringify(data) }],
});

// Domain errors surface as tool errors (never a crash); internals stay hidden.
function fail(err: unknown): ToolResult {
  const code = err instanceof DomainError ? err.code : "INTERNAL";
  const message = err instanceof DomainError ? err.message : "internal error";
  if (!(err instanceof DomainError)) console.error("MCP tool error:", err);
  return {
    content: [{ type: "text", text: JSON.stringify({ code, message }) }],
    isError: true,
  };
}

async function run(fn: () => Promise<unknown>): Promise<ToolResult> {
  try {
    return ok(await fn());
  } catch (e) {
    return fail(e);
  }
}

const id = z.string().min(1);

// Registers the full agent-facing tool surface. Each tool only maps input to a
// service call — no business logic here (single source with REST).
export function registerTools(server: McpServer, db: Db, ctx: AppContext): void {
  server.registerTool(
    "list_tasks",
    {
      description: "List the user's tasks, optionally filtered by status/quadrant.",
      inputSchema: { status: status.optional(), quadrant: quadrant.optional() },
    },
    (a) => run(() => listTasks(db, ctx, a)),
  );

  server.registerTool(
    "get_task",
    { description: "Get one task with its DoD, subtasks and progress.", inputSchema: { id } },
    (a) => run(() => getTaskDetail(db, ctx, a.id)),
  );

  server.registerTool(
    "create_task",
    { description: "Create a task.", inputSchema: taskCreateShape },
    (a) => run(() => createTask(db, ctx, a)),
  );

  server.registerTool(
    "update_task",
    {
      description:
        "Update editable task fields. Setting status to done is blocked when the DoD is incomplete.",
      inputSchema: { id, ...taskPatchShape },
    },
    ({ id: taskId, ...patch }) => run(() => patchTask(db, ctx, taskId, patch)),
  );

  server.registerTool(
    "move_task",
    {
      description:
        "Reorder a task (rank) and optionally change its quadrant. Never changes status.",
      inputSchema: { id, ...taskMoveShape },
    },
    ({ id: taskId, ...move }) => run(() => moveTask(db, ctx, taskId, move)),
  );

  server.registerTool(
    "delete_task",
    { description: "Delete a task and its DoD/subtasks.", inputSchema: { id } },
    (a) => run(() => removeTask(db, ctx, a.id)),
  );

  // --- DoD ---
  server.registerTool(
    "add_dod",
    {
      description: "Add a Definition-of-Done criterion to a task.",
      inputSchema: { taskId: id, text: z.string().trim().min(1).max(500) },
    },
    (a) => run(() => addDod(db, ctx, a.taskId, { text: a.text })),
  );
  server.registerTool(
    "toggle_dod",
    {
      description: "Set a DoD criterion done/undone (may revert a done task).",
      inputSchema: { dodId: id, done: z.boolean() },
    },
    (a) => run(() => toggleDod(db, ctx, a.dodId, { done: a.done })),
  );
  server.registerTool(
    "delete_dod",
    { description: "Delete a DoD criterion.", inputSchema: { dodId: id } },
    (a) => run(() => deleteDod(db, ctx, a.dodId)),
  );

  // --- Subtasks ---
  server.registerTool(
    "add_subtask",
    {
      description: "Add a subtask to a task.",
      inputSchema: { taskId: id, title: z.string().trim().min(1).max(200) },
    },
    (a) => run(() => addSubtask(db, ctx, a.taskId, { title: a.title })),
  );
  server.registerTool(
    "toggle_subtask",
    {
      description: "Set a subtask done/undone.",
      inputSchema: { subtaskId: id, done: z.boolean() },
    },
    (a) => run(() => toggleSubtask(db, ctx, a.subtaskId, { done: a.done })),
  );
  server.registerTool(
    "delete_subtask",
    { description: "Delete a subtask.", inputSchema: { subtaskId: id } },
    (a) => run(() => deleteSubtask(db, ctx, a.subtaskId)),
  );

  // --- Meta ---
  server.registerTool(
    "list_projects",
    { description: "List projects.", inputSchema: {} },
    () => run(() => listProjects(db, ctx)),
  );
  server.registerTool(
    "create_project",
    { description: "Create a project.", inputSchema: projectCreateShape },
    (a) => run(() => createProject(db, ctx, a)),
  );
  server.registerTool(
    "list_tags",
    { description: "List tags.", inputSchema: {} },
    () => run(() => listTags(db, ctx)),
  );
  server.registerTool(
    "create_tag",
    { description: "Create (or dedupe) a tag.", inputSchema: tagCreateShape },
    (a) => run(() => createTag(db, ctx, a)),
  );

  // --- Dashboard ---
  server.registerTool(
    "get_dashboard_summary",
    { description: "Task counts, completion rate, quadrant distribution.", inputSchema: {} },
    () => run(() => getDashboardSummary(db, ctx)),
  );
  server.registerTool(
    "get_productivity",
    {
      description: "Completions per local calendar day over a recent window.",
      inputSchema: { days: z.number().int().min(1).max(31).optional() },
    },
    (a) => run(() => getProductivity(db, ctx, a.days ?? 7)),
  );
}
