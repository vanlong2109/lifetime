import { z } from "zod";

// Single source of truth for domain shapes. Each entity exposes a raw ZodRawShape
// (reused directly by MCP tools — finding H4) plus a strict z.object for REST
// validation. `.strict()` rejects unknown keys, blocking mass-assignment of
// computed fields like progress/completedAt (finding H6).

export const quadrant = z.enum(["q1", "q2", "q3", "q4"]);
export const status = z.enum(["todo", "doing", "done"]);
export type Quadrant = z.infer<typeof quadrant>;
export type TaskStatus = z.infer<typeof status>;

const title = z.string().trim().min(1).max(200);
const deadline = z.number().int().nullable();
const timeBlock = z.string().max(200).nullable();
const method = z.string().max(4000).nullable();
const projectId = z.string().min(1).nullable();
const tagList = z.array(z.string().trim().min(1).max(50)).max(50);

// --- Task create ---
export const taskCreateShape = {
  title,
  quadrant: quadrant.optional(),
  status: status.optional(),
  deadline: deadline.optional(),
  timeBlock: timeBlock.optional(),
  method: method.optional(),
  projectId: projectId.optional(),
  tags: tagList.optional(),
} as const;
export const TaskCreate = z.object(taskCreateShape).strict();
export type TaskCreateInput = z.infer<typeof TaskCreate>;

// --- Task patch (whitelist; all optional; strict rejects computed fields) ---
export const taskPatchShape = {
  title: title.optional(),
  quadrant: quadrant.nullable().optional(),
  status: status.optional(),
  deadline: deadline.optional(),
  timeBlock: timeBlock.optional(),
  method: method.optional(),
  projectId: projectId.optional(),
  tags: tagList.optional(),
} as const;
export const TaskPatch = z.object(taskPatchShape).strict();
export type TaskPatchInput = z.infer<typeof TaskPatch>;

// --- Move (rank/quadrant only; never status — finding C2/H2) ---
export const taskMoveShape = {
  // Place the task between two existing siblings in the ordered list.
  prevId: z.string().min(1).nullable().optional(),
  nextId: z.string().min(1).nullable().optional(),
  quadrant: quadrant.optional(),
} as const;
export const TaskMove = z.object(taskMoveShape).strict();
export type TaskMoveInput = z.infer<typeof TaskMove>;

// --- DoD / subtask ---
export const dodCreateShape = { text: z.string().trim().min(1).max(500) } as const;
export const DodCreate = z.object(dodCreateShape).strict();

export const subtaskCreateShape = {
  title: z.string().trim().min(1).max(200),
} as const;
export const SubtaskCreate = z.object(subtaskCreateShape).strict();

export const toggleShape = { done: z.boolean() } as const;
export const Toggle = z.object(toggleShape).strict();

// --- Meta ---
export const projectCreateShape = {
  name: z.string().trim().min(1).max(100),
  color: z.string().max(20).nullable().optional(),
} as const;
export const ProjectCreate = z.object(projectCreateShape).strict();

export const tagCreateShape = {
  name: z.string().trim().min(1).max(50),
} as const;
export const TagCreate = z.object(tagCreateShape).strict();
