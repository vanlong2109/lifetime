import { Hono } from "hono";
import type { AppEnv } from "../env";
import {
  getDashboardSummary,
  getProductivity,
} from "../services/dashboard-service";

// Mounted at /api/dashboard.
export const dashboardRoutes = new Hono<AppEnv>();

dashboardRoutes.get("/summary", async (c) =>
  c.json(await getDashboardSummary(c.get("db"), c.get("ctx"))),
);

dashboardRoutes.get("/productivity", async (c) => {
  const raw = Number(c.req.query("days"));
  const days = Number.isFinite(raw) ? Math.min(31, Math.max(1, raw)) : 7;
  return c.json(await getProductivity(c.get("db"), c.get("ctx"), days));
});
