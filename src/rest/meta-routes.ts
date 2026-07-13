import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { AppEnv } from "../env";
import { ProjectCreate, TagCreate } from "../domain/schemas";
import { createProject, listProjects } from "../services/project-service";
import { createTag, listTags } from "../services/tag-service";
import { validationHook } from "./errors";

// Mounted at /api/projects.
export const projectRoutes = new Hono<AppEnv>();

projectRoutes.get("/", async (c) =>
  c.json(await listProjects(c.get("db"), c.get("ctx"))),
);

projectRoutes.post(
  "/",
  zValidator("json", ProjectCreate, validationHook),
  async (c) =>
    c.json(await createProject(c.get("db"), c.get("ctx"), c.req.valid("json")), 201),
);

// Mounted at /api/tags.
export const tagRoutes = new Hono<AppEnv>();

tagRoutes.get("/", async (c) =>
  c.json(await listTags(c.get("db"), c.get("ctx"))),
);

tagRoutes.post("/", zValidator("json", TagCreate, validationHook), async (c) =>
  c.json(await createTag(c.get("db"), c.get("ctx"), c.req.valid("json")), 201),
);
