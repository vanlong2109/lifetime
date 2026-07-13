import type { AppContext } from "./services/context";
import type { Db } from "./db/client";

// App-level bindings. Explicit (not the generated `Env`) so lower layers do not
// depend on generated worker types. No Durable Object (finding H1).
export interface AppBindings {
  DB: D1Database;
  AUTH_TOKEN?: string; // Workers Secret — optional so fail-closed can be tested
  APP_USER_ID: string; // fixed single-user id
  APP_TIMEZONE: string; // e.g. "Asia/Bangkok"
  DOD_GATE_ENABLED?: string; // "false" disables the DoD-gate
  ASSETS?: Fetcher; // static host, wired in Phase 6
}

// Hono per-request variables set by the auth middleware after verification.
export interface AppVariables {
  db: Db;
  ctx: AppContext;
}

export type AppEnv = { Bindings: AppBindings; Variables: AppVariables };
