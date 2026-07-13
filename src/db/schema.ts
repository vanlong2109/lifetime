import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

// Timestamps stored as epoch-ms integers (deterministic, tz-agnostic at rest).
const nowMs = sql`(unixepoch() * 1000)`;

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name"),
  createdAt: integer("created_at")
    .notNull()
    .default(nowMs),
});

export const projects = sqliteTable(
  "projects",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color"),
    createdAt: integer("created_at").notNull().default(nowMs),
  },
  (t) => [index("projects_user").on(t.userId)],
);

// Unique index on (userId, lower(name)) enforces tag dedup at the DB layer
// (finding C4: no read-then-write in app code).
export const tags = sqliteTable(
  "tags",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: integer("created_at")
      .notNull()
      .default(nowMs),
  },
  (t) => [
    uniqueIndex("tags_user_lower_name").on(t.userId, sql`lower(${t.name})`),
  ],
);

export const tasks = sqliteTable(
  "tasks",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    quadrant: text("quadrant", { enum: ["q1", "q2", "q3", "q4"] }),
    status: text("status", { enum: ["todo", "doing", "done"] })
      .notNull()
      .default("todo"),
    deadline: integer("deadline"),
    timeBlock: text("time_block"),
    method: text("method"),
    projectId: text("project_id").references(() => projects.id, {
      onDelete: "set null",
    }),
    // Fractional/lexicographic rank string -> drag-drop reorder without
    // sibling renumber (finding H2: no reindex race).
    rank: text("rank").notNull(),
    completedAt: integer("completed_at"),
    createdAt: integer("created_at")
      .notNull()
      .default(nowMs),
    updatedAt: integer("updated_at")
      .notNull()
      .default(nowMs),
  },
  (t) => [
    index("tasks_user_status").on(t.userId, t.status),
    index("tasks_user_quadrant").on(t.userId, t.quadrant),
  ],
);

export const taskTags = sqliteTable(
  "task_tags",
  {
    taskId: text("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    tagId: text("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.taskId, t.tagId] })],
);

export const dodCriteria = sqliteTable(
  "dod_criteria",
  {
    id: text("id").primaryKey(),
    taskId: text("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    done: integer("done", { mode: "boolean" }).notNull().default(false),
    rank: text("rank").notNull(),
    createdAt: integer("created_at").notNull().default(nowMs),
  },
  (t) => [index("dod_criteria_task").on(t.taskId)],
);

export const subtasks = sqliteTable(
  "subtasks",
  {
    id: text("id").primaryKey(),
    taskId: text("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    done: integer("done", { mode: "boolean" }).notNull().default(false),
    rank: text("rank").notNull(),
    createdAt: integer("created_at").notNull().default(nowMs),
  },
  (t) => [index("subtasks_task").on(t.taskId)],
);
