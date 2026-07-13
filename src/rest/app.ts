import { Hono } from "hono";
import { isAuthorized } from "../auth/bearer-token";
import { createDb } from "../db/client";
import type { AppEnv } from "../env";
import { createContext } from "../services/context";
import { ensureUser } from "../services/user-service";
import { dashboardRoutes } from "./dashboard-routes";
import { dodRoutes, subtaskRoutes } from "./dod-subtask-routes";
import { errorHandler } from "./errors";
import { projectRoutes, tagRoutes } from "./meta-routes";
import { tasksRoutes } from "./tasks-routes";

export function createRestApp() {
  const app = new Hono<AppEnv>();

  // Public smoke endpoint.
  app.get("/health", (c) => c.json({ status: "ok" }));

  // Fail-closed bearer auth on every /api route (findings C1/M1). After verify,
  // bootstrap the user row and build the request context.
  app.use("/api/*", async (c, next) => {
    if (!isAuthorized(c.req.header("Authorization"), c.env.AUTH_TOKEN)) {
      return c.json({ code: "UNAUTHORIZED" }, 401);
    }
    const db = createDb(c.env.DB);
    const now = Date.now();
    await ensureUser(db, c.env.APP_USER_ID, now);
    c.set("db", db);
    c.set(
      "ctx",
      createContext({
        userId: c.env.APP_USER_ID,
        timeZone: c.env.APP_TIMEZONE,
        gateEnabled: c.env.DOD_GATE_ENABLED !== "false",
      }),
    );
    await next();
  });

  app.route("/api/tasks", tasksRoutes);
  app.route("/api/dod", dodRoutes);
  app.route("/api/subtasks", subtaskRoutes);
  app.route("/api/dashboard", dashboardRoutes);
  app.route("/api/projects", projectRoutes);
  app.route("/api/tags", tagRoutes);

  app.onError(errorHandler);
  return app;
}
