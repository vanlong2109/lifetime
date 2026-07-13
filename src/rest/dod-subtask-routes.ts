import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { AppEnv } from "../env";
import { Toggle } from "../domain/schemas";
import { deleteDod, toggleDod } from "../services/dod-service";
import { deleteSubtask, toggleSubtask } from "../services/subtask-service";
import { validationHook } from "./errors";

// Mounted at /api/dod. Child add is under /api/tasks/:id/dod (tasks-routes).
export const dodRoutes = new Hono<AppEnv>();

dodRoutes.patch("/:dodId", zValidator("json", Toggle, validationHook), async (c) =>
  c.json(
    await toggleDod(
      c.get("db"),
      c.get("ctx"),
      c.req.param("dodId"),
      c.req.valid("json"),
    ),
  ),
);

dodRoutes.delete("/:dodId", async (c) =>
  c.json(await deleteDod(c.get("db"), c.get("ctx"), c.req.param("dodId"))),
);

// Mounted at /api/subtasks.
export const subtaskRoutes = new Hono<AppEnv>();

subtaskRoutes.patch(
  "/:subId",
  zValidator("json", Toggle, validationHook),
  async (c) =>
    c.json(
      await toggleSubtask(
        c.get("db"),
        c.get("ctx"),
        c.req.param("subId"),
        c.req.valid("json"),
      ),
    ),
);

subtaskRoutes.delete("/:subId", async (c) =>
  c.json(await deleteSubtask(c.get("db"), c.get("ctx"), c.req.param("subId"))),
);
