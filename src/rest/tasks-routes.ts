import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { AppEnv } from "../env";
import {
  DodCreate,
  quadrant,
  status,
  SubtaskCreate,
  TaskCreate,
  TaskMove,
  TaskPatch,
} from "../domain/schemas";
import { addDod } from "../services/dod-service";
import { addSubtask } from "../services/subtask-service";
import { getTaskDetail, listTasks, type TaskFilter } from "../services/task-read";
import {
  createTask,
  moveTask,
  patchTask,
  removeTask,
} from "../services/task-service";
import { validationHook } from "./errors";

// Mounted at /api/tasks. Status changes only via PATCH (through the gate);
// move handles rank/quadrant only.
export const tasksRoutes = new Hono<AppEnv>();

tasksRoutes.get("/", async (c) => {
  const filter: TaskFilter = {};
  const s = status.safeParse(c.req.query("status"));
  if (s.success) filter.status = s.data;
  const q = quadrant.safeParse(c.req.query("quadrant"));
  if (q.success) filter.quadrant = q.data;
  return c.json(await listTasks(c.get("db"), c.get("ctx"), filter));
});

tasksRoutes.post("/", zValidator("json", TaskCreate, validationHook), async (c) =>
  c.json(await createTask(c.get("db"), c.get("ctx"), c.req.valid("json")), 201),
);

tasksRoutes.get("/:id", async (c) =>
  c.json(await getTaskDetail(c.get("db"), c.get("ctx"), c.req.param("id"))),
);

tasksRoutes.patch(
  "/:id",
  zValidator("json", TaskPatch, validationHook),
  async (c) =>
    c.json(
      await patchTask(
        c.get("db"),
        c.get("ctx"),
        c.req.param("id"),
        c.req.valid("json"),
      ),
    ),
);

tasksRoutes.delete("/:id", async (c) =>
  c.json(await removeTask(c.get("db"), c.get("ctx"), c.req.param("id"))),
);

tasksRoutes.patch(
  "/:id/move",
  zValidator("json", TaskMove, validationHook),
  async (c) =>
    c.json(
      await moveTask(
        c.get("db"),
        c.get("ctx"),
        c.req.param("id"),
        c.req.valid("json"),
      ),
    ),
);

tasksRoutes.post(
  "/:id/dod",
  zValidator("json", DodCreate, validationHook),
  async (c) =>
    c.json(
      await addDod(
        c.get("db"),
        c.get("ctx"),
        c.req.param("id"),
        c.req.valid("json"),
      ),
      201,
    ),
);

tasksRoutes.post(
  "/:id/subtasks",
  zValidator("json", SubtaskCreate, validationHook),
  async (c) =>
    c.json(
      await addSubtask(
        c.get("db"),
        c.get("ctx"),
        c.req.param("id"),
        c.req.valid("json"),
      ),
      201,
    ),
);
